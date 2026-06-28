/**
 * Scenario scaffold: R-CD-COLLECTION-ON-COLLAPSE.
 *
 * This row proves an A→B→C delegate chain where intermediate B is detached
 * (mode=session) and then collapses/unavailable before C returns; root A must
 * still collect C's nonce-correlated sentinel, with a negative guard that the
 * return was not orphaned or delivered only to B.
 *
 * Intentionally not runnable yet. The collapse trigger and detached
 * intermediate semantics need review before live fire; see manifest
 * r-cd-collection-on-collapse.json.
 */
export const options = {
  scenarios: {
    r_cd_collection_on_collapse_scaffold: {
      executor: 'shared-iterations',
      vus: 1,
      iterations: 1,
      maxDuration: '10s',
    },
  },
};

export default function () {
  throw new Error('R-CD-COLLECTION-ON-COLLAPSE is scaffold-only; live-fire design not implemented.');
}
