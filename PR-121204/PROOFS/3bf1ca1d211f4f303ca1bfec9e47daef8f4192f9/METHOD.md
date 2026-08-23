# Method

## Authority and identity

Current remote `openclaw-bootstrap` `RUNBOOKS/ENTRYPOINT.md` selected
`RUNBOOKS/PROOF-CORPUS-METHOD.md`. The current docs method and
`frond-scribe:skills/build-openclaw-proof-corpus/SKILL.md` were also read before
capture.

Before each row, the worker independently recorded the Rune seat, UTC time,
installed checkout, `dist/build-info.json` commit, non-mutating gateway state,
nonce, and command. Both checkout identities were required to equal
`6e6da7bba079b0fc50d134b96657cda683985837`.

The systemd user unit was absent or inactive while an OpenClaw gateway process
was observed. The worker did not restart, repair, or redeploy it.

## Deterministic stimulus

`package.json#scripts.test` was `node --import tsx scripts/test-projects.mts`.
Each row used that sanctioned `pnpm test` entrypoint with one selected proof
case and one worker. Raw Vitest was not invoked.

The proof-only harness is [proof-harness.test.ts](proof-harness.test.ts), SHA-256
`368650f8f97583038cd0a9beec2488fbe67574b12a4d8df514a595a583b8f344`.
It imports production queue/drain SDK surfaces and the production Discord
ingress monitor. Each row creates a unique temporary state directory and the
real `channel_ingress_events` SQLite table.

For each row the harness records a public-safe projection of durable rows before
and after processing. Payload JSON, claim tokens, claim owners, credentials, and
operator state are excluded.

## Boundary and limits

Rows 1 and 2 use the real Discord ingress classifier, pending-disposition logic,
claim lifecycle, and durable SQLite queue. Their downstream dispatch callback
only acknowledges adoption; no model or agent turn is run.

Row 3 uses the core durable drain and real SQLite queue. It forces a
pre-adoption stall, advances the five-second watchdog, observes one durable
retry, completes the stalled row and follower, then submits the completed ID
again and proves no further dispatch.

Because all state is isolated test state, no deployed-gateway journal event is
expected or claimed. The absence of a live journal excerpt is therefore by
construction, not an inference from missing logs.
