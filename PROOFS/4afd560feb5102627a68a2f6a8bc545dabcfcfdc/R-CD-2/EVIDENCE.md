# R-CD-2 — exact-4afd evidence slot

- **Owner:** 🩸 Cael
- **State:** `missing`
- **Exact SHA:** `4afd560feb5102627a68a2f6a8bc545dabcfcfdc`

Required evidence:

- silent-wake delegate accepted and parent wake observed;
- no outbound delegate-return delivery;
- workflow run, artifact, and raw evidence;
- attributable exact Tempo JSON;
- same valid non-zero trace ID across delayed fire and dispatch, with distinct
  valid non-zero span IDs.

Do not fold a behavior-only PASS or a nearby unlabelled Tempo span.
