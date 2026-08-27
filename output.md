# PR #129388 continuation corpus transposition

Status: in progress.

## Named-ref contract

This ledger was established before transposition evidence was created or
credited. `N/A` means the ref is intentionally read-only or does not apply to
this docs-only workorder.

| Category | Named ref | Local SHA | Tracking SHA | Server / authoritative SHA | Equality |
|---|---|---|---|---|---|
| Product/base ref | `openclaw/openclaw` source presentation commit | N/A | N/A | `4737afdf7dcc5cca53f8dd1bdaaeaa122ce17bbd` | Server commit object exists; it is the source-to-target merge base. |
| This lane's safe branch ref | `karmaterminal/karmaterminal-openclaw-docs:codeagent/129388-proofs-transpose-446f-20260827` | `f71e97238bfd8150f2eb0fe5488a25c250e257cc` | `f71e97238bfd8150f2eb0fe5488a25c250e257cc` | `f71e97238bfd8150f2eb0fe5488a25c250e257cc` | Equal after publishing the unchanged lane. |
| CI/workflow ref | Docs corpus validators only; no product Mode-B dispatch | N/A | N/A | N/A | N/A |
| Presentation ref | `karmaterminal/openclaw:codeagent/85651-upstream-1ba243c8-gates` | N/A | N/A | `446f4b22d321cb7f5f26a4fbc2247f54da72d2a4` | Fork branch equals `openclaw/openclaw#129388` head. |
| Docs/proof base ref | `karmaterminal/karmaterminal-openclaw-docs:main` | `f71e97238bfd8150f2eb0fe5488a25c250e257cc` | `f71e97238bfd8150f2eb0fe5488a25c250e257cc` | `f71e97238bfd8150f2eb0fe5488a25c250e257cc` | Equal. |
| Docs/proof source corpus | `PROOFS/4737afdf7dcc5cca53f8dd1bdaaeaa122ce17bbd/` at docs `main` | tree `97f278557b2c121627804b76e440b0f2004f5e21` | tree `97f278557b2c121627804b76e440b0f2004f5e21` | tree `97f278557b2c121627804b76e440b0f2004f5e21` via equal server `main` | Equal; 403 files, 4,666,303 bytes. |
| Latest source-corpus update | docs commit `0e75318a68d7145c0c5b99e8b11bda304f4f9fd2` | reachable | reachable from `origin/main` | reachable from equal server `main` | Incorporated into canonical source bytes. |
| Upstream PR base commit | `openclaw/openclaw#129388` base | N/A | N/A | `9bd50c803cce88f2ab387ddaf6cc29b4ef004005` | PR API authority; informational materiality boundary. |

The target presentation is `ahead` of the source presentation by 1,244
commits, behind by zero, and uses the source presentation as its exact merge
base. The workorder is docs-only: the presentation remains read-only and no
live proof or target Mode-B run will be fired.
