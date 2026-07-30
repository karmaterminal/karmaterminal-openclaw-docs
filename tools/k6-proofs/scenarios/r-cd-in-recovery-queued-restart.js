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
 *   restart a seat. When `OPENCLAW_RESTART_ORCHESTRATED=true` is not set, or the
 *   post-lifecycle child arrival is not observed, the row terminates
 *   PARTIAL-candidate with an explicit reason. It never reports PASS on an
 *   unperformed precondition.
 *
 * References:
 *   - Issue: karmaterminal/karmaterminal-openclaw-docs#491
 *   - Manifest: tools/k6-proofs/manifests/r-cd-in-recovery.json
 */
import ws from 'k6/ws';
import { check } from 'k6';
import { Counter, Trend } from 'k6/metrics';
import { connectFrame, nonce, RequestTracker } from '../lib/gateway-ws.js';
import { loadManifestFromEnv, validateManifest } from '../lib/manifest-loader.js';
import {
  baseEvidence,
  boolEnv,
  canaryFor,
  capture,
  computeVerdict,
  contentReceipt,
  declareNegative,
  fire,
  logEvidence,
  matchGroup,
  orchestrationGate,
  rowSummary,
  scanRawBytes,
} from '../lib/delegate-attachment-io.js';

const ROW = 'R-CD-IN-RECOVERY';

export const options = {
  scenarios: {
    r_cd_in_recovery: {
      executor: 'shared-iterations',
      vus: 1,
      iterations: 1,
      maxDuration: '400s',
    },
  },
  thresholds: {
    r_cd_in_recovery_duration: ['p(95)<380000'],
  },
};

const failures = new Counter('proof_failures');
const duration = new Trend('r_cd_in_recovery_duration');

const manifest = loadManifestFromEnv();

const REQUIRED = [
  'tool-invoke-accepted',
  'input-snapshot-queued',
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

  const res = ws.connect(url, {}, (socket) => {
    const tracker = new RequestTracker();
    let queuedAtMs = null;

    function startProofFlow() {
      tracker.send(socket, 'sessions.messages.subscribe', { key: sessionKey });
      socket.setTimeout(() => {
        const instruction =
          `[k6-proof-harness] Call continue_delegate exactly once with ` +
          `task="Reply exactly: CDINREC-CHILD-ARRIVED ${rowNonce} <bytes> where <bytes> is the byte length ` +
          `of the attachment you were handed. Do not print the file contents.", ` +
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
      socket.setTimeout(() => socket.close(), 360000);
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

        const queuedBytes = matchGroup(body, new RegExp(`CDINREC-QUEUED ${rowNonce} ([0-9]+)`));
        if (queuedBytes) {
          fire(evidence, 'input-snapshot-queued');
          queuedAtMs = queuedAtMs || Date.now();
          evidence.queued_snapshot_bytes = Number(queuedBytes);
        }

        const arrivedBytes = matchGroup(body, new RegExp(`CDINREC-CHILD-ARRIVED ${rowNonce} ([0-9]+)`));
        if (arrivedBytes) {
          const elapsedMs = queuedAtMs ? Date.now() - queuedAtMs : null;
          evidence.child_arrival_elapsed_ms = elapsedMs;
          if (elapsedMs !== null && elapsedMs < queueDelaySeconds * 1000 * 0.5) {
            // Arrival far inside the queue window means the row never actually
            // exercised durable recovery; record it rather than crediting it.
            evidence.early_arrival = true;
          }
          fire(evidence, 'post-lifecycle-child-arrival');
          evidence.arrived_snapshot_bytes = Number(arrivedBytes);
          if (
            evidence.queued_snapshot_bytes !== undefined &&
            Number(arrivedBytes) === evidence.queued_snapshot_bytes
          ) {
            fire(evidence, 'snapshot-identity-preserved');
          }
          socket.close();
        }
      } catch (e) {
        console.warn(`parse error: ${e}`);
      }
    });

    socket.on('error', (e) => {
      console.error(`ws error: ${e && e.error ? e.error() : e}`);
      failures.add(1);
    });
  });

  evidence.duration_ms = Date.now() - started;
  duration.add(evidence.duration_ms);

  orchestrationGate(
    evidence,
    restartOrchestrated && !!evidence.receipts['post-lifecycle-child-arrival'] && !evidence.early_arrival,
    restartOrchestrated
      ? 'operator restart was declared but no post-lifecycle child arrival outside the queue window was observed'
      : 'OPENCLAW_RESTART_ORCHESTRATED was not set: no operator gateway restart happened during the queue window, so durable input recovery was not exercised',
  );

  const verdict = computeVerdict(evidence, REQUIRED);

  check(res, { 'websocket connected': (r) => r && r.status === 101 });
  check(null, {
    'typed continue_delegate dispatch accepted': () => !!evidence.receipts['tool-invoke-accepted'],
    'input snapshot reported queued': () => !!evidence.receipts['input-snapshot-queued'],
    'no raw attachment bytes on the wire': () =>
      evidence.negative_checks['no-raw-attachment-bytes-on-the-wire'].held,
  });

  logEvidence(evidence);
  if (verdict !== 'PASS-candidate') {
    console.log(
      `[${ROW}] PARTIAL is the honest outcome here unless an operator restart was orchestrated: ` +
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
