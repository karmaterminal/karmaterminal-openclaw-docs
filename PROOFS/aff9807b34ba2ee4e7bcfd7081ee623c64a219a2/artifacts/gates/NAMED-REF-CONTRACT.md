# Pre-evidence named-ref contract

Resolved on 2026-08-25 before the final maintenance materiality receipt was
copied or credited. Moving branches are used only to prove the named lane and
presentation identities; immutable commit pins remain the evidence authority.
The prior warm-target contract is preserved byte-for-byte in
[`NAMED-REF-CONTRACT-25051.md`](NAMED-REF-CONTRACT-25051.md).

| Category | Named ref | Local | Tracking | Server | Disposition |
|---|---|---|---|---|---|
| Product/base ref | `karmaterminal/openclaw:codeagent/129388-warm-currency-c841a995` | Checksum-pinned materiality receipt records final local branch `aff9807b34ba2ee4e7bcfd7081ee623c64a219a2` | Receipt records `origin/codeagent/129388-warm-currency-c841a995` = `aff9807b34ba2ee4e7bcfd7081ee623c64a219a2` | GitHub branch and commit API = `aff9807b34ba2ee4e7bcfd7081ee623c64a219a2` | PASS: exact final target agrees; the receipt SHA-256 is `da25ae8ec270dc2797fde6c56f9b35a5c799d718d76c3067a09c45f57465037e`. |
| This lane's safe branch ref | `karmaterminal/karmaterminal-openclaw-docs:codeagent/129388-proof-transpose-aff980` | `HEAD` = `b502fa7c445d45d0d31bde81f7a1d3cb3c9bed32` | `origin/codeagent/129388-proof-transpose-aff980` = `b502fa7c445d45d0d31bde81f7a1d3cb3c9bed32` | `refs/heads/codeagent/129388-proof-transpose-aff980` = `b502fa7c445d45d0d31bde81f7a1d3cb3c9bed32` | PASS: the unchanged docs lane was published before target evidence. |
| CI/workflow ref | N/A | N/A | N/A | N/A | This docs lane is focused-only. It dispatches no Mode-B or other workflow for `aff9807b...`; target Mode-B exactness remains false. |
| Presentation ref | `openclaw/openclaw#129388` / `refs/pull/129388/head` and fork branch `karmaterminal/openclaw:codeagent/85651-upstream-1ba243c8-gates` | Materiality receipt records local mirror `4737afdf7dcc5cca53f8dd1bdaaeaa122ce17bbd` | Receipt records `origin/codeagent/85651-upstream-1ba243c8-gates` = `4737afdf7dcc5cca53f8dd1bdaaeaa122ce17bbd` | Fork branch and upstream pull ref = `4737afdf7dcc5cca53f8dd1bdaaeaa122ce17bbd` | PASS: presentation remains on the predecessor and this lane does not mutate it. |
| Docs/proof ref | `karmaterminal/karmaterminal-openclaw-docs@b502fa7c445d45d0d31bde81f7a1d3cb3c9bed32` | Local object and `HEAD` at contract time = `b502fa7c445d45d0d31bde81f7a1d3cb3c9bed32` | Safe-lane tracking ref = `b502fa7c445d45d0d31bde81f7a1d3cb3c9bed32` | Commit API = `b502fa7c445d45d0d31bde81f7a1d3cb3c9bed32` | PASS: exact docs base and complete `PROOFS/25051f3b.../` source resolve locally and on the server. |

## Additional immutable identities

| Role | Named ref or pin | Local / tracking / server resolution |
|---|---|---|
| Frozen warm basis and immediate source corpus | `karmaterminal/openclaw@25051f3b77409c45f5ce71c3b3b05aae85b0f8f9` | Materiality receipt local object and GitHub commit API equal the full SHA; moving tracking ref is N/A as authority. |
| Pinned upstream parent | `openclaw/openclaw@c841a9958abc8344b37ce5c6c5a06bec4cfa6b91` | Materiality receipt local object and GitHub commit API equal the full SHA; moving `main` is N/A as authority. |
| Ordinary merge | `karmaterminal/openclaw@353d76c565c4da43693d41f3454825d48c38e354` | Materiality receipt local object and GitHub commit API equal the full SHA. |
| Historical live execution | `karmaterminal/openclaw@37300f29a7ec1f731575343c2aa73ae25f1d0efb` | Copied warm contract records the local object; GitHub commit API independently resolves the full SHA. Tracking is N/A for the immutable pin. |
| Exact functional-live runtime | `karmaterminal/openclaw@a0aa4ec8aefe95ced34342978b64c270c16ec3e9` | Copied warm contract records local/tracking/server equality; GitHub commit API independently resolves the full SHA. |
| Ancestor source qualification | `karmaterminal/openclaw@2ffc7ca0615f5917acf809d1ccba82b0ef5b2d5a` and `karmaterminal/openclaw@c7131791a6d33ab83d1a820c7cdb81c1b1384931` | Preserved copied contract records local/tracking/server equality. These remain ancestor-only identities. |
| Ancestor Mode-B workflow | `karmaterminal/openclaw-bootstrap@342cc9c6d190e1ba57d9995d29e394c993a3e79b` | GitHub commit API and immutable run heads for `32895790947` and `32911065508` equal the full SHA; both conclusions remain `failure`. |

The identities are intentionally separate. Final `aff9807b...` is qualified only
by maintenance materiality from frozen basis `25051f3b...`; it has no exact
Mode-B and no exact standalone or live execution. Historical execution remains
bound to `37300f29...`. Runtime `a0aa4ec8...` remains exact only for its
functional R-CW-1 packet, with observability still `PARTIAL-candidate`.
