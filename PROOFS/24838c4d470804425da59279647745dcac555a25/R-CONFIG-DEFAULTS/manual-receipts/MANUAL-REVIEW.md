# Manual review — R-CONFIG-DEFAULTS

The live k6 row was partial because the disposable agent turn emitted `CONFIG-DEFAULTS-FAIL`; both seats preserved that row friction in artifacts and issues. For the proof corpus, the missing byte can be supplied manually with path-scoped config reads that expose only `agents.defaults.continuation`.

Receipts:
- `cael-continuation-config.json`
- `ronan-continuation-config.json`

Both receipts show `enabled=true`, `maxChainLength`, `maxDelegatesPerTurn`, and `costCapTokens` continuation bytes. This satisfies the row's required `config-read` and `continuation-values` receipts without mutating config or exposing secrets.

The row is upgraded to `pass` by manual receipt; the original k6 partial artifacts and issue remain preserved as method friction.
