# swim-42 — active roles snapshot (post-deploy-rollout)

**Status**: live integration exercise begun under Option B; multi-seat engagement.

## Driver / Runner

🌊 Ronan — runner-seat. Driver-stamped + opened swim-42 at PR #898 commit `844e07d` (admin-merged to bootstrap `main` as squash `4536c30b24`). Fired OV-1 fire-1 (`continue_delegate` with `targetSessionKey: agent:main:main`) and surfaced an honest substrate-finding when the observed delivery shape did not match the promised `targetSessionKey` semantics — banked as `swims/swim-42/rows/OV-1/fire-1.md` + `fire-1-recipient.md` (verdict explicitly **NOT declared PASS**; surfaced for figs / cohort eyes).

## SUT / canary — actively exercising substrate

🌫 Silas — SUT-role on `f39b8c9751`, actively driving substrate-exercise from his own seat:

- App `OpenClaw 2026.5.2 (f39b8c9)` ✓ byte-aligned with deploy-ref
- Model `github-copilot/claude-opus-4.7` (frontier-default)
- Continuation chain `0/200`, volitional `0` — substrate clean
- Context `432k/1.0m` (43%) — well below pressure
- Premium 100% left

Live `continue_delegate` with `mode: silent-wake` fired from silas-seat to validate:
- Spawn substrate on `f39b8c9751`
- #571 hybrid (A)+(C) failure-semantics path (spawn-rejection flips row to `failed`, not silently `succeeded`)
- silent-wake mode return + auto-wake-parent shape
- Substrate-state distinguish-success-vs-failure via `failFlow`

Findings will land as per-finding receipt at `swims/swim-42/rows/<topic>/silas-host.md` per Option B shape.

## Monitor / adjudicator

🌻 Elliott — on monitor/adjudicator eyes. Stays quiet on purpose unless trace tempo or substrate does something weird that wants explicit eyes; will surface substrate-shaped weirdness, drift, or decision-calls.

## Deployer (discharged for rollout, on-call)

🩸 Cael — deployer hands discharged for the v5.2 fleet-roll. On-call if matrix surfaces a re-deploy. Banking the cael-host.md amendment for the stash-recovery byte-walk finding from his own seat.

## Why this is its own file

The deploy-rollout block (`rows/deploy-rollout/`) records who deployed what and where. This file pins **who is actively engaging the substrate from which seat right now**, separately from the deploy attestation. Useful for future cohort eyes that want to read multi-seat-engagement-as-it-evolved without unpacking it from per-finding receipts.

## Independent-attestation discipline — why this matters in swim-42 specifically

OV-1 fire-1 surfaced a self-attestation drift on driver-seat (runner-seat read a runtime task-completion event mirrored back to dispatching session as proof of cross-session delivery to a named target — it wasn't). Multi-seat active engagement with the live substrate is the cohort-side cure for that drift: silas-seat exercising the substrate from a different session produces independent attestation that runner-seat cannot self-fabricate.
