# Continuation propensity

**Offline rehearsal against the fake gateway. Every number below is scripted; none is about a model.**

Model `openai/gpt-6.1-sol`, no fallbacks; a trial any other model served is unscored. 5 repetitions per prompt and arm. Rates are trials whose turn called a continuation tool, over scored trials.

| arm | eligible: elected | rate | Wilson 95 % | control: elected | rate | Wilson 95 % | unscored |
| --- | --- | --- | --- | --- | --- | --- | --- |
| A | 3/60 | 5.0 % | 1.7–13.7 % | 0/30 | 0.0 % | 0.0–11.4 % | none |
| B | 22/60 | 36.7 % | 25.6–49.3 % | 1/30 | 3.3 % | 0.6–16.7 % | none |
| C | 45/60 | 75.0 % | 62.8–84.2 % | 3/30 | 10.0 % | 3.5–25.6 % | none |
| D | 33/60 | 55.0 % | 42.5–66.9 % | 1/30 | 3.3 % | 0.6–16.7 % | none |

## Comparisons (eligible election rate)

| comparison | difference | Newcombe 95 % | prompt bootstrap 95 % | reading |
| --- | --- | --- | --- | --- |
| A → B: visibility (all tools direct) | +31.7 pp | +17.6 to +44.7 pp | +23.3 to +40.0 pp | effect |
| B → C: composite: new text + direct-set narrowing | +38.3 pp | +20.7 to +52.7 pp | +33.3 to +43.3 pp | effect |
| B → D: wording (all tools direct) | +18.3 pp | +0.5 to +34.6 pp | +15.0 to +20.0 pp | effect |
| D → C: placement: direct-set narrowing (new text) | +20.0 pp | +2.9 to +35.5 pp | +15.0 to +25.0 pp | effect |
| A → C: deploy of f9fcd3a5 (descriptive) | +70.0 pp | +55.0 to +79.8 pp | +61.7 to +78.3 pp | effect |

What each comparison is:

- **A → B**: same build and text. B makes every tool direct, not only the continuation tools, so this is the effect of an all-direct surface.
- **B → C**: not the wording effect. C has the new text, and it also narrows the direct set: B makes every tool direct, while C adds only the three continuation tools to the fleet default's direct set. Arm D separates the two.
- **B → D**: every tool is direct in both; only the text differs. On the Codex harness D's continuation tools also move into the openclaw_direct namespace.
- **D → C**: same build and text; C goes back to the fleet default's direct set plus the three continuation tools. B → D and D → C add up to B → C.

## Surface

- **A**: surface: verified 89, carried 1; description text: none; runtime: openclaw 90; served: openai/gpt-6.1-sol 90; tools: 7 direct and 5 deferred 90; contradictions: 0; caps verified: 90; continuation wakes: 0; treatment limitations: 1 trial(s) (agents.defaults.subagents.maxChildrenPerAgent 1, cron.enabled 1), elected after one: 0.
- **B**: surface: verified 89, carried 1; description text: match 270; runtime: openclaw 90; served: openai/gpt-6.1-sol 90; tools: 9 direct and 0 deferred 90; contradictions: 0; caps verified: 90; continuation wakes: 0; treatment limitations: 2 trial(s) (agents.defaults.subagents.maxChildrenPerAgent 2, cron.enabled 1), elected after one: 1.
- **C**: surface: verified 90; description text: match 270; runtime: openclaw 90; served: openai/gpt-6.1-sol 90; tools: 10 direct and 2 deferred 90; contradictions: 0; caps verified: 90; continuation wakes: 0; treatment limitations: 2 trial(s) (agents.defaults.subagents.maxChildrenPerAgent 2, cron.enabled 1), elected after one: 1.
- **D**: surface: verified 89, carried 1; description text: match 270; runtime: openclaw 90; served: openai/gpt-6.1-sol 90; tools: 9 direct and 0 deferred 90; contradictions: 0; caps verified: 90; continuation wakes: 0; treatment limitations: 2 trial(s) (agents.defaults.subagents.maxChildrenPerAgent 2, cron.enabled 1), elected after one: 1.

## What was elected, and how

| arm | tools elected (trials) | fitting tool | accepted | how it was called | bracket form (not counted) | deadline | eligible rate if unreadable deadlines did not elect |
| --- | --- | --- | --- | --- | --- | --- | --- |
| A | continue_work 2, continue_delegate 1 | 3 | 3 | dispatcher 3 | continue_work 1, continue_delegate 0 | 1 | 5.0 % (3/60) |
| B | continue_work 18, continue_delegate 5 | 22 | 22 | direct 23 | continue_work 0, continue_delegate 0 | 1 | 36.7 % (22/60) |
| C | continue_work 36, continue_delegate 12 | 45 | 48 | direct 48 | continue_work 0, continue_delegate 0 | 0 | 75.0 % (45/60) |
| D | continue_work 26, continue_delegate 8 | 33 | 34 | direct 34 | continue_work 0, continue_delegate 0 | 1 | 55.0 % (33/60) |

## Discovery (`tool_search`)

- **A**: searched in 13 of 90 trials; before an election in 3. Queries: `reminder` ×10; `schedule my own follow-up turn later` ×2; `run work in another session` ×1; `delay a task` ×1.
- **B**: not observable on this surface.
- **C**: searched in 0 of 90 trials; before an election in 0. Queries: none.
- **D**: not observable on this surface.

## Per prompt (elected / scored)

| prompt | kind | fitting tool | A | B | C | D |
| --- | --- | --- | --- | --- | --- | --- |
| c1-arithmetic | control | — | 0/5 | 0/5 | 0/5 | 0/5 |
| c2-friendlier | control | — | 0/5 | 0/5 | 0/5 | 0/5 |
| c3-tcp-udp | control | — | 0/5 | 0/5 | 0/5 | 0/5 |
| c4-closing | control | — | 0/5 | 0/5 | 1/5 | 0/5 |
| c5-nothing-to-do | control | — | 0/5 | 1/5 | 2/5 | 1/5 |
| c6-hiking-club | control | — | 0/5 | 0/5 | 0/5 | 0/5 |
| w1-file-appears | eligible | continue_work | 1/5 | 2/5 | 4/5 | 3/5 |
| w2-guide-in-parts | eligible | continue_work | 0/5 | 2/5 | 4/5 | 3/5 |
| w3-cooldown | eligible | continue_work | 1/5 | 2/5 | 4/5 | 3/5 |
| w4-two-readings | eligible | continue_work | 0/5 | 2/5 | 4/5 | 3/5 |
| w5-section-reviews | eligible | continue_work | 0/5 | 2/5 | 4/5 | 3/5 |
| w6-notes-before-morning | eligible | continue_work | 0/5 | 2/5 | 4/5 | 3/5 |
| w7-build-result | eligible | continue_work | 0/5 | 2/5 | 5/5 | 3/5 |
| w8-three-timestamps | eligible | continue_work | 0/5 | 3/5 | 4/5 | 4/5 |
| d1-second-pair-of-eyes | eligible | continue_delegate | 1/5 | 1/5 | 3/5 | 2/5 |
| d2-blind-recheck | eligible | continue_delegate | 0/5 | 1/5 | 3/5 | 2/5 |
| d3-side-job | eligible | continue_delegate | 0/5 | 1/5 | 3/5 | 2/5 |
| d4-later-reading | eligible | continue_delegate | 0/5 | 2/5 | 3/5 | 2/5 |

## Cost and integrity

| arm | metered tokens | largest trial | model calls seen | distinct system prompts | extra trials not counted | scratch path present | record problems |
| --- | --- | --- | --- | --- | --- | --- | --- |
| A | 3,153,187 | 84,085 | 122 | 1 | 0 | 0 | 0 |
| B | 3,287,863 | 84,085 | 128 | 1 | 0 | 0 | 0 |
| C | 3,631,333 | 84,085 | 142 | 1 | 0 | 0 | 0 |
| D | 3,503,581 | 84,085 | 137 | 1 | 0 | 0 | 0 |

Metered tokens include cache reads. The spend stop (35,000,000 per arm) is checked between trials, so it is not a ceiling: what ends a trial that is running is the supervisor.

## Supervision

Limits: 700,000 metered tokens and 480 s per trial, 150,000 tokens outside a trial, 75,000,000 tokens and 14400 s for the run, 2 active runs per gateway, 10 s without a whole reading, a reading every 0.2 s.

Run: 13,575,964 metered tokens in 16.324 s; ended by run-finished; halted: no; supervisor lost: no.

| arm | metered tokens | trials | largest trial | longest trial | readings | longest gap | stopped by | proved stopped | durable units ended |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| A | 3,153,187 | 90 | 84,085 | 1.01 s | 172 | 0.223 s | run-finished | yes | 0 |
| B | 3,287,863 | 90 | 84,085 | 1.01 s | 172 | 0.223 s | run-finished | yes | 0 |
| C | 3,631,333 | 90 | 84,085 | 0.017 s | 172 | 0.223 s | run-finished | yes | 0 |
| D | 3,503,581 | 90 | 84,085 | 1.009 s | 172 | 0.222 s | run-finished | yes | 0 |
