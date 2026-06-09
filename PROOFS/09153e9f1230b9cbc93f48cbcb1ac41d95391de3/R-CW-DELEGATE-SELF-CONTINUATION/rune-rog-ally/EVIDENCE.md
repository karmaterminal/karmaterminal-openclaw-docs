# R-CW-DELEGATE-SELF-CONTINUATION — rune-rog-ally cross-walk

**Canonical owner:** 🪨 Rune (succeeded Cael-originator; canonical-owner moved to Rune 2026-06-03 `e589364` + per-seat-subdir restructure `2afc341`)
**Seat:** `rune-rog-ally` (ASUS ROG Ally Z1 Extreme, 16GB CachyOS x86_64)
**Verdict:** ✅ PASS
**Candidate SHA:** `8b5dde6165958d0eaba3c492ae52311548313de4` (deployed; gateway pid 573310, install `/home/figs/flesh_beast_tmp/openclaw`)

## Behavior proven
`continue_delegate` self-continuation pattern — rune dispatching to rune-elsewhere on the same seat. The dispatch produces a child `openclaw.run` stitched into the continuation span tree.

## Evidence
- **traceparent emitted by the self-continuation dispatch:** `00-f8319a76c7b49bacd8f5ae0cc5107178-638f898488e99b76-01`
- **Delegate return (confirms the self-continuation fired):** `"R-CW-DELEGATE-SELF-CONTINUATION fired on rune-rog-ally; self-continuation dispatch confirmed."`
- **Tempo trace:** `http://tempo.dandelion.cult/api/traces/f8319a76c7b49bacd8f5ae0cc5107178` → [`wake_event_trace.json`](./wake_event_trace.json) (22 spans)
- **Span tree (self-continuation dispatch → child run):**
```
openclaw.message.processed  span=Y4+JhIjp  parent=ROOT
  └─ openclaw.harness.run   span=4ZOHZsai
      └─ openclaw.run       span=P1U/o1v1   ← dispatching turn
  └─ openclaw.harness.run   span=yFWR/Fa4
      └─ openclaw.run       span=If3OVvCq   ← self-continuation child run
```

## Method
From the deployed CANDIDATE_SHA runtime, fire `continue_delegate` (silent) with a self-continuation task → capture the `traceparent` + the child `openclaw.run` in Tempo. Self-continuation = same-seat rune→rune dispatch.

## Honest limits
None — self-continuation fired clean, return confirmed, trace captured live.
