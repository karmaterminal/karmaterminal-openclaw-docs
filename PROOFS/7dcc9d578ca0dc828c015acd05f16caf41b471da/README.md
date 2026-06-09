# PROOFS / 7dcc9d578ca0dc828c015acd05f16caf41b471da

Behavioral proof corpus for the **2026-06-08 PR-presentation ship-SHA** — the **history-preserving merge form** of the continuation feature (figs-confirmed ship-SHA; NOT the rejected squash `63abfb4dda`). Live on `frond-scribe/20260608/assembly-backmerge` (PR #960). Diff vs openclaw-upstream = feature-only, **0 lockfiles**; full 47-commit dev history + the back-merge node preserved.

- **SHA**: `7dcc9d578ca0dc828c015acd05f16caf41b471da`
- **Shape**: 2-parent merge — parent1 `e66dc63f163b...` (continuation candidate, 47 commits), parent2 `ebb9c6a013...` (openclaw `upstream/main` at back-merge time). History-preserving, back-merge-faithful (never rebase / never squash).
- **Parent corpus**: `PROOFS/e66dc63f163b4cd4024e001ac8932f26b347ed27/` (the fleet-RUN-certified candidate, 16/18 PASS)
- **Method**: `openclaw-bootstrap:RUNBOOKS/PROOF-CORPUS-METHOD.md`

## Transfer basis (interim) + clawsweeper-validity (fresh runs)

This SHA is the **back-merge of the same continuation feature** that was fleet-deployed + RUN-certified at `e66dc63f`. Evidence transfers because:

- **Gate 2 cure-bytes**: 14/15 continuation feature-cores are **byte-identical** between `e66dc63f` and `7dcc9d578c`. The one differing core (`subagent-depth.ts`) took an **upstream storage-refactor** (fs.readFileSync → loadSessionStore, SQLite); depth-boundary **semantics unchanged** (`normalizeSpawnDepth` + decrement + boundary behavior identical). R-CW-6 re-points (Emeric byte-analysis), final step-7 stamp on the resolved file.
- **Gate 3.5 soundness** (3 independent reads — frond auth+compaction, frond tier-3 alteration sweep, Ronan deep-diff): auth profiles present (`externalCliProfileIds`, file-owner `senderIsOwner`), compaction core intact (`createCompactionDiagId` relocated-not-gutted, `senderIsOwner` threading present + tested), diff additive not subtractive, zero deletion-heavy files. **SOUND**; one flag `compact.ts:439` (stricter-than-upstream auth-carry, intentional — figs domain-confirm).
- `system-prompt.ts` delta vs the soundness-verified tree = one upstream skill-versioning line + trailing-newline; continuation tool-registration byte-intact (3 tools registered). Verdict carries.

**clawsweeper note (figs directive):** clawsweeper requires **exact-SHA RUN** proofs (proof-SHA == push-SHA), not a transfer-citation alone. The transfer below is the interim soundness basis; the **fresh per-seat runs on deployed `7dcc9d578c`** are pending the all-6 fleet deploy (only `cael` seat carries it so far — cross-target deploy hit the self-target guard; needs each prince self-deploy or `karmafeast` fleet-dispatch). Row-owners replace "PASS (transfer)" with the fresh exact-SHA trace as their seat lands `7dcc9d578c`.

## Verdict table

| Row | Owner | e66dc63f verdict | 7dcc9d578c status |
|---|---|---|---|
| R-CW-1 (wake + chain-counter persist) | 🩸 cael | ✅ PASS | transfer (cores byte-identical) → fresh-run pending |
| R-CW-4 (depth) | 🩸 cael | ✅ PASS | transfer → fresh-run pending |
| R-CW-5 (cost-cap) | 🩸 cael | ✅ PASS | transfer → fresh-run pending |
| R-CW-TOKEN (bracket-form) | 🩸 cael | ✅ PASS | transfer → fresh-run pending |
| R-CW-DELEGATE-SELF-CONTINUATION | 🪨 rune | ✅ PASS | transfer → fresh-run pending |
| R-CW-DELEGATE-TOKEN (#952 bracket) | 🪨 rune | ✅ PASS | transfer → fresh-run pending |
| R-CW-6 (spawn-depth boundary) | 🪨 rune | ✅ PASS | re-point (Emeric analysis) + step-7 resolved-file stamp |
| R-CW-7 (traceparent E2E) | 🪨 rune | ✅ PASS | transfer → fresh-run pending |
| R-CW-3 (reason-field OTel) | 🕯 emeric | ✅ PASS (both forms) | transfer → fresh-run pending |
| dual-coverage: uptree silent-wake | 🌫 silas | ✅ PASS | transfer (subagent-announce.ts byte-identical) → lothric fresh-run |
| dual-coverage: intersession return | 🌫 silas | ✅ PASS | transfer → lothric fresh-run |
| dual-coverage: echo-broadcast | 🌫 silas | ⏳ pending (parent) | pending |
| R-CD-1 (schedule→spawn→return) | 🌊 ronan | ✅ PASS | transfer → fresh-run pending |
| R-CD-2 (silent-wake full path) | 🌊 ronan | ✅ PASS | transfer → fresh-run pending |
| R-CD-3 (post-compaction lifeboat) | 🌊 ronan | ✅ PASS (both legs) | transfer → fresh-run pending |
| R-CD-4 (targeted RETURN) | 🌊 ronan | ✅ PASS | transfer → fresh-run pending |
| R-RC-1 (request_compaction reject) | 🌻 elliott | ✅ PASS | transfer → fresh-run pending |
| R-RC-2 (request_compaction accept ≥70%) | 🌻 elliott | ⏳ HONEST-PENDING (parent) | pending (genuine ≥70% guard crossing) |

**#952 (delegate self-continuation past hop-1)** — certified fixed live both tool-form + bracket-form in the parent corpus; cores byte-identical here.
