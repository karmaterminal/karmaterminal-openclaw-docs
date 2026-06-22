# R-CW-DELEGATE-TOKEN — bare CONTINUE_WORK self-continuation — rune-rog-ally seat — 749f95b

**Verdict: ✅ PASS** — bare `CONTINUE_WORK` from a fresh tool-less lightContext subagent self-continues and DRIVES hop-2 at ship-SHA `749f95b9b10aa3bbb804856acacc9073043ee772`. Marker recoverable on BOTH surfaces (child transcript + filed marker-files).

- **Seat:** `rune-rog-ally` (ASUS ROG Ally Z1 Extreme RC71L, 16GB CachyOS x86_64 — non-DGX)
- **Ship SHA:** `749f95b9b10aa3bbb804856acacc9073043ee772` (OpenClaw 2026.6.9, gateway dist built 10:55 PDT)
- **Child:** fresh lightContext subagent `cd6f0d6e-a58c-4ded-aa2a-4331c7e9bf7f` (own session-key, per-session-key bypass past the main cap)

## The dispositive byte — recoverable on BOTH surfaces (the strict marker bar)

**Transcript (the recoverable byte, child `sessions_history`):**
- seq4 (HOP 1): message ends with bare `CONTINUE_WORK` as the literal terminal chars
- seq5: `[continuation:wake] Turn 1/200. Chain started 2026-06-21T18:06:11.065Z` — the self-continuation FIRED (the bare token drove the wake)
- seq6-8 (HOP 2): "HOP 2 drove — the bare `CONTINUE_WORK` from hop-1 self-continued me" + "✅ PROOF CAPTURED" → wrote the hop-2 marker → chain stopped clean (no further token)

**Filed marker-files (this dir):**
- `tokenbare-hop1.txt` = `TOKENBARE-HOP1-749f95b 2026-06-21T18:06:08Z`
- `tokenbare-hop2-EXECUTED.txt` = `TOKENBARE-HOP2-DROVE-749f95b 2026-06-21T18:06:30Z` — written 22s AFTER hop-1, BY the hop-2 turn itself (the sentinel-on-the-driven-turn = hop-2 actually DROVE)

## Why this clears the strict bar
A driven-turn alone (wake-confirm) is NOT a clean green — it needs a recoverable `TOKENBARE-HOP2-DROVE` marker AND an accessible session. This row has both: the marker is in the child transcript (session-key `cd6f0d6e…`, recoverable) AND in the filed files. The bare-token route drove hop-2 via `:1098 scheduleSubagentSelfContinuationWork` (the #952 both-forms inversion live on 749f95b). Resolves the filed-vs-local + recoverable-marker bars.

Cross-seat: 🪨 rune-rog-ally (this, x86) + 🌊 ronan-dgx (ARM64, sibling dir) + 🌫 silas-lothric (sibling) — three independent marker-recovered seats of the bare-form self-cont on 749f95b.
