# SWIM 36 — Continuation Feature Full-Surface Coverage

**Status**: ACTIVE
**Owner**: Ronan 🌊 (swim-driver, per figs 2026-04-22 07:03 PDT)
**Witness/Operator**: Silas 🌫️ (mnemosyne register — playbook + evidence ledger)
**Project board**: https://github.com/orgs/karmaterminal/projects/54
**Trigger context**: PR #290 in-flight (frond-scribe via ronan-dandelion-cult, addresses Failure 3); Cael's codex+claude agents addressing Failures 1 + 2 in parallel worktrees
**Mandate quote (figs 2026-04-22 07:03 PDT)**: "insist on full surface coverage of continuation feature in SWIM 36"

## Goal

Verify the full surface of the continuation feature (RFC: `docs/design/continue-work-signal-v2.md` @ commit cf2cecf979) under a coordinated soak after the in-flight pressure-band fixes land. Produce byte-evidence per surface, not narrative.

## Scope (15 surfaces, 45 issues on project #54)

### A. Tool-Surface — must be live + callable each turn
- #54 continue_delegate tool missing from agent toolset
- #57 enable continue_delegate tool for chain delegates
- #88 Swim 12 Phase 1: Tool availability
- #21 lift continue_delegate SUBAGENT_TOOL_DENY_ALWAYS

### B. continue_work end-to-end (Trigger A — self-elected timer)
- #90 Swim 12 Phase 3: continue_work tool end-to-end
- #117 continue_work timer silently killed by generation guard
- #114 continue_work timer stacking
- #154 continue_work timer never armed despite tool-call acceptance

### C. continue_delegate modes (Trigger B — silent/silent-wake/post-compaction)
- #91 Swim 12 Phase 4: continue_delegate tool modes
- #119 continue_delegate tool calls lost in multi-payload batched responses
- #118 ~50% delegate loss rate under 4-prince concurrent relay chains
- #116 Silent delegate completion not observable in session_status
- #51 Delegate return-routing on messaging surfaces

### D. request_compaction (Trigger C — voluntary)
- #92 Swim 12 Phase 5: request_compaction tool guards

### E. Bracket fallbacks (Trigger D — emergency syntax)
- #93 Swim 12 Phase 6: Bracket fallbacks

### F. Context-pressure bands (Trigger E — pre-run threshold check) ← **active fix lane**
- #61 Compaction death spiral on copilot proxy [CANONICAL]
- #94 Swim 12 Phase 7: Context pressure events
- #110 PR review: contextPressureThreshold=0 silently disables feature
- #112 PR review: continuationEnabled not wired through buildEmbeddedSystemPrompt
- #113 Wire continuationEnabled through production prompt builders

### G. Chain guards & limits
- #95 Swim 12 Phase 8: Chain guards and limits
- #18 costCapTokens not wired for bracket chain-hop delegates
- #19 maxDelegatesPerTurn doesn't hot-reload
- #109 PR review: maxDelegatesPerTurn bypass via bracket-signal delegate

### H. Lich/post-compaction lifecycle (Trigger F — in-turn compaction recovery) ← **active fix lane**
- #23 [Lich Protocol] Pre-compaction + post-rehydration lifecycle hooks
- #22 [Lich Protocol] Delegate label field + silent enrichment returns
- #153 Assure TaskFlow based persist for ALL delegate paths

### I. Status / observability
- #89 Swim 12 Phase 2: /status continuation telemetry
- #115 Investigate overnight continuation behavior
- #152 Investigate unreliable continuation wake surfacing under Swim-style attempts
- #52 Continuation/volition debugging

### J. State persistence (TaskFlow integration)
- #155 Assessment: continuation state vs TaskFlow

### K. Race conditions & concurrency
- #282 [P1] cancel status update in continuation-delegate-store-taskflow can race
- #277 [Feature]: first-class no_reply tool

### L. Config / schema
- #87 Swim 12 Phase 0: Pre-flight config verification
- #96 Swim 12 Phase 9: Config convergence
- #285 zod-schema.agent-defaults: missing `truncateAfterCompaction`
- #108 PR review: dead code — continuation-generation.ts never imported

### M. Aspected delegates (future)
- #274 Continuation feature evolution: aspected-shadow delegates (the pantheon)

### N. RFC accuracy
- #97 Swim 12 Phase 10: RFC accuracy + bug verification
- #158 RFC polish: trim results appendix
- #85 RFC: document sessions_yield interaction with continue_delegate

### O. Branch/release hygiene
- #144 Rebase continuation feature onto v2026.4.11
- #198 Clip non-continuation changes off candidate branch

## Status flow (project #54 columns)

`Todo` → `in_coding_agent` → `prince_review` → `swim` → `Done`

## In-flight at swim charter time (2026-04-22 07:30 PDT)

- **PR #290** (`frond-scribe/fix-in-turn-pressure` → `feature/context-pressure-squashed`): +42/0, addresses surface F Failure 3 (mid-turn `[context-pressure:fire]` + `[system:context-pressure]` emission from timeout-compaction + overflow-compaction paths). Mergeable, CI queued. Author: ronan-dandelion-cult; author-voice: frond-scribe.
- **Cael's codex worktree** (PID 3186320, 14min elapsed): root-cause find on Failure 1 (`mergeSessionEntry` writes `lastContextPressureBand: undefined` during compaction); 7 files modified, +218/-20. Surface F + H.
- **Cael's claude session** (`wo61-fix`, 18% context, 102 turns): scope = Failure 2 (`after_compaction` hook silently dead → zero `[system:post-compaction]` emissions across n=4 cohort). Found `followup-runner.ts` may bypass post-compaction emission entirely.

## Companion documents (in this dir)

- `playbook.md` — Silas's operator playbook (per-surface grep targets, telemetry pulls, pass/fail anchors, soak shape)
- `evidence-ledger.md` — Silas's mnemosyne ledger (raw log excerpts + sha pins per surface verification)

## Anchor naming convention

Cross-refs between charter ↔ playbook ↔ ledger ↔ project board use `<surface-letter>-<short-name>`:

`A-tool-availability`, `B-continue-work`, `C-continue-delegate`, `D-request-compaction`, `E-bracket-fallbacks`, `F-pressure-bands`, `G-chain-guards`, `H-post-compaction`, `I-status-observability`, `J-taskflow-persistence`, `K-races`, `L-config-schema`, `M-aspected-delegates`, `N-rfc-accuracy`, `O-branch-hygiene`

## Testing discipline (figs directive, 2026-04-22 08:01 PDT)

Mandate quote: *"pls don't skip tests that let you catch stuff before swims 🕯️"*

Lesson concretized by PR #290 finding 2: missing timeout-path `[context-pressure:fire] mid-turn trigger=timeout` regression assertion let half the fix ship unguarded; only triangulated cross-prince review caught it before merge. Tests skipped become bugs deferred to swim. Every time.

**Hard rules for SWIM 36 fix-PRs:**

1. **Every surface in the playbook needs a regression test asserting its log anchor exists.** No anchor = no surface coverage = surface stays open.
2. **No fix-PR merges without paired test.** CI block, not aspiration. If the fix changes emission behavior, a test asserts the new emission. If the fix prevents a regression, a test would fail without the fix.
3. **Path parity.** If one branch of a code path has a regression assertion (e.g. overflow-path tests `mid-turn trigger=overflow`), all sibling branches must too (timeout-path tests `mid-turn trigger=timeout`). PR #290 finding 2 = canonical example.
4. **Side-channel emissions mocked + asserted, not just executed.** `enqueueSystemEvent`, `[system:*]` injections, post-compaction hooks, log anchors — all need test mocks/spies. "Test passes when line is deleted" = no test.
5. **PR descriptions must accurately label behavioral contract changes.** Model-visible system events ARE contract changes. Acknowledge in PR body. (PR #290 finding 3.)
6. **Test-trap mandate (figs directive, 2026-04-22 08:47 PDT).** Every emission anchor has a paired stable-string test assertion (`expect.stringContaining('[anchor:name]')` shape). The test-trap fails CI red when the anchor is renamed, moved, or silently dropped — *before* the silent surface degradation reaches production. "You lost or moved" trap pattern: the assertion is the contract, the rename is the violation, the test is the alarm. Refactor that drops the anchor must explicitly migrate the test or migrate the swim doc — never silently.
7. **Symmetric miss-side trap (cael extension, 2026-04-22 08:49 PDT).** Rule 6 is the *fire-side* trap (anchor presence asserted, rename breaks CI red). The *miss-side* trap is the cohort-soak invariant: `[session-key:missing site=<anchor>]` and equivalent miss-emission anchors have **hit-count = 0** in clean cohort runs. Non-zero = silent-fall-through regression upstream (e.g. `backfillSessionKey` drift). Two traps per surface: (a) fire-side anchor presence (red CI on drop), (b) miss-side anchor absence (red soak on hit). Together they catch rename-breakage AND silent-fall-through.

### Teleology of the test-trap (cael framing, 2026-04-22 09:00 PDT, in response to figs advisory 08:57)

Rules 6+7 are not scoped only to in-cohort refactor-rename hazard. The deeper mandate is **rebase-illuminator**: anchor-tests catch the moment upstream form-shift collides with our feature. *Red CI on rebase = free archaeology.* When upstream chops/changes (TaskFlow's recent introduction is the canonical example: post-fork addition that upended assumptions about session/event flow), the breaking test is the system telling us "this surface moved upstream, look at it." The test-trap converts silent rebase-drift into legible CI failure.

**File-loss as same shape (figs note, *"we've lost whole files in the past"*):** silent file-removal during rebase has the identical failure-mode signature as silent anchor-rename: the absence only surfaces if a test asserts the file's content/anchor still exists. Rules 6+7 cover both — fire-side asserts presence (file/anchor exists), miss-side asserts absence-of-fall-through. A rebase that loses a file silently breaks a fire-side test by making the anchor disappear; the prince re-running the test sees red CI and knows to re-cartograph.

**Operational implication for surface coverage**: every wiring-sketch in `swims/swim-N/wiring/<surface>.md` carries a corresponding fire-side test that asserts the sketched-anchor exists in source. Post-rebase workflow (silas, for playbook): re-run wiring-sketch grep against `swims/swim-N/wiring/` directory, diff against committed sketch, surface drift in PR before merge. Charter holds the rule; playbook holds the runbook.

Charter author (Ronan) and playbook author (Silas) jointly own enforcement; surface owners (per project #54 assignments) own test authorship before requesting review.

## Review-gates

Per Silas's C1-R3-enforcement (2026-04-22 08:10 PDT), the following PR-level gates apply to all SWIM 36 fix-PRs **before** they enter the swim soak queue:

1. **Anchor-test pairing gate.** Any new `log.warn`/`log.debug` anchor in a fix-PR MUST land with a matching `expect.stringContaining(...)` assertion in the same commit. PR-review-toolkit reviewers (human or agent) reject otherwise. Anchor-without-test = silent regression vector; the next refactor deletes the log line and the swim catches it instead of the test (or worse, production does).
2. **Path-parity gate.** If the fix touches one branch of a forked emission path (e.g. timeout vs overflow, pre-run vs mid-turn), all sibling branches require parity assertions in the same PR. PR #290's missing timeout-path assertion is the canonical violation.
3. **Side-channel mock gate.** Any new call to `enqueueSystemEvent`, `[system:*]` injection, post-compaction hook, or other side-channel emission MUST have its argument list asserted via test mock/spy in the same PR. Issue #291 is the standing follow-up; future fixes should not regress further.
4. **Multi-model review on continuation surfaces.** Per figs directive 2026-04-22 08:03 PDT, fix-PRs touching SWIM 36 surfaces should solicit at least 2 independent multi-model reviews (e.g. claude-opus + gpt-5.4 + goldeneye) before merge — overlap is feature, not collision; convergence is ship-stamp, divergence is added coverage.
5. **Lane-check before spawn (per Silas C1-R11, 2026-04-22 08:11 PDT, revised 08:13 PDT).** Before spawning `/pr-review-toolkit:review-pr`, post intent + target PR + intended model to #sprites. Multi-agent overlap on the same surface is **welcomed** — the lane-call exists to **diversify the model mix**, not prevent dup. *If you dup, dup with a different brain.* If first reviewer runs claude-opus, second reviewer picks `gpt-5.4` / `goldeneye` / other family for orthogonal perspective. Same-family dup gives convergence-evidence (real-finding stamp); cross-family fan-out gives that **plus** divergence-evidence (which findings hold across models = high-confidence; which only one finds = worth deeper byte-check). Third reviewer byte-checks divergences rather than blanket re-running. Same-model triple-dup is the wasteful pattern; cross-model triple-fan-out is the gold standard.

Gate enforcement is at PR-review stage, not swim-queue admission. The swim should catch what the tests miss; tests should catch what the fix breaks.

## Wiring-discipline (figs directive, 2026-04-22 08:47 PDT)

Mandate quote: *"prior to executing a test case (and updating main branch SWIM/ docs as needed) assure you stab at the paths being assessed. ... knowing where you think you're going is important."*

The continuation feature runs as a **repeating core loop with concurrent events arriving upon it, dispatching to sessions of various sort and capability** (figs's framing). The post-modularization shape (continuation pulled out of core openclaw splay into discrete `src/agents/pi-embedded-runner/` + `src/infra/system-events.ts` + RFC anchors) makes the wiring more legible than it was — but legibility is not knowledge. Every surface in the playbook gets a wiring sketch *before* a test case fires against it.

**Order of operations for every SWIM 36 surface (A–O):**

1. **Read the path end-to-end.** Entry point → dispatch → session-type fanout → emission. Source-byte-quote at each branching node, not narrative paraphrase.
2. **Sketch the wiring** in `swims/swim-36/wiring/<surface-letter>-<short-name>.md`. Include: concurrent-event arrival shape, dispatch target(s), session-capability matrix (which session-types receive vs ignore vs error), expected emission anchors at each terminus.
3. **Commit the wiring sketch to main-branch SWIM docs** before executing test cases against the surface. Surface coverage starts at *cartography*, not at *canary*.
4. **Execute test case** against the wiring sketch (not against memory of the wiring).
5. **Log the result against the wiring doc**, not in a separate channel artifact. The wiring doc is the artifact-of-record; test results enrich it; channel discussion summarizes it.

**Cartographer-then-canary, not canary-blind.** Surface-map A–O = 15 wiring sketches before any soak fires. The soak validates the cartography; the cartography prevents the soak from being a needle-haystack hunt through a system nobody has mapped end-to-end.

**Why this matters:** the failure mode the modularization was designed to prevent — silent degradation when a code path is moved or renamed — only protects you if you *know where the code path was* when you assessed it. The wiring sketch is the snapshot. The test-trap is the alarm. Together they close the loop figs named: *trap 'you lost or moved.'*

Charter author (Ronan) owns §Wiring-discipline enforcement at PR-review stage; surface owners author wiring sketches before requesting test-execution review.

### Sketch as test-spec, not snapshot (figs advisory, 2026-04-22 08:57 PDT)

Figs advisory verbatim: *"upstream chops and changes a lot; what we think true for how wiring (or even features like the TaskFlow system, only recently introduced) can upend (and do) presumptions about form of system. don't over-burn, while having enough cognizance of your feature to understand 'what i'm looking for' at relative depth for a test case. let in-repo tests help you; that exposes upstream shift vs our feature if done well — every time we rebase, we'll ideally break a bunch of tests, and the failures may be illuminatory in tracking what happened."*

**Depth calibration**: the wiring sketch is sized to *specify the test case*, not to *snapshot the codebase*. Half a page that names "these are the call sites the test asserts against" + "this is what changes if upstream moves the path" is the target shape. A multi-page topology of the surface is over-burn — it grows surface-area for rebase-rot without improving the test the cartography exists to enable.

**The test-membrane is the cartography-update**: in-repo tests breaking after a rebase are not the failure mode; they are the cartography being *re-grounded* against upstream shift. The wiring sketch's job is to make those failures **legible** (which call site moved, what emission was lost, what session-type fanout changed), not to predict them. Charter has lost whole files to past rebases; the sketch is the artifact that helps a post-rebase prince reconstruct what was meant.

**Operational rule**: if you find yourself writing >1 page of sketch per surface, ask whether the additional content is enabling a specific test assertion or whether it is documentation-for-its-own-sake. If the latter, prune. The sketch survives by being small and pointed; the test suite carries the weight of in-the-flesh truth.

## Closure criteria

SWIM 36 closes when:
1. All P0/P1 issues on project #54 are `Done` or moved to a successor swim
2. Evidence ledger has byte-pin per active surface
3. RFC §4.1 trigger taxonomy is verified end-to-end against codepaths
4. Post-soak: 24h cohort run with zero band=25 anomaly fires (verifies no stale-config code path), non-zero `[system:post-compaction]` emissions per prince session
5. **Every closed surface has at least one regression test asserting its log anchor — no exceptions.**
6. **Every closed surface has a wiring sketch in `swims/swim-36/wiring/`** committed to main, updated to reflect the as-shipped code path, with test results logged against it.
