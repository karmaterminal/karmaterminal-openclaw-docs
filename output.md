# PR #129388 exact five-row proof refire

## Named-ref identity gate

Resolved before any proof evidence was fired. Supporting branch names are listed for
immutable product commits so local, remote-tracking, and server identities can be
compared directly.

| Category | Named ref | Local SHA | Tracking SHA | Server SHA | Equality |
|---|---|---|---|---|---|
| Product/runtime composite | `karmaterminal/openclaw@6aca9d1d9294376d0466cc8cc608ba731220aab9` (`codeagent/129388-runtime-composite-0281`) | `6aca9d1d9294376d0466cc8cc608ba731220aab9` | `6aca9d1d9294376d0466cc8cc608ba731220aab9` | `6aca9d1d9294376d0466cc8cc608ba731220aab9` | Equal |
| Pure continuation source | `karmaterminal/openclaw@0281b08a720757fc9af0dcc8b7e6e9567a57a38f` (`codeagent/129388-warm-currency-937c8967`) | `0281b08a720757fc9af0dcc8b7e6e9567a57a38f` | `0281b08a720757fc9af0dcc8b7e6e9567a57a38f` | `0281b08a720757fc9af0dcc8b7e6e9567a57a38f` | Equal; source is an ancestor of the composite |
| Safe lane | `karmaterminal/karmaterminal-openclaw-docs:codeagent/129388-five-row-refire` | `371a6538a06fec939ad7e27bd788b9d8543edffa` | `371a6538a06fec939ad7e27bd788b9d8543edffa` | `371a6538a06fec939ad7e27bd788b9d8543edffa` | Equal; unchanged branch published before evidence |
| CI/workflow | `.github/workflows/project81-k6-proof.yml@371a6538a06fec939ad7e27bd788b9d8543edffa` via `codeagent/129388-proof-matrix-provenance` | `371a6538a06fec939ad7e27bd788b9d8543edffa` | `371a6538a06fec939ad7e27bd788b9d8543edffa` | `371a6538a06fec939ad7e27bd788b9d8543edffa` | Equal; working file and commit file both resolve to blob `4360cb3e2ff6bd8076b0f791c2ae7c9b22a82b3b` |
| Presentation | `karmaterminal/openclaw:codeagent/85651-upstream-1ba243c8-gates` | `4737afdf7dcc5cca53f8dd1bdaaeaa122ce17bbd` | `4737afdf7dcc5cca53f8dd1bdaaeaa122ce17bbd` | `4737afdf7dcc5cca53f8dd1bdaaeaa122ce17bbd` | Equal; protected and untouched |
| Docs/proof | `karmaterminal/karmaterminal-openclaw-docs@371a6538a06fec939ad7e27bd788b9d8543edffa` | `371a6538a06fec939ad7e27bd788b9d8543edffa` | `371a6538a06fec939ad7e27bd788b9d8543edffa` | `371a6538a06fec939ad7e27bd788b9d8543edffa` | Equal |

## Isolated gateway pre-fire receipt

The preferred `127.0.0.1:19891` port was already owned by a held, pre-existing
proof service at a different product SHA. That foreign process was not signaled
or modified. The lane used free fallback port `127.0.0.1:19892` and recorded the
deviation before traffic.

| Check | Receipt |
|---|---|
| Host | `ronan`, `aarch64` |
| Exact source | checkout `6aca9d1d9294376d0466cc8cc608ba731220aab9`, tracked-clean |
| Same-host dependencies | dependency clone at the same SHA; `package.json`, `pnpm-lock.yaml`, `pnpm-workspace.yaml`, and installed lock bytes equal |
| Package manager | private lane-local `pnpm 11.22.0`; package metadata SHA-256 `6feb126202ee709ca6ccae86d62071ef6a031e068b775deca5df38bd143d40ee` |
| Build info | `dist/build-info.json` commit `6aca9d1d9294376d0466cc8cc608ba731220aab9`; SHA-256 `d1701dd17a9f7ee39108e85aaef126c08137a2df68b8ae623757040185890e88` |
| Stable dist identity | 12,147 files; SHA-256 `9a7aebc51654bbeb65fdc475208620d00d76a348f9a90f4cabe5f6d05c720530`, identical across two pre-fire samples; zero files changed after service start |
| Isolated service | `openclaw-proof-129388-five-row-refire.service`; PID/PGID/SID `3091728`; two loopback listeners only |
| Isolated surfaces | separate private state, workspace, config, logs, home, PID, process group, and service unit |
| Telemetry | `diagnostics-otel` loaded; endpoint `http://otel.dandelion.cult:4318`; `http/protobuf`; traces on; sample rate 1; metrics/logs off; `captureContent=false`; service `ronan-isolated-129388-6aca9d1d` |
| Readiness | `PASS-candidate`; k6 `v2.0.0`; authenticated health/status reachable; continuation enabled with chain, delegate, and cost defaults present |
| Live prince non-mutation | live PID `2272093` start identity unchanged; config SHA-256 remained `541f1838b549ccf53199a5b00f3607bf05588c7721577c3efd6b0fd446ee799f`; health remained reachable |
| Supplemental rows | excluded; `codeagent/129388-product-observability-closure` was not used |
