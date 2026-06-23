# k6 PROOFS harness foundation

Issue: [#100](https://github.com/karmaterminal/karmaterminal-openclaw-docs/issues/100)  
Coordination epic: [#106](https://github.com/karmaterminal/karmaterminal-openclaw-docs/issues/106)

This directory is the docs-side home for candidate k6 proof harness output. It is intentionally a harness and artifact layout, not an automatic proof verdict engine.

The harness may fire deterministic rows and collect receipts, but generated `EVIDENCE.md` files are **draft/candidate output** until a human reviewer folds them into `PROOFS/<sha>/` and the corpus manifest.

## Source notes

Primary design note:

- `karmaterminal/openclaw-bootstrap:.specify/notes/k6-for-proofs-deterministic-elements.md`

Compatibility target:

- `karmaterminal/openclaw-bootstrap:RUNBOOKS/PROOF-CORPUS-METHOD.md`
- Existing docs corpus shape under `PROOFS/<sha>/<row>/<seat>/`

## What belongs here

```text
tools/k6-proofs/
├── README.md
├── row-manifest.schema.json
├── manifests/
│   └── preflight.example.json
├── scenarios/
│   └── preflight.js
├── scripts/
│   └── postprocess-k6-summary.mjs
└── examples/
    └── k6-summary.preflight.example.json
```

Future row PRs can add focused scenario files for issue-owned lanes, for example:

- `scenarios/continue-work.js` for `R-CW-1` / `R-CW-TOKEN`
- `scenarios/continue-delegate.js` for `R-CD-1` / `R-CD-TOKEN`
- serialized opt-in scenarios for compaction/config/observer rows

## Required environment

Do not commit secrets. Operator credentials and session keys come from environment or local untracked wrapper scripts.

Common variables:

- `OPENCLAW_GATEWAY_WS` — Gateway WebSocket URL, usually `ws://127.0.0.1:18789`.
- `OPENCLAW_GATEWAY_TOKEN` — operator token/password for the selected gateway. Required unless running offline dry mode.
- `OPENCLAW_SESSION_KEY` — target session key for the row. Defaults to `main` only as a local convenience; real proof runs should pin the exact session.
- `K6_PROOF_MANIFEST` — row manifest path. Defaults to `tools/k6-proofs/manifests/preflight.example.json`.
- `K6_PROOF_RUN_ID` — optional stable run id. Defaults to `k6-run-<UTC timestamp>`.
- `K6_PROOFS_OFFLINE=1` — no-mutating offline dry preflight. This validates manifest/env shape without connecting to the gateway.

## No-mutating dry preflight

The first accepted harness behavior is a dry preflight stub. It must not write proof verdicts or call mutating tools.

```bash
k6 run \
  -e K6_PROOFS_OFFLINE=1 \
  -e K6_PROOF_MANIFEST=tools/k6-proofs/manifests/preflight.example.json \
  --summary-export /tmp/k6-preflight-summary.json \
  tools/k6-proofs/scenarios/preflight.js
```

The offline mode checks the manifest, emits k6 checks, and exits without gateway traffic.

For a live read-only preflight, set `OPENCLAW_GATEWAY_WS`, `OPENCLAW_GATEWAY_TOKEN`, and `OPENCLAW_SESSION_KEY`; keep the manifest row `mutates=false`.

## Candidate artifact layout

Post-processing writes candidate output under the proof corpus shape, but under an explicit `k6-run-<timestamp>/` directory so review/fold can be done later:

```text
PROOFS/<sha>/<row>/<seat>/
└── k6-run-<timestamp>/
    ├── EVIDENCE.md                  # generated draft, not final verdict
    ├── row-manifest.json            # exact row manifest used
    ├── k6-summary.json              # raw k6 summary/export
    ├── row-result.json              # normalized candidate result
    └── artifacts/                   # optional copied receipts later
        ├── gateway-events.ndjson
        ├── tool-invoke-response.json
        ├── task-ledger.json
        ├── logs-tail.txt
        └── wake_event_trace.json
```

The `EVIDENCE.md` draft always labels itself `CANDIDATE` and includes the review warning. A human fold may copy or rewrite its contents into the row's canonical `EVIDENCE.md` only after checking the raw receipts.

## Post-process a k6 summary

```bash
node tools/k6-proofs/scripts/postprocess-k6-summary.mjs \
  --manifest tools/k6-proofs/manifests/preflight.example.json \
  --summary /tmp/k6-preflight-summary.json \
  --out-root PROOFS
```

The output directory is derived from the manifest:

```text
PROOFS/<sha>/<row>/<seat>/<runId>/
```

Use `--run-id k6-run-YYYYMMDDTHHMMSSZ` to override the generated run id.

## Row manifest fields

See [`row-manifest.schema.json`](./row-manifest.schema.json). The core fields are:

- `schema` — currently `openclaw.k6.proof-row-manifest.v1`.
- `rowId` — proof row id or sub-row id, e.g. `R-CW-1`, `R-CD-TOKEN`, `preflight`.
- `candidateSha` — full 40-char deployed/candidate SHA.
- `seat` — canonical seat name, e.g. `emeric-nuc`, `ronan-dgx`.
- `sessionKey` — exact target session key or an environment placeholder.
- `transport` — `websocket`, `http-tools-invoke`, or `offline`.
- `toolSurface` — `typed-tool`, `token`, `bracket-token`, `read-only`, or `mixed`.
- `mutates` — boolean. Preflight must be `false`.
- `expectedReceipts` — checklist of receipts the row must capture before a PASS can be considered.
- `artifactDestination` — target proof path fields.
- `review` — candidate/fold policy.

## Guardrails

- No secrets in manifests, summaries, logs, or generated evidence.
- Do not mark generated evidence as final PASS. Use `PASS-candidate`, `HONEST-LIMIT-candidate`, or `FAIL-candidate` language until reviewed.
- Do not run mutating rows in parallel against the same live session.
- Serialize compaction/config rows and require explicit issue ownership before adding them.
- Capture Tempo trace JSON for every continuation-tool fire before a row can be folded as PASS.
