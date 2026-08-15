/**
 * One span-identity contract for continuation trace correlation.
 *
 * Node-only post-run module. Never import it from a k6 scenario graph.
 *
 * `collect-continuation-trace.mjs` previously carried two different answers to
 * the same question — "is this the originating tool-execution span?". The
 * continuation path (R-CD-2 / R-CD-4 / R-CD-CHAINED-DEPTH-2 / R-CW-1 / R-CW-3 /
 * R-RC-2) matched only `gen_ai.tool.name`; the generic tool path also accepted
 * `openclaw.toolName`. Published corpora carry both attribute keys on the same
 * `openclaw.tool.execution` span, so the narrower copy could report
 * `matched trace lacks the originating <tool> tool span` for a trace that the
 * wider copy in the same file would have accepted. The identity lives here now.
 */

export const TOOL_EXECUTION_SPAN_NAME = 'openclaw.tool.execution';

/** Attribute keys that name the executed tool, in precedence order. */
export const TOOL_NAME_ATTRIBUTE_KEYS = Object.freeze([
  'gen_ai.tool.name',
  'openclaw.toolName',
]);

function attributeMap(span, attributeValue) {
  return new Map((span?.attributes || []).map((attribute) => [attribute.key, attributeValue(attribute)]));
}

/**
 * Every tool name this span declares. A span that declares the tool under both
 * keys yields one entry; a span that declares conflicting names yields both, so
 * a caller can refuse to treat it as an unambiguous origin.
 */
export function toolSpanNames(span, attributeValue) {
  const attrs = attributeMap(span, attributeValue);
  const names = new Set();
  for (const key of TOOL_NAME_ATTRIBUTE_KEYS) {
    const value = attrs.get(key);
    if (typeof value === 'string' && value.length > 0) names.add(value);
  }
  return [...names];
}

/**
 * True when this span is the `openclaw.tool.execution` span for `toolName`.
 * Fails closed when the span declares two different tool names: an ambiguous
 * origin must never satisfy an exactly-one gate.
 */
export function toolSpanMatchesName(span, toolName, attributeValue) {
  if (span?.name !== TOOL_EXECUTION_SPAN_NAME) return false;
  if (typeof toolName !== 'string' || toolName.length === 0) return false;
  const names = toolSpanNames(span, attributeValue);
  if (names.length !== 1) return false;
  return names[0] === toolName;
}

/**
 * True when this span declares `toolName` under *any* tool-name attribute,
 * even alongside a conflicting one.
 *
 * This is the predicate for negative controls — "the bracket-token path must
 * not go through the typed tool". There, `toolSpanMatchesName`'s ambiguity
 * rejection would invert into a false pass: a span carrying the tool under one
 * key and something else under another would read as "no typed tool span
 * present" and satisfy the assertion it exists to break. Ambiguity has to fail
 * closed on both sides of the gate, which means the two sides need different
 * predicates.
 */
export function toolSpanDeclaresName(span, toolName, attributeValue) {
  if (span?.name !== TOOL_EXECUTION_SPAN_NAME) return false;
  if (typeof toolName !== 'string' || toolName.length === 0) return false;
  return toolSpanNames(span, attributeValue).includes(toolName);
}
