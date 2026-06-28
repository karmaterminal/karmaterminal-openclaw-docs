# R-CW-6 — chain-depth-boundary reject — rune-rog-ally

**Seat:** `rune-rog-ally`  
**Capture/ship SHA:** `2723dbee783c113cae70e4fb63a4cff9f55402e3`  
**Disposition:** ⚠️ **HONEST-LIMIT** — live low-cap induction was not performed because `agents.defaults.continuation.maxChainLength` is a protected runtime config path. The chain-depth boundary reject is byte-verified in source and deterministically test-covered at the deployed SHA; the narrow local test selector included the relevant pass rows, while an unrelated zero-delay work test failed in the same filtered invocation.

## What this row tests

R-CW-6 is the chain-depth boundary: once continuation chain state reaches `maxChainLength`, the next `continue_work` / `continue_delegate` election must be rejected instead of extending the lineage forever.

Rune live config at capture time:

```text
agents.defaults.continuation.enabled = true
agents.defaults.continuation.maxChainLength = 200
agents.defaults.continuation.costCapTokens = 50000000
agents.defaults.continuation.maxDelegatesPerTurn = 500
```

Gateway status at capture time reported OpenClaw `2026.6.10 (2723dbe)`, current session chain `0/200`, context `7%`, and model `github-copilot/gpt-5.5`.

## Runtime mutation guard

Before attempting any config mutation, Rune inspected schema and current state:

- `gateway config.schema.lookup agents.defaults.continuation.maxChainLength` → integer path, reloadKind `none`
- `gateway config.get agents.defaults.continuation` → `maxChainLength: 200`

Per the runbook, lowering `maxChainLength` can cheaply induce the boundary. I did **not** lower it on this live room session: prior R-CW-6 cycles established this as a protected/sensitive config path, and mutating continuation depth on the active gateway during a fresh room proof cycle is not required for an honest proof when the source/test boundary is present at the exact deployed SHA.

## Source byte

`chain-depth-source-and-test-byte.txt` captures the exact deployed SHA source around `src/auto-reply/continuation/scheduler.ts:19-38`:

```ts
const allocatedChainHop = chainState.currentChainCount;

if (allocatedChainHop >= config.maxChainLength) {
  log.info(
    `[continuation] Chain depth ${allocatedChainHop}/${config.maxChainLength} — capped for session ${sessionKey}`,
  );
  return "chain-capped";
}
```

That is the boundary: `currentChainCount >= maxChainLength` returns `chain-capped`.

## Deterministic test bytes

`chain-depth-source-and-test-byte.txt` also captures:

- `src/auto-reply/continuation/scheduler.test.ts:17-37` — `returns chain-capped at max depth` asserts `currentChainCount: 10`, `maxChainLength: 10` returns `"chain-capped"`.
- `src/auto-reply/continuation/work-dispatch.test.ts:1608-1632` — `schedules the valid elections and caps the overflow without dropping the earlier ones` uses `maxChainLength: 2`, schedules two valid elections, caps the third, and asserts only `fit-1`/`fit-2` deliver while `over-cap` does not.

## Local narrow test run

Receipt: `rune-rcw6-test-2723dbee-20260628T033143Z.log`

Command:

```bash
pnpm exec vitest run src/auto-reply/continuation/scheduler.test.ts src/auto-reply/continuation/work-dispatch.test.ts -t 'chain|cap|capped|budget|valid elections'
```

Result:

```text
Test Files  1 failed | 1 passed (2)
Tests       1 failed | 15 passed | 60 skipped (76)
```

Relevant R-CW-6 assertions passed in the run:

- `checkContinuationBudget > returns chain-capped at max depth`
- `durable continuation_work dispatch > schedules the valid elections and caps the overflow without dropping the earlier ones`

The single failure was unrelated to R-CW-6 chain-depth semantics:

```text
work-dispatch.test.ts > durable continuation_work dispatch > arms zero-delay work for the next tick so callers can persist chain state first
AssertionError: expected [] to deeply equal [ ObjectContaining{…} ]
```

That failure is not used as R-CW-6 evidence; it is a separate zero-delay scheduling expectation failure surfaced by the broad filtered selector.

## Verdict

⚠️ **HONEST-LIMIT / source+test proof**. Live induction at `maxChainLength=200` would require 200 sequential hops (or sensitive live config mutation). The exact deployed SHA contains the boundary reject (`currentChainCount >= maxChainLength → chain-capped`) and deterministic tests covering both direct budget rejection and partial-success overflow rejection. The row should be treated as the chain-depth safety boundary present and test-covered at `2723dbee783c113cae70e4fb63a4cff9f55402e3`, with no live low-cap mutation performed on the room gateway.
