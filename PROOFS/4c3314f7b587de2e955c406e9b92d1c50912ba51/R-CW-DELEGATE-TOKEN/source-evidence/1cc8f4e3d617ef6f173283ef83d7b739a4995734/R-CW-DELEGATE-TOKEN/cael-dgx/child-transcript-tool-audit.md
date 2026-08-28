# Child transcript tool audit

Fresh `sessions_history(..., includeTools=true)` inspection after figs warning about delegate instruction drift.

Session: `agent:main:subagent:continuation-e9f996fc51ca332b1fa86217cf72090e`

Observed transcript shape:

1. User task instructs: do not call typed `continue_work`; first child reply must emit bare `CONTINUE_WORK:5`.
2. Assistant first turn contains only text:

```text
R-CW-DELEGATE-TOKEN-BCA2B0B-CAEL-20260704-1122 armed; awaiting fallback continuation wake.

CONTINUE_WORK:5
```

No `toolCall` blocks appear in the first child turn.

3. User continuation wake arrives with:

```text
Disposition: granted
Chain: 3cfc8617-1edc-42a4-ba9f-85a04ef445a8 hop 1/200
Flow: 3cfc8617-1edc-42a4-ba9f-85a04ef445a8
```

4. Assistant second turn contains only final text with sentinel and metadata.

No child typed `continue_work` call appears anywhere in the child transcript. This supports the row claim that the continuation came from token parsing, not a mistaken typed tool call.
