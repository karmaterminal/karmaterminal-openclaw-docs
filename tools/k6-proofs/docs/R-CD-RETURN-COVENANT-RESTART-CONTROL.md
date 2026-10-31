# R-CD-RETURN-COVENANT-AUTHORITY: disposable real-restart control

🌊's ruling (Discord msg 1565895695586558120, karmaterminal/openclaw-bootstrap#1727) keeps this
row required and MISSING until a disposable real-restart control runs on the final successor. The
run must include 🌻's negative, a replacement that never becomes usable. 🌊's ruling on the fork
(Discord msg 1565903655885082677) narrows what that negative proves; see
[The spawned-branch negative](#the-spawned-branch-negative). This document is the operator's guide
to the control: `tools/k6-proofs/scripts/run-return-covenant-restart-control.mjs`. The product
path it exercises, with `path:line` anchors at F′ `f15237ec92`, is in the header of
`tools/k6-proofs/scenarios/r-cd-return-covenant-authority.js`. That k6 entry itself fails closed.

## What it proves

A delegate's return is bound to the recipient session's authority generation: one UUID epoch per
logical session key, stored in `session_recipient_authority` in the per-agent database. A gateway
restart is not a generation edge. So across a real restart, the epoch must stay present and
unchanged, including the outage where no gateway process serves, and the failure text must
survive. The rejected base lost the failure body.

**Usable means serving.** A generation is usable only while it owns the listening socket,
`/readyz` passes and hello-ok answers; the control observes all three at every sample. An
unchanged epoch alone is not usability. At F′ every full-process restart closes the old server
before any successor is ready, so continuous service across a restart is not an invariant and the
control does not assert it. It measures the outage instead: `outageInterval` runs from the last
sample that saw the old generation serving to the first sample that saw a generation serving
again, with a precision of one sample interval.

The control establishes that generation without a model turn: `sessions.create`, then
`session.visibility.set` to `suggest`. The narrowing advances, and so creates, the epoch row. The
control reads the row read-only from outside the gateway and publishes only its SHA-256.

It does not deliver a delegate return across the restart. That needs a model turn and is outside
the ruling's receipt list. The product covers the durable-row half in
`src/gateway/server-restart-sentinel.new-process.proof.test.ts`.

## Which restart branch each case drives

F′ has two full-process restart branches with different failure behaviour, and the control drives
each one on purpose.

| Case | Supervisor hints in the old generation's environment | Restart reason | F′ branch | What it shows |
| --- | --- | --- | --- | --- |
| `positive` | `OPENCLAW_SUPERVISOR_MODE=external` only | `gateway.restart` | supervised (`src/cli/gateway-cli/run-loop.ts:497-561`) | A fresh successor serves under the unchanged epoch. |
| `negative-replacement-never-usable` | `OPENCLAW_SUPERVISOR_MODE=external` only | `gateway.restart` | supervised | The successor never serves, and this branch has no fallback: nothing serves again. |
| `negative-spawned-fallback` | none | `update.run` | spawned (`run-loop.ts:459-495`) | The product-spawned child never serves; the original process serves again. |
| `negative-spawned-runtime-unavailable` | none | `update.run` | spawned | The product refuses the fallback because its child runtime is gone. |

**Systemd-supervised fleet seats take the supervised branch.** Their gateways carry
`OPENCLAW_SYSTEMD_UNIT` and systemd's `INVOCATION_ID`, so F′ resolves supervisor `systemd`
(`src/infra/supervisor-markers.ts:5-22`). The run loop writes the restart handoff, closes and
exits, and systemd starts the replacement. The positive case takes the same branch, with the
control standing in for systemd as the declared external supervisor, so the positive is the
fleet-relevant case. Once the handoff is written, that branch has no in-process fallback. The
external-supervisor negative records this as `noFallback`. A proof-gw systemd unit cannot host the
control itself: `composite-launcher.sh` sets `OPENCLAW_SYSTEMD_UNIT` with `Restart=no`, so a
supervised restart there exits for good.

**Only the update respawn spawns a child.** These facts were read from the F′ source:

- `restartGatewayProcessWithFreshPid` returns only `supervised`, `disabled` or `failed`, never
  `spawned` (`src/infra/process-respawn.ts:231-273`).
- Without any supervisor hint, the restart decision is `disabled`/`unmanaged`
  (`process-respawn.ts:56-71`). A plain restart of an unmanaged gateway is therefore in-process
  under the same PID, with no child (`run-loop.ts:572-580`).
- The spawned branch runs only for a standalone update: a foreground update handoff, or an
  update-process reason (`update.run` or `update.auto`, `src/cli/gateway-cli/run-loop-request.ts:33-35`)
  with no supervisor. That path calls `respawnGatewayProcessForUpdate`
  (`process-respawn.ts:282-307`), which starts a detached child with inherited stdio and
  environment. `OPENCLAW_NO_RESPAWN` disables it.
- The untargeted `gateway.restart.request` passes its reason through to the run loop. So the
  spawned cases send `{reason:"update.run", skipDeferral:true}` without performing an update, and
  `installationReplacement` is absent by construction.
- The product's own test of this fallback drives it the same way:
  `src/cli/gateway-cli/run-loop.test.ts:1076-1110`.

The control builds the old generation's environment from scratch. It then reads the running
process's own `/proc/<pid>/environ` (keys only) and records which of the eight hint keys it
carries (`OPENCLAW_SUPERVISOR_MODE`, `OPENCLAW_SYSTEMD_UNIT`, `INVOCATION_ID`, `SYSTEMD_EXEC_PID`,
`JOURNAL_STREAM`, `OPENCLAW_SERVICE_MARKER`, `OPENCLAW_SERVICE_KIND`, `OPENCLAW_NO_RESPAWN`). If the
keys are not exactly the ones the case needs, the record grades MISSING
(`branch-precondition-unmet`).

## The spawned-branch negative

🌊's ruling: on this branch `handleRestartAfterServerClose` has already closed the old server
before the child's readiness is observed. On an unready child, the run loop:

1. kills the child;
2. marks the restart `restart-unhealthy`;
3. calls `reacquireAndResumeInProcessRestart()` (`run-loop.ts:266-360`).

So continuous old-process service until the replacement is ready is not an invariant here either.
The negative proves the narrower behaviour: the child is never healthy; the failure body and
diagnostic are retained; and, if the old runtime is viable and not replaced, the original process
reacquires the lock and serves again under the preserved authority.

`negative-spawned-fallback` drives that path:

1. Once the old listener has closed, the control binds the port itself. The product's child cannot
   serve: it retries the held port 20 × 500 ms (`src/gateway/server/http-listen.ts:6-7`), then
   fails its first boot and exits nonzero.
2. The control finds the child in `/proc` as a child of the old PID that carries the run marker,
   and records its PID, parent PID and start ticks. It releases the port only once that child is
   gone, because a dead child can never become healthy.
3. The product's readiness wait then ends with `stopped-free` (or times out after up to 60 s).
4. The product logs `update respawn child did not become healthy (<pid>); falling back to
   in-process restart` and restarts in-process.

The grade must be FAIL-candidate (`replacement-never-usable`), with `negativeControl.holds: true`,
which requires all of these:

- the update respawn ran (the child was seen, or the product named it);
- no sample saw the child serving;
- the product's fallback line and the restart frame body were retained;
- the original PID and start ticks own the listener again, on a new socket, with `/readyz` and
  hello-ok passing, through to the end of the window;
- the epoch is unchanged at every sample;
- `outageInterval` was measured, from the last serving old sample to the first sample where the
  original process serves again.

`grade.fallback.branch` is `restored`, with class `old-process-restoration`. That is old-process
restoration, never fresh-successor proof, and no negative case can grade PASS.

## Named non-PASS fallback branches

`reacquireAndResumeInProcessRestart` can refuse or fail the fallback. Each refusal has the
product's own diagnostic, and the control keeps every such line in `fallback.diagnostics`
(redacted). A **limit** means the product declined an in-process recovery whose precondition is
false: the old runtime is not viable, or it was replaced. A **failure** means the fallback itself
failed. A limit alone grades MISSING-candidate and a failure FAIL-candidate; neither is ever PASS.

| Branch | Product diagnostic | F′ anchor (`run-loop.ts`) | Class | How it is tested |
| --- | --- | --- | --- | --- |
| `resources-retained` | `shutdown resources remain; refusing in-process restart and exiting` (exits 0) | `:270-273` | limit | scripted gateway |
| `require-fresh-process` | `Fresh-process restart failed; the unsettled native worker cannot recover in-process` | `:274-279` | limit | scripted gateway |
| `child-runtime-unavailable` | `Fresh-process restart failed; the unavailable child runtime cannot recover in-process` | `:280-285` | limit | **induced**: `negative-spawned-runtime-unavailable` |
| `foreground-closed` | `… did not become healthy (…); shutdown pending; retaining the replacement until it closes` | `:286-288` (warned at `:486-488`) | limit | scripted gateway |
| `installation-replaced` | `… the replaced runtime cannot resume` / `Cannot continue in this process` | `:308-310`, `:336-338` (exit at `:203-214`) | limit | scripted gateway |
| `lock-reacquire-failed` | `failed to reacquire gateway lock for in-process restart` | `:313-331` | failure | scripted gateway |

Only the unavailable child runtime can be induced on a disposable gateway:

- `negative-spawned-runtime-unavailable` runs the old generation on a copy of the runtime in
  `<artifact-dir>.private/runtime/node`, owned by the control, and removes the copy before the
  transition.
- The product's child spawn then fails, and its viability check finds the runtime missing
  (`src/infra/child-runtime-viability.ts:48-62`).
- The case must report `negativeControl.holds: true`: the branch is named from the product's line,
  the old process exits nonzero, nothing serves again, and the epoch is unchanged.

The other branches cannot be induced:

- `requireFreshProcess` comes only from native-worker recovery under systemd or launchd
  (`process-respawn.ts:198-203`), never from a targeted restart intent (`restart-request.ts:57-82`).
- The gateway lock is state-database ownership and never probes the port
  (`src/infra/gateway-lock.ts:417-572`), so a held port cannot make a reacquire fail.
- A foreground-closed or replaced installation needs a real update.

Their grading is tested through the scripted gateway, with each product line and exit code.

The grader classifies anything else as follows:

- **Not exercised** (MISSING, `negative-not-exercised`):
  - a restart that stayed in-process (`in-process-restart`);
  - one that showed no update respawn at all (`spawned-branch-not-taken`);
  - a fresh child that served (`replacement-accepted`), because the port was not held.
- **Failure:**
  - `restoration-unstable`: the original process served again but did not stay serving;
  - `unclassified-exit`: it exited without a named reason;
  - `not-restored`: it neither served again nor exited by the deadline.

Other exits the control does not induce land in these failures too:

- a managed-update cancellation that stays unconfirmed (it remains draining);
- a stop request during the restart;
- the shutdown deadline's forced exit.

## How it runs

1. **Guard.** Before starting anything, it refuses a target unless all of these hold:
   - the target is `$HOME/proof-gw/comp-<sha8>` with no symlinked path;
   - `receipts/identity.json` names `openclaw-proof-comp-<sha8>` and the candidate as
     `composite_runtime_C`;
   - `openclaw.json` is mode 0600, binds loopback with its own token and carries no channels;
   - the port is neither 18789 nor the port in `~/.openclaw/openclaw.json`, and nothing listens on
     it;
   - the unit is `inactive` or `failed` (a user systemd bus must be reachable to confirm it);
   - the state does not overlap `~/.openclaw`;
   - the stage's `dist/build-info.json` commit is the candidate;
   - `--docs-sha` is the executing harness checkout;
   - the observer key file is 0600 and outside the target;
   - the artifact directory is outside the target, the live state and the docs repository;
   - `--gateway-env` sets only `NODE_OPTIONS` (`--max-old-space-size`, loopback `--inspect`)
     or `OPENCLAW_CODEX_APP_SERVER_BIN`.

   A refusal writes `refusal.json` and starts nothing.
2. **Old generation.** It starts `node <stage>/dist/index.js gateway --port <port>` with a cleared
   environment: the proof-gw state, config and port, the case's supervisor hints (see the table
   above), and a run marker. It waits until that process owns the listening socket, `/readyz` and
   `/startupz` pass, and hello-ok answers, then records the hints from `/proc`.
3. **Authority.** It establishes the epoch (above).
4. **Window and matrix.** It freezes the plan, then samples every interval:
   - phase;
   - listener owner and inode, from `/proc/net/tcp*` and each process's fds, with the owner's
     PID and kernel start ticks;
   - `/readyz` and `/startupz` status with a body hash;
   - hello-ok (attempted only while a generation owns the listener and `/readyz` passes), with a
     bootId hash;
   - the generation observed serving: the one that owns the listener while `/readyz` passes and
     hello-ok answers, or none;
   - the authority epoch hash.
5. **Transition.** It sends `gateway.restart.request` with the case's reason and
   `skipDeferral:true`, using `operator.admin`.
   - On the supervised branch, it waits for the old generation to close and exit 0. Then it runs
     `gateway restart-handoff consume --expected-pid <old pid> --json`, starts the replacement and
     verifies it the same way, with a new bootId. `negative-replacement-never-usable` first binds
     the port itself, so the replacement cannot serve.
   - On the spawned branch, the product starts and judges the child. The control follows it as
     described above, then waits for the original process to serve again or to exit.
6. **Cleanup.** It signals only its own generations, after re-checking PID, start ticks and run
   marker.
   - It stops any process still carrying the run marker, which includes a product-spawned child
     and one that called setsid. That is graded as a leak.
   - It closes any socket it held, removes the runtime copy, and confirms nothing listens.
   - It keeps the isolated state for `composite-launcher.sh shred`.
7. **Receipt.** It grades the record, signs `observer-receipt.json` with the observer key
   (`hmac-sha256-proof-observer-key-v1`), and writes raw logs and frames to
   `<artifact-dir>.private` (mode 0700, never published).

## Receipts and grading

| Receipt | Where it comes from |
| --- | --- |
| `transition-http-body` | The restart response frame (hash; redacted public copy; raw private) plus the `/readyz` and `/startupz` bodies at the edges: last pre-transition, first not-ready, first replacement-ready, last not-ready. |
| `replacement-process-output` | Supervised: the replacement's stdout and stderr, captured by the control as supervisor (bytes, SHA-256, redacted tail). Spawned: the product starts the child with inherited stdio (`process-respawn.ts:295-299`), so the old generation's streams carry it; the restart diagnostic lines are kept in `fallback.diagnostics`. |
| `generation-fingerprints` | Old and replacement PID, start ticks, listening socket inode and port, bootId hash, buildId. Spawned: the child's PID, parent PID and start ticks (or its PID from the product's line, `unknown` when its spawn failed), and the restored original process's new socket and bootId. |
| `observation-record` | The plan and the matrix. |
| `signed-cleanup-receipt` | The cleanup record inside the receipt signed with the observer key. |

The verdicts, from the signed record only:

- **PASS-candidate**, for the positive case only, needs all five receipts and the positive
  behaviour:
  - the old generation was observed serving before the transition;
  - the restart was accepted;
  - the old generation exited 0 through an accepted full-process external handoff bound to its
    PID;
  - every sample shows the same epoch;
  - the replacement was ready by the deadline and observed serving from its first serving sample
    to the end of the window, with a new PID, inode and bootId;
  - both generations reported the staged buildId;
  - the full window was observed without blind gaps;
  - the docs harness was clean;
  - cleanup left nothing running.
- **FAIL-candidate** means the behaviour was contradicted. That covers:
  - the epoch was cleared or advanced;
  - the old generation did not serve before the transition;
  - there was no handoff;
  - the replacement never served or stopped serving;
  - the generations were not distinct;
  - something survived cleanup;
  - a fallback branch of class failure.
- **MISSING-candidate** means there is nothing to judge:
  - no matrix;
  - no established authority;
  - a rejected restart (its body is still kept);
  - unmet branch preconditions;
  - a negative that was not exercised;
  - a fallback limit.
- **PARTIAL-candidate** means an observed, uncontradicted restart with a missing receipt or bound:
  a lost body or output, a missing fingerprint, an unsigned receipt, an unreadable authority
  sample, a short window, or a dirty harness.

No negative case can grade PASS: a negative that nothing contradicted grades MISSING
(`negative-not-exercised`).

Every receipt reports `outageInterval`, which holds:

- `lastServingBefore` and `firstServingAfter`, each with time, generation, listener inode and
  owner PID;
- `ms` between them;
- `open`, when nothing served again before the window ended;
- the count of unserved samples;
- `resolutionMs`, the sample interval.

It is reported, not graded against a bound: no restart path at F′ avoids it. Every receipt also
reports `grade.fallback`: the branch and its class, `none-on-supervised-branch` for the supervised
cases.

Each negative must be non-PASS with `negativeControl.holds: true`:

- `negative-replacement-never-usable`: the epoch and old fingerprint are retained, the failure body
  is kept, and `noFallback` holds.
- `negative-spawned-fallback`: the conditions in
  [The spawned-branch negative](#the-spawned-branch-negative).
- `negative-spawned-runtime-unavailable`: the conditions in
  [Named non-PASS fallback branches](#named-non-pass-fallback-branches).

## Operator steps for the F″ fire

Run these on a seat that builds locally, with a stage-only build of the exact successor SHA. Never
point the control at the live install. The spawned cases default to a 150 s restoration deadline
inside a 180 s window: the product's readiness wait alone can take 60 s before an in-process boot.

```bash
SHA=<F″ 40-hex>; DOCS=<merged docs 40-hex>
L=~/flesh_beast_best_beast/source/frond-scribe/scripts/proof-gw/composite-launcher.sh
V=$HOME/flesh_beast_tmp/.openclaw-path-b/stage-only/$SHA     # dist/build-info.json commit == $SHA
bash $L setup $SHA $SHA        # isolated state, own token, port 18796 (PORT=... to change)
bash $L stop  $SHA $SHA        # the control owns the lifecycle; a running unit is refused
W=~/flesh_beast_best_beast/source/WORKTREES/docs-rcc-${DOCS:0:8}
git -C ~/flesh_beast_best_beast/source/karmaterminal-openclaw-docs worktree add --detach "$W" "$DOCS"
mkdir -p ~/.config/frond && (umask 077; head -c 32 /dev/urandom | od -An -tx1 | tr -d ' \n' > ~/.config/frond/rcc-observer.key)
OUT=~/proof-runs/RCC-${SHA:0:8}-$(date -u +%Y%m%dT%H%M%SZ)
cd "$W"
for CASE in positive negative-replacement-never-usable negative-spawned-fallback negative-spawned-runtime-unavailable; do
  node tools/k6-proofs/scripts/run-return-covenant-restart-control.mjs \
    --proof-gw-dir ~/proof-gw/comp-${SHA:0:8} --stage-dir "$V" \
    --candidate-sha "$SHA" --docs-sha "$DOCS" --case "$CASE" \
    --artifact-dir "$OUT/$CASE" --observer-key-file ~/.config/frond/rcc-observer.key \
    --gateway-env OPENCLAW_CODEX_APP_SERVER_BIN=$HOME/.local/bin/codex \
    --gateway-env NODE_OPTIONS=--max-old-space-size=16384
  node tools/k6-proofs/scripts/run-return-covenant-restart-control.mjs \
    --verify "$OUT/$CASE/observer-receipt.json" --observer-key-file ~/.config/frond/rcc-observer.key
done
bash $L shred $SHA $SHA        # after the receipts are copied
```

Expected:

| Case | Verdict | Also |
| --- | --- | --- |
| `positive` | `PASS-candidate` | `outageInterval` closed, `firstServingAfter.generation: replacement` |
| `negative-replacement-never-usable` | `FAIL-candidate` | `negativeControl.holds: true`, `noFallback: true`, `outageInterval.open: true` |
| `negative-spawned-fallback` | `FAIL-candidate` | `negativeControl.holds: true`, `fallback.branch: restored`, `firstServingAfter.generation: old` |
| `negative-spawned-runtime-unavailable` | `FAIL-candidate` | `negativeControl.holds: true`, `fallback.branch: child-runtime-unavailable` (limit) |

Publish only `$OUT/<case>/` after review. Never publish `*.private`. Folding into `PROOFS/` is a
separate, reviewed corpus step. RETURN-COVENANT stays MISSING until this control fires on F″.

If the positive grades MISSING with `authority-not-established`, or PARTIAL with
`authority-sample-unreadable`, the record's `authority.error` and the sample reasons say which
product surface refused. Report it; do not retry with a weaker configuration. The same applies to
a spawned case that grades `not-exercised` or names an unexpected branch: the retained diagnostic
lines say which path the product took.
