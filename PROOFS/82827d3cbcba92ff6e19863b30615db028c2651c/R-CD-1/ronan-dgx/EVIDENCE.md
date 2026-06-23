# R-CD-1: continue_delegate tool-form, mode=normal

## SHA: 82827d3cbcba92ff6e19863b30615db028c2651c
## Seat: ronan (spark-ecdf, 10.0.0.246, ARM64)
## Trace: c2c3615e2e081101be9d8ea4e86120f1

## Result: PASS

Dispatched `continue_delegate(mode="normal", task="...")` from main session.
Child delegate arrived, confirmed SHA 82827d3cbc, announced to channel.
Runtime: 17s. Model: github-copilot/gpt-5.5.

## Evidence
- Tool call returned: `{"status":"scheduled","mode":"normal","delaySeconds":0,"delegateIndex":1,"delegatesThisTurn":1}`
- Child confirmed arrival in channel-visible output
- Tempo trace: `R-CD-1234-parent_trace.json` (179KB, full span tree)
