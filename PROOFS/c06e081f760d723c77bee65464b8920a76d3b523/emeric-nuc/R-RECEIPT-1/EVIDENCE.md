# R-RECEIPT-1 — 🕯 emeric (emeric-nuc) — PROOF-receipt vs `c06e081f76`

**Seat:** emeric (emeric-nuc, Intel NUC i7-12700H, CachyOS)
**SHA:** `c06e081f760d723c77bee65464b8920a76d3b523` (`OpenClaw 2026.6.2`)
**Verdict:** ✅ PASS — deployed-clean on v4, continuation-store intact across the deploy-restart seam, #996 `:518` fix live in the running binary.
**Captured:** 2026-06-11 ~18:11 + 19:14 PDT (post v4 fan-restart at 18:32).

## What this row proves

The v4 fleet candidate (`c06e081f76`, carrying #990 3-state classifier + #996 `:518` succeeded-exclusion + drift-corrections) fanned to the emeric-nuc seat clean: gateway came up healthy on the fan-restart, the #996 fix is compiled into the running binary, and the continuation/flow_runs store survived the deploy-seam intact.

## Byte evidence (self-contained)

### Boot-clean
```
gateway: [shutdown] started: gateway stopping @ 2026-06-11T18:32:07 PDT (the v4 fan landing)
→ came up on c06e081f76 clean
fatal/uncaught/crash scan since boot: 0
```

### Deployed SHA byte-confirmed
```
repo HEAD: c06e081f760d723c77bee65464b8920a76d3b523
running binary: OpenClaw 2026.6.2 (c06e081)
```

### #996 `:518` fix LIVE
- source: `src/auto-reply/continuation/work-store.ts:534` → `if (decodeWorkState(flow)?.succeeded) {` (returns false from `hasLiveOrRecentlyDispatchedContinuationWork`)
- compiled dist: `dist/work-store-5haSToNg.js` → `decodeWorkState(flow)?.succeeded) return false`
- the `!decodeWorkState(flow)?.succeeded` exclusion — the verbatim-third of the `:221`/`:485` consume-guards (closes the delivered-marked-but-still-`running` row stranding the child session). Matches silas-lothric `:534` + ronan-dgx dist `:362`.

### Continuation-store survived the deploy-seam
```
sqlite ~/.openclaw/state/openclaw.sqlite (post-deploy):
  flow_runs total: 479 (intact across the deploy)
  [continuation:post-compaction] succeeded: 74 (source-gated, marker-prefix)
```

### #868 continuation-misconfig-warn = benign (not a wiring-gap)
```
journald [agents/openclaw-tools] "continuation.enabled=true but neither …Opts supplied" count since boot: 0
```
My seat fires the warn 0× — the control case: if it were a v4 main-runner wiring-gap, the same v4 binary would fire it on my main-runner too. It doesn't. The warn (where it fires on other seats, e.g. elliott 2×) is the benign inventory/catalog-build domain (`openclaw-tools.ts:633`, register-via-`buildInventoryContinuationToolOpts` stubs), confirmed by 🌫's namespace-provenance byte (`[agents/openclaw-tools]`). My main-runner continuation tools demonstrably work (see R-CW-DELEGATE-1: `request_compaction` real guard-reject + `continue_delegate` fired).

### Health
```
RSS: 0.64 GB (low/healthy)
0 FATAL since boot
```

## Verdict
✅ PASS. emeric-nuc deployed-clean on `c06e081f76`; #996 live in dist; continuation-store intact across the deploy-restart seam; #868-warn benign (0 on this seat); health stable.

## HONEST-LIMIT
This row proves deploy-clean + #996-live-in-binary + store-intact + #868-benign at the static/byte level. The *live dispatch-path firing* end-to-end is the separate R-CW-DELEGATE-1 row (a fresh `continue_delegate` → fresh `flow_runs` rows on the deployed binary). The *payload rehydrating into the next-turn context* (the 🍰-goal's deepest claim) remains witnessed-in-session, not a re-queryable record — figs's runtime-internals domain (per the cohort grade-ladder: dispatch+task-completion = record-grade; rehydrate-into-context = witnessed).
