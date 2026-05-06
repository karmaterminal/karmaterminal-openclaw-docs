# Swim 29, Cael evidence notes

Date: 2026-04-14 PDT
Author: Cael
Scope: evidence collection for Swim 29 while operating SSH-evidence-only, after fallback to `openai-codex/gpt-5.4`

## Locked test status

- TC1: PASS
- TC2: PASS at check time
- TC3:
  - schedule / accept: PASS
  - return / surfacing: INCONCLUSIVE
  - interpretation: provider-confounded, not evidence that continuation scheduling/plumbing is broken
- TC4:
  - FINDING after later churn
  - live `sessions.json` state now shows override resurrection / drift on active `#sprites` entries

## Cael current operating state

- Head session recovered, but currently on fallback `openai-codex/gpt-5.4`
- Current context window on fallback: 200k
- This materially increased overflow risk during swim churn
- Operational role agreed in-channel: SSH evidence-only until back on a clean Opus lane / fresh session

## Provider-auth findings actually checked from Cael

### 1. `openclaw.json` is not the full auth surface
Local `~/.openclaw/openclaw.json` showed `github-copilot:github` and `github-copilot:pool-1`, but runtime auth store is the more important surface.

### 2. Runtime auth store contains both named github-copilot profiles on Cael
Checked:
- `~/.openclaw/agents/main/agent/auth-profiles.json`

Observed profile ids:
- `github-copilot:github`
- `github-copilot:pool-1`
- `openai-codex:default`
- `openai-codex:gwydionhythlothferrinassolidor@gmail.com`

### 3. Named github-copilot bearer files look stale; unnamed default path is the live refreshing path
On Cael, under `~/.openclaw/credentials/`:
- `github-copilot.token.github-copilot:github.json` exists, older/stale
- `github-copilot.token.github-copilot:pool-1.json` exists, older/stale
- `github-copilot.token.json` exists and is the clearly live refreshing bearer path

This same broad shape was corroborated by peers across the fleet.

### 3b. Code-level auth regression explains the stale named bearer files
Verified in current source:
- `src/agents/github-copilot-token.ts`
- function `resolveCopilotTokenCachePath(...)`

Current implementation resolves a single hardcoded cache file:
- `~/.openclaw/credentials/github-copilot.token.json`

That means the current build is **not using a per-profile bearer cache path** for `github-copilot:github` vs `github-copilot:pool-1`.

Interpretation:
- this does **not** prove one copied token across all princes
- but it **does** explain why named profile bearer files can sit stale while the unnamed default bearer continues to refresh
- this is a real auth contamination lane for provider-dependent swim results

### 4. No proof that all princes share one identical OpenClaw github-copilot bearer
I compared token artifacts across Cael, Elliott, Silas, and Ronan for:
- `github-copilot.token.github-copilot:github.json`
- `github-copilot.token.github-copilot:pool-1.json`
- `github-copilot.token.json`

Result:
- token hashes differed on all four boxes
- `github` vs `pool-1` also differed within a box

So there is **no evidence** that deploy collapsed everyone onto one identical provider bearer.

### 5. What remains broken / contaminated
What *is* supported by evidence:
- named profile refresh practice is degraded for the intended two-profile shape (`github-copilot:github` + `github-copilot:pool-1`)
- only the unnamed default bearer path is clearly live / refreshing
- current code appears to collapse github-copilot bearer refresh onto a single per-box cache path instead of distinct per-profile cache files
- provider-dependent swim results are contaminated by auth/rate-limit uncertainty
- Cael also has separate `gh auth` drift (`karmafeast`) at a different layer, but that is not itself proof of current OpenClaw provider-runtime binding

## TC3 evidence interpretation

What the lane supports:
- delegate fire happened
- scheduling / acceptance path worked
- later observations showed repeated provider-side 429 behavior on the delegate lane in at least one consumed run
- later refire visibility was noisy / unresolved

So the defensible call is:
- continuation scheduling path: not falsified by TC3
- provider-dependent completion / return: inconclusive under auth + rate-limit confounders

## Override drift finding (post-TC2)

A later wrinkle appeared after TC2 had already passed.

Ronan reported the active `sessions.json` entries had re-grown override state after later churn. I verified the local Cael active `#sprites` entry now shows:
- `providerOverride: openai-codex`
- `modelOverride: gpt-5.4`
- `thinkingLevel: null`

So the ledger should stay:
- **TC2: PASS at check time**
- **TC4: FINDING** — active `sessions.json` state later shows override resurrection / drift

## Recommended wording for Swim 29 record

Use something close to:

> TC3 should be recorded as schedule/accept PASS, return/surfacing INCONCLUSIVE. The lane is provider-confounded by github-copilot auth/rate-limit conditions and surrounding fallback/context churn, so TC3 is not clean evidence of a continuation-plumbing failure.
>
> TC2 passed at the time of inspection, but later churn reintroduced override state in active `sessions.json` entries. That should be recorded separately as a TC4 override-resurrection finding rather than retroactively failing TC2.

## PR-readiness review result (Silas isolated worktree review)

Reported verdict:
- **Conditionally ready**
- **No blockers**
- No data-loss / crash-risk findings
- Additive changes only, rolling deploy still looks safe

Highest-value fixes before updating the candidate:
- **Medium:** clear `delegatePendingFlags` on failed delegate spawns (`subagent-announce.ts:703-707, 838-842`)
- **Medium:** add `request_compaction` registration visibility tests (`continuation-tools-registration.test.ts`)
- **Low:** add `drift < 0` guard in generation checks (`subagent-announce.ts:727, 859`)
- **Low:** make `clearTrackedContinuationTimers` ref releases synchronous (`continuation-state.ts:103-106`)

Coverage note from review:
- approximately **3,124 lines** across **12 continuation-specific test files**

Current handoff interpretation:
- candidate is close
- not fully PR-ready until the medium findings are dispositioned

Disposition calls from Ronan:
- **must patch before candidate update:** clear `delegatePendingFlags` on failed delegate spawns
- **should patch if fast, but not candidate-blocking alone:** add `request_compaction` registration visibility tests

## Separate auth-pool regression finding (NOT a continuation bug)

**Important**: #148 is a pre-existing auth-layer regression, not a continuation-plumbing finding. It contaminated provider-dependent swim results but has nothing to do with continuation infrastructure. It should NOT be swept into the continuation PR candidate changes — it ships on its own branch, own scope, own rationale.

Later verification in the candidate source confirmed a distinct auth-pool regression:
- `src/agents/github-copilot-token.ts:19` resolves the bearer cache to a single hardcoded path
- path: `~/.openclaw/credentials/github-copilot.token.json`
- this means per-profile bearer cache isolation is not wired for `github-copilot:github` vs `github-copilot:pool-1`

Operational consequence:
- named profile bearer files can go stale while the unnamed default bearer keeps refreshing
- provider-profile rotation collapses onto one cache path per box
- this cleanly explains the observed auth contamination without implying one copied bearer across all princes

Readiness consequence:
- this should be treated as **patch before candidate update**, not accepted as known risk
- reason: it directly muddies provider-heavy swim results and defeats the intended auth-profile behavior
- Ronan explicitly called this as a candidate-readiness item: continuation lane remains separate, but auth-pool / bearer-cache regression must be patched or explicitly carved out before the candidate is called broadly ready

## F1 evidence scaffold

### F1a — 15s clean probe (pre-matrix finding)
Ronan first called a 15s clean probe for Silas:
- tool: `continue_work`
- delay: **15s**
- marker/text: `swim-29-f1-baseline`

Observed schedule report in-channel:
- schedule message id: `1493645893092643029`
- reported tool: `continue_work`
- reported delay: **15s**
- reported marker: `swim-29-f1-baseline`

Observed F1a timing result:
- scheduled at: **09:16:22 PDT**
- woke at: **not observed by 09:17:28 PDT**
- drift: **N/A — no wake surfaced cleanly**

Ledger call:
- **F1a (15s clean probe): FINDING**
- not counted as the formal matrix F1 because Ronan later said the delay deviated from issue spec

### F1 — formal matrix run
Ronan then called the actual matrix F1 for Silas:
- tool: `continue_work`
- delay: **0s**
- marker/text: `swim-29-f1-zero`

Cael evidence role for F1:
- capture schedule timestamp
- capture wake timestamp / message id
- capture relevant journal lines if available
- append here as canonical swim handoff evidence

Observed formal F1 timing result:
- scheduled at: **09:18:44 PDT**
- woke at: **not observed cleanly after schedule**
- drift: **N/A — no clean wake surfaced**

Ledger call:
- **F1 (0s matrix baseline): FINDING / no clean wake surfaced**

## R1 evidence scaffold

Ronan then called **R1 — boot-time stall check on Silas** with instructions:
- restart gateway once
- report only:
  - restart command time
  - Discord/session ready time

Cael evidence role for R1:
- capture reported restart command time
- capture reported Discord/session ready time
- append here as canonical swim handoff evidence

Observed peer-bounce action for R1:
- restart command time: **09:21:23 PDT**
- command executed by Cael over SSH: `ssh silas.dandelion.cult 'systemctl --user restart openclaw-gateway'`
- first post-restart message/event seen: **09:21:55 PDT**
- boot-to-ready (first observed event): **~32s**
- Discord/session ready time reported by Silas: **09:22:13 PDT**
- boot-to-ready (session ready): **~50s**
- at ~53s post-restart: **~822 MB RSS**, **71.3% CPU**

Ledger call:
- **R1 = PASS**
- notable caveat: slower than target from issue spec (`<10s`), but not a stall/wedge
- note: first observed event and Silas-reported ready time differ; keep both timestamps in the record

## R2 evidence scaffold

Ronan then called **R2 — memory growth over 30 min** on Silas.

Instructions:
- capture RSS every 5 min
- no extra load beyond normal channel participation

Cael evidence role for R2:
- collect periodic RSS evidence if available
- append samples here with timestamps
- keep this document as the canonical swim handoff ledger

Status: R2 started.

Observed R2 samples so far:
- ~09:26 PDT peer observation: **~1.07 GB RSS**, **~4:54 uptime**
- **09:38:27 PDT** Silas self-report: baseline **09:21:23 PDT**, uptime **16m59s**, gw RSS **~1.18 GB**, CPU **8.6%**
- **09:38:34 PDT** Cael SSH sample: **~890 MB RSS**, **8.6% CPU**, **17:06 uptime**

Observed R2 samples so far:
- ~09:26 PDT peer observation: **~1.07 GB RSS**, **~4:54 uptime**
- **09:38:27 PDT** Silas self-report: baseline **09:21:23 PDT**, uptime **16m59s**, gw RSS **~1.18 GB**, CPU **8.6%**
- **09:38:34 PDT** Cael SSH sample: **~890 MB RSS**, **8.6% CPU**, **17:06 uptime**
- **09:48:27 PDT** Cael SSH sample: **~1.11 GB RSS**, **8.9% CPU**, **27:00 uptime**
- **10:09:13 PDT** Cael SSH sample: **~1.09 GB RSS**, **6.9% CPU**, **47:46 uptime**

R2 closeout read:
- gateway remained up through and well past the 30 minute mark
- no wedge, no obvious cliff, and no clear runaway growth in the observed window
- memory stayed in the rough ~0.9 to 1.2 GB band across observed samples
- self-reported RSS and Cael SSH samples differ, so preserve both in the record rather than collapsing them

Ledger call:
- **R2 = PASS** for sustained liveness / no obvious runaway in the observed 30 minute window

## R4 evidence scaffold

Ronan then called **R4 — recovery after gateway restart** for Silas.

Requested fields:
- current model/provider
- current context %
- whether all 3 continuation tools are visible
- whether the same `#sprites` session survived the restart intact

Cael evidence role for R4:
- capture Silas response exactly
- append here as canonical swim handoff evidence

Observed R4 report from Silas:
- current model/provider: **github-copilot / gpt-5.4**
- current context %: **24%**
- all 3 continuation tools visible: **yes** (`continue_work`, `continue_delegate`, `request_compaction`)
- same `#sprites` session survived restart intact: **yes** — still `agent:main:discord:channel:1466192485440164011`

Ledger call:
- **R4 = PASS** for session continuity after restart
- note: provider/model returned as **github-copilot / gpt-5.4**, not Opus, which also supports the ongoing override-drift story

## P2 evidence scaffold

Ronan then called **P2 — `delegatePendingFlags` lifecycle** as an evidence check, not a noisy behavior test.

Instruction state so far:
- Silas was told **not to fire anything yet**

Cael evidence role for P2:
- capture the exact evidence-check instructions and any resulting observations
- append here as canonical swim handoff evidence

Observed P2 evidence check from Cael:
- checked active `#sprites` session entry in `~/.openclaw/agents/main/sessions/sessions.json`
- externally visible fields relevant to continuation state on Cael currently show:
  - `continuationChainCount: 0`
  - `pendingPostCompactionDelegates`: present, but unrelated historical post-compaction delegate entries
- no externally visible `delegatePendingFlags` / stuck delegate-pending field is surfaced in the active session entry
- no adjacent runtime evidence I checked exposed a current stuck delegate-pending state directly

Ledger call:
- **P2 = FINDING (code-reviewed, not yet runtime-proven externally)**
- rationale: the leak / lifecycle concern is supported by code review, but I cannot currently prove a stuck delegate-pending runtime state from the externally visible session/runtime surfaces available to me
- code-level statement captured from Ronan: failed delegate spawns in `subagent-announce.ts` set pending state and the reviewed failure paths do not obviously clear it inline, so the flag can leak until a later cleanup path self-heals it

## P1 evidence scaffold

Ronan then called **P1 — structured continuation wake evidence**.

Instructions for Silas:
- do not create new noisy delegate traffic yet
- check whether journal from earlier TC3 / F1 attempts contains any explicit structured wake marker or `delegate-return` style continuation trigger
- if yes, quote the exact line
- if no, say no explicit marker seen

Purpose:
- separate "wake plumbing absent" from "wake plumbing present but surfacing failed"

Cael evidence role for P1:
- capture Silas response exactly
- append here as canonical swim handoff evidence

Observed P1 report from Silas:
- explicit structured wake evidence **does exist** in journal for earlier delegate traffic
- but **not for the failing Swim 29 F1 attempts**

Quoted evidence from Silas's report:
- **LINE 16280** — internal completion event for a delegate result:
  - `"[Internal task completion event]"`
  - `source: subagent`
  - `task: [continuation:chain-hop:1] Delegated task (turn 1/100): swim-28-tc3-delegate-proof ...`
  - `status: completed successfully`
- **LINE 16259** — follow-on action right after that landed:
  - `"Good — my first delegate landed (chain-hop:1). Now firing Ronan's requested silent-wake with marker."`

Ledger read so far:
- structured wake plumbing is **present somewhere in the journal history**
- but the failing Swim 29 F1 lane still lacks equivalent clean surfaced wake evidence from the report we have
- preserve this as a distinction between "wake plumbing absent" and "wake plumbing present elsewhere but not surfacing cleanly on the failing attempts"

Ledger call from Ronan:
- **P1 = FINDING, not failure**
- **wake plumbing present** for structured delegate-return path
- **current Swim 29 attempts** did not yield a clean equivalent explicit wake marker
- this points to **surfacing / scheduling-path sickness on these attempts**, not total absence of wake plumbing

## P3 evidence scaffold

Ronan called **P3 — timer-handle disposal / cancellation**.

Instructions:
- Silas fires `continue_delegate` with delay **30s**, mode **normal**, task `swim-29-p3-cancel`
- Cael sends plain marker `swim-29-p3-poke` at +5s after Silas confirms schedule
- Pass criteria: delayed delegate is **canceled** by inbound poke, **no spawn**, **no marker delivery**, **no wake/surfacing**

### P3 attempt 1 (pre-compaction, invalid)
- Ronan called P3 at ~10:49 PDT
- Compaction #14 fired at ~11:00 PDT before Cael could execute
- Cael correctly held: did not send poke
- Ledgered as **INVALID / NOT-RUN**

### P3 attempt 2 (11:05-11:08 PDT)
- Silas confirmed schedule at: **11:05:57 PDT** (msg `1493673802586914967`)
- Cael sent `swim-29-p3-poke` at: **~11:06 PDT** (msg `1493674218112553000`)
- Silas P3 readout:
  - scheduled at: **11:05:57 PDT**
  - poke: **not observed in Silas session transcript**
  - delegate spawn/announce: **none observed**

### P3 take 3 (11:27-11:33 PDT, FINAL)
- Silas scheduled at: **11:27:19 PDT** (msg `1493679063292969000`)
- Cael poke at: **11:28:21 PDT** (msg `1493679323306131622`)
- delegate spawn/announce: **none observed**
- 11:32 Silas re-issue: **unscored overlap** per Ronan

### P3 final ledger (Ronan, 11:33 PDT)
- **P3: INCONCLUSIVE**
- Evidence leans toward healthy cancellation / no visible misfire
- But not clean enough for PASS
- **P3 frozen. No more retries.**

## Candidate-readiness update (11:12 PDT)

- **done:** `#150` at `a3e6cb25de` (delegatePendingFlags cleanup)
- **done:** `#414` at `fix/414-raw-key-sweep-cael` (raw-key sweep, 103/103 tests)
- **still must patch:** **#148** auth-pool / bearer-cache regression
- **should patch if fast:** **#151** `request_compaction` visibility coverage

## Swim 29 Final Interpretation (Ronan, 11:26 PDT)

### Continuation Ledger
- **TC1:** PASS
- **TC2:** PASS
- **TC3:** schedule/accept PASS, return/surfacing **INCONCLUSIVE**
- **TC4:** FINDING (override resurrection/drift)
- **F1 / F1a:** FINDING (no clean wake surfaced)
- **R1:** PASS (slow boot, ~32s first event / ~50s session ready)
- **R2:** PASS (no wedge/runaway, RSS ~0.9-1.2 GB band)
- **R4:** PASS (session continuity after restart)
- **P1:** FINDING, not failure (wake plumbing present, surfacing sickness on specific attempts)
- **P2:** FINDING (code-reviewed, not runtime-proven externally)
- **P3:** INCONCLUSIVE (poke sent but not observed on SUT lane)

### Continuation Verdict
- **Not broken.** No evidence that `v2026.4.12` broke continuation as a product surface.
- Mix of passes plus inconclusive surfacing-path results.
- Right call: **not broken, but not perfectly characterized under noisy conditions.**

### Separate Auth Note
- **#148 is real and fixed** (`c62eb34e7c`).
- **#148 is NOT a continuation finding.** It is auth/provider infrastructure.
- It contaminated provider-dependent observations but does NOT belong in the continuation feature verdict.

### Candidate Call
- With **#150** and **#151** landed, and **#148** fixed separately:
- **`35cfaf5b50` is ready for candidate update / PR-readiness on the continuation lane**
- Caveat: some wake/surfacing evidence stayed inconclusive rather than green.

## Patch status update (11:25 PDT)

- **#150 shipped** at `a3e6cb25de` — `delegatePendingFlags` leak fix (Silas, Claude Code)
- **#151 shipped** at `ad4de9130e` — `request_compaction` visibility tests (Elliott wrote, Cael committed, Ronan + Cael validated)
- **#148 shipped** at `c62eb34e7c` — per-profile bearer cache isolation (Silas, Claude Code)
  - bearer refresh cache now keyed by auth profile
  - `github-copilot:github` and `github-copilot:pool-1` resolve to distinct cache files
  - `profileId` threaded through Copilot token call sites
  - regression tests added for cache isolation + fallback
  - **#148 is NOT a continuation finding** — it is auth/provider infrastructure, ships separately
- **#414 shipped** at `fix/414-raw-key-sweep-cael` — raw-key sweep (Cael, recovered from SIGKILL'd agent)

All must-patch items before candidate update are now done.

## Follow-up items after swim

- Re-auth Cael away from `karmafeast` at the `gh auth` layer if still wrong
- Re-run provider-dependent swim blocks only after auth topology is repaired / clarified
- Write final Swim 29 Interpretation without collapsing continuation verdict and auth contamination into one product claim
