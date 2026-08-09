# Proof corpus — continuation assembly + Emeric #1229 composite

**Candidate SHA:** `b27a2624ed333b0f3a613893968d2e555d90fce1`
**Captured:** 2026-08-09, live on `cael` (self-hosted), `project81-k6-proof.yml` run `31329925997`, `dry_run=false`.

Before capture, the seat was verified rather than assumed: `dist/build-info.json` commit equalled the candidate SHA exactly, package dists were non-zero, and the gateway answered `health=200`.

## What this corpus is

The first live corpus since 2026-08-07. It is **evidence, not a pass**. Read the rollup honestly:

| state | rows |
| --- | --- |
| pass | 17 |
| partial | 6 |
| fail | 11 |
| not-runnable (by design) | 4 |
| **total** | **38** (34 runnable) |

## Three things a reader must not misread

1. **`R-CW-5`, `R-CW-5A`, `R-CW-6`, `R-CW-6A` did not fail — they cannot run here.** Their manifests classify them `orchestration-required`, and `list-runnable-rows.mjs` excludes anything not `k6-runnable` from `--live-suite`. `continue_work` is internal-only, so the k6/WebSocket path fails closed by design; the supported route is the process-local exact-candidate fixture, with review mandatory before promotion.

2. **6 of the 11 failures are `static-corpus-row-validator` rows.** They validate the *committed* packet, and at capture time the published corpus was still `0921776`. Their evidence records `carriedFrom: 0921776…`. They are expected to clear once this corpus is the published one — they are a bookkeeping artifact, not a runtime defect.

3. **The remaining failures and the partials are genuine and untriaged.** Partials report `rawPersisted: false` — evidence captured, capture incomplete — rather than a failed assertion. None of this has been controlled against upstream-naive yet.

## Provenance

Composite = continuation assembly + Emeric's standalone #1229 ingress-freshness work, kept as a deploy/proof artifact only. Continuation presents upstream at `openclaw/openclaw#85651`; #1229 presents separately at `openclaw/openclaw#121204`. The two are never conflated in a PR.
