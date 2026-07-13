# Manual review — R-CONFIG-INTERSESSION

The live k6 row was partial because the disposable agent turn emitted `CONFIG-INTERSESSION-FAIL`; both seats preserved that row friction in artifacts and issues. For the proof corpus, the missing byte can be supplied manually with path-scoped config reads for `agents.defaults.continuation.crossSessionTargeting`.

Receipts:
- `cael-cross-session-targeting.json`
- `ronan-cross-session-targeting.json`

Both receipts show `crossSessionTargeting="enabled"`. This satisfies the row's required `config-read` and `cross-session-targeting` receipts without mutating config or exposing secrets.

The row is upgraded to `pass` by manual receipt; the original k6 partial artifacts and issue remain preserved as method friction.
