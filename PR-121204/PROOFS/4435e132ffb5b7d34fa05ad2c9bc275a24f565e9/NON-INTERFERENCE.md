# Isolation, cleanup, and non-interference

## Isolated proof resources

The proof used a fresh OpenClaw state root, workspace, account binding, queue,
session, Discord channel, gateway port, transient systemd unit, and OTel
service identity. The unit and service names are represented only by truncated
SHA-256 hashes in the live receipt.

The isolated gateway was started once and stopped once. Its port was free after
shutdown. The temporary Discord channel was deleted after receipt extraction.
The isolated state root and credential file were removed after the public
packet was assembled.

## Existing Cael gateway

Before the proof, the existing `openclaw-gateway.service` was active on its
existing port with:

- PID `3448915`
- process start `2026-08-23T15:44:59-07:00`
- systemd monotonic start `1191412581078`
- command-line SHA-256
  `625b1d970affb48bd776b16083037c7992886aeaaf459864902b672b59751bf0`

The proof did not stop, restart, reconfigure, or write to that gateway. The
post-cleanup comparison retained the same PID, process start, monotonic start,
command-line hash, active unit state, and bound port.

## Repository boundaries

- Product commit `4435e132ffb5b7d34fa05ad2c9bc275a24f565e9`
  was built and tested from an independent detached root.
- The product safe branch and protected PR-presenting branch were not modified.
- No upstream PR body, comment, label, proof index, docs main branch, or live
  operator state was changed.
