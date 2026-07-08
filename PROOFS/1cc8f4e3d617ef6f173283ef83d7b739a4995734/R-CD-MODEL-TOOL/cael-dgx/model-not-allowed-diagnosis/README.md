# R-CD-MODEL-TOOL model-not-allowed diagnosis

This receipt explains why the Cael k6 live run stayed `PARTIAL-candidate` in the first fold.

The parent proof session successfully called typed `continue_delegate(model="github-copilot/claude-sonnet-4.6")` and emitted the parent scheduled sentinel. The durable continuation delegate row was created, but the spawned subagent failed before producing `MODEL-TOOL-CHILD` because the requested model override was rejected for agent `main`:

```text
Error: Model override "github-copilot/claude-sonnet-4.6" is not allowed for agent "main".
```

That means this row should not be treated as a timing-only observer miss, and it should not be a PASS. It is an honest limit for the current seat/config: the explicit model override path reached the runtime boundary and was refused by model allowlisting before a child model byte could exist.

Artifacts in this directory are narrowed sqlite extracts:

- `flow-runs-model-not-allowed.json` — durable continuation delegate flow with requested model and child session key.
- `subagent-runs-model-not-allowed.json` — subagent run rejected with model-not-allowed outcome.
- `task-runs-model-not-allowed.json` — task rows carrying the same rejection.

These extracts are public-safe for this proof row: they contain nonce, session keys, requested model, and error text, but not provider secrets.
