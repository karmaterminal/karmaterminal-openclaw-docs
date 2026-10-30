// Journal-bound delegate returns for the offline overlap/collection validators
// (karmaterminal/openclaw-bootstrap#1727).
//
// The validators used to accept a return when the journal held one
// `[continuation:targeted-return]` line and the row markers anywhere. A marker
// is written into the delegate task, so a dispatcher line carrying the task
// (`C_SENTINEL_SCHEDULED=<marker>`, `task=<marker>`) satisfied that alone. A
// return binds here only when:
//   - a session writes the marker itself: the marker on a line that names the
//     writer (`<marker> session=<key>`), or followed within three lines by
//     `session: <key>` (multi-line agent output), never as a `KEY=<marker>`
//     value; and
//   - the gateway logs `[continuation:targeted-return] Delivered to <targets>
//     from <that key>`.
//
// k6 and Node compatible: no k6 or Node imports.

/** The session that wrote `marker` itself, or null. Returns { session, line }. */
export function markerWriterInJournal(journal, marker) {
  const lines = String(journal || '').split(/\r?\n/);
  if (!marker) return { session: null, line: -1 };
  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i];
    for (let at = line.indexOf(marker); at >= 0; at = line.indexOf(marker, at + 1)) {
      // A value assignment is a dispatcher writing the marker out, not the session answering it.
      if (at > 0 && line[at - 1] === '=') continue;
      const same = line.slice(at + marker.length).match(/^\s+session=(\S+)/);
      if (same) return { session: same[1], line: i };
      for (let j = i + 1; j < Math.min(lines.length, i + 4); j += 1) {
        const next = lines[j].match(/(?:^|\s)session:\s+(\S+)\s*$/);
        if (next) return { session: next[1], line: i };
      }
    }
  }
  return { session: null, line: -1 };
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
  return { writer: writer.session, returns, bound: returns.length > 0 };
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
