import {
  findRcd2ModelMetadata,
  findRcd2Session,
  rcd2ModelRef,
  resolveRcd2ExecutionRuntime,
  selectRcd2ExecutionModel,
  verifyRcd2ListedSession,
  verifyRcd2SessionCreateResponse,
} from './r-cd-2-runtime-selection.js';

function normalizedText(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function sessionAgentId(session) {
  const explicit = normalizedText(session?.agentId);
  if (explicit) return explicit;
  const match = /^agent:([^:]+):/.exec(normalizedText(session?.key));
  return match ? match[1] : null;
}

function listedSessionMatchesPreparedModel(session, selectedModel) {
  const selectedRuntime = resolveRcd2ExecutionRuntime(selectedModel);
  const sessionRuntime = resolveRcd2ExecutionRuntime(session);
  return normalizedText(session?.modelProvider) === normalizedText(selectedModel?.provider) &&
    normalizedText(session?.model) === normalizedText(selectedModel?.id) &&
    selectedRuntime.builtIn &&
    sessionRuntime.builtIn &&
    sessionRuntime.id === selectedRuntime.id &&
    sessionRuntime.source === selectedRuntime.source;
}

export function resolvePreparationAgentId(payload) {
  return normalizedText(payload?.defaultId) || null;
}

export function selectPreparationModel(payload, requestedModel) {
  return selectRcd2ExecutionModel(payload?.models, { requestedModel });
}

export function resolvePreparedListedSession(payload, modelsPayload, requestedKey = '') {
  const rawSessions = payload?.sessions || payload?.items;
  const sessions = Array.isArray(rawSessions) ? rawSessions : [];
  const requested = normalizedText(requestedKey);
  const candidates = requested
    ? [findRcd2Session(sessions, requested)].filter(Boolean)
    : [...sessions].sort((left, right) =>
        normalizedText(left?.key).localeCompare(normalizedText(right?.key)));

  for (const session of candidates) {
    const key = normalizedText(session?.key);
    const sessionId = normalizedText(session?.sessionId);
    const provider = normalizedText(session?.modelProvider);
    const model = normalizedText(session?.model);
    const agentId = sessionAgentId(session);
    const selectedModel = findRcd2ModelMetadata(modelsPayload?.models, provider, model);
    if (!key || !sessionId || !agentId || !selectedModel) continue;
    if (!listedSessionMatchesPreparedModel(session, selectedModel)) continue;
    return { key, sessionId, agentId, session, selectedModel };
  }
  return null;
}

export function verifyCreatedPreparedSession({
  createPayload,
  listedPayload,
  key,
  selectedModel,
}) {
  if (!verifyRcd2SessionCreateResponse(createPayload, key, selectedModel)) return null;
  const sessionId = normalizedText(createPayload?.sessionId);
  const sessions = listedPayload?.sessions || listedPayload?.items || [];
  const session = findRcd2Session(sessions, key);
  if (!verifyRcd2ListedSession(session, key, sessionId, selectedModel)) return null;
  return { key, sessionId, session, selectedModel };
}

export function completePreparationAuthority({
  source,
  sessionClass,
  agentId,
  selectedModel,
  session,
}) {
  const runtime = resolveRcd2ExecutionRuntime(session);
  return {
    preparation_status: 'complete',
    session_source: source,
    session_class: sessionClass,
    resolved_agent_id: normalizedText(agentId) || null,
    requested_model_provider: normalizedText(selectedModel?.provider) || null,
    requested_model: normalizedText(selectedModel?.id) || null,
    effective_model_provider: normalizedText(session?.modelProvider) || null,
    effective_model: normalizedText(session?.model) || null,
    effective_runtime_id: runtime.id,
    effective_runtime_source: runtime.source,
    preparation_complete: true,
    tools_effective_call_stage: 'after-session-list-verification',
    setup_failure_code: null,
  };
}

export function incompletePreparationAuthority(code) {
  return {
    preparation_status: 'setup-incomplete',
    session_source: null,
    session_class: null,
    resolved_agent_id: null,
    requested_model_provider: null,
    requested_model: null,
    effective_model_provider: null,
    effective_model: null,
    effective_runtime_id: null,
    effective_runtime_source: null,
    preparation_complete: false,
    tools_effective_call_stage: null,
    setup_failure_code: normalizedText(code) || 'session-preparation-incomplete',
  };
}

export function preparedToolsEffectiveParams(sessionKey, authority) {
  const key = normalizedText(sessionKey);
  if (!key || authority?.preparation_complete !== true ||
      authority?.tools_effective_call_stage !== 'after-session-list-verification') {
    return null;
  }
  return { sessionKey: key };
}

export { rcd2ModelRef };
