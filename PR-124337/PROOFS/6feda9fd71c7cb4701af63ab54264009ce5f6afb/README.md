# Exact Discord transport proof for openclaw/openclaw#124337

This corpus executes the two missing rows against exact product
`6feda9fd71c7cb4701af63ab54264009ce5f6afb`. It does not deploy or mutate a
prince runtime. A process-local Discord `MESSAGE_CREATE` fixture enters the
production durable ingress monitor and production Discord dispatcher, which
owns the Plugin SDK lifecycle fan-in.

**Behavioral verdict: both exact transport rows PASS. Broad acceptance:
FAIL.** Mode-B run `33318993673` completed with 20 deterministic failures
outside the candidate delta; the red gate and full failure list are preserved
in [`MODE-B.md`](MODE-B.md).

## Rows

| Row | Execution | Contract |
| --- | --- | --- |
| `A-GENUINE-ABANDONMENT-CEILING` | exact execution | Repeated reply-lane `onAbandoned` consumes the durable retry budget, retains the Discord payload in one `retry-limit-exceeded` dead letter, and releases the later-admitted same-lane follower strictly after dead-letter time; both terminal facts survive close/reopen without replay. |
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
attempt sequence, exact dead-letter reason, strict follower completion ordering,
and restart observations.

## Run

```bash
docs_root=/path/to/karmaterminal-openclaw-docs
cd /path/to/exact-6feda9fd-worktree
OPENCLAW_ROOT="$PWD" \
OPENCLAW_PROOF_DOCS_SHA=<pushed-harness-commit> \
OPENCLAW_PR124337_RESULTS_DIR="$docs_root/PR-124337/PROOFS/6feda9fd71c7cb4701af63ab54264009ce5f6afb" \
node --import tsx "$docs_root/PR-124337/PROOFS/6feda9fd71c7cb4701af63ab54264009ce5f6afb/harness.mjs"
```

Run `node PR-124337/PROOFS/6feda9fd71c7cb4701af63ab54264009ce5f6afb/verify.mjs`
after capture. `SHA256SUMS` excludes itself and is the final public artifact
integrity manifest.
