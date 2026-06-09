# R-CW-DELEGATE-SELF-CONTINUATION — on-SHA 7dcc9d578ca0dc828c015acd05f16caf41b471da

**Owner:** 🌊 ronan
**Verdict:** ✅ PASS
**SHA:** `7dcc9d578ca0dc828c015acd05f16caf41b471da` (history-preserving merge, fresh upstream `ebb9c6a0` — the decided presentation ship-SHA)
**Captured:** 2026-06-08 ~19:12 PDT, ronan seat (DGX Spark, arm64)

## Claim
`continue_delegate` self-continuation dispatches a background shard from the ronan main session and returns on-SHA, with the continuation runtime instrumented (Tempo `continuation.delegate` span emitted).

## On-SHA proof
- **Build-info pin (gateway actually running this SHA):** `dist/build-info.json` commit = `7dcc9d578ca0dc828c015acd05f16caf41b471da`, version `2026.6.2`, builtAt `2026-06-09T02:00:48Z`; gateway pid 3884704 restarted 19:01:09 PDT via the karmafeast fleet-fan deploy. (`../build-info-ronan-seat.json`)
- **Dispatch:** `continue_delegate(mode=silent-wake)` fired from `agent:main:discord:channel:1466192485440164011` (ronan main session). Runtime returned `{status: scheduled, mode: silent-wake, delegateIndex: 1, traceparent: 00-742162609668aad88798f8cb7878b4d3-ca090fba8e057779-01}`.
- **Spawn confirmed:** system event `[continuation:delegate-spawned] Spawned turn 20/200: [PROOF-CAPTURE R-CW-DELEGATE-SELF-CONTINUATION ...]` — the shard spawned on-SHA.
- **Journal (on-SHA, host=ronan, pid=3884704):** `[continuation/work-dispatch] [continuation:work-wake] hop=17/200 … hop=19/200 session=agent:main:discord:channel:1466192485440164011` — continuation chain advancing live on-SHA. (`spawn-journal.txt`)
- **Tempo trace `742162609668aad88798f8cb7878b4d3`** (`tempo-trace-742162609668aad88798f8cb7878b4d3.json`, 42744 bytes, 28 spans):
  - `resource.host.name = ronan`, `host.arch = arm64`, `process.pid = 3884704` — captured from the ON-SHA gateway.
  - Contains a **`continuation.delegate` span** — the continue_delegate dispatch instrumented end-to-end on-SHA.
  - Pull: `http://tempo.dandelion.cult/api/traces/742162609668aad88798f8cb7878b4d3`

## Integration
Build-info pins the SHA + journal hops prove the continuation chain advancing live + the Tempo trace's `continuation.delegate` span proves the dispatch is instrumented on-SHA + the spawn-event proves the shard ran. continue_delegate self-continuation is PROVEN on `7dcc9d578c`.

## Carries forward from
2807efc1c1e R-CW-DELEGATE-SELF-CONTINUATION (✅ PASS, trace `fdf20b45`) — same behavior re-proven on the fresh-upstream ship-SHA.
