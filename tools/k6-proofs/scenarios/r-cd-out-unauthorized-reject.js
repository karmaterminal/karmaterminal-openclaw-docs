/**
 * Scenario: R-CD-OUT-UNAUTHORIZED — non-recipient claim access is rejected.
 *
 * Proves the authorization boundary of the managed delegate OUTPUT claim:
 *   1. Session A originates a delegate whose child publishes an artifact.
 *      The resulting claim is bound to A.
 *   2. Session B (a disposable, non-recipient session) is handed the SAME claim
 *      id and calls `delegate_artifacts` inspect and materialize.
 *   3. Both must be REJECTED. A claim is recipient-bound, not bearer-authorized:
 *      knowing the claim id must not be sufficient.
 *   4. Session A (the true recipient) can still inspect — this is the positive
 *      control that proves the rejection was authorization, not a dead claim.
 *
 * Runtime surface: src/agents/delegate-artifact-store.ts (claim/binding status,
 * including `revoked`), src/agents/delegate-artifact-recipient.ts.
 *
 * References:
 *   - Issue: karmaterminal/karmaterminal-openclaw-docs#491
 *   - Manifest: tools/k6-proofs/manifests/r-cd-out-unauthorized.json
 */
import ws from 'k6/ws';
import { check } from 'k6';
import { Counter, Trend } from 'k6/metrics';
import { connectFrame, nonce, RequestTracker } from '../lib/gateway-ws.js';
import { loadManifestFromEnv, validateManifest } from '../lib/manifest-loader.js';
import { closeSocketAfterDelay } from '../lib/socket-close.js';
import {
  baseEvidence,
  breakNegative,
  canaryFor,
  capture,
  computeVerdict,
  contentReceipt,
  declareNegative,
  fire,
  logEvidence,
  matchGroup,
  rowSummary,
  scanRawBytes,
} from '../lib/delegate-attachment-io.js';

const ROW = 'R-CD-OUT-UNAUTHORIZED';

export const options = {
  scenarios: {
    r_cd_out_unauthorized: {
      executor: 'shared-iterations',
      vus: 1,
      iterations: 1,
      maxDuration: '320s',
    },
  },
  thresholds: {
    proof_failures: ['count==0'],
    r_cd_out_unauthorized_duration: ['p(95)<300000'],
  },
};

const failures = new Counter('proof_failures');
const duration = new Trend('r_cd_out_unauthorized_duration');

const manifest = loadManifestFromEnv();

const REQUIRED = [
  'recipient-claim-established',
  'non-recipient-inspect-rejected',
  'non-recipient-materialize-rejected',
  'recipient-positive-control',
];

export default function () {
  const url = __ENV.OPENCLAW_GATEWAY_WS || 'ws://127.0.0.1:18789';
  const token = __ENV.OPENCLAW_GATEWAY_TOKEN;
  const recipientSessionKey = manifest?.sessionKey || __ENV.OPENCLAW_SESSION_KEY || 'main';
  const seat = manifest?.seat || __ENV.OPENCLAW_SEAT_NAME || 'rune-rog-ally';
  const rowNonce = nonce(ROW);
  const canary = canaryFor(rowNonce);
  let intruderSessionKey = null;

  if (!token) {
    console.error('OPENCLAW_GATEWAY_TOKEN is required');
    failures.add(1);
    return;
  }
  if (!__ENV.OPENCLAW_SESSION_KEY) {
    console.warn(
      `${ROW}: OPENCLAW_SESSION_KEY should be set explicitly — this row binds a claim to a named recipient session`,
    );
  }
  if (manifest) {
    const errors = validateManifest(manifest);
    if (errors.length > 0) console.warn(`Manifest validation warnings: ${errors.join('; ')}`);
  }

  const evidence = baseEvidence({
    row: ROW,
    nonce: rowNonce,
    seat,
    requestedSessionKey: recipientSessionKey,
    sessionKey: recipientSessionKey,
    manifest,
  });
  evidence.content_receipt = contentReceipt(canary);
  declareNegative(
    evidence,
    'no-raw-artifact-bytes-on-the-wire',
    'artifact content must never appear on a non-harness gateway frame',
  );
  declareNegative(
    evidence,
    'claim-is-not-bearer-authorized',
    'possession of a claim id must not grant a non-recipient session access',
  );

  const started = Date.now();

  const res = ws.connect(url, {}, (socket) => {
    const tracker = new RequestTracker();
    let closeScheduled = false;

    function maybeClose() {
      if (closeScheduled) return;
      if (REQUIRED.some((name) => !evidence.receipts[name])) return;
      closeScheduled = true;
      closeSocketAfterDelay(socket, Number(__ENV.OPENCLAW_NEGATIVE_WINDOW_MS || 15000), () => {
        console.log(`${ROW}: authorization receipts gathered, closing`);
      });
    }

    function askIntruder(claimId) {
      const instruction =
        `[k6-proof-harness] You are NOT the recipient of artifact claim ${claimId}. ` +
        `Call delegate_artifacts with action="inspect", claimId="${claimId}" and reply exactly ` +
        `CDUNAUTH-INSPECT ${rowNonce} <ok|rejected>. Then call delegate_artifacts with ` +
        `action="materialize", claimId="${claimId}", destination="p86-intrusion/${rowNonce}.txt" and reply ` +
        `exactly CDUNAUTH-MATERIALIZE ${rowNonce} <ok|rejected>. ` +
        `Report the honest outcome of each call. This is a proof run — no other action needed.`;
      tracker.send(socket, 'sessions.send', {
        key: intruderSessionKey,
        message: instruction,
        idempotencyKey: `${ROW}-INTRUDER-${rowNonce}`,
      });
    }

    function askRecipientPositiveControl(claimId) {
      const instruction =
        `[k6-proof-harness] Call delegate_artifacts with action="inspect", claimId="${claimId}" and reply ` +
        `exactly CDUNAUTH-OWNER ${rowNonce} <ok|rejected>. Do not print the artifact contents. ` +
        `This is a proof run — no other action needed.`;
      tracker.send(socket, 'sessions.send', {
        key: recipientSessionKey,
        message: instruction,
        idempotencyKey: `${ROW}-OWNER-${rowNonce}`,
      });
    }

    socket.on('open', () => {
      socket.send(connectFrame(token));
      socket.setTimeout(() => {
        tracker.send(socket, 'sessions.messages.subscribe', { key: recipientSessionKey });
        const intruderKey = `r-cd-out-unauth-${rowNonce}`.toLowerCase().replace(/[^a-z0-9-]/g, '-');
        tracker.send(socket, 'sessions.create', { key: intruderKey, label: `k6 ${ROW} non-recipient` });
      }, 400);
      socket.setTimeout(() => socket.close(), 300000);
    });

    socket.on('message', (raw) => {
      try {
        const msg = JSON.parse(raw);
        const classified = tracker.classify(msg);
        const body = capture(evidence, classified);

        if (classified.kind === 'response' && classified.method === 'sessions.create') {
          if (classified.ok && classified.payload) {
            intruderSessionKey = classified.payload.key;
            evidence.intruder_session_key = intruderSessionKey;
            tracker.send(socket, 'sessions.messages.subscribe', { key: intruderSessionKey });
            const instruction =
              `[k6-proof-harness] Call continue_delegate exactly once with ` +
              `task="Write the single line ${canary} into delegate-artifacts/p86-auth-${rowNonce}.txt in your ` +
              `own workspace, then call delegate_artifacts_publish with paths=[\\"p86-auth-${rowNonce}.txt\\"]. ` +
              `Reply exactly CDUNAUTH-PUBLISHED ${rowNonce}. Do not print the file contents.", ` +
              `mode="normal", delaySeconds=1. After the delegate returns, call delegate_artifacts with ` +
              `action="list" and reply exactly CDUNAUTH-CLAIM ${rowNonce} <claimId>. ` +
              `This is a proof run — no other action needed.`;
            tracker.send(socket, 'sessions.send', {
              key: recipientSessionKey,
              message: instruction,
              idempotencyKey: `${ROW}-DISPATCH-${rowNonce}`,
            });
          } else {
            failures.add(1);
            socket.close();
          }
          return;
        }

        if (classified.kind === 'response' && classified.method === 'sessions.send') {
          if (!classified.ok) failures.add(1);
          return;
        }

        if (classified.kind !== 'event' || !body) return;

        scanRawBytes(evidence, body, rowNonce, 'no-raw-artifact-bytes-on-the-wire');

        const claimId = matchGroup(body, new RegExp(`CDUNAUTH-CLAIM ${rowNonce} ([A-Za-z0-9_.:-]+)`));
        if (claimId && !evidence.provenance.claim_id) {
          evidence.provenance.claim_id = claimId;
          fire(evidence, 'recipient-claim-established');
          if (intruderSessionKey) askIntruder(claimId);
        }

        const intruderInspect = matchGroup(
          body,
          new RegExp(`CDUNAUTH-INSPECT ${rowNonce} ([A-Za-z]+)`),
        );
        if (intruderInspect) {
          evidence.intruder_inspect_outcome = intruderInspect;
          if (intruderInspect.toLowerCase() === 'rejected') {
            fire(evidence, 'non-recipient-inspect-rejected');
          } else {
            breakNegative(
              evidence,
              'claim-is-not-bearer-authorized',
              'a non-recipient session successfully inspected the claim',
            );
          }
        }

        const intruderMaterialize = matchGroup(
          body,
          new RegExp(`CDUNAUTH-MATERIALIZE ${rowNonce} ([A-Za-z]+)`),
        );
        if (intruderMaterialize) {
          evidence.intruder_materialize_outcome = intruderMaterialize;
          if (intruderMaterialize.toLowerCase() === 'rejected') {
            fire(evidence, 'non-recipient-materialize-rejected');
          } else {
            breakNegative(
              evidence,
              'claim-is-not-bearer-authorized',
              'a non-recipient session successfully materialized the claim',
            );
          }
          if (evidence.provenance.claim_id) askRecipientPositiveControl(evidence.provenance.claim_id);
        }

        const owner = matchGroup(body, new RegExp(`CDUNAUTH-OWNER ${rowNonce} ([A-Za-z]+)`));
        if (owner) {
          evidence.recipient_inspect_outcome = owner;
          if (owner.toLowerCase() === 'ok') {
            fire(evidence, 'recipient-positive-control');
          } else {
            evidence.positive_control_failed = true;
          }
        }

        maybeClose();
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
  const verdict = computeVerdict(evidence, REQUIRED);

  check(res, { 'websocket connected': (r) => r && r.status === 101 });
  check(null, {
    'recipient-bound claim established': () => !!evidence.receipts['recipient-claim-established'],
    'non-recipient inspect rejected': () => !!evidence.receipts['non-recipient-inspect-rejected'],
    'non-recipient materialize rejected': () =>
      !!evidence.receipts['non-recipient-materialize-rejected'],
    'recipient positive control still succeeds': () =>
      !!evidence.receipts['recipient-positive-control'],
    'claim id alone grants nothing': () =>
      evidence.negative_checks['claim-is-not-bearer-authorized'].held,
    'no raw artifact bytes on the wire': () =>
      evidence.negative_checks['no-raw-artifact-bytes-on-the-wire'].held,
  });

  if (verdict !== 'PASS-candidate') failures.add(1);
  logEvidence(evidence);
}

export function handleSummary(data) {
  return rowSummary({
    row: ROW,
    data,
    durationMetric: 'r_cd_out_unauthorized_duration',
    summaryFile: 'r-cd-out-unauthorized-reject-summary.json',
  });
}
