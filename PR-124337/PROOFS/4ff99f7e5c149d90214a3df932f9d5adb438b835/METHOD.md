# Method

## Objective

Prove the three #124337 ownership contracts from authoritative durable queue
state while keeping accepted source identity separate from execution identity.

## Execution

1. Run on a seat whose installed checkout and `dist/build-info.json` both
   resolve to composite
   `6e6da7bba079b0fc50d134b96657cda683985837`.
2. Recheck that identity before every row.
3. Use a fresh synthetic account and isolated `OPENCLAW_STATE_DIR` per row.
4. Exercise the installed composite's production
   `createChannelIngressQueue`, `createChannelIngressDrain`, and
   `fanInChannelIngressLifecycles` implementations.
5. Close the shared state database, then query
   `channel_ingress_events` directly from SQLite for the durable projection.
6. Preserve only synthetic identifiers, counters, status, retry timestamps,
   last errors, failure reasons, payload-retained booleans, and bounded
   lifecycle logs.
7. Review the candidate artifacts before changing a row from `missing`.

## Safety

- The harness never opens the seat's live state database.
- No provider or channel credential is loaded.
- Payloads contain only synthetic proof markers and are not published.
- Raw account, user, message, channel, process, hostname, and filesystem values
  are excluded from canonical artifacts.
- A missing or mismatched checkout/build identity fails before the row.

## Reproduction

The corpus seed commit is immutable input to the live command. The command
downloads `harness.mjs` by full docs commit SHA, enters the already deployed
OpenClaw checkout, and supplies the exact source, composite, seat, docs SHA,
and artifact directory as environment values.
