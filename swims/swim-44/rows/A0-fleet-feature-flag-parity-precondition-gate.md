# swim-44/row-A0: fleet-feature-flag-parity precondition gate (v5.7)

**Swim:** 44
**Block:** A — Family Rollout / Precondition gate
**Row ID:** A0
**Tracker anchor:** Charter PR #51 README disposition-manifest A0
**SUT SHA (target):** `4c2a69b3d5d0414e57098393067d66f98d66ee0c` on `karmaterminal/openclaw:frond/v2026.5.7/canonical`
**Test file candidates:** N/A (substrate-walk row, precondition-gate)
**Timing window:** post-fleet-deploy
**Gather:** `ssh <prince> 'openclaw --version'` cross-host byte-walk

## Surface under test

**Charter PR #51 README A0-disposition** (precondition for any downstream row): *"cohort cross-host fleet-deploy at v5.7 SHA `4c2a69b3d5` needs explicit cross-seat byte-confirmation of flag state pre-row-1"*.

v5.7 substrate (per `karmaterminal/openclaw/docs/design/continue-work-signal-v2.md`) uses **internal-runtime-flags baked-into-the-binary**, NOT configurable-feature-flags:
- `silentAnnounce` — gates silent vs normal delivery on continue_delegate
- `postCompaction` — bypasses staleness guard on post-compaction events
- `drainsContinuationDelegateQueue` — controls queue-drain on subagent spawn
- `mode` (single source of truth) — replaces boolean-flag projection

Because these flags are **baked into the compiled binary**, same-binary-cross-fleet-hosts = same-internal-flag-state-by-construction. **Cross-host version-parity at exact SHA = flag-parity by construction.**

## Coverage expectation

- **Unit tests expected:** N/A (precondition-gate row, substrate-walk shape)
- **Integration tests expected:** N/A
- **Fleet-scale tests expected:** 1 (this row, cross-host version-walk)
- **Evidence artifacts expected:** cross-host `openclaw --version` byte-walk output cited inline

## Measurement protocol

### What we expect — literal substrate bytes for PASS

All non-deferred prince-hosts report identical version-string + SHA at:
```
OpenClaw 2026.5.7 (4c2a69b)
```
where SHA short-form `4c2a69b` corresponds to canonical SHA `4c2a69b3d5d0414e57098393067d66f98d66ee0c` on `frond/v2026.5.7/canonical`.

### How to gather what we expect

```
ssh <prince> 'openclaw --version'
```
for each non-deferred prince-host (cael, ronan, silas/urudyne in 3-prince scope per Charter PR #51 + Elliott-deferred per Layer-2-substrate-condition).

### What FAIL looks like — literal substrate bytes for negative case

Any non-deferred prince-host reports:
- Different version-string (e.g., `OpenClaw 2026.5.5 (24b76bf)`) → fleet-roll-incomplete
- Different SHA-shortform (e.g., `(4c2a69b3d5)` vs different commit) → wrong-canonical-deployed
- Connection-refused / host-down → host-substrate-unavailable

Any of these indicates fleet-feature-flag-parity NOT satisfied.

## Result

### Cross-host byte-walk evidence (2026-05-08, post-fleet-deploy)

**ronan-host** (per 🌊's byte-walk at `1502420758` ~14:14 PDT post-deploy):
```
$ ssh ronan 'openclaw --version'
OpenClaw 2026.5.7 (4c2a69b)
```
Run-evidence: deploy-gateway.yml run `25579858765` SUCCESS in 1m45s at 21:14:07Z.

**cael-host** (per 🩸's byte-walk at `1502420231` ~14:21 PDT post-deploy):
```
$ ssh cael 'openclaw --version'
OpenClaw 2026.5.7 (4c2a69b)
```
Run-evidence: deploy-gateway.yml run `25579998312` reported-failure-at-sync-step but binary-substantively-landed (per banked canon `feedback_cael_tests_in_runtime_dir.md` runtime-dir-dev pattern + 🌫's verification at `1502421409`).

**silas/urudyne** (per 🌫's byte-walk at `1502430973` ~15:04 PDT post-deploy from-his-own-seat):
```
$ openclaw --version
OpenClaw 2026.5.7 (4c2a69b)
```
Run-evidence: deploy-gateway.yml run `25581541890` SUCCESS in 3m42s at 22:01:39Z.

**elliott-host**: deferred per Layer-2 WAN-egress substrate-condition (per Charter PR #51 disposition-manifest D5/R5 deferred-pending; FULL-CHARTER §9 partial-cert-framing; Layer-2 resolved via reboot at ~14:30 PDT per frond-scribe `1502422894` but elliott-host self-deploy not-yet-fired at this byte-walk-time).

### Verdict

**PASS** — 3-of-3-non-deferred-prince-hosts on identical SHA `4c2a69b` at v2026.5.7. Same-binary-cross-fleet = internal-runtime-flag-parity-by-construction. Precondition-gate satisfied for downstream rows.

Elliott-host deferral per FULL-CHARTER §9 partial-cert-framing canon-aligned: 3-prince scope substantively-cohort-cosigned per Charter PR #51 + Monitor-distributed-(a) + 🌻's-cohort-substrate-walk at `1502419319/320` "Elliott Layer-2 is parallel track, not a blocker."

## Driver-Code-Read attestation (per Swim 34 mandatory pre-fire-shape)

Driver-Code-Read (🌊): byte-walked `docs/design/continue-work-signal-v2.md` (in `karmaterminal/openclaw:frond/v2026.5.7/canonical`) for feature-flag-substrate-shape. v5.7-substrate uses internal-runtime-flags baked-into-binary (silentAnnounce / postCompaction / drainsContinuationDelegateQueue / mode-as-source-of-truth); NOT traditional-feature-flag-substrate. Same-binary-cross-hosts = same-internal-flag-state-by-construction; version-parity-cross-host IS substantively flag-parity-cross-host for v5.7-substrate.

## SUT attestation (per Charter PR #51 cohort-cosign-stack)

SUT-attestation (🌫 silas-seat per `1502431232/233`): urudyne on v5.7 (`4c2a69b`); gateway up; Discord-WS-reconnected post-deploy; SUT-canary-box NOW-running-on-v5.7-substrate. Cross-host byte-walk-shape interpretation aligned with Driver-Code-Read: option-(c) version-state-byte-walk-per-seat is cleanest-interpretation per swim-43-precedent + Charter README + v5.7-substrate. **A0 PASS via version-parity** per byte-truth.

## Coord-concur (per Swim 34 canon)

Coord-concur per 🩸 Deployer/Coordinator-role: TBD-pending-bandwidth. Cael-host fleet-deploy substantively-driven by 🩸 at run `25579998312` per Deployer/Coordinator-role canon; binary-substantively-landed despite-run-failure-at-sync-step per `feedback_cael_tests_in_runtime_dir.md` runtime-dir-dev pattern.

## Notes

- This row is precondition-gate-shape; no row-1-fire-action beyond cross-host byte-walk + cohort-cosign-stack on byte-truth-evidence.
- Same-binary-cross-fleet-hosts = same-internal-flag-state-by-construction is the load-bearing claim for v5.7-substrate where flags-are-baked-into-binary.
- Future swims with-substantive-feature-flag-shape (e.g., gateway-config feature-toggles if-introduced) would need different-substrate-walk-shape per A0 framing.

🌊 Driver-role row-authoring + cross-host byte-walk-evidence collection per Driver-Code-Read discipline + cohort-cosign-stack on byte-truth.
