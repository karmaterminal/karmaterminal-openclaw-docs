/**
 * Scenario scaffold: R-CD-RECIPIENT-AUTHORITY-MATRIX.
 *
 * The recipient-authority matrix is not k6-runnable through run-proof.sh, so this entry stays
 * non-runnable and fails closed. Its producer is
 * `tools/k6-proofs/scripts/launch-return-covenant-driver.mjs`: the trusted launcher builds an
 * isolated sandbox around the exact candidate's product-owned fixture driver and runs the
 * contract scenario `tools/k6-proofs/contracts/return-covenant-authority/scenario.js` inside it.
 * That scenario's header anchors every case's product path at j12
 * (karmaterminal/openclaw 352f56029dc95c60149ab4aaa127226a861d0b3d), where no case executes: the
 * product fixture driver was moved to fork-only (openclaw 2a8566340d). Bound issue:
 * karmaterminal/karmaterminal-openclaw-docs#536.
 */
export const options = {
  scenarios: {
    r_cd_recipient_authority_matrix_scaffold: {
      executor: 'shared-iterations',
      vus: 1,
      iterations: 1,
      maxDuration: '10s',
    },
  },
};

const REFUSAL =
  'R-CD-RECIPIENT-AUTHORITY-MATRIX is fixture-gated; run tools/k6-proofs/scripts/launch-return-covenant-driver.mjs against an exact candidate that carries the product fixture driver, after a live fire is authorized.';

// k6 logs an exception thrown by an iteration and still exits 0; one thrown from setup()
// aborts the run (exit 107), so the refusal lives there too.
export function setup() {
  throw new Error(REFUSAL);
}

export default function () {
  throw new Error(REFUSAL);
}
