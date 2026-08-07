# Silas journal cross-check — R-CW-1

Gateway user-service journal window: 2026-07-12 19:16:45–19:20:30 PDT.

## Continuation receipts

- `19:18:31.063`: tool-origin continuation parked for the disposable R-CW-1
  session; idle retry armed.
- `19:18:36.169`: scheduled hedge fired and emitted `continuation:work-wake`,
  but the immediate drive was skipped for `command-queue-busy`.
- `19:18:43.197`: idle retry fired after 7.015 seconds; it emitted the successor
  `continuation:work-wake` used by the proof receipt.

Thus the row is a successful durable schedule/wake proof, with a documented
queue-busy retry before the observed wake—not a clean single-attempt delivery.
The trace/correlation bundle records the same one-trace continuation topology.

## Concurrent but separate degradation

The same window has active-memory plugin timeout/unavailable results and an
embedded-agent cleanup `FOREIGN KEY constraint failed` after timeout. That did
not erase the scheduled-work retry/wake path, but it is a real independent
runtime failure; core repair tracking: `karmaterminal/openclaw#1181`.
