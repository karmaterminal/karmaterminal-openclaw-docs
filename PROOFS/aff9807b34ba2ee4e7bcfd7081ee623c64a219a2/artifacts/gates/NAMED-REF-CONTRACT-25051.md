# Pre-evidence named-ref contract

Resolved on 2026-08-25 before the warm-target evidence subtree was copied or
credited. Moving branches are not used as authority for historical commit pins.

| Category | Named ref | Local | Tracking | Server | Disposition |
|---|---|---|---|---|---|
| Product/base ref | `karmaterminal/openclaw:codeagent/129388-warm-currency-80985b96` | `25051f3b77409c45f5ce71c3b3b05aae85b0f8f9` | `origin/codeagent/129388-warm-currency-80985b96` = `25051f3b77409c45f5ce71c3b3b05aae85b0f8f9` | `refs/heads/codeagent/129388-warm-currency-80985b96` = `25051f3b77409c45f5ce71c3b3b05aae85b0f8f9` | PASS: exact warm-target identity agrees. |
| This lane's safe branch ref | `karmaterminal/karmaterminal-openclaw-docs:codeagent/129388-proof-transpose-25051` | `HEAD` = `e19110e419b67118fd8e890f1f3075c51acd8e4d` | `origin/codeagent/129388-proof-transpose-25051` = `e19110e419b67118fd8e890f1f3075c51acd8e4d` | `refs/heads/codeagent/129388-proof-transpose-25051` = `e19110e419b67118fd8e890f1f3075c51acd8e4d` | PASS: the unchanged safe lane was published before evidence. |
| CI/workflow ref | `karmaterminal/openclaw-bootstrap:main` for ancestor runs `32895790947` and `32911065508` | object `342cc9c6d190e1ba57d9995d29e394c993a3e79b` exists; local `main` is stale and is not authority | `origin/main` = `342cc9c6d190e1ba57d9995d29e394c993a3e79b` | both run `headSha` values and `refs/heads/main` = `342cc9c6d190e1ba57d9995d29e394c993a3e79b` | PASS: tracking, server, and both immutable run heads agree; both run conclusions remain `failure`. |
| Presentation ref | `openclaw/openclaw#129388` / `refs/pull/129388/head` | local mirror branch `codeagent/85651-upstream-1ba243c8-gates` = `4737afdf7dcc5cca53f8dd1bdaaeaa122ce17bbd` | `origin/codeagent/85651-upstream-1ba243c8-gates` = `4737afdf7dcc5cca53f8dd1bdaaeaa122ce17bbd` | fork branch and upstream pull ref = `4737afdf7dcc5cca53f8dd1bdaaeaa122ce17bbd` | PASS: identity agrees. Presentation remains on the predecessor and this lane does not mutate it. |
| Docs/proof ref | `karmaterminal/karmaterminal-openclaw-docs@e19110e419b67118fd8e890f1f3075c51acd8e4d` | object and `HEAD` = `e19110e419b67118fd8e890f1f3075c51acd8e4d` | N/A: immutable workorder commit pin | commit API = `e19110e419b67118fd8e890f1f3075c51acd8e4d` | PASS: exact docs base resolves locally and on the server. |

## Additional immutable identities

| Role | Named ref or pin | Local / tracking / server resolution |
|---|---|---|
| Immediate source corpus | `karmaterminal/openclaw:codeagent/129388-upstream-4da57168-gates` | local, `origin/...`, and server branch equal `2ffc7ca0615f5917acf809d1ccba82b0ef5b2d5a` |
| Frozen qualified basis | `karmaterminal/openclaw:codeagent/129388-upstream-df9b7a5f-gates` | local, `origin/...`, and server branch equal `c7131791a6d33ab83d1a820c7cdb81c1b1384931` |
| Pinned upstream parent | `karmaterminal/openclaw@80985b9663252da97bf8d67dd2cbeba0fa03aeea` | local object, `upstream/pinned-80985b96`, and server commit API equal `80985b9663252da97bf8d67dd2cbeba0fa03aeea`; moving `main` is N/A as authority |
| Historical live execution | `karmaterminal/openclaw@37300f29a7ec1f731575343c2aa73ae25f1d0efb` | local object and server commit API resolve; tracking is N/A for the immutable commit pin |
| Pending exact-live runtime | `karmaterminal/openclaw:codeagent/129388-runtime-composite-25051` | local, `origin/...`, and server branch equal `a0aa4ec8aefe95ced34342978b64c270c16ec3e9` |

The identities are intentionally separate. Source corpus `2ffc7ca0...` and
frozen basis `c7131791...` supply ancestor qualification only. Historical live
execution remains bound to `37300f29...`. Warm target `25051f3b...` has no
exact-target Mode-B and no exact live execution. Exact live proof for pending
runtime `a0aa4ec8...` awaits the Ronan receipt.
