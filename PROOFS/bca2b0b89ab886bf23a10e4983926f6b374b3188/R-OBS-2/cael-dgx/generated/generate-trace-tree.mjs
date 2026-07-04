import fs from 'node:fs';

const [input, treeOut, textOut, countsOut] = process.argv.slice(2);
if (!input || !treeOut || !textOut || !countsOut) {
  console.error('usage: node generate-trace-tree.mjs <trace.json> <trace-tree.json> <span-tree.txt> <span-counts.json>');
  process.exit(2);
}
const raw = JSON.parse(fs.readFileSync(input, 'utf8'));
function attrValue(value) {
  if (!value || typeof value !== 'object') return value;
  if ('stringValue' in value) return value.stringValue;
  if ('intValue' in value) return Number(value.intValue);
  if ('doubleValue' in value) return Number(value.doubleValue);
  if ('boolValue' in value) return value.boolValue;
  if ('arrayValue' in value) return value.arrayValue;
  if ('kvlistValue' in value) return value.kvlistValue;
  return value;
}
function attrs(list = []) {
  const out = {};
  for (const item of list) out[item.key] = attrValue(item.value);
  return out;
}
const spans = [];
for (const batch of raw.batches ?? []) {
  const resourceSpans = batch.resourceSpans ?? [batch];
  for (const resourceSpan of resourceSpans) {
    const resource = attrs(resourceSpan.resource?.attributes ?? []);
    for (const scopeSpan of resourceSpan.scopeSpans ?? []) {
      const scope = { name: scopeSpan.scope?.name, version: scopeSpan.scope?.version };
      for (const span of scopeSpan.spans ?? []) {
        spans.push({
          traceId: span.traceId,
          spanId: span.spanId,
          parentSpanId: span.parentSpanId ?? null,
          name: span.name,
          kind: span.kind,
          startTimeUnixNano: span.startTimeUnixNano,
          endTimeUnixNano: span.endTimeUnixNano,
          durationNs: span.endTimeUnixNano && span.startTimeUnixNano ? String(BigInt(span.endTimeUnixNano) - BigInt(span.startTimeUnixNano)) : null,
          attributes: attrs(span.attributes ?? []),
          status: span.status ?? {},
          resource,
          scope,
          children: [],
        });
      }
    }
  }
}
spans.sort((a, b) => {
  const as = BigInt(a.startTimeUnixNano ?? '0');
  const bs = BigInt(b.startTimeUnixNano ?? '0');
  if (as < bs) return -1;
  if (as > bs) return 1;
  return a.spanId.localeCompare(b.spanId);
});
const byId = new Map(spans.map((s) => [s.spanId, s]));
const roots = [];
const orphans = [];
for (const span of spans) {
  if (span.parentSpanId && byId.has(span.parentSpanId)) {
    byId.get(span.parentSpanId).children.push(span);
  } else {
    roots.push(span);
    if (span.parentSpanId) orphans.push(span);
  }
}
function sortTree(nodes) {
  nodes.sort((a, b) => {
    const as = BigInt(a.startTimeUnixNano ?? '0');
    const bs = BigInt(b.startTimeUnixNano ?? '0');
    if (as < bs) return -1;
    if (as > bs) return 1;
    return a.spanId.localeCompare(b.spanId);
  });
  for (const node of nodes) sortTree(node.children);
}
sortTree(roots);
const counts = {};
for (const span of spans) counts[span.name] = (counts[span.name] ?? 0) + 1;
function traceIdHex(id) {
  if (!id) return id;
  if (/^[0-9a-f]{32}$/i.test(id)) return id.toLowerCase();
  try {
    const hex = Buffer.from(id, 'base64').toString('hex');
    return hex.length === 32 ? hex : id;
  } catch {
    return id;
  }
}
const traceIds = [...new Set(spans.map((s) => s.traceId))].sort();
const traceIdsHex = [...new Set(traceIds.map(traceIdHex))].sort();
const tree = { traceIds, traceIdsHex, spanCount: spans.length, rootCount: roots.length, orphanCount: orphans.length, spanNameCounts: counts, roots };
fs.writeFileSync(treeOut, JSON.stringify(tree, null, 2) + '\n');
fs.writeFileSync(countsOut, JSON.stringify({ traceIds, traceIdsHex, spanCount: spans.length, rootCount: roots.length, orphanCount: orphans.length, spanNameCounts: counts }, null, 2) + '\n');
function label(span) {
  const a = span.attributes;
  const bits = [];
  if (a['openclaw.toolName']) bits.push(`tool=${a['openclaw.toolName']}`);
  if (a['openclaw.channel']) bits.push(`channel=${a['openclaw.channel']}`);
  if (a['openclaw.trigger']) bits.push(`trigger=${a['openclaw.trigger']}`);
  if (a['openclaw.model']) bits.push(`model=${a['openclaw.model']}`);
  if (a['delegate.mode']) bits.push(`delegate.mode=${a['delegate.mode']}`);
  if (a['delegate.delivery']) bits.push(`delegate.delivery=${a['delegate.delivery']}`);
  if (a['chain.id']) bits.push(`chain.id=${a['chain.id']}`);
  if (a['queue.drained_count'] !== undefined) bits.push(`drained=${a['queue.drained_count']}`);
  if (a['queue.drained_continuation_count'] !== undefined) bits.push(`continuations=${a['queue.drained_continuation_count']}`);
  return `${span.name} [span=${span.spanId}${span.parentSpanId ? ` parent=${span.parentSpanId}` : ''}]${bits.length ? ` (${bits.join(', ')})` : ''}`;
}
const lines = [];
lines.push(`traceIds: ${traceIds.join(', ')}`);
lines.push(`traceIdsHex: ${traceIdsHex.join(', ')}`);
lines.push(`spanCount: ${spans.length}`);
lines.push(`rootCount: ${roots.length}`);
lines.push(`orphanCount: ${orphans.length}`);
lines.push('');
lines.push('spanNameCounts:');
for (const [name, count] of Object.entries(counts).sort((a, b) => a[0].localeCompare(b[0]))) lines.push(`- ${name}: ${count}`);
lines.push('');
lines.push('tree:');
function walk(nodes, depth = 0) {
  for (const span of nodes) {
    lines.push(`${'  '.repeat(depth)}- ${label(span)}`);
    walk(span.children, depth + 1);
  }
}
walk(roots);
fs.writeFileSync(textOut, lines.join('\n') + '\n');
