/**
 * Scenario scaffold: R-CD-MODEL-TOKEN.
 *
 * This row proves the `[[CONTINUE_DELEGATE: ... | model=<model>]]` token form
 * forwards an explicit model override to the delegate child.
 *
 * Intentionally not runnable yet. Blocked on karmaterminal/openclaw#1103.
 */
export const options = {
  scenarios: {
    r_cd_model_token_scaffold: {
      executor: 'shared-iterations',
      vus: 1,
      iterations: 1,
      maxDuration: '10s',
    },
  },
};

export default function () {
  throw new Error('R-CD-MODEL-TOKEN is scaffold-only; blocked on karmaterminal/openclaw#1103.');
}
