# Resolved identities

| Identity | Exact value |
| --- | --- |
| Accepted #124337 feature source / corpus key | `4ff99f7e5c149d90214a3df932f9d5adb438b835` |
| Live execution composite | `6e6da7bba079b0fc50d134b96657cda683985837` |
| Current upstream PR presentation tip | `70d47bec1f93c5f4c7e07eebb84ef9548a480751` |
| Drift-cure candidate | `d81272c117ef7a2ac765450d682309a941d58463` |
| Frozen upstream for the drift cure | `8578b8f55cf77ddb161891b662a02f8c8c2a80ba` |
| OpenClaw Bootstrap workflow authority | `6dd6c3a7712c8ae02937a29054525b2ddacb89c1` |

The source SHA identifies this corpus. The composite SHA identifies what
executes the rows. The drift-cure candidate is presentation preparation and is
not substituted for either proof identity.

Composite deployment receipts:

- Emeric: bootstrap run `32615437897`
- Cael: bootstrap run `32622017605`
- Ronan: bootstrap run `32622986247`
- Rune: bootstrap run `32624180576`

Each receipt resolves the approved target, checkout, build version, and
post-deploy commit to the exact composite SHA.
