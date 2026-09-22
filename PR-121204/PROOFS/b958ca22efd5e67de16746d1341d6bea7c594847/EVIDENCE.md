# PR #121204 exact-head evidence

## Verdict

Evidence is being gathered for product head
`b958ca22efd5e67de16746d1341d6bea7c594847`.

The exact product head is merged, without flattening, into proof composite
`0dec285645550f6ca4d2da0cb0153ee95acf9f6a`. Its other parent is the existing
frond composite `310252733a626568c98071bdaf9ee09dbdf38a88`, which preserves the
princes' elective-continuation runtime and the separate Discord poison-event
dead-letter cure.

Static, deterministic, and live Discord proof is complete for the narrow stale
ingress correction. Typed continuation is also green on the same execution
SHA. Bracket-token continuation is explicitly red and receives no proof credit.

## Exact identities

| Role | SHA |
| --- | --- |
| Upstream PR #121204 head | `b958ca22efd5e67de16746d1341d6bea7c594847` |
| Existing frond composite | `310252733a626568c98071bdaf9ee09dbdf38a88` |
| Proof execution composite | `0dec285645550f6ca4d2da0cb0153ee95acf9f6a` |
| Pre-fix fossil commit | `e1ec70fa07d3cefd6eaa1cf781d5cc99d2643101` |
| Historical fossil report | `0c9072e54b938fed367bb18942b0519ea07a306c` |

`COMPOSITE-ANCESTRY.txt` proves that both the product PR head and the existing
frond composite are ancestors of the proof execution SHA. The merge delta from
the prior composite is only two Discord owner files: 13 insertions and 11
deletions.

## Reproduced failure and repair

The production-shaped Fossil A fixture is a Discord guild `MESSAGE_CREATE`
containing numeric top-level `channel_type` and no invented hydrated `channel`
object.

On the pre-fix composite `310252733a626568c98071bdaf9ee09dbdf38a88`,
the fossil is deterministically red:

```text
expected [ "fossil-a-stale-ambient", "fossil-a-fresh-mention" ]
to deeply equal [ "fossil-a-fresh-mention" ]
```

The stale ambient row dispatches as a current turn before the fresh addressed
row. See `static/FOSSIL-A-PREFIX-RED.log`.

On proof composite `0dec285645550f6ca4d2da0cb0153ee95acf9f6a`,
the identical fossil is green: the stale ambient row receives
`stale-ambient-backlog`, and only the fresh addressed row dispatches. See
`static/FOSSIL-A-FIXED-GREEN.log`.

## Focused exact-composite suites

All commands used the repository wrapper and `--maxWorkers=1`.

| Surface | Result |
| --- | --- |
| Discord ingress, direct-config, import boundary | 40/40 |
| Generic channel ingress drain/freshness/disposition | 37/37 |
| Retry-delay policy | 3/3 |
| Telegram sibling using the generic drain | 5/5 |
| **Total** | **85/85** |

Logs and checksums are under `static/`.

## Safety contract

- Numeric real-wire `channel_type` takes precedence.
- Existing hydrated `channel.type` remains a fallback.
- DMs, mentions, replies, commands, audio candidates, threads, and uncertain
  rows continue to dispatch.
- Missing or non-numeric channel type deliberately fails open. Discord's
  gateway type declares `channel_type` optional, and an unknown row cannot be
  safely distinguished from an unhydrated thread.
- The composite's `deadLetterMinAgeMs: 0` policy is separate: it bounds genuine
  Discord dispatch poison events and does not authorize stale suppression.
- No schema, migration, config, dependency, or continuation surface changes.

## Live proof contract

Live proof must use exact execution SHA
`0dec285645550f6ca4d2da0cb0153ee95acf9f6a` on Silas and preserve:

1. build identity, dist count, gateway health, and clean ingress integrity;
2. a payload-free `discord ingress stale ambient backlog suppressed` receipt
   for a real-shaped stale ambient event;
3. prompt admission and response for fresh addressed work;
4. elective continuation on the same execution SHA, including typed and
   token/bracket entry forms;
5. no synthetic database injection and no proof credit from another SHA.

Dry-run deployment receipt:
<https://github.com/karmaterminal/openclaw-bootstrap/actions/runs/31711731449>

Live deployment run:
<https://github.com/karmaterminal/openclaw-bootstrap/actions/runs/31712188114>

Post-migration deployment run:
<https://github.com/karmaterminal/openclaw-bootstrap/actions/runs/31717310841>

## Live exact-SHA results

Silas was recovered onto exact execution SHA
`0dec285645550f6ca4d2da0cb0153ee95acf9f6a` with:

- `HEAD == build-info == 0dec285645550f6ca4d2da0cb0153ee95acf9f6a`;
- 16 package dists;
- gateway health 200;
- ingress and agent database `quick_check=ok`;
- agent database schema 17.

The official `channels dead-letters resubmit` command re-enqueued one retained
real guild event without printing or modifying its payload. Resubmission reset
queue age, so the gateway was stopped before retry 8 and the row aged naturally
past the 15-minute threshold. On restart:

| Receipt | Value |
| --- | --- |
| Source event | `1536809450147422268` |
| Received at | `2026-08-13T16:00:03.471Z` |
| Observed age | `969152ms` |
| Threshold | `900000ms` |
| Attempts before/after | `7` / `7` |
| Disposition | `failed` |
| Reason | `stale-ambient-backlog` |
| Journal receipt | `discord ingress stale ambient backlog suppressed` |

The unchanged exact runtime then admitted and visibly answered fresh addressed
work:

| Receipt | Value |
| --- | --- |
| Request | `1537503743359189128` |
| Response | `1537503822341996666` |
| Ingress result | `completed`, attempts `0` |
| Request-to-response latency | about 27 seconds |

Typed continuation also passed in a dedicated Discord session on the same
runtime:

| Receipt | Value |
| --- | --- |
| Typed request | `1537505186363351201` |
| Visible response | `1537505290818162739` |
| Runtime signal | `origin=tool-call kind=work` |

`LIVE-PROOF.json` retains the machine-readable, payload-free ledger.

## Honest limits

- Bracket-token continuation is red on this composite. Request
  `1537506217407156295` produced response `1537506337150210168`, but runtime
  logged `origin=none kind=none`; no bracket proof credit is claimed.
- During recovery, a separate accepted-before-adoption lifecycle defect could
  leave a terminal restart claim blocking later turns. One exact exhausted
  claim was retired through OpenClaw's canonical session accessor after stopped
  SQLite backups; transcript and session identity were preserved.
- The fence intentionally does not expire legacy/unknown channel-type rows.
- Fossils B/C in the historical report identify a separate core watchdog
  disposition defect. They are not claimed fixed by PR #121204.
- No message bodies, usernames, channel names, credentials, or sovereign data
  are included in this packet.
