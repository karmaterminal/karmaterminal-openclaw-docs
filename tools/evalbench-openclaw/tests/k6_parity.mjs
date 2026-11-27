// Reads rows on stdin and prints the k6 harness's own reading of them.
import { readFileSync } from 'node:fs';
import { toolCallTarget, unwrapToolResult } from '../../k6-proofs/lib/tool-call-identity.mjs';
import { servedModelFromMessage } from '../../k6-proofs/lib/model-identity.mjs';

const tools = ['continue_work', 'continue_delegate', 'request_compaction'];
const rows = JSON.parse(readFileSync(0, 'utf8'));
console.log(JSON.stringify(rows.map((row) => ({
  targets: Array.isArray(row.content) ? row.content.map(toolCallTarget) : [],
  results: tools.map((tool) => unwrapToolResult(row, tool).payload),
  served: servedModelFromMessage(row),
}))));
