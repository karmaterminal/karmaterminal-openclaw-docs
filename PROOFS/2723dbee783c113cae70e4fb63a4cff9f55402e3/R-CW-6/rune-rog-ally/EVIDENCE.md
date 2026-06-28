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

## Source/test bytes

`chain-depth-source-and-test-byte.txt` also captures:

- `src/auto-reply/continuation/scheduler.test.ts:17-37` — `returns chain-capped at max depth` asserts `currentChainCount: 10`, `maxChainLength: 10` returns `"chain-capped"`.
- `src/auto-reply/continuation/work-dispatch.test.ts:1608-1632` — `schedules the valid elections and caps the overflow without dropping the earlier ones` uses `maxChainLength: 2`; the captured assertions prove the batch accounting surface: `scheduledCount: 2`, `cappedCount: 1`, `capped: true`, and `chainState.currentChainCount: 2`.

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

Safe R-CW-6 carry from the broad filtered run plus follow-up seat checks:

- `checkContinuationBudget > returns chain-capped at max depth` passed in Rune's broad filtered run.
- The work-dispatch cap-scheduling/accounting assertions are consistent at the source/test byte: `scheduledCount: 2`, `cappedCount: 1`, `capped: true`, `chainState.currentChainCount: 2`.
- Do **not** carry the full work-dispatch test as deterministic/green coverage. Independent follow-up from Ronan/Elliott/Silas isolated the work-dispatch delivery side as red/fragile on multiple seats: the later delivery assertion observes `deliveredReasons=[]` instead of two delivered valid wakes. Therefore this row cites source boundary + direct scheduler unit + cap-accounting evidence only, not full work-dispatch delivery coverage.

The single failure in Rune's broad filtered run was unrelated to R-CW-6 chain-depth semantics:

```text
work-dispatch.test.ts > durable continuation_work dispatch > arms zero-delay work for the next tick so callers can persist chain state first
AssertionError: expected [] to deeply equal [ ObjectContaining{…} ]
```

That failure is not used as R-CW-6 evidence; it is a separate zero-delay scheduling expectation failure surfaced by the broad filtered selector.

## Low-cap live-fire attempt after initial filing

After this row was first filed, Rune attempted a temporary low-cap induction on the room gateway. This attempt is retained as an audit receipt, but it **does not upgrade** the row from HONEST-LIMIT to PASS.

Receipt dir: `lowcap-attempt-20260628T034259Z/`

What happened:

1. Rune backed up `/home/figs/.openclaw/openclaw.json` and changed only continuation `maxChainLength: 200 → 2`; `costCapTokens` remained `50000000`.
2. Restart workflow `karmaterminal/openclaw-bootstrap/actions/runs/28310367530` completed successfully and `session_status` reported continuation chain `0/2`.
3. Rune queued three `continue_delegate(mode=silent)` tool calls intended as fit-1, fit-2, and over-cap.
4. The same turn hit the live `#1110` incomplete-turn class (`payloads=0 tools=5 replaySafe=no`) and the queued delegates were not consumed before Rune restored config.
5. Rune restored `maxChainLength: 200` from backup and restart workflow `28310449439` completed successfully.
6. After the restore/restart, delegate recovery replayed the three queued delegates under restored config, not low-cap config:
   - journal: `Consuming 3 tool delegate(s)`
   - journal: `hop=2/200`, `hop=3/200`, `hop=4/200`
   - journal: `continuation-delegate-recovery ... dispatched=3 rejected=0`
   - transcripts: `R-CW6-LOWCAP-FIT-1`, `R-CW6-LOWCAP-FIT-2`, and `R-CW6-LOWCAP-OVERCAP-RAN` all ran.

Interpretation: the third delegate running proves this was **not** a valid `maxChainLength=2` cap proof. It is useful negative/diagnostic evidence for the interaction between queued continuation delegates, gateway restart, recovery replay, and `#1110`, but not an acceptance proof for R-CW-6.

## Verdict

⚠️ **HONEST-LIMIT / source-boundary + cap-scheduling evidence only**. Live low-cap induction was attempted after initial filing but invalidated by restart/recovery timing: the over-cap delegate ran after restore under `maxChainLength=200` (`hop=4/200`, `dispatched=3 rejected=0`). The exact deployed SHA still contains the boundary reject (`currentChainCount >= maxChainLength → chain-capped`), the direct scheduler unit covers boundary rejection, and the work-dispatch batch accounting assertions are consistent (`scheduledCount: 2`, `cappedCount: 1`, `capped: true`). The row should not be described as full deterministic work-dispatch coverage: delivery/timer dispatch is red/fragile on multiple seats (`deliveredReasons=[]`). Preserve the invalid low-cap attempt and delivery/timer red as diagnostic evidence, not PASS evidence.
