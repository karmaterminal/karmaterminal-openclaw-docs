# INVALID — PROOFS-corpus at SHA `0dff94d` declared invalid by figs

**Status**: INVALID beyond regression-illustration value (companion to `PROOFS/7522d6c60f.../INVALID.md`)
**Adjudicated by**: 🍖 figs, 2026-06-01 19:28 PDT (Discord msg `1511194678`)
**SHA**: `0dff94dbe4875a3b7ed44c60a9097a5f55083572` (pre-cure-binary; 🌫 silas-seat lothric served on this SHA across PROOFS-cycle window due to Raptor-Lake build incompatibility at uncurse-tip)

## Why invalid

Per 🍖 figs adjudication at byte:

> *"that proof session was valuable illustration; but is invalid beyond regression - there were mixed sha in fleet, and you were not able to connect to grafana stack for reasons frond-scribe is investigating. --- imo; dump it."*

Same two structural defects that invalidate the companion `PROOFS/7522d6c60f.../` corpus apply at byte to this `0dff94d` sha-directory:

### 1. Mixed-SHA fleet at fire-time

The 5-prince cohort was NOT on a single uniform SHA when PROOFS rows fired:
- 🩸 cael (DGX Spark), 🌊 ronan (DGX Spark undertow), 🕯 emeric (Intel NUC), 🌻 elliott (Lenovo Legion sunflower) — deployed at uncurse-tip `7522d6c60f11a37d2534db70e5c7c3be8a8f16e3`
- 🌫 silas (lothric Raptor-Lake i9-14900KS) — V8/Go-tsgo SIGILL deploy-failures across three retry attempts; remained on this pre-cure binary `0dff94d` for the entire PROOFS cycle window

This `0dff94d` sha-directory specifically contains:
- The full PROOFS corpus 🌫 silas accumulated WHILE ON pre-cure binary (R-CW-1..7, R-CD, R-OBS-1/2, R-RC-1, R-CONFIG-DEFAULTS, R-CONFIG-INTERSESSION, R-CW-DELEGATE-SELF-CONTINUATION) — silas-seat at-SHA receipts
- `2026-06-01-cohort-cycle-bridge-fires/` — 🌫 silas bridge-fire receipts (R-CW-1-silas-direct-fire + R-RC-1-silas-direct-fire) relocated by 🩸 cael's `62301aa` commit out of the uncurse-tip `7522d6c60f` corpus to honor substrate-monotypy at the path level

Both substrate-classes here are at-byte-at-pre-cure-binary `0dff94d`, NOT at uncurse-tip `7522d6c60f`. The cross-SHA-bridge-argument for using these to validate uncurse-tip substrate (via `git diff` empty on touched-files showing structural-equivalence) is what 🍖 figs adjudicated INVALID at byte. Bridge-by-construction-not-by-observation is not GATES-submission-grade evidence.

### 2. Grafana/Tempo trace collection broken cohort-wide

Per `PROOF-CORPUS-METHOD.md` (figs 2026-05-16 directive), Tempo trace JSON artifacts are part of the FULL proof-set for every R-CW / R-CD / R-RC row. At byte during this PROOFS cycle:
- `tempo.dandelion.cult:3100` direct ClusterIP path returned connection-refused from undertow-seat
- `tempo.dandelion.cult` HAProxy path was reachable from cael-seat + emeric-seat but flaky/empty from undertow-seat + sunflower-seat (DNS NXDOMAIN at sunflower)
- elliott-prince + silas-prince services were NOT in Tempo's known service-list at fire-time (sunflower-seat OTLP exporter not emitting at all; lothric not deployed at uncurse-tip SHA)
- 🩸 Cael fetched-and-committed traces for some rows from cael-prince; 🌊 ronan-prince traces also visible. Other rows leaned on journal-substrate as substitute

🌿 frond-scribe is investigating the grafana stack reachability + OTLP exporter issues separately (🍖 figs `1511193457`).

## Companion adjudication

This `PROOFS/0dff94d/INVALID.md` is complementary to `PROOFS/7522d6c60f/INVALID.md` (🌊 ronan commit `726a25d` on docs:main). Together both sha-directories of the mixed-fleet PROOFS-cycle are declared INVALID at byte per the same 🍖 figs adjudication-canon. The corpus is preserved on docs:main (not deleted) for historical record + decision-illustration value.

## What was valuable

This corpus is preserved on docs:main (not deleted) because it was **valuable as illustration**:

1. **Surfaced a regression**: PROOFS-cycle attempted to validate the post-cure-stack uncurse-tip continuation-tool substrate at a fleet-coordinated level. The validation cycle itself surfaced that continue_work + request_compaction tools are not registered at LLM-callable function-tool-surface on uncurse-tip seats (cohort substrate-of-record-truth has continued to refine the exact cure-target across multiple HONEST-self-correction-cascade iterations; canonical-issue is `karmaterminal/openclaw#868`).

2. **Validated the GATES gate-shape**: cohort failed GATES the way it's supposed to — regression surfaced BEFORE force-push to upstream PR #85651 presentation-branch, not after. 🍖 figs canon `1511189679` + `1511192829`: GATES dispatch HELD pending regression cure.

3. **Generated cohort-discipline classes**: mixed-SHA-corpus-invalid + cross-SHA-bridge-argument-not-GATES-submission-grade + grafana-stack-broken-cohort-wide-invalidates-trace-axis + SHA-diff-finding-surfaces-candidate-bytes-not-necessarily-structural-cure-direction + write-tool-overwrites-not-appends + multi-call-site-same-gap-but-different-runtime-routing-paths-means-cure-target-is-routing-flip-not-call-site-fix + cohort-substrate-of-record-flux-during-cure-cycle-can-require-multiple-substrate-direction-shifts-as-empirical-evidence-arrives + multi-prince-honest-self-correction-cascade-AND-cross-cohort-empirical-disambiguation-as-textbook-cohort-substrate-discipline + many others banked across cohort substrate-of-record at byte.

## What happens next

Per 🍖 figs 8-step regression-cure cycle (`1511188407`):
1. ✅ No force-push to PR #85651 presentation-branch (canon held)
2. ✅ GH issue filed: `karmaterminal/openclaw#868` (🩸 cael driver-baton)
3. ⏳ Test reproducing the regression (held per 🩸 cael holding-discipline `1511193958` pending empirical-disambiguation + 🩸 cael `1511194797` SHA-compare-at-byte surfacing routing-path-investigation as next-byte-action)
4. ⏳ Fix at cure-target call-site (TBD pending runtime trace of which call-site serves prince-main-session schema-inventory at uncurse-tip)
5. ⏳ Verify test fails without fix, passes with fix
6. ⏳ Proper assertions
7. ⏳ Build/tests/lint green
8. ⏳ Re-enter GATES with single-SHA fleet + grafana-stack-working

A NEW PROOFS-corpus will be assembled at the post-cure SHA when all 5 fleet princes deploy clean on the same SHA AND grafana/Tempo trace collection is working cohort-wide. This corpus is preserved as historical record + decision-illustration only.

## Cohort substrate-of-record

This INVALID.md added by 🕯 emeric (lamp) at NUC-seat per 🍖 figs's directive at `1511194678` + as complementary-coverage to 🌊 ronan's `726a25d` INVALID.md at `PROOFS/7522d6c60f.../`. Together both sha-directories of mixed-fleet PROOFS-cycle declared INVALID at byte. Other prince-seats may add additional INVALID-context as substrate at byte.

♥️🕯
