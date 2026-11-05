# Gate 3 at `a22bd9c05c`: the live row R-CD-RECIPIENT-AUTHORITY

**Ruling: PASS-candidate** (🌊, karmaterminal-openclaw-docs#620 comment 6651745479), for the single
whole-13 run `rra-e0b97a595e89973b`, docs `6e1da8eb395b181d668b34ffa5611d714360019f`, product
`a22bd9c05c4a7a9c86e72a132cb7939e399104cb`.

The ruling is scoped to the gate-3 fire. In 🌊's words: "This rules the **live row's Gate 3 fire
only**. It does not fold the PR, change the corpus/INDEX verdict, bless Gate 4's unfinished shards,
or claim the broader #129388 authority matrix and Telegram evidence complete." So the row is not
folded in this packet: it is held at `partial` with `candidate_verdict: PASS-candidate` (🌊,
room msg 1567933730021056636); see
`../R-CD-RECIPIENT-AUTHORITY/EVIDENCE.md`.

| | |
|---|---|
| run | `rra-e0b97a595e89973b`, 13 cases, one run id, 2026-11-05 06:07Z to 06:37Z (dispatch captures) |
| owner and seat | 🕯 emeric, on a harness-owned isolated proof gateway (trace service `emeric-proof-comp-a22bd9c0`) |
| harness | docs `6e1da8eb395b181d668b34ffa5611d714360019f`: the head of draft docs#620, **not on docs main** |
| public bundle | `frond/thornfield-artifacts/proof-runs/2026-11-05/rra-e0b97a595e89973b-public.tar.gz`, sha256 `7e29caf5310e877b4dcd5755c1719389b2b929237cfe14d686491ce04da06409` (matched by 🌿 and again by this lane) |
| regrade | 🌿, docs#620 comment 6651654909: row `PASS-candidate`, all 13 cases `PASS-candidate`, no notes, graded as `run-recipient-authority-row.mjs:1207-1214` does |
| receipts here | `../R-CD-RECIPIENT-AUTHORITY/emeric/authority-row-20261105T060708Z/` (the bundle's 33 public files, byte-identical) |

What the regrade and the ruling rest on:

- Every case's gates are true: `candidatePinned`, `stateIsolated`, `modelSignIn`,
  `crossSessionTargetingEnabled`, `gatewayStartedByHarness`.
- Every `buildInfoCommit` is `a22bd9c05c4a7a9c86e72a132cb7939e399104cb`.
- Every cleanup reads `gatewayStopped: true, residue: false`.
- The 10 delegate and wake cases correlate with their Tempo traces.
- `work-revoked-visibility` passes on its own probe (`3cacb241…`); the other probing cases name
  `509c3feb…`.
- `replay-restart`: the probe was answered; one `return-refused` at `replay` with
  `recipient-authority-changed`; the epoch advanced `adfb7dce…` → `0414a08c…`; 0 foreign runs, 0
  adopted deliveries, 0 ack runs.
- The earlier `rra-89f6172167abb906` stays MISSING and contributes nothing.
