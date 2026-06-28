# R-CD-MODEL-CHAINED-ALT honest limit

**State:** HONEST-LIMIT

This row is intentionally not counted as PASS on `191a7af989a637f435016fd8d72627fc47fae0e0`.

The alternate-model override cluster is blocked by `karmaterminal/openclaw#1103`: observed tool calls accept/apply-looking model overrides, but the child context reports default `github-copilot/gpt-5.5` instead of the requested alternate model. The unresolved root is override ignored vs runtime context misreported vs silent fallback/alias normalization.

No further evidence is claimed here until #1103 is fixed or the row is re-fired with a discriminating artifact.
