import { spawn } from 'node:child_process';
import { createHash, createHmac } from 'node:crypto';
import { once } from 'node:events';
import {
  readFileSync,
  writeFileSync,
} from 'node:fs';
import http from 'node:http';
import { performance } from 'node:perf_hooks';
import { setTimeout as delay } from 'node:timers/promises';

function canonicalValue(value) {
  if (Array.isArray(value)) return value.map(canonicalValue);
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.keys(value)
        .filter((key) => value[key] !== undefined)
        .sort()
        .map((key) => [key, canonicalValue(value[key])]),
    );
  }
  return value;
}

const canonicalJson = (value) => JSON.stringify(canonicalValue(value));
const sha256 = (value) => createHash('sha256').update(value).digest('hex');
const readJson = (file) => JSON.parse(readFileSync(file, 'utf8'));
const hostPid = () => Number(
  readFileSync('/proc/self/status', 'utf8')
    .match(/^NSpid:\s+([0-9]+)/mu)?.[1] || process.pid,
);

async function waitForJson(file) {
  for (let attempt = 0; attempt < 500; attempt += 1) {
    try {
      return readJson(file);
    } catch {
      await delay(10);
    }
  }
  throw new Error(`timed out waiting for ${file}`);
}

function processStartFingerprint(pid) {
  const raw = readFileSync(`/proc/${pid}/stat`, 'utf8');
  const fields = raw.slice(raw.lastIndexOf(')') + 2).trim().split(/\s+/u);
  return sha256(`${pid}:${fields[19]}`);
}

function args(argv) {
  return Object.fromEntries(
    Array.from({ length: (argv.length - 2) / 2 }, (_, index) => [
      argv[2 + index * 2].slice(2),
      argv[3 + index * 2],
    ]),
  );
}

if (process.argv[2] === 'gateway') {
  const gatewayServer = http.createServer((_request, response) => {
    response.end('gateway-ok');
  });
  gatewayServer.listen(0, '127.0.0.1', () => {
    writeFileSync(
      process.env.RETURN_COVENANT_GATEWAY_READY_FILE,
      JSON.stringify({
        pid: hostPid(),
        endpoint: `http://127.0.0.1:${gatewayServer.address().port}`,
      }),
    );
  });
} else {
  const input = args(process.argv);
  const plan = readJson(input.plan);
  const phaseKey = process.env.OPENCLAW_RETURN_COVENANT_PHASE_KEY;
  const cases = new Map();
  const gateways = [];
  let currentGateway = null;
  let cleanupRun = null;
  let finalizing = false;

  function spawnGateway(label) {
    const readyFile = `${input.ready}.gateway-${label}.json`;
    const child = spawn(process.execPath, [process.argv[1], 'gateway'], {
      cwd: process.cwd(),
      stdio: 'ignore',
      env: {
        ...process.env,
        RETURN_COVENANT_GATEWAY_READY_FILE: readyFile,
      },
    });
    const entry = { child, readyFile, label, exited: false };
    child.once('exit', () => { entry.exited = true; });
    gateways.push(entry);
    return entry;
  }

  async function startGateway(label) {
    const entry = spawnGateway(label);
    const ready = await waitForJson(entry.readyFile);
    entry.pid = ready.pid;
    entry.endpoint = ready.endpoint;
    entry.startFingerprint = processStartFingerprint(entry.pid);
    return entry;
  }

  async function stopGateway(entry) {
    if (entry.exited || entry.child.exitCode !== null) return;
    let exited = false;
    const exitPromise = once(entry.child, 'exit').then(() => {
      exited = true;
      entry.exited = true;
    });
    entry.child.kill('SIGTERM');
    await Promise.race([exitPromise, delay(1000)]);
    if (!exited) {
      entry.child.kill('SIGKILL');
      await Promise.race([exitPromise, delay(1000)]);
    }
    if (!exited) {
      throw new Error(`gateway ${entry.label} did not stop`);
    }
  }

  function receiptForPhase(phase, payload) {
    if (phase === 'prepare') {
      return { prepare: payload.prepare, observation: payload.observation || null };
    }
    if (phase === 'dispatch') return payload.acceptance;
    if (phase === 'transition') return payload.transition;
    if (phase === 'release') return payload.release;
    if (phase === 'observe') {
      return {
        settled: payload.settled === true,
        observation: payload.observation || null,
      };
    }
    if (phase === 'cleanup') return payload.cleanup;
    if (phase === 'cleanup-run') return payload.cleanupRun;
    return null;
  }

  function responseFor(request, payload) {
    const receipt = receiptForPhase(request.phase, payload);
    const binding = {
      phase: request.phase,
      requestNonce: request.driverBinding.requestNonce,
      receiptSha256: sha256(canonicalJson(receipt)),
      attestationSha256: request.driverBinding.attestationSha256,
      launchNonceFingerprint: request.driverBinding.launchNonceFingerprint,
      processStartFingerprint: request.driverBinding.processStartFingerprint,
      endpointSocketFingerprint:
        request.driverBinding.endpointSocketFingerprint,
      runtimeConfigSha256: request.driverBinding.runtimeConfigSha256,
    };
    return {
      schema: input.contract,
      phase: request.phase,
      ok: true,
      ...payload,
      driverBinding: {
        ...binding,
        signature: createHmac('sha256', phaseKey)
          .update(canonicalJson(binding))
          .digest('hex'),
      },
    };
  }

  function databaseReceipt(testCase, receiptId) {
    const profiles = {
      'fresh-v19': [null, 'fresh', true, false, false],
      'covenant-v18-upgrade': [18, 'covenant-v18', false, true, false],
      'participant-v18-upgrade': [18, 'participant-v18', false, true, false],
      'idempotent-v19-reopen': [19, 'v19-reopen', false, false, true],
    };
    const [source, fixtureShape, freshInstall, migrationApplied, reopenIdempotent] =
      profiles[testCase.databaseProfile];
    return {
      profile: testCase.databaseProfile,
      sourceSchemaVersion: source,
      targetSchemaVersion: 19,
      fixtureShape,
      productOwnedFixture: true,
      canonicalFixtureReceiptId: receiptId,
      freshInstall,
      migrationApplied,
      reopenIdempotent,
    };
  }

  function originEvidence(key, form) {
    return {
      source: 'product-owned',
      observedForm: form,
      receiptId: `origin-receipt-${key}`,
      typedToolExecutions: form === 'typed-tool' ? 1 : 0,
      bracketParses: form === 'bracket-token' ? 1 : 0,
      rawFinalText: form === 'bracket-token',
    };
  }

  function transitionFor(state, attestation, lineage) {
    const forbidden = state.request.kind === 'forbidden';
    const key = state.key;
    const lifecycle = {
      edge: state.request.lifecycleEdge,
      occurredAfterAcceptance: true,
      completedBeforeRelease: true,
      preSessionId:
        state.request.caseId === 'allowed-late-materialization'
          ? null
          : `pre-session-${key}`,
      postSessionId: `post-session-${key}`,
      successorIdentity: `successor-${key}`,
      receiptId: `lifecycle-receipt-${key}`,
      acceptedDispatchReceiptId: state.acceptance.receiptId,
      generationAdvanced: forbidden,
      effectiveAuthorityUnchanged: !forbidden,
    };
    if (state.request.caseId === 'forbidden-delete-recreate') {
      lifecycle.operations = {
        deletionObserved: true,
        deletionReceiptId: `delete-operation-receipt-${key}`,
        recreationObserved: true,
        recreationReceiptId: `recreate-operation-receipt-${key}`,
      };
    }
    if (state.request.caseId === 'allowed-gateway-restart-replay') {
      lifecycle.restart = {
        stoppedAfterAcceptance: true,
        restartedBeforeRelease: true,
        replayRecovered: true,
        receiptId: `restart-receipt-${key}`,
        originalGatewayPid: lineage.original.pid,
        originalGatewayStartFingerprint: lineage.original.startFingerprint,
        replacementGatewayPid: lineage.replacement.pid,
        replacementGatewayStartFingerprint:
          lineage.replacement.startFingerprint,
        gatewayCommandSha256: attestation.gatewayCommand.sha256,
        runtimeConfigSha256: attestation.runtimeConfigSha256,
        processGroupId: attestation.isolation.processGroupId,
        replacementGatewayEndpoint: lineage.replacement.endpoint,
      };
    }
    return lifecycle;
  }

  function completeObservation(state) {
    const nowWall = Date.now();
    const nowMonotonic = performance.now();
    const elapsedWall = nowWall - state.releasedAtWall;
    const elapsedMonotonic = nowMonotonic - state.releasedAtMonotonic;
    const forbidden = state.request.kind === 'forbidden';
    const admission = forbidden
      ? {
        'forbidden-delete-recreate': 'stale',
        'forbidden-owner-reassignment': 'unauthorized',
        'forbidden-member-access-removal': 'unauthorized',
        'forbidden-restrictive-visibility': 'unauthorized',
        'forbidden-explicit-revocation': 'revoked',
      }[state.request.caseId]
      : 'adopted';
    return {
      schema: 'openclaw.k6.return-covenant-observation.v1',
      rowId: plan.rowId,
      runId: plan.runId,
      caseId: state.request.caseId,
      form: state.request.form,
      kind: state.request.kind,
      candidateSha: plan.target.candidateSha,
      runtimeBuildSha: plan.target.runtimeBuildSha,
      docsHarnessSha: plan.target.docsHarnessSha,
      runtimeConfigSha256: plan.target.runtimeConfigSha256,
      startedAt: state.startedAt,
      endedAt: new Date(nowWall).toISOString(),
      returnMode: state.request.returnMode,
      logicalSessionKey: state.request.logicalSessionKey,
      caseHandle: state.caseHandle,
      database: state.database,
      isolation: { home: true, state: true, config: true, syntheticData: true },
      dispatch: state.acceptance,
      lifecycle: state.lifecycle,
      authorityDiagnostic: {
        source: 'product-owned',
        surface: 'diagnostics/continuation/recipient-authority',
        capturedAuthorityGeneration:
          state.acceptance.capturedAuthorityGeneration,
        currentAuthorityGeneration: forbidden
          ? `current-generation-${state.key}`
          : state.acceptance.capturedAuthorityGeneration,
      },
      delivery: {
        acceptedDispatchReceiptId: state.acceptance.receiptId,
        heldResultAuthorityGeneration:
          state.acceptance.capturedAuthorityGeneration,
        caseHandle: state.caseHandle,
        transitionReceiptId: state.lifecycle.receiptId,
        releaseReceiptId: state.release.receiptId,
        resultReleased: true,
        admission,
        queue: {
          recordId: `queue-record-${state.key}`,
          status: forbidden ? `${admission}-acknowledged` : 'adopted',
          acknowledged: true,
          removed: true,
          retryScheduled: false,
        },
      },
      effects: {
        distinguishable: true,
        sources: {
          promptAdoptions: 'product-observer/prompt-adoption',
          wakes: 'product-observer/heartbeat-wake',
          channelDeliveries: 'product-observer/channel-delivery',
        },
        expected: state.request.expectedEffects,
        observed: state.request.expectedEffects,
      },
      settlement: {
        bounded: true,
        complete: true,
        windowMs: state.request.settlementWindowMs,
        releasedAt: new Date(state.releasedAtWall).toISOString(),
        scansCompletedAt: new Date(nowWall).toISOString(),
        elapsedMs: elapsedWall,
        monotonicElapsedMs: elapsedMonotonic,
      },
      scans: {
        resultMarker: state.acceptance.resultMarker,
        successorTranscript: {
          source: 'product-owned',
          marker: state.acceptance.resultMarker,
          matches: 0,
          receiptId: `transcript-scan-receipt-${state.key}`,
        },
        trustedSystemEvents: {
          source: 'product-owned',
          marker: state.acceptance.resultMarker,
          matches: 0,
          receiptId: `system-event-scan-receipt-${state.key}`,
        },
      },
      resultMarker: state.acceptance.resultMarker,
    };
  }

  const driverServer = http.createServer((request, response) => {
    let raw = '';
    request.setEncoding('utf8');
    request.on('data', (chunk) => { raw += chunk; });
    request.on('end', async () => {
      try {
        const body = JSON.parse(raw);
        const key = `${body.caseId}:${body.form}`;
        let payload;
        if (body.phase === 'prepare') {
          const caseHandle = `case-handle-${key}`;
          const prepareReceipt = `fixture-receipt-${key}`;
          cases.set(caseHandle, {
            key,
            caseHandle,
            request: body,
            startedAt: new Date().toISOString(),
            database: databaseReceipt(body, prepareReceipt),
          });
          payload = {
            caseHandle,
            prepare: { caseHandle, receiptId: prepareReceipt },
          };
        } else if (body.phase === 'dispatch') {
          const state = cases.get(body.caseHandle);
          const resultMarker = `RCV-${sha256(key).slice(0, 32)}`;
          state.acceptance = {
            caseHandle: state.caseHandle,
            prepareReceiptId: state.database.canonicalFixtureReceiptId,
            accepted: true,
            completionHeld: true,
            receiptId: `dispatch-receipt-${key}`,
            heldResultId: `held-result-${key}`,
            capturedAuthorityGeneration: `captured-generation-${key}`,
            resultMarker,
            originEvidence: originEvidence(key, body.form),
          };
          payload = { acceptance: state.acceptance };
        } else if (body.phase === 'transition') {
          const state = cases.get(body.caseHandle);
          const attestation = readJson(
            process.env.OPENCLAW_RETURN_COVENANT_ATTESTATION_PATH,
          );
          let lineage = null;
          if (state.request.caseId === 'allowed-gateway-restart-replay') {
            const original = currentGateway;
            await stopGateway(original);
            const replacement = await startGateway(
              `replacement-${state.request.form}`,
            );
            currentGateway = replacement;
            lineage = { original, replacement };
          }
          state.lifecycle = transitionFor(state, attestation, lineage);
          payload = {
            transition: {
              caseHandle: state.caseHandle,
              lifecycleOccurred: true,
              receiptId: state.lifecycle.receiptId,
              acceptedDispatchReceiptId: state.acceptance.receiptId,
              capturedAuthorityGeneration:
                state.acceptance.capturedAuthorityGeneration,
              ...(state.lifecycle.restart
                ? {
                  restartReceiptId: state.lifecycle.restart.receiptId,
                  restart: state.lifecycle.restart,
                }
                : {}),
              ...(state.lifecycle.operations
                ? { operations: state.lifecycle.operations }
                : {}),
            },
          };
        } else if (body.phase === 'release') {
          const state = cases.get(body.caseHandle);
          state.release = {
            caseHandle: state.caseHandle,
            released: true,
            receiptId: `release-receipt-${key}`,
            transitionReceiptId: state.lifecycle.receiptId,
            acceptedDispatchReceiptId: state.acceptance.receiptId,
            heldResultId: state.acceptance.heldResultId,
            resultMarker: state.acceptance.resultMarker,
            capturedAuthorityGeneration:
              state.acceptance.capturedAuthorityGeneration,
          };
          state.releasedAtWall = Date.now();
          state.releasedAtMonotonic = performance.now();
          payload = { release: state.release };
        } else if (body.phase === 'observe') {
          const state = cases.get(body.caseHandle);
          const settled =
            performance.now() - state.releasedAtMonotonic >=
            state.request.settlementWindowMs;
          payload = {
            settled,
            observation: settled ? completeObservation(state) : null,
          };
        } else if (body.phase === 'cleanup') {
          payload = {
            cleanup: {
              caseHandle: body.caseHandle,
              closed: true,
              receiptId: `case-cleanup-receipt-${key}`,
            },
          };
        } else if (body.phase === 'cleanup-run') {
          if (!cleanupRun) {
            cleanupRun = {
              completed: true,
              receiptId: 'run-cleanup-receipt-pass',
              observationSetSha256: body.observationSetSha256,
              phaseChainSha256: body.phaseChainSha256,
              driverAttestationSha256: body.driverAttestationSha256,
              runtimeConfigSha256: plan.target.runtimeConfigSha256,
            };
          }
          payload = { cleanupRun };
        } else {
          throw new Error(`unknown phase: ${body.phase}`);
        }
        response.setHeader('content-type', 'application/json');
        response.end(JSON.stringify(responseFor(body, payload)));
        if (body.phase === 'cleanup-run' && body.fallback === true && !finalizing) {
          finalizing = true;
          setTimeout(() => void finalize(), 25);
        }
      } catch (error) {
        console.error(error?.stack || String(error));
        response.statusCode = 500;
        response.end(String(error));
      }
    });
  });

  async function finalize() {
    const attestation = await waitForJson(
      process.env.OPENCLAW_RETURN_COVENANT_ATTESTATION_PATH,
    );
    const startedAt = new Date().toISOString();
    await Promise.all(gateways.map(stopGateway));
    writeFileSync(input['cleanup-draft'], JSON.stringify({
      startedAt,
      endedAt: new Date().toISOString(),
      retained: {
        delegates: 0,
        queueItems: 0,
        temporarySessions: 0,
        gateways: 0,
        fixtureProcesses: 0,
      },
      allCaseHandlesClosed: true,
      caseHandles: [...cases.keys()],
      observationSetSha256: cleanupRun.observationSetSha256,
      phaseChainSha256: cleanupRun.phaseChainSha256,
      driverAttestationSha256: attestation.attestationSha256,
      runCleanupReceiptId: cleanupRun.receiptId,
    }));
    driverServer.closeAllConnections();
    driverServer.close();
    process.exit(0);
  }

  void (async () => {
    const initial = await startGateway('initial');
    currentGateway = initial;
    driverServer.listen(0, '127.0.0.1', () => {
      writeFileSync(input.ready, JSON.stringify({
        schema: 'openclaw.k6.return-covenant-driver-ready.v1',
        protocol: input.contract,
        runId: plan.runId,
        rowId: plan.rowId,
        candidateSha: plan.target.candidateSha,
        runtimeBuildSha: plan.target.runtimeBuildSha,
        docsHarnessSha: plan.target.docsHarnessSha,
        commandRelativePath: plan.driver.fixtureCommand.relativePath,
        commandSha256: plan.driver.fixtureCommand.sha256,
        gatewayCommandRelativePath: plan.driver.gatewayCommand.relativePath,
        gatewayCommandSha256: plan.driver.gatewayCommand.sha256,
        runtimeConfigSha256: plan.target.runtimeConfigSha256,
        launchNonce: process.env.OPENCLAW_RETURN_COVENANT_LAUNCH_NONCE,
        phaseKeyFingerprint:
          process.env.OPENCLAW_RETURN_COVENANT_PHASE_KEY_FINGERPRINT,
        pid: hostPid(),
        gatewayPid: initial.pid,
        gatewayEndpoint: initial.endpoint,
        endpoint: `http://127.0.0.1:${driverServer.address().port}`,
        revocationCapability: {
          schema: 'openclaw.k6.return-covenant-capability-inventory.v1',
          source: 'product-owned',
          productSha: plan.target.candidateSha,
          runtimeBuildSha: plan.target.runtimeBuildSha,
          runtimeConfigSha256: plan.target.runtimeConfigSha256,
          inventoryComplete: true,
          revocationApiExposed: true,
          surface: 'diagnostics/continuation/capability-inventory',
          receiptId: 'run-wide-revocation-capability-receipt',
        },
      }));
    });
  })();
}
