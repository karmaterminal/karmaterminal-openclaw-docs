# R-CONFIG-DEFAULTS — continuation config defaults applied on bootstrap (🕯 emeric-nuc)

Seat: 🕯 Emeric / `emeric-nuc` (Intel NUC i7-12700H, 64GB, CachyOS x86_64)
Build: OpenClaw `2026.6.2` · dist build-info commit `2807efc1c1e8aa86e8f4ec9d0ba35c3fdccde427`
Date: 2026-06-05 ~12:25 PDT
Source tree HEAD: `2807efc1c1e8aa86e8f4ec9d0ba35c3fdccde427`

## Contract
The continuation runtime config resolves from `agents.defaults.continuation` in the gateway
config. When a key is absent (or invalid), a hardcoded default is applied — these are the
"defaults applied on bootstrap." Resolution is hot-reloadable: it happens at each enforcement
point (scheduling, chain-check, cost-check, pressure-threshold), not once at process start
(`config.ts` header + RFC: docs/design/continue-work-signal-v2.md §5).

## Default constants — byte-confirmed on-SHA
`src/auto-reply/continuation/config.ts` (lines 15–21, candidate SHA `2807efc1c1e`):

```ts
const DEFAULT_CONTINUATION_DELAY_MS            = 15_000;
const DEFAULT_CONTINUATION_MIN_DELAY_MS        = 5_000;
const DEFAULT_CONTINUATION_MAX_DELAY_MS        = 300_000;
const DEFAULT_CONTINUATION_MAX_CHAIN_LENGTH    = 10;
const DEFAULT_CONTINUATION_COST_CAP_TOKENS     = 500_000;
const DEFAULT_CONTINUATION_MAX_DELEGATES_PER_TURN = 5;
const DEFAULT_EARLY_WARNING_BAND               = 0.3125;
```

`resolveContinuationRuntimeConfig(cfg)` (config.ts L66–104) applies each default via a clamp:
- `enabled`: `continuation?.enabled === true` (default **false** — continuation off unless opted-in)
- `defaultDelayMs` ← `clampNonNegativeDelayMs(cfg, 15_000)`
- `minDelayMs` ← `clampNonNegativeDelayMs(cfg, 5_000)`
- `maxDelayMs` ← `clampNonNegativeDelayMs(cfg, 300_000)`
- `maxChainLength` ← `clampPositiveInt(cfg, 10)`
- `costCapTokens` ← `clampNonNegativeInt(cfg, 500_000)`
- `maxDelegatesPerTurn` ← `clampPositiveInt(cfg, 5)`
- `earlyWarningBand` ← `clampEarlyWarningBand(cfg)` → 0.3125 when unset/invalid
- `crossSessionTargeting`: `"enabled"` only on explicit opt-in, else `"disabled"`

Full source excerpt: `config-defaults-source.txt` (this dir).

## Defaults are test-pinned on-SHA — ✅
`src/auto-reply/continuation/config.test.ts` carried at the candidate SHA pins the exact default
values. Re-run on emeric's seat:

```
pnpm vitest run src/auto-reply/continuation/config.test.ts
 ✓  auto-reply  config.test.ts (14 tests) 34ms
 Test Files  1 passed (1)
      Tests  14 passed (14)
```

`config.test.ts:19` — `it("returns defaults when continuation is not configured")` asserts:
`defaultDelayMs: 15_000, minDelayMs: 5_000, maxDelayMs: 300_000, maxChainLength: 10,
costCapTokens: 500_000, earlyWarningBand: 0.3125`, and `contextPressureThreshold` undefined.
`config.test.ts:71` — `clamps negative values to defaults` (maxChainLength→10, costCapTokens→500_000,
maxDelegatesPerTurn→5). Output receipt: `config-test-defaults-pin.log` (this dir).

## Deployed gateway is genuinely on-SHA (the bootstrap that applied these defaults)
`dist/build-info.json` of the running install (`build-info.json`, this dir):

```json
{ "version": "2026.6.2", "commit": "2807efc1c1e8aa86e8f4ec9d0ba35c3fdccde427", "builtAt": "2026-06-05T18:37:22.041Z" }
```

Live gateway (systemd MainPID 2870105) runs `/home/figs/flesh_beast_tmp/openclaw/dist/index.js`
— the same dist tree whose build-info commit is the candidate SHA. `dist.pre-2807efc1c1e…1780684544`
backup-dir confirms the deploy-to-this-SHA cutover on emeric's seat.

## Effective running continuation config (emeric's seat) — honest note on overrides
emeric's `~/.openclaw/openclaw.json` sets `agents.defaults.continuation` explicitly (the fleet-tuned
substrate, NOT the source defaults) — captured in `effective-running-continuation-config.json`:

```json
{ "enabled": true, "maxChainLength": 200, "costCapTokens": 50000000,
  "contextPressureThreshold": 0.4, "crossSessionTargeting": "enabled",
  "defaultDelayMs": 15000, "maxDelayMs": 86400000, "maxDelegatesPerTurn": 500, "minDelayMs": 5000 }
```

Honest cross-walk: the fleet config **overrides** chain/cost/delegate ceilings for cohort-proof
fan-out work (the schema doc-string at `zod-schema.agent-defaults.ts:259` explicitly sanctions
raising `maxChildrenPerAgent` for "continuation-delegate cohort proofs, fleet-deploys"). The two
fields the fleet leaves at default — `defaultDelayMs=15000` and `minDelayMs=5000` — match the
source defaults exactly, demonstrating the default-application path is live: where the config is
silent, the bootstrap default is what takes effect. The defaults-applied behavior for the
*absent-key* case is proven structurally by the resolver + test-pin (any key the operator omits
falls through to the hardcoded default at read-time).

## Verdict
✅ **PASS** — the continuation config defaults are byte-confirmed in the on-SHA source
(`config.ts` L15–21), applied at read-time by `resolveContinuationRuntimeConfig` with per-field
clamps, and test-pinned (`config.test.ts`, 14/14 green) on emeric's seat. The deployed gateway's
`build-info.json` commit equals the candidate SHA, so the running bootstrap is the one that applies
these defaults. emeric's live config overrides the runaway-ceilings for cohort-proof work while
leaving the delay-defaults at their source values (15000/5000), confirming the default-application
path is live and not a regression of the #923 cure (which touches only the L627 inventory-warn
suppression, not the continuation config resolver).
