/**
 * Scenario: R-CD-IN-RECOVERY — queued/restart delegate INPUT recovery.
 *
 * Proves that a typed `continue_delegate` input snapshot which is still QUEUED
 * (delayed beyond the observation window, or staged post-compaction) survives a
 * gateway lifecycle event and is handed to the child from durable state — the
 * same snapshot identity, not a re-read of live workspace files.
 *
 * Durable surface under test:
 *   src/auto-reply/continuation/delegate-flow-store.ts
 *     (persisted attachment state + hasStoredDelegateAttachmentState)
 *
 * ORCHESTRATION GATE — read this before reading a verdict:
 *   The gateway restart is an operator step. This harness cannot and must not
 *   restart a seat, and it must not take the operator's word for it either:
 *   `OPENCLAW_RESTART_ORCHESTRATED=true` is a DECLARATION, never the evidence.
 *   The restart is credited only from the gateway's own public `/status`
 *   surface (uptime going backwards, or the endpoint dropping and returning)
 *   observed between two SEPARATE WebSocket connections — the row deliberately
 *   disconnects before the window and reconnects after it, so a real restart
 *   cannot break the run and a missing restart cannot be papered over.
 *   Without that receipt the row terminates PARTIAL-candidate with a verbatim
 *   reason. It never reports PASS on an unperformed precondition.
 *
 * References:
 *   - Issue: karmaterminal/karmaterminal-openclaw-docs#491
 *   - Manifest: tools/k6-proofs/manifests/r-cd-in-recovery.json
 */
import ws from 'k6/ws';
import { check, sleep } from 'k6';
import { Counter, Trend } from 'k6/metrics';
import { connectFrame, nonce, RequestTracker } from '../lib/gateway-ws.js';
import { loadManifestFromEnv, validateManifest } from '../lib/manifest-loader.js';
import {
  baseEvidence,
  boolEnv,
  breakNegative,
  canaryFor,
  capture,
  computeVerdict,
  contentReceipt,
  declareNegative,
  fire,
  httpBaseFromWs,
  logEvidence,
  matchGroup,
  observeGatewayRestart,
  orchestrationGate,
  rowSummary,
  sampleGatewayStatus,
  scanRawBytes,
  sentinel,
} from '../lib/delegate-attachment-io.js';

const ROW = 'R-CD-IN-RECOVERY';

export const options = {
  scenarios: {
    r_cd_in_recovery: {
      executor: 'shared-iterations',
      vus: 1,
      iterations: 1,
      maxDuration: '540s',
    },
  },
  thresholds: {
    r_cd_in_recovery_duration: ['p(95)<520000'],
  },
};

const failures = new Counter('proof_failures');
const duration = new Trend('r_cd_in_recovery_duration');

const manifest = loadManifestFromEnv();

const REQUIRED = [
  'tool-invoke-accepted',
  'input-snapshot-queued',
  'gateway-restart-observed',
  'reconnected-after-restart',
  'post-lifecycle-child-arrival',
  'snapshot-identity-preserved',
];

export default function () {
  const url = __ENV.OPENCLAW_GATEWAY_WS || 'ws://127.0.0.1:18789';
  const token = __ENV.OPENCLAW_GATEWAY_TOKEN;
  const requestedSessionKey = manifest?.sessionKey || __ENV.OPENCLAW_SESSION_KEY || 'main';
  let sessionKey = requestedSessionKey;
  const seat = manifest?.seat || __ENV.OPENCLAW_SEAT_NAME || 'rune-rog-ally';
  const createDisposableSession = boolEnv('OPENCLAW_CREATE_DISPOSABLE_SESSION');
  const restartOrchestrated = boolEnv('OPENCLAW_RESTART_ORCHESTRATED');
  const queueDelaySeconds = Number(__ENV.OPENCLAW_QUEUE_DELAY_SECONDS || 120);
  const restartWindowMs = Number(__ENV.OPENCLAW_RESTART_WINDOW_MS || 120000);
  const rowNonce = nonce(ROW);
  const canary = canaryFor(rowNonce);

  if (!token) {
    console.error('OPENCLAW_GATEWAY_TOKEN is required');
    failures.add(1);
    return;
  }
  if (manifest) {
    const errors = validateManifest(manifest);
    if (errors.length > 0) console.warn(`Manifest validation warnings: ${errors.join('; ')}`);
  }

  const evidence = baseEvidence({
    row: ROW,
    nonce: rowNonce,
    seat,
    requestedSessionKey,
    sessionKey,
    manifest,
    orchestrationRequired: 'operator gateway restart while the delegate input snapshot is queued',
  });
  evidence.content_receipt = contentReceipt(canary);
  evidence.queue_delay_seconds = queueDelaySeconds;
  evidence.restart_window_ms = restartWindowMs;
  evidence.restart_declared_by_operator = restartOrchestrated;
  evidence.lifecycle = { baseline: null, observation: null };
  declareNegative(
    evidence,
    'no-raw-attachment-bytes-on-the-wire',
    'queued attachment content must never appear on a non-harness gateway frame',
  );
  declareNegative(
    evidence,
    'no-pre-lifecycle-spawn',
    'the delayed delegate must not spawn before its queue window elapses',
  );

  const started = Date.now();
  const httpBase = httpBaseFromWs(url);

  // --- Phase 0: external lifecycle baseline (before anything is dispatched) ---
  const baseline = sampleGatewayStatus(httpBase, token);
  evidence.lifecycle.baseline = { reachable: baseline.reachable, uptime: baseline.uptime };

  // --- Phase 1: dispatch and observe the queued snapshot, then DISCONNECT ---
  const phase1 = ws.connect(url, {}, (socket) => {
    const tracker = new RequestTracker();

    function startProofFlow() {
      tracker.send(socket, 'sessions.messages.subscribe', { key: sessionKey });
      socket.setTimeout(() => {
        const instruction =
          `[k6-proof-harness] Call continue_delegate exactly once with ` +
          `task="Reply exactly: CDINREC-CHILD-ARRIVED ${rowNonce} <bytes> <sha256First16> where <bytes> is the ` +
          `byte length of the attachment you were handed and <sha256First16> is the first 16 hex characters ` +
          `of its sha256 digest. Do not print the file contents.", ` +
          `mode="normal", delaySeconds=${queueDelaySeconds}, ` +
          `attachments=[{name:"p86-rec-${rowNonce}.txt", content:"${canary}", encoding:"utf8", mimeType:"text/plain"}]. ` +
          `After the tool result reports the delegate is scheduled, reply exactly ` +
          `CDINREC-QUEUED ${rowNonce} <bytes> — <bytes> from the tool result snapshot receipt. ` +
          `Never echo the attachment content. This is a proof run — no other action needed.`;
        tracker.send(socket, 'sessions.send', {
          key: sessionKey,
          message: instruction,
          idempotencyKey: `${ROW}-DISPATCH-${rowNonce}`,
        });
      }, 500);
      socket.setTimeout(() => socket.close(), 90000);
    }

    socket.on('open', () => {
      socket.send(connectFrame(token));
      if (createDisposableSession) {
        socket.setTimeout(() => {
          const disposableKey = `r-cd-in-recovery-${rowNonce}`.toLowerCase().replace(/[^a-z0-9-]/g, '-');
          tracker.send(socket, 'sessions.create', { key: disposableKey, label: `k6 ${ROW}` });
        }, 250);
      } else {
        socket.setTimeout(startProofFlow, 500);
      }
    });

    socket.on('message', (raw) => {
      try {
        const msg = JSON.parse(raw);
        const classified = tracker.classify(msg);
        const body = capture(evidence, classified);

        if (classified.kind === 'response' && classified.method === 'sessions.create') {
          if (classified.ok && classified.payload) {
            sessionKey = classified.payload.key || sessionKey;
            evidence.sessionKey = sessionKey;
            evidence.session_created = true;
            evidence.created_session_key = sessionKey;
            startProofFlow();
          } else {
            failures.add(1);
            socket.close();
          }
          return;
        }

        if (classified.kind === 'response' && classified.method === 'sessions.send') {
          if (classified.ok) fire(evidence, 'tool-invoke-accepted');
          else failures.add(1);
          return;
        }

        if (classified.kind !== 'event' || !body) return;

        scanRawBytes(evidence, body, rowNonce, 'no-raw-attachment-bytes-on-the-wire');

        const queuedBytes = matchGroup(body, sentinel('CDINREC-QUEUED', rowNonce, ' ([0-9]+)'));
        if (queuedBytes) {
          fire(evidence, 'input-snapshot-queued');
          evidence.queued_snapshot_bytes = Number(queuedBytes);
          evidence.queued_at_ms = Date.now();
          // Disconnect deliberately: the row must survive an operator restart
          // that would otherwise tear this socket down mid-run.
          socket.close();
        }

        const early = body.match(sentinel('CDINREC-CHILD-ARRIVED', rowNonce, ' ([0-9]+)'));
        if (early) {
          // Arrival before the restart window means durable recovery was never
          // exercised. Record it; do not credit it.
          evidence.early_arrival = true;
          breakNegative(
            evidence,
            'no-pre-lifecycle-spawn',
            'the delayed delegate arrived before the restart window opened',
          );
          socket.close();
        }
      } catch (e) {
        console.warn(`parse error: ${e}`);
      }
    });

    socket.on('error', (e) => {
      console.error(`ws error (phase 1): ${e && e.error ? e.error() : e}`);
      failures.add(1);
    });
  });

  // --- Phase 2: externally observable restart window, socket intentionally down ---
  if (evidence.receipts['input-snapshot-queued']) {
    console.log(
      `${ROW}: snapshot queued and harness disconnected. Operator restart window is OPEN for ` +
        `${restartWindowMs}ms — restart the gateway now to exercise durable input recovery.`,
    );
    const observation = observeGatewayRestart({
      httpBase,
      token,
      baseline,
      windowMs: restartWindowMs,
      pollMs: Number(__ENV.OPENCLAW_RESTART_POLL_MS || 5000),
      sleep,
    });
    evidence.lifecycle.observation = observation;
    if (observation.observed) fire(evidence, 'gateway-restart-observed');
  } else {
    evidence.lifecycle.observation = {
      observed: false,
      reason: 'the queued-snapshot receipt never fired, so the restart window was never opened',
    };
  }

  // --- Phase 3: RECONNECT on a fresh socket and wait for the child arrival ---
  let phase2 = null;
  if (evidence.receipts['gateway-restart-observed']) {
    phase2 = ws.connect(url, {}, (socket) => {
      const tracker = new RequestTracker();

      socket.on('open', () => {
        fire(evidence, 'reconnected-after-restart');
        socket.send(connectFrame(token));
        socket.setTimeout(() => {
          tracker.send(socket, 'sessions.messages.subscribe', { key: sessionKey });
        }, 500);
        socket.setTimeout(() => socket.close(), Math.max(30000, queueDelaySeconds * 1000 + 60000));
      });

      socket.on('message', (raw) => {
        try {
          const msg = JSON.parse(raw);
          const classified = tracker.classify(msg);
          const body = capture(evidence, classified);
          if (classified.kind !== 'event' || !body) return;

          scanRawBytes(evidence, body, rowNonce, 'no-raw-attachment-bytes-on-the-wire');

          const arrived = body.match(
            sentinel('CDINREC-CHILD-ARRIVED', rowNonce, ' ([0-9]+) ([0-9a-f]{16})'),
          );
          if (arrived) {
            const arrivedBytes = Number(arrived[1]);
            const arrivedDigest = arrived[2];
            evidence.child_arrival_elapsed_ms = evidence.queued_at_ms
              ? Date.now() - evidence.queued_at_ms
              : null;
            evidence.arrived_snapshot = { bytes: arrivedBytes, sha256_prefix: arrivedDigest };
            fire(evidence, 'post-lifecycle-child-arrival');
            // Identity is preserved only when the bytes the child received
            // still digest to the canary this run staged BEFORE the restart.
            if (
              arrivedBytes === evidence.content_receipt.bytes &&
              arrivedDigest === evidence.content_receipt.sha256_prefix &&
              (evidence.queued_snapshot_bytes === undefined ||
                arrivedBytes === evidence.queued_snapshot_bytes)
            ) {
              fire(evidence, 'snapshot-identity-preserved');
            } else {
              evidence.identity_mismatch = {
                staged: evidence.content_receipt,
                queued_bytes: evidence.queued_snapshot_bytes,
                arrived: evidence.arrived_snapshot,
              };
            }
            socket.close();
          }
        } catch (e) {
          console.warn(`parse error: ${e}`);
        }
      });

      socket.on('error', (e) => {
        console.error(`ws error (phase 3): ${e && e.error ? e.error() : e}`);
      });
    });
  }

  evidence.duration_ms = Date.now() - started;
  duration.add(evidence.duration_ms);

  orchestrationGate(
    evidence,
    !!evidence.receipts['gateway-restart-observed'] &&
      !!evidence.receipts['reconnected-after-restart'] &&
      !!evidence.receipts['post-lifecycle-child-arrival'] &&
      !evidence.early_arrival,
    evidence.receipts['gateway-restart-observed']
      ? 'a gateway restart was observed but the reconnected socket saw no post-lifecycle child arrival for this row'
      : `no gateway restart was observable on ${httpBase}/status inside the window` +
        (restartOrchestrated
          ? ' even though OPENCLAW_RESTART_ORCHESTRATED was declared: the declaration is not evidence'
          : '') +
        `: ${evidence.lifecycle.observation?.reason || 'no lifecycle change detected'}`,
  );

  const verdict = computeVerdict(evidence, REQUIRED);

  check(phase1, { 'websocket connected': (r) => r && r.status === 101 });
  check(null, {
    'typed continue_delegate dispatch accepted': () => !!evidence.receipts['tool-invoke-accepted'],
    'input snapshot reported queued': () => !!evidence.receipts['input-snapshot-queued'],
    'gateway restart observed on the public status surface': () =>
      !!evidence.receipts['gateway-restart-observed'],
    'harness reconnected after the restart': () =>
      !!evidence.receipts['reconnected-after-restart'],
    'no raw attachment bytes on the wire': () =>
      evidence.negative_checks['no-raw-attachment-bytes-on-the-wire'].held,
    'no pre-lifecycle spawn': () => evidence.negative_checks['no-pre-lifecycle-spawn'].held,
  });
  if (phase2) check(phase2, { 'reconnect websocket connected': (r) => r && r.status === 101 });

  logEvidence(evidence);
  if (verdict !== 'PASS-candidate') {
    console.log(
      `[${ROW}] PARTIAL is the honest outcome here unless an operator restart was observed: ` +
        `${evidence.orchestration.reason || 'see missing_receipts'}`,
    );
  }
}

export function handleSummary(data) {
  return rowSummary({
    row: ROW,
    data,
    durationMetric: 'r_cd_in_recovery_duration',
    summaryFile: 'r-cd-in-recovery-queued-restart-summary.json',
  });
}
