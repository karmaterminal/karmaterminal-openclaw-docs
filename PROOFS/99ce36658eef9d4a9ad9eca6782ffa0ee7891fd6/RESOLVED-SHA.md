# Resolved SHA identity

| Role | SHA | Disposition |
| --- | --- | --- |
| Pure continuation / publication | `99ce36658eef9d4a9ad9eca6782ffa0ee7891fd6` | Accepted Gate 3 continuation tip; assembly and presentation refs plain-fast-forwarded here |
| Runtime execution composite | `6b09b1dbe938ab6b5f56eaf4e58f1ed243f89955` | Pure continuation plus separately reconstructed PR #121204 semantics |
| Composite semantic-fix parent | `b5de30c6ffe068d26f6b18e416f8f4659088241f` | Ancillary runtime-only provenance |
| Immutable docs harness | `7ab525923833cbddffa5c75c22481fcbe9d12fe9` | Frozen manifests, scenarios, and runner |
| Static evidence baseline requested by snapshot | `0921776150142c3fd8d517de5c73e1c94732f004` | Not present in immutable harness tree; static readers failed honestly |
| Bound corpus retained by `PROOFS/INDEX.json` | `a7ef03177e0f42831a087521e6eb7720102d6be1` | Stronger 26-pass / 0-fail corpus; never-regress pointer retained |

`git merge-base --is-ancestor 99ce36658eef9d4a9ad9eca6782ffa0ee7891fd6 6b09b1dbe938ab6b5f56eaf4e58f1ed243f89955` succeeded before
publication.
