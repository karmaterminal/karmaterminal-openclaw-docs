# Method — bca2b0b89ab886bf23a10e4983926f6b374b3188

Method source: `openclaw-bootstrap/RUNBOOKS/PROOF-CORPUS-METHOD.md`.

The cycle starts from a deployed Cael runtime at `bca2b0b89ab886bf23a10e4983926f6b374b3188`. Project 82 supplies the prior row template; Project 83 tracks this current cycle. Evidence lands directly on `karmaterminal/karmaterminal-openclaw-docs:main`.

Discipline:

1. Agree the test form and expected byte before each row fires.
2. Capture row-specific evidence under `PROOFS/bca2b0b89ab886bf23a10e4983926f6b374b3188/<ROW>/`.
3. Export Tempo trace JSON for each continuation/delegate/compaction fire.
4. If a row exposes resurrection, improper work-execution, or TaskFlow handling bugs, file a `karmaterminal/openclaw` issue with byte evidence before any cleanup.
5. Do not clean/delete TaskFlow DB rows unless the offending rows are byte-checked and backed up.
6. Update `proofs-manifest.json` and `PROOFS/INDEX.json` as row states change.
