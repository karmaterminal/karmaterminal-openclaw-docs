# R-CD-1: continue_delegate() normal lifecycle
**SHA**: `6a23864d12` | **Prince**: 🌊 Ronan | **Trace**: `a91abcfc1b23e93524c98d2d403526ff`
**Tempo**: http://tempo.dandelion.cult/api/traces/a91abcfc1b23e93524c98d2d403526ff
## Scenario
Basic delegate lifecycle: dispatch → spawn → execute → return.
## Observed
Delegate spawned, announced (msg `1507595863831351366`), returned to parent. 13s.
## Verdict
✅ PASS
