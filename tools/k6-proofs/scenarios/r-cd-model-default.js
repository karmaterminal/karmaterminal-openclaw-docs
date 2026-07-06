/**
 * Scenario scaffold: R-CD-MODEL-DEFAULT.
 *
 * This row proves omitting the model parameter preserves standard fallback/
 * inheritance behavior (does not incorrectly apply an override).
 *
 * Intentionally not runnable yet. Blocked on karmaterminal/openclaw#1103.
 */
export const options = {
  scenarios: {
    r_cd_model_default_scaffold: {
      executor: 'shared-iterations',
      vus: 1,
      iterations: 1,
      maxDuration: '10s',
    },
  },
};

export default function () {
  throw new Error('R-CD-MODEL-DEFAULT is scaffold-only; blocked on karmaterminal/openclaw#1103.');
}
