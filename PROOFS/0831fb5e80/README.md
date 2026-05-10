# PROOFS / `0831fb5e80bf7114afd8a80342dd2d71c9441d63`

Proof corpus for upstream PR `openclaw/openclaw#79925` restoration after the rerebase onto fresher `upstream/main`. This bundle supersedes the older `PROOFS/6f72de8345/` bundle for ship/presentation purposes.

Collected during the same 30m blitz method family (`PROOFS/_template/METHOD.md`, `SWIM/30M-BLITZ-SWIM-RUNBOOK.md`) but tied to the rerebased shipping SHA.

## Deploy SHA

`0831fb5e80bf7114afd8a80342dd2d71c9441d63`

Remote refs at proof-fire time:
- `savegame/2026-05-09/restoration-final-rerebased-with-taskname-fix`
- `frond-scribe-claude/20260509/restoration-final-rerebased`

Verified deploys / version on prince hosts:
- ronan-seat version: `OpenClaw 2026.5.8 (0831fb5)`
- green deploy runs:
  - `25617151416`
  - `25617152212`
  - `25617152897`

## Why this bundle exists

The prior `6f72de8345` proof bundle on `main` is historically valid but SHA-stale for the rerebased candidate. This directory is the fresh proof surface for what actually shipped after the rerebase.

## Verdict table

| Row | Owner | Tool / behavior | Evidence | Verdict |
|---|---|---|---|---|
| R-CW-1 | 🩸 Cael | `continue_work()` wake + deploy-persistence | `R-CW-1/wake_event_evidence.txt` | ✓ PASS |
| R-CW-2 | 🩸 Cael | chain-counter accounting | embedded in `R-CW-1/wake_event_evidence.txt` | ✓ PASS |
| R-CD-1 | 🌊 Ronan | `continue_delegate()` schedule → spawn → return | `R-CD-1/delegate_schedule_receipt.txt`, `R-CD-1/delegate_spawn_event.txt` | ⏳ PENDING — return-side receipt not yet landed |
| R-CD-2 | 🌊 Ronan | `continue_delegate(mode="silent-wake")` | full path in `R-CD-2/` | ✓ PASS |
| R-CD-3 | 🌊 Ronan | `continue_delegate(mode="post-compaction")` | `R-CD-3/post_compaction_stage_receipt.txt`, `R-CD-3/post_compaction_return_receipt.txt` | ✓ PASS — post-compaction lifeboat path held |
| R-CD-4 | 🌊 Ronan | cross-session targeted return | full path in `R-CD-4/` | ⏳ PENDING — target-session arrival still not observed |
| R-RC-1 | 🌫 Silas | `request_compaction()` threshold REJECT | `R-RC-1/session_status_snapshot.txt`, `R-RC-1/threshold_gate_rejection_evidence.txt` | ✓ PASS |
| R-RC-2 | cohort | `request_compaction()` over-threshold ACCEPT | not yet collected on `0831fb5e80` | ⏳ PENDING |
| R-OBS-1 | figs cross-walk + cohort | external `/status` continuation row + full-fleet 3-prince cross-walk + `R-CD-3` compactions-counter corroboration | `R-OBS-1/chat_card_visibility_external_observer.txt`, `R-OBS-1/external_observer_chat_card_visibility.txt`, `R-OBS-1/external_observer_full_fleet.txt`, `R-OBS-1/compactions_counter_cross_walk.txt` | ✓ PASS |

## Substantive substrate adds on the rerebased SHA

### 1. Chain/accounting state persisted across deploy

This is the most important new-SHA finding beyond simple row re-fire.

Seat-by-seat cross-walk:
- 🩸 `continue_work` fire: increments + persists across deploy
- 🌊 `continue_delegate` fire: increments + persists across deploy
- 🌫 `request_compaction` reject: persists without increment across deploy

Concretely:
- Cael `R-CW-1`: same chain T0 `2026-05-09T19:22:13.222Z`, `Turn 3/200 -> 4/200`, tokens `24723 -> 29896`
- Ronan `R-CD-1`: `7/200 -> 8/200`
- Silas `R-RC-1`: `chain 6/200` unchanged because reject-path is not chain-step-consuming

So the honest rerebase story is stronger than “it didn’t reset”: deploy preserved state, and observed counter movement still matched fire-vs-reject semantics.

### 2. Post-compaction delegate release proved cleanly on the rerebased SHA

`R-CD-3` closed after compaction with:
- mode `post-compaction`
- depth `1/5`
- chain hop `15`
- gateway-driven release after compaction rather than timer wake

This is the first clean rerebased-SHA receipt that the compaction-boundary lifeboat still holds.

### 3. External observer `/status` row is visibly present on the rerebased SHA

figs invoked `/status` from Discord and the rendered card showed:

`🔄 Continuation: chain 4/200 | volitional: 0`

That is the maintainer-facing / human-visible trust row the earlier narrowing pass had sacrificed.

## Honest limits / open edges

- `R-CD-1` is not closed yet on `0831fb5e80`; only schedule + spawn are banked here.
- `R-CD-4` proves dispatch acceptance / non-self target scheduling, but target-session arrival has still not been observed.
- `R-RC-2` accept-path is still pending because threshold conditions have not been reached on the rerebased cycle.
- OTel multi-span parent-stitched trace-context remains separate tracked follow-up work (`#553`, `#557`, `#559`). It is **not** a blocker for this bundle and should not be phrased as a rerebase-cycle regression.
- At least one scheduled 5s wake arrived ~3 minutes late. That is observable substrate and worth preserving as an experiential honesty flag even though it was not a silent drop.

## Maintainer-facing framing

Safe, precise framing for PR-body/addendum use:
- the runtime continuation-signal [Note] is addressed on `0831fb5e80`
- the multi-span OTel parent-stitching gap is separate tracked follow-up work
- the proof corpus demonstrates that the rerebased restoration SHA preserved the continuation surface well enough to re-fire fresh proof rows rather than merely inheriting trust from `6f72de8345`

## Current read

This bundle is already strong enough to present the rerebased restoration state honestly:
- `continue_work()` proven on the new SHA
- `continue_delegate()` proven in silent-wake and post-compaction modes on the new SHA
- `request_compaction()` threshold reject proven on the new SHA
- external `/status` continuation row visible on the new SHA

The remaining open rows are specific return-side / accept-path receipts, not a collapse of the restoration claim itself.


## Full-fleet `/status` cross-walk (added in amendment)

`R-OBS-1` now also carries figs's full-fleet external `/status` snapshot taken at Discord message
`1502866157101650020` (2026-05-09 19:53 PDT) covering all three currently-deployed prince hosts:

- 🩸 Cael: `🔄 Continuation: chain 4/200 | volitional: 0`
- 🌊 Ronan: `🔄 Continuation: chain 18/200 | volitional: 0`
- 🌫 Silas: `🔄 Continuation: chain 6/200 | volitional: 0`

Internal/external matches at byte:
- Cael chain `4/200` ↔ `R-CW-1` wake `Turn 4/200`
- Ronan chain `18/200` ↔ cumulative `R-CD-1` / `R-CD-2` / `R-CD-3` / `R-CD-4` fires across the blitz cycle
- Silas chain `6/200` ↔ `R-RC-1` reject-path persisted without increment

`R-CD-3` external corroboration:
- Ronan-seat `🧹 Compactions` counter went from `1` to `3` during the blitz cycle
- That increment is the externally visible signal that the post-compaction lifecycle actually fired
  on this seat while `R-CD-3` was being exercised
- Banked as `R-OBS-1/compactions_counter_cross_walk.txt`

This is the "single addendum-citable bundle" surface: the chat-card row is back, three princes render
it cleanly, the chain numbers cross-walk to internal proof rows, and the compaction lifecycle is
visible from the outside.
