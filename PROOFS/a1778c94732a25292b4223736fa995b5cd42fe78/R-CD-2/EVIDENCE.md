# R-CD-2 — exact-a177 evidence slot

- **Owner:** 🩸 Cael
- **State:** `missing`
- **Exact SHA:** `a1778c94732a25292b4223736fa995b5cd42fe78`

Required evidence:

- silent-wake delegate accepted and parent wake observed;
- no outbound delegate-return delivery;
- workflow run, artifact, and raw evidence;
- attributable exact Tempo JSON;
- same valid non-zero trace ID across delayed fire and dispatch, with distinct
  valid non-zero span IDs.

Do not fold a behavior-only PASS or a nearby unlabelled Tempo span.
