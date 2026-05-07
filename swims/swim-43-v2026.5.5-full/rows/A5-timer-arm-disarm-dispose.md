# swim-43/A5 — Timer arm/disarm/dispose on deployed v5.5

## Claim being banked

On deployed v5.5 substrate, delayed normal `continue_delegate` arms once, fires once when allowed to mature, and does not double-fire. The inherited "ordinary inbound cancels delayed delegate" reading does **not** hold on the public substrate and was method-broken as written.

## Fire history

### Fire 1 — inherited cancel-via-inbound wording

**Verdict:** `METHOD-BROKEN` on the inherited row wording.

Cael-seat fired delayed normal delegate `A5-CANCEL-1` with inbound traffic landing during the delay window. The delegate still fired and returned the nonce. Source-walk + runtime evidence converged on the sharper substrate truth: **ordinary inbound / channel noise is not a cancellation surface for delayed continuation work on deployed v5.5**. The row-method assumed a cancel mechanism the public substrate does not expose/claim for ordinary inbound chat.

Preserved substrate finding from fire-1:
- delayed `continue_delegate(mode:"normal", delaySeconds:60)` is **not** implicitly cancelled by ordinary inbound
- same family as earlier `continue_work` negative result
- this fire also acts as corroboration for B4's noisy-delayed-delegate PASS shape

### Fire 2 — let-fire half

**Verdict:** `PASS`.

Cael-seat fired:

```text
continue_delegate(mode:"normal", delaySeconds:60, task:"A5-FIRE-2 nonce=A5-FIRE-2 return verbatim")
```

Pinned pre-fire state:
- `T0 = 1778193772` (`2026-05-07 15:42:52 PDT`)
- scheduled wake target: `15:43:52 PDT`
- pre-fire substrate: `162 total flow_runs / 0 queued+runnable`
- registry md5: `02b7185b55dd1e03a90c349a37864e05`

Observed three-source PASS shape:
- one visible return: `🩸 [A5-fire-2-return] NONCE:A5-FIRE-2 — let-fire-half delegate fired at 15:44 PDT after 60s delay.`
- one journal `Consuming` line at `15:44:11`
- one journal `delegate-spawned` line at `15:44:12`
- one child return at `15:44:23`
- post-fire `flow_runs`: `164 total / 0 queued+runnable` (delta `+2` = exactly one marker + one child-spawn)
- marker `3140728b-...` released to scheduler at `15:44:11`
- child-spawn `fe357409-...` succeeded at `15:44:22`
- registry md5 stable
- no doubling / no ghost second return

Tail-latency note:
- actual wake landed ~`+19s` later than nominal `T0+60s`, tighter than earlier cael-host delayed wakes that day

## Row verdict

**PASS**.

The deployed-v5.5 A5 row is honestly banked as:
- fire-1 `METHOD-BROKEN` on inherited cancel-via-ordinary-inbound wording, with the negative substrate finding preserved
- fire-2 `PASS` on the let-fire half with clean three-source single-fire evidence

This matches the same banking pattern used in A1: an early method-broken fire does not block row-level PASS when the substantive row claim is later re-run and banked cleanly.

## Notes for rewrite / successor split

If A5 is later rewritten for sharper substrate truth, the natural split is:
- **A5a** ordinary inbound does **not** cancel delayed delegate
- **A5b** real preemption/cancel path via directive / inline-action / slash surface

Until then, this row preserves both the old-method failure and the clean let-fire-half PASS without discarding the negative finding.
