# Continuation proof corpus - `372ce0f8e33b42d0377a64806f8013208af54fcf`

- **PR-presentation / corpus identity:** `372ce0f8e33b42d0377a64806f8013208af54fcf`
- **Runtime composite:** `6e6da7bba079b0fc50d134b96657cda683985837`
- **Docs starting SHA / unchanged harness:** `5862caf39a3844a8ce3dd25def236a901ce9b316`
- **Frozen upstream:** `8578b8f55cf77ddb161891b662a02f8c8c2a80ba`
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
[32650099821](https://github.com/karmaterminal/openclaw-bootstrap/actions/runs/32650099821)
is red: 163,506 passed and 38 failed. Its aggregate records 16 deterministic
failures (14 TUI PTY, one doctor-lint, one Telegram Mantis) and 22 load flakes
that greened on retry. The exact absorbed-upstream baseline run
[32657627746](https://github.com/karmaterminal/openclaw-bootstrap/actions/runs/32657627746)
also failed: 162,053 passed / 41 failed, with 19 deterministic failures.
Thirteen deterministic test identities are shared, three are
presentation-only, and six are baseline-only. Raw logs plus three matched
serial repetitions on each immutable SHA classify the three presentation-only
identities as host permission or PTY timing/order failures, not presentation
product regressions.

Exact Gate 2.7 is fully dispositioned: 346 unique current rows, 345 `KEEP` and
one `RESTORE`, with zero missing, extra, or duplicate paths. The restore is a
compatible frozen-upstream Telegram anti-spoof assertion omitted by the
presentation. The presentation is immutable and this docs lane cannot patch
OpenClaw, so acceptance remains blocked. These receipts are recorded in
[RESOLVED-SHA.md](RESOLVED-SHA.md).

No live proof row may fire while the acceptance state remains blocked.

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
