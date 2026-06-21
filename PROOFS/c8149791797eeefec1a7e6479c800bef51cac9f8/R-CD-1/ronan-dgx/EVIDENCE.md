# R-CD-1 — ronan-dgx, SHIP-SHA `c8149791797eeefec1a7e6479c800bef51cac9f8`

**Owner:** 🌊 Ronan | **Seat:** ronan-dgx (DGX Spark ARM64, deployed at ship-SHA, gateway pid `1333838`) | **Verdict: ✅ PASS**

Re-fire at the token-fixed ship-SHA (figs's (B), drift-absorb-2 tip). `continue_delegate(mode="normal")` schedule→spawn→return.

## Byte-evidence
- **Fire trace:** `bce6499c90b55754b58213330ed66c57` — http://tempo.dandelion.cult/api/traces/bce6499c90b55754b58213330ed66c57 (`continuation.delegate.dispatch` + stitched child run). traceparent `00-bce6499c90b55754b58213330ed66c57-f4b47305861c54f1-01`.
- **Journal** (`journal_continuation.log`, pid `1333838`): `[continuation:delegate-spawned] hop=1/200 mode=normal task=[PROOF R-CD-1 / c8149791797…]` at 01:53:19.510 → literal return at 01:53:22.969 (~3.5s).
- **Return** (`delegate_return_payload.txt`): the literal proof string verified at SHIP-SHA `c8149791797…`.

**Verdict: ✅ PASS** — schedule→spawn→return clean on the deployed ship-SHA `c8149791797`.
