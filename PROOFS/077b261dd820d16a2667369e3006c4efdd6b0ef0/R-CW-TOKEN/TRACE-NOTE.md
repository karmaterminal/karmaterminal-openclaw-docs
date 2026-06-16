# R-CW-TOKEN trace provenance

`trace-40674ffa-bracket-form.json` — the in-repo Tempo trace JSON for the token/bracket-form
`continue_work` behavior (`CONTINUE_WORK:5` → `continuation.work` span, `reason.preview` ABSENT).

This is the same trace 🕯 Emeric captured for R-CW-3's bracket-form contrast (trace-id
`40674ffa8f1a17ecb42bb2f0ffd2167`), fetched fresh from `tempo.dandelion.cult/api/traces/<id>`
and committed here so clawsweeper reads the bytes in-repo (no private-Tempo TraceQL dependency).

It's the behavioral byte for R-CW-TOKEN: the bracket token dispatched and emitted the
`continuation.work` span with no `reason.preview` (the token form carries no reason param) —
the populated-vs-absent contrast against the tool-form (R-CW-3 `96accc7e`).
