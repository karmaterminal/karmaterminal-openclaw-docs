/**
 * Scenario scaffold: R-CW-6.
 *
 * `continue_work` is an internal session-elected primitive and is absent from
 * the gateway/MCP loopback tool set. A WebSocket tools.invoke scenario cannot
 * exercise this max-chain contract, and patching shared config would create an
 * unsafe, misleading receipt.
 *
 * The safe executable runtime fixture lives in
 * `tools/k6-proofs/scripts/run-max-chain-fixture.mjs`. It runs the exact
 * candidate's production budget helper, durable work scheduler, typed tool
 * capture path, persistence/recovery path, and delegate dispatch boundary in a
 * disposable worktree with cleanup and public-artifact-safety receipts. This
 * k6 entry remains intentionally non-runnable and fail-closed.
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
  throw new Error('R-CW-6 is fixture-gated; run tools/k6-proofs/scripts/run-max-chain-fixture.mjs against an exact-candidate source worktree.');
}
