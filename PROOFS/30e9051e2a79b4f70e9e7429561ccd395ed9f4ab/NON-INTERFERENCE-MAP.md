# Presentation/runtime non-interference map

## Identities

- Presentation: `30e9051e2a79b4f70e9e7429561ccd395ed9f4ab`
- Runtime composite: `6e6da7bba079b0fc50d134b96657cda683985837`
- Direct merge base: `09b553e5fc7c2b3a26954046c1d9f52c55af4b40`

The presentation is not an ancestor of the runtime composite. Therefore this
map does not claim ancestry or blanket equivalence; it compares the two trees
directly.

## Dedicated owned surfaces

| Surface | Presentation tree/blob | Composite tree/blob | Classification |
|---|---|---|---|
| `src/auto-reply/continuation/` | `fbafe7cc7f8760aedf3b23e0e9926c56b51f5126` | `fbafe7cc7f8760aedf3b23e0e9926c56b51f5126` | byte-identical continuation core |
| `src/infra/continuation-tracer.ts` | `ea69093176ebc586c48104dc9361d5444a4ce2bc` | `ea69093176ebc586c48104dc9361d5444a4ce2bc` | byte-identical continuation tracing |
| `extensions/diagnostics-otel/` | `1ff9ba6089de52f535a662409f630e7ebc158ca0` | `1ff9ba6089de52f535a662409f630e7ebc158ca0` | byte-identical originating-tool-span plugin |
| `src/runtime/` | no changed paths | no changed paths | byte-equivalent for this comparison |
| `packages/plugin-sdk/` | no changed paths | no changed paths | byte-equivalent for this comparison |

## Adjacent execution surfaces

The direct diff contains 244 paths across `src/agents/`, `src/gateway/`,
`packages/gateway-client/`, and `packages/gateway-protocol/`. These are
lineage drift between the 153-commit presentation side and 13-commit composite
side of the merge base, not a small patch that can be described as
"presentation plus two commits."

A changed-line scan for `continuation`, `continue_work`,
`continue_delegate`, `request_compaction`, `TaskFlow`, `work-dispatch`, and
`continuation-tracer` found no primitive implementation change. The sole
continuation-named adjacent line is the presentation-only code-mode
reconciliation guard `!attempt.runtimeContinuationStarted`; its containing
code-mode reconciliation module is absent from the composite. It gates a
read-only recovery retry after a code-mode mutation candidate and is not a
continuation primitive or proof-row dispatch path.

The full [path-level appendix](NON-INTERFERENCE-PATHS.tsv) is generated from
the direct `git diff --name-status` and classifies all 244 non-empty adjacent
paths. This supports a bounded non-interference claim for continuation-owned
bytes; it does not erase the disclosed broad lineage difference.

## Ancillary source commits

| Source | Direct changed paths | Continuation classification |
|---|---|---|
| `3bf1ca1d211f4f303ca1bfec9e47daef8f4192f9` (`openclaw/openclaw#121204`) | `scripts/run-vitest.mts`, `test/scripts/run-vitest.test.ts` | test-runner watchdog only |
| `4ff99f7e5c149d90214a3df932f9d5adb438b835` (`openclaw/openclaw#124337`) | `REPORTS/124337-grok-ship-repair.md` | report-only |

The runtime composite tip itself changes
`src/channels/message/ingress-drain-pending-disposition.ts`; this is disclosed
Discord durable-ingress policy work, outside the byte-identical continuation
core/tracer/plugin surfaces.

## Conclusion

Continuation core, tracing, and originating tool-span instrumentation are
byte-identical between presentation and runtime. Broad adjacent gateway/agent
lineage is not identical and remains explicit. Behavioral proof, if acceptance
unblocks, must therefore bind both identities and cannot be described as
executing the presentation commit itself.
