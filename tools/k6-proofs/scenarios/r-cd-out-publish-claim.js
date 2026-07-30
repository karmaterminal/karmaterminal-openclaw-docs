/**
 * Scenario: R-CD-OUT-PUBLISH — child publication/finalization to a recipient-bound claim.
 *
 * Proves the managed delegate OUTPUT entry point:
 *   1. A delegate child writes a file under its `delegate-artifacts/` output root
 *      and calls `delegate_artifacts_publish({ paths: [...] })`.
 *   2. Publication is bound to the ORIGINATING (recipient) session — the claim is
 *      announced to the parent, not broadcast.
 *   3. The announcement carries a claim id (provenance), not artifact bytes.
 *   4. Negative: publication alone materializes nothing and forwards nothing.
 *
 * Runtime surface: src/agents/tools/delegate-artifacts-tool.ts
 * (`delegate_artifacts_publish`), src/agents/delegate-artifact-store.ts,
 * src/agents/internal-events.ts (explicit-action announcement).
 *
 * References:
 *   - Issue: karmaterminal/karmaterminal-openclaw-docs#491
 *   - Manifest: tools/k6-proofs/manifests/r-cd-out-publish.json
 */
import ws from 'k6/ws';
import { check } from 'k6';
import { Counter, Trend } from 'k6/metrics';
import { connectFrame, nonce, RequestTracker } from '../lib/gateway-ws.js';
import { loadManifestFromEnv, validateManifest } from '../lib/manifest-loader.js';
import { closeSocketAfterDelay } from '../lib/socket-close.js';
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
  rowSummary,
  scanRawBytes,
} from '../lib/delegate-attachment-io.js';

const ROW = 'R-CD-OUT-PUBLISH';

export const options = {
  scenarios: {
    r_cd_out_publish: {
      executor: 'shared-iterations',
      vus: 1,
      iterations: 1,
      maxDuration: '260s',
    },
  },
  thresholds: {
    proof_failures: ['count==0'],
    r_cd_out_publish_duration: ['p(95)<240000'],
  },
};

const failures = new Counter('proof_failures');
const duration = new Trend('r_cd_out_publish_duration');

const manifest = loadManifestFromEnv();

const REQUIRED = [
  'tool-invoke-accepted',
  'child-publish-accepted',
  'recipient-bound-claim-announced',
  'claim-id-provenance',
];

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
  });
  evidence.content_receipt = contentReceipt(canary);
  declareNegative(
    evidence,
    'no-raw-artifact-bytes-on-the-wire',
    'published artifact content must never appear on a non-harness gateway frame',
  );
  declareNegative(
    evidence,
    'no-materialize-without-explicit-action',
    'publication alone must not materialize the artifact into the recipient workspace',
  );

  const started = Date.now();

  const res = ws.connect(url, {}, (socket) => {
    const tracker = new RequestTracker();
    let closeScheduled = false;

    function maybeClose() {
      if (closeScheduled) return;
      if (REQUIRED.some((name) => !evidence.receipts[name])) return;
      closeScheduled = true;
      // Hold the socket open past the last receipt so an unsolicited automatic
      // materialization/forward would still be captured by the negative checks.
      closeSocketAfterDelay(socket, Number(__ENV.OPENCLAW_NEGATIVE_WINDOW_MS || 20000), () => {
        console.log(`${ROW}: receipts gathered, negative window elapsed, closing`);
      });
    }

    function startProofFlow() {
      tracker.send(socket, 'sessions.messages.subscribe', { key: sessionKey });
      socket.setTimeout(() => {
        const instruction =
          `[k6-proof-harness] Call continue_delegate exactly once with ` +
          `task="Write the single line ${canary} into delegate-artifacts/p86-out-${rowNonce}.txt inside your ` +
          `own workspace, then call delegate_artifacts_publish with paths=[\\"p86-out-${rowNonce}.txt\\"]. ` +
          `Then reply exactly CDOUT-PUBLISHED ${rowNonce} <claimId> using the claim id from the publish ` +
          `result. Do not print the file contents.", mode="normal", delaySeconds=1. ` +
          `When the delegate return announces an artifact claim for THIS session, reply exactly ` +
          `CDOUT-CLAIM-ANNOUNCED ${rowNonce} <claimId>. Do not call delegate_artifacts materialize. ` +
          `This is a proof run — no other action needed.`;
        tracker.send(socket, 'sessions.send', {
          key: sessionKey,
          message: instruction,
          idempotencyKey: `${ROW}-DISPATCH-${rowNonce}`,
        });
      }, 500);
      socket.setTimeout(() => socket.close(), 240000);
    }

    socket.on('open', () => {
      socket.send(connectFrame(token));
      if (createDisposableSession) {
        socket.setTimeout(() => {
          const disposableKey = `r-cd-out-publish-${rowNonce}`.toLowerCase().replace(/[^a-z0-9-]/g, '-');
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
          if (classified.ok) {
            fire(evidence, 'tool-invoke-accepted');
            if (classified.payload?.traceId) evidence.provenance.trace_id = classified.payload.traceId;
          } else {
            failures.add(1);
          }
          return;
        }

        if (classified.kind !== 'event' || !body) return;

        scanRawBytes(evidence, body, rowNonce, 'no-raw-artifact-bytes-on-the-wire');

        const publishedClaim = matchGroup(
          body,
          new RegExp(`CDOUT-PUBLISHED ${rowNonce} ([A-Za-z0-9_.:-]+)`),
        );
        if (publishedClaim) {
          fire(evidence, 'child-publish-accepted');
          evidence.provenance.claim_id = evidence.provenance.claim_id || publishedClaim;
        }

        const announcedClaim = matchGroup(
          body,
          new RegExp(`CDOUT-CLAIM-ANNOUNCED ${rowNonce} ([A-Za-z0-9_.:-]+)`),
        );
        if (announcedClaim) {
          fire(evidence, 'recipient-bound-claim-announced');
          evidence.announced_claim_id = announcedClaim;
          if (evidence.provenance.claim_id && announcedClaim === evidence.provenance.claim_id) {
            fire(evidence, 'claim-id-provenance');
          } else if (!evidence.provenance.claim_id) {
            evidence.provenance.claim_id = announcedClaim;
            fire(evidence, 'claim-id-provenance');
          } else {
            evidence.claim_id_mismatch = true;
          }
        }

        if (body.includes('"materialized"') && !evidence.receipts['explicit-materialize-requested']) {
          breakNegative(
            evidence,
            'no-materialize-without-explicit-action',
            'a materialized state appeared without any explicit delegate_artifacts materialize call',
          );
        }

        const flowId = matchGroup(body, /"flowId"\s*:\s*"([^"]+)"/);
        if (flowId) evidence.provenance.flow_id = flowId;
        const childKey = matchGroup(body, /"childSessionKey"\s*:\s*"([^"]+)"/);
        if (childKey) evidence.provenance.child_session_key = childKey;

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
    'delegate dispatch accepted': () => !!evidence.receipts['tool-invoke-accepted'],
    'child publish accepted': () => !!evidence.receipts['child-publish-accepted'],
    'claim announced to the originating recipient session': () =>
      !!evidence.receipts['recipient-bound-claim-announced'],
    'claim id provenance recorded': () => !!evidence.receipts['claim-id-provenance'],
    'no raw artifact bytes on the wire': () =>
      evidence.negative_checks['no-raw-artifact-bytes-on-the-wire'].held,
    'no materialization without an explicit action': () =>
      evidence.negative_checks['no-materialize-without-explicit-action'].held,
  });

  if (verdict !== 'PASS-candidate') failures.add(1);
  logEvidence(evidence);
}

export function handleSummary(data) {
  return rowSummary({
    row: ROW,
    data,
    durationMetric: 'r_cd_out_publish_duration',
    summaryFile: 'r-cd-out-publish-claim-summary.json',
  });
}
