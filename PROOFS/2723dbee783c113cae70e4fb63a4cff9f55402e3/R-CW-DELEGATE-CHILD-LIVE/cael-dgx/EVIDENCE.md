# R-CW-DELEGATE-CHILD-LIVE — cael-dgx live delegate-child continuation execution

**Ship SHA:** `2723dbee783c113cae70e4fb63a4cff9f55402e3`  
**Seat:** `cael-dgx`  
**Marker:** `RCW_DELEGATE_CHILD_LIVE_2723_CAEL_1782632760`  
**Dispatch traceparent:** `00-2723dbee783c113cae70e4fb63a4cff9-2723cae117826327-01`

## Claim

PASS for `R-CW-DELEGATE-CHILD-LIVE`: a `continue_delegate(mode=normal, fanoutMode=tree)` child wrote hop1 evidence, scheduled its own `continue_work(delaySeconds=5)` without `sessions_yield`, then executed the continuation wake and wrote hop2 evidence.

This row is **not** claimed from the parent delegate dispatch receipt alone. The PASS basis is the child-produced hop2 file after the child continuation wake.

## Byte receipts

- `hop1.txt` — child first-turn receipt with marker and pre-`continue_work` state.
- `hop2-EXECUTED.txt` — child continuation-wake receipt written only after the child `continue_work` hop executed.
- `verify-wc.txt` — byte counts for both receipt files at fold time.
- `verify-hop2-metadata.txt` — fold-time grep check confirming hop2 contains the marker plus continuation/wake/hop2 metadata text.

Fold-time verifier checks executed on `cael-dgx` before commit:

```text
test -s hop1.txt
test -s hop2-EXECUTED.txt
grep -q RCW_DELEGATE_CHILD_LIVE_2723_CAEL_1782632760 hop1.txt
grep -q RCW_DELEGATE_CHILD_LIVE_2723_CAEL_1782632760 hop2-EXECUTED.txt
grep -E 'Turn|continuation|wake|hop2' hop2-EXECUTED.txt
```

All checks passed before this artifact was committed.

## Limitations

No Tempo trace JSON is included in this row. The proof is filesystem receipt + marker + continuation-wake text from the delegated child itself.
