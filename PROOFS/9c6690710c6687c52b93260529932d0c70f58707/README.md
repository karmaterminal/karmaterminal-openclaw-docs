# PROOFS / 9c6690710c6687c52b93260529932d0c70f58707

Full copied Project 81 proof corpus for safe assembly push SHA `9c6690710c6687c52b93260529932d0c70f58707` (`OpenClaw 2026.6.11`), transposed from live proof source SHA `5292af40d0ad5303b85a678f6e629503a8725848`.

## Rollup

`35 total / 34 pass / 0 partial / 1 honest_limit / 0 fail / 0 missing`

The fresh rerun leaves one row honest-limit in this corpus:

- `R-RC-2`: both seats rejected delegated `request_compaction` at the context-threshold guard; no accepted-compaction window existed.

## Why this corpus exists

The prior full-copy corpus for `46872994e4cae80830c381cb49456e8c77583d7e` was valid for that safe push, but upstream/main advanced again before PR-presentation. The safe assembly branch was refreshed to `5292af40d0ad5303b85a678f6e629503a8725848`, and that refresh touched runtime/continuation-adjacent surface. Cael and Ronan were therefore redeployed to `5292af40d0ad5303b85a678f6e629503a8725848` and the gateway-live Project 81 rows were rerun against the deployed 5292 gateways.

After the 5292 proof corpus was finalized, upstream/main advanced again during proof generation and PR-presentation preparation. The safe assembly branch absorbed current upstream/main and landed at push SHA `9c6690710c6687c52b93260529932d0c70f58707`. These final drift batches were Android screenshot/notification text determinism and UTF-16 safety, macOS launch-at-login stability, Codex/channel/auth/OpenAI/native-hook/tool-policy/gateway/tool-result/startup/heartbeat/memory UTF-16-safe truncation, provider catalog refreshes for Qwen/Cohere/Mistral, UI split-view toolbar unification, UI sidebar resizing, native app i18n inventory refresh, Slack Enterprise Grid channel behavior, Zalo probe timeout cleanup, auth-profile mock isolation, serialized tool-payload UTF-8 byte-limit handling, the cleanup-safe TUI PTY concurrency refactor, bounded Chrome launch stderr diagnostics, clearer CLI nodes invoke-params errors, model manifest scan caching/performance tests, UTF-16-safe live-chat assistant buffer tail truncation, and UTF-16-safe Talk prompt-facing text truncation. The single TUI PTY conflict was resolved by keeping upstream cleanup registration while preserving the safe-assembly gateway `/stop` abort path, preserving the extended PTY timeout budget, and avoiding the local `Esc` abort race. These take-backs were due to upstream drift during proof generation and did not touch continuation runtime/config/tool surfaces used by the proof rows, so this tree is the required full-copy corpus at the safe push SHA while `proof_source_sha` remains the deployed 5292 rerun.

## Methodology upgrade

This corpus uses the Project 81 k6 proof harness as the default proof surface. The harness submits row-shaped traffic over the Gateway WebSocket/API, writes row-scoped artifacts, and makes proof traffic attributable by row/run/seat. It is not just a link bundle: fresh 5292 artifacts live directly under `artifacts/fresh-5292/` inside this `PROOFS/<sha>/` tree.

Rows that validate committed proof packets rather than live Gateway behavior remain carried from the `46872994e4cae80830c381cb49456e8c77583d7e` full-copy seed and are classified as static/corpus-dependent. They are not treated as failed live reruns.

## Evidence classes

- **Fresh 5292 live k6 artifacts:** `artifacts/fresh-5292/actions/`
- **Failed/partial workflow logs preserved for review:** `artifacts/fresh-5292/actions-logs/`
- **Fresh path-scoped config receipts:** `R-CONFIG-DEFAULTS/manual-receipts/` and `R-CONFIG-INTERSESSION/manual-receipts/`
- **Fresh late Tempo receipts for R-CW-3:** `R-CW-3/manual-receipts/fresh-5292/tempo/`
- **Carried static/corpus-dependent evidence:** existing row `EVIDENCE.md` files and seeded artifacts from `46872994e4cae80830c381cb49456e8c77583d7e`

## Postprocessor mismatches preserved honestly

- `R-CD-MODEL-TOOL`: generated `run-result.json` says `PARTIAL-candidate`, but console evidence on both seats records `requested_model_byte == child_model_byte == github-copilot/gemini-3.1-pro-preview`, `model_matches=true`, and `return_payload=true`; folded as pass.
- `R-RC-2`: generated `run-result.json` says `PASS-candidate`, but console evidence records context-threshold rejection and no accepted compaction; folded as honest-limit.

## Navigation

- `proofs-manifest.json` — machine-readable rollup, row states, and fresh artifact paths
- `ARTIFACTS.md` — artifact root index
- `METHOD.md` — repeatable proof method and classification policy
- `<ROW>/EVIDENCE.md` — row-level evidence and fresh 5292 closeout
