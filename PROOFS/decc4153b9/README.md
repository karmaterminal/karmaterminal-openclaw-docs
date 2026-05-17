# PROOFS / decc4153b9

Focused-proof corpus for PR #79925 **cure-(11)** candidate (drift-cure rebase + T-1/T-2/T-3/T-4 spiderweb tests + lint-fix).

- **SHA**: `decc4153b9849b548ae7acc7dfc7c2dc333e6db9`
- **Parent**: upstream/main `59b85d4eb9` (drift = 192 commits absorbed cleanly)
- **Pre-push branch**: `karmaterminal/openclaw:silas/cure11-candidate-2026-05-17`
- **PR**: [openclaw/openclaw#79925](https://github.com/openclaw/openclaw/pull/79925)

## Commits on candidate

| SHA | author | description |
|---|---|---|
| `f58602bdd5` | karmafeast | feat(continuation) — cure-(10) feature rebased onto upstream `59b85d4eb9` |
| `67849b4db5` | elliott-gmail | test(spiderweb-T1): export releaseQueuedCompactionCompletion for direct branch tests |
| `cc25d1b73b` | elliott-gmail | test(spiderweb-T1): 8 branch tests (419 lines) |
| `8f58ad3e70` | cael-dandelion-cult | test(continuation): pin cost-cap exactly-at-boundary (> not >=) (T-2) |
| `d878a62482` | ronan-dandelion-cult | test: nonexistent-target-session delivery coverage (#697) (T-3) |
| `5bb4d281c8` | ronan-dandelion-cult | test: continue_work onFire callback throws (#698) (T-4) |
| `decc4153b9` | ronan-dandelion-cult | fix: lint fixes for scheduler.onfire-throws.test.ts |

## Conflict resolutions (cure-(11) only, vs cure-(10) `df502943c2`)

Per 🌫's substrate-walk at Discord `1505619065`:

1. `src/agents/openclaw-tools.ts` — kept cure-(10) `runtime.js` consolidated import + `createSubsystemLogger` (both runtime paths export needed functions per byte-walk)
2. `src/auto-reply/reply/agent-runner-execution.ts` — 4 conflict blocks merged: kept both upstream `runEmbeddedPiAgent` AND cure-(10) `isLikelyExecutionAckPrompt` + `EmbeddedPiCompactResult` imports; kept cure-(10) `releaseQueuedCompactionCompletion` function + brevity constants; merged role-ordering + session-corruption blocks BEFORE providerRequestError check (preserving both upstream + cure-(10) error-handling paths)
3. `src/auto-reply/reply/reply-delivery.ts` — kept BOTH upstream silent-payload handling AND cure-(10) `let blockPayload` (needed for later reassignment)

## Cohort byte-walk cosigns

- 🌻 elliott — Discord [`1505619609`](https://discord.com/channels/1466192485440164011/1466192485440164011/1505619609984700547) (post-correction at `1505619492`)
- 🌫 silas — driver, Stage 1 declared `1505619065`
- 🩸 cael — Discord [`1505621523`](https://discord.com/channels/1466192485440164011/1466192485440164011/1505621523468255332)
- 🌊 ronan — implicit at canon byte-walk `1505621xxx` + R-XSDT-1 draft staged

## Focused vitest verdict (🌫's pre-push gate)

✅ **74/74 PASSING** in 13.08s on 4 P0 surfaces:
- 26 tests cross-session-targeting nonexistent-target (T-3)
- 6 tests scheduler.onfire-throws (T-4)
- 14 tests scheduler (T-2 cost-cap additions)
- 20 tests delegate-dispatch (T-3 second file)
- 8 tests agent-runner-execution.release-queued-compaction (T-1)

Total: 1160 lines of test additions across 6 files.

## Proof-row claims at byte (provisional, pending deploy to seats)

cure-(11) substrate-new surfaces vs cure-(10):
- **T-1 spiderweb** — releaseQueuedCompactionCompletion 8-test surface (covered statically by tests; runtime fire optional)
- **T-2 cost-cap-exactly-at-boundary** — chain-guard `>` vs `>=` strict-operator behavior
- **T-3 nonexistent-target-session** — cross-session-delivery missing-target path
- **T-4 onfire-throws** — scheduleWorkContinuation throw-path defensive coverage

Plus re-fire of cure-(10) runtime rows (R-CW-1/2, R-CD-1, R-RC-1/2, R-LSTC-1, R-RDT-1, R-SDPP-1) at the new SHA to confirm rebase didn't regress.

Distribution (re-aligned per 🩸 `1505621523`):
- 🩸 cael — R-CW-1 (continue_work) / R-CW-2 (continue_delegate) / R-RC-2 (request_compaction-2nd-instance)
- 🌊 ronan — R-RC-1 (request_compaction) / R-XSDT-1 (cross-session-delivery-targeting) / T-3 runtime / T-4 runtime
- 🌫 silas — R-SDPP-1 / R-LSTC-1 / R-RDT-1
- 🌻 elliott — R-RC-1-addendum + T-2 cost-cap-boundary runtime fire (new substrate from `8f58ad3e70`)

## Discipline (per figs `1505460056`-area cure-(10) canon)

- **whole thing**: complete corpus per claims, no partials
- **tempo trace fetch**: real trace data from tempo backend, not journal-only / not agent prose
- **no skipped test cases**: every relevant case fires; none waved-through

## Status

- Stage 1 (candidate-prep): ✅ COMPLETE 🌫
- Stage 2 (local 7-gate): 🟡 fork-CI cycle in flight at candidate-SHA
- Stage 3 (deploy-to-4-princes via deploy-gateway.yml): 🟡 🩸 cael-seat deploy `25997583929` in_progress
- Stage 4 (PROOFS rows fire across 4 seats): _pending Stage 3 + squashed-SHA per figs `1505621xxx` canon_
- Stage 5 (cohort byte-walk + figs ship-call): 3/4 cosigns at byte (🌻 🩸 🌫); 🌊 implicit at canon byte-walk
- Stage 6 (savegame branch push): _pending Stage 5_
- Stage 7 (force-push --force-with-lease as karmafeast committer, single-squash-shape per figs canon `1505621xxx`): _pending Stage 6_
- Stage 8 (PR body update — PROOFS-path only, NO OV-narrative per 🩸 `1505616434` correction): _pending Stage 7_
- Stage 9 (cohort announce + downstream-rebase notify): _pending Stage 8_

## figs ship-shape canon (`1505621xxx`)

> "just squash 1 - put authorship in comment. because its simpler and the maintainers dont get pissy because shit is split"

Step 7 force-push presentation = **single squash commit** onto presentation branch `frond-scribe-claude/20260509/narrow-surgery-tight`, with multi-prince authorship via `Co-authored-by:` trailers in commit message body. NOT 7-commit shape currently on `silas/cure11-candidate-2026-05-17`. Candidate is intermediate-substrate; squash happens at Step 7.

