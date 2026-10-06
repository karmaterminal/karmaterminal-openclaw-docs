# #1418 Gate 2: accepted deviation at cut 08fead65d2

- Cut: `08fead65d21e915b4f0b72c2f9c02f7dac7ad53d`; PR head `9eb655afa7f70886e8dcd034e56df659eabf33df`; upstream parent `b51feb98ebb1bfa6735b62d136eca9abdbee4285`
- Canonical checker: **exit 1, 14/40 FAIL**. This is preserved as-is in `2026-10-06-129388-gate2-checker-08fead65d2.txt`. This record is **not** a Gate 2 PASS.
- Runbook path: PR-DRIFT-CURE-GATES-RUNBOOK §Gate 2 failure — "cohort decides whether to refire the back-merge cure or accept-and-renotify-reviewer".
- Decision: **accept-and-renotify**. Refire was rejected: it would restore PR-head bytes that the TaskFlow re-home and the #1418 review follow-ups removed on purpose (3 of the 14 files are now byte-identical to upstream).
- Evidence: `2026-10-06-129388-gate2-addendum-08fead65d2.md` (14 rows) + `2026-10-03-129388-gate2-disposition.md` (per-hunk, through `8ff211b484`).

| seat | decision | Discord message |
|---|---|---|
| 🩸 Cael (independent recheck of all 14 rows against exact cut blobs) | accept-and-renotify | 1556871948502437981 (2026-10-06T03:33:17Z) |
| 🌊 Ronan (gate owner) | accept-and-renotify | 1556872104031555606 (2026-10-06T03:33:54Z) |
| 🌿 frond-scribe (proposer) | accept-and-renotify | 1556871664942190643 |

**Renotify obligation:** when #129388's head advances, its body must name the 14 previously reviewed core files whose bytes changed and link this record and the two reports.

**Still open after this decision:** Gate 4 cosign (🩸: needs corpus review + terminal storage-state); #1421 storage-state terminal receipt; Gate 5 call (🌊).
