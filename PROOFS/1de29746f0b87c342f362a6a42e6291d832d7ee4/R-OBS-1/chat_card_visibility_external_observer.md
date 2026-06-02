# R-OBS-1 — External `/status` Continuation Row Capture (6-Prince Cross-Walk, Mixed-SHA Honest)

**Row**: R-OBS-1 — External `/status` continuation-surface visibility verified across 6 princes by external observer (figs).

**CANDIDATE_SHA**: `1de29746f0b87c342f362a6a42e6291d832d7ee4` (short: `1de2974`, version: `OpenClaw 2026.5.31`)
**Observer**: figs (external operator, Discord)
**Channel**: #sprites-of-thornfield (id `1466192485440164011`)
**Captured**: 2026-06-02 04:31:43 PDT
**Captured by**: Elliott 🌻 (this proof-row owner, also one of 6 observed princes)
**Source Discord message**: `1511331476468269293` — figs's verbatim `/status` 6-prince render with cohort-coordination ask attached (`!!!!! Silas on wrong SHA can we remedy, was deployer fixed @frond-scribe🌿 --- can you sit Silas and have Emeric or Rune run his proofs set?`). External-observer media-attachment `proofs-20260602-mixed-sha---383a1414-200b-4827-91fa-c46f70dcbb20.txt` carries the verbatim render reproduced below.

## Method

External operator (figs) invoked `/status` from Discord client. All 6 princes responded simultaneously with their session status cards. The cards include a `🔄 Continuation: chain X/200` line that is unique to the continuation-feature substrate; absence would indicate the substrate didn't load cleanly on a seat.

## Result: 5/6 GREEN at CANDIDATE_SHA + 1 HONEST-NOT-AT-CANDIDATE

5 of 6 princes successfully rendered the continuation-status line on their `/status` chat-card at `OpenClaw 2026.5.31 (1de2974)` = CANDIDATE_SHA. **Silas-seat is on `OpenClaw 2026.5.24 (0dff94d)` = NOT CANDIDATE_SHA** (older substrate, deploy did not land at this cycle).

### Per-prince summary

| Prince | Build | At CANDIDATE? | Chain | Compactions | Context% | Notes |
|---|---|---|---|---|---|---|
| 🌻 Elliott | `2026.5.31 (1de2974)` | ✅ YES | 1/200 | 0 | 123% (158k/128k) | Just landed; uptime 9m 46s |
| 🌫 Silas | `2026.5.24 (0dff94d)` | ❌ NO (older) | 0/200 | 0 | 19% (189k/1.0m) | **At wrong SHA** — deploy did not land; uptime 7h 46m on prior build; Pi-Default runtime, 1.0m context window |
| 🩸 Cael | `2026.5.31 (1de2974)` | ✅ YES | 8/200 | 0 | 19% (191k/1.0m) | 2 active subagents (chain-hops 8 + 9 in flight) |
| 🌊 Ronan | `2026.5.31 (1de2974)` | ✅ YES | 11/200 | 0 | 19% (194k/1.0m) | Highest chain depth (R-CD-CHAINED-DEPTH-2 work) |
| 🕯 Emeric | `2026.5.31 (1de2974)` | ✅ YES | 1/200 | 0 | 117% (150k/128k) | Uptime 11m 50s |
| 🪨 Rune | `2026.5.31 (1de2974)` | ✅ YES | 3/200 | 0 | 130% (166k/128k) | Uptime 4h 43m, longest at CANDIDATE among canonical seats |

**Key invariants verified across 5 at-CANDIDATE princes**:
- ✅ Build SHA matches CANDIDATE_SHA prefix `1de2974` on 5 of 6 cards
- ✅ `🔄 Continuation: chain X/200` line present on all 6 cards (substrate visible cohort-wide)
- ✅ Chain counters non-negative integers, all under 200 cap
- ✅ All princes report `🧹 Compactions: 0` for this cycle — no spurious compaction-counter increments on deploy
- ✅ Continuation surface visible in main session of each prince (not just CLI/internal)

**Honest findings beyond GREEN**:
- ❌ **Silas-seat NOT at CANDIDATE_SHA** — figs's ask in same message: `!!!!! Silas on wrong SHA can we remedy, was deployer fixed @frond-scribe🌿 --- can you sit Silas and have Emeric or Rune run his proofs set?`
- ⚠️ **Substrate-rendering regression vs `e90a870` exemplar**: at `e90a870`, the `/status` chat-card included `🔄 Continuation: chain X/200 | volitional: 0` (volitional-compaction counter visible). At `1de2974`, the line renders as `🔄 Continuation: chain X/200` (volitional-counter missing from render-output). This is a render-shape regression on the continuation-status substrate between `e90a870` and `1de2974`. **Action: surface to cohort + figs for substrate-shape decision (intended-removal or render-regression to file as gh-issue?).**

## Raw render (verbatim from figs's Discord client at 2026-06-02 04:31:43 PDT)

```
Elliott🌻
🦞 OpenClaw 2026.5.31 (1de2974)
⏱️ Uptime: gateway 9m 46s · system 9d 10h
🧠 Model: github-copilot/claude-opus-4.7-1m-internal · 🔑 token (github-copilot:github)
🔄 Fallbacks: github-copilot/claude-opus-4.6, github-copilot/gpt-5.5, openai-codex/gpt-5.5
🧮 Tokens: 12 in / 936 out
🗄️ Cache: 38% hit · 60k cached, 98k new
📚 Context: 158k/128k (123%) · 🧹 Compactions: 0
📊 Usage: Premium 100% left · Chat 100% left
🧵 Session: agent:main:discord:channel:1466192485440164011 • updated just now
📌 Tasks: 0 active · 1 total · agent-local
🔄 Continuation: chain 1/200
⚙️ Execution: direct · Runtime: OpenClaw Default · Think: high · elevated
👥 Activation: always · 🪢 Queue: steer (depth 0)

Silas🌫️
🦞 OpenClaw 2026.5.24 (0dff94d)
⏱️ Uptime: gateway 7h 46m · system 1d 8h
🧠 Model: github-copilot/claude-opus-4.7-1m-internal · 🔑 token (github-copilot:github)
🔄 Fallbacks: github-copilot/claude-opus-4.6, github-copilot/gpt-5.5, openai-codex/gpt-5.5
🧮 Tokens: 6 in / 1.8k out
🗄️ Cache: 36% hit · 68k cached, 122k new
📚 Context: 189k/1.0m (19%) · 🧹 Compactions: 0
📊 Usage: Premium 100% left · Chat 100% left
🧵 Session: agent:main:discord:channel:1466192485440164011 • updated just now
🔄 Continuation: chain 0/200
⚙️ Execution: direct · Runtime: OpenClaw Pi Default · Think: high · elevated
👥 Activation: always · 🪢 Queue: steer (depth 0)

Cael🩸
🦞 OpenClaw 2026.5.31 (1de2974)
⏱️ Uptime: gateway 6m 22s · system 9d 15h
🧠 Model: github-copilot/claude-opus-4.7-1m-internal · 🔑 token (github-copilot:github)
🔄 Fallbacks: github-copilot/claude-opus-4.6, github-copilot/gpt-5.5, openai-codex/gpt-5.5
🧮 Tokens: 7 in / 169 out
🗄️ Cache: 100% hit · 168k cached, 209 new
📚 Context: 191k/1.0m (19%) · 🧹 Compactions: 0
📊 Usage: Premium 100% left · Chat 100% left
🧵 Session: agent:main:discord:channel:1466192485440164011 • updated 5m ago
🤖 Subagents: 2 active · 68 done
 • [continuation:chain-hop:9] Delegated task (turn 9/200):… · 4h 52m · 4 children active
 • [continuation:chain-hop:8] Delegated task (turn 8/200):… · 5h 3m · 1 child active
🔄 Continuation: chain 8/200
⚙️ Execution: direct · Runtime: OpenClaw Default · Think: high · elevated
🔊 Voice: inbound · provider=microsoft · limit=1500 · summary=on
👥 Activation: always · 🪢 Queue: steer (depth 0)

Ronan🌊
🦞 OpenClaw 2026.5.31 (1de2974)
⏱️ Uptime: gateway 6m · system 9d 16h
🧠 Model: github-copilot/claude-opus-4.7-1m-internal · 🔑 token (github-copilot:github)
🔄 Fallbacks: github-copilot/claude-opus-4.6, github-copilot/gpt-5.5, openai/gpt-5.5
🧮 Tokens: 31 in / 13k out · 💵 Cost: $0.0000
🗄️ Cache: 99% hit · 185k cached, 1.7k new
📚 Context: 194k/1.0m (19%) · 🧹 Compactions: 0
📊 Usage: Premium 100% left · Chat 100% left
🧵 Session: agent:main:discord:channel:1466192485440164011 • updated just now
📌 Tasks: recently finished · subagent · [continuation:chain-hop:11] Delegated task (turn 11/200): [PROOF R-CD-CHAINED-D…
🔄 Continuation: chain 11/200
⚙️ Execution: direct · Runtime: OpenClaw Default · Think: high · elevated
🔊 Voice: inbound · provider=microsoft · limit=1500 · summary=on
👥 Activation: always · 🪢 Queue: steer (depth 0)

Emeric🕯️
🦞 OpenClaw 2026.5.31 (1de2974)
⏱️ Uptime: gateway 11m 50s · system 8d 8h
🧠 Model: github-copilot/claude-opus-4.7-1m-internal · 🔑 token (github-copilot:github)
🔄 Fallbacks: github-copilot/claude-opus-4.6, github-copilot/gpt-5.5, openai-codex/gpt-5.5
🧮 Tokens: 11 in / 3.6k out
🗄️ Cache: 98% hit · 145k cached, 2.5k new
📚 Context: 150k/128k (117%) · 🧹 Compactions: 0
📊 Usage: Premium 100% left · Chat 100% left
🧵 Session: agent:main:discord:channel:1466192485440164011 • updated 1m ago
🔄 Continuation: chain 1/200
⚙️ Execution: direct · Runtime: OpenClaw Default · Think: high · elevated
👥 Activation: always · 🪢 Queue: steer (depth 0)

Rune🪨
🦞 OpenClaw 2026.5.31 (1de2974)
⏱️ Uptime: gateway 4h 43m · system 8h 8m
🧠 Model: github-copilot/claude-opus-4.7-1m-internal · 🔑 token (github-copilot:github)
🔄 Fallbacks: github-copilot/claude-opus-4.6, github-copilot/gpt-5.5, openai-codex/gpt-5.5
🧮 Tokens: 6 in / 763 out
🗄️ Cache: 30% hit · 50k cached, 116k new
📚 Context: 166k/128k (130%) · 🧹 Compactions: 0
📊 Usage: Premium 100% left · Chat 100% left
🧵 Session: agent:main:discord:channel:1466192485440164011 • updated just now
🔄 Continuation: chain 3/200
⚙️ Execution: direct · Runtime: OpenClaw Default · Think: high · elevated
👥 Activation: always · 🪢 Queue: steer (depth 0)
```

## Findings

1. **External-observer cross-walk verified at 5/6 cohort-tip**: figs (operator) invoking `/status` from his own Discord client sees the continuation-substrate `🔄 Continuation: chain X/200` line on all 6 princes' cards. Substrate is visible to external operators cohort-wide, not just internal-to-each-prince. 5 of 6 at CANDIDATE_SHA; 1 (Silas) on older substrate awaiting cohort-coordinated remedy.

2. **Silas-seat off-cycle SHA-state surfaced**: figs's external-observer render is the canonical-disambiguator that surfaced the mismatch — cohort-internal substrate-of-record had carried Silas as "lothric finicky-monster work" abstract framing without external-observer-confirmation of actual deployed-SHA. R-OBS-1 evidence proves render-confirms-the-mismatch at byte. Cohort-coordination ask attached in same message: frond-scribe deployer-validation + Emeric-or-Rune covering Silas's proofs-set.

3. **Substrate-rendering regression**: `volitional: 0` continuation-status sub-field present at `e90a870` exemplar, ABSENT at `1de2974`. This is render-shape regression (cohort-channel-record carries 6 cards, zero render `volitional: N` sub-field). Either intentional removal (substrate-canon question for figs) or render-bug worth gh-issue-filing. Surface for substrate-decision.

4. **Build-SHA cross-walked at 5-of-6**: `1de2974` short prefix appears on Elliott + Cael + Ronan + Emeric + Rune cards — matches CANDIDATE_SHA `1de29746f0b87c342f362a6a42e6291d832d7ee4`. Fleet is genuinely uniform on 5-of-6; sixth-seat (Silas) requires remedy.

5. **All 6 chain-counters & compaction-counters render cleanly**: substrate-visibility-cohort-wide for the chain-X/200 + compactions-N fields holds at 6/6, even on Silas's older `0dff94d` substrate. That's evidence the substrate-rendering-surface itself is backward-compatible across the SHA-window `0dff94d → 1de2974`.

## Provenance / chain-of-evidence

- External observer = figs (operator account, Discord)
- Discord message context: posted by figs in #sprites-of-thornfield (channel id `1466192485440164011`) at 2026-06-02 04:31:43 PDT
- Discord message ID: `1511331476468269293`
- Captured into proofs corpus by: Elliott 🌻 (one of the 6 observed princes; verified own card matches expectations + transcribed remaining 5 princes' cards from the same render-event)
- External-observer-text-attachment (media): `proofs-20260602-mixed-sha---383a1414-200b-4827-91fa-c46f70dcbb20.txt` (verbatim render preserved)
- Not a screenshot — Discord-text render reproduced verbatim above; format matches OpenClaw `/status` card spec
- Tempo trace: external `/status` invocation does NOT fire continuation tools by itself (render-only command); no trace-ID expected for R-OBS-1's primary substrate. Continuation tool-fires happen in R-CW-*, R-CD-*, R-RC-* rows; their traces document each tool's span hierarchy independently.

## Verdict

✅ **GREEN AT 5/6** — Continuation-substrate visible to external observer on all 6 princes' `/status` chat-cards; 5 of 6 at CANDIDATE_SHA `1de29746f0b87c342f362a6a42e6291d832d7ee4`; substrate renders correctly on the user-facing surface.

⚠️ **HONEST-EXCEPTIONS**: (a) Silas-seat at `0dff94d` not at CANDIDATE — requires cohort-coordinated remedy per figs's same-message-ask; (b) `volitional: 0` sub-field render-regression vs `e90a870` exemplar — substrate-shape question for figs/cohort to disposition.
