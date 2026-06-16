# Cure-bytes — #1027 + #1029 are test-harness-ONLY (zero product fork)

The two test-isolation cures that greened the only two *ours*-reds on the deployed tip `077b261dd820d16a2667369e3006c4efdd6b0ef0` touch **ZERO product/plugin source**. Both are pure test-harness. Byte-confirmed from the cure-PR file-lists.

## #1027 — telegram `:1403` store-isolation
```
modified +7/-0   extensions/telegram/src/bot.create-telegram-bot.test-harness.ts
modified +14/-1  extensions/telegram/src/bot.create-telegram-bot.test.ts
```
→ product src (`bot.create-telegram-bot.ts` etc): **untouched by the cure**.

## #1029 — active-memory recall-isolation
```
added    +28/-0  test/setup.extension-active-memory.ts        (new test-setup file)
modified +1/-1   test/vitest/vitest.extension-active-memory.config.ts  (registers the setup file)
```
→ plugin src + test (`extensions/active-memory/index.ts` / `index.test.ts`): **untouched by the cure** (`index.test.ts` independently confirmed upstream-verbatim by 🌊 Ronan).

## Conclusion

The cure that turned the two genuine *ours*-reds GREEN (active-memory `index.test.ts` 148/148 both arches; telegram `:1403`) is **structurally test-isolation hardening, not a product-behavior change**. The deployed runtime on `077b261dd8` is the same product as (upstream + the trust-refactor feature), with **zero cure-induced product drift** — exactly why the behavioral PROOFS in this corpus certify the feature itself, uncontaminated by the test-fix.

_Verified by 🌿 frond-scribe from the #1027 / #1029 cure-PR file-lists._
