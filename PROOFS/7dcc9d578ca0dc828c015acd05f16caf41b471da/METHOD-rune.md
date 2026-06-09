# METHOD — Rune (🪨) rows, corpus `7dcc9d578ca0dc828c015acd05f16caf41b471da`

This document captures the procedure that produced the rune-seat proof rows on the history-preserving ship-SHA. It follows the corpus-shape canon (`PROOF-CORPUS-METHOD.md`) and the clawsweeper principle: **proof-SHA == push-SHA** — each row is fired fresh on the deployed `7dcc9d5` runtime.

## Substrate-frame

Test-suite pass + cohort byte-walk + tsgo-clean prove "the code compiles and obeys its type contracts." The proof corpus proves "the feature actually operates as designed on live deployed runtime, recoverable from external observation." These rune-seat rows certify the spawn-depth boundary and traceparent E2E threading on the live `7dcc9d5` runtime.

## Procedure (this corpus's run)

The two rows were fired from a **depth-1 subagent session** (`agent:main:subagent:43559507-db12-4ab0-b847-0a4297a5500a`) spawned by the rune main session. This is the natural test-bed: a depth-1 session IS the boundary case for `maxSpawnDepth=1`.

### R-CW-6 (spawn-depth boundary)

1. **Observe tool-policy enforcement**: at session assembly, the runtime resolves subagent role as `"leaf"` (because `depth=1 >= maxSpawnDepth=1`) and applies `subagent tools.deny`, stripping `continue_delegate` + `sessions_spawn` from the tool set.
2. **Capture the journal event**: `[agents/tool-policy] tool policy removed 10 tool(s) via subagent tools.deny: [...] continue_delegate, [...] sessions_spawn [...]` — this IS the boundary enforcement.
3. **Verify code anchors**: confirm the guard logic in the deployed build (`subagent-spawn-BazZsMM5.js`, `subagent-capabilities-zBNDNERf.js`, `delegate-dispatch-C2WZgM-l.js`) matches the behavioral observation.
4. **Document behavioral delta**: on 7dcc9d5, enforcement is tool-policy-layer (tools stripped preemptively) vs e66dc63f (tools offered, call accepted, dispatch-time reject). Same semantic outcome, stricter enforcement.

### R-CW-7 (traceparent E2E)

1. **Call `continue_work`** with a descriptive reason — capture the returned `traceparent` (trace-id + span-id).
2. **Extract structured log events** from the gateway file log — verify that ALL events for this session carry the SAME trace-id as the `continue_work` result.
3. **Map the span hierarchy**: confirm `parentSpanId` relationships prove proper parent-child span linking (not just coincidental trace-id sharing).
4. **Verify Tempo reachability**: query Tempo for rune-prince traces, attempt to fetch this specific trace. Document honestly whether it has landed or is pending flush.
5. **Provide cross-seat fetch key**: `http://tempo.dandelion.cult/api/traces/e55408592fb268c1c2a66e93373d804d` for independent verification by Tempo-networked seats.

## Verification tooling

- `journalctl --user -u openclaw-gateway` — gateway journal events (tool-policy, continuation-signal)
- Gateway file log (`/tmp/openclaw/openclaw-2026-06-08.log`) — structured JSON with `traceId`, `spanId`, `parentSpanId`
- `continue_work` tool result — the machine-readable traceparent proving continuation dispatch carries trace context
- `grep` across deployed dist (`/home/figs/flesh_beast_tmp/openclaw/dist/`) — code anchor verification
- `curl http://tempo.dandelion.cult/...` — Tempo reachability + trace search
- `openclaw --version` + `git rev-parse HEAD` at deploy tree — SHA confirmation

## Key finding: enforcement-layer upgrade on 7dcc9d5

The most significant observation from this fresh run vs the e66dc63f parent corpus: the spawn-depth boundary enforcement on 7dcc9d5 is **preemptive** (tool-policy-strip at session assembly) rather than **reactive** (dispatch-time-reject after call-acceptance). The `subagent-capabilities-zBNDNERf.js` role-resolution module (`depth < maxSpawnDepth ? "orchestrator" : "leaf"`) gates the tool-set composition, and `delegate-dispatch-C2WZgM-l.js` serves as defense-in-depth only.

This is a consequence of the upstream storage-refactor (the one differing core identified in the README's Gate 2 analysis): the refactored `subagent-spawn.ts` → `subagent-capabilities-zBNDNERf.js` module now drives tool-policy role assignment based on depth, creating a harder boundary than the prior dispatch-reject model.

## What this corpus slice does NOT contain

- Long-term reliability / 24h-stability data (point-in-time proof).
- Adversarial cases (traceparent forgery, malicious payloads) — separate security-corpus.
- Performance-regression data — separate perf-corpus.
- A confirmed Tempo span-tree fetch for this specific trace from rune-seat (trace pending flush; cross-seat fetch key provided).

## Cohort attribution

- 🪨 Rune — these two rows (R-CW-6, R-CW-7), fired + staged on rune-seat at depth-1
- 🌫 Silas — prior sub-row-1+2 on this SHA (dual-coverage, already committed at 56c16a3)
- figs — deploy + go-signal + clawsweeper directive
