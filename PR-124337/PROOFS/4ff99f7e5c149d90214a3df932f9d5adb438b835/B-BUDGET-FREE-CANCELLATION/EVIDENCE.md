# B - budget-free cancellation

State: `missing`.

Required candidate evidence:

- exact source/composite/docs/seat/nonce/time-window binding;
- prior retry facts captured before cancellation;
- repeated explicit `onCancelled` settlement at the retry ceiling;
- raw SQLite projection proving attempts, last-attempt time, and last error
  remained unchanged;
- no failed row and no surviving claim.
