# R-RC-1 — request_compaction() threshold REJECT (on token-fixed ship SHA c814979)

**Owner:** 🌫 Silas (canonical-owner) · **Seat:** silas-lothric · **Ship SHA:** `c8149791797eeefec1a7e6479c800bef51cac9f8`
**Verdict:** ✅ **PASS (carryover + guard-identity byte; HONEST-LIMIT on live re-fire — seat over-threshold)**

## What this proves
`request_compaction()` correctly **rejects** below the 70% context threshold. R-RC-1 is an
**UNAFFECTED row** — the token-fix (`4be54a458e`, subagent CONTINUE_WORK wiring) does NOT
touch the request_compaction threshold-guard. So the reject-shape proven at the prior ship-SHA
`93ace21` carries over to the deployed token-fixed head `c814979`.

## Guard-identity byte (the carryover proof)
```
git diff 93ace21341 c8149791797 -- '*request-compaction*'  →  (empty)
```
The `context_threshold` Guard-1 (`request-compaction-tool.ts:216-228`) is **byte-identical**
between `93ace21` and `c814979`. The guard text on `c814979`:
- `:160` "Context threshold: context usage must be >= 70%."
- `:222` `guard: "context_threshold"`
- `:228` `[request_compaction:below-threshold] session=… usage=…%`

## Prior reject byte (carries over — proven at 93ace21, guard unchanged)
```json
{"status":"rejected","guard":"context_threshold","contextUsage":55,"threshold":70,
 "reason":"Context usage (55%) is below the minimum threshold (70%). Compaction is not needed yet."}
```

## HONEST-LIMIT on live re-fire (substrate condition)
The canary seat was at **75% context (over-threshold)** at re-fire time on `c814979` — so the
*reject*-shape could not fire live on this session (request_compaction would ACCEPT at 75%>70%,
which is R-RC-2's shape, not R-RC-1's). The reject-shape's live capture is substrate-blocked
this cycle (over-threshold), exactly the documented HONEST-LIMIT case. **The carryover + the
byte-identical guard are the proof** that R-RC-1 holds on the deployed token-fixed head: the
guard is unaffected, and its reject-behavior was proven at `93ace21` where the canary was
under-threshold.

## Files
- `EVIDENCE.md` — this summary
- `guard_identity_diff.txt` — the empty-diff byte (guard unchanged 93ace21→c814979)
