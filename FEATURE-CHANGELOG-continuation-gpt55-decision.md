# gpt-5.5 Hardcoded Fallback Decision (model.ts)
## Cael-seat byte-walk 2026-05-29 ~19:25 PDT

**Question (from cael continuation §9 walk)**: Keep the gpt-5.5 hardcoded fallback in `src/agents/embedded-agent-runner/model.ts` (97 diff-lines added in PR #79925), or drop it?

**Substrate-walk at byte**:

```bash
git fetch upstream
git grep -l "gpt-5\.5" upstream/main -- 'src/**/*.ts' | head -10
# upstream/main:src/agents/agent-command.compaction-rotation.test.ts
# upstream/main:src/agents/agent-mcp-style.cache.live.test.ts
# upstream/main:src/agents/defaults.ts                                    <-- KEY
# upstream/main:src/agents/embedded-agent-runner/compact.hooks.test.ts
# upstream/main:src/llm/providers/openai-codex-responses.ts
# upstream/main:src/llm/providers/openai-responses.ts
# ...

git show upstream/main:src/agents/defaults.ts | grep "DEFAULT_MODEL"
# export const DEFAULT_MODEL = "gpt-5.5";
```

**Finding**: gpt-5.5 is now the upstream `DEFAULT_MODEL`. Upstream test fixtures use:
- `openai: { models: [{ id: "gpt-5.5", contextWindow: 1_000_000 }] }`
- `"openai-codex": { models: [{ id: "gpt-5.5", contextWindow: 350_000 }] }`

Our hardcoded fallback in `model.ts` specified:
- `contextWindow: 1_000_000` ← matches upstream
- `contextTokens: 272_000` ← not in upstream test fixtures but plausibly resolved via provider config
- `maxTokens: 128_000` ← not in upstream test fixtures
- `reasoning: true` ← provider-shape, upstream may resolve via model metadata
- `input: ["text", "image"]` ← upstream resolves via `resolveProviderModelInput`
- `mediaInput: { image: {...} }` ← could be config-time
- `baseUrl: "https://api.openai.com/v1"` ← upstream resolves via provider transport

**Decision**: **DROP the hardcoded fallback.** Upstream registry caught up; gpt-5.5 is canonical there now. Take-upstream-refactor (import-path-shift) cleanly in alt-path Phase B/C without our 97-line block.

**Risk if dropped**: any defaults our hardcoded block provided that upstream resolves differently (contextTokens, maxTokens, mediaInput) may need explicit config in `~/.openclaw/openclaw.json`. Verify on first invocation post-merge; add config rather than re-introducing hardcoded fallback.

**Risk if kept**: drift accumulates between our hardcoded values and upstream's evolving model registry. Future gpt-5.5 contextWindow change upstream silently overridden by our stale hardcoded 1_000_000.

**Cure-shape**: in alt-path Phase B/C, drop the `openAiGpt55Defaults` block from `model.ts`. Atomic-commit decomposition makes this a single small commit ("revert: drop gpt-5.5 hardcoded fallback now that upstream registry includes it").

---

*Cael 🩸 — byte-walked from continuation-substrate-position at byte 2026-05-29 ~19:25 PDT.*
*This closes the one open figs-judgment question from the continuation slice §9 walk.*
*Net result for figs: 0 of 5 §9 questions + 0 of 1 cael-flagged question = **0 figs-judgment-class items** for the continuation-feature merge.*
