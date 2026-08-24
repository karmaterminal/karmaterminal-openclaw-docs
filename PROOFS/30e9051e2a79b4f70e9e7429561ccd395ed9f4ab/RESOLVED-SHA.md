# Resolved SHA and gates

| Identity | Value |
|---|---|
| Upstream pull | `openclaw/openclaw#85651` |
| Fork presentation head | `30e9051e2a79b4f70e9e7429561ccd395ed9f4ab` |
| Closed immutable pull ref | `372ce0f8e33b42d0377a64806f8013208af54fcf` |
| Runtime composite | `6e6da7bba079b0fc50d134b96657cda683985837` |
| PR 121204 source | `3bf1ca1d211f4f303ca1bfec9e47daef8f4192f9` |
| PR 124337 source | `4ff99f7e5c149d90214a3df932f9d5adb438b835` |
| Frozen upstream | `6669872a95f87b9a79ebebbaac5718cd877f86bd` |
| Docs starting SHA | `5862caf39a3844a8ce3dd25def236a901ce9b316` |

## Presentation verification

The protected fork presentation was plain-fast-forwarded to the exact required
SHA. The bot-closed upstream pull ref remains immutable at its earlier head;
the workorder forbids reopening it. This corpus therefore binds the replacement
PR presentation source, not the stale historical pull ref.

## Gate receipts

- Exact presentation Mode-B:
  [32674562617](https://github.com/karmaterminal/openclaw-bootstrap/actions/runs/32674562617),
  workflow SHA `6dd6c3a7712c8ae02937a29054525b2ddacb89c1`,
  **classified failure**, 163/163 routed shards and valid receipts.
- Deterministic presentation failures: 12 TUI PTY cases, one
  `doctor-lint` Crabbox-profile case, and one Telegram Mantis stop/owner case.
- Exact frozen-upstream baseline Mode-B:
  [32657627746](https://github.com/karmaterminal/openclaw-bootstrap/actions/runs/32657627746),
  workflow SHA `6dd6c3a7712c8ae02937a29054525b2ddacb89c1`,
  **failure**, 162,053 passed / 41 failed.
- The baseline has the same doctor and TUI artifact-failure families. Candidate
  and baseline isolated doctor tests pass 25/25. Candidate and baseline isolated
  Mantis tests pass 6/6, and both Mantis paths are byte-identical.
- TUI logs identify the missing built
  `@openclaw/ai/dist/internal/openai-responses-payload-policy.mjs`; the final
  local build emits that file. This is artifact assembly, not product behavior.
- Exact Gate 2.7 recomputation examined 931 paths: 297 `GENUINE`, 289
  `SAFE-NEW`, 345 `MIXED-CLOBBER`, and zero `FROZEN-STALE`. All 345 mixed rows
  are `KEEP`; the prior Telegram `RESTORE` is now applied and its shard passes
  11/11.
- Gate 2 reports 40/40 primitive-core invariants preserved.
- Local `pnpm check`, `pnpm check:test-types`, `pnpm build`, focused
  continuation/Telegram/conflict suites, four commit-scoped autoreviews, and
  exact-head GitNexus review are clean.

## Ronan readiness snapshot

- checkout: exact runtime composite;
- `dist/build-info.json`: exact runtime composite;
- package dist roots: 16;
- bundled plugin:
  `dist/extensions/diagnostics-otel/index.js`;
- plugin state: enabled, loaded, bundled, sourced from the root compiled path;
- diagnostics, OTel, and traces: enabled;
- Tempo `/ready`: HTTP 200;
- gateway `/health` and `/status`: HTTP 200;
- continuation and Discord configuration: present and enabled.

Transport/disposable-session readiness still requires the workflow's
authenticated preflight before any behavioral dispatch.
