# Target ancestry and materiality

## Commit walk

| Leg | Git result | Materiality |
| --- | --- | --- |
| `4ff99f7e` -> `d81272c1` | source is an ancestor | Settlement ownership is extracted from the drain into the lifecycle module; ancillary timeout/root-admission behavior is added. Core proof predicates remain. |
| `d81272c1` -> `eee69b3d` | previous head is target parent 1 | The five core production/test blobs used by the proof rows are byte-identical. |
| `6ae89b5a` -> `eee69b3d` | floor is target parent 2 | The feature patch is retained above the exact pinned floor. |

Target `eee69b3d` has parents in the required order:
`d81272c117ef7a2ac765450d682309a941d58463`, then
`6ae89b5a8ed6a1bdbd0d9b7639fc8162afbb7578`.

## Every PR feature intersection

| Path | Source -> previous | Previous -> target | Classification |
| --- | --- | --- | --- |
| `extensions/feishu/src/monitor.message-handler.ingress.test.ts` | unchanged in the proof-source walk | floor-merge test adaptation | Test-only; no feature owner change. |
| `extensions/mattermost/src/mattermost/monitor.inbound-system-event.test.ts` | unrelated test drift | floor-merge test adaptation | Test-only; no feature owner change. |
| `extensions/msteams/src/monitor-handler/message-handler.ingress-lifecycle.test.ts` | unchanged in the proof-source walk | floor-merge test adaptation | Test-only; validates lifecycle integration. |
| `src/channels/message/ingress-drain-lifecycle.test.ts` | unchanged | byte-identical | Keeps direct `onCancelled` forwarding assertion. |
| `src/channels/message/ingress-drain-lifecycle.ts` | settlement owner extracted here | byte-identical | Cancel-compat and `onCancelled` forwarding preserved. |
| `src/channels/message/ingress-drain.abandonment-retry-budget.test.ts` | byte-identical | byte-identical | All five bounded-abandonment controls preserved. |
| `src/channels/message/ingress-drain.cancellation.test.ts` | byte-identical | byte-identical | Budget-free cancellation and mixed fan-in separation preserved. |
| `src/channels/message/ingress-drain.test.ts` | ancillary timeout/root-admission tests | floor-merge assertion adaptation | Core abandonment reason and retry accounting remain asserted. |
| `src/channels/message/ingress-drain.ts` | consumes extracted settlement owner; adds ancillary timeout/root-admission work | byte-identical | Genuine abandonment still enters failure disposition; cancellation still uses `recordAttempt: false`. |
| `src/plugin-sdk/channel-ingress-runtime.test.ts` | byte-identical | byte-identical | Legacy/capable fan-in behavior preserved. |
| `src/plugin-sdk/channel-ingress-runtime.ts` | byte-identical | byte-identical | Legacy fallback alone uses cancel-compat; direct `onCancelled` remains separate. |

## Predicate closure

The byte walk preserves:

1. bounded retry for genuine pre-adoption abandonment;
2. `deadLetterMinAgeMs` as an independent terminalization floor;
3. budget-free cancellation through `recordAttempt: false`;
4. capable-versus-legacy mixed fan-in separation;
5. direct `onCancelled` forwarding;
6. durable producer reason `turn-abandoned`.

The PR surface remains three production files and eight test files. It adds no
schema, config, protocol, dependency, or separate feature surface.

## Review-time merge tree

GitHub exposed merge tree `8934a1d2dae2e8b6f298a52f0d16e556e9e26d90`
with parents `71d4a8c3e305c623aa3ffe92696eec18f116cfc6` and the target
head. Upstream advanced during review, so this is a timestamped compatibility
snapshot rather than durable exact-head execution.
