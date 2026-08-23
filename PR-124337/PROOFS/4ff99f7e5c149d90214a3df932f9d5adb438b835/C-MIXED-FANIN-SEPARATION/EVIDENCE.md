# C - mixed fan-in separation

State: `missing`.

Required candidate evidence:

- exact source/composite/docs/seat/nonce/time-window binding;
- capable and legacy claims repeatedly canceled through one fan-in;
- raw SQLite projection proving both canceled claims remain at attempts zero
  without dead letters;
- a separate genuine abandonment in the same process terminalizes with
  `turn-abandoned` and releases its same-lane follower;
- bounded journal preserving the separation of those outcomes.
