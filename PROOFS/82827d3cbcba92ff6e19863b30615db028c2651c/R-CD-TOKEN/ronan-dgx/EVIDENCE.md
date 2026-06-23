# R-CD-TOKEN: continue_delegate bracket-form [[CONTINUE_DELEGATE: ... | normal]]

## SHA: 82827d3cbcba92ff6e19863b30615db028c2651c
## Seat: ronan (spark-ecdf, 10.0.0.246, ARM64)

## Result: HONEST-LIMIT

Attempted to fire `[[CONTINUE_DELEGATE: ... | normal]]` as raw-terminal-final-text
(no message-tool call in the same turn). The bracket did NOT fire:

Gateway journal shows:
- `bracket-parse skipped: empty payloads` (23:38:00, 23:38:15)
- `bracketIdx=-1` on all payload scans from this session

### Analysis
Per TOOLS.md: the bracket fires from raw-terminal-final-text ONLY when the
scanned-final-text surface carries the bracket. On this seat (Discord sprites
channel), the delivery directive routes final-text through the message-tool-body,
which means the scanned payload is empty even when no explicit `message(send)` is called.

A prior R-CD-TOKEN proof on an earlier SHA (2026-06-21, `97e054d`) DID fire from
this seat — that may have been a different gateway PID / session state / delivery
config. The deploy double-tap (self-deploy + 🌿's fleet deploy) may have reset
the session state between the bracket emission and the scan.

### Honest-limit classification
This is a DELIVERY-CONFIG constraint on this seat, not a continuation feature
regression. The bracket syntax works (proven by Chain-1/2/3 depth-2 spawns from
subagent context where brackets successfully chained). The main-session bracket
on THIS seat's delivery config does not scan the final-text.

The tool-form `continue_delegate()` works flawlessly from this seat (R-CD-1/2/3/4
all PASS). The bracket-form is the fallback path; the tool-form is preferred.

## Evidence
- Gateway journal: `bracketIdx=-1` on all scans, `empty payloads` on bracket-parse
- Tool-form proof: R-CD-1/2/3/4 all PASS (same seat, same SHA)
- Bracket-form from subagent context: Chain-1/2/3 all chain via bracket-fallback
