// Journal-bound delegate returns for the offline overlap/collection validators
// (karmaterminal/openclaw-bootstrap#1727).
//
// The validators used to accept a return when the journal held one
// `[continuation:targeted-return]` line and the row markers anywhere. A marker
// is written into the delegate task, so a dispatcher line carrying the task
// (`C_SENTINEL_SCHEDULED=<marker>`, `task=<marker>`) satisfied that alone. The
// first fix still took any line carrying `<marker> session=<key>` (or the marker
// followed within three lines by `session: <key>`) as the writer, so a
// dispatcher or requester echo line in prose (`delegated <marker>
// session=<child>`) faked the binding (mai review J1).
//
// A return binds here only when:
//   - a session writes the marker itself, in one of the two committed
//     marker-writer line forms (the bca2b0b-era evidence under
//     PROOFS/1cc8f4e3.../R-CD-RETURN-OVERLAP and R-CD-COLLECTION-ON-COLLAPSE;
//     no F' writer of these shapes exists, so they bind historical evidence
//     only). After the journald prefix and the process's ISO timestamp, the
//     line's whole message is either
//       `<marker> session=<child> run=<run>`, or
//       `<marker>`, and the next line's whole message is `session: <child>`;
//   - exactly one session writes it that way;
//   - that session is neither a dispatcher (`[continuation:delegate-spawned]
//     ... session=<key>` before the writer line) nor a return target (any
//     `Delivered to <targets>`): those are the sessions whose echoes the
//     binding must not credit; and
//   - the gateway logs `[continuation:targeted-return] Delivered to <targets>
//     from <that session>` after the writer line.
//
// k6 and Node compatible: no k6 or Node imports.

/** journald's `Mon DD HH:MM:SS host unit[pid]: ` line prefix. */
const JOURNAL_PREFIX = /^[A-Z][a-z]{2} [ \d]\d \d{2}:\d{2}:\d{2} \S+ [^\s:]+: /;
/** The process's own ISO timestamp before its message. */
const LOG_TIMESTAMP = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2}) /;

function escapeRegex(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** A journal line's message: without the journald prefix and the process timestamp, trailing space trimmed. */
function logMessage(line) {
  let rest = String(line || '');
  const prefix = rest.match(JOURNAL_PREFIX);
  if (prefix) rest = rest.slice(prefix[0].length);
  const timestamp = rest.match(LOG_TIMESTAMP);
  if (timestamp) rest = rest.slice(timestamp[0].length);
  return rest.replace(/\s+$/, '');
}

/** Every session a `[continuation:delegate-spawned]` line names as the dispatcher before `beforeLine`. */
function dispatchersBefore(lines, beforeLine) {
  const keys = new Set();
  for (let i = 0; i < Math.min(lines.length, beforeLine); i += 1) {
    const match = lines[i].match(/\[continuation:delegate-spawned\][^\n]*\bsession=(\S+)/);
    if (match) keys.add(match[1]);
  }
  return keys;
}

/**
 * The session that wrote `marker` itself, in a committed marker-writer line
 * form, or null with the reason. Returns { session, line, reason }.
 */
export function markerWriterInJournal(journal, marker) {
  const lines = String(journal || '').split(/\r?\n/);
  const none = (reason) => ({ session: null, line: -1, reason });
  if (!marker) return none('no marker');
  const sameLine = new RegExp(`^${escapeRegex(marker)} session=(\\S+) run=(\\S+)$`);
  const writers = [];
  for (let i = 0; i < lines.length; i += 1) {
    const message = logMessage(lines[i]);
    const same = message.match(sameLine);
    if (same) { writers.push({ session: same[1], line: i }); continue; }
    if (message === marker && i + 1 < lines.length) {
      const next = logMessage(lines[i + 1]).match(/^session: (\S+)$/);
      if (next) writers.push({ session: next[1], line: i });
    }
  }
  if (writers.length === 0) return none('no committed marker-writer line carries the marker');
  const sessions = [...new Set(writers.map((w) => w.session))];
  if (sessions.length > 1) return none(`more than one session writes the marker (${sessions.length})`);
  const [writer] = writers;
  if (dispatchersBefore(lines, writer.line).has(writer.session)) return none('the writer is a dispatcher of the delegate, not the delegate');
  if (targetedReturns(journal).some((r) => r.targets.includes(writer.session))) return none('the writer is a return target, not the returning delegate');
  return { session: writer.session, line: writer.line, reason: null };
}

/** Every `[continuation:targeted-return] Delivered to <a,b> from <source>`: [{ targets, source, line }]. */
export function targetedReturns(journal) {
  return String(journal || '').split(/\r?\n/).flatMap((line, index) => {
    const match = line.match(/\[continuation:targeted-return\] Delivered to (\S+) from (\S+)/);
    return match ? [{ targets: match[1].split(',').filter(Boolean), source: match[2], line: index }] : [];
  });
}

/** The marker's writer and the targeted returns delivered from it. */
export function markerReturn(journal, marker) {
  const writer = markerWriterInJournal(journal, marker);
  const returns = writer.session ? targetedReturns(journal).filter((r) => r.source === writer.session && r.line > writer.line) : [];
  return {
    writer: writer.session,
    returns,
    bound: returns.length > 0,
    reason: writer.reason || (returns.length > 0 ? null : 'no targeted return from the writer after its marker'),
  };
}

/** The session a `[continuation:delegate-spawned]` line names as the dispatcher before `beforeLine`, or null. */
export function delegateDispatcherBefore(journal, beforeLine) {
  const lines = String(journal || '').split(/\r?\n/);
  let dispatcher = null;
  for (let i = 0; i < Math.min(lines.length, beforeLine); i += 1) {
    const match = lines[i].match(/\[continuation:delegate-spawned\][^\n]*\bsession=(\S+)/);
    if (match) dispatcher = match[1];
  }
  return dispatcher;
}
