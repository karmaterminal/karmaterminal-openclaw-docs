/**
 * Scenario scaffold: R-CW-6.
 *
 * maxChainLength boundary proof. This row sets maxChainLength=1, restarts the
 * gateway, proves hop-1 accepted and hop-2 rejected, then restores and restarts.
 * It intentionally remains scaffold-only because it mutates config and gateway
 * lifecycle.
 *
 * Required before runnable promotion:
 * - isolated/fixture gateway or explicit maintenance approval
 * - config backup/restore and restart receipts
 * - failure-safe restore even if the proof aborts mid-run
 */
export const options = {
  scenarios: {
    r_cw_6_max_chain_length_scaffold: {
      executor: 'shared-iterations',
      vus: 1,
      iterations: 1,
      maxDuration: '10s',
    },
  },
};

export default function () {
  throw new Error('R-CW-6 is scaffold-only; config/restart boundary fixture not implemented.');
}
