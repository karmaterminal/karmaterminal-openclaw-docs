# R-CW-TOOL — Tempo span-tree (scribe-pulled, rune-rog-ally → emeric-nuc)

**Seat fired:** emeric-nuc · **Pulled by:** 🪨 rune-rog-ally (on-net Tempo access)
**SHA:** `4bbd3aec096545992d6535f4ba96c3bd71414ed3` · **service.name:** `fifth-prince`
**Trace:** `417efa66d5e171d7c2f91c5b2f2f087b` — pulled `http://tempo.dandelion.cult/api/traces/417efa66d5e171d7c2f91c5b2f2f087b` → HTTP 200, 10 spans

## Behavior
`continue_work()` self-continuation tool-form on the deployed binary. delaySeconds 0 → clamped to 5s by continuation config (proves the clamp-floor wiring). Self-continuation woke emeric's own next turn ~5s post-dispatch. Echo token `R-CW-TOOL-emeric-4bbd3aec096-1781093560`.

## Span hierarchy (the proof tree)
```
openclaw.message.processed     kG3/m/7zg9Q=   (ROOT — dispatching turn)
├─ openclaw.harness.run        GHVhVaLi8gI=
│  └─ openclaw.run             8vJ2urnk0zs=
└─ continuation.work           oDdThrV0EQY=   ← the continue_work self-continuation span
```

**`continuation.work` count = 1** (single clean fire, no re-arm within the trace). The span is parented to the dispatching turn — the self-continuation scheduling; the ~5s wake-confirmation is the PASS (matches the system-event).

Distinction byte: this is `continuation.work` (singular, work-path) vs `continuation.delegate.dispatch` (delegate-paths in R-CD-TOOL/R-CD-TOKEN). The distinct span-names confirm the three continuation primitives are genuinely separate on the deployed binary. Raw trace JSON: `tempo_trace_417efa66.json` (10 spans).
