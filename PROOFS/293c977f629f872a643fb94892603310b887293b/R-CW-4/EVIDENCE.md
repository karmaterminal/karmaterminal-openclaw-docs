# R-CW-4 at `293c977f62`: **partial**

Chain depth hop counter: fires continue_work 3× in sequence, verifies hop increments from 1/200 → 3/200 in traced responses.

- Candidate verdict: PASS-candidate (trace pending)
- Review: reviewed: frond-scribe (single seat), 2026-10-29
- Summary: Behavior PASS (hops 1-3 woke, journal). Refire 030423Z trace: matched trace carries 3 continue_work tool spans (hops 2-3 wake under hop 1's trace); the collector's exactly-one-span topology rule refuses it. Classified harness topology rule for chain rows.
- owner: docs harness (#600 follow-up: chain-row topology)
- Canonical run (matrix-012658Z): `20261029T015426Z-r-cw-4-5e4ce138`
- Targeted trace refire (030423Z, 🌊 go 1565199441013645316): `20261029T032246Z-r-cw-4-844f2bba`

Runtime and candidate `293c977f629f872a643fb94892603310b887293b` on emeric's isolated gateway `:18797` (state `~/proof-gw/comp-293c977f`, own OpenAI sign-in), docs harness `dcc6330c40` (matrix) / `313a70c625` (refire). Nothing is transposed from the live composite.

## Refire 2 (050313Z, docs c65b9bb86a, 🌊 go 1565229430878642217)

- PASS with complete receipts in refire2 050313Z (docs c65b9bb86a, #608 declared chain scoping, chainDepth 3). Earlier trace-pending receipts preserved.
- Runs: `20261029T050418Z-r-cw-4-843e883b`
