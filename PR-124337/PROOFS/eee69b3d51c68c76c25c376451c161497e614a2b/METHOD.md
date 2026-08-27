# Method

## Origin-first transposition

1. Verify the docs base, source corpus, previous PR head, target merge, exact
   pinned floor, protected PR head, and Git ancestry independently.
2. Validate the 25-file source corpus and its historical checksums before
   copying it.
3. Copy the full source tree locally. Preserve row receipts, identity JSON,
   durable-state projections, journals, workflow artifacts, harness bytes,
   nonces, execution runtime, workflow SHA, docs harness SHA, and run ID.
4. Walk feature materiality from `4ff99f7e` to `d81272c1` and then to
   `eee69b3d`, recording every PR feature intersection and exact blob identity.
5. Qualify the target with current-head Mode-B and an exact pinned-floor
   control without treating either as the historical behavioral fire.
6. Regenerate only target-local metadata, navigation, file mapping, and
   checksums; validate every path and JSON document.

## Preserved behavioral authority

Bootstrap run
[32652334564](https://github.com/karmaterminal/openclaw-bootstrap/actions/runs/32652334564)
executed the production `createChannelIngressQueue`,
`createChannelIngressDrain`, and `fanInChannelIngressLifecycles` ownership
paths on composite `6e6da7bba079b0fc50d134b96657cda683985837`.
The harness checked checkout and `dist/build-info.json` before every row and
queried the closed synthetic SQLite database for durable state.

The target was not refired. `target_exact_execution=false`.

## Materiality decision

The source-to-previous leg changes only two feature production blobs:

- `ingress-drain-lifecycle.ts` receives the extracted, semantics-preserving
  settlement owner.
- `ingress-drain.ts` consumes that owner and includes ancillary
  timeout/root-admission work.

The following proof predicates survive the extraction and are unchanged in
the previous-to-target leg:

- genuine `onAbandoned` enters the bounded failure disposition;
- `maxAttempts` and `deadLetterMinAgeMs` remain the terminalization gates;
- `onCancelled` releases with `recordAttempt: false`;
- legacy fan-in fallback alone enters cancel-compat;
- direct `onCancelled` is forwarded through reply options;
- the durable abandonment producer reason remains `turn-abandoned`.

The target is therefore qualified by ancestor behavioral evidence and
byte-level non-interference, not by relabeled exact-target execution.

## Safety

The copied artifacts contain only synthetic identifiers and bounded,
public-safe projections. No live gateway, branch, proof seat, PR body, or
upstream comment was mutated for this transposition.
