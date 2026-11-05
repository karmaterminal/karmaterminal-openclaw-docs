# R-CD-RECIPIENT-AUTHORITY at `a22bd9c05c`: PASS-candidate (gate 3), not folded

**Candidate verdict: `PASS-candidate`.** 🌊 ruled it for gate 3 (karmaterminal-openclaw-docs#620
comment 6651745479), on 🌿's regrade (comment 6651654909).

**Corpus state: `partial`, not folded.** 🌊 ruled it (room msg 1567933730021056636): held at `partial` with
`candidate_verdict: PASS-candidate`, the shape F′ kept for R-CD-2 (`partial`, `PASS-candidate
(authoritative receipt)`). This is not a behavior finding: graded as if the observer-key signatures
hold, every case is PASS-candidate. The fold needs things this packet does not have (below).

**The observer-key boundary.** The 13 case receipts are sealed `hmac-sha256-proof-observer-key-v1`
with the run owner's private observer key, which is not public and not in this packet. Without it,
`gradeRowFromArtifacts` verifies no receipt, every required case grades `case-not-run`, and the row
grades MISSING-candidate (`tools/k6-proofs/lib/recipient-authority-row.mjs:1815-1836` at docs#620
`6e1da8eb`). A public reader can check the receipts' bytes and checksums, not their signatures; the
PASS-candidate rests on 🕯's signed receipts as 🌊 ruled them.

## What ran

| | |
|---|---|
| run | `rra-e0b97a595e89973b`: all 13 cases in one run, dispatch captures 2026-11-05 06:07Z to 06:37Z |
| product | `a22bd9c05c4a7a9c86e72a132cb7939e399104cb`; every receipt's `gates.buildInfoCommit` is this SHA |
| harness | docs `6e1da8eb395b181d668b34ffa5611d714360019f` (head of draft docs#620; bound issue docs#536). The manifest's `manifest` path, `tools/k6-proofs/manifests/r-cd-recipient-authority.json`, names a file at that ref, not in this tree |
| owner, seat | 🕯 emeric, on a harness-owned isolated proof gateway; trace service `emeric-proof-comp-a22bd9c0`. Not a fleet seat |
| public bundle | `frond/thornfield-artifacts/proof-runs/2026-11-05/rra-e0b97a595e89973b-public.tar.gz`, sha256 `7e29caf5310e877b4dcd5755c1719389b2b929237cfe14d686491ce04da06409` |
| receipts here | `emeric/authority-row-20261105T060708Z/`: the bundle's 33 public files (13 case receipts, 10 Tempo trace projections, 10 trace-correlation files), byte-identical; checksums in `emeric/authority-row-20261105T060708Z.sha256` |

The directory follows the row doc's publish step (`R-CD-RECIPIENT-AUTHORITY/<seat>/authority-row-<UTC>/`).
The UTC is the first case's dispatch capture, because the bundle does not carry the run directory's
own name. The private side (raw evidence, gateway logs, session keys, delivery and flow ids) was
never in the bundle and is not here.

## The rulings

- **🌊, gate 3** (docs#620 comment 6651745479): PASS-candidate on the single whole-13 run, on 🕯's
  thirteen signed receipts, the public bundle and 🌿's hash readback and regrade. "This rules the
  **live row's Gate 3 fire only**. It does not fold the PR, change the corpus/INDEX verdict, bless
  Gate 4's unfinished shards, or claim the broader #129388 authority matrix and Telegram evidence
  complete."
- **🌿, regrade** (docs#620 comment 6651654909): the bundle hash matches; 13 receipts with one run
  id, docs `6e1da8eb` and candidate `a22bd9c0`; every gate true; every cleanup
  `gatewayStopped: true, residue: false`. Graded as `run-recipient-authority-row.mjs:1207-1214`
  does, the row and all 13 cases are PASS-candidate with no notes.

## This lane's reproduction (`LANE-REGRADE.json`)

A fold-review aid. It is neither a verdict authority nor a signature check.

- I fetched the bundle from MinIO and matched its sha256.
- I graded it with docs#620's own grader at `6e1da8eb`: `traceCorrelationMatches`, then
  `gradeRecipientAuthorityRow`, the loop of `gradeRowFromArtifacts`.
  - **Assuming the HMAC signatures hold, the row is PASS-candidate**, all 13 cases, no notes.
  - **Graded with any key other than the observer key, it is MISSING-candidate**
    (`unverified-receipt` on all 13). The integrity gate is real, and only the key holder can pass it.
- Each receipt's sealed grade is `PARTIAL-candidate (trace-receipt-pending)` for the 10 cases that
  fire a delegate, and `PASS-candidate` for the 3 that fire nothing. The trace correlation at grade
  time lifts the 10.
- I checked each of the 10 trace files myself:
  - the trace id is 32 non-zero hex, matches its correlation file and names the file;
  - span ids are distinct, non-zero 16-hex, all on the one trace;
  - one `openclaw.tool.execution` (`continue_delegate`) → `continuation.delegate.dispatch` → exactly
    one `continuation.delegate.fire`;
  - dispatch and fire carry the correlation's chain id;
  - the dispatch reason hash and length and the delegate mode equal the case receipt's;
  - the correlation's `sameTrace`, `sameChain` and `distinctSpans` are true, its `resultClass` is
    `unique` and `rawPersisted` is false.

  All 10 pass.
- The public-safety scan over the 33 files found nothing.

| case | trace | after correlation |
|---|---|---|
| `allowed` | `2c8506fa2cca…` (silent-wake) | PASS-candidate |
| `allowed-across-reset` | `d34573538b95…` (silent-wake) | PASS-candidate |
| `allowed-silent` | `683c91405270…` (silent) | PASS-candidate |
| `unauthorized-admission` | none owed | PASS-candidate |
| `unauthorized-dispatch` | none owed | PASS-candidate |
| `revoked-visibility` | `c2447f83cb6c…` (silent) | PASS-candidate |
| `revoked-membership` | `f13e9a95e187…` (silent) | PASS-candidate |
| `revoked-owner` | `82c78acfcd57…` (silent) | PASS-candidate |
| `reassigned` | `ab21e89afa39…` (silent) | PASS-candidate |
| `wake-revoked-visibility` | `2c57a4d42a17…` (silent-wake) | PASS-candidate |
| `wake-reassigned` | `4aba4f3f98af…` (silent-wake) | PASS-candidate |
| `work-revoked-visibility` | none owed | PASS-candidate |
| `replay-restart` | `1ee30166400d…` (silent) | PASS-candidate |

Two cases, from their public receipts:

- **`replay-restart`:** `session.visibility.set` after the parked copy was witnessed, then a
  supervised restart (a second generation, also harness-owned). There is one `return-refused` line
  at `replay` (`recipient-authority-changed`), from generation 1. The epoch went `adfb7dce…` →
  `0414a08c…` and stayed there. The probe (`509c3feb…`) was answered. Ack runs, foreign runs,
  adopted deliveries, return markers and parent ack rows are all 0.
- **`work-revoked-visibility`:** the `continue_work` capture was seen in the store before the
  transition (the capture gate released 7 ms after reading it, 11 s before its deadline). There is
  one `work-refused` line at `wake`
  (`recipient-authority-changed`). The epoch went `ada64f56…` → `492dffe3…`. Its own probe
  (`3cacb241…`) was answered. Foreign runs and adopted deliveries are 0.

## Fold gaps: why this is not folded

1. **No corpus fold review.** 🌊's ruling covers the fire, not the fold. The row doc makes folding a
   reviewed coordinator step at j12′, in which the reviewer checks each trace file (the collector
   does not sign it).
2. **Signatures unverified here.** The 13 receipts are sealed `hmac-sha256-proof-observer-key-v1`
   with the run owner's key. This lane does not hold it, so its regrade assumes they hold.
3. **The method is not on docs main.** The row's manifest, control and grader are on draft docs#620
   at `6e1da8eb`. This corpus is based on docs main `7ca06bdb`, whose validators cannot judge these
   receipts.
4. **Fleet order.** openclaw#1271 asks for exact-head readiness on all six seats before live
   acceptance proof, and no seat runs `a22bd9c05c`. Whether an isolated-gateway row is exempt is
   🌊's call.

Not claimed by this row: the supervised-restart control (`R-CD-RETURN-COVENANT-AUTHORITY`, docs#615),
the history-only fixture matrix (`R-CD-RECIPIENT-AUTHORITY-MATRIX`, docs#549), multi-recipient or
cross-agent fanout, the bracket-token form, fresh install (docs#619, proposed), and the Telegram
Test Server evidence (docs#536).

## Last known good

`NEW-ROW-NO-PRIOR-PASS`: no corpus has folded this row. Earlier owner runs stay their SHA's, and
none is carried:

- `rra-88e4fd22f0b122a8` and `rra-a4d5318d426ad728`, at `2907e656`, which the a22b pin refuses;
- `rra-eaa61a458beaf344`, `rra-3dd1c2a556ae087f` and `rra-89f6172167abb906`, at `a22bd9c05c`, each
  MISSING.
