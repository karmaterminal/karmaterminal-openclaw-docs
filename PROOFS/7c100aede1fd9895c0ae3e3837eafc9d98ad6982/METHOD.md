# Method

- Target presentation identity:
  `7c100aede1fd9895c0ae3e3837eafc9d98ad6982`.
- Immediate source presentation:
  `00c7f721a55554d0b9228337cc8bc6bec88f9e9f`.
- Immediate source docs commit and canonical docs main:
  `66cac550c218dc1c9736674eccbb613c0e017790`.
- Original proof source:
  `80311e8aa07fd560cb957475517c5ea18164541c`.
- Historical execution identity:
  `37300f29a7ec1f731575343c2aa73ae25f1d0efb`; ancestry was verified for
  the original proof source, #124337, and #121204.
- Product ancestry is exact: target `7c100aed...` is a merge with first parent
  source `00c7f721...`, second parent upstream/main `42676314...`, and tree
  `7360e360...`.
- The merge absorbs current upstream changes and manually reconciles seven
  conflict owners: `scripts/plugin-sdk-surface-report.mts`,
  `src/agents/code-mode.bridge.lifecycle.test.ts`,
  `src/agents/embedded-agent-subscribe.ts`,
  `src/agents/subagents/announce/subagent-announce-delivery.ts`,
  `src/agents/subagents/announce/subagent-announce-direct-delivery.ts`,
  `src/config/sessions/goals.ts`, and
  `src/config/sessions/session-accessor.sqlite-transcript-write.ts`. Some
  logical owners moved into new upstream split files; product materiality is
  not test-only.
- Independent divergence and code reviews found no blocker. Validation passed
  625 focused tests across 19 files, exact plugin SDK surface checks, static
  checks, core/test/scripts type checks, and the full no-install Node 24 build.
- Static/type/lint/format/review and historical Mode-B receipts remain
  historical evidence, not current-target acceptance.
- The active feature-acceptance composition contains the same 37 retained rows
  as the immediate source. No retained row state or review state changed.
- Historical composite non-interference remains 10 routed shards / 403 tests.
- Historical Ronan deployment remains workflow 32828846929 with exact
  HEAD/build-info/runtime, 60-second startup and 15-second post-Doctor health
  holds, and zero restarts.
- Historical live ingress, continuation, cap-boundary, Tempo, and static
  carried-row evidence retains its original execution identity and checksums.
- No live proof or Mode-B workflow ran at `7c100aed`. Mode-B run `33165923171`
  targeted ancestor product `4c3314f7` and remains historical lineage evidence
  only;
  `exact_target_mode_b=false`.
- The 32 pass, 4 partial, 1 honest-limit, 0 fail, and 0 missing rollup is not
  acceptance-complete while required rows remain partial.
