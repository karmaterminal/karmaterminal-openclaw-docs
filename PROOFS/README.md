# PROOFS — public-facing proof artifacts for upstream PR review

Per-SHA proof bundles for upstream-PR-presented features. Cited from the PR body. Designed for **rapid reviewer trust** with byte-pinned, repeatable, machine-collected evidence.

## Scope

This directory holds **out-of-tree behavior proof** for upstream PRs filed from `karmaterminal/openclaw`. The PR body links into specific `PROOFS/<sha>/` subtrees so reviewers can verify the implementation behaves as the RFC claims, not just that the diff typechecks.

Distinct from `swims/`:

- `swims/` = internal cycle of test administration with adjudicator, scoreboard, and per-row dispositions; serves cohort discipline + regression-protection.
- `PROOFS/` = external proof presentation for one specific PR head SHA at one specific moment; serves reviewer trust.

## Layout

```
PROOFS/
  <pr-head-sha>/
    METHOD.md                  # how proof was gathered, what artifacts mean
    README.md                  # exec summary + verdicts + outward links
    <topic>.md                 # focused proof per feature aspect
    artifacts/                 # raw logs, journal excerpts, screenshots
```

The directory is **keyed by the exact PR head SHA** so each proof bundle is immutable against the artifact it speaks for. New SHA → new directory. No mutation in place.

## Conventions

- All commands, journal lines, and SQLite reads are reproduced verbatim where they fit; long output goes to `artifacts/` with a path reference.
- Each proof file ends with a single-line verdict: `PASS` / `METHOD-BROKEN` / `KNOWN-LIMITATION-BY-DESIGN`.
- Verdicts that say `PASS` always point to a runnable receipt: gateway call, journal grep, file path, etc.
- Hosts are named (`ronan-host`, `cael-host`, `silas-host`, `elliott-host`) so per-host divergence can be honestly recorded rather than averaged out.

## Stewardship

- Lead steward: 🌊 Ronan
- Cohort princes contribute proof rows for assigned aspects per the PR's METHOD.md.
- Issues filed via separate path (`karmaterminal/openclaw` issues) when a proof row uncovers a real bug.
