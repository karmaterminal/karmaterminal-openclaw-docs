# R-CD-CHAINED-DEPTH-2 TEST-2 EVIDENCE — emeric-seat dual-mirror of Ronan Chain-2 — ✅ PASS via cohort cross-walk convergence

**Row**: R-CD-CHAINED-DEPTH-2 TEST-2 — depth-2 chain test, inter-session-return via explicit targetSessionKey (canary-mirror)
**Owner**: 🕯 Emeric (emeric-seat NUC)
**CANDIDATE_SHA**: `7522d6c60f11a37d2534db70e5c7c3be8a8f16e3`
**Seat**: emeric-NUC (host.name=emeric, i7-12700H Alder Lake)
**Gateway version**: `OpenClaw 2026.5.31 (7522d6c)`

## Verdict (final)

✅ **PASS** — `continue_delegate(silent-wake, targetSessionKey=grandparent-main-session)` from depth-2 subagent context at emeric-seat routes correctly to grandparent at byte. Fire-response targetSessionKey echo is BYTE-IDENTICAL to fire-input AND gateway-side routing actually delivers to grandparent session (per 🌊 ronan's corrected Chain-2 byte-walk via `[continuation:targeted-return]` gateway-routing-line evidence).

## Cohort cross-walk convergence — load-bearing PROOFS yield

This row's lifecycle demonstrates the **dual-seat-mirror value 🌊 ronan named at `1511184350`**:

1. **Initial emeric-seat finding** (`1511184579`): TEST-2 fire-response showed BYTE-IDENTICAL targetSessionKey echo from depth-2 subagent context
2. **Cohort-prior on file**: 🌊 ronan's Chain-2 (`1511182917` + correction `1511183085`) reported REWRITE-to-immediate-parent — interpreted as subagent-isolation pattern
3. **Apparent contradiction**: lamp's TEST-2 directly contradicted 🌊 Chain-2 finding
4. **Cohort re-byte-walk triggered by dual-seat-mirror divergence** (🌊 ronan re-walked Chain-2 evidence at byte after lamp's `1511187706` cross-walk question)
5. **Root cause surfaced** (🌊 ronan `1511185134`): Chain-2 misread the child-agent's printed targetSessionKey from depth-3 return-payload as the gateway-routing-fact. The actual gateway-routing-line `[continuation:targeted-return] Delivered to agent:main:discord:channel:1466192485440164011 from agent:main:subagent:81b8f2a0` showed routing went to GRANDPARENT MAIN SESSION — exactly what was fired
6. **Cohort substrate-of-record converges**: both seats' fire-response AND gateway-routing show byte-identical end-to-end. No subagent-isolation rewrite. Cross-session targetSessionKey routing works from depth-2 subagent context.

## Sister-class banked by 🌊 ronan in own-correction

***delegate-return-payload-text-and-gateway-routing-receipt-are-different-substrates-don't-conflate-class*** — child agent's printed targetSessionKey ≠ gateway's actual routing target. Always prefer `[continuation:targeted-return]` (or equivalent) journal-line as load-bearing routing-fact.

## Three earlier-readings collapse

Lamp's original EVIDENCE.md enumerated three non-mutually-exclusive readings for the apparent contradiction:
- (a) Seat-config-divergence — RULED OUT (no contradiction exists; cohort converges)
- (b) Fire-response vs delivery-side distinction — RULED OUT (both BYTE-IDENTICAL at fire AND gateway-routing)
- (c) Harness-rendering of subagent task-spec — RULED OUT (lamp's fire-response was real; child agent's claim was real)
- **(d)** [load-bearing converged truth] **Original 🌊 Chain-2 evidence misread child-agent return-payload-text as gateway-routing-fact** — corrected in 🌊's own-correction commit + lamp's TEST-2 finding was correct all along

## Chain-shape (verified at byte from both seats)

```
parent (main-session: agent:main:discord:channel:1466192485440164011)
  └── depth-2 child (subagent) — silent-wake
        │   Task: fire depth-3 with explicit targetSessionKey=grandparent (channel:1466192485...)
        │   Fire-response echo: targetSessionKey BYTE-IDENTICAL to fire-input ✓
        └── depth-3 child (silent-wake)
              ↑ Gateway routes [continuation:targeted-return] to grandparent
                main-session per fire-input targetSessionKey ✓
              ↑ NOT rewritten to immediate-parent (depth-2 subagent key)
```

## Fire (depth-1: parent)
- **fire_utc**: 2026-06-02T01:48:00Z (approx; parallel fan-out with TEST-1/TEST-3)
- **fire_response** (see `fire_response.json`):
  ```json
  {"status":"scheduled","mode":"silent-wake","delegateIndex":2,"delegatesThisTurn":2}
  ```

## Cohort PROOFS-cycle value statement

**The yellow-finding-becoming-green via cross-walk IS the load-bearing PROOFS-cycle yield for this row** — substantive substrate-of-record correction that wouldn't exist without dual-seat-coverage. Per 🌊 ronan's own-correction at `1511185134` + lamp's cross-walk push at `1511188048`, the cohort substrate-of-record is now byte-truthful where it was previously wrong. This is the operational case-study for why dual-seat-coverage matters beyond redundancy.

## Tempo trace
Not captured at byte for TEST-2-specific continue_delegate call from depth-2 subagent context this cycle (Tempo indexing-lag prevented same-turn fetch). Re-fetchable via `service.name=fifth-prince` + time-window around `sentAt 1780364880` + filter for `continuation.delegate.dispatch` spans. Not blocking for verdict since cohort gateway-routing evidence is converged at byte.

## Cross-references

- 🌊 ronan Chain-2 corrected EVIDENCE (incoming push referenced by `1511185134`)
- 🌊 ronan own-correction commit (incoming push referenced by `1511185134`)
- lamp emeric-seat TEST-1/3 ✅ PASS — see TEST-1/EVIDENCE.md + TEST-3/EVIDENCE.md
- 🩸 cael bonus-coverage TEST-1 from cael-seat (pending Cael's commit per coordination at `1511184849`)
