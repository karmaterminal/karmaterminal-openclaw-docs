# Artifact index — cea9e4296b7e5cd37f0a491d637ef8459ea2e737

## Current exact-SHA artifacts

| Kind | Seat | Run | Artifact | Outcome |
|---|---|---:|---:|---|
| focused contained CI | assembly | `29218008324` | workflow receipt | PASS: 124 tests, 0 failures, core/all-test typechecks, full lint/format |
| Gate 2.7 | assembly | `29218008174` | classification artifact | PASS: `FROZEN-STALE=0` |
| deploy | Silas | pending | workflow receipt | pending |
| deploy | Elliott | pending | workflow receipt | pending |
| deploy | Cael | pending | workflow receipt | pending |
| deploy | Ronan | pending | workflow receipt | pending |

No behavioral `cea9e42` proof artifact is folded yet. Row owners add reviewed
artifacts here or in their row directories and update the manifest in the same
direct-to-main commit.

## Prior diagnostic runs

These pre-repair runs remain historical only. They helped expose the Codex
dynamic-tool classification defect, but cannot validate the repaired assembly:

| Row | Seat | Run | Artifact |
|---|---|---:|---:|
| `R-CD-2` | Cael | `29212192102` | `8265490583` |
| `R-CD-4` | Ronan | `29212213138` | `8265812039` |
| `R-CD-CHAINED-DEPTH-2` | Silas | `29212195951` | `8265493055` |
| `R-RC-1` harness hold | Elliott | `29212562660` | `8265590530` |
| `R-OBS-STATUS` source receipt | Elliott | `29211410818` | `8265258675` |

They must not be promoted as exact-`cea9e42` proof.

## Carried baseline

The copied ledger comes from published corpus
`2e7861ba45fd8534282aadabab2b855d2f524fdf`, which itself carries the published
`4afd560feb5102627a68a2f6a8bc545dabcfcfdc` corpus and the
`9c6690710c6687c52b93260529932d0c70f58707` baseline. Non-document artifact
bytes are preserved. `prior_4afd_state` and `baseline_corpus` in the manifest
distinguish those historical receipts from fresh evidence.
