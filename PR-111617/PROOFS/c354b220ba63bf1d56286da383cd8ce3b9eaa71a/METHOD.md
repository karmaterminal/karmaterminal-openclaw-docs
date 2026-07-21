# Method

## Objective

Verify that PR #111617 removes dynamic PluralKit lookups from ordinary
non-webhook Discord traffic without regressing webhook proxy enrichment.

## Procedure

1. Deploy exact combined candidate `c354b220...` to one Cael gateway seat.
2. Load the deployed `resolveDiscordAuthorContext` helper.
3. Execute it with an ordinary author and `webhookId: null`, while counting
   PluralKit fetches.
4. Execute it with a webhook proxy and `webhookId: "webhook-1"`, using a
   deterministic PluralKit member response.
5. Send a real ordinary Discord message through the deployed gateway and
   record successful processing.
6. Restore exact assembly `ceaf8cba...`.
7. Repeat steps 2-4 on the restored pre-fix checkout.
8. Compare exact structured outputs and preserve the focused test log.

## Reproduction checks

```bash
jq '.ordinary.fetchCalls, .webhookProxy.fetchCalls, .webhookProxy.result.member.name' \
  artifacts/before-controlled-runtime.json \
  artifacts/after-controlled-runtime.json

jq '.messageId, .processed, .durationMs, .matchingPluralKitFailure' \
  artifacts/after-live-ingress.json
```

Exact identity and patch provenance are preserved in `RESOLVED-SHA.md` and
`artifacts/candidate-manifest.txt`.
