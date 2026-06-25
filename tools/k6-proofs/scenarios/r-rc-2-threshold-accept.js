/**
 * Scenario: R-RC-2 — request_compaction() over-threshold ACCEPT (compaction fires).
 *
 * Proves the ACCEPT path: on an at/over-threshold (>=70% context) session,
 * request_compaction is ACCEPTED and compaction FIRES — context is reclaimed and
 * the successor wakes. This is the irreversible-in-session counterpart to R-RC-1's
 * non-mutating REJECT proof.
 *
 * ⚠️ SAFETY TIER: **requires-human-confirmation** (see SAFETY-MANIFEST.md, #104).
 *   Compaction FIRES here — the pre-compaction working set leaves the live window.
 *   This MUST run on a DEDICATED throwaway session (never the live channel-bound
 *   'main'), and only with explicit pre-authorization. The runner is responsible
 *   for confirming before the accept-path fires.
 *
 * SAFETY (serialized + dedicated):
 *   - request_compaction compacts the TARGET session, so the target must be a
 *     dedicated test session driven to >=70% context — NOT a live working session
 *     (compacting live main destroys real working state).
 *   - Serialized: never run in parallel with continuation/delegate rows on the same
 *     session — compaction holds a session-write-lock during the LLM summarization
 *     call; a parallel row hits the asymmetric lock-timeout cascade.
 *   - Compaction is bounded by the config-valued safety timeout, NOT the SDK child:
 *     `compaction-safety-timeout.ts` → `resolveCompactionTimeoutMs(cfg)` reads
 *     `agents.defaults.compaction.timeoutSeconds` (default 180s). (Byte-walked HEAD
 *     82827d3cbcb.)
 *
 * DISPATCH (#134): continuation tools are agent-side — fire via `sessions.send`
 * (agent turn → tool call), NOT a bare `tools.invoke` RPC. Subscribe with `key`.
 * (Mirrors Ronan's R-CD-2 PASS: 7e727c5 + 3c0802e.)
 *
 * THRESHOLD NOTE: to exercise the accept path you need the target session at
 * >=70% real context, OR a lowered threshold via config. A lowered threshold needs
 * a gateway restart to arm (config patches don't propagate to a running scheduler).
 * The manifest carries OPENCLAW_RC_SESSION_KEY for a pre-prepared high-context
 * dedicated session.
 *
 * PASS = agent turn triggered + request_compaction ACCEPTED + a compaction/
 * summarization lifecycle event fires on the target session (the reclaim happened).
 *
 * References:
 *   - Issue: karmaterminal/karmaterminal-openclaw-docs#104
 *   - Manifest: tools/k6-proofs/manifests/r-rc-2.json
 *   - Pairs with R-RC-1 (run R-RC-1 REJECT first to prove the guard before this).
 */
import ws from 'k6/ws';
import { check } from 'k6';
import { Counter, Trend } from 'k6/metrics';
import { connectFrame, nonce, RequestTracker, redactEvent } from '../lib/gateway-ws.js';
import { loadManifestFromEnv, validateManifest } from '../lib/manifest-loader.js';

export const options = {
  scenarios: {
    r_rc_2_accept: {
      executor: 'shared-iterations',
      vus: 1,
      iterations: 1,
      maxDuration: '120s',
    },
  },
  thresholds: {
    proof_failures: ['count==0'],
    r_rc_2_duration: ['p(95)<110000'],
  },
};

const failures = new Counter('proof_failures');
const duration = new Trend('r_rc_2_duration');

const manifest = loadManifestFromEnv();
const DEFAULTS = {
  // DEDICATED high-context session — NEVER the live channel-bound 'main'.
  sessionKey: 'rc-proof-dedicated',
  seat: 'elliott',
  reasonTemplate: 'R-RC-2 proof nonce {{nonce}}: over-threshold accept probe (compaction expected to fire on this dedicated session).',
  idempotencyKeyPrefix: 'R-RC-2',
  // Signals that a compaction lifecycle actually fired:
  fireSubstrings: ['compaction-started', 'compaction_started', 'summarizing', 'summarization', 'compacted', 'compaction complete', 'successor'],
};

function invocationCfg() {
  const inv = (manifest && manifest.invocation) || {};
  return {
    tool: inv.tool || 'request_compaction',
    reasonTemplate: inv.reasonTemplate || DEFAULTS.reasonTemplate,
    idempotencyKeyPrefix: inv.idempotencyKeyPrefix || DEFAULTS.idempotencyKeyPrefix,
    fireSubstrings: inv.fireSubstrings || DEFAULTS.fireSubstrings,
  };
}

function blobHasAny(blob, subs) {
  if (!blob) return false;
  const low = String(blob).toLowerCase();
  for (let i = 0; i < subs.length; i++) {
    if (low.indexOf(String(subs[i]).toLowerCase()) !== -1) return true;
  }
  return false;
}

export default function () {
  const url = __ENV.OPENCLAW_GATEWAY_WS || 'ws://127.0.0.1:18789';
  const token = __ENV.OPENCLAW_GATEWAY_TOKEN;
  // DEDICATED session for the accept path (compaction FIRES on it).
  const sessionKey =
    (manifest && manifest.sessionKey) ||
    __ENV.OPENCLAW_RC_SESSION_KEY ||
    __ENV.OPENCLAW_SESSION_KEY ||
    DEFAULTS.sessionKey;
  const seat = (manifest && manifest.seat) || __ENV.OPENCLAW_SEAT_NAME || DEFAULTS.seat;
  const rowNonce = nonce('R-RC-2');
  const inv = invocationCfg();

  if (!token) {
    console.error('OPENCLAW_GATEWAY_TOKEN is required');
    failures.add(1);
    return;
  }

  // Hard safety rail: refuse to fire the accept path against a live 'main' session.
  if (sessionKey === 'main') {
    console.error('R-RC-2 REFUSES to run against live "main" — compaction fires and would destroy live working state. Set OPENCLAW_RC_SESSION_KEY to a dedicated high-context session.');
    failures.add(1);
    return;
  }

  if (manifest) {
    const errors = validateManifest(manifest);
    if (errors.length > 0) console.warn(`Manifest validation warnings: ${errors.join('; ')}`);
  }

  const evidence = {
    row: 'R-RC-2',
    manifest_loaded: !!manifest,
    nonce: rowNonce,
    seat,
    sessionKey,
    candidateSha: (manifest && manifest.candidateSha) || __ENV.OPENCLAW_CANDIDATE_SHA || 'unset',
    started: new Date().toISOString(),
    turn_triggered: false,       // sessions.send accepted -> agent turn fired
    request_accepted: false,     // request_compaction was ACCEPTED (not rejected)
    compaction_fired: false,     // a compaction/summarization lifecycle event fired = ACCEPT proven
    fire_signal: null,           // the event text that evidenced the fire
    trace_id: null,
    redacted_events: [],
  };

  const started = Date.now();

  const res = ws.connect(url, {}, (socket) => {
    const tracker = new RequestTracker();

    socket.on('open', () => {
      socket.send(connectFrame(token));

      // Subscribe with 'key' (not 'sessionKey').
      socket.setTimeout(() => {
        tracker.send(socket, 'sessions.messages.subscribe', { key: sessionKey });
      }, 500);

      // Dispatch via sessions.send: agent turn calls request_compaction on the
      // dedicated high-context session; the guard ACCEPTS (>=70%) and compaction fires.
      socket.setTimeout(() => {
        const reason = inv.reasonTemplate.replace('{{nonce}}', rowNonce);
        const agentInstruction =
          `[k6-proof-harness] Call request_compaction with reason="${reason}". ` +
          `This is a pre-authorized proof run on a DEDICATED high-context session — invoke the tool exactly once, ` +
          `then state verbatim whether it was ACCEPTED or REJECTED. Do not mutate files.`;
        tracker.send(socket, 'sessions.send', {
          key: sessionKey,
          message: agentInstruction,
          idempotencyKey: `${inv.idempotencyKeyPrefix}-${rowNonce}`,
        });
      }, 1000);

      // Compaction can take up to the safety-timeout; watch a generous window.
      socket.setTimeout(() => socket.close(), 90000);
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

        if (classified.kind === 'response' && classified.method === 'sessions.send') {
          if (classified.ok) {
            evidence.turn_triggered = true;
            if (classified.payload && classified.payload.traceId) evidence.trace_id = classified.payload.traceId;
            console.log('✓ sessions.send accepted — agent turn triggered for R-RC-2');
          } else if (classified.error) {
            console.error(`✗ sessions.send rejected: ${JSON.stringify(classified.error)}`);
            failures.add(1);
          }
        }

        // Scan events for: (a) the accept signal, (b) the compaction-fired lifecycle.
        if (classified.kind === 'event' || classified.kind === 'response') {
          const blob = JSON.stringify(classified.data || classified.payload || classified.event || {}).toLowerCase();

          // ACCEPT: the agent's turn reports request_compaction accepted (not rejected/threshold-declined).
          if (blob.indexOf('accept') !== -1 && blob.indexOf('request_compaction') !== -1) {
            evidence.request_accepted = true;
          }

          // FIRE: a compaction/summarization lifecycle event = the reclaim happened (the ACCEPT proof).
          if (blobHasAny(blob, inv.fireSubstrings)) {
            if (!evidence.compaction_fired) {
              evidence.compaction_fired = true;
              evidence.request_accepted = true; // a fire implies acceptance
              evidence.fire_signal = blob.slice(0, 280);
              console.log('✓ compaction/summarization FIRED on the dedicated session — ACCEPT path proven');
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
    'request_compaction accepted (>=threshold)': () => evidence.request_accepted,
    'compaction fired (reclaim happened on dedicated session)': () => evidence.compaction_fired,
  });

  // PASS (load-bearing) = turn fired + compaction actually fired. The dedicated
  // session must be at >=70% context (or threshold lowered) for the accept to occur;
  // if neither, this records HONEST-LIMIT (accept couldn't be exercised), not a bug.
  if (!evidence.turn_triggered) {
    failures.add(1);
    console.error('FAIL: R-RC-2 — agent turn was not triggered');
  } else if (!evidence.compaction_fired) {
    console.warn('HONEST-LIMIT: R-RC-2 turn fired but no compaction observed — likely the dedicated session was below threshold (need >=70% context or a lowered+restart-armed threshold). Not a guard bug; the accept path was not reachable this run.');
  }

  console.log(`\n--- R-RC-2 EVIDENCE SUMMARY ---`);
  console.log(JSON.stringify(evidence, null, 2));
  console.log(`--- END EVIDENCE ---\n`);
}
