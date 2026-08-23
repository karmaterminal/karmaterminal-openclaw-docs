# Exact presentation Mode-B receipt

- Product SHA: `372ce0f8e33b42d0377a64806f8013208af54fcf`
- Workflow SHA: `6dd6c3a7712c8ae02937a29054525b2ddacb89c1`
- Run: `32650099821`
- Conclusion: **FAILURE**
- Planned shards: 163
- Receipt validation: 69/69 routed jobs
- Passed: 163,506
- Failed: 38
- Load flakes greened: 22

## Deterministic failures

- 14 `core-runtime-tui-pty` TUI PTY cases.
- `src/commands/doctor-lint.test.ts`: Crabbox profile finding before dispatch.
- `test/scripts/telegram-mantis-sut.test.ts`: runtime-owner wait during stop.

This red is preserved as red. Baseline reproduction classifies provenance but
does not rewrite the exact presentation run as green.
