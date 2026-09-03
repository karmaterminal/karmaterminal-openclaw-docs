# Final continuation proof corpus — `5035aac3a96df18f0a5d5a5c3e91a516a32daf32`

Status: **BLOCKED** after the one authorized explicit-owner replacement attempt
stopped before consumption at ancillary-contract path resolution.

- canonical pure/corpus SHA: `5035aac3a96df18f0a5d5a5c3e91a516a32daf32`
- deployment runtime: `dbf5795bd5dd406f586575d883a7878288e591ad` (ancillary only)
- approved explicit-owner harness:
  `52c0b46f86f2f98a6ff7f17b7a5f380609903484`
- before explicit-owner replacement: 18 PASS / 7 PARTIAL / 2 FAIL / 11 MISSING
- after explicit-owner replacement: 18 PASS / 7 PARTIAL / 2 FAIL / 11 MISSING
- `R-CW-5`: PASS
- `R-CW-6`: FAIL-fixture
- `R-CD-TOKEN`: PARTIAL
- `R-CD-RETURN-COVENANT-AUTHORITY`: MISSING with terminal PARTIAL attempt; zero of 24 observations
- `R-CW-5A` / `R-CW-6A`: MISSING

`R-CD-2` FAIL and `R-RC-2` PARTIAL were not modified or refired. Docs main and protected presentation remain unchanged.

The new `R-CD-TOKEN` run
`20260903T073850Z-r-cd-token-248195ae` did not dispatch. The immutable harness
snapshot resolved the repository-relative ancillary contract path from
`tools/k6-proofs`, producing an ENOENT before attempt/session creation. The
consumed semantic PARTIAL `20260903T060815Z-r-cd-token-0fd4f089` remains
unchanged. Rollup remains 18 PASS / 7 PARTIAL / 2 FAIL / 11 MISSING.
