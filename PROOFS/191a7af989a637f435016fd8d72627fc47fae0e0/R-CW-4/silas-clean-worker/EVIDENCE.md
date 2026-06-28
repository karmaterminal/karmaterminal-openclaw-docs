# R-CW-4 clean-worker classification — HONEST_LIMIT / anomaly

**Row:** R-CW-4 — continue_work chain-depth tracking (`chain.step.remaining` / hop accounting)  
**Worker:** Silas clean worker (`agent:main:subagent:fd68ab7b-fc4a-47e0-9727-038c72d9a23d`)  
**Base docs ref:** `00464a25d91a26db445a69372e03baad555551d9`  
**Runtime SHA under corpus:** `191a7af989a637f435016fd8d72627fc47fae0e0`  
**Verdict:** `HONEST_LIMIT` — existing row proves wake delivery and visible hop markers, but the corpus evidence does **not** prove same-chain depth decrement/identity across turns.

## Why this is not a PASS yet

The current row evidence (`../cael-dgx/chain_depth_journal.txt`) contains visible wake markers:

```text
[continuation:work-wake] hop=1/200 ...
[continuation:work-wake] hop=2/200 ...
[continuation:work-wake] hop=3/200 ...
[continuation:work-wake] hop=4/200 ...
[continuation:work-wake] hop=5/200 ...
```

That is useful byte evidence for wake delivery and for the journal's human-readable `hop=N/200` counter. It is **not sufficient** for R-CW-4's stricter claim:

- no `chain.id` is present in those journal wake lines;
- no `chain.step.remaining` is present in those journal wake lines;
- the window contains repeated `hop=1/200` after the same session key, so the evidence can be explained by multiple fresh chains / duplicate hedges rather than a single chain identity decrementing over time;
- the k6 scenario in the same directory is `PARTIAL` because Tempo readiness failed (`[R-CW] tempo ready (trace correlation)` failed), so it did not independently correlate the journal markers to continuation spans for this capture.

Older corpus captures (for example `PROOFS/335acbe43a/R-CW-4/trace-*.json` and `PROOFS/7992640e60/R-CW-4/trace-turn2-935072d3.json`) include `continuation.work` spans with `chain.id` and `chain.step.remaining`, but those are not the deployed `191a7af...` corpus row and should not be used to certify this row as freshly passed.

## Minimal discriminator needed for PASS

A clean PASS needs at least two continuation-work receipts from the same chain showing either:

1. identical `chain.id` and monotonic `chain.step.remaining` decrement in `continuation.work` spans; or
2. journal wake lines that include an explicit stable chain identity plus monotonic hop/depth for that identity.

A marker-only sequence (`SEQ-HOP1 -> SEQ-HOP2 -> SEQ-HOP3`) without chain identity/depth fields remains ambiguous.

## Local retest status

This worker scheduled a local continuation retest with marker:

```text
SILAS-R-CW4-20260627T2357PDT
```

The first scheduling call succeeded, but the visible tool result only returned the injected W3C `traceparent`; it did not expose `chain.id` or `chain.step.remaining`. Unless the follow-up turn can retrieve correlated gateway/Tempo span bytes for that trace and show the same-chain decrement, the honest classification remains `HONEST_LIMIT`.
