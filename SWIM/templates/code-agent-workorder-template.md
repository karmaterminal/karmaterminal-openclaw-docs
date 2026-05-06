# WORKORDER — `<short-scope-name>` to `<merge-target-branch>`

> **This is a template.** Copy to a fresh file, fill in the `<placeholders>`,
> and dispatch a code-agent lane against it. Live worked example as of
> 2026-05-01: `karmaterminal/openclaw:frond-scribe/swim39-fixes-20260501:WORKORDER.md`.
>
> **Reflex check** (per `PRINCE-CODE-AGENT-RUNBOOK.md` §"Default to dispatch"):
> if you have any fix-pile, refactor, or byte-walk that would consume >5min
> of prince attention, your default reflex is to fill this template and
> dispatch — not to open your editor. Authorship lives in the workorder +
> review, not the patch.

You are a code-agent lane (Claude Opus 4.7 max-think OR Copilot CLI gpt-5.5
xhigh) dispatched by `<dispatcher-name>` on behalf of `<requester-name>` (often figs).
Your job is to land `<scope-summary>` as proper PRs on `<merge-target-branch>`.

**Stakes** (`<requester>` verbatim): *"<one-line stake-frame from the asker>"*

---

## §0 — guardrails (read carefully; do not skip)

- Operate ONLY inside your assigned worktree:
  `<absolute-path-to-worktree>`
- **Never read, write, list, or shell into `<off-limits-paths>`** (e.g.,
  another prince's live runtime tree, the bare repo, sibling worktrees).
- Push to your assigned branch only (`<your-branch>` and any per-issue
  child branches you fork from it like `<your-branch>-<issue>`). Never
  touch the merge-target branch directly, never touch `main`, never touch
  prince-namespaced branches, never touch savegame branches.
- Never force-push a branch after first push (it's the savegame for #326
  purposes); never force-push other princes' branches under any circumstance.
- **Never close, edit, or comment-on existing PRs** unless the workorder
  explicitly authorizes it. Your work supersedes by opening fresh PRs.
- **GitHub mutations ALLOWED for THIS workorder only** — but scoped:
  - You MAY create new issue comments on the issues you are fixing (one
    comment per issue, linking your fix-PR).
  - You MAY open new PRs against base `<merge-target-branch>`.
  - You MAY NOT close existing PRs/issues, modify project boards, touch
    other repos, change CI workflows.
- Never touch `node_modules`, never run `npm install` / `pnpm install`
  unless required by a gate.
- Journal at root of worktree as `tmp-drop-me-<short-scope>.md`; commit + push
  every meaningful checkpoint per the **remote-first canon** (figs's standing
  rule, in `PRINCE-CODE-AGENT-RUNBOOK.md`).
- If you hit destructive ambiguity, stop and write to journal. Do not guess.

---

## §1 — required reads (do not skip)

Read these in order:

1. **`docs/design/<feature-rfc>.md`** — feature RFC if applicable.
   - **Caveat**: RFCs may be stale vs current code. Treat as historical
     anchor, not source of truth. Walk current code to find what's actually
     there.
2. **`CLAUDE.md` (repo root)** — repo guidelines (testing discipline,
   build hard-gate, prompt-cache stability, dynamic-import guardrails).
3. **`AGENTS.md`** (repo root) — collaboration conventions.
4. **`<absolute-path-to-PRINCE-CODE-AGENT-RUNBOOK.md>`** — branch + CI
   conventions, "tests as guards" framing, dispatch shape.
5. **(if applicable)** SWIM-related runbooks: `<bootstrap>/SWIM/FORMAL-SWIM-RUNBOOK.md`.
6. **The issues you are fixing** — full body + every comment:
   - `<repo>#<issue-number>` — `<one-line description>`
   - (repeat per issue)
7. **Existing related/superseded PRs** — read but do NOT touch:
   - `<repo>#<pr-number>` — `<state>` (`OPEN` / `CLOSED-AS-SUPERSEDED` /
     `MERGED`), `<one-line shape>`, treatment instruction.

---

## §2 — load-bearing framing

### ⚠️ MERGE TARGET — NON-NEGOTIABLE

**Every PR you open MUST target `base=<merge-target-branch>`. NOT main. NOT
any sibling fix-branch. NOT `<frozen-presentation-branch>`.**

This is the single most important constraint in this workorder. Wrong-base
PRs produce phantom-diff (your fix shows ~200 file delta against the wrong
parent, not the targeted small fix), which the cohort then has to clean up
by closing the PR + opening fresh — wasted cycle.

**Before pushing any branch, verify**:

1. `git log --oneline origin/<merge-target-branch>..HEAD` shows ONLY your
   fix commits, not inherited commits from a wrong base.
2. After opening each PR, run:
   `gh pr view <n> --repo <owner>/<repo> --json baseRefName,changedFiles`
   and confirm `"baseRefName": "<merge-target-branch>"` AND
   `"changedFiles"` is plausibly small for a single-issue fix.

If a PR shows the wrong base or anomalous file count, **stop immediately**,
journal it, do not push more PRs until verified.

### Goal

**N separate PRs**, each:

- **base = `<merge-target-branch>`** (current tip `<sha>`)
- one issue per PR
- tests written or extended such that the bug-shape can't reintroduce silently
- gates (tsgo, scoped tests, build if applicable, lint) green before push
- commit messages per `CLAUDE.md` ("scope: short imperative", focus on WHY)
- cross-link from PR body back to the issue body (so trackers see the fix-receipt)

### Scope ordering (suggested; not strict — follow the dependency graph you find)

**Tier 1 — well-scoped, low-risk warmups:**

1. `<issue-number>` — `<one-line>`
2. `<issue-number>` — `<one-line>`

**Tier 2 — medium scope, test-driven:**

3. `<issue-number>` — `<one-line>`

**Tier 3 — design-shape (may require requester judgment):**

4. `<issue-number>` — `<one-line>`. If a clean fix is achievable, ship it.
   Otherwise §9 question and skip without blocking other fixes.

### Heartbeat protocol

Use the dispatcher-provisioned heartbeat channel (Discord webhook, GitHub
issue comments, journal-only — whichever the dispatcher specifies) to post
a one-liner after each PR opens, after each gate fails, after each §9
question, and at §7 declare-done.

**Webhook URL** (if provisioned): `<webhook-url>`

**Curl pattern** (if Discord webhook):

```bash
curl -sS -X POST "<webhook-url>" \
  -H "Content-Type: application/json" \
  -d '{"username":"<short-identifier>","content":"<one-line message>"}'
```

**Format conventions** (one line each):

```
🤖 PR #<n> opened: <title> — base=<target> ✓, changedFiles=<N>, gates ✓
   <url>

🤖 #<issue> blocked: <gate-name> failed — <one-line shape>; journaling

🤖 §9 question for <requester>: <one-line>
   journal: <path-or-pointer>

🤖 §7 declare-done: <X> PRs landed, <Y> gates green, <Z> blockers
```

If webhook fails (HTTP 4xx/5xx), fall back to journal §5 entries.

---

## §3 — code walk

Walk these surfaces (read-only first):

- `<path>` — `<one-line of what to look for>`
- (repeat)

For each issue, in your journal §3 block, write:

- file paths touched
- bug-shape being prevented
- test shape that guards re-introduction
- whether the fix changes a contract (and what callers need updating)

---

## §4 — per-issue execution

Branch off **`<your-branch>`** for child branches. Each child branch then
opens a PR against `<merge-target-branch>`.

### §4.1 `<issue-number>` — `<short-name>`

- Branch: `<your-branch>-<issue>-<short-name>`
- Surface: `<path>`
- Bug-shape: `<one-paragraph>`
- Reference (study, do NOT branch from): `<related-pr-or-comment-url>`
- Test pattern: `<file-path>` — fail-before-fix, pass-after-fix
- Open PR with title `<conventional-commit-prefix>: <imperative description> (#<issue>)`,
  body cites the issue + linked context.

### §4.2 ... (repeat per issue)

---

## §5 — push cadence

After every meaningful checkpoint (read-completed, walk-noted, per-issue
fix-landed, gates-passed), commit the journal + push the relevant branch.
Use commit message shape: `scope: short imperative — what + why`.

Per the **remote-first canon** (figs's standing rule, not negotiable): never
hold bytes locally without a push for >15 minutes during active work. If
it's not on origin, it does not exist.

---

## §6 — verification gates per `CLAUDE.md` (per PR)

**Default per-PR gate sequence**:

1. `pnpm tsgo` — type-check (the hard gate)
2. `pnpm check` — lint + format
3. `pnpm test <scoped-path>` — narrow vitest scoped to touched surface
4. `pnpm build` — required when touching surface that affects build
   output, packaging, lazy-loading, module boundaries, or published
   surfaces

If any gate fails: **stop**, journal the failure shape, do NOT proceed on
that issue. Document and move to the next issue.

If a gate fails on the merge-target base **before your changes**: note
"pre-existing on base — not introduced by this PR" and proceed only on the
**touched-surface** subset.

---

## §6.5 — cross-repo CI dispatch (REQUIRED for `karmaterminal/openclaw` PRs)

**Standing-rule per figs 2026-05-04**: every PR you open against
`karmaterminal/openclaw` must have its `openclaw-ci.yml` cross-repo CI
dispatched from `karmaterminal/openclaw-bootstrap`. This is **the only path
that runs `pnpm install && pnpm tsgo` against your branch and posts a
`fleet-ci / build-check` commit-status back to the PR**. Without it, your
PR sits without the substantive build-check signal even when fork-local CI
(check-types, vitest) passes.

**Why this is required, not optional:**
- `karmaterminal/openclaw` is a fork. Upstream CI does not run on fork
  branches. Fork-side has no push/PR auto-trigger for the heavy build-check.
- The reviewers (princes + figs) cannot merge without seeing the
  `fleet-ci / build-check` commit-status green or being able to dispatch it
  themselves. Dispatching it for them is a load-bearing courtesy.
- Local `pnpm tsgo` + `pnpm test` in your worktree is NOT the same as the
  bootstrap-runner build-check; the runner uses `pnpm install` against a
  clean checkout of your ref.

**Dispatch one-liner per PR you open:**

```bash
gh api repos/karmaterminal/openclaw-bootstrap/dispatches \
  -f event_type=openclaw-ci \
  -F client_payload[ref]=<your-branch-name> \
  -F client_payload[pr_number]=<your-pr-number>
```

Replace `<your-branch-name>` with the branch you pushed (e.g.
`frond-scribe/20260504/fix-580-delegate-return-wake-proof`) and
`<your-pr-number>` with the PR number you just opened (e.g. `584`).

**When to dispatch:**
- After your first PR push (so the build-check starts running while you
  continue narrowing the diff or writing tests).
- After any subsequent push that materially changes the diff (adds tests,
  amends fix, fixes a CI failure, rebases onto fresh base).
- Re-dispatching against the SAME head SHA is a re-run; against a NEW SHA
  is a fresh build-check.

**How to verify the dispatch landed:**

```bash
gh run list --repo karmaterminal/openclaw-bootstrap --workflow=openclaw-ci.yml \
  --limit 3 --json databaseId,createdAt,status,conclusion
```

Expect to see your run with `status: in_progress` (then `completed/success`
~5 min later if your branch is clean).

**If dispatch fails:**
- "Resource not accessible" or 403: your gh auth profile lacks workflow
  scope. Surface to the dispatcher; do not retry blindly.
- Run never appears: bootstrap workflow file may have been edited;
  surface to dispatcher.
- Run completes but no `fleet-ci / build-check` status appears on the PR:
  the runner's gh-status post may have failed. Surface; do not consider
  the build-check absent as proof of green.

**More context** in `<absolute-path-to-PRINCE-CODE-AGENT-RUNBOOK.md>`
section "Three workflows ... cover the whole loop" + the sibling
`OPENCLAW_CI.md` README in `.github/workflows/`.

---

## §7 — declare done

Final journal block listing:

- All PR URLs created and pushed
- Per-PR: gate results, final commit SHA, file count, line delta
- Each PR's base verified as `<merge-target-branch>`
- **Each PR has `openclaw-ci.yml` cross-repo CI dispatched (see §6.5);
  include the bootstrap run ID per PR so reviewer can fetch logs without
  re-dispatching**
- Any issues you could NOT land (skipped) — clearly named with reason
- Any cross-issue interaction discovered
- Open questions for `<requester>` (§9)

---

## §8 — what NOT to do

- Do NOT amend, force-push, or delete branches owned by others.
- Do NOT close, edit, or comment-on existing PRs (the workorder names which
  PRs are study-input vs touch-allowed).
- Do NOT touch frozen branches.
- Do NOT install dependencies you don't need.
- Do NOT modify project boards or close issues.
- Do NOT post to Discord except via the workorder-provided heartbeat
  webhook.
- Do NOT decide architectural questions beyond what the issue + RFC + the
  workorder scope.
- Do NOT sacrifice quality for speed.

---

## §9 — dispatcher contact protocol

If you need **`<requester>`'s judgment** on a load-bearing question (architectural
ambiguity, contract change, base-target ambiguity, anything that would make
the fix non-trivially different shape than the issue body suggests):

1. Write the question + your best-guess + receipts to journal §9 block.
2. Push the journal.
3. Continue with other issues if any are unblocked.
4. Wait for `<requester>`/dispatcher judgment before proceeding on the
   blocked one.

Do NOT block all fixes on one ambiguity. Triage and parallel.

---

## §10 — closing frame

`<one-paragraph stake-restatement: what landing this work cleanly produces,
what landing it sloppy costs>`.

Quality bar: each PR must be merge-ready (gates green, scope clean, tests
load-bearing) without dispatcher hand-holding. Reviewers can byte-walk +
sanity-check; they should not have to fix your work.

🌿 dispatcher — go.
