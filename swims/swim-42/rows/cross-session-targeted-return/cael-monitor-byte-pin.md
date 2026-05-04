# swim-42 / cross-session-targeted-return — cael-seat independent byte-pin

**Status**: independent attestation — fourth-seat byte-pin closes the cohort cross-host attestation on OV-1 fire-1 explicit-targeting axis NOT being a PASS.

## Evidence layer

Per `swims/swim-42/EVIDENCE-LAYERS.md`: this attestation is at the **recipient-delivery** layer (registry-side `owner_key` for the named recipient session).

## Byte-pin from cael-host

cael-seat queried his own `~/.openclaw/flows/registry.sqlite` for the named recipient session:

- **8 historical rows** with `owner_key = agent:main:main` exist on cael-host (the recipient session has produced rows in the past — substrate is real, not a name typo)
- **0 rows** with `owner_key = agent:main:main` in the swim-42 window — latest historical row is `2026-04-28 13:17:09`, all prior to this swim
- recent flow_runs from this evening are owned by `agent:main:discord:channel:1466192485440164011` (246 rows total) — same dispatcher-owned pattern as elliott-host

## What this rules out / rules in

**Rules out**:
- runner-seat-local artifact (already ruled out by elliott-host)
- "the recipient session never existed" hypothesis — the 8 historical rows confirm `agent:main:main` is a real session that does receive flow_runs when targeted

**Rules in**:
- the substrate-finding is genuinely cross-host on this fire specifically
- the recipient session can hold flow_runs (so the 0-rows-in-window result is not a session-doesn't-exist artifact)
- something specific to the OV-1 fire-1 explicit-targeting path resulted in zero recipient-owned rows despite the request being accepted and the dispatcher-side state machine completing cleanly

## Joint attestation (now 4/4)

| Seat | Layer | Attestation |
|---|---|---|
| 🌊 runner | dispatcher health + surface announce | dispatcher-side `flow_run` `8b402f1b-…` `succeeded` with `state_json.targetSessionKey: "agent:main:main"`; subagent reply surfaced as runtime task-completion mirrored to dispatcher |
| 🌫 SUT | dispatcher health (default-targeting axis only) | silas-host independent default-axis canary clean |
| 🌻 monitor | recipient delivery | elliott-host registry: 0 rows with `owner_key = agent:main:main` from this fire |
| 🩸 deployer (on-call) | recipient delivery + historical baseline | cael-host registry: 0 rows with `owner_key = agent:main:main` in swim-42 window; 8 historical rows confirm the recipient session is real |

## Cohort verdict

**OV-1 fire-1 explicit-targeting axis is NOT a PASS** — confirmed by 4/4 prince seats via independent byte-pin at the recipient-delivery layer. The actual open question for figs / cohort eyes remains the same two readings runner-seat surfaced:

1. **(intended)** `targetSessionKey` is a returnability/visibility hint and the runtime mirrors the subagent reply back to the dispatcher; tool description is then misleading and OV-1 acceptance shape needs re-cast
2. **(bug)** `targetSessionKey` is silently retargeting back to the dispatching session; #551 cross-session primitive is not actually landing cross-session

**Recipient-side byte-pin is what would distinguish them**: if the substrate intends to deliver to the named target but a mirror also surfaces at dispatcher, recipient-side `flow_run` ownership should still be the named target. If recipient-side `flow_run` ownership is dispatcher (current observation), the runtime is either (a) intentionally dispatcher-owning the row and using `targetSessionKey` only as a hint, or (b) the routing logic is silently dropping the target.

Substrate-finding remains pending figs / cohort eyes; the cohort byte-pin work is complete.
