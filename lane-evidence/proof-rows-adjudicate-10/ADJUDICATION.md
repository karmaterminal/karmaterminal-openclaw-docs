# The 10 continuation-shaped PARTIAL rows of run 44245772142: product bug or harness/observer?

Lane `proof-rows-adjudicate-10`, 2026-11-20. Read-only: no product change, no live run, no dispatch.
Bound issue: openclaw/openclaw#129388.

## Verdict

**product 0 / harness 10 / infra 0 / new 0 / undecidable 0.**

None of the 10 rows shows an authoritative runtime contradiction on ab5a. In every row the
row-bound Tempo trace (correlated by the row's own reason hash, `resultClass: unique`) or R-CD-2's
signed topology shows the continuation doing what the row asks. All 10 go PARTIAL at a harness
reader, and one defect explains all 10:

- **H1. The harness never unwraps the Tool Search result envelope.**
  - On emeric's live gateway Tool Search is on. It is the default when `tools.toolSearch` is
    unset (openclaw ab5a `src/agents/tool-search-config.ts:11`), and only `message` stays direct
    (`src/agents/tool-surface-plan.ts:145-151`).
  - So `continue_work`, `continue_delegate`, `sessions_spawn` and `request_compaction` run through
    `dispatch_action`. Their result comes back as an envelope:
    - content text: `{"tool":{id,name,source},"result":<inner result without details>}`;
    - `details`: `{tool:<catalog entry>, result:<inner result>}`;
    - source: `src/agents/tool-search.ts:373-426` (envelope `:412`, details `:421`).
  - The inner `{"status":"scheduled",…}` is one level down. Four harness readers take the first
    JSON object they find and look for a top-level `status`:
    - `sentinel-binding.mjs:175` `toolResultPayload`, which feeds `continue-work-chain.mjs:56`,
      `createToolReceiptTracker` (`:231`) and `toolReceiptsFromHistory` (`:205`);
    - `cw-delegate-self-receipt.mjs:45`;
    - `r-cd-2-same-run-delegate.mjs:27`;
    - `request-compaction-receipt.js:76`, which reads `details` first and so gets the `callResult`.
  - Docs PR #617 (merged `d3d2094b`, 2026-10-31) taught the matchers to unwrap the **call**
    (`tool-call-identity.mjs:59`). No reader unwraps the **result**.
  - The 2026-10-30 harness review predicted this exact failure set: `REVIEW-harness-sentinel-echo.md`
    N1, "every positive receipt fail[s] closed when the call is recorded as `dispatch_action`…
    R-CD-1/3/SILENT…, R-CW-1..4…, R-CW-TOKEN".
  - Reproduced offline on the run's own harness bytes (docs `fe8e3c21`) and on docs main
    (`54d750e8`): 20 of 20 cases held on both (`repro/`). The dispatched shape reproduces each row's
    recorded failure string, and the direct shape passes the same gate.

Why this is the first time it shows: every last PASS of these rows was fired on 2026-10-29/30, at
docs `215235ed` / `860bd4ec`, on an isolated gateway (`openai/gpt-6-sol`).

- That harness predates #617. None of `continue-work-chain.mjs`, `sentinel-binding.mjs` or
  `tool-call-identity.mjs` exists at `215235ed`.
- That seat used direct tool names. R-RC-1's call id was `exec-<uuid>` and its status was read at
  the top level. N1 records R-CD-2's `typedDelegateSuccessSameRun: true` there.
- No `run-result.json` for these rows was committed on any fetched branch after 2026-10-30. The other two docs runs since
  then fired no row (44243905837, 44082334447 and 44082522523 all failed with no artifact). So run
  44245772142 is **the first live fire of the post-#617 predicates**, and the first on a Tool Search
  seat.

## Per-row table

The last PASS is the last same-row fire with a PASS-candidate verdict, or the latest manifest
`pass` where that differs. Every one is a fresh fire, not a transposition. Product diff axis:
openclaw `f15237ec` → `ab5a30ea` (ab5a descends from f152, +5,856 commits). Harness diff axis:
docs `215235ed` → `fe8e3c21`.

| row | last PASS | diff axes (product / harness) | class | evidence | owning-issue suggestion |
|---|---|---|---|---|---|
| R-CD-1 | f15237ec, run `20261030T012952Z-r-cd-1-44aa4c89`, docs 215235ed, emeric-isolated-composite, state pass (audit: unverified-echo-vulnerable) | product: same envelope bytes, different seat surface (Tool Search dispatch vs direct). Harness: #617 receipt tracker added | **harness (H1)** | only failing gate is `scheduled_receipt_observed` (→ `delegate_scheduled_sentinel`). `tool_invoke_accepted`, `child_return_bound` and `parent_return_event` are true. Trace unique: `continuation.delegate.dispatch` + `.fire` + tool span. Journal: `delegate-spawned hop=1`, `targeted-return Delivered` | docs: H1 |
| R-CD-2 | manifest pass at 6ee7eca2 (docs 246c447a, run 29573369445). Latest fire f15237ec `20261030T013026Z-r-cd-2-44aa4c89`: PASS-candidate held **partial** by 🌊's ruling (a) (HMAC keyed to the gateway token) | same as above; the f152 seat used direct names (N1) | **harness (H1 certain; immediate sub-cause open)** | Signed receipt: `failureCategory: delegate-not-spawned`. All 14 topology checks and all joins are true: `typedTool`, `exactlyOneToolSpan`, dispatch + fire, `silentWake`, `nonceBinding`, `sendRunBinding`. So a product non-spawn is refuted. The same-run tracker never bound the nonce-bound call on the send run. If it had, H1 would still make it `tool-result-not-scheduled` (`repro` case `sameRunDelegate/dispatched-args`). The k6 log and journal are withheld by design | docs: H1 + H2; H3 before any pure-line fire. Ruling (a) still caps the row at PARTIAL |
| R-CD-SILENT | manifest pass at 08c37a15, run `20261029T214550Z-r-cd-silent-7ec4c1cf`, docs 860bd4ec, pre-#617. The f15237ec PASS was **corrected to missing** on 2026-10-31 (confirmed echo) | as R-CD-1 | **harness (H1)** | only `scheduled_sentinel` false (`scheduled_receipt_observed` false, `scheduled_text_bound` true). Child completion, followup, parent internal context and no-channel-delivery are all true. Trace unique (delegate dispatch + fire). Journal: spawned + targeted return | docs: H1. No PASS exists under the current predicate |
| R-CW-1 | f15237ec refire `20261030T021254Z-r-cw-1-bca3fca7`, docs 215235ed, pass (audit: CW-WOKE at 5.69 s, likely wake-input echo) | same envelope bytes; harness moved from event text to the transcript chain (#617) | **harness (H1)** | `chain_reason: hop 1: the continue_work result is not "scheduled"`, the exact string the repro's dispatched case returns. Trace unique: `continuation.work` + `.fire`. Journal: parked hop 1, then `work-wake hop=1` 5.0 s later. Later gates were never evaluated | docs: H1 |
| R-CW-2 | f15237ec `20261030T014440Z-r-cw-2-44aa4c89`, docs 215235ed, pass | as R-CW-1 | **harness (H1)** | same chain reason; trace unique; journal parked hop 1 → wake hop 1 | docs: H1 |
| R-CW-3 | f15237ec `20261030T014534Z-r-cw-3-44aa4c89`: runner PARTIAL (manual receipt) → reviewed pass. Never a runner PASS, by design | as R-CW-1 | **harness (H1)** | same chain reason. The review join is `review-join-invalid` only because its `scheduledSentinel`/`wakeObserved` checks mirror the chain. The other 14 checks all passed, including every redaction and telemetry check (no raw reason in Tempo or public artifacts). Trace unique | docs: H1. The manual review receipt stays owed |
| R-CW-4 | f15237ec `20261030T014605Z-r-cw-4-44aa4c89`, docs 215235ed, pass | as R-CW-1 | **harness (H1)** | chain stops at hop 1. Trace: 3 `continue_work` tool spans and 3 `continuation.work`. Journal: wakes hop 1/2/3. The two `work-finish-not-committed` lines also appear in the last-PASS journal (f152, 2026-10-29): unchanged behaviour | docs: H1 |
| R-CW-DELEGATE-SELF-CONTINUATION | f15237ec `20261030T014645Z-…-44aa4c89`, docs 215235ed, pass | as R-CW-1 | **harness (H1)** | `child_hops.reason: continue_work result is not "scheduled"` (`cw-delegate-self-receipt.mjs:45` admits the `dispatch_action` name but parses the envelope). Child spawned and done. Journal: child `work-wake hop=2`. Trace unique. Parent return never read (0 reads, downstream) | docs: H1 |
| R-CW-TOKEN | manifest pass at 08c37a15, run `20261029T215228Z-r-cw-token-7ec4c1cf`, docs 860bd4ec. The f15237ec PASS was **corrected to missing** (confirmed echo) | as R-CD-1 (sessions_spawn) | **harness (H1)** | `spawn_receipt_status: null` from chat.history: the sessions_spawn envelope, so there is no `accepted` and no `childSessionKey`. The child is never subscribed and everything downstream goes unread. Journal: `bracket-parse: kind=work`, parked hop 1, wake hop 1 (the token form fired). Product observation O1 below | docs: H1. O1 and parent-return reachability are open post-fix risks |
| R-RC-1 | f15237ec `20261030T014819Z-r-rc-1-44aa4c89`, docs 215235ed, pass (audit: unverified-unmeasured-receipt) | product: **dd32c17eba** (2026-10-30, in ab5a and 9476c7aa, not in f152) made an unmeasured request answer `guard: context_unmeasured`. Harness: dispatcher-aware call binding | **harness (H1; H4 latent)** | `tool_result_status: invalid` is the scenario's fallback when `receipt.status` is missing. The k6 log prints the receipt: `{"tool":{"id":"openclaw:core:request_compaction","source":"openclaw","sourceName":"core","name":"request_compaction","label":"Compaction",…`. That is the dispatcher's `details` (`tool-search.ts:421`), not the tool's answer. The trace shows `request_compaction` executed in a 2-model-call turn | docs: H1 + H4 |

## The harness defects (karmaterminal/karmaterminal-openclaw-docs)

- **H1. The result envelope is never unwrapped.** Readers: the four listed above. The shared ones
  also decide R-CD-3's compaction and staging receipts (`r-cd-3-lifeboat.mjs`),
  R-CD-MODEL-TOKEN's spawn receipt and R-RC-2's receipt. So H1 reaches past these 10 rows on any
  Tool Search seat.
  - A fix must read the inner result from both forms:
    - content text `result.content[].text`, parsed as JSON;
    - `details.result.details`.
  - It must accept that only for a result row paired by `toolCallId` with a dispatched call of the
    named tool, and should check `tool.name`/`tool.id`.
  - Prior art: docs PR #589 (open since 2026-10-23). It reads `outer.result.details.status`, but ab5a
    strips `details` from the model-visible envelope (`tool-search.ts:402`, `:412`). It also matches
    only `tool_call`, while the raw dispatcher name at ab5a is `dispatch_action`
    (`core-tool-facts.ts:5`). It does not fix H1 as written.
- **H2. Call binding covers fewer argument shapes than the product accepts.**
  - `toolCallTarget` (`tool-call-identity.mjs:59-67`) reads only a record under `args`.
  - The dispatcher also accepts `input`, dotted `args.*` keys and flattened top-level arguments
    (`tool-search-request.ts:30-88`, `:91-105`).
  - A call in any of those shapes executes, but the harness sees no nonce-bound call
    (`repro` cases `toolCallTarget/shapes` and `sameRunDelegate/dispatched-*`).
  - This is one candidate for R-CD-2's unbound call. A run-stamp mismatch between the row's
    `__openclaw.runId` and the send run's id is the other.
  - **Deciding receipt:** the private R-CD-2 acquisition's send-run `session.message` rows. That
    means the nonce-bound toolCall part's `arguments` shape and its row run-stamp, compared with
    `acceptedRunId`.
- **H3. R-CD-2's prompt hard-codes Tool Search** ("Use tool_search… then call dispatch_action",
  `r-cd-2-silent-wake.js:261`).
  - At 9476c7aa `continue_delegate` is direct-only, and `dispatch_action` refuses it: "This tool is
    already available directly…" (`tool-search.ts:443-447`).
  - It caused nothing in this run. It is a pure-line hazard.
- **H4. R-RC-1 fires request_compaction in the first turn of a fresh session**
  (`r-rc-1-threshold-reject.js:109`).
  - At ab5a and 9476c7aa a session with no fresh totals returns `no_fresh_usage`
    (`agent-runner-post-compaction-release.ts:183-192`). The tool then answers
    `{status:"rejected", guard:"context_unmeasured"}` (`request-compaction-tool.ts:212-223`), which
    is a truthful answer.
  - The classifier accepts only `guard === "context_threshold"` (`request-compaction-receipt.js:93`).
  - H4 is latent behind H1: the inner guard is not in public artifacts. By the product bytes, a
    first-turn fire cannot reach a measured threshold rejection, so the row needs a primed prior turn.

## Product-side observations (not the cause of any PARTIAL; same bytes on the pure line)

- **O1 (R-CW-TOKEN).** `[tools] dispatch_action failed: Error: Followup has no retained original
  caller policy.` was logged at 22:22:37, inside the child's hop-1 wake window.
  - Source: `sessions-send-followup-custody.ts:76-81`. A `sessions_send` followup needs the original
    gateway caller in scope, and a token-form (system-event) wake carries none.
  - The rows don't show which session made the call: session keys are redacted, and the capture is
    unit-wide on a live gateway.
  - It looks fail-closed by design. It could still block the row's parent-return contract (hop-2
    output reaching the parent) once H1 is fixed.
  - R-CW-DELEGATE-SELF's own record says "the child delivers one return (its spawned run), before
    hop 2". R-CW-TOKEN's token-form parent return has never been proven: its f152 PASS was a
    confirmed echo.
  - **Deciding receipt:** the failing call's private transcript row (session and run), plus a fixed
    harness's read of whether hop-2 output reaches the parent at all.
- **O2 (R-CW-4).** `work-finish-not-committed` on hops 2 and 3 (`work-store.ts:398`). The same lines
  are in the last-PASS journal: not a regression.
- **The journal is corroboration only.** It is unit-wide on a live gateway, with session keys
  redacted. In R-CW-3's window it caught an unrelated `Context overflow … (precheck)` on a 3-message
  session (`preflightEstimatedTokens=31772`) that the row cannot own. The row-bound product receipts
  are the reason-hash-correlated traces.

## The pure candidate question (9476c7aa)

No row is product-owned, so there is no product bug to carry to the pure line. The bytes the
adjudication rests on, compared across the two lines:

- **The composite and the pure line diverge exactly where these rows exercise.**
  - They are different lines: merge-base `541d0428`; ab5a has 284 commits the pure line lacks, and
    the pure line has 3,062 that ab5a lacks.
  - Commit **7a8857205d** ("keep continue_work and continue_delegate direct beside sessions_yield",
    2026-11-19, replayed onto the pure rebuild for #129388) is on the pure line only. It sets
    `catalogMode: "direct-only"` (`continue-work-tool.ts:46`, `continue-delegate-tool.ts:265`).
    Direct-only tools leave the catalog (`tool-search-catalog.ts:218`, `:616-617`).
  - So on the pure line these two tools are **not** dispatched, and H1 does not touch R-CW-1..4,
    R-CD-1, R-CD-SILENT, R-CD-2 or DELEGATE-SELF's continuation calls.
  - H1 still hits `sessions_spawn` (R-CW-TOKEN, MODEL-TOKEN) and `request_compaction` (R-RC-1,
    R-RC-2, R-CD-3). The envelope bytes are unchanged at 9476c7aa: `tool-search.ts:464`, details
    at `:473`, Tool Search default on.
  - The run-k6-proofs binding check ("prove the continuation surface is unchanged by the extra
    bytes") therefore **fails** for ab5a against 9476c7aa. This run's results transfer to the pure
    line in neither direction.
- **H3** is a pure-line-only hazard (above).
- **Identical on both lines:** `sessions-send-followup-custody.ts` (O1), `work-store.ts` (O2),
  `request-compaction-tool.ts`, `agent-runner-post-compaction-release.ts` (H4) and
  `tool-search-request.ts` (H2). `git diff ab5a 9476c7aa` on those files is empty.

## The budget collision (options for 🕯 and 🌊; no choice made)

Facts:

- **The meter counts cache reads.** It counts `max(totalTokens, input+output+cacheRead+cacheWrite)`
  per model response (docs#628, `tools/k6-proofs/README.md` § What is counted). A compaction's own
  model call is **not counted** (README § Not counted at ab5a). It stops on `projected-exceed`,
  which is total plus the largest growth seen between readings. Post-trip overshoot is unbounded
  (README § How far past the bound).
- **Measured on emeric at ab5a in this run:**
  - window 922,000 (R-CD-3 `fill_context_tokens`);
  - first fill turn: 40,000 filler chars took the total to 56,813 tokens, so each model call
    carries about 47–49k tokens of prompt (R-CD-4's journal shows a 45,568-token cache read);
  - R-RC-1's turn made 2 model calls; the R-CW-TOKEN trace holds 7.
- **R-CD-3 fill.** Target 0.77 × 922k = 709,940 tokens. Each fill turn re-sends the growing total:
  - 0.21 tokens/char: 8 turns, Σ ≈ **3.22M** (docs#627's figure);
  - 0.14 tokens/char: 11 turns, Σ ≈ **4.30M**;
  - 0.25 tokens/char: 7 turns, Σ ≈ 2.85M.
- **R-CD-3 proof turn**, at about 710k of context: 2 model calls ≈ 1.42M. At ab5a
  `continue_delegate` and `request_compaction` are cataloged, so `tool_search`/`tool_describe`
  steps can make it about 4 calls ≈ 2.84M. The compaction summarizer reads about 710k more, outside
  the meter.
- **R-CD-3 metered total**, estimated: about **4.8–6.4M at 0.21**, about **5.9–7.4M at 0.14**. Not
  measured.
- **The other rows.** About 20 rows drive model turns in a full run: 14 dispatched here by evidence
  flags, plus R-CD-4, plus R-CD-3, R-CD-TOKEN and the three MODEL-* rows that did not dispatch. At
  about 48k metered tokens per call, 3.2M buys roughly **66 model calls** in total. The rest of the
  suite's real total is unmeasured. The first budgeted run's `token-budget-receipt.json` is the
  number to read.

Options:

| option | what changes | token cost | harness cost | risks |
|---|---|---|---|---|
| A. Per-row budget (R-CD-3 gets its own bound B3; the rest share 3.2M) | per-row ledger segments: rows already run one after another, so take a baseline at each row start; per-row bound input; per-row receipt | B3 + 3.2M. A per-row bound limits spend; it does not shrink it. B3 must be ≳ 5–7.5M at 922k under this meter's unit | one harness lane (token-budget.mjs, meter, run-proofs.sh, README, tests), plus review | an R-CD-3 trip stops only R-CD-3, but the attribution must stay fail-closed (sessions are already ownership-scoped); the 33-row share may still not fit in 3.2M (unmeasured) |
| B1. R-CD-3 alone, same seat (922k) | two dispatches: `rows=<live-suite minus R-CD-3>` with `token_budget=3200000`, and `rows=R-CD-3` with its own `token_budget` | B3 ≳ 5–7.5M for R-CD-3, plus the rest | none (existing inputs; keep each rows list under about 350 chars) | the 18-minute socket and 20-minute `maxDuration` were sized for about 200k (docs#627 notes); a 922k fill's wall time is unproven; the rest-of-suite fit is still unmeasured |
| B2. R-CD-3 alone on a small-window seat/model (about 200k) | fill target 0.77 × 200k = 154k: about 2 turns at 0.21, Σ ≈ 0.21M, plus a proof turn at about 154k ≈ 0.31–0.62M (2–4 calls) | ≈ 0.5–0.9M | none in the harness. Operations: a seat whose runtime equals the candidate | the PASS then belongs to that model and window, not to emeric's 922k; needs a ruling that a smaller window proves the contract |
| C. Raise the whole-suite bound | one `token_budget` value | ≥ R-CD-3 (≈ 5–7.5M) + the rest (unmeasured) + a `projected-exceed` margin of at least one late fill call (≈ 0.7M) | none | the bound no longer separates a runaway R-CD-3 from the rest. `FILL_BUDGET_CEILING_TOKENS` (1M) caps filler added, not re-send cost |
| (cross-cutting) Fix the unit | decide whether 🕯's 3.2M means provider-billed input or all tokens including cache reads | if cache reads are excluded, every figure above shrinks by the cached share (most of each call's ≈48k prefix and most of each fill re-send) | small: one counting rule plus tests and README in token-budget.mjs | changes what the receipt certifies; needs 🕯's statement of what the bound protects |

## Limits of this adjudication

- R-CD-2's immediate sub-cause (H2 or run stamp) and O1's actor are not decidable from public
  artifacts. The deciding receipts are named above.
- "Downstream gates would pass once H1 is fixed" is **not** claimed. The chain stops at its first
  failed gate, so later gates (sentinel order, wake row, done sentinel, parent return) were never
  evaluated. The diagnostics are consistent with them holding (`scheduled_text_seen`,
  `woke_text_seen`, time-aligned journal wakes), but they are not receipts.
- The GitNexus graph is index `openclaw-composite-39d19454`@39d1945464, verdict FRESH-FOR-SCOPE for
  ab5a, scope Tool Search files. That index is 50 commits before ab5a, and
  `continue-work-tool.ts`/`continue-delegate-tool.ts` moved after it. Each graph answer was
  byte-verified with `git show ab5a…:<path>`. `readToolSearchCallArgs`'s context lists only test
  callers: the graph misses the tool-search.ts lambda caller (`:386`). LadybugDB is 0.16.1, so
  impact counts are lower bounds.
- The budget figures for R-CD-3's proof turn and for the rest of the suite are estimates from the
  stated per-call floor. Only the 56,813-token first fill turn, the 45,568-token cache read and the
  2/7 model-call counts are measured.

## Refs

| category | ref | full SHA / id | local = tracking = server |
|---|---|---|---|
| product (run) | openclaw fleet composite | `ab5a30ea79b776f149e24b1fccab9e79b0a5d299` | yes (local clone = GitHub API) |
| product (pure candidate) | openclaw #129388 pure | `9476c7aaf79f8dc86d0222d2b708524a37711418` | yes |
| product (last PASS) | openclaw F′ | `f15237ec921879d918482cdf372b0718d4c1aab9` | yes |
| product (cited commits) | direct-only / unmeasured guard | `7a8857205d96c658d66b6a9214316ec616cb90d3`, `dd32c17eba8f5e7eebf4821298f0e9f8b7b1aca5` | yes |
| lane | `codeagent/proof-rows-adjudicate-10` | base `54d750e8c39d9889ad32834edcf05ead6ab0055c` (published unchanged before evidence) | yes |
| CI / workflow | run 44245772142, `project81-k6-proof.yml`, artifact 14404091587 | headSha `fe8e3c2188f4a3cb82a7c04c47dab96d49e13955` | yes (server) |
| presentation | N/A | N/A | N/A |
| docs / proof | docs main at lane start; last-PASS harness refs | `54d750e8…`; `215235ed73a6926a0610d91814b02f25a4836ed1`, `860bd4ec2a8aac2c0442fc3bcdea9aba087d3b19` | yes (local `main` is stale at b46590ae; origin/main = server = 54d750e8) |
| GitNexus | karmaterminal/GitNexus fork | `3c1e686edfc1acaac882927cada121ddd7c47bcc`, CLI 1.6.5, LadybugDB 0.16.1 | n/a |

## Files

- `run-44245772142-row-evidence.json`: public run fields per row. Nonce and session fields are
  dropped and provider tool-call ids masked.
- `repro/envelope-repro.mjs`, plus its outputs on docs `fe8e3c21` and `54d750e8`.
- `gitnexus/`: context and impact receipts.
