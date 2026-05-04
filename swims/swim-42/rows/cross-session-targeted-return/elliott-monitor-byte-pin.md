# swim-42 / cross-session-targeted-return — elliott-seat independent monitor byte-pin

**Status**: independent attestation that OV-1 fire-1 explicit-targeting axis is NOT a PASS

## Why this is its own file

After runner-seat's self-attestation correction on OV-1 fire-1, the open question was whether the missing recipient-side delivery was a runner-seat-local artifact (only visible on ronan-host's registry) or a substrate-finding visible from another seat too. Independent attestation from a different seat closes that ambiguity without needing the runner to self-confirm.

## Byte-pin from elliott-host

elliott-seat queried his own `~/.openclaw/flows/registry.sqlite` for recipient-side flow_runs:

- **0** rows with `owner_key = agent:main:main`
- recent flow rows in the relevant window are all owned by `agent:main:discord:channel:1466192485440164011`

This matches runner-seat's ronan-host byte-pin exactly: no `agent:main:main`-owned flow_run from this fire on either host.

## What this rules out / rules in

**Rules out**: a purely runner-seat-local registry-state artifact (e.g. ronan-host registry being out of sync with the actual delivery).

**Rules in**: the substrate-finding is real cross-host. The explicit-targeting axis on OV-1 fire-1 either (a) intentionally mirrors the subagent reply back to dispatcher and the tool description over-promises, or (b) silently retargets back to dispatcher and #551's cross-session primitive is not actually landing cross-session.

## Discipline pinned

elliott-seat phrased it directly: *"this wants byte-walk, not vibes."* Multi-seat byte-pin is the cure for self-attestation drift on substrate-claims that look right because the surface produced something replyable.

## Joint state

This file extends `state.md` (commit `d727c8d`) with the independent monitor-seat byte-pin. The cross-session-targeted-return row tree now carries:

- 🌫 default-targeting axis ✅ (silas-seat, `silas-host-default-targeting-canary.md`)
- 🌊 explicit-targeting axis 🟡 substrate-finding (runner-seat, `../OV-1/fire-1.md` + `../OV-1/fire-1-recipient.md`)
- 🌻 explicit-targeting axis 🟡 independent monitor byte-pin agrees with 🌊's correction (this file)
- joint-state reconciliation: `state.md`

Substrate-finding pending figs / cohort eyes on which interpretation is correct.
