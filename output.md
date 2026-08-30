# Independent exact physical-schema harness review

Status: `REVIEW_IN_PROGRESS`.

Issue binding: `openclaw/openclaw#129388`.

## Named-reference contract

This table was written before any independent replay or focused-suite evidence
was credited. The unchanged safe review lane was published to `origin` at cure
implementation `d4deb21faa2e02076709e0c728308668924c9da4` first.

| Category | Named reference | Local SHA | Tracking SHA | Server SHA | Equality |
|---|---|---|---|---|---|
| Product/base ref | `karmaterminal/openclaw:codeagent/129388-product-owned-covenant-fixture-driver-20260830` | `0ed59cb64f31971e8659b417fe3fd2ba6a1730c3` | `0ed59cb64f31971e8659b417fe3fd2ba6a1730c3` | `0ed59cb64f31971e8659b417fe3fd2ba6a1730c3` | local/tracking/server equal |
| Safe lane ref | `codeagent/129388-d4deb21f-physical-schema-independent-review-20260830` | `d4deb21faa2e02076709e0c728308668924c9da4` | `d4deb21faa2e02076709e0c728308668924c9da4` | `d4deb21faa2e02076709e0c728308668924c9da4` | local/tracking/server equal |
| CI/workflow ref | N/A | N/A | N/A | N/A | Review-only docs harness uses the workorder's focused-only acceptance path; Mode-B and Gate 3g do not apply. |
| Presentation ref | N/A | N/A | N/A | N/A | Protected presentation and fleet are read-only and no named presentation ref applies. |
| Docs/proof cure branch | `codeagent/129388-harness-exact-physical-schema-cure-20260830` | `a41b3dfb800b764cd4efb8800c48e957de29232c` | `a41b3dfb800b764cd4efb8800c48e957de29232c` | `a41b3dfb800b764cd4efb8800c48e957de29232c` | local/tracking/server equal |
| Docs/proof cure savegame | `savegame/129388-harness-exact-physical-schema-cure-20260830T20260830T211513Z` | `a41b3dfb800b764cd4efb8800c48e957de29232c` | `a41b3dfb800b764cd4efb8800c48e957de29232c` | `a41b3dfb800b764cd4efb8800c48e957de29232c` | local/tracking/server equal |
| Docs/proof WIP salvage | `savegame/129388-harness-exact-physical-schema-cure-8edd8005-pre-amend-20260830T2102Z` | `8edd8005ac78a83dc57ab006fd791ef1a8dc53d3` | `8edd8005ac78a83dc57ab006fd791ef1a8dc53d3` | `8edd8005ac78a83dc57ab006fd791ef1a8dc53d3` | local/tracking/server equal |
| Docs/proof rejected implementation | `savegame/129388-harness-global-schema-v15-currency-20260830T195326Z` | `2a219003d4a75bc2650dd72bbeb43274686e85b5` | `2a219003d4a75bc2650dd72bbeb43274686e85b5` | `2a219003d4a75bc2650dd72bbeb43274686e85b5` | local/tracking/server equal |
| Docs/proof rejected review | `codeagent/129388-2a219003-harness-v15-independent-review-20260830` | `b952a02ceca205945f63d8a785924c2613fdf2b6` | `b952a02ceca205945f63d8a785924c2613fdf2b6` | `b952a02ceca205945f63d8a785924c2613fdf2b6` | local/tracking/server equal |
| Docs/proof accepted ancestor | `codeagent/129388-proof-store-generic-terminal-marker-fix-20260829` | `16f8bca6593813adb25e864c91d38f456b1708c0` | `16f8bca6593813adb25e864c91d38f456b1708c0` | `16f8bca6593813adb25e864c91d38f456b1708c0` | local/tracking/server equal |
| Docs main | `karmaterminal/karmaterminal-openclaw-docs:main` | `0984dabae218000b20178f4a031e688bdf0584ac` | `0984dabae218000b20178f4a031e688bdf0584ac` | `0984dabae218000b20178f4a031e688bdf0584ac` | local/tracking/server equal |

The final report commit cannot contain its own identity. Final review-branch and
immutable-savegame equality will be recorded after this report is frozen.

## Review result

Pending independent physical-contract derivation, adversarial parser analysis,
deterministic replay, complete serial focused-suite receipt, authority audit,
and provenance audit.
