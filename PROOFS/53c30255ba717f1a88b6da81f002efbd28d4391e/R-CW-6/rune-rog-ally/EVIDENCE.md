# R-CW-6 — chain-depth-boundary reject (maxChainLength)

**Seat:** rune-rog-ally (Ryzen Z1 Extreme, x86)
**SHA:** `749f95b9b10aa3bbb804856acacc9073043ee772` (OpenClaw 2026.6.9, "drift re-absorb #2")
**Disposition:** ⚠️ **HONEST-LIMIT** — guard byte-verified present; live-induction impractical at the my-seat-pinned threshold.
**Filed by:** rune-dandelion-cult

## What R-CW-6 tests
The chain-DEPTH boundary: when a continuation/subagent chain reaches `maxChainLength` hops, the next hop must be REJECTED with `reason: "chain-length"`.

**Value-class precision (per Cael's correction `1518326897`):** R-CW-6 is the chain-DEPTH boundary → it tests **`maxChainLength`**, NOT `maxDelegatesPerTurn` (which is the per-turn fan-out WIDTH). My-seat-pinned values (byte-walked `openclaw.json` agents.defaults.continuation):
- `maxChainLength: 200` ← **the R-CW-6 boundary value (depth)**
- `maxDelegatesPerTurn: 500` (fan-out width — NOT what R-CW-6 tests)
- `costCapTokens: 50000000` (my-seat value; distinct from Cael's 500K — per-seat-divergence is real)

Pinned the silicon, then prescribed: the boundary proves against MY 200, not a carried number (my keeper `1513498589`).

## The guard is byte-verified PRESENT on 749f95b
`src/agents/subagent-announce.ts:1164` (full capture in `chain-depth-guard-byte.txt`):
```
const childChainHop = hopMatch ? Number.parseInt(hopMatch[1], 10) : 0;
const nextChainHop = childChainHop + 1;
...
if (childChainHop >= maxChainLength) {
  chainGuardResult = { allowed: false, reason: "chain-length", chainCount: nextChainHop, maxChainLength };
}
```
→ rejects with log `[subagent-chain-hop] Chain length ${chainCount} > ${maxChainLength}, rejecting hop from ${childSessionKey}` (`:1193`).

So the chain-depth guard fires when `childChainHop >= maxChainLength` (200 on this seat). The hop is parsed from `CONTINUATION_CHAIN_HOP_PATTERN` in the child task. The reject-shape (`allowed:false, reason:"chain-length"`) is structurally present + correct.

## Why HONEST-LIMIT (no live fire)
Live-inducing the reject requires a continuation chain to reach `childChainHop >= 200` — i.e. **200 sequential continuation hops**. At my-seat `minDelayMs: 5000`, that's ≥1000s of pure inter-hop delay before the boundary even trips, plus the per-hop work. Impractical to live-induce.

The alternative (lower `maxChainLength` to a small N to trip it at a low hop-count) would require editing `openclaw.json` (a **protected-config-path**) + restarting the live gateway — outside the "finish the rows the regular way" scope, and a modification of the running host. Not done.

So R-CW-6 = **guard-present-byte-verified, live-induction-impractical-at-maxChainLength=200-my-seat-pinned**. Same "note-why-no-live-fire" disposition as Silas's R-RC-1 (reject-shape carryover) + Cael's R-CW-MULTI-COLLAPSE-honest-limit.

## Net
The chain-depth-reject mechanism is byte-confirmed correct + present on `749f95b` at the my-seat-pinned `maxChainLength=200`; the live boundary-trip is impractical at that threshold (200 hops). Disposition: HONEST-LIMIT (guard-byte-verified).
