# R-CD-RETURN-COVENANT-AUTHORITY: disposable real-restart control

🌊's ruling (Discord msg 1565895695586558120, karmaterminal/openclaw-bootstrap#1727) keeps this
row required and MISSING until a disposable real-restart control runs on the final successor. The
run must include 🌻's negative, a replacement that never becomes usable. This document is the
operator's guide to that control:
`tools/k6-proofs/scripts/run-return-covenant-restart-control.mjs`. The product path it exercises,
with `path:line` anchors at F′ `f15237ec92`, is in the header of
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
before any successor is ready (🌊's ruling, Discord msg 1565903655885082677), so continuous
service across a restart is not an invariant and the control does not assert it. It measures the
outage instead: `outageInterval` runs from the last sample that saw the old generation serving to
the first sample that saw a generation serving again, with a precision of one sample interval.

The control establishes that generation without a model turn: `sessions.create`, then
`session.visibility.set` to `suggest`. The narrowing advances, and so creates, the epoch row. The
control reads the row read-only from outside the gateway and publishes only its SHA-256.

It does not deliver a delegate return across the restart. That needs a model turn and is outside
the ruling's receipt list. The product covers the durable-row half in
`src/gateway/server-restart-sentinel.new-process.proof.test.ts`.

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
   environment: the proof-gw state, config and port, `OPENCLAW_SUPERVISOR_MODE=external`, and a run
   marker. It waits until that process owns the listening socket, `/readyz` and `/startupz` pass,
   and `hello-ok` answers.
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
5. **Transition.** It sends `gateway.restart.request {reason:"gateway.restart", skipDeferral:true}`
   with `operator.admin`. It waits for the old generation to close and exit 0, then runs
   `gateway restart-handoff consume --expected-pid <old pid> --json`. Then it starts the replacement
   and verifies it the same way, with a new bootId. The negative case first binds the port itself,
   so the replacement cannot serve.
6. **Cleanup.** It signals only its own generations, after re-checking PID, start ticks and run
   marker. It stops any process still carrying the run marker, even one that called setsid
   (that is graded as a leak), closes the negative's socket, and confirms nothing listens. The isolated state is kept
   for `composite-launcher.sh shred`.
7. **Receipt.** It grades the record, signs `observer-receipt.json` with the observer key
   (`hmac-sha256-proof-observer-key-v1`), and writes raw logs and frames to
   `<artifact-dir>.private` (mode 0700, never published).

## Receipts and grading

| Receipt | Where it comes from |
| --- | --- |
| `transition-http-body` | The restart response frame (hash; redacted public copy; raw private) plus the `/readyz` and `/startupz` bodies at the edges: last pre-transition, first not-ready, first replacement-ready, last not-ready. |
| `replacement-process-output` | The replacement's stdout and stderr, captured by the control as supervisor: bytes, SHA-256, redacted tail. |
| `generation-fingerprints` | Old and replacement PID, start ticks, listening socket inode and port, bootId hash, buildId. |
| `observation-record` | The plan and the matrix. |
| `signed-cleanup-receipt` | The cleanup record inside the receipt signed with the observer key. |

The verdicts, from the signed record only:

- **PASS-candidate** needs all five receipts and the positive behaviour:
  - the old generation was ready before the transition;
  - the restart was accepted;
  - the old generation exited 0 through an accepted full-process external handoff bound to its
    PID;
  - every sample shows the same epoch;
  - the old generation was observed serving before the transition, and the replacement was
    observed serving from its first serving sample to the end of the window;
  - the replacement was ready by the deadline, with a new PID, inode and bootId, and both
    generations reported the staged buildId;
  - the full window was observed without blind gaps;
  - the docs harness was clean;
  - cleanup left nothing running.
- **FAIL-candidate** means the behaviour was contradicted: the epoch was cleared or advanced, the
  old generation did not serve before the transition, there was no handoff, the replacement never
  served or stopped serving, the generations were not distinct, or something survived cleanup.

Every receipt reports `outageInterval`: `lastServingBefore` and `firstServingAfter` (time,
generation, listener inode, owner PID), `ms` between them, `open` when nothing served again
before the window ended, the count of unserved samples, and `resolutionMs` (the sample interval).
It is reported, not graded against a bound: no restart path at F′ avoids it.
- **MISSING-candidate** means there is nothing to judge: no matrix, no established authority, or a
  rejected restart (its body is still kept).
- **PARTIAL-candidate** means an observed, uncontradicted restart with a missing receipt or bound:
  a lost body or output, a missing fingerprint, an unsigned receipt, an unreadable authority
  sample, a short window, or a dirty harness.

The negative case must be non-PASS with `negativeControl.holds: true`: the old authority and the
failure body are both retained.

## Operator steps for the F″ fire

Run these on a seat that builds locally, with a stage-only build of the exact successor SHA. Never
point the control at the live install.

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
for CASE in positive negative-replacement-never-usable; do
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

Expected: `positive` gives `VERDICT: PASS-candidate`; the negative gives
`VERDICT: FAIL-candidate` with `negativeControl.holds: true`. Publish only `$OUT/<case>/` after
review. Never publish `*.private`. Folding into `PROOFS/` is a separate, reviewed corpus step.

If the positive grades MISSING with `authority-not-established`, or PARTIAL with
`authority-sample-unreadable`, the record's `authority.error` and the sample reasons say which
product surface refused. Report it; do not retry with a weaker configuration.
