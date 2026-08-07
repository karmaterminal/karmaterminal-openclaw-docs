# PR #112013: empty outbound location normalization proof

**Verdict: PASS.** The same real embedded-agent message-tool call included
explicit `location: ""` on both runtimes. Exact assembly `ceaf8cba...`
rejected it with `location must be an object.` and returned no delivery ID.
Exact candidate `c354b220...` delivered successfully and returned Discord
message ID `1529204270954451180`.

## Exact testbed disclosure

The deployed runtime was continuation assembly
`ceaf8cba72c48914acd1baf8b6796b5f35fc5f1e`, derived from upstream
continuation PR #85651, plus:

- PR #111616 as `f9e54d68bbc1587549152b169b0fc6b7ef560360`;
- PR #111617 as `beedc34e3f38135335a595cbc45dae3aaaef2626`;
- PR #112013 as candidate head
  `c354b220ba63bf1d56286da383cd8ce3b9eaa71a`.

The #112013 patch retains upstream stable patch ID
`3d424d8368129a70ac2d6ab381b8e3c3dd9e9634`. Protected PR #85651
presentation bytes and the assembly ref were not modified.

## Before/after behavior

| Observation | Before: assembly `ceaf8cba...` | After: candidate `c354b220...` |
| --- | --- | --- |
| Real embedded-agent tool arguments | `location: ""` | `location: ""` |
| Tool result | `location must be an object.` | `status: "sent"` |
| Discord message ID | None | `1529204270954451180` |
| Marker search | Zero before-marker deliveries | After marker visible at the returned message ID |

## Evidence map

- [`artifacts/before-message-tool.json`](artifacts/before-message-tool.json)
  records the redacted exact tool arguments and synchronous validation error.
- [`artifacts/after-message-tool.json`](artifacts/after-message-tool.json)
  records the same argument shape and successful delivery receipt.
- [`artifacts/discord-marker-search.json`](artifacts/discord-marker-search.json)
  records zero before-marker deliveries and the visible after marker.
- [`artifacts/focused-tests.log`](artifacts/focused-tests.log) contains 82
  passing focused outbound assertions.
- [`artifacts/platform.json`](artifacts/platform.json) binds deployment,
  restoration, and exact runtime SHAs.

## Honest limit

The evidence publishes only the decisive redacted tool call/result and delivery
receipt. The broader agent trajectory and workspace context are intentionally
omitted because they are not needed to evaluate the normalization behavior.
