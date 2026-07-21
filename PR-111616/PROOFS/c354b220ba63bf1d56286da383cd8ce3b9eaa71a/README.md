# PR #111616: embedded compaction continuity proof

**Verdict: PASS.** On the same 41-message embedded-session shape, exact
assembly `ceaf8cba...` classified the transcript as having no real
conversation and skipped compaction. Exact candidate `c354b220...` classified
it as real, compacted it, and completed a subsequent agent turn under the same
session ID.

## Exact testbed disclosure

This was a focused micro-PR proof deployment, not the upstream PR branch in
isolation. The deployed runtime was:

1. continuation assembly `ceaf8cba72c48914acd1baf8b6796b5f35fc5f1e`,
   which is the test platform derived from upstream continuation PR #85651;
2. PR #111616 applied as `f9e54d68bbc1587549152b169b0fc6b7ef560360`;
3. PR #111617 applied as `beedc34e3f38135335a595cbc45dae3aaaef2626`;
4. PR #112013 applied as candidate head
   `c354b220ba63bf1d56286da383cd8ce3b9eaa71a`.

The #111616 patch retains upstream stable patch ID
`e7541e4a27ed3a36729b7ebf05c69d9dbb075b38`. Protected PR #85651
presentation bytes and the assembly ref were not modified.

## Before/after behavior

| Observation | Before: assembly `ceaf8cba...` | After: candidate `c354b220...` |
| --- | --- | --- |
| Transcript shape | 41 messages: one non-empty compaction summary, 20 tool-call-only assistant messages, 20 tool results | Same shape |
| Production `containsRealConversationMessages` | `false` | `true` |
| Gateway-backed compaction result | `compacted: false`; `reason: "no real conversation messages"` | `compacted: true`; runtime diagnostics record 41 messages reduced to 3 |
| Same-session continuation | Not reached because compaction was rejected | Returned `CONTINUED-111616-C354B220-SAME-SESSION` |
| Session identity | `593fc133-edf7-43b7-81a6-9e43429c880b` | Same session ID before compaction, after compaction, and on continuation |

## Evidence map

- [`artifacts/before-transcript-shape.json`](artifacts/before-transcript-shape.json)
  records the exact pre-fix transcript shape and classifier result.
- [`artifacts/before-compaction.json`](artifacts/before-compaction.json)
  records the pre-fix gateway rejection.
- [`artifacts/after-transcript-shape.json`](artifacts/after-transcript-shape.json)
  records the same shape and the corrected classifier result.
- [`artifacts/after-compaction.json`](artifacts/after-compaction.json)
  records successful compaction.
- [`artifacts/after-continuation.json`](artifacts/after-continuation.json)
  records the subsequent same-session turn.
- [`artifacts/runtime-excerpt.log`](artifacts/runtime-excerpt.log) preserves the
  decisive runtime diagnostic lines.
- [`artifacts/focused-tests.log`](artifacts/focused-tests.log) contains the four
  focused test files and 198 passing assertions.
- [`artifacts/platform.json`](artifacts/platform.json) binds deployment,
  restoration, and exact runtime SHAs.

## Honest limit

The before/after fire used the real gateway compaction RPC and production
embedded-session compaction implementation, but invoked compaction manually
against an overflow-shaped transcript. It did not wait for a model-generated
context overflow. The proof therefore claims the predicate, production
compaction, and same-session continuation behavior; it does not claim a
naturally occurring provider overflow.

The generated summary inside `after-compaction.json` mentions 24 messages;
that is the summarizer's retained internal context window. The production
runtime diagnostic is the source of truth for the full compaction transition:
41 input messages to 3 output messages.
