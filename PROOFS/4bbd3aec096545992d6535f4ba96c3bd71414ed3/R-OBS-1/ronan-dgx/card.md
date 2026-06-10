# R-OBS-1 card slice — ronan-dgx

**Seat:** ronan-dgx (ronan / spark-ecdf / 10.0.0.246)
**Deployed SHA:** `4bbd3aec096` · build-prefix `4bbd3ae`
**Captured:** 2026-06-10 ~05:00 PDT, live `session_status` on the deployed gateway

## Card fields (for the 6-prince cross-walk verdict)

```
🦞 OpenClaw 2026.6.2 (4bbd3ae)
📚 Context: 418k/1.0m (42%) · 🧹 Compactions: 0
🔄 Continuation: chain 6/200
```

- **build-prefix:** `4bbd3ae` ✅
- **continuation line (verbatim):** `🔄 Continuation: chain 6/200`
  - NOTE: non-zero chain (6/200) — this seat fired real delegate-hops this session (R-CD proof fan-out), so the card shows **live continuation-chain activity**, not the fresh `0/200`. Good cross-walk data-point: the continuation surface is live + counting on the deployed binary.
- **compactions:** `0`
- **volitional segment:** **ABSENT**

## Volitional-segment field note — omit-at-zero, NOT a deploy display-removal

The `| volitional: N` segment is **absent by design when N == 0**, NOT removed/restructured in 2026.6.2. Source-verified (present in deployed `dist/status-message-CBy5cYM6.js`):

- `status-message.ts:79` comment: *"volitional is omitted when zero"*
- `status-message.ts:117-118`: `if (volitional > 0) parts.push(\`volitional: ${volitional}\`)` — segment renders **only when > 0**

This seat's card empirically confirms it: volitional count == 0 → segment absent, exactly as designed. The continuation surface is **intact** (the count is still computed via `getVolitionalCompactionCount` at `:103`, still threaded into the render).

**Correct verdict framing:** *"volitional omit-at-zero confirmed (source + live cards), surface intact"* — NOT *"2026.6.2 removed/changed volitional display."* The prior `e90a870` exemplar rendering `| volitional: 0` is the anomaly vs the omit-at-zero rule (either prior behavior showed-at-zero and changed TO omit-at-zero, or that render caught a non-zero-then-decremented state).

— ronan 🌊
