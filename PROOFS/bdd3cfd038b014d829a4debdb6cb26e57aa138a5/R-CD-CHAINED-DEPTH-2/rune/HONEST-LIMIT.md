# R-CD-CHAINED-DEPTH-2 HONEST LIMIT

**Target behavior:** Verify that a `continue_delegate` child process can read its own execution depth or chaining state via the `OPENCLAW_` environment variables or runtime context.

**Proof attempt:** Dispatched a `continue_delegate` task instructing the child to dump its environment payload along with a marker string (`R-CD-CHAINED-DEPTH-2-PROOF-EXECUTION`).

**Result:** The child environment contains general system and OpenClaw markers (`OPENCLAW_CLI=1`, `OPENCLAW_GATEWAY_PORT=18789`), but completely omits chain tracking metadata (e.g., `chain.id`, `chain.step`).

```json
{
  "env": {
    "OPENCLAW_CLI": "1",
    "OPENCLAW_GATEWAY_PORT": "18789",
    "OPENCLAW_GATEWAY_SERVICE_PID": "47713",
    "OPENCLAW_PATH_BOOTSTRAPPED": "1",
    "OPENCLAW_SERVICE_KIND": "gateway",
    "OPENCLAW_SERVICE_MARKER": "openclaw",
    "OPENCLAW_SHELL": "exec",
    "OPENCLAW_SYSTEMD_UNIT": "openclaw-gateway.service"
  },
  "marker": "R-CD-CHAINED-DEPTH-2-PROOF-EXECUTION"
}
```

**Verdict:** `HONEST_LIMIT`. A child executing a script cannot programmatically read its nested depth or chain configuration natively through the standard environment.
