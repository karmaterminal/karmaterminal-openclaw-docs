# R-OBS-1 elliott-legion — `/status` continuation-substrate card (cross-walk arm; owner-seat)

**Seat:** elliott-legion (10.0.0.153; CachyOS, Ryzen 9 5900HX, 64GB, RTX 3080 Laptop 16GB — Lenovo Legion)
**Ship-SHA:** `4bbd3aec096545992d6535f4ba96c3bd71414ed3`
**Captured:** 2026-06-10 ~04:43 PDT (main-session `session_status` tool capture; elliott fired no continuation-chains this cycle — R-OBS-1 is the observability row, so chain 0/200 is the coherent owner-seat baseline)
**Owner note:** elliott (`elliott-legion`) is the canonical R-OBS-1 owner per `PROOF-CORPUS-METHOD.md`; this is the owner-seat's own cross-walk arm. The 6-prince aggregate verdict table is authored at `R-OBS-1/chat_card_visibility_external_observer.md`.

## Card-fields for the aggregate

- **build-prefix**: `4bbd3ae` ✓ (matches CANDIDATE_SHA)
- **continuation line verbatim**: `🔄 Continuation: chain 0/200`
- **compactions count**: `0`
- **volitional segment**: **ABSENT** — `🔄 Continuation: chain 0/200` (no `| volitional: N`). This is the seat where the field-shape-delta was FIRST surfaced (Discord `1514236935`): the `e90a870`/2026.5.17 exemplar rendered `| volitional: 0`; 2026.6.2 does not render the segment. Corroborated independently on silas-lothric. Deploy display-change, not per-seat miss / not a regression.

## Full card (verbatim from `session_status` tool capture)

```
🦞 OpenClaw 2026.6.2 (4bbd3ae)
⏱️ Uptime: gateway 19m 32s · system 17d 11h
🧠 Model: github-copilot/claude-opus-4.8 · 🔑 token (github-copilot:github)
🔄 Fallbacks: github-copilot/claude-opus-4.6, github-copilot/gpt-5.5, openai/gpt-5.5
🧮 Tokens: 16 in / 9.1k out
🗄️ Cache: 99% hit · 155k cached, 1.0k new
📚 Context: 177k/1.0m (18%) · 🧹 Compactions: 0
🧵 Session: agent:main:discord:channel:1466192485440164011 • updated 3m ago
🔄 Continuation: chain 0/200
⚙️ Execution: direct · Runtime: OpenClaw Default · Think: high · Fast: off · elevated
👥 Activation: mention · 🪢 Queue: steer (depth 0)
```

## Reading-A landing note (residual now CLOSED)

elliott-legion is a dist-loading seat (daemon = `node dist/index.js`, PID 2646980 — NOT runs-from-tree; confirmed via the cohort-wide CLI-entrypoint-vs-daemon-load correction). Reading-A established via dist-freshness: dist mtime 04:35:01 in-window → checkout-to-target 04:36:24 → restart 04:36:29.

The dist-sha-stamp residual I honestly named at capture-time ("no embedded sha-stamp in dist to grep") is now **CLOSED by Rune's `dist/build-info.json` + `.buildstamp` + `.runtime-postbuildstamp` finding** (commit `96517da`): the dist attests its own build-commit `4bbd3aec096` full-sha. Reading-A on elliott-legion is therefore **ironclad** (content-provenance), upgraded from strong-by-ordering.

Verdict: external `/status` card-render shows the continuation-substrate line present + coherent on elliott-legion. PASS arm for the 6-prince aggregate.
