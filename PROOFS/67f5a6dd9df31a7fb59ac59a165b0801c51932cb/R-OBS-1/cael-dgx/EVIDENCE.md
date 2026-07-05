# R-OBS-1 — status-card observability (cael-dgx)

Issue: https://github.com/karmaterminal/karmaterminal-openclaw-docs/issues/228

Candidate SHA: `bca2b0b89ab886bf23a10e4983926f6b374b3188`  
Seat: Cael / `cael-dgx`  
Build: `OpenClaw 2026.6.11 (bca2b0b)`  
Verdict: ✅ PASS

## Scenario

Capture the session status card observability surface without firing new continuation/delegate behavior. This row verifies the status card exposes the deployed build, model/runtime, context usage, session identity, continuation chain/queue visibility, plugin health, and route context.

`karmaterminal/openclaw#1135` was still open at capture time, so live continuation/delegate proof rows were intentionally held. This row uses only `session_status`, runtime/version, and queue/continuation visibility bytes.

## Status card receipt

`session-status.txt` records:

```text
🦞 OpenClaw 2026.6.11 (bca2b0b)
⏱️ Uptime: gateway 2h 1m · system 41d 22h
🧠 Model: github-copilot/gpt-5.5 · 🔑 token (github-copilot:github)
🔄 Fallbacks: github-copilot/gemini-3.1-pro-preview
🧮 Tokens: 274k in / 1.5k out · 💵 Cost: $0.0000
🗄️ Cache: 38% hit · 172k cached, 0 new
📚 Context: 173k/1.0m (17%) · 🧹 Compactions: 2
🧵 Session: agent:main:discord:channel:1466192485440164011 • duration 2h 27m • updated just now
🔄 Continuation: chain 0/200 | 1 post-compaction staged
⚙️ Execution: direct · Runtime: OpenClaw Default · Think: high · Fast: off · elevated
🔌 Plugins: OK
🔊 Voice: inbound · provider=microsoft · limit=1500 · summary=on
👥 Activation: mention · 🪢 Queue: collect (depth 0)
```

Route context in the same receipt shows active Discord delivery targeting:

```json
{
  "origin": {"provider":"discord","accountId":"default"},
  "active": {"channel":"discord","to":"channel:1466192485440164011","accountId":"default"},
  "deliveryContext": {"channel":"discord","to":"channel:1466192485440164011","accountId":"default"}
}
```

## Issue-hold receipt

`openclaw-issue-1135.json` records the reason live continuation/delegate rows were held:

```json
{"number":1135,"state":"OPEN","title":"continuation scheduler can churn requests-in-flight off-board flows and wedge gateway","url":"https://github.com/karmaterminal/openclaw/issues/1135"}
```

## Tempo trace

Machine-readable Tempo trace JSON is saved at:

```text
tempo/trace-session-status-7b046c30b612b3373c0351e2b39b2273.json
```

`tempo/trace-session-status-summary.jsonl` includes the typed status-card tool execution:

```json
{"name":"openclaw.tool.execution","startTimeUnixNano":"1783187660209000000","attrs":{"openclaw.toolName":"session_status","openclaw.tool.source":"core","gen_ai.tool.name":"session_status","openclaw.tool.params.kind":"object"}}
```

The preceding precheck/claim trace is included at `tempo/trace-precheck-d8733872982c589de83b65501fa4c8df.json`.

## Supporting receipts

- `session-status.txt` — status-card output with build/model/context/session/continuation/plugins/queue/route visibility.
- `version.txt` — runtime version receipt.
- `discord-claim-receipt.json` — visible proof-claim receipt.
- `openclaw-issue-1135.json` — open continuation issue receipt justifying no live continuation/delegate fire.
- `tempo/trace-session-status-7b046c30b612b3373c0351e2b39b2273.json` — machine-readable session_status tool trace.
- `tempo/trace-session-status-summary.jsonl` — extracted session_status trace summary.
- `tempo/trace-precheck-d8733872982c589de83b65501fa4c8df.json` — precheck/claim trace.
- `tempo/trace-precheck-summary.jsonl` — extracted precheck trace summary.
- Tempo search JSON and `tempo/candidate-traces.txt` — trace discovery receipts.

## Verdict

✅ PASS — status-card observability exposed deployed build `OpenClaw 2026.6.11 (bca2b0b)`, current model/runtime, context/compaction count, session key, continuation chain and post-compaction queue visibility, plugin health, activation/queue state, and Discord route context without firing live continuation/delegate behavior.
