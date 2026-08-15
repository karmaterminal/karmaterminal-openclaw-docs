# k6 continuation scenario library consolidation

Issue binding: openclaw/openclaw#85651
Base (exact repaired harness head): `87f6e14354544a0b29cb35d12ae9aabc7e9032cf`
Branch: `codeagent/k6-scenario-library-consolidation`
Head: branch tip (a recorded self-SHA churns on every amend; the exact head is
in the COMPLETE report and in `git log`)
Files changed: 53
No PR opened. No live proof run fired. No product source, prince runtime,
configuration, database, or continuation ref touched.

---

## Result

The seven PARTIAL rows were not seven problems. Their run artifacts differ in
prose but cluster into two shared mechanisms, and both of those mechanisms had
already drifted into per-caller copies. The lane's work was to make each
mechanism have exactly one implementation, and to make the absence of evidence a
first-class named outcome instead of an empty file.

One finding reframes the workorder's premise, and it is the first thing a
reviewer should check: **the 99ce PARTIAL artifacts are largely pre-repair
evidence.** That corpus ran on docs harness ref `7ab52592`, which predates two
fixes already present at `87f6e143`.

| Fix | Present at 99ce harness ref `7ab52592`? |
| --- | --- |
| `21b24fa4` — trace-collection budget 60s → 180s | No |
| `a26ca671` — 31-hex Tempo search trace-id normalization | No |

So the two error strings in the 99ce artifacts —
`invalid search trace id: 7abdc3584196ef745cb4d8c85897a88` and
`Tempo trace did not reach valid continuation topology before timeout` — are not
open defects at this base. Re-fixing them here would have been re-fixing
history. What *was* still open is that neither repair had been carried across
the callers that share the contract, and that is what this lane closed.

---

## Inventory

35 checked-in scenarios, 24 shared library modules (19 at base, 5 added here), 30 post-run scripts.

### Live scenarios by class

| Class | Scenarios |
| --- | --- |
| WebSocket proof rows (dispatch a turn) | `r-cd-1-typed-delegate`, `r-cd-2-silent-wake`, `r-cd-3-post-compaction`, `r-cd-4-target-session-key`, `r-cd-chained-depth-2`, `r-cd-model-chained-alt`, `r-cd-model-default`, `r-cd-model-token`, `r-cd-model-tool`, `r-cd-silent`, `r-cd-token-bracket-delegate`, `r-cw-1-tool-schedule-wake`, `r-cw-2-immediate-wake`, `r-cw-3-reason-telemetry`, `r-cw-4-chain-depth`, `r-cw-delegate-self-continuation`, `r-cw-token-bracket`, `r-obs-1`, `r-rc-1-threshold-reject`, `r-rc-2-delegate-request-compaction` |
| WebSocket read-only inventory | `preflight`, `r-config-defaults`, `r-config-intersession` |
| Static / fixture-entry (no WS) | `r-cd-collection-on-collapse`, `r-cd-return-overlap`, `r-cw-5-cost-cap-reject`, `r-cw-6-max-chain-length`, `r-obs-2`, `r-obs-status`, `r-rc-2`, `r-regression-trap-tests`, `r-trace-redaction-1121`, `static-corpus-row-validator` |
| Legacy HTTP | `r-cw`, `r-cw-1` |

### Shared modules, by runtime

| k6-safe (`lib/*.js` + k6-safe `.mjs` observers) | Node-only post-run |
| --- | --- |
| `gateway-ws.js`, `manifest-loader.js`, `socket-close.js`, `gateway-lifecycle.js`, `r-cd-2-terminal-sentinel.js`, `r-cd-token-contract.js`, `request-compaction-receipt.js`, `source-function-extractor.js`, `row-child-correlation.mjs`, `r-cd-4-authority.mjs`, `r-cd-chained-depth-2-authority.mjs`, `r-cd-model-tool-authority.mjs`, **`proof-session.js` (new)** | `targeted-return-receipt.mjs`, `r-cd-2-authoritative-receipt.mjs`, `r-cd-token-authoritative-receipt.mjs`, `r-cd-4-return-authority.mjs`, `r-cd-chained-depth-2-return-authority.mjs`, `public-tempo-trace.mjs`, `repo-root.mjs`, **`receipt-seal.mjs` (new)**, **`tempo-trace-id.mjs` (new)**, **`tempo-span-match.mjs` (new)**, **`observability-outcome.mjs` (new)** |

The split was previously carried only by file extension and reviewer memory —
and the extension convention is already violated in the correct direction (four
`.mjs` modules are legitimately k6-safe structural observers). The authority is
the import-closure guard, not the suffix; the README now says so.

---

## Pattern matrix

Concern by concern, what existed before and what it is now. "Divergent" means
two live implementations of one contract that could disagree on the same input.

| Concern | Before | Now |
| --- | --- | --- |
| Deterministic nonce + public-safe hashing | `nonce()` in `gateway-ws.js`, plus private variants in `r-cd-silent` and legacy `r-cw-1`; `fingerprintIdentity` / `fingerprint` / inline `sha256().slice(0,16)` in three receipt modules | Fingerprint/digest primitives unified in `receipt-seal.mjs`. Nonce generation left row-owned (see severable follow-ups) |
| Disposable session creation | 22 inline `` `<prefix>-${nonce}`.toLowerCase().replace(/[^a-z0-9-]/g,'-') `` derivations across 19 scenarios, in three syntactic forms | One `disposableSessionKey` / `normalizedProofName` in `proof-session.js`; a contract test fails any reintroduction |
| Session-key / `targetSessionKey` binding | Row-owned (R-CD-4 parent/target, chained-depth root/child/grandchild) | Unchanged — genuinely row-specific semantics |
| Tool dispatch and response-driven acceptance | Response-driven for `sessions.create` / `sessions.send`; **not** for `connect`, because `connectFrame()` discarded the request id | `connectRequest()` + `RequestTracker.register()` + `GatewayHandshake` make the ack trackable and the start response-driven |
| Child/session discovery without fixed sleeps | `row-child-correlation.mjs` shared; hard-coded `tasks.list` ladders per row (5/15/30/60s, 8/25/50s, 8/20/40/60/90/120s) | Ladders left in place — they are observation windows, not stand-ins for an available response. Named as a severable follow-up |
| Lifecycle/history polling with bounded deadlines | R-CD-4 re-arms on response; others use fixed ladders + a close timer | Unchanged this lane |
| Exact child completion / targeted-return authority | Shared `resolveTargetedReturnAuthority`; two thin row wrappers | Unchanged semantics; journal availability now distinguished from non-delivery |
| Parent-vs-target negative assertions | Shared in `targeted-return-receipt.mjs` (`parentMatchCount`, `allowIntermediateAncestorTargets`) | Unchanged |
| Chained/depth topology construction | `r-cd-chained-depth-2-authority.mjs` (k6-safe) + return authority (Node) | Unchanged; forwards journal availability |
| Model metadata discovery | `r-cd-model-tool-authority.mjs` `spawnedBy` set-diff; three other model rows read `sessions.list` inline | Unchanged. **Its five negative controls never actually ran** — fixed (below) |
| Context-pressure / honest-limit measurement | R-RC-2 only, with a dedicated `HONEST-LIMIT-candidate` outcome enumerated in four scripts | Unchanged |
| Gateway journal collection | `journalctl` in `run-proofs.sh`; `GATEWAY_JOURNAL_STATUS` gates a `gateway-journal` pending receipt | Status now also reaches the targeted-return authority, so an unread journal cannot read as a product non-delivery |
| Tempo/Loki correlation when the WS API has no trace id | TraceQL reason-hash search in `collect-continuation-trace.mjs`. **Divergent trace-id validators**: the collector normalized 31-hex, `fetch-tempo-trace.mjs` accepted any 8..64 hex and would fetch the truncated id verbatim | One `tempo-trace-id.mjs`; both callers resolve there |
| Originating-tool-span identity | **Divergent inside one file**: `validateTrace` matched only `gen_ai.tool.name`; `validateToolTrace` matched `gen_ai.tool.name \|\| openclaw.toolName` | One `tempo-span-match.mjs`; ambiguous multi-name spans fail closed |
| Service-log redaction | `redactEvent` allowlist + `sanitize-k6-artifacts.mjs`; 18 identical inline record blocks, 4 with row-specific redactors | `recordClassifiedEvent` with `options.redactData`; the four row-specific redactions preserved verbatim |
| Cleanup and transcript archival | No scenario deletes its disposable sessions; child cleanup is delegated to `sessions_spawn cleanup="delete"` | Unchanged — named as a severable follow-up |
| Run-result / verdict reconciliation | `postprocess-k6-summary.mjs` → `run-result.json` → `validate-candidate-run-result.mjs` → candidate envelope with an exact-key contract | `run-result.json` gains `observability.observabilityOutcome` + `observabilityOutcomeStatus`; the envelope's exact-key contract is untouched |
| Node-only postprocessing vs k6-safe runtime | Import-closure guard for `node:` imports only | Guard extended to `require()`, computed `import()`, and Node-only globals |
| **Receipt construction/validation** | Three private copies of hex-shape / fingerprint / digest / canonical / seal / HMAC-verify. Only one rejected a missing signing key | `receipt-seal.mjs` owns the primitives; each row still owns its canonical field list |
| **Observability outcome** | On failure: an empty `continuation-trace-collector.json` and a one-line prose error log. Nothing machine-readable | `continuation-trace-observability.json` on every exit, with an explicit status and public-safe rebind keys |

---

## What changed, and why each change is load-bearing

### 1. One Tempo identifier contract — `lib/tempo-trace-id.mjs`

`a26ca671` taught the row collector to left-pad a 31-hex Tempo search id.
`fetch-tempo-trace.mjs` kept `/^[A-Fa-f0-9]{8,64}$/` and would have issued
`GET /api/traces/7abdc3584196ef745cb4d8c85897a88` — the exact truncated form —
as if it were a real trace. Its `--traceql` path reads from the same Tempo
search response that produced the original defect. Both callers now resolve
here. The fetcher keeps its 8..64 width for hand and fixture use, but recovers
the 31-hex form and fails closed on the all-zero OTel invalid-trace sentinel,
which previously produced a confident "fetched: true" receipt over nothing.

### 2. One originating-tool-span identity — `lib/tempo-span-match.mjs`

`collect-continuation-trace.mjs` answered the same question two ways, forty
lines apart. The continuation path — the one used by R-CD-2, R-CD-4,
R-CD-CHAINED-DEPTH-2, R-CW-1, R-CW-3 and R-RC-2 — required `gen_ai.tool.name`.
The generic tool path accepted `gen_ai.tool.name` **or** `openclaw.toolName`.
Published corpora (`PROOFS/077b261d…`, twenty trace files) carry **both** keys
on the same `openclaw.tool.execution` span, so the narrower copy could report
`matched trace lacks the originating <tool> tool span` for a trace the wider
copy in the same file accepted. That is exactly the error text five PARTIAL rows
recorded. One matcher now serves both, and a span declaring two *different* tool
names is no longer treated as an unambiguous origin — an ambiguous span must
never satisfy an exactly-one gate.

### 3. One receipt seal — `lib/receipt-seal.mjs`

R-CD-2, R-CD-TOKEN and the targeted-return authority each carried private copies
of five primitives. The copies had drifted in a way that mattered: only the
targeted-return validator rejected a missing signing key, so
`validateRcd2AuthoritativeReceipt(receipt)` with no key threw a raw `TypeError`
out of the resolver instead of returning a reason. The primitives are shared
now; **each row keeps its own canonical field list**, so one row's signature
still cannot certify another — asserted directly by a cross-row swap test.
Signatures and verdict semantics are unchanged.

### 4. Explicit observability — `lib/observability-outcome.mjs`

This is the change with the widest effect on the PARTIAL rows, and it is not a
repair of a trace failure. It is a repair of what a trace failure *records*.

Before: a failed correlation left an empty `continuation-trace-collector.json`
and one line of prose. Every row that lost its trace therefore looked identical
in the manifest — the same two `pendingReceipts`, `review-pending`, forever —
whether Tempo was down, the window held nothing, two traces matched, or a
matched trace failed a topology gate. Re-binding a row later required firing the
product again.

Now the collector writes `continuation-trace-observability.json` on **every**
exit:

| status | asserts |
| --- | --- |
| `correlated` | a trace was found and passed every topology gate |
| `backend-unavailable` | Nothing prevented an answer from being *unavailable*: transport failure, 5xx, 429, 401/403, or a 404 from the search route (an empty search answers 200, so a 404 there means the route is missing) |
| `no-matching-trace` | The backend answered and had nothing: an empty search result, or a 404 for the trace body — a claim about the run |
| `ambiguous-trace` | more than one candidate; never first-wins |
| `topology-invalid` | a trace matched and failed a gate |
| `contract-invalid` | manifest/evidence could not produce a query at all |

Only `correlated` may carry `traceId` / `traceJson` / `correlationReceipt`;
`buildObservabilityOutcome` throws rather than construct any other combination,
and `validateObservabilityOutcome` rejects a hand-forged success shape. Every
unresolved status carries `rebind` — service name, TraceQL query, search window,
reason hash and length, and public-safe nonce/session fingerprints — so the row
can be re-resolved when the backend returns **without refiring the product**.
Raw nonces, session keys and traceparent material are rejected outright.

The log side got the same treatment, inverted. `resolveTargetedReturnAuthority`
previously reported `no-delivery` whenever the journal held no matching
`[continuation:targeted-return]` line — *including when no journal had been
read*. "The journal was captured and contains no delivery" is a claim about the
product; "no journal was read" is a claim about the evidence. R-CD-4 and
R-CD-CHAINED-DEPTH-2 now receive the runner's own `GATEWAY_JOURNAL_STATUS` and
report `journal-unavailable` for the gap. `failureCategory` is already inside
the HMAC-closed canonical form, so the distinction is sealed; no receipt field
or signature shape changed.

### 5. The connect race — `lib/proof-session.js`

`connectFrame()` returned only the frame string, discarding the request id. That
was not a style choice: it made a response-driven handshake impossible, so all
twenty WS proof rows guessed with `socket.setTimeout(startProofFlow, 500)` or
`setTimeout(createSession, 250)` that authentication had completed, then issued
`sessions.create` / `sessions.send` into the dark.

`connectRequest()` keeps the id, `RequestTracker.register()` accepts a
caller-sent request, and `GatewayHandshake` releases a row the moment the
gateway acknowledges. The old delay survives only as the fallback, so worst-case
timing is exactly what it was — and the path taken (`connect-ack`,
`connect-rejected`, `deadline-fallback`) is recorded rather than absorbed into
an unexplained downstream failure. A rejected connect still releases the row,
because suppressing the start would turn a visible auth rejection into a silent
timeout.

Read-only inventory rows (PREFLIGHT, R-CONFIG-DEFAULTS, R-CONFIG-INTERSESSION)
are deliberately excluded: their open handler is an ordered probe sequence, not
a handshake guard, and converting them would reorder their probes for no gain.
The contract test names them rather than leaving them silently inconsistent.

### 6. The import-closure guard

Passing the import scan was never sufficient to prove a graph is k6-safe. A
CommonJS `require`, a computed `import(expr)` whose closure cannot be verified
ahead of the run, and Node-only globals (`process`, `Buffer`, `__dirname`,
`__filename`, `module`, `exports`, `globalThis.<node-global>`) each abort a VU
exactly like a `node:` import — exit 107, before a single frame is sent. All
three are now rejected. Literal contents and comments are blanked before the
identifier and call scans, with delimiters preserved, so prompts and prose
cannot trip the guard while a literal `import('node:os')` is still classified as
the builtin import it is; member access and object keys are excluded.

### 7. A validation hole that was not in the workorder

`tests/r-cd-model-tool-authority.test.mjs` nested six subtests inside a
**synchronous** parent callback. Node's test runner cancels subtests when the
parent returns, so five of them — every sticky-evidence and ambiguity negative
control for R-CD-MODEL-TOOL, one of the seven target PARTIAL rows — had never
executed on any run since they were written. They ran as `cancelled`, which does
not fail a suite.

This is a false PASS in the validation layer itself, and it sits directly under
this lane: the consolidation's whole claim is that shared helpers preserve row
semantics, which is unprovable if the row's negative controls do not run. Made
the parent `async` and awaited the subtests. All six now execute and pass.

---

## Effect on each PARTIAL row

No row is claimed repaired. What changed is which failures remain possible, and
what a failure will now tell a reviewer.

| Row | Effect of this lane | Still owed |
| --- | --- | --- |
| **R-CD-4** | Its 99ce `invalid search trace id` was already fixed at base. This lane closes the unconsolidated half: `fetch-tempo-trace.mjs` can no longer fetch that truncated id. Journal absence now reports `journal-unavailable` instead of `no-delivery`, so an uncaptured journal can no longer read as proven non-routing. Starts on the connect ack. | A live run. Its return authority still needs one in-window delivery, exact child binding, zero parent deliveries |
| **R-CD-CHAINED-DEPTH-2** | Same journal-availability and handshake benefits; the return authority forwards availability through the tree-fanout path. | Live run behind the disposable-ancestry preflight; two stable `spawnedBy` observations, distinct hop identities, cleanup, Tempo receipt |
| **R-CD-2** | `validateRcd2AuthoritativeReceipt` no longer throws on a missing key — it fails closed with `missing-signing-key`. Its `matched trace lacks the originating continue_delegate tool span` class is now covered by the unified matcher when the runtime emits `openclaw.toolName`. A future correlation failure records its own classification. | Its signed row-scoped authority still needs reconciling against a manual control on the accepted send lifecycle |
| **R-CD-MODEL-TOOL** | **Five negative controls now actually execute** (all pass). No Node-import leak; no other shared defect found. | Row-specific: manual requested-model byte vs `spawnedBy` set-diff child model byte vs parent return byte; the known explicit-model runtime mismatch |
| **R-CD-TOKEN** | Its ten pending receipts are row-contract, not shared-library. It gains the seal consolidation, the handshake, and an explicit observability outcome for the two of the ten that are trace receipts. | The other eight receipts are row-specific and out of scope for library work |
| **R-CW-3** | Its `matched trace lacks the originating continue_work tool span` is the unified-matcher class. Keeps its own `safeData` redaction through `options.redactData` — that difference is load-bearing and was not flattened. | The row is intentionally PARTIAL pending review: a public-safe Tempo trace with exact trace/chain correlation showing safe reason attributes and no raw sentinel |
| **R-RC-2** | Same matcher and observability benefits; `HONEST-LIMIT-candidate` handling untouched. | Nonce-bound child tool result rather than assistant text; below-threshold rejection stays the only HONEST-LIMIT path |

Rows outside the seven that also benefit: **R-CW-1** (same two pending trace
receipts, same matcher class) and the three exit-107 `static-proof-substrate-failure`
rows (R-CD-RETURN-OVERLAP, R-OBS-2, R-REGRESSION-TRAP-TESTS), whose class the
extended guard now covers more completely.

---

## Severable follow-ups

Named rather than bundled, per the workorder.

| # | Follow-up | Why not here |
| --- | --- | --- |
| 1 | Replace the hard-coded `tasks.list` ladders (5/15/30/60s, 8/25/50s, 8/20/40/60/90/120s) with a shared deadline-bounded poller | These are observation windows, not stand-ins for an available response. Changing them changes each row's evidence window and needs live validation this lane may not fire |
| 2 | Disposable-session cleanup | **No scenario deletes the sessions it creates.** Child cleanup relies on `sessions_spawn cleanup="delete"`; disposable parent/target sessions are left behind. Needs a policy decision (delete vs retain for post-run reads) before code |
| 3 | Deterministic nonce | `nonce()` is `Date.now()` + `Math.random()`. Two rows roll their own. A seeded, run-id-derived nonce would make a re-run re-bindable, but it changes every row's identity surface |
| 4 | Handshake for the read-only inventory rows | PREFLIGHT gates every run; converting its ordered probe sequence is a separate, independently reviewable change |
| 5 | Re-resolution driver consuming `rebind` keys | The keys are now emitted; a `resolve-pending-observability.mjs` that re-attempts correlation from them is the natural next step and is severable |
| 6 | Model-row consolidation | `r-cd-model-{default,token,chained-alt}` read `sessions.list` inline rather than through `r-cd-model-tool-authority.mjs`. Their assertions differ enough that unifying them needs row-owner review |

---

## Validation

| Validation | Result |
| --- | --- |
| Full sanctioned docs harness suite | **452 passed, 1 failed, 0 cancelled** (453 tests) |
| Baseline classification of the single red | `candidate envelope is outside and invisible to canonical corpus validation` — the documented pre-existing failure; reproduces at base `87f6e143` and on fork base `f7e307d7`. Not owned by this lane |
| Test-count delta | 382 → 453 (+71): 15 proof-session, 12 observability-outcome, 6 collector observability e2e, 8 receipt-seal, 6 tempo-span-match, 7 scenario-handshake contract, 15 import-guard negatives, 2 journal-availability, plus 5 R-CD-MODEL-TOOL controls that previously never ran |
| Cancelled tests | 0 (was 5 at base when the model-tool file runs standalone) |
| All-scenario import-closure scan | 35 scenarios, 35 graphs, **0 violations** |
| k6 v2.0.0 `inspect` | All 35 scenarios load and initialize; 0 failures |
| Dry-run selection, six topology classes | R-CD-4 (targeted return), R-CD-CHAINED-DEPTH-2 (chained depth), R-CD-MODEL-TOOL (model metadata), R-CD-TOKEN (token form), R-CW-3 (reason telemetry), R-RC-2 (compaction limit) — all selected, catalog preflight green, `liveRunSafety: k6-runnable`, **zero rows dispatched** |
| Receipt refactor equivalence | `canonical()` byte-identical to base for all three modules; signatures identical for R-CD-2 PASS/PARTIAL, R-CD-TOKEN and targeted-return; receipts cross-validate in both directions (base receipt against new validator, new receipt against base validator) |
| Scenario codemod scope check | Every transformed `onReady` body resolves all referenced identifiers in-file; all targets are hoisted function declarations |
| Live proof runs | **None fired**, per the workorder |

### Exact commands

```bash
# Full sanctioned docs harness suite
node --test tools/k6-proofs/scripts/__tests__/*.test.mjs tools/k6-proofs/tests/*.test.mjs

# All-scenario k6 import closure
node tools/k6-proofs/scripts/check-k6-scenario-import-closure.mjs --repo-root "$PWD"

# k6 module-graph initialization for every scenario
for f in tools/k6-proofs/scenarios/*.js; do k6 inspect "$f" >/dev/null || echo "FAIL $f"; done

# Focused contract + negative suites for the new shared helpers
node --test \
  tools/k6-proofs/tests/proof-session.test.mjs \
  tools/k6-proofs/tests/targeted-return-receipt.test.mjs \
  tools/k6-proofs/tests/r-cd-model-tool-authority.test.mjs \
  tools/k6-proofs/scripts/__tests__/receipt-seal.test.mjs \
  tools/k6-proofs/scripts/__tests__/tempo-span-match.test.mjs \
  tools/k6-proofs/scripts/__tests__/observability-outcome.test.mjs \
  tools/k6-proofs/scripts/__tests__/collector-observability-outcome.test.mjs \
  tools/k6-proofs/scripts/__tests__/scenario-handshake-contract.test.mjs \
  tools/k6-proofs/scripts/__tests__/check-k6-scenario-import-closure.test.mjs

# Dry-run selection across the six representative topology classes
cd tools/k6-proofs && OPENCLAW_CANDIDATE_SHA=<40-hex> OPENCLAW_SEAT_NAME=<seat> \
  ./scripts/run-proofs.sh --dry-run --out-dir /tmp/k6-dryrun \
  R-CD-4,R-CD-CHAINED-DEPTH-2,R-CD-MODEL-TOOL,R-CD-TOKEN,R-CW-3,R-RC-2
```

---

## Recommended fold strategy

Relative to docs PR #510 and repair `87f6e143`:

1. **Do not extend PR #510.** It establishes R-CD-4's signed target-return
   authority. This change is a successor with an independently reviewable
   purpose: give every duplicated mechanism exactly one implementation, and make
   missing observability explicit rather than empty.

2. **Land after `87f6e143`, as its completion.** `87f6e143` proved a class of
   defect (a Node import reachable from a scenario) and fixed the two instances
   it found. This lane generalizes that reasoning in three directions:
   the guard now covers the rest of the class (`require`, computed `import()`,
   Node globals); the repairs that shipped to one caller are carried to their
   siblings; and the artifact a failed row leaves behind became machine-readable.

3. **Reviewable in four commits, in order.** Each is independently revertible:
   - `37094db1` — trace identity, span match, receipt seal, observability outcome
   - `b585b763` — response-driven handshake, session mechanics, guard extension
   - `02d220f9` — journal availability, collector observability e2e tests
   - `52db18fe` — the authoring guide and doc pointers
   - `3b2265cf` / `ba70cffd` / `bcb7ac5a` / `7426ac5c` / `2a60ca95` — the guard,
     classifier, negative-control and error-provenance repairs found by
     self-probe and two rounds of independent review

4. **Highest-value review targets.** The tool-span matcher change
   (`lib/tempo-span-match.mjs`) alters which traces five continuation rows accept
   — it is the one change with direct verdict reach, and it widens acceptance, so
   it deserves the closest look. Second: confirm the `GatewayHandshake` fallback
   values are right for any seat where connect acknowledgement is slower than the
   500ms upper bound; behaviour there is identical to today, but the recorded
   `deadline-fallback` will make that visible for the first time.

5. **Before any re-fire.** The next live run of the seven PARTIAL rows will emit
   `continuation-trace-observability.json` per row. Read those first: they will
   say, per row, whether the remaining gap is infrastructure, evidence, or
   product — the distinction the 99ce artifacts could not express.

---

## Review pass

The change set was put through an independent read before finalizing. It
returned four Medium findings, **all of them defects in this lane's own work,
and all four failing in the permissive direction**. That is the useful shape of
the result: the consolidation's whole purpose is to stop evidence gaps from
rendering as success, and four of its new mechanisms did exactly that.

| Finding | Why it mattered | Fix |
| --- | --- | --- |
| The guard's regex-keyword branch never fired | `REGEX_KEYWORDS` was tested against the accumulated output with a `$` anchor, but the whitespace between keyword and slash had already been emitted. Every idiomatic `return /'/.test(s)` still reopened the blindness the previous commit was meant to close — and the bogus string usually closes cleanly on a later apostrophe, so the fail-closed net never fired either | The scanner tracks the last significant *token*, not just the last character |
| Ambiguity inverted on the negative control | `toolSpanMatchesName` rejecting a two-name span is right for "exactly one origin" and exactly wrong for R-CD-TOKEN's "no typed tool span": there `false` reads as *absent* and satisfies the assertion it exists to break | `toolSpanDeclaresName` backs the negative control; ambiguity now fails closed on both sides |
| A Tempo 404 was an availability excuse | Every non-2xx mapped to `backend-unavailable`, contradicting this module's own stated invariant that a reachable backend returning nothing is an evidence statement | 5xx/429 stay availability claims, 4xx becomes `no-matching-trace`; a 404 on the trace body is retried inside the deadline as the ordinary ingest-flush window rather than aborting the poll loop |
| The handshake receipt was documented but never recorded | Nothing outside the tests called `receipt()`, so a gateway that never acknowledges `connect` would emit evidence byte-identical to a healthy run — and all twenty rows could have silently degraded to the pre-change fixed sleep with no trace of it | The handshake publishes into `evidence.handshake`; the scenario contract test requires it |

A second review round then caught that **my own 404 fix was defeated on the only
path that mattered**: the collector re-wrapped its last failure in a bare
`new Error()` when the deadline expired, dropping `httpStatus`, `code` and
`cause`. Since moving `fetchTrace` inside the retry made that wrap the normal
route for the motivating case, a persistent 404 fell through to
`topology-invalid` — the most product-blaming outcome in the enum, asserting a
malformed trace for a trace never obtained. Worse than what it replaced. The
wrapper preserves `cause` now, and the retry guard, which had been keyed on
"has an HTTP status", no longer swallows transport failures.

Three further defects were caught by self-probing rather than by a test failing,
which is worth recording because in all three cases the tests were green:

- `stripLiterals` did not recognize regex literals at all, so `/'/g` — ordinary
  code — blanked the rest of the file and the guard certified it clean.
- It then blanked template `${…}` interpolations wholesale, so
  `${process.env.SEAT}` was invisible. Measured against the real closure that
  was 602 substitutions and ~8.7 KB of live code excluded from every scan.
- `classifyTraceFailure` treated any `TypeError` as transport failure, which
  would have let a bug inside the harness present itself as infrastructure.

**The pattern is the finding.** Eight defects in this lane's own new code, every
one failing in the permissive direction, and not one caught by a failing test —
they were found by reading the code against its own stated invariant and by
probing it with inputs it claimed to handle. A guard, a classifier, and a
receipt all shipped green while quietly certifying things they had not checked.
That is precisely the failure mode this consolidation exists to remove from the
proof corpus, reproduced inside the tooling built to remove it.

Confirmed clean by the review: all 20 codemod transforms, `k6 inspect` on all
35 scenarios, `canonical()` byte-identity across all three receipt modules with
strictly-stricter validators, the impossibility of the `journalAvailable` change
promoting a PARTIAL to a PASS, and that scoping `declaredTools` rather than
`matchingTools` is monotonically stricter and cannot loosen any
non-`raw-final-text` row.

### Known residuals in the guard's scanner

Recorded rather than hidden, because a guard's limits are part of its contract:

- A regex in statement position after `)` — `if (x) /'/.test(x)` — is read as
  division. `)` is deliberately not a regex preceder, because treating
  `(a + b) / c` as a regex would blank real code and trade one fail-open for
  another. The residual is **fail-closed, not silent**: quoted strings no longer
  run past a newline, so the stray quote cannot close and the guard reports
  `unscannable-source`. Pinned by test.
- `x.return / 2` — division after a property named with a keyword — is read as
  a regex, since the token stream does not distinguish a property name from a
  keyword. Not idiomatic, absent from the corpus, and caught by the same
  newline guard when it would otherwise matter.

## Uncertainties

- **The unified tool-span matcher widens acceptance.** Historical corpora prove
  the runtime emits both `gen_ai.tool.name` and `openclaw.toolName` on the same
  span, so the wider matcher is correct. But whether that alone converts the
  five affected rows to `correlated` cannot be established without a live run,
  which this lane does not fire. It removes one specific cause; it does not
  prove it was the only one.
- **`GatewayHandshake` is validated structurally, not live.** Twelve unit tests
  cover ack, rejection, fallback, single-fire and non-interference; `k6 inspect`
  proves every graph initializes; a contract test locks the wiring. What no
  local check can prove is that the gateway answers `connect` with a tracked
  `{type:'res', id}` frame. If it does not, every row takes the
  `deadline-fallback` path and behaves exactly as before — the change is
  fail-safe in that direction, and the receipt will say which path was taken.
- **Journal-availability inference.** When `--journal-status` is absent the
  helper infers availability from journal content. A captured-but-genuinely-empty
  journal would be misreported as `journal-unavailable`. `run-proofs.sh` always
  passes the explicit status, so this only affects direct manual invocation.
- **The `no-delivery` → `journal-unavailable` split changes signatures** for
  receipts sealed over an empty journal, because `failureCategory` is a closed
  field. That is intended: the two cases must not be interchangeable. Archived
  receipts are unaffected — nothing re-verifies them against current code.
