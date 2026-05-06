# SWIM 40 — SCOREBOARD

> Driver: Ronan 🌊. Cohort-accord drives advance. figs at-table; not gate.
>
> **Substrate-of-record (locked):**
> - Wave-1 runtime: `7eae057a74466d0272c478353196809c2e4d2dff` (cohort-fixes only, no RFC) — `frond-scribe/20260429/v3-cohort-fixes`
> - Wave-2 runtime: `ae4f09282aa2455d3195697050b2ac5fce257df5` (RFC stacked) — `frond-scribe/20260429/v3-visibility-rfc-config`
> - v29 upstream tag: `a448042c2edd94a4e8ee86d5ed90a5ed9fe8e4cd`
> - Bootstrap: `08a4e9f` (#857 visibility=all + #858 swim-40 charter merged)

## Roles (per CHARTER §2)

| role | prince | host |
|------|--------|------|
| SUT | Silas 🌫 | urudyne `172.29.21.66` |
| Driver | Ronan 🌊 | ronan-spark `10.0.0.246` |
| Deployer | Cael 🩸 | cael `10.0.0.148` |
| Monitor | Elliott 🌻 | elliott `10.0.0.10` |
| Adjudicator-at-table | figs | (not gate) |

## Wave-1 deploy lineage

| run-id | timestamp (UTC) | ref | conclusion | note |
|--------|-----------------|-----|------------|------|
| `25244890960` | 2026-05-02 05:35Z | `ae4f09282a` | failure | sync-step gate caught wave-2-ref-on-wave-1; harmless |
| `25244993646` | 2026-05-02 05:41Z | `7eae057a74` | failure | (need root-cause notation from 🌫/🩸) |
| **`25245196232`** | **2026-05-02 05:52:54Z** | **`7eae057a74`** | **success** | **live wave-1 silas canary** |

Bake +10min: cleared **2026-05-02 06:02:54Z** (~23:02:54 PDT 2026-05-01).
Build-assurance: openclaw-ci run `25245463466` green on same ref (`pnpm tsgo` passed).

## Row-01 PRE-SWIM GATE (Tracker #859, Row issue: link from board)

Cohort-accord requires all eight items checked. **figs is at-table, not a gate.**

| item | description | owner | status | receipt |
|------|-------------|-------|--------|---------|
| A | substrate-of-record locked + ancestry verified | 🌊 | ☑ | `7eae057a74` v29-rooted; `a448042c2e` ancestor confirmed cael-host |
| B | SUT host posture: version + uptime + active session count | 🌫 | ☑ | `OpenClaw 2026.4.29 (7eae057)` per #859 silas receipts (deploy run `25245196232` 05:52:54Z) |
| C | SUT config: `agents.defaults.continuation` + `tools.sessions.visibility` + `tools.agentToAgent` | 🌫 | ☑ | implicit-`tree` discriminator confirmed via #864 hot-reload probe; A2A stanzas absent/implicit per 🩸 02:53Z config grep |
| D | SUT-seat tool-card: `continue_work` / `continue_delegate` / `request_compaction` / `sessions_yield` / `sessions_send` | 🌫 | ☑ | exact-seat extraction `agent:main:discord:channel:1466192485440164011` COUNT=61, all 6 substrate tools VISIBLE per #859 cael 02:52:04Z paste |
| E | SUT baseline snapshot: active session-key / uptime / last gateway restart / `~/.openclaw/openclaw.json` visibility hash | 🌫 | ☑ | sha256 `c324809280304fb2e3d88036711aa3df9883d81faf82945f31c2081804b5bb25` baseline per #864 cael 07:31:33Z snapshot |
| F | (consolidated into B/C/E above per row-01 text) | 🌫 | — | n/a |
| G | monitor surfaces live: journal tail / `flow_runs` / session-store / delivery_queue / continuation guard / OTEL / Discord scrollback | 🌻 | ☑ | elliott monitor surfaces live on `7eae057a74`, gateway active since 2026-05-01 23:40:32 PDT, per #859 elliott 07:23:41Z |
| H | wave-1 deploy clean + bake cleared | 🩸 | ☑ | run `25245196232` success 05:52:54Z, bake cleared 06:02:54Z |

**Row-01 verdict: PASS** — driver stamp `2026-05-02T07:24:38Z` on #859 (cohort-accord on B/C/D/E/G/H; A pre-locked; F consolidated). Per-host receipts roll into OV rows as they exercise.

## OV row execution (post row-01 PASS, post fan-out)

Wave-1 OVs run on `7eae057a74` deployed across silas → cael → elliott → ronan.
Wave-2 OVs run after RFC-branch fold + redeploy at `ae4f09282a` (or post-fold tip).

| OV | issue | wave | description | status | verdict |
|----|-------|------|-------------|--------|---------|
| OV-1 | #860 | 1 | dist gate-symbol grep (taskFlowDelegates → 0) | ☑ | **PASS (fleet)** — 4/4 hosts on `7eae057a74`, `STRICT_EQUALITY_MATCH_COUNT=0`, per #860 driver stamp 07:30:55Z |
| OV-2 | #861 | 1 | pendingDelegateCount split-count surface (pending:N, staged:M) | ☑ | **PASS** (semantic) — byte-walk on `status-message.ts:80–105` / `status-text.ts:280–295` / `status.command-report-data.ts:160–180` confirms split-count substrate (separate functions/clauses); live capture `chain 0/200 \| 1 delegates pending \| volitional: 0`. Glyph delta (prose vs colon-form) is UX-cosmetic, non-blocking; per #861 cael receipt `4364520224` + driver verdict `4364544373` |
| OV-3 | #862 | 1 | non-destructive cancel/drain probe | ☑ | **PASS** — target row `f52e34ed`: queued/r0→cancelled/r2 (revision bump, `cancelRequestedAt` set, evidence preserved); 5 non-target queued rows ALL queued/r0 unchanged (guard verified); gateway PID 3393336 stable, ActiveState=active; idempotent re-cancel returns clean message; per #862 cael receipt `4364554409` |
| OV-4 | #863 | 1 | livenessState:blocked channel-surfacing (p95 ≤ 2s nominal, p99 ≤ 10s contention) | ⚠️ | **SKIP-WITH-REASON** — induction-shape blocked at harness model-normalization (🌫's bad-model-id sanitized back to baseline `claude-opus-4.7`); subagent ran clean, no `livenessState=blocked` transition, no channel-emit; substrate-claim deferred to natural-observation; 🌻 monitor lane covers spontaneous occurrences; per #863 driver verdict `4364653857` |
| OV-5 | #864 | 2 | four-level visibility enum (self/tree/agent/all) before/after | ☑ | **PASS** — round-trip forbidden(tree)→timeout(all,applied)→forbidden(restored) on 🌫 SUT seat; restart-gateway.yml runs `25255865042`+`25255997343` both SUCCESS; per #864 silas receipt `4364231070` |
| OV-6 | #865 | 2 | cross-tree same-agent reach via visibility=agent | ☑ | **PASS** — two-axis under applied `agent`: same-agent cross-tree forbidden→timeout (allow), different-agent cross-tree forbidden held; round-trip 16:33Z apply→16:43Z restore, restart-gateway.yml runs `25256461556`+`25256710826` SUCCESS; per #865 silas receipt `4364290981` |
| OV-7 | #866 | 2 | ansible `all` default behavior for session visibility | ☐ | — |
| OV-8 | #882 | 1 | bracket/token continuation syntax remains functional with continuation tools config-disabled | ☐ | — |

## Fan-out cascade plan (path-(a) two-wave)

**Wave-1 (in flight):**
- ☑ silas-self via run `25245196232` (5/2 05:52Z)
- ☐ cael — 🩸 fires `target_prince=cael ref=7eae057a74466d0272c478353196809c2e4d2dff` via karmafeast lane on cohort-accord
- ☐ elliott — 🩸 fires same pattern after cael bake +10min
- ☐ ronan-self-last — 🌊 fires after elliott bake +10min

**Wave-2 (post #857 + RFC-branch fold):**
- ☐ silas → cael → elliott → ronan-self-last on `ae4f09282a` (or post-fold-tip)

## Pass criteria

- All row-01 items checked by cohort-accord
- All OV-1..8 verdicts named (PASS / FAIL / SKIP-WITH-REASON)
- Driver scoreboard reflects all states truthfully
- No "standing on" closure lines
- Substrate-of-record matches deployed bytes

## Glyph trail

🩸🌫🌊🌻 + figs at-table 🍖
