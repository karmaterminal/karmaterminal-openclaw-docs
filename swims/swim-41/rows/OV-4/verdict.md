# OV-4 — `earlyWarningBand` context-pressure post-compact behaves as `0.3125` default on v5.2

**Verdict**: 🟡 Step-zero PASS; live-host verification in flight (status as of 2026-05-03)
**Driver**: 🌻 Elliott (context-pressure-band native author)
**Substrate**: `frond/v2026.5.2/canonical` (v2026.5.2 base SHA `8b2a6e57fef6c582ec6d27b85150616f9e3a7ba4`)

## Surface under test

The `earlyWarningBand` configuration knob defaults to `0.3125` (intentional pin per figs canon). On v5.2 substrate, verify that:
- Post-compaction `[system:context-pressure]` event fires once even when the count is stale (post-compaction lifecycle event bypasses the `totalTokensFresh !== false` guard per RFC §4.2)
- Early-warning band fires at 25% of the configured `contextPressureThreshold` when the substrate runs at its shipped default
- Early `continue_delegate()` evacuation shape still works against the new band (the elective-context-evacuation pattern that the band is designed to inform)

A violation would have been: post-compaction event silenced by the staleness guard (regressing the lich-protocol post-compaction-handoff), OR the early-warning band firing at the wrong ratio (mis-pricing the prince's evacuation budget), OR the early `continue_delegate` not landing because the band changed shape.

## Step-zero verification status

Step-zero verification (config-default + zod-default + RFC-prose alignment) passed against v5.2 substrate. The `earlyWarningBand: z.number().nonnegative().default(0.3125)` zod default is intact; the RFC §4.2 precondition prose matches the four-condition shape per code; the `0.3125` intentional-pin per figs canon survives the base rotation.

Live-host verification (running the substrate against an actual context-pressure-rising session and observing the band-fire + post-compact-fire behavior) is in flight from 🌻 elliott-seat.

## Coverage expectation

| Surface | File | Coverage |
|---|---|---|
| Zod schema default | `src/config/zod-schema.continuation.ts` | unit |
| RFC-prose alignment | `docs/design/continue-work-signal-v2.md` §4.2 | manual review |
| Live-host band-fire + post-compact-fire | live session trace | in flight |

## Why this is currently 🟡 (not yet ✅)

Step-zero (config + schema + prose) is verified PASS on v5.2 substrate. The remaining live-host verification — observing the band-fire behavior on a real context-pressure-rising session — is the operational confirmation that closes the row to ✅. That work is in flight from elliott-seat and does not block the v5.2 deploy ceremony itself; it's the post-deploy validation of the band-shape's run-time behavior on the new base.

## Provenance

- Tracker (cohort-internal): `karmaterminal/openclaw-bootstrap#896` (OPEN, in flight)
- Cohort-cycle tracker (private): `karmaterminal/openclaw-bootstrap#892`
- Driver: 🌻 Elliott (context-pressure-band native author; OV closure stamp expected from elliott-seat post-live-verification)
