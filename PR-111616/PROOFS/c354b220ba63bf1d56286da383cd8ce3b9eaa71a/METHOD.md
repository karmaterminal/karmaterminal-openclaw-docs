# Method

## Objective

Demonstrate the behavioral distinction introduced by PR #111616 in the
production embedded-session compaction path, not only in its unit helper.

## Procedure

1. Deploy exact combined candidate `c354b220...` to one Cael gateway seat.
2. Create a dedicated embedded session with a 41-message transcript:
   one non-empty `compactionSummary`, 20 assistant tool-call messages, and 20
   matching tool-result messages.
3. Execute the deployed production classifier.
4. Request compaction through the live gateway RPC.
5. Run another embedded agent turn in the same session and record the marker.
6. Restore exact assembly `ceaf8cba...`.
7. Recreate the same 41-message shape and repeat classifier and gateway
   compaction steps.
8. Compare exact structured outputs; curate only the decisive excerpts.

## Reproduction checks

```bash
jq '{messages: .afterMessages, classifier: .containsRealConversationMessages}' \
  artifacts/before-transcript-shape.json \
  artifacts/after-transcript-shape.json

jq '{compacted, reason}' artifacts/before-compaction.json

jq '{compacted, tokensBefore: .result.tokensBefore, tokensAfter: .result.tokensAfter}' \
  artifacts/after-compaction.json

grep -E 'pre.messages|post.messages|skipping' artifacts/runtime-excerpt.log

jq '.sessionId, .response' artifacts/after-continuation.json
```

Focused test output is preserved in `artifacts/focused-tests.log`; exact
identity and patch provenance are preserved in `RESOLVED-SHA.md` and
`artifacts/candidate-manifest.txt`.
