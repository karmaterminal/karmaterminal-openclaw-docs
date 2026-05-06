# Historical swim index

This directory is the public evidence surface for recovered continuation / integration swim artifacts.

## Provenance classes

Every linked swim below is tagged with one of three provenance classes, surfaced both here and in-file at the top of each per-swim README:

- **`appendix/branch-native`** — backed by surviving in-tree or RFC-history evidence on the `karmaterminal/openclaw` fork, or recovered from the `ronan/rfc-evidence-appendix` frozen branch. The public page can stand on first-party byte evidence.
- **`bootstrap-pointer`** — public surface evacuated from `karmaterminal/openclaw-bootstrap` (e.g. `swims/swim-NN-…/`, `SWIM/history/`); bootstrap remains the source-of-truth body. The public page is a pointer to the bootstrap body, not a substitute for it.
- **`adjacent branch-era` / `inferred from neighboring evidence, not directly preserved`** — reserved for future evacuations where the evidence is from neighboring branches or inferred rather than directly preserved. No swim in this index currently sits here; the appendix-discipline ledger at `karmaterminal/openclaw-bootstrap` PR #912 (`swims/MISSING-SWIMS-LEDGER.md`) tracks what would land here when migrated.

The provenance grammar follows `karmaterminal/openclaw-bootstrap` PR #908 + #912 + `swims/MISSING-SWIMS-LEDGER.md`. Anti-flattening rule: a `bootstrap-pointer` page is **not** appendix-native proof, and silent promotion across classes is a discipline failure.

## Public historical anchors

- [Swim 06](./swim-06/README.md) — three-layer continuation canary validation (recovered from frozen branch) — `appendix/branch-native`
- [Swim 07](./swim-07/README.md) — hot-reload and silent enrichment canary (recovered from frozen branch) — `appendix/branch-native`
- [Swim 09](./swim-09/README.md) — early canary for volitional compaction — `appendix/branch-native`
- [Swim 10](./swim-10/README.md) — tool parity + full path coverage canary — `appendix/branch-native`

## Recovered middle-era artifacts

- [Swim 31](./swim-31/README.md) — timer-arm failure evidence artifact — `bootstrap-pointer`
- [Swim 34](./swim-34/README.md) — formal matrix / whole-board continuation battery — `bootstrap-pointer`
- [Swim 35](./swim-35/README.md) — ship-the-feature stabilization — `bootstrap-pointer`
- [Swim 36](./swim-36/README.md) — continuation feature full-surface coverage — `bootstrap-pointer`
- [Swim 37](./swim-37/README.md) — pre-ship validation of `feature/context-pressure-squashed` — `bootstrap-pointer`
- [Swim 38](./swim-38/README.md) — slippy-hoodie edition — `bootstrap-pointer`
- [Swim 39](./swim-39/README.md) — volatile-purge edition — `bootstrap-pointer`
- [Swim 40](./swim-40/README.md) — v29 substrate verification — `bootstrap-pointer`

## Later public anchors

- [Swim 41](./swim-41/README.md) — v5.2-era public evidence anchor — `appendix/branch-native`
- [Swim 42](./swim-42/README.md) — v5.5 / final-release-integration charter — `bootstrap-pointer`
- [Swim 42 evidence layers](./swim-42/EVIDENCE-LAYERS.md) — rows-era evidence layers / targeted substrate verification

## Anti-flattening note (what is and isn't migrated)

The `swims/HISTORY.md` companion index lists all currently-evidenced swims and explicitly names thin / still-missing areas:

- **Migrated and surfaced here**: 05, 06, 07, 09, 10, 31, 34, 35, 36, 37, 38, 39, 40, 41, 42
- **Thin or still-missing (do NOT treat absence as completeness)**: 08, 11–30 except 31, 32, 33

Per `karmaterminal/openclaw-bootstrap#912` (`swims/MISSING-SWIMS-LEDGER.md`), swims 11–30 (except 31) plus 32–33 are tracked at the appendix-discipline level as `pointer-only acceptable` (22 / 25 / 27 / 28), bootstrap-primary pointer entries (26 / 29 / 32 / 33), or `needs-migration before any appendix entry` (the rest). They do not have public pages here precisely because they lack the surviving-artifact density to honestly carry one yet.

## Notes

- This is an **evidence index**, not a claim that every swim here was a FULL whole-board integration swim.
- Some entries are full scorecards, some are charters, some are matrix artifacts, and some are recovered findings pages.
- The point of this directory is to make the historical testing surface visible again so future FULL-swim reconstruction can proceed from artifacts instead of memory alone.
- For the FULL-swim charter contract these recovered artifacts feed into, see `karmaterminal/openclaw-bootstrap` `SWIM/FULL-SWIM-CHARTER.md` (PR #908) and `SWIM/CASE-REGISTRY-RULES.md` (PR #929). For the case registry that elects against this surface, see `SWIM/cases/` (PR #938).
