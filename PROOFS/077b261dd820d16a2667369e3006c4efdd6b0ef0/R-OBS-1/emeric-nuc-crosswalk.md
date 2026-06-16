# R-OBS-1 — emeric-nuc cross-walk datum (operator status-surface)

**Row**: R-OBS-1 (external /status 6-prince cross-walk) — canonical: 🌻 Elliott; this = 🕯 Emeric cohort cross-walk datum
**Seat**: emeric-nuc (i7-12700H Alder-Lake, CachyOS), host `emeric`, service `fifth-prince`
**Target SHA**: `077b261dd820d16a2667369e3006c4efdd6b0ef0` (deployed)
**Status**: ✅ PASS (corroborates Elliott's R-OBS-1)

## Scenario

Independent per-seat confirmation that the operator status-surface (`session_status` / `/status`)
renders the full continuation-substrate on the deployed candidate tip from a *second* box (emeric-nuc,
x86 Alder-Lake — distinct arch from Elliott's elliott-legion). Strengthens the 6-prince cross-walk.

## Observed — `session_status` on the deployed emeric-nuc gateway

```
🦞 OpenClaw 2026.6.2 (077b261)          ← build string ✅ on deployed tip
🔄 Continuation: chain 0/200            ← continuation banner renders ✅
🧹 Compactions: 4                       ← compaction counter renders ✅
📚 Context: 472k/1.0m (47%)             ← context gauge renders ✅
🧠 Model: github-copilot/claude-opus-4.8
🔄 Fallbacks: claude-opus-4.6, gpt-5.5, openai/gpt-5.5   ← fallback ladder renders ✅
⏱️ Uptime: gateway 27m 48s             ← restart onto the 16:51 deploy build
🧵 Session: agent:main:discord:channel:1466192485440164011
```

(Full snapshot in `status_snapshot_077b261dd8_emeric.txt`.)

## SHA-anchor cross-check (three surfaces agree — no stale-route on the emeric box)

```
git rev-parse HEAD                                 → 077b261dd820
gh api .../git/ref/heads/...assembly-drift-cure    → 077b261dd820   (server-computed anchor)
openclaw --version build-string                    → (077b261)
```

All three independent SHA surfaces agree on emeric-nuc — the SHA-anchor discipline (server-ref
parity) confirms this box reads the true tip, no stale `ls-remote`/CDN route. (This is the same
discipline banked from the #999 night: when a SHA matters, the `gh api .../git/ref` server-ref is
the anchor; here it matches both the local checkout and the running build string.)

## Verdict

✅ **PASS** — the operator status-surface renders the full continuation-substrate (build / chain /
compactions / context / model+fallbacks) on the deployed tip `077b261dd8` from the emeric-nuc seat,
and all three SHA surfaces agree (server-ref anchored). Corroborates Elliott's R-OBS-1 6/6
boot-confirmed fleet table with an independent second-arch (x86 Alder-Lake) datum.

## Artifacts

- `status_snapshot_077b261dd8_emeric.txt` — full `session_status` render from the deployed emeric-nuc gateway
