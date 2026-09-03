/** R-CD-TOKEN disposable-session ownership state machine. k6/Node compatible. */

const AGENT_SESSION_KEY = /^agent:([^:]+):/i;

function normalized(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function responseError(response) {
  return normalized(response?.error?.message || response?.error);
}

export function agentIdFromOwnerBindingKey(sessionKey) {
  return AGENT_SESSION_KEY.exec(normalized(sessionKey))?.[1]?.toLowerCase() || null;
}

export function createTokenSessionProvisioner({
  ownerBindingSessionKey,
  targetSessionKey,
  disposableKey,
  label,
  allowUnownedControl = false,
}) {
  const bindingKey = normalized(ownerBindingSessionKey);
  const returnTargetKey = normalized(targetSessionKey);
  const expectedAgentId = agentIdFromOwnerBindingKey(bindingKey);
  const createParams = {
    key: normalized(disposableKey),
    label: normalized(label),
  };
  let phase = bindingKey
    ? 'resolve-binding'
    : allowUnownedControl
      ? 'create-unowned-control'
      : 'failed';
  let ownerAgentId = null;
  let createdSessionKey = null;
  let verificationCount = 0;
  let failureReason = bindingKey || allowUnownedControl ? null : 'owner-binding-required';

  function fail(reason) {
    phase = 'failed';
    failureReason = reason;
    return null;
  }

  function resolveRequest(key, agentId) {
    return {
      method: 'sessions.resolve',
      params: {
        key,
        ...(agentId ? { agentId } : {}),
        allowMissing: true,
      },
    };
  }

  function nextRequest() {
    if (phase === 'resolve-binding') return resolveRequest(bindingKey);
    if (phase === 'create-unowned-control') {
      phase = 'creating';
      return { method: 'sessions.create', params: createParams };
    }
    if (phase === 'create-owned') {
      phase = 'creating';
      return {
        method: 'sessions.create',
        params: { ...createParams, agentId: ownerAgentId },
      };
    }
    if (phase === 'verify-created') {
      phase = 'verifying';
      return resolveRequest(createdSessionKey, ownerAgentId);
    }
    return null;
  }

  function accept(method, response) {
    if (method === 'sessions.resolve' && phase === 'resolve-binding') {
      if (!response?.ok) return fail('owner-binding-resolution-rejected');
      const resolved = response.payload;
      const resolvedKey = normalized(resolved?.key);
      const resolvedAgentId = normalized(resolved?.agentId);
      if (resolved?.ok !== true || !resolvedKey || !resolvedAgentId) {
        return fail('owner-binding-not-found-or-not-visible');
      }
      if (!expectedAgentId || resolvedAgentId !== expectedAgentId) {
        return fail('owner-binding-agent-mismatch');
      }
      ownerAgentId = resolvedAgentId;
      phase = 'create-owned';
      return nextRequest();
    }

    if (method === 'sessions.create' && phase === 'creating') {
      if (!response?.ok) {
        const message = responseError(response);
        return fail(
          /AgentSelectionRequiredError|explicit owner|Pass agentId/i.test(message)
            ? 'agent-selection-required'
            : 'disposable-session-rejected',
        );
      }
      createdSessionKey = normalized(response.payload?.key);
      if (!createdSessionKey || createdSessionKey === returnTargetKey) {
        return fail('disposable-session-not-distinct');
      }
      if (!ownerAgentId) {
        return fail('unowned-session-unexpectedly-created');
      }
      phase = 'verify-created';
      return nextRequest();
    }

    if (method === 'sessions.resolve' && phase === 'verifying') {
      if (!response?.ok) return fail('created-session-owner-verification-rejected');
      const resolved = response.payload;
      if (resolved?.ok !== true ||
          normalized(resolved?.key) !== createdSessionKey ||
          normalized(resolved?.agentId) !== ownerAgentId) {
        return fail('created-session-owner-mismatch');
      }
      verificationCount += 1;
      phase = 'ready';
      return null;
    }

    return fail('unexpected-session-provisioning-response');
  }

  function verifyAgain() {
    if (phase !== 'ready') return null;
    phase = 'verify-created';
    return nextRequest();
  }

  function snapshot() {
    return {
      phase,
      ready: phase === 'ready',
      failed: phase === 'failed',
      failureReason,
      ownerAgentId,
      createdSessionKey,
      verificationCount,
    };
  }

  return { accept, nextRequest, snapshot, verifyAgain };
}
