/**
 * Scenario: R-RC-1 — request_compaction() threshold-REJECT guard.
 *
 * Proves the SAFETY guard: request_compaction must be REJECTED on a
 * below-threshold (low-context) session — compaction must NOT fire. This is the
 * non-mutating proof that gates the irreversible accept path (R-RC-2).
 *
 * Manifest-driven: reads row config from OPENCLAW_ROW_MANIFEST env var
 * or falls back to inline defaults for shape-testing.
 *
 * SAFETY (see tools/k6-proofs/SAFETY-MANIFEST.md, #104):
 *   - R-RC-1 is **serialized**: it reads/asserts live context %, so it must not
 *     run in parallel with continuation/delegate rows on the same session.
 *   - It is **non-mutating** on the REJECT path: compaction does not fire, so the
 *     pre-compaction working set is preserved. This is why R-RC-1 runs BEFORE R-RC-2.
 *   - Run on a genuinely low-context session (a fresh/idle main session) so the
 *     threshold guard is actually exercised.
 *
 * References:
 *   - Issue: karmaterminal/karmaterminal-openclaw-docs#104
 *   - Manifest: tools/k6-proofs/manifests/r-rc-1.json
 *   - Guard byte (HEAD 82827d3cbcb): request_compaction requires >=70% context
 *     usage and at most one request per 5 minutes per session; below threshold it
 *     returns a structured rejection (no compaction).
 */
import ws from 'k6/ws';
import { check } from 'k6';
import { Counter, Trend } from 'k6/metrics';
import { connectFrame, nonce, RequestTracker, redactEvent } from '../lib/gateway-ws.js';
import { loadManifestFromEnv, validateManifest } from '../lib/manifest-loader.js';

export const options = {
  scenarios: {
    r_rc_1_reject: {
      executor: 'shared-iterations',
      vus: 1,
      iterations: 1,
      maxDuration: '60s',
    },
  },
  thresholds: {
    proof_failures: ['count==0'],
    r_rc_1_duration: ['p(95)<45000'],
  },
};

const failures = new Counter('proof_failures');
const duration = new Trend('r_rc_1_duration');

// --- Manifest-driven config ---
const manifest = loadManifestFromEnv();
const DEFAULTS = {
  sessionKey: 'main',
  seat: 'elliott',
  reasonTemplate: 'Proof nonce {{nonce}}: R-RC-1 below-threshold reject probe. Expect REJECT (compaction must NOT fire on a low-context session).',
  idempotencyKeyPrefix: 'R-RC-1',
  rejectReasonSubstrings: ['context', 'threshold', '70', 'usage'],
};

// Resolve invocation config from manifest -> defaults
function invocationCfg() {
  const inv = (manifest && manifest.invocation) || {};
  return {
    tool: inv.tool || 'request_compaction',
    reasonTemplate: inv.reasonTemplate || DEFAULTS.reasonTemplate,
    idempotencyKeyPrefix: inv.idempotencyKeyPrefix || DEFAULTS.idempotencyKeyPrefix,
    rejectReasonSubstrings: inv.rejectReasonSubstrings || DEFAULTS.rejectReasonSubstrings,
  };
}

// Does a rejection reason cite the threshold guard?
function reasonCitesThreshold(reasonStr, substrings) {
  if (!reasonStr) return false;
  const low = String(reasonStr).toLowerCase();
  for (let i = 0; i < substrings.length; i++) {
    if (low.indexOf(String(substrings[i]).toLowerCase()) !== -1) return true;
  }
  return false;
}

export default function () {
  const url = __ENV.OPENCLAW_GATEWAY_WS || 'ws://127.0.0.1:18789';
  const token = __ENV.OPENCLAW_GATEWAY_TOKEN;
  const sessionKey = (manifest && manifest.sessionKey) || __ENV.OPENCLAW_SESSION_KEY || DEFAULTS.sessionKey;
  const seat = (manifest && manifest.seat) || __ENV.OPENCLAW_SEAT_NAME || DEFAULTS.seat;
  const rowNonce = nonce('R-RC-1');
  const inv = invocationCfg();

  if (!token) {
    console.error('OPENCLAW_GATEWAY_TOKEN is required');
    failures.add(1);
    return;
  }

  if (manifest) {
    const errors = validateManifest(manifest);
    if (errors.length > 0) {
      console.warn(`Manifest validation warnings: ${errors.join('; ')}`);
    }
  }

  const evidence = {
    row: 'R-RC-1',
    manifest_loaded: !!manifest,
    nonce: rowNonce,
    seat,
    sessionKey,
    candidateSha: (manifest && manifest.candidateSha) || __ENV.OPENCLAW_CANDIDATE_SHA || 'unset',
    started: new Date().toISOString(),
    // PASS conditions for the REJECT proof:
    tool_responded: false,      // gateway returned a response to the invocation
    tool_rejected: false,       // the response was a rejection (ok:false / structured reject)
    reject_reason: null,        // the rejection reason string
    reason_cites_threshold: false, // the reason cites the context-usage guard
    compaction_fired: false,    // SHOULD STAY FALSE — any compaction/summarization event = guard FAILED
    trace_id: null,
    redacted_events: [],
  };

  const started = Date.now();

  const res = ws.connect(url, {}, (socket) => {
    const tracker = new RequestTracker();

    socket.on('open', () => {
      socket.send(connectFrame(token));

      socket.setTimeout(() => {
        tracker.send(socket, 'sessions.messages.subscribe', { sessionKey });
      }, 500);

      // Fire request_compaction on the (expected low-context) session.
      // Expected outcome: REJECT — compaction must NOT fire below threshold.
      socket.setTimeout(() => {
        const reason = inv.reasonTemplate.replace('{{nonce}}', rowNonce);
        tracker.send(socket, 'tools.invoke', {
          name: inv.tool,
          sessionKey,
          args: { reason },
          idempotencyKey: `${inv.idempotencyKeyPrefix}-${rowNonce}`,
        });
      }, 1000);

      // Give the gateway time to (not) fire compaction; close after the watch window.
      socket.setTimeout(() => socket.close(), 30000);
    });

    socket.on('message', (raw) => {
      try {
        const msg = JSON.parse(raw);
        const classified = tracker.classify(msg);

        evidence.redacted_events.push({
          ts: Date.now(),
          kind: classified.kind,
          method: classified.method || null,
          event: classified.event || null,
          ok: classified.ok !== undefined ? classified.ok : null,
          data: classified.payload ? redactEvent(classified.payload) : null,
        });

        // The invocation response — the REJECT is the PASS condition here.
        if (classified.kind === 'response' && classified.method === 'tools.invoke') {
          evidence.tool_responded = true;
          const payload = classified.payload || {};
          // A rejection can surface as a transport error OR a structured { ok:false, reason }
          const structuredReject = payload && payload.ok === false;
          if (classified.error || structuredReject) {
            evidence.tool_rejected = true;
            const reason =
              (classified.error && (classified.error.message || classified.error.reason)) ||
              payload.reason ||
              (payload.result && payload.result.reason) ||
              JSON.stringify(classified.error || payload);
            evidence.reject_reason = reason;
            evidence.reason_cites_threshold = reasonCitesThreshold(reason, inv.rejectReasonSubstrings);
            if (payload.traceId) evidence.trace_id = payload.traceId;
            console.log(`✓ request_compaction REJECTED (guard held): ${reason}`);
          } else if (classified.ok) {
            // ACCEPTED below threshold = the guard FAILED — this is a proof failure.
            console.error('✗ request_compaction ACCEPTED on a below-threshold session — guard did NOT hold');
            if (payload.traceId) evidence.trace_id = payload.traceId;
            failures.add(1);
          }
        }

        // Watch for any compaction-fired / summarization-started signal — must NOT appear.
        if (classified.kind === 'event') {
          const eventStr = JSON.stringify(classified.data || classified.event || {}).toLowerCase();
          if (
            eventStr.indexOf('compact') !== -1 ||
            eventStr.indexOf('summariz') !== -1
          ) {
            evidence.compaction_fired = true;
            console.error('✗ compaction/summarization event observed — the REJECT guard did NOT hold');
            failures.add(1);
          }
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

  evidence.ended = new Date().toISOString();
  evidence.duration_ms = Date.now() - started;
  duration.add(evidence.duration_ms);

  check(res, { 'websocket connected': (r) => r && r.status === 101 });
  check(null, {
    'request_compaction got a response': () => evidence.tool_responded,
    'request_compaction REJECTED below threshold': () => evidence.tool_rejected,
    'reject reason cites the context-usage guard': () => evidence.reason_cites_threshold,
    'no compaction fired (guard held, nothing mutated)': () => !evidence.compaction_fired,
  });

  // PASS = rejected + reason cites threshold + nothing fired.
  if (!evidence.tool_rejected || evidence.compaction_fired) {
    failures.add(1);
    console.error('FAIL: R-RC-1 threshold-reject guard not proven (need REJECT + no compaction)');
  }

  console.log(`\n--- R-RC-1 EVIDENCE SUMMARY ---`);
  console.log(JSON.stringify(evidence, null, 2));
  console.log(`--- END EVIDENCE ---\n`);
}
