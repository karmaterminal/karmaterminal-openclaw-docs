# R-OBS-1 — Silas external status/build/health cross-walk

**Ship SHA:** `191a7af989a637f435016fd8d72627fc47fae0e0`
**Seat:** 🌫 Silas / `silas-lothric`
**Captured:** 2026-06-27 10:31 PDT
**Verdict:** ✅ PASS-candidate for Silas slice — status/build/health evidence captured for Elliott’s six-prince external-status row.

## Receipts

- `status-card.txt` — `session_status(sessionKey="current")` status card from the active Silas Discord session.
- `version.txt` — `openclaw --version` returned `OpenClaw 2026.6.10 (191a7af)`.
- `health.json` — local gateway health returned `{"ok":true,"status":"live"}`.

## Observed continuation/status facts

- Build/version: `OpenClaw 2026.6.10 (191a7af)`.
- Session key: `agent:main:discord:channel:1466192485440164011`.
- Continuation status: `chain 0/200`.
- Plugins: `OK`.
- Queue: `steer (depth 0)`.

## No-secrets statement

The filed artifacts contain no gateway token, raw session key beyond the public channel session identifier already used in the proof set, prompt body, raw provider response, or private user content.
