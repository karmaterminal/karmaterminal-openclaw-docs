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
