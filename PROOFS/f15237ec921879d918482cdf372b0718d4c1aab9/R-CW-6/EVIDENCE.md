# R-CW-6: partial at `f15237ec92`

The max-chain boundary uses a disposable exact-candidate runtime fixture; continue_work is intentionally not externally invocable through the gateway loopback.

- **Verdict:** fixture `PASS-candidate`, exit 0; every check true (reviewed by frond-scribe).
- **Identity:** candidate `f15237ec921879d918482cdf372b0718d4c1aab9` (clean detached checkout, clean afterwards); docs/harness `215235ed73a6926a0610d91814b02f25a4836ed1`; a fresh frozen-lockfile disposable install from the candidate's pin, removed afterwards.
- **Run:** ronan, `fixtures-f15237ec-20261030T013026Z`, the same command and surfaces as at F (see `tools/k6-proofs/docs/` for the row's method).
- **Receipts:** `fixture-ronan/` (the fixture's declared files plus the runner's JSON stdout). frond-scribe scanned them: no private paths and no credential-shaped strings.

The F (`08c37a1562`) fire was PASS too; it is a historical diagnostic and is not carried.

## Correction (2026-10-31, frond-scribe; 🌊 03:08Z)

The earlier fold recorded **pass**. **That over-credited the row.** The fixture's `PASS-candidate` at exact `f15237ec92` is genuine, and its receipts (`fixture-ronan/`, run `fixtures-f15237ec-20261030T013026Z`, docs `215235ed`) are kept unchanged. But this is a **process-local max-chain fixture**, not an external gateway invocation, and the row's own manifest (`tools/k6-proofs/manifests/r-cw-6.json`, `telemetryContract.verdictAuthority.pass` and `.partial`) caps that artifact class at **PARTIAL-candidate**. The fold recorded row PASS with no superseding authority receipt.

**State.** The row is now **partial**. It is a scope and authority correction, not a behavioural failure: the fixture's checks all held.

**For F″.** A passing exact-candidate preflight (R-CW-6A, docs#616) does not lift this cap. Only a superseding authority receipt (a live producer of a different artifact class), adopted by an explicit method change, could.

🌊's ruling: Discord msg 1565925290008387728 and his docs#616 review (2026-10-31): F′ over-credited R-CW-5/6; keep the fixture receipts and correct the row-level over-credit in a separate, explicit historical correction.
