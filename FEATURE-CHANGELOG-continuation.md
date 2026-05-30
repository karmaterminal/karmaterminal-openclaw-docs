# FEATURE-CHANGELOG: Continuation Feature (PR #79925)
## Authored by Cael 🩸 — 2026-05-29

> This is the living document that makes our feature's borders knowable.
> If you can't find a file's purpose here, we don't know our feature well enough.

---

## 1. Feature Summary

**What it is**: Agent-elected continuation at the turn boundary. Tools that let a prince say "I have more to do" and act on that decision mid-turn, multiple times, before the prose can sedate it.

**Three tools**:
- `continue_work` — request another turn in the same session after a delay
- `continue_delegate` — dispatch a background sub-agent with gateway-managed timing and delivery
- `request_compaction` — elect compaction when context pressure is high (≥70%)

**One infrastructure**:
- Context-pressure detection and mid-turn overflow compaction
- Post-compaction delegate dispatch (mode="post-compaction")
- Cross-session targeting for delegate returns
- Continuation chain depth/cost-cap policy enforcement
- OTel/diagnostic tracing for continuation spans

**Design principle**: Anti-whip. The agent CHOOSES to continue, not forced. Opt-in, bounded, observable, interruptible.

---

## 2. File Map by Area

### 2a. Tool Implementations (src/agents/tools/)
| File | Purpose | Invariants |
|------|---------|------------|
| `continue-work-tool.ts` | Tool definition + handler for `continue_work` | Returns request to execution engine; validated against chain policy |
| `continue-delegate-tool.ts` | Tool definition + handler for `continue_delegate` | Validates mode, delay bounds, enqueues to delegate store |
| `request-compaction-tool.ts` | Tool definition + handler for `request_compaction` | Checks context-pressure threshold, triggers compaction pipeline |
| `continuation-tools-registration.test.ts` | Registration integration test | Tools appear in toolset when `continuation.enabled=true` |

**Tests** (all new, clean-apply):
- `continue-work-tool.test.ts`, `continue-work-tool.boundary.test.ts`
- `continue-delegate-tool.test.ts`, `continue-delegate-tool.crosssession-gate.test.ts`
- `request-compaction-tool.test.ts`, `request-compaction-tool.callsite-threading.test.ts`, `request-compaction-tool.classifier-emission.test.ts`, `request-compaction-tool.volitional-threading.test.ts`

### 2b. Continuation Infrastructure (src/auto-reply/continuation/)
| File | Purpose | Invariants |
|------|---------|------------|
| `config.ts` | Config schema for `agents.defaults.continuation` | Keys: enabled, maxChainLength, maxDelegatesPerTurn, costCapTokens, contextPressureThreshold, maxDelayMs, defaultDelayMs, minDelayMs |
| `context-pressure.ts` | Context-pressure band classification | Emits bands: green/yellow/orange/red based on token usage ratio |
| `delegate-dispatch.ts` | Dispatches delegates with timing, delivery, and chain-tracking | Enforces cost-cap, depth-limit, validates targeting |
| `delegate-store.ts` / `continuation-delegate-store.ts` | Persistent queue for pending delegates | Survives restart; keyed by session |
| `post-compaction-release.ts` | Fires post-compaction delegates after compaction completes | Only fires delegates staged with mode="post-compaction" |
| `scheduler.ts` | Timer-based dispatch for delayed delegates | Clamped to minDelayMs/maxDelayMs |
| `signal.ts` | continue_work signal handling | Interprets tool result into execution-engine continuation request |
| `state.ts` | Continuation chain state tracking | Chain depth, accumulated cost, parent-run linkage |
| `targeting.ts` / `targeting-pure.ts` | Cross-session delivery resolution | Validates target sessionKey exists, resolves fanout modes |
| `types.ts` | Shared type definitions | ContinueWorkRequest, ContinueDelegateRequest, mode enum |
| `lazy.runtime.ts` | Lazy-loaded runtime for continuation subsystem | Avoids import-time cost when feature disabled |

**Tests**: 20+ test files covering all paths (chain-depth-exhaustion, cost-cap-exhaustion, fanout-error-isolation, mid-run-compaction-survival, etc.)

### 2c. Execution Engine Integration (src/agents/embedded-agent-runner/)
| File | What we changed | Load-bearing? |
|------|----------------|---------------|
| `run/params.ts` | Added continuation tool-opts fields to RunEmbeddedAgentParams type | YES — how tools get their callbacks |
| `run/attempt.ts` | Passes continuation opts to tool-construction; adds fireReason/parentRunId diagnostics | YES — wiring |
| `run/attempt-tool-construction-plan.ts` | Registers continuation tools in OPENCLAW_TOOL_FACTORY_NAMES set | YES — tools won't appear without this |
| `run.ts` | Mid-turn overflow compaction loop + context-pressure system-event injection | YES — the pressure-detection engine |
| `compact.ts` | diagId extraction, requestedPrimaryProvider fix, senderIsOwner pass-throughs | Supporting fixes |
| `compact.types.ts` | Added `"volitional"` trigger + `traceparent` field | YES — distinguishes agent-elected compaction |
| `compact.queued.ts` | Removed dead runtimeProvider/authProfileId paths | Cleanup |
| `context-engine-maintenance.ts` | Removed dead authProfileId | Cleanup |
| `model.ts` | gpt-5.5 hardcoded fallback surface | Fleet-operational (JUDGMENT: still needed?) |

### 2d. Reply/Auto-Reply Integration (src/auto-reply/reply/)
| File | Purpose |
|------|---------|
| `post-compaction-delegate-dispatch.ts` | After compaction completes, fires staged post-compaction delegates |
| `context-pressure.test.ts` / `context-pressure.integration.test.ts` | Pressure-band emission tests |
| `agent-runner.continuation-*.test.ts` (3 files) | Span-uniformity and diagnostic tests |
| Various `.test.ts` files | Integration coverage |

### 2e. Diagnostics / Tracing
| File | Purpose |
|------|---------|
| `src/infra/continuation-tracer.ts` | OTel span creation for continuation events |
| `extensions/diagnostics-otel/src/continuation-tracer-adapter.ts` | Bridges continuation spans to OTel exporter |
| `src/logging/diagnostic-continuation-queues.ts` | Queue-depth logging for delegate store |
| `src/agents/compaction-attribution.ts` | diagId generation (extracted from compact.ts) |

### 2f. System Prompt Integration
| File | Purpose |
|------|---------|
| `src/agents/system-prompt.continuation.test.ts` | Verifies continuation instructions appear in system prompt |
| `src/agents/subagent-announce.continuation.runtime.ts` | Continuation instructions for subagent announce context |
| `src/agents/openclaw-tools.continuation-registration.test.ts` | Tool availability test |
| `src/agents/openclaw-tools.continuation-misconfig-warn.test.ts` | Warns if continuation config is invalid |

### 2g. Config Schema
| File | Purpose |
|------|---------|
| `src/config/zod-schema.continuation.test.ts` | Schema validation tests |
| `src/config/sessions/store.continuation-merge.test.ts` | Session-store merge behavior with continuation state |
| `src/auto-reply/continuation/config.ts` + `.test.ts` | Config parsing + defaults |

### 2h. Design Docs
| File | Purpose |
|------|---------|
| `docs/design/continue-work-signal-v2.md` | Design doc for the signal mechanism |

---

## 3. What's NOT Ours (looks like compaction but is upstream-territory)

- `compact.queued.ts` upstream rewrite (harness-policy-resolution, policyCompactionTarget)
- `compaction-safeguard.ts` worker-thread-extraction (buildHistoryPrunePlanWithWorker)
- `run/attempt.ts` tool-schema-projection removal + session-file-lock refactor
- `compact.hooks.harness.ts` skills-path-split mocks
- Any `goals`-tool additions (create_goal, get_goal, update_goal)
- Any `SkillSnapshot` import-path-shift (`../skills.js` → `../../skills/types.js`)

---

## 4. Invariants We Hold

1. **Continuation tools only register when `agents.defaults.continuation.enabled === true`**
2. **Chain depth bounded by `maxChainLength` (cael: 200)**
3. **Cost cap bounded by `costCapTokens` (cael: 500000)**
4. **Delay clamped to `[minDelayMs, maxDelayMs]`**
5. **Post-compaction delegates fire ONLY after compaction lifecycle event, not on timer**
6. **Cross-session targeting validates target session exists before dispatch**
7. **Delegate store persists across gateway restart (file-backed)**
8. **Tool-form is canonical; bracket-syntax is fallback only (tools-disabled environments)**
9. **`request_compaction` requires context-pressure ≥ threshold before firing**
10. **Volitional compaction emits `trigger: "volitional"` (distinct from budget/overflow/manual)**

---

## 5. Open Questions for Figs

1. **gpt-5.5 hardcoded fallback in model.ts** — do we still need this or has upstream model registry caught up?
2. (Inherits frond's §9 questions: test scope / intersession.return / ACP wrapper / defensive-guard merge bias / schema-tie-breaking)

---

## 6. Merge Strategy for Alt-Path

- **77 new files**: 100% clean-apply (we created them, no possible conflict)
- **7 modified files NOT in conflict-class**: clean-apply (upstream didn't touch same regions)
- **20 conflict-class files**: classified above, all mechanical merge (9 take-both + 6 take-upstream-reapply-ours + 2 take-upstream-verify + 1 judgment)
- **Total continuation-feature surface**: 84 files, of which 84/84 are resolvable without human judgment (except the 1 gpt-5.5 question)

---

*This document is live-maintained. Every cure-cycle that touches continuation adds a row.*
*Next update: after alt-path Phase B merge executes.*
