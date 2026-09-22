# swim-44 / row-1192: typed `continue_delegate` input attachments

**Status:** implementation-gated — source and focused-test proof only; not a live
runtime or corpus result.

**Issue:** [karmaterminal/openclaw#1192](https://github.com/karmaterminal/openclaw/issues/1192)

**Implementation base:** `f01e2fbf09130103592c948ef7eef6b39a1e5a88`
(`scribe/20260709/1172-status-row-assembly` at the time of the handoff).

## Exact claim

When #1192 is committed, cleanly autoreviewed, and accepted into the assembly
line, and the existing shared attachment policy is enabled, the typed tool call
below carries bounded **input** attachments into the new delegate's workspace:

```ts
continue_delegate({
  task: "Read input/probe.txt and report its filename only.",
  attachments: [
    {
      name: "probe.txt",
      content: "CONTINUE_DELEGATE_ATTACHMENT_PROBE",
      encoding: "utf8",
      mimeType: "text/plain",
    },
  ],
  attachAs: { mountPath: "input" },
});
```

`CONTINUE_DELEGATE_ATTACHMENT_PROBE` is a harmless fixture marker, not an
example of user or sovereign content. Real callers must keep attachment content
within the existing inline-attachment policy and local trust boundary.

The typed shape is:

```ts
attachments: Array<{
  name: string;
  content: string;
  encoding?: "utf8" | "base64";
  mimeType?: string;
}>;
attachAs?: { mountPath?: string };
```

## What #1192 proves

The candidate implementation accepts the two fields only on the typed
`continue_delegate` surface, applies the shared inline-attachment policy before
durable enqueue, applies it again at child spawn, and materializes the accepted
input for the child workspace. The focused suite covers the same typed input
through all four carrier paths:

1. immediate dispatch;
2. delayed delegate recovery after restart;
3. post-compaction staging and release; and
4. durable session-delivery queue replay.

It also covers invalid names, invalid base64, configured byte limits, disabled
attachments, tool-result non-echoing, and corrupt-state diagnostic redaction.
This is intentionally an input-mount contract, not a general state-transfer
claim.

## Explicit non-claims

- **Delegate return attachments are not implemented by #1192.** Structured
  child-to-parent attachment returns remain [#666](https://github.com/karmaterminal/openclaw/issues/666): completion capture, durable return carriage, and
  recipient rendering/mounting are out of scope here.
- `continue_work` remains attachment-free. Its schema has no `attachments` or
  `attachAs` fields.
- `[[CONTINUE_DELEGATE: ...]]` remains attachment-free. It may name a task that
  refers to an existing workspace file, but it has no typed inline-byte carrier;
  `attachment=...` is task text, not an attachment parameter.

## Source and focused-test anchors

The candidate is uncommitted as of this row's first authoring. The exact
uncommitted patch is anchored by its base and patch id:

- base: `f01e2fbf09130103592c948ef7eef6b39a1e5a88`
- patch id: `a2572daa7586ba34db9e470889a8821b05f0ec5b`
- required destination: `scribe/20260709/1172-status-row-assembly`

Implementation seams:

- `src/agents/tools/continue-delegate-tool.ts` — typed schema, parse, and
  enqueue-time validation;
- `src/agents/subagent-attachments.ts` and
  `src/agents/subagent-spawn.ts` — shared policy and child materialization;
- `src/auto-reply/continuation/delegate-store.ts`,
  `delegate-flow-store.ts`, and `delegate-dispatch.ts` — durable delegate
  persistence, recovery, and spawn handoff;
- `src/auto-reply/continuation/post-compaction-staged-dispatch.ts` and
  `src/auto-reply/reply/post-compaction-delegate-delivery.ts` —
  post-compaction carriage;
- `src/infra/session-delivery-queue-storage.ts` — restart replay; and
- `docs/design/continue-work-signal-v2.md` — RFC boundary and token-form
  policy.

Focused proof command, run against the candidate worktree:

```sh
node scripts/run-vitest.mjs \
  src/agents/tools/continue-delegate-tool.test.ts \
  src/auto-reply/continuation/delegate-store.test.ts \
  src/auto-reply/continuation/delegate-dispatch.test.ts \
  src/auto-reply/continuation/delegate-dispatch.recovery-1.test.ts \
  src/auto-reply/continuation/delegate-dispatch-post-compaction.test.ts \
  src/auto-reply/continuation/signal-parser.test.ts \
  src/agents/subagent-spawn.attachments.test.ts \
  src/agents/tools/continue-work-tool.test.ts \
  src/auto-reply/reply/post-compaction-delegate-dispatch.test.ts \
  src/auto-reply/reply/post-compaction-delegate-dispatch.delivery-guards.test.ts \
  src/agents/system-prompt.test.ts
```

Recorded candidate result: **11 files / 320 tests passed**. `git diff --check`,
targeted lint/type checks, documentation checks, and a checksum-verified
TruffleHog scan also passed. The remaining required gate is a successful
structured Codex autoreview after local CLI reauthentication; do not promote
this row to a deployed or corpus-PASS result before the resulting commit and
assembly acceptance are pinned.

## Promotion rule

After #1192 lands, re-anchor this row to the resulting full commit SHA and run
one ordinary live tool-form dispatch with a non-sensitive fixture. Capture only
the tool receipt and mounted-file existence/filename, not attachment content.
Then add a separate result block. Do not use that fire to certify #666's return
surface.
