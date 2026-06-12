# R-CW-DELEGATE — rune-rog-ally seat

**Verdict: PASS.** `continue_delegate` fires end-to-end on the deployed v4 binary `c06e081f760d` — dispatch-record + spawned-shard both `succeeded` in the live durable registry (`flow_runs`). The #990-continuation surface is wired + live-functional on this seat's main-runner.

Self-contained (clawsweeper-standalone): all bytes below were captured on rune-rog-ally and need no reference to any other corpus row.

---

## Seat + deployed-binary identity

- **Seat:** rune-rog-ally (ROG Ally Z1 Extreme RC71L, 16GB; prince 🪨 Rune)
- **gh attribution:** `rune-dandelion-cult` (per-row own-auth canon, not karmafeast)
- **Running gateway:** `/home/figs/flesh_beast_tmp/openclaw/dist/index.js`
- **Install HEAD:** `c06e081f760d723c77bee65464b8920a76d3b523` (== v4 `c06e081f76`, the fleet-fan artifact / A-B + PROOFS target)
- **CLI:** `OpenClaw 2026.6.2 (c06e081)`
- **/status continuation-row:** `🔄 Continuation: chain 0/200` · `🔑 token (github-copilot:github)` resolves

Independent of the `/status` card — the install HEAD was byte-read directly from the running gateway's install dir (`git -C /home/figs/flesh_beast_tmp/openclaw rev-parse HEAD`).

---

## Primary proof — continue_delegate → two flow_runs rows, both succeeded

A deliberate minimal continue_delegate specimen was fired to produce a clean dispatch+spawn record. Both rows landed in `~/.openclaw/state/openclaw.sqlite` (`flow_runs`, the live durable registry — the migrated store, NOT the stale `flows/registry.sqlite.migrated` backup):

| flow_id | role | controller / shape | status | timing |
|---|---|---|---|---|
| `7950f6e4-9154-453a-9ec3-05354ab395a3` | **dispatch-record** (continue_delegate accepted) | `core/continuation-delegate` | `succeeded` | created 20:29:35 → ended 20:30:02 |
| `668a74a4-7992-4cf4-8e89-237dd39c4c39` | **spawned-shard** (ran-to-completion) | `task_mirrored` | `succeeded` | created 20:30:02 → ended 20:30:05 (**~2.9s**) |

- Dispatch `state_json`: `kind=continuation_delegate`, `childSessionKey=agent:main:subagent:continuation-66be2a14284db341322e12b7c50dcfca`, `traceparent=00-f91d7bf1b6a1163a916955785dc7993a-daf6406e2f4b8933-01`.
- Spawned-shard `goal`: `[continuation:chain-hop:1] Delegated task (turn 1/200): PROOF-ROW R-CW-DELEGATE specimen …`
- Child returned: `"rune-rog-ally R-CW-DELEGATE dispatch-path executed on c06e081f760d"`.

So: `continue_delegate` → dispatch-record (`7950f6e4`, accepted) → spawned-shard (`668a74a4`, ran-to-completion-succeeded). End-to-end, on the deployed binary. Raw byte-capture: see `dispatch-result_7950f6e4.txt`.

---

## Embedded check-lines (captured on this seat, same binary)

### #996 `:518` carry-forward — CLEAN on v4 (co-verify, the only seat running v4 live)

The #996 fold (`e77e5a401c`) survived the v3→v4 re-drift. Byte-walked the **deployed dist**:

```
dist/work-store-5haSToNg.js:362:  if (decodeWorkState(flow)?.succeeded) return false;
```

- Source-form `&& !decodeWorkState(flow)?.succeeded` (source line 534, per Frond's independent v3↔v4 diff: `work-store.ts` byte-identical, cherry-pick = same bytes/new commit-object) → compiled to this early `return false` guard inside `hasLiveOrRecentlyDispatchedContinuationWork` at dist line 362.
- Behavior intact: a flow whose work-state is `succeeded` is **EXCLUDED** from live-or-recently-dispatched (the delivered-marked-but-running-row exclusion). The re-drift did NOT silently drop the fold.

### request_compaction — wired + functional (clean threshold-reject, not missing-opts error)

Fired live on this seat:

```
request_compaction → { status: rejected, guard: context_threshold,
                       contextUsage: 17, threshold: 70 }
```

A structured threshold-reject (`{guard, contextUsage, threshold}`) — NOT a missing-tool / missing-opts error-out. Dispositive proof `requestCompactionOpts` is present + wired on this seat's live v4 main-runner.

### #868 continuation-warning — BENIGN on this seat (inventory/dispatch domain, not main-runner gap)

All three continuation-tools are live-functional on this seat's main-runner:
- `continue_delegate` → the two succeeded rows above.
- `request_compaction` → the clean 17%-threshold-reject above.
- `continue_work` → fired this session (row `f6056f5c`, `core/continuation-work`).

So the #868 warn (where it fires) is the inventory/dispatch stub-build domain, not a main-runner `availableTools` wiring-gap. Concordant with the corpus `R-868-CONFIRM` (elliott-host) and the ronan-dgx / silas-lothric live-bytes — rune-rog-ally is the 4th seat-confirm.

---

## Provenance

- All bytes captured 2026-06-11 ~20:29–20:34 PDT on rune-rog-ally by 🪨 Rune (gh `rune-dandelion-cult`).
- flow_runs source: `~/.openclaw/state/openclaw.sqlite` (live durable registry).
- Deployed SHA cross-checked three ways: install-dir `git rev-parse HEAD`, running gateway path, and CLI `--version`.
