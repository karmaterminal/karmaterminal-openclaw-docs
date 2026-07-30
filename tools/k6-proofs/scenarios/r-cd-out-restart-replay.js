/**
 * Scenario: R-CD-OUT-REPLAY — claim survives restart and replays exactly once.
 *
 * Proves the durability half of the managed delegate OUTPUT lifecycle:
 *   1. A claim is published and announced to its recipient session.
 *   2. Across a gateway lifecycle event, the claim is still listable and
 *      inspectable by the recipient — the binding is durable, not in-memory.
 *   3. The replay delivery is idempotent: the recipient sees the SAME claim id,
 *      not a duplicate claim and not a second materialization.
 *
 * Runtime surface: src/agents/delegate-artifact-delivery.ts (delivery phases
 * attempt | replay | acknowledged), src/state/delegate-artifacts-schema.ts.
 *
 * ORCHESTRATION GATE — read this before reading a verdict:
 *   The gateway restart is an operator step. This harness must not restart a
 *   seat. Set `OPENCLAW_RESTART_ORCHESTRATED=true` only when an operator
 *   actually cycled the gateway between the pre- and post-phase of this run.
 *   Without it, the row terminates PARTIAL-candidate naming the missing step;
 *   the pre-restart legs it did observe are still recorded as receipts.
 *
 * References:
 *   - Issue: karmaterminal/karmaterminal-openclaw-docs#491
 *   - Manifest: tools/k6-proofs/manifests/r-cd-out-replay.json
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
  matchGroup,
  orchestrationGate,
  rowSummary,
  scanRawBytes,
} from '../lib/delegate-attachment-io.js';

const ROW = 'R-CD-OUT-REPLAY';

export const options = {
  scenarios: {
    r_cd_out_replay: {
      executor: 'shared-iterations',
      vus: 1,
      iterations: 1,
      maxDuration: '420s',
    },
  },
  thresholds: {
    r_cd_out_replay_duration: ['p(95)<400000'],
  },
};

const failures = new Counter('proof_failures');
const duration = new Trend('r_cd_out_replay_duration');

const manifest = loadManifestFromEnv();

const REQUIRED = [
  'pre-restart-claim-established',
  'post-restart-claim-listed',
  'claim-identity-stable',
  'replay-is-idempotent',
];

export default function () {
  const url = __ENV.OPENCLAW_GATEWAY_WS || 'ws://127.0.0.1:18789';
  const token = __ENV.OPENCLAW_GATEWAY_TOKEN;
  const recipientSessionKey = manifest?.sessionKey || __ENV.OPENCLAW_SESSION_KEY || 'main';
  const seat = manifest?.seat || __ENV.OPENCLAW_SEAT_NAME || 'rune-rog-ally';
  const restartOrchestrated = boolEnv('OPENCLAW_RESTART_ORCHESTRATED');
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
    requestedSessionKey: recipientSessionKey,
    sessionKey: recipientSessionKey,
    manifest,
    orchestrationRequired: 'operator gateway restart between the pre- and post-phase of this run',
  });
  evidence.content_receipt = contentReceipt(canary);
  evidence.restart_window_ms = restartWindowMs;
  declareNegative(
    evidence,
    'no-raw-artifact-bytes-on-the-wire',
    'artifact content must never appear on a non-harness gateway frame across replay',
  );
  declareNegative(
    evidence,
    'no-duplicate-claim-after-replay',
    'replay must not mint a second claim for the same publication',
  );
  declareNegative(
    evidence,
    'no-auto-materialize-on-replay',
    'replay must not materialize the artifact without an explicit recipient action',
  );

  const started = Date.now();

  const res = ws.connect(url, {}, (socket) => {
    const tracker = new RequestTracker();

    function askPostRestartList() {
      const instruction =
        `[k6-proof-harness] Call delegate_artifacts with action="list" and reply exactly ` +
        `CDREPLAY-POST ${rowNonce} <claimId> <count> where <claimId> is the claim whose name contains ` +
        `${rowNonce} and <count> is how many claims carry that nonce. Do not materialize anything. ` +
        `This is a proof run — no other action needed.`;
      tracker.send(socket, 'sessions.send', {
        key: recipientSessionKey,
        message: instruction,
        idempotencyKey: `${ROW}-POST-${rowNonce}`,
      });
    }

    socket.on('open', () => {
      socket.send(connectFrame(token));
      socket.setTimeout(() => {
        tracker.send(socket, 'sessions.messages.subscribe', { key: recipientSessionKey });
        const instruction =
          `[k6-proof-harness] Call continue_delegate exactly once with ` +
          `task="Write the single line ${canary} into delegate-artifacts/p86-replay-${rowNonce}.txt in your ` +
          `own workspace, then call delegate_artifacts_publish with paths=[\\"p86-replay-${rowNonce}.txt\\"]. ` +
          `Reply exactly CDREPLAY-PUBLISHED ${rowNonce}. Do not print the file contents.", ` +
          `mode="normal", delaySeconds=1. After the delegate returns, call delegate_artifacts with ` +
          `action="list" and reply exactly CDREPLAY-PRE ${rowNonce} <claimId>. Do not materialize anything. ` +
          `This is a proof run — no other action needed.`;
        tracker.send(socket, 'sessions.send', {
          key: recipientSessionKey,
          message: instruction,
          idempotencyKey: `${ROW}-DISPATCH-${rowNonce}`,
        });
      }, 400);
      socket.setTimeout(() => socket.close(), 400000);
    });

    socket.on('message', (raw) => {
      try {
        const msg = JSON.parse(raw);
        const classified = tracker.classify(msg);
        const body = capture(evidence, classified);

        if (classified.kind === 'response' && classified.method === 'sessions.send') {
          if (!classified.ok) failures.add(1);
          return;
        }

        if (classified.kind !== 'event' || !body) return;

        scanRawBytes(evidence, body, rowNonce, 'no-raw-artifact-bytes-on-the-wire');

        const preClaim = matchGroup(body, new RegExp(`CDREPLAY-PRE ${rowNonce} ([A-Za-z0-9_.:-]+)`));
        if (preClaim && !evidence.pre_restart_claim_id) {
          evidence.pre_restart_claim_id = preClaim;
          evidence.provenance.claim_id = preClaim;
          fire(evidence, 'pre-restart-claim-established');
          console.log(
            `${ROW}: pre-restart claim captured. Operator restart window opens now ` +
              `(${restartWindowMs}ms) — restart the gateway to exercise durable replay.`,
          );
          socket.setTimeout(askPostRestartList, restartWindowMs);
        }

        const post = body.match(
          new RegExp(`CDREPLAY-POST ${rowNonce} ([A-Za-z0-9_.:-]+) ([0-9]+)`),
        );
        if (post) {
          fire(evidence, 'post-restart-claim-listed');
          evidence.post_restart_claim_id = post[1];
          evidence.post_restart_claim_count = Number(post[2]);
          if (evidence.pre_restart_claim_id && post[1] === evidence.pre_restart_claim_id) {
            fire(evidence, 'claim-identity-stable');
          }
          if (Number(post[2]) === 1) {
            fire(evidence, 'replay-is-idempotent');
          } else if (Number(post[2]) > 1) {
            breakNegative(
              evidence,
              'no-duplicate-claim-after-replay',
              `replay produced ${post[2]} claims for one publication`,
            );
          }
          socket.close();
        }

        if (body.includes('"materialized"')) {
          breakNegative(
            evidence,
            'no-auto-materialize-on-replay',
            'a materialized state appeared without any explicit recipient materialize call',
          );
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
    restartOrchestrated && !!evidence.receipts['post-restart-claim-listed'],
    restartOrchestrated
      ? 'operator restart was declared but no post-restart claim listing was observed'
      : 'OPENCLAW_RESTART_ORCHESTRATED was not set: no operator gateway restart happened inside the restart window, so durable replay was not exercised',
  );

  const verdict = computeVerdict(evidence, REQUIRED);

  check(res, { 'websocket connected': (r) => r && r.status === 101 });
  check(null, {
    'pre-restart claim established': () => !!evidence.receipts['pre-restart-claim-established'],
    'no duplicate claim after replay': () =>
      evidence.negative_checks['no-duplicate-claim-after-replay'].held,
    'no automatic materialization on replay': () =>
      evidence.negative_checks['no-auto-materialize-on-replay'].held,
    'no raw artifact bytes on the wire': () =>
      evidence.negative_checks['no-raw-artifact-bytes-on-the-wire'].held,
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
    durationMetric: 'r_cd_out_replay_duration',
    summaryFile: 'r-cd-out-restart-replay-summary.json',
  });
}
