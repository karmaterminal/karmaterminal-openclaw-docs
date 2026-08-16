# Docs harness full suite

```bash
node --test tools/k6-proofs/scripts/__tests__/*.test.mjs
```

Tally: **320 tests / 319 passed / 1 failed**.

The red is `candidate envelope is outside and invisible to canonical corpus
validation` execing `validate-corpus.mjs --index` — the known baseline
continuation manifest-schema red on `origin/main`. Not repaired here.
