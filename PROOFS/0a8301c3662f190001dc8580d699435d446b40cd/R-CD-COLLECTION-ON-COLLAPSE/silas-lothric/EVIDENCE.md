# R-CD-COLLECTION-ON-COLLAPSE — silas-lothric live evidence

**Ship SHA:** `2723dbee783c113cae70e4fb63a4cff9f55402e3`
**Docs base re-resolved before write:** `00464a25d91a26db445a69372e03baad555551d9`
**Seat:** `silas-lothric`
**Root A session:** `agent:main:subagent:a1d65d17-4aae-4b35-8fb8-aa0b7de27776`

## Claim

`R-CD-COLLECTION-ON-COLLAPSE` is live-proven for the delegate `fanoutMode="tree"` collapse/collection path:

A spawned detached intermediate B. B scheduled delayed C using `continue_delegate(..., fanoutMode="tree")`, then B finalized before C returned. Root A later received C's nonce-correlated sentinel through the OpenClaw steering queue, with visible chain `B2 -> continuation leaf`.

## Receipts

### A → B root dispatch

Root A used `sessions_spawn` run-mode detached subagent B2. This is not the exact k6 manifest `mode=session` harness form, but it is a detached intermediate for the live runtime evidence: B2 ran as its own subagent session/run, finalized, and was no longer the active turn when delayed C returned:

- B session: `agent:main:subagent:8cc53a05-1b1e-4cc3-9fad-9c8e4e1eb53b`
- B run: `8aa389dd-863e-4f12-bcc0-e18c808a7b99`
- B task: schedule C with `continue_delegate(mode="normal", delaySeconds=8, fanoutMode="tree")`, then final immediately.

B2 returned first:

```text
B_SENTINEL_RCD_COLLECTION_2723DBEE_RETRY2_20260628T0658Z continue_delegate status: scheduled (mode=normal, delaySeconds=8, fanoutMode=tree, delegateIndex=1)
```

### B → C delayed leaf

C later returned to root A:

```text
C_SENTINEL_RCD_COLLECTION_2723DBEE_RETRY2_20260628T0658Z reached root A via fanoutMode=tree after B2 final; visible chain: requester=agent:main:subagent:8cc53a05-1b1e-4cc3-9fad-9c8e4e1eb53b -> session=agent:main:subagent:continuation-fa2a9eb07259c4da91e5a11adf101227.
```

This is the row's collection-on-collapse byte: C's delayed result reached root A after B2 had already finalized.

## Negative guard / no-orphan guard

A first invalid fire B1 intentionally mixed `targetSessionKey` with `fanoutMode="tree"` and was rejected:

```text
B_SENTINEL_RCD_COLLECTION_2723DBEE_20260628T0655Z
Dispatch tool returned success: no — continue_delegate returned error: fanoutMode cannot be combined with targetSessionKey or targetSessionKeys.
```

That guard matters because it proves the successful B2 path did not rely on an explicit root target mixed with tree fanout. The only successful C fire used `fanoutMode="tree"`; the C receipt then appeared in root A, not only in B's finished session.

## Scope and caveat

This is **live evidence**, not a k6 scenario implementation. It proves the row's required substrate behavior with OpenClaw runtime queue evidence and session/run ids. No Tempo trace was captured in this worker. The row scaffold still says detached `mode=session`; this fire used `sessions_spawn(mode="run")` detached subagents rather than a k6 `sessions.send` harness. Treat this as live evidence for the load-bearing collection behavior, not as a completed runnable k6 scenario. The proven byte is: `fanoutMode="tree"` reaches root A across finalized B.

## Artifacts

- `root-dispatch-receipts.json`
- `root-collection-receipt.txt`
- `negative-guard.txt`
