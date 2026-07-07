/**
 * Scenario scaffold: R-CW-5.
 *
 * Cost-cap rejection proof. This row temporarily lowers continuation
 * costCapTokens, proves continue_work is rejected at the cap boundary, then
 * restores the original config. It intentionally remains scaffold-only because
 * it mutates live gateway configuration.
 *
 * Required before runnable promotion:
 * - explicit OPENCLAW_ALLOW_CONFIG_MUTATION=true gate
 * - config backup/restore receipts
 * - failure-safe restore on k6 abort
 * - preferably an isolated test gateway fixture, not a live prince
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
  throw new Error('R-CW-5 is scaffold-only; config-mutating cost-cap fixture not implemented.');
}
