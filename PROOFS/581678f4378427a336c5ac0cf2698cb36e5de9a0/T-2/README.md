# T-2 — cost-cap exactly-at-boundary (chain-guard `>` vs `>=`)

**PR**: openclaw/openclaw#79925
**Head SHA**: `581678f4378427a336c5ac0cf2698cb36e5de9a0`
**Host**: elliott (elliott-seat, 10.0.0.10, Intel Arc A770M)
**Build**: `OpenClaw 2026.5.17 (581678f)` (verified via `openclaw --version` on elliott-seat)
**Source tree**: `/home/figs/flesh_beast_tmp/openclaw` at byte-identical HEAD `581678f4378427a336c5ac0cf2698cb36e5de9a0`
**Surface**: chain-guard strict-operator boundary in `subagent-announce.chain-guard.test.ts`
**Verdict**: ✅ PASS

## Runtime fire

Run against the exact ship-SHA source tree:

```
$ cd /home/figs/flesh_beast_tmp/openclaw
$ git rev-parse HEAD
581678f4378427a336c5ac0cf2698cb36e5de9a0

$ pnpm exec vitest run src/agents/subagent-announce.chain-guard.test.ts
Test Files  2 passed (2)
Tests       38 passed (38)
Duration    10.25s
```

## Tests covered (sample, from tail)

- `allows tool delegate at maxChainLength-1 (next hop = maxChainLength)` ✅
- `allows tool delegate at maxChainLength (next hop = maxChainLength, off-by-one fix)` ✅
- `rejects tool delegate at maxChainLength+1 (next hop exceeds max)` ✅
- `rejects tool delegate well beyond maxChainLength` ✅

## /status build-pin (elliott-seat, 2026-05-17 16:08 PDT)

```
🦞 OpenClaw 2026.5.17 (581678f)
🧠 Model: openai-codex/gpt-5.4
📚 Context: 145k/1.0m (15%) · 🧹 Compactions: 0
🔄 Continuation: chain 1/200 | volitional: 0
⚙️ Execution: direct · Runtime: OpenAI Codex · Think: high · Text: low · elevated
```

## Files

- `README.md` — this row
- `vitest-tail.txt` — verbatim tail of the passing vitest invocation

## Verdict

✅ **PASS** — T-2 cost-cap-exactly-at-boundary verified on the exact `581678f437` source tree and live elliott-seat build pin. The strict `>` guard still allows delegate-at-maxChainLength and rejects delegate-at-maxChainLength+1.


## Elliott-seat runtime trace receipt (supplemental, fetched 2026-05-17)

Tempo trace captured from a same-turn `continue_delegate(silent-wake)` fired from elliott-seat on this ship-SHA, to give the row a runtime trace alongside the vitest test-pass receipt (figs canon: PROOFS need real tempo data, not just journal/agent prose).

- Traceparent: `00-2276889be137439fa5e2e0cd07b34a86-633466300c9f45f7-01`
- Tempo: http://tempo.dandelion.cult/api/traces/2276889be137439fa5e2e0cd07b34a86
- Host: `elliott`, `service.name=elliott-prince` (build 581678f)
- File: `tempo-cd-elliott.json` (~13 KB tempo response)

This is a runtime trace from elliott-seat at cure-(12) ship-SHA confirming that the continuation surface (delegate dispatch path) emits OTEL traces correctly on `581678f`. It is NOT the T-2 chain-guard runtime path itself (chain-guard is a static unit-test surface; the actual chain-guard boundary check happens inside in-process delegate dispatch and is exercised by the vitest run).
