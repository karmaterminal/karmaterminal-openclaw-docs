# PR 121204 ClawSweeper follow-up evidence — `1519a37db29333c34e596dffe514488b31b9f2de`

## Binding

- Upstream PR: <https://github.com/openclaw/openclaw/pull/121204>
- Follow-up PR: <https://github.com/karmaterminal/openclaw/pull/1237>
- Base: `02bd9d77142248a07e4ad50387a166db1823b494`
- Head: `1519a37db29333c34e596dffe514488b31b9f2de`

This head removes the 713-line `.github/copilot-log` evidence artifact from the
OpenClaw source branch. Evidence belongs in this repository and path; only source,
tests, and generated API baseline data remain in the product PR.

## Static and focused evidence

The PR-authored receipts record:

- removal of the new pre-claim callback seam and its public exports;
- reuse of the existing claimed-delivery `resolveNonRetryableFailure` lifecycle;
- fail-open handling for missing or mismatched reply-reference payloads;
- direct raw non-thread `GuildText` preservation and suppression fixtures;
- settlement of deliberate stale-ambient suppression as a handled completion,
  avoiding false durable dead-letter health warnings;
- focused queue/monitor tests passing across three shards;
- broader Discord, channel-message, Telegram, and Slack suites passing locally;
- clean Plugin SDK API/surface checks, relevant typechecks, lint, formatting, and
  `git diff --check` receipts;
- a one-line inherited test repair using the file's existing tracked temporary
  directory helper, with its focused suite passing 40/40.

Hosted CI was re-triggered by the evidence-relocation commit and was still running
when this record was published. Fork-only automation failures that require GitHub
App repository configuration are not converted into source-pass claims here.

## Proof boundary

This is static and focused-test evidence. It does **not** claim the required live
recovered-Discord behavior proof. In particular, no redacted real-gateway receipt
has yet demonstrated both:

1. stale ambient backlog suppression after recovery; and
2. prompt dispatch of a fresh addressed message on the same lane.

The deployed structured event is debug-level, while the inspected gateway used
the default info file-log threshold. Zero observed debug events therefore cannot
prove either that suppression did or did not occur. A future live receipt must be
published as a new exact-SHA evidence record rather than appended to this one.

## Redaction

This record intentionally omits message content, author/account identifiers,
Discord event and channel identifiers, lane keys, hostnames, process identifiers,
local paths, credentials, and credential-bearing configuration. No raw Discord
payload, transcript, or full operator log is published here.
