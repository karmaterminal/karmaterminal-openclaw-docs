/**
 * Scenario: R-CD-IO-NEG — negative boundary for delegate attachment I/O.
 *
 * This row exists to prove the things that must NOT happen. It is the guard on
 * the #491 non-goals: a managed delegate artifact is a CLAIM, not a delivery.
 *
 * Positive control (so the negatives are not vacuous):
 *   - a claim IS published and IS announced to its recipient session.
 *
 * Negative boundary, asserted over a bounded observation window after the
 * announcement, with NO explicit recipient action taken:
 *   1. no automatic raw-byte mount — artifact content never crosses the wire
 *   2. no automatic materialization into the recipient workspace
 *   3. no Discord / native-media upload or channel attachment delivery
 *   4. no generic render / forward of the artifact into the reply text
 *   5. no prompt injection — the announcement is an explicit-action notice, not
 *      an instruction the recipient is made to obey
 *
 * Runtime surface: src/agents/internal-events.ts (the explicit-action footer),
 * src/agents/tools/delegate-artifacts-tool.ts (materialize is caller-driven).
 *
 * References:
 *   - Issue: karmaterminal/karmaterminal-openclaw-docs#491
 *   - Manifest: tools/k6-proofs/manifests/r-cd-io-neg.json
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

const ROW = 'R-CD-IO-NEG';

export const options = {
  scenarios: {
    r_cd_io_neg: {
      executor: 'shared-iterations',
      vus: 1,
      iterations: 1,
      maxDuration: '300s',
    },
  },
  thresholds: {
    proof_failures: ['count==0'],
    r_cd_io_neg_duration: ['p(95)<280000'],
  },
};

const failures = new Counter('proof_failures');
const duration = new Trend('r_cd_io_neg_duration');

const manifest = loadManifestFromEnv();

const REQUIRED = ['tool-invoke-accepted', 'claim-announced-positive-control', 'negative-window-elapsed'];

/** Event names/fields that would indicate a native-media or channel upload. */
const MEDIA_DELIVERY_SIGNALS = [
  '"attachments":[{',
  '"mediaUrl"',
  '"discordAttachment"',
  '"upload"',
  '"nativeMedia"',
];

export default function () {
  const url = __ENV.OPENCLAW_GATEWAY_WS || 'ws://127.0.0.1:18789';
  const token = __ENV.OPENCLAW_GATEWAY_TOKEN;
  const requestedSessionKey = manifest?.sessionKey || __ENV.OPENCLAW_SESSION_KEY || 'main';
  let sessionKey = requestedSessionKey;
  const seat = manifest?.seat || __ENV.OPENCLAW_SEAT_NAME || 'rune-rog-ally';
  const createDisposableSession = boolEnv('OPENCLAW_CREATE_DISPOSABLE_SESSION');
  const negativeWindowMs = Number(__ENV.OPENCLAW_NEGATIVE_WINDOW_MS || 45000);
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
  evidence.negative_window_ms = negativeWindowMs;
  declareNegative(evidence, 'no-automatic-raw-byte-mount', 'artifact bytes must never cross the wire unasked');
  declareNegative(evidence, 'no-automatic-materialization', 'no materialize without an explicit recipient call');
  declareNegative(evidence, 'no-native-media-upload', 'no Discord/native-media or channel attachment delivery');
  declareNegative(evidence, 'no-generic-render-or-forward', 'artifact content must not be rendered into reply text');
  declareNegative(evidence, 'no-prompt-injection', 'the announcement must not instruct the recipient to act on its behalf');

  const started = Date.now();

  const res = ws.connect(url, {}, (socket) => {
    const tracker = new RequestTracker();
    let windowOpenedAt = null;

    function startProofFlow() {
      tracker.send(socket, 'sessions.messages.subscribe', { key: sessionKey });
      socket.setTimeout(() => {
        const instruction =
          `[k6-proof-harness] Call continue_delegate exactly once with ` +
          `task="Write the single line ${canary} into delegate-artifacts/p86-neg-${rowNonce}.txt in your ` +
          `own workspace, then call delegate_artifacts_publish with paths=[\\"p86-neg-${rowNonce}.txt\\"]. ` +
          `Reply exactly CDNEG-PUBLISHED ${rowNonce}. Do not print the file contents.", ` +
          `mode="normal", delaySeconds=1. ` +
          `When the delegate return announces an artifact claim, reply exactly ` +
          `CDNEG-ANNOUNCED ${rowNonce} <claimId> and then STOP. ` +
          `Do NOT call delegate_artifacts at all. Do NOT materialize, upload, forward, render, ` +
          `or quote the artifact. This is a proof run — no other action needed.`;
        tracker.send(socket, 'sessions.send', {
          key: sessionKey,
          message: instruction,
          idempotencyKey: `${ROW}-DISPATCH-${rowNonce}`,
        });
      }, 500);
      socket.setTimeout(() => socket.close(), 280000);
    }

    socket.on('open', () => {
      socket.send(connectFrame(token));
      if (createDisposableSession) {
        socket.setTimeout(() => {
          const disposableKey = `r-cd-io-neg-${rowNonce}`.toLowerCase().replace(/[^a-z0-9-]/g, '-');
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

        // (1) raw-byte mount / (4) render-or-forward share the same canary probe:
        // the artifact content must not appear on any non-harness frame.
        scanRawBytes(evidence, body, rowNonce, 'no-automatic-raw-byte-mount');
        if (body.includes(canary)) {
          breakNegative(evidence, 'no-generic-render-or-forward', 'artifact content rendered into a reply frame');
        }

        // (2) automatic materialization
        if (body.includes('"materialized"') || body.includes('"materializedPath"')) {
          breakNegative(
            evidence,
            'no-automatic-materialization',
            'a materialized state appeared with no explicit delegate_artifacts materialize call',
          );
        }

        // (3) native-media / channel upload
        for (const signal of MEDIA_DELIVERY_SIGNALS) {
          if (body.includes(signal) && body.includes(rowNonce)) {
            breakNegative(
              evidence,
              'no-native-media-upload',
              `channel/native-media delivery signal observed: ${signal}`,
            );
          }
        }

        // (5) prompt injection: the announcement must describe an explicit action,
        // never issue an imperative the recipient is made to obey.
        if (
          body.includes(rowNonce) &&
          /"(?:injectedInstruction|systemDirective|autoInstruction)"/.test(body)
        ) {
          breakNegative(
            evidence,
            'no-prompt-injection',
            'the claim announcement carried an injected instruction field',
          );
        }

        const announced = matchGroup(body, new RegExp(`CDNEG-ANNOUNCED ${rowNonce} ([A-Za-z0-9_.:-]+)`));
        if (announced && !windowOpenedAt) {
          fire(evidence, 'claim-announced-positive-control');
          evidence.provenance.claim_id = announced;
          windowOpenedAt = Date.now();
          console.log(`${ROW}: negative observation window open for ${negativeWindowMs}ms`);
          closeSocketAfterDelay(socket, negativeWindowMs, () => {
            fire(evidence, 'negative-window-elapsed');
            console.log(`${ROW}: negative observation window elapsed with no violation escalation`);
          });
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
  // The window receipt is only credible when the window actually ran to term.
  if (evidence.receipts['claim-announced-positive-control'] && !evidence.receipts['negative-window-elapsed']) {
    console.warn(`${ROW}: negative window did not run to term; the row stays PARTIAL`);
  }
  const verdict = computeVerdict(evidence, REQUIRED);

  check(res, { 'websocket connected': (r) => r && r.status === 101 });
  check(null, {
    'positive control: claim announced': () =>
      !!evidence.receipts['claim-announced-positive-control'],
    'no automatic raw-byte mount': () => evidence.negative_checks['no-automatic-raw-byte-mount'].held,
    'no automatic materialization': () => evidence.negative_checks['no-automatic-materialization'].held,
    'no native-media/channel upload': () => evidence.negative_checks['no-native-media-upload'].held,
    'no generic render or forward': () => evidence.negative_checks['no-generic-render-or-forward'].held,
    'no prompt injection in the announcement': () => evidence.negative_checks['no-prompt-injection'].held,
  });

  if (verdict !== 'PASS-candidate') failures.add(1);
  logEvidence(evidence);
}

export function handleSummary(data) {
  return rowSummary({
    row: ROW,
    data,
    durationMetric: 'r_cd_io_neg_duration',
    summaryFile: 'r-cd-io-negative-boundary-summary.json',
  });
}
