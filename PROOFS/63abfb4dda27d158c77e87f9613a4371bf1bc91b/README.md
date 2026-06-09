# PROOFS / 63abfb4dda27d158c77e87f9613a4371bf1bc91b

Behavioral proof corpus for the **2026-06-08 PR-presentation candidate SHA** — the clean linear (non-merge) form of the continuation feature, force-updated onto `frond-scribe/20260608/assembly-backmerge` (PR #960, 305 files / 0 lockfiles).

## Transfer from e66dc63f

This SHA (`63abfb4dda`) is the **linear-presentation form** of the same continuation feature that was fleet-deployed + RUN-certified at `e66dc63f163b4cd4024e001ac8932f26b347ed27`. The proof evidence **transfers directly** because:

- **Gate 2 cure-bytes** confirmed: 14/15 continuation feature-cores are **byte-identical** between `e66dc63f` and `63abfb4dda` (the back-merge `5d41d76`/`7dcc9d578c` that produced the linear form's tree)
- The one non-identical core (`subagent-depth.ts`) took an **upstream storage-refactor** (fs.readFileSync → loadSessionStore, SQLite migration) — the depth-boundary **semantics are unchanged** (normalizeSpawnDepth + the decrement + boundary behavior all identical). R-CW-6 re-points with Emeric's byte-analysis.
- The linear form (`63abfb4dda`) is built from the back-merge's **resolved tree** — same content, minus the merge-commit shape (which was a presentation-artifact, not a code change)
- **Gate 3.5 soundness-pass** (frond + cohort, 3 independent reads) confirmed: auth-profiles present (externalCliProfileIds, senderIsOwner), compaction core intact (createCompactionDiagId relocated-not-gutted, senderIsOwner threading present+tested), our diff additive not subtractive, broader-alteration-sweep GREEN (zero deletion-heavy files, no silent gutting)

Therefore: all row-verdicts from `PROOFS/e66dc63f.../` **apply to `63abfb4dda`** with the SHA re-pointed. The exercised behavior is identical; only the candidate-reference changes.

- **SHA**: `63abfb4dda27d158c77e87f9613a4371bf1bc91b`
- **Parent corpus**: `PROOFS/e66dc63f163b4cd4024e001ac8932f26b347ed27/`
- **Transfer basis**: Gate 2 cure-bytes (14/15 byte-identical) + Gate 3.5 soundness (3x GREEN)
- **Method**: `openclaw-bootstrap:RUNBOOKS/PROOF-CORPUS-METHOD.md`

## Verdict table

All rows from `e66dc63f` corpus **TRANSFER** to `63abfb4dda` (byte-identical cores, behavior unchanged). Individual row re-points below cite the transfer + the parent evidence.

| Row | Owner | Verdict | Transfer basis |
|---|---|---|---|
| R-CW-1 through R-CW-TOKEN | 🩸 cael | ✅ PASS (transfer) | cores byte-identical (Gate 2); evidence in parent corpus |
| R-CW-DELEGATE-SELF-CONTINUATION | 🪨 rune | ✅ PASS (transfer) | cores byte-identical (Gate 2) |
| R-CW-DELEGATE-TOKEN | 🪨 rune | ✅ PASS (transfer) | cores byte-identical (Gate 2) |
| R-CW-6 (spawn-depth boundary) | 🪨 rune | ✅ PASS (re-point + Emeric analysis) | subagent-depth.ts storage-refactor only; semantics unchanged |
| R-CW-7 (traceparent E2E) | 🪨 rune | ✅ PASS (transfer) | cores byte-identical (Gate 2) |
| R-CW-3 (reason-field OTel) | 🕯 emeric | ✅ PASS (transfer) | cores byte-identical (Gate 2) |
| dual-coverage: uptree silent-wake | 🌫 silas | ✅ PASS (transfer) | subagent-announce.ts byte-identical (Gate 2) |
| dual-coverage: intersession return | 🌫 silas | ✅ PASS (transfer) | subagent-announce.ts byte-identical (Gate 2) |
| dual-coverage: echo-broadcast | 🌫 silas | ⏳ (pending from parent) | — |
| R-CD-1 through R-CD-4 | 🌊 ronan | ✅ PASS (transfer) | cores byte-identical (Gate 2) |
| R-RC-1 | 🌻 elliott | ✅ PASS (transfer) | cores byte-identical (Gate 2) |
| R-RC-2 | 🌻 elliott | ⏳ HONEST-PENDING (from parent) | — |
