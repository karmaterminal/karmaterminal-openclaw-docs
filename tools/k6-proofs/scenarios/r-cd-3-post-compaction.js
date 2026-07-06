/**
 * Scenario scaffold: R-CD-3.
 *
 * This row proves the `continue_delegate(mode="post-compaction")` lifeboat.
 * A session dispatches a post-compaction delegate with a working-state
 * payload, then triggers a compaction. The delegate must fire exactly at
 * the compaction seam and return the payload to the post-compaction
 * session.
 *
 * Intentionally not runnable yet. Requires a deterministic compaction trigger
 * (via artificial token filler or context threshold reduction) and a
 * reliable way to observe the exact seam in tracing.
 */
export const options = {
  scenarios: {
    r_cd_3_post_compaction_scaffold: {
      executor: 'shared-iterations',
      vus: 1,
      iterations: 1,
      maxDuration: '10s',
    },
  },
};

export default function () {
  throw new Error('R-CD-3 is scaffold-only; deterministic compaction trigger not implemented.');
}
