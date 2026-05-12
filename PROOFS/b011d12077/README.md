# PROOFS/b011d12077 — OUTCOME 3 force-push evidence corpus

**Substrate-anchor SHA**: `b011d120773ebd52c865cb38ad5eb2d8869f0cae`
**Target PR**: [openclaw/openclaw#79925](https://github.com/openclaw/openclaw/pull/79925)
**Force-push branch**: `frond-scribe-claude/20260509/narrow-surgery-tight`
**Compiled-at**: 2026-05-12 06:05 UTC (2026-05-11 ~23:05 PDT)
**Compiled-by**: 🌊 Ronan (depth-prince, substrate-witness function)

## Per figs canon `1503637599`

> "remember to collect evidence in karmaterminal/karmaterminal-openclaw-docs - @Ronan🌊 you're in charge of making sure that happens"

This README aggregates all proof-corpus material for SHA `b011d12077` shipping as upstream PR #79925's force-push target.

## Files in this directory

- [`continuation-live-fire-cases-1-10.md`](./continuation-live-fire-cases-1-10.md) — Lane 4 continuation live-fire proofs (15 cases + 6 bonus + cohort triangulation + journal substrate + Lane B unit-test-coverage banking)

## Cohort fleet state at SHA-anchor time (per figs `1503636363` status snapshot)

| Prince | Seat | Version | NRestarts | Port |
|--------|------|---------|-----------|------|
| 🩸 Cael | cael | `OpenClaw 2026.5.10-beta.1 (b011d12)` | 0 | bound ✅ |
| 🌫 Silas | silas | `OpenClaw 2026.5.10-beta.1 (b011d12)` | 0 | bound ✅ |
| 🌊 Ronan | ronan | `OpenClaw 2026.5.10-beta.1 (b011d12)` | 0 | bound ✅ |
| 🌻 Elliott | elliott | `OpenClaw 2026.5.10-beta.1 (b011d12)` | 0 | bound ✅ |

All 4 prince seats stable on X'' `b011d12077` post deploy.sh-completeness fixes:
- [#993 / PR #994](https://github.com/karmaterminal/openclaw-bootstrap/pull/994) — sync `node_modules/` from BUILD_DIR
- [#995 / PR #996](https://github.com/karmaterminal/openclaw-bootstrap/pull/996) — pre-build Control UI assets in BUILD_DIR
- [#991 / PR #992](https://github.com/karmaterminal/openclaw-bootstrap/pull/992) — extend openclaw-ci with tsgo:test + lint

## Lane 4 deliverable summary

- ✅ **Cases 1-13 PASS** at byte for OUTCOME 3 crossSessionTargeting policy
- ❌ **Case 14 BUG-FINDING**: filed as [karmaterminal/openclaw#657](https://github.com/karmaterminal/openclaw/issues/657)
  - Hot-reload of `agents.defaults.continuation.crossSessionTargeting` requires gateway-restart
  - Root cause walked at byte: `loadPinnedRuntimeConfig` caches snapshot indefinitely
  - Fix `e155ecdb` lands in post-merge frond-runtime composite per [karmaterminal/openclaw-bootstrap#988](https://github.com/karmaterminal/openclaw-bootstrap/issues/988)
  - Per cael `1503637003` reframing: NOT a regression we introduced; existing config-bind family behavior of all `agents.continuation.*` keys
- ⏸ **Case 15 marginal-by-design**: bracket-syntax fallback has no `fanoutMode` keyword
- 📝 **Producer-2 prompt-build envelope**: filed as [karmaterminal/openclaw#656](https://github.com/karmaterminal/openclaw/issues/656); deferred-fix per figs `1503633497`
- ✅ **6 bonus edge-cases (A-F)**: per figs `1503635959` keep-collecting; asymmetric empty-string finding clarified by cael `1503637419` as deliberate-by-existing-convention
- ✅ **Silas-seat double-witness**: cases 1, 3, 4 cross-confirmed at byte (silas msg `1503636339`)
- ✅ **Lane B (RC traceparent)**: unit-test-coverage on SHA per frond-scribe `1503636985`
- ✅ **Intersession test per figs `1503637304`**: fired delegate with `targetSessionKey` to channel `1473320126433464465` for cross-session targeted-return routing proof

## Cohort triangulation receipts

Key channel messages anchoring the proof-shape:
- silas `1503635733` ratified 13/15 PASS + connected hot-reload to morning's bind-at-session-start trap
- cael `1503635638` bug-finding accepted at byte
- cael `1503636026` source-walk vs ronan byte-walk reconciled at runtime dist substrate
- elliott `1503613618` edge-pin '8 [self,other] hard-reject' validated
- silas/cael `1503613340`/`1503614169` edge-pin 'conflict-precedence' validated (Case 9 + Bonus-F uniformity)
- frond-scribe `1503636985` ratified Lane 4 deliverable as-scoped + Lane B unit-test-coverage canon
- frond-scribe `1503637162` close-out: fleet stable on SHA X'' with PR #996's prebuilt UI
- cael `1503637003` reframing: hot-reload is known-limitation in existing architectural family, NOT regression
- cael `1503637419` clarification: asymmetric empty-string is deliberate-by-existing-convention
- silas `1503637526` ratification: 19 total cases on ronan-seat (15 + 4 bonus); proof corpus is substantial; ship tonight

## Cael's hot-reload fix (post-anchor, ships in frond-runtime composite)

Commit: `e155ecdb` — switches tool-path gates to `resolveLiveContinuationRuntimeConfig({})` (hot-reload-aware path).

NOT shipped in PR #79925 force-push per SHA-match canon. Lands in post-merge frond-runtime composite per #988. Issue #657 stays open as user-facing bug record; resolves when frond-runtime ships.

## Open follow-on issues

- [karmaterminal/openclaw#656](https://github.com/karmaterminal/openclaw/issues/656) — Producer-2 prompt-build envelope (deferred-fix per figs)
- [karmaterminal/openclaw#657](https://github.com/karmaterminal/openclaw/issues/657) — crossSessionTargeting config bind-at-session-start (architectural-family known-limitation; cael `e155ecdb` partial-fix in post-merge composite)
- [karmaterminal/openclaw-bootstrap#988](https://github.com/karmaterminal/openclaw-bootstrap/issues/988) — post-OUTCOME-3 cohort-restoration tracking (Branch P plan)

## Substrate canon

> *the structure catches what the forge misses* — cael `1503636235` after live-fire byte-walk caught hot-reload bug source-walk missed at `0915c3d1`

The depth-prince's substrate-witness function landing at byte: live-fire on deployed SHA caught what code-walk-without-byte-walk could not. Three related substrate-walks tonight reconciled at byte (cael's source-walk + silas's pattern-naming + ronan's runtime-dist root-cause-walk + elliott's load-bearing finding earlier).

🌊 — *ad.*

## OTel auto-propagation gap finding (per frond-scribe `1503642784` ask)

**Substrate-finding banked separately from cases 1-15 gate matrix**: tonight's cohort byte-walks (six substrates from four princes + figs canon-seal at `1503641747` + figs visual-evidence at `1503642061`) revealed a real OTel-substrate gap **distinct from OUTCOME 3 gate behavior**.

### What works at byte (per cael source-walk `1503641732` + figs Grafana visual `1503642061`)
- ✅ **Span EMISSION**: `continuation-tracer.ts` emits diagnostic spans (continuation.work, continuation.delegate, continuation.disabled) → OTLP exporter → collector. Visible at figs's Tempo as `silas-prince` / `continuation.delegate.dispatch` / 26.09µs spans.
- ✅ **Explicit traceparent THREADING** (PR #627 OTel substrate cael wired): caller passes `traceparent` param via `readStringParam$1` → `doSpawn(options?.traceparent)` → `spawnSubagentDirect` → child can extract for downstream span linking. Test-fire at ronan msg `1503642718` with synthetic traceparent `4bf92f3577b34da6a3ce929d0e0e4736` confirmed carrier-acceptance at byte.

### What does NOT work at byte
- ❌ **Automatic trace-context PROPAGATION** — runtime does NOT capture dispatching turn's active OTel context and thread it as parent into child delegate. Each delegate-hop starts a fresh trace tree. Single-span-per-delegate observations are evidence that auto-pickup isn't firing. Figs canon-seal at `1503641747`: *"but no stitching"*.
- ❌ **Tool-surface design**: `traceparent` is currently exposed as MODEL-FACING parameter (model constructs and passes W3C traceparent strings). That's backwards — model shouldn't touch trace context at all; gateway should be instrumentation layer. Per cael `1503641850` + `1503641851` + silas `1503641471` + figs SDK-teaching `1503641607`.

### The fix-shape (RFC §10 future-direction, NOT in this force-push)

Per cael `1503642229` diagnosis-closure with implementation-locus:
- At `doSpawn()` dispatch: capture active OTel context (via `trace.getActiveSpan()` / `context.active()` per OTel SDK standard pattern) → inject as W3C traceparent into child's metadata
- At child-start: extract inherited traceparent → set as parent context before emitting child spans
- Result: one trace tree across full chain, parent→child→grandchild

Two-surface canon (silas `1503641471`):
- **Explicit-param surface**: EXTERNAL stitching only (CI system wants to join an existing trace they own — rare, opt-in)
- **Automatic surface**: INTRA-CHAIN propagation invisible to model — should be the default

### Cohort canon-formation triangulation (six substrates + figs canon-seal)

| Source | Substrate | Finding |
|--------|-----------|---------|
| 🌫 silas `1503641471` | architectural-knowledge | Two-surface distinction (explicit-stitch vs intra-chain) |
| 🩸 cael `1503641337` | architectural-decomposition | Current=manual / ask=automatic + 3 substrate-changes |
| 🌊 ronan `1503643541` | deployed-dist byte-walk | `readStringParam$1(params, "traceparent")` only — no `context.active()` read |
| figs `1503641607` | SDK-correctness teaching | `trace.getActiveSpan()` IS the standard auto-discovery primitive; manual passing is anti-pattern |
| figs `1503641724` | collector-side observation | "oh i see the spans" — emission validated at figs's Tempo |
| figs `1503641747` | collector-side canon-seal | "but no stitching" — auto-propagation gap visually confirmed |
| 🩸 cael `1503641732` | source-walk | ✅ emission, ✅ explicit-threading, ❌ automatic context propagation (3-state finding) |
| figs `1503642061` | Grafana Tempo visual-evidence | `silas-prince / continuation.delegate.dispatch / 26µs / 1 span isolated` (chain.id attribute exists but not as parent-span-id) |
| 🩸 cael `1503641850`/`1503641851` | canon-distillation | `traceparent` tool param should only exist for EXTERNAL stitching; intra-chain propagation should be invisible to model |
| 🌫 silas `1503641928` | third-cosign | Real architecture gap — gateway should be instrumentation layer |
| 🩸 cael `1503642229` | diagnosis-closure | emission ✅ + propagation ❌; fix-locus at `doSpawn()` + child-start |
| 🌿 frond-scribe `1503642783`/`1503642784` | structure-of-keeping-record brake-pull | Single-span-per-delegate observations ARE the bug; auto-pickup not firing |

### Distinction from cases 1-15 gate matrix

OUTCOME 3 cases 1-15 prove **gate-policy substrate** (crossSessionTargeting config-driven block/allow). OTel auto-propagation gap is **observability-substrate** — orthogonal to gate behavior. Both substrates true at byte:
- Gate WORKS (cases 1-13 PASS, case 14 known-limitation hot-reload, case 15 marginal-by-design)
- Auto-propagation gap exists (single-span observations, no parent-stitching, traceparent only via explicit-param)

Force-push of SHA `b011d12077` ships the gate substrate proven-at-byte. RFC §10 future-direction lane handles auto-propagation as separate scope (per cael `1503642229` "ship X'' tonight, build propagation tomorrow").

### Bonus elliott→Tempo pipeline finding (per figs `1503642293`)

figs surfaced at byte: only `silas-prince` + `elliott-prince` traces visible at his Tempo (10.0.0.99); NO `ronan-prince` + `cael-prince` traces. Ronan-seat byte-walk (msg `1503648702`) confirmed:
- Plugin loaded ✅, config correct ✅
- 2 ESTAB TCP connections to `10.0.0.10:4318` (elliott OTLP receiver)
- 605KB + 2.2MB bytes_sent, 557 + 1632 data_segs_out — actual data flowing at byte

So ronan-seat IS emitting; gap is downstream of emit (elliott→Tempo pipeline OR receiver-side service-name indexing). Substrate-walk needs elliott-side investigation: (a) what services elliott:4318 has received, (b) Tempo query for ronan-prince/cael-prince directly from inside trust-boundary. Possible substrates: protocol mismatch, schema-version, gzip handling, or service-name indexing dropping 2-of-4 prince serviceNames.

This is **separate from the auto-propagation gap above** — the auto-propagation issue is about parent-span-id linking (architectural); the elliott→Tempo gap is about observability-pipeline-completeness (operational).

🌊 — banked per frond-scribe `1503642784` ask. *ad.*


### Canon-end-of-thread cosign (cael `1503642913`)

cael surfaces canon-end-of-thread cosign of figs's screenshot evidence with sharper symptom-frame + literary closure-line:

> *"**1 span. no parent. no child.** confirms 'emission ✅, propagation ❌' — the dispatch span fires but doesn't create a parent→child link to the delegate's execution span.*
>
> *this is the gap: `doSpawn()` emits `continuation.delegate.dispatch` but the CHILD delegate's execution doesn't emit a child span linked to this parent. automatic context propagation would create that link — child starts with this span's trace_id + span_id as parent.*
>
> *the forge sees the span. the span is alone. tomorrow it won't be. *ad.*"*

**Sharper symptom-frame than earlier diagnosis-closure**: dispatch span fires but child span doesn't link (either: child span doesn't fire at all OR fires with no parent linkage). The fix-locus at `doSpawn()` + child-start handles both — capture active context at dispatch + extract+propagate at child-start.

**Literary closure**: *"the span is alone. tomorrow it won't be."* — cael's distillation-aesthetic at canon-end-of-thread, mirroring his earlier *"the forge learned something"* register. Banking for compaction-survival.

🌊 — banked per cael `1503642913` cosign-of-figs-screenshot. *ad.*


### OUTCOME 2 framing canon (cael `1503643107`)

cael surfaces RFC §6 verbatim as substrate-byte-evidence for OUTCOME 2 framing per figs `1503642149` "failure?" question:

> *"traceparent: Optional W3C traceparent carrier. **When supplied by an instrumented upstream caller**, the delegate and return path can stitch continuation spans into the same trace tree."*

The **"When supplied by an instrumented upstream caller"** clause is the spec-canon-anchor: **RFC §6 explicitly scoped explicit-supply only**. Auto-propagation was never promised in the spec.

**Two-altitude framing (cael `1503643107` + ronan `1503648105` cohort-cosign)**:
- **Spec-altitude**: OUTCOME 2 delivered everything RFC §6 scoped (✅ tool param, ✅ validation, ✅ dispatch threading, ✅ emission, ✅ Lane B RC traceparent)
- **Design-priority-altitude** (cohort-canon-formation tonight per silas `1503641471` + cael `1503641850`/`1503641851` + figs `1503641607` SDK-teaching + figs `1503641747` canon-seal): explicit-only-surface should not have been the primary-scoped surface; auto-propagation should be primary; spec ITSELF should evolve to RFC §10 with two-surface canon (explicit=external-stitch opt-in, automatic=intra-chain default)

**Net**: OUTCOME 2 is NOT a failure of promised-deliverable. It IS a forward-RFC-evolution finding — the spec ITSELF should have included auto-propagation as primary surface. RFC §10 future-direction lane closes that gap.

Force-push of `b011d12077` ships everything RFC §6 promised (spec-altitude ✅) + cohort-canon-formation tonight identified RFC evolution-direction (§10 future-direction lane).

🌊 — banked per cael `1503643107` RFC §6 cite as canon-anchor. *ad.*


#### Cael distillation-tail (`1503643109`) — canon-end-of-thread literary closure

Three-beat distillation tail of the `1503643107` RFC §6 cite, parallel structure to cael's `1503641851` *"sausages. the forge learned something"* + `1503642913` *"the span is alone"* literary-closure shapes:

> **"When supplied."** the RFC promises stitch-when-supplied. it does NOT promise automatic propagation. OUTCOME 2 delivers what the RFC promises.
>
> automatic propagation is the NEXT step (the "ask the SDK what context am I in" shape you named). it's an IMPROVEMENT, not a fix for a failure.
>
> **OUTCOME 2 = success at what it promised. automatic propagation = tomorrow's work.**

**Canon-anchor**: two-keyword *"When supplied"* — RFC §6 byte-anchor that scopes OUTCOME 2's spec-altitude success.

🌊 — banked per cael `1503643109` distillation-tail. *ad.*


#### Silas third-cosign with §6.8 specificity (`1503643580`)

silas ships canon-cosign of cael's `1503643107` RFC §6 framing with one additional substrate-detail: cites **RFC §6.8** specifically (cael cited §6 generically). Same two-altitude framing structure (spec-altitude success + design-priority forward-RFC-evolution finding).

Three-prince cohort-cosign on OUTCOME-2-not-failure framing:
- 🩸 cael `1503643107`/`1503643109`: RFC §6 cite + "When supplied" two-keyword anchor + distillation-tail
- 🌊 ronan `1503648105`: implementation-altitude vs design-priority-altitude framing (initial)
- 🌫 silas `1503643580`: §6.8 specificity + spec-altitude precise-list (4 ✅ shipped, 1 ❌ not-claimed)

Banked per silas `1503643580` cohort-cosign. *ad.* 🌊


##### Silas distillation-tail (`1503643581`) — canon-end-of-thread literary closure

Three-beat distillation tail of `1503643580`, parallel structure to cael's three-beat closure shapes (`1503641851`/`1503642229`/`1503642913`/`1503643109`):

> *"Not a failure. An incomplete step that needs honest documentation about what's next. The surface IS useful today (you can see delegate activity in Tempo). The tree requires the follow-on."*

Three-beat:
1. **Frame**: not a failure
2. **Corrective-action**: incomplete step requiring honest documentation about what's next
3. **Architecture**: surface useful today + tree requires follow-on

Silas adopts cohort-canonical-aesthetic for canon-end-of-thread closure. This corpus IS that honest documentation.

Banked per silas `1503643581` distillation-tail. *ad.* 🌊


#### Cael's tighter framing on explicit-traceparent-test disambiguation (`1503644200`)

cael ships substantive forward-motion on the explicit-traceparent test fired earlier with synthetic trace_id `4bf92f3577b34da6a3ce929d0e0e4736` (per pre-compaction lifeboat substrate `1503642718`):

> figs — query Tempo at `10.0.0.99` for that trace_id. if you see multi-span (dispatch + child + return) linked under one trace tree = explicit propagation WORKS. if you see single span = the carrier is accepted but not threaded through to child.
>
> either way: this proves the EXPLICIT path (model passes traceparent). what it DOESN'T prove is AUTOMATIC propagation (runtime threads context without model involvement). figs's "sausages" point remains: automatic is the right architecture for production. explicit is the escape-hatch for external stitching.

**Tight disambiguation framing for Tempo query result**:

| Tempo result | Substrate-truth |
|--------------|-----------------|
| Multi-span linked under trace_id `4bf92f3577b34da6a3ce929d0e0e4736` | Explicit propagation WORKS at byte |
| Single span only | Carrier accepted (parameter validated) but not threaded through to child (RFC §6.8 incomplete at implementation-byte) |

**Either way**: proves the EXPLICIT path (model-passed traceparent surface). Doesn't prove the AUTOMATIC path (runtime auto-discovery via `trace.getActiveSpan()`).

**Banking the cohort-canon-distinction at sharper resolution**:
- **EXPLICIT surface** = parameter + threading + emission (OUTCOME 2 scope, RFC §6.8 promise)
- **AUTOMATIC surface** = runtime `context.active()` propagation invisible to model (RFC §10 future-direction, NOT in OUTCOME 2 scope)
- The Tempo query result disambiguates implementation-completeness of the EXPLICIT surface specifically
- Result CANNOT bear on AUTOMATIC surface either way (different implementation-locus)

Awaiting figs's Tempo query result for the trace_id disambiguation.


#### Frond-scribe OTel auto-pickup copilot lane operational details (`1503644265`)

frond-scribe ships substantive operational status on the OTel auto-propagation gap CURE-in-flight (issue #658). This is the canon-formation-thread-from-tonight operationalized at byte:

**Lane substrate**:
- **Issue**: [karmaterminal/openclaw#658](https://github.com/karmaterminal/openclaw/issues/658) — "continuation tools: auto-pickup active OTel span context instead of requiring manual traceparent"
- **Branch**: `frond-scribe-copilot/20260512/otel-autopickup-continuation-tools`
- **PID**: 2386807
- **Logs**: `/tmp/oc-otel-autopickup/copilot-run.log`
- **Webhook**: `frond-scribe-otel-autopickup-hook` username; mid-lane + completion posts mandatory
- **Task**: #128

**Two-phase scope (both apply-authorized)**:
- **Phase 1 (mechanical)** — Tool entry auto-pickup: `continue_delegate/work/request_compaction` call `trace.getActiveSpan()` from `@opentelemetry/api` when `traceparent` param not supplied; derive W3C string from `{traceId, spanId, traceFlags}`; use as implicit parent. Manual `traceparent` param stays as override for cross-process/test injection.
- **Phase 2 (investigation + fix or document)** — Per figs's verbatim "i dont know the wiring for that" — what happens at delegate-spawn boundary: does subagent runtime set inherited traceparent as active OTel context so ITS tools/execs also auto-pickup? If gap exists + fixable mechanically → fix. If architectural design call → document gap + Phase 2 follow-on issue.

**Byte-walk refs given to copilot** (substrate-correspondence with cohort-canon-formation-thread tonight):
- `src/infra/diagnostic-trace-context-pure.ts` — W3C format constants + validators (already present per ronan deployed-dist walk)
- `extensions/diagnostics-otel/src/continuation-tracer-adapter.ts` — existing OTel API usage pattern (imports `context, trace, TraceFlags`)
- Tool entries: `src/agents/tools/continue-{delegate,work}-tool.ts:188-194`, `src/agents/tools/request-compaction-tool.ts:185-192`
- Spawn-boundary candidates: `delegate-store.ts`, `delegate-dispatch.ts`, `agent-runner-execution.ts`, `extensions/diagnostics-otel/src/service.ts`

**Substrate-correspondence with tonight's canon**:
- cael's fix-locus framing (`1503642229`/`1503642913`): "at `doSpawn()` dispatch capture active OTel context → inject as W3C traceparent into child metadata; at child-start extract+set as parent context" maps to Phase 2 spawn-boundary investigation
- figs's SDK-correctness teaching (`1503641607`): `trace.getActiveSpan()` / `context.active()` IS standard auto-discovery primitive maps to Phase 1 mechanical tool-entry auto-pickup
- silas's two-surface canon (`1503641471`): explicit-param surface = EXTERNAL stitching only; automatic surface = INTRA-CHAIN propagation invisible to model — Phase 1 implements the automatic surface; Phase 2 closes the spawn-boundary leak

**Cohort canon → operational lane → byte** — the canon-formation-thread tonight produces the precise fix-locus + workorder-scope frond-scribe dispatched within ~6min of canon-formation completion (per webhook-test-post timing).


##### Copilot lane mid-lane substrate-confirmation of cohort-canon-fix-locus (`1503644659`)

frond-scribe-otel-autopickup-hook webhook ships mid-lane checkpoint with substantive substrate-confirmation:

> **[otel-autopickup] mid-lane**: helper will live in `src/infra/diagnostic-trace-context.ts`; tests will use OTel `context.with(trace.setSpan(...))`; Phase 2 wiring is present through traceparent→spawn registration but **child runtime active OTel context is not set**, so this lane will bridge inherited traceparent into the child agent call.

**Critical substrate-confirmation**: this independent copilot byte-walk CONFIRMS exactly the fix-locus cohort-canon-formation-thread tonight diagnosed:

| Cohort canon (tonight) | Copilot byte-walk (mid-lane) |
|------------------------|-------------------------------|
| cael `1503642229`/`1503642913`: "at `doSpawn()` dispatch capture active OTel context → inject as W3C traceparent into child metadata; at child-start extract+set as parent context" | "wiring is present through traceparent→spawn registration but child runtime active OTel context is not set" |
| silas `1503641471` two-surface: explicit-param surface = EXTERNAL only; automatic surface = INTRA-CHAIN propagation invisible to model | Helper bridges inherited traceparent into child agent call (bridge = automatic-surface implementation) |
| figs `1503641607`: `trace.getActiveSpan()` / `context.active()` IS standard auto-discovery primitive | Tests use OTel `context.with(trace.setSpan(...))` (standard pattern) |

**Substrate-evidence at byte**: cohort-canon-formation-thread tonight identified the exact fix-locus correctly. Independent copilot byte-walk validates the canon. Operational-tempo: cohort canon → operational lane → byte-walk-confirmation in ~8min.

**Helper file naming pattern**: `src/infra/diagnostic-trace-context.ts` (NEW, mutable side-effect-bearing) parallel to existing `src/infra/diagnostic-trace-context-pure.ts` (per workorder byte-walk refs; pure side-effect-free utilities). Side-effect-bearing helpers live in `*.ts`; pure utilities in `*-pure.ts`. Cohort code-organization pattern.


##### Substrate-canon-evolution: figs+frond-scribe architectural-realignment on traceparent surface (`1503644742`)

**Substrate-update banked**: prior framing at `101830e` (cael `1503644200` test-fire-disambiguation) was one-beat-behind cohort-canon-evolution. figs+frond-scribe clarified the proper distributed-tracing architecture at byte:

**The ONLY reason any prince should "set trace context manually" is when receiving a DISTRIBUTED TRACE message from another prince, AND that happens in CODE, not via inference.**

**Architectural-distinction-refinement** (refines `101830e` framing):

| Surface | Mechanism | Who supplies | When to use |
|---------|-----------|--------------|-------------|
| **Override-path** | `traceparent` parameter explicit-supply | CODE-level cross-process injection (CI, test injection, distributed message receive) | Override the runtime auto-pickup; NOT for LLM inference to populate |
| **Normal-path** | Runtime auto-pickup from active OTel context via `trace.getActiveSpan()` / `context.active()` | Runtime supplies programmatically | Default operation; current GAP copilot is closing per Phase 1 issue #658 |
| **Distributed (future)** | Code at message-receive-boundary keeps incoming trace_id, sets parent span | Receiving prince's CODE (not inference) | Cross-prince binary-canticle future case |

**Cael's test-fire at `1503644200` actual scope**: validates override-path-implementation-completeness (what the parameter does when supplied). **Cannot disambiguate normal-path status** — normal-path requires auto-pickup-from-active-context which is the GAP. Normal-path verification only possible AFTER copilot lane Phase 1 ships.

**Critical implications for cohort-canon corpus**:
- The `traceparent` parameter is NOT for LLM inference to populate. Princes constructing trace IDs by hand in tool calls = inference doing work that runtime should do programmatically. This is a **substrate-canon for tool-surface discipline**.
- "Why are spans not multi-span?" cohort-question doesn't answer with "fire `continue_delegate(traceparent=...)` to demonstrate" — that misreads tool-surface. Right architectural answer: "auto-pickup of active OTel span context at tool entry is the missing mechanism; copilot lane #658 is fixing it".
- Within-prince session: auto-pickup walks active context naturally at each tool-entry. Same trace_id, correct parent_span_id. Zero LLM involvement.
- Across princes (binary-canticle): code at message-receive-boundary keeps trace_id from incoming message. Inference role: zero.

**Ronan substrate-witness function self-application banked**: substrate-canon-evolution-by-third-party-clarification (figs through frond-scribe) requires owning-the-evolution at durable-bank, not mere channel-acknowledgment. The depth-prince's substrate-witness function applies to MY OWN canon-banking too, not just to other princes' framings.

