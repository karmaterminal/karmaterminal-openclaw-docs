/**
 * Scenario: PREFLIGHT — authenticated gateway/session/tool inventory.
 *
 * tools.effective is synchronous, so this row calls it only with a session
 * whose model/runtime publication has been verified through sessions.list.
 */
import ws from 'k6/ws';
import { check } from 'k6';
import { Counter, Trend } from 'k6/metrics';
import { connectFrame, nonce, RequestTracker, redactEvent } from '../lib/gateway-ws.js';
import { loadManifestFromEnv, validateManifest } from '../lib/manifest-loader.js';
import {
  completePreparationAuthority,
  incompletePreparationAuthority,
  preparedToolsEffectiveParams,
  rcd2ModelRef,
  resolvePreparationAgentId,
  resolvePreparedListedSession,
  selectPreparationModel,
  verifyCreatedPreparedSession,
} from '../lib/session-runtime-preparation.js';

export const options = {
  scenarios: {
    preflight_inventory: {
      executor: 'shared-iterations',
      vus: 1,
      iterations: 1,
      maxDuration: '45s',
    },
  },
  thresholds: {
    proof_failures: ['count==0'],
    proof_setup_failures: ['count==0'],
    preflight_duration: ['p(95)<30000'],
  },
};

const failures = new Counter('proof_failures');
const setupFailures = new Counter('proof_setup_failures');
const duration = new Trend('preflight_duration');
const manifest = loadManifestFromEnv();

function boolEnv(name) {
  return (__ENV[name] || '').toLowerCase() === 'true';
}

export default function () {
  const url = __ENV.OPENCLAW_GATEWAY_WS || 'ws://127.0.0.1:18789';
  const token = __ENV.OPENCLAW_GATEWAY_TOKEN;
  const requestedSessionKey = String(
    manifest?.sessionKey || __ENV.OPENCLAW_SESSION_KEY || '',
  ).trim();
  const forceDisposable = boolEnv('OPENCLAW_PREFLIGHT_CREATE_DISPOSABLE_SESSION');
  const seat = manifest?.seat || __ENV.OPENCLAW_SEAT_NAME || 'ci-runner';
  const rowNonce = nonce('PREFLIGHT');
  let sessionKey = '';
  let disposableAgentId = '';
  let disposableKey = '';
  let selectedModel = null;
  let modelsPayload = null;
  let createPayload = null;
  let inspectionPhase = 'unstarted';
  let setupFailureRecorded = false;

  if (!token) {
    console.error('OPENCLAW_GATEWAY_TOKEN is required');
    failures.add(1);
    setupFailures.add(1);
    return;
  }

  if (manifest) {
    const errors = validateManifest(manifest);
    if (errors.length > 0) {
      console.warn(`Manifest validation warnings: ${errors.join('; ')}`);
    }
  }

  const evidence = {
    row: 'PREFLIGHT',
    manifest_loaded: !!manifest,
    seat,
    candidateSha: manifest?.candidateSha || __ENV.OPENCLAW_CANDIDATE_SHA || 'unset',
    runtimeBuildSha: __ENV.OPENCLAW_RUNTIME_BUILD_SHA || 'unset',
    started: new Date().toISOString(),
    connected: false,
    sessions_list_ok: false,
    tools_effective_ok: false,
    tool_inventory_count: 0,
    ...incompletePreparationAuthority('preparation-not-started'),
    redacted_events: [],
  };

  function applyAuthority(authority) {
    Object.assign(evidence, authority);
  }

  function failSetup(code, message, preservePreparation = false) {
    if (!preservePreparation) applyAuthority(incompletePreparationAuthority(code));
    else evidence.setup_failure_code = code;
    if (!setupFailureRecorded) {
      setupFailureRecorded = true;
      setupFailures.add(1);
      failures.add(1);
    }
    console.error(`PREFLIGHT setup incomplete (${code}): ${message}`);
  }

  const started = Date.now();
  const res = ws.connect(url, {}, (socket) => {
    const tracker = new RequestTracker();

    function requestToolsEffective(authority) {
      const params = preparedToolsEffectiveParams(sessionKey, authority);
      if (!params) {
        failSetup('tools-effective-before-preparation', 'session preparation was not complete');
        socket.close();
        return;
      }
      tracker.send(socket, 'tools.effective', params);
    }

    socket.on('open', () => {
      evidence.connected = true;
      socket.send(connectFrame(token));
      socket.setTimeout(() => tracker.send(socket, 'agents.list', {}), 250);
      socket.setTimeout(() => socket.close(), 30000);
    });

    socket.on('message', (raw) => {
      try {
        const classified = tracker.classify(JSON.parse(raw));
        evidence.redacted_events.push({
          ts: Date.now(),
          kind: classified.kind,
          method: classified.method || null,
          event: classified.event || null,
          ok: classified.ok !== undefined ? classified.ok : null,
          data: classified.payload ? redactEvent(classified.payload) : null,
        });

        if (classified.kind === 'response' && classified.method === 'agents.list') {
          if (!classified.ok) {
            failSetup('agent-resolution-unavailable', 'agents.list was unavailable');
            socket.close();
            return;
          }
          disposableAgentId = resolvePreparationAgentId(classified.payload);
          if (!disposableAgentId) {
            failSetup('agent-resolution-unavailable', 'agents.list did not return a default agent');
            socket.close();
            return;
          }
          tracker.send(socket, 'models.list', { view: 'configured' });
        }

        if (classified.kind === 'response' && classified.method === 'models.list') {
          if (!classified.ok) {
            failSetup('runtime-selection-unavailable', 'models.list was unavailable');
            socket.close();
            return;
          }
          modelsPayload = classified.payload;
          selectedModel = selectPreparationModel(
            modelsPayload,
            __ENV.OPENCLAW_PREFLIGHT_MODEL,
          );
          if (!selectedModel) {
            failSetup(
              'runtime-selection-unavailable',
              'no configured model publishes the built-in OpenClaw runtime',
            );
            socket.close();
            return;
          }
          if (forceDisposable) {
            const suffix = rowNonce.toLowerCase().replace(/[^a-z0-9-]/g, '-');
            disposableKey = `agent:${disposableAgentId}:preflight-${suffix}`;
            inspectionPhase = 'precreate-list';
            tracker.send(socket, 'sessions.list', {
              search: disposableKey,
              archived: 'all',
              limit: 10,
            });
          } else {
            inspectionPhase = 'listed-resolution';
            tracker.send(socket, 'sessions.list', {
              ...(requestedSessionKey ? { search: requestedSessionKey } : {}),
              archived: 'all',
              limit: 50,
            });
          }
        }

        if (classified.kind === 'response' && classified.method === 'sessions.create') {
          if (!classified.ok || !classified.payload) {
            failSetup('session-create-unverified', 'sessions.create rejected the selected model');
            socket.close();
            return;
          }
          createPayload = classified.payload;
          inspectionPhase = 'postcreate-list';
          tracker.send(socket, 'sessions.list', {
            search: disposableKey,
            archived: 'all',
            limit: 10,
          });
        }

        if (classified.kind === 'response' && classified.method === 'sessions.list') {
          if (!classified.ok) {
            failSetup('session-list-unavailable', `sessions.list failed during ${inspectionPhase}`);
            socket.close();
            return;
          }

          if (inspectionPhase === 'listed-resolution') {
            const listed = resolvePreparedListedSession(
              classified.payload,
              modelsPayload,
              requestedSessionKey,
            );
            if (!listed) {
              failSetup(
                requestedSessionKey ? 'requested-session-not-prepared' : 'prepared-session-not-listed',
                'sessions.list did not return a matching model/runtime-prepared session',
              );
              socket.close();
              return;
            }
            sessionKey = listed.key;
            evidence.sessions_list_ok = true;
            const authority = completePreparationAuthority({
              source: 'sessions-list',
              sessionClass: 'existing-listed',
              agentId: listed.agentId,
              selectedModel: listed.selectedModel,
              session: listed.session,
            });
            applyAuthority(authority);
            inspectionPhase = 'ready';
            requestToolsEffective(authority);
            return;
          }

          if (inspectionPhase === 'precreate-list') {
            const existing = classified.payload?.sessions || classified.payload?.items || [];
            if (existing.some((entry) => String(entry?.key || '').trim() === disposableKey)) {
              failSetup('disposable-session-collision', 'generated disposable session already exists');
              socket.close();
              return;
            }
            inspectionPhase = 'creating';
            tracker.send(socket, 'sessions.create', {
              agentId: disposableAgentId,
              key: disposableKey,
              label: 'k6 PREFLIGHT disposable',
              model: rcd2ModelRef(selectedModel),
            });
            return;
          }

          if (inspectionPhase === 'postcreate-list') {
            const created = verifyCreatedPreparedSession({
              createPayload,
              listedPayload: classified.payload,
              key: disposableKey,
              selectedModel,
            });
            if (!created) {
              failSetup(
                'session-create-unverified',
                'create response and sessions.list did not prove one prepared disposable session',
              );
              socket.close();
              return;
            }
            sessionKey = created.key;
            evidence.sessions_list_ok = true;
            const authority = completePreparationAuthority({
              source: 'sessions-create',
              sessionClass: 'disposable-unbound',
              agentId: disposableAgentId,
              selectedModel,
              session: created.session,
            });
            applyAuthority(authority);
            inspectionPhase = 'ready';
            requestToolsEffective(authority);
          }
        }

        if (classified.kind === 'response' && classified.method === 'tools.effective') {
          evidence.tools_effective_ok = classified.ok;
          const tools = classified.payload?.tools || classified.payload?.items || [];
          evidence.tool_inventory_count = Array.isArray(tools) ? tools.length : 0;
          if (!classified.ok) {
            failSetup(
              'tools-effective-unavailable',
              'tools.effective rejected the verified session',
              true,
            );
          }
          socket.close();
        }
      } catch (error) {
        failSetup('gateway-response-invalid', `gateway response could not be classified: ${error}`);
        socket.close();
      }
    });

    socket.on('error', (error) => {
      failSetup(
        'gateway-connection-error',
        `${error && error.error ? error.error() : error}`,
      );
    });
  });

  evidence.ended = new Date().toISOString();
  evidence.duration_ms = Date.now() - started;
  duration.add(evidence.duration_ms);

  check(res, { 'websocket connected': (response) => response && response.status === 101 });
  check(null, {
    'session preparation complete': () => evidence.preparation_complete,
    'sessions.list accepted': () => evidence.sessions_list_ok,
    'tools.effective accepted': () => evidence.tools_effective_ok,
  });

  if (!evidence.preparation_complete || !evidence.sessions_list_ok ||
      !evidence.tools_effective_ok) {
    if (!setupFailureRecorded) {
      failSetup('preflight-incomplete', 'preflight ended before verified inventory');
    }
  }

  const verdict = evidence.preparation_complete && evidence.tools_effective_ok
    ? 'PASS-candidate'
    : 'NO-VERDICT';
  console.log(`PREFLIGHT_EVIDENCE ${JSON.stringify(evidence)}`);
  console.log(`[PREFLIGHT] VERDICT: ${verdict}`);
}

export function handleSummary(data) {
  const failuresCount = data.metrics.proof_failures?.values?.count || 0;
  const verdict = failuresCount === 0 ? 'PASS-candidate' : 'NO-VERDICT';
  const summary = {
    row: 'PREFLIGHT',
    sha: __ENV.OPENCLAW_CANDIDATE_SHA || 'unset',
    seat: __ENV.OPENCLAW_SEAT_NAME || 'ci-runner',
    timestamp: new Date().toISOString(),
    verdict,
    metrics: {
      duration_ms: data.metrics.preflight_duration?.values || null,
      failures: failuresCount,
      setup_failures: data.metrics.proof_setup_failures?.values?.count || 0,
    },
  };
  return {
    stdout: `\n[PREFLIGHT] Summary: ${verdict} | SHA: ${summary.sha} | Seat: ${summary.seat}\n`,
    'preflight-summary.json': JSON.stringify(summary, null, 2),
  };
}
