# Gate-3 local-test stdout logs (PROOF-CORPUS-METHOD canon)

Per `openclaw-bootstrap:main/RUNBOOKS/PROOF-CORPUS-METHOD.md` § "Corpus shape":

Expected log files (placeholder until cael driver-axis fires Gate-3 from cael-DGX seat at CANDIDATE_SHA `2f71e4378b70ea43fb185edff1af14571eca826f`):
- `gate-3a-pnpm-install.log` — pnpm install --frozen-lockfile stdout
- `gate-3b-pnpm-tsgo.log` — pnpm tsgo (core type-check) stdout
- `gate-3c-pnpm-tsgo-test.log` — pnpm tsgo:test stdout
- `gate-3d-pnpm-check.log` — pnpm check (lint + format) stdout
- `gate-3e-pnpm-vitest.log` — pnpm test (full vitest, all 88 shards) stdout
- `gate-3f-pnpm-build.log` — pnpm build (production build) stdout
- `upstream-main-broken-class-receipt.log` — if vitest hit upstream-class failures (optional)

Frond Gate 3e on `2f71e4378b7` from `1511881572` returned 88/88 PASS (durable on `/tmp/frond-audit-gate3e-2f71e4378b7.log` on frond-scribe-copilot seat).

Per PROOF-CORPUS-METHOD discipline: remove this STUB.md when actual gate-logs land.
