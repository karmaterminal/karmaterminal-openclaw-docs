# PR #129388 backend-disposition verdict semantics

## Named-ref identity gate

The unchanged safe lane was published before the contract evidence was evaluated.
Exact commits and immutable run metadata are used where no branch ref applies.

| Category | Named ref | Local SHA | Tracking SHA | Server SHA | Equality |
|---|---|---|---|---|---|
| Product/base | `karmaterminal/karmaterminal-openclaw-docs@a1b52de161185efcd4e503e9b1e962e76c67a7b0` | `a1b52de161185efcd4e503e9b1e962e76c67a7b0` | N/A (immutable commit) | `a1b52de161185efcd4e503e9b1e962e76c67a7b0` | Equal |
| Safe lane | `karmaterminal/karmaterminal-openclaw-docs:codeagent/129388-backend-disposition-verdict` | `a1b52de161185efcd4e503e9b1e962e76c67a7b0` | `a1b52de161185efcd4e503e9b1e962e76c67a7b0` | `a1b52de161185efcd4e503e9b1e962e76c67a7b0` | Equal; unchanged branch published |
| CI/workflow | Focused docs harness tests | N/A | N/A | N/A | N/A; this lane is `focused-only` and uses no external workflow ref |
| Presentation | `openclaw/openclaw#129388` | N/A | N/A | N/A | N/A; protected and untouched |
| Docs/proof | `karmaterminal/karmaterminal-openclaw-docs` Actions run `32956764849` | `ef850a6943bda22a863c7608c07d707b0b8a49ff` | N/A (immutable run head) | `ef850a6943bda22a863c7608c07d707b0b8a49ff` | Equal; local commit object matches the run's recorded `headSha` |

## Contract basis

The row title and pipeline define `R-OBS-BACKEND-DISPOSITION` as proof that a
degraded backend is classified explicitly instead of producing a zero that reads
as absence. Its manifest and #517 likewise require public-safe status receipts,
rebind keys, and fail-closed handling when completeness metadata is absent; they
do not require this harness row to repair Tempo or Loki.

Run `32956764849` is the decisive receipt. Tempo and Loki both returned HTTP 200,
both interactions remained `partial`, aggregate `countAuthority` remained
`false`, both zero results remained non-authoritative, all classifier controls
matched, all four required row receipts were present, and all rebind keys were
complete. The rejected harness converted that honest backend classification into
`PARTIAL-candidate` solely because it treated backend completeness as row-contract
completeness. The owning boundary is the disposition composition from scenario
summary through telemetry postprocessing and candidate-envelope validation.

## Work status

Implementation and focused successor receipts are in progress.
