# Docs harness full suite

Command:

```bash
node --test tools/k6-proofs/scripts/__tests__/*.test.mjs
```

Tally on this worktree (`4915f658` plus honesty follow-up): **320 tests / 319 passed / 1 failed**.

## The one red

`candidate envelope is outside and invisible to canonical corpus validation`
(`tools/k6-proofs/scripts/__tests__/candidate-run-result.test.mjs`) execs
`validate-corpus.mjs --index --json` and fails because that validator already
exits 1 on `origin/main`:

- expected schema `openclaw.proofs.manifest.v1`
- current continuation manifest is `openclaw.k6.proofs-manifest.v1`
- missing `capture_sha`; `rows` is not an array

This is the **known baseline manifest-schema red**. This sidecar does not edit
`PROOFS/INDEX.json` or `PROOFS/a7ef0317…/proofs-manifest.json`. Not repaired
here.

Focused validators: see `FOCUSED-VALIDATORS.md`.
