# Independent review: openclaw/openclaw#124337 clean-history strict-order proof

Review target: exact proof head `9eb729a0d739dd4a0397131338a08a70bf18ac11`.
This review does not modify product or proof bytes.

## Named-ref contract

The primary workorder refs in this table were established before behavioral or
artifact evidence was credited. `N/A` means that the workorder supplies an
immutable object ID rather than a tracking ref, or explicitly excludes that
surface.

| Surface | Named ref or object | Required object | Local | Tracking | Server | Identity |
|---|---|---|---|---|---|---|
| Product/base | `karmaterminal/openclaw:savegame/20260830-0030Z/pr-124337-post-43a7-absorb` | `6feda9fd71c7cb4701af63ab54264009ce5f6afb` | `6feda9fd71c7cb4701af63ab54264009ce5f6afb` | `6feda9fd71c7cb4701af63ab54264009ce5f6afb` | `6feda9fd71c7cb4701af63ab54264009ce5f6afb` | equal |
| This lane's safe branch | `karmaterminal/karmaterminal-openclaw-docs:codeagent/124337-9eb729a0-proof-independent-review-20260830` | `9eb729a0d739dd4a0397131338a08a70bf18ac11` before this report | `9eb729a0d739dd4a0397131338a08a70bf18ac11` | `9eb729a0d739dd4a0397131338a08a70bf18ac11` | `9eb729a0d739dd4a0397131338a08a70bf18ac11` | equal; unchanged branch published before evidence |
| CI/workflow | `karmaterminal/openclaw-bootstrap:codeagent/124337-feac2430-routing-independent-review-20260829` | `d05778e6a96dd9a96946eff483e80c4d9ff9575e` | `d05778e6a96dd9a96946eff483e80c4d9ff9575e` | `d05778e6a96dd9a96946eff483e80c4d9ff9575e` | `d05778e6a96dd9a96946eff483e80c4d9ff9575e` | equal; run `33318993673` reports this `headSha` |
| Presentation | N/A | N/A | N/A | N/A | N/A | explicitly out of scope |
| Docs main | N/A | N/A | N/A | N/A | N/A | explicitly out of scope |
| Fleet/deployment | N/A | N/A | N/A | N/A | N/A | explicitly out of scope |
| Docs/proof clean base | immutable commit `0984dabae218000b20178f4a031e688bdf0584ac` | `0984dabae218000b20178f4a031e688bdf0584ac` | exact commit | N/A | exact commit | local/server object identity |
| Docs/proof harness authority | immutable commit `52c11aa552f08201a91421afe5532fd694c7c873` | `52c11aa552f08201a91421afe5532fd694c7c873` | exact commit | N/A | exact commit | local/server object identity |
| Docs/proof final savegame | `karmaterminal/karmaterminal-openclaw-docs:savegame/20260830/openclaw-124337-proof-strict-order-clean-history-9eb729a0d739` | `9eb729a0d739dd4a0397131338a08a70bf18ac11` | `9eb729a0d739dd4a0397131338a08a70bf18ac11` | `9eb729a0d739dd4a0397131338a08a70bf18ac11` | `9eb729a0d739dd4a0397131338a08a70bf18ac11` | equal |
| Docs/proof final tree | immutable tree `181a0f690d49e264134e73d7c1ae0113fc3953a9` | `181a0f690d49e264134e73d7c1ae0113fc3953a9` | exact tree | N/A | exact tree | local/server object identity |
| Docs/proof rejected control | immutable commit `03edde2b0b0b7bfc7afef7ac2eb36994971ff301` | `03edde2b0b0b7bfc7afef7ac2eb36994971ff301` | exact commit | N/A | exact commit | local/server object identity |
| Docs/proof prior review | immutable commit `5e968bf9c1779a2658d99d0a30806060d84caadf` | `5e968bf9c1779a2658d99d0a30806060d84caadf` | exact commit | N/A | exact commit | local/server object identity |
| Mode-B disclosure | `karmaterminal/openclaw-bootstrap` Actions run `33318993673` | failure receipt for product `6feda9fd71c7cb4701af63ab54264009ce5f6afb` | N/A | N/A | completed/failure; workflow SHA `d05778e6a96dd9a96946eff483e80c4d9ff9575e` | run identity resolved; receipt classification below |

The associated proof branch and supporting provenance refs were resolved before
their claims were credited:

| Purpose | Named ref | Local | Tracking | Server | Result |
|---|---|---|---|---|---|
| Final proof branch | `karmaterminal/karmaterminal-openclaw-docs:codeagent/124337-proof-strict-order-clean-history-20260830` | `9eb729a0d739dd4a0397131338a08a70bf18ac11` | same | same | equal |
| Corpus product base ref | `karmaterminal/openclaw:codeagent/124337-bounded-43a7-absorb-20260829` | `6feda9fd71c7cb4701af63ab54264009ce5f6afb` | same | same | equal |
| Prior product review | `karmaterminal/openclaw:codeagent/124337-6feda9fd-independent-review-20260829` | `aed2ce831feb4e75af5332ec000336b537849322` | same | same | equal |
| Prior Mode-B classification | `karmaterminal/openclaw:codeagent/124337-modeb-33286077327-parent-classification-20260829` | `eaad41489f30b284f61dc47b9846f78eb2031ad1` | same | same | equal |
| Prior component source | immutable commit `eee69b3d51c68c76c25c376451c161497e614a2b` | immutable object present; local `codeagent/ward-1255-m1-intervention` has advanced to `70d47bec1f93c5f4c7e07eebb84ef9548a480751` | `eee69b3d51c68c76c25c376451c161497e614a2b` | `eee69b3d51c68c76c25c376451c161497e614a2b` | immutable object plus tracking/server identity only |

## Verdict

`CONFIRMED_EXACT_ROWS`

The clean-history successor corrects both defects found at rejected proof
`03edde2b0b0b7bfc7afef7ac2eb36994971ff301`: strict row-A ordering is now
captured from the canonical store, and both authored commits have
newline-delimited, Git-parseable Copilot trailers. Rows A and B reproduce at the
exact product SHA through the production Discord composition boundary. This is
an exact-row verdict, not broad fork acceptance; Mode-B run `33318993673`
remains red and is not waived.

## Clean history, tree, parents, files, and trailers

The final graph from the clean docs base contains exactly two commits:

```text
0984dabae218000b20178f4a031e688bdf0584ac
+- 52c11aa552f08201a91421afe5532fd694c7c873
   +- 9eb729a0d739dd4a0397131338a08a70bf18ac11
```

| Commit | Parent | Tree | Subject |
|---|---|---|---|
| `52c11aa552f08201a91421afe5532fd694c7c873` | `0984dabae218000b20178f4a031e688bdf0584ac` | `d5e73802bbe02d48faef40d81a1ce6447a4151f7` | `proofs: enforce strict poison-head release` |
| `9eb729a0d739dd4a0397131338a08a70bf18ac11` | `52c11aa552f08201a91421afe5532fd694c7c873` | `181a0f690d49e264134e73d7c1ae0113fc3953a9` | `proofs: publish strict exact transport corpus` |

The final commit reports the required tree exactly. The rejected proof
`03edde2b0b0b7bfc7afef7ac2eb36994971ff301` and prior review
`5e968bf9c1779a2658d99d0a30806060d84caadf` are not ancestors. Thus none of
the ten malformed-trailer proof commits is carried into the accepted graph;
the direct base parent and two-commit ancestry establish the clean rebuild
rather than a rewritten or cherry-picked malformed history.

Commit `52c11aa5` adds these 12 files:

```text
PR-124337/PROOFS/6feda9fd71c7cb4701af63ab54264009ce5f6afb/NAMED-REFS.md
PR-124337/PROOFS/6feda9fd71c7cb4701af63ab54264009ce5f6afb/README.md
PR-124337/PROOFS/6feda9fd71c7cb4701af63ab54264009ce5f6afb/diagnostics/projection-helper-failure/FAIL.json
PR-124337/PROOFS/6feda9fd71c7cb4701af63ab54264009ce5f6afb/diagnostics/projection-helper-failure/signing-public-key.json
PR-124337/PROOFS/6feda9fd71c7cb4701af63ab54264009ce5f6afb/diagnostics/session-store-scope-failure/FAIL.json
PR-124337/PROOFS/6feda9fd71c7cb4701af63ab54264009ce5f6afb/diagnostics/session-store-scope-failure/signing-public-key.json
PR-124337/PROOFS/6feda9fd71c7cb4701af63ab54264009ce5f6afb/diagnostics/sqlite-reopen-byte-failure/FAIL.json
PR-124337/PROOFS/6feda9fd71c7cb4701af63ab54264009ce5f6afb/diagnostics/sqlite-reopen-byte-failure/signing-public-key.json
PR-124337/PROOFS/6feda9fd71c7cb4701af63ab54264009ce5f6afb/diagnostics/timing-helper-failure/FAIL.json
PR-124337/PROOFS/6feda9fd71c7cb4701af63ab54264009ce5f6afb/diagnostics/timing-helper-failure/signing-public-key.json
PR-124337/PROOFS/6feda9fd71c7cb4701af63ab54264009ce5f6afb/harness.mjs
PR-124337/PROOFS/6feda9fd71c7cb4701af63ab54264009ce5f6afb/verify.mjs
```

Commit `9eb729a0` adds 22 proof files, modifies `NAMED-REFS.md` and
`verify.mjs`, and modifies the root `output.md`:

```text
PR-124337/PROOFS/6feda9fd71c7cb4701af63ab54264009ce5f6afb/A-GENUINE-ABANDONMENT-CEILING/EVIDENCE.md
PR-124337/PROOFS/6feda9fd71c7cb4701af63ab54264009ce5f6afb/A-GENUINE-ABANDONMENT-CEILING/durable-state.json
PR-124337/PROOFS/6feda9fd71c7cb4701af63ab54264009ce5f6afb/A-GENUINE-ABANDONMENT-CEILING/payload-projection.json
PR-124337/PROOFS/6feda9fd71c7cb4701af63ab54264009ce5f6afb/A-GENUINE-ABANDONMENT-CEILING/receipt.json
PR-124337/PROOFS/6feda9fd71c7cb4701af63ab54264009ce5f6afb/A-GENUINE-ABANDONMENT-CEILING/restart-state.json
PR-124337/PROOFS/6feda9fd71c7cb4701af63ab54264009ce5f6afb/A-GENUINE-ABANDONMENT-CEILING/transport.json
PR-124337/PROOFS/6feda9fd71c7cb4701af63ab54264009ce5f6afb/B-MIXED-FANIN-CANCELLATION/EVIDENCE.md
PR-124337/PROOFS/6feda9fd71c7cb4701af63ab54264009ce5f6afb/B-MIXED-FANIN-CANCELLATION/durable-state.json
PR-124337/PROOFS/6feda9fd71c7cb4701af63ab54264009ce5f6afb/B-MIXED-FANIN-CANCELLATION/receipt.json
PR-124337/PROOFS/6feda9fd71c7cb4701af63ab54264009ce5f6afb/B-MIXED-FANIN-CANCELLATION/transport.json
PR-124337/PROOFS/6feda9fd71c7cb4701af63ab54264009ce5f6afb/CLEANUP.json
PR-124337/PROOFS/6feda9fd71c7cb4701af63ab54264009ce5f6afb/METHOD.md
PR-124337/PROOFS/6feda9fd71c7cb4701af63ab54264009ce5f6afb/MODE-B.md
PR-124337/PROOFS/6feda9fd71c7cb4701af63ab54264009ce5f6afb/SHA256SUMS
PR-124337/PROOFS/6feda9fd71c7cb4701af63ab54264009ce5f6afb/VALIDATION.md
PR-124337/PROOFS/6feda9fd71c7cb4701af63ab54264009ce5f6afb/artifacts/mode-b-33318993673/run-identity.json
PR-124337/PROOFS/6feda9fd71c7cb4701af63ab54264009ce5f6afb/artifacts/mode-b-33318993673/summary.json
PR-124337/PROOFS/6feda9fd71c7cb4701af63ab54264009ce5f6afb/artifacts/mode-b-33318993673/summary.md
PR-124337/PROOFS/6feda9fd71c7cb4701af63ab54264009ce5f6afb/execution-identity.json
PR-124337/PROOFS/6feda9fd71c7cb4701af63ab54264009ce5f6afb/proofs-manifest.json
PR-124337/PROOFS/6feda9fd71c7cb4701af63ab54264009ce5f6afb/run-summary.json
PR-124337/PROOFS/6feda9fd71c7cb4701af63ab54264009ce5f6afb/signing-public-key.json
PR-124337/PROOFS/6feda9fd71c7cb4701af63ab54264009ce5f6afb/NAMED-REFS.md
PR-124337/PROOFS/6feda9fd71c7cb4701af63ab54264009ce5f6afb/verify.mjs
output.md
```

The base-to-head union is 35 files. A detached checkout of exact head/tree
`9eb729a0`/`181a0f6` had zero status entries. The active dispatch worktree began
with untracked `BRIEF.md`, `console.log`, and `launch.sh`, and now also contains
this report; tracked proof bytes were clean throughout. The exact product
worktree was clean after both independent executions.

`git interpret-trailers --parse` returns exactly:

```text
Co-authored-by: Copilot <223556219+Copilot@users.noreply.github.com>
```

for each authored commit. Both bodies also contain
`References openclaw/openclaw#124337.` Commit signatures report `%G? = N`;
artifact signatures are assessed separately below.

## Strict-order negative and successor controls

The rejected harness was extracted unchanged from `03edde2b`, with SHA-256
`8589d05ab474f99f3ebd16102d048c5e2cadea2b25deea3f2c4485a86b8778b8`,
and executed against exact product/tree
`6feda9fd71c7cb4701af63ab54264009ce5f6afb` /
`7095698b45352f760e79d17e2d9e2bffcfdd7765`. It reproduced:

```text
head.failed_at         = 1277001
follower.completed_at  = 1277001
```

The independent predicate
`dead_letter.failed_at < follower.completed_at` exited 1 with:

```text
strict-order control rejected equality: 1277001 !< 1277001
```

The successor harness was extracted unchanged from `52c11aa5`, with SHA-256
`1e0068a9f3d87b47250883d8e37847f549b3a6eebf533323e00946e066d0d8cc`,
and executed against the same product/tree. The identical predicate passed:

```text
head.received_at       = 10000
follower.received_at   = 10001
head.failed_at         = 1277001
follower.completed_at  = 1277002
```

This is the deterministic rejected-SHA negative control and successor-SHA
positive control. Reverting to the rejected harness deterministically restores
the equality failure.

## Row authority

The owning composition boundary is:

```text
createDiscordMessageHandler
  -> createDiscordIngressMonitor
  -> createChannelIngressDrain
  -> createDiscordMessageDispatcher debounce
  -> fanInChannelIngressLifecycles
  -> reply-lane terminal lifecycle
```

The harness injects only the external `MESSAGE_CREATE` payload and clock. The
production monitor owns durable admission, the shared drain owns lane exclusion
and retry disposition, the Discord dispatcher owns debounce, and the Plugin SDK
owns lifecycle fan-in.

| Row / case | Required authority | Committed and independent result |
|---|---|---|
| A: admission | Poison head precedes same-lane follower | canonical `received_at`: `10000 < 10001` |
| A: payload | Admitted payload retained at terminal failure | admitted and dead-letter raw-message SHA-256 equal; `payload_retained=1` |
| A: retries | Monotonic attempts reach configured ceiling 8 | observations `1,2,3,4,5,6,7`, then terminal observation 8 with retained count 7 (terminal `fail()` does not increment) |
| A: terminal | Exactly one terminal dead letter | one failed head, `retry-limit-exceeded`, `turn-abandoned`, no claim owner |
| A: release | Follower strictly follows head failure | `1277001 < 1277002`; follower is `completed` with no claim owner |
| A: reopen | Terminal facts persist and head does not replay | canonical ingress/session rows equal before/after; replay list empty |
| B: mixed fan-in | Current plus legacy-fallback cancellation is budget-free | one two-line Discord preflight; both durable rows pending with attempts 0, no last error, no dead letter |
| B: explicit | Explicit current cancellation is budget-free | durable row pending with attempts 0, no last error, no dead letter |
| B: genuine sibling | Genuine abandonment still reaches the ceiling | same-process row A reaches terminal observation 8 and one `retry-limit-exceeded` dead letter |
| Alternate failure path | Ordinary thrown dispatch failure remains bounded | focused sibling test reaches the same ceiling with its distinct error |
| Unrelated lane | Poisoned lane does not block another lane | focused sibling test drains the unrelated lane while the poison head retries |
| Partial/setup failures | Harness failures remain fail-closed and diagnosable | four historical signed FAILs preserved with their exact harness bytes |

## Canonical reopen authority

Both committed evidence and the independent successor run have identical
canonical ingress and session projections across close/reopen, with an empty
replay list. Their raw SQLite hashes change:

| Run | Before | After | Canonical rows |
|---|---|---|---|
| committed | `69018e164124b8fdd1a66f318dc12150902b23aef8db5aa28a18aceca1b5c21f` | `0975646fd9d2e4cfc1ead7de50e57837145a884f378493660b77b8c9841f115d` | equal |
| independent | `d7a6c7deab6a8757e79506931f37bff412e0d4ad88bf7c394630c11bff2320ef` | `46796ec68d1ff0db37cccb5c6e1ad1384d0ab368a575091ccfcc756322e0434b` | equal |

SQLite reopen/checkpoint byte drift is therefore diagnostic, not semantic.
Canonical `channel_ingress_events` and `session_nodes` projections own the
reopen claim.

## Signed artifacts and diagnostic preservation

`verify.mjs` validates stable-serialized Ed25519 payload bytes for all three
PASS envelopes:

1. `run-summary.json`
2. `A-GENUINE-ABANDONMENT-CEILING/receipt.json`
3. `B-MIXED-FANIN-CANCELLATION/receipt.json`

It also validates the four FAIL envelopes against their separate public keys.
Each diagnostic's recorded harness hash equals the harness bytes at its
recorded docs commit:

| Diagnostic | Docs commit | Harness SHA-256 | Preserved failure |
|---|---|---|---|
| session store scope | `57148b0413dbae8295f00218b75fbe1e08e3f823` | `6a70b36d253412d7b670b51da19c8d37f562c035cbe2d7d7e3f38b3881130cd8` | default-state legacy registry consulted |
| timing helper | `6770dabdc871a63ee9a6d1850ac0ddfdf2d10726` | `8c6a6783136cfc3d4a1c5040ed429196e7365c01237d7b0ebe19c1199e3535bc` | `originalNow` initialization order |
| projection helper | `cd26162deb658daab664083ce2f2a893991f14eb` | `4267f565df004b8a844e2ecaa1ee1766be8e854b26579c3077c66bd815e494d9` | projection helper initialization order |
| SQLite reopen bytes | `2717224429a271c6b7e80c2857f5bec259e6c090` | `d87f6c4291ed82012c06104b9fcd914f265c6f21b6ae257e6b08a6f653dfaae7` | whole-file equality rejected stable rows |

`SHA256SUMS` validates all 33 files it enumerates, and the verifier confirms
that these plus `SHA256SUMS` are the complete 34-file corpus. The signatures
authenticate unchanged run payloads; the ephemeral keys do not identify a
human signer.

## Cleanup and non-interference

The committed cleanup receipt reports zero
`/tmp/openclaw-pr124337-discord-*` paths, a clean product worktree, no fleet or
prince mutation, and no listener. After independently running both rejected and
successor harnesses:

- the exact product worktree still had zero status entries;
- an independent `/tmp` scan found zero matching state roots;
- each row's `finally` cleanup had removed its isolated state root;
- no network client or listener was created: the harness passed an inert local
  client into the production gateway-message handler;
- `transposed_rows` remained empty, so no earlier component receipt was
  relabeled as exact product evidence.

## Focused owner proof

All focused commands used the repository runner at exact product
`6feda9fd71c7cb4701af63ab54264009ce5f6afb`, one worker:

```bash
node scripts/run-vitest.mjs run \
  --config test/vitest/vitest.channels.config.ts --maxWorkers=1 \
  src/channels/message/ingress-drain.abandonment-retry-budget.test.ts \
  src/channels/message/ingress-drain.cancellation.test.ts

node scripts/run-vitest.mjs run \
  --config test/vitest/vitest.plugin-sdk.config.ts --maxWorkers=1 \
  src/plugin-sdk/channel-ingress-runtime.test.ts

node scripts/run-vitest.mjs run \
  --config test/vitest/vitest.extension-discord.config.ts --maxWorkers=1 \
  extensions/discord/src/monitor/message-handler.queue.test.ts
```

Results: channels 7/7, Plugin SDK 8/8, Discord 23/23.

## Mode-B run 33318993673

Broad acceptance remains **red**. The live aggregate downloaded from Actions
is byte-identical to the committed copies:

| Artifact | SHA-256 | Live vs committed |
|---|---|---|
| summary Markdown | `87389c187339ad86da59d4ccd878e105c5e9931c8196395f4ebec516391d7de8` | equal |
| summary JSON | `6c1c110412b16958c8b47f5ffbd95a51e65ddb063038aa7d2108faf8272dcec4` | equal |

| Receipt fact | Value |
|---|---|
| Product input | `6feda9fd71c7cb4701af63ab54264009ce5f6afb` |
| Workflow ref | `codeagent/124337-feac2430-routing-independent-review-20260829` |
| Workflow `headSha` | `d05778e6a96dd9a96946eff483e80c4d9ff9575e` |
| Run conclusion | completed / failure |
| Routing | 167/167 shards; 69/69 routed-job receipts valid |
| Test tally | 179,809 passed; 25 failed; five load flakes greened |
| Deterministic failures | 20 |
| Failed lane guards | hosted, self-hosted, and self-hosted-dist |

Failure groups remain:

| Shard | Deterministic failures | Candidate-delta path intersection |
|---|---:|---|
| `core-runtime-tui-pty` | 4 | none |
| `agentic-plugins` | 1 | none |
| `agentic-gateway-core-runtime` | 2 | none |
| `core-tooling-5` | 6 | none |
| `core-tooling-7` | 5 | none |
| `agentic-gateway-methods` | 1 | none |
| `extension-telegram` | 1 | none |

Fourteen signatures recur in earlier run `33286077327` against the same product.
The six newly observed signatures are one TUI sanitization case and five
`install.sh` cases. All nine failed test-file blobs, plus `scripts/install.sh`,
are byte-identical between candidate `6feda9fd` and pinned absorbed upstream
`43a7cb3c92c7b5b8d5ddd56d9d157c009e0c85e5`. None is one of the candidate's
12 changed paths. The candidate-owning Mode-B shards are green:

| Shard | Passed | Failed |
|---|---:|---:|
| `channels` | 1,252 | 0 |
| `agentic-plugin-sdk` | 961 | 0 |
| `extension-discord` | 3,034 | 0 |

No candidate-delta-owned deterministic signature is identified by the exact
path, blob, recurrence, and owner-shard evidence. This classification does not
launder the run: no exact pinned-upstream baseline execution was supplied, so
causal upstream attribution remains limited and every failure continues to red
the broad gate.

## Residual limits

- The proof invokes the production Discord handler process-locally; it does not
  prove a live Discord socket, fleet deployment, or prince runtime.
- Mode-B is red with 20 deterministic failures. This review confirms exact rows
  only and uses the `focused-only` acceptance path.
- The original signed run used Node `v25.9.0` on arm64. The independent rerun
  used Node `v26.7.0` on x64 from a fresh exact product checkout.
- The prior exact product worktree had already been removed. The replacement
  linked checkout used same-host x64 dependencies whose tracked lock object
  equals the target and whose dependency-bearing manifest fields are
  identical; installed metadata records pnpm 12.0.0. Pinned pnpm 12 could not
  be reacquired because the configured registry time gate returned `ETARGET`,
  and an inherited selector pointed into a stale Actions-runner cache. No
  project install ran in the linked worktree.
- The active dispatch worktree is not literally untracked-clean because of
  dispatcher-owned files and this report. An independent detached exact proof
  checkout was fully clean, and both docs and product tracked bytes remained
  unchanged during evidence collection.
- Ephemeral Ed25519 keys authenticate receipt bytes, not author identity.
