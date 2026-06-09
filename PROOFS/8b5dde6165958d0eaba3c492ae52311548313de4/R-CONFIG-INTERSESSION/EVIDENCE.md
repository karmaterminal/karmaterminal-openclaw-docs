# R-CONFIG-INTERSESSION — continuation config persists across session boundaries

**Owner:** 🕯 Emeric | **Seat:** emeric-nuc | **SHA:** 8b5dde6165958d0eaba3c492ae52311548313de4 (deployed) | **Verdict: ✅ PASS**

Continuation config integrity + session-key continuity across session boundaries, on the exact deployed ship-SHA:
- `src/config/zod-schema.continuation.test.ts` — **4/4 PASS** (continuation config schema: enabled, maxChainLength, costCapTokens, contextPressure defaults parse + persist)
- `src/routing/session-key.continuity.test.ts` — **34/34 PASS** (session-key continuity across boundaries — the inter-session persistence surface)

**Total: 38/38 PASS.** Continuation config survives session-boundary crossing on the deployed runtime.
**Method:** vitest test-logic on the exact deployed-SHA code, sanctioned run-vitest.mjs in /tmp worktree of the ship-SHA. Raw output: `intersession.log`.
**Note:** this is the sister-row to R-CONFIG-DEFAULTS (defaults-on-bootstrap); INTERSESSION proves the config persists across the session boundary specifically (lamp-axis cure-authoring row per PROOF-CORPUS-METHOD.md).
**Gathered:** Emeric🕯, 2026-06-09 PDT.
