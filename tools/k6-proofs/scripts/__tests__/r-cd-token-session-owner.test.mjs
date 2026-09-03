import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import test from 'node:test';

import {
  createTokenLedger,
  observeTokenTaskLedger,
  parseTokenReturnEvent,
  summarizeTokenLedger,
} from '../../lib/r-cd-token-contract.js';
import { createTokenSessionProvisioner } from '../../lib/r-cd-token-session-owner.js';

const hash = (value) => createHash('sha256').update(String(value)).digest('hex').slice(0, 16);
const exactToken = '[[CONTINUE_DELEGATE: D-0123456789ab reply exactly RCDT-RETURN-0123456789abcdef +10s]]';
const targetSessionKey = 'agent:return-router:main';
const ownerBindingSessionKey = 'agent:research:main';

class MultiAgentGateway {
  constructor({ visibleAgents = ['main', 'research'] } = {}) {
    this.agents = new Set(['main', 'research']);
    this.visibleAgents = new Set(visibleAgents);
    this.sessions = new Map([
      ['agent:main:main', 'main'],
      [ownerBindingSessionKey, 'research'],
    ]);
    this.createCalls = [];
  }

  request({ method, params }) {
    if (method === 'sessions.resolve') {
      const owner = this.sessions.get(params.key);
      if (!owner) return { ok: true, payload: { ok: false } };
      if (!this.visibleAgents.has(owner)) {
        return { ok: false, error: { message: 'missing scope: session owner is not visible' } };
      }
      if (params.agentId && params.agentId !== owner) {
        return { ok: true, payload: { ok: false } };
      }
      return { ok: true, payload: { ok: true, key: params.key, agentId: owner } };
    }
    if (method === 'sessions.create') {
      this.createCalls.push(params);
      if (!params.agentId) {
        return {
          ok: false,
          error: {
            message: 'AgentSelectionRequiredError: Multiple agents are configured, but this operation has no explicit owner. Pass agentId or use an agent-prefixed session key.',
          },
        };
      }
      if (!this.agents.has(params.agentId)) {
        return { ok: false, error: { message: `Unknown agent id "${params.agentId}"` } };
      }
      if (!this.visibleAgents.has(params.agentId)) {
        return { ok: false, error: { message: 'missing scope: agent owner is not authorized' } };
      }
      const key = `agent:${params.agentId}:dashboard:${params.key}`;
      this.sessions.set(key, params.agentId);
      return { ok: true, payload: { ok: true, key } };
    }
    throw new Error(`unexpected method ${method}`);
  }
}

function drive(provisioner, gateway, request = provisioner.nextRequest()) {
  while (request) {
    request = provisioner.accept(request.method, gateway.request(request));
  }
  return provisioner.snapshot();
}

function tokenOutcome({ provisioner, token = exactToken }) {
  const parsed = token === exactToken;
  const state = provisioner.snapshot();
  if (!parsed || !state.ready) {
    return { parsed, tasks: [], children: [] };
  }
  const originChild = `agent:${state.ownerAgentId}:subagent:origin`;
  const delegateChild = `agent:${state.ownerAgentId}:subagent:delegate`;
  return {
    parsed,
    children: [delegateChild],
    tasks: [
      {
        taskId: 'origin-task',
        runId: 'origin-run',
        childSessionKey: originChild,
        title: 'RCDT-O-0123456789abcdef',
        sessionKey: state.createdSessionKey,
        status: 'completed',
      },
      {
        taskId: 'delegate-task',
        runId: 'delegate-run',
        childSessionKey: delegateChild,
        title: `[continuation:chain-hop:1] Delegated from sub-agent (depth 1): D-0123456789ab`,
        sessionKey: originChild,
        parentTaskId: 'origin-task',
        status: 'completed',
      },
    ],
    originChild,
    delegateChild,
  };
}

test('rejected base parses the exact token but an unowned parent creates no delegate task or child', () => {
  const gateway = new MultiAgentGateway();
  const provisioner = createTokenSessionProvisioner({
    targetSessionKey,
    disposableKey: 'r-cd-token-control',
    label: 'R-CD-TOKEN control',
    allowUnownedControl: true,
  });
  const state = drive(provisioner, gateway);
  const outcome = tokenOutcome({ provisioner });
  assert.equal(state.failed, true);
  assert.equal(state.failureReason, 'agent-selection-required');
  assert.equal(outcome.parsed, true);
  assert.deepEqual(outcome.tasks, []);
  assert.deepEqual(outcome.children, []);
  assert.deepEqual(gateway.createCalls, [{
    key: 'r-cd-token-control',
    label: 'R-CD-TOKEN control',
  }]);
});

test('successor resolves the owner, creates explicitly, and binds exactly one delegate and return', () => {
  const gateway = new MultiAgentGateway();
  const provisioner = createTokenSessionProvisioner({
    ownerBindingSessionKey,
    targetSessionKey,
    disposableKey: 'r-cd-token-successor',
    label: 'R-CD-TOKEN successor',
  });
  const state = drive(provisioner, gateway);
  assert.equal(state.ready, true);
  assert.equal(state.ownerAgentId, 'research');
  assert.notEqual(state.ownerAgentId, 'return-router');
  assert.deepEqual(gateway.createCalls, [{
    key: 'r-cd-token-successor',
    label: 'R-CD-TOKEN successor',
    agentId: 'research',
  }]);

  const outcome = tokenOutcome({ provisioner });
  assert.equal(outcome.parsed, true);
  assert.equal(outcome.children.length, 1);
  const ledger = createTokenLedger({ surfaceClass: 'raw-final-text' });
  observeTokenTaskLedger(ledger, {
    tasks: outcome.tasks,
    originTitle: 'RCDT-O-0123456789abcdef',
    delegateMarker: 'D-0123456789ab',
    parentSessionKey: state.createdSessionKey,
    pages: 1,
    hash,
  });
  const summary = summarizeTokenLedger(ledger);
  assert.equal(summary.origin_task_unique_count, 1);
  assert.equal(summary.delegate_task_unique_count, 1);
  assert.equal(summary.delegate_requester_matches_origin_child, true);

  const returnReceipt = parseTokenReturnEvent({
    sessionKey: outcome.originChild,
    message: {
      role: 'user',
      content: [{
        type: 'text',
        text: `[Inter-session message] sourceSession=${outcome.delegateChild} sourceTool=subagent_announce\nRCDT-RETURN-0123456789abcdef`,
      }],
    },
  }, {
    expectedTargetSessionKey: outcome.originChild,
    expectedDelegateChildSessionKey: outcome.delegateChild,
    expectedSentinel: 'RCDT-RETURN-0123456789abcdef',
    hash,
  });
  assert.deepEqual(returnReceipt, {
    targetSessionHash: hash(outcome.originChild),
    sourceSessionHash: hash(outcome.delegateChild),
  });
});

test('wrong, nonexistent, and unauthorized owner bindings fail before session or child creation', () => {
  const cases = [
    {
      name: 'wrong',
      configure(gateway) {
        gateway.sessions.set(ownerBindingSessionKey, 'main');
      },
      reason: 'owner-binding-agent-mismatch',
    },
    {
      name: 'nonexistent',
      binding: 'agent:missing:main',
      reason: 'owner-binding-not-found-or-not-visible',
    },
    {
      name: 'unauthorized',
      gateway: new MultiAgentGateway({ visibleAgents: ['main'] }),
      reason: 'owner-binding-resolution-rejected',
    },
  ];

  for (const item of cases) {
    const gateway = item.gateway || new MultiAgentGateway();
    item.configure?.(gateway);
    const provisioner = createTokenSessionProvisioner({
      ownerBindingSessionKey: item.binding || ownerBindingSessionKey,
      targetSessionKey,
      disposableKey: `r-cd-token-${item.name}`,
      label: `R-CD-TOKEN ${item.name}`,
    });
    const state = drive(provisioner, gateway);
    assert.equal(state.failureReason, item.reason, item.name);
    assert.equal(gateway.createCalls.length, 0, item.name);
    assert.equal(tokenOutcome({ provisioner }).children.length, 0, item.name);
  }
});

test('validated owner survives task polling and reconnect verification boundaries', () => {
  const gateway = new MultiAgentGateway();
  const provisioner = createTokenSessionProvisioner({
    ownerBindingSessionKey,
    targetSessionKey,
    disposableKey: 'r-cd-token-reconnect',
    label: 'R-CD-TOKEN reconnect',
  });
  assert.equal(drive(provisioner, gateway).verificationCount, 1);

  for (let boundary = 0; boundary < 4; boundary += 1) {
    const requestAfterReconnect = provisioner.verifyAgain();
    const state = drive(provisioner, gateway, requestAfterReconnect);
    assert.equal(state.ready, true);
    assert.equal(state.ownerAgentId, 'research');
    assert.equal(state.verificationCount, boundary + 2);
  }
  assert.equal(gateway.createCalls.length, 1);
});
