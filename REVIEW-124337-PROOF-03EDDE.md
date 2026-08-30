# Independent review: PR 124337 exact transport proof corpus

## Verdict

`REQUEST_CHANGES`

Row B's cancellation receipts are confirmed, but the corpus does not prove the
required strict terminal ordering for row A. Both the committed ordered
checkpoint and an independent rerun record:

```text
head.failed_at         = 1277001
follower.completed_at  = 1277001
```

The harness accepts equality with `follower.completed_at >= head.failed_at`.
The review contract requires the follower to complete **strictly after** the
head's failed/dead-letter time. Consequently row A's signed `PASS`, row B's
reference to row A as a signed `PASS` sibling, and the manifest rollup of two
PASS rows overstate the exact authority available.

There is a second history-integrity defect: every proof-history commit from
`57148b0413dbae8295f00218b75fbe1e08e3f823` through
`03edde2b0b0b7bfc7afef7ac2eb36994971ff301` contains literal `\n\n` bytes
before `Co-authored-by` instead of real line breaks. Git's trailer parser
returns no `Co-authored-by` trailer for all ten commits.

## Named-ref contract

Applicable refs were resolved before crediting evidence. The safe review lane
was published unchanged at `03edde2b0b0b7bfc7afef7ac2eb36994971ff301`
before review execution.

| Category | Named ref | Expected full SHA | Local | Tracking | Server | Result |
| --- | --- | --- | --- | --- | --- | --- |
| Product/base ref | `karmaterminal/openclaw:codeagent/124337-bounded-43a7-absorb-20260829` | `6feda9fd71c7cb4701af63ab54264009ce5f6afb` | same | same | same | equal |
| This lane's safe branch ref | `karmaterminal/karmaterminal-openclaw-docs:codeagent/124337-03edde-proof-independent-review-20260830` | pre-report `03edde2b0b0b7bfc7afef7ac2eb36994971ff301` | same | same | same | equal and published |
| CI/workflow ref | `karmaterminal/openclaw-bootstrap:codeagent/124337-feac2430-routing-independent-review-20260829` | `d05778e6a96dd9a96946eff483e80c4d9ff9575e` | same | same | same | equal |
| Presentation ref | N/A | N/A | N/A | N/A | N/A | out of scope |
| Docs/proof ref | `karmaterminal/karmaterminal-openclaw-docs:codeagent/124337-6feda9fd-exact-transport-proof-20260830` | `03edde2b0b0b7bfc7afef7ac2eb36994971ff301` | same | same | same | equal |

Additional authority refs also resolved:

| Purpose | Named ref | Full SHA | Equality |
| --- | --- | --- | --- |
| Prior product review | `karmaterminal/openclaw:codeagent/124337-6feda9fd-independent-review-20260829` | `aed2ce831feb4e75af5332ec000336b537849322` | local/tracking/server equal |
| Exact-parent Mode-B classification | `karmaterminal/openclaw:codeagent/124337-modeb-33286077327-parent-classification-20260829` | `eaad41489f30b284f61dc47b9846f78eb2031ad1` | local/tracking/server equal |
| Prior component source | `karmaterminal/openclaw:codeagent/ward-1255-m1-intervention` | `eee69b3d51c68c76c25c376451c161497e614a2b` | tracking/server equal; read-only local object |

Mode-B run `33318993673` independently reports workflow `headSha`
`d05778e6a96dd9a96946eff483e80c4d9ff9575e` and product input
`6feda9fd71c7cb4701af63ab54264009ce5f6afb`.

## Docs identity and history

| Check | Result |
| --- | --- |
| Docs head | `03edde2b0b0b7bfc7afef7ac2eb36994971ff301` |
| Docs tree | `d047cd11fb2cb039d1e249bba4b65b54a081ec93` |
| Ordered PASS parent | `b4a18ba2ab0777ff2e9aea006248ded43be7b992` |
| Local/tracking/server identity | equal before review |
| Parent chain | linear through all supplied correction commits |
| Tracked files | clean before review |
| Untracked files | pre-existing dispatch files `BRIEF.md`, `console.log`, and `launch.sh`; therefore the literal worktree was not fully clean |
| Proof-history trailers | failed: 0/10 parse as Git trailers |
| Commit signatures | all ten commits report `%G? = N` (unsigned) |

The malformed trailers do contain the intended Copilot text, but text embedded
after literal backslash characters is not a commit trailer and is not credited
as one.

## Correction-history audit

The historical harness bytes were extracted from each commit and run without
editing against detached exact product
`6feda9fd71c7cb4701af63ab54264009ce5f6afb`, tree
`7095698b45352f760e79d17e2d9e2bffcfdd7765`. Each run used an isolated results
directory outside the repository. The exact product worktree remained clean.

| Commit | Correction or control | Independent result |
| --- | --- | --- |
| `57148b0413dbae8295f00218b75fbe1e08e3f823` | Initial exact Discord transport harness | exit 1; signed FAIL: default-state legacy registry was consulted |
| `6770dabdc871a63ee9a6d1850ac0ddfdf2d10726` | Scope session persistence to row-local state | exit 1; signed FAIL: `originalNow` initialization order |
| `cd26162deb658daab664083ce2f2a893991f14eb` | Initialize exact proof clock | exit 1; signed FAIL: `fsModule` initialization order |
| `2717224429a271c6b7e80c2857f5bec259e6c090` | Fix canonical projection reader | exit 1; signed FAIL: raw SQLite hashes differed after reopen although row facts remained stable |
| `7cc7dc68f3f6d5371e89de2f2697ca06d3f04379` | Compare canonical reopen row facts, not whole-file hashes | exit 0; signed PASS |
| `fcb8fb38894de2f5ef38b70623104b76558271ff` | Publish first exact transport rows | exit 0; same harness bytes as `7cc7dc68`; signed PASS |
| `eeb83104300697d0817aa01ad097f83f09065918` | Bind admitted and retained payload hashes | exit 0; signed PASS; retained raw-message hash equals admitted head hash |
| `70e8dded665a291e2e69cc8b377427152bd1b917` | Distinguish head/follower admission and add terminal-order assertion | exit 0; signed PASS, but only because the assertion permits equal terminal timestamps |
| `b4a18ba2ab0777ff2e9aea006248ded43be7b992` | Freeze ordered corpus | artifacts faithfully preserve the same equal terminal timestamps |
| `03edde2b0b0b7bfc7afef7ac2eb36994971ff301` | Preserve Mode-B disposition | correctly records broad acceptance as FAIL |

The four committed diagnostic FAIL envelopes independently verify against their
paired Ed25519 public keys, and the reproduced diagnostics match their
committed harness SHA-256 values:

| Diagnostic | Harness SHA-256 |
| --- | --- |
| Session-store scope | `6a70b36d253412d7b670b51da19c8d37f562c035cbe2d7d7e3f38b3881130cd8` |
| Timing helper | `8c6a6783136cfc3d4a1c5040ed429196e7365c01237d7b0ebe19c1199e3535bc` |
| Projection helper | `4267f565df004b8a844e2ecaa1ee1766be8e854b26579c3077c66bd815e494d9` |
| SQLite reopen byte comparison | `d87f6c4291ed82012c06104b9fcd914f265c6f21b6ae257e6b08a6f653dfaae7` |

The final executed harness hash is
`8589d05ab474f99f3ebd16102d048c5e2cadea2b25deea3f2c4485a86b8778b8`,
matching the committed execution identity.

## Row-by-row authority

| Row | Required authority | Committed and independently reproduced facts | Review |
| --- | --- | --- | --- |
| A: genuine abandonment | Head admitted before follower | `received_at` 10000 then 10001; transport processes head through all retries before follower | confirmed |
| A: genuine abandonment | Monotonic attempts and configured ceiling | observations 1 through 7, then terminal observation 8 with retained attempt 7; configured maximum 8 | confirmed |
| A: genuine abandonment | Exactly one payload-retaining `retry-limit-exceeded` dead letter | one failed head; `last_error=turn-abandoned`; retained payload; retained raw-message hash equals admitted head hash | confirmed |
| A: genuine abandonment | Follower strictly after failed/dead-letter time | committed and rerun values are equal (`1277001 == 1277001`); harness checks `>=` | **rejected** |
| A: genuine abandonment | Restart/reopen preserves rows and does not replay head | canonical ingress/session projections equal; replay list empty | confirmed |
| B: mixed fan-in | Current and legacy-fallback cancellation budget-free | both durable rows pending, attempts 0, no failed reason, no dead letter | confirmed |
| B: explicit cancellation | Explicit current cancellation budget-free | durable row pending, attempts 0, no failed reason, no dead letter | confirmed |
| B: sibling | Genuine abandonment still reaches ceiling | row A independently reaches observation 8 and `retry-limit-exceeded`; strict follower-order defect does not erase the ceiling fact | confirmed for ceiling only |
| B: outcome separation | Transport and durable receipts distinguish paths | combined two-line preflight; cancellation rows remain pending with payload hashes while genuine abandonment is failed with retained raw Discord hash | confirmed |

The real composition boundary is exercised:

```text
createDiscordMessageHandler
  -> createDiscordIngressMonitor
  -> createChannelIngressDrain
  -> createDiscordMessageDispatcher
  -> Plugin SDK lifecycle fan-in
  -> reply-lane terminal lifecycle
```

The external Discord listener is intentionally N/A; the synthetic
`MESSAGE_CREATE` payload enters the production gateway-message handler
process-locally.

## Persistence and semantic authority

The corpus correctly stopped using whole SQLite file hashes as semantic
authority. The committed row A ingress hashes differ across reopen:

```text
before bcc5e54f38619a91445927cbd4873f7c67081f3acaa13c8168e14f194a18c6b1
after  b5418423d58a523b3d88d650775076503ece2c97c228b01dc72dd6bdb9bec7c5
```

The independent rerun also produced different file hashes while preserving
identical canonical ingress and session projections and replaying no terminal
row. WAL checkpoint/reopen byte drift is therefore diagnostic only. Bound row,
route, event, session, payload, and harness identities are the semantic
authority.

## Corpus integrity, cleanup, and non-interference

`verify.mjs` passes and verifies three signed PASS envelopes, four signed FAIL
diagnostics, all 33 entries in `SHA256SUMS`, and the 34-file inventory. That
integrity check proves the corpus is unchanged; it does not cure the too-weak
strict-order predicate.

`transposed_rows` is exactly empty. The prior `eee69b3d` component corpus is
marked inspected-not-transposed and is not credited as exact successor Discord
transport evidence.

Committed cleanup records zero matching temporary directories, a clean exact
product worktree, no fleet or prince-runtime mutation, and no opened network
listener. Independent runs likewise left the exact product worktree clean and
no `/tmp/openclaw-pr124337-discord-*` directories. Signed FAIL history remains
present and valid.

Execution identity is internally consistent: product/tree
`6feda9fd...`/`7095698...`, docs harness `70e8dded...`, Node `v25.9.0`,
`arm64`, and the final harness hash all match across the manifest, receipts,
and independent execution.

## Mode-B 33318993673

Mode-B remains **FAIL**. The live run identity and committed aggregate agree:

| Fact | Value |
| --- | --- |
| Product input | `6feda9fd71c7cb4701af63ab54264009ce5f6afb` |
| Workflow SHA | `d05778e6a96dd9a96946eff483e80c4d9ff9575e` |
| Run | `33318993673` |
| Routing | 167/167 shards; 69/69 routed-job receipts valid |
| Test tally | 179,809 passed; 25 failed; five load flakes greened |
| Deterministic failures | 20 |
| Conclusion | failure |

All 14 deterministic signatures classified at exact-parent review
`eaad41489f30b284f61dc47b9846f78eb2031ad1` recur. The six signatures not
listed in that prior run are:

| Newly observed signature | Count | Ownership check |
| --- | ---: | --- |
| TUI PTY sanitizes ANSI OSC and C1 payloads | 1 | test blob byte-identical at candidate and pinned upstream; no candidate-delta path intersection |
| `install.sh` Alpine/NodeSource/apt cases | 5 | test and `scripts/install.sh` blobs byte-identical at candidate and pinned upstream; no candidate-delta path intersection |

There is **no genuinely new candidate/product-delta-owned signature** among the
six. They are newly observed deterministic broad-red signatures from absorbed
upstream surfaces, not grounds to green the run. No failure is waived,
repaired, or relabeled as a pass. The candidate-owning `channels`,
`extension-discord`, and `agentic-plugin-sdk` shards are green, but broad
acceptance remains red.

## Independent commands and results

Historical controls used the repository's exact harness bytes:

```bash
git archive <docs-commit> \
  PR-124337/PROOFS/6feda9fd71c7cb4701af63ab54264009ce5f6afb/harness.mjs |
  tar -x -C <isolated-code-dir> --strip-components=3

cd /home/figs/flesh_beast_best_beast/source/WORKTREES/openclaw-124337-exact-6feda9fd
OPENCLAW_ROOT="$PWD" \
OPENCLAW_PROOF_DOCS_SHA=<docs-commit> \
OPENCLAW_PR124337_RESULTS_DIR=<isolated-results-dir> \
node --import tsx <isolated-code-dir>/harness.mjs
```

Results were four expected nonzero signed controls followed by four zero-exit
signed successors, as detailed in the correction-history table.

Committed corpus verification:

```bash
node PR-124337/PROOFS/6feda9fd71c7cb4701af63ab54264009ce5f6afb/verify.mjs
```

Result:

```json
{"event":"pr124337-corpus-verified","verdict":"PASS","signed_receipts":3,"signed_diagnostics":4,"files":34}
```

Ref identity was checked with `git rev-parse`, `git ls-remote`, and the GitHub
ref API. Mode-B identity and conclusion were checked with:

```bash
gh run view 33318993673 \
  --repo karmaterminal/openclaw-bootstrap \
  --json databaseId,conclusion,status,headSha,headBranch,event,createdAt,updatedAt,url,jobs
```

## Required changes

1. Make the row A ownership-boundary regression assert
   `follower.completed_at > head.failed_at`, not `>=`.
2. Produce a deterministic successor receipt in which the canonical follower
   completion time is strictly greater than the canonical head failure time,
   then regenerate all signed rows, rollups, and `SHA256SUMS`.
3. Ensure row B references the corrected row A sibling receipt.
4. Recreate the proof-history commits with real newline-delimited,
   Git-parseable `Co-authored-by` trailers if trailer conformance is required
   for acceptance.

## Residual limits

- The proof is process-local and does not establish a live Discord socket or
  fleet deployment.
- Ephemeral Ed25519 signatures authenticate unchanged run bytes, not a human
  signer.
- The literal review worktree began with three untracked dispatch files,
  although tracked proof bytes and the exact product worktree were clean.
- Mode-B is red with 20 deterministic failures.
- Until strict terminal ordering is captured from the canonical store, the
  exact corpus has one confirmed row (B's cancellation behavior), not two
  confirmed exact PASS rows.
