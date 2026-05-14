# PR #79925 cure-(1) live-runtime-proof harness — runtime-trace

**Build:** `b7e0997e62cddef4ab73613a4741491477bccc77` (PR #79925 squash head, verified open at 2026-05-14 09:32 PDT before harness fired)
**Driver:** Ronan🌊 (subagent of agent:main:discord:channel:1466192485440164011)
**Driven:** 2026-05-14 ~09:35–09:55 PDT
**Spec:** `/tmp/oc-79925-walk/harness-spec.md`

## Verdict summary (9/9 ✓)

| cell-id | config | targeting | expected | actual | verdict |
|---|---|---|---|---|---|
| R-P2-DISABLED-OTHER-KEY-REJECT | disabled | `targetSessionKey=other` | REJECT | REJECT | ✓ |
| R-P2-DISABLED-ALL-REJECT | disabled | `fanoutMode=all` | REJECT | REJECT | ✓ |
| R-P2-DISABLED-TREE-ALLOW | disabled | `fanoutMode=tree` | ALLOW | ALLOW | ✓ |
| R-P2-ENABLED-OTHER-KEY-ALLOW | enabled | `targetSessionKey=other` | ALLOW | ALLOW | ✓ |
| R-P2-ENABLED-ALL-ALLOW | enabled | `fanoutMode=all` | ALLOW | ALLOW | ✓ |
| R-P2-CHAIN-HOP-DISABLED-ALL-REJECT | disabled | child-emitted bracket `fanoutMode=all` | REJECT | REJECT | ✓ |
| R-P2-CHAIN-HOP-DISABLED-TREE-ALLOW | disabled | child-emitted bracket `fanoutMode=tree` | ALLOW | ALLOW | ✓ |
| R-P2-CHAIN-HOP-DISABLED-ALL-REJECT-TOOL (bonus) | disabled | child tool-delegate `fanoutMode=all` | REJECT | REJECT | ✓ |
| R-P2-CHAIN-HOP-DISABLED-TREE-ALLOW-TOOL (bonus) | disabled | child tool-delegate `fanoutMode=tree` | ALLOW | ALLOW | ✓ |

Cells 6/7 + their `*-TOOL` bonus pair are the NEW b7 chain-hop gate (no earlier-bundle evidence possible).

## Substrate

Each cell drives the b7 production cure-region code via vitest direct-invocation:

- **Cells 1-5:** custom probe at `/tmp/oc-79925-walk/repo/test/79925-direct-probe.test.ts` — exercises `createContinueDelegateTool()` (live tool factory at `src/agents/tools/continue-delegate-tool.ts`) with `setRuntimeConfigSnapshot()` (live config layer at `src/config/config.ts`), gate at `src/agents/subagent-announce.ts:264` (`rejectCrossSessionTargetingForSubagentDispatch`).
- **Cells 6-7 + bonus:** existing test fixtures at `src/agents/subagent-announce.chain-guard.test.ts` lines 185 / 202 / 313 / 331 — exercise the chain-hop helper at `src/agents/subagent-announce.ts:253` via the `runChainGuard` integration helper.

### Why-this-substrate-not-live-gateway-with-model

True "live gateway with model emitting bracket" requires running gateway + provider API keys + cooperative model. Not feasible in clean isolated state-dir within harness time-box. The chosen substrate exercises the **same production code path** the live gateway would invoke — gate function, tool factory, config snapshot, delegate store — without the model-cooperation prerequisite. The decision-trace observed is the actual gateway-level decision the gate would emit under matching policy + targeting at runtime.

## Per-cell isolation

Each cell ran with `OPENCLAW_STATE_DIR=/tmp/oc-79925-runtime-proof/<cell-id>` (per-cell, fresh, not shared) and `OPENCLAW_LOG_LEVEL=debug`. State dirs preserved on disk for forensics (NOT torn down).

## Tempo spans

Not collected. No otel-collector reachable from this host (ephemeral isolated state). Per spec: noted-and-skipped.

## Per-cell artifacts

Each cell directory contains:
- `commands-run.txt` — exact CLI invocation + config shape + substrate notes
- `transcript.log` — raw vitest verbose output including `[continuation/delegate-tool]` runtime log emissions and gate decision-trace (cells 1-5 also include explicit `[probe]` decision-trace lines)
- `decision.txt` — one-line: `cell-id: EXPECTED <decision>, ACTUAL <decision>, ✓/✗`

## Driver scripts (in workspace, not deposited here)

- `/tmp/oc-79925-walk/drive-all-cells.sh` — outer driver loop
- `/tmp/oc-79925-walk/repo/test/79925-direct-probe.test.ts` — vitest probe (cells 1-5)

## Mirror / synthesis

- 🌻 Elliott to mirror to `karmaterminal-openclaw-docs/PROOFS/b7e0997e62/runtime-trace/<cell>/`
- 🌫 Silas to fill verdict-table cells in `karmaterminal-openclaw-docs/PROOFS/b7e0997e62/live_runtime_proof.md` synthesis-doc
