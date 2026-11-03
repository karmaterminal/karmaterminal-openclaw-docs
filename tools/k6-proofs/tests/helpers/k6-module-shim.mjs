// Stand-in for the k6 modules a scenario imports (k6, k6/ws, k6/crypto,
// k6/metrics, k6/data) when k6-node-runtime.mjs loads that scenario in Node.
// Only the surface the proof scenarios use is provided. The socket itself is
// the runtime's scripted gateway; everything the scenario does with it is the
// scenario's own code.
import { createHash } from 'node:crypto';

function runtime() {
  const value = globalThis.__k6NodeRuntime;
  if (!value) throw new Error('k6 module shim used outside k6-node-runtime.mjs');
  return value;
}

export function check(value, checks = {}) {
  let ok = true;
  for (const [name, predicate] of Object.entries(checks)) {
    const passed = Boolean(predicate(value));
    runtime().record('check', name, passed);
    ok &&= passed;
  }
  return ok;
}

export function sleep() {}

export function fail(message) {
  throw new Error(message);
}

export function group(_name, fn) {
  return fn();
}

class Metric {
  constructor(name) {
    this.name = name;
  }

  add(value) {
    runtime().record('metric', this.name, value);
  }
}

export class Counter extends Metric {}
export class Trend extends Metric {}
export class Rate extends Metric {}
export class Gauge extends Metric {}

// k6/data: `new SharedArray(name, fn)` is the array fn returns.
export function SharedArray(_name, fn) {
  return fn();
}

function connect(url, params, callback) {
  return runtime().connect(url, params, callback);
}

// k6/crypto: sha256(input, 'hex').
function sha256(input, encoding = 'hex') {
  return createHash('sha256').update(typeof input === 'string' ? input : Buffer.from(input)).digest(encoding);
}

// One default export serves both `import ws from 'k6/ws'` and
// `import crypto from 'k6/crypto'`.
export default { connect, sha256 };
