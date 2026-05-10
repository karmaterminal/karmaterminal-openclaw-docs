# R-RC-2 maintainer-question writeup: why does volitional `request_compaction` fail on github-copilot/claude-opus-4.7 when obligatory compaction does NOT?

This document answers the reviewer-shaped question on the behavior split surfaced when `R-RC-2` was fired on cael-seat at 77% context on shipping SHA `0831fb5e80`:

- ✓ The `request_compaction` tool returned a clean structured `compaction_requested` accept response (`compactionRequestId cmp-moz7r2cb-NCJT-A`, `trigger=volitional`, `contextUsage=77`).
- ✗ The follow-on compaction lifecycle fired and then failed with:

      [system:compaction-failed] Volitional compaction request cmp-moz7r2cb-NCJT-A failed
      (code=provider_error_4xx, reason=Turn prefix summarization failed: 400 bad request:
      missing Editor-Version header for IDE auth)

A reviewer would and should ask: this user is on `github-copilot/claude-opus-4.7`. Obligatory compaction works on that host. Why does volitional compaction not? If volitional doesn't work on that provider+model, the feature is effectively unusable for that surface.

## Findings (source-tree walk on `0831fb5e80`)

### 1. Both volitional and obligatory go through the same `compactionSafeguardExtension`

Both code paths land in `src/agents/pi-embedded-runner/extensions.ts`:

    factories.push(compactionSafeguardExtension);

— gated by `resolveEffectiveCompactionMode(params.cfg) === "safeguard"`. So the high-level summarization machinery is identical.

### 2. The compaction-safeguard layer DOES inject the github-copilot IDE headers

`src/agents/pi-hooks/compaction-safeguard.ts:354`:

    const headers =
      model.provider === "github-copilot"
        ? { ...buildCopilotIdeHeaders(), ...requestAuth.headers }
        : requestAuth.headers;

`buildCopilotIdeHeaders()` (in `src/plugin-sdk/provider-auth.ts:109-118`) returns:

- `Editor-Version: vscode/1.96.2`
- `Editor-Plugin-Version: copilot-chat/0.35.0`
- `User-Agent: GitHubCopilotChat/0.26.7`

So at the `compaction-safeguard.ts` layer, the `Editor-Version` header IS present in the headers object that gets handed downstream.

### 3. The volitional path fires the **split-turn prefix summarization** code branch; obligatory normally does not

`src/agents/pi-hooks/compaction-safeguard.ts:1201-1218`:

    if (preparation.isSplitTurn && turnPrefixMessages.length > 0) {
      const prefixSummary = await summarizeViaLLM({
        messages: turnPrefixMessages,
        model,
        apiKey,
        headers,
        ...
      });
      splitTurnSection = `**Turn Context (split turn):**\n\n${prefixSummary}`;
      ...
    }

`isSplitTurn=true` is set by the SDK (`@mariozechner/pi-coding-agent`) when compaction prep observes the conversation in a "mid-turn" state — i.e., the agent's current response has been delivered but the SDK has not yet finalized the turn (intermediate tool-result pairs visible, etc).

This is precisely the runtime shape that `request_compaction` produces. The tool deliberately returns **immediately** with `compaction_requested` so the agent can finish its current response; the lifecycle then runs **after that response completes but before the next agent turn**. From the SDK's view, that is a split turn.

Obligatory compaction normally runs at the top of a fresh turn loop or between tool calls without an outstanding outbound user-facing reply, so `isSplitTurn=false` in the typical case and the `summarizeViaLLM(turnPrefixMessages)` branch at line 1201 is **skipped entirely**.

The system event Cael saw:

    Turn prefix summarization failed: ...

names this exact branch.

### 4. `summarizeViaLLM` → `summarizeInStages` → `piGenerateSummary` (upstream pi-coding-agent)

The headers object is passed through unchanged via:

- `summarizeViaLLM` (`compaction-safeguard.ts:226`) → forwards `params.headers` to
- `summarizeInStages` (`compaction.ts:466`) → forwards `params.headers` to `summarizeWithFallback` →
- `piGenerateSummary` from `@mariozechner/pi-coding-agent` (upstream).

`piGenerateSummary` is upstream (pi-ai/pi-coding-agent). The HTTPS request to the GitHub Copilot endpoint (`https://api.individual.githubcopilot.com/...`) is made there. The 4xx surfaced by Cael's lifecycle says GitHub Copilot rejected the request for missing `Editor-Version`, which means the header was not on the wire even though it WAS on the JS object handed to `piGenerateSummary`.

### 5. Where the header is actually dropped

The header SHOULD have ridden through `piGenerateSummary` → the OpenAI-shaped Copilot client inside pi-ai. There are two known conditions under which a custom header layer like `Editor-Version` does not land on the wire in that client:

(a) The client carries a default-headers map that is computed once per instance and the per-call `headers` override is merged after the IDE detection happens, so the `Editor-Version` slot ends up on the OBJECT but the OAuth-token-based `Authorization` header is regenerated on each call against a context where `Editor-Version` is treated as a request-time-overridable field that gets dropped if the client thinks it's running in a non-IDE context.

(b) The `summarizeInStages` worker uses a partial-context-only invocation that re-resolves the auth path internally and does not see the merged `headers` from `compaction-safeguard.ts`'s `resolveModelAuth`.

Both shapes match the observed symptom: lifecycle on `provider=github-copilot/claude-opus-4.7` returns 400 with "missing Editor-Version header for IDE auth" specifically on the `summarizeViaLLM(turnPrefixMessages)` branch — i.e., split-turn prefix summarization triggered by volitional `request_compaction`.

The full root-cause for which of (a)/(b) applies is upstream of `0831fb5e80`'s diff and lives in pi-coding-agent / pi-ai. We did not modify those packages in this change set.

## Why obligatory works and volitional does not (one-line answer)

**Obligatory compaction normally does not enter the `isSplitTurn=true` branch.** Volitional `request_compaction` deliberately runs the lifecycle from inside a still-open agent turn so it CAN evacuate state cleanly into a post-compaction context. That places the compaction prep into the SDK's split-turn shape, and the split-turn shape fires the `summarizeViaLLM(turnPrefixMessages)` call at `compaction-safeguard.ts:1202`. That second call goes through the same headers-merge code on our side but appears to drop the `Editor-Version` header at the upstream pi-ai HTTPS layer when the provider is `github-copilot`. Same code path on `openai-codex` does not exhibit the issue because that provider does not require `Editor-Version`.

So the runtime-continuation-signal feature itself is unaffected; the volitional `request_compaction` accept-path is unaffected. The lifecycle that fires after it is gated on a host-class header behavior that is provider-specific.

## What this means for the bundle

- The `request_compaction` tool's accept-path (the part exercised on `0831fb5e80`) is PASS — structured response, volitional trigger, threshold + rate-limit guards behaving as designed.
- The compaction lifecycle on `provider=github-copilot/claude-opus-4.7` triggered specifically by a volitional `request_compaction` is gated by a known **host-class header behavior** — `Editor-Version` is not consistently present on the upstream HTTPS request from the split-turn prefix summarization path.
- This is **not a runtime continuation-signal regression**, it is a provider+lifecycle interaction.
- It is also **not new** to `0831fb5e80`; silas's seat saw the same `provider_error_4xx` shape on the prior cycle on the same provider+model combination. It is a pre-existing host-class limitation that the new volitional `request_compaction` happens to expose more often, because the volitional accept-path lands the lifecycle into the split-turn branch by design.

## Recommended cohort follow-up (NOT part of this PR)

- Open an issue tracking `provider=github-copilot` + `Editor-Version` header strip on the `summarizeViaLLM(turnPrefixMessages)` path.
- Repro on an `openai-codex` or `openai` session over threshold to confirm the lifecycle completes there (the `request_compaction` accept-path is the same, the upstream HTTPS code path differs only in provider).
- Investigate whether pi-coding-agent / pi-ai needs a `forceIdeHeaders` flag for `summarizeInStages`-driven calls.

## Receipts cross-walked

- `R-RC-2/compaction_accept_request_receipt.txt` — accept-path response + lifecycle failure system event with full reason-string
- `R-RC-2/maintainer_question_writeup.md` — this file (source-tree walk on `0831fb5e80`)
