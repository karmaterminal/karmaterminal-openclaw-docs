// Run one offline k6 scenario in Node, including handleSummary, and print what it
// produced as JSON. Usage (from the scenario's own directory, so the scenario's
// relative open() paths resolve as they do under k6):
//
//   node k6-static-scenario-driver.mjs <scenario.js>   with K6_DRIVER_ENV='{"…":"…"}'
//
// Only the k6 runtime is replaced, by tests/helpers/k6-module-shim.mjs as in
// tests/helpers/k6-node-runtime.mjs. The scenario, its manifest loading, its
// library imports and its summary are the real code. proof_failures is counted
// from the scenario's own Counter.add calls and handed to handleSummary the way
// k6 hands it the end-of-test metrics. As in k6, handleSummary runs in a fresh
// module instance that never ran default(), so it cannot lean on VU state.
import { readFileSync } from 'node:fs';
import { registerHooks } from 'node:module';
import { pathToFileURL } from 'node:url';

const SHIM_URL = new URL('../../../tests/helpers/k6-module-shim.mjs', import.meta.url).href;
registerHooks({
  resolve(specifier, context, nextResolve) {
    if (specifier === 'k6' || specifier.startsWith('k6/')) return { url: SHIM_URL, shortCircuit: true };
    return nextResolve(specifier, context);
  },
});

const [scenarioPath] = process.argv.slice(2);
const lines = [];
const checks = [];
let failures = 0;
globalThis.__ENV = JSON.parse(process.env.K6_DRIVER_ENV || '{}');
globalThis.__VU = 1;
globalThis.__ITER = 0;
globalThis.open = (file) => readFileSync(file, 'utf8');
globalThis.__k6NodeRuntime = {
  record(kind, name, value) {
    if (kind === 'check') checks.push({ name, passed: value });
    if (kind === 'metric' && name === 'proof_failures') failures += Number(value) || 0;
  },
};

const original = { log: console.log, warn: console.warn, error: console.error };
for (const level of ['log', 'warn', 'error']) {
  console[level] = (...args) => lines.push({ level, message: args.map(String).join(' ') });
}
let files;
try {
  const url = pathToFileURL(scenarioPath).href;
  const vu = await import(`${url}?k6-vu`);
  vu.default();
  const summaryContext = await import(`${url}?k6-summary`);
  files = summaryContext.handleSummary({
    metrics: { proof_failures: { values: { count: failures } }, static_corpus_row_duration: { values: { avg: 0 } } },
  });
} finally {
  Object.assign(console, original);
}
process.stdout.write(`${JSON.stringify({ lines, checks, failures, files })}\n`);
