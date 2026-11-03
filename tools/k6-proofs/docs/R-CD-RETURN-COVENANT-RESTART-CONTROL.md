# R-CD-RETURN-COVENANT-AUTHORITY: disposable real-restart control

🌊's ruling (Discord msg 1565895695586558120, karmaterminal/openclaw-bootstrap#1727) keeps this
row required and MISSING until a disposable real-restart control runs on the final successor. The
run must include 🌻's negative, `negative-replacement-never-usable`: a supervised replacement that
never serves. 🌊's final scope ruling (Discord msg 1565927316687691777, 2026-10-31 03:16Z) says
what the row claims:

> Scope the RETURN-COVENANT restart claim to the supervised branch the fleet actually runs. An `update.run` reason on an unmanaged disposable gateway can test the update-respawn fallback, but it is a distinct control—not the negative proving fleet restart. For supervised restart, a replacement that never serves should produce the observed failure/outage, retained authority as applicable, and a non-PASS verdict; do not claim old-process fallback. Name the plain in-process case separately.

🌻 agreed (Discord msg 1565922704752779386): the `update.run` drive may test the update-respawn
negative only when it is labelled as such, never as evidence for the fleet's supervised restart
path.

So the control has three parts, kept apart:

- **The row's claim: the supervised branch.** The row verdict is graded from `positive` and
  `negative-replacement-never-usable` only. Both take the branch systemd-supervised fleet seats
  take. See [The row verdict](#the-row-verdict) and
  [🌻's negative](#s-negative-negative-replacement-never-usable).
- **The update-respawn controls.** `control-update-respawn-fallback` and
  `control-update-respawn-runtime-unavailable` (kind `update-respawn-control`) drive `update.run`
  on an unmanaged gateway. They are not evidence for the fleet restart claim. Their receipts sit
  beside the row verdict and never feed it, and the operator runs them only when reviewers want
  the update-path evidence. See [The update-respawn controls](#the-update-respawn-controls).
- **The plain in-process restart** is a named limit, `in-process-restart`, outside both. See
  [The plain in-process restart](#the-plain-in-process-restart).

This document is the operator's guide to the control:
`tools/k6-proofs/scripts/run-return-covenant-restart-control.mjs`. The product path it exercises,
with `path:line` anchors at F′ `f15237ec92`, is in the header of
`tools/k6-proofs/scenarios/r-cd-return-covenant-authority.js`. That k6 entry itself fails closed.

The control starts, restarts and stops a real gateway process, so it is not a process-local
fixture. The row manifest names it under `invocation.control` with
`invocation.artifactClass: "disposable-real-process"`. The verdict-cap rule
(`tools/k6-proofs/lib/row-verdict-cap.mjs`, the ruling on docs#616) therefore does not cap the
row at `PARTIAL-candidate`, as it caps R-CW-5/6's process-local fixtures. The row can grade
PASS-candidate from the two supervised cases.

## What it proves

A delegate's return is bound to the recipient session's authority generation: one UUID epoch per
logical session key, stored in `session_recipient_authority` in the per-agent database. A gateway
restart is not a generation edge. So across a real supervised restart, the epoch must stay present
and unchanged, including the outage where no gateway process serves, and the failure text must
survive. The rejected base lost the failure body.

**Usable means serving.** A generation is usable only while it owns the listening socket,
`/readyz` passes and hello-ok answers; the control observes all three at every sample. An
unchanged epoch alone is not usability. At F′ every full-process restart closes the old server
before any successor is ready, so continuous service across a restart is not an invariant and the
control does not assert it. It measures the outage instead. `outageInterval` runs from the last
sample at which the generation serving at the transition (old PID, original socket) still
served, to the first sample served by any other identity: the replacement, or the original
process on a new socket. Its precision is one sample interval. A draining old generation that
misses one hello-ok before it closes does not start the outage early.

The control establishes that generation without a model turn: `sessions.create`, then
`session.visibility.set` to `suggest`. The narrowing advances, and so creates, the epoch row. The
control reads the row read-only from outside the gateway and publishes only its SHA-256.

It does not deliver a delegate return across the restart. That needs a model turn and is outside
the ruling's receipt list. The product covers the durable-row half in
`src/gateway/server-restart-sentinel.new-process.proof.test.ts`.

## Which restart branch each case drives

F′ has two full-process restart branches with different failure behaviour. The row's two cases
drive the supervised one; the update-respawn controls drive the spawned one.

| Case | Kind | Supervisor hints in the old generation's environment | Restart reason | F′ branch | What it shows |
| --- | --- | --- | --- | --- | --- |
| `positive` | `row-positive` | `OPENCLAW_SUPERVISOR_MODE=external` only | `gateway.restart` | supervised (`src/cli/gateway-cli/run-loop.ts:497-561`) | A fresh successor serves under the unchanged epoch. |
| `negative-replacement-never-usable` | `row-negative` | `OPENCLAW_SUPERVISOR_MODE=external` only | `gateway.restart` | supervised | The successor never serves: the failure and the outage are observed, and this branch has no fallback. |
| `control-update-respawn-fallback` | `update-respawn-control` | none | `update.run` | spawned (`run-loop.ts:459-495`) | Update path only: the product-spawned child never serves; the original process serves again. |
| `control-update-respawn-runtime-unavailable` | `update-respawn-control` | none | `update.run` | spawned | Update path only: the product refuses the fallback because its child runtime is gone. |

**Systemd-supervised fleet seats take the supervised branch.** Their gateways carry
`OPENCLAW_SYSTEMD_UNIT` and systemd's `INVOCATION_ID`, so F′ resolves supervisor `systemd`
(`src/infra/supervisor-markers.ts:5-22`). The run loop writes the restart handoff, closes and
exits, and systemd starts the replacement. The positive case takes the same branch, with the
control standing in for systemd as the declared external supervisor, so the positive is the
fleet-relevant case. Once the handoff is written, that branch has no in-process fallback. The
supervised negative records this as `noFallback`. A proof-gw systemd unit cannot host the
control itself: `composite-launcher.sh` sets `OPENCLAW_SYSTEMD_UNIT` with `Restart=no`, so a
supervised restart there exits for good.

**Only the update respawn spawns a child.** These facts were read from the F′ source:

- `restartGatewayProcessWithFreshPid` returns only `supervised`, `disabled` or `failed`, never
  `spawned` (`src/infra/process-respawn.ts:231-273`).
- Without any supervisor hint, the restart decision is `disabled`/`unmanaged`
  (`process-respawn.ts:56-71`). A plain restart of an unmanaged gateway is therefore in-process
  under the same PID, with no child (`run-loop.ts:572-580`). That is the named limit in
  [The plain in-process restart](#the-plain-in-process-restart).
- The spawned branch runs only for a standalone update: a foreground update handoff, or an
  update-process reason (`update.run` or `update.auto`, `src/cli/gateway-cli/run-loop-request.ts:33-35`)
  with no supervisor. That path calls `respawnGatewayProcessForUpdate`
  (`process-respawn.ts:282-307`), which starts a detached child with inherited stdio and
  environment. `OPENCLAW_NO_RESPAWN` disables it.
- The untargeted `gateway.restart.request` passes its reason through to the run loop. So the
  update-respawn controls send `{reason:"update.run", skipDeferral:true}` without performing an
  update, and `installationReplacement` is absent by construction.
- The product's own test of this fallback drives it the same way:
  `src/cli/gateway-cli/run-loop.test.ts:1076-1110`.

The control builds the old generation's environment from scratch. It then reads the running
process's own `/proc/<pid>/environ` (keys only) and records which of the eight hint keys it
carries (`OPENCLAW_SUPERVISOR_MODE`, `OPENCLAW_SYSTEMD_UNIT`, `INVOCATION_ID`, `SYSTEMD_EXEC_PID`,
`JOURNAL_STREAM`, `OPENCLAW_SERVICE_MARKER`, `OPENCLAW_SERVICE_KIND`, `OPENCLAW_NO_RESPAWN`). If the
keys are not exactly the ones the case needs, the record grades MISSING
(`branch-precondition-unmet`).

## The row verdict

The row verdict is graded from `positive` and `negative-replacement-never-usable` only, by
`gradeReturnCovenantRow` in `tools/k6-proofs/lib/return-covenant-restart-control.mjs`. The
operator runs it over the signed receipts with `--grade-row` (see
[Operator steps](#operator-steps-for-the-f-fire)). It counts only receipts whose observer signature
verifies. Any other receipt is listed in `unverifiedReceipts`, is never counted, and makes the exit
status 1.

The verdict starts from the positive's and only moves down:

| Condition | Row verdict at most | Reason code |
| --- | --- | --- |
| no verified `positive` receipt | `MISSING-candidate` | `positive-missing` |
| no verified `negative-replacement-never-usable` receipt | `PARTIAL-candidate` | `supervised-negative-missing` |
| the supervised negative graded PASS | `MISSING-candidate` | `supervised-negative-not-refused` |
| the supervised negative is non-PASS but does not hold | `PARTIAL-candidate` | `supervised-negative-not-holding` |
| the two cases ran different candidates, or one names no 40-hex candidate SHA | `MISSING-candidate` | `row-cases-candidate-mismatch`, `row-case-candidate-unbound` |
| the two cases ran different docs harnesses, or one names no 40-hex docs SHA | `PARTIAL-candidate` | `row-cases-docs-mismatch`, `row-case-docs-unbound` |
| a receipt for a supervised or unknown case did not verify, or cannot be counted | `PARTIAL-candidate` | `row-receipt-unverified`, `case-conflict`, `case-unknown`, `case-kind-mismatch`, `case-grade-missing` |
| a case has more than one receipt | the worst of its receipts | `row-case-repeated` |

So `PASS-candidate` needs a `PASS-candidate` positive and a supervised negative that holds, both
from one candidate. A control that cannot refuse PASS makes its positive no evidence, which is why
a passing supervised negative caps the row at MISSING. The row re-checks the supervised negative
from its grade (the failure, the outage, the retained authority and body, `noFallback`) rather
than trusting its `holds` alone. A receipt for a supervised case is counted only when it names
exactly that case (its own and its record's) and every kind it states is that case's. Anything
else caps the row instead of being ignored: an update-respawn control relabelled as the supervised
negative, for example (`case-kind-mismatch`). So the worst of a case's receipts cannot be dodged by
one that fails to count.

A receipt is an update-respawn control when every case it names is a control case. Those receipts
are reported in `controls`, each with `kind: update-respawn-control` and `feedsRowVerdict: false`,
and an unverified one stays beside the verdict too. They neither raise the row verdict nor are
required for it. Everything in the row verdict except `controls` is identical with or without
them. The CLI lists them after the verdict line, with whether each held. The row verdict also lists
`namedLimits`: `in-process-restart`.

## 🌻's negative: `negative-replacement-never-usable`

🌻's negative is `negative-replacement-never-usable`. It takes the same supervised branch as the
positive. After the old generation exits through the accepted handoff, the control binds the port
itself and then starts the replacement. The replacement retries the held port, logs `another
gateway instance is already listening on …` and exits nonzero, so it never serves.

Following 🌊's final ruling, it must show all of these, and `negativeControl.holds` requires them:

- **the observed failure:** `replacement-never-usable` in `grade.failures`
  (`negativeControl.failureObserved`). The failure body is kept (`failureBodyRetained`): the
  replacement's stderr and stdout, the last not-ready probe body, and the restart frame.
- **the outage:** `outageInterval` starts at the last serving old sample and stays open to the
  end of the window (`outageObserved`).
- **the authority retained:** the epoch is unchanged at every sample and the old generation's
  fingerprint is kept (`oldAuthorityRetained`). That is retained authority, never a claim that
  the old generation served.
- **a non-PASS verdict** (`nonPass`): it grades `FAIL-candidate`.
- **`noFallback`:** the old generation exited 0 through the accepted handoff and nothing served
  again. The supervised branch has no in-process fallback once the handoff is written, so no
  old-process fallback is claimed: `grade.fallback.branch` is `none-on-supervised-branch`.

A record in which the original process serves again after it exited does not hold, and the row
cannot pass.

## The update-respawn controls

🌊's final ruling keeps the `update.run` path out of the row's claim: an `update.run` reason on an
unmanaged disposable gateway "can test the update-respawn fallback, but it is a distinct
control—not the negative proving fleet restart." So `control-update-respawn-fallback` and
`control-update-respawn-runtime-unavailable` are labelled controls:

- Their case names start with `control-update-respawn-`. Each record, grade and signed receipt
  also carries `kind: update-respawn-control`, and the grade says `feedsRowVerdict: false`.
- They are not evidence for the fleet restart claim. Fleet seats are systemd-supervised and take
  the supervised branch, never this one.
- Their receipts sit beside the row verdict: they neither raise it nor are required for it.
- They are optional in the F″ operator loop. Run them only when reviewers want the update-path
  evidence.

🌊's earlier ruling on the fork (Discord msg 1565903655885082677) still says what they prove. On
this branch `handleRestartAfterServerClose` has already closed the old server before the child's
readiness is observed. On an unready child, the run loop:

1. kills the child;
2. marks the restart `restart-unhealthy`;
3. calls `reacquireAndResumeInProcessRestart()` (`run-loop.ts:266-360`).

So continuous old-process service until the replacement is ready is not an invariant here either.
The fallback control proves the narrower behaviour: the child is never healthy; the failure body
and diagnostic are retained; and, if the old runtime is viable and not replaced, the original
process reacquires the lock and serves again under the preserved authority.

`control-update-respawn-fallback` drives that path:

1. Once the old listener has closed, the control binds the port itself on `127.0.0.1`. F′
   binds that host first in loopback mode, and a failure there is fatal
   (`src/gateway/server-runtime-state.ts:551-577`, `src/gateway/net.ts:312-327`). The product's child cannot
   serve: it retries the held port 20 × 500 ms (`src/gateway/server/http-listen.ts:6-7`), then
   fails its first boot and exits nonzero.
2. The control finds the child in `/proc`: a child of the old PID that carries the run marker,
   appeared after the trigger, and runs a script from the stage with the `gateway` command. That
   is required on two polls, because between fork and exec a helper still shows its parent's
   command line. The gateway's own helpers (the codex app server, plugin workers) also carry the
   marker. The control records the child's PID, parent PID and start ticks. When the product
   names its child in its own diagnostic, that PID overrides anything inferred. The port is
   released only once that child is gone, because a dead child can never become healthy.
3. The product's readiness wait then ends with `stopped-free` (or times out after up to 60 s).
4. The product logs `update respawn child did not become healthy (<pid>); falling back to
   in-process restart` and restarts in-process.

Its own grade is `FAIL-candidate` (`replacement-never-usable`). Its expectation,
`negativeControl.holds: true`, requires all of these:

- the update respawn ran (the child was seen, or the product named it);
- no sample saw the child serving;
- the product's fallback line and the restart frame body were retained;
- the original PID and start ticks own the listener again, on a new socket, with `/readyz` and
  hello-ok passing, through to the end of the window;
- the epoch is unchanged at every sample;
- `outageInterval` was measured, from the last serving old sample to the first sample where the
  original process serves again.

`grade.fallback.branch` is `restored`, with class `old-process-restoration`. That is old-process
restoration, never fresh-successor proof. No control case can grade PASS, and none of it reaches
the row verdict.

## Named non-PASS fallback branches

These belong to the update-respawn controls. `reacquireAndResumeInProcessRestart` can refuse or
fail the fallback. Each refusal has the product's own diagnostic, and the control keeps every such
line in `fallback.diagnostics` (redacted). A **limit** means the product declined an in-process
recovery whose precondition is false: the old runtime is not viable, or it was replaced. A
**failure** means the fallback itself failed. Neither is ever PASS. On the update-respawn controls
the child never served, so the control grades FAIL-candidate (`replacement-never-usable`)
whichever branch blocked the fallback. The branch and its class are recorded in `grade.fallback`,
a limit also in `grade.limits` and a failure in `grade.failures`.

| Branch | Product diagnostic | F′ anchor (`run-loop.ts`) | Class | How it is tested |
| --- | --- | --- | --- | --- |
| `resources-retained` | `shutdown resources remain; refusing in-process restart and exiting` (exits 0) | `:270-273` | limit | scripted gateway |
| `require-fresh-process` | `Fresh-process restart failed; the unsettled native worker cannot recover in-process` | `:274-279` | limit | scripted gateway |
| `child-runtime-unavailable` | `Fresh-process restart failed; the unavailable child runtime cannot recover in-process` | `:280-285` | limit | **induced**: `control-update-respawn-runtime-unavailable` |
| `foreground-closed` | `… did not become healthy (…); shutdown pending; retaining the replacement until it closes` | `:286-288` (warned at `:486-488`) | limit | scripted gateway |
| `installation-replaced` | `… the replaced runtime cannot resume` / `Cannot continue in this process` | `:308-310`, `:336-338` (exit at `:203-214`) | limit | scripted gateway |
| `lock-reacquire-failed` | `failed to reacquire gateway lock for in-process restart` | `:313-331` | failure | scripted gateway |

Only the unavailable child runtime can be induced on a disposable gateway:

- `control-update-respawn-runtime-unavailable` runs the old generation on a copy of the runtime in
  `<artifact-dir>.private/runtime/node`, owned by the control, and removes the copy before the
  transition.
- The product's child spawn then fails, and its viability check finds the runtime missing
  (`src/infra/child-runtime-viability.ts:48-62`).
- The case must report `negativeControl.holds: true`: the branch is named from the product's line,
  the old process exits nonzero, nothing serves again, and the epoch is unchanged.

The other branches cannot be induced:

- `requireFreshProcess` comes only from native-worker recovery under a native service supervisor
  (systemd, launchd or schtasks; `process-respawn.ts:107-113`, `198-203`), never from a targeted
  restart intent (`restart-request.ts:57-82`).
- The gateway lock is state-database ownership and never probes the port
  (`src/infra/gateway-lock.ts:417-572`), so a held port cannot make a reacquire fail.
- A foreground-closed or replaced installation needs a real update.

Their grading is tested through the scripted gateway, with each product line and exit code.

The grader classifies anything else as follows:

- **Not exercised** (MISSING, `negative-not-exercised`):
  - a restart that stayed in-process (`in-process-restart`; see
    [The plain in-process restart](#the-plain-in-process-restart));
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

## The plain in-process restart

🌊's final ruling: "Name the plain in-process case separately." An unmanaged gateway restarted
without an update-process reason restarts in-process under the same PID, with no child and no
handoff (`src/cli/gateway-cli/run-loop.ts:572-580`). That is `in-process-restart`, a named limit
(`RCC_IN_PROCESS_RESTART`), kept apart from both the row's claim and the update-respawn controls:

- No case drives it, so nothing this control records is evidence about it.
- Every row verdict lists it in `namedLimits`.
- An update-respawn control run that lands there, because the product ignored `update.run`,
  grades `MISSING-candidate` (`negative-not-exercised`, branch `in-process-restart`).

Fleet seats do not take it: they are systemd-supervised.

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
   - On the supervised branch (the row's cases), it waits for the old generation to close and
     exit 0. Then it runs `gateway restart-handoff consume --expected-pid <old pid> --json`,
     starts the replacement and verifies it the same way, with a new bootId.
     `negative-replacement-never-usable` first binds the port itself, so the replacement cannot
     serve.
   - On the spawned branch (the update-respawn controls), the product starts and judges the
     child. The control follows it as described above, then waits for the original process to
     serve again or to exit.
6. **Cleanup.** It signals only its own generations, after re-checking PID, start ticks and run
   marker.
   - It stops any process still carrying the run marker, which includes a product-spawned child
     and one that called setsid. That is graded as a leak.
   - It closes any socket it held, removes the runtime copy, and confirms nothing listens.
   - It keeps the isolated state for `composite-launcher.sh shred`.
7. **Receipt.** It grades the record, signs `observer-receipt.json` with the observer key
   (`hmac-sha256-proof-observer-key-v1`), and writes raw logs and frames to
   `<artifact-dir>.private` (mode 0700, never published). The receipt names the case and its
   `kind`.

## Receipts and grading

| Receipt | Where it comes from |
| --- | --- |
| `transition-http-body` | The restart response frame (hash; redacted public copy; raw private) plus the `/readyz` and `/startupz` bodies at the edges: last pre-transition, first not-ready, first replacement-ready, last not-ready. |
| `replacement-process-output` | Supervised: the replacement's stdout and stderr, captured by the control as supervisor (bytes, SHA-256, redacted tail). Spawned: the product starts the child with inherited stdio (`process-respawn.ts:295-299`), so the old generation's streams carry it; the restart diagnostic lines are kept in `fallback.diagnostics`. |
| `generation-fingerprints` | Old and replacement PID, start ticks, listening socket inode and port, bootId hash, buildId. Spawned: the child's PID, parent PID and start ticks (or its PID from the product's line, `unknown` when its spawn failed), and the restored original process's new socket and bootId. |
| `observation-record` | The plan and the matrix. |
| `signed-cleanup-receipt` | The cleanup record inside the receipt signed with the observer key. |

Each case's own verdict, from its signed record only:

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
  - a negative or control that was not exercised;
  - a declared limit with nothing else contradicted. This cannot happen on the update-respawn
    controls, where the child's failure already grades FAIL.
- **PARTIAL-candidate** means an observed, uncontradicted restart with a missing receipt or bound:
  a lost body or output, a missing fingerprint, an unsigned receipt, an unreadable authority
  sample, a short window, or a dirty harness.

No case but the positive can grade PASS: a negative or control that nothing contradicted grades
MISSING (`negative-not-exercised`). These are per-case verdicts. The row's verdict comes only from
[The row verdict](#the-row-verdict).

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

Each case other than the positive must be non-PASS with `negativeControl.holds: true`:

- `negative-replacement-never-usable`: the conditions in
  [🌻's negative](#s-negative-negative-replacement-never-usable).
- `control-update-respawn-fallback`: the conditions in
  [The update-respawn controls](#the-update-respawn-controls).
- `control-update-respawn-runtime-unavailable`: the conditions in
  [Named non-PASS fallback branches](#named-non-pass-fallback-branches).

## Operator steps for the F″ fire

Run these on a seat that builds locally, with a stage-only build of the exact successor SHA. Never
point the control at the live install. The row needs only its two supervised cases, then the row
verdict:

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
RCC=tools/k6-proofs/scripts/run-return-covenant-restart-control.mjs
KEY=~/.config/frond/rcc-observer.key
cd "$W"
for CASE in positive negative-replacement-never-usable; do
  node $RCC \
    --proof-gw-dir ~/proof-gw/comp-${SHA:0:8} --stage-dir "$V" \
    --candidate-sha "$SHA" --docs-sha "$DOCS" --case "$CASE" \
    --artifact-dir "$OUT/$CASE" --observer-key-file "$KEY" \
    --gateway-env OPENCLAW_CODEX_APP_SERVER_BIN=$HOME/.local/bin/codex \
    --gateway-env NODE_OPTIONS=--max-old-space-size=16384
  node $RCC --verify "$OUT/$CASE/observer-receipt.json" --observer-key-file "$KEY"
done
node $RCC --observer-key-file "$KEY" \
  --grade-row "$OUT/positive/observer-receipt.json" \
  --grade-row "$OUT/negative-replacement-never-usable/observer-receipt.json"
```

Optional: the update-respawn controls, only when reviewers want the update-path evidence. They are
not evidence for the fleet restart claim, and adding their receipts to `--grade-row` changes
nothing but its `controls` list. They default to a 150 s restoration deadline inside a 180 s
window, because the product's readiness wait alone can take 60 s before an in-process boot:

```bash
for CASE in control-update-respawn-fallback control-update-respawn-runtime-unavailable; do
  node $RCC \
    --proof-gw-dir ~/proof-gw/comp-${SHA:0:8} --stage-dir "$V" \
    --candidate-sha "$SHA" --docs-sha "$DOCS" --case "$CASE" \
    --artifact-dir "$OUT/$CASE" --observer-key-file "$KEY" \
    --gateway-env OPENCLAW_CODEX_APP_SERVER_BIN=$HOME/.local/bin/codex \
    --gateway-env NODE_OPTIONS=--max-old-space-size=16384
  node $RCC --verify "$OUT/$CASE/observer-receipt.json" --observer-key-file "$KEY"
done
```

Then, after the receipts are copied:

```bash
bash $L shred $SHA $SHA
```

Expected:

| Evidence | Verdict | Also |
| --- | --- | --- |
| row verdict (`--grade-row`) | `PASS-candidate` | `gradedFrom: [positive, negative-replacement-never-usable]`, `reasons: []`, `namedLimits: [in-process-restart]` |
| `positive` | `PASS-candidate` | `outageInterval` closed, `firstServingAfter.generation: replacement` |
| `negative-replacement-never-usable` | `FAIL-candidate` | `negativeControl.holds: true`, `failureObserved`, `outageObserved`, `noFallback: true`, `outageInterval.open: true` |
| `control-update-respawn-fallback` (optional) | `FAIL-candidate` | `kind: update-respawn-control`, `negativeControl.holds: true`, `fallback.branch: restored`, `firstServingAfter.generation: old` |
| `control-update-respawn-runtime-unavailable` (optional) | `FAIL-candidate` | `kind: update-respawn-control`, `negativeControl.holds: true`, `fallback.branch: child-runtime-unavailable` (limit) |

Publish only `$OUT/<case>/` after review. Never publish `*.private`. Folding into `PROOFS/` is a
separate, reviewed corpus step. RETURN-COVENANT stays MISSING until this control fires on F″.

A helper the gateway started detached, which outlives the gateway's own shutdown, carries the run
marker and is stopped and graded as a leak (`resource-retention`). That is a false FAIL at worst,
never a false PASS; report it.

If the positive grades MISSING with `authority-not-established`, or PARTIAL with
`authority-sample-unreadable`, the record's `authority.error` and the sample reasons say which
product surface refused. Report it; do not retry with a weaker configuration. The same applies to
an update-respawn control that grades `not-exercised` or names an unexpected branch: the retained
diagnostic lines say which path the product took.
