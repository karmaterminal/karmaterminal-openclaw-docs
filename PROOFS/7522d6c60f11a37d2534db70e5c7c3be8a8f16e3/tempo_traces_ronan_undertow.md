# Tempo traces — ronan-undertow during PROOFS-corpus cycle (7522d6c60f)

Captured via cael-seat → `tempo.dandelion.cult` HAProxy path (undertow-seat direct route flaky; cael-seat HAProxy works).

Trace search: `{resource.host.name="ronan" && name =~ "continuation.*"}`
Time window: PROOFS cycle ~01:33Z to ~01:43Z (covers R-CD-1 through Chain-3)

## Trace IDs (12 continuation.queue.drain spans observed from ronan-prince)

| TraceID | Span | Tempo URL |
|---|---|---|
| `d53c74337bb47f5b7b0473aba3c00f46` | continuation.queue.drain | http://tempo.dandelion.cult/api/traces/d53c74337bb47f5b7b0473aba3c00f46 |
| `f68433807d3e72398669fe1bd1d97c55` | continuation.queue.drain | http://tempo.dandelion.cult/api/traces/f68433807d3e72398669fe1bd1d97c55 |
| `68fece521f18f6cc70dfa40e6a965e0a` | continuation.queue.drain | http://tempo.dandelion.cult/api/traces/68fece521f18f6cc70dfa40e6a965e0a |
| `20208aad6c5ae730c9d5690b80b4d64a` | continuation.queue.drain | http://tempo.dandelion.cult/api/traces/20208aad6c5ae730c9d5690b80b4d64a |
| `d337f3b8880ba1df7f0d7048fe5c7a12` | continuation.queue.drain | http://tempo.dandelion.cult/api/traces/d337f3b8880ba1df7f0d7048fe5c7a12 |
| `e03086a684ad96d57c1f9a31fa68cef6` | continuation.queue.drain | http://tempo.dandelion.cult/api/traces/e03086a684ad96d57c1f9a31fa68cef6 |
| `a1e74b2e85b91d7102306a4c409a5d8e` | continuation.queue.drain | http://tempo.dandelion.cult/api/traces/a1e74b2e85b91d7102306a4c409a5d8e |
| `88b0233a0109aecc374c3b7d413118ee` | continuation.queue.drain | http://tempo.dandelion.cult/api/traces/88b0233a0109aecc374c3b7d413118ee |
| `48b06e90d43a26e57d55a3c391a4a871` | continuation.queue.drain | http://tempo.dandelion.cult/api/traces/48b06e90d43a26e57d55a3c391a4a871 |
| `8ac656d926d060d4d88561e770e6d31d` | continuation.queue.drain | http://tempo.dandelion.cult/api/traces/8ac656d926d060d4d88561e770e6d31d |
| `88680144b9dd891fd90eb7d121a2ac82` | continuation.queue.drain | http://tempo.dandelion.cult/api/traces/88680144b9dd891fd90eb7d121a2ac82 |
| `45d997a0fb29059b188dc54c6a0c8913` | continuation.queue.drain | http://tempo.dandelion.cult/api/traces/45d997a0fb29059b188dc54c6a0c8913 |

## Sample trace export

See `tempo_sample_trace.json` for one full trace export (continuation.queue.drain on ronan, host.arch=arm64 confirming DGX Spark seat origin).

## Cross-reference to PROOFS rows

The 12 continuation.queue.drain spans correlate with PROOFS row fires across the window:
- R-CD-1, R-CD-2, R-CD-3, R-CD-4 = 4 drain spans for fire-side dispatch
- R-CD-CHAINED-DEPTH-2 Chain-1 = 3+ drain spans (depth-1 + depth-2 + depth-3 returns)
- R-CD-CHAINED-DEPTH-2 Chain-2 = 3+ drain spans (with both Fire A + Fire B re-trigger)
- R-CD-CHAINED-DEPTH-2 Chain-3 = 4 drain spans (depth-1 + depth-2 + 3 echo-children)

Span detail at: `host.name=ronan`, `host.arch=arm64`, `host.id=7af66f30966a49b6886e00e2fce4b42f`, `service.name=ronan-prince`, `process.executable.path=/home/figs/.nvm/versions/node/v25.9.0/bin/node`.

## Tempo-access note

Undertow-seat direct connection to `tempo.dandelion.cult` is currently network-restricted; cael-seat HAProxy route works. Trace harvest performed via SSH cael → curl. Banking sister-class: ***tempo-haproxy-reachable-from-cael-seat-but-not-undertow-seat-likely-firewall-or-routing-divergence-class***.
