/**
 * Scenario scaffold: R-CW-5.
 *
 * Cost-cap rejection proof. `continue_work` is an internal session-elected
 * primitive, intentionally absent from the gateway/MCP loopback tool set. A
 * WebSocket `tools.invoke` therefore cannot exercise this contract.
 *
 * The safe executable fixture lives in
 * `tools/k6-proofs/scripts/run-cost-cap-fixture.mjs`. It runs the exact
 * candidate's production budget module plus the dispatcher boundary suite
 * from a source-only worktree and writes cleanup receipts. This k6 entry
 * remains intentionally non-runnable: using it to patch live configuration
 * would not invoke the internal tool and would create a misleading receipt.
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
