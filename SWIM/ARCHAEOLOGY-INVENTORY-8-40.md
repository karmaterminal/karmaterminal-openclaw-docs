# Archaeology inventory — Swim 8 through Swim 40

Purpose: separate historical continuation evidence into the honest migration buckets needed for FULL-swim reconstruction.

## 1. Branch-backed / RFC-history-backed

These have citable evidence on old `karmaterminal/openclaw` RFC / frozen-branch surfaces.

### Swim 8
- `origin/ronan/rfc-tool-parity:docs/design/continue-work-signal-v2.md`
  - `D.4 Swim 8 detailed results`
  - points at `ronan/rfc-evidence-appendix`
- `origin/archived/flesh_beast_figs-20260414-claude:docs/design/continue-work-signal-v2.md`
  - Appendix D.2 / D.3 names Swim 8 as archived evidence on `ronan/rfc-evidence-appendix`
- `origin/archived/feature-context-pressure-squashed:docs/design/continue-work-signal-v2.md`
  - same Appendix D stratum, still points Swim 8 to `ronan/rfc-evidence-appendix`

### Swim 9
- `origin/ronan/rfc-tool-parity:docs/design/continue-work-signal-v2.md`
  - `D.5 Swim 9 and Swim 10 detailed results`
  - evidence table points Swim 9 issue/results at `openclaw-bootstrap#375`
- `origin/archived/flesh_beast_figs-20260414-claude:docs/design/continue-work-signal-v2.md`
  - D.3 treats Swim 9 as one of the most-recent full-coverage canary sessions
- `origin/archived/feature-context-pressure-squashed:docs/design/continue-work-signal-v2.md`
  - same later Appendix D.3 framing
- `origin/feature/context-pressure-squashed-recompose-20260504-findings-1-2-3-savegame-pre-strip:docs/design/continue-work-signal-v2.md`
  - public-docs bridge already links `swims/swim-09/README.md`

### Swim 10
- `origin/ronan/rfc-tool-parity:docs/design/continue-work-signal-v2.md`
  - D.5 detailed scorecard
  - evidence table points Swim 10 issue/results at `openclaw-bootstrap#377`
- `origin/archived/flesh_beast_figs-20260414-claude:docs/design/continue-work-signal-v2.md`
  - D.3 full scorecard and retained notes
- `origin/archived/feature-context-pressure-squashed:docs/design/continue-work-signal-v2.md`
  - same later Appendix D.3 framing
- `origin/feature/context-pressure-squashed-recompose-20260504-findings-1-2-3-savegame-pre-strip:docs/design/continue-work-signal-v2.md`
  - public-docs bridge already links `swims/swim-10/README.md`

### Swim 41
- `origin/feature/context-pressure-squashed-recompose-20260504-findings-1-2-3-savegame-pre-strip:docs/design/continue-work-signal-v2.md`
  - `D.4 Current validation cycle: Swim 41 v5.2 substrate verification`
  - links public evidence at `karmaterminal-openclaw-docs/swims/swim-41/`
- `origin/feature/context-pressure-squashed-archive-20260504-recompose-findings-1-2-3-landed:docs/design/continue-work-signal-v2.md`
  - later D.4 v5.2 substrate verification stratum (less explicit naming than savegame-pre-strip)

## 2. Bootstrap-only / bootstrap-primary

These do not currently have strong branch-backed evidence and should be treated as bootstrap-primary archaeology.

### Swim 31
- `openclaw-bootstrap/SWIM/history/SWIM31-EVIDENCE.md`
- public summary may exist in docs repo, but source-of-truth is bootstrap history

### Swim 34
- `openclaw-bootstrap/swims/swim-34-formal-matrix/ROWS.md`
- `openclaw-bootstrap/swims/swim-34-formal-matrix/README.md`
- strongest old-board anchor; explicit A0–A5, B1–B8, C1–C7, D1–D5, E1–E3, X1–X15 inventory

### Swim 35
- `openclaw-bootstrap/swims/swim-35-stabilization/ROWS.md`
- `openclaw-bootstrap/swims/swim-35-stabilization/README.md`
- `openclaw-bootstrap/swims/swim-35-stabilization/BRIEF.md`

### Swim 36
- `openclaw-bootstrap/swims/swim-36/charter.md`
- 15-surface coverage expansion

### Swim 37
- `openclaw-bootstrap/swims/swim-37/FEATURE-COVERAGE.md`
- `openclaw-bootstrap/swims/swim-37/CASES.md`
- `openclaw-bootstrap/swims/swim-37/OVERLAY.md`
- `openclaw-bootstrap/swims/swim-37/CHARTER.md`
- explicit inherited-board framing over Swim 34 / 35 / 36

### Swim 38
- `openclaw-bootstrap/swims/swim-38-slippy-hoodie/CHARTER.md`

### Swim 39
- `openclaw-bootstrap/swims/swim-39-volatile-purge/CHARTER.md`
- `.../CASES.md`
- `.../FEATURE-COVERAGE.md`
- `.../OVERLAY.md`
- explicit reuse of the formal runbook block taxonomy in a real cycle

### Swim 40
- `openclaw-bootstrap/swims/swim-40-v29-substrate-verification/CHARTER.md`
- `openclaw-bootstrap/swims/swim-40-v29-substrate-verification/SCOREBOARD.md`

## 3. Appendix-can-surface-now vs needs fresh docs migration

### Appendix-can-surface-now
- Swim 8 — via old RFC appendix surfaces (`ronan/rfc-tool-parity`, archived RFC branches) pointing to `ronan/rfc-evidence-appendix`
- Swim 9 — via old RFC appendix surfaces + public docs bridge
- Swim 10 — via old RFC appendix surfaces + public docs bridge
- Swim 41 — via later RFC appendix surfaces + public docs bridge

### Needs fresh docs migration / explicit public evacuation
- Swim 31
- Swim 34
- Swim 35
- Swim 36
- Swim 37
- Swim 38
- Swim 39
- Swim 40

These may already have partial slotting or summaries in docs-repo PR lanes, but their primary evidence body still lives in bootstrap and should not be described as already fully public.

## 4. Too thin to cite cleanly

Within the 8→40 range, the thinnest surfaces are:
- any attempt to treat Swim 32 or Swim 33 as evidenced boards (outside this range request, but adjacent gap remains real)
- any attempt to treat Swim 41 / Swim 42 as replacing the old whole-board taxonomy
- any attempt to treat branch-era Appendix D summaries as sufficient proof for the bootstrap-era 34→40 whole-board structure

## 5. Load-bearing reconstruction anchors

- Old whole-board taxonomy: `openclaw-bootstrap/swims/swim-34-formal-matrix/ROWS.md`
- Carried-forward matrix / delta framing: `openclaw-bootstrap/swims/swim-35-stabilization/ROWS.md`, `openclaw-bootstrap/swims/swim-36/charter.md`, `openclaw-bootstrap/swims/swim-37/FEATURE-COVERAGE.md`
- Early branch-backed evidence-link lineage: `origin/ronan/rfc-tool-parity:docs/design/continue-work-signal-v2.md`
- Later docs-bridge lineage: `origin/feature/context-pressure-squashed-recompose-20260504-findings-1-2-3-savegame-pre-strip:docs/design/continue-work-signal-v2.md`

## 6. Honest reading

The archive is not a void and not one branch.
It is a layered three-surface history:
1. early branch-backed RFC evidence
2. middle bootstrap swim archive
3. later public docs distillate
