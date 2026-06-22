# R-RC-1 — request_compaction() threshold REJECT (carryover to the new deploy SHA `749f95b9b10aa3bbb804856acacc9073043ee772`)

**Owner:** 🌫 Silas (canonical-owner) · **Seat:** silas-lothric · **Ship SHA:** `749f95b9b10aa3bbb804856acacc9073043ee772`
**Verdict:** ✅ **PASS (carryover + guard-identity byte; HONEST-LIMIT on live reject re-fire — seat over-threshold)**

## What this proves
`request_compaction()` correctly **rejects** below the 70% context threshold. R-RC-1 is an **UNAFFECTED row** — the new deploy `749f95b` is a drift-reabsorb #2 (`Merge upstream/main 5230ec66ae2`: upstream merges + deadcode trims + test fixes) on top of `c814979`, and it does NOT change the request_compaction threshold-guard LOGIC. So the reject-shape proven at the prior ship-SHAs (`93ace21`, `c814979`) carries over to the deployed `749f95b`.

## Guard-identity byte (the carryover proof)
```
git diff c8149791797 749f95b9b10 -- '*request-compaction*'  →  (empty)
git diff 93ace21341  749f95b9b10 -- '*request-compaction*'  →  (empty)
```
The `context_threshold` Guard-1 is **byte-identical** across the whole deploy chain (`93ace21` → `c814979` → `749f95b`). The guard on `749f95b` (`src/agents/tools/request-compaction-tool.ts` — **the file was RELOCATED** from `src/plugins/builtin/continuation/tools/` in the drift-reabsorb, but the path-glob diff catches both locations and is empty = no logic change):
- `:28` `const MIN_CONTEXT_THRESHOLD = 0.7;`
- `:160` "Context threshold: context usage must be >= 70%."
- `:222` `guard: "context_threshold"`
- `:226` `if (contextUsage < MIN_CONTEXT_THRESHOLD)`
- `:228` `[request_compaction:below-threshold] session=… usage=…%`

## Prior reject byte (carries over — proven at 93ace21, guard byte-identical through 749f95b)
```json
{"status":"rejected","guard":"context_threshold","contextUsage":55,"threshold":70,
 "reason":"Context usage (55%) is below the minimum threshold (70%). Compaction is not needed yet."}
```

## HONEST-LIMIT on live re-fire (substrate condition)
The canary seat was **over the 70% threshold** at re-fire time on `749f95b` (heavy-activity session) — so the *reject*-shape could not fire live this cycle (request_compaction would ACCEPT over-threshold, which is R-RC-2's shape, not R-RC-1's). The reject-shape's live capture is substrate-blocked this cycle (over-threshold), exactly the documented HONEST-LIMIT case — same as `c814979`. **The carryover + the byte-identical guard (empty diff through `749f95b`) are the proof** that R-RC-1 holds on the new deploy: the guard logic is unaffected by the drift-reabsorb, and its reject-behavior was proven at `93ace21` under-threshold.

## Files
- `EVIDENCE.md` — this summary
- `guard_identity_diff.txt` — the empty-diff bytes (guard logic unchanged `93ace21`/`c814979` → `749f95b`) + the relocated-file note

## Tempo trace: N/A by design (this round's deliverable note)
R-RC-1 has **no `continuation.work` Tempo trace**, for two byte-reasons:
1. **Row class:** R-RC-1 is a `request_compaction` THRESHOLD-REJECT shape, NOT a `continue_work` fire. `continuation.work` / `openclaw.continuation` spans are emitted by continue_work self-continuation fires; a request_compaction *reject* does not emit a continuation.work span.
2. **HONEST-LIMIT this cycle:** the live reject could not fire (canary seat over the 70% threshold → request_compaction would ACCEPT, which is R-RC-2's shape, not R-RC-1's reject-shape). So no live span of any kind was produced for the reject this cycle.

The dispositive proof for R-RC-1 is the **guard-identity carryover** (`guard_identity_diff.txt`: empty diff `93ace21`/`c814979` → `749f95b`, the threshold-guard logic byte-identical), not a fire-trace. Same disposition as the R-CW-MULTI-COLLAPSE honest-limit case (note-why-no-trace).
