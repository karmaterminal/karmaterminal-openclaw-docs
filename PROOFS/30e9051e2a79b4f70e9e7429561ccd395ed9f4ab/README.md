# Continuation proof corpus - `30e9051e2a79b4f70e9e7429561ccd395ed9f4ab`

- **PR-presentation / corpus identity:** `30e9051e2a79b4f70e9e7429561ccd395ed9f4ab`
- **Runtime composite:** `6e6da7bba079b0fc50d134b96657cda683985837`
- **Docs starting SHA / unchanged harness:** `5862caf39a3844a8ce3dd25def236a901ce9b316`
- **Frozen upstream:** `6669872a95f87b9a79ebebbaac5718cd877f86bd`
- **Seed rollup:** `41 total / 0 pass / 0 partial / 0 honest_limit / 0 fail / 41 missing`
- **Authorized live-suite allocation:** Ronan, 34 runnable entries including `PREFLIGHT` and 33 behavioral rows

This is a fresh exact-presentation seed. Every current behavior row is reopened
as `missing`; no earlier live verdict is relabeled as evidence for this
presentation SHA.

Eight static-comparison scenarios retain only the explicitly permitted
`carriedFrom=1cc8f4e3d617ef6f173283ef83d7b739a4995734` baseline used by the
current harness. Those references are comparison inputs, not current-candidate
verdicts.

## Identity boundary

The fleet executes the separate composite
`6e6da7bba079b0fc50d134b96657cda683985837`. It discloses:

- `openclaw/openclaw#121204` source
  `3bf1ca1d211f4f303ca1bfec9e47daef8f4192f9`;
- `openclaw/openclaw#124337` source
  `4ff99f7e5c149d90214a3df932f9d5adb438b835`.

That composite is ancillary execution context. It is not the presentation,
capture, ship, or proof-source identity. See
[NON-INTERFERENCE-MAP.md](NON-INTERFERENCE-MAP.md) for the direct tree
comparison and path classification.

## Acceptance state

The exact presentation Mode-B run
[32674562617](https://github.com/karmaterminal/openclaw-bootstrap/actions/runs/32674562617)
is red with valid receipts for all 163 routed shards. Its aggregate records 14
deterministic failures: 12 TUI PTY cases, one doctor-lint case, and one Telegram
Mantis case. The exact absorbed-upstream baseline run
[32657627746](https://github.com/karmaterminal/openclaw-bootstrap/actions/runs/32657627746)
also failed. Its failures include the same doctor and TUI families. The TUI
family is an artifact-assembly failure: the isolated runtime lacks
`@openclaw/ai/dist/internal/openai-responses-payload-policy.mjs`, although the
source path is identical and the final local build emits it. The Mantis paths
are byte-identical to frozen upstream; isolated candidate and upstream runs both
pass 6/6. The doctor test also passes in isolated candidate and upstream runs.
These complete matched receipts classify the red set as inherited
artifact/host/order failures, not candidate-specific product failures.

Exact Gate 2.7 is fully dispositioned: 345 current mixed rows, all `KEEP`, with
zero `FROZEN-STALE` and zero remaining `RESTORE`. The prior Telegram restore is
present byte-identically in this presentation and its owning shard passes
11/11. These receipts are recorded in [RESOLVED-SHA.md](RESOLVED-SHA.md).

The seed is therefore eligible for the single authorized Ronan live-suite fire.

## Verdict policy

- `pass`: complete current-candidate behavior and all required identity,
  durable, correlation, topology, and public-safety receipts.
- `partial`: current behavior was observed but any required predicate or
  receipt is incomplete.
- `honest_limit`: reserved only for `R-RC-2` under the structured
  `context_threshold` rejection contract.
- `fail`: authoritative current-candidate evidence contradicts the row.
- `missing`: no authoritative current-candidate behavior receipt exists.

Candidate envelopes remain review-required. Workflow color never becomes a
canonical row verdict by itself.

## Navigation

- [CLAW-SWEEPER-DIRECT-DIGEST.md](CLAW-SWEEPER-DIRECT-DIGEST.md)
- [CLAWSSWEEPER.md](CLAWSSWEEPER.md)
- [METHOD.md](METHOD.md)
- [RESOLVED-SHA.md](RESOLVED-SHA.md)
- [ARTIFACTS.md](ARTIFACTS.md)
- [NON-INTERFERENCE-MAP.md](NON-INTERFERENCE-MAP.md)
- [proofs-manifest.json](proofs-manifest.json)
