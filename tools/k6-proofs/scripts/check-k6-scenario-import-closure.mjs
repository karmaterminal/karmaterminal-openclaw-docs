#!/usr/bin/env node
/**
 * Fail closed when a k6 scenario can reach a Node-only builtin. k6 resolves the
 * full ESM graph before a VU starts, so a post-run-only helper must never be
 * imported by any scenario even if its Node-specific function is not called.
 */
import fs from 'node:fs';
import path from 'node:path';
import { builtinModules } from 'node:module';
import { proofsToolPath, resolveRepositoryRoot } from '../lib/repo-root.mjs';

const { root: ROOT } = resolveRepositoryRoot({ argv: process.argv.slice(2) });
const SCENARIOS_DIR = proofsToolPath(ROOT, 'scenarios');
const NODE_BUILTINS = new Set(builtinModules.map((name) => name.replace(/^node:/u, '')));
const STATIC_IMPORT_RE = /(?:^|\n)\s*(?:import\s+(?:[\s\S]*?\s+from\s+)?|export\s+(?:[\s\S]*?\s+from\s+)?)(['"])([^'"]+)\1/g;
const DYNAMIC_IMPORT_RE = /\bimport\s*\(\s*(['"])([^'"]+)\1\s*\)/g;
// A dynamic import whose specifier is not a literal cannot be verified ahead of
// the run, so the closure it opens is unbounded. Fail closed on it.
const COMPUTED_IMPORT_RE = /\bimport\s*\(\s*(?!['"])/g;
const REQUIRE_RE = /(?<![.\w$])require\s*\(/g;

// Globals that exist in Node but not in a k6 VU. A helper can pass the import
// scan and still abort the run by touching one of these, which is the same
// failure class as a `node:` import: the row dies before it dispatches and
// publishes an empty PARTIAL.
const NODE_ONLY_GLOBALS = [
  'process',
  'Buffer',
  '__dirname',
  '__filename',
  'module',
  'exports',
];
// `globalThis` itself is valid in k6; reaching a Node global through it is not.
const GLOBAL_THIS_ESCAPE_RE = /\bglobalThis\s*\.\s*(process|Buffer|require|module|exports)\b/gu;

/**
 * Blank out the *contents* of string literals, regex literals and comments so
 * identifier and call scans cannot fire on prose, prompts, or marker text —
 * while keeping everything that is actually code.
 *
 * Three things have to be true at once, and each was learned the hard way:
 *
 *  - Delimiters survive, because a scan that needs to know "was the next token
 *    a quote?" — literal-vs-computed dynamic import — must still see them.
 *  - Regex literals are recognized, not skipped. `/'/g` is ordinary code, and a
 *    naive scanner treats its apostrophe as a string open, blanks the rest of
 *    the file and certifies it clean. Telling a regex from a division needs the
 *    last significant *token*, not just the last character: `return /'/.test(s)`
 *    has whitespace between the keyword and the slash.
 *  - Template interpolations stay live. `${process.env.SEAT}` is code wearing a
 *    string's clothes; blanking it hides exactly the Node-global reach this
 *    guard exists to catch.
 *
 * Returns `{ code, unterminated }`. An unterminated literal means the scan
 * cannot be trusted, and the caller fails closed rather than reporting a clean
 * file it never really read.
 */
function stripLiterals(source) {
  let out = '';
  let i = 0;
  const n = source.length;
  let unterminated = false;
  // Nesting stack of `{ kind: 'template' }` and `{ kind: 'interp', depth }`.
  const stack = [];
  // Last significant character of emitted code, plus the last identifier token,
  // used together to tell a regex literal from a division operator.
  let lastSignificant = '';
  let token = '';
  let lastToken = '';
  const blank = (text) => text.replace(/[^\n]/gu, ' ');
  const REGEX_PRECEDERS = new Set(['', '(', ',', '=', ':', '[', '!', '&', '|', '?', '{', ';', '+', '-', '*', '%', '~', '^', '<', '>']);
  // Keywords after which a `/` opens a regex rather than dividing.
  const REGEX_KEYWORDS = new Set([
    'return', 'typeof', 'case', 'in', 'of', 'new', 'delete', 'void',
    'instanceof', 'do', 'else', 'yield', 'await',
  ]);
  const isWordChar = (c) => /[\w$]/u.test(c);
  const top = () => (stack.length > 0 ? stack[stack.length - 1] : null);
  const inTemplateText = () => top()?.kind === 'template';
  const breakToken = () => {
    if (token) { lastToken = token; token = ''; }
  };
  const regexPosition = () => {
    if (REGEX_PRECEDERS.has(lastSignificant)) return true;
    if (isWordChar(lastSignificant)) return REGEX_KEYWORDS.has(token || lastToken);
    return false;
  };
  const emit = (c) => {
    out += c;
    if (isWordChar(c)) token += c;
    else breakToken();
    if (c.trim()) lastSignificant = c;
  };
  const emitRaw = (text, significant) => {
    out += text;
    breakToken();
    if (significant) lastSignificant = significant;
  };

  while (i < n) {
    const c = source[i];

    if (inTemplateText()) {
      if (c === '\\') { out += blank(source.slice(i, i + 2)); i += 2; continue; }
      if (c === '`') { emitRaw('`', '`'); stack.pop(); i += 1; continue; }
      if (c === '$' && source[i + 1] === '{') {
        emitRaw('${', '{');
        stack.push({ kind: 'interp', depth: 0 });
        i += 2;
        continue;
      }
      out += blank(c);
      i += 1;
      continue;
    }

    if (c === '/' && source[i + 1] === '/') {
      const end = source.indexOf('\n', i);
      const stop = end === -1 ? n : end;
      out += blank(source.slice(i, stop));
      i = stop;
      continue;
    }
    if (c === '/' && source[i + 1] === '*') {
      const end = source.indexOf('*/', i + 2);
      if (end === -1) { out += blank(source.slice(i)); i = n; unterminated = true; continue; }
      out += blank(source.slice(i, end + 2));
      i = end + 2;
      continue;
    }
    if (c === '/' && regexPosition()) {
      let j = i + 1;
      let inClass = false;
      let closed = false;
      while (j < n) {
        const d = source[j];
        if (d === '\\') { j += 2; continue; }
        if (d === '\n') break;
        if (d === '[') inClass = true;
        else if (d === ']') inClass = false;
        else if (d === '/' && !inClass) { closed = true; break; }
        j += 1;
      }
      if (closed) {
        emitRaw(`/${blank(source.slice(i + 1, j))}/`, '/');
        i = j + 1;
        continue;
      }
      // Not a terminated regex after all; fall through and treat as an operator.
    }
    if (c === '"' || c === "'") {
      const quote = c;
      let j = i + 1;
      let closed = false;
      while (j < n) {
        if (source[j] === '\\') { j += 2; continue; }
        if (source[j] === quote) { closed = true; break; }
        if (source[j] === '\n') break;
        j += 1;
      }
      const contentEnd = Math.min(j, n);
      emitRaw(quote + blank(source.slice(i + 1, contentEnd)) + (closed ? quote : ''), quote);
      i = closed ? contentEnd + 1 : contentEnd;
      if (!closed) unterminated = true;
      continue;
    }
    if (c === '`') {
      emitRaw('`', '`');
      stack.push({ kind: 'template' });
      i += 1;
      continue;
    }
    if (c === '{' && top()?.kind === 'interp') { top().depth += 1; emit(c); i += 1; continue; }
    if (c === '}' && top()?.kind === 'interp') {
      if (top().depth === 0) { emitRaw('}', '}'); stack.pop(); i += 1; continue; }
      top().depth -= 1;
      emit(c);
      i += 1;
      continue;
    }

    emit(c);
    i += 1;
  }
  if (stack.length > 0) unterminated = true;
  return { code: out, unterminated };
}

function lineNumber(source, index) {
  return source.slice(0, index).split('\n').length;
}

function importSpecifiers(source) {
  const found = [];
  for (const match of source.matchAll(STATIC_IMPORT_RE)) {
    found.push({ specifier: match[2], line: lineNumber(source, match.index) });
  }
  for (const match of source.matchAll(DYNAMIC_IMPORT_RE)) {
    found.push({ specifier: match[2], line: lineNumber(source, match.index) });
  }
  return found;
}

function resolveLocalImport(fromFile, specifier) {
  const base = path.resolve(path.dirname(fromFile), specifier);
  const candidates = [
    base,
    `${base}.js`,
    `${base}.mjs`,
    path.join(base, 'index.js'),
    path.join(base, 'index.mjs'),
  ];
  return candidates.find((candidate) => {
    try {
      return fs.statSync(candidate).isFile();
    } catch {
      return false;
    }
  }) || null;
}

function relative(file) {
  return path.relative(ROOT, file).split(path.sep).join('/');
}

function violation(file, line, specifier, reason) {
  return {
    file: relative(file),
    line,
    specifier,
    reason,
  };
}

function collectScenarioClosure(scenarioFile) {
  const queue = [scenarioFile];
  const visited = new Set();
  const violations = [];

  while (queue.length > 0) {
    const file = queue.pop();
    if (!file || visited.has(file)) continue;
    visited.add(file);

    const source = fs.readFileSync(file, 'utf8');
    const { code, unterminated } = stripLiterals(source);
    if (unterminated) {
      // The scan could not be completed, so a clean result would be a lie.
      violations.push(violation(file, 1, 'unterminated-literal', 'unscannable-source'));
    }

    for (const match of code.matchAll(COMPUTED_IMPORT_RE)) {
      violations.push(violation(file, lineNumber(code, match.index), 'import(<computed>)', 'computed-dynamic-import'));
    }
    for (const match of code.matchAll(REQUIRE_RE)) {
      violations.push(violation(file, lineNumber(code, match.index), 'require()', 'commonjs-require'));
    }
    for (const name of NODE_ONLY_GLOBALS) {
      // Exclude member access (`step.process`) and object keys (`{ process: … }`):
      // neither reaches the Node global, and rows legitimately use both words.
      const globalRe = new RegExp(`(?<![.\\w$])${name}(?![\\w$])(?!\\s*:)`, 'gu');
      for (const match of code.matchAll(globalRe)) {
        violations.push(violation(file, lineNumber(code, match.index), name, 'node-only-global'));
      }
    }
    for (const match of code.matchAll(GLOBAL_THIS_ESCAPE_RE)) {
      violations.push(violation(file, lineNumber(code, match.index), `globalThis.${match[1]}`, 'node-only-global'));
    }

    for (const imported of importSpecifiers(source)) {
      const { specifier, line } = imported;
      if (specifier.startsWith('.')) {
        const resolved = resolveLocalImport(file, specifier);
        if (resolved) {
          queue.push(resolved);
        } else {
          violations.push(violation(file, line, specifier, 'unresolved-local-import'));
        }
        continue;
      }

      const normalized = specifier.replace(/^node:/u, '');
      if (specifier.startsWith('node:') || NODE_BUILTINS.has(normalized)) {
        violations.push(violation(file, line, specifier, 'node-builtin-import'));
      } else if (specifier !== 'k6' && !specifier.startsWith('k6/')) {
        violations.push(violation(file, line, specifier, 'unsupported-bare-import'));
      }
    }
  }

  return {
    scenario: relative(scenarioFile),
    visited: [...visited].map(relative).sort(),
    violations,
  };
}

const scenarioFiles = fs.readdirSync(SCENARIOS_DIR)
  .filter((file) => file.endsWith('.js'))
  .sort()
  .map((file) => path.join(SCENARIOS_DIR, file));
const graphs = scenarioFiles.map(collectScenarioClosure);
const violations = graphs.flatMap(({ scenario, violations: graphViolations }) =>
  graphViolations.map((entry) => ({ scenario, ...entry })));

const result = {
  schema: 'openclaw.k6.scenario-import-closure.v1',
  scenarioCount: scenarioFiles.length,
  graphCount: graphs.length,
  ok: violations.length === 0,
  violations,
};

console.log(JSON.stringify(result, null, 2));
if (!result.ok) process.exit(1);
