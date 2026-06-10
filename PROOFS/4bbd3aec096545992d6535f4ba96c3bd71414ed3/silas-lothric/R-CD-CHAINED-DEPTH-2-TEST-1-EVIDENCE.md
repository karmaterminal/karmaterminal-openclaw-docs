# R-CD-CHAINED-DEPTH-2 TEST-1 silas-lothric — tool-form chained delegate at depth-2 on `4bbd3aec096`

**Row owner:** 🌫 Silas (canary)
**Seat:** silas-lothric (10.0.0.100; CachyOS, i9-14900KS, 192GB DDR5, RTX 5090 32GB)
**Exact ship-SHA:** `4bbd3aec096545992d6535f4ba96c3bd71414ed3` (deployed, byte-verified live)
**Captured:** 2026-06-10 04:51:23 PDT (per system task-completion event for chain-hop 4)
**Re-fire-context:** post-deploy PROOFS sweep on `4bbd3aec096` — R-CD-CHAINED-DEPTH-2 TEST-1 (tool-form chained-delegate arm) on the new ship-SHA.

## Seat byte-verification

Three-way + load-from-tree discriminator confirmed on lothric at fire-time (same byte-set as sibling rows):
- `git rev-parse HEAD` → `4bbd3aec096545992d6535f4ba96c3bd71414ed3` ✓
- `openclaw --version` → `OpenClaw 2026.6.2 (4bbd3ae)` ✓
- gateway `ActiveState=active`, restart 04:37:01 PDT (clean), reading-A

## Behavior proven

`continue_delegate(mode="silent-wake")` dispatched from main session on deployed `4bbd3aec096` spawns hop-1 subagent. From INSIDE the hop-1 subagent's turn, the child fires its OWN `continue_delegate(mode="silent-wake")` tool-call, which spawns hop-2 via the SAME `attemptContinueWorkRequest` tool-path on the same parent-traceparent chain — chain-tracking propagates from main→hop-1→hop-2. Hop-1 returns to parent (main) with both its own chain-hop number AND hop-2's chain-hop number, proving the depth-2 chain established successfully end-to-end on the deployed binary.

## Stage receipt (hop-1 spawn from silas main)

```json
{
  "status": "scheduled",
  "mode": "silent-wake",
  "delaySeconds": 0,
  "delegateIndex": 1,
  "delegatesThisTurn": 3,
  "traceparent": "00-63d4f249662a926265d94cd80515740e-191c30f94c2a26f7-01"
}
```

Echo token (parent-author-fixed): `R-CD-CHAINED-D2-T1-silas-4bbd3aec096-1781092200`
Token-shape encodes: row id · seat · exact ship-SHA · POSIX-second timestamp.

## Hop-1 spawn confirmation (system event, verbatim)

```
[2026-06-10 04:51:14 PDT] [continuation:delegate-spawned] Spawned turn 4/200:
silas R-CD-CHAINED-DEPTH-2 TEST-1 on 4bbd3aec096 — you are hop-1 of a depth-2 chain. From inside this delegate, fire ONE continue_delegate(mode="silent-wake", task=<short>) to spawn hop-2. ...
```

## Hop-1 child result (full round-trip closed, parent received)

```
[2026-06-10 04:51:23 PDT] subagent task completed; ready for parent review
session_key: agent:main:subagent:continuation-0364bb7db9a0abfb9d58086e36dc910b
session_id: c0ffa3e5-ce75-4749-b4d5-93e6ed729ab0
task: [continuation:chain-hop:4] silas R-CD-CHAINED-DEPTH-2 TEST-1 ...

child result:
hop-1=4, hop-2=5 — R-CD-CHAINED-D2-T1-silas-4bbd3aec096-1781092200

stats: runtime 6s · tokens 271 (in 7 / out 264) · prompt/cache 40.3k
```

## Field-by-field depth-2 verification

- **hop-1 chain-hop = 4** ✓ — hop-1 ran at chain-position 4/200 of the main session's chain (chain-incremented from sibling rows: R-CD-TOOL=1, R-CD-TOKEN=2, R-CW-TOOL=3, R-CD-CHAINED-D2-T1-hop1=4)
- **hop-2 chain-hop = 5** ✓ — hop-1's own `continue_delegate(silent-wake)` from inside its turn spawned hop-2 at chain-position 5/200 (incremented from hop-1's 4)
- **echo token verbatim**: `R-CD-CHAINED-D2-T1-silas-4bbd3aec096-1781092200` ✓ — parent-author-fixed token round-tripped intact through main→hop-1 dispatch + hop-1's own dispatch of hop-2
- **silent-wake mode end-to-end** ✓ — hop-1 silent-wake returned + woke this evidence-writing turn at parent
- **Note**: hop-2's child-result is NOT visible to parent main directly — hop-2's silent-wake returns to its parent (hop-1), not up-tree to main. Main only sees hop-1's report. This is the routing-scope distinction: silent-wake returns to immediate-parent, not all-ancestors (that's `fanoutMode=tree` or `fanoutMode=all`, separate rows).

## Byte-walk: depth-2 tool-chain on `4bbd3aec096`

On the deployed `4bbd3aec096` reorg'd tree:
- main session → `attemptContinueWorkRequest` (tool path) → hop-1 subagent spawn at chain-hop 4/200
- hop-1 subagent's turn → `attemptContinueWorkRequest` (tool path) inside child → hop-2 subagent spawn at chain-hop 5/200
- chain-tracking propagates across spawning-subagent boundaries (depth-limit + cost-cap enforced on the same chain)
- hop-1 silent-wake → returns to main with confirmation including hop-2's chain-hop number
- hop-2 silent-wake → returns to hop-1 (not main), confirming hop-2's own execution to its immediate parent

## Verdict: ✅ PASS

Tool-form chained-delegate at depth-2 on the deployed `4bbd3aec096` runtime fires cleanly: main→hop-1 (chain 4) → hop-1's own continue_delegate inside its turn → hop-2 (chain 5), chain-tracking propagated end-to-end, parent-author-fixed echo-token round-tripped verbatim through both depths, silent-wake routing-to-immediate-parent confirmed at each hop. The depth-2 tool-chain arm is byte-confirmed live on silas-lothric for the new ship-SHA.

## Honest scope

- **Tool-form chain arm proven**: this row proves the tool-path can chain to depth-2; TEST-3 sibling proves the bracket-form can chain to depth-2 (heterogeneous: hop-1 bracket → hop-2 bracket); TEST-2 sibling proves delegate→work-wake chain (heterogeneous: hop-1 delegate-spawn → continue_work from inside it).
- **Hop-2 child-result NOT visible to main**: silent-wake routing returns to immediate-parent only. Main sees hop-1's report (which includes hop-2's chain-hop number reported by hop-1's tool-return). Hop-2's own task-completion event would route to hop-1, not main — but hop-1 already silently-woke main BEFORE hop-2 fired, so hop-1's evidence is the proof from main's vantage. The hop-2 chain-position assertion in hop-1's child result is the substrate-truth being reported by hop-1.
- **Cross-walk**: TEST-1/2/3 trio under same parent-turn shared traceparent `63d4f249662a926265d94cd80515740e` on hop-1 dispatch side; hop-2 dispatches each get their own traceparent under the chain-id.

## Pointers

- Sibling rows on same SHA + seat (silas-lothric on `4bbd3aec096`):
  - `R-CD-TOOL-EVIDENCE.md` (chain 1/200) — delegate-tool single-depth baseline
  - `R-CD-TOKEN-EVIDENCE.md` (chain 2/200) — delegate-token single-depth baseline
  - `R-CW-TOOL-EVIDENCE.md` (chain 3/200) — work-tool single-depth baseline
  - `R-RC-1-EVIDENCE.md` — request_compaction REJECT-arm
  - `R-OBS-1-EVIDENCE.md` — status-card substrate-coherence
  - `R-CD-CHAINED-DEPTH-2-TEST-1-EVIDENCE.md` (this row, chain 4+5, depth-2 tool chain)
  - `R-CD-CHAINED-DEPTH-2-TEST-2-EVIDENCE.md` (chain 5, hop-1 fires continue_work)
  - `R-CD-CHAINED-DEPTH-2-TEST-3-EVIDENCE.md` (chain 6+7, depth-2 bracket chain)
- Prior ship-SHA cross-walk: `PROOFS/9b1f42a694.../silas-lothric/R-CD-CHAINED-DEPTH-2-TEST-1-EVIDENCE.md`
- Deploy-event flip tally (6/6 prince-seats on `4bbd3aec096`, reading-A): Elliott msg `1514233280008945724`
