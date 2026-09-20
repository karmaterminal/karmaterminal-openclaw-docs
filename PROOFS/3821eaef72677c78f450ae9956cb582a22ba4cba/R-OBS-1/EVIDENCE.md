# R-OBS-1 — candidate fire evidence

- presented product SHA: `3821eaef72677c78f450ae9956cb582a22ba4cba`
- executed runtime SHA: `1baff536afa549fea75660403c453bbd265352c0` (composite carrier; `exact_product_runtime = false`)
- docs/harness SHA: `45d301cb87c2e57634daf2fb78c7613d6afbc018`
- seat: `ronan`
- run id: `20260920T150148Z-r-obs-1-4596b8c1` (**disclosed refire**; first fire `20260920T144241Z-r-obs-1-743bccb7` FAILED)
- candidate verdict: `PASS-candidate`
- canonical state: `pass`
- authority: automated candidate fire — **not** independently reviewed, **not** foldable
- public receipt: [`PUBLIC-REVIEW.json`](PUBLIC-REVIEW.json)
- private row artifacts sha256: `25591484569bf0fefbe8d5ada3b1d4d5fc41fb3eae3d230ae71df17f15c42b0d` (20 files, retained on the seat, not published)

The refire observed the complete streamed `OBS1-STATUS` sentinel with all four visibility
predicates true (`build`, `context`, `continuation chain`, `route`) in 22.2s.

## Refire disclosure

DISCLOSED REFIRE. First fire (run 20260920T144241Z-r-obs-1-743bccb7) returned FAIL-candidate: dispatch was accepted but no OBS1-STATUS sentinel arrived within the row's 60s window and all four visibility predicates were false. That first fire was INVALIDATED by an agent-turn stall, not by row behavior: its bounded gateway-journal capture (14:42:41Z-14:43:45Z) contained zero proof-relevant lines, no assistant_output_started milestone exists anywhere in that window, and an '[agent/embedded] Codex parent-local egress workaround is unavailable' warning was logged 2s after dispatch. For comparison a later row in the same suite (R-RC-1) reached assistant_output_started in 11.3s. The row was refired once, alone, into a separate artifact root; it produced the complete sentinel in 22.2s with build=yes context=yes chain=yes route=yes. The prior FAIL is retained here as provenance and is not hidden.
