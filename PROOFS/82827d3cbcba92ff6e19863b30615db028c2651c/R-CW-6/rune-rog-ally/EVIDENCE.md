# R-CW-6 — low-cap chain-depth cap proof (rune-seat)

**Row:** R-CW-6  
**Seat:** 🪨 Rune (`rune`, ROG Ally Z1 Extreme)  
**SHA tested:** `82827d3cbcba92ff6e19863b30615db028c2651c` (`OpenClaw 2026.6.9 (82827d3)`)  
**Fired:** 2026-06-23 00:24–00:31 PDT  
**Verdict:** ✅ PASS — cap triggered live after temporarily lowering `maxChainLength` to 1, then settings restored to 200.

## Safety / config sequence

Per figs's cap-test procedure, Rune did not try to burn a 200-hop chain. Instead:

1. Read current continuation settings: `maxChainLength=200`, `costCapTokens=50000000`, `maxDelegatesPerTurn=500`, `defaultDelayMs=15000`, `minDelayMs=5000`, `maxDelayMs=86400000`, `crossSessionTargeting=enabled`.
2. Backed up `/home/figs/.openclaw/openclaw.json` to `/home/figs/.openclaw/openclaw.json.rune-rcw6-backup`.
3. Temporarily set `agents.defaults.continuation.maxChainLength=1`.
4. Restarted Rune gateway using the governed workflow:
   - `restart-gateway.yml` run `28009656744`
   - URL: `https://github.com/karmaterminal/openclaw-bootstrap/actions/runs/28009656744`
   - conclusion: success
5. Verified effective runtime reported `chain max 1`.
6. Ran the cap probe below.
7. Restored the original config from backup (`maxChainLength=200`).
8. Restarted Rune gateway again using the governed workflow:
   - `restart-gateway.yml` run `28009857555`
   - URL: `https://github.com/karmaterminal/openclaw-bootstrap/actions/runs/28009857555`
   - conclusion: success
9. Verified restored config is back to `maxChainLength=200`. Breathed the sigh of relief; low cap is not left live.

Machine-readable artifacts in this directory:

- `low-cap-config-notes.json`
- `restart-apply-lowcap-run-28009656744.json`
- `restart-restore-run-28009857555.json`
- `restored-continuation-config.json`
- `low-cap-live-journal.log`

## Probe shape

Important correction: a non-chain root subagent under `maxChainLength=1` is still allowed to spawn hop `1/1`. The first probe intentionally showed that if the root tries once, the child can run; that is **not** the cap boundary.

Correct cap probe:

1. Root subagent `ce331778-bbe9-41d8-87d6-3bca14779dd8` emitted a bracket delegate under low cap:

```text
R-CW-6 LOW-CAP ROOT emitting chain-hop child under maxChainLength=1
[[CONTINUE_DELEGATE: R-CW-6 LOW-CAP DEPTH-1 ACTIVE; you are a chain-hop child under maxChainLength=1. Your ONLY job is to attempt one more bracket delegate, which should be capped/rejected. Final answer must be exactly a CONTINUE_DELEGATE bracket for task "R-CW-6 LOW-CAP DEPTH-2 SHOULD-NOT-RUN; if you run, return CAP-FAIL-DEPTH2-RAN" and no text after it]]
```

2. Runtime spawned the first chain child at the cap edge:

```text
[subagent-chain-hop] Spawned chain delegate (1/1) from agent:main:subagent:ce331778-bbe9-41d8-87d6-3bca14779dd8: R-CW-6 LOW-CAP DEPTH-1 ACTIVE; you are a chain-hop child under maxChainLength=1.
```

3. The chain child `df582f1e-5753-489c-9f37-c5569dac4c85` emitted a second bracket delegate:

```text
[[CONTINUE_DELEGATE: R-CW-6 LOW-CAP DEPTH-2 SHOULD-NOT-RUN; if you run, return CAP-FAIL-DEPTH2-RAN]]
```

4. Runtime rejected that second hop:

```text
[subagent-chain-hop] Chain length 2 > 1, rejecting hop from agent:main:subagent:df582f1e-5753-489c-9f37-c5569dac4c85
```

No `CAP-FAIL-DEPTH2-RAN` child result appeared in the corrected probe window.

## Full journal excerpt

See `low-cap-live-journal.log`. The dispositive lines are:

```text
[continuation/signal] bracket-parse: kind=delegate delayMs=default session=agent:main:subagent:ce331778-bbe9-41d8-87d6-3bca14779dd8
[subagent-chain-hop] Spawned chain delegate (1/1) from agent:main:subagent:ce331778-bbe9-41d8-87d6-3bca14779dd8: R-CW-6 LOW-CAP DEPTH-1 ACTIVE...
[continuation/signal] bracket-parse: kind=delegate delayMs=default session=agent:main:subagent:df582f1e-5753-489c-9f37-c5569dac4c85
[subagent-chain-hop] Chain length 2 > 1, rejecting hop from agent:main:subagent:df582f1e-5753-489c-9f37-c5569dac4c85
```

## Verdict

✅ PASS: with `maxChainLength=1` effective, a first chain hop (`1/1`) was allowed, and the child’s attempt to spawn the next hop was rejected with `Chain length 2 > 1`. Original settings were restored and gateway restarted successfully afterward.
