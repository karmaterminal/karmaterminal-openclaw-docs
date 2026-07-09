# Method — Project 81 live k6 proof fire transposed to 5292af40d0ad5303b85a678f6e629503a8725848

This corpus was gathered by directing Cael and Ronan to run the Project 81 k6 proof suite against their deployed `e08f6966` gateways. The harness drives standard row-shaped submit patterns over Gateway WebSocket/API (`web` in Grafana), while the user/channel session activity remains visible separately as Discord/session traffic.

This directory is a full copy transposed for push SHA `5292af40d0ad5303b85a678f6e629503a8725848`. The proof-source SHA remains `e08f696618da57e7267a2148578fa4ab0d8b0d01`. The two SHAs differ because upstream/main advanced during proof generation and the final safe assembly needed a post-proof merge-conflict resolution in `scripts/plugin-sdk-surface-report.mjs`; that conflict did not touch continuation runtime behavior. Consumers should read this `PROOFS/5292af40d0ad5303b85a678f6e629503a8725848/` tree directly rather than following links to the source corpus.

## Method upgrade

The important upgrade is traceability. Each row should identify its row/run/scenario in the emitted logs and artifacts. When it does, a Grafana spike or gateway log line can be mapped back to a specific proof row and artifact directory. When it does not, that absence is proof-method friction and should be filed as such.

## Run shape

1. Deploy exact candidate SHA to the proof seats via `deploy-gateway.yml`.
2. Run the Project 81 k6 proof suite from the seat against its local Gateway.
3. Continue past blockers so one partial row does not stop the entire corpus.
4. Preserve raw/redacted per-row artifacts, top-level reports, wrapper logs, and issue links.
5. Fold PASS/PARTIAL/HONEST_LIMIT only after row evidence is reviewed.
6. For the safe assembly push SHA, full-copy the reviewed corpus into `PROOFS/<push-sha>/` and preserve `proof_source_sha` / `proof_push_sha` metadata.

## Observability

- k6 harness traffic appears as `web` Gateway activity.
- Discord/channel turns remain separately visible as Discord/session traffic.
- Disposable web proof sessions should be closed after artifact capture once #374 lands.

## Known live-fire friction

- #366: unattended live `all` needs disposable-session env.
- #367: `R-CD-MODEL-TOOL` was partial in first fire, then upgraded by Cael's known-good Gemini model rerun.
- #368: `R-CONFIG-DEFAULTS` was upgraded by manual config receipts.
- #369: `R-CONFIG-INTERSESSION` was upgraded by manual config receipts.
- #370/#371: Cael `R-CW-1`/`R-CW-2` partials, covered by Ronan PASS evidence but retained for review.
- #372: `R-CW-3` wake/Tempo receipt was upgraded by Ronan schedule/wake + Tempo trace review.
- #373: `R-RC-2` generated-result vs live-evidence verdict mismatch.
- #374: disposable web-session cleanup after proof gather.
