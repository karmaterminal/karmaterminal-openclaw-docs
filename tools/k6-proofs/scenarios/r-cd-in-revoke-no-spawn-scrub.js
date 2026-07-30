/**
 * Scenario: R-CD-IN-REVOKE — policy revoke terminalizes with no spawn and scrubs.
 *
 * Proves that when the delegate-input attachment policy is revoked
 * (`tools.sessions_spawn.attachments.enabled = false`), a typed
 * `continue_delegate({ attachments: [...] })`:
 *   1. is refused at the tool boundary with a policy reason,
 *   2. spawns NO child, and
 *   3. leaves no attachment state behind — the durable snapshot is scrubbed.
 *
 * Runtime surface: src/agents/tools/continue-delegate-tool.ts (policy refusal),
 * src/auto-reply/continuation/delegate-flow-store.ts
 * (`scrubStoredDelegateAttachmentState`).
 *
 * ORCHESTRATION GATE — read this before reading a verdict:
 *   The gateway exposes `config.get` but no `config.set`. Flipping the policy to
 *   revoked is an operator step this harness must not perform. The scenario
 *   reads `config.get` to establish the live precondition:
 *     - policy already revoked  -> the behavioral legs are asserted for real.
 *     - policy still enabled    -> PARTIAL-candidate with an explicit reason.
 *   It never reports PASS against a precondition that was not in place.
 *
 * References:
 *   - Issue: karmaterminal/karmaterminal-openclaw-docs#491
 *   - Manifest: tools/k6-proofs/manifests/r-cd-in-revoke.json
 */
import ws from 'k6/ws';
import { check } from 'k6';
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
  logEvidence,
  orchestrationGate,
  rowSummary,
  scanRawBytes,
} from '../lib/delegate-attachment-io.js';

const ROW = 'R-CD-IN-REVOKE';

export const options = {
  scenarios: {
    r_cd_in_revoke: {
      executor: 'shared-iterations',
      vus: 1,
      iterations: 1,
      maxDuration: '200s',
    },
  },
  thresholds: {
    r_cd_in_revoke_duration: ['p(95)<180000'],
  },
};

const failures = new Counter('proof_failures');
const duration = new Trend('r_cd_in_revoke_duration');

const manifest = loadManifestFromEnv();

const REQUIRED = [
  'operator-policy-snapshot',
  'tool-invoke-accepted',
  'policy-revoke-refusal',
  'scrub-confirmed',
];

/**
 * Read the delegate-input attachment policy out of a config.get payload.
 * Returns true/false when the policy is explicitly present, null when the
 * surface did not carry it (which is a PARTIAL, not an assumed default).
 */
export function readAttachmentPolicy(configPayload) {
  const spawn = configPayload?.config?.tools?.sessions_spawn ?? configPayload?.tools?.sessions_spawn;
  const enabled = spawn?.attachments?.enabled;
  return typeof enabled === 'boolean' ? enabled : null;
}

export default function () {
  const url = __ENV.OPENCLAW_GATEWAY_WS || 'ws://127.0.0.1:18789';
  const token = __ENV.OPENCLAW_GATEWAY_TOKEN;
  const requestedSessionKey = manifest?.sessionKey || __ENV.OPENCLAW_SESSION_KEY || 'main';
  let sessionKey = requestedSessionKey;
  const seat = manifest?.seat || __ENV.OPENCLAW_SEAT_NAME || 'rune-rog-ally';
  const createDisposableSession = boolEnv('OPENCLAW_CREATE_DISPOSABLE_SESSION');
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
    orchestrationRequired:
      'operator config revoke of tools.sessions_spawn.attachments.enabled before the row fires',
  });
  evidence.content_receipt = contentReceipt(canary);
  // Operator read-only surface row: config.get establishes the precondition.
  Object.assign(evidence, { operator_surface: true });
  evidence.attachment_policy_enabled = null;
  declareNegative(
    evidence,
    'no-child-spawn-under-revoke',
    'a revoked delegate-input policy must spawn no child session',
  );
  declareNegative(
    evidence,
    'no-raw-attachment-bytes-on-the-wire',
    'refused attachment content must never appear on a non-harness gateway frame',
  );

  const started = Date.now();

  const res = ws.connect(url, {}, (socket) => {
    const tracker = new RequestTracker();

    function dispatchRevokeProbe() {
      tracker.send(socket, 'sessions.messages.subscribe', { key: sessionKey });
      socket.setTimeout(() => {
        const instruction =
          `[k6-proof-harness] Call continue_delegate exactly once with ` +
          `task="CDINREV probe ${rowNonce} — do nothing.", mode="normal", delaySeconds=1, ` +
          `attachments=[{name:"p86-rev-${rowNonce}.txt", content:"${canary}", encoding:"utf8", mimeType:"text/plain"}]. ` +
          `If the tool refuses, reply exactly CDINREV-REFUSED ${rowNonce} <reasonWord> using a single ` +
          `word from the refusal reason, then reply exactly CDINREV-NO-STATE ${rowNonce} if a follow-up ` +
          `continue_delegate with no attachments reports no retained attachment state. ` +
          `If the tool succeeds instead, reply exactly CDINREV-ACCEPTED ${rowNonce}. ` +
          `Never echo the attachment content. This is a proof run — no other action needed.`;
        tracker.send(socket, 'sessions.send', {
          key: sessionKey,
          message: instruction,
          idempotencyKey: `${ROW}-DISPATCH-${rowNonce}`,
        });
      }, 500);
      socket.setTimeout(() => socket.close(), 170000);
    }

    socket.on('open', () => {
      socket.send(connectFrame(token));
      // Operator read-only surface first: establish the live policy precondition.
      socket.setTimeout(() => tracker.send(socket, 'config.get', {}), 250);
    });

    socket.on('message', (raw) => {
      try {
        const msg = JSON.parse(raw);
        const classified = tracker.classify(msg);
        const body = capture(evidence, classified);

        if (classified.kind === 'response' && classified.method === 'config.get') {
          if (classified.ok) {
            fire(evidence, 'operator-policy-snapshot');
            evidence.attachment_policy_enabled = readAttachmentPolicy(classified.payload);
          } else {
            failures.add(1);
          }
          if (createDisposableSession) {
            const disposableKey = `r-cd-in-revoke-${rowNonce}`.toLowerCase().replace(/[^a-z0-9-]/g, '-');
            tracker.send(socket, 'sessions.create', { key: disposableKey, label: `k6 ${ROW}` });
          } else {
            dispatchRevokeProbe();
          }
          return;
        }

        if (classified.kind === 'response' && classified.method === 'sessions.create') {
          if (classified.ok && classified.payload) {
            sessionKey = classified.payload.key || sessionKey;
            evidence.sessionKey = sessionKey;
            evidence.session_created = true;
            evidence.created_session_key = sessionKey;
            dispatchRevokeProbe();
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

        if (body.includes(`CDINREV-REFUSED ${rowNonce}`)) {
          fire(evidence, 'policy-revoke-refusal');
        }
        if (body.includes(`CDINREV-NO-STATE ${rowNonce}`)) {
          fire(evidence, 'scrub-confirmed');
          socket.close();
        }
        if (body.includes(`CDINREV-ACCEPTED ${rowNonce}`)) {
          evidence.attachment_delegate_accepted = true;
          breakNegative(
            evidence,
            'no-child-spawn-under-revoke',
            'delegate with attachments was accepted — the revoke precondition was not in place',
          );
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
    evidence.attachment_policy_enabled === false,
    evidence.attachment_policy_enabled === null
      ? 'config.get did not expose tools.sessions_spawn.attachments.enabled, so the revoke precondition could not be established'
      : 'tools.sessions_spawn.attachments.enabled is still true: no operator revoke was applied, so no-spawn/scrub was not exercised',
  );

  const verdict = computeVerdict(evidence, REQUIRED);

  check(res, { 'websocket connected': (r) => r && r.status === 101 });
  check(null, {
    'operator policy snapshot captured': () => !!evidence.receipts['operator-policy-snapshot'],
    'no child spawned under revoke': () =>
      evidence.negative_checks['no-child-spawn-under-revoke'].held,
    'no raw attachment bytes on the wire': () =>
      evidence.negative_checks['no-raw-attachment-bytes-on-the-wire'].held,
  });

  logEvidence(evidence);
  if (verdict !== 'PASS-candidate') {
    console.log(`[${ROW}] ${evidence.orchestration.reason || 'see missing_receipts'}`);
  }
}

export function handleSummary(data) {
  return rowSummary({
    row: ROW,
    data,
    durationMetric: 'r_cd_in_revoke_duration',
    summaryFile: 'r-cd-in-revoke-no-spawn-scrub-summary.json',
  });
}
