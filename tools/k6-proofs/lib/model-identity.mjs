// Model-identity receipts for the R-CD-MODEL-* rows (karmaterminal-openclaw-docs#559,
// #562 review). Two gateway facts are kept separate:
// - SELECTED: sessions.describe session.modelProvider/model is the persisted
//   model selection. A child row carries it before dispatch, and under fallback
//   it keeps the selection, so it is not proof the child served on it.
// - SERVED: the provider/model on the row-bound assistant message in the child's
//   own transcript (chat.history), inside the row's run window.
// Text a child was asked to emit is never authority: a row that tells the child
// which model to print can only prove the child can repeat a string.

export function normalizeModel(value) {
  return String(value ?? '').trim().replace(/[.,;:]+$/, '');
}

/** provider/model from a sessions.describe `session` object, or null when absent. */
export function modelFromSessionMetadata(session) {
  const model = normalizeModel(session?.model);
  const provider = normalizeModel(session?.modelProvider || session?.provider);
  if (!model) return null;
  return model.includes('/') ? model : (provider ? `${provider}/${model}` : model);
}

/**
 * The explicit override model for a row, with no built-in default. It must be a
 * full provider/model so it can be compared byte-for-byte with session metadata;
 * a bare alias (e.g. "gpt") resolves differently per seat and is refused.
 */
export function resolveRequestedModel(...candidates) {
  const raw = candidates.find((value) => typeof value === 'string' && value.trim() !== '');
  if (raw === undefined) {
    return { model: null, refusal: 'no override model configured (set OPENCLAW_ALT_MODEL or manifest invocation.model to a provider/model)' };
  }
  const model = normalizeModel(raw);
  if (!/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.:/-]+$/.test(model)) {
    return { model: null, refusal: `override model ${JSON.stringify(raw)} is not a provider/model; aliases resolve per seat and cannot be compared with session metadata` };
  }
  return { model, refusal: null };
}

/**
 * Runtime model serving a session while it differs from the selection
 * (sessions.describe row activeModel/activeModelProvider,
 * packages/gateway-protocol/src/schema/sessions-row.ts:248-252, resolved by
 * resolveGatewaySessionActiveModel, src/gateway/session-utils-row.ts:307-361).
 * Returns the active provider/model when it is present and differs from the
 * selected one, else null. After a child run ends this is usually absent.
 */
export function activeFallbackFromSessionMetadata(session) {
  const active = modelFromSessionMetadata({
    model: session?.activeModel,
    modelProvider: session?.activeModelProvider || session?.modelProvider,
  });
  if (!active) return null;
  const selected = modelFromSessionMetadata(session);
  return selected && selected === active ? null : active;
}

// A provider's concrete response id may add a release-date suffix to the
// requested id (e.g. gpt-5.6-sol -> gpt-5.6-sol-2026-08-01). Only that exact
// shape is read as the same model; any other different responseModel is the
// served model (e.g. Anthropic server-side fallback sets it to the fallback,
// openclaw packages/ai/src/.../anthropic-server-fallback.ts:136-137).
function isDatedSnapshotOf(responseModel, model) {
  if (!responseModel.startsWith(model)) return false;
  return /^-(\d{4}-\d{2}-\d{2}|\d{8})$/.test(responseModel.slice(model.length));
}

/**
 * Served provider/model for one transcript assistant message. Assistant
 * messages persist provider/model from the Model the attempt actually called
 * (openclaw packages/ai/src/transports/assistant-output.ts:4-17), so a
 * fallback attempt records the fallback; responseModel is the provider's
 * concrete id when it differs (packages/llm-core/src/types.ts:390-420).
 */
export function servedModelFromMessage(message) {
  if (!message || String(message.role || '').toLowerCase() !== 'assistant') return null;
  const provider = normalizeModel(message.provider);
  const model = normalizeModel(message.model);
  const responseModel = normalizeModel(message.responseModel);
  if (!model) return null;
  const id = responseModel && responseModel !== model && !isDatedSnapshotOf(responseModel, model)
    ? responseModel
    : model;
  if (id.includes('/')) return id;
  return provider ? `${provider}/${id}` : null;
}

function textOf(message) {
  const content = message?.content;
  if (typeof content === 'string') return content;
  if (!Array.isArray(content)) return '';
  return content
    .filter((part) => part && part.type === 'text' && typeof part.text === 'string')
    .map((part) => part.text)
    .join('\n');
}

/**
 * Row- and run-window-bound SERVED model receipt from chat.history messages.
 *
 * Window: it opens at the first user message carrying `anchor` (the row nonce
 * in the dispatch or spawn task) and closes at the first later assistant
 * message carrying `sentinel` (the row's own reply, which also carries the
 * nonce). That assistant message is the receipt. Messages before the anchor
 * or after the sentinel never count. Any other assistant message inside the
 * window that served a different model is a conflict. If the window cannot be
 * bound, served is null and the caller stays selection-only PARTIAL.
 */
export function servedReceiptFromHistory(messages, { anchor, sentinel } = {}) {
  const list = Array.isArray(messages) ? messages : [];
  const empty = (reason) => ({
    served: null, conflict: false, servedModels: [], stopReason: null, errorMessage: null,
    provider: null, model: null, responseModel: null, messageIndex: null, anchorIndex: null, reason,
  });
  if (!anchor || !sentinel) return empty('no row anchor or sentinel to bind the run window');
  const anchorIndex = list.findIndex((m) => String(m?.role || '').toLowerCase() === 'user' && textOf(m).includes(anchor));
  if (anchorIndex < 0) return empty('run window not bindable: no user message carries the row anchor');
  let messageIndex = -1;
  for (let i = anchorIndex + 1; i < list.length; i += 1) {
    const m = list[i];
    if (String(m?.role || '').toLowerCase() === 'assistant' && textOf(m).includes(sentinel)) { messageIndex = i; break; }
  }
  if (messageIndex < 0) return { ...empty('run window not bindable: no assistant message after the anchor carries the row sentinel'), anchorIndex };
  const receipt = list[messageIndex];
  const served = servedModelFromMessage(receipt);
  const stopReason = typeof receipt.stopReason === 'string' ? receipt.stopReason : null;
  const errorMessage = typeof receipt.errorMessage === 'string' ? receipt.errorMessage : null;
  const windowModels = new Set();
  for (let i = anchorIndex + 1; i <= messageIndex; i += 1) {
    const model = servedModelFromMessage(list[i]);
    if (model) windowModels.add(model);
  }
  const base = {
    servedModels: [...windowModels],
    conflict: windowModels.size > 1,
    stopReason,
    errorMessage,
    provider: receipt.provider ?? null,
    model: receipt.model ?? null,
    responseModel: receipt.responseModel ?? null,
    messageIndex,
    anchorIndex,
  };
  if (stopReason === 'error' || stopReason === 'aborted' || errorMessage) {
    return { ...base, served: null, reason: `sentinel turn did not end cleanly (stopReason=${stopReason || 'unknown'})` };
  }
  if (!served) return { ...base, served: null, reason: 'sentinel message carries no provider/model' };
  return { ...base, served, reason: null };
}

/**
 * Verdict for one identity comparison.
 * - baseline: the model the row says the child must run (the parent's own
 *   SERVED model for inheritance rows, the requested override otherwise)
 * - selected (alias: observed): persisted selection from sessions.describe
 *   (session.modelProvider/model). Not proof the child served on it.
 * - served: run-window-bound served model (servedReceiptFromHistory)
 * - servedConflict: the run window served more than one model
 * - activeFallback: describe activeModel* differing from the selection
 * - expected: optional seat pin (OPENCLAW_EXPECTED_MODEL); the baseline must
 *   equal it, which is also the live negative control. A wrong pin can only
 *   FAIL once a baseline exists: for MODEL-DEFAULT that is the parent's
 *   served model, so without a bound parent served receipt it is PARTIAL.
 * - complete: every non-identity receipt the row requires was gathered
 * PASS needs a served receipt equal to the baseline. FAIL needs authoritative
 * evidence (served or selection mismatch, conflict, active fallback). Missing
 * evidence is PARTIAL, never PASS.
 */
export function classifyModelIdentity({
  baseline,
  observed = null,
  selected = undefined,
  served = null,
  servedConflict = false,
  activeFallback = null,
  expected = null,
  complete,
}) {
  const b = baseline ? normalizeModel(baseline) : null;
  const sel = selected !== undefined ? (selected ? normalizeModel(selected) : null) : (observed ? normalizeModel(observed) : null);
  const srv = served ? normalizeModel(served) : null;
  const fb = activeFallback ? normalizeModel(activeFallback) : null;
  const e = expected ? normalizeModel(expected) : null;
  const selectionMatches = Boolean(b && sel && b === sel);
  const out = (verdict, modelMatches, reason) => ({ verdict, modelMatches, selectionMatches, reason });
  if (e && b && b !== e) {
    return out('FAIL-candidate', false, `baseline ${b} does not match the expected model ${e}`);
  }
  if (fb && fb !== b) {
    return out('FAIL-candidate', false, `active fallback: session is served by ${fb}, not ${b || 'the baseline'}`);
  }
  if (servedConflict) {
    return out('FAIL-candidate', false, 'the bound run window served more than one model');
  }
  if (b && srv && b !== srv) {
    return out('FAIL-candidate', false, `served model ${srv} does not match baseline ${b}`);
  }
  if (!srv && b && sel && b !== sel) {
    // Without a served receipt the persisted selection is the only authority,
    // and it names a different model.
    return out('FAIL-candidate', false, `child session model ${sel} does not match baseline ${b}`);
  }
  if (!b) {
    return out('PARTIAL-candidate', false, 'no authoritative baseline model');
  }
  if (!srv) {
    return sel
      ? out('PARTIAL-candidate', false, 'selection matched; served route unproven')
      : out('PARTIAL-candidate', false, 'no authoritative child-session model');
  }
  // Served equals the baseline here. A differing selection is recorded
  // (selectionMatches=false), not hidden.
  if (!complete) {
    return out('PARTIAL-candidate', true, 'model identity matched but other required receipts are missing');
  }
  return out('PASS-candidate', true, null);
}
