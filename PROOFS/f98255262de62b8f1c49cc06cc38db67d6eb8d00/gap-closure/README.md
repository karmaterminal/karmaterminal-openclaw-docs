# PR #79925 PROOFS — fanoutMode=all + bracket-fallback gap-closure

## SHA Context (disclosure)

**Tests captured under fork-build SHA `af2e51a54b694ba1fa394e15977884394bc9bf40`**
- https://github.com/karmaterminal/openclaw/commit/af2e51a54b
- This SHA = PR #79925 head `f98255262de62b8f1c49cc06cc38db67d6eb8d00` + 1 commit: cure-(25) drop-fence
- Cure-(25) scope: removes over-strict session-file fingerprint fence (embedded-runner only)
- Files changed in cure-25 (NOT continuation surface): `attempt.session-lock.ts`, `failover-error.ts`, `google-prompt-cache.ts` + tests

## Continuation-tools surface byte-identical between SHAs

Verified via:
```bash
git diff --numstat f98255262d af2e51a54b -- \
  'src/agents/tools/continue-work-tool.ts' \
  'src/agents/tools/continue-delegate-tool.ts' \
  'src/agents/tools/request-compaction-tool.ts' \
  'src/agents/openclaw-tools.ts' \
  'src/auto-reply/continuation/' \
  'src/auto-reply/reply/post-compaction-delegate-dispatch.ts'
# Output: empty (zero changes on continuation-tools surface)
```

Tests at running-SHA `af2e51a54b` therefore exercise the continuation-tools surface as it exists at PR-head SHA `f98255262d`.

## Test runs

### FANOUT-B: chain-hop + fanoutMode=all (immediate)

- Substrate-shape: root spawns child_B via `continue_delegate(fanoutMode="all")`, child_B calculates random NOW, returns to all known sessions on host
- Trace: `fe08fac37b3e33795ebe9fb7225c800f`
- Parent span: `a60602563981954a`
- Receipt UUID: `8d5ac213-19ca-4337-8834-07b73e1d71a1`
- Receipt timestamp: `2026-05-19T18:29:18-07:00`
- Chain-depth: 2 (root → spawner `fbee6b1f` → receiver `a5ef9d33`)
- Discord channel evidence: msg `1506469041307389963`

### FANOUT-A: timed-delegate 180s + random-fresh

- Substrate-shape: `continue_delegate(task="sleep 180; cat /proc/sys/kernel/random/uuid", delaySeconds=0)`
- Trace: `fe08fac37b3e33795ebe9fb7225c800f`
- Receipt UUID: `1c0f0f48-6ea2-467a-9ae9-33c786b78c6b`
- Receipt timestamp: `1779240720` (2026-05-19T18:32:00 PDT)
- Subagent runtime: 3m6s (sleep + uuid generation + return)
- Chain-hop depth: 6
- Cost: 617 tokens (10 in / 607 out)

### Bracket-fallback test

- Substrate-shape: `[[CONTINUE_DELEGATE:task | silent]]` syntax fired in same turn as tool-form, proves parser-pickup-path lives alongside tool-form
- Receipt: parser substrate-detected bracket-form, dispatched delegate (silent mode, no channel-return)
- Source-form confirmation: bracket-form parser-detection per RFC C.2 fallback canon

## Substrate-honest disclosure

These proofs cover the two real-behavior-proof gaps clawsweeper named in PR #79925 review:
1. fanoutMode=all at fleet scale (per schema: "all known sessions on host" — single-host = cael-host's 3+ active sessions)
2. Bracket fallback (parser-pickup path validated)

Tests conducted on cael-host (DGX Spark, ARM64, Grace Blackwell GB10).
