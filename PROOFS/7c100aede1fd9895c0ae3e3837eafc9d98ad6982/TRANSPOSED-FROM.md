# Corpus transposition

## Provenance

| Field | Value |
|---|---|
| Immediate source corpus | `00c7f721a55554d0b9228337cc8bc6bec88f9e9f` |
| Original proof source | `80311e8aa07fd560cb957475517c5ea18164541c` |
| Target corpus / PR #129388 candidate | `7c100aede1fd9895c0ae3e3837eafc9d98ad6982` |
| Target tree | `7360e360d571d304c9632cddb258a05920e93ea8` |
| Immediate source docs commit / canonical docs main | `66cac550c218dc1c9736674eccbb613c0e017790` |
| Historical live execution composite | `37300f29a7ec1f731575343c2aa73ae25f1d0efb` |
| Historical exact-source Mode-B | run `32859410821`, product `4737afdf7dcc5cca53f8dd1bdaaeaa122ce17bbd` |
| Historical lineage Mode-B | run `33165923171`, ancestor product `4c3314f7...` only |
| Exact-target live execution | **not run** |
| Exact-target Mode-B | **not run** |

## Product ancestry

| Commit | Role |
|---|---|
| `00c7f721a55554d0b9228337cc8bc6bec88f9e9f` | Immediate source presentation and target first parent |
| `426763145635db88cf227f40f093860172bcb37b` | Current upstream/main and target second parent |
| `7c100aede1fd9895c0ae3e3837eafc9d98ad6982` | Final product merge candidate |

The target descends from the immediate source. All 399 files from the canonical
source subtree were copied with zero symlinks and zero inventory delta.
Target-facing manifest and index paths resolve inside the target subtree.
Retained row IDs, states, review states, evidence payloads, timestamps, source
execution and CI identities, runtime identities, and historical checksums
remain source-attributed. Only the seven target-facing metadata files differ.

The target absorbs current upstream changes and manually reconciles seven
conflict owners: `scripts/plugin-sdk-surface-report.mts`,
`src/agents/code-mode.bridge.lifecycle.test.ts`,
`src/agents/embedded-agent-subscribe.ts`,
`src/agents/subagents/announce/subagent-announce-delivery.ts`,
`src/agents/subagents/announce/subagent-announce-direct-delivery.ts`,
`src/config/sessions/goals.ts`, and
`src/config/sessions/session-accessor.sqlite-transcript-write.ts`. Some logical
owners were relocated into new upstream split files; product materiality is
not test-only. This copy does not retroactively turn historical execution into
exact-target execution. Mode-B run 33165923171 targeted ancestor product
`4c3314f7...` and remains historical lineage evidence only.
No Mode-B ran at the target. The active feature matrix remains
`37 total / 32 pass / 4 partial / 1 honest_limit / 0 fail / 0 missing`. It is
not acceptance-complete while four required rows remain partial.
