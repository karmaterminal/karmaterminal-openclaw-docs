# R-CW-MULTI — Cael DGX evidence

Ship SHA: `2723dbee783c113cae70e4fb63a4cff9f55402e3`
Runtime/build-info SHA during capture: `64324505fcb8be367abe91234bbb811b005466b4`
Marker: `RCW_MULTI_CAEL_1782634400`
Seat: `cael-dgx`
Time: 2026-06-28 01:13-01:18 PDT

## Claim

R-CW-MULTI is PASS on Cael: both continuation forms produced distinct wake receipts.

- Typed tool form: three `continue_work(...)` tool calls in the same turn produced three distinct continuation wakes (`typed-A`, `typed-B`, `typed-C`).
- Fallback token form: bare final-text `CONTINUE_WORK:5` produced distinct continuation wakes (`token-A`, `token-B`).

A later extra bare-token attempt was rejected by the continuation cost cap after `token-A` and `token-B` receipts already existed; it is preserved in `token-A-rejected.txt` inside the history excerpt and is not counted as PASS evidence.

## Evidence files

- `wake-receipts.json` — machine-readable receipt state and marker.
- `session-history-excerpt.md` — typed/token receipt file contents and wake summary.
- `trace.json` — Tempo trace fetched from `2723dbee783c113cae70e4fb63a4cff9` showing continuation/work spans.

## Receipt summary

Typed receipts:

```text
typed-A 2026-06-28T01:14:30-07:00
typed-B 2026-06-28T01:14:55-07:00
typed-C 2026-06-28T01:15:25-07:00
```

Token receipts:

```text
token-A 2026-06-28T01:17:25-07:00
token-B 2026-06-28T01:17:38-07:00
```

## Verdict

PASS.
