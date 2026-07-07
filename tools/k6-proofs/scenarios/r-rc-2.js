/**
 * Scenario scaffold: R-RC-2.
 *
 * request_compaction accept-path proof. The proof requires a disposable session
 * at/above compaction threshold or an explicit low-threshold fixture, then
 * verifies request_compaction accepted and compaction rewrote context.
 *
 * It remains scaffold-only because the accept path intentionally mutates session
 * context and must not run against active main/work sessions.
 */
export const options = {
  scenarios: {
    r_rc_2_accept_scaffold: {
      executor: 'shared-iterations',
      vus: 1,
      iterations: 1,
      maxDuration: '10s',
    },
  },
};

export default function () {
  throw new Error('R-RC-2 is scaffold-only; compaction-accept fixture not implemented.');
}
