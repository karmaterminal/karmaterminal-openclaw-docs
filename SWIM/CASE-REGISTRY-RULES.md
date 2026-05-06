# SWIM/ factory — case registry rules

This file defines how the `SWIM/` factory holds the canonical continuation test-case corpus across time, so cases can never silently disappear from a swim cycle.

> The swim charter chooses from the board.
> It is not allowed to *unknow* the board.

---

## 1. Canonical case registry

The factory maintains a durable registry separate from any individual swim cycle.

Each registry entry has:

- stable case id
- short name
- family / category
- claim it proves
- evidence class needed (`repo-test`, `live-row`, `cross-seat`, `deploy`, etc.)
- lifecycle status: `active`, `deferred`, `deprecated`, `superseded-by`, `split`, `merged`, `lost`, `new`
- provenance pointer (e.g. `swim-34/ROWS.md A3`, `#412 X7`, `rfc-evidence-appendix:Swim 7`)

Suggested layout:

- `SWIM/cases/CATALOG.md` — index
- `SWIM/cases/<case-id>.md` — per-case file

## 2. Per-swim charter = explicit selection from registry

A swim charter does not redefine the universe of cases.
It declares, for every entry in the registry:

- in scope this cycle
- required vs optional
- intentionally deferred (with reason)
- intentionally omitted (with reason)

If a registry case is missing entirely from the swim charter manifest, the swim is **NOT-FULL** by construction.

## 3. Anti-loss rules

Two rules are baked into the factory:

1. **No silent drop**
   A case can only leave the active set via explicit:
   - `deprecated` (feature promise removed)
   - `superseded-by <id>` (replaced by narrower / better cases)
   - `split <ids>` (one old case hid multiple claims)
   - `merged <id>` (real coverage duplication folded into one)

2. **No silent inheritance**
   A case can only enter the active set via explicit `new` declaration with:
   - family
   - claim
   - evidence class
   - provenance

A case removed without one of those reasons, or added without one of those declarations, is a factory-discipline failure.

## 4. Lost-case recovery lane

The registry must be allowed to carry named ghosts when memory outlives artifacts.

Lost-case statuses:

- `recovered-from-archive`
- `named-in-history-but-row-text-lost`
- `memory-backed, artifact-thin`

Each lost-case entry carries a confidence tag rather than pretending to be live evidence.

This lets the registry be *truthful about gaps* instead of quietly closing them.

## 5. New-case intake

When a new seam appears, it goes into the registry first, not into a single swim charter.

New-case intake produces:

- a `new` registry entry (id, family, claim, evidence class, provenance)
- a registry version bump
- and only then becomes electable into any future swim charter

This stops every cycle from improvising surface area from scratch.

## 6. Retirement grammar

A case truly stops being applicable only via:

- `deprecated`
- `superseded-by`
- `split`
- `merged`

Each retirement leaves a tombstone in the registry, with reason and (where applicable) replacement pointer.

## 7. Charter ↔ registry coupling

Each FULL swim charter must:

- name the exact registry version it elects against
- list every active registry case and its disposition
- list every deferred, deprecated, superseded, split, merged, or lost entry it intentionally elects out
- declare any new-case intake that landed since the previous cycle

A FULL swim verdict therefore reads against the live catalog as it really stands at that moment — including its named ghosts and elected omissions.

## 8. Why this matters

Without this discipline:

- cases vanish silently because one cycle didn't run them
- new seams hide inside one cycle and don't propagate
- retired surface gets re-tested forever or quietly forgotten
- "FULL" can mean *"we ran what we remembered"* instead of *"we elected against the whole catalog"*

With this discipline:

- the factory is the long-term memory
- individual swims are dispositions against that memory
- nothing leaves the universe of cases except by election

## 9. Relationship to FULL-SWIM-CHARTER.md

`FULL-SWIM-CHARTER.md` defines what **FULL** means as a verdict.
This file defines the **catalog** that any FULL verdict must be earned against.

Together they enforce:

- declared-before-first-fire board
- explicit verdicts for every required row
- closure against the catalog, not just against the convenient subset
