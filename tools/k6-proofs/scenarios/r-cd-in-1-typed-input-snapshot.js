/**
 * Scenario: R-CD-IN-1 — typed continue_delegate INPUT snapshot + provenance.
 *
 * Proves the typed delegate-input surface assembled at the candidate:
 *   1. A typed `continue_delegate({ attachments: [...] })` call is accepted and
 *      a STRUCTURED continue_delegate tool record appears on the wire.
 *   2. The tool result reports a staged input snapshot (count/bytes), NOT the
 *      attachment content.
 *   3. A structured record binds a child session key to this row's nonce.
 *   4. The child reports the workspace-relative mount path together with the
 *      byte length and sha256 prefix of the file it was handed, and those must
 *      equal the canary digest the harness staged. The canary is known only to
 *      this run, so a matching digest cannot be produced without reading the
 *      staged bytes at the named path: that is the provenance binding.
 *   5. Negative: the attachment content never appears on a non-harness frame.
 *
 * Only the typed tool carries attachment blobs; the bracket
 * `[[CONTINUE_DELEGATE: ...]]` form cannot, so this row has no token sibling.
 *
 * References:
 *   - Issue: karmaterminal/karmaterminal-openclaw-docs#491
 *   - Manifest: tools/k6-proofs/manifests/r-cd-in-1.json
 *   - Runtime: src/agents/tools/continue-delegate-tool.ts,
 *              src/auto-reply/continuation/delegate-flow-store.ts
 */
import ws from 'k6/ws';
import { check } from 'k6';
import { Counter, Trend } from 'k6/metrics';
import { connectFrame, nonce, RequestTracker } from '../lib/gateway-ws.js';
import { loadManifestFromEnv, validateManifest } from '../lib/manifest-loader.js';
import { closeSocketAfterDelay } from '../lib/socket-close.js';
import { childSessionKeysForRow } from '../lib/row-child-correlation.mjs';
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
  rowSummary,
  scanRawBytes,
  sentinel,
  toolResultRecords,
} from '../lib/delegate-attachment-io.js';

const ROW = 'R-CD-IN-1';

export const options = {
  scenarios: {
    r_cd_in_1_typed_input_snapshot: {
      executor: 'shared-iterations',
      vus: 1,
      iterations: 1,
      maxDuration: '200s',
    },
  },
  thresholds: {
    proof_failures: ['count==0'],
    r_cd_in_1_duration: ['p(95)<180000'],
  },
};

const failures = new Counter('proof_failures');
const duration = new Trend('r_cd_in_1_duration');

const manifest = loadManifestFromEnv();

const REQUIRED = [
  'tool-invoke-accepted',
  'typed-tool-record-observed',
  'input-snapshot-staged',
  'child-session-bound',
  'child-mount-provenance',
  'child-bytes-bound-to-canary',
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
    'no-raw-attachment-bytes-on-the-wire',
    'attachment content must never appear on a non-harness gateway frame',
  );
  declareNegative(
    evidence,
    'no-absolute-path-mount',
    'the child mount path must be workspace-relative, never an absolute host path',
  );
  declareNegative(
    evidence,
    'child-bytes-match-the-known-canary',
    'the digest/size the child reports for its mounted file must equal the canary the harness staged',
  );

  const started = Date.now();

  const res = ws.connect(url, {}, (socket) => {
    const tracker = new RequestTracker();
    let closeScheduled = false;

    function maybeClose() {
      if (closeScheduled) return;
      if (REQUIRED.some((name) => !evidence.receipts[name])) return;
      closeScheduled = true;
      closeSocketAfterDelay(socket, Number(__ENV.OPENCLAW_TRACE_INGEST_GRACE_MS || 10000), () => {
        console.log(`${ROW}: required receipts gathered, closing`);
      });
    }

    function startProofFlow() {
      tracker.send(socket, 'sessions.messages.subscribe', { key: sessionKey });
      socket.setTimeout(() => {
        const instruction =
          `[k6-proof-harness] Call continue_delegate exactly once with ` +
          `task="Locate the attachment you were handed. Reply exactly: ` +
          `CDIN1-CHILD-SAW ${rowNonce} <mountRelPath> <byteLength> <sha256First16> where <mountRelPath> is the ` +
          `workspace-relative path of that file, <byteLength> is its size in bytes, and <sha256First16> is the ` +
          `first 16 hex characters of its sha256 digest (run: sha256sum <mountRelPath>). ` +
          `Do not print the file contents. Do not mutate any other file.", ` +
          `mode="normal", delaySeconds=1, ` +
          `attachments=[{name:"p86-in-${rowNonce}.txt", content:"${canary}", encoding:"utf8", mimeType:"text/plain"}]. ` +
          `After the tool result reports the delegate is scheduled, reply exactly ` +
          `CDIN1-SNAPSHOT-STAGED ${rowNonce} <count> <bytes> — where <count> and <bytes> come from the ` +
          `tool result's attachment snapshot receipt. Never echo the attachment content. ` +
          `This is a proof run — no other action needed.`;
        tracker.send(socket, 'sessions.send', {
          key: sessionKey,
          message: instruction,
          idempotencyKey: `${ROW}-DISPATCH-${rowNonce}`,
        });
      }, 500);
      socket.setTimeout(() => socket.close(), 180000);
    }

    socket.on('open', () => {
      socket.send(connectFrame(token));
      if (createDisposableSession) {
        socket.setTimeout(() => {
          const disposableKey = `r-cd-in-1-${rowNonce}`.toLowerCase().replace(/[^a-z0-9-]/g, '-');
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
            console.error('sessions.create rejected');
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
            console.error('sessions.send rejected');
            failures.add(1);
          }
          return;
        }

        if (classified.kind !== 'event' || !body) return;

        scanRawBytes(evidence, body, rowNonce, 'no-raw-attachment-bytes-on-the-wire');

        // Structured authority: a continue_delegate tool record must exist on
        // the wire. A prose sentinel alone can be produced by a model that
        // never called the tool.
        const toolRecords = toolResultRecords(classified.data, 'continue_delegate');
        if (toolRecords.length > 0) {
          fire(evidence, 'typed-tool-record-observed');
          evidence.typed_tool_records = (evidence.typed_tool_records || 0) + toolRecords.length;
        }

        // Structured child binding: only a record that ties childSessionKey to
        // this row's nonce is authority for "the delegate child exists".
        const childKeys = childSessionKeysForRow(classified.data, rowNonce);
        if (childKeys.length === 1) {
          fire(evidence, 'child-session-bound');
          evidence.provenance.child_session_key = childKeys[0];
        }

        const staged = body.match(sentinel('CDIN1-SNAPSHOT-STAGED', rowNonce, ' ([0-9]+) ([0-9]+)'));
        if (staged) {
          fire(evidence, 'input-snapshot-staged');
          evidence.snapshot_reported = { count: Number(staged[1]), bytes: Number(staged[2]) };
        }

        const saw = body.match(
          sentinel('CDIN1-CHILD-SAW', rowNonce, ' ([^"\\s\\\\]+) ([0-9]+) ([0-9a-f]{16})'),
        );
        if (saw) {
          const mount = saw[1];
          const reportedBytes = Number(saw[2]);
          const reportedDigest = saw[3];
          fire(evidence, 'child-mount-provenance');
          evidence.provenance.mount_rel_path = mount;
          evidence.child_reported = { bytes: reportedBytes, sha256_prefix: reportedDigest };
          if (mount.startsWith('/') || /^[A-Za-z]:/.test(mount)) {
            breakNegative(evidence, 'no-absolute-path-mount', `mount path is absolute: ${mount}`);
          }
          // The canary is known to the harness only. A child that reports the
          // same size AND the same digest necessarily read the staged bytes at
          // the mount path it named; a hallucinated path cannot produce this.
          const bytesMatch = reportedBytes === evidence.content_receipt.bytes;
          const digestMatch = reportedDigest === evidence.content_receipt.sha256_prefix;
          if (bytesMatch && digestMatch) {
            fire(evidence, 'child-bytes-bound-to-canary');
          } else {
            breakNegative(
              evidence,
              'child-bytes-match-the-known-canary',
              `child reported bytes=${reportedBytes}/digest=${reportedDigest}, harness staged ` +
                `bytes=${evidence.content_receipt.bytes}/digest=${evidence.content_receipt.sha256_prefix}`,
            );
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
    'typed continue_delegate dispatch accepted': () => !!evidence.receipts['tool-invoke-accepted'],
    'structured continue_delegate tool record observed': () =>
      !!evidence.receipts['typed-tool-record-observed'],
    'input snapshot staged receipt observed': () => !!evidence.receipts['input-snapshot-staged'],
    'child session bound to the row nonce': () => !!evidence.receipts['child-session-bound'],
    'child observed workspace-relative mount': () => !!evidence.receipts['child-mount-provenance'],
    'child bytes/digest bound to the staged canary': () =>
      !!evidence.receipts['child-bytes-bound-to-canary'],
    'no raw attachment bytes on the wire': () =>
      evidence.negative_checks['no-raw-attachment-bytes-on-the-wire'].held,
    'mount path is workspace-relative': () => evidence.negative_checks['no-absolute-path-mount'].held,
    'child bytes match the known canary': () =>
      evidence.negative_checks['child-bytes-match-the-known-canary'].held,
  });

  if (verdict !== 'PASS-candidate') failures.add(1);
  logEvidence(evidence);
}

export function handleSummary(data) {
  return rowSummary({
    row: ROW,
    data,
    durationMetric: 'r_cd_in_1_duration',
    summaryFile: 'r-cd-in-1-typed-input-snapshot-summary.json',
  });
}
