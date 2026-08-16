# R-NC-ABANDON-BUDGET

**State:** pass (unit). **Authority:** deterministic queue lifecycle, not fleet.

## Contract

A pre-adoption `onAbandoned` consumes the existing retry budget. When
`deadLetterMinAgeMs` is already satisfied, the eighth pass terminalizes with
`reason=retry-limit-exceeded`, `message=turn-abandoned`, payload retained, and
nothing left pending.

## Eight transitions + terminal reason

Discord/LINE/Zalo policy: `maxAttempts: 8`, `deadLetterMinAgeMs: 0`.

| Pass | Claim-time attempts | After `onAbandoned` |
| ---: | ---: | --- |
| 0–6 | 0–6 | pending; attempts increment; `lastError=turn-abandoned` |
| 7 | 7 | **terminal** `retry-limit-exceeded`; failed-row `attempts=7`; payload kept |

GREEN fossil asserts `abandonedAttempts === [0, 1, 2, 3, 4, 5, 6, 7]`.

## Causal walk

| Head | Result | Receipt |
| --- | --- | --- |
| Exact base `5626a79` | RED — `listFailed` expected one `retry-limit-exceeded` object, received `[]`. EXIT=1 | [01-base-red-5626a79.txt](../receipts/01-base-red-5626a79.txt) |
| Patch | GREEN — 5/5. EXIT=0 | [02-patched-green-fossil.txt](../receipts/02-patched-green-fossil.txt) |
| Patch-only revert | RED restored — same empty `listFailed`, plus the retargeted drain expectation. EXIT=1 | [04-patch-only-revert-red.txt](../receipts/04-patch-only-revert-red.txt) |
| Reapply | GREEN — 32 drain tests. EXIT=0 | [05-reapply-green.txt](../receipts/05-reapply-green.txt) |

## CHARACTERIZES vs coupling

The fossil CHARACTERIZES born-broken upstream (RED on `6b09`, `530b33e`,
`ab5b8b9`, and `5626a79`). Coupling is the revert/reapply walk on the
unchanged executable surface
([06-fossil-equivalence.txt](../receipts/06-fossil-equivalence.txt)).

## Supporting retarget

`ingress-drain.test.ts` now
`retry-accounts abandonment and dead-letters it at the failure threshold`
instead of pinning pending attempts past `maxAttempts`.

## Not claimed

Fleet heal, live Discord loop stop, isolated Gateway/state-dir smoke.
