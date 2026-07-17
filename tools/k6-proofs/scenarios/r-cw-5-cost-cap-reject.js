/**
 * Scenario scaffold: R-CW-5.
 *
 * Cost-cap rejection proof. This row temporarily lowers continuation
 * costCapTokens, proves continue_work is rejected at the cap boundary, then
 * restores the original config. It intentionally remains scaffold-only because
 * it mutates live gateway configuration.
 *
 * The safe executable fixture lives in
 * `tools/k6-proofs/scripts/run-cost-cap-fixture.mjs`. It runs the exact
 * candidate's production budget module plus the dispatcher boundary suite
 * from a source-only worktree and writes cleanup receipts. This k6 entry
 * remains intentionally non-runnable: k6 cannot safely create the required
 * isolated runtime state itself.
 */
export const options = {
  scenarios: {
    r_cw_5_cost_cap_reject_scaffold: {
      executor: 'shared-iterations',
      vus: 1,
      iterations: 1,
      maxDuration: '10s',
    },
  },
};

export default function () {
  throw new Error('R-CW-5 is fixture-gated; run tools/k6-proofs/scripts/run-cost-cap-fixture.mjs against an exact-candidate source worktree.');
}
