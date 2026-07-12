# Trace collection recovery and aggregation protocol

This is the Project 81 operational record for a proof row whose behavioral receipts
arrive before its Tempo evidence is attached to the row artifact. It is a collection
protocol, not permission to infer a trace from behavior alone.

## Why this exists

A continuation proof has two separate products:

1. the **behavioral row result** (accepted/scheduled/woke/returned), and
2. the **observability receipt** (an attributable Tempo trace and a public-safe
   correlation document).

They can complete on different clocks. Tempo receives, assembles, and stitches spans
asynchronously. Therefore a wrapper field such as `trace_id: null` immediately after
a live row means only **the wrapper did not attach a receipt at that collection point**.
It does **not** establish that the runtime emitted no continuation span.

The distinction is necessary because historical Project 81 evidence includes manually
collected continuation traces. The current problem is not classified as a newly
introduced runtime regression until direct collection disproves emission; it is an
observed collection/attachment gap in the affected run.

## Recorded incident: Silas R-CW-1, 2026-07-12

| Field | Recorded value |
| --- | --- |
| Candidate SHA | `4afd560feb5102627a68a2f6a8bc545dabcfcfdc` |
| Workflow run | `29209313511` |
| Row / seat | `R-CW-1` / `silas` |
| Wrapper result | behavioral PASS-candidate; `traceId: null`, no attached Tempo JSON |
| Direct Tempo recovery | trace `5c9f1f08dafd5d1ce5f4acc45e6dff69` |
| Receipt spans | `continuation.work` `ac693188ac66d779`; `continuation.work.fire` `04f306092c4ca868` |
| Safe join | known dispatch acceptance to root-span start: 20 ms; same trace contains a `continue_work` tool-execution span and the work/fire pair |
| Timing | scheduled `2026-07-12T21:18:10.169Z`; fired `2026-07-12T21:18:15.276Z`; `delay.ms=5000`, `fire.deferred_ms=5109` |

The raw Tempo response was retrieved only for local inspection. The channel handoff
contains a public-safe projection plus a correlation receipt: no raw session key,
nonce, prompt, token, traceparent, process metadata, or tool-call identifier.

This incident proves that an unpopulated wrapper field must trigger collection work,
not a claim that the continuation did not happen.

## Required collection sequence

Use this sequence for every continuation row that expects a trace.

1. **Write behavioral evidence immediately.** Preserve the row's candidate SHA,
   runner/run identifier, UTC start/end, and redacted event receipts. Do not delay
   the behavioral result while waiting for Tempo.
2. **Retain a safe join fingerprint.** At minimum retain the row ID, seat/service,
   dispatch-accepted timestamp, and any safe continuation attributes emitted by the
   row (for example reason hash + length, mode, chain ID, or expected span names).
   Do not retain raw nonce, raw reason, session key, token, or `traceparent` merely
   to make collection easier.
3. **Allow assembly time before declaring a miss.** First query after the behavior
   completes, then retry with bounded backoff through at least 5 s, 15 s, and 30 s
   after completion. Record every query time and result. A row may proceed as
   behavioral candidate evidence while this collection window is open.
4. **Query Tempo by the safe fingerprint, not a time window alone.** A time range
   narrows the candidate set; it is not attribution. Require a stable join such as
   matching service + continuation span name + reason hash/length, or a causal
   same-trace relation from the dispatched tool execution to the continuation spans.
5. **Fetch the selected trace and verify the span chain.** Confirm the expected
   continuation spans, their parent/root relation, and the row's schedule/fire or
   dispatch/return semantics. Record the trace ID and relevant span IDs.
6. **Publish a public-safe projection.** Store the redacted trace projection under
   the row's `artifacts/` directory and a correlation receipt explaining exactly why
   the trace belongs to that row. Keep unredacted Tempo payloads out of the corpus.
7. **Classify the result honestly.**
   - direct query yields an attributable trace: attach it and keep the behavioral
     candidate outcome pending normal review;
   - direct query yields spans but no safe join: `PARTIAL-candidate`, with candidate
     traces listed but not attributed;
   - no matching span after the bounded collection window: document `trace-missing`
     / receipt debt; do not silently convert it into runtime failure;
   - a query/adapter bug is found: document it as collection debt and open a narrowly
     scoped repair. Rerun only if the repaired collection boundary requires fresh
     evidence, not merely to overwrite an existing behavioral receipt.

## Collector requirements

The collector must support every runnable continuation row, not only delegate rows.
For a `continue_work` row it must be able to emit an artifact equivalent to a delegate
correlation receipt:

- a bounded polling window for Tempo assembly;
- the query inputs in public-safe form (service, expected span names, safe reason
  hash/length or other non-secret fingerprint);
- selected trace ID and span IDs;
- a redacted/projection JSON in `artifacts/`;
- a machine-readable correlation document that explains the join;
- an explicit `trace-pending`, `trace-present`, `trace-ambiguous`, or `trace-missing`
  status rather than a bare `null`.

A tool-visible `traceparent` is **not** an acceptable repair. Runtime trace context
remains internal; the collector needs a trusted, redacted receipt bridge instead.

## Review checklist

Before folding a recovered trace into a corpus:

- [ ] Candidate SHA and deployed runtime receipt match the row.
- [ ] The recorded query window begins only after the behavioral row completed.
- [ ] The trace is joined by a safe non-temporal fingerprint or causal same-trace
      relation; a time window alone is rejected.
- [ ] The public artifact excludes session keys, raw nonces/reasons/prompts, tokens,
      traceparent, process/resource internals, and opaque tool-call IDs.
- [ ] The correlation document names the exact expected spans and identifiers.
- [ ] The row's `EVIDENCE.md`, result JSON, and corpus manifest are updated together
      by the authorized atomic intake owner.

## Follow-up repair boundary

The July 12 R-CW-1 incident calls for a small collection repair: give the R-CW
post-processor the same safe-fingerprint/Tempo-polling/receipt-writing path used for
continuation rows that already attach trace artifacts. The repair must include a
regression test in which a trace is not immediately searchable but becomes available
inside the configured polling window. It must not re-expose trace context through the
public tool schema.
