# T-2 — cost-cap exactly-at-boundary (chain-guard `>` vs `>=`)

**PR**: openclaw/openclaw#79925
**Head SHA**: `52262fff7ff86b2c0fb0266a1f524067e84e1412`
**Host**: elliott (elliott-seat, 10.0.0.10, Intel Arc A770M)
**Build**: `OpenClaw 2026.5.17 (52262ff)` (verified via `openclaw --version` on elliott-seat)
**Surface**: chain-guard strict-operator boundary in `subagent-announce.chain-guard.test.ts`
**Verdict**: ✅ PASS

## Substrate-new in cure-(11)

Cohort-bank from `PROOFS/decc4153b9/README.md`:

> **T-2 cost-cap-exactly-at-boundary** — chain-guard `>` vs `>=` strict-operator behavior

New commit on candidate from 🩸 cael:

```
8f58ad3e70 — cael-dandelion-cult — test(continuation): pin cost-cap exactly-at-boundary (> not >=) (T-2)
```

This row pins the off-by-one fix: chain-guard rejects when `nextToolHop > toolMaxChainLength` (strict greater-than), so a delegate AT `maxChainLength` is allowed (next hop = maxChainLength) but a delegate at `maxChainLength+1` is rejected.

## Runtime fire

Run on elliott-seat at byte-identical ship-SHA `52262fff7f`:

```
$ openclaw --version
OpenClaw 2026.5.17 (52262ff)

$ npx vitest run src/agents/subagent-announce.chain-guard.test.ts
 Test Files  2 passed (2)
      Tests  38 passed (38)
   Start at  15:07:55
   Duration  10.11s
```

## Tests covered (sample, from verbose run)

- `allows tool delegate at maxChainLength-1 (next hop = maxChainLength)` ✅
- `allows tool delegate at maxChainLength (next hop = maxChainLength, off-by-one fix)` ✅ ← **T-2 boundary**
- `rejects tool delegate at maxChainLength+1 (next hop exceeds max)` ✅ ← **T-2 boundary**
- `rejects tool delegate well beyond maxChainLength` ✅
- `respects custom maxChainLength for tool delegates` ✅
- `rejects child tool-delegate fanout=all when cross-session targeting is disabled` ✅
- `allows child tool-delegate fanout=tree when cross-session targeting is disabled` ✅

Full 38/38 in 10.11s under 2 vitest projects (`agents-core` + `agents-support`).

## /status build-pin (elliott-seat, 2026-05-17 12:11 PDT)

```
🦞 OpenClaw 2026.5.17 (52262ff)
🧠 Model: github-copilot/claude-opus-4.7-1m-internal
🧵 Session: agent:main:discord:channel:1466192485440164011
🔄 Continuation: chain 1/200 | volitional: 0
⚙️ Execution: direct · Runtime: OpenClaw Pi Default · Think: high · elevated
```

## Files
- `README.md` — this row
- `vitest-tail.txt` — verbatim tail of `npx vitest run` invocation

## Verdict

✅ **PASS** — T-2 cost-cap-exactly-at-boundary verified on `52262fff7f` runtime from elliott-seat. The off-by-one fix from `8f58ad3e70` holds: chain-guard strict `>` operator allows delegate-at-maxChainLength and rejects delegate-at-maxChainLength+1.
