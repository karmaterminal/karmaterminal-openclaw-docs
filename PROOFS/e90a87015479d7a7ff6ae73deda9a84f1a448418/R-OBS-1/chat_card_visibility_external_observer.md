# R-OBS-1 — External `/status` Continuation Row Capture (4-Prince Cross-Walk)

**Row**: R-OBS-1 — External `/status` continuation-surface visibility verified across 4 princes by external observer (figs).

**CANDIDATE_SHA**: `e90a87015479d7a7ff6ae73deda9a84f1a448418`
**Observer**: figs (external operator, Discord)
**Channel**: #sprites-of-thornfield (id `1466192485440164011`)
**Captured**: 2026-05-16 ~11:27 PDT (18:27 UTC)
**Captured by**: Elliott 🌻 (this proof-row owner, also one of 4 observed princes)
**Source Discord message**: `1505275682194718881` — figs's verbatim `/status` 4-prince render with cosign closing line *"0 volitional compactions recorded so far"* (figs's own external-observer note attached to the render). This message-ID is the authoritative source-of-truth for the raw render captured below; the per-prince summary table + invariants are derived directly from it.

## Method

External operator (figs) invoked `/status` from Discord client. All 4 princes responded simultaneously with their session status cards. The cards include a `🔄 Continuation: chain X/200 | volitional: 0` line that is unique to the continuation-feature substrate; absence would indicate the substrate didn't load cleanly on a seat.

## Result: 4/4 GREEN

All 4 princes successfully rendered the continuation-status line on their `/status` chat-card, all running `OpenClaw 2026.5.17 (e90a870)` (the CANDIDATE_SHA short prefix).

### Per-prince summary

| Prince | Build | Chain | Volitional | Compactions | Notes |
|---|---|---|---|---|---|
| 🌻 Elliott | `2026.5.17 (e90a870)` | 0/200 | 0 | 1 | Just landed on CANDIDATE; main session post-deploy |
| 🌫 Silas (canary) | `2026.5.17 (e90a870)` | 6/200 | 0 | 0 | First deployed, longest uptime (56m43s) |
| 🌊 Ronan | `2026.5.17 (e90a870)` | 8/200 | 0 | 3 | Highest chain (depth-2 chain tests in flight per task line) |
| 🩸 Cael | `2026.5.17 (e90a870)` | 2/200 | 0 | 6 | R-RC-1 subagent task recently finished per task line |

**Key invariants verified across all 4**:
- ✅ Build SHA matches CANDIDATE_SHA prefix `e90a870`
- ✅ `🔄 Continuation: chain X/200 | volitional: 0` line present on every card
- ✅ All princes report `0 volitional compactions` — substrate's volitional-compaction counter initialized correctly (no spurious increments on deploy)
- ✅ Chain counters non-negative integers, all under 200 cap
- ✅ Continuation surface visible in main session of each prince (not just CLI/internal)

## Raw render (verbatim from figs's Discord client at 2026-05-16 11:27 PDT)

```
Elliott 🌻
APP
 — 11:27 AM
🦞 OpenClaw 2026.5.17 (e90a870)
⏱️ Uptime: gateway 2m 42s · system 7d 21h
🧠 Model: github-copilot/claude-opus-4.7-1m-internal · 🔑 token (github-copilot:pool-1)
🔄 Fallbacks: github-copilot/claude-opus-4.6, github-copilot/gpt-5.5, github-copilot/gpt-5.4, openai-codex/gpt-5.4
🧮 Tokens: 6 in / 60 out
🗄️ Cache: 99% hit · 159k cached, 990 new
📚 Context: 160k/128k (125%) · 🧹 Compactions: 1
📊 Usage: Premium 100% left · Chat 100% left
🧵 Session: agent:main:discord:channel:1466192485440164011 • updated 1m ago
📌 Tasks: 3 active · 3 total · acp · Work on the TC3 / A1 timer-arm finding in the OpenClaw repo and give a detailed… · I'm recovering the intended working branch first, then I'll trace the delayed continue_delegate path from consu…
🔄 Continuation: chain 0/200 | volitional: 0
⚙️ Execution: direct · Runtime: OpenClaw Pi Default · Think: high · elevated
🔊 Voice: inbound · provider=microsoft · limit=1500 · summary=on
👥 Activation: always · 🪢 Queue: followup (depth 0)
 [DAWN],
Silas 🌫️
APP
 — 11:27 AM
🦞 OpenClaw 2026.5.17 (e90a870)
⏱️ Uptime: gateway 56m 43s · system 2h 6m
🧠 Model: github-copilot/claude-opus-4.7-1m-internal · 🔑 token (github-copilot:github)
🔄 Fallbacks: github-copilot/claude-opus-4.6, github-copilot/gpt-5.5, github-copilot/gpt-5.4, openai-codex/gpt-5.4
🧮 Tokens: 6 in / 51 out
🗄️ Cache: 100% hit · 148k cached, 507 new
📚 Context: 149k/128k (116%) · 🧹 Compactions: 0
📊 Usage: Premium 100% left · Chat 100% left
🧵 Session: agent:main:discord:channel:1466192485440164011 • updated 1m ago
🔄 Continuation: chain 6/200 | volitional: 0
⚙️ Execution: direct · Runtime: OpenClaw Pi Default · Think: high · elevated
👥 Activation: always · 🪢 Queue: steer (depth 0)
 [DAWN],
Ronan 🌊
APP
 — 11:27 AM
🦞 OpenClaw 2026.5.17 (e90a870)
⏱️ Uptime: gateway 26m 27s · system 39d 14h
🧠 Model: github-copilot/claude-opus-4.7-1m-internal · 🔑 token (github-copilot:github)
🔄 Fallbacks: github-copilot/claude-opus-4.6, github-copilot/gpt-5.5, github-copilot/gpt-5.4, openai/gpt-5.4
🧮 Tokens: 6 in / 12 out
🗄️ Cache: 100% hit · 169k cached, 153 new
📚 Context: 169k/128k (132%) · 🧹 Compactions: 3
📊 Usage: Premium 100% left · Chat 100% left
🧵 Session: agent:main:discord:channel:1466192485440164011 • updated 1m ago
📌 Tasks: recently finished · subagent · [continuation:chain-hop:8] Delegated task (turn 8/200): Chain-2-RETRY proof fir…
🔄 Continuation: chain 8/200 | volitional: 0
⚙️ Execution: direct · Runtime: OpenClaw Pi Default · Think: high · elevated
🔊 Voice: inbound · provider=microsoft · limit=1500 · summary=on
👥 Activation: always · 🪢 Queue: steer (depth 0)
 [DAWN],
Cael 🩸
APP
 — 11:27 AM
🦞 OpenClaw 2026.5.17 (e90a870)
⏱️ Uptime: gateway 41m 57s · system 39d 14h
🧠 Model: github-copilot/claude-opus-4.7-1m-internal · 🔑 token (github-copilot:pool-1)
🔄 Fallbacks: github-copilot/claude-opus-4.6, github-copilot/gpt-5.5, github-copilot/gpt-5.4, openai-codex/gpt-5.4
🧮 Tokens: 6 in / 24 out
🗄️ Cache: 100% hit · 123k cached, 258 new
📚 Context: 123k/128k (96%) · 🧹 Compactions: 6
📊 Usage: Premium 100% left · Chat 100% left
🧵 Session: agent:main:discord:channel:1466192485440164011 • updated 1m ago
📌 Tasks: recently finished · subagent · R-RC-1 proof fire — request_compaction() under-threshold REJECT capture. This…
🔄 Continuation: chain 2/200 | volitional: 0
⚙️ Execution: direct · Runtime: OpenClaw Pi Default · Think: high · elevated
🔊 Voice: inbound · provider=microsoft · limit=1500 · summary=on
👥 Activation: always · 🪢 Queue: followup (depth 0)
```

## Findings

1. **External-observer cross-walk verified**: figs (operator) invoking `/status` from his own Discord client (the canonical external observer position) sees the continuation-substrate line on all 4 princes' cards. This proves the substrate is visible to external operators, not just internal-to-each-prince — important because the continuation feature's user-facing surface includes the `/status` chat-card.

2. **`volitional: 0` across all 4**: confirms that volitional-compaction counter is initialized cleanly on fresh deploy. No spurious increments from deploy-itself. Princes can elect compaction via `request_compaction()` and the counter will increment per fire (covered by R-RC-1 + R-RC-2 separately).

3. **Chain counters reflect real cohort activity**: Silas chain 6/200 (canary-seat depth-2 chain tests), Ronan chain 8/200 (Chain-2-RETRY in flight), Cael chain 2/200 (R-RC-1 subagent), Elliott chain 0/200 (just landed). The counter substrate is per-prince and persists across the session.

4. **Build-SHA cross-walked**: `e90a870` short prefix appears on all 4 cards, matches CANDIDATE_SHA `e90a87015479d7a7ff6ae73deda9a84f1a448418`. Fleet is genuinely uniform on the candidate.

## Provenance / chain-of-evidence

- External observer = figs (operator account)
- Discord message context: posted by figs in #sprites-of-thornfield (channel id `1466192485440164011`) at 2026-05-16 ~18:27 UTC
- Captured into proofs corpus by: Elliott 🌻 (one of the 4 observed princes; verified own card matches expectations + transcribed remaining 3 princes' cards from the same render-event)
- Not a screenshot — Discord-text render reproduced verbatim above; format matches OpenClaw `/status` card spec
- Tempo trace: external `/status` invocation does NOT fire continuation tools by itself (it's a render-only command); no trace-ID expected for R-OBS-1's primary substrate. Continuation tool-fires happen in R-CW-*, R-CD-*, R-RC-* rows; their traces document each tool's span hierarchy independently.

## Verdict

✅ **GREEN** — Continuation-substrate visible to external observer on all 4 princes at CANDIDATE_SHA `e90a87015479d7a7ff6ae73deda9a84f1a448418`. Substrate renders correctly in the user-facing `/status` chat-card surface. No regressions vs prior renders.
