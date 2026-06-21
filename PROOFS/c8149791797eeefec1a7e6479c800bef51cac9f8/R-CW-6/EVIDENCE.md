# R-CW-6 — chain-depth-boundary reject — rune-rog-ally seat

**Verdict: ⚠️ HONEST-LIMIT** — the live temp-low-cap capture is blocked by a protected config-path; the chain-depth-boundary reject behavior is byte-verified + deterministically test-proven GREEN at the ship SHA. (Structural-finding-of-difficulty is itself the proof, per the runbook's "PASS-shape structurally blocked" option.)

- **Seat:** `rune-rog-ally` (ASUS ROG Ally Z1 Extreme, 16GB CachyOS x86_64)
- **Ship SHA:** `93ace21341bf13a08f9bf75791f8ac70cf9542a5`
- **Behavior:** chain-depth-boundary reject — a continuation chain that reaches `maxChainLength` is rejected at the dispatcher (`currentChainCount >= maxChainLength → reject hop`).

## The HONEST-LIMIT — why the live temp-low-cap capture is blocked

The runbook's temp-low-cap method (set `maxChainLength` low → fire a chain to exceed it → capture the reject → restore) requires mutating `continuation.maxChainLength`. On the deployed gateway, **that path is PROTECTED** — `gateway config.patch` refuses it:

```
config.patch agents.defaults.continuation.maxChainLength
→ ERROR: gateway config.patch cannot change protected config paths: agents.defaults.continuation.maxChainLength
```

So the on-demand live-induction is gated by the protected-config-path safety surface (the gate engaging is itself an honest-finding: the chain-depth ceiling is not casually mutable at runtime). Live config value: `agents.defaults.continuation.maxChainLength = 200` (default 10), recorded; not altered.

## The behavior IS proven — byte-verified reject logic + deterministic test GREEN

**Reject logic byte-verified** (`subagent-announce.ts` at ship SHA, `reject_logic_byte.txt`):
```
:1023   | { allowed: false; reason: "chain-length"; chainCount; maxChainLength }
:1029   allowed: false, reason: "chain-length"   (when chain depth exceeds maxChainLength)
:1054   if (reason === "chain-length") log:
          [subagent-chain-hop] Chain length ${chainCount} > ${maxChainLength}, rejecting hop from ${childSessionKey}
```

**Deterministic test GREEN at the ship SHA** (`chain_depth_test_green.txt`):
```
npx vitest run delegate-dispatch.chain-depth-exhaustion.test.ts
  ✓ 3 tests passed (3/3)
  - "rejects a delegate when currentChainCount equals maxChainLength"  (10>=10 → reject)
  - "accepts a delegate at count 9/10, then rejects the next at 10/10" (boundary: 9 accept, 10 reject)
```

The boundary-reject is exactly the discipline-floor concept (the chain-depth ceiling as a safety boundary): the dispatcher accepts up to the limit, rejects at/past it, byte-verified + test-proven on the ship SHA.

## Disposition

⚠️ HONEST-LIMIT. The live temp-low-cap capture is blocked by the protected-config-path (the safety-surface engaging is the honest-finding). The chain-depth-boundary reject behavior is byte-verified (the reject logic) + deterministically test-proven (3/3 GREEN) at the ship SHA. The boundary fires as-designed; this is the safety surface working, framed per the runbook's structural-finding option. Stone-axis-substrate-of-record-witness shape (the boundary as discipline-floor).
