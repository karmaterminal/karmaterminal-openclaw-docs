/**
 * Scenario scaffold: R-CD-MODEL-CHAINED-ALT.
 *
 * This row proves model overrides can be applied inside a chained delegate
 * dispatch (A -> B(override) -> C(override)).
 *
 * Intentionally not runnable yet. Blocked on karmaterminal/openclaw#1103.
 */
export const options = {
  scenarios: {
    r_cd_model_chained_alt_scaffold: {
      executor: 'shared-iterations',
      vus: 1,
      iterations: 1,
      maxDuration: '10s',
    },
  },
};

export default function () {
  throw new Error('R-CD-MODEL-CHAINED-ALT is scaffold-only; blocked on karmaterminal/openclaw#1103.');
}
