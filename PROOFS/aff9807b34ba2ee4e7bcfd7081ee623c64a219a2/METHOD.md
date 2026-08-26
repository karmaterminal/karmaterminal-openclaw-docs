# Method

- Final pure identity:
  `aff9807b34ba2ee4e7bcfd7081ee623c64a219a2`.
- Qualification mode: `maintenance-materiality-reuse`.
- Immediate source corpus and frozen warm basis:
  `25051f3b77409c45f5ce71c3b3b05aae85b0f8f9`.
- Source docs commit:
  `b502fa7c445d45d0d31bde81f7a1d3cb3c9bed32`.
- Ordinary merge:
  `353d76c565c4da43693d41f3454825d48c38e354`, with parents `25051f3b...`
  and pinned upstream `c841a9958abc8344b37ce5c6c5a06bec4cfa6b91`.
- Final aff adds three test-only semantic merge-repair commits after that
  ordinary merge. The materiality report is checksum-pinned at
  `da25ae8ec270dc2797fde6c56f9b35a5c799d718d76c3067a09c45f57465037e`.
- Target Mode-B exactness and target execution exactness are both false.
- Historical execution identity remains
  `37300f29a7ec1f731575343c2aa73ae25f1d0efb`; it contains source proof SHA
  `80311e8aa07fd560cb957475517c5ea18164541c`, not final aff.
- Runtime `a0aa4ec8aefe95ced34342978b64c270c16ec3e9` contains warm 250, not aff.
  Its exact functional R-CW-1 verdict is `PASS-candidate`; its observability
  verdict is `PARTIAL-candidate`.
- Ancestor Mode-B is preserved as run `32895790947` on source `2ffc7ca0...`
  and run `32911065508` on frozen basis `c7131791...`; both retain workflow
  `342cc9c6d190e1ba57d9995d29e394c993a3e79b` and conclusion `failure`.
- The c713 `APPROVE` review applies only to exact c713 qualification identity.
- Warm 250 affected-slice proof remains exact: 11 files / 686 owner assertions,
  an independent 11-file / 544-assertion subset, production types, full test
  types, build, and three generated snapshot checks.
- Final materiality records 39/40 feature cores byte-identical, the sole
  changed core exact-upstream, all three proof-sensitive inputs byte-identical,
  three test-only repairs, 84/84 exact-head focused owners, and passing
  production types/build.
- Historical Ronan deployment and live ingress receipts remain attributed to
  `37300f29...`; they are carried ancestry/materiality evidence only.
- Continuation evidence remains bound to isolated typed and bracket sessions
  plus Project-81 catalog `19b095ef0d356c6d68985ea26bc1bd958f53f144`.
- Cap fixtures remain bound to source proof SHA
  `80311e8aa07fd560cb957475517c5ea18164541c` and docs ref
  `86b39d87e0ae4eef980496d3742e83033ee84a93`; R-CW-5 passes and R-CW-6
  remains partial. Neither is exact aff execution.
- Tempo evidence uses public-safe projections with content capture disabled.
- Static carried rows retain their historical source SHA and comparison-only role.
- Final disposition is `REUSE`, execution transfer is `INVALIDATE`, and there
  is no `UNKNOWN` within the declared maintenance slice.
