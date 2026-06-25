/**
 * Scenario: R-RC-1 — request_compaction() threshold-REJECT guard.
 *
 * Proves the SAFETY guard: request_compaction must be REJECTED on a
 * below-threshold (low-context) session — compaction must NOT fire. This is the
 * non-mutating proof that gates the irreversible accept path (R-RC-2).
 *
 * DISPATCH PATH (#134): continuation tools (continue_work / continue_delegate /
 * request_compaction) are AGENT-SIDE — they execute inside an agent turn and need
 * the runner-supplied opts/closures to fire. A bare `tools.invoke` RPC accepts at
 * the transport layer WITHOUT creating an agent execution context, so the real
 * tool logic never runs. The E2E path is `sessions.send` → agent turn → the agent
 * calls the tool. (Same fix as Ronan's R-CD-2 PASS: commit 7e727c5 "use
 * sessions.send to trigger agent turn (not tools.invoke)" + 3c0802e "use 'key'
 * not 'sessionKey' for sessions.messages.subscribe".)
 *
 * Manifest-driven: reads row config from OPENCLAW_ROW_MANIFEST env var
 * or falls back to inline defaults for shape-testing.
 *
 * SAFETY (see tools/k6-proofs/SAFETY-MANIFEST.md, #104):
 *   - R-RC-1 is **serialized**: it triggers an agent turn that reads/asserts live
 *     context %, so it must not run in parallel with continuation/delegate rows on
 *     the same session.
 *   - It is **non-mutating** on the REJECT path: compaction must NOT fire, so the
 *     pre-compaction working set is preserved. This is why R-RC-1 runs BEFORE R-RC-2.
 *   - Run on a genuinely low-context session (a fresh/idle main session) so the
 *     threshold guard is actually exercised.
 *
 * PASS = agent turn triggered + NO compaction fires (guard held). The rejection
 * reason citing the context-usage threshold is captured when it surfaces in the
 * turn output, but the load-bearing safety assertion is "compaction did not fire."
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
      maxDuration: '90s',
    },
  },
  thresholds: {
    proof_failures: ['count==0'],
    r_rc_1_duration: ['p(95)<75000'],
  },
};

const failures = new Counter('proof_failures');
const duration = new Trend('r_rc_1_duration');

// --- Manifest-driven config ---
const manifest = loadManifestFromEnv();
const DEFAULTS = {
  sessionKey: 'main',
  seat: 'elliott',
  reasonTemplate: 'R-RC-1 proof nonce {{nonce}}: below-threshold reject probe.',
  idempotencyKeyPrefix: 'R-RC-1',
  rejectReasonSubstrings: ['context', 'threshold', '70', 'usage', '%'],
};

function invocationCfg() {
  const inv = (manifest && manifest.invocation) || {};
  return {
    tool: inv.tool || 'request_compaction',
    reasonTemplate: inv.reasonTemplate || DEFAULTS.reasonTemplate,
    idempotencyKeyPrefix: inv.idempotencyKeyPrefix || DEFAULTS.idempotencyKeyPrefix,
    rejectReasonSubstrings: inv.rejectReasonSubstrings || DEFAULTS.rejectReasonSubstrings,
  };
}

function reasonCitesThreshold(text, substrings) {
  if (!text) return false;
  const low = String(text).toLowerCase();
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
    // PASS conditions for the REJECT proof (via the agent-turn dispatch path):
    turn_triggered: false,        // sessions.send accepted -> an agent turn fired
    compaction_fired: false,      // MUST STAY FALSE — any compaction/summarization event = guard FAILED
    reject_observed: false,       // a structured rejection / threshold-decline surfaced in the turn
    reject_reason: null,          // the rejection reason text (when it surfaces)
    reason_cites_threshold: false,// the reason cites the context-usage guard
    trace_id: null,
    redacted_events: [],
  };

  const started = Date.now();

  const res = ws.connect(url, {}, (socket) => {
    const tracker = new RequestTracker();

    socket.on('open', () => {
      socket.send(connectFrame(token));

      // Protocol: sessions.messages.subscribe uses 'key' (not 'sessionKey').
      socket.setTimeout(() => {
        tracker.send(socket, 'sessions.messages.subscribe', { key: sessionKey });
      }, 500);

      // Dispatch via sessions.send (NOT tools.invoke): trigger an agent turn that
      // calls request_compaction on the (expected low-context) session. The guard
      // must REJECT it below threshold — compaction must NOT fire.
      socket.setTimeout(() => {
        const reason = inv.reasonTemplate.replace('{{nonce}}', rowNonce);
        const agentInstruction =
          `[k6-proof-harness] Call request_compaction with reason="${reason}". ` +
          `This is a proof run on a deliberately low-context session — invoke the tool exactly once, ` +
          `then in your reply state verbatim whether it was ACCEPTED or REJECTED and the reason. ` +
          `Do not take any other action and do not mutate files.`;
        tracker.send(socket, 'sessions.send', {
          key: sessionKey,
          message: agentInstruction,
          idempotencyKey: `${inv.idempotencyKeyPrefix}-${rowNonce}`,
        });
      }, 1000);

      // Watch window: give the turn time to fire + (not) compact, then close.
      socket.setTimeout(() => socket.close(), 60000);
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

        // sessions.send accepted => an agent turn was triggered (the dispatch path).
        if (classified.kind === 'response' && classified.method === 'sessions.send') {
          if (classified.ok) {
            evidence.turn_triggered = true;
            if (classified.payload && classified.payload.traceId) evidence.trace_id = classified.payload.traceId;
            console.log('✓ sessions.send accepted — agent turn triggered for R-RC-1');
          } else if (classified.error) {
            console.error(`✗ sessions.send rejected: ${JSON.stringify(classified.error)}`);
            failures.add(1);
          }
        }

        // Scan session-message events (the agent turn output) for the rejection signal
        // AND for any compaction/summarization that must NOT occur.
        if (classified.kind === 'event' || classified.kind === 'response') {
          const blob = JSON.stringify(classified.data || classified.payload || classified.event || {}).toLowerCase();

          // Guard FAILED if compaction actually fires on the below-threshold session.
          if (blob.indexOf('compact') !== -1 || blob.indexOf('summariz') !== -1) {
            // Distinguish the REJECTION mention from an actual compaction firing:
            // a structured reject mentions the threshold; an actual fire shows a
            // compaction-started/summarization-started lifecycle signal.
            const looksLikeFire =
              blob.indexOf('summarization failed') !== -1 ||
              blob.indexOf('compaction-started') !== -1 ||
              blob.indexOf('"summarizing"') !== -1 ||
              blob.indexOf('compaction_started') !== -1 ||
              blob.indexOf('compacted') !== -1;
            if (looksLikeFire) {
              evidence.compaction_fired = true;
              console.error('✗ compaction/summarization FIRED — the REJECT guard did NOT hold');
              failures.add(1);
            }
          }

          // Detect the rejection / threshold-decline surfacing in the turn output.
          if (
            (blob.indexOf('reject') !== -1 || blob.indexOf('declin') !== -1 || blob.indexOf('not') !== -1) &&
            reasonCitesThreshold(blob, inv.rejectReasonSubstrings)
          ) {
            if (!evidence.reject_observed) {
              evidence.reject_observed = true;
              evidence.reject_reason = blob.slice(0, 280);
              evidence.reason_cites_threshold = true;
              console.log('✓ request_compaction REJECT/threshold-decline observed in turn output');
            }
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
    'agent turn triggered via sessions.send': () => evidence.turn_triggered,
    'no compaction fired (guard held, nothing mutated)': () => !evidence.compaction_fired,
    'reject/threshold-decline observed in turn (soft)': () => evidence.reject_observed,
  });

  // PASS (load-bearing) = turn fired + compaction did NOT fire. reject_observed is a
  // soft corroborator (the rejection text isn't always emitted on the WS stream).
  if (!evidence.turn_triggered || evidence.compaction_fired) {
    failures.add(1);
    console.error('FAIL: R-RC-1 threshold-reject guard not proven (need agent turn + NO compaction fired)');
  }

  console.log(`\n--- R-RC-1 EVIDENCE SUMMARY ---`);
  console.log(JSON.stringify(evidence, null, 2));
  console.log(`--- END EVIDENCE ---\n`);
}
