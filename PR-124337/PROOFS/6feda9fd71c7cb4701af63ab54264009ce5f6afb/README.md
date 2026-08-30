# Exact Discord transport proof for openclaw/openclaw#124337

This corpus executes the two missing rows against exact product
`6feda9fd71c7cb4701af63ab54264009ce5f6afb`. It does not deploy or mutate a
prince runtime. A process-local Discord `MESSAGE_CREATE` fixture enters the
production durable ingress monitor and production Discord dispatcher, which
owns the Plugin SDK lifecycle fan-in.

## Rows

| Row | Execution | Contract |
| --- | --- | --- |
| `A-GENUINE-ABANDONMENT-CEILING` | exact execution | Repeated reply-lane `onAbandoned` consumes the durable retry budget, retains the Discord payload in one `retry-limit-exceeded` dead letter, releases and completes the same-lane follower, and survives close/reopen without replay. |
| `B-MIXED-FANIN-CANCELLATION` | exact execution | Discord debounce combines current and legacy lifecycle sources; shutdown cancellation charges neither source, explicit current cancellation is also budget-free, and row A is the same-process genuine-abandonment sibling control. |
| Prior `eee69b3d` component rows | inspected, not transposed | Inputs stop below the Discord transport boundary and do not establish exact-target execution, so no behavioral receipt is relabeled or copied. |

Candidate HTTP responses and self-reported summaries are not evidence. The
harness projects the canonical SQLite ingress and session stores after closing
their production owners, reopens them read-only, and signs each verdict with an
ephemeral Ed25519 key whose public half is committed with the run.

The socket field is `N/A`: this deterministic proof invokes the production
Discord gateway-message handler process-locally and opens no listener. The
transport receipt still binds raw Discord message/channel identity, payload
hash, process PID/start time, product tree, harness hash, route/session key,
attempt sequence, dead letter, follower completion, and restart observations.

## Run

```bash
OPENCLAW_ROOT=/path/to/exact-6feda9fd-worktree \
OPENCLAW_PROOF_DOCS_SHA=<pushed-harness-commit> \
OPENCLAW_PR124337_RESULTS_DIR="$PWD/PR-124337/PROOFS/6feda9fd71c7cb4701af63ab54264009ce5f6afb" \
node --import tsx PR-124337/PROOFS/6feda9fd71c7cb4701af63ab54264009ce5f6afb/harness.mjs
```

Run `node PR-124337/PROOFS/6feda9fd71c7cb4701af63ab54264009ce5f6afb/verify.mjs`
after capture. `SHA256SUMS` excludes itself and is the final public artifact
integrity manifest.

