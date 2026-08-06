import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import {
  classifyRcdModelToolVerdict,
  RCD_MODEL_TOOL_REQUIRED_MODEL,
} from '../../lib/r-cd-model-tool-verdict.js';

const repoRoot = path.resolve(import.meta.dirname, '../../../..');

function evidence(overrides = {}) {
  return {
    row: 'R-CD-MODEL-TOOL',
    requested_model_byte: RCD_MODEL_TOOL_REQUIRED_MODEL,
    manifest_model_matches_required: true,
    dispatch_accepted: true,
    parent_scheduled_sentinel: true,
    child_session_observed: true,
    return_payload: true,
    disposable_session_required: false,
    selected_model_projection_matches_request: true,
    child_selected_model_projection_byte: RCD_MODEL_TOOL_REQUIRED_MODEL,
    modelExecution: {
      bound: true,
      complete: true,
      identityComplete: true,
      lifecycleComplete: true,
      calls: [{
        provider: 'openai',
        model: 'gpt-5.6-luna',
        identity: RCD_MODEL_TOOL_REQUIRED_MODEL,
        complete: true,
      }],
    },
    ...overrides,
  };
}

test('exact execution-bound Luna identity is the only PASS authority', () => {
  assert.deepEqual(classifyRcdModelToolVerdict(evidence()), {
    verdict: 'PASS-candidate',
    reason: null,
  });
});

test('selected Luna metadata cannot mask an execution-time fallback', () => {
  const result = classifyRcdModelToolVerdict(evidence({
    selected_model_projection_matches_request: true,
    child_selected_model_projection_byte: RCD_MODEL_TOOL_REQUIRED_MODEL,
    modelExecution: {
      bound: true,
      complete: true,
      identityComplete: true,
      lifecycleComplete: true,
      calls: [{
        provider: 'openai',
        model: 'gpt-5.4',
        identity: 'openai/gpt-5.4',
        complete: true,
      }],
    },
  }));
  assert.equal(result.verdict, 'FAIL-candidate');
  assert.match(result.reason, /openai\/gpt-5\.4/);
});

test('nested model IDs keep their separately observed provider', () => {
  const result = classifyRcdModelToolVerdict(evidence({
    modelExecution: {
      bound: true,
      complete: true,
      identityComplete: true,
      lifecycleComplete: true,
      calls: [{
        provider: 'openrouter',
        model: 'anthropic/claude-sonnet',
        identity: 'openrouter/anthropic/claude-sonnet',
        complete: true,
      }],
    },
  }));
  assert.equal(result.verdict, 'FAIL-candidate');
  assert.match(result.reason, /openrouter\/anthropic\/claude-sonnet/);
});

test('missing, ambiguous, or incomplete child execution remains NO-VERDICT', () => {
  for (const modelExecution of [
    null,
    { bound: false, complete: false, calls: [] },
    { bound: true, complete: false, identityComplete: false, lifecycleComplete: true, calls: [] },
    {
      bound: true,
      complete: false,
      identityComplete: false,
      lifecycleComplete: true,
      calls: [{ provider: 'openai', model: null, identity: null, complete: false }],
    },
    {
      bound: true,
      complete: false,
      identityComplete: true,
      lifecycleComplete: false,
      calls: [{
        provider: 'openai',
        model: 'gpt-5.6-luna',
        identity: RCD_MODEL_TOOL_REQUIRED_MODEL,
        complete: true,
      }],
    },
  ]) {
    assert.equal(classifyRcdModelToolVerdict(evidence({ modelExecution })).verdict, null);
  }
});

test('Luna telemetry cannot PASS with an incomplete or wrong-row lifecycle', () => {
  for (const override of [
    { return_payload: false },
    { parent_scheduled_sentinel: false },
    { row: 'R-CD-OTHER' },
    { requested_model_byte: 'openai/gpt-5.4' },
    { manifest_model_matches_required: false },
    { disposable_session_required: true, session_created: false },
  ]) {
    assert.equal(classifyRcdModelToolVerdict(evidence(override)).verdict, null);
  }
});

test('incomplete non-Luna telemetry is NO-VERDICT, not FAIL', () => {
  // Classification order matters: an incomplete lifecycle is not authoritative
  // enough to accuse a fallback identity, so it may never become FAIL.
  for (const modelExecution of [
    {
      bound: true,
      complete: false,
      identityComplete: true,
      lifecycleComplete: false,
      calls: [{
        provider: 'openai',
        model: 'gpt-5.4',
        identity: 'openai/gpt-5.4',
        complete: true,
      }],
    },
    {
      bound: true,
      complete: false,
      identityComplete: true,
      lifecycleComplete: true,
      calls: [{
        provider: 'openrouter',
        model: 'anthropic/claude-sonnet',
        identity: 'openrouter/anthropic/claude-sonnet',
        complete: true,
      }],
    },
    {
      bound: true,
      complete: false,
      identityComplete: false,
      lifecycleComplete: false,
      calls: [{
        provider: 'openai',
        model: 'gpt-5.4',
        identity: 'openai/gpt-5.4',
        complete: true,
      }],
    },
  ]) {
    const result = classifyRcdModelToolVerdict(evidence({ modelExecution }));
    assert.equal(result.verdict, null);
    assert.doesNotMatch(result.reason, /does not match/);
  }
});

test('complete non-Luna identity still FAILs regardless of slash count', () => {
  for (const call of [
    { provider: 'openai', model: 'gpt-5.4', identity: 'openai/gpt-5.4', complete: true },
    {
      provider: 'openrouter',
      model: 'anthropic/claude-sonnet',
      identity: 'openrouter/anthropic/claude-sonnet',
      complete: true,
    },
  ]) {
    assert.equal(classifyRcdModelToolVerdict(evidence({
      modelExecution: {
        bound: true,
        complete: true,
        identityComplete: true,
        lifecycleComplete: true,
        calls: [call],
      },
    })).verdict, 'FAIL-candidate');
  }
});

test('scenario and manifest keep selected-model projections auxiliary', async () => {
  const [scenario, manifest] = await Promise.all([
    readFile(path.join(repoRoot, 'tools/k6-proofs/scenarios/r-cd-model-tool.js'), 'utf8'),
    readFile(path.join(repoRoot, 'tools/k6-proofs/manifests/r-cd-model-tool.json'), 'utf8'),
  ]);
  assert.match(scenario, /requestedModel = RCD_MODEL_TOOL_REQUIRED_MODEL/);
  assert.match(scenario, /selected-model projection; auxiliary, not execution authority/);
  assert.match(scenario, /accepted_send_trace_id/);
  assert.match(scenario, /NO VERDICT: execution identity is resolved only from the nonce-bound Tempo child model-call span/);
  assert.doesNotMatch(scenario, /model_matches\s*\?/);
  assert.match(manifest, /"model": "openai\/gpt-5\.6-luna"/);
  assert.match(manifest, /nonce-bound child model-call span is the sole execution-identity authority/);
});
