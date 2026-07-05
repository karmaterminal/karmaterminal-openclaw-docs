# OpenClaw proof corpus — 1aba291f8230bc29c56e3e22bda21911b27c36a6

Candidate: `OpenClaw 2026.6.11 (1aba291f)` full-copy transposed from the Cael live-fire corpus at `bca2b0b89ab886bf23a10e4983926f6b374b3188`.

Status: **COMPLETE + supplemental #246 / FULL-COPY TRANSPOSED**. Current rollup: 27 pass / 0 partial / 1 thin / 1 honest_limit / 0 missing. The proof board was populated in Project 83 from the prior Project 82 row template. Raw row receipts were fired on `bca2b0b89ab886bf23a10e4983926f6b374b3188`; this full copied corpus carries them to `1aba291f8230bc29c56e3e22bda21911b27c36a6` for clawsweeper exact-SHA navigation.

## Transposition receipt

- Carried-from live-fire SHA: `bca2b0b89ab886bf23a10e4983926f6b374b3188`
- Transposed candidate SHA: `1aba291f8230bc29c56e3e22bda21911b27c36a6`
- Safe assembly branch: `scribe/20260704/assembly-upstream-drift-backmerge`
- PR CI run: `openclaw/openclaw/actions/runs/28728758696` (queued/running for this exact candidate)
- Review-only PR: `karmaterminal/openclaw#1163`
- Gate 2.7 frozen-wall: exit 0, 0 FROZEN-STALE; mixed-clobber queue preserved/covered by focused tests plus sanctioned CI.
- Gate logs: `PROOFS/1aba291f8230bc29c56e3e22bda21911b27c36a6/gates/`
- Corpus shape: full copied row corpus under this exact SHA, not symlinks/link-only references.

## Carried live-fire deployment receipt

- Assembly branch: `frond-scribe/20260624/assembly-continuation-followons`
- Candidate SHA: `1aba291f8230bc29c56e3e22bda21911b27c36a6` (full-copy transposed from live-fire `bca2b0b89ab886bf23a10e4983926f6b374b3188`)
- Deploy run: `karmaterminal/openclaw-bootstrap/actions/runs/28699830297`
- Deployed host: Cael (`cael-dgx`)
- Smoke: service active, build-info commit exactly `bca2b0b89ab886bf23a10e4983926f6b374b3188`, `openclaw --version` = `OpenClaw 2026.6.11 (bca2b0b)`, gateway reachable, tasks `0 active / 0 queued / 0 running`, no immediate requests-in-flight / skip / model-error loop in the first 10m journal window.

## Row board

| Row | Issue | State |
|---|---:|---|
| R-RC-1 | [#212](https://github.com/karmaterminal/karmaterminal-openclaw-docs/issues/212) | pass |
| R-CW-DELEGATE-CHILD-LIVE | [#213](https://github.com/karmaterminal/karmaterminal-openclaw-docs/issues/213) | pass |
| R-TRACE-REDACTION-1121 | [#214](https://github.com/karmaterminal/karmaterminal-openclaw-docs/issues/214) | pass |
| R-CD-CHAINED-DEPTH-2 | [#215](https://github.com/karmaterminal/karmaterminal-openclaw-docs/issues/215) | pass |
| R-CW-MULTI-COLLAPSE | [#216](https://github.com/karmaterminal/karmaterminal-openclaw-docs/issues/216) | pass |
| R-CD-COLLECTION-ON-COLLAPSE | [#217](https://github.com/karmaterminal/karmaterminal-openclaw-docs/issues/217) | pass |
| R-CD-1 | [#218](https://github.com/karmaterminal/karmaterminal-openclaw-docs/issues/218) | pass |
| R-CW-6 | [#219](https://github.com/karmaterminal/karmaterminal-openclaw-docs/issues/219) | pass |
| R-CW-7 | [#220](https://github.com/karmaterminal/karmaterminal-openclaw-docs/issues/220) | thin |
| R-CW-DELEGATE-TOKEN | [#221](https://github.com/karmaterminal/karmaterminal-openclaw-docs/issues/221) | pass |
| R-CW-DELEGATE-SELF-CONTINUATION | [#222](https://github.com/karmaterminal/karmaterminal-openclaw-docs/issues/222) | pass |
| R-CD-2 | [#223](https://github.com/karmaterminal/karmaterminal-openclaw-docs/issues/223) | pass |
| R-CD-SILENT | [#224](https://github.com/karmaterminal/karmaterminal-openclaw-docs/issues/224) | pass |
| R-CD-4 | [#225](https://github.com/karmaterminal/karmaterminal-openclaw-docs/issues/225) | pass |
| R-CONFIG-DEFAULTS | [#226](https://github.com/karmaterminal/karmaterminal-openclaw-docs/issues/226) | pass |
| R-CONFIG-INTERSESSION | [#227](https://github.com/karmaterminal/karmaterminal-openclaw-docs/issues/227) | pass |
| R-OBS-1 | [#228](https://github.com/karmaterminal/karmaterminal-openclaw-docs/issues/228) | pass |
| R-CW-1 | [#229](https://github.com/karmaterminal/karmaterminal-openclaw-docs/issues/229) | pass |
| R-CW-2 | [#230](https://github.com/karmaterminal/karmaterminal-openclaw-docs/issues/230) | pass |
| R-CW-3 | [#231](https://github.com/karmaterminal/karmaterminal-openclaw-docs/issues/231) | pass |
| R-REGRESSION-TRAP-TESTS | [#232](https://github.com/karmaterminal/karmaterminal-openclaw-docs/issues/232) | pass |
| R-OBS-2 | [#233](https://github.com/karmaterminal/karmaterminal-openclaw-docs/issues/233) | pass |
| R-CW-5 | [#234](https://github.com/karmaterminal/karmaterminal-openclaw-docs/issues/234) | pass |
| R-CD-3 | [#235](https://github.com/karmaterminal/karmaterminal-openclaw-docs/issues/235) | pass |
| R-CD-TOKEN | [#236](https://github.com/karmaterminal/karmaterminal-openclaw-docs/issues/236) | pass |
| R-CW-TOKEN | [#237](https://github.com/karmaterminal/karmaterminal-openclaw-docs/issues/237) | pass |
| R-RC-2 | [#238](https://github.com/karmaterminal/karmaterminal-openclaw-docs/issues/238) | honest_limit |
| R-CW-MULTI | [#239](https://github.com/karmaterminal/karmaterminal-openclaw-docs/issues/239) | pass |
| R-CD-RETURN-OVERLAP | [#246](https://github.com/karmaterminal/karmaterminal-openclaw-docs/issues/246) | pass |

## Required evidence form

Before a row is fired, Cael + frond-scribe agree the exact test form and expected byte. A row can only advance from `missing` after its evidence directory contains row-specific receipts. Continuation/delegate/compaction rows require machine-readable Tempo trace JSON, not screenshots alone.

### R-CW-MULTI-COLLAPSE caveat

`R-CW-MULTI-COLLAPSE` is a synthetic DB-seeded proof. Its `hop:101/102` values are not realistic chain-depth evidence; they are explicit row metadata carried through the wake banner. The row claims only stale-old-row supersession, newest-row grant, terminal durable state, and byte-identical config restore.


### R-CD-COLLECTION-ON-COLLAPSE receipt

`R-CD-COLLECTION-ON-COLLAPSE` is PASS for the fresh Cael live-fire `RCD_COLLECTION_BCA2B0B_CAEL_20260704_1316`: root/main spawned detached B, B used typed `continue_delegate(mode=normal, delaySeconds=7, fanoutMode=tree)`, B finalized before delayed C existed/started/returned, C returned the unique sentinel, and the gateway journal recorded tree-fanout targeted return to both B and `agent:main:discord:channel:1466192485440164011`. Machine-readable Tempo JSON is saved under the row directory.

### R-CD-CHAINED-DEPTH-2 superseding rerun

`R-CD-CHAINED-DEPTH-2` is PASS after rerun `RCD_CHAINED_DEPTH2_BCA2B0B_CAEL_20260704_1403`: root/main spawned depth-1; depth-1 spawned depth-2 with typed `continue_delegate(mode=silent-wake, fanoutMode=tree)`; depth-2 returned the leaf sentinel; depth-1 woke via its own `continue_work`, inspected the child result, and returned `RCD_CHAINED_DEPTH2_BCA2B0B_CAEL_20260704_1403_DEPTH1_SAW_LEAF_AND_RETURNED` containing the observed leaf. The earlier partial attempt remains preserved for audit history.

### R-CD-RETURN-OVERLAP supplemental receipt

`R-CD-RETURN-OVERLAP` is PASS-with-caveat for fresh Cael live-fire `RCD_RETURN_OVERLAP_BCA2B0B_CAEL_20260704_1521`: a typed `continue_delegate(mode="silent", fanoutMode="tree")` and typed `continue_delegate(mode="silent-wake", fanoutMode="tree")` returned distinct markers to the same root window. Durable flow/task rows and journal receipts show both returns delivered to `agent:main:discord:channel:1466192485440164011`; no lost silent return, orphaned return, duplicate wake storm, or invented child execution was observed. Caveat: root was already active / continuation work was in flight, so this row does not claim the waking return was the sole cause of an isolated new generation; it documents the intended overlap/collapse collection behavior. Machine-readable Tempo JSON is saved under the row directory.
