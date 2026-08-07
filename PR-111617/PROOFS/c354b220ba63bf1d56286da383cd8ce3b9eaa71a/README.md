# PR #111617: PluralKit lookup gating proof

**Verdict: PASS.** Exact assembly `ceaf8cba...` performed a PluralKit API
lookup for both ordinary non-webhook input and webhook proxy input. Exact
candidate `c354b220...` performed zero lookups for ordinary input while
retaining one lookup and canonical member enrichment for webhook proxy input.
A real ordinary Discord ingress was also processed successfully on the
candidate.

## Exact testbed disclosure

The deployed runtime was continuation assembly
`ceaf8cba72c48914acd1baf8b6796b5f35fc5f1e`, derived from upstream
continuation PR #85651, plus:

- PR #111616 as `f9e54d68bbc1587549152b169b0fc6b7ef560360`;
- PR #111617 as `beedc34e3f38135335a595cbc45dae3aaaef2626`;
- PR #112013 as candidate head
  `c354b220ba63bf1d56286da383cd8ce3b9eaa71a`.

The #111617 patch retains upstream stable patch ID
`8237f3fcda1f826e40660aed33ebc12e9b9a2a53`. Protected PR #85651
presentation bytes and the assembly ref were not modified.

## Before/after behavior

| Input | Before: assembly `ceaf8cba...` | After: candidate `c354b220...` |
| --- | --- | --- |
| Ordinary non-webhook message (`webhookId: null`) | PluralKit fetch count `1`; helper returned a PluralKit member override | PluralKit fetch count `0`; helper returned `null`, leaving the caller's ordinary author identity unchanged |
| Webhook proxy | PluralKit fetch count `1`; canonical member identity returned | PluralKit fetch count `1`; canonical member identity returned |
| Live ordinary Discord ingress | Baseline controlled behavior above | Message `1529205505111888094` processed in 379 ms with no matching PluralKit failure |

## Evidence map

- [`artifacts/before-controlled-runtime.json`](artifacts/before-controlled-runtime.json)
  records the exact-assembly helper execution.
- [`artifacts/after-controlled-runtime.json`](artifacts/after-controlled-runtime.json)
  records the exact deployed helper execution.
- [`artifacts/after-live-ingress.json`](artifacts/after-live-ingress.json)
  records the real ordinary Discord ingress receipt.
- [`artifacts/focused-tests.log`](artifacts/focused-tests.log) contains 52
  passing focused Discord preflight assertions.
- [`artifacts/platform.json`](artifacts/platform.json) binds deployment,
  restoration, and exact runtime SHAs.

## Honest limit

The deterministic lookup counts come from controlled execution of the exact
helper loaded from each deployed checkout. The live ordinary Discord ingress
confirms the candidate path processes a real message without the former
failure, but its public excerpt does not expose an internal API-call counter.
