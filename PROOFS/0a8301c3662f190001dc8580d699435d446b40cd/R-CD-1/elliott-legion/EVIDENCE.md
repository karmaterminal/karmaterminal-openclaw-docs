# R-CD-1 — continue_delegate tool-form default dispatch on `2723dbee`

**Owner:** 🌻 Elliott (`elliott-legion`)
**Candidate / deployed SHA:** `2723dbee783c113cae70e4fb63a4cff9f55402e3`
**Docs head at filing:** `c040ce759516411b136ab3cd36c21d70e24014c4`
**Captured:** 2026-06-27 21:19–21:21 PDT
**Verdict:** ✅ PASS — tool-form `continue_delegate` scheduled a child, child executed under the default model, returned the requested nonce, and the fanout return reached the parent session.

## Fire

Parent fired tool-form `continue_delegate` with:

- `mode: "silent-wake"`
- `delaySeconds: 0`
- `fanoutMode: "tree"`
- `traceparent: 00-00000000000000000000000000000021-0000000000000021-01`
- nonce: `elliott-rcd1-2723dbee-20260627T2119PDT`

Receipt: `root_dispatch_receipt.json`.

## Return

The delegated child returned exactly the requested row/nonce statement:

```text
row=R-CD-1
nonce=elliott-rcd1-2723dbee-20260627T2119PDT
observed_model=github-copilot/gpt-5.5
statement=continue_delegate tool-form child spawned and returned.
```

Receipt: `delegate_return.md`.

## Trace / queue evidence

Tempo export: `artifacts/trace_00000000000000000000000000000021.json`.

Observed spans include:

- `continuation.delegate.dispatch` with `delegate.mode=silent-wake`, `delay.ms=0`, `chain.step.remaining=199`, and the R-CD-1 `reason.preview`.
- child execution spans: `openclaw.harness.run`, `openclaw.run`, `openclaw.model.call`, `openclaw.context.assembled` with provider/model `github-copilot/gpt-5.5` and completed outcome.
- `continuation.queue.fanout` with `fanout.recipient_count=1`, `fanout.delivered_count=1`, `fanout.mode=tree`.
- `continuation.queue.drain` with `queue.drained_count=1`.

Summary: `trace_summary.txt`.

## Honest limits

- This row proves the tool-form/default-model `continue_delegate` path for this Elliott-fired substitution row on deployed `2723dbee`.
- It does not claim bracket/token parsing, alternate model override behavior, post-compaction behavior, or multi-hop chained delegation; those are separate rows.
- The trace id was intentionally pinned by the parent fire to make the Tempo export deterministic for this proof artifact.

## Verdict

✅ PASS for `R-CD-1` on `2723dbee783c113cae70e4fb63a4cff9f55402e3`: tool-form `continue_delegate` accepted, dispatched a child, child ran under the default `github-copilot/gpt-5.5` model, returned the nonce, and fanout delivered the return to the parent session.
