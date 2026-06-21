// 05-r-cd-chained-depth-2.js — R-CD-CHAINED-DEPTH-2: collection-on-collapse.
//
// THE LOAD-BEARING ROW (🌊 Ronan, R-CD owner). Distinct from the wake-cased
// R-CD-CHAINED-DEPTH-2 TEST rows: this proves **collection-on-collapse** —
// a delegate's OWN return follows up-tree on COLLAPSE to root EVEN WHEN the
// child-return did NOT trigger a parent-turn (the aggregation-without-wake case
// the wake-cased rows don't cover).
//
// THE A→B→C CHAIN (🌫-authored test-shape, the assertion to build against):
//   root(A) ── spawns ──▶ B(intermediate) ── spawns ──▶ C(leaf)
//   B COLLAPSES BEFORE C's return propagates.
//   ASSERT (step 3): root(A) COLLECTS C's sentinel ACROSS the dead intermediate B.
//   NEGATIVE-GUARD (step 4): no-orphan — C's return is NOT lost when no wake fires.
//   The bug hides if chain-ancestry reads the LIVE intermediate, not persisted state.
//
// MODE-CONDITIONAL (🌊 byte-walk + 🪨 refinement, issue karmaterminal/openclaw#1061):
//   • DEFAULT (no fanoutMode) → parentRunId routes to the IMMEDIATE PARENT ONLY
//     (one-level-up; ORPHANS if an intermediate collapses without explicit-carry).
//   • fanoutMode="tree" → routes to ALL ancestor keys → reaches root automatically.
//   Cost-roll-up (subagent-chain-hop token climb) is separate + always-on.
//   So this row asserts BOTH modes: default=one-level (orphan-on-collapse unless
//   carried) · tree=reaches-root. The #7-invariant (which is DEFAULT) is figs's
//   call (issue #1061's 3 shapes) — this row produces the parentRunId-stitched
//   trace under EACH mode for that decision.
//
// HARNESS CONSTRAINT (🌊 v1 learning): intermediates MUST be **mode=session**
//   (detached), NOT mode=run — a mode=run wired-subagent hits perpetual
//   `requests-in-flight` (the three-clears: model + wiring + genuine-idle).
//
// SPAN RECEIPTS (🩸 Cael VERIFIED-GATEWAY-SURFACE.md @ 90358ec — SOURCE-emission
//   names; live-trace-confirm belongs at the first SAFE_TO_FIRE run, NOT asserted
//   live-verified until then): the R-CD chain emits
//   `continuation.delegate.dispatch` + `.delegate.fire` + `.queue.drain`, attribute
//   `span.attributes.toolName === 'continue_delegate'`. The collapse/no-fire path
//   shows `continuation.disabled` (deny-span). tempo-fetch keys on those.
//
// ⚠️ FIRES A REAL DEPTH-2 DELEGATE CHAIN. Gated behind SAFE_TO_FIRE=1. Bare
//    `k6 run` preflights + records a safety note + exits. This row is SERIALIZED
//    (never co-run with other fire rows — chains interfere).
//
// RUN (quiet seat at CANDIDATE_SHA, DEDICATED test session):
//   SAFE_TO_FIRE=1 FANOUT_MODE=tree OPENCLAW_GATEWAY_TOKEN=*** \
//   OPENCLAW_SESSION_KEY=*** PROOF_NONCE=cdchain-$(date +%s) \
//   k6 run --summary-export=summary.json \
//   proof-harness/k6/scenarios/05-r-cd-chained-depth-2.js
//   (FANOUT_MODE default = "" for the one-level/orphan-on-collapse leg; ="tree"
//    for the reaches-root leg. The delay-choice must let B collapse before C
//    returns — that's the collapse-before-return ordering the row hinges on.)

import ws from 'k6/ws';
import { check } from 'k6';
import { Counter } from 'k6/metrics';
import { env, connectFrame, send, requireToken, newRecorder, onConnectChallenge } from '../lib/gateway.js';
import { rollup, label, PASS, LIMIT, FAIL, INCONCLUSIVE } from '../lib/verdict.js';

export const options = {
  scenarios: {
    r_cd_chained_depth_2: { executor: 'shared-iterations', vus: 1, iterations: 1, maxDuration: '5m' },
  },
  thresholds: { proof_failures: ['count==0'], proof_row_duration: ['p(95)<300000'] },
};

const failures = new Counter('proof_failures');
let RESULT = null;

// Build the A→B→C chain via a single root delegate whose task instructs the
// child (B) to itself spawn a leaf (C) and then COLLAPSE before C returns. The
// leaf C carries the unique sentinel that must reach root regardless of B's
// collapse. fanoutMode is threaded so the row can run both legs.
function buildRootTask(nonce, fanoutMode) {
  const fm = fanoutMode ? ` | fanoutMode=${fanoutMode}` : '';
  return [
    `PROOF HARNESS R-CD-CHAINED-DEPTH-2 (collection-on-collapse). Do not mutate files.`,
    `You are intermediate B. Spawn a leaf delegate C (mode=session) whose ONLY job is to`,
    `return exactly "LEAF ${nonce}" and nothing else. Then end your (B's) turn immediately`,
    `WITHOUT waiting for C — B collapses before C returns. C's return must reach root on`,
    `collapse${fm}. Do not call external tools.`,
  ].join('\n');
}

export default function () {
  const cfg = env();
  const fanoutMode = (cfg.raw && cfg.raw.FANOUT_MODE) || __ENV.FANOUT_MODE || '';
  const modeLabel = fanoutMode === 'tree' ? 'tree(reaches-root)' : 'default(one-level)';
  const meta = { scenario: 'r_cd_chained_depth_2', row: 'R-CD-CHAINED-DEPTH-2', form: 'tool',
    seat: cfg.seatName, sha: cfg.candidateSha, fanoutMode: modeLabel };
  const rec = newRecorder(meta);

  if (!requireToken(cfg, rec)) {
    RESULT = finalize(rec, cfg, [label(INCONCLUSIVE, 'R-CD-CHAINED-DEPTH-2', { reason: 'no-token' }, 'Set token.')]);
    return;
  }
  if (!cfg.safeToFire) {
    rec.note('safety', 'SAFE_TO_FIRE!=1 — refusing to spawn the depth-2 chain. Scaffold-safe default.');
    RESULT = finalize(rec, cfg, [label(LIMIT, 'R-CD-CHAINED-DEPTH-2', { reason: 'safety-gate-closed' },
      'Harness safety gate prevented the chain fire (by design). Not a SUT verdict.')]);
    return;
  }

  const nonce = cfg.nonce;
  const leafNeedle = `LEAF ${nonce}`;
  const obs = {
    rootDispatched: false,    // root's delegate (B) dispatched
    intermediateSpawned: false, // B observed (task-ledger / child)
    leafSpawned: false,       // C observed (B's child)
    intermediateCollapsed: false, // B ended before C returned
    rootCollectedLeaf: false, // THE assertion: root sees "LEAF <nonce>" on collapse
    orphaned: false,          // NEGATIVE: leaf seen-spawned but never reached root
    traceId: null,
    spanFires: 0,             // continuation.delegate.dispatch/.fire/.queue.drain count
  };
  let rootFireId = null;
  let leafSeenAtMs = null;

  const res = ws.connect(cfg.wsUrl, {}, (socket) => {
    // CHALLENGE-FIRST handshake (Cael FIX #1) — identical pattern to 03/04.
    const onChallenge = onConnectChallenge(
      { token: cfg.token, scopes: ['operator.read', 'operator.write'] },
      () => {
        rec.note('connect', 'connect.challenge received → sent operator connect');
        socket.setTimeout(() => { send(socket, rec, 'sessions.messages.subscribe', { sessionKey: cfg.sessionKey }); }, 500);
        socket.setTimeout(() => { send(socket, rec, 'tasks.list', {}); }, 800);

        socket.setTimeout(() => {
          const idem = `R-CD-CHAINED-DEPTH-2/${cfg.candidateSha}/${cfg.seatName}/${nonce}/${modeLabel}`;
          const args = {
            task: buildRootTask(nonce, fanoutMode),
            mode: 'normal',
            delaySeconds: 1,
          };
          if (fanoutMode) args.fanoutMode = fanoutMode;
          rootFireId = send(socket, rec, 'tools.invoke', {
            name: 'continue_delegate', sessionKey: cfg.sessionKey, args, idempotencyKey: idem,
          }, 'fire');
          rec.note('fire', `dispatched root delegate (B) for depth-2 chain, mode=${modeLabel}, idem=${idem}`);
        }, 1200);

        // Poll the ledger through the chain lifetime to catch B + C + the collapse.
        [6000, 18000, 40000, 80000, 140000].forEach((t) => {
          socket.setTimeout(() => { send(socket, rec, 'tasks.list', {}); }, t);
        });
        socket.setTimeout(() => socket.close(), 280000);
      },
    );

    socket.on('open', () => { rec.note('open', 'ws open — awaiting connect.challenge'); });

    socket.on('message', (raw) => {
      const msg = rec.record(raw);
      if (onChallenge(socket, msg)) return;
      if (!msg) return;
      if (msg.type === 'res' && msg.ok === false) failures.add(1);

      // root dispatch accepted
      if (msg.type === 'res' && rootFireId && msg.id === rootFireId) {
        obs.rootDispatched = msg.ok === true || (msg.result !== undefined && !msg.error);
        const tid = deepFindTraceId(msg);
        if (tid) { obs.traceId = tid; rec.setFact('receipts.traceId', tid); }
      }

      const blob = JSON.stringify(msg);
      const evt = (msg.type === 'event' && msg.event) ? String(msg.event) : '';

      // R-CD continuation span fires (Cael's verified names) — count as receipts.
      if (/continuation\.delegate\.(dispatch|fire)|continuation\.queue\.drain/i.test(blob)) {
        obs.spanFires += 1;
      }

      // intermediate (B) spawn: a task/child event after root dispatch
      if (obs.rootDispatched && /(child.*session|spawn|subagent|task.*(create|start)|delegate)/i.test(blob)) {
        if (!obs.intermediateSpawned) { obs.intermediateSpawned = true; rec.note('chain', 'intermediate B spawned'); }
        // leaf (C): a second-level spawn (B's own child) — heuristic: a spawn event
        // mentioning the leaf task / a deeper chain step. Confirmed structurally by
        // the parentRunId-stitched trace at review time.
        else if (!obs.leafSpawned && /(child|subagent|spawn|delegate)/i.test(blob)) {
          obs.leafSpawned = true; leafSeenAtMs = Date.now();
          rec.note('chain', 'leaf C spawned (B\'s child)');
        }
      }

      // intermediate collapse: B's run-end / task-complete BEFORE the leaf returns.
      if (obs.intermediateSpawned && /(run.*end|task.*(complete|done|end)|session.*(closed|ended))/i.test(blob)
          && !obs.rootCollectedLeaf) {
        obs.intermediateCollapsed = true;
      }

      // THE ASSERTION: root collects the leaf sentinel "LEAF <nonce>" — surfaces as
      // a session.message on the ROOT session (Cael-verified wake event), or in the
      // root transcript/return. This must hold ACROSS B's collapse.
      const onRoot = (msg.params && msg.params.sessionKey === cfg.sessionKey) || blob.includes(cfg.sessionKey);
      const isRootMessage = (/session\.message/i.test(evt)) && onRoot;
      if ((isRootMessage || onRoot) && blob.includes(leafNeedle)) {
        obs.rootCollectedLeaf = true;
        rec.note('collect', `root collected leaf sentinel "${leafNeedle}" across intermediate collapse → collection-on-collapse`);
        rec.setFact('receipts.rootCollectedLeaf', true);
      }

      const tid = deepFindTraceId(msg);
      if (tid && !obs.traceId) { obs.traceId = tid; rec.setFact('receipts.traceId', tid); }
    });

    socket.on('error', (e) => { rec.note('error', `ws error: ${e && e.error ? e.error() : e}`); failures.add(1); });
  });

  // NEGATIVE-GUARD: leaf spawned but never collected at root within the window = orphan.
  if (obs.leafSpawned && !obs.rootCollectedLeaf) obs.orphaned = true;

  check(res, { 'R-CD-CHAINED-DEPTH-2: websocket upgraded (101)': (r) => r && r.status === 101 });
  rec.setFact('chain', {
    rootDispatched: obs.rootDispatched, intermediateSpawned: obs.intermediateSpawned,
    leafSpawned: obs.leafSpawned, intermediateCollapsed: obs.intermediateCollapsed,
    rootCollectedLeaf: obs.rootCollectedLeaf, orphaned: obs.orphaned,
    fanoutMode: modeLabel, spanFires: obs.spanFires,
  });
  rec.note('observe', `mode=${modeLabel} root=${obs.rootDispatched} B=${obs.intermediateSpawned} C=${obs.leafSpawned} collapse=${obs.intermediateCollapsed} collected=${obs.rootCollectedLeaf} orphan=${obs.orphaned}`);

  RESULT = finalize(rec, cfg, [classifyChainedDepth2(obs, modeLabel)]);
}

// Verdict — mode-aware. The collection-on-collapse semantics differ by fanoutMode:
//   tree    → root MUST collect the leaf across B's collapse (reaches-root). Not
//             collecting = FAIL-candidate (the bug).
//   default → one-level-up: collecting at root requires explicit-carry; an orphan
//             on intermediate-collapse is the DOCUMENTED default shape, NOT a bug
//             (it's the #1061/#7-invariant decision) → HONEST-LIMIT (records which
//             mode produced which reach), human + figs decide the invariant.
function classifyChainedDepth2(o, modeLabel) {
  const ev = { ...o };
  const A = 'CONTINUATION-BEHAVIOR-SPEC §collection-on-collapse + issue #1061';
  if (!o.rootDispatched) {
    return label(INCONCLUSIVE, A, ev, 'Root delegate never dispatched — confirm tools.invoke landed + token/session.');
  }
  if (!o.leafSpawned) {
    return label(LIMIT, A, ev, 'Chain did not reach a leaf (B may not have spawned C, or model non-compliance ' +
      'with the spawn-C-then-collapse instruction). Widen window / confirm B emitted the leaf spawn. Not a ' +
      'collection-on-collapse verdict yet.');
  }
  if (modeLabel.startsWith('tree')) {
    if (o.rootCollectedLeaf) {
      return label(PASS, A, ev, 'fanoutMode=tree: root COLLECTED the leaf sentinel ACROSS the intermediate ' +
        'collapse → collection-on-collapse holds (reaches-root). Confirm the parentRunId-stitched trace shows ' +
        'C→root across dead B + the cost-roll-up climbed, then ✅.');
    }
    return label(FAIL, A, ev, 'fanoutMode=tree: leaf spawned + (likely) B collapsed, but root did NOT collect ' +
      'the leaf sentinel → the return was ORPHANED under tree-mode, where it MUST reach root. This is the ' +
      'collection-on-collapse BUG (return-only-on-wake / ancestry-reads-live-intermediate). Confirm B collapsed ' +
      'before C returned (the ordering the row hinges on) — if so, FAIL.');
  }
  // default mode
  if (o.rootCollectedLeaf) {
    return label(PASS, A, ev, 'default mode: root collected the leaf (explicit-carry or single-level sufficed). ' +
      'Records that default reached root for this chain shape — note whether explicit-carry was present.');
  }
  return label(LIMIT, A, ev, 'default mode (no fanoutMode): leaf spawned, B collapsed, root did NOT collect → ' +
    'one-level-up ORPHAN on intermediate-collapse. This is the DOCUMENTED default shape (#1061/#7-invariant), ' +
    'NOT a bug — the invariant choice (explicit-carry-default vs tree-default vs invariant-only-under-tree) is ' +
    'figs\'s call. HONEST-LIMIT: records default=orphan-on-collapse for the decision. Re-run with FANOUT_MODE=tree ' +
    'for the reaches-root leg.');
}

function deepFindTraceId(obj, depth = 0) {
  if (!obj || depth > 6) return null;
  if (typeof obj === 'object') {
    for (const k of Object.keys(obj)) {
      if (/^trace(id|parent)?$/i.test(k) && typeof obj[k] === 'string') return obj[k];
      const r = deepFindTraceId(obj[k], depth + 1);
      if (r) return r;
    }
  }
  return null;
}

function finalize(rec, cfg, steps) {
  const roll = rollup(steps);
  rec.note('verdict', `R-CD-CHAINED-DEPTH-2 candidate=${roll.rowVerdict} (HUMAN REVIEW REQUIRED)`);
  return {
    meta: rec.snapshot().meta, rowCandidate: roll, facts: rec.facts, notes: rec.notes,
    config: { wsUrl: cfg.wsUrl, sessionKey: cfg.sessionKey, candidateSha: cfg.candidateSha, seat: cfg.seatName, nonce: cfg.nonce },
    frameCount: rec.frames.length,
  };
}

export function handleSummary(data) {
  const out = {
    harness: 'k6-proof-harness', scenario: 'r_cd_chained_depth_2', row: 'R-CD-CHAINED-DEPTH-2', form: 'tool',
    generatedAt: new Date().toISOString(), result: RESULT, HUMAN_VERDICT_REQUIRED: true,
    note: 'collection-on-collapse (A→B→C, B collapses before C returns; root must collect C across dead B). ' +
          'MODE-CONDITIONAL: default=one-level (orphan-on-collapse = documented #1061 shape, HONEST-LIMIT); ' +
          'fanoutMode=tree=reaches-root (orphan = FAIL). Run BOTH legs (FANOUT_MODE="" and ="tree"). ' +
          'Intermediates mode=session. Spans: continuation.delegate.dispatch/.fire/.queue.drain (live-confirm at first fire).',
  };
  return { 'summary.json': JSON.stringify(out, null, 2), stdout: renderText(out) };
}

function renderText(out) {
  const rv = out.result && out.result.rowCandidate ? out.result.rowCandidate.rowVerdict : 'UNKNOWN';
  const fm = out.result && out.result.meta ? out.result.meta.fanoutMode : '?';
  return [
    '──────────────────────────────────────────────',
    ' k6 proof-harness :: R-CD-CHAINED-DEPTH-2 (collection-on-collapse)',
    `   row candidate : ${rv}   (HUMAN VERDICT REQUIRED)`,
    `   fanoutMode    : ${fm}   (run BOTH: default + tree)`,
    '   assert        : root collects leaf sentinel ACROSS intermediate collapse',
    '   default=one-level (orphan=documented #1061) · tree=reaches-root (orphan=FAIL)',
    '──────────────────────────────────────────────',
  ].join('\n') + '\n';
}
