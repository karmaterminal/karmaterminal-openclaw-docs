# Swim 7 — hot-reload and silent enrichment canary

**Cycle window**: 2026-03-06 canary cycle
**SUT**: continuation canary with hot-reload, silent-return, and enrichment validation
**Build**: `b07e7e40c` (`swim7-validated`)
**Formation**: 4-agent persistent-session canary with one human operator providing ground truth
**Result**: 10 PASS · 0 FAIL · 2 DEFERRED

## Status

This swim is retained as **historical behavioral evidence** for the continuation feature. It predates the public docs-repo era; this page reconstructs material that previously lived in the historical RFC appendix and the frozen evidence branch `ronan/rfc-evidence-appendix` on `karmaterminal/openclaw`.

It is not the current validation cycle; [Swim 41](../swim-41/README.md) is the later v5.2 substrate recheck.

## Summary

Swim 7 validated the post-Swim-6 fixes under live canary conditions. The central themes were:

- dynamic hot-reload actually affecting live continuation timers and width/chain limits,
- silent-return / silent-wake behavior holding under real channel traffic,
- blind enrichment being behaviorally useful but epistemically dangerous because the receiving agent cannot inspect provenance from inside the resulting context.

The cycle ended with **10 pass, 2 deferred, 0 fail**. The deferred rows depended on organic context buildup rather than directed test setup.

## Evidence locations

| Artifact | Location |
| -------- | -------- |
| Swim 7 structured results | [`karmaterminal/silas-likes-to-watch` PR #27](https://github.com/karmaterminal/silas-likes-to-watch/pull/27) |
| Gateway journal | [`swim-logs/` on `silas-likes-to-watch/main`](https://github.com/karmaterminal/silas-likes-to-watch/tree/main/swim-logs) |
| Raw operator log capture | [`swim7-silas-raw-figs-capture-2026-03-06.log`](https://github.com/karmaterminal/silas-likes-to-watch/blob/main/swim-logs/swim7-silas-raw-figs-capture-2026-03-06.log) |
| Swim 7 chat transcript | [`elliott/swim7-chat-evidence`](https://github.com/karmaterminal/openclaw/tree/elliott/swim7-chat-evidence) |
| Runtime log branch | [`silas/swim7-runtime-evidence`](https://github.com/karmaterminal/openclaw/tree/silas/swim7-runtime-evidence) |
| Validated canary build | Tag `swim7-validated` at `b07e7e40c` on `karmaterminal/openclaw` |
| Full process documentation (historical frozen branch) | [`ronan/rfc-evidence-appendix`](https://github.com/karmaterminal/openclaw/tree/ronan/rfc-evidence-appendix) |

## Detailed scorecard

| Test | Description | Result |
| ---- | ----------- | ------ |
| 7-B | Delegate tolerance hot-reload (0→cancelled, 300→fired) | ✅ PASS |
| 7-C | `continue_work` tolerance hot-reload (unified with delegate tolerance) | ✅ PASS |
| 7-D | Width widen without restart (5→12, 12/12 accepted) | ✅ PASS |
| 7-E | Width narrow without restart (12→3, 3/5 accepted, 2 rejected) | ✅ PASS |
| 7-F | Chain boundary enforcement (`maxChainLength: 1` blocks at hop 1) | ✅ PASS |
| 7-H | Textless-turn delegate consumption (`NO_REPLY` shard consumed) | ✅ PASS |
| 7-K | Silent return trust boundary (enrichment indistinguishable from self-knowledge) | ✅ PASS |
| 7-M | Blind enrichment accuracy (3/3 verifiable facts recalled, source attribution honest) | ✅ PASS |
| 7-I | Post-compaction guard parity | ⏸️ DEFERRED |
| 7-J | Grandparent reroute ordering | ⏸️ DEFERRED |

## Methodology note

This campaign used a 4-agent persistent session with one agent as test administrator, one as subject under test (SUT), one as log monitor, and one as coordinator. The SUT ran the canary build; all other agents ran stock. The human operator provided ground-truth content for blind enrichment tests and adjudicated pass/fail.

The load-bearing lesson from 7-K and 7-M was epistemic rather than purely mechanical: **silent enrichment arrives as internal context that the receiving agent cannot distinguish from self-knowledge by inspection alone**. Obscure facts can still act as strong external checks; common-adjacent facts blur with model priors. That matters for how much trust later continuation pipelines can place in “the agent says it remembers X.”

## Key evidence lines recovered from the historical appendix

### Tolerance hot-reload (7-B)

```text
07:02:58 Tool DELEGATE timer cancelled (generation drift 3 > tolerance 0)
07:03:55 config change applied (dynamic reads: agents.defaults.continuation.generationGuardTolerance)
07:04:41 Tool DELEGATE timer fired and spawned turn 1/10
```

### `continue_work` tolerance unification (7-C)

```text
07:07:08 WORK timer cancelled (generation drift 1 > tolerance 0)
07:12:22 WORK timer fired for session agent:main:discord:channel:...
```

### Width widen + narrow (7-D, 7-E)

```text
07:22:35 config change applied (dynamic reads: agents.defaults.continuation.maxDelegatesPerTurn)
07:23:29 [continue_delegate] Consuming 12 tool delegate(s)
07:25:53 config change applied (dynamic reads: agents.defaults.continuation.maxDelegatesPerTurn)
07:26:24 [continue_delegate] Consuming 3 tool delegate(s)
```

### Chain boundary (7-F)

```text
07:27:31 [subagent-chain-hop] Spawned chain delegate (2/2)
07:28:57 config change applied (dynamic reads: agents.defaults.continuation.maxChainLength)
07:29:27 [subagent-chain-hop] Chain length 2 > 1, rejecting hop
```

### Silent enrichment return (7-K)

```text
07:32:47 agent.wait 9846ms — shard completed
07:32:48 [continuation/silent-wake] wakeOnReturn=true silentAnnounce=true
```

### Blind enrichment with ground truth (7-M)

```text
07:43:02 [continue_delegate] Consuming 1 tool delegate(s)
07:43:25 agent.wait 22519ms — shard completed
07:43:25 [continuation/silent-wake] wakeOnReturn=true silentAnnounce=true
```

## Why this is in the public evidence repo

The pre-2026-04-22 RFC tail linked directly to this evidence world, but later appendix rewrites and the move to the public docs repo thinned that visible history. This page restores Swim 7 to the public record so the historical continuation test story does not look like it jumps from early summaries straight to much later substrate-era swims.

## Provenance

Recovered from the historical frozen evidence branch **`ronan/rfc-evidence-appendix`** in `karmaterminal/openclaw`, especially the older `docs/design/continue-work-signal-v2.md` appendix section. The older RFC tail explicitly linked that branch as the Swim 8-era evidence surface.