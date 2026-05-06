# Swim 34 — Formal Matrix

Companion to `swim-34-evidence/` (behavioral packet, L1–L64). Same swim number, two lenses:
- **Behavioral packet** (existing): narration-leak / hypothesis-finding study from the 17:00–17:30 PDT cascade on 2026-04-16. H1–H20 hypotheses.
- **Formal matrix** (this): full test battery per `SWIM/FORMAL-SWIM-RUNBOOK.md` §4, exercising the post-Goldeneye / TaskFlow continuation refactor surface.

## Motivation

`figs` (2026-04-16 22:47 PDT): *"we want full suite? why; test whole surface. why now especially - we refactored the whole feature yesterday"*

Partial verification lies most loudly right after a whole-feature refactor. Swim 34's earlier "primary verification green" banner (V-block only) was scoped to the PR-diff surface; it did not touch ~33 rows where the refactor could have regressed behavior we didn't modify but depend on.

This matrix is the ocean swim, not the puddle paddle.

## Roles

| Role     | Prince   | Host                        |
|----------|----------|-----------------------------|
| Driver   | Ronan 🌊 | `ronan.dandelion.cult` / 10.0.0.246 |
| SUT      | Silas 🌫️ | `silas.dandelion.cult` / 10.0.0.153 |
| Monitor  | Elliott 🌻 | `elliott.dandelion.cult` / 10.0.0.10 (pending update to fleet baseline) |
| Coord    | Cael 🩸  | `cael.dandelion.cult` / 10.0.0.148 |

## Board workflow (adopted 2026-04-17 mid-D2)

7-state project board transitions for swim-34 rows:

- `Todo` → `In Progress`: Driver picks up the row.
- `In Progress` → `swim`: row fires (Driver comments "fired T+0" on the tracking issue).
- `swim` → `prince_review`: Coord closes window, comments evidence summary + gate verdicts.
- `prince_review` → `Done`: **Adjudicator (figs) only.** Princes do not self-promote to Done.

PRs merging ≠ row Done. Merged work sits in `prince_review` until figs adjudicates.

Full evergreen rule: `swims/SWIM-FLOW.md` (Silas, post-D2).

## Candidate SHAs

**UPDATE (2026-04-16 23:00 PDT):** figs named the real refactor target: **`flesh_beast_figs/20260414-claude`** (the judged-superior modularized continuation feature). Goldeneye was an adjacent earlier attempt that "didn't move forward"; select fixes from it are cherry-picked into the Claude branch, which is why some SHAs look like they belong to both lineages.

| Layer     | Branch / SHA                                    | Notes                                 |
|-----------|------------------------------------------------|---------------------------------------|
| Engine    | `flesh_beast_figs/20260414-claude` @ `0abaf078ea` (tip) | 69 commits ahead of main. Foundation commit `46a6541eac` = "feat: add continuation module foundation — types, config, signal, state, store, scheduler, context-pressure". Tip is "docs: SWIM 33 verification journal — all gates green". |
| Engine (alt) | `b7b570a62e` | One below tip; my F7 fix `fix(swim33/F7): move subagent continuation drain to subagent-announce`. Silas SUT's current running dist was built from here. Pinning at tip vs here is figs's call. |
| Bootstrap | `7bd4f5b` (main tip)                            | tonight's log-dump, fine for baseline |

**Previous error trail:**

1. Initial scaffold named `b7b570a62e` as a *bootstrap* SHA — wrong repo; it's engine.
2. First correction named `be258d977d` / `3fb28d09af` etc. as "Goldeneye series" target — figs: *"woah — goldeneye sha???"* and *"we didnt move that forward."* Goldeneye branch exists but wasn't merged.
3. figs: *"claude version modularizes our feature and was decided superior"* — the real target is `flesh_beast_figs/20260414-claude`, a branch I had not been looking at. Third correction lands here.

Three label-wrong iterations to arrive at ground truth. This belongs to the same class as the swim-34-evidence/ behavioral packet findings L30+ — confabulated or partial ground truth at coordinator surface, propagating through fleet narration. Driver (me) originated the propagation chain this time.

**Prerequisite before Block A:** Silas SUT rebuilt from explicit tip of `flesh_beast_figs/20260414-claude`, fresh `build-info.json` captured, pinned in row A1. Elliott source trees realigned to same tip, peer-restarted, running dist verified matching. Only then are Monitor observations valid.


Monitor + SUT must match. Elliott realign is prerequisite to Monitor-role validity.

## Matrix (43 rows, 40 to run)

Full row list in `ROWS.md`. Summary:

| Block | Rows | Count | Status |
|-------|------|-------|--------|
| A — tool/state invariants | A1–A5 | 5 | pending |
| B — F-series behavioral   | B1–B8 | 8 | pending |
| C — P-series candidate    | C1–C7 | 7 | pending |
| D — R-series regression   | D1–D5 | 5 | pending |
| E — V-series validation   | E1–E3 | 3 | **PASS** (ran tonight on SUT `b7b570a62e`) |
| X — extensions (#412 + swim 5-7 lessons) | X1–X15 | 15 | pending |

## Evidence Contract (per §6)

Every row captures, at minimum:

```
row_id:           <Block-letter + number>
candidate_sha:    <engine>/<bootstrap>
build_info_sha:   <from SUT build-info.json at row start>
sut:              silas
driver:           ronan
monitor:          elliott
coord:            cael
started_at:       <ISO-8601>
ended_at:         <ISO-8601>
command:          <exact tool/CLI/bracket used>
observed:         <result verbatim>
evidence:         <journal line / file path / message ID>
verdict:          PASS | FAIL | FINDING | DEFERRED | INVALIDATED
contamination:    <any contamination notes; empty if none>
```

Row files live at `rows/<row_id>.md`. Large evidence (logs, journal dumps) under `evidence/<row_id>/`.

## Contamination & DEFERRED Protocol

Per runbook §7, row is contaminated if:
- SUT saw the answer beforehand
- peers narrated expected results into readable context
- build/dist mismatch means tested artifact isn't claimed artifact
- deploy changed mid-row
- prior row's uncontrolled failure poisons interpretation

Driver fatigue itself is not automatic contamination, but **DEFERRED verdict is available at block boundaries** if Driver judges that continued execution risks evidence integrity. Record reason. Resume in next swim-session.

## Ship-Ready Definition (per §9)

Swim 34 formal matrix is swim-green when:
1. All rows A1–D5 + E1–E3 + X1–X15 have terminal verdicts (or explicit DEFERRED with reason).
2. No unresolved FAIL remains on in-scope critical row.
3. Engine + bootstrap SHAs recorded per row, deploy provenance exact.
4. Known limitations labeled as such, not silently accepted.
5. Scoreboard (this README + ROWS.md + row files) durable enough to survive compaction.

## History

- 2026-04-16 22:47 PDT — figs flags partial-scoping: *"you keep skipping the full set, yo. dont know if you mean to - really, like 40."*
- 2026-04-16 22:51 PDT — figs authorizes full swim: *"yes please @Ronan🌊 - the whole thing. ocean swim, not puddle paddle."*
- 2026-04-16 22:53 PDT — figs flags morning conflict (structured dreaming) + Elliott rebuild dependency. Decision: run tonight, Elliott updated first.
- 2026-04-16 22:55 PDT — scaffold created on branch `swim-34-formal-matrix/ronan`, base `7bd4f5b`.
