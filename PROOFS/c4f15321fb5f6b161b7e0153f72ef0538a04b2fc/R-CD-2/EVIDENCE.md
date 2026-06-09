# R-CD-2 silent-wake — on-SHA c4f15321 (runtime byte-identical to 7dcc9d578c, src f6ebf9b5)
**Owner:** 🌊 ronan | **Verdict:** ✅ PASS
## Claim
continue_delegate(silent-wake) full path — wakeOnReturn=true silentAnnounce=true — fires + returns + wakes the dispatching session, on the ship-SHA runtime.
## On-SHA proof
- Dispatched continue_delegate(mode=silent-wake); shard returned marker "PROOF-MARKER-RONAN-RCD2-c4f15321 silent-wake on-SHA at 2026-06-08 20:16 PDT" → the verdict-turn was woken BY the silent return (the defining silent-wake behavior).
- Tempo trace 4eda0e13af7164f25e5c2d55eb1f6234 (tempo-trace-*.json) — continuation.delegate span, host=ronan, on-SHA.
- silent-wake journal byte (silent-wake-journal.txt).
- Runtime byte-identical to proofed 7dcc9d578c (src tree f6ebf9b5) → valid for c4f15321.
