# Row 01 — pre-swim gate / substrate declaration

**Verdict**: PASS
**Swim**: Swim 43 — v5.5 FULL continuation swim
**Family**: Rollout / Observability / gate prerequisite
**Driver**: 🌊 Ronan
**SUT**: 🩸 Cael
**Canonical branch**: `frond/v2026.5.5/canonical`
**SHA**: `24b76bf62afa7da77eed11ddd7f22c9eba019f58`
**Tag basis**: `v2026.5.5`
**Seat under test**: `agent:main:discord:channel:1466192485440164011`

## Claimed gate items

1. exact running artifact named before behavioral fire
2. fleet-roll-to-all-princes complete
3. named SUT runtime pack exists on actual deployed bytes
4. tool visibility verified in-context on named SUT
5. project spine / scoreboard surface exists and is truthful enough to carry the cycle

## Evidence surfaces

### Fleet deploy receipts

Wave A landed the fleet on the exact candidate:
- cael `25478324254` ✅
- elliott `25478329597` ✅
- silas `25478331187` ✅
- ronan `25478332876` ✅

Redundant Wave B was stale-gate noise/cancellations only.

### Runtime truth

All four hosts byte-walked on:
- `OpenClaw 2026.5.5 (24b76bf)`
- build-info `24b76bf62afa7da77eed11ddd7f22c9eba019f58`

Named SUT (cael-seat) surfaced the 5-item pack on deployed v5.5:
- `openclaw --version` = `OpenClaw 2026.5.5 (24b76bf)`
- build-info = `24b76bf62afa7da77eed11ddd7f22c9eba019f58`
- continuation tools visible in-generation: `continue_work`, `continue_delegate`, `request_compaction`, `sessions_spawn`
- config ordinary / no obvious continuation-specific drift
- gateway healthy / baseline clean

### Board / durable artifact truth

Project 67 board truth is established via:
- direct item-node lookup for `#915` / `#907`
- reverse `issue -> projectItems`

Forward aggregate/list path on project 67 is a known lying witness tonight and is not used as authority.

## Notes

- systemd unit `Description` may still show stale version text; `openclaw --version` and `dist/build-info.json` are authoritative.
- This row closes the old artifact-truth blocker. It does **not** certify any behavioral family yet.
- Behavioral rows begin after this file; FULL remains unearned until the declared registry-v1 surface is actually exercised.
