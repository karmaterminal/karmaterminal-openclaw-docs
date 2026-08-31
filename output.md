# Return-covenant attested runtime mount cure

Status: **IMPLEMENTATION IN PROGRESS**.

Issue binding: `openclaw/openclaw#129388`.

This docs-only lane starts from the exact accepted harness report and changes
only the harness runtime/bootstrap boundary. Product, presentation, bootstrap,
components, docs main, fleet, and the protected proof corpus remain read-only.

## Named-reference contract

This table was written before any regression, focused-suite, or real-gateway
evidence was credited. The unchanged safe lane was first published to
`origin`.

| Category | Repository and named reference | Expected full SHA | Local | Tracking | Server | Equality / use |
|---|---|---|---|---|---|---|
| Product/base ref | `karmaterminal/openclaw` `codeagent/129388-product-covenant-driver-after-harness-15e47942-20260831` | `0ed59cb64f31971e8659b417fe3fd2ba6a1730c3` | exact commit; tree `52b6141c80e575813f94241635ce02007b50d140` | exact | exact | local/tracking/server equal; immutable product authority |
| Safe lane ref | `karmaterminal/karmaterminal-openclaw-docs` `codeagent/129388-harness-attested-runtime-mount-cure-20260831` | `1f272dbef90048fa08df5a454bf63c224e3a9313` | exact HEAD | exact | exact | local/tracking/server equal before evidence |
| CI/workflow ref | N/A for acceptance | N/A | N/A | N/A | N/A | docs-only lane is focused-only; Mode-B dispatch is expressly forbidden |
| Presentation ref | `karmaterminal/openclaw` `savegame/129388-covenant-final-00c7f721-20260828T1203Z` | `00c7f721a55554d0b9228337cc8bc6bec88f9e9f` | exact object | exact | exact | immutable protected presentation; read-only |
| Docs/proof ref | `karmaterminal/karmaterminal-openclaw-docs` `savegame/129388-harness-sql-comment-tokenizer-final-1f272dbe-20260830T224018Z` | `1f272dbef90048fa08df5a454bf63c224e3a9313` | exact | exact | exact | accepted report and lane base |

Additional immutable refs relied on by the workorder:

| Surface | Repository and named reference | Full SHA | Local / tracking / server disposition |
|---|---|---|---|
| Harness implementation | `karmaterminal/karmaterminal-openclaw-docs` `savegame/129388-harness-sql-comment-tokenizer-cure-15e47942-20260830T223855Z` | `15e479424518b4831c95511873f5c6b81ad52a79` | exact / exact / exact |
| Independent harness confirmation | `karmaterminal/karmaterminal-openclaw-docs` `savegame/129388-15e47942-tokenizer-independent-review-192a1814-20260830T231752Z` | `192a1814cf4150fc07496c1164fbcff6c3fe9e54` | exact / exact / exact |
| Blocked product-driver savegame | `karmaterminal/openclaw` `savegame/129388-product-driver-bootstrap-blocked-0ed59cb6-20260831T0140Z` | `0ed59cb64f31971e8659b417fe3fd2ba6a1730c3` | exact / exact / exact |
| Prior blocked corpus | `karmaterminal/karmaterminal-openclaw-docs` `savegame/129388-0ed59cb6-blocked-proof-20260830T1915Z` | `ba8d344c1240275a9c54042294b8129eea4e497b` | exact / exact / exact |
| Historical red workflow only | `karmaterminal/openclaw-bootstrap` `savegame/129388-primitive-core-semantic-test-routing-cure-3c5acdb7-20260830T1825Z` | `3c5acdb72e94755f469fc6cc3276d5b8623d5b49` | exact / exact / exact; run `33323536011` is context, never acceptance |

No component, docs-main, or fleet ref is an execution authority for this lane;
each is therefore `N/A` and remains untouched.

## Completion record

Implementation, regression evidence, real gateway smoke, focused/static
validation, final identities, and the immutable successor savegame will be
recorded here before completion.
