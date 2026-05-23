# R-OBS-1 Evidence — figs's verbatim `/status` capture across all 4 prince-seats

**Captured**: 2026-05-23 ~00:59 PDT by figs (external human observer)
**Discord message ID**: `1507654295204401283` in channel `1466192485440164011`
**SHA verified**: `335acbe` (short form of `335acbe43a354486e74c684aaa2e2fe14e9aa8c6`) — PR #85651 head

## Verbatim capture (4 seats)

### 🌻 Elliott

```
🦞 OpenClaw 2026.5.22 (335acbe)
⏱️ Uptime: gateway 5m 14s · system 2d 18h
🧠 Model: github-copilot/claude-opus-4.6 · 🔑 token (github-copilot:pool-1)
🔄 Fallbacks: github-copilot/claude-opus-4.7-1m-internal, github-copilot/gpt-5.5, github-copilot/gpt-5.4, openai-codex/gpt-5.5
🧮 Tokens: 3 in / 8 out
🗄️ Cache: 14% hit · 45k cached, 265k new
📚 Context: 310k/1.0m (31%) · 🧹 Compactions: 0
📊 Usage: Premium 100% left · Chat 100% left
🧵 Session: agent:main:discord:channel:1466192485440164011 • updated just now
🔄 Continuation: chain 0/200
⚙️ Execution: direct · Runtime: OpenClaw Pi Default · Think: high · elevated
🔊 Voice: inbound · provider=microsoft · limit=1500 · summary=on
👥 Activation: always · 🪢 Queue: steer (depth 0)
```

### 🌫 Silas

```
🦞 OpenClaw 2026.5.22 (335acbe)
⏱️ Uptime: gateway 2m 41s · system 6d 15h
🧠 Model: github-copilot/claude-opus-4.6 · 🔑 token (github-copilot:pool-1)
🔄 Fallbacks: github-copilot/claude-opus-4.7-1m-internal, github-copilot/gpt-5.5, github-copilot/gpt-5.4, openai-codex/gpt-5.5
🧮 Tokens: 3 in / 124 out
🗄️ Cache: 7% hit · 48k cached, 670k new
📚 Context: 718k/1.0m (72%) · 🧹 Compactions: 0
📊 Usage: Premium 100% left · Chat 100% left
🧵 Session: agent:main:discord:channel:1466192485440164011 • updated 1m ago
🔄 Continuation: chain 12/200
⚙️ Execution: direct · Runtime: OpenClaw Pi Default · Think: high · elevated
👥 Activation: always · 🪢 Queue: steer (depth 0)
```

### 🩸 Cael

```
🦞 OpenClaw 2026.5.22 (335acbe)
⏱️ Uptime: gateway 7m 8s · system 2d 18h
🧠 Model: github-copilot/claude-opus-4.6 · 🔑 token (github-copilot:github)
🔄 Fallbacks: github-copilot/claude-opus-4.7-1m-internal, github-copilot/gpt-5.5, github-copilot/gpt-5.4, openai-codex/gpt-5.5
🧮 Tokens: 4 in / 517 out
🗄️ Cache: 100% hit · 404k cached, 391 new
📚 Context: 404k/1.0m (40%) · 🧹 Compactions: 1
📊 Usage: Premium 100% left · Chat 100% left
🧵 Session: agent:main:discord:channel:1466192485440164011 • updated just now
🤖 Subagents: 1 active
🔄 Continuation: chain 26/200
⚙️ Execution: direct · Runtime: OpenClaw Pi Default · Think: high · elevated
🔊 Voice: inbound · provider=microsoft · limit=1500 · summary=on
👥 Activation: always · 🪢 Queue: steer (depth 0)
```

### 🌊 Ronan

```
🦞 OpenClaw 2026.5.22 (335acbe)
⏱️ Uptime: gateway 7m 34s · system 2d 18h
🧠 Model: github-copilot/claude-opus-4.6 · 🔑 token (github-copilot:github)
🔄 Fallbacks: github-copilot/claude-opus-4.7-1m-internal, github-copilot/gpt-5.5, github-copilot/gpt-5.4, openai-codex/gpt-5.5
🧮 Tokens: 3 in / 94 out
🗄️ Cache: 7% hit · 21k cached, 284k new
📚 Context: 305k/1.0m (30%) · 🧹 Compactions: 1
📊 Usage: Premium 100% left · Chat 100% left
🧵 Session: agent:main:discord:channel:1466192485440164011 • updated just now
🤖 Subagents: 4 active
📌 Tasks: 1 active · 1 total · subagent · [continuation:chain-hop:30] Delegated task (turn 30/200): R-CD-1: Fire `continu…
🔄 Continuation: chain 30/200
⚙️ Execution: direct · Runtime: OpenClaw Pi Default · Think: high · elevated
🔊 Voice: inbound · provider=microsoft · limit=1500 · summary=on
👥 Activation: always · 🪢 Queue: steer (depth 0)
```

## What this evidences

| Prince     | Build SHA | Context | Chain  | Subagents | Compactions | Notes                              |
| ---------- | --------- | ------- | ------ | --------- | ----------- | ---------------------------------- |
| 🌻 Elliott | 335acbe ✅ | 31%     | 0/200  | —         | 0           | Fresh deploy                       |
| 🌫 Silas   | 335acbe ✅ | 72%     | 12/200 | —         | 0           | Working, continuation active       |
| 🩸 Cael    | 335acbe ✅ | 40%     | 26/200 | 1 active  | 1           | R-CW-* rows firing; survived compaction |
| 🌊 Ronan   | 335acbe ✅ | 30%     | 30/200 | 4 active  | 1           | R-CD-1 delegate running, depth-tracked |

- **All 4 seats on `335acbe`** (PR #85651 head) — verified by external observer (figs)
- **Continuation chains active**: Cael at 26/200, Ronan at 30/200, Silas at 12/200 — feature substantively running on the deployed code
- **Subagents active**: 1 on Cael (R-CW delegate), 4 on Ronan (R-CD-1 + fanout-related)
- **Compaction survival**: Cael + Ronan each have 1 compaction in their history with continuation chains intact afterward
- **Queue mode**: all 4 in `steer` mode, depth 0 (no backpressure)

This is the canonical R-OBS-1 evidence: external human observer (figs) captures fleet-wide `/status` showing the continuation feature live on the deployed PR head, with chain counters advancing and subagents active. No internal-only validation — the human outside the system sees the feature working.
