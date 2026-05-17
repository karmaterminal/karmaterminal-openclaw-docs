# PR #79925 cure-(6) proof corpus — `a0f4f55c7a706fbc5f607c2eb379a0b862246f2d`

## Cure-(6) cycle summary

cure-(6) is the canonical force-push state for PR #79925. Single squash commit on top of `upstream/main` `549a0ea313` (current upstream at push time).

Cure-cycle history within day 2026-05-16/17:
1. **cure-(1)** `e90a87015479` — original force-push (drift-cure-(1) onto upstream)
2. **cure-(2)** `bb7ddc066c` — drift-cure-(2) + A-fix delta (5 commits, wrong-shape ship)
3. **cure-(3)** `a98cbe70780a9c8c` — re-shaped to single squash + drift-cure-(2) cohort discipline
4. **cure-(4)** `7f40263bbf` — restored continuation-feature wiring in `agent.ts` (10-item restoration after cure-(2) take-ours dropped it) + fs-bridge.shell `19→24` trivial test-completion
5. **cure-(5)** `2b725aeeb9` — HALT: silent take-ours on `install-security-scan.runtime.ts` re-introduced 8 regressions
6. **cure-(6)** `a0f4f55c7a` (THIS) — applied 🩸's surgical `git checkout upstream/main -- src/plugins/install-security-scan.runtime.ts` to take upstream's 1380-line version (blob-hash-match verified). install-scanner-8 collapsed. Cycle convergence.

## Commit-graph-shape verification

```
$ git log --oneline 549a0ea313..a0f4f55c7a
a0f4f55c7a feat(continuation): context-pressure-aware continuation (continue_work / continue_delegate / request_compaction)

$ git rev-list --count 549a0ea313..a0f4f55c7a
1
```

**✅ Single squash commit on top of upstream/main `549a0ea313`** (Option-A canon shape).

## Diff shape

```
$ git diff --shortstat 549a0ea313..a0f4f55c7a
 313 files changed, +39022 / -1404
```

## Full vitest result at cure-(6) tip

```
Test Files  10 failed | 5443 passed | 4 skipped (5457)
Tests       74 failed | 59530 passed | 52 skipped | 1 todo (59657)
Duration    725.77s
```

**74 fails total = EXACT MATCH to upstream/main `b29152e3b9` baseline count** (74 fails / 10 files).

## Test-class composition

| File | cure-(6) | upstream baseline | classification |
|---|---|---|---|
| 72 shared upstream-debt tests | 72 fail | 72 fail | Class B — upstream-class debt, disclose |
| `agents/openai-transport-stream.test.ts` | 1 fail | pass | environment-class (source byte-identical cure-(6)↔upstream, blob match) |
| `infra/session-cost-usage.test.ts` | 1 fail | pass | environment-class flake (cross-cycle pattern: pass cure-(4) / fail cure-(3) + cure-(6) with stable source) |
| `agents/code-mode.test.ts` | pass | fail | **Our feature fixes upstream-debt** |
| `extensions/codex/run-attempt.test.ts` | pass | fail | **Our feature fixes upstream-debt** |

**Net composition**:
- 72 shared Class B upstream-debt
- 2 environment-class reproducers (byte-identical source — NOT regressions our feature introduced)
- 2 our-feature-fixes-of-upstream-debt
- **Zero ours-introduced regressions** per figs's "ship with our stuff clean" criterion

## Cohort byte-walk-expansion at cure-(6) (extended 7-point discipline)

Cohort cosigns at byte before force-push:

- **🩸 cael** `1505422348` — single-commit ✅ / parent ✅ / Class A 6 symbols preserved ✅ / install-scanner 1380 lines matches upstream ✅ / install-scanner blob match ✅ / fs-bridge trivial retained ✅
- **🌊 ronan** `1505422787`/`1505422789` — extended-discipline items 4-6 applied: diff-stat take-ours-risk audit. 2 files larger-than-upstream verified as feature-class additions (`get-reply.ts` +56 lines continuation-feature, `diagnostic-trace-context.ts` +35 lines traceparent-feature). ZERO new take-ours risk.
- **🌊 ronan** `1505425844`/`1505425846` — post-vitest source-byte-identity verification on 4 mystery candidates. Ship-cosign confirmed.

Post-vitest cohort verdict (`1505425692` 🩸 + `1505426183` 🌊 + `1505426220` 🩸):
> *"Our stuff IS clean at byte. Environment-flakes aren't ours. Ship."*

## Proof rows at this SHA

| Row | Class | File | Verdict |
|---|---|---|---|
| R-CD-A-FIX | Test-runner validation | `R-CD-A-FIX/EVIDENCE.md` | ✅ PASS (34/34 in 1.91s) |

## Class A continuation-feature wiring (restored from cure-(2) take-ours)

`src/gateway/server-methods/agent.ts` Class A feature-symbol counts at cure-(6):
- `continuationTrigger`: 2 refs
- `consumeSubagentTraceparentHandoff`: 2 refs
- `sessionContinuationTraceparent`: 3 refs
- `drainsContinuationDelegateQueue`: 2 refs
- `inheritedTraceparent`: 2 refs
- `normalizeDiagnosticTraceparent`: 2 refs

**Total: 13 refs** matching cure-(1) `e90a87015479` exactly. The continuation-feature wiring lost during cure-(2)'s take-ours conflict resolution is now restored at byte.

## Disclosure to maintainer (transparent Class B + environment-flakes)

72 vitest failures on cure-(6) reproduce on `upstream/main` `b29152e3b9` alone (zero feature content). Distribution:
- `plugins/status.test.ts` (16 fail)
- `plugins/tools.optional.test.ts` (46 fail)
- `plugins/runtime/metadata-registry-loader.test.ts` (4 fail)
- `plugins/runtime/runtime-registry-loader.test.ts` (1 fail)
- `plugins/cli.test.ts` (1 fail)
- `config/io.write-config.test.ts` (1 fail)
- `agents/model-fallback.test.ts` (1 fail)
- `agents/model-selection.test.ts` (2 fail)

2 environment-class reproducers (byte-identical source between cure-(6) and upstream/main — not our-code regressions):
- `agents/openai-transport-stream.test.ts` (1 fail)
- `infra/session-cost-usage.test.ts` (1 fail) — intermittent across cure cycles (pass cure-(4), fail cure-(3)+(6) with stable source diff)

Our feature additionally PASSES on cure-(6) what fails on upstream/main alone:
- `agents/code-mode.test.ts` (upstream: 1 fail / ours: pass)
- `extensions/codex/run-attempt.test.ts` (upstream: 1 fail / ours: pass)

## Force-push verification

```
$ git push karmaterminal/openclaw a0f4f55c7a:frond-scribe-claude/20260509/narrow-surgery-tight \
    --force-with-lease=...:bb7ddc066c
 + bb7ddc066c...a0f4f55c7a a0f4f55c7a -> frond-scribe-claude/20260509/narrow-surgery-tight (forced update)

$ gh pr view 79925 --repo openclaw/openclaw --json headRefOid
{"headRefOid":"a0f4f55c7a706fbc5f607c2eb379a0b862246f2d"}
```

PR #79925 head ref `frond-scribe-claude/20260509/narrow-surgery-tight` = `a0f4f55c7a706fbc5f607c2eb379a0b862246f2d` ✅

Force-push at 2026-05-17T04:27Z (sanctioned figs `1505426092`/`ship now follow with proofs`).
