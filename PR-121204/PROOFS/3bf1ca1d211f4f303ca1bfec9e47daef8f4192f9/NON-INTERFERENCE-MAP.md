# Source-versus-composite non-interference map

## Row ownership

| Row | Production owner | Source assertion | Composite treatment | Isolation |
| --- | --- | --- | --- | --- |
| Stale direct-open ambient vs fresh mention | `extensions/discord/src/monitor/ingress.ts`; core pending disposition | `extensions/discord/src/monitor/ingress-stale-direct-config.test.ts` | #121204 Discord replay `2a09807c65af9bc0fa2e11cae66f56fb15996d81` | Exact-source |
| Corrupt pending vs fresh addressed | `extensions/discord/src/monitor/ingress.ts`; core pending disposition | `extensions/discord/src/monitor/ingress-corrupt-pending.test.ts` null-payload case | #121204 Discord replay `2a09807c65af9bc0fa2e11cae66f56fb15996d81`; later `24298a9263b7483e96fb14158e216803985bcec5` adds other corrupt shapes and policy-error containment | Exact-source for the selected null case |
| Watchdog bounded recovery/no replay | `src/channels/message/ingress-drain.ts` | Source watchdog assertion expects immediate `handler-timeout` failure | Composite base commit `ee79b0a49ae4b0ecd30f9e483c70c0f49f20232c` changes timeout to retry; later extraction/policy commits preserve that composite behavior | **Non-isolating** |

## Blob and history facts

- The stale-direct regression test blob is identical at source and composite:
  `e75e5e398ecf26b30ce292f9ffb788ddfb6b72c5`.
- At the #121204 replay tip, both
  `extensions/discord/src/monitor/ingress.ts` and
  `src/channels/message/ingress-drain-pending-disposition.ts` match the accepted
  source blobs. Later `24298a9` changes policy-error containment, but row 1 and
  the selected row-2 null-payload assertion do not traverse that added path.
- The row-2 source test already contains the null-payload invalid-event case and
  the same fresh-row settlement assertion. `24298a9` adds malformed
  mentions/content cases; those additions are not used here.
- The source watchdog test blob
  `49f5788ab7da910be41d8b795cb0c71eaf282531` expects a terminal
  `handler-timeout`. The composite-base watchdog blob
  `62e375396b345a77fd808eae0d8b7c8b98b3b8c8` expects one retry followed by
  lane-ordered recovery. The divergence predates replay commit `c98224e...` in
  composite base `605d19f41ef848067473248c9f3fdbf459208352`.

## Required composite changes

- `c98224eefa5c05dc74727a645f634c5e0a583ec0`: #121204 core replay; owns
  freshness and pending-disposition integration.
- `2a09807c65af9bc0fa2e11cae66f56fb15996d81`: #121204 Discord replay; owns
  channel-kind persistence, stale classification, and corrupt-pending handling.
- `a328ec3132d26298fa5f88bbc4ec460bb2c57731`: #124337 treatment; changes
  pre-adoption abandonment and cancellation accounting. None of the two
  exact-source verdicts depends on it.
- `24298a9263b7483e96fb14158e216803985bcec5`: policy-error containment; adds
  fail-open handling for thrown pending policy and additional corrupt shapes.
  The selected row-2 null case predates it.

The watchdog row is intentionally not counted as exact-source proof. Its
composite result is retained because it answers the requested operational
question while preserving the provenance limit.
