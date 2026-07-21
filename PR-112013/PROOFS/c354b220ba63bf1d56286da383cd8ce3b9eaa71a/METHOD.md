# Method

## Objective

Demonstrate real message-tool behavior when an upstream model/provider emits
the optional structured field as an empty string.

## Procedure

1. Deploy exact combined candidate `c354b220...` to one Cael gateway seat.
2. Run a real embedded agent turn whose message-tool arguments explicitly
   contain `location: ""`.
3. Record the synchronous tool result and returned Discord message ID.
4. Confirm the after marker exists at that message ID.
5. Restore exact assembly `ceaf8cba...`.
6. Run the same real embedded-agent argument shape with `location: ""`.
7. Record the synchronous validation result and search for the before marker.
8. Publish only the redacted decisive call/result records and focused tests.

## Reproduction checks

```bash
jq '.toolArguments.location, .toolResult.status, .toolResult.messageId, .toolResult.error' \
  artifacts/before-message-tool.json \
  artifacts/after-message-tool.json

jq '.beforeMarker.totalSearchResults, .afterMarker.totalSearchResults, .afterMarker.deliveryResultCount, .afterMarker.messageId' \
  artifacts/discord-marker-search.json
```

Exact identity and patch provenance are preserved in `RESOLVED-SHA.md` and
`artifacts/candidate-manifest.txt`.
