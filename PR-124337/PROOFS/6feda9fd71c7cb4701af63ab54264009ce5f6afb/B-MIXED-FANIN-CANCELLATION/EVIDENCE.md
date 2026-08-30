# B: mixed fan-in cancellation

**Signed verdict: PASS.**

The production Discord debouncer combined two messages into one preflight. Its
Plugin SDK fan-in contained one current lifecycle and one legacy lifecycle.
Shutdown cancellation returned both durable rows to pending with attempts zero,
no last error, no claim owner, and no dead letter. A separate explicit current
cancellation produced the same budget-free result.

The same-process sibling control is row A, where genuine abandonment reached the
configured ceiling and terminalized. This separates cancellation compatibility
from genuine abandonment without relabeling either action.

| Evidence | Path |
| --- | --- |
| Signed row receipt | [`receipt.json`](receipt.json) |
| Closed-store projection | [`durable-state.json`](durable-state.json) |
| Combined Discord preflight observation | [`transport.json`](transport.json) |
| Genuine sibling control | [`../A-GENUINE-ABANDONMENT-CEILING/receipt.json`](../A-GENUINE-ABANDONMENT-CEILING/receipt.json) |
| Signature key | [`../signing-public-key.json`](../signing-public-key.json) |

