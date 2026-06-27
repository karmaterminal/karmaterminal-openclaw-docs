# Ronan local chained-depth audit note

Ronan local artifacts from 2026-06-27T10:33 PDT contain one valid TEST-1-style up-tree silent-wake traversal (`TEST-1-ronan-dgx`) and two invalid local chain attempts (`Chain-2-ronan-dgx`, `Chain-3-ronan-dgx`) that are intentionally **not** folded here.

- Chain-2 failed because the depth-1 model repeatedly combined `targetSessionKey` with `fanoutMode`, and the runtime correctly rejected that invalid parameter combination.
- Chain-3 failed because the depth-1 model supplied invalid zero traceparent values; runtime correctly rejected the invalid traceparent.

Those failures are model/tool-call-shape artifacts, not pass evidence for the continuation feature. The aggregate `R-CD-CHAINED-DEPTH-2` row remains `partial`; only the Ronan TEST-1 substitution and the existing Silas TEST-3 artifact are pass candidates in this fold.
