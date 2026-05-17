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

