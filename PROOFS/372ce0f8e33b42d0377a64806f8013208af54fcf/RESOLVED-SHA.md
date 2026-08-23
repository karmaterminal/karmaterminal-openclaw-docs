# Resolved SHA and gates

| Identity | Value |
|---|---|
| Upstream pull | `openclaw/openclaw#85651` |
| Immutable pull head | `372ce0f8e33b42d0377a64806f8013208af54fcf` |
| Runtime composite | `6e6da7bba079b0fc50d134b96657cda683985837` |
| PR 121204 source | `3bf1ca1d211f4f303ca1bfec9e47daef8f4192f9` |
| PR 124337 source | `4ff99f7e5c149d90214a3df932f9d5adb438b835` |
| Frozen upstream | `8578b8f55cf77ddb161891b662a02f8c8c2a80ba` |
| Docs starting SHA | `5862caf39a3844a8ce3dd25def236a901ce9b316` |

## Presentation verification

GitHub reports the pull head at the exact required SHA and `mergeable=true`.
The pull is closed and its named source branch no longer exists, but the
immutable pull ref remains available at the exact commit. Proof work does not
move any presentation ref.

## Gate receipts

- Exact presentation Mode-B:
  [32650099821](https://github.com/karmaterminal/openclaw-bootstrap/actions/runs/32650099821),
  workflow SHA `6dd6c3a7712c8ae02937a29054525b2ddacb89c1`,
  **failure**, 163,506 passed / 38 failed.
- Deterministic presentation failures: 14 TUI PTY cases, one
  `doctor-lint` Crabbox-profile case, and one Telegram Mantis stop/owner case.
- Load flakes greened on retry: 22.
- Exact frozen-upstream baseline Mode-B:
  [32657627746](https://github.com/karmaterminal/openclaw-bootstrap/actions/runs/32657627746),
  workflow SHA `6dd6c3a7712c8ae02937a29054525b2ddacb89c1`,
  **failure**, 162,053 passed / 41 failed.
- Baseline deterministic failures: 19. Thirteen exact test identities are
  shared with the presentation failure set; three are presentation-only and
  six are baseline-only. See `gates/mode-b-failure-classification.md`.
- Raw artifact logs and three matched serial repetitions per SHA classify the
  three presentation-only identities as:
  - Telegram Mantis: host `/run/lock` permission/fixture class, 3/3 matched
    passes on both SHAs;
  - xAI account-limit rendering: PTY timing/order class, 3/3 presentation and
    2/3 frozen matched passes;
  - redacted cause-aware send failure: one-off PTY timing class, 3/3 matched
    passes on both SHAs.
  No presentation-specific product regression was proved by these identities.
- Exact Gate 2.7 recomputation examined 930 paths: 296 `GENUINE`, 288
  `SAFE-NEW`, 346 `MIXED-CLOBBER`, and zero `FROZEN-STALE`. The canonical
  tool exited zero. Its reconciliation has 346 unique dispositions: 345
  `KEEP`, one `RESTORE`, and zero missing, extra, or duplicate paths. Set
  geometry is 346 current / 317 prior / 310 shared / 36 current-only / seven
  prior-only.

The gate is fail-closed because
`extensions/telegram/src/bot-message-dispatch.context-recovery.test.ts`
requires restoration of frozen upstream's compatible anti-spoof assertion.
The immutable presentation cannot be repaired from this docs lane. No current
proof behavior has fired; docs main and the presentation ref were not moved.

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
