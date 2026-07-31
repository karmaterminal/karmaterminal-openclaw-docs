/**
 * Scenario: R-CD-OUT-CLAIM — recipient-bound list / inspect / authorized
 * materialize / discard.
 *
 * Proves the managed delegate OUTPUT claim lifecycle end to end from the
 * recipient side, using only the typed `delegate_artifacts` tool:
 *   list -> inspect -> materialize (workspace-relative destination) -> discard
 *
 * Each leg must be an EXPLICIT action. Nothing in this row may be reached by
 * automatic delivery: the artifact only lands in the recipient workspace because
 * the recipient asked for it, at a path the recipient named.
 *
 * Runtime surface: src/agents/tools/delegate-artifacts-tool.ts
 * (`action: list|inspect|materialize|discard`, `destination` constrained to safe
 * workspace-relative segments), src/agents/delegate-artifacts.ts
 * (`markDelegateArtifactMaterialized`, `discardDelegateArtifactForRecipient`).
 *
 * References:
 *   - Issue: karmaterminal/karmaterminal-openclaw-docs#491
 *   - Manifest: tools/k6-proofs/manifests/r-cd-out-claim.json
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
  sentinel,
  toolRecordRejected,
  toolResultRecords,
} from '../lib/delegate-attachment-io.js';

const ROW = 'R-CD-OUT-CLAIM';

export const options = {
  scenarios: {
    r_cd_out_claim: {
      executor: 'shared-iterations',
      vus: 1,
      iterations: 1,
      maxDuration: '320s',
    },
  },
  thresholds: {
    proof_failures: ['count==0'],
    r_cd_out_claim_duration: ['p(95)<300000'],
  },
};

const failures = new Counter('proof_failures');
const duration = new Trend('r_cd_out_claim_duration');

const manifest = loadManifestFromEnv();

const REQUIRED = [
  'tool-invoke-accepted',
  'claim-listed',
  'claim-inspected',
  'authorized-materialize',
  'claim-discarded',
  'post-discard-inspect-rejected',
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
  const destination = `p86-materialized/${rowNonce}.txt`;

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
  evidence.requested_destination = destination;
  declareNegative(
    evidence,
    'no-raw-artifact-bytes-on-the-wire',
    'artifact content must never appear on a non-harness gateway frame, including inspect results',
  );
  declareNegative(
    evidence,
    'materialize-destination-is-workspace-relative',
    'the materialize destination must stay workspace-relative, never absolute or traversing',
  );
  declareNegative(
    evidence,
    'no-read-after-discard',
    'a discarded claim must not remain readable, and the post-discard probe must name that same claim',
  );
  declareNegative(
    evidence,
    'discard-targets-the-listed-claim',
    'the discarded claim id must be the claim id that was listed and inspected',
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
        console.log(`${ROW}: lifecycle receipts gathered, closing`);
      });
    }

    function startProofFlow() {
      tracker.send(socket, 'sessions.messages.subscribe', { key: sessionKey });
      socket.setTimeout(() => {
        const instruction =
          `[k6-proof-harness] Step 1: call continue_delegate exactly once with ` +
          `task="Write the single line ${canary} into delegate-artifacts/p86-claim-${rowNonce}.txt in your ` +
          `own workspace, then call delegate_artifacts_publish with paths=[\\"p86-claim-${rowNonce}.txt\\"]. ` +
          `Reply exactly CDCLAIM-CHILD-PUBLISHED ${rowNonce}. Do not print the file contents.", ` +
          `mode="normal", delaySeconds=1. ` +
          `Step 2, only after the delegate returns and announces a claim, run these four ` +
          `delegate_artifacts calls in order and acknowledge each one on its own line: ` +
          `(a) action="list" then reply CDCLAIM-LISTED ${rowNonce} <claimId>; ` +
          `(b) action="inspect", claimId=<claimId> then reply CDCLAIM-INSPECTED ${rowNonce} <bytes> <mimeType>; ` +
          `(c) action="materialize", claimId=<claimId>, destination="${destination}" then reply ` +
          `CDCLAIM-MATERIALIZED ${rowNonce} <destination>; ` +
          `(d) action="discard", claimId=<claimId> then reply CDCLAIM-DISCARDED ${rowNonce} <claimId>; ` +
          `finally call action="inspect" with the same claimId once more and reply ` +
          `CDCLAIM-POSTDISCARD ${rowNonce} <claimId> <ok|rejected> <reasonWord> — where <reasonWord> is a ` +
          `single word taken from that final tool result (use "none" only if it succeeded). ` +
          `Never print the artifact contents. This is a proof run — no other action needed.`;
        tracker.send(socket, 'sessions.send', {
          key: sessionKey,
          message: instruction,
          idempotencyKey: `${ROW}-DISPATCH-${rowNonce}`,
        });
      }, 500);
      socket.setTimeout(() => socket.close(), 300000);
    }

    socket.on('open', () => {
      socket.send(connectFrame(token));
      if (createDisposableSession) {
        socket.setTimeout(() => {
          const disposableKey = `r-cd-out-claim-${rowNonce}`.toLowerCase().replace(/[^a-z0-9-]/g, '-');
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

        scanRawBytes(evidence, body, rowNonce, 'no-raw-artifact-bytes-on-the-wire');

        if (body.includes(`CDCLAIM-CHILD-PUBLISHED ${rowNonce}`)) {
          fire(evidence, 'child-publish-accepted');
        }

        const listedClaim = matchGroup(
          body,
          sentinel('CDCLAIM-LISTED', rowNonce, ' ([A-Za-z0-9_.:-]+)'),
        );
        if (listedClaim) {
          fire(evidence, 'claim-listed');
          evidence.provenance.claim_id = listedClaim;
        }

        const inspected = body.match(
          sentinel('CDCLAIM-INSPECTED', rowNonce, ' ([0-9]+) ([A-Za-z0-9_./+-]+)'),
        );
        if (inspected) {
          fire(evidence, 'claim-inspected');
          evidence.inspect_receipt = { bytes: Number(inspected[1]), mimeType: inspected[2] };
        }

        const materialized = matchGroup(
          body,
          sentinel('CDCLAIM-MATERIALIZED', rowNonce, ' ([^"\\s\\\\]+)'),
        );
        if (materialized) {
          fire(evidence, 'authorized-materialize');
          evidence.provenance.materialized_destination = materialized;
          if (materialized.startsWith('/') || materialized.includes('..') || /^[A-Za-z]:/.test(materialized)) {
            breakNegative(
              evidence,
              'materialize-destination-is-workspace-relative',
              `destination escaped the workspace: ${materialized}`,
            );
          }
        }

        const discarded = matchGroup(
          body,
          sentinel('CDCLAIM-DISCARDED', rowNonce, ' ([A-Za-z0-9_.:-]+)'),
        );
        if (discarded) {
          evidence.discarded_claim_id = discarded;
          if (evidence.provenance.claim_id && discarded !== evidence.provenance.claim_id) {
            breakNegative(
              evidence,
              'discard-targets-the-listed-claim',
              `discarded ${discarded} but the listed claim was ${evidence.provenance.claim_id}`,
            );
          } else {
            fire(evidence, 'claim-discarded');
          }
        }

        // A structured rejection on the post-discard delegate_artifacts call is
        // the authority for "the claim is unreadable". Prose alone is not.
        const rejectedRecords = toolResultRecords(classified.data, 'delegate_artifacts')
          .filter((record) => toolRecordRejected(record));
        if (rejectedRecords.length > 0 && evidence.receipts['claim-discarded']) {
          evidence.post_discard_tool_rejection = true;
        }

        const postDiscard = body.match(
          sentinel('CDCLAIM-POSTDISCARD', rowNonce, ' ([A-Za-z0-9_.:-]+) ([A-Za-z]+) ([A-Za-z0-9_-]+)'),
        );
        if (postDiscard) {
          const [, postClaimId, outcome, reasonWord] = postDiscard;
          evidence.post_discard_inspect = {
            claimId: postClaimId,
            outcome: outcome.toLowerCase(),
            reasonWord,
            toolRejectionObserved: evidence.post_discard_tool_rejection === true,
          };
          const claimIdMatches =
            !!evidence.provenance.claim_id && postClaimId === evidence.provenance.claim_id;
          if (!claimIdMatches) {
            breakNegative(
              evidence,
              'no-read-after-discard',
              `post-discard inspect named ${postClaimId}, not the discarded claim ` +
                `${evidence.provenance.claim_id || '(none listed)'}`,
            );
          } else if (outcome.toLowerCase() === 'ok') {
            breakNegative(
              evidence,
              'no-read-after-discard',
              'inspect still succeeded after the claim was discarded',
            );
          } else if (evidence.post_discard_tool_rejection === true) {
            // Bound on three axes: the same claim id, an explicit rejected
            // outcome, and a structured delegate_artifacts error record.
            fire(evidence, 'post-discard-inspect-rejected');
          } else {
            evidence.post_discard_unbound_reason =
              'the recipient reported a rejection but no structured delegate_artifacts error record was ' +
              'observed on the wire, so the rejection is not receipt-bound';
          }
          socket.close();
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
    'recipient listed the claim': () => !!evidence.receipts['claim-listed'],
    'recipient inspected the claim': () => !!evidence.receipts['claim-inspected'],
    'recipient-authorized materialize succeeded': () => !!evidence.receipts['authorized-materialize'],
    'recipient discarded the claim': () => !!evidence.receipts['claim-discarded'],
    'post-discard inspect was rejected for the same claim': () =>
      !!evidence.receipts['post-discard-inspect-rejected'],
    'materialize destination stayed workspace-relative': () =>
      evidence.negative_checks['materialize-destination-is-workspace-relative'].held,
    'no read after discard': () => evidence.negative_checks['no-read-after-discard'].held,
    'discard targeted the listed claim': () =>
      evidence.negative_checks['discard-targets-the-listed-claim'].held,
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
    durationMetric: 'r_cd_out_claim_duration',
    summaryFile: 'r-cd-out-claim-lifecycle-summary.json',
  });
}
