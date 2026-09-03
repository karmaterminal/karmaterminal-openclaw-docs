# Final continuation proof corpus — `5035aac3a96df18f0a5d5a5c3e91a516a32daf32`

Status: **BLOCKED** on the remaining non-PASS rows; the authorized R-CW family
refire is complete and ready for scribe review.

- canonical pure/corpus SHA: `5035aac3a96df18f0a5d5a5c3e91a516a32daf32`
- deployment runtime: `dbf5795bd5dd406f586575d883a7878288e591ad` (ancillary only)
- approved R-CW source harness:
  `f90999198987f7710924ab05512df01d2408c160`
- integrated combined-harness checkpoint:
  `af001b21dd17d7da788502d3ad1c2215c59d9922`
- before R-CW family refire: 18 PASS / 7 PARTIAL / 2 FAIL / 11 MISSING
- after R-CW family fold: 21 PASS / 7 PARTIAL / 1 FAIL / 9 MISSING
- `R-CW-5`: PASS
- `R-CW-6`: PASS
- `R-CD-TOKEN`: PARTIAL
- `R-CD-RETURN-COVENANT-AUTHORITY`: MISSING with terminal PARTIAL attempt; zero of 24 observations
- `R-CW-5A` / `R-CW-6A`: PASS

`R-CD-2` FAIL and `R-RC-2` PARTIAL were not modified or refired. Docs main
and protected presentation remain unchanged.

The new `R-CD-TOKEN` run
`20260903T073850Z-r-cd-token-248195ae` did not dispatch. The immutable harness
snapshot resolved the repository-relative ancillary contract path from
`tools/k6-proofs`, producing an ENOENT before attempt/session creation. The
consumed semantic PARTIAL `20260903T060815Z-r-cd-token-0fd4f089` remains
unchanged.

R-CW-6 run `run-20260903T083304Z-159f4b0e` passed every independent producer
surface under exact pure product `5035...`. The prior terminal FAIL attempt
remains preserved. Strict consumers `R-CW-5A`
`run-20260903T083714Z-26910927` and `R-CW-6A`
`run-20260903T083721Z-597334cc` both passed their exact reviewed-producer
contracts. Rollup is now 21 PASS / 7 PARTIAL / 1 FAIL / 9 MISSING.
