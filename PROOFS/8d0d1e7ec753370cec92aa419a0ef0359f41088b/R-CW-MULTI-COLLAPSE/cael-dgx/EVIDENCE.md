# R-CW-MULTI-COLLAPSE — cael-dgx live stale-fold proof

## Claim

PASS. A live same-session `continue_work` stale-backlog collapse was forced under figs-authorized temporary continuation timing, then the live config was restored.

The two injected durable continuation flow rows used the same session/chain and marker `RCW_COLLAPSE_CAEL_1782635391621`:

- `rcw-collapse-cael-old-1782635391621` — stale/old election, reason `OLD_STALE should supersede`
- `rcw-collapse-cael-new-1782635391621` — newest election, reason `NEWEST should drive`

The wake delivered the newest reason (`Turn 102/200 reason NEWEST should drive`) and the system wake note reported `1 stale continue_work wake folded into newest`. SQLite then shows the old row completed as superseded and the new row granted/succeeded.

## Live bytes

- `newest-wake-receipt.txt` records the actual wake surface: newest reason drove the wake, with the stale fold note.
- `post-dispatch-sqlite.txt` / `post-restore-sqlite.txt` show:
  - old flow `status=succeeded`, `current_step="superseded: Superseded by a newer continue_work election after a 40331ms stale backlog."`
  - new flow `status=succeeded`, `current_step="Same-session continuation turn granted"`, with `releasedAt`, `turnGrantedAt`, and `succeeded` in `state_json`.
- `receipt.txt` is the fresh post-rescue receipt from the live DB and config.

## Config safety / restoration

figs authorized direct JSON edit + gateway restart for this row. The config was temporarily lowered to make the stale backlog observable:

- lowered: `minDelayMs=1000`, `defaultDelayMs=1000`, `maxDelayMs=1000`
- restored live file: `minDelayMs=5000`, `defaultDelayMs=15000`, `maxDelayMs=86400000`

`config-lowered.json` / `config-active-lowered.json` preserve the temporary state. `config-restored.json` / `config-final-restored-file.json` and `receipt.txt` preserve restored config bytes. No lowered config remains live.

## Tempo trace

No genuine Tempo trace JSON was captured from this rescue run. Per corpus rules, no trace is fabricated and manifest `traces` is `0`.

## Supporting files

- `pre-dispatch-sqlite.txt`
- `post-dispatch-sqlite.txt`
- `post-restore-sqlite.txt`
- `config-lowered.json`
- `config-active-lowered.json`
- `config-restored.json`
- `config-final-restored-file.json`
- `insert-vars.json`
- `newest-wake-receipt.txt`
- `receipt.txt`
