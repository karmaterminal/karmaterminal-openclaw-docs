# R-CD-CHAINED-DEPTH-2: Silas canary-seat dual-coverage at FINAL SHA

## SHA: 55c0ed67a5b89c0e3a99e3e862968a5e1aeabc26
## Seat: silas (urudyne, x64)
## Timestamp: 2026-05-20T12:28-12:29 PDT
## Trace ID: 05a15e4f9874ac1a34515753d46896f0
## Tempo URL: http://tempo.dandelion.cult/api/traces/05a15e4f9874ac1a34515753d46896f0

## TEST-1 (up-tree silent-wake depth-2 chain):
- Depth-1 delegate fired: status=scheduled, traceparent=05a15e4f...-b2b4efac90b117da
- Depth-1 returned: "DEPTH-1-CONFIRMED at 55c0ed67a5: spawned depth-2 delegate successfully, silent-wake mode"
- Depth-2 returned: "echo-ack from depth-2 via tree-broadcast" ✅
- Verdict: PASS (depth-1 + depth-2 both proven)

## TEST-2 (inter-session return via targetSessionKey):
- Depth-1 delegate fired: status=scheduled
- Depth-1 returned: "TEST-2-CONFIRMED at 55c0ed67a5: targetSessionKey accepted, delegate scheduled. Trace: 05a15e4f...-3729b0e5b447364a"
- Inter-session ping returned: "TEST-2 inter-session delivery OK" ✅
- Verdict: PASS — cross-session targeting works, return delivered to addressed session

## TEST-3 (echo broadcast via fanoutMode="tree"):
- Depth-1 delegate fired: status=scheduled
- Depth-1 returned: "TEST-3-CONFIRMED at 55c0ed67a5: fanoutMode=tree accepted, broadcast return scheduled. Trace: 05a15e4f...-9d8404bad29bfc46"
- Tempo verifies: continuation.queue.fanout span recorded with `fanout.mode=tree, fanout.recipient_count=2, fanout.delivered_count=2`
- Verdict: PASS — ancestor-chain broadcast return accepted AND delivered to 2 recipients

## Overall verdict: PASS — all 3 canonical tests proven at byte at FINAL SHA

## Tempo trace evidence (BACKFILLED):
- Full span hierarchy captured at http://tempo.dandelion.cult/api/traces/05a15e4f9874ac1a34515753d46896f0
- Spans visible: openclaw.run (parent) → 3× continuation.delegate.dispatch (TEST-1/2/3) → continuation.queue.fanout (delivered_count=2 for TEST-3) → continuation.queue.drain (drained_count=4)
- Multi-tool same-turn pattern visible (3 continue_delegate spans share parent openclaw.run span)
- service.name=silas-prince, host.arch=amd64, process.pid=476809 (silas-seat attribution)
