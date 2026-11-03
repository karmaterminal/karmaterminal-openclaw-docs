// Independent review of the sentinel-echo fixes (karmaterminal/openclaw-bootstrap#1727).
//
// FINDING (low; needs a requester deviation plus a failed real release):
// R-CD-3 treats a bound child as the released lifeboat when its own spawn task
// CONTAINS "[continuation:post-compaction]" and the row token
// (lib/r-cd-3-lifeboat.mjs:218-221, used at scenarios/r-cd-3-post-compaction.js:435).
// The prefix is product text only in its product position. At openclaw
// f15237ec92:
//   - a released lifeboat's task is
//     "[continuation:post-compaction] [continuation:chain-hop:N] Compaction just completed. Carry this working state to the post-compaction session: <task>"
//     (src/auto-reply/reply/post-compaction-delegate-delivery.ts:499-502);
//   - an ordinary typed continue_delegate child's task is
//     "[continuation:chain-hop:N] Delegated task (turn N/M): <task>"
//     (src/auto-reply/continuation/delegate-dispatch-request.ts:43), where <task>
//     is whatever the requester wrote;
//   - chat.history strips only the protected context blocks around a child's
//     task, so either string reaches the observer as written
//     (src/auto-reply/reply/user-envelope-display.ts, src/agents/internal-runtime-context.ts).
// A requester that writes "[continuation:post-compaction]" into an ordinary
// delegate's task therefore mints a "released lifeboat" whenever the real
// release does not happen (if both exist, the observer's ambiguity check makes
// the row PARTIAL). The fix is a position check on the de-enveloped task, and
// refusing a requester call whose arguments carry the prefix.
//
// The first test asserts the desired contract and FAILS on
// codeagent/harness-review at 3283454d; the control passes.
import test from 'node:test';
import assert from 'node:assert/strict';
import { isReleasedLifeboatTask, rcd3TaskIdentityToken } from '../lib/r-cd-3-lifeboat.mjs';

const NONCE = 'R-CD-3-1793326378000-abcd1234';
const TOKEN = rcd3TaskIdentityToken(NONCE);
const HARNESS_TASK = `${TOKEN} R-CD-3 post-compaction lifeboat nonce ${NONCE}: when you run, invent a fresh random token ...`;

test('REVIEW R-CD-3: an ordinary delegate whose requester-written task carries the prefix is not a released lifeboat', () => {
  // The typed path's composition around a task the requester wrote.
  const ordinary = `[continuation:chain-hop:1] Delegated task (turn 1/10): [continuation:post-compaction] ${HARNESS_TASK}`;
  assert.equal(isReleasedLifeboatTask(ordinary, TOKEN), false,
    'the post-compaction prefix sits inside requester-written task text, not in its product position');
});

test('REVIEW control R-CD-3: the product release composition is a released lifeboat', () => {
  const released = `[continuation:post-compaction] [continuation:chain-hop:1] Compaction just completed. Carry this working state to the post-compaction session: ${HARNESS_TASK}`;
  assert.equal(isReleasedLifeboatTask(released, TOKEN), true);
});
