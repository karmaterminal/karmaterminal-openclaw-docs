# Continuation proof corpus: `51ff02dc16d0b4ac08c0c1ea544f98a391faecad` (ab5a fleet build)

The reviewed continuation slice `51ff02dc` (`ronan/1547-forwardport-c6276079`), to be proved on the deployed fleet runtime `ab5a30ea`, which carries it. This is GATES step 4: all six seats run `ab5a30ea`, and proofs are taken at the pure slice SHA.

**Status: BLOCKED before any row fired. All 37 required rows are `missing`; nothing was consumed.** This is a working corpus, not acceptance-complete. `PROOFS/INDEX.json` is not repointed.

**v2 (14:12Z).** 🕯 chose to pair the proof client and keep emeric on `auth.mode=none`. That cannot run with the current harness. The readiness client sends no device identity, so the gateway refuses it before the pairing branch and never creates a pending request. A probe on emeric showed 0 pending requests before and after one readiness connect. With `autoApproveLocal` unset, a device-bearing loopback client would be paired silently, with nothing to approve. The receipt and the remaining options are in `METHOD.md` § v2 and `proofs-manifest.json` → `blocker.pairing_decision_v2`.

## Why it is blocked

The authenticated target-readiness gate cannot pass on emeric's live gateway as it is configured.

- emeric's live gateway runs `gateway.auth.mode = "none"` on loopback.
- The harness's readiness client connects as `{id: "cli", mode: "cli"}` (`tools/k6-proofs/scripts/target-readiness.mjs`). The gateway refuses it with `NOT_PAIRED` "device identity required".
- At `ab5a30ea`, a device-less `cli` operator is admitted only after shared-secret (token/password) auth (`src/gateway/server/ws-connection/auth-context.ts:105-108`, `connect-policy.ts:69-98`). Mode `none` never produces that, so no token value helps. That includes emeric's own configured token and any change to the repository secret.
- The row scenarios themselves connect as `{id: "gateway-client", mode: "backend"}`, which loopback self-pairing admits. A read-only probe on emeric got `hello-ok` with that identity (operator, `config.get`, `buildId` containing `ab5a30ea79b7`) and `NOT_PAIRED` with the readiness identity. Both probes used a dummy token.
- `run-proofs.sh` runs the same readiness and, by design, cannot fall through it.

Every remedy lies outside this lane's rules: no gateway restart or config change on emeric, no deploy, no unreviewed harness change. The options and their trade-offs are in `METHOD.md` § Fire attempts and `proofs-manifest.json` → `blocker`.

## What this corpus already holds

- `RESOLVED-SHA.md`: identities, ancestry (`51ff02dc` is an ancestor of `ab5a30ea`), and the `51ff02dc → ab5a30ea` delta. That delta is 1 test-only line on the continuation surface out of 61 files overall.
- `METHOD.md`: the 🕯 live-gateway input set, the candidate == runtime binding (four fail-closed gates; the `3821eaef` precedent), the pre-fire seat/observability/harness checks, both successful dry runs, and the two refused live attempts.
- `SUBNETWORK-MAP.md`: the pre-fire code-path-to-proof-predicate map at `51ff02dc`, with its GitNexus receipt and risk flags for the next fire. R-RC-1 is likely PARTIAL because `request_compaction` on an unmeasured fresh session now answers `guard: "context_unmeasured"` (`dd32c17eba`) while the row expects `context_threshold`. R-CD-3 and the delegate-grant and wake-fold paths also carry flags.
