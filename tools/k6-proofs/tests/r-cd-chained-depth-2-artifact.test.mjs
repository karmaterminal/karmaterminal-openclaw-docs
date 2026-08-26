import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import {
  rCdChainRootLifecycleStart,
  rCdChainRootReturnAcceptance,
  rCdChainRootReturnCandidate,
  rCdChainRootReturnReceipt,
} from '../lib/r-cd-chained-depth-2-authority.mjs';

const fixture = JSON.parse(await readFile(
  new URL('./fixtures/r-cd-chained-depth-2-run-32981265676.json', import.meta.url),
  'utf8',
));

test('run 32981265676 requires structured post-return consumption, not a prose ACK', () => {
  assert.equal(fixture.rejectedPublicEvidence.root_return_receipt, null);
  assert.equal(fixture.rejectedPublicEvidence.terminal_reason, 'root-return-observation-window-expired');

  const control = fixture.structuredControl;
  const lifecycleStart = rCdChainRootLifecycleStart({
    eventName: control.lifecycleStartEvent.eventName,
    eventData: control.lifecycleStartEvent.eventData,
    rootSessionKey: control.rootSessionKey,
    taskLedgerReceipt: control.taskLedgerReceipt,
    dispatchRunId: control.dispatchRunId,
    observedAtMs: control.lifecycleStartEvent.observedAtMs,
  });
  const candidate = rCdChainRootReturnCandidate({
    eventName: control.consumptionInputEvent.eventName,
    eventData: control.consumptionInputEvent.eventData,
    rootSessionKey: control.rootSessionKey,
    nonce: control.nonce,
    taskLedgerReceipt: control.taskLedgerReceipt,
    dispatchRunId: control.dispatchRunId,
    lifecycleRunId: lifecycleStart.runId,
    lifecycleStartedAtMs: lifecycleStart.startedAtMs,
    observedAtMs: control.consumptionInputEvent.observedAtMs,
  });
  const acceptance = rCdChainRootReturnAcceptance(candidate, {
    eventName: control.acceptedEvent.eventName,
    eventData: control.acceptedEvent.eventData,
    observedAtMs: control.acceptedEvent.observedAtMs,
  });
  const receipt = rCdChainRootReturnReceipt(acceptance, {
    childSessionKey: control.childSessionKey,
    grandchildSessionKey: control.grandchildSessionKey,
    eventName: control.lifecycleEndEvent.eventName,
    eventData: control.lifecycleEndEvent.eventData,
    observedAtMs: control.lifecycleEndEvent.observedAtMs,
  });

  assert.equal(
    receipt?.authority,
    'structured-post-return-consumption',
    'the rejected harness wrongly required ROOT-CHAIN-ACK after the root had consumed both returns',
  );
  assert.equal(receipt?.assistantSentinelObserved, false);
});
