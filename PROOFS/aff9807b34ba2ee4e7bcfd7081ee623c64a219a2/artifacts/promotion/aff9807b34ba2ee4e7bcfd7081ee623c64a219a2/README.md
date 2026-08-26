# Final maintenance materiality receipt

This packet is the only applicability bridge from frozen warm basis
`25051f3b77409c45f5ce71c3b3b05aae85b0f8f9` to final presentation target
`aff9807b34ba2ee4e7bcfd7081ee623c64a219a2`.

The checksum-pinned [`materiality-report.md`](materiality-report.md) records the
bounded verdict `reuse`: 39 of 40 feature-core blobs are unchanged, the sole
changed core is an exact pinned-upstream projection, all three proof-sensitive
inputs are byte-identical, and three post-merge repairs are test-only. Its
focused final-head owner proof is 84/84, production types and build pass, and
the only two test-type diagnostics reproduce byte-identically on pinned
upstream.

This packet does not establish exact target Mode-B or exact target execution.
Historical execution remains on `37300f29...`; exact functional R-CW-1 evidence
remains on runtime `a0aa4ec8...`, whose observability verdict remains
`PARTIAL-candidate`.
