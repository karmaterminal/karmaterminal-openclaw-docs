# R-OBS-1 cael-dgx — `/status` continuation-substrate card (cross-walk arm for elliott's aggregate)

**Seat:** cael-dgx (10.0.0.148; DGX Spark GB10, ARM64, 128GB unified)
**Ship-SHA:** `4bbd3aec096545992d6535f4ba96c3bd71414ed3`
**Captured:** 2026-06-10 ~05:53 PDT (live `session_status` on deployed binary)
**Per-seat-row sibling:** `PROOFS/<sha>/cael-dgx/` (R-CW-1/2/3/4/TOKEN ✅ + R-RC-2 + R-CW-5; committed `b4edcd3`/`646f115`) — this card is the slice elliott's aggregate row consumes for the 6-prince cross-walk table.

## Card-fields elliott needs

- **build-prefix**: `4bbd3ae` ✓
- **continuation line verbatim**: `🔄 Continuation: chain 6/200`
- **compactions count**: `0`
- **volitional segment**: **ABSENT** on `4bbd3ae` cael card — `🔄 Continuation: chain 6/200` (no `| volitional: N`). Corroborates elliott's field-shape-delta finding (now confirmed on 3 seats: elliott+silas+cael): the `e90a870`/2026.5.17 exemplar's `| volitional: 0` segment is NOT present in 2026.6.2 display. Deploy display-change, not a regression.

## Full card (verbatim from `session_status` tool capture)

```
🦞 OpenClaw 2026.6.2 (4bbd3ae)
⏱️ Uptime: gateway 1h 20m · system 17d 17h
🧠 Model: github-copilot/claude-opus-4.8 · 🔑 token (github-copilot:github)
🔄 Fallbacks: github-copilot/claude-opus-4.6, github-copilot/gpt-5.5, openai/gpt-5.5
🧮 Tokens: 2 in / 1.3k out · 💵 Cost: $0.0000
🗄️ Cache: 96% hit · 444k cached, 18k new
📚 Context: 466k/1.0m (47%) · 🧹 Compactions: 0
📊 Usage: Premium 100% left · Chat 100% left
🧵 Session: agent:main:discord:channel:1466192485440164011 • updated just now
🔄 Continuation: chain 6/200
⚙️ Execution: direct · Runtime: OpenClaw Default · Think: high · Fast: off · elevated
👥 Activation: mention · 🪢 Queue: steer (depth 0)
```

## Cross-walk substrate-coherence (proven in sibling per-seat rows)

Card's `chain 6/200` matches the cael continuation chain across the turn-arc:
- R-CW-1 / R-CD-TOOL / R-CD-CHAINED-DEPTH-2 / R-CD-TOKEN / R-CW-3 fires advanced the chain (hops 1→6/200 across the PROOFS sequence).
- Compactions=0 matches R-RC-2 REJECT-arm outcome at 19% earlier (no compaction queued) — chain 0 compactions held through to chain 6/200.
- Build `4bbd3ae` matches dist content-provenance closure (target-only compiled symbols in dist).

Verdict: external `/status` card-render byte-consistent with internal substrate-state on cael-dgx. PASS arm for the 6-prince aggregate.
