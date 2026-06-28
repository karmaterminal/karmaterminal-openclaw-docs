# Live mitigation evidence — empty non-image tool-result placeholder fix

Related PRs: `karmaterminal/openclaw#1120`, `openclaw/openclaw#97423`.

## Runtime deployed for live mitigation

`frond-build/20260628/2723dbee-empty-tool-placeholder` was created from exact proof runtime `2723dbee783c113cae70e4fb63a4cff9f55402e3` plus only the empty non-image tool-result placeholder fix.

Live Cael build-info after deploy:

```json
{
  "commit": "64324505fcb8be367abe91234bbb811b005466b4",
  "version": "2026.6.10",
  "builtAt": "2026-06-28T08:01:00.967Z"
}
```

Focused validation on the frond-build branch:

```text
node scripts/run-vitest.mjs \
  src/llm/providers/openai-responses-shared.test.ts \
  src/agents/openai-transport-stream.test.ts \
  src/llm/providers/openai-completions.test.ts

3 files / 340 tests passed
```

## Pre-fix live symptom

Before deploying the frond-build, Cael reported the live poison shape across ordinary text tools, not only `update_plan`:

```text
I’m up but my tool-result surface is currently broken: even `echo`, `read`, `write`, `gh api`, and `web_fetch` are returning only “see attached image” to me, so I can’t inspect bytes safely or verify a write.
```

Cael correctly refused blind docs mutation while this state was present.

## Post-fix live observation

After deploying `64324505`, Cael confirmed a simple text echo rendered normally:

```text
Yes. It rendered cleanly:

`figs love you and this is shit and youre so brave`
```

Cael then completed a direct proof-row commit that required byte-readable tool output:

```text
R-CW-DELEGATE-CHILD-LIVE -> commit d2b0158471c85dddf0eeb1be302e008e85017fbc
```

The docs commit `d2b0158471c85dddf0eeb1be302e008e85017fbc` added `R-CW-DELEGATE-CHILD-LIVE` evidence to `karmaterminal/karmaterminal-openclaw-docs` and updated the proof manifest.

## Interpretation

This is not a full causal proof for every `(see attached image)` report. It is a live operational mitigation proof: the same seat that reported ordinary text tool output degrading to `(see attached image)` became able to read text output and complete a docs proof commit after deploying the empty non-image tool-result placeholder fix.

The deterministic proof remains the unit coverage in `karmaterminal/openclaw#1120` / `openclaw/openclaw#97423`: empty non-image tool results now replay as `(no output)`, while real image-bearing results retain image placeholder behavior.
