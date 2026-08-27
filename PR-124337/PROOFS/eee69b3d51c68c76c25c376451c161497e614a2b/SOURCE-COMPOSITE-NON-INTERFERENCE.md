# Source, composite, and target non-interference

Behavioral authority originates at source
`4ff99f7e5c149d90214a3df932f9d5adb438b835`; execution occurred on disclosed
composite `6e6da7bba079b0fc50d134b96657cda683985837`; presentation targets descendant
`eee69b3d51c68c76c25c376451c161497e614a2b`.

The original source-versus-composite review established:

- lifecycle cancel-compat and `onCancelled` forwarding were byte-identical;
- the abandonment retry-budget and cancellation tests were byte-identical;
- ancillary composite settlement, timeout, root-admission, and diagnostics
  work did not supply the exercised predicates;
- durable `turn-abandoned` and `retry-limit-exceeded` fields distinguish
  genuine abandonment from cancellation.

The target walk adds a second boundary. Source-to-previous extracts the
settlement owner and includes ancillary timeout/root-admission handling.
Previous-to-target preserves all five core production/test blobs used by the
three rows byte-for-byte. Floor-merge changes in channel adapters and adjacent
tests do not alter the ownership predicates.

Accordingly:

- source execution remains source/composite execution;
- target exact execution remains false;
- ancestry and byte materiality justify carrying the reviewed row states
  without claiming a new behavioral fire.
