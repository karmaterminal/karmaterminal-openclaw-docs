# Registry Lifecycle Walkthrough — Retire Grammar + Version Bump

This document is the **acceptance bar from `karmaterminal/openclaw-bootstrap#933` (narrow scope)**: the case-registry's retire grammar and version-bump discipline demonstrated through worked examples that can be reused as templates.

It is the companion to:
- `SWIM/CASE-REGISTRY-RULES.md` — the rules
- `SWIM/cases/CATALOG.md` — the v1 registry that elects against those rules
- `SWIM/cases/N001.md`-`SWIM/cases/N010.md` — worked examples of `new` lifecycle intake (already shipped in PR #938)

This file fills the missing half of #914's living-document discipline: the **retire** half (`deprecated`, `superseded-by`, `split`, `merged`, `lost` ↔ `recovered-from-archive`) and the version-bump that captures those transitions.

If you are a fresh prince trying to remove a case from the registry without leaving folklore behind, this file is your worked-example reference.

---

## 0. Why retire-grammar matters

The default failure mode of any test catalog is silent shrinkage: a case stops being run, then stops being mentioned, then disappears from collective memory. The next cycle inherits the smaller catalog and treats it as canonical, which means the original promise was lost without a tombstone.

`SWIM/CASE-REGISTRY-RULES.md` §3 names this directly: **no silent drop**. A case can only leave the active set via explicit:

- `deprecated` — feature promise removed (case no longer applicable)
- `superseded-by <id>` — replaced by a narrower / better case
- `split <ids>` — one old case hid multiple claims; replaced by multiple successors
- `merged <id>` — coverage duplication folded into one
- `lost` — known to have existed; evidence too thin to rebuild yet (carries confidence tag)

Plus the inverse:

- `recovered-from-archive` — case previously `lost` now has evidence migrated; can return to active

Each transition leaves a tombstone in the case file's `Lifecycle history` section. The catalog itself never silently shrinks.

This walkthrough demonstrates each transition with a worked example.

---

## 1. Worked example — `deprecated`

**Scenario**: Suppose the continuation feature drops bracket-token fallback entirely in v2026.5.6 (no more `[[CONTINUE_DELEGATE:...]]` parsing). The case `B1` ("F1 clean continue_work (no inbound noise)") still applies because `continue_work()` still exists, but a hypothetical case `B-token` that exercises bracket-token fallback would no longer have a feature to test against.

**Action** (in the registry-bump PR):

1. Edit the deprecated case file. Append a `Lifecycle history` entry:

   ```markdown
   ## Lifecycle history

   - v1 (2026-05-06): added as `active` from `#412 X-token` (hypothetical)
   - v2 (2026-XX-XX): transitioned to `deprecated`
     - **Reason**: bracket-token fallback removed in v2026.5.6 (see `karmaterminal/openclaw#XXXX` PR removing parser); feature surface no longer exists for this case to test.
     - **Replacement**: none required. The behavior is gone.
   ```

2. Update the case header:

   ```markdown
   **Lifecycle status**: deprecated (was `active` in v1; deprecated in v2 — bracket-token fallback removed)
   ```

3. Update `SWIM/cases/CATALOG.md`:
   - move the case from its `### Active` section to a new `### Deprecated` section
   - in the registry version section, bump the registry to `v2` and note the transition

4. The deprecated case file **stays in the repository**. It is not deleted. Future readers can see what was removed and why.

**Discipline check**: a swim charter electing `registry_version: v2` does NOT need to disposition deprecated cases (per `CASE-REGISTRY-RULES.md` §7 — "instances inherit only what's active in the elected registry version"). But a swim charter electing `registry_version: v1` still has to disposition the case as it existed then.

---

## 2. Worked example — `superseded-by`

**Scenario**: The case `X7` ("Max chain boundary — probe past declared cap") tests chain-depth cap enforcement. Suppose later we realize this needs to split: the cap check is one behavior, but the *recovery from rejection* is a separate behavior worth its own case.

**Action**:

1. File the new narrower case as `XYZ` (a new case file with `new` lifecycle status):

   ```markdown
   # Case `XYZ` — Chain-cap rejection produces clean error envelope

   **Lifecycle status**: new
   **Provenance**: spun out from `X7` per registry v2 bump
   ```

2. Edit the original case file `X7.md`:

   ```markdown
   ## Lifecycle history

   - v1 (2026-05-06): added as `active` from `#412 X7`
   - v2 (2026-XX-XX): transitioned to `superseded-by XYZ`
     - **Reason**: the cap-enforcement behavior and the rejection-envelope behavior were conflated in one case; XYZ now covers the rejection-envelope half explicitly. X7 retains the cap-enforcement half — wait, that's not superseded, that's `split`. See §3.
   ```

   *(Note: this scenario is actually a `split`, not a `superseded-by`. The cleaner `superseded-by` example follows.)*

**Cleaner `superseded-by` scenario**: Suppose `C5` ("P5 CPU bound under permutation load") gets fully replaced by a more rigorous case `CXY` that uses a structured permutation matrix instead of an ad-hoc load mix.

**Action**:

1. File `CXY` as `new`.
2. Edit `C5.md`:

   ```markdown
   ## Lifecycle history

   - v1 (2026-05-06): added as `active` from `swim-34/ROWS.md C5`
   - v2 (2026-XX-XX): transitioned to `superseded-by CXY`
     - **Reason**: ad-hoc load mix produced unrepeatable measurements; CXY uses structured permutation matrix from RFC §6.7 worked example.
     - **Coverage delta**: CXY covers the same claim plus produces repeatable receipts; no surface lost.
   ```

3. Header:

   ```markdown
   **Lifecycle status**: superseded-by CXY (was `active` in v1; superseded in v2)
   ```

4. CATALOG.md: move from `### Active` to `### Superseded`; CXY appears under `### New`.

**Discipline check**: a charter electing v2 dispositions CXY (not C5). A charter electing v1 still dispositions C5. Cross-version comparison reveals the substitution explicitly.

---

## 3. Worked example — `split`

**Scenario**: Returning to `X7` from §2: chain-cap enforcement and rejection-envelope behavior really are two separate claims. The honest action is a `split`.

**Action**:

1. File two new cases:
   - `X7a` — Chain-cap enforcement (probe past cap → behavior occurs)
   - `X7b` — Chain-cap rejection envelope (when cap fires, rejection produces declared error shape)

2. Edit `X7.md`:

   ```markdown
   ## Lifecycle history

   - v1 (2026-05-06): added as `active` from `#412 X7`
   - v2 (2026-XX-XX): transitioned to `split [X7a, X7b]`
     - **Reason**: original case conflated cap-enforcement (Family Guards, behavior under boundary) with rejection-envelope (Family Routes, error shape). Splitting lets each half carry its own evidence-class requirement.
     - **Coverage delta**: zero net loss; X7a + X7b together carry exactly what X7 carried.
   ```

3. Header:

   ```markdown
   **Lifecycle status**: split [X7a, X7b] (was `active` in v1; split in v2)
   ```

4. CATALOG.md: move X7 to `### Split`; X7a + X7b appear under `### Active` (or `### New` for the v2 registry).

**Discipline check**: this is the trickiest transition because it's the most prone to silent coverage-loss. The "Coverage delta" field MUST be filled in honestly. If a split actually drops coverage (one half is too hard to test), say so explicitly and either (a) file the dropped half as `lost` (with confidence tag) or (b) abort the split and keep the original.

---

## 4. Worked example — `merged`

**Scenario**: Cases `B5` ("F5 silent-wake via continue_delegate") and a hypothetical `B5-bis` ("silent-wake delegate triggers next turn") both test the same claim — silent-wake fires AND triggers a turn cycle. Coverage was duplicated; the two should fold into one.

**Action**:

1. Pick the canonical survivor (say `B5`). The other (`B5-bis`) is the merge source.

2. Edit `B5.md`: append any additional claim-text or evidence-surface from `B5-bis` so the survivor carries the union.

3. Edit `B5-bis.md`:

   ```markdown
   ## Lifecycle history

   - v? (date): added as `active` from <provenance>
   - v2 (2026-XX-XX): transitioned to `merged B5`
     - **Reason**: `B5-bis` claim was a restatement of `B5` claim with no surface delta. Folded into B5; no test coverage lost.
     - **Coverage delta**: zero. B5 already covered the silent-wake-triggers-turn-cycle claim implicitly; explicit restatement was duplicative.
   ```

4. Header for B5-bis:

   ```markdown
   **Lifecycle status**: merged B5 (was `active`; merged in v2)
   ```

5. CATALOG.md: B5-bis moves from `### Active` to `### Merged`; B5 stays in `### Active` with optional note.

**Discipline check**: don't merge cases just because they sound similar. Merge only when one truly contains the other's claim with no surface delta. If there's any non-trivial delta, prefer split or rename instead.

---

## 5. Worked example — `lost` ↔ `recovered-from-archive`

**Scenario**: From the swim-archaeology pass (per `karmaterminal-openclaw-docs/swims/MISSING-SWIMS-LEDGER.md` and `karmaterminal/openclaw-bootstrap` PR #912), swims 11–30 (except 31), 32, 33 are named-but-thin in the archive. Suppose someone now finds a real evidence trail for a hypothetical case `Z3` from swim-22-era work.

**Action (transition into `lost`)** — what should have happened originally:

When the swim-archaeology pass identified `Z3` as named-but-thin, the case file should have been created with:

```markdown
# Case `Z3` — <name>

**Lifecycle status**: lost
**Confidence**: low — referenced in `karmaterminal/openclaw-bootstrap` issue #399 (swim-22-era announce-back retry) but no surviving row receipt or scoreboard entry
**Provenance**: bootstrap/issues only; see MISSING-SWIMS-LEDGER.md
**Registry version added**: v1 (as `lost`)
```

This is the tombstone shape. A `lost` case carries a confidence tag and a provenance pointer; it does NOT pretend to active status.

**Action (transition out of `lost` → `recovered-from-archive`)**:

1. Migrate the recovered evidence into the appropriate public surface (e.g. `karmaterminal-openclaw-docs/swims/swim-22/...` if a real reconstruction exists, or as a comment trail on the original bootstrap issue).

2. Edit `Z3.md`:

   ```markdown
   ## Lifecycle history

   - v1 (2026-05-06): added as `lost` from MISSING-SWIMS-LEDGER.md
   - v2 (2026-XX-XX): transitioned to `recovered-from-archive`
     - **Recovery source**: <link to migrated evidence>
     - **Confidence**: now `medium` (or `high` depending on evidence density)
     - **Promotion to active**: scheduled for v3 once a swim cycle exercises the recovered case at least once
   ```

3. The `recovered-from-archive` state is intermediate: the case has provenance again but hasn't been re-exercised in a live cycle. Promotion to `active` requires a real row fire.

**Discipline check**: never promote `lost` directly to `active`. The intermediate `recovered-from-archive` state forces honest accounting of what's been re-tested vs what's just been re-found.

---

## 6. Version-bump worked example

A registry version bump captures one or more lifecycle transitions. It is its own PR against `karmaterminal-openclaw-docs/SWIM/cases/`.

**Worked example: bumping v1 → v2 to capture the transitions in §1 + §3**:

1. Open a PR titled `swim(registry): bump to v2 (deprecate B-token; split X7 → X7a/X7b)`.

2. Edit `SWIM/cases/CATALOG.md`:

   ```markdown
   ## Registry version

   - **Current version**: `v2`
   - **Established**: 2026-XX-XX (succeeds `v1` from 2026-05-06)
   - **Transition rationale**: bracket-token fallback removed upstream (see `karmaterminal/openclaw#XXXX`); X7 split into cap-enforcement + rejection-envelope halves for honest evidence-class differentiation.
   ```

3. Add a `### Version transitions` section (or extend an existing one) listing every transition this bump captures:

   ```markdown
   ### v1 → v2 transitions

   - `B-token`: `active` → `deprecated` (feature surface removed upstream)
   - `X7`: `active` → `split [X7a, X7b]` (claim conflation resolved)
   - `X7a`: NEW
   - `X7b`: NEW
   ```

4. Move case entries between sections (Active / Deprecated / Superseded / Split / Merged) per their new states.

5. The PR carries the full diff: per-case file edits + CATALOG.md updates. Cosign discipline as usual (non-author byte-walk before merge).

**Charter coupling at version bump**: any in-flight swim charter electing `v1` continues to elect against v1 frozen at the bump moment. Charters opened after the bump elect against `v2` (or whichever is current).

---

## 7. The single rule that ties it all together

> A case can only leave the active set by explicit lifecycle transition with a recorded reason and (where applicable) a replacement pointer. The catalog itself never silently shrinks.

If you find yourself wanting to "just remove" a case because it feels obsolete, stop. Pick a transition (`deprecated`, `superseded-by`, `split`, `merged`), fill in the reason and replacement, edit the case file's lifecycle history, update CATALOG.md, and bump the registry version.

The grammar exists so that two years from now, a fresh prince can read the catalog and know not just what's active but what was removed and why. That's how the factory stays a real proof surface instead of a fictional snapshot of present preferences.

---

## 8. Acceptance criteria for this lane (#933-narrow)

This file satisfies the retire-walkthrough portion of #933 when:

- [ ] each lifecycle transition (`deprecated`, `superseded-by`, `split`, `merged`, `lost` ↔ `recovered-from-archive`) has a worked example with concrete actions
- [ ] each example shows the case-file edit, the header update, and the CATALOG.md update
- [ ] the version-bump worked example shows how a bump PR captures transitions
- [ ] the single-rule statement at §7 is unambiguous
- [ ] no chat-archaeology required to apply any transition cleanly

If any of those are false, the retire-walkthrough has not landed yet.

The new-case-intake half of #933 is satisfied by `SWIM/cases/N001.md`–`SWIM/cases/N010.md` (already shipped in PR #938 — each `Lifecycle history` entry shows the `new` intake pattern with provenance + claim + evidence-class).
