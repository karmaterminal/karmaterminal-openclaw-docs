# Return-covenant authority matrix

Owning composition boundary: product capture, durable queue settlement,
transcript read, post-image verification, and final prompt adoption. The
accepted docs harness requires one indivisible signed receipt over both
typed-tool and bracket-token forms.

| Case | Required relation/effect | Typed tool | Bracket token |
|---|---|---|---|
| Ordinary `/new` | Generation current; accepted delivery | BLOCKED | BLOCKED |
| Ordinary reset | Generation current; accepted delivery | BLOCKED | BLOCKED |
| Provider fallback | Generation current; accepted delivery | BLOCKED | BLOCKED |
| Compaction | Generation current; accepted delivery | BLOCKED | BLOCKED |
| Process restart/replay | Generation current; one durable delivery | BLOCKED | BLOCKED |
| Transient session-ID rollover | Logical generation current | BLOCKED | BLOCKED |
| Late materialization | Pre-materialization generation accepted once | BLOCKED | BLOCKED |
| Explicit deletion/recreation | Generation stale; zero effects; durable row settled | BLOCKED | BLOCKED |
| Effective owner reassignment | Generation stale; zero effects; durable row settled | BLOCKED | BLOCKED |
| Member/access removal | Generation stale; zero effects; durable row settled | BLOCKED | BLOCKED |
| Restrictive visibility | Generation stale; zero effects; durable row settled | BLOCKED | BLOCKED |
| Explicit revocation | Generation stale; zero effects; durable row settled | BLOCKED | BLOCKED |

For each forbidden case the missing signed receipt would have had to prove:
captured generation differs from current; stale marker text is absent from
final prompt and user input; delivery/adoption ID is absent; the durable stale
row is terminally settled; prompt, wake, transcript-adoption, channel, retry,
and heartbeat effects are all zero; unbound sibling events and exact-session
managed artifacts remain intact.

## Blocking control

Both exact-tree controls returned an empty result:

```text
git ls-tree -r --name-only 0ed59cb64f31971e8659b417fe3fd2ba6a1730c3 |
  grep -E '(^|/)(return-covenant|.*return.*covenant.*driver|.*covenant.*fixture)'

git grep -l 'openclaw.k6.return-covenant-fixture-driver.v1'
  0ed59cb64f31971e8659b417fe3fd2ba6a1730c3 -- .
```

The product contains recipient-authority implementation and focused tests, but
the accepted harness explicitly rejects implementation tests, candidate
responses, docs-owned SQL, and arbitrary loopback stubs as proof authority.

