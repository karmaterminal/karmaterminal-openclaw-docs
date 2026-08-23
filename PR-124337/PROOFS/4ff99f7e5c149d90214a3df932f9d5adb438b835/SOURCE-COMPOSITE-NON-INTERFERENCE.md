# Source versus composite non-interference

The behavior under proof belongs to #124337 source
`4ff99f7e5c149d90214a3df932f9d5adb438b835`; the composite is execution
context only.

| Surface | Source versus composite | Ownership conclusion |
| --- | --- | --- |
| `src/channels/message/ingress-drain-lifecycle.ts` | byte-identical | #124337 owns cancel-compat `AsyncLocalStorage`, explicit cancellation, and genuine-abandonment classification. |
| `src/plugin-sdk/channel-ingress-runtime.ts` | byte-identical | #124337 owns capable/legacy `cancelAll` separation and the legacy fallback's cancel-compat scope. |
| `src/channels/message/ingress-drain.abandonment-retry-budget.test.ts` | byte-identical | The source contract for bounded genuine abandonment is unchanged in the composite. |
| `src/channels/message/ingress-drain.ts` | composite refactors claim settlement and adds timeout/root-admission/pending-disposition work; the `cancelled` versus `abandoned` branch and `turn-abandoned` disposition remain | Ancillary composite work changes settlement plumbing and diagnostics, not the exercised classification. |
| `src/channels/message/ingress-drain.cancellation.test.ts` | composite adds a failed-release diagnostic case | The added case does not change the three proof-row outcomes. |

#121204 owns stale-ingress freshness and FIFO recovery behavior outside these
classification branches. Continuation owns its agent/runtime surfaces.
Neither supplies the proof predicates:

- `onAbandoned` without cancel-compat reaches the existing retry disposition;
- `onCancelled` releases with `recordAttempt: false`;
- legacy fan-in cancellation scopes only its fallback `onAbandoned` call as
  cancel-compat;
- durable `turn-abandoned` and `retry-limit-exceeded` fields distinguish
  genuine abandonment from cancellation.

The harness checks those fields directly from the synthetic SQLite queue. It
does not infer them from fresh-message behavior, continuation behavior, or
assistant output.
