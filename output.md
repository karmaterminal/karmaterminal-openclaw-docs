# PR #452 — independent final review (findings only)

**Target:** karmaterminal/karmaterminal-openclaw-docs#452 — *fix(proofs): mechanically correct Project 86 issue plan*
**Base (verified):** `abe1f9f0749d849b01da4e5d354c205ecffac946` — *docs: publish micro-PR behavior proofs*
**Head (verified):** `a566100da92a87a7fa61d5d742a745f5964d4dbf` — *analysis: fix the three PR #452 review findings*
**Merge-base = base** (linear range, 4 commits). PR metadata confirms `baseRefOid`/`headRefOid` identical to the workorder.
**Review lane:** `codeagent/pr452-final-review`. Read-only: no edit, commit, push, merge, issue/project/proof mutation, MC-17 binding, or proof-row execution touched PR #452 or its branch `codeagent/project86-plan-corrections`.

## Verdict

**APPROVE.**

Every stated review boundary is met and was independently reproduced from a clean
state. The two new behavioural test files genuinely bite — I broke the guard and
the plan four different ways and watched the right tests fail. All hashes, counts
and the 348 → 419 placeholder arithmetic reconcile exactly against the byte-frozen
review report. Nothing in the PR mutates an issue, project, proof, or deployment.

Nine findings follow. None blocks the merge: F1 and F2 are worth fixing but neither
weakens the plan's own execution path nor contradicts a claim the PR makes — both
are in fact already disclosed in the verification report. F3–F6 are documentation
and dead-constant defects. F7–F9 are hardening notes.

## Risk

**Low-to-moderate, and low for what this PR actually does.** The diff adds analysis
artifacts, a hash-pinned offline transformer, two test files, and a purely additive
change to `live-run-guard.mjs` (`--require-lock`, `lockRequiredReason`,
`sessionLockPath`/`sessionLockLabel`). No existing guard behaviour changes when the
new flag is absent — verified by the 245-test suite passing unchanged. The residual
risk is operational, not code: the two-lock contract is enforced only by the shell
the operator copy-pastes, not by any runner in the tree (F1).

## Changed surface

| File | Δ | Note |
|---|---|---|
| `analysis/apply-project86-plan-corrections.mjs` | **A** 1136 | Hash-pinned, fail-closed transformer. sha256 `bb5645af…c727`, matches the PR body. |
| `analysis/project86-fold-readiness.json` | **A** 2793 | Review report. sha256 `fe3a082c…fb76` = the pin. Added at `6b97d681`, **untouched by every later commit in the range** — byte-frozen as claimed. |
| `analysis/project86-fold-readiness.md` | **A** 883 | Prose form of the above. |
| `analysis/project86-plan-corrections-verification.md` | **A** 565 | Verification report. |
| `analysis/project86-proof-issue-plan.corrected.json` | **A** 761 | 38-row corrected plan. sha256 `b3b3a7e8…6885` = the pin. |
| `tools/k6-proofs/README.md` | **M** +18 | Lock-ownership paragraph, two-lock table, nesting example, `--require-lock` example. |
| `tools/k6-proofs/scripts/live-run-guard.mjs` | **M** +36/−8 | Additive only. |
| `…/scripts/__tests__/project86-plan-corrections-idempotence.test.mjs` | **A** 168 | 6 tests. |
| `…/scripts/__tests__/project86-plan-lock-serialization.test.mjs` | **A** 340 | 5 tests. |

## GitNexus evidence

**Unavailable — stated plainly rather than guessed.** No GitNexus MCP tools are
exposed in this session, `gitnexus` is not on `PATH`, and there is no repo-local
`.gitnexus`. `~/.gitnexus/registry.json` indexes only three `karmaterminal/openclaw`
worktrees; `karmaterminal-openclaw-docs` appears **0** times. `status`,
`detect-changes`, `impact` and `context` could not be run. All tracing below is
direct source/caller/test tracing instead.

Scoped instruction files: **none exist** — no `AGENTS.md`, `CLAUDE.md`,
`copilot-instructions.md` or `*.instructions.md` anywhere in the repo (verified by
glob and `find`). `.agents/skills/k6-proofs/SKILL.md` is the only `.agents` content.

## Commands and tallies

All from a clean worktree at `a566100d`; adversarial variants ran in an isolated
`git archive` export in `/tmp`, never in the repo. Node v22.23.1.

```bash
node --test tools/k6-proofs/scripts/__tests__/*.test.mjs   # tests 245, pass 245, fail 0  (17.5 s)
node --test tools/k6-proofs/tests/*.test.mjs               # tests  31, pass  31, fail 0  (0.08 s)
```

Both reported tallies **reproduced exactly**. `/tmp` lock-file residue after a full
run: **0** (before/after delta 0); no stray `p86-*` tmpdirs.

Repo checkers, from the repository root (they are cwd-sensitive; they fail
identically at base `abe1f9f0` when run from `tools/k6-proofs`, so this is
pre-existing and unrelated):

```bash
node tools/k6-proofs/scripts/check-proof-row-manifests.mjs   # exit 0
node tools/k6-proofs/scripts/check-manifest-scenarios.mjs    # exit 0 — 38 manifests; 35 scenario files
node tools/k6-proofs/scripts/check-scenario-alignment.mjs    # exit 0
```

JSON validity of both added data artifacts: valid. `run-proof.sh` / `run-proofs.sh`
parse clean under `bash -n` as shipped.

### Negative controls (do the tests detect the old defects?)

| Control | Mutation | Result |
|---|---|---|
| NC-1 | `live-run-guard.mjs` reverted to base `abe1f9f0` | **4 of 11 fail** (`held same-session lock`, `metadata-only form does NOT serialize`, `--require-lock escalates`, `two different rows / same session`) |
| NC-2 | `flock` wrapper stripped from `R-CD-1`'s fence only | **3 of 5 lock tests fail** |
| NC-3 | `R-OBS-1` both-forms reverted to `required` | **3 of 6 idempotence tests fail** |

Note NC-2 also fails `every serialized row holds its own manifest lock`, i.e. the
byte-level and the behavioural assertions are independent and both catch it.

### Drift sweep — every class fails closed, nothing is rewritten

13 mutations of the corrected plan, each fed back as `--plan`. **All exit 2 with
`FAIL-CLOSED`, and in every case no output file was written** (checked explicitly):
trailing newline stripped; extra trailing newline; one `--conflict-exit-code 75`→`76`;
one `--shell --require-lock`→`--json`; one lock preamble stripped; `candidate_sha`
filled in; MC-17 applied (all 419 substituted); re-serialized at indent 4; re-serialized
at indent 2; `R-OBS-1` mandate reverted; MC-03 ledger `sites` 36→18; supersession
pre-image hash blanked; a whitespace-only reindent of one line.

Control (pristine bytes) exits 0. In-place no-op with the **default** `--out` — i.e.
overwriting the committed artifact — leaves it **byte-identical** (`cmp` clean),
`input_mode: corrected-no-op`, `output_sha256 b3b3a7e8…6885`, `candidate_sha null`,
419 tokens remaining, superseded `MC-03, MC-11/R-OBS-1`, deferred `MC-17`.

### Boundary-by-boundary

| Boundary | Result | Evidence |
|---|---|---|
| MC-03 acquires real locks, not preflight | **MET** | `flock(1)` given a path + command opens, locks, then `exec`s; the fd survives `exec` uncloexec'd, so both locks are held for `run-proofs.sh`'s whole lifetime. Behaviourally: holder runs 4 s, second invocation at t=1.5 s exits **75** and its sentinel is never written. |
| Lock held *across* `run-proofs.sh` | **MET for the plan's emitted command** | `…lock-serialization.test.mjs:138-173`. See **F1** for the in-repo runner. |
| Same row / same session serializes | **MET** | exit 75, no sentinel. |
| Different row / same session serializes | **MET** | `R-CW-1` against `R-CD-1`'s session key → exit **75**, never executes. |
| Different sessions stay concurrent | **MET** | `R-CW-1` on a different session key, launched *while* the holder is live → exit **0**, executes concurrently. |
| Lock ordering cannot deadlock | **MET** | Global order (session-outer, row-inner) *and* both are `--nonblock`, so blocking is impossible in either direction. |
| Cleanup leaves no lock artifacts | **MET** | Measured: 0 files before, 0 after a full suite run. |
| R-OBS-1 satisfiable; no contradictory both-forms | **MET** | 38 rows: **19 `required` / 19 `not applicable`**, exactly one mandate each, 0 unknown values, **0 dangling siblings**. `R-OBS-1` = `not applicable`, carries no INCOMPLETE clause, names no `None` sibling. Justification is factually correct: `manifests/r-obs-1.json` has `mutates: false`, `toolSurface: typed-tool`, methods `sessions.create/send/subscribe` + `session_status` — no continuation primitive. |
| Transformer on corrected plan = byte-identical no-op | **MET** | Above. |
| Every drift class fails closed | **MET** | 13/13, above. |
| Supersession table agrees with bytes | **MET** | `sha256(report.MC-03.text)` = `411c79a7…903d` = the pin, and that text does contain `--json` and no `flock`. `sha256(report.MC-11.per_row["R-OBS-1"].text)` = `fd829ed2…a032c2` = the pin. |
| Report-vs-own distinction | **MET** | The report is byte-frozen and not in the diff; defects are *superseded* with the pre-image hash recorded in `corrections.superseded`, never rewritten. §193 of the verification report openly explains why MC-03 does not route through `run-proof.sh`. |
| Counts / hashes agree | **MET** | Ledger sums to **325** (= the PR body's claim); MC-03 = **36** (18 preambles + 18 wrappers); 18 serialized rows; 23 live-runner rows; transformer sha256 matches the PR body exactly. |
| README instructions agree with bytes | **MET, with F4** | `live-run-guard.mjs --manifest …/r-rc-2.json --shell --require-lock` runs and emits exactly the six documented variables with `caller-override`. |
| `candidate_sha` null, MC-17 deferred, 419 sites intact | **MET** | `candidate_sha: null`; `deferred["MC-17"].status: DEFERRED`; measured **381 body + 0 title + 38 subtree = 419**, matching the file's own declared counts. |
| `fold-readiness.json` byte-frozen | **MET** | Added at `6b97d681`, touched by no later commit in the range; sha256 = the pin. |
| No hidden issue/project/proof/deployment mutation | **MET** | Executable diff contains no `gh`, no GitHub API, no network, no `git` mutation; `writeFileSync` only to `args.out`; `rmSync` only on guard-computed `/tmp` lock paths and `mkdtemp` dirs. The only `gh` in the plan is 38× `gh api repos/…/contents/…?ref=…` — a read-only GET. Nothing outside `analysis/` and the two tests references the transformer or the plan; no workflow runs either. |

---

## Findings, by severity

### F1 — MEDIUM · `run-proof.sh`, the repo's only in-tree `flock` owner, never takes the new session lock, and nothing tests it

`tools/k6-proofs/run-proof.sh:29-41` (not modified by this PR):

```bash
GUARD_VARS="$(node "${SCRIPT_DIR}/scripts/live-run-guard.mjs" --manifest "${OPENCLAW_ROW_MANIFEST}" --shell)"
eval "$GUARD_VARS"
if [[ "${K6_PROOF_LOCK_REQUIRED:-0}" == "1" ]]; then
  LOCK_FD=9
  exec 9>"${K6_PROOF_LOCK_PATH}"
  if ! flock -n 9; then …
```

This PR makes the guard emit `K6_PROOF_SESSION_LOCK_PATH`, and `README.md:426-429`
establishes it as a first-class obligation ("*excludes any **other** continuation row
against that session*"). `run-proof.sh` `eval`s that variable and then ignores it. It
also never passes `--require-lock`, so an `R-RC-2`-style contract override is silently
unenforced on that path.

Consequence: on the one in-repo caller that *does* lock, two **different** continuation
rows can still run concurrently against the same target session — precisely the HIGH
defect the MC-03 supersession exists to close. Verified by grep: outside the guard
itself, `sessionLockPath` / `K6_PROOF_SESSION_LOCK_PATH` is consumed **only** by the
plan's emitted fence, the new test, the README, and the verification report. Zero
tests reference `run-proof.sh` at all.

This is disclosed, not concealed — verification report §193 explains why the plan uses
an explicit wrapper instead. But the README's new sentence "*`run-proof.sh` holds
`lockPath` on fd 9*" reads as a completeness statement when it is half the contract.

**Recommend:** either teach `run-proof.sh` the outer session lock (`exec 8>` +
`flock -n 8` before fd 9, same session-outer/row-inner order) and `--require-lock`, or
add one clause to the README stating that `run-proof.sh` implements only the row half.
**Not blocking:** the plan never invokes `run-proof.sh`.

### F2 — MEDIUM · The reviewed input plan is not committed, so the MC-01..MC-16 derivation is not reviewer-reproducible

`readOneOfPinned` (`apply-project86-plan-corrections.mjs:223-248`) accepts exactly two
SHA-256s: `af607246…4220` (original) and `b3b3a7e8…6885` (corrected). Only the second
exists in the tree — `analysis/` contains just the report and the corrected output
(hashed and confirmed). Therefore `main()`'s original-input branch, roughly lines
500-973 including **all sixteen** correction applications and their site-count
assertions, can never execute for any reviewer.

Consequence: "applied exactly as reviewed" is provable for the *output* (via hashes and
the no-op battery) but not for the *derivation*. The PR body's
`f(original) -> b3b3a7e8…6885` line cannot be reproduced. Consistent with this, the
verification report's negative test N3 states it needed a throwaway copy "with pins
relaxed" — and indeed `readPinned`'s `allowUnpinned` parameter (line 194) is never
passed `true` anywhere in shipped code, so it is dead.

**Recommend:** commit the reviewed input plan — it is not secret and its hash is already
published in three places — or state plainly in verification report §2 that the
original-input path is not reviewer-reproducible.

### F3 — LOW · No plan row states its required working directory, and the two documented conventions disagree

All **23 of 23** live-runner rows open with `node tools/k6-proofs/scripts/live-run-guard.mjs …`
(repository-root-relative) and only later contain `cd tools/k6-proofs && \`. Searching
every row body for `repo root`, `repository root`, or `working directory` returns
**none**.

`tools/k6-proofs/scripts/run-proofs.sh:6-8` documents the opposite convention:

```
#   cd tools/k6-proofs
#   ./scripts/run-proofs.sh [--dry-run] …
```

An operator following the runner's own header gets
`Cannot find module …/tools/k6-proofs/tools/k6-proofs/scripts/live-run-guard.mjs`. I hit
exactly this class of error running the repo's own checkers from `tools/k6-proofs`.
It fails closed (the `&&` chain stops before `run-proofs.sh`), so it is a usability
defect, not a safety one. Related: because the fence `cd`s, a second attempt in the same
shell fails the same way.

**Recommend:** one line — "Run from the repository root." — in the fence preamble.

### F4 — LOW · The README's new nesting example is not runnable as written

`tools/k6-proofs/README.md:431-437` presents

```bash
flock --nonblock --conflict-exit-code 75 "$K6_PROOF_SESSION_LOCK_PATH" \
  flock --nonblock --conflict-exit-code 75 "$K6_PROOF_LOCK_PATH" \
    ./scripts/run-proofs.sh --live <ROW> <SHA>
```

with no preceding guard call or `eval`, so both variables are unset. Verified: exit
**66**, `flock: cannot open lock file : No such file or directory`. Fails closed, but it
is offered as *the* caller recipe. Add the `--shell` guard invocation and `eval` (as the
plan fence does).

### F5 — LOW · `EXPECTED.serialized_after_contract_override: 20` is dead and contradicts the enforced count

`apply-project86-plan-corrections.mjs:62`, referenced nowhere else in the file. The
enforced serialized count is **18** (`gateway_serialized_needing_guard`, asserted at
lines 441-443 and confirmed by measurement). 20 is the number of *non*-serialized rows
(38 − 18) — which is how verification report §227 uses it — and it is also 18 + the two
fixture-serialized rows `R-CW-5`/`R-CW-6`. Under the name's obvious reading it is simply
wrong, and it sits in a block a reader will treat as the contract. Delete it, or rename
and actually assert it.

### F6 — LOW · The corrected plan's own note misattributes the 348 → 419 placeholder growth

`corrections.deferred["MC-17"].note` says "*MC-04, MC-05, MC-06 and MC-14 add further
sites*". Reconciling exactly from the frozen report payloads:

```
348  reviewed pre-correction total
−23  MC-01   (find carries 2 tokens, replace 1) × 23 live-runner rows
+38  MC-04   1 token × 38 rows
+ 0  MC-05   net zero — a path rewrite, not an addition
+ 3  MC-06   1 token × 3 support rows
+35  MC-14   +38, less the 1 token in the corpus-only checklist line dropped for 3 support rows
+18  MC-03   the SUPERSESSION preamble's OPENCLAW_CANDIDATE_SHA=<FINAL_CANDIDATE_SHA>, × 18 serialized rows
────
419  ✔ matches the measured 381 body + 38 subtree
```

So the note credits MC-05 (contributes nothing), omits MC-01 (−23), and omits MC-03
(+18, the second-largest contributor). The PR body gets this right — "*401 at `ca3034dd`;
the lock preamble binds `OPENCLAW_CANDIDATE_SHA` …, adding one site per serialized row*"
— the committed artifact does not. The number **419** itself is correct and
post-condition-enforced.

### F7 — INFORMATIONAL · `node --test` now executes shell derived from a committed JSON data file

`project86-plan-lock-serialization.test.mjs:60-84` `bash -c`'s the `R-CD-1` and `R-CW-1`
fences taken verbatim from the plan. The mitigations are real and adequate:
`./scripts/run-proofs.sh` is replaced by a stub and its absence asserted (line 66), every
placeholder must resolve (line 67), and the guard is genuinely read-only (`eval` of its
`--shell` output is injection-safe — see below). But the substitution allow-list is a
single literal: a future row fence that gained a second real command (a bare `k6 run`,
say) would execute for real during an ordinary `node --test`. Worth hardening with an
assertion that the instantiated script's command set is a subset of
`{command, node …live-run-guard.mjs, eval, [, cd, flock, <stub>}`.

Injection check, for the record — `shellQuote` (`live-run-guard.mjs:63-65`) is correct
single-quote escaping. Session keys `a$(touch /tmp/P86_PWNED)b`, `` a`id`b ``, `a'b` and
`a b` all round-trip through `eval` as literal text; no file was created, no command ran.

### F8 — INFORMATIONAL · Predictable lock paths in a world-writable directory

`/tmp/openclaw-k6-proof-<24hex>.lock` and `/tmp/openclaw-k6-session-<24hex>.lock` are
derived from a SHA-256 of public inputs, so on a shared host another user can pre-create
them (mode 000 → DoS) or plant a symlink, which `flock` follows. Pre-existing —
`run-proof.sh` already did this — but the session lock slightly widens the blast radius
(one path per *session* rather than per row+session, so a single squatted file can block
every row on that session). Consider `${XDG_RUNTIME_DIR:-/tmp}`.

### F9 — INFORMATIONAL · The timing-based tests assume a reasonably fast host

`sleep(1500)` before asserting the holder owns the lock, with `HOLD_SECONDS=4`. Measured
guard-plus-`flock` latency to the runner on this host: **46, 51, 48 ms** — roughly a 30×
margin, so this is not flaky today. Noted only because under heavy load or a cold FS
cache the suite would fail spuriously rather than report a real defect.

---

## Uncertainties

- **GitNexus** could not be consulted (see above). Impact analysis is therefore from
  direct grep/read tracing; I consider the changed surface small enough that this is not
  a material gap.
- **The `reviewed-original` transform path was never executed** by me or, so far as the
  repo permits, by anyone else reviewing it (F2). Its correctness rests on reading the
  code plus the fact that its output passes the full post-condition battery.
- **The standing dispatch policy's full-suite runner, `node scripts/test-projects.mjs`,
  does not exist in this repository** — there is no `package.json` and no top-level
  `scripts/` (that command belongs to `karmaterminal/openclaw`). I used the repo's own
  documented suites, both of them in full, never a hand-picked subset.
- I did not run any k6 proof row, and could not: `k6` and a live gateway are not present.
  All lock behaviour was proven with the runner stubbed, which is exactly how the PR's own
  tests are designed.

## Exact commands

```bash
# identity
git cat-file -t abe1f9f0749d849b01da4e5d354c205ecffac946
git merge-base abe1f9f0749d849b01da4e5d354c205ecffac946 a566100da92a87a7fa61d5d742a745f5964d4dbf
git --no-pager diff --name-status abe1f9f0 a566100d
gh pr view 452 --json baseRefOid,headRefOid,body

# reported suites (from the repository root)
node --test tools/k6-proofs/scripts/__tests__/*.test.mjs      # 245/245
node --test tools/k6-proofs/tests/*.test.mjs                  #  31/31

# repo checkers (from the repository root)
node tools/k6-proofs/scripts/check-proof-row-manifests.mjs
node tools/k6-proofs/scripts/check-manifest-scenarios.mjs
node tools/k6-proofs/scripts/check-scenario-alignment.mjs

# hashes
sha256sum analysis/project86-fold-readiness.json \
          analysis/project86-proof-issue-plan.corrected.json \
          analysis/apply-project86-plan-corrections.mjs

# byte-identical no-op (in an isolated export, not the repo)
git archive a566100d | tar -x -C /tmp/p86-nc
cd /tmp/p86-nc && node analysis/apply-project86-plan-corrections.mjs \
  --plan analysis/project86-proof-issue-plan.corrected.json --stdout-summary
cmp analysis/project86-proof-issue-plan.corrected.json <pristine copy>

# negative controls (isolated export only)
git show abe1f9f0:tools/k6-proofs/scripts/live-run-guard.mjs > /tmp/p86-nc/tools/k6-proofs/scripts/live-run-guard.mjs
cd /tmp/p86-nc && node --test tools/k6-proofs/scripts/__tests__/project86-plan-*.test.mjs

# README example
OPENCLAW_GATEWAY_TOKEN=… OPENCLAW_CANDIDATE_SHA=… OPENCLAW_SESSION_KEY=… \
  node tools/k6-proofs/scripts/live-run-guard.mjs \
    --manifest tools/k6-proofs/manifests/r-rc-2.json --shell --require-lock
```

All scratch artifacts under `/tmp` were removed; `/tmp` holds no `openclaw-k6-*.lock`
and no `p86-*` residue.
