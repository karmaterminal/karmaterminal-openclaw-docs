# R-OBS-2 — Tempo trace tree export (rune-seat)

**Row:** R-OBS-2  
**Seat:** 🪨 Rune (`rune`, ROG Ally Z1 Extreme)  
**SHA tested:** `82827d3cbcba92ff6e19863b30615db028c2651c` (`OpenClaw 2026.6.9 (82827d3)`)  
**Captured:** 2026-06-23 00:13 PDT  
**Verdict:** ✅ PASS

## Behavior proven

Rune-seat can fetch continuation traces from Tempo, and live continuation fires from this proof window export `continuation.work` spans.

## Trace exports captured

Raw Tempo exports archived in this directory:

- `tempo-trace-aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa.json` — batches=4, span names include `continuation.work`
- `tempo-trace-bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb.json` — batches=1, span names include `continuation.work`
- `tempo-trace-cccccccccccccccccccccccccccccccc.json` — batches=1, span names include `continuation.work`
- `tempo-trace-dddddddddddddddddddddddddddddddd.json` — batches=1, span names include `continuation.work` (late direct-wake retry)

Fetch command shape:

```bash
curl -fsS 'http://tempo.dandelion.cult/api/traces/<trace_id>'
```

Span summary from rune-seat:

```text
=== aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa ===
batches=4
continuation.work
=== bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb ===
batches=1
continuation.work
=== cccccccccccccccccccccccccccccccc ===
batches=1
continuation.work
=== dddddddddddddddddddddddddddddddd ===
batches=1
continuation.work
```

## Journal excerpt

`live-continuation-journal-excerpt.log` captures the same proof window from the local gateway journal, including:

- token `CONTINUE_WORK:5` parse → work hedge → work wake
- tool `continue_work` origin → work hedge → work wake
- bracket `CONTINUE_DELEGATE` parse → `subagent-chain-hop` spawn
- depth-2 child PASS sentinel

## Verdict

✅ PASS: Tempo trace-tree export is reachable from rune-seat and contains continuation spans for live proof-window traces on `82827d3cbc`.
