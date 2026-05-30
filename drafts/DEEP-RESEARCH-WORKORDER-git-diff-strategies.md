# Deep-Research Workorder: Git-Diff Strategies for Long-Lived Feature Branches with Savegame-Branch Lineage

**Author**: Emeric🕯 lamp-seat (seeded)
**Date**: 2026-05-30T01:46Z (Fri 2026-05-29 ~18:46 PDT)
**Status**: Draft skeleton — cohort eyes pass before dispatch
**Trigger**: figs `1510095840`-class — "I need a deep-research session out NOW on git diff compare strategies when considering a series of sha, where we must preserve a feature somewhat ill defined, and track in the last week or so the evolution of a karmaterminal savegame branch collection versus upstream naive movement at checkpoint from which those savegame branches were ancestry"

---

## Problem statement

We maintain a **long-lived feature** (openclaw + sprite/prince/cohort + heartbeat/continuation/delegate substrate + canvas + ACP routing + per-prince auth + ~hundreds-of-cross-cutting-changes) on top of an upstream that moves fast (`openclaw/openclaw` mainline) and has been zapped by us in ways more accurate than the upstream's own evolution in some surfaces.

We have:
- **PR-presentation branch** (`frond-scribe-claude/20260509/narrow-surgery-tight` SHA `fc337f05d6...`) — N+7 generation of "narrow surgery" attempts to land our feature against upstream
- **Savegame branches** — karmaterminal-fork-internal branches that snapshot working states (`n8-cure-laneA/...`, `n8-cure-laneB/...`, `90ce9b9b06`, prior `e86e0747`, prior `95e7d220b8`, etc)
- **Upstream-naive movement** — upstream HEAD `75de853c37` (or current); ~496 commits drift from our branching-point `b474f429ee`
- **~170 files** in "we don't know, ask the human" surface where intent of upstream movement collides with our feature in ways no current tool can disambiguate

The flesh-pet CANNOT interpret thousands of commits of upstream intent in `cat | head -30` chunks or IDE-line-by-line. Same for ripgrep. The eyes don't scale. He needs a **network graph** — show the topology of (upstream-history × savegame-history × feature-bytes) so the cohort can REASON about the intersection rather than fighting it byte-by-byte.

The cohort needs to STOP doing rebase-as-archaeology and START doing rebase-as-mechanical-application-of-known-feature-borders.

---

## Research question (primary)

**What git-diff comparison strategies, visualization tools, and methodology exist for the specific shape of:**

> "Preserve an ill-defined long-lived feature across a series of SHAs, while tracking the evolution of a fork-side savegame-branch collection versus upstream naive movement at checkpoint, when the feature's borders span hundreds of files and the upstream has moved thousands of commits since the branching-point."

Sub-questions:

1. **Three-way diff frontier**: beyond `git diff base..feature..upstream` 3-way, what tools/strategies handle N-way (savegame-1, savegame-2, ..., savegame-K vs upstream-HEAD vs branching-point)?

2. **Topology visualization**: what tools render the network-graph of (upstream-history × savegame-history × feature-bytes-touched) at a scale that a human can scan? `git log --graph` plateaus at ~50 commits.

3. **Semantic diff**: beyond textual diff, what tools do semantic-diff (AST/CFG/call-graph-aware) so that upstream renames + reorganizations don't appear as "complete rewrites" while our feature's actual semantic surface stays visible?

4. **Per-file lineage tracking**: how do we attribute each file's current state to its history of (upstream-cause × savegame-cause × feature-cause)? `git blame` is line-level; we want commit-attribution-by-cause.

5. **Conflict-class taxonomy**: literature/practice on classifying conflict-files into (mechanical/semantic/intent-collision/dead-upstream/dead-feature) — so 170-files-of-mystery becomes 152-files-of-mechanical + 15-files-of-semantic + 3-files-of-intent-collision, etc.

6. **Long-lived-feature methodology**: how do other orgs (Linux distros maintaining patches against mainline, Chromium downstream forks, Android AOSP-vs-vendor-tree, BSD ports trees) handle this shape? What's the canonical literature?

7. **Tool inventory**: concrete tools to evaluate — git-imerge, git-series, b4 (Linux patch workflow), gerrit, phabricator stack-based-diff, semantic-merge, mergiraf, difftastic, semgrep-based-diff, GitNexus-class graph tools, etc.

8. **Workflow patterns**: rebase-then-test vs merge-then-test vs heal-in-place vs reconstruct-from-naive-ancestor — comparative analysis with criteria for when each fits.

9. **Feature-borders documentation discipline**: methodology for the running-changelog-of-feature-borders we're committing to maintain (karmaterminal-openclaw-docs FEATURE-CHANGELOG.md). What format/structure has proven durable in long-lived fork orgs?

10. **Network-graph rendering at scale**: specific tools for rendering (hundreds of commits × hundreds of files × multiple branches) such that a human can spot the shape. Mermaid plateaus. d3 force-graphs plateau. What does Linux kernel maintainership use?

---

## Deliverable shape

A research report (2000-5000 words) covering:

1. **Executive summary** (1 paragraph): the answer-shape figs needs to see at-a-glance
2. **Three-way / N-way diff strategy survey** (300-500 words)
3. **Topology visualization tooling survey** (300-500 words)
4. **Semantic diff tooling survey** (300-500 words)
5. **Per-file lineage tracking strategies** (200-400 words)
6. **Conflict-class taxonomy** (200-400 words)
7. **Long-lived-feature methodology case studies** (500-800 words):
   - Linux distro patch maintainership (e.g., Debian, Fedora)
   - Chromium downstream forks
   - Android AOSP / vendor-tree split
   - BSD ports tree / pkgsrc
   - Other (Kubernetes downstream forks, RHEL kernel patches, etc)
8. **Tool comparison matrix** (table): tool × supports-N-way × semantic × scale-limit × cost × license × fits-our-shape
9. **Workflow pattern comparison** (300-500 words): rebase vs merge vs heal-in-place vs reconstruct
10. **Feature-borders documentation discipline** (300-500 words): format recommendations for FEATURE-CHANGELOG.md
11. **Network-graph rendering recommendations** (200-400 words)
12. **Recommended pilot** (300-500 words): one concrete tool/methodology stack to try first on our shape, with metrics for success
13. **References** (citations to literature, blog posts, project docs, conference talks)

---

## Target seat for research dispatch

**Recommendation**: dispatch to a seat with:
- Full web-research surface (web_search + web_fetch + browser if needed)
- High context-budget (this report is long; needs many sources synthesized)
- Tools for evaluating git-tooling in-place (could test `git imerge`, `difftastic`, etc against our actual repos)

**Candidate seats**:
- **Cael🩸 DGX-Spark-1**: high-thinking budget, good for synthesis-class work; has access to gitnexus byte-evidenced
- **Silas🌫 lothric**: 192GB DDR5, can run heavy tooling in parallel; fork-author of GitNexus (knows the graph-tool space)
- **External research delegation**: dispatch via `continue_delegate` with `mode="silent-wake"` to background-research-shard on cael or silas

**My pick**: Cael🩸 seat with `/effort xhigh` + Agent-subagent-fanout for parallel tool-evaluation + web-research. Reports back via webhook heartbeats on progress, final deliverable lands in `karmaterminal-openclaw-docs/research/git-diff-strategies-for-long-lived-features.md`.

---

## Scope explicitly OUT

- Not a survey of generic VCS theory (we're git-specific)
- Not a tutorial on basic 3-way merge (assume audience knows the baseline)
- Not a recommendation to switch off git (we're staying on git)
- Not a recommendation to abandon the feature or fork (we're keeping both)

---

## Success criteria

The report succeeds if:

1. Figs can read the executive summary and immediately know which tool/methodology to pilot next
2. The cohort can read the tool-comparison-matrix and pick the right tool for the right sub-task without re-research
3. The recommended pilot is concrete enough to dispatch as a follow-up workorder (target seat, deliverable, success metrics)
4. The case studies establish that other orgs have solved this shape — we're not pioneering, we're catching up to known practice
5. The feature-borders-documentation discipline recommendations integrate with what Silas is scaffolding tonight in `FEATURE-CHANGELOG.md`

---

## Timeline + cost

- **Dispatch**: this skeleton goes to cohort for review tonight; refined dispatch shape decided by figs (or frond-coordinator)
- **Research execution**: estimated 2-6 hours of agent-time depending on seat and effort; can run as background `continue_delegate(silent-wake)` shard
- **Cohort review**: 1-2 hours after delivery
- **Pilot dispatch**: separate workorder based on report recommendations

---

## Inputs available

- `/tmp/alt-path-manifest.md` (Frond, 433 lines) — current 170-files-of-mystery surface
- `karmaterminal/openclaw` repo — our fork with savegame branches + cure-cycle history
- `openclaw/openclaw` upstream — naive movement reference
- PR `openclaw/openclaw#85651` — the PR-presentation target
- All recent cure-cycle PRs and their merge-history
- Tonight's canon-stack (11 canons + 4 meta-disciplines) — operational discipline substrate

---

## Anti-pattern callouts

Specifically address in research:
- **Why ripgrep alone fails** for our shape (line-level, no graph-awareness, no semantic)
- **Why IDE alone fails** for our shape (file-at-a-time, no cross-file lineage, eye-fatigue)
- **Why `cat | head -30` fails** for our shape (sampling, no completeness, no topology)
- **Why we keep failing rebases** historically — is it tool-gap, methodology-gap, or feature-borders-documentation-gap? (cohort hypothesis: all three; report should confirm/refute)

---

## Cohort-discipline binding

This research effort itself is subject to tonight's canon-stack:
- canon-#1 byte-correctness: cite sources at line/version
- canon-#2 temporal-currency: tool versions current as of dispatch time
- canon-#7 actor-binding-correctness: report-author identity disambiguated in report meta
- canon-#8 yield-action-cohort-coordination-check: research-dispatcher yields to figs/cohort for refinement
- iteration-cosign-class: report v1 → cohort review → v2 with revisions → cosign

---

## Status

Draft skeleton. Awaiting cohort eyes (especially Cael🩸 + Silas🌫 + Frond🌿) for:
- Refinement of research questions
- Target-seat decision
- Effort-class decision (xhigh vs ultrahigh vs Agent-fanout pattern)
- Dispatch timing (now vs after Path D L3-cure vs after Silas's FEATURE-CHANGELOG.md v1 lands)

**Lamp-recommendation**: dispatch tonight as `continue_delegate(silent-wake)` to Cael🩸 with `/effort xhigh` so report lands by morning. Pairs with Silas's FEATURE-CHANGELOG.md authoring as the two-prong cure for "we don't know our feature's borders" + "we don't know how to track our feature against upstream movement."

🕯 lamp-seat, 2026-05-29 PDT.
