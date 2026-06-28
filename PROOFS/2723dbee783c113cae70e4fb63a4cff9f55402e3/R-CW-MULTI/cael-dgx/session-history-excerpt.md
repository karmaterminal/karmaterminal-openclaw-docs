# Session/wake excerpt (manual extract)

Marker: `RCW_MULTI_CAEL_1782634400`


## Source receipts on disk


### typed-dispatch.txt
```
RCW_MULTI_CAEL_1782634400 typed dispatch prepared
```


### typed-A.txt
```
marker=RCW_MULTI_CAEL_1782634400
receipt=typed-A
wake_ts=2026-06-28T01:14:30-07:00
reason=R-CW-MULTI typed-A receipt
```


### typed-B.txt
```
marker=RCW_MULTI_CAEL_1782634400
receipt=typed-B
wake_ts=2026-06-28T01:14:55-07:00
reason=R-CW-MULTI typed-B receipt
```


### typed-C.txt
```
marker=RCW_MULTI_CAEL_1782634400
receipt=typed-C
wake_ts=2026-06-28T01:15:25-07:00
reason=R-CW-MULTI typed-C receipt
```


### token-A.txt
```
marker=RCW_MULTI_CAEL_1782634400
receipt=token-A
wake_ts=2026-06-28T01:17:25-07:00
reason=R-CW-MULTI token-A receipt via bare CONTINUE_WORK token
```


### token-B.txt
```
marker=RCW_MULTI_CAEL_1782634400
receipt=token-B
wake_ts=2026-06-28T01:17:38-07:00
reason=R-CW-MULTI token-B receipt via bare CONTINUE_WORK token
```


### token-A-rejected.txt
```
marker=RCW_MULTI_CAEL_1782634400
receipt=token-A
status=rejected
reason=cost cap exceeded on bare CONTINUE_WORK:5 fallback token (504568 > 500000)
wake_ts=2026-06-28T01:17:49.711364-07:00
```


### state.json
```
{
  "row": "R-CW-MULTI",
  "marker": "RCW_MULTI_CAEL_1782634400",
  "phase": "complete-with-extra-token-rejection-recorded",
  "typed_expected": [
    "typed-A",
    "typed-B",
    "typed-C"
  ],
  "token_expected": [
    "token-A",
    "token-B"
  ],
  "typed_seen": [
    "typed-A",
    "typed-B",
    "typed-C"
  ],
  "token_seen": [
    "token-A",
    "token-B"
  ],
  "last_update": "2026-06-28T08:18:23.544532+00:00",
  "token_instruction": "final response emitted bare CONTINUE_WORK:5 after this state write",
  "token_syntax": "bare CONTINUE_WORK:5 final text (not bracket form)",
  "token_blocker": "bare CONTINUE_WORK:5 fallback token was rejected by continuation cost cap before scheduling; no token-form wake receipt can be produced in this chain.",
  "extra_rejected_attempt": "token-A-rejected.txt records a later bare CONTINUE_WORK:5 attempt rejected by cost cap after token-A/token-B receipts existed; not counted as PASS evidence."
}
```


## Wake messages observed in current session

- `typed-A`: continuation wake turn reason `R-CW-MULTI typed-A receipt`; wrote `typed-A.txt`.

- `typed-B`: continuation wake turn reason `R-CW-MULTI typed-B receipt`; wrote `typed-B.txt`.

- `typed-C`: continuation wake turn reason `R-CW-MULTI typed-C receipt`; wrote `typed-C.txt`.

- `token-A`: bare fallback final text `CONTINUE_WORK:5` produced a continuation wake; wrote `token-A.txt` at 2026-06-28T01:17:25-07:00.

- `token-B`: second bare fallback token produced a distinct continuation wake; wrote `token-B.txt` at 2026-06-28T01:17:38-07:00.

- Extra later token attempt rejected by cost cap (`504568 > 500000`); recorded separately in `token-A-rejected.txt` and not counted as PASS evidence.
