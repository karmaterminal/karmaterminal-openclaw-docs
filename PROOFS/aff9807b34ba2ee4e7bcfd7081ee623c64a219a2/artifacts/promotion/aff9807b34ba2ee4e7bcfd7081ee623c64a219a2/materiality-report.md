# PR #129388 second warm currency delta

## Named-ref contract

Recorded before merge analysis, generators, checks, or tests.

| Category | Named ref | Full identity | Local / tracking / server equality | Role |
| --- | --- | --- | --- | --- |
| Product/base | Frozen warm basis `karmaterminal/openclaw@25051f3b77409c45f5ce71c3b3b05aae85b0f8f9` | `25051f3b77409c45f5ce71c3b3b05aae85b0f8f9` | Local object and GitHub commit API equal | First merge parent and approved affected-slice basis |
| Product/base | Pinned upstream currency `openclaw/openclaw@c841a9958abc8344b37ce5c6c5a06bec4cfa6b91` | `c841a9958abc8344b37ce5c6c5a06bec4cfa6b91` | Local object and GitHub commit API equal | Required second merge parent |
| Product/base | Derived merge base | `80985b9663252da97bf8d67dd2cbeba0fa03aeea` | Local derived identity; server equality N/A | Base for base/feature/upstream conflict semantics |
| Safe lane | `karmaterminal/openclaw@refs/heads/codeagent/129388-warm-currency-c841a995` | `25051f3b77409c45f5ce71c3b3b05aae85b0f8f9` before merge; `aff9807b34ba2ee4e7bcfd7081ee623c64a219a2` final | Local branch, `origin` tracking ref, and `origin` server ref equal at both identities | Published unchanged before lane-identity evidence; only this branch was pushed |
| CI/workflow | N/A | N/A | N/A | Workorder requires affected local checks only; no Mode-B, live, or workflow dispatch |
| Presentation | `openclaw/openclaw#129388`, branch `codeagent/85651-upstream-1ba243c8-gates` | `4737afdf7dcc5cca53f8dd1bdaaeaa122ce17bbd` | Local object, local `origin` tracking ref, and live PR head equal | Read-only; protected presentation branch and PR metadata remained untouched |
| Docs/proof | Approved promotion packet `karmaterminal/karmaterminal-openclaw-docs@e19110e4` | `e19110e419b67118fd8e890f1f3075c51acd8e4d` | Local object, `refs/remotes/proof-docs/approved-promotion-e19110e4`, and GitHub commit API equal after a read-only exact-SHA fetch | Prior approval context and canonical proof-sensitive identity manifest; ancestor execution identities remain bound to their original SHAs |

The docs repository name was recovered from the retained proof-corpus history,
then the exact packet was fetched read-only. No docs branch was moved, and no
ancestor execution receipt is rebound to the successor.

## Outcome

Final warm head:
`aff9807b34ba2ee4e7bcfd7081ee623c64a219a2`.

Materiality verdict: **`reuse`**. The continuation feature-core semantics and
all approved proof-sensitive inputs are unchanged. The new upstream overlap in
one primitive-core path is an exact pinned-upstream projection. No impact is
unknown, so `full-requalification-required` does not apply.

Acceptance path: **focused-only**. No Mode-B, Gate 3g, live, k6, deep review,
workflow dispatch, protected presentation mutation, docs-main mutation, PR
metadata mutation, or runtime operation was performed.

## Topology and content identities

| Object | Identity | Parents / role |
| --- | --- | --- |
| Frozen warm basis | `25051f3b77409c45f5ce71c3b3b05aae85b0f8f9` | Required first merge parent |
| Pinned upstream currency | `c841a9958abc8344b37ce5c6c5a06bec4cfa6b91` | Required second merge parent |
| Ordinary merge | `353d76c565c4da43693d41f3454825d48c38e354` | Parents are exactly basis then pinned upstream |
| Ordinary merge tree | `a950709235c0cd9fd07e04fb416effe9764b8dcc` | Only the two declared textual conflicts differ from the non-mutating merge-tree result |
| Final warm head | `aff9807b34ba2ee4e7bcfd7081ee623c64a219a2` | Test-only repair successor; parent `7a9bfac9afb7f711c8cec9cca067c639a161af12` |
| Final tree | `371e84e894904c4f9c018d6872eb9adc24c79902` | Candidate tree used for final materiality comparison |

The basis, pinned upstream, ordinary merge, and approved proof-corpus product
SHA `2ffc7ca0615f5917acf809d1ccba82b0ef5b2d5a` are all ancestors of the final
head.

- Basis-to-final binary patch SHA-256:
  `64dba0e3e71b29cced56d64217a768c83986b0327a6ca068a963f1661004af37`
- Merge-to-final repair patch SHA-256:
  `ccb970b964126762a0dced7404d19bf76681bcae0997db23d4763af0ef751a8e`
- Basis-to-final delta: 582 files, +24,240/-6,946. This is the pinned upstream
  currency plus the bounded resolutions below, not a newly requalified product
  corpus.
- Lane-authored production runtime LOC: +0/-0.
- Declared conflict surfaces: generated config +3/-6; browser test +4/-4
  relative to the warm basis.
- Post-merge repair surfaces: three tests, +5/-5.

## Declared conflict resolutions

| Path | Base blob | Warm blob | Upstream blob | Resolved blob | Resolution |
| --- | --- | --- | --- | --- | --- |
| `config/assertion-safety-baseline.txt` | `3b2540e1f4abcba7a9824888cf9327f982446022` | `bece9dbd2972aaea5408fa9bc461c34c0d0d4fea` | `729e04960f4dba6ed24c2e5f95e76cb191691cb5` | `2be125333cd474d56af43202eabc275291ef5c28` | Seeded from pinned upstream, then regenerated with the canonical ratchet `--prune`; no count was chosen manually. Final inventory is 4,253 files and 13,333 assertions. |
| `ui/src/styles/corner-shape.browser.test.ts` | `100ffbe1d39f67ed14b5a62ed892e251218bc7f3` | `26763704449d3d5af246918d096ca5a1dc252669` | `a924267dca808131e22df0ada5f518e3419c030c` | `c8bcbe214429a7d5848bddeabcc7dd4c17471fe5` | Preserved the warm `page.setContent` in-memory fixture and upstream’s 20px/25px multiline-composer expectations, `toContain` presence assertion, and `replaceAll` fallback substitution. |

The merge index differed from the non-mutating merge-tree object only at these
two paths.

## Silent auto-merge repairs

The minimum static boundary found three test-only composition defects after the
ordinary merge. Each parent passed independently; each rejected combined SHA
failed deterministically; each successor passes the same owner test.

| Path | Rejected merge blob | Final blob | Canonical repair |
| --- | --- | --- | --- |
| `src/agents/bash-tools.exec-workdir.test.ts` | `a02b478a7899ea05be3d18b0d4e1ad23a4ca4dbd` | `0524f9a141a39521f74a3e08eea373c1eb6d0b2d` | Routed the upstream symlink-canonicalization case through the warm branch’s retained `withTestDir` owner. |
| `src/cron/service/startup-run-repair.auto-disable.test.ts` | `c7bcd088085fffbfd10bf84ba3aaf311b1754150` | `363d409a6d245716cf3e144914e9177d92be5697` | Composed the upstream startup-repair regression through `heartbeat-runner.ts` plus the current raw internal wake and system-event owners. |
| `extensions/qa-lab/src/crabline-transport.test.ts` | `a712d92e4991deba4c2d00403f87455c0d6e3b56` | `4aaed4b556e4c6ab63613d16c99f1ade35b67414` | Routed the upstream oversized-response case through the warm branch’s canonical `withTestDir` plugin test-env helper. |

Regression completeness:

- Workdir invariant: local cwd identity is canonicalized before approval and
  execution. Rejected merge `353d76c5...` failed the exact case with
  `withTempDir is not defined` (1 failed/52 passed); pinned upstream passed
  53/53, basis passed 52/52, and final passed 53/53. Nearest sibling is the
  existing local-workdir table in the same owner file. No persistence or
  restart state is involved.
- Cron invariant: a restart-repair auto-disable notice still reaches a real
  immediate heartbeat when recurring cadence is disabled, through the
  continuation-aware facade. Rejected `2cb92453...` failed with
  `startHeartbeatRunner is not a function` (1 failed/8 passed); upstream passed
  9/9, basis passed 8/8, and final passed 9/9. The test itself covers restart
  recovery, deferred notification commit, runner stop, queue drain, and timer
  cleanup.
- QA transport invariant: an oversized successful provider response is rejected
  before metadata parsing while transport cleanup still runs. Rejected
  `7a9bfac9...` failed with `withTempDir is not defined` (1 failed/18 passed);
  upstream passed 19/19, basis passed 18/18, and final passed 19/19. The nearest
  sibling cases share the same canonical test-env owner and cleanup boundary.

The authoring gate retained the upstream behavior regressions, introduced no
test-only production seam, and repaired composition rather than weakening any
assertion.

## Continuation feature-core comparison

The approved 40-row primitive-core inventory is
`PROOFS/2ffc7ca0615f5917acf809d1ccba82b0ef5b2d5a/artifacts/gates/gate-2-feature-cores.log`
at docs packet `e19110e419b67118fd8e890f1f3075c51acd8e4d`;
its blob is `d0d238ea86c6977da72e0ad54e18b44883260913`.

- 39/40 invariants are byte-identical between warm basis and final head.
- `src/cli/program/preaction.ts` is the sole changed core:
  basis blob `16b2b29f51a7385a892362e48e3ff5d009d7e91a`;
  pinned-upstream and final blob
  `b79ece805dae2555aae1087985b0d95ad1ef629d`.
- The path was untouched by the warm feature patch at the prior currency point;
  its final content is an exact upstream projection adding plain-machine model
  output handling. There are zero mixed core blobs.
- The three post-merge repairs are test-only and outside the primitive-core and
  proof-sensitive input inventories.

## Proof-sensitive input comparison

Whole-file blob equality preserves the approved source-slice hashes exactly:

| Input | Warm blob | Final blob | Approved slice SHA-256 | Result |
| --- | --- | --- | --- | --- |
| `src/agents/system-prompt.ts` continuation block | `1aed2ad2235b8b52987c7c5ecd9917ecd40c73be` | `1aed2ad2235b8b52987c7c5ecd9917ecd40c73be` | `a07e924ebc1fb471938d74b1677ad66e2c98d9073bfb30a2768681c37496f82e` | equal |
| `src/agents/embedded-agent-runner/system-prompt.ts` forwarding | `5025f8387471559d76d5dc70c3bff58c13dd4e17` | `5025f8387471559d76d5dc70c3bff58c13dd4e17` | `6e39f9929ec1d20c97f4e00c437b6266feb124a849947ab212f19d721d7e35d4` | equal |
| `src/agents/embedded-agent-runner/run/attempt.ts` enablement | `86252084ff2c368875ef1a38b5d6dbd67baabcb3` | `86252084ff2c368875ef1a38b5d6dbd67baabcb3` | `1d6fdcd01148fadaabfc580052d83ea8ac258499950467915d17e604a548f2ad` | equal |

Ancestor executions remain bound to their original product SHAs. The
independently provisioning runtime composite `a0aa4ec8...` supplies no evidence
to this lane and was neither observed nor relabeled.

## Affected receipts

All passing receipts below ran against exact final head
`aff9807b34ba2ee4e7bcfd7081ee623c64a219a2`.

| Receipt | Result |
| --- | --- |
| Assertion baseline generator/check | Stable 4,253 files / 13,333 assertions; blob `2be125333cd474d56af43202eabc275291ef5c28` |
| Corner-shape browser owner | 3/3 passed |
| Exec-workdir owner | 53/53 passed |
| Cron startup-repair owner | 9/9 passed |
| QA Lab Crabline transport owner | 19/19 passed |
| Focused total | 4 files, 84/84 tests passed, one worker per command |
| Production types | Passed |
| Build | Passed; tracked tree remained clean |
| Formatting / whitespace | Four touched TypeScript tests formatted; full basis-to-final `git diff --check` passed |

`pnpm check:test-types` is red on both final head and exact pinned upstream for
the same two diagnostics only:

- `extensions/qa-lab/src/suite-run-isolated.cleanup.test.ts:323`
- `extensions/qa-lab/src/suite-runtime-parity-runner.cleanup.test.ts:338`

Both upstream-identical fixture literals omit
`providerReadinessArtifactPath`. The direct dependency contract is
`@openclaw/crabline@0.1.17`; its installed `openclaw/shared.d.ts` SHA-256 is
`def32cf9e3a6db55fc388fabfbed608bdbc7f8f2482d3c2f8acfc55c78d3e45b`
and requires that field. The final candidate’s normalized error set matches
`c841a995...` exactly after all merge-specific diagnostics were removed.
Per the workorder’s upstream-failure classification rule, these two
upstream-owned failures were not repaired in this lane.

Commands:

```text
node --import tsx scripts/check-assertion-safety-ratchet.mts --base c841a9958abc8344b37ce5c6c5a06bec4cfa6b91 --prune
node --import tsx scripts/check-assertion-safety-ratchet.mts --base c841a9958abc8344b37ce5c6c5a06bec4cfa6b91
node scripts/run-vitest.mjs run --config test/vitest/vitest.ui.config.ts --maxWorkers=1 ui/src/styles/corner-shape.browser.test.ts
node scripts/run-vitest.mjs run --config test/vitest/vitest.agents-core.config.ts --maxWorkers=1 src/agents/bash-tools.exec-workdir.test.ts
node scripts/run-vitest.mjs run --config test/vitest/vitest.cron.config.ts --maxWorkers=1 src/cron/service/startup-run-repair.auto-disable.test.ts
node scripts/run-vitest.mjs run --config test/vitest/vitest.extension-qa.config.ts --maxWorkers=1 extensions/qa-lab/src/crabline-transport.test.ts
pnpm tsgo:prod
pnpm check:test-types
pnpm build
node_modules/.bin/oxfmt --check ui/src/styles/corner-shape.browser.test.ts src/agents/bash-tools.exec-workdir.test.ts src/cron/service/startup-run-repair.auto-disable.test.ts extensions/qa-lab/src/crabline-transport.test.ts
git diff --check 25051f3b77409c45f5ce71c3b3b05aae85b0f8f9 HEAD
```

The three `pnpm` static commands ran in the same-host normal clone at the exact
candidate SHA and exact candidate manifest/lock identity. The focused Vitest
commands ran locally in this worktree as required.

## Reuse plan

**`reuse`**

Reuse the approved `25051f3b...` applicability packet for its affected slice
only. Keep every ancestor execution receipt attached to its original SHA.
Treat the final warm head as an ancestry/materiality successor, not as a new
execution identity. No continuation core, prompt slice, forwarding slice, or
attempt-enablement input changed; all additional repairs are deterministic,
test-only composition unions with failing/passing owner controls.
