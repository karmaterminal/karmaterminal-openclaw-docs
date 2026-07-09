# Method — Project 81 5292 proof rerun transposed to 55663f1

## Scope

- **Safe assembly / corpus SHA:** `55663f1f2adb177df277ee4db95ea788731a26d7`
- **Live proof source SHA:** `5292af40d0ad5303b85a678f6e629503a8725848`
- **Seed corpus:** `5292af40d0ad5303b85a678f6e629503a8725848` (itself seeded from `46872994e4cae80830c381cb49456e8c77583d7e`)
- **Proof seats:** Cael and Ronan
- **Runtime under proof:** deployed OpenClaw `2026.6.11 (5292af4)` on both seats
- **Rollup:** `35 total / 34 pass / 0 partial / 1 honest_limit / 0 fail / 0 missing`

## Run shape

1. Deploy `5292af40d0ad5303b85a678f6e629503a8725848` to Cael and Ronan with source-only gateway deploys.
2. Seed `PROOFS/55663f1f2adb177df277ee4db95ea788731a26d7/` from the previous full-copy corpus so corpus-dependent rows have an addressable target.
3. Run gateway-live rows with disposable proof sessions and `docs_ref=scribe/20260708/proofs-5292-rerun`.
4. Split rows around partial/static blockers so one row cannot suppress unrelated artifact upload.
5. Preserve uploaded Actions artifacts under `artifacts/fresh-5292/actions/` and failed-row logs under `artifacts/fresh-5292/actions-logs/`.
6. Fold row state from reviewed row evidence, not workflow conclusion alone.
7. During proof generation and PR-presentation preparation, absorb current upstream/main drift into the safe assembly branch, validate the touched non-proof-row drift slices, and full-copy transpose the 5292 corpus to push SHA `55663f1f2adb177df277ee4db95ea788731a26d7`. The final 55663f1 drift batches were Android screenshot determinism, Codex app inventory diagnostic UTF-16 safety, Line/Matrix/Telegram inbound-log preview UTF-16 safety, auth-profile OAuth credential recovery, docs-only infographic table formatting, OpenAI Realtime Talk API key rejection clarity, UI sidebar drawer collapse, native app i18n inventory refresh, Slack Enterprise Grid channel behavior, and serialized tool-payload UTF-8 byte-limit handling.
8. Re-query Tempo after ingestion delay for R-CW-3, because trace absence in the immediate k6 window is not a permanent failure. Add the late Cael/Ronan trace JSON receipts and fold R-CW-3 by the reviewed trace bytes.

This corpus does not claim a second live gateway proof run at 55663f1. It preserves `proof_source_sha=5292af40d0ad5303b85a678f6e629503a8725848` and `proof_push_sha=55663f1f2adb177df277ee4db95ea788731a26d7` because the final drift corrections were freshness/ancestry take-backs that did not modify the continuation proof-row behavior under test.

## Classification rules used for this corpus

- A row with fresh 5292 k6 PASS-candidate evidence and no pending required receipt is folded as `pass`.
- A row whose generated summary contradicts console evidence is folded by the more specific console evidence, with the mismatch documented in row evidence.
- A config row whose k6 parser fails to read runtime config can be closed by a fresh path-scoped receipt that exposes only the required continuation subtree.
- A corpus-dependent/static row is carried from the seeded full-copy corpus instead of being treated as a live Gateway failure.
- A compaction row is not upgraded to PASS unless accepted compaction and post-compaction lifecycle bytes are observed. Threshold rejection remains `honest_limit`.
- `R-CW-3` requires fresh Tempo trace JSON for a clean PASS in this 5292 round. Immediate k6 trace absence is treated as pending ingestion/search, not a permanent error; late Tempo receipts close the row.

## Known harness friction

- Static/corpus rows still expect older deep manual-evidence trees when run as `all`; for this corpus they are carried explicitly instead.
- `R-CD-MODEL-TOOL` and `R-RC-2` both exposed postprocessor mismatches between console evidence and generated summaries.
- `R-CONFIG-DEFAULTS` / `R-CONFIG-INTERSESSION` exposed config read-path/reporting friction; fresh config receipts close the runtime byte.
