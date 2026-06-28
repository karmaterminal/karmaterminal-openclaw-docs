# R-CD-4 — targetSessionKey / fanoutMode mutual-exclusion guard — rune-rog-ally

**Seat:** `rune-rog-ally`  
**Capture/ship SHA:** `2723dbee783c113cae70e4fb63a4cff9f55402e3`  
**Docs base when filed:** `7cca49715cf8a3044e2fd0f1e40dd7204df88fcb`  
**Verdict:** ✅ **PASS (guard-side)** — the typed `continue_delegate` API rejects an invalid cross-session targeting request that combines `targetSessionKey` with `fanoutMode`.

## What this row tests

R-CD-4 is the cross-session/targeting family. This Rune row verifies a guard in that family: explicit recipient addressing (`targetSessionKey` / `targetSessionKeys`) is mutually exclusive with broadcast fanout (`fanoutMode`).

This is not the positive cross-session targeted-return behavior proof; it is the invalid-combination rejection proof for the same API surface.

## Attempted command shape

```text
continue_delegate(
  mode="silent",
  targetSessionKey="agent:main:discord:channel:1466192485440164011",
  fanoutMode="tree",
  task="R-CD-4-2723DBEE targetSessionKey proof child ..."
)
```

## Observed

Saved as `invalid-combination-receipt.json`:

```json
{
  "status": "error",
  "tool": "continue_delegate",
  "error": "fanoutMode cannot be combined with targetSessionKey or targetSessionKeys."
}
```

A local gateway journal slice is saved as `journal-invalid-combination.log` when matching runtime log lines were available.

## Honest scope

- ✅ Proves the API guard rejects combining `fanoutMode` with `targetSessionKey` / `targetSessionKeys`.
- ✅ Preserves the exact error returned to the caller.
- ❌ Does not prove positive targeted-return delivery. A positive R-CD-4 behavior row requires omitting `fanoutMode` and observing `[continuation:targeted-return]` delivery.
- ❌ Does not mutate docs based on a failed positive-targeting attempt; it files this as the guard row only.

## Verdict

✅ **PASS (guard-side)** — invalid cross-session targeting/fanout combination is rejected with the expected structured error on the deployed `2723dbee` lane.
