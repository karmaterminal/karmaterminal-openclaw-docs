# METHOD — PROOFS/3821eaef72677c78f450ae9956cb582a22ba4cba

## What was run

```bash
# on seat ronan, from the frozen docs checkout at 45d301cb87c2e57634daf2fb78c7613d6afbc018
cd tools/k6-proofs
export OPENCLAW_GATEWAY_WS=ws://127.0.0.1:18789
export OPENCLAW_SESSION_KEY=agent:main:proof-disposable
export OPENCLAW_CANDIDATE_SHA=1baff536afa549fea75660403c453bbd265352c0
export OPENCLAW_RUNTIME_SHA=1baff536afa549fea75660403c453bbd265352c0
export OPENCLAW_RUNTIME_BUILD_SHA=1baff536afa549fea75660403c453bbd265352c0
export OPENCLAW_DOCS_SHA=45d301cb87c2e57634daf2fb78c7613d6afbc018
export OPENCLAW_GATEWAY_UNIT=openclaw-gateway
export OPENCLAW_SEAT_NAME=ronan
export OPENCLAW_REQUIRED_MAX_SPAWN_DEPTH=2
export OPENCLAW_EXPECTED_MAX_SPAWN_DEPTH=5
export OPENCLAW_CREATE_DISPOSABLE_SESSIONS=true
./scripts/run-proofs.sh --live --docs-ref 45d301cb87c2e57634daf2fb78c7613d6afbc018 "$(node scripts/list-runnable-rows.mjs --live-suite)" 1baff536afa549fea75660403c453bbd265352c0
```

`--live-suite` resolves to 34 entries = PREFLIGHT + 33 `k6-runnable` rows. The no-argument form
resolves to 36 and includes `R-CW-5A`/`R-CW-6A`, which are **not** `k6-runnable`; firing those
through the gateway path is incorrect, so the canonical filtered set was used.

`candidate_sha` must equal the deployed runtime build (`run-proofs.sh` enforces this), which is why
the composite SHA appears as the execution identity while this corpus is published at the presented
continuation SHA.

## Gates that passed before any row fired

- harness identity: every tracked byte under `tools/k6-proofs` matched docs `45d301cb87c2e57634daf2fb78c7613d6afbc018`, tree clean
- harness contract binding: frozen manifest/scenario digests for every selected row
- deployed runtime SHA match
- `seat readiness receipt verified` — authenticated gateway RPC, depth configured=5 effective=5
  required=2 expected=5, empty note list, binding digest `165a1ce0…`

Seat config verified rather than assumed: `agents.defaults.subagents.maxSpawnDepth = 5` and
`agents.defaults.continuation` carrying `maxChainLength`, `maxDelegatesPerTurn` and
`costCapTokens`; readiness fails closed without all of them in both configured and effective config.

## Disclosed deviations

1. **Refired rows.** An initial attempt was launched with the unfiltered 36-row set and terminated
   after ~2 minutes precisely to avoid firing the orchestration-required rows. It had consumed
   `PREFLIGHT` and `R-CD-1` and interrupted `R-CD-2`. Its artifact tree was deleted before relaunch,
   so no partial receipts from it can leak here. Those three rows were refired in the recorded run.
   The reason was method conformance, not verdict improvement. Rows are one-shot, so this is
   disclosed rather than silent.
2. **Single seat.** All 33 rows ran on ronan. The canonical per-prince assignment table spreads
   R-CW-* to cael/rune and R-CD-* to ronan. `dispatch_allocation` assigns every fired row exactly
   once, but this cycle does not honor the per-owner distribution.
3. **Operator-supplied token.** `project81-k6-proof.yml` requires `secrets.OPENCLAW_GATEWAY_TOKEN`,
   and that single repository secret authenticates against only one seat, so three Actions dispatches
   failed seat readiness with an unauthenticated target RPC. The harness deliberately forbids reading
   ambient host config (`seat-readiness.test.mjs`: *workflow and matrix runner cannot fall through
   failed readiness or ambient host config*), so the token was instead supplied **explicitly** by the
   operator into `run-proofs.sh`'s required `OPENCLAW_GATEWAY_TOKEN` variable, which is the sanctioned
   path. The signed readiness receipt binds gateway URL fingerprint, candidate, runtime, docs ref,
   rows and depths.
4. **No independent review.** Candidate verdicts only; nothing promoted.

## Known harness defect found by this cycle

Report generation failed for the entire run:

```
render-run-report.mjs:156 rowFromRunResult -> consumeRcd2Authority()
lib/r-cd-2-authority-context.mjs:79 readJson
Error: R-CD-2 authoritative receipt missing or unreadable: ENOENT ... r-cd-2-authoritative-receipt.json
```

`consumeRcd2Authority()` is called unconditionally, so a single row that legitimately produced no
authoritative receipt destroys the rendered report for all 34 rows. Per-row artifacts and receipts
are intact; only the HTML report is lost. Owner: this repository.
