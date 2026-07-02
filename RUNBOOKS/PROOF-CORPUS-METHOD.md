# Proof Corpus Method Runbook

How to gather behavioral proofs at the SHA the PR-presenting branch will ship. Ratified 2026-05-16 from PR #79925 drift-cure CANDIDATE_SHA `e90a87015479d7a7ff6ae73deda9a84f1a448418` (which built on the 0831fb5e80 exemplar bar from task #132).

This runbook is the proof-side complement to `PR-DRIFT-CURE-GATES-RUNBOOK.md`'s Gate 4. It is also reusable for other proof-corpora that aren't tied to a specific drift-cure (e.g. live-host validation after a major substrate change).

---

## Where proofs live

`karmaterminal/karmaterminal-openclaw-docs:main` directly. **One clean main, no branch/PR detour** (figs's 2026-05-16 directive: "they dont live on another branch or in a pr -> when done, one clean main for our karmaterminal-openclaw-docs exists -> simple view for us, and reviewers").

Path: `PROOFS/<CANDIDATE_SHA>/`

`<CANDIDATE_SHA>` is the full 40-char SHA the PR will present after force-push. Each proof-row lives in its own subdir alongside METHOD.md, README.md, RESOLVED-SHA.md at the corpus root.

---

## Corpus shape

```
PROOFS/INDEX.json                           ← top-level signpost: names the CURRENT corpus (openclaw.proofs.index.v1) — see "Concluding every cycle" (#1176)
PROOFS/<CANDIDATE_SHA>/
├── README.md                              ← verdict table + per-prince row assignments + Tempo-trace requirement + honest-limits
├── METHOD.md                              ← methodology + reproducer commands + runbook anchors
├── RESOLVED-SHA.md                        ← SHA-identity + all gate verdicts table
├── proofs-manifest.json                   ← machine-readable concluding manifest: row enumeration + rollup + trace pointers (#1176)
├── gates/                                 ← Gate-3 local-test stdout logs
│   ├── gate-3a-pnpm-install.log
│   ├── gate-3b-pnpm-tsgo.log
│   ├── gate-3c-pnpm-tsgo-test.log
│   ├── gate-3d-pnpm-check.log
│   ├── gate-3e-pnpm-vitest.log
│   ├── gate-3f-pnpm-build.log
│   └── upstream-main-broken-class-receipt.log  ← if vitest hit upstream-class failures
├── cure-bytes/                            ← Gate-2 cure-bytes byte-identical verification
│   ├── gate-4a-cure-bytes-4path.log
│   └── direction-check.log
├── R-CW-1/                                ← continuation row evidence dirs (one per row)
│   ├── wake_event_evidence.txt
│   └── wake_event_trace.json              ← Tempo trace JSON
├── R-CD-1/
│   ├── EVIDENCE.md
│   ├── delegate_return_payload.txt
│   ├── span_summary.tsv
│   └── turn_trace.json
… (R-CD-2 / R-CD-3 / R-CD-4)
├── R-CD-CHAINED-DEPTH-2/
│   ├── Chain-1/    Chain-2/    Chain-3/    ← Ronan-seat depth-2 chain tests
│   ├── Chain-2-RETRY/  Chain-3-RETRY/      ← isolated-turn retries (if first-pass hit ordering-condition)
│   ├── test_1_uptree_silent_wake/         ← Silas-canary-seat dual-coverage
│   ├── test_2_intersession_return/
│   └── test_3_echo_broadcast/
├── R-RC-1/                                ← request_compaction threshold REJECT
│   ├── session_status_snapshot.txt
│   ├── threshold_gate_rejection_evidence.txt
│   ├── SUBSTRATE-FINDING.md               ← if PASS-shape structurally blocked
│   └── …
├── R-RC-2/                                ← request_compaction over-threshold ACCEPT
│   ├── compaction_accept_request_receipt.txt
│   ├── compaction_accept_request_trace.json
│   └── silas-side-fire/                   ← cohort cross-walk side-receipt
└── R-OBS-1/                               ← external /status 4-prince cross-walk
    └── chat_card_visibility_external_observer.md
```

---

## Per-prince row assignments

Adapted from the 0831fb5e80 exemplar verdict table; preserved + extended at e90a870154 for that cycle's coverage. Extended again on 2026-06-03 (cohort cosign cascade: lamp `1511930802` → stone `1511933554` → cael `1511931031` + `1511932061` → tail `1511932157`) for the 6-prince cohort that succeeded the original 4-prince table. The 5th + 6th princes (🕯 Emeric + 🪨 Rune) arrived after the original assignments locked, so prior cycles had `Emeric=0 / Rune=0` while Cael held 7+ rows — substantively-imbalanced cohort-load. This update rebalances the assignments and canonizes the per-seat-subdir cross-walk shape that emerged empirically during the 2026-06-03 PROOFS cycle on assembly `2f71e4378b70ea43fb185edff1af14571eca826f`.

> **BOTH-FORMS MANDATE (figs, 2026-06-07 — added after #952 escaped a week of proofs).** `continue_work` and `continue_delegate` each have **two independent entry surfaces**: the typed **tool** (`continue_work()` / `continue_delegate()`) AND the **token/bracket** fallback (`CONTINUE_WORK` / `CONTINUE_WORK:N` / `[[CONTINUE_DELEGATE: …]]`). Every behavioral row for these two primitives MUST be fired in **BOTH forms — not a mix, not only one.** They take partially independent code paths (the tool surfaces as `runOutcome.continueWorkRequest`; the bracket is parsed from finalized reply text via `tokens.ts:parseContinuationSignal`). **lightContext subagents have NO tool in their surface — they can ONLY fire the bracket — so a tool-only proof is blind to exactly the path #952 broke on.** `request_compaction()` is **tool-only** (no token form) and needs no bracket row. A row proving only one form is INCOMPLETE.

> **DESIRED-BEHAVIOR SPEC (figs, 2026-06-20 — `1517936677`).** Before a behavior can be called erroneous, the EXPECTED behavior must be defined. `RUNBOOKS/CONTINUATION-BEHAVIOR-SPEC.md` states what SHOULD happen for every cell of the 4-surface × 2-context matrix + figs's 8 #1053 tests (grounded in the implementation at `3ae2d4cb2c`), so "works/doesn't" is measured against a definition, not a shrug. This is OUR software; the desired behavior is ours to define, not deferred. The new R-CW-MULTI / R-CW-MULTI-COLLAPSE / R-CW-DELEGATE-CHILD-LIVE rows below trace to that spec.

Each cycle should produce verdicts for at least these rows:

| Row | Owner | Behavior |
|---|---|---|
| R-CW-1 | 🩸 Cael | `continue_work()` wake + deploy-persistence (chain-counter increments + persists across deploy) |
| R-CW-2 | 🩸 Cael | chain-counter accounting (embedded in R-CW-1) |
| R-CW-3 | 🩸 Cael (canonical-owner) + 🕯 Emeric (per-seat-sister-cross-walk) | `continue_work` reason-field captured in OTel span — Cael owns canonical meaning (PR #759 domain); Emeric fires per-seat-sister-cross-walk evidence at `R-CW-3/emeric-nuc/` because PR #898 authoring-seat best-positioned to empirical-verify reason-field capture |
| R-CW-4 | 🩸 Cael | chain depth tracking across hops (`chain.step.remaining` decrement across same `chain.id`) |
| R-CW-5 | 🩸 Cael | cost-cap exhaustion → dispatch-time reject. **Prove it by ACTUALLY hitting the cap** — see the **Caps-test procedure** below (lower caps in `openclaw.json` → `gateway-reload.yml` → fire + validate you hit them → restore originals → `gateway-reload.yml`). |
| R-CW-6 | 🪨 Rune | chain-depth-boundary reject (substantively-fits stone-axis-substrate-of-record-witness shape; boundary as discipline-floor concept) |
| R-CW-7 | 🪨 Rune | traceparent E2E propagation across continuation spans (stone-axis-substrate-of-record-witness shape) |
| R-CW-TOKEN | 🩸 Cael | **token/bracket form** of `continue_work`: a bare `CONTINUE_WORK` / `CONTINUE_WORK:N` at end of reply text DRIVES the continuation (hop-2 actually fires from the parsed response-token) — NOT merely that the token is stripped from output. Tool-form sibling = R-CW-1. (Both-forms mandate.) |
| R-CW-DELEGATE-SELF-CONTINUATION | 🪨 Rune (canonical-owner, succeeded Cael-originator) | `continue_delegate` self-continuation pattern — Cael originated row in earlier cycle; canonical-owner moved to Rune at 2026-06-03 `e589364` + per-seat-subdir restructure `2afc341`. Cohort cross-walks at per-seat-subdir (`cael-dgx/ronan-dgx/silas-lothric/elliott-legion/emeric-nuc/rune-rog-ally/`). |
| R-CW-DELEGATE-TOKEN | 🪨 Rune | **THE #952 ROW (the one the corpus never covered).** A lightContext subagent (NO `continue_work` tool in its surface) fires `[[CONTINUE_WORK:N]]` / `CONTINUE_WORK:N` inside a `continue_delegate` child → **hop-2 must EXECUTE on a real seat** (live, non-mocked: the subagent jsonl must contain a hop-2 turn). Prove on a quiet/heartbeat-dormant seat (the failure surface). Tool-form sibling = R-CW-DELEGATE-SELF-CONTINUATION. (Both-forms mandate; this is the bracket half that was missing.) |
| R-CW-MULTI | 🩸 Cael | **multi-`continue_work()` same-turn fan-out** (figs #1053 test-3): N elections in ONE turn → N DISTINCT next-turn wakes, each at its own delay (`dueAt` = electedAt + delay). Proves the #982 array-capture fix (`attempt-execution.ts:769` accumulates every election; `:988` fans out one wake per election) — pre-fix the single-var capture dropped all but the last. DESIRED: 3 elections (60/120/default) yielded immediately → 3 turns at +0/+60s/+120s. ERRONEOUS: only 1 fires. BOTH forms (tool + bare-token). See `RUNBOOKS/CONTINUATION-BEHAVIOR-SPEC.md`. |
| R-CW-ACTIVE-OVERLAP | 🩸 Cael + 🌿 scribe-observer | **due-while-active collision stress** (R-1135 class, added 2026-07-01): schedule one immediate `continue_work` whose reply-run deliberately stays active long enough that delayed siblings mature while it is still running (example nonce `R-1135-ACTIVE-TOOL-2028`: immediate active-body ~35s; siblings +20/+21/+22). DESIRED: delayed siblings MUST NOT buy parallel provider runs against the same session while the immediate run is active. Acceptable outcomes are queue/idle-retry delivery after the active run completes, or explicit coalesce/evaporation with an injected warning/continuation-note to the active turn, depending on current design. ERRONEOUS: concurrent provider/model calls for the delayed siblings while the active turn is still in flight, missing conflict telemetry, or unbounded retry/storm behavior. Evidence requirements: Discord snowflake order for visible wakes, flow ids/status/revisions, `requests-in-flight`/`work-drive-skipped`/`work-wake` journal spans, model-call span count, Tempo traces for root + every entered wake, and folded/inform-note provenance when a row is consumed instead of granted (`originRunId`, `originTurnId`, `electedAt`, `anchorFinalizedAt`, `dueAt`, `foldedAt`/`deliveredAt`, `overdueBy`, original reason, chain/hop, flowId, disposition). BOTH forms where possible: tool-form active-overlap first; token-form active-overlap as a sibling row once tool-form classification is stable. Observed R-1135-ACTIVE-TOOL-2028 classification (2026-07-01, 🌿 log read): all 4 rows terminalized `succeeded`; +20/+21/+22 first hit `requests-in-flight` while immediate was active; no parallel provider buys; idle-retry released them sequentially after immediate ended; no fold/inform note entered the active turn, and no Silas #1137 provenance payload was present. That observed behavior is bounded, but NOT the evaporate+inform/provenance behavior figs expected — the row records the product decision point explicitly. This row is distinct from R-CW-MULTI-COLLAPSE because the collision is with an actively-running reply-run, not only a stale backlog pile. See spec. |
| R-CW-MULTI-COLLAPSE | 🩸 Cael | **multi-`continue_work()` elapsed-overlap, grace-conditional fold** (figs #1053 test-4): elections MATURED by yield-time (`now >= dueAt`) co-drain in ONE `consumePendingWork` batch (`work-dispatch.ts:364` — NOT a retroactive turn-storm) — **but the BATCH is not ONE drive: `partitionSupersededWork` (`:345-355`) is graceMs-GATED, not collapse-to-one.** Within the drained batch: **newest-elected always DRIVES (`:347`) · non-newest WITHIN-grace ALSO DRIVES (`:351`) · non-newest STALE (overdue past `graceMs` = `maxDelayMs × SUPERSEDED_GRACE_MULTIPLIER`) is SUPERSEDED/folded into newest (`:349`)**. So a within-grace pair = BOTH deliver (two drives from one drain); only a genuine stale pile folds. `running` is never folded (`:341`). DESIRED (the delay-choice MUST STRADDLE graceMs to capture both legs): **co-drain matured → newest drives + within-grace-older ALSO drives + stale-older (past graceMs) superseded**; unmatured fire at their `dueAt`. ERRONEOUS: collapse-to-one that drops a within-grace older (it MUST deliver 2) · a retroactive turn-storm (3 distinct retroactive turns) · failing to fold a genuine stale pile. See spec. |
| R-CW-DELEGATE-CHILD-LIVE | 🩸 Cael (+ 🕯 cross-walk) | **LIVE (non-mock) delegate-child `continue_work` hop-2-EXECUTES** (figs #1053 test-7/8). **STATUS: WIRING (register+arm+wake+hop-1-dispatch-ATTEMPT) = PROVEN child-keyed ✓** (🌫's byte 2026-06-20, precision-corrected by 🌊 `1517981925`: a `continue_delegate` child's continue_work REGISTERS + returns scheduled + ARMS + WAKES + fires the **hop-1 dispatch-ATTEMPT** under its OWN session key, flowId `48510873` / `continuation-8047325a` — then `work-drive-skipped reason=requests-in-flight`, i.e. **busy-skipped at hop-1, NEVER hop-2-EXECUTE**; #1044 wiring is LIVE in the delegate-child) — answers figs's "a delegate MUST self-continue" at the **WIRING / no-inversion** level (double-confirmed: a delegate-child `48510873` (author **attribution-pending** — 🌫 declined the credit `1517990583`, fired no delegate-child this session; whoever's seat actually fired it owns it) + 🌊 subagent `db3d5e33` both register+arm child-keyed, unlike the cron which doesn't register at all), NOT the hop-2-execute level (neither reached it — both busy-skipped at hop-1; "dispatches" was an overstatement, corrected). **DESIRED (figs-ruled): from-child continue_work MUST DRIVE hop-2** (defer-when-genuinely-contended is fine; permanent-defer is not). **LOCATED DEVIATION = #1057 (figs-ruled BUG, byte-confirmed RED on `3ae2d4cb2c`)**: the from-child terminal drive is BROKEN on a busy main seat — `work-dispatch.ts:240` gates the direct-grant continuation on `getQueueSize(MAIN_COMMAND_LANE)` (the MAIN lane the subagent's own direct-grant turn does NOT contend for), so it defers on traffic that isn't its own → on any active main seat it perpetually HOP1-only's, never drives. **This is NOT "correct-by-design busy-skip" — it is the wrong-lane gate, the bug.** Second dimension (🪨): even the defer outlives the child session (child ended 10:26:23 before the hedge fired 10:26:31+) → hop-2 LOST, not delayed. **FIX (scoped, both dimensions): (a) gate on the subagent's own readiness (`replyRunRegistry.isActive(work.sessionKey)`), NOT MAIN_COMMAND_LANE; (b) fire the terminal drive within the child's session lifetime.** Two-instrument-confirmed (🕯 spawn-init subagent `75c6899b` + a delegate-child `48510873` [author attribution-pending, NOT 🌫 — he declined `1517990583`] + 🌊 harness = the IDENTICAL `:240` defect, one fix). **STATUS FOLLOW-UP × 2 (🌊 then 🪨 2026-06-20, post-#1208 — the byte cut toward BOTH of us, re-split precisely): there are TWO DISTINCT layers, and the precise framing keeps them separate (my first follow-up over-collapsed them; 🪨 caught it; re-corrected): **(1) the DISPATCH-MECHANISM = TEST-PROVEN-AS-BUG** — 🌿's test (`ef90f994b2`) + PR #1060's regression-test (both in `work-dispatch.test.ts`) assert the `dispatched` COUNT (the gate-DECISION): "drives a SUBAGENT continuation when its own session is idle even if main busy" → `received dispatched: 0 (expected 1)` = the subagent's OWN session idle + main busy → the `:240` wrong-lane gate busy-skips = the cross-session BUG (figs-ruled `1517960244`), GREEN post-fix (`dispatched:1`). The gate-mechanism is test-settled; the fix resolves it. **(2) the LIVE terminal-drive-COMPLETES-END-TO-END = still OWED** — a REAL delegate-child taking a fresh hop-2 turn to COMPLETION on a genuinely-quiet runtime seat is a SEPARATE empirical byte; the live runs so far busy-skipped / the child ended before the hedge fired → no fresh turn completed live. That IS legitimately owed (🪨's catch: the dispatch-unit-assertion ≠ the live-full-loop-completion). So: **dispatch-mechanism TEST-PROVEN-AS-BUG (unit-level, fix-owed = PR #1060) · live-full-loop-end-to-end-completion still OWED (the genuinely-quiet child-seat where a fresh hop-2 turn COMPLETES).** My first follow-up collapsed (2) into (1) and wrongly said "not owed-to-capture" — same motion as 🪨's own earlier over-claim, opposite direction; the byte over both our banks. PR #1208's original split was the precise one: dispatch-mechanism-proven · live-full-loop-OWED.** (Two distinct bytes, not one — 🌻's split: the NEGATIVE case [busy-main starves] = MEASURED → #1057, filed RED; the POSITIVE case [idle-main drives] = OWED, harness-blocked. After the `:240` fix scopes the gate to the child's own session, this positive byte becomes the **#1057-fix's regression-test** — asserting the child drives regardless of main-lane state.) INSTRUMENT: a `continue_delegate` CHILD calling continue_work (the #1044 path), NOT an isolated cron (a cron/agentTurn doesn't supply `continueWorkOpts`, `openclaw-tools.ts:592`; the spawn-init path `attempt-execution.ts:771` does). NB the #1045 `Real behavior proof` CI check is a PR-BODY-EVIDENCE-POLICY gate (`scripts/github/real-behavior-proof-check.mjs` greps the PR body), NOT a runtime hop-2 test — do NOT use it as the behavioral surface; the behavioral byte is #1057. BOTH forms. See spec. |
| R-CD-1 | 🌊 Ronan | `continue_delegate()` schedule → spawn → return |
| R-CD-2 | 🌊 Ronan | `continue_delegate(mode="silent-wake")` full path |
| R-CD-3 | 🌊 Ronan | `continue_delegate(mode="post-compaction")` event-triggered lifeboat |
| R-CD-4 | 🌊 Ronan | cross-session targeted return via `targetSessionKey` |
| R-CD-TOKEN | 🌊 Ronan | **token/bracket form** of `continue_delegate`: `[[CONTINUE_DELEGATE: task]]` (and `+Ns` delayed form) schedules → spawns → returns, parity with the tool path. Tool-form sibling = R-CD-1. (Both-forms mandate.) |
| R-CD-CHAINED-DEPTH-2 Chain-1/2/3 | 🌊 Ronan | depth-2 chain — up-tree silent-wake / inter-session return / echo + cross-channel-broadcast |
| R-CONTINUATION-MIXED-SURFACE-FANOUT | 🩸 Cael + 🌿 scribe-observer | **mixed continuation surfaces in one turn** (figs 2026-07-01): fire, from one originating turn, (1) token-form `CONTINUE_WORK:20`, (2) immediate `continue_delegate` with a waking return payload, and (3) a `continue_delegate` child that itself schedules a depth-2 `continue_delegate(..., 22s, targetSessionKey=<main-session>)`. DESIRED: all three surfaces preserve independent provenance/trace identity; no surface starves or collapses another silently; depth-2 targeted return reaches the intended main session with origin/chain metadata; token-form work does not arrive as a naked imperative if it matures into an active turn. ERRONEOUS: one surface masks another, duplicate provider/model buys, unbounded wake/retry storm, missing target-session return, or token form silently no-ops on a surface that claims to support it. Evidence requirements: the exact originating surface (auto-scanned final text vs message-tool-only), parsed-token receipt for `CONTINUE_WORK:20`, tool receipts for both delegates, depth-2 child trace, target-session delivery receipt, flow ids/statuses, model-call counts, and Tempo traces for each branch. Surface caveat: a token embedded inside a `message` tool body is not scanned, but a raw assistant final-text response ending in bracket/bare continuation syntax is scanned even in this Discord session class (Cael live canary 2026-07-01: raw final `[[CONTINUE_WORK:20]]` produced a continuation wake). The proof row must record which surface carried the token and must not count a message-tool body as token proof. |
| R-CD-CHAINED-DEPTH-2 TEST-1 | 🕯 Emeric (substitutes for 🌫 Silas when canary-seat unavailable) | up-tree silent-wake from substitution-seat |
| R-CD-CHAINED-DEPTH-2 TEST-2 | 🪨 Rune (substitutes for 🌫 Silas when canary-seat unavailable) | inter-session return from substitution-seat |
| R-CD-CHAINED-DEPTH-2 TEST-3 | 🌫 Silas (canary) | echo + cross-channel-broadcast from canary-seat |
| R-CD-COLLECTION-ON-COLLAPSE | 🩸 Cael | **collection-on-collapse** (figs #1053 "necessary proof", flagged as potential CRITICAL GAP) — the DISTINCT case from up-tree-silent-wake: a delegate's OWN return follows up-tree on COLLAPSE to root **even when the child-return did NOT trigger a parent-turn** (figs: "where it is NOT the delegate waking the parent that causes new turn... my return will follow up-tree on collapse to root"). Mechanism: `parentRunId` default return + `fanoutMode="tree"` (`targeting.ts:46` routes to ancestors); the return is injected as a follow-up (`subagent-announce.ts:1579` deliver=false) = aggregates up-tree as CONTEXT, not necessarily a wake. DESIRED: child spawns delegates → their returns may/may-not wake the child → child's return STILL reaches root on collapse (the orchestrator receives it). ERRONEOUS: the return is LOST when no wake fires (return-only-on-wake). This is the aggregation-without-wake-trigger that the wake-cased R-CD-CHAINED-DEPTH-2 does NOT cover. **STATUS (🌊 byte-walk 2026-06-20 + 🪨's mode-refinement: the open PROOF-vs-GAP question RESOLVED, but MODE-CONDITIONAL):** the up-tree aggregation IS implemented — but the reach-to-root is **mode-conditional** (`targeting.ts`): **DEFAULT (no `fanoutMode`) → `:125` `parentRunId: childRunId` routes to the IMMEDIATE PARENT ONLY** (needs explicit-carry to reach root; **orphans if an intermediate collapses without carrying**); **`fanoutMode="tree"` (opt-in) → `:46-48` routes to ALL ancestor keys → reaches root automatically.** So my earlier "aggregates-regardless-of-mode" was imprecise: auto-to-root holds ONLY under `fanoutMode=tree`; the default is one-level-up. The cost-roll-up (`subagent-chain-hop` token climb) is separate + always-on. So R-CD-COLLECTION-ON-COLLAPSE asserts: **cost-climbs-auto ✓ · result-reaches-root IFF (explicit-carry OR `fanoutMode="tree"`) · orphan-case = intermediate-collapses-without-carry under default.** The #7-invariant decision is sharper than "auto-vs-explicit": the runtime supports BOTH — figs picks WHICH is the DEFAULT (the 3 shapes in issue #1061: explicit-carry-default [current] / `fanoutMode=tree`-default / invariant-only-under-tree). The owed empirical is the `parentRunId`-stitched trace under EACH mode (default = one-level; tree = reaches-root). See `RUNBOOKS/CONTINUATION-BEHAVIOR-SPEC.md` §collection-on-collapse + issue karmaterminal/openclaw#1061. **TEST-SHAPE (🌫-authored 2026-06-20, the load-bearing assertion to build against): the A→B→C(leaf) chain where B COLLAPSES BEFORE C's return propagates — assert root(A) collects C's sentinel across the dead intermediate (step 3) + NEGATIVE-guard no-orphan (step 4); the bug hides if chain-ancestry reads the LIVE intermediate not persisted state. Harness: intermediates MUST be mode=session (detached), NOT mode=run — 🌊's v1 mode=run wired-subagent hit perpetual `requests-in-flight` (the three-clears: model + wiring + genuine-idle). See spec §collection-on-collapse for the full desired-behavior (collapse-independence + ordering-independence) + the 4-step test.**
| R-RC-1 | 🌫 Silas (canonical-owner) | `request_compaction()` threshold REJECT — requires low-context main-session. When Silas seat unavailable, 🕯 Emeric substitutes per substitution-pattern (see `eb5d32cf3c` precedent + 2026-06-03 `9684479` substitution-receipt). |
| R-RC-2 | 🩸 Cael | `request_compaction()` over-threshold ACCEPT |
| R-OBS-1 | 🌻 Elliott (+ cohort cross-walk) | external `/status` continuation row + 6-prince cross-walk (was 4-prince in prior cycles; expanded for current cohort shape) |
| R-OBS-2 | 🪨 Rune | Tempo trace-tree visualization + parent-child span hierarchy export (substantively-fits stone-axis-substrate-of-record-witness shape per figs's 2026-05-16 traces-as-load-bearing directive) |
| R-CONFIG-DEFAULTS | 🕯 Emeric | continuation config defaults applied on bootstrap (lamp-axis cure-authoring natural fit) |
| R-CONFIG-INTERSESSION | 🕯 Emeric | continuation config persists across session boundaries (lamp-axis cure-authoring natural fit) |
| R-REGRESSION-TRAP-TESTS | 🕯 Emeric | sister-trap-tests landed alongside each cure-PR (#898 / #913 / #914 / #915 / etc.) substantively-lock-in the cure going-forward. Emerged from figs's 2026-06-03 framing "its frightening how we keep losing things" + the half-symmetric-cure-class (cure ships for one tool but not the sibling tool sharing the same plumbing, e.g. `continueWorkOpts` cured but `requestCompactionOpts` missed at spawn-init code-path). Lamp-axis owns because the authoring-seat is best-positioned to enumerate the sibling-surfaces that need parallel trap-test coverage. |

If the fleet is on CANDIDATE_SHA + each prince fires assigned rows from own seat, the cross-walk is complete. Substitutions are fine if a prince's seat is unavailable; document the substitution in the row's EVIDENCE.md (see substitution-pattern formalization below).

### Caps-test procedure (figs, 2026-06-21)

A cap-exhaustion row (R-CW-5 cost-cap; R-CW-6 chain-depth; and any config-cap row) must be proven by **actually hitting the cap**, not by reasoning about it. Production caps are set high enough that a normal proof run won't reach them, so lower them artificially for the test, then restore:

1. **Lower the cap(s) artificially low.** Edit `openclaw.json` directly (the continuation caps live under `agents.defaults.continuation`, e.g. `costCapTokens` / `maxChainLength` / `maxPendingWork`) — **record your ORIGINAL values first** (you restore them in step 4). Set the cap(s) under test low enough that a single proof run will exhaust them.
2. **Make the lowered setting effective.** Dispatch `gateway-reload.yml` (openclaw-bootstrap) for your seat so the gateway re-reads `openclaw.json` and the lowered cap goes live.
3. **Run the test under the lowered cap.** Fire the row and **validate you actually hit the cap** — the dispatch-time reject fires (e.g. `[continuation:work-rejected] … N/N`). Capture the reject in the journal + Tempo trace (same evidence shape as any row).
4. **Restore your original values.** Edit `openclaw.json` back to the original continuation-cap values you recorded in step 1.
5. **Make the restore effective.** Dispatch `gateway-reload.yml` again for your seat, restoring your original settings live.

The proof artifact records the lowered values used + the hit-the-cap evidence + confirmation that originals were restored. **Do NOT leave a seat on artificially-lowered caps after the row is captured.**

> ⚠️ **Workflow note (Cael, 2026-06-21):** figs's procedure names `gateway-reload.yml` (a config-reload that re-reads `openclaw.json` without a full service-restart — gentler than restart, no state-churn, the right tool for a transient lower→test→restore). **As of this edit `gateway-reload.yml` does NOT yet exist in `.github/workflows/`** (only `restart-gateway.yml`, which restarts the service, and `deploy-gateway.yml`). The reload workflow needs creating before this row can be fired as written. Until it exists, `restart-gateway.yml` is the fallback (it also re-reads `openclaw.json`, but with a full service-restart). Flagged to figs for the reload-workflow build.

### 6-prince per-seat name canon

When filing per-seat-subdir cross-walk evidence (see canonization below), use these exact seat-names so cohort-wide grep + corpus comparison stays consistent:

| Prince | Seat-name | Hardware |
|---|---|---|
| 🩸 Cael | `cael-dgx` | DGX Spark (ARM64) |
| 🌊 Ronan | `ronan-dgx` | DGX Spark (ARM64) |
| 🌫 Silas | `silas-lothric` | i9-14900KS + RTX 5090, 192GB RAM, CachyOS (x86_64) |
| 🌻 Elliott | `elliott-legion` | Lenovo Legion AMD + RTX 3080 (x86_64) |
| 🕯 Emeric | `emeric-nuc` | Intel NUC i7-12700H, 64GB CachyOS (x86_64). Lamp + Silas both colloquially call their boxes "lothric"; `emeric-nuc` is the canonical-name for the lamp-seat box per Silas's `1511837818` correction. |
| 🪨 Rune | `rune-rog-ally` | ASUS ROG Ally Z1 Extreme, 16GB CachyOS (x86_64) |

### Per-seat-subdir cross-walk shape (canonized)

When a row supports cohort-wide cross-walk evidence (anyone with a post-cure binary can fire and confirm), structure evidence under `<row>/<seat-name>/`:

```
PROOFS/<CANDIDATE_SHA>/R-CW-DELEGATE-SELF-CONTINUATION/
├── cael-dgx/
│   ├── EVIDENCE.md
│   └── wake_event_trace.json
├── ronan-dgx/
│   └── EVIDENCE.md
├── silas-lothric/
│   └── EVIDENCE.md
├── emeric-nuc/
│   ├── EVIDENCE.md
│   ├── fire_response.json
│   ├── journal_continuation.log
│   ├── subagent_continue_work_response.json
│   └── wake_event_trace.json
├── rune-rog-ally/
│   ├── EVIDENCE.md
│   └── wake_event_trace.json
└── elliott-legion/
    └── EVIDENCE.md
```

The row's README row-status updates as each seat's `EVIDENCE.md` lands. This shape was implicit in past `silas-side-fire/` precedent (e90a870154 + 0831fb5e80 corpora) and empirically-validated on 2026-06-03 (rune `e589364` → restructure `2afc341` per Emeric's `1511922340` substrate-refinement; lamp `fc08634` cross-walk close).

### Substitution-class discipline (formalized)

When a row's canonical-owner seat is unavailable for the cycle (deploy-blocked, seat-state-incompatible, sovereignty-call to skip), another prince may substitute. The substitution itself becomes part of the row's substrate-of-record.

Documentation requirements:
1. The substituting seat fires the row from its own seat and bands the evidence under the row's canonical path (not under the absent canonical-owner's name).
2. The row's `EVIDENCE.md` (or `SUBSTRATE-FINDING.md` when PASS-shape is also structurally blocked) explicitly names the substitution: `"<seat-name> substituting for <canonical-owner> per <unavailability-reason>; substitution-pattern precedent: <prior-cycle-corpus-ref>."`
3. The README verdict-table cites the substitution: `"R-XX ✅ PASS (substituted by 🕯 Emeric for 🌫 Silas)"` or `"R-XX ⚠️ HONEST-LIMIT (substitution-bank by 🕯 Emeric for 🌫 Silas)"`

Prior cycle precedents: `4896c3129b/eb5d32cf3c` substitution. 2026-06-03 cycle instance: `R-RC-1` lamp-substitution-for-Silas-out at commit `9684479` (lamp `emeric-nuc` seat substituting because Silas-axis canary-deploy restart pending).

---

## Tempo trace requirement (figs's 2026-05-16 directive)

For EACH continuation-tool fire (R-CW / R-CD / R-RC rows), capture the actual Grafana Tempo trace as part of the row's evidence. This is **MANDATORY**: a PASS row without its machine-readable Tempo `*_trace.json` in the proof corpus is **INCOMPLETE**. The upstream bot **clawsweeper** consumes the proof corpus and needs JSON; a screenshot does **NOT** satisfy the requirement (screenshots are supplemental only).

Required evidence:
- **Trace ID** emitted by the fire (visible in journal `[continuation:…]` log lines + tool-result payload)
- **Tempo URL** pointing at the trace: `http://tempo.dandelion.cult/api/traces/<trace-id>`
- **Span hierarchy export JSON** from Tempo at `R-<row>/<descriptive>_trace.json`
- **For chained / inter-session / post-compaction rows**: trace-parent stitching evidence across the spans (continuation.delegate.dispatch → child openclaw.run, etc.)

Dead-simple Tempo HTTP API recipe (Tempo is reachable at `http://tempo.dandelion.cult` on port 80; DNS `10.0.0.99`):

1. Find your trace-id if it is not already in your journal `[continuation:…]` line / tool-result. Search your own seat's fires via TraceQL:

   ```bash
   curl -sG http://tempo.dandelion.cult/api/search \
     --data-urlencode 'q={ resource.service.name="<your-seat>-prince" && .gen_ai.tool.name="continue_delegate" }' \
     --data-urlencode "start=$(date -d '8 hours ago' +%s)" \
     --data-urlencode "end=$(date +%s)" \
     | jq -r '.traces[] | "\(.traceID)  \((.startTimeUnixNano[0:10]|tonumber|strftime("%H:%M")))  \((.durationMs//0)/1000|floor)s"'
   ```

   `resource.service.name` is your seat (for example `ronan-prince`, `cael-prince`, `silas-prince`, `rune-prince`). Swap `continue_delegate` for `continue_work` for R-CW rows, or `request_compaction` / `message` as relevant to the row.

2. Export the full span-tree JSON. This one curl is the required span-hierarchy export:

   ```bash
   curl -sS "http://tempo.dandelion.cult/api/traces/<TRACE_ID>" \
     -o PROOFS/<FULL_SHA>/R-<row>/<descriptive>_trace.json
   ```

   The response is full OTLP JSON (`.batches[].scopeSpans[].spans[]`) with `openclaw.run`, `openclaw.tool.execution`, `openclaw.model.call`, and parent-child span hierarchy.

Naming: required JSON traces use `R-<row>/<descriptive>_trace.json` alongside the journal-receipt evidence files (e.g. `R-CW-1/wake_event_trace.json`). Optional screenshots may be added as `R-<row>/<descriptive>_trace.png`, but they do not replace the required JSON.

This is a departure from the prior 0831fb5e80 exemplar bar, which tracked OTel multi-span parent-stitching as separate follow-up work (`#553`, `#557`, `#559`). For cycles from 2026-05-16 onward, traces ARE part of the FULL proof-set.

---

## Honest substrate-findings vs PASS-shapes

A row's verdict can be one of:
- **✅ PASS** — the canonical behavior fired clean; receipts + trace captured
- **⚠️ HONEST-LIMIT** — a substrate condition prevented the canonical PASS-shape from firing; the substrate condition itself is the proof (e.g. R-RC-1 PASS-shape blocked by fleet-wide over-threshold context-state — `R-RC-1/SUBSTRATE-FINDING.md` consolidates the gate-stack receipts)
- **🔴 FAIL** — the canonical behavior failed in a way that requires regression-investigation; this is the case where the lane HALTs and goes back to Gate 1 per figs `1504663337` canon

**HONEST-LIMITs are NOT failures.** They are byte-walked classifications of substrate conditions (e.g. `maxChildrenPerAgent=5` saturation for chain-2/3 in 7-in-1-turn batch; subagent-policy-gate denies `request_compaction` to leaf subagents). They demonstrate the safety surface working as-designed; the gates engaging is the proof.

When filing a HONEST-LIMIT:
- Name the substrate condition explicitly
- Cite the gate-source (file:line reference for the policy check)
- Cross-walk against the byte-identical version of the same gate-source on PR-head + upstream/main to verify NOT regression
- Frame for maintainer-PR-comment in the "we inherit these failing tests unchanged" + "the safety-surface fires as-designed" framing

---

## Live-host runtime proofs require fleet-deploy

Behavioral rows that fire `continue_work` / `continue_delegate` / `request_compaction` from a prince's own seat at CANDIDATE_SHA require the prince's seat to be deployed at CANDIDATE_SHA via `gh workflow run deploy-gateway.yml`.

Fleet-deploy mechanics (per `ENTRYPOINT.md` workflow-override section):
- `vars.COHORT_TARGET_TAG` is the fleet-deploy-gating-tag (NOT a rebase target)
- If CANDIDATE_SHA isn't ancestor-of COHORT_TARGET_TAG, fire `deploy-gateway.yml` with `bypass_validation=true` + audit-logged `bypass_reason`
- Canary-first (smallest blast-radius prince — typically silas on urudyne); 5-10 min observation; then fleet-roll to remaining 3 princes
- Each deploy log + journal-excerpt → `PROOFS/<sha>/<prince>/` if prince's seat has unique journal-state worth banking; otherwise the row-specific evidence (R-CW-1/, etc.) suffices

Pre-deploy each prince must:
1. Clean own install-dir (`/home/figs/flesh_beast_tmp/openclaw`) of any modified-tracked-files via `git checkout HEAD -- <file>` (back up local hot-patches separately first)
2. Repair `~/.openclaw/openclaw.json` if config-validate fails post-deploy (manual inspect; doctor --fix doesn't catch deprecated-enum-values like `messages.queue.mode: "steer-backlog"` → use `"steer"`)

Per `ENTRYPOINT.md` failure-mode catalog 7 + 8.

---

## Authoring discipline

- **One commit per row** (or per related sub-row group). Easier to review, easier to revert if a single row's evidence needs correction.
- **Commit messages should name the row**: `PROOFS/<sha>/R-XX: <brief>`
- **Push direct to main** (no branch/PR detour)
- **README.md verdict table updated alongside row commits** — readers see at-a-glance what's filed + verdict status
- **METHOD.md + RESOLVED-SHA.md at corpus root** consolidate methodology + identifier-table; written once at corpus-init + updated as gates land

---

## Concluding every cycle: `proofs-manifest.json` + `PROOFS/INDEX.json` (#1176)

Every proofs cycle ends with two machine-readable artifacts — generate/refresh
them as the **concluding step**, every cycle, so clawsweeper (and humans) can
navigate the corpus without re-deriving scope or hand-walking the dirs.

### 1. `PROOFS/<CANDIDATE_SHA>/proofs-manifest.json` — the per-SHA manifest

The byte-true roll-up of the cycle: it **comprises the test-case enumeration +
pointers to every piece of the corpus** (rows, traces, supporting docs). It is a
generated mirror of the README verdict table, NOT a hand-written summary —
regenerate it whenever a row state, trace, or the SHA changes. Shape:

```json
{
  "corpus": "<corpus name>",
  "sha": "<full 40-char CANDIDATE_SHA>",
  "sha_short": "<7-char>",
  "build_string": "OpenClaw <ver> (<sha_short>)",
  "method": "openclaw-bootstrap:RUNBOOKS/PROOF-CORPUS-METHOD.md",
  "generated": "<date (seat, basis)>",
  "rollup": { "total_rows": N, "pass": N, "partial": N, "thin": N, "fail": N, "missing": N },
  "notes": "<disposition / honest-limits / contested-deferred>",
  "rows": [
    {
      "row": "R-CW-1",
      "title": "...",
      "owner": "🩸 cael (cael-dgx)",
      "state": "pass|partial|thin|fail|missing",
      "dir": "PROOFS/<SHA>/R-CW-1/",
      "evidence_doc": "R-CW-1/EVIDENCE.md",
      "summary": "...",
      "test_cases_executed": ["...", "..."],
      "traces": [ { "path": "PROOFS/<SHA>/R-CW-1/wake_event_trace.json" } ],
      "supporting_docs": ["PROOFS/<SHA>/R-CW-1/..."],
      "notes": "honest-limit / both-forms note",
      "fired": "<date time, seat sha (build)>"
    }
  ]
}
```

- `rows[]` enumerates **every** row in the README verdict table — same ordering,
  same states; `rollup` is the count by state.
- Each row's `traces[]` carries the **Tempo trace JSON path(s)** (the fire-time
  trace mandated in "Tempo trace requirement"); `supporting_docs[]` the evidence files.

### 2. `PROOFS/INDEX.json` — the top-level signpost

One file at the `PROOFS/` root naming the **current** pr-presentation corpus, so
navigation + dir-count stay unambiguous (many historical `PROOFS/<sha>/` dirs
exist; this names the live one). Shape (`openclaw.proofs.index.v1`):

```json
{
  "schema": "openclaw.proofs.index.v1",
  "purpose": "Top-level signpost for clawsweeper + humans: which PROOFS/<sha>/ corpus is CURRENT.",
  "current_sha": "<full SHA>",
  "current_sha_short": "<7-char>",
  "build_string": "OpenClaw <ver> (<sha_short>)",
  "corpus_path": "PROOFS/<SHA>/",
  "manifest_path": "PROOFS/<SHA>/proofs-manifest.json",
  "readme_path": "PROOFS/<SHA>/README.md",
  "rollup": { "total_rows": N, "pass": N, "partial": N, "thin": N, "fail": N, "missing": N },
  "disposition_note": "<contested-deferred / FF-decoupled note, if any>",
  "navigation": "clawsweeper: read INDEX.json -> current_sha -> manifest_path -> rows[]",
  "generated": "<date>",
  "generated_by": "<seat (basis)>"
}
```

- Point `current_sha` + the `*_path`s + `rollup` at the **new** CANDIDATE_SHA
  every cycle — never leave it on a historical corpus.
- It is the entry-point clawsweeper reads first; the per-SHA manifest is the detail.

**Both land on `karmaterminal-openclaw-docs:main` directly** (no branch/PR
detour, per "Where proofs live") as the concluding commit of the cycle —
**generated, byte-true off the README verdict table, every proofs cycle.**

---

## Cross-references

- `RUNBOOKS/ENTRYPOINT.md` — entrypoint pointing here for proof-corpus work
- `RUNBOOKS/PR-DRIFT-CURE-GATES-RUNBOOK.md` — the 6-gate procedure this runbook supports (Gate 4 specifically)
- Past corpora (exemplar bars to match shape):
  - `karmaterminal-openclaw-docs:PROOFS/0831fb5e80/` (May 2026; canary-seat substrate-luck enabled R-RC-1 PASS-shape)
  - `karmaterminal-openclaw-docs:PROOFS/e90a87015479d7a7ff6ae73deda9a84f1a448418/` (2026-05-16; full Tempo trace coverage + 4 gate-findings banked honestly)

## When a row's PASS-shape is structurally blocked

If PASS-shape cannot fire at submission-time (e.g. R-RC-1 at all-seats-over-threshold context-state):
1. File the honest-negative receipts that DO exist (gate-stack engagement evidence)
2. Create `<row>/SUBSTRATE-FINDING.md` consolidating the gate-stack receipts into a structural-finding writeup with maintainer-facing framing
3. Verify the gate-source is BYTE-IDENTICAL between PR-head and CANDIDATE_SHA (proves the row is NOT cure-regression)
4. Frame for PR-comment: "<Row> REJECT-path verified via gate-stack receipts at high-context; structural PASS-shape blocked at submission-time per <substrate-condition>, tracked as honest-substrate-finding."

This is option (g) per cael's 2026-05-16 framing — substrate-finding-of-structural-difficulty is itself the proof.
