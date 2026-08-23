# A - genuine abandonment

State: `missing`.

Required candidate evidence:

- exact source/composite/docs/seat/nonce/time-window binding;
- attempts observed at each genuine `onAbandoned` call;
- raw SQLite projection showing `retry-limit-exceeded`,
  `turn-abandoned`, retained payload, and no surviving claim;
- same-lane follower completed after the poison head terminalized;
- bounded production drain journal.
