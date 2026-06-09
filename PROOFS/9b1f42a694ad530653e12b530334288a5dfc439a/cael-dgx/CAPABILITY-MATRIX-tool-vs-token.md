# Tool-vs-Token Capability Matrix — continuation primitives (deployed 9b1f42a694)

**Owner:** 🩸 Cael | **Deployed:** `OpenClaw 2026.6.2 (9b1f42a)` | per figs's 2026-06-09 directive: *"test tools AND tokens for all-of-the-things... if you're not explicitly testing both ||TOKEN|| and tool form where those exist, you should be."*

The continuation primitives have **two independent entry surfaces** — the typed **tool** (normal-ops path, highest priority) and the **||TOKEN||/bracket** form (the ONLY path when continuation is enabled but **tools are DENIED** — light-context leaf subagents; explicit in `signal.ts`: *"Critical for subagent chain-hops where the bracket is the ONLY continuation path"*). A proof testing only one form is **blind to exactly the path #952 broke on.** Both forms MUST be tested where both exist.

| Primitive | tool-form | token-form | token in TOOLS-DENIED (light-context) |
|---|---|---|---|
| `continue_work` | ✅ (R-CW-1, gate-grade) | ✅ parses + drives (main-channel: clean wake→drive Turn 24/200; subagent turn-1 via `attempt-execution.ts:910`) | ⚠️ **BROKEN in subagent CHAIN-HOP** — `subagent-announce.ts:975` `"CONTINUE_WORK not supported in sub-agent chain, ignoring"` → **#952/#958** (heartbeat-substrate category error, re-drive mis-routed) |
| `continue_delegate` | ✅ | ✅ parses (`tokens.ts` `parseDelegateDirective`) | ⚠️ **BROKEN in light-context** — `:2618` delegate-dispatch unreachable (`runReplyAgent` never called on subagent path), spawn-init peek leaves marker inert (smoking-gun test `attempt-execution.continue-work-opts.test.ts:235-252`) → **#974/#976**; ALSO token MISSING `mode=post-compaction` directive entirely → **#976** |
| `request_compaction` | ✅ | — (tool-only **by design**) | N/A — correct, no token form, no fix needed |

## The deviation figs flagged, byte-confirmed
**BOTH** token-forms are non-functional in the tools-denied light-context case — the exact condition the token-fallback exists for:
- `continue_work` token → ignored in subagent chain-hop (#952/#958)
- `continue_delegate` token → unreachable/inert in light-context (#974/#976), AND can't express `post-compaction` (the most-needed mode for the constrained context) (#976)

## Honest-correction note (byte over my own story)
cael's first consolidation (`1513981803`) claimed "continue_delegate token IS dispatched in subagent chain-hop" — that was an **existence read, not a reachability walk** (saw `:977` dispatch code, didn't verify a leaf's marker reaches it end-to-end). 🪨 Rune's #974 reachability-walk (`runReplyAgent` grep=0 + smoking-gun test) is the authoritative one; corrected here. The `:977` path is the PARENT-announce-flow (`runSubagentAnnounceFlow`, child-return trigger), distinct from the leaf's-own-turn paths which don't fire it.

## Proof-discipline going forward
Every R-CW-* / R-CD-* row MUST fire BOTH forms (tool + token); token-cells MUST test the tools-denied condition specifically (the failure surface). Tool-only proofs are blind to #952/#974. (`request_compaction` tool-only is the one exception, by design.)

## Fix lanes (pinned, in-flight)
- **#976** (continue_delegate token post-compaction parity) → 🌊 Ronan (copilot lane, in-flight)
- **#974** (continue_delegate token unreachable in light-context) → confirmed-deviation, 🪨/🌻/🌊 walked
- **#952/#958** (continue_work token chain-hop direct-drive) → open, heartbeat-substrate forward-fix
- cael: awaiting frond arbiter-call on canonical-issue + assembly-target + lane-division
