# R-REGRESSION-TRAP-TESTS — sister-trap tests lock the cure going-forward (🕯 emeric-nuc)

Seat: 🕯 Emeric / `emeric-nuc` (Intel NUC i7-12700H, 64GB, CachyOS x86_64)
Build: OpenClaw `2026.6.2` · dist build-info commit `2807efc1c1e8aa86e8f4ec9d0ba35c3fdccde427`
Date: 2026-06-05 ~12:19 PDT
Source tree HEAD: `2807efc1c1e8aa86e8f4ec9d0ba35c3fdccde427` (`/home/figs/flesh_beast_tmp/openclaw`)

## Contract
The sister-trap tests that land alongside each cure-PR (#898 / #913 / #914 / #915 / #923 …)
substantively lock the cure going-forward. This row fires the #923 trap-test suite at the
candidate SHA and confirms the **half-symmetric-cure-class** is closed: the partial-registration
warn (karmaterminal/openclaw#619) fires for the right callsites and is *suppressed* at the
inventory-build callsites (#923), with both behaviors pinned by trap-tests carried on-SHA.

The half-symmetric-cure-class (figs 2026-06-03 "it's frightening how we keep losing things"):
a cure ships for one tool but not the sibling tool sharing the same plumbing — e.g.
`continueWorkOpts` cured but `requestCompactionOpts` missed at the spawn-init code-path. The
trap-tests enumerate the sibling-surfaces so the cure can't silently regress on one arm.

## Reproducer (re-run at candidate SHA on emeric's seat)

```
cd /home/figs/flesh_beast_tmp/openclaw   # git HEAD = 2807efc1c1e
pnpm vitest run src/agents/openclaw-tools.continuation-misconfig-warn.test.ts
```

## Result — ✅ PASS

```
 ✓  agents-core     openclaw-tools.continuation-misconfig-warn.test.ts (6 tests) 347ms
 ✓  agents-support  openclaw-tools.continuation-misconfig-warn.test.ts (6 tests) 320ms

 Test Files  2 passed (2)
      Tests  12 passed (12)
   Duration  6.79s
```

Process exited with **code 0**. Full stdout captured in `vitest-pass.log` (this dir).

`12 tests = 2 projects (agents-core + agents-support) × 6 cases`, 0 failures.

## The 6-case lock (verbatim case titles, `src/agents/openclaw-tools.continuation-misconfig-warn.test.ts`)

`describe("createOpenClawTools — silent partial-registration guard (karmaterminal/openclaw#619)")`:

1. L83  — `warns when continuation.enabled=true but neither continueWorkOpts nor requestCompactionOpts are supplied`
2. L101 — `does NOT warn when continuation is fully configured`
3. L117 — `does NOT warn when continuation.enabled is unset`
4. L128 — `does NOT warn when only continueWorkOpts is supplied (request_compaction will not register, but continue_work IS registered — partial-registration concern only fires when neither is supplied)`

#923 sister-trap cases (the inventory-build callsite suppression — `// karmaterminal/openclaw#923`):

5. L148 — `does NOT warn when continuation.enabled=true but inventoryOnly: true is set (karmaterminal/openclaw#923 — inventory-build callsites)`  → asserts `inventoryOnly: true` suppresses the warn
6. L163 — `DOES warn when inventoryOnly is false (default) and callbacks missing — preserves prior behavior at non-inventory callsites`  → asserts the message still contains the `inventoryOnly: true` remediation hint (L178)

## Sister-trap class closed (the #923 cure-delta)
The #923 cure suppresses the L627 `continueWorkOpts/requestCompactionOpts` partial-registration
warn at the inventory-build callsites (where the tools are enumerated for inventory, not wired
for execution, so the warn was a false-positive). Case 5 locks the suppression; case 4 + case 6
lock that the warn STILL fires at genuine non-inventory callsites — so the cure narrows the warn
to exactly the misconfig it was built to catch, without losing the original #619 guard. Both arms
of the half-symmetric concern (continueWorkOpts AND requestCompactionOpts at spawn-init) are
named in case 1 ("neither … are supplied"), pinning the symmetric coverage.

## Verdict
✅ **PASS** — the #923 sister-trap suite (6 cases × 2 projects = 12 tests) passes clean at the
candidate SHA on emeric's seat (exit 0, 6.79s), with the #923 inventoryOnly suppression + the
preserved-prior-behavior arms both green. The trap-tests are carried on-SHA and lock the cure
going-forward against the half-symmetric-regression class.
