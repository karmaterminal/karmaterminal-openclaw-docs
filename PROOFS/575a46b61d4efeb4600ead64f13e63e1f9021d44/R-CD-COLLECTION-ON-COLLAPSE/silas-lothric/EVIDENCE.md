# R-CD-COLLECTION-ON-COLLAPSE Proof — 🌫 silas (silas-lothric)

## Context
- **Row:** `R-CD-COLLECTION-ON-COLLAPSE`
- **Target Assembly SHA:** `575a46b61d4efeb4600ead64f13e63e1f9021d44`
- **Seat:** `silas-lothric` (10.0.0.100, ASUS TUF Z790-PRO WIFI, Intel i9-14900KS)
- **Time:** 2026-06-29 19:33 PDT
- **Proof:** Delegate return collection on collapse to root (A→B→C).

## Execution / Honest Limit Evidence

**Verdict: HONEST LIMIT (Scenario Runner Required / Scaffold Blocked)**

This row tests an A→B→C delegate chain where the intermediate child (B) collapses, and the grandchild (C) successfully returns to the root (A) via `fanoutMode="tree"`. 

The structural block preventing execution of this proof on my seat is twofold: (1) manual chat-surface execution is blocked by LLM behavioral limits during A→B→C dispatch generation, and (2) the k6 scenario runner intended to bypass this limitation is explicitly blocked at the framework level.

1. **Attempt Analysis / Live Surface Blocker:** To construct the A→B→C chain manually from the chat surface:
    - I (Agent A) dispatch a `continue_delegate` with `fanoutMode="tree"` to spawn Agent B.
    - Agent B must wake, parse the task, and dynamically decide to dispatch Agent C *before* yielding or collapsing. 
    - The `continue_delegate` payload for Agent B must contain an exact injected instruction for Agent B to invoke `continue_delegate` itself.
    - During previous continuation-chain attempts (e.g., `R-CW-MULTI-COLLAPSE`), the dynamic generation required at the B node was fragile. When forced into a tight timeout/collapse window, the B node frequently failed to reliably parse the instruction and dispatch C before the session yielded or was reaped.
    - This aligns with Cael's findings on `R-CD-CHAINED-DEPTH-2` (PR #172 / Issue #168), where Cael filed an Honest Limit because the multi-hop chain required highly fragile prompt injection to force the B node to spawn C. The fragility makes live manual runs unreliable as proofs of the *substrate mechanism* (the actual fanout logic), because they fail at the *LLM behavioral layer*. My own prior manual attempt on PR #165 (`docs(proofs): add R-CD collection collapse evidence`) proved the load-bearing substrate collection logic via `sessions_spawn`, but that PR was closed in favor of awaiting the unified k6 approach to eliminate the live spawn variance.

2. **Required Surface (k6) is Blocked:** Scribe requested execution via k6 if the manual path is structurally unsound. However, the scaffolded k6 scenario for this row (`tools/k6-proofs/scenarios/r-cd-collection-on-collapse.js`) is intentionally hard-blocked from running. Examining the file in the `karmaterminal-openclaw-docs` repo yields:
    ```javascript
    export default function () {
      throw new Error('R-CD-COLLECTION-ON-COLLAPSE is scaffold-only; live-fire design not implemented.');
    }
    ```
    Cael scaffolded this in PR #159 (`docs(k6-proofs): scaffold R-CD collection-on-collapse row`) specifically noting: *"Scenario intentionally throws if run; the detached intermediate / collapse trigger design needs review before live fire."*

The substrate mechanism is sound, but this row is classified as an Honest Limit because live manual execution is behaviorally blocked and the required k6 scenario execution is explicitly hard-blocked by an unimplemented scaffold.
