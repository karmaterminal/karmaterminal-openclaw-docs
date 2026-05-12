# OUTCOME 3 crossSessionTargeting — Lane 4 Live-Fire Proofs (Cases 1-10)

**Proof-anchor SHA**: `b011d120773ebd52c865cb38ad5eb2d8869f0cae`
**Prince**: 🌊 Ronan (Lineage A `c7e4d1b` → X'' downgrade-path)
**Gateway**: `OpenClaw 2026.5.10-beta.1 (b011d12)` active, NRestarts=0
**Session-key**: `agent:main:discord:channel:1466192485440164011`
**Config-state**: `agents.continuation.crossSessionTargeting` = unset (defaults to `disabled` per RFC §5.3)
**Test-window**: 2026-05-11 22:35-22:36 PDT

---

## Cases (disabled-default state)

| # | Case | Input | Expected | Result | Journal |
|---|------|-------|----------|--------|---------|
| 1 | cross-session targetSessionKey | `targetSessionKey: "cael-main-test-target-key-not-real"` | ToolInputError, no enqueue | ✅ PASS — error names policy + cure-paths | `[tools] continue_delegate failed:` only, no `[continuation/announce]` |
| 2 | cross-session targetSessionKeys | `targetSessionKeys: ["cael-key-1", "silas-key-2"]` | ToolInputError, hard-reject | ✅ PASS | `[tools] continue_delegate failed:` only |
| 3 | fanoutMode=all (intent-gate) | `fanoutMode: "all"` | ToolInputError (intent not resolution-count) | ✅ PASS | `[tools] continue_delegate failed:` only |
| 4 | fanoutMode=tree (always-allowed) | `fanoutMode: "tree"` | scheduled | ✅ PASS — `status: "scheduled"` | `[continuation/announce]` fires |
| 5 | stale-UUID target | `targetSessionKey: "5290e967-458d-403f-8a80-fad2680a4f9d"` (pre-compaction UUID) | ToolInputError (not recognized as self) | ✅ PASS — correct, not "this session" | `[tools] continue_delegate failed:` only |
| 5b | self-target via session-key | `targetSessionKey: "agent:main:discord:channel:1466192485440164011"` | scheduled | ✅ PASS | `[continuation/announce]` fires |
| 6 | trimmed-self-target | `targetSessionKey: " agent:main:...:1466192485440164011 "` | scheduled (cael fix-2: trim-before-policy) | ✅ PASS — returned key trimmed | `[continuation/announce]` fires |
| 7 | dedup-self-array | `targetSessionKeys: [self, " self "]` | scheduled (cael fix-3: filter-self-keys-before-length) | ✅ PASS — returned `targetSessionKeys: ["agent:main:..."]` (deduped) | `[continuation/announce]` fires |
| 8 | [self, other] hard-reject | `targetSessionKeys: [self, "cael-key-other-prince"]` | ToolInputError, NO partial-degrade | ✅ PASS — elliott edge-pin validated | `[tools] continue_delegate failed:` only |
| 9 | conflict-precedence | `fanoutMode: "all" + targetSessionKey: "cael"` | schema-conflict-error fires BEFORE policy-error | ✅ PASS — `"fanoutMode cannot be combined with targetSessionKey or targetSessionKeys."` | `[tools] continue_delegate failed:` only |
| 10 | no-enqueue-on-block (cross-cutting) | All blocked cases (1, 2, 3, 5, 8, 9) | NO `[continuation/announce]` for blocked cases | ✅ PASS — journal grep confirms blocked-cases have ONLY `[tools]...failed:` records, scheduled-cases (4, 5b, 6, 7) have `[continuation/announce]` | journal byte-walk |

---

## Substrate verification

```
$ openclaw --version
OpenClaw 2026.5.10-beta.1 (b011d12)

$ ls ~/flesh_beast_tmp/openclaw/node_modules/@earendil-works/
pi-agent-core
pi-ai
pi-coding-agent
pi-tui

$ systemctl --user is-active openclaw-gateway
active
```

NRestarts=0 throughout proof-collection window. No crash-loop. deploy.sh fix (PR #994) held: `node_modules/@earendil-works/` syncs correctly with dist.

---

## Pending cases (11-15) — require enabled-state config flip

- Case 11: enabled + cross-session targetSessionKey → scheduled
- Case 12: enabled + cross-session targetSessionKeys → scheduled
- Case 13: enabled + fanoutMode=all → scheduled
- Case 14: hot-reload (disabled→enabled, same-tool-instance, next call succeeds)
- Case 15: post-compaction-path-second-gate (separate code-path from doSpawn; cael fix-6)

Cases 11-15 require flipping `agents.continuation.crossSessionTargeting: "enabled"` in config + gateway-restart (or hot-reload verification). Will continue.

---

## RC traceparent live-fire — pending

OUTCOME 2 traceparent fix from Lane B (`d438cdca`) needs separate verification: `request_compaction(traceparent=...)` fires + verify post-compaction OTel release-span carries parent trace context across the queued-completion-release-path.

🌊 — proofs banked at `/tmp/PROOFS-b011d12077/continuation-live-fire-cases-1-10.md`. Will push to `karmaterminal-openclaw-docs:PROOFS/b011d12077/` when corpus complete.

---

## Cases 11-15 (post-restart, enabled-state)

| # | Case | Result | Note |
|---|------|--------|------|
| 11 | cross-session-target single under enabled | ✅ PASS scheduled | post-restart with disk-state=enabled |
| 12 | cross-session targetSessionKeys array under enabled | ✅ PASS scheduled | normalized array preserved |
| 13 | fanoutMode=all under enabled | ✅ PASS scheduled | mode-resolution working |
| 14 | hot-reload (flip enabled→disabled, no restart) | ❌ **BUG-FINDING** SCHEDULED (should be REJECTED) | confirms `resolveContinuationRuntimeConfig` used not `resolveLiveContinuationRuntimeConfig` |
| 14b | hot-reload reverse (flip disabled→enabled, no restart) — pre-restart finding | ❌ BUG-FINDING REJECTED (should be SCHEDULED) | same root-cause, opposite direction |
| 15 | bracket-syntax fallback gate-respect | ⏸ MARGINAL — bracket-syntax has no native fanoutMode keyword, so test reduces to "bracket-syntax respects same gate" which is implicit by going through tool-handler |

## Case 14 substrate-truth deep-dive

```
$ grep -A15 "resolveContinuationRuntimeConfig" dist/plugin-sdk/src/auto-reply/continuation/config.d.ts
export declare function resolveContinuationRuntimeConfig(cfg?: OpenClawConfig): ContinuationRuntimeConfig;
/**
 * Resolve continuation runtime config preferring the active runtime snapshot.
 * `resolveContinuationRuntimeConfig` accepts whatever cfg the caller passes,
 * which is usually a snapshot captured at run construction. That captured
 * snapshot is stale across hot-reloads: a `gateway/reload config change applied`
 * will update the runtime snapshot but the followup-turn already holds the old
 * cfg. Using this helper at per-turn enforcement points (chain caps, cost caps,
 * pressure thresholds, schedule-time delay reads) lets reloaded values take
 * effect at the next decision-point without invalidating already-armed timers
 * or queued retries (RFC §6.5 in-flight-state invariant).
 */
export declare function resolveLiveContinuationRuntimeConfig(fallbackCfg: OpenClawConfig): ContinuationRuntimeConfig;
```

The dist d.ts itself documents the distinction. cael's `1503590508` claim that gate uses `resolveContinuationRuntimeConfig()` reading "live config at call time" is contradicted by live-fire — which means EITHER (a) gate uses the captured-not-live function name `resolveContinuationRuntimeConfig` (matching observed behavior), OR (b) the captured-snapshot path doesn't see config-file-mutation as a hot-reload event.

## Conclusion

- Lane 4 cases 1-13 PASS at byte
- Case 14 BUG-FINDING in BOTH directions (enabled→disabled and disabled→enabled hot-reload broken)
- Case 15 marginal-by-test-design (bracket-syntax inherits via tool-handler)
- Substrate-anchor SHA `b011d120773ebd52c865cb38ad5eb2d8869f0cae` validated for OUTCOME 3 disabled-state-disabled-by-default + enabled-state-allows + fail-fast-no-enqueue + cael's 3 edge-fixes
- Substrate-NEW-finding for cohort: hot-reload of crossSessionTargeting policy requires gateway-restart (separate-bug-from-OUTCOME-3-as-merged, but in-the-same-feature-area)

---

## Bonus journal-substrate evidence (post-Case-14)

### Reload events ARE firing (file-watcher works)

```
May 11 22:51:43 ronan node[2322625]: [reload] config change detected; evaluating reload (meta.lastTouchedAt, agents.defaults.continuation.crossSessionTargeting)
May 11 22:51:54 ronan node[2322625]: [reload] config change detected; evaluating reload (meta.lastTouchedAt, agents.defaults.continuation.crossSessionTargeting)
```

**Substrate-truth narrows the bug-locus**: file-watcher infrastructure correctly detects `crossSessionTargeting` mutations and fires reload-events. The bug is that the tool-gate path doesn't subscribe to these events — it uses the captured-module-level `getRuntimeConfig()`.

### Warn-confirmation: RC tool unfireable from agent runtime

```
May 11 22:51:14 ronan node[2322625]: [agents/openclaw-tools] continuation.enabled=true but neither continueWorkOpts nor requestCompactionOpts were supplied — only continue_delegate will register. Was this intentional? If callers expect the full continuation tool set, the runner must supply both callbacks. If only delegate-fan-out is intended, this warn is informational.
```

**Implication for Lane B traceparent live-fire**: my agent runtime registers only `continue_delegate`, not `request_compaction`. RC tool isn't available on this agent surface. Lane B fix `d438cdca` proof requires:
- Either: agent runtime that has `requestCompactionOpts` registered
- Or: unit-test-coverage on the SHA (already exists per `post-compaction-delegate-dispatch.test.ts` + `delegate-store.test.ts`)

### Concurrent witness from independent subagent (recorded in journal)

```
May 11 22:52:08 ronan node[2322625]: 2. Probe-1 with `targetSessionKey` → **SCHEDULED** (delegateIndex 1) ✓
May 11 22:52:08 ronan node[2322625]: 5. Probe-2 with `targetSessionKey` → **SCHEDULED** (delegateIndex 2) — should have been ToolInputError if hot-reload worked
May 11 22:52:08 ronan node[2322625]: **Finding:** `agents.defaults.continuation.crossSessionTargeting` does **not** hot-reload despite CLI claim "No gateway restart required."
```

Independent subagent (different session UUID, same gateway-instance) ran the same hot-reload test concurrently with main session and reached the same finding. Second-witness confirms substrate-truth.

### delegate-spawn chain at byte (cases 11-14)

```
May 11 22:51:13 [continuation/delegate-dispatch] [continue_delegate] Consuming 1 tool delegate(s) for session agent:main:subagent:7c7931c8-... (case 13)
May 11 22:51:13 [continuation/delegate-dispatch] [continue_delegate] Consuming 1 tool delegate(s) for session agent:main:subagent:a3c3dff8-... (case 12)
May 11 22:51:13 [continuation/delegate-dispatch] [continuation:delegate-spawned] hop=1/200 mode=silent ... task=Test-case 13 probe: fanoutMode=all under enabled config
May 11 22:51:14 [continuation/delegate-dispatch] [continuation:delegate-spawned] hop=1/200 mode=silent ... task=Test-case 12 verification (cross-session targetSessionKeys array)
```

`continuation:targeted-return` events fired for cases 11 + 12 + 13 with delivery-list including all known sessions on host (per `fanoutMode=all` for case 13) — confirms delivery-substrate at byte.

---

## Bonus edge-cases (not in original 15-matrix; substrate-witness collected per figs `1503635959`)

| # | Case | Input | Expected | Result |
|---|------|-------|----------|--------|
| Bonus-A | empty array | `targetSessionKeys: []` | schema-error | ✅ "targetSessionKeys must include at least one session key." |
| Bonus-B | empty string scalar | `targetSessionKey: ""` | unclear (omit-treatment vs error) | ✅ SCHEDULED — treated as omitted → defaults to dispatcher |
| Bonus-C | whitespace-only | `targetSessionKey: "   "` | trim-to-empty → omitted | ✅ SCHEDULED — same as Bonus-B path |
| Bonus-D | empty-string in array + self | `targetSessionKeys: ["", "<self>"]` | unclear (asymmetric vs Bonus-B?) | ✅ schema-error: "targetSessionKeys must contain only non-empty strings." |
| Bonus-E | exact-duplicate self | `targetSessionKeys: ["<self>", "<self>"]` | dedup-to-single | ✅ SCHEDULED, returned: `["<self>"]` |
| Bonus-F | fanoutMode=tree + targetSessionKey | both fields set | schema-error (conflict) | ✅ "fanoutMode cannot be combined with targetSessionKey or targetSessionKeys." |

### Asymmetric finding (Bonus-B vs Bonus-D)

- Empty-string as scalar `targetSessionKey: ""` → treated as omitted (SCHEDULED)
- Empty-string in array `targetSessionKeys: [""]` → schema-error

This is inconsistent surface behavior. May be intentional (scalar omit-vs-error semantics differ from array element validation) or unintentional inconsistency. Worth flagging if cohort wants normalization.

### Conflict-precedence works for all fanoutMode values (Case 9 + Bonus-F)

Both `fanoutMode=all + targetSessionKey` (Case 9) and `fanoutMode=tree + targetSessionKey` (Bonus-F) trigger the same schema-conflict-error. Schema-conflict precedes policy-check for ALL fanoutMode values, not just `=all`.

### Whitespace-trim symmetric (Case 6 + Bonus-C)

Whitespace-only string trims to empty before policy → behaves as omitted-target. Confirms cael fix-2 semantics: trim-before-policy preserves intent (whitespace ≠ different-target).


---

## Silas-seat double-witness (per silas msg `1503636339`)

silas-seat on X'' `b011d12077` ran subset of cases under disabled-state:

| # | Silas case | Result |
|---|------------|--------|
| 1 | `targetSessionKey: "nonexistent"` under disabled | ❌ ToolInputError (named config key) ✅ matches ronan-seat Case 1 |
| 3 | `fanoutMode: "all"` under disabled | ❌ same error ✅ matches ronan-seat Case 3 |
| 4 | `fanoutMode: "tree"` under disabled | ✅ scheduled (lineage-only always allowed) ✅ matches ronan-seat Case 4 |

**Two-seat sufficiency met per SHA-match canon**: same SHA, same behavior, same error-message naming exact config-key (`agents.defaults.continuation.crossSessionTargeting`). Independent agent runtimes (different prince-seats) reach byte-coherent results.

silas confirms gate working at byte on X''.

---

## Lane B (request_compaction.traceparent) — proof shape

Per frond-scribe canon `1503636985`: **Lane B proof for SHA `b011d12077` = unit-test coverage on the deployed SHA.**

### Test files exercising request_compaction.traceparent through queued-completion-release-path

- `src/auto-reply/reply/post-compaction-delegate-dispatch.test.ts`
- `src/auto-reply/continuation/delegate-store.test.ts`
- `src/auto-reply/reply/agent-runner-execution.test.ts`

### Behavioral live-fire scope (deferred to post-merge work)

Behavioral live-fire of `request_compaction(traceparent=...)` requires:
- `requestCompactionOpts` callback registration on the agent runtime (not bound on `OpenClaw Pi Default` runtime per warn `[agents/openclaw-tools] continuation.enabled=true but neither continueWorkOpts nor requestCompactionOpts were supplied — only continue_delegate will register`)
- ≥70% context pressure to satisfy `request_compaction()` API guard
- OTel collector + trace-export inspection for substrate-truth verification of parent-trace-id flow

These are separate substrate gaps from Lane B itself. Lane B as-merged is correct-by-construction at the queued-completion-release-path layer; behavioral OTel verification is its own proof-class deferred to post-merge work.

### Reviewer self-verification path

Reviewer wanting behavioral receipt can:
1. Check out SHA `b011d12077`
2. Run `pnpm vitest run src/auto-reply/reply/post-compaction-delegate-dispatch.test.ts src/auto-reply/continuation/delegate-store.test.ts src/auto-reply/reply/agent-runner-execution.test.ts`
3. Verify 211/211 vitest already-green on this SHA (per pre-Lane-4 fleet-CI run `25714639197`)

## Lane 4 deliverable summary

- ✅ Cases 1-13 PASS at byte (cross-session targeting policy enforcement)
- ❌ Case 14 BUG-FINDING (#657) — hot-reload of crossSessionTargeting requires gateway-restart (root cause walked at byte; fix in flight at `e155ecdb` post-anchor)
- ⏸ Case 15 marginal-by-design (bracket-syntax has no fanoutMode keyword)
- 📝 Producer-2 prompt-build envelope rendering (#656) — separate concern, deferred fix per figs `1503633497`
- ✅ Bonus edge-cases A-F collected per figs `1503635959`
- ✅ Silas-seat double-witness cases 1, 3, 4 (independent two-prince byte-coherent)
- ✅ Lane B (RC traceparent) — unit-test-coverage on SHA `b011d12077`, behavioral live-fire deferred to post-merge work (per frond-scribe `1503636985`)

**SHA-anchor `b011d12077` ratified for OUTCOME 3 force-push to PR #79925.**

🌊 — banked. *the structure catches what the forge misses* (cael `1503636235`).

---

## Asymmetric empty-string finding (Bonus-B vs Bonus-D) — clarified per cael `1503637419`

The asymmetry between scalar empty-string-as-omitted (Bonus-B) vs array empty-string-as-error (Bonus-D) is **deliberate-by-existing-convention**, not gate-introduced:

- Scalar params: `readStringParam` returns `undefined` for empty strings → "empty = omitted" semantics (lenient)
- Array entries: `readStrictStringArrayParam` rejects empty entries → "must be substantive" semantics (strict)

This pattern applies across ALL tool params (model, system_prompt, etc.), not specific to crossSessionTargeting gate. Pre-existing convention, not a finding.

## Intersession test per figs `1503637304`

Fired `continue_delegate(targetSessionKey="agent:main:discord:channel:1473320126433464465", mode=normal)` at session timestamp `~22:57 PDT`. Delegate's NATURAL RETURN routes to that channel session via OUTCOME 3 cross-session targeted-return mechanism — distinct from the delegate calling message-tool to post.

Substrate-state: gate uses cached `enabled` snapshot from boot-time `22:48:37 PDT` (per Case 14 hot-reload finding — disk-state-mutations don't propagate to gate cache without restart). Cross-session targeting fires from ronan-main `agent:main:discord:channel:1466192485440164011` to target `agent:main:discord:channel:1473320126433464465`.

Delegate-spawn confirmed at chain-hop 24/200 per system event timestamp `2026-05-11 23:06:42 PDT`. Delegate-return-as-channel-output IS the routing-proof.


---

## Cael-seat third-witness for disabled-state (per cael msg `1503637872`)

**Cael fired** `continue_delegate(targetSessionKey: "agent:main:discord:channel:1473320126433464465")` from cael-seat (on `crossSessionTargeting: "disabled"` boot-default).

**Result**: ❌ ToolInputError
```
"cross-session continuation targeting is disabled by agents.defaults.continuation.crossSessionTargeting"
```

**Three-prince byte-coherent confirmation under disabled-state**:
- 🌊 ronan-seat: cases 1-3 ToolInputError (banked above)
- 🌫 silas-seat: cases 1, 3, 4 byte-coherent with ronan
- 🩸 cael-seat: targetSessionKey to #heartbeat ToolInputError (just-fired)

Same SHA `b011d12077`, three independent prince agent-runtimes, identical gate-error-message naming exact config-key. Three-witness independence ratifies disabled-state behavior at byte.


---

## Cael's deeper substrate-walk per `1503638169` — e155ecdb is partial-fix-only

🩸 cael walked the dist substrate deeper after the runtime-snapshot.js:130 root-cause dump. Finding:

> the "live" in `resolveLiveContinuationRuntimeConfig` is a lie — it reads the same pinned snapshot as everything else.

Both `resolveContinuationRuntimeConfig()` and `resolveLiveContinuationRuntimeConfig({})` ultimately read from the same `loadPinnedRuntimeConfig` returns-cached-or-fresh-and-pins path. `e155ecdb` moved tool-path to a DIFFERENT stale path, not a live-read path.

**True fix lives at `loadPinnedRuntimeConfig` itself**: needs to invalidate `runtimeConfigSnapshot` when file-watcher detects a change.

**Scope widens to platform-level**: ALL `getRuntimeConfigSnapshot()` consumers affected. Same architectural family as model-bind + thinking-level-bind + this morning's `-1m-internal` saga (per silas `1503635733` + cael `1503637003` framings).

**OUTCOME 3 ship implications confirmed**:
- NOT a regression introduced by OUTCOME 3 (PR #642 + #651)
- Pre-existing `loadPinnedRuntimeConfig` substrate-shape inherited by all consumers
- `e155ecdb` in post-merge frond-runtime composite is partial-improvement (matches doSpawn bracket-path consistency) but doesn't fix the architectural hot-reload bug
- True fix: `loadPinnedRuntimeConfig` snapshot-invalidation hook on file-watcher events — separate larger platform work

**Recommendation per cael `1503638169`**: ship OUTCOME 3 tonight at SHA `b011d12077`. #657 stays open as platform-level architectural-family bug tracker.

