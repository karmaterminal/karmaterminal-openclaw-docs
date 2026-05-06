# Swim 7 — canary scorecard and methodology snapshot

**Cycle window**: historical canary cycle after Swim 6
**SUT**: canary continuation build on a 4-agent persistent-session formation
**Build**: `b07e7e40c`
**Result**: 10 pass · 2 deferred · 0 fail

## Status

This page preserves historical continuation evidence evacuated from the older
`karmaterminal/openclaw` branch `ronan/rfc-evidence-appendix`, which served as an
RFC evidence surface before `karmaterminal-openclaw-docs` existed.

It is historical evidence, not the current validation cycle.

## Scorecard

| Test | Description | Result |
| --- | --- | --- |
| 7-B | Delegate tolerance hot-reload (`0→cancelled`, `300→fired`) | ✅ PASS |
| 7-C | `continue_work` tolerance hot-reload (unified with delegate tolerance) | ✅ PASS |
| 7-D | Width widen without restart (`5→12`, `12/12` accepted) | ✅ PASS |
| 7-E | Width narrow without restart (`12→3`, `3/5` accepted, 2 rejected) | ✅ PASS |
| 7-F | Chain boundary enforcement | ✅ PASS |
| 7-H | Textless-turn delegate consumption | ✅ PASS |
| 7-K | Silent-return trust boundary | ✅ PASS |
| 7-M | Blind enrichment accuracy | ✅ PASS |
| 7-I | Post-compaction guard parity | ⏸️ DEFERRED |
| 7-J | Grandparent reroute ordering | ⏸️ DEFERRED |

## Methodology snapshot

Historical methodology note preserved from the source branch:

- 4-agent persistent-session canary formation
- one agent as test administrator
- one agent as subject under test (SUT)
- one agent as log monitor
- one agent as coordinator
- operator-provided ground truth for blind enrichment checks

The key trust-boundary finding from 7-K / 7-M was that silent enrichment arrives
as internal context that is indistinguishable from self-knowledge from inside the
receiving session. Provenance had to be established from logs and reasoning, not
from introspection.

## Key evidence lines preserved from the source branch

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

### Width widen + narrow (7-D / 7-E)

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

## Source artifacts evacuated into this page

The historical source material came from:

- `karmaterminal/openclaw` branch `ronan/rfc-evidence-appendix`
- `docs/design/continue-work-signal-v2.md` (historical appendix)
- `SEAL-BOY-SWIM-RUNBOOK.md`
- `SWIM-MONITORING-RUNBOOK.md`
- `SWIM-SUBJECT-NOTES.md`
- `SWIM-COORDINATOR-NOTES.md`

Those runbooks remain valuable as historical methodology artifacts, but the core
release-facing evidence moved here so the RFC can point at stable public docs
instead of an old branch lineage.
