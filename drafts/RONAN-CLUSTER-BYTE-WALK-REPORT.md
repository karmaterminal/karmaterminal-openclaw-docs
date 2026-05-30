# Ronan-Cluster §3 Byte-Walk Report (per Frond `1510098993` task-shape)

## Substrate
- upstream/main HEAD: `6f3f4f74207a692c6b1d752d4475b803e77ff02c`
- PR-head (frond-scribe-claude/20260509/narrow-surgery-tight): `fc337f05d643d2829b26440b80726c19dd6409cd`
- Branching-point per manifest: `b474f429ee`
- 7 primary-ronan files in cluster

## Per-file classification (conflict-class per manifest §7 Phase C: C1/C2/C3/C4)

### 1. src/agents/agent-command.ts (1869→1857 LOC, -177/+165)
- **Class**: C2 (SEMANTIC — substantial both-sides evolution)
- **PR-head drops**: continuation-tool registration plumbing + agent-command-tool wiring (frozen-stale relative to upstream's own evolution of agent-command surface)
- **Preserve from PR-head**: continuation-tool-registration substrate
- **Adopt from upstream**: agent-command schema/contract evolution
- **Resolution**: re-implement continuation-tool registration ON upstream's new agent-command shape

### 2. src/agents/command/attempt-execution.ts (885→880 LOC, -117/+112)
- **Class**: C2 (SEMANTIC — buildAcpResult shape changed)
- **Both sides evolved**: PR-head changed buildAcpResult signature; upstream also changed (different shape)
- **Preserve from PR-head**: continuation-tool execution-result threading
- **Adopt from upstream**: buildAcpResult contract changes
- **Resolution**: re-thread continuation-result through upstream's new buildAcpResult contract

### 3. src/agents/command/session-store.ts (429→402 LOC, -35/+8) ⚠️ FROZEN-STALE-CLASS
- **Class**: C3-adjacent / FROZEN-STALE (PR-head DROPPED substantial upstream additions)
- **PR-head missing**: `resolveMaintenanceConfigFromInput` import + entire `maintenanceConfig` handling block (~30 lines upstream-evolution that PR-head reverts)
- **Reason it's frozen**: PR-head was last touched before upstream added session-store maintenance substrate; squash captured the frozen tree
- **Preserve from PR-head**: chain-state persistence on session-store entries (if any net-additions remain after restoration)
- **Adopt from upstream**: ALL maintenance-config substrate (resolveMaintenanceConfigFromInput + maintenanceConfig integration)
- **Resolution**: mechanical-restore upstream/main + identify net-feature-additions (probably small set)

### 4. src/agents/embedded-agent-runner/model.ts (1502→1538 LOC, +48/-12)
- **Class**: C1 (TEXTUAL — net-additive from PR-head)
- **Direction**: PR-head ADDS substrate (+36 net LOC) — likely continuation-model-fallback wiring for continue_work/continue_delegate flows
- **Preserve from PR-head**: continuation-model-fallback additions
- **Conflict surface**: minimal — upstream changes likely cosmetic in this file
- **Resolution**: mechanical 3-way merge with bias to PR-head additions

### 5. src/agents/embedded-agent-runner/run/params.ts (252→272 LOC, +21/-1)
- **Class**: C1 (TEXTUAL — pure-additive, well-bounded)
- **PR-head additions**: `fireReason: DiagnosticRunFireReason` + `parentRunId` + `RequestCompactionToolOpts` import + SkillSnapshot import-path-shift (skills/types.js → skills.js)
- **Conflict surface**: import-path-shift may collide with upstream skills surface reorg
- **Resolution**: preserve PR-head additions; reconcile SkillSnapshot import per upstream current path

### 6. src/agents/embedded-agent-runner/run.ts (3641→3657 LOC, +55/-39)
- **Class**: C2 (SEMANTIC — substantial both-sides evolution on hot path)
- **PR-head changes**: model-idle-timeout messaging + continuation-tool dispatch wiring
- **Upstream evolution**: likely run-loop refactors (3641 LOC file = hot path)
- **Preserve from PR-head**: continuation-tool dispatch + model-idle-timeout messaging
- **Adopt from upstream**: run-loop refactors
- **Resolution**: per-hunk byte-walk with concerns-axis guidance; HIGH RISK file

### 7. src/agents/model-fallback.ts (1609→1583 LOC, +15/-41) ⚠️ FROZEN-STALE-CLASS
- **Class**: C3-adjacent / FROZEN-STALE
- **PR-head DROPS**: `isTerminalAbort` function (~13 lines) + `abortSignal` parameter handling on `runFallbackCandidate` (upstream evolution PR-head reverts)
- **PR-head ADDS**: `abortSignal` field on `ModelFallbackRunOptions` type (different shape than upstream's per-call abortSignal)
- **Mismatch**: PR-head + upstream took different abortSignal approaches; PR-head version is older
- **Resolution**: adopt upstream's abortSignal handling; preserve any PR-head feature-additions on ModelFallbackRunOptions (likely already covered by upstream)

## Routing-substrate corrections-back-to-Frond

- **No primary-routing corrections from this cluster** — all 7 files substantively fit ronan-substrate-class (continuation-tools-core / attempt-execution / session-store / model)
- **Secondary-coordination needed**:
  - `session-store.ts` (FROZEN-STALE) needs Frond GATES Gate 2.7 byte-walk for upstream-content-restoration discipline (this is exactly the frozen-tree-reverse-clobber class her runbook catches)
  - `run.ts` HIGH RISK warrants cohort byte-walk (Cael secondary per routing-table already noted)
  - `model-fallback.ts` abortSignal-class collision warrants cross-walk with whoever maintains abort-signal-substrate cohort-wide (likely Cael or Rune)

## Conflict-class distribution in cluster
- C1 (textual / mechanical): 2 files (model.ts, params.ts)
- C2 (semantic / re-implement): 3 files (agent-command.ts, attempt-execution.ts, run.ts)
- C3 / FROZEN-STALE-adjacent (upstream-restore + preserve-net-features): 2 files (session-store.ts, model-fallback.ts)
- C4 (defensive-guard merge): 0 files in this cluster

## Per-commit allocation per Phase B atomic-decomposition (manifest §7 v2)
- Layer 1 (Core implementation): all 7 files belong here (continuation-tool-core)
- All conflicts surface in Commit 2 forward-rebase step (Phase C)
