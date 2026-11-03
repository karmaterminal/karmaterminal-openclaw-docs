// The journal marker writer binds only in the committed writer line forms
// (karmaterminal/openclaw-bootstrap#1727, mai review J1 sibling paths).
//
// The committed bca2b0b-era journals carry two writer shapes after the
// journald prefix and the process timestamp:
//   `<marker> session=<child> run=<run>`                (R-CD-RETURN-OVERLAP)
//   `<marker>` then the next line `session: <child>`     (R-CD-COLLECTION-ON-COLLAPSE)
// The mai review test covers a prose dispatcher echo. These cover the
// nearest alternates the old substring rule accepted: an exact-shape line
// that names the dispatcher or a return target as the writer, two sessions
// writing the same marker, a `session:` line that is not the next line, and
// trailing text on the writer line. They import only exports that predate
// the fix.
import test from 'node:test';
import assert from 'node:assert/strict';
import { markerReturn } from '../lib/journal-return-binding.mjs';

const M = 'RCD_ECHO_FIX_MARKER';
const DISPATCHER = 'agent:main:discord:channel:1466192485440164011';
const CHILD = 'agent:main:subagent:continuation-echofixchild';
const OTHER = 'agent:main:subagent:continuation-echofixother';
const at = (message) => `Jul 04 15:21:44 cael node[2519116]: 2026-07-04T15:21:44.596-07:00 ${message}`;
const bare = (message) => `Jul 04 13:16:03 cael node[2519116]: ${message}`;
const spawned = at(`[continuation/delegate-dispatch] [continuation:delegate-spawned] hop=5/200 mode=silent session=${DISPATCHER} task=${M} proof`);
const returned = (from, to = DISPATCHER) => at(`[continuation:targeted-return] Delivered to ${to} from ${from}`);

test('control: both committed writer forms bind the child to its own return', () => {
  const sameLine = [spawned, at(`${M} session=${CHILD} run=dcf4b8a2-8e32-4b21-9046-33b8c6222191`), returned(CHILD)].join('\n');
  assert.deepEqual([markerReturn(sameLine, M).writer, markerReturn(sameLine, M).bound], [CHILD, true]);
  const twoLine = [spawned, at(M), bare(`session: ${CHILD}`), bare('sessionId/run id: ea37bf7c'), returned(CHILD)].join('\n');
  assert.deepEqual([markerReturn(twoLine, M).writer, markerReturn(twoLine, M).bound], [CHILD, true]);
});

test('an exact-shape line naming the dispatcher as the writer binds nothing', () => {
  const journal = [spawned, at(`${M} session=${DISPATCHER} run=x`), returned(DISPATCHER, CHILD)].join('\n');
  assert.equal(markerReturn(journal, M).bound, false);
});

test('an exact-shape line naming a return target as the writer binds nothing', () => {
  const journal = [at(`${M} session=${OTHER} run=x`), returned(OTHER, CHILD), returned(CHILD, OTHER)].join('\n');
  assert.equal(markerReturn(journal, M).bound, false);
});

test('two sessions writing the same marker bind neither', () => {
  const journal = [spawned, at(`${M} session=${OTHER} run=a`), at(`${M} session=${CHILD} run=b`), returned(OTHER), returned(CHILD)].join('\n');
  assert.equal(markerReturn(journal, M).bound, false);
});

test('a session: line that is not the next line is not the writer', () => {
  const journal = [spawned, at(M), bare('unrelated output'), bare(`session: ${CHILD}`), returned(CHILD)].join('\n');
  assert.equal(markerReturn(journal, M).bound, false);
});

test('trailing text on the writer line is not the writer form', () => {
  const journal = [spawned, at(`${M} session=${CHILD} run=b, as delegated by ${DISPATCHER}`), returned(CHILD)].join('\n');
  assert.equal(markerReturn(journal, M).bound, false);
});
