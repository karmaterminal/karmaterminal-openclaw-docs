# Accepted exact-target direct controls

| Field | Value |
|---|---|
| Product SHA | `2ffc7ca0615f5917acf809d1ccba82b0ef5b2d5a` |
| Mode-B run | `32895790947` |
| Workflow SHA | `342cc9c6d190e1ba57d9995d29e394c993a3e79b` |
| Deterministic Mode-B failures covered | 18 |
| Accepted direct-control result | 18 passed |

The exact-target gate handoff supplied to this transposition records direct
passing controls for:

- four isolated auth/session ownership assertions;
- auth-choice and model-resolution assertions;
- Doctor and dispatch assertions;
- cron isolated-agent identity;
- memory-flush persistence;
- the continuation cross-session gate;
- two config best-effort assertions;
- Telegram Mantis runtime ownership; and
- four CLI update-finalization assertions.

These controls classify the Mode-B failures; they do not make the red workflow
green.

## Docs-lane replay limitation

The docs lane independently replayed the 18 named assertions with the repository
runner and one worker. Sixteen passed. On the loaded shared host, the cron
control reached its 180-second `beforeAll` limit and the cross-session control
reached its 120-second test limit; neither produced an assertion mismatch. This
non-authoritative replay does not replace or weaken the accepted exact-target
control receipt above, and its timeout diagnostics are retained outside the
public corpus.
