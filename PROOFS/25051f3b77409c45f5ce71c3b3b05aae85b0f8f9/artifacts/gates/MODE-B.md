# Exact-target Mode-B classification

| Field | Value |
|---|---|
| Product SHA | `2ffc7ca0615f5917acf809d1ccba82b0ef5b2d5a` |
| Exact upstream parent/control | `4da57168d3c1970419e93e59a91e65466518231b` |
| Workflow SHA | `342cc9c6d190e1ba57d9995d29e394c993a3e79b` |
| Run | [`32895790947`](https://github.com/karmaterminal/openclaw-bootstrap/actions/runs/32895790947) |
| Conclusion | `failure` |
| Routed shards / jobs | 163 / 69 |
| Routing receipts | 69/69 valid |
| Tests | 165,696 passed; 39 failed |
| Load flakes greened | 9 |
| Deterministic failures | 32 |

The workflow is red. This corpus preserves that conclusion and classifies every
reported failure; it does not convert the run to green.

## Deterministic failures

| Count | Surface | Classification |
|---:|---|---|
| 13 | `src/tui/tui-pty-local.e2e.test.ts` | All fail before PTY behavior because the dist runner lacks `node_modules/@openclaw/ai/dist/internal/openai-responses-payload-policy.mjs`. The test, source module, package export, package build config, root manifest, and lockfile are byte-identical to upstream `4da57168…`. |
| 1 | `src/auto-reply/reply/commands-learn.test.ts` | Directly red on the exact target: the assertion expects `first ~60 characters`, while the prompt says `within the first 60 characters`. The test, command implementation, and prompt implementation are byte-identical to upstream `4da57168…`. |
| 18 | Isolated auth/session ownership, auth choice, model resolution, Doctor, dispatch, cron, memory, cross-session gate, config best-effort, Telegram Mantis, and CLI update finalization | The accepted exact-target control receipt reports every assertion green. These are shard order/host/timeout effects, not an exact-target behavioral regression. |

The 18-control group consists of four isolated auth/session assertions, one
auth-choice assertion, one model-resolution assertion, one Doctor assertion,
one dispatch assertion, one cron assertion, one memory assertion, one
cross-session assertion, two config assertions, one Telegram assertion, and
four CLI assertions.

## Vendored receipts

- Fail-closed aggregate:
  [`mode-b/aggregate/aggregate-summary.md`](mode-b/aggregate/aggregate-summary.md)
  and
  [`mode-b/aggregate/aggregate-summary.json`](mode-b/aggregate/aggregate-summary.json).
- Raw failing and confirm-determinism cell packets:
  [`mode-b/artifacts/`](mode-b/artifacts/).
- Accepted exact-target controls for the 18 grouped deterministic failures:
  [`mode-b/DIRECT-CONTROLS.md`](mode-b/DIRECT-CONTROLS.md).
- Deterministic exact-target `commands-learn` negative control:
  [`mode-b/commands-learn-exact-red.log`](mode-b/commands-learn-exact-red.log).
- Target/upstream blob identities for the TUI packaging and `commands-learn`
  surfaces:
  [`mode-b/upstream-blob-identity.txt`](mode-b/upstream-blob-identity.txt).
- Machine rollup: [`mode-b-summary.json`](mode-b-summary.json).

Nine initially red assertions passed confirm-determinism reruns. Their seven
receipt files are retained in the corresponding cell packets; two receipt files
contain two greened assertions each.

## Disposition

No deterministic failure is candidate-specific, but the authoritative run
conclusion remains `failure`. This exact pure-target CI receipt is independent
of historical live evidence and provides no exact live claim for descendant
runtime `a48c475b…`.
