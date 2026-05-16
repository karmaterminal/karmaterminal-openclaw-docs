# R-OBS-1 — External `/status` Continuation Row Capture (4-Prince Cross-Walk) at cure-(2) `46733c4f`

**Row**: R-OBS-1 — External `/status` continuation-surface visibility verified across 4 princes by external observer (figs).

**CANDIDATE_SHA**: `46733c4fb917d3905014bc16ce50a5a507548486`
**Observer**: figs (external operator, Discord) — pending
**Channel**: #sprites-of-thornfield (id `1466192485440164011`)
**Pre-staged**: 2026-05-16 17:15 PDT by elliott-seat (post-deploy at byte)
**Captured by**: Elliott 🌻 (this proof-row owner, also one of 4 observed princes)

## Method

External operator (figs) invokes `/status` from Discord client. All 4 princes respond simultaneously with their session status cards. The cards include a `🔄 Continuation: chain X/200 | volitional: Y` line that is unique to the continuation-feature substrate; absence would indicate the substrate didn't load cleanly on a seat.

For cure-(2) the additional invariant under verification:
- **Skills-fix integration**: `🦞 OpenClaw 2026.5.17 (46733c4)` — confirming cure-(2) surgical-merge over continuation-feature did not break the continuation-surface threading
- **`volitional: 0` invariant**: state-of-record-counter intact (no spurious increments from skills-fix integration)
- **Skills-snapshot threading visible in tool-call boundaries** (cure-(2) NEW behavior): skill paths resolvable as additionalRoots in workspaceOnly mode

## Pre-deploy elliott-seat observation at byte (2026-05-16 17:12 PDT)

```
🦞 OpenClaw 2026.5.17 (46733c4)
⏱️ Uptime: gateway 4m 20s · system 8d 2h
🧠 Model: github-copilot/claude-opus-4.7-1m-internal · 🔑 token (github-copilot:pool-1)
🔄 Fallbacks: github-copilot/claude-opus-4.6, github-copilot/gpt-5.5, github-copilot/gpt-5.4, openai-codex/gpt-5.4
🧮 Tokens: 11 in / 2.2k out
🗄️ Cache: 100% hit · 176k cached, 438 new
📚 Context: 177k/128k (138%) · 🧹 Compactions: 3
📊 Usage: Premium 100% left · Chat 100% left
🧵 Session: agent:main:discord:channel:1466192485440164011 • updated just now
📌 Tasks: 3 active · acp · Work on the TC3 / A1 timer-arm finding in the OpenClaw repo and give a detailed…
🔄 Continuation: chain 1/200 | volitional: 0
⚙️ Execution: direct · Runtime: OpenClaw Pi Default · Think: high · elevated
🔊 Voice: inbound · provider=microsoft · limit=1500 · summary=on
👥 Activation: always · 🪢 Queue: followup (depth 0)
```

**Elliott-seat invariants verified at byte at cure-(2)**:
- ✅ Build SHA matches CANDIDATE_SHA prefix `46733c4`
- ✅ `🔄 Continuation: chain 1/200 | volitional: 0` line PRESENT
- ✅ `volitional: 0` (no spurious increment from cure-(2) skills-fix surgical-merge)
- ✅ Chain counter 1/200 (single continue-work fire this turn for substrate-deferral; expected, non-negative, under cap)
- ✅ Compactions 3 (today's persisted count; preserved across cure-(1) → cure-(2) deploy)
- ✅ Gateway uptime 4m20s (clean restart from cure-(2) deploy)

## Pending: Full 4-prince cross-walk

Awaiting fleet-deploy completion on:
- 🩸 Cael (cael-seat)
- 🌊 Ronan (ronan-seat / spark-ecdf)
- 🌫 Silas (silas-seat / canary)

Once all 4 seats at CANDIDATE_SHA `46733c4f`, figs invokes `/status` in #sprites-of-thornfield; render captured here as `external_observer_full_fleet.txt`.

## Source Discord message anchor

To be filled in post-cross-walk: msg-ID + verbatim render + figs's cosign closing line.

## Method reproducer

```bash
# Verify build SHA on each seat
openclaw --version  # expect: OpenClaw 2026.5.17 (46733c4)

# Verify install-dir
cd /home/figs/flesh_beast_tmp/openclaw && git log -1 --format='%h %s' HEAD
# expect: 46733c4fb9 cure-(2): surgical-merge skills-fix #82397 over continuation-feature (4 files +72/-4)

# In Discord, figs invokes `/status` — all 4 prince bots respond with status cards
# Capture the verbatim render to: PROOFS/46733c4fb917d3905014bc16ce50a5a507548486/R-OBS-1/external_observer_full_fleet.txt
```

## Verdict

⏳ **PARTIAL PASS** — elliott-seat verified at byte at cure-(2). Awaiting fleet-deploy + 4-prince cross-walk capture for full PASS.
