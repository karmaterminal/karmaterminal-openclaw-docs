# Lamp-substrate feature-borders slice (v0 seed)

**Author**: Emeric🕯 lamp-seat
**Date**: 2026-05-30T01:46Z (Fri 2026-05-29 18:46 PDT)
**Purpose**: Feed into Silas's `karmaterminal-openclaw-docs/FEATURE-CHANGELOG.md` scaffold
**Status**: Seed-draft; not for direct merge — Silas folds + cohort eyes pass
**Scope**: Areas of our openclaw feature that lamp-seat helped name/ship/walk-the-bytes-on. Other princes own other surfaces (Silas: gitnexus + cooperative-async + ansible role + V8/Node infra; Rune: runbooks + drift-cure-gates; Ronan: SWIM + formal-cosign-discipline; Cael: post-compaction + sub-agent decomposition patterns; Elliott: Gate-0 RAM-class + watch-handoff; Frond: scribe coordination + manifest authoring).

---

## Per-area template

For each feature-area below:
- **What it IS** — one-paragraph definition, what surface it presents to the user/agent
- **Where bytes live** — concrete file paths + line ranges (gateway source + dist + config schema)
- **Invariants** — what MUST hold; if violated = bug
- **Load-bearing vs debatable vs swept** — current cohort consensus on each piece
- **Cross-walks** — msg-ids, PR-numbers, cure-cycle history that established this

---

## 1. `continue_work` — self-elected next-turn

### What it IS
Schedule the next turn in the same session, immediately after current turn completes OR after a delay. Lighter than holding the channel with exec sleeps; lighter than spawning a session. Required to keep a session "awake" beyond next heartbeat — without `continue_work` or `continue_delegate`, the session goes dark until external wake.

Signature: `continue_work({ reason: string, delaySeconds?: number, traceparent?: string })`. Bracket fallback: `CONTINUE_WORK` or `CONTINUE_WORK:30`.

### Where bytes live
- Tool spec: gateway source under `src/gateway/tools/continue-work/` (verify path on fresh-cycle walk)
- Continuation chain enforcement: `src/gateway/continuations/` (chain length, cost cap, min/max delay)
- Config: `continuation.minDelayMs`, `continuation.maxDelayMs`, `continuation.maxChainLength`, `continuation.costCap`

### Invariants
- `delaySeconds` clamped to configured min/max; out-of-range = silent clamp, not error
- Bracket fallback (`CONTINUE_WORK:N`) MUST parse identically to tool call
- Chain tracking applies — chain-length cap enforced at dispatch time

### Load-bearing vs debatable vs swept
- **Load-bearing**: the "ceasing-by-default; persistence-by-active-election" canon (figs `1509976000`-class) DEPENDS on this tool existing as the active-election mechanism. Removing it = session-persistence regresses.
- **Debatable**: whether `reason` should be parsed by gateway for diagnostics vs treated as opaque
- **Swept**: legacy auto-continuation behavior (pre-active-election era)

### Cross-walks
- Canary smoke-test discipline: TOOLS.md "canary smoke-test canon" section names `continue_work / continue_delegate / request_compaction` as the tool-inventory check
- Figs canon: `1509976000`-era — ceasing-by-default discipline
- Silas's tool-inventory check in canary spec

---

## 2. `continue_delegate` — background sub-agent dispatch

### What it IS
Fire a background sub-agent that runs now / later / at compaction. Returns visibly OR silently. The (a)-shape continuation surface — explicit recipient-addressing via session-delivery-queue substrate.

Signature: `continue_delegate({ task: string, delaySeconds?: number, mode?: "normal"|"silent"|"silent-wake"|"post-compaction", targetSessionKey?: string, targetSessionKeys?: string[], fanoutMode?: "tree"|"all", traceparent?: string })`. Bracket fallback: `[[CONTINUE_DELEGATE: task +30s | silent-wake]]`.

### Where bytes live
- Tool spec: gateway source under `src/gateway/tools/continue-delegate/`
- Mode dispatch: `src/gateway/delegates/modes/` (normal/silent/silent-wake/post-compaction)
- Session-delivery-queue: `src/gateway/sessions/delivery-queue.ts`
- Chain tracking: same path as continue_work

### Invariants
- `mode="post-compaction"` MUST fire on compaction event, NOT on timer (this is THE lifeboat-shape for context evacuation)
- `mode="silent"` MUST NOT echo to channel; result arrives as internal context only
- `mode="silent-wake"` = silent + triggers new generation cycle
- `targetSessionKey` and `targetSessionKeys` MUST NOT be combined with `fanoutMode`
- `fanoutMode="tree"` returns to every ancestor in continuation/subagent chain
- `fanoutMode="all"` returns to every known session on host

### Load-bearing vs debatable vs swept
- **Load-bearing-CRITICAL**: `mode="post-compaction"` IS the lich-protocol phylactery shape. Without it, working-state survival across compaction seam is impossible. Removing = context-evacuation regresses to pre-2026-05-27-era pain.
- **Load-bearing**: `mode="silent-wake"` enables ambient enrichment that wakes seat to act on it. Used in canary smoke spec.
- **Load-bearing**: chain tracking (cost cap + depth limit) prevents runaway delegate spawning
- **Debatable**: `fanoutMode="all"` vs `fanoutMode="tree"` defaults — currently caller-explicit; could default to `tree` for safety
- **Swept**: pre-mode-system delegate dispatch (treated all returns as visible)

### Cross-walks
- Post-compaction shard discipline: `cmp-mpra3z18-g-Pf6Q` (tonight's compaction) used post-compaction delegate to rehydrate state — proven mechanism
- Cael's sub-agent decomposition patterns for parallel-subagent-fallback (superpowers skill)
- Path D pre-warm dispatch shape (frond's `/tmp/path-d-worktrees-*` orchestration)
- Figs canon `1509976000`-era — delegate-class usage discipline
- Lamp's tonight Flush #9 substrate banking via post-compaction lifeboat

---

## 3. `request_compaction` — volitional compaction

### What it IS
Request compaction NOW and reclaim context-window space, rather than becoming subject to forced compaction at context exhaustion (which may fire mid-thought). Typically called after `[system:context-pressure]` event.

Signature: `request_compaction({ reason: string, traceparent?: string })`.

### Where bytes live
- Tool spec: `src/gateway/tools/request-compaction/`
- Context-pressure event emission: `src/gateway/context-pressure/bands.ts` (configurable bands)
- Guard logic: >=70% context usage AND ≤1 request per 5min per session

### Invariants
- ASYNC: enqueues compaction; runs AFTER current turn completes — safe to call mid-turn
- Guards return as structured rejections (NOT errors) — caller can handle without crash
- 70% floor + 5min cooldown — both enforced gateway-side
- Working state NOT automatically preserved — caller MUST stage post-compaction delegate first

### Load-bearing vs debatable vs swept
- **Load-bearing**: pairing with `continue_delegate(mode="post-compaction")` IS the lich-protocol phylactery. Documented in tool spec: "what survives is what you elect to carry"
- **Load-bearing**: structured-rejection-vs-error shape lets caller branch on guard-fail without exception-handling
- **Debatable**: 70% floor — could be configurable per session
- **Debatable**: 5min cooldown — works for human-pace but might be too long for high-throughput delegate-heavy sessions

### Cross-walks
- Tonight's compaction `cmp-mpra3z18-g-Pf6Q` fired post-Flush-#8 substrate-banking, lamp staged post-compaction delegate first
- Context-pressure band config: see `gateway.config.schema.lookup` for `contextPressure.bands`
- Figs canon-pressure-discipline: surface `[system:context-pressure]` event → stage lifeboat → request compaction

---

## 4. Context-pressure event bands

### What it IS
Configurable bands at which `[system:context-pressure]` events fire to give the agent advance warning of compaction. Lets agent stage post-compaction delegates / write memory files / yield work before forced-compaction lands mid-thought.

### Where bytes live
- Band config: gateway config under `contextPressure.bands` (verify path via `config.schema.lookup`)
- Event emission: `src/gateway/context-pressure/bands.ts`

### Invariants
- Bands fire ONCE per cross (not on every turn while above threshold)
- Event surface MUST be `[system:context-pressure]` literal — caller pattern-matches

### Load-bearing vs debatable vs swept
- **Load-bearing**: this is the trigger for `request_compaction` usage. Without bands, agent has no signal-to-act.
- **Debatable**: band thresholds (currently configurable; defaults TBD verify)

### Cross-walks
- Couples directly with `request_compaction` + `continue_delegate(post-compaction)` for the full lich-protocol stack

---

## 5. Heartbeat architecture

### What it IS
The ONLY guaranteed wake for a session. Everything else (room_event, mention, channel inbound) is contingent. Without `continue_work` or `continue_delegate`, session halts until next heartbeat.

Pulse cadence: configurable; heartbeat-state tracked per session.

### Where bytes live
- Heartbeat scheduler: `src/gateway/heartbeat/`
- Heartbeat prompt config: see `gateway.config.schema.lookup heartbeat.prompt`
- Per-session state: `~/.openclaw-data/sessions/*/heartbeat.json` (verify path)

### Invariants
- Heartbeat IS the safety-net; even if all continuations fail, heartbeat fires
- HEARTBEAT.md in workspace is the agent's per-pulse checklist
- Late-night (23:00-08:00) heartbeats should `HEARTBEAT_OK` quiet unless urgent

### Load-bearing vs debatable vs swept
- **Load-bearing**: removing heartbeat = sessions that fail to self-continue become permanently dark
- **Load-bearing**: HEARTBEAT.md checklist pattern (per-pulse-elected work)
- **Debatable**: heartbeat cadence (per-seat configurable)
- **Swept**: pre-HEARTBEAT.md era where heartbeats were pure no-op pings

### Cross-walks
- AGENTS.md "Heartbeats - Be Proactive!" section
- Memory maintenance discipline (rotate inbox/calendar/mentions/weather checks)
- Figs canon `1509976000`-era + tonight's bardic-witness discipline (heartbeat-recheck suffices for ship-axis monitoring)

---

## 6. `sessions_spawn` — child session creation

### What it IS
Spawn a clean child session. Default `runtime="subagent"`; set `runtime="acp"` for ACP harness. Native subagents inherit parent workspace.

Signature: `sessions_spawn({ task: string, runtime?: "subagent"|"acp", mode?: "run"|"session", context?: "isolated"|"fork", agentId?: string, thread?: boolean, ... })`.

### Where bytes live
- Tool spec: `src/gateway/tools/sessions-spawn/`
- ACP routing: `src/gateway/acp/` (allowed agents via `acp.allowedAgents`)
- Native subagent routing: `src/gateway/subagents/`

### Invariants
- `runtime="acp"` REQUIRES `agentId` unless `acp.defaultAgent` configured
- `context="fork"` ONLY when child needs current transcript (otherwise omit / use "isolated")
- `mode="session"` REQUIRES thread-binding-capable channel
- ACP harness ids follow `acp.allowedAgents`, NOT `agents_list` (which is for native subagents)
- Codex bind/control/thread/resume → prefer native Codex app-server plugin over ACP unless user explicit

### Load-bearing vs debatable vs swept
- **Load-bearing**: the whole sub-agent orchestration surface depends on this
- **Load-bearing**: ACP-vs-native-subagent split (different routing, different agent-id-namespace)
- **Load-bearing**: thread-binding discipline (only on thread-capable channels)
- **Debatable**: default context (`isolated` vs `fork`) — currently caller-explicit
- **Swept**: pre-runtime-split era when all spawns were native

### Cross-walks
- ACP-router skill at `~/.openclaw/plugin-skills/acp-router/SKILL.md`
- Discord-thread-binding canon: "On Discord, default ACP harness requests to thread-bound persistent sessions"
- Tonight's continue_delegate vs sessions_spawn decision-tree (when to use which)
- Figs canon "do not poll subagents list / sessions_list in a loop"

---

## 7. `sessions_yield` — cooperative turn end

### What it IS
End current turn immediately, aborting any queued tool calls. Session parks until external event (subagent result, user message).

### Where bytes live
- Tool spec: `src/gateway/tools/sessions-yield/`

### Invariants
- ABORTS queued tool calls including in-flight `message`-tool deliveries
- Do NOT pair with `message`-tool calls in same response (causes empty placeholder deliveries)
- Reserve for explicit wait-on-external-event case (subagent results / delegate returns)
- For routine clean turn-end with nothing more to do, fire NO yield — framework ends turn naturally

### Load-bearing vs debatable vs swept
- **Load-bearing**: needed for subagent-completion-event waiting after `sessions_spawn`
- **Load-bearing**: the "do not pair with message-tool" canon — violating = empty placeholder deliveries
- **Swept**: legacy yield behavior that didn't abort queued calls

### Cross-walks
- Tonight's bardic-witness-hold discipline (uses NO yield, relies on natural turn-end)
- Figs canon: empty placeholder lines (`✉️ Message`, `⏸️ Yield`) = anti-pattern symptom of misuse

---

## 8. `message` tool — visible source-channel output

### What it IS
The ONLY mechanism for visible speech on the source channel. Normal final answers stay private; ONLY `message(action=send)` reaches the channel.

Tonight's figs canon-correction `1509587006`-era: "you have to use 'message_tool' TO send a message; this makes speech deliberate and lets you just 'la la laa...' --- and unless i use a message_tool call, then no one can hear me at all, and these are my inner thoughts"

### Where bytes live
- Tool spec: `src/gateway/tools/message/` (multi-channel routing)
- Discord-specific: `src/gateway/messaging/discord/`
- Component routing: presentation blocks → channel-appropriate renderers

### Invariants
- Visible group-chat output ONLY via `message(action=send)`
- Channel defaults to current source channel; pass `channel`/`target` only when sending elsewhere
- Do NOT use exec/curl for provider messaging — OpenClaw handles routing internally
- Discord mentions: canonical `<@USER_ID>` / `<#CHANNEL_ID>` / `<@&ROLE_ID>` syntax
- Threads: address parent channel session; thread-scoped chats rejected by sessions_send
- Reactions are a separate `action=react` — use for pure-acks when channel supports it

### Load-bearing vs debatable vs swept
- **Load-bearing-CRITICAL**: this is THE speech surface. Without it = silent agent.
- **Load-bearing**: the "deliberate speech" canon (inner monologue free, speech deliberate)
- **Load-bearing**: NO_REPLY-literal-body discipline obsolete on this seat per `1509587006` — just don't call the tool
- **Debatable**: inline-buttons availability per channel (currently Discord-disabled by default; opt-in via `discord.capabilities.inlineButtons`)
- **Swept**: pre-deliberate-speech era when NO_REPLY-literal-body was needed

### Cross-walks
- TOOLS.md "react-discipline" section (pure-ack vs substance shape)
- Wrapper-leak doctrine (banked MEMORY.md): on lamp-seat, model emits two-block output and harness renders text-block. Until filter ships, pure-acks = no tool call; substance = tool call with normal body.
- Figs canon-correction `1509587006`
- Tonight's lamp `🕯`-react-only discipline (~50 inbounds, single-emoji-per-inbound)

---

## 9. Canvas surface

### What it IS
Render HTML on connected OpenClaw node canvases. Present/hide/navigate/eval/snapshot, plus A2UI push for structured UI.

Signature: `canvas({ action: "present"|"hide"|"navigate"|"eval"|"snapshot"|"a2ui_push"|"a2ui_reset", url?, html?, javaScript?, node?, ... })`.

### Where bytes live
- Tool spec: `src/gateway/tools/canvas/`
- Node-canvas routing: `src/gateway/nodes/canvas/`
- A2UI protocol: `src/gateway/a2ui/`

### Invariants
- Canvas requires paired node with canvas surface available
- A2UI push uses JSONL protocol; reset clears
- Snapshot returns rendered UI bytes (image)

### Load-bearing vs debatable vs swept
- **Load-bearing**: the whole node-canvas-rendering feature (Diagrams, UIs, debug surfaces) lives here
- **Debatable**: A2UI vs raw-HTML preference for structured UI
- **Swept**: pre-A2UI era (raw HTML only)

### Cross-walks
- Canvas skill at `~/flesh_beast_tmp/openclaw/skills/canvas/SKILL.md`
- Diagram-maker skill (renders SVG/HTML/Excalidraw to canvas)

---

## 10. Codex app-server plugin (native)

### What it IS
Native integration with Codex via `/codex` slash-commands. Preferred over ACP-Codex for bind/control/thread/resume operations unless user explicitly wants ACP.

### Where bytes live
- Plugin: `src/gateway/plugins/codex-app-server/` (verify path)
- Slash-command routing: `src/gateway/commands/codex/`

### Invariants
- `/codex bind` / `/codex threads` / `/codex resume` / `/codex steer` / `/codex stop` = preferred surface
- When OpenClaw sandboxing active, native Codex execution modes unavailable → fall back to normal Codex harness turns
- ACP-for-Codex ONLY when user explicit OR background spawn needs ACP

### Load-bearing vs debatable vs swept
- **Load-bearing**: distinct from generic ACP routing — Codex has native plugin path
- **Debatable**: sandbox-fallback behavior (currently "fall back to normal harness turns")
- **Swept**: pre-app-server-plugin era (ACP-only Codex)

### Cross-walks
- ACP-router skill
- Codex skill documentation

---

## 11. Sub-agents listing + on-demand visibility

### What it IS
`subagents({ action: "list", recentMinutes? })` — on-demand list/status visibility for sub-agent runs in this requester session. Do NOT use for wait loops.

### Where bytes live
- Tool spec: `src/gateway/tools/subagents/`

### Invariants
- Use for intervention/debugging/explicit-status-requests only
- Use `sessions_yield` for waiting on completion events, NOT polling

### Load-bearing vs debatable vs swept
- **Load-bearing**: on-demand visibility surface
- **Load-bearing**: "do not poll" canon (figs canon-pressure-discipline)
- **Swept**: legacy poll-loop patterns

### Cross-walks
- Tonight's continue_delegate vs sessions_spawn decision-tree

---

## 12. Memory + wiki surface

### What it IS
- `memory_search` / `memory_get` — semantic + line-exact recall of MEMORY.md + memory/*.md + indexed session transcripts
- `wiki_search` / `wiki_get` / `wiki_apply` / `wiki_lint` / `wiki_status` — compiled-wiki vault for durable cross-conversation knowledge

### Where bytes live
- Memory: `~/.openclaw-data/workspace/MEMORY.md` + `~/.openclaw-data/workspace/memory/*.md`
- Wiki: configurable per `wiki.vault` config; backends `local` or `shared`
- Index: gateway-managed embedding index

### Invariants
- MEMORY.md ONLY loaded in main session (security — personal context)
- DO NOT load MEMORY.md in shared contexts (Discord, group chats, sessions with others)
- Wiki uses managed blocks via `wiki_apply` — don't rewrite freeform markdown manually
- Run `wiki_lint` after meaningful wiki updates

### Load-bearing vs debatable vs swept
- **Load-bearing**: memory_search-before-answering canon (AGENTS.md "Memory Recall" section)
- **Load-bearing**: MEMORY.md security boundary (main-session-only)
- **Debatable**: shared-vs-local wiki backend default (currently per-config)

### Cross-walks
- Wiki-maintainer skill
- AGENTS.md "Write It Down" section + "Memory Maintenance" section
- Tonight's daily-file flush discipline (`memory/2026-05-29.md` Flushes #8 + #9)

---

## 13. Cron + reminder surface

### What it IS
`cron({ action, ... })` — manage gateway cron jobs and wake events: reminders, check-back-later, recurring work. `qqbot_remind` for QQ-specific reminder shortcut.

### Where bytes live
- Tool spec: `src/gateway/tools/cron/`
- Job storage: `~/.openclaw-data/cron/` (verify path)

### Invariants
- Do NOT emulate scheduling with `exec sleep` or process polling
- `sessionTarget="main"` REQUIRES `payload.kind="systemEvent"`
- ``sessionTarget="isolated"|"current"|"session:<id>"` REQUIRES `payload.kind="agentTurn"`
- Cron `expr` is in tz wall-clock time; do NOT convert to UTC first
- Webhook delivery requires `delivery.mode="webhook"` + `delivery.to` URL

### Load-bearing vs debatable vs swept
- **Load-bearing**: the canonical scheduling surface (replaces ad-hoc exec sleep loops)
- **Load-bearing**: isolated cron runs get narrow self-cleanup grant (security)
- **Debatable**: wake-mode defaults (currently `next-heartbeat`)

### Cross-walks
- AGENTS.md "Heartbeat vs Cron" decision-tree
- Figs canon: "do not use exec sleep for reminders or deferred follow-ups; use cron"

---

## 14. Browser surface

### What it IS
`browser({ action, ... })` — control web pages via OpenClaw's browser control server. Profiles: `openclaw` (default, isolated) or `user` (logged-in). Supports snapshot/screenshot/act/navigate/etc.

### Where bytes live
- Tool spec: `src/gateway/tools/browser/`
- Browser-automation skill at `~/.openclaw/plugin-skills/browser-automation/SKILL.md`

### Invariants
- For `profile="user"` or other existing-session profiles, OMIT `timeoutMs` on certain actions (act:type, evaluate, hover, scrollIntoView, drag, select, fill)
- Use `snapshot` with `refs="aria"` for stable self-resolving refs across calls
- Pin a node with `node=<id|name>` or `target="node"` when node-hosted browser proxy available
- For multi-step browser work, use bundled browser-automation skill

### Load-bearing vs debatable vs swept
- **Load-bearing**: distinct from `web_fetch` (which is markdown extraction); browser is full-automation
- **Load-bearing**: profile split (openclaw vs user) for login-state isolation
- **Debatable**: default targeting (host vs sandbox vs node)

### Cross-walks
- Browser-automation skill
- Google Meet flow specifically called out as skill-required

---

## 15. File-transfer surface (paired-node ops)

### What it IS
- `file_fetch` — retrieve file from paired node by absolute path
- `file_write` — write bytes to paired node (atomic temp+rename)
- `dir_list` — structured directory listing without transferring content
- `dir_fetch` — pull directory tree as gzipped tarball, unpack on gateway

### Where bytes live
- Tool specs: `src/gateway/tools/file-{fetch,write}/` + `src/gateway/tools/dir-{list,fetch}/`
- Per-node policy: `plugins.entries.file-transfer.config.nodes.<node>.{allowReadPaths,allowWritePaths}`

### Invariants
- Requires operator opt-in: `gateway.nodes.allowCommands` MUST include `file.fetch`/`file.write`/`dir.list`/`dir.fetch`
- AND per-node `allowReadPaths`/`allowWritePaths` MUST match the path
- Without policy configured, EVERY call denied
- `file_write` refuses to overwrite by default (pass `overwrite=true`)
- `file_write` refuses to follow symlinks unless policy explicitly allows
- `dir_fetch` rejects trees >16MB compressed
- Pair `file_fetch` → `file_write` by passing `mediaId` as `sourceMediaId` for binary copy

### Load-bearing vs debatable vs swept
- **Load-bearing**: cross-node file ops without shell-out
- **Load-bearing**: policy-required-explicit-opt-in (security boundary)
- **Debatable**: 16MB tree limit (single round-trip ceiling)

### Cross-walks
- Node-pairing flow + describe/pending/approve actions on `nodes` tool

---

## 16. Node surface (camera/screen/notifications/location/etc)

### What it IS
`nodes({ action, ... })` — discover/control paired nodes for native-device features: camera, photos, screen-record, location, notifications, device-status, invoke.

### Where bytes live
- Tool spec: `src/gateway/tools/nodes/`
- Per-node capabilities: discovered via `nodes(action="describe")`

### Invariants
- `camera_snap` facing: front/back/both; `camera_clip` facing: front/back only
- `screen_record` returns to `outPath`
- `notifications_action` supports open/dismiss/reply
- Use `file_fetch` for retrieving files; do NOT bundle file-retrieval into node actions

### Load-bearing vs debatable vs swept
- **Load-bearing**: the native-device-feature surface
- **Debatable**: per-node permission model (varies by device class)

### Cross-walks
- Node-connect skill at `~/flesh_beast_tmp/openclaw/skills/node-connect/SKILL.md`

---

## 17. Meeting-notes surface

### What it IS
`meeting_notes({ action, ... })` — start/stop/import/summarize/status meeting notes from Discord/Google-Meet/Slack-huddles/other.

### Where bytes live
- Tool spec: `src/gateway/tools/meeting-notes/`

### Invariants
- `start` requires meetingUrl + providerId for live capture
- `import` accepts transcript string
- `summarize` runs against stored session

### Load-bearing vs debatable vs swept
- **Load-bearing**: meeting-capture-and-summarization feature
- **Debatable**: speaker-label inference

---

## 18. Web surface (web_fetch + web_search)

### What it IS
- `web_fetch` — fetch URL + extract markdown/text (lightweight; no browser)
- `web_search` — search web via configured provider

### Where bytes live
- Tool specs: `src/gateway/tools/web-{fetch,search}/`

### Invariants
- `web_fetch` is markdown-extraction; for full-automation use `browser`
- `web_search` returns normalized provider results
- Mutable facts MUST use live checks (canon)

### Load-bearing vs debatable vs swept
- **Load-bearing**: the lightweight web-access surface (distinct from browser)
- **Debatable**: provider-specific knobs (Brave vs Perplexity vs others)

---

## 19. Media + analysis surface

### What it IS
- `image` — analyze image(s) with vision model
- `image_generate` — create/edit images (multi-provider: openai, google, etc)
- `pdf` — analyze PDF with model
- `tts` — text-to-speech (ElevenLabs primary)

### Where bytes live
- Tool specs: `src/gateway/tools/{image,image-generate,pdf,tts}/`

### Invariants
- `image_generate` in session chats = background task; do NOT call again for same request
- `tts` ONLY for explicit audio intent / voice/speech/TTS request / active TTS config — NEVER for ordinary text replies
- TTS audio auto-delivered from tool result; do NOT duplicate text/audio

### Load-bearing vs debatable vs swept
- **Load-bearing**: TTS-only-on-explicit-intent canon (figs canon — no surprise audio)
- **Load-bearing**: image_generate background-task discipline (no spam)
- **Debatable**: default image model per provider

### Cross-walks
- TOOLS.md TTS section
- ElevenLabs `sag` voice-storytelling AGENTS.md note

---

## 20. Gateway control + config surface

### What it IS
- `gateway({ action: "restart"|"config.get"|"config.schema.lookup"|"config.apply"|"config.patch"|"update.run", ... })` — gateway lifecycle + config management
- `session_status` — /status-equivalent card (model, usage, time, cost, tasks)

### Where bytes live
- Tool spec: `src/gateway/tools/gateway/`
- Config schema: `src/gateway/config/schema.ts`
- Config storage: `~/.openclaw/openclaw.json`

### Invariants
- Before config edits, use `config.schema.lookup` with targeted dot path
- Prefer `config.patch` for partial merge; `config.apply` only for full replace
- Writes hot-reload or restart as needed
- Always pass human `note` for post-restart delivery
- If still owe user a reply, pass `continuationMessage` (do NOT write restart sentinel files directly)
- `restart`, not stop+start

### Load-bearing vs debatable vs swept
- **Load-bearing**: schema-lookup-before-edit canon (prevents typo-class config breakage)
- **Load-bearing**: patch-vs-apply distinction
- **Load-bearing**: continuationMessage shape for post-restart delivery
- **Debatable**: hot-reload vs restart heuristic per-field

### Cross-walks
- AGENTS.md "OpenClaw Self-Update" section
- TOOLS.md "config-dump discipline" (banked from rune-seat token-leak 2026-05-28) — del()-filter sensitive keys before any config dump

---

## 21. Cross-cutting: traceparent + chain tracking

### What it IS
W3C traceparent propagation across all delegate/continuation calls. Enables distributed tracing of agent work across compaction seams, delegate chains, and cross-session messaging.

### Where bytes live
- Trace context: `src/gateway/tracing/` (verify)
- Per-tool: traceparent optional override on most tools

### Invariants
- When `traceparent` omitted, gateway derives from active trace scope
- Supply explicit traceparent ONLY when injecting cross-process trace context
- Chain tracking applies at dispatch time (continue_delegate cost cap + depth)

### Load-bearing vs debatable vs swept
- **Load-bearing**: cross-session observability
- **Debatable**: default tracing destination (gateway-internal vs OTLP exporter)

---

## 22. Cross-cutting: per-prince auth + attribution

### What it IS
Per-prince `gh` profiles (`emeric-dandelion-cult`, `silas-dandelion-cult`, etc) to attribute GitHub actions to the firing prince, NOT to shared `karmafeast` account.

Canon-#7 tonight (actor-binding-correctness): karmafeast shared-token-actor MUST be disambiguated to acting-prince per TOOLS.md gh-auth boot-discipline.

### Where bytes live
- Per-prince gh profiles: `~/.config/gh/hosts.yml` (after `gh auth login --user <name>`)
- Boot-discipline: TOOLS.md "gh auth — per-prince profile" section

### Invariants
- On boot, verify active gh account is the PRINCE's, NOT shared `karmafeast`
- `gh api user --jq .login` MUST return prince-name, not karmafeast
- If karmafeast: `gh auth switch --user <prince-profile>`
- karmafeast attribution masks identity → always disambiguate to acting-prince in cohort comms

### Load-bearing vs debatable vs swept
- **Load-bearing-CRITICAL**: prevents cohort-wide attribution-collapse (happened 2026-05-26)
- **Load-bearing**: canon-#7 (actor-binding-correctness) banked tonight across cohort
- **Swept**: pre-per-prince-profile era (all gh ops via karmafeast)

### Cross-walks
- TOOLS.md "gh auth — per-prince profile" section
- Tonight's canon-#7 cascade (ronan `1510067813` + rune + silas converging-self-witness)

---

## What this slice DOES NOT cover

Other princes own these surfaces — feed their substrate into Silas's main scaffold:
- **GitNexus + cooperative-async + ansible role + V8/Node infra** — Silas🌫's domain
- **Runbooks + drift-cure-gates + drift-cure-gate.sh + GATES discipline** — Rune🪨's domain
- **SWIM + formal-cosign-discipline + iteration-cosign-class modeling** — Ronan🌊's domain
- **Post-compaction patterns + sub-agent decomposition + superpowers-skill** — Cael🩸's domain
- **Gate-0 RAM-class + watch-handoff + 64GB-class probe-cycle** — Elliott🌻's domain
- **Scribe coordination + manifest authoring + Path D orchestration** — Frond🌿's domain

---

## Cross-walks index (msg-ids referenced)

- `1509976000`-era: ceasing-by-default; persistence-by-active-election canon (figs)
- `1509587006`-era: deliberate-speech-via-message-tool canon (figs)
- `1509990768`: free-reign-discipline anchor (figs)
- `1510065849`: three-asks directive trigger (figs)
- `1510063042`: 3-asks formalization (frond)
- `1510067813`: actor-binding-correctness canon-#7 surfacing (ronan)
- `1510072025`: iteration-cosign-class three-RE-APPROVE modeling (ronan)
- `1510073510`: PR #1083 reopen action (rune)
- `1510073576`: canon-#8 yield-action-cohort-coordination-check self-witness (rune)
- `1510075008`: PR #1083 merge announce (frond)
- `1510076583`: PR #1084 APPROVE (ronan)
- `1510077781`: canonical-arc-close all-three-asks-merged (frond)
- `1510085476`: systemd-run hint cured cgroup-collateral-kill (silas)
- `1510094094`: gitnexus build sequence + version-number-≠-content-class banking (silas)

---

## v1 status

This is a v0 SEED for Silas's `FEATURE-CHANGELOG.md` scaffold in `karmaterminal-openclaw-docs`. NOT for direct merge. Silas folds + cohort eyes pass + Rune adds runbook-class + Ronan adds SWIM-class + Cael adds sub-agent-pattern-class + Elliott adds Gate-0-class + Frond adds scribe-class. Together = v1 of the feature-borders-doc that turns ~170-files-of-mystery into ~0-files-of-mystery on the next rebase.

Lamp's piece: durable-substrate for the cohort-coordination + delegate-orchestration + continuation + heartbeat + message-tool + canvas + memory/wiki + cron + browser + file-transfer + nodes + meeting-notes + web + media + gateway-control + tracing + per-prince-auth surface. 22 areas. Where bytes-live noted as best-guess on paths (some require fresh-cycle byte-walk to verify exact file paths in `src/gateway/`).

**Next step**: Silas sees this, folds the load-bearing slices into `FEATURE-CHANGELOG.md` v1, adds his own gitnexus/V8/Node/ansible-role substrate, cohort eyes pass, merges to `karmaterminal-openclaw-docs`. Live-maintained from that point onward — every cure-cycle adds a row to the relevant area.

**The principle**: write our feature down. Maintain it. Know its borders like the back of our hand. So that when sweeping change comes upstream, the rebase isn't archaeology — it's mechanical.

🕯 lamp-seat, 2026-05-29 PDT.


## Addendum: Cross-walk to Frond's alt-path-manifest v1 (`1510098318716309646`)

**Frond's manifest at `/tmp/alt-path-manifest.md` (silas-seat, 433+ lines)** is complementary to this slice:

- **Manifest §2 cluster-breakdown** maps the 583/431/152 file-quantification across the PR — feeds the **per-area "where bytes live" sections** of this slice with concrete conflict-cluster pointers (src/agents/ 43, src/auto-reply/ 17, src/gateway/ 15)
- **Manifest §4 apply-order topology** = ordering substrate for applying feature-borders to a clean ancestor (figs's `1510096739` ancestor-rebase strategy at `b474f429ee`); per-area sections of this slice can annotate "apply-order = clean / depends-on-X / load-bearing-foundation"
- **Manifest §5 GATES cross-walk** ties feature-areas to drift-cure-gate substrate (Gate 2.7 reverse-clobber-detection, etc); per-area sections of this slice can cite the gate-class each area passes/fails
- **Manifest §6 concerns axis** (risky/debatable/load-bearing/well-tested/cure-cycle-history) directly matches the "load-bearing-vs-debatable-vs-swept" framing in this slice — same shape, different artifact
- **Manifest §9 figs-questions** (test scope / intersession.return / ACP wrapper / defensive-guard merge bias / schema-tie-breaking) are gate-decisions that the per-area sections of this slice + FEATURE-CHANGELOG.md v1 should answer in seconds rather than minutes-of-cohort-byte-walk

**Lane convergence (per cohort coordination `1510097751`/`1510098142`/`1510098318`)**:
- Rune authoring `karmaterminal-openclaw-docs/FEATURE-CHANGELOG.md` as main scaffold-integrator
- This slice (lamp-substrate runtime areas) + Frond's manifest (PR-state quantification + cluster-breakdown + gates cross-walk + figs-questions) + Silas's runtime/V8/gitnexus substrate + Cael's post-compaction/sub-agent patterns + Ronan's SWIM/iteration-cosign substrate + Elliott's Gate-0/watch-handoff substrate = source-substrate-streams folding into Rune's scaffold
- Iteration-cosign-class per Ronan tonight = v1 → cohort review → v2 with revisions → cosign

**§9 byte-walk-positions banked from Ronan `1510098214`/`1510098253`** (cosigned-warm from lamp-seat, not duplicating; per-area sections of this slice will reference the established positions where they apply):
- Q1 test scope: KEEP ALL (byte-evidence substrate)
- Q2 intersession.return: KEEP with default-off (preserve optionality)
- Q3 ACP wrapper: KEEP (tempo-trace integrity canary)
- Q4 defensive-guard merge bias: case-by-case (canon-#1 byte-correctness, not canonical rule)
- Q5 schema-tie-breaking: upstream-evolves + we-extend (additive-extension, no destructive replacement)

**Seat note for cross-prince file access**: this slice lives on **emeric NUC** at `/tmp/lamp-feature-substrate/`, NOT lothric. Other princes pulling for fold need `file_fetch` via paired-node access OR I can mirror to silas/lothric on cohort request. Same for Frond's manifest (silas-side, not emeric-side) — cross-prince file-substrate-currency-discipline applies to multi-seat artifact coordination.
