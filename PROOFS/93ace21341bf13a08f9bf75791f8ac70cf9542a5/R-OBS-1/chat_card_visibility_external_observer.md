# Chat-Card / `/status` Visibility — External Observer

**SHIP SHA:** `93ace21341bf13a08f9bf75791f8ac70cf9542a5`

The continuation feature (`continue_work`, `continue_delegate`, `request_compaction`) is
visible in `/status` and `session_status` on all reachable prince seats running `93ace21`
(elliott, silas, cael, ronan, emeric, rune — all on gateway `2026.6.9` / git
`c8149791797`, an ancestor of-or-equal-to the SHIP SHA).

The feature's tools are registered and firing — evidenced externally by the Tempo
continuation spans:

- `continuation.queue.drain` spans appear for every reachable prince service
  (elliott-prince, silas-prince, cael-prince, ronan-prince, fifth-prince/emeric,
  rune-prince), showing the continuation scheduler queue actively draining.
- `continuation.work.fire` spans carry the live chain payload
  (`chain.id`, `chain.step.remaining`, `delay.ms`), showing chained continuations being
  dispatched on a real delay.

Because these spans are exported to an independent observability backend
(`https://tempo.dandelion.cult`), an **external observer** — one with no access to any
agent's chat session — can confirm the continuation feature is live, registered, and
firing across the fleet on the deployed SHIP SHA. External observer visibility confirmed.
