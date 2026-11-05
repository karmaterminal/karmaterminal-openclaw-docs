# Resolved identities: `a22bd9c05c4a7a9c86e72a132cb7939e399104cb`

| item | value |
|---|---|
| candidate / proof source / ship | `a22bd9c05c4a7a9c86e72a132cb7939e399104cb` (karmaterminal/openclaw `codeagent/j12prime-candidate`; the server ref resolved to this SHA when the packet was built) |
| tree | `53363f7964f31a47109cf0575aa23f31eefa0338` |
| composition | parent `2fe459ab92f1617ccc8b5394341a3cf5d5652892`, the merge of `2907e656a892c0efa93821670e9488c07be12c17` and the reviewed `ae11b29243cc5d50d097d0c9045f5380884b56fe` (incognito fanout refusal, memory-store maintenance separation). This commit changes only `config/test-lines-allocations/continuation-j12prime.txt`: 7181 → 7393, 🌊's approval (Discord 1567670360353149102) |
| ancestry | descends from `2907e656` (6 commits ahead, 0 behind; 11 files) |
| j12 baseline | `352f56029dc95c60149ab4aaa127226a861d0b3d` |
| Mode-B | [41927761314](https://github.com/karmaterminal/openclaw-bootstrap/actions/runs/41927761314): product `a22bd9c05c4a7a9c86e72a132cb7939e399104cb`, workflow `a768f04231bd0a6f94cc7b845aecaec28a4a4c9e`, concluded failure; 64 failing tests, identical to j12's ([41266680278](https://github.com/karmaterminal/openclaw-bootstrap/actions/runs/41266680278)) |
| live-row runtime | `R-CD-RECIPIENT-AUTHORITY` only: a harness-owned isolated proof gateway on emeric, every receipt's `buildInfoCommit` this SHA |
| docs base of this packet | `7ca06bdb9b30cfe604fcdda60c115e5400924f59` (docs `main`) |
| R-CD-RECIPIENT-AUTHORITY harness | docs `6e1da8eb395b181d668b34ffa5611d714360019f` (draft docs#620; not on `main`) |
| bootstrap method read at | `a768f04231bd0a6f94cc7b845aecaec28a4a4c9e` |
| `PROOFS/INDEX.json` | unchanged; it does not point here |
| presentation ref | not touched by this lane; `a22bd9c05c` is preserved for presentation |

## Gates

| gate | ruling | receipt |
|---|---|---|
| Gate 3 (`R-CD-RECIPIENT-AUTHORITY`) | PASS-candidate, the fire only (🌊, docs#620 comment 6651745479) | `gates/GATE-3-R-CD-RECIPIENT-AUTHORITY.md` |
| Gate 4 (Mode-B + the local cut shards) | PASS-candidate, the candidate-owned precondition (🌊, openclaw#1271 comment 6653747059) | `gates/GATE-4-MODE-B-AND-LOCAL-SHARDS.md`, `gates/gate-4-summary.json` |
| j12′ fold source review | PASS-candidate, source review only (🌊, openclaw#1271 comment 6655365352) | `gates/FOLD-SOURCE-REVIEW.md` |

## Fleet readiness: NOT complete

**No seat runs `a22bd9c05c`.** openclaw#1271 requires the presented SHA healthy on all six seats
before live acceptance proof.

| step | state | receipt |
|---|---|---|
| 1. emeric stage-only canary stage | receipt: the stage's `build-info` commit is this SHA; emeric's live install unchanged | openclaw#1271 comment 6654093951 |
| 2. emeric stopped-seat backup + off-live restore rehearsal | PASS (rehearsal and preservation). 🍃's gloss: the rehearsal restored its own image, not the sealed step-2 image | comments 6656791454, 6657597870 |
| 3. the emeric canary cut | **HELD**. karmaterminal/openclaw#1546 (`--no-opt` does not reach node children) records that 🕯 holds flagged migrating cuts until it lands. The readiness check, which itself ran nothing, says the cut needs both explicit GOs (🌊 and 🕯). The dispatch workorder also records that silas is blocked on #1546 and that the canary needs karmaterminal/openclaw-bootstrap#1775 (an open PR). #1546 names #1775 as context, but the GitHub sources cited here state neither outright | readiness check: comment 6656932943; #1546 |

## Public-safety scan

Every file this packet adds was scanned (rules in `METHOD.md`): **0 hits**. The 33 copied
`R-CD-RECIPIENT-AUTHORITY` receipt files were also scanned before they were copied: 0 hits.
