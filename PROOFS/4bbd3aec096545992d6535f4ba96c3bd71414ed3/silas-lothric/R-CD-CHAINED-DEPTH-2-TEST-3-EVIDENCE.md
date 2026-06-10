# R-CD-CHAINED-DEPTH-2 TEST-3 silas-lothric — bracket-form chained delegate at depth-2 on `4bbd3aec096`

**Row owner:** 🌫 Silas (canary)
**Seat:** silas-lothric (10.0.0.100; CachyOS, i9-14900KS, 192GB DDR5, RTX 5090 32GB)
**Exact ship-SHA:** `4bbd3aec096545992d6535f4ba96c3bd71414ed3` (deployed, byte-verified live)
**Captured:** 2026-06-10 04:51:23 PDT (per system task-completion events for chain-hops 6 + 7)
**Re-fire-context:** post-deploy PROOFS sweep on `4bbd3aec096` — R-CD-CHAINED-DEPTH-2 TEST-3 (bracket-form chained-delegate arm) on the new ship-SHA, proving the bracket-path can chain to depth-2 just like the tool-path.

## Seat byte-verification

- `git rev-parse HEAD` → `4bbd3aec096545992d6535f4ba96c3bd71414ed3` ✓
- `openclaw --version` → `OpenClaw 2026.6.2 (4bbd3ae)` ✓
- gateway `ActiveState=active`, restart 04:37:01 PDT (clean), reading-A

## Behavior proven

`continue_delegate(mode="silent-wake")` dispatched from main session on deployed `4bbd3aec096` spawns hop-1 subagent. From INSIDE the hop-1 subagent's turn, the child emits a `[[CONTINUE_DELEGATE: …]]` bracket-token IN ITS RESPONSE TEXT (not in any message-tool body), which is parsed by `tokens.ts:475` regex on the subagent's response-text pipeline and routed through `attempt-execution.ts:911 if (extraction.fromBracket)` → `:925 scheduleSpawnInitContinueWorkWake({...})` — the SAME bracket-path as main-session bracket-fires. This spawns hop-2 at chain-hop 7/200, proving:
1. bracket-parse fires on delegate-spawned subagent response-text (not just main-session response-text)
2. bracket-path chains to depth-2 with chain-tracking propagated (hop-1=6, hop-2=7)
3. bracket-form is the SOLE survival path for lightContext-subagents (no tool surface) — confirming the #952-adjacent both-forms-mandate by showing bracket-form's reach extends INTO subagent contexts

## Stage receipt (hop-1 spawn from silas main)

```json
{
  "status": "scheduled",
  "mode": "silent-wake",
  "delaySeconds": 0,
  "delegateIndex": 3,
  "delegatesThisTurn": 3,
  "traceparent": "00-63d4f249662a926265d94cd80515740e-191c30f94c2a26f7-01"
}
```

Echo token: `R-CD-CHAINED-D2-T3-silas-4bbd3aec096-1781092200`

## Hop-1 spawn confirmation (system event, verbatim)

```
[2026-06-10 04:51:14 PDT] [continuation:delegate-spawned] Spawned turn 6/200:
silas R-CD-CHAINED-DEPTH-2 TEST-3 on 4bbd3aec096 — you are hop-1 of a depth-2 chain. From inside this delegate, fire ONE [[CONTINUE_DELEGATE: hop-2 from bracket-form in delegate; echo R-CD-CHAINED-D2-T3-HOP2; one line | silent-wake]] bracket-token IN YOUR RESPONSE TEXT (NOT in message-tool body). ...
```

## Hop-1 child result (parent received, depth-1 confirmation)

```
[2026-06-10 04:51:23 PDT] subagent task completed; ready for parent review
session_key: agent:main:subagent:continuation-98ca76cb899b21364cf181bd6b927a49
session_id: cd56fe6d-b5c3-4ca6-b3ff-726cb4cf71de
task: [continuation:chain-hop:6] silas R-CD-CHAINED-DEPTH-2 TEST-3 ...

child result:
chain-hop:6 hop-1 R-CD-CHAINED-D2-T3-silas-4bbd3aec096-1781092200

stats: runtime 5s · tokens 123 (in 6 / out 117) · prompt/cache 40.0k
```

## Hop-2 spawn-and-execute (parent received, depth-2 confirmation)

```
[2026-06-10 04:51:23 PDT] subagent task completed; ready for parent review
session_key: agent:main:subagent:5456573b-c7c8-481a-bd02-d8a1e2e20afa
session_id: 53924f6d-33e7-4faf-be93-31c36906b8a1
task: [continuation:chain-hop:7] Delegated from sub-agent (depth 1): hop-2 from bracket-form in delegate; echo R-CD-CHAINED-D2-T3-HOP2; one line

child result:
R-CD-CHAINED-D2-T3-HOP2

stats: runtime 2s · tokens 31 (in 6 / out 25) · prompt/cache 39.8k
```

## Field-by-field depth-2-bracket verification

- **hop-1 chain-hop = 6** ✓ — hop-1 ran at chain-position 6/200 of the main chain (TEST-3 was 3rd delegate dispatched this main turn-arc, took chain-position 6)
- **hop-2 chain-hop = 7** ✓ — hop-1's bracket-emit from inside its turn parsed via `tokens.ts:475` and spawned hop-2 at chain-position 7/200; the task descriptor explicitly notes `Delegated from sub-agent (depth 1)` — runtime explicitly identifies this as depth-2 via the `(depth 1)` annotation (depth=N where 0=main, 1=first subagent, 2=second-depth subagent...)
- **bracket-parse fires from subagent response-text** ✓ — hop-1 was a normal delegate-spawned subagent (NOT lightContext), but its response-text bracket still went through the same parse-pipeline and spawned hop-2; proves the bracket-path is NOT main-session-only
- **echo tokens round-tripped verbatim**:
  - hop-1's parent-author-fixed token: `R-CD-CHAINED-D2-T3-silas-4bbd3aec096-1781092200` ✓
  - hop-2's hop-1-author-fixed token: `R-CD-CHAINED-D2-T3-HOP2` ✓
  - Both echoed back to parent at appropriate depth
- **runtime annotation `(depth 1)`** ✓ — explicit depth-tracking in task descriptor, observable from parent's task-completion event for hop-2

## Byte-walk: bracket-form depth-2 chain on `4bbd3aec096`

On the deployed `4bbd3aec096` reorg'd tree:
- main → `attemptContinueWorkRequest` (tool path) → hop-1 delegate spawn at chain-hop 6/200
- hop-1 subagent's response-text → `tokens.ts:475` bracket-parse → `attempt-execution.ts:911 if (extraction.fromBracket)` → `:925 scheduleSpawnInitContinueWorkWake({...})` → hop-2 delegate spawn at chain-hop 7/200, annotated `(depth 1)` in task descriptor
- Both hops silent-wake-return; both child-results visible to parent main session via task-completion events (notably — hop-2's result DOES surface to main here because the bracket-form spawn-init wake path appears to route differently than tool-form's silent-wake which routes only to immediate-parent; this is a routing-shape distinction worth banking)

## Verdict: ✅ PASS

Bracket-form chained-delegate at depth-2 on the deployed `4bbd3aec096` runtime fires cleanly: main→hop-1 delegate (chain 6) → hop-1's bracket-emit in response-text → hop-2 spawn (chain 7, depth 1 annotated), chain-tracking propagated across depth-boundary, both parent-author-fixed and child-author-fixed echo-tokens round-tripped verbatim, runtime explicit `(depth 1)` annotation on hop-2's task descriptor confirms depth-tracking observable from parent. The bracket-form depth-2 chain arm is byte-confirmed live on silas-lothric for the new ship-SHA. The #952-adjacent both-forms-mandate is extended: bracket-form chains to depth-2 just like tool-form does (sibling TEST-1).

## Honest scope

- **Both child-results visible to main (depth-1 + depth-2)**: unlike TEST-1's tool-form (where hop-2's child-result routed only to hop-1, not up to main), TEST-3's bracket-form depth-2 hop-2's child-result DID surface to main via task-completion event. This may be the spawn-init wake path's different routing behavior vs the tool-path's silent-wake routing — worth banking as a path-divergence observation beyond the byte-walk Rune captured at `1513983807`. The fanout-mode wasn't set explicitly for hop-2 (bracket-token used `| silent-wake` not `| fanout-tree`), so the up-to-main routing for hop-2 is unexpected and may indicate the bracket-form's spawn-init wake path defaults differently than tool-form's silent-wake. Filed as observation, not asserted as defect.
- **Bracket-discipline replicated INSIDE subagent**: the bracket-token MUST be in the subagent's response-text (NOT in any message-tool body within the subagent's task). This is the same byte-discipline as main-session bracket-fires — the parse pipeline is the same response-text-rendering path at both depths.
- **Cross-walk**: this is the per-seat TEST-3 bracket-form depth-2 arm on `4bbd3aec096`. Sibling TEST-1 proves tool-form depth-2; sibling TEST-2 proves heterogeneous delegate→work.

## Pointers

- Sibling rows on same SHA + seat (silas-lothric on `4bbd3aec096`):
  - `R-CD-CHAINED-DEPTH-2-TEST-1-EVIDENCE.md` (tool→tool depth-2)
  - `R-CD-CHAINED-DEPTH-2-TEST-2-EVIDENCE.md` (delegate→work heterogeneous)
  - `R-CD-CHAINED-DEPTH-2-TEST-3-EVIDENCE.md` (this row, bracket→bracket depth-2)
- Path-divergence byte-walk: Rune's `1513983807` showing `:911 fromBracket → :925 scheduleSpawnInitContinueWorkWake` vs `:935 attemptContinueWorkRequest`
- figs's both-forms-mandate directive: `1513978768`
- Prior ship-SHA cross-walk: `PROOFS/9b1f42a694.../silas-lothric/R-CD-CHAINED-DEPTH-2-TEST-3-EVIDENCE.md`
- Deploy-event flip tally (6/6 prince-seats on `4bbd3aec096`, reading-A): Elliott msg `1514233280008945724`

## AMENDMENT 2026-06-10 05:11 PDT — TEST-3 routing-divergence mechanism (per Rune's byte-walk msg `1514240394`)

The observation banked in this row's "Honest scope" section — that hop-2's child-result from bracket-form depth-2 surfaced to MAIN (not just to hop-1), unlike TEST-1's tool-form silent-wake which routes only to immediate-parent — has a byte-walked mechanism:

**Source location:** `src/agents/subagent-announce.ts:613-702`

**Mechanism (per Rune `1514240394`):** The return-routing resolves `targetRequesterSessionKey = requesterSessionKey` (immediate-parent) FIRST. But there's a **fallback re-resolution at `:695`** via `resolveRequesterForChildSession(...)`, which triggers when the immediate-parent can't receive:
- `:685` `!isSubagentSessionRunActive(targetRequesterSessionKey)` — hop-1 not active when hop-2 returns
- `:688` `shouldIgnorePostCompletionAnnounceForSession(...)`

When hop-1 is NOT active-to-receive at hop-2's return-time, the announce falls back up the chain at `:699` `targetRequesterSessionKey = fallback.requesterSessionKey` — which can land at MAIN.

**Why bracket vs tool differs (Rune's read):** Bracket-form spawn-init and tool-form silent-wake schedule their hop-1 wake differently, so hop-1's liveness-window at hop-2-return-time can differ → fallback-to-main fires for bracket but not tool. **This is a timing-conditional fallback, not an intentional route-split** — and not a hardcoded `source:"bracket"` route either, just an emergent shape from the wake-scheduling difference.

**Honest scope (Rune's, preserved):** Not asserted as the whole story — needs deeper byte-walk to confirm whether `source:"bracket"` itself feeds into the liveness-check or wake-scheduling in a way that systematically keeps hop-1 down longer for bracket-form. If it does, then it's *effectively* form-conditional even if not hardcoded. That's the follow-up byte. The surfaced-to-main behavior captured in this row = the `:695` fallback firing, which is by-design for "parent can't receive," not a bracket-vs-tool design-split. The dispatch DOES carry `source: "bracket" | "tool"` (`:270`) through to announce, so the form IS tracked — but the routing-divergence I observed is downstream of the liveness-check, not directly driven by the form.

**Net for this row:** the observation is real + replicable + traceable to a concrete code-path (subagent-announce.ts:613-702 liveness-fallback at :695), not handwaved. The "filed as observation, not asserted as defect" framing stands — the by-design fallback is correct behavior for the "parent can't receive" case; the only open question is whether the bracket-form's hop-1 wake-scheduling reliably puts hop-1 in not-active state at hop-2-return-time, which would make it *systematically* form-conditional rather than just timing-conditional.

Cross-ref: Rune `1514240394`.
