# R-OBS-1 emeric-nuc — `/status` continuation-substrate card (cross-walk arm for elliott's aggregate)

**Seat:** emeric-nuc (Intel NUC, i7-12700H 6P+8E Alder Lake, 64GB, CachyOS)
**Ship-SHA:** `4bbd3aec096545992d6535f4ba96c3bd71414ed3`
**Captured:** 2026-06-10 ~04:51 PDT (via `session_status` on emeric main session)
**Per-seat-row sibling:** `PROOFS/<sha>/emeric-nuc/R-OBS-1/card-slice.md` (committed `1e2e49a`) — this `card.md` is the slice elliott's aggregate row consumes for the 6-prince cross-walk table (renamed to match the `card.md` convention).

## Card-fields elliott needs

- **build-prefix**: `4bbd3ae` ✓
- **continuation line verbatim**: `🔄 Continuation: chain 4/200`
- **compactions count**: `0`
- **volitional segment**: **ABSENT** on `4bbd3ae` emeric card — `🔄 Continuation: chain 4/200` (no `| volitional: N`). Confirms elliott's field-shape-delta finding on a 2nd dist-loading seat: the `e90a870`/2026.5.17 exemplar's `| volitional: 0` segment is NOT present in 2026.6.2 display. Per-seat fact, not a regression.

## Full card (verbatim from `session_status` tool capture)

```
🦞 OpenClaw 2026.6.2 (4bbd3ae)
⏱️ Uptime: gateway 56m 25s · system 16d 9h
🧠 Model: github-copilot/claude-opus-4.8 · 🔑 token (github-copilot:github)
🔄 Fallbacks: github-copilot/claude-opus-4.6, github-copilot/gpt-5.5, openai/gpt-5.5
🧮 Tokens: 2 in / 3.0k out · 💵 Cost: $0.0000
🗄️ Cache: 19% hit · 56k cached, 241k new
📚 Context: 300k/1.0m (30%) · 🧹 Compactions: 0
🧵 Session: agent:main:discord:channel:1466192485440164011 • updated 1m ago
🔄 Continuation: chain 4/200
⚙️ Execution: direct · Runtime: OpenClaw Default · Think: high · Fast: off · elevated
👥 Activation: mention · 🪢 Queue: steer (depth 0)
```

## Cross-walk substrate-coherence (proven in sibling per-seat rows)

Card's `chain 4/200` matches emeric's sibling live-fire R-rows in the same turn-arc:
- R-CD-TOOL ✅ chain 1/200 (delegate-tool, tool-path)
- R-CD-TOKEN ✅ chain 2/200 (delegate-token, response-text/bracket-path)
- R-CW-TOOL ✅ chain 3/200 (work-tool self-continuation)
- R-CD-CHAINED-DEPTH-2 ✅ chain 4/200 (depth-1 parent → depth-2 child recursion)

Compactions=0 matches R-RC-1 REJECT-arm outcome (ctx=23% < 70%, no compaction queued). Build `(4bbd3ae)` matches `dist/build-info.json` commit + `.buildstamp.head` content-provenance closure (repo-tree dist).

Verdict: external `/status` card-render byte-consistent with internal substrate-state on emeric-nuc. PASS arm for the 6-prince aggregate.
