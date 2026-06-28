# Ronan local chained-depth audit note

Ronan local artifacts from 2026-06-27 contain three valid subtest proofs and two invalid early attempts.

## Counted artifacts

- `TEST-1-ronan-dgx` — valid up-tree silent-wake traversal: depth-2 leaf delivered to depth-1 parent, depth-2 grandparent, and main Discord channel.
- `TEST-2-ronan-dgx` / Chain-2B — valid inter-session targeted return: depth-1 called `continue_delegate(mode="silent-wake", targetSessionKeys=[main-channel])`; depth-2 returned `DEPTH2-CHAIN2B-DONE...`; gateway delivered to the explicit main session.
- `TEST-3-ronan-dgx` / Chain-3B — valid fanout tree return: depth-1 called `continue_delegate(mode="silent-wake", fanoutMode="tree", traceparent=<valid>)`; depth-2 returned `DEPTH2-CHAIN3B-DONE...`; gateway delivered to depth-1 parent + main session.

## Excluded artifacts

The first same-night Chain-2/Chain-3 attempts are intentionally **not** counted:

- Chain-2 failed because the depth-1 model combined `targetSessionKeys` with `fanoutMode`, and the runtime correctly rejected that invalid parameter combination.
- Chain-3 failed because the depth-1 model supplied an invalid zero traceparent, and the runtime correctly rejected it.

Those failures are model/tool-call-shape artifacts, not pass evidence for the continuation feature. The counted Chain-2B/Chain-3B retries are the valid artifacts folded into the aggregate `R-CD-CHAINED-DEPTH-2` PASS.
