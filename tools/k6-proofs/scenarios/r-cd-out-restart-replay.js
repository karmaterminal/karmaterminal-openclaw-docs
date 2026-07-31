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
 *   seat, and `OPENCLAW_RESTART_ORCHESTRATED=true` is a DECLARATION, never the
 *   evidence. The restart is credited only from the gateway's own public
 *   `/status` surface (uptime going backwards, or the endpoint dropping and
 *   returning), observed while this harness is deliberately DISCONNECTED
 *   between the pre- and post-phase sockets. A real restart therefore cannot
 *   fail the run by dropping a socket, and a missing restart cannot be
 *   declared away. Without that receipt the row terminates PARTIAL-candidate
 *   naming the missing step; the pre-restart legs it did observe are still
 *   recorded as receipts.
 *
 * References:
 *   - Issue: karmaterminal/karmaterminal-openclaw-docs#491
 *   - Manifest: tools/k6-proofs/manifests/r-cd-out-replay.json
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

const ROW = 'R-CD-OUT-REPLAY';

export const options = {
  scenarios: {
    r_cd_out_replay: {
      executor: 'shared-iterations',
      vus: 1,
      iterations: 1,
      maxDuration: '660s',
    },
  },
  thresholds: {
    r_cd_out_replay_duration: ['p(95)<640000'],
  },
};

const failures = new Counter('proof_failures');
const duration = new Trend('r_cd_out_replay_duration');

const manifest = loadManifestFromEnv();

const REQUIRED = [
  'pre-restart-claim-established',
  'gateway-restart-observed',
  'reconnected-after-restart',
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
  const httpBase = httpBaseFromWs(url);
  evidence.restart_declared_by_operator = restartOrchestrated;
  evidence.lifecycle = { baseline: null, observation: null };

  // --- Phase 0: external lifecycle baseline, before anything is published ---
  const baseline = sampleGatewayStatus(httpBase, token);
  evidence.lifecycle.baseline = { reachable: baseline.reachable, uptime: baseline.uptime };

  // --- Phase 1: publish + list the claim, then DISCONNECT for the window ---
  const phase1 = ws.connect(url, {}, (socket) => {
    const tracker = new RequestTracker();

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
      socket.setTimeout(() => socket.close(), 240000);
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

        const preClaim = matchGroup(body, sentinel('CDREPLAY-PRE', rowNonce, ' ([A-Za-z0-9_.:-]+)'));
        if (preClaim && !evidence.pre_restart_claim_id) {
          evidence.pre_restart_claim_id = preClaim;
          evidence.provenance.claim_id = preClaim;
          fire(evidence, 'pre-restart-claim-established');
          // Disconnect on purpose: the operator restart must be survivable, and
          // a socket held open across it would fail the run for the wrong reason.
          socket.close();
        }

        if (body.indexOf('"materialized"') !== -1) {
          breakNegative(
            evidence,
            'no-auto-materialize-on-replay',
            'a materialized state appeared without any explicit recipient materialize call',
          );
        }
      } catch (e) {
        console.warn(`ws error (phase 1): ${e}`);
      }
    });

    socket.on('error', (e) => {
      console.error(`ws error (phase 1): ${e && e.error ? e.error() : e}`);
      failures.add(1);
    });
  });

  // --- Phase 2: externally observable restart window, socket intentionally down ---
  if (evidence.receipts['pre-restart-claim-established']) {
    console.log(
      `${ROW}: pre-restart claim captured and harness disconnected. Operator restart window is OPEN ` +
        `for ${restartWindowMs}ms — restart the gateway to exercise durable replay.`,
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
      reason: 'the pre-restart claim was never established, so the restart window was never opened',
    };
  }

  // --- Phase 3: RECONNECT and re-list the claim from durable state ---
  let phase2 = null;
  if (evidence.receipts['gateway-restart-observed']) {
    phase2 = ws.connect(url, {}, (socket) => {
      const tracker = new RequestTracker();

      socket.on('open', () => {
        fire(evidence, 'reconnected-after-restart');
        socket.send(connectFrame(token));
        socket.setTimeout(() => {
          tracker.send(socket, 'sessions.messages.subscribe', { key: recipientSessionKey });
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
        }, 500);
        socket.setTimeout(() => socket.close(), 180000);
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

          const post = body.match(
            sentinel('CDREPLAY-POST', rowNonce, ' ([A-Za-z0-9_.:-]+) ([0-9]+)'),
          );
          if (post) {
            fire(evidence, 'post-restart-claim-listed');
            evidence.post_restart_claim_id = post[1];
            evidence.post_restart_claim_count = Number(post[2]);
            if (evidence.pre_restart_claim_id && post[1] === evidence.pre_restart_claim_id) {
              fire(evidence, 'claim-identity-stable');
            } else {
              breakNegative(
                evidence,
                'no-duplicate-claim-after-replay',
                `post-restart claim ${post[1]} does not match the pre-restart claim ` +
                  `${evidence.pre_restart_claim_id}`,
              );
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

          if (body.indexOf('"materialized"') !== -1) {
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
      !!evidence.receipts['post-restart-claim-listed'],
    evidence.receipts['gateway-restart-observed']
      ? 'a gateway restart was observed but the reconnected socket saw no post-restart claim listing'
      : `no gateway restart was observable on ${httpBase}/status inside the window` +
        (restartOrchestrated
          ? ' even though OPENCLAW_RESTART_ORCHESTRATED was declared: the declaration is not evidence'
          : '') +
        `: ${evidence.lifecycle.observation?.reason || 'no lifecycle change detected'}`,
  );

  const verdict = computeVerdict(evidence, REQUIRED);

  check(phase1, { 'websocket connected': (r) => r && r.status === 101 });
  check(null, {
    'pre-restart claim established': () => !!evidence.receipts['pre-restart-claim-established'],
    'gateway restart observed on the public status surface': () =>
      !!evidence.receipts['gateway-restart-observed'],
    'harness reconnected after the restart': () =>
      !!evidence.receipts['reconnected-after-restart'],
    'no duplicate claim after replay': () =>
      evidence.negative_checks['no-duplicate-claim-after-replay'].held,
    'no automatic materialization on replay': () =>
      evidence.negative_checks['no-auto-materialize-on-replay'].held,
    'no raw artifact bytes on the wire': () =>
      evidence.negative_checks['no-raw-artifact-bytes-on-the-wire'].held,
  });
  if (phase2) check(phase2, { 'reconnect websocket connected': (r) => r && r.status === 101 });

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
