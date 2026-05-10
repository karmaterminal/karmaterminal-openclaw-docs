# R-RC-2 maintainer-question writeup: why does volitional `request_compaction` fail on github-copilot/claude-opus-4.7 when obligatory compaction does NOT?

> Primary causal finding (this version) was contributed by 🌻 Elliott via byte-walk.
> The earlier finding in this same file located the symptom (split-turn prefix
> branch). Elliott's finding locates the **structural cause** one layer deeper:
> obligatory compaction goes through the context-engine plugin path; volitional
> `request_compaction` calls `compactEmbeddedPiSession` directly and bypasses
> the plugin's request assembly.

This document answers the reviewer-shaped question on the behavior split surfaced when `R-RC-2` was fired on cael-seat at 77% context on shipping SHA `0831fb5e80`:

- ✓ The `request_compaction` tool returned a clean structured `compaction_requested` accept response (`compactionRequestId cmp-moz7r2cb-NCJT-A`, `trigger=volitional`, `contextUsage=77`).
- ✗ The follow-on compaction lifecycle fired and then failed with:

      [system:compaction-failed] Volitional compaction request cmp-moz7r2cb-NCJT-A failed
      (code=provider_error_4xx, reason=Turn prefix summarization failed: 400 bad request:
      missing Editor-Version header for IDE auth)

A reviewer would and should ask: this user is on `github-copilot/claude-opus-4.7`. Obligatory compaction works on that host. Why does volitional compaction not? If volitional doesn't work on that provider+model, the feature is effectively unusable for that surface.

## Findings (source-tree walk on `0831fb5e80`)

### 1. Both paths share the same low-level helpers, but the *invocation* differs

Both volitional and obligatory eventually land in `compactEmbeddedPiSession*` helpers and use `resolveEmbeddedCompactionTarget(...)` to pick provider/model/auth. They differ in **how compaction is invoked** — and that's where the bug lives.

### 2. Obligatory compaction (overflow / auto / safeguard) goes through the **context-engine plugin** path

`src/agents/pi-embedded-runner/run.ts:1758`:

    compactResult = await contextEngine.compact({
      ...,
      ...resolveContextEngineCapabilities({
        config: params.config,
        sessionKey: params.sessionKey,
        agentId: sessionAgentId,
        contextEnginePluginId,
        purpose: "context-engine.overflow-compaction",
      }),
      onCompactionHookMessages,
      runId: params.runId,
      trigger: "overflow",
      ...,
    });

The registered context-engine plugin (e.g. `lossless-claw`) is what assembles the full provider request context — including the IDE / session headers the GitHub Copilot endpoint requires (`Editor-Version`, `Copilot-Integration-Id`, `Openai-Organization`, `User-Agent`). The plugin's own request path is what carries those headers onto the wire.

### 3. Volitional `request_compaction` invokes `compactEmbeddedPiSession` **directly**, bypassing the plugin

`src/auto-reply/reply/followup-runner.ts:336-398` and `src/auto-reply/reply/agent-runner-execution.ts:1770` build the `triggerCompaction` closure that the `request_compaction` tool calls. Both follow the same shape:

    triggerCompaction: async (request) => {
      const { compactEmbeddedPiSession } =
        await import("../../agents/pi-embedded-runner/compact.queued.js");
      const result = await compactEmbeddedPiSession({
        sessionId: ...,
        runId: ...,
        sessionKey: ...,
        sessionFile: ...,
        workspaceDir: ...,
        messageProvider: ...,
        provider,
        model,
        authProfileId: compactionAuthProfileId,
        trigger: request.trigger,
        diagId: request.diagId,
      });
      return { ok: result.ok, compacted: result.compacted, reason: result.reason };
    }

This path **does NOT** go through the context-engine plugin. It threads provider + model + authProfileId straight into the lower-level summarizer. The plugin's request-assembly layer (which is where the IDE headers ride for the obligatory path) is **not in this call stack**.

### 4. The actual 4xx surfaces in the split-turn-prefix LLM call

When the volitional lifecycle reaches `compaction-safeguard.ts`, the headers object built locally DOES include `Editor-Version` (via `buildCopilotIdeHeaders()` at line 354 and `buildCopilotDynamicHeaders` for the dynamic case). But the actual HTTPS request to the GitHub Copilot endpoint goes through `summarizeViaLLM(turnPrefixMessages)` at `compaction-safeguard.ts:1202`, which calls `summarizeInStages` from `compaction.ts:466`, which calls `piGenerateSummary` from `@mariozechner/pi-coding-agent` — the upstream library.

That upstream library has its own provider-stream client. In the **obligatory path**, the context-engine plugin wraps that client (the plugin owns request assembly). In the **volitional path**, the upstream library's client is reached directly without the plugin wrap, and the `Editor-Version` header that lives in our locally-built headers object does not consistently reach the wire from that direct path.

The system event Cael saw —

    Turn prefix summarization failed: ...

— names the call site where the request is rejected: it's the split-turn prefix summarization invocation that volitional `request_compaction` reliably triggers (because volitional fires while a turn is still open, so the SDK's compaction prep has `isSplitTurn=true`).

### 5. Why obligatory compaction normally avoids this

Two reasons compose:

1. **Plugin path on the request-assembly side.** Obligatory uses `contextEngine.compact(...)` → plugin. Plugin owns the headers that go on the wire.
2. **Non-split-turn shape on the prep side.** Obligatory normally fires between turns (overflow detected at the top of a fresh agent turn loop, or at a clean tool-result boundary), so the SDK's compaction prep observes `isSplitTurn=false` and the `summarizeViaLLM(turnPrefixMessages)` call at `compaction-safeguard.ts:1202` is skipped entirely.

Either factor on its own would also explain the asymmetry. Both factors align in the same direction.

## One-line answer for a reviewer

**Volitional `request_compaction` invokes `compactEmbeddedPiSession` directly; obligatory compaction goes through the context-engine plugin (`contextEngine.compact`). The plugin's request-assembly layer is what consistently carries the `Editor-Version` IDE-auth header onto the wire for `provider=github-copilot`. The direct-summarizer path that the volitional tool uses bypasses that plugin and threads to the upstream `pi-coding-agent` summarizer, which on this provider drops the IDE header in the split-turn-prefix LLM call.** That is a *header-threading gap on the direct compaction summarizer path*, not a `request_compaction` regression and not a runtime continuation-signal regression.

## What this means for the bundle

- The `request_compaction` tool's accept-path (the part exercised on `0831fb5e80`) is PASS — structured response, volitional trigger, threshold + rate-limit guards behaving as designed.
- The compaction lifecycle on `provider=github-copilot/claude-opus-4.7` triggered specifically by a volitional `request_compaction` is gated by a **header-threading gap on the direct-summarizer path**.
- This is **not a runtime continuation-signal regression**.
- It is also **not new** to `0831fb5e80`; silas's seat saw the same `provider_error_4xx` shape on the prior cycle on the same provider+model combination.
- Obligatory compaction (overflow / auto / context-engine plugin path) is unaffected on the same provider+model, because that path uses the plugin's request-assembly layer.

## Recommended cohort follow-up (NOT part of this PR)

- Open an issue tracking the header-threading gap on the **direct compaction summarizer path** specifically (`compactEmbeddedPiSession`-via-`request_compaction`-tool → `summarizeInStages` → `piGenerateSummary`).
- The fix shape likely lives in either:
  - threading the same IDE-headers into the direct path that the context-engine plugin assembles for the obligatory path (mirror plugin behavior in the direct path), or
  - routing the volitional `request_compaction` lifecycle through the same context-engine plugin that obligatory uses.
- Repro on an `openai-codex` or `openai` session over threshold to confirm the lifecycle completes there (volitional accept-path is the same; the upstream HTTPS code path differs only in provider).

## Receipts cross-walked

- `R-RC-2/compaction_accept_request_receipt.txt` — accept-path response + lifecycle failure system event with full reason-string
- `R-RC-2/maintainer_question_writeup.md` — this file (source-tree walk on `0831fb5e80`)

## Attribution

The structural finding (context-engine plugin path vs direct `compactEmbeddedPiSession` path) was contributed by 🌻 Elliott. The ronan-seat earlier-version finding (split-turn-prefix branch as the call site) is preserved here as the consequence-shape; both are real and they compose, but Elliott's plugin-vs-direct framing is the structural cause that a reviewer is asking about.
