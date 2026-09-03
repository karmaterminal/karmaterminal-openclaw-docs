# Current-runtime proof harness repair

This repair keeps canonical proof identity on pure
`5035aac3a96df18f0a5d5a5c3e91a516a32daf32`. Runtime composite
`dbf5795bd5dd406f586575d883a7878288e591ad` is ancillary execution
provenance only.

No command below is authorized until detached review accepts this harness
branch. Every artifact directory must be new, empty, and private.

## R-CW-5

```bash
node tools/k6-proofs/scripts/run-cost-cap-fixture.mjs \
  --source-dir <exact-pure-source> \
  --candidate-sha 5035aac3a96df18f0a5d5a5c3e91a516a32daf32 \
  --pnpm-node-modules <preinstalled-pnpm-12.1.0-node_modules> \
  --artifact-dir <new-private-R-CW-5-artifacts> \
  --cap 100 --json
```

Expected receipts: exact pnpm and native-package version/integrity, executable
and metadata digests, candidate workspace-graph equivalence, boundary matrix,
typed-tool surface, dispatch boundary, and cleanup.

## R-CW-6

```bash
PATH=<exact-pnpm-12.1.0-bin>:$PATH \
node tools/k6-proofs/scripts/run-max-chain-fixture.mjs \
  --source-dir <exact-pure-source> \
  --candidate-sha 5035aac3a96df18f0a5d5a5c3e91a516a32daf32 \
  --artifact-dir <new-private-R-CW-6-artifacts> \
  --max-chain-length 3 --json
```

Expected receipts: candidate lock digest, installed workspace-graph digest,
validated package-manager bootstrap digest, exact importers/package
integrities, candidate-contained virtual store and local executables, boundary
matrix, durable recovery, typed-tool and delegate boundaries, cleanup, and
public safety.

## R-CD-RETURN-COVENANT-AUTHORITY

Use the already-built artifact only after verifying its manifest/closure
digests against the frozen plan:

```bash
node tools/k6-proofs/scripts/launch-return-covenant-driver.mjs \
  --plan <private-plan.json> \
  --source-dir <exact-pure-source> \
  --runtime-config tools/k6-proofs/tests/fixtures/return-covenant-authority/runtime-config.valid.json \
  --runtime-artifact <exact-attested-HOME-contained-artifact> \
  --control-dir <new-private-control> \
  --artifact-dir <new-private-candidate-artifacts>
```

Expected prelaunch receipts: no-follow source root identity, current-user
ownership, non-writable mode, exact manifest/closure/inventory digests, private
snapshot re-verification, `/home` masking, and no external artifact path in the
sandbox. The matrix still requires exactly 24 observations and one cleanup
receipt.

## R-CD-TOKEN

```bash
OPENCLAW_CANDIDATE_SHA=5035aac3a96df18f0a5d5a5c3e91a516a32daf32 \
OPENCLAW_RUNTIME_BUILD_SHA=dbf5795bd5dd406f586575d883a7878288e591ad \
OPENCLAW_RUNTIME_SOURCE_DIR=<exact-runtime-git-checkout> \
OPENCLAW_ANCILLARY_RUNTIME_CONTRACT=tools/k6-proofs/contracts/ancillary-runtime/129388-pure5035-dbf5795.json \
OPENCLAW_SEAT_CLASS=raw-final-text \
OPENCLAW_R_CD_TOKEN_OWNER_SESSION_KEY=agent:<intended-agent>:<existing-visible-session> \
./tools/k6-proofs/scripts/run-proofs.sh --live \
  --docs-ref <accepted-repair-docs-sha> \
  R-CD-TOKEN 5035aac3a96df18f0a5d5a5c3e91a516a32daf32
```

The owner binding is a dedicated, existing, agent-qualified session. The
scenario resolves it through `sessions.resolve`, uses only the returned
`agentId` in `sessions.create`, and re-resolves the new disposable parent
before dispatch and across task-ledger polling. `OPENCLAW_SESSION_KEY` remains
return routing only and is never used to select the disposable parent owner.
A missing, invisible, nonexistent, or mismatched owner binding stops before
child creation.

Repository-relative `OPENCLAW_ANCILLARY_RUNTIME_CONTRACT` values are resolved
from the immutable snapshot's canonical docs repository root, independent of
the caller working directory. The resolver rejects path escape, symlinks,
missing or nonregular files, and conflicting cwd-relative shadows. Absolute
paths are accepted only when their lexical and real paths identify the same
regular file inside that canonical repository root. Contract bytes are read
again after provenance validation and must remain identical before a receipt
is written.

Expected pre-dispatch receipt:
`ancillary-runtime-provenance.json`, proving the exact pure/runtime trees,
two-commit chain, both patch digests, exact 22-path union, and unchanged
R-CD-TOKEN owner paths. Required row receipts are
`exact-candidate-or-reviewed-ancillary-runtime-identity`, `attempt-state`,
`raw-final-text-origin`, `session-owner-binding`, `prompt-injected`,
`parser-detected`, `queue-identity`, `child-spawned`, `child-completed`,
`parent-return-event`, `tempo-trace-json`, and
`continuation-trace-correlation`. The signed row receipt keeps
candidate/corpus identity on pure `5035aac3...`, binds the hashed owner session
and agent through repeated verification, and records the runtime only as
ancillary provenance.

Consumed attempt
`20260903T060815Z-r-cd-token-0fd4f089` is terminal evidence and must not be
refired. The command above is documentation for a separately authorized,
post-review run with a new attempt identifier only.
