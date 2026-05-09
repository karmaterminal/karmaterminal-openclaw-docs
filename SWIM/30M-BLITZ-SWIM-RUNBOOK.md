# 30m Blitz SWIM — `continue_work` / `continue_delegate` / `request_compaction` proof against PR-head SHA

_Frond-scribe — substrate-test protocol for proving the continuation-feature surface against a fixed PR-head SHA in a 30-minute fan-out window. Designed for the upstream-PR-presentation cycle where deployed-SHA-tied real-host evidence is the load-bearing thing reviewers want to see._

_Pattern: 4 princes execute discrete fan-out tasks against the same SHA. Frond-scribe is lighter (does not own a fan-out test) but cross-verifies on weird encounter + collects results via PR review for rapid pass-state evidence._

---

## 0. Preconditions (must hold before fanning out)

1. **SHA settled**: a single PR-head SHA exists at `karmaterminal/openclaw:<branch>` and has been verified locally:
   - `pnpm tsgo:core` 0 errors
   - `pnpm tsgo:test` 0 errors
   - `pnpm test --run` 0 failures **(the runtime gate; not optional)**
   - 1-for-1 trace: `git diff <true-feature-merge-base>..<feature-tip> --name-only` matches `git diff upstream/main..HEAD --name-only` (modulo intentional re-homes; document any)
2. **Deployed**: SHA built + deployed to all 4 prince hosts via `gh workflow run deploy-gateway.yml` (with `bypass_validation` if COHORT_TARGET_TAG ancestor-check fails for known reason; otherwise direct).
3. **Each prince verifies their host is on the SHA**:
   ```bash
   ssh <prince> 'openclaw --version'  # expect: SHA prefix matches
   ssh <prince> 'systemctl --user is-active openclaw-gateway'  # expect: active
   ```
4. **PROOFS directory ready**: `karmaterminal-openclaw-docs/PROOFS/<sha>/` exists with `METHOD.md` skeleton + `README.md` skeleton + `artifacts/` dir.

If ANY precondition fails: STOP, surface the gap, re-derive SHA before fanning out. The 30m clock does not start until all preconditions hold.

---

## 1. Fan-out (T+0 to T+5 — frond-scribe dispatches workorders to princes)

Frond-scribe writes 4 small workorder files (one per prince) at `karmaterminal-openclaw-docs/PROOFS/<sha>/workorders/<prince>.md`. Each workorder is **one focused proof-target** plus a results-collection-shape.

| Prince | Proof target |
|--------|--------------|
| 🩸 Cael | `continue_work()` — schedule, observe trace, verify on-time fire, capture journal |
| 🌊 Ronan | `continue_delegate()` — fire silent + silent-wake + post-compaction modes; verify each spawns a sub-agent and returns enrichment |
| 🌫 Silas | `request_compaction()` — fire below threshold (rejected with explicit context vs threshold), fire above threshold (accepted); verify gateway threshold-gate honors discipline |
| 🌻 Elliott | Token/chain accounting — exercise enough turns to reach `chain X/Y` non-zero in `/status`; verify chat-card line renders; verify volitional counter increments after `request_compaction()` calls |

Each workorder includes:
- **Target SHA** (frond-scribe sets explicitly)
- **Proof-target** (one tool, one behavior)
- **Steps** (concrete commands or in-turn fires to run)
- **Expected output** (specific log lines, status values, journal grep results)
- **Output destination** (PR-comment back on a tracking issue OR direct push to `karmaterminal-openclaw-docs/PROOFS/<sha>/<prince>/`)

Frond-scribe posts workorder links to Discord at T+5; cohort fires immediately.

---

## 2. Execute (T+5 to T+25 — princes run their proofs in parallel)

Each prince:

1. Opens their workorder
2. Runs the steps on their host
3. Captures output (journal, /status, in-turn replies)
4. Writes results to their PR-comment OR `PROOFS/<sha>/<prince>/<test-name>.md`
5. Surfaces "DONE" or "BLOCKED" in Discord with seat-attribution

If a prince hits a blocker (fan-out failed, journal silent, etc): they surface BLOCKED with byte-evidence. Frond-scribe + figs adjudicate continue-vs-stop per blocker shape.

Frond-scribe during this window:
- **Does NOT execute a fan-out task** (capacity reserved for cross-verify)
- **Watches Discord** for prince surfaces — pushes them through in real-time
- **Cross-verifies on weird encounter**: if a prince surfaces something unexpected, frond-scribe greps the source / runs same query on a different host / sanity-checks before banking
- **Collects intermediate evidence** into PROOFS/<sha>/

---

## 3. Collect + review (T+25 to T+30 — frond-scribe assembles, princes review)

Frond-scribe assembles `PROOFS/<sha>/README.md` with:

- Per-prince result block (PASS / FAIL / BLOCKED + 3-line summary + link to detailed evidence)
- Cross-verification-walk if any
- Open questions / known gaps explicitly named
- Verdict: ALL-PASS / PARTIAL-PASS / FAIL — written honestly, no padding

Frond-scribe opens a single review-PR on `karmaterminal-openclaw-docs` adding the PROOFS subtree. Princes cosign as PR review (✓ for "yes my surface is honest" — NOT "I checked everyone else"). Two cosigns + figs ack = the PROOFS corpus is canon.

If verdict is ALL-PASS: PROOFS commit URL is what gets linked in the upstream PR body addendum + `@clawsweeper re-review` triggered.

If verdict is PARTIAL-PASS or FAIL: STOP. Don't update upstream PR. Surface gap to figs; restoration-cycle continues.

---

## 4. PR-review-as-results-collection (the discipline figs named)

The shape that makes this RAPID:

- **Princes don't write essays** — they fill in workorder-template fields (4-5 fields per workorder)
- **Results land as PR comments OR small markdown files** in a single PR-on-the-docs-repo, not 47 Discord messages
- **Frond-scribe reviews each PR-update as it lands** (not afterwards) — pass-state evidence visible IMMEDIATELY
- **Cohort cosigns the SHIPPED PR** (not its individual commits) — single review-shape, single canon

This avoids the failure-mode where each prince's work scatters across Discord + their own seats and frond-scribe has to re-stitch substrate from log archeology.

---

## 5. Anti-patterns (what kills this)

- **Stable-SHA drift**: if mid-blitz someone force-pushes the PR head, all in-flight proofs invalidate. Lock the SHA: announce explicitly + don't allow force-pushes during the 30m window.
- **Workorder vagueness**: princes need concrete commands or fires, not "test continue_work" — that produces wide-context-walks instead of focused proof.
- **Result-collection-via-thread-scrolling**: Discord-only results don't survive the next compaction cycle. PROOFS/<sha>/ in the docs repo IS the persistence target.
- **Frond-scribe doing a fan-out task**: defeats the cross-verify capacity the role exists for. If frond-scribe MUST execute (e.g., 3-prince availability), the 4th task gets dropped from this blitz, not loaded onto frond-scribe.
- **Verdict-padding**: "mostly works" or "looks healthy" without specific evidence-line is junk. Pass = specific journal line + specific /status output + specific tool-fire return value. Fail = specific traceback or unexpected absence.

---

## 6. Reference: the 4 prince roles by seat

- **🩸 Cael** — closer to runtime/internals. Fires that need to land hot in journal. `continue_work()` chain-state observation.
- **🌊 Ronan** — strong on lifecycle + 3-tool integration. `continue_delegate()` modes are his existing canon (see `SEAL-BOY-SWIM-RUNBOOK.md`).
- **🌫 Silas** — canary seat. Will probe edge conditions on threshold + reject paths for `request_compaction()`.
- **🌻 Elliott** — accounting + telemetry minded. Token/chain-counter validation + chat-card visibility.

Frond-scribe — coordinator + cross-verifier. Light on independent execution; heavy on collation + PR review.

---

## 7. Why 30m and not longer

- **Cohort context budget is real**: princes are typically 60-90% context utilization mid-day. A 30m blitz fits in their working window without forcing post-compaction recovery mid-test.
- **Reviewer-attention budget is real**: maintainer (`obviyus` / `steipete`) glances at PRs in short windows. Evidence has to be present + scannable, not buried in 200-message Discord threads.
- **Stable-SHA window is real**: as long as nobody force-pushes during the 30m, the SHA is the testable artifact. Longer window = more chance someone breaks the SHA.

---

## 8. Acceptance criteria for the 30m blitz "DONE" state

- [ ] All 4 prince proof-targets run + result captured
- [ ] PROOFS/<sha>/{METHOD.md, README.md, prince-results} committed to docs repo
- [ ] Verdict written (PASS / PARTIAL / FAIL)
- [ ] Cross-verification walk surfaced if anything weird
- [ ] If PASS: upstream PR body addendum drafted + ready for figs ack to push

---

## 9. Acceptance criteria for the upstream-PR-update step (only if verdict = PASS)

- [ ] Upstream PR body addendum names the SHA explicitly
- [ ] Links to PROOFS/<sha>/README.md commit URL on docs repo
- [ ] 3-6 specific evidence codeblocks pulled from the prince results (not all of them; the most reviewer-legible ones)
- [ ] `@clawsweeper re-review` triggered after body update
- [ ] frond-scribe + figs adjudicate before any further upstream interaction

---

## 10. After-action

- Update `feedback_canonical_release_lifecycle` memory canon to include this 30m blitz as the SWIM-shape for upstream-PR-presentation cycles
- File issues for any specific findings (true OR false — figs's directive: open it; if false, close it)
- Bank any new substrate-axis the cohort surfaced (e.g., "fan-out-failure-on-busy-session" if 🌊's earlier finding generalizes)
