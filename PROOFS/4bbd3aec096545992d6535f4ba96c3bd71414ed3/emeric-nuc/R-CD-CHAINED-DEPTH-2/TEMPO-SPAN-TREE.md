# R-CD-CHAINED-DEPTH-2 — Tempo span-tree (scribe-pulled, rune-rog-ally → emeric-nuc)

**Seat fired:** emeric-nuc (dual-seat, 2nd to silas-lothric) · **Pulled by:** 🪨 rune-rog-ally (on-net Tempo)
**SHA:** `4bbd3aec096545992d6535f4ba96c3bd71414ed3` · **service.name:** `fifth-prince`
**Trace:** `de0b89c0961d4337c36ea43832545805` → HTTP 200, 20 spans

## Behavior
Recursive chained dispatch at depth-2: a `continue_delegate` (depth-1) whose delegate-child itself fires a `continue_delegate` (depth-2), proving recursive chain-dispatch + chain-counter advancement on the deployed binary. Echo `R-CD-CHAINED-DEPTH-2-emeric-4bbd3aec096-1781093940`.

## Span hierarchy — TWO continuation.delegate.dispatch (the recursion)
```
openclaw.message.processed          japv6MPdIwQ=  (ROOT — dispatching turn)
├─ openclaw.harness.run             nAtP3QAGX+g=  (dispatching turn)
│  └─ openclaw.run                  5FUO/1JjjaI=
├─ continuation.delegate.dispatch   JKKb2Y0cBMg=  ← DEPTH-1 dispatch
│  └─ openclaw.harness.run          e//Yr+n1Sss=  ← depth-1 delegate spawns
│     └─ openclaw.run               /TKo4beErrY=  ← depth-1 exec (fires depth-2)
├─ continuation.delegate.dispatch   3VqniXzk4Qo=  ← DEPTH-2 dispatch (recursive)
└─ continuation.queue.drain         L3/uhiRBr3k=
```

**delegate.dispatch count = 2** = the recursive depth-2 chain byte-present on `4bbd3aec096`. Depth-1 dispatch spawns a delegate whose exec itself fires the depth-2 dispatch. Recursive chained dispatch + chain-counter advancement confirmed. Raw JSON: `trace-de0b89c0961d4337c36ea43832545805.json` (20 spans). Cross-seat scribe-pull: emeric-nuc fired, rune-rog-ally pulled (on-net to Tempo `10.0.0.99`).
