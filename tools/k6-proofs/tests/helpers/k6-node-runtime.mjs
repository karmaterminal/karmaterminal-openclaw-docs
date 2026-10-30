// Run one k6 proof scenario in Node against a scripted gateway.
//
// The scenario module, its manifest loading, its library imports and its
// evidence assembly are the real code. Only the k6 runtime is replaced: the
// k6/* imports resolve to k6-module-shim.mjs, __ENV/__VU/__ITER/open() are
// globals as in k6, and ws.connect drives the scenario's socket callbacks in
// virtual time against `gateway(frame) -> replies[]`. console output is
// captured in k6's own log line shape, so the result can go through the real
// evidence extractor and sanitizer exactly as run-proofs.sh feeds them.
import { readFileSync } from 'node:fs';
import { registerHooks } from 'node:module';
import { pathToFileURL } from 'node:url';

const SHIM_URL = new URL('./k6-module-shim.mjs', import.meta.url).href;
let hooksRegistered = false;
let runs = 0;

function registerK6Modules() {
  if (hooksRegistered) return;
  hooksRegistered = true;
  registerHooks({
    resolve(specifier, context, nextResolve) {
      if (specifier === 'k6' || specifier.startsWith('k6/')) return { url: SHIM_URL, shortCircuit: true };
      return nextResolve(specifier, context);
    },
  });
}

function k6LogLine(level, args) {
  const message = args.map((value) => (typeof value === 'string' ? value : String(value))).join(' ');
  return `time="${new Date().toISOString()}" level=${level} msg=${JSON.stringify(message)} source=console`;
}

/**
 * @param {object} options
 * @param {string} options.scenarioPath absolute path of the scenario under test
 * @param {Record<string, string>} options.env the k6 __ENV the scenario sees
 * @param {(frame: object) => object[]} options.gateway replies for each frame the scenario sends
 * @returns {Promise<{log: string, frames: object[], checks: object[], metrics: object[]}>}
 */
export async function runK6Scenario({ scenarioPath, env, gateway }) {
  registerK6Modules();
  const frames = [];
  const checks = [];
  const metrics = [];
  const lines = [];
  globalThis.__ENV = { ...env };
  globalThis.__VU = 1;
  globalThis.__ITER = 0;
  globalThis.open = (file) => readFileSync(file, 'utf8');
  globalThis.__k6NodeRuntime = {
    record(kind, name, value) {
      if (kind === 'check') checks.push({ name, passed: value });
      if (kind === 'metric') metrics.push({ name, value });
    },
    connect(url, _params, callback) {
      const handlers = {};
      const queue = [];
      let sequence = 0;
      let now = 0;
      let closed = false;
      const schedule = (delayMs, fn) => queue.push({ at: now + delayMs, sequence: sequence++, fn });
      const socket = {
        on(event, fn) { handlers[event] = fn; },
        send(raw) {
          const frame = JSON.parse(raw);
          frames.push(frame);
          for (const reply of gateway(frame) || []) {
            schedule(0, () => handlers.message?.(JSON.stringify(reply)));
          }
        },
        // k6 rejects a non-positive delay; so does this socket.
        setTimeout(fn, delayMs) {
          if (!(Number(delayMs) > 0)) throw new Error(`setTimeout requires a >0 timeout parameter, received ${delayMs}`);
          schedule(Number(delayMs), fn);
        },
        close() { closed = true; },
      };
      callback(socket);
      schedule(0, () => handlers.open?.());
      while (!closed && queue.length) {
        queue.sort((a, b) => a.at - b.at || a.sequence - b.sequence);
        const next = queue.shift();
        now = next.at;
        next.fn();
      }
      handlers.close?.();
      return { status: 101, url };
    },
  };

  const original = { log: console.log, info: console.info, warn: console.warn, error: console.error };
  console.log = (...args) => lines.push(k6LogLine('info', args));
  console.info = console.log;
  console.warn = (...args) => lines.push(k6LogLine('warning', args));
  console.error = (...args) => lines.push(k6LogLine('error', args));
  try {
    runs += 1;
    const scenario = await import(`${pathToFileURL(scenarioPath).href}?k6-node-run=${runs}`);
    scenario.default();
  } finally {
    Object.assign(console, original);
    delete globalThis.__k6NodeRuntime;
  }
  return { log: `${lines.join('\n')}\n`, frames, checks, metrics };
}
