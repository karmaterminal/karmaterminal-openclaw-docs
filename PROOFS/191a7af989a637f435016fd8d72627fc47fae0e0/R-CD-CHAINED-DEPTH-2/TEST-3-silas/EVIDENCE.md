# R-CD-CHAINED-DEPTH-2 TEST-3 — Silas echo/tree canary

**Ship SHA:** `191a7af989a637f435016fd8d72627fc47fae0e0`
**Runtime:** `OpenClaw 2026.6.10 (191a7af)`
**Seat:** 🌫 Silas / `silas-lothric`
**Captured:** 2026-06-27 10:29 PDT
**Echo token:** `R-CD-CHAINED-DEPTH-2-TEST-3-silas-191a7af989a6-1782581400`
**Verdict:** ✅ PASS-candidate — root delegate scheduled, depth-1 child ran, nested depth-2 delegate scheduled, and depth-2 child returned the nonce with observed chain depth `2/5`.

## Fire

Silas fired the TEST-3 arm from the deployed `191a7af989a637f435016fd8d72627fc47fae0e0` seat:

- root: `continue_delegate(mode="silent-wake", fanoutMode="tree")`
- depth-1 child: emit the nonce and attempt a nested depth-2 delegate
- depth-2 child: return `DEPTH-2 ECHO RETURN` with the same nonce and chain information

## Receipts

Root dispatch receipt is preserved in `root_dispatch_receipt.json`:

```json
{
  "status": "scheduled",
  "mode": "silent-wake",
  "delaySeconds": 0,
  "delegateIndex": 2,
  "delegatesThisTurn": 2,
  "fanoutMode": "tree",
  "traceparent": "00-00000000000000000000000000000003-0000000000000003-01"
}
```

Depth-1 result is preserved in `depth1_result.json`. It records one invalid-traceparent attempt followed by a valid retry that scheduled the nested depth-2 delegate successfully:

```json
{
  "depth1_started": true,
  "nested_dispatch_status": {
    "first_attempt": { "status": "error", "error": "traceparent must be a valid W3C traceparent header" },
    "second_attempt": { "status": "scheduled", "mode": "silent-wake", "delaySeconds": 0, "delegateIndex": 1, "fanoutMode": "tree" }
  },
  "final_nonce": "R-CD-CHAINED-DEPTH-2-TEST-3-silas-191a7af989a6-1782581400"
}
```

Depth-2 result is preserved in `depth2_result.md`; it returned the same nonce and observed chain depth `2/5`.

## Trace

- Tempo URL: `http://tempo.dandelion.cult/api/traces/00000000000000000000000000000003`
- Export: `artifacts/root_trace_00000000000000000000000000000003.json`

The exported root trace exists and is JSON from Tempo with public-proof redactions for process path/argv/owner and host id. Depth-1/depth-2 child return receipts are the load-bearing chain proof for this canary lane.

## Honest limits

The first nested attempt failed only because the child supplied an invalid W3C traceparent. The child retried with a valid traceparent and scheduled depth-2 successfully. This is not a continuation failure; it is recorded because the proof corpus should preserve the exact observed path.

## No-secrets statement

The filed artifacts contain no gateway token, raw session key, prompt body, raw provider response, private path, or private user content. The nonce and trace id are proof identifiers for this row.
