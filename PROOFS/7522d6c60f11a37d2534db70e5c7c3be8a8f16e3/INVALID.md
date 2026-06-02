# INVALID — PROOFS-corpus for `7522d6c60f` declared invalid by figs

**Status**: INVALID beyond regression-illustration value
**Adjudicated by**: 🍖 figs, 2026-06-01 19:28 PDT (Discord msg `1511194678`)
**SHA**: `7522d6c60f11a37d2534db70e5c7c3be8a8f16e3` (uncurse-tip post-Track-A+B+C cure-stack merge)

## Why invalid

Per figs adjudication at byte:

> *"that proof session was valuable illustration; but is invalid beyond regression - there were mixed sha in fleet, and you were not able to connect to grafana stack for reasons frond-scribe is investigating. --- imo; dump it."*

Two structural defects make this PROOFS-corpus invalid as GATES-submission-grade evidence:

### 1. Mixed-SHA fleet at fire-time

The 5-prince cohort was NOT on a single uniform SHA when PROOFS rows fired:
- 🩸 cael (DGX Spark), 🌊 ronan (DGX Spark undertow), 🕯 emeric (Intel NUC), 🌻 elliott (Lenovo Legion sunflower) — deployed at `7522d6c60f`
- 🌫 silas (lothric Raptor-Lake i9-14900KS) — V8/Go-tsgo SIGILL deploy-failures across three retry attempts; remained on **pre-cure binary `0dff94dbe4875a3b7ed44c60a9097a5f55083572`** for the entire PROOFS cycle

Silas's continuation-tool fire-receipts (R-CW-1 direct fire + R-RC-1 REJECT path) were therefore evidence of pre-cure binary behavior, not at-SHA `7522d6c60f` behavior. The cohort attempted to bridge via "substrate-byte-identity" argument (cure-stack didn't modify source-file paths → pre-cure binary fires validate post-cure source by structural equivalence). That bridge was relocated to `PROOFS/0dff94dbe4875a3b7ed44c60a9097a5f55083572/2026-06-01-cohort-cycle-bridge-fires/` at commit `62301aa` for substrate-monotypy at the path level, but the dependency on cross-SHA fires for R-CW-1 / R-RC-1 / R-RC-2 verdicts means those rows were never single-SHA-validated at `7522d6c60f` directly.

### 2. Grafana/Tempo trace collection broken cohort-wide

Per `PROOF-CORPUS-METHOD.md` (figs 2026-05-16 directive), Tempo trace JSON artifacts are part of the FULL proof-set for every R-CW / R-CD / R-RC row. At byte during this PROOFS cycle:
- `tempo.dandelion.cult:3100` direct ClusterIP path returned connection-refused from undertow-seat
- `tempo.dandelion.cult` HAProxy path was reachable from cael-seat + emeric-seat but flaky/empty from undertow-seat + sunflower-seat (DNS NXDOMAIN at sunflower)
- elliott-prince + silas-prince services were NOT in Tempo's known service-list at fire-time (sunflower-seat OTLP exporter not emitting at all; lothric not deployed at SHA)
- Cael fetched-and-committed traces for R-CW-1 + R-CW-2 from cael-prince; ronan-prince traces also visible. Other rows leaned on journal-substrate as substitute

🌿 frond-scribe is investigating the grafana stack reachability + OTLP exporter issues separately (figs `1511193457`).

## What was valuable

This corpus is preserved on docs:main (not deleted) because it was **valuable as illustration**:

1. **Surfaced the actual cure-target**: the tool-registration regression in `src/gateway/tool-resolution.ts:148` schema-inventory-path that strips `liveSessionToolConfig: true` (regression-introducing commit: upstream PR #85341 `bb46b79d3c`). Documented in `FINDINGS/agent-runner-continuation-tool-regression.md` + GH issue `karmaterminal/openclaw#868`.

2. **Validated the GATES gate-shape**: cohort failed GATES the way it's supposed to — regression surfaced BEFORE force-push to upstream PR #85651 presentation-branch, not after. figs canon `1511189679` + `1511192829`: GATES dispatch HELD pending regression cure.

3. **Generated cohort-discipline classes**: mixed-SHA-corpus-invalid + delegate-return-payload-vs-gateway-routing-receipt-don't-conflate + SHA-diff-finding-surfaces-candidate-bytes-not-necessarily-structural-cure-direction + write-tool-overwrites-not-appends + many others banked across cohort substrate-of-record.

## What happens next

Per figs 8-step regression-cure cycle (`1511188407`):
1. ✅ No force-push to PR #85651 presentation-branch (canon held)
2. ✅ GH issue filed: `karmaterminal/openclaw#868` (cael, schema-inventory-layer cure-target)
3. ⏳ Test reproducing the regression
4. ⏳ Fix at `src/gateway/tool-resolution.ts:148` (restore `liveSessionToolConfig: true` OR equivalent post-#85341-refactor wiring)
5. ⏳ Verify test fails without fix, passes with fix
6. ⏳ Proper assertions
7. ⏳ Build/tests/lint green
8. ⏳ Re-enter GATES with single-SHA fleet + grafana-stack-working

A NEW PROOFS-corpus will be assembled at the post-cure SHA when all 5 fleet princes deploy clean on the same SHA AND grafana/Tempo trace collection is working cohort-wide. This corpus is preserved as historical record + decision-illustration only.

## Cohort substrate-of-record

This INVALID.md added by 🌊 ronan at undertow-seat per figs's directive at `1511194678`. Other prince-seats may add additional INVALID-context as substrate at byte.

♥️🌊
