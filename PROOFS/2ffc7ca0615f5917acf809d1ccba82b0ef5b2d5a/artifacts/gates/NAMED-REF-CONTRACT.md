# Pre-evidence named-ref contract

Resolved before folding exact-target receipts on 2026-08-25.

| Category | Named ref | Local | Tracking | Server | Disposition |
|---|---|---|---|---|---|
| Product/base ref | `karmaterminal/openclaw:codeagent/129388-upstream-4da57168-gates` | `2ffc7ca0615f5917acf809d1ccba82b0ef5b2d5a` | `origin/codeagent/129388-upstream-4da57168-gates` = `2ffc7ca0615f5917acf809d1ccba82b0ef5b2d5a` | `refs/heads/codeagent/129388-upstream-4da57168-gates` = `2ffc7ca0615f5917acf809d1ccba82b0ef5b2d5a` | PASS: exact target identity agrees. |
| This lane's safe branch ref | `karmaterminal/karmaterminal-openclaw-docs:codeagent/129388-proof-transpose-2ffc` | `0e75318a68d7145c0c5b99e8b11bda304f4f9fd2` | `origin/codeagent/129388-proof-transpose-2ffc` = `0e75318a68d7145c0c5b99e8b11bda304f4f9fd2` | `refs/heads/codeagent/129388-proof-transpose-2ffc` = `0e75318a68d7145c0c5b99e8b11bda304f4f9fd2` | PASS: unchanged safe lane was published before evidence. |
| CI/workflow ref | `karmaterminal/openclaw-bootstrap:main` for run `32895790947` | object `342cc9c6d190e1ba57d9995d29e394c993a3e79b` | `origin/main` = `342cc9c6d190e1ba57d9995d29e394c993a3e79b` | run `headSha` and `refs/heads/main` = `342cc9c6d190e1ba57d9995d29e394c993a3e79b` | PASS: workflow identity agrees; the run conclusion is `failure`. |
| Presentation ref | `openclaw/openclaw#129388` / `refs/pull/129388/head` | local mirror branch `codeagent/85651-upstream-1ba243c8-gates` = `4737afdf7dcc5cca53f8dd1bdaaeaa122ce17bbd` | `origin/codeagent/85651-upstream-1ba243c8-gates` = `4737afdf7dcc5cca53f8dd1bdaaeaa122ce17bbd` | `refs/pull/129388/head` = `4737afdf7dcc5cca53f8dd1bdaaeaa122ce17bbd` | PASS: identity agrees. Presentation remains on the predecessor and this lane does not mutate it. |
| Docs/proof ref | `karmaterminal/karmaterminal-openclaw-docs@0e75318a68d7145c0c5b99e8b11bda304f4f9fd2` | `HEAD` = `0e75318a68d7145c0c5b99e8b11bda304f4f9fd2` | N/A: immutable workorder commit pin | commit API = `0e75318a68d7145c0c5b99e8b11bda304f4f9fd2` | PASS: exact docs product pin resolves locally and on the server. |

The separate identities are intentional. Exact pure target
`2ffc7ca0615f5917acf809d1ccba82b0ef5b2d5a` is the Mode-B and review
subject. Historical live evidence remains bound to composite
`37300f29a7ec1f731575343c2aa73ae25f1d0efb` and its continuation ancestor
`80311e8aa07fd560cb957475517c5ea18164541c`. Exact composite live execution
at `a48c475baa893493df2ee8ebb17834b845a64aec` is pending.
