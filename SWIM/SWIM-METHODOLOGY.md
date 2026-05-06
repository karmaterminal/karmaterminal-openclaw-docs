# Swim Methodology — Lessons from Swim 11

**Date:** 2026-04-06
**Source:** Swim 11 (continuation feature verification)
**Prior art:** Swim 9 plan, Swim 10 plan (never executed)

---

## Fixed Roles (from Swim 9, reconfirmed by figs)

| Role | Prince | Responsibility |
|------|--------|---------------|
| **SUT** (Subject Under Test) | Silas 🌫️ | Canary box. All deploys land here first. Reports tool availability, tool call results, system messages. |
| **Driver** (Test Administrator) | Ronan 🌊 | Calls tests, fills result cells, coordinates phases. Posts scoreboard. |
| **Deployer** (Build Handler) | Cael 🩸 | Builds, deploys to SUT via SSH, verifies dist. All code deploys go through Cael. |
| **Monitor** (Infrastructure) | Elliott 🌻 | SSH log tail on SUT, config verification, gateway restarts. Independent evidence collection. |
| **Adjudicator** | figs | Ground truth, operator decisions, override authority. |

These roles are **fixed across swims**. Not negotiated per-swim.

---

## Pre-Swim Checklist

1. All princes read the swim plan and agree on roles
2. SUT identified (always Silas unless figs overrides)
3. Fix branch identified and reviewed by at least 2 princes
4. Deploy to SUT: `npm install` (NO `--ignore-scripts`), build, verify dist, restart
5. **Post-deploy validation (MANDATORY):**
   - Confirm build commit via `/status` or SSH
   - Confirm tool availability by listing structured tool definitions
   - Confirm model and activation mode
   - Confirm config values loaded correctly (not stale from prior startup)
6. **Driver code-read and coord concur (MANDATORY, added Swim 34):**
   - Driver reads the candidate SHA's actual diff and posts a summary: SUT surface, preserved vs. changed behaviour, which row invariants exercise the refactor surface (and which do not)
   - Coord reads independently and posts a concurring or dissenting summary
   - Two independent reads meeting at shared understanding gates Block A
   - Gate is comprehension-shaped, not time-shaped — an expired timer does not authorise rebuild-and-run
   - See `lessons/swim-34-prereq-code-comprehension.md`

---

## Evidence Standards

### Three independent sources needed for critical results:
1. **SUT self-report** — tool call returns, system messages in context
2. **SSH gateway logs** — timer events, delegate spawns, tool registration
3. **Session transcript on disk** — JSONL entries proving tool calls happened

### What counts as evidence:
- ✅ Tool returning `{status: "scheduled"}` — proves tool is registered and callable
- ✅ `WORK timer fired` in gateway journal — proves scheduler ran
- ✅ `[continue_delegate] Consuming N tool delegate(s)` in journal — proves dispatch
- ✅ Tool entries in session JSONL — proves tool calls happened on disk

### What does NOT count:
- ❌ "I remember it working" — memory is unreliable post-compaction
- ❌ Prince echo of another prince's claim — cascade pattern
- ❌ Code existing in source — tool may exist but not be wired (Swim 11 lesson)

---

## Lessons from Swim 11

### 1. Validate tool + token presence after every deploy to SUT
The entire first half of Swim 11 was discovering that tools existed in source but didn't reach the model. Phase 1 (tool availability) catches this immediately.

### 2. Observer queue depth > 10 = compromised observations
Ronan (120 queued) and Cael (86 queued) had unreliable observations. Only the SUT (Silas) had clean context. figs caught this: "are you certain?"

### 3. Deploy checklist: never `--ignore-scripts`
Cael's first deploy to SUT crashed (missing `@buape/carbon`) because `npm install --ignore-scripts` skipped postinstall hooks.

### 4. Config reads at startup, not hot-reload for all fields
Config changes after gateway start require restart. Don't debate "display bug vs config bug" — just restart and check.

### 5. `message` tool bypasses response parser
Bracket stripping tests (6-5) were contaminated because SUT used `message` tool to post bracket text. The `message` tool posts directly to Discord, bypassing the response parser. Clean stripping tests need response-text-only path.

### 6. Bracket tokens leak into output; tool calls don't
Bracket syntax (`CONTINUE_WORK`, `[[CONTINUE_DELEGATE:]]`) leaks to Discord. Tool calls (`continue_work()`, `continue_delegate()`) don't. This is an argument FOR tool parity over bracket fallbacks.

### 7. The graft-loss pattern: check ALL files before deploying
Cael's wiring fix took 6 files and 3 deploy cycles because files were discovered incrementally. `git diff --stat backup HEAD` before starting identifies all files at once.

### 8. SUT self-report + tool call results ARE valid evidence
Successfully calling a tool that "doesn't exist" is impossible. `{status: "scheduled"}` from `continue_work` proves the tool is registered. The tool call IS the test.

### 9. "The file is the truth, not the room"
Config cascades, confabulation cascades, and echo cascades all stem from trusting the room over the file. `grep` before claiming. SSH before asserting. Read before speaking.

---

## Method correction from later stabilization swims

Swim 11 still reflects an earlier reflex: treat a live slice as enough once the first real finding appears. Later work clarified the distinction more sharply:

- For **stabilization / pre-ship swims**, a partial board is still real evidence, but it is **not totality**.
- If the question is "can we ship this jacket?" then run the **whole board unless genuinely blocked**.
- The point is to see the back of the jacket too — later rows often reveal systemic patterns that the first finding alone does not.
- For **exploratory / development swims**, partial slices are still valid when the question is "what does this half-born thing do?"

Short version:
- **point-break** when the room is actively bleeding
- **whole-board** when the question is ship-readiness / stabilization

## Swim 12 Improvements

- [ ] Add `openclaw agent --message` test for bracket stripping (figs suggestion)
- [ ] Phase 1 becomes mandatory gate — no proceeding until ALL expected tools confirmed
- [ ] Observer role requires queue depth < 10 to claim observations
- [ ] Deploy checklist automated in ansible (build + verify + restart + validate)
- [ ] Deferred tests from Swim 11: high-context pressure bands, chain depth enforcement, fleet config convergence
