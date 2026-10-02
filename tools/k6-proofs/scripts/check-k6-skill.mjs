#!/usr/bin/env node
/**
 * check-k6-skill.mjs — the k6 authoring skill loads, has one source, and names no dead paths (#123).
 *
 * tools/k6-proofs/skill/SKILL.md is the single k6 authoring skill. Two loader
 * entry points reach it:
 *   - .agents/skills/k6-proofs/SKILL.md is a pointer file, because OpenClaw reads
 *     .agents/skills and skips a skill directory whose real path leaves that root;
 *   - .claude/skills/k6-proofs is a relative symlink to tools/k6-proofs/skill, for
 *     Claude Code.
 *
 * Invariants:
 *   - each SKILL.md opens with a `---` frontmatter block of single-line `key: value`
 *     pairs whose values are plain YAML scalars, so a line parser (OpenClaw's
 *     fallback) and a YAML parser read the same values;
 *   - a YAML parser (PyYAML safe_load, through python3) reads the block as the same
 *     mapping of strings;
 *   - name is lowercase letters and digits in hyphen-separated words, at most 64
 *     characters, and matches both entry directory names; description is at most
 *     1024 characters and finishes its first sentence within 160, so a listing
 *     that truncates it still reads as a summary;
 *   - the pointer repeats the source's frontmatter exactly, names the source, and
 *     carries nothing else of substance;
 *   - every relative Markdown link resolves, the source has none (it is also read
 *     through the symlink, where relative links resolve elsewhere), and every
 *     repository path either file names exists.
 *
 * Exit status: 0 when every invariant holds, 1 when one fails, 2 on a usage or
 * repository-root contract error. The repository root comes from the shared
 * repo-root contract, so this runs the same from the repository root and from
 * tools/k6-proofs.
 */
import { existsSync, lstatSync, readFileSync, readlinkSync, realpathSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { resolveRepositoryRoot } from '../lib/repo-root.mjs';

export const SKILL_SOURCE = 'tools/k6-proofs/skill/SKILL.md';
export const AGENTS_POINTER = '.agents/skills/k6-proofs/SKILL.md';
export const CLAUDE_ENTRY = '.claude/skills/k6-proofs';

const NAME_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/u;
const NAME_MAX = 64;
const DESCRIPTION_MAX = 1024;
const SUMMARY_MAX = 160;
const POINTER_MAX_BODY_LINES = 12;
const KEY_LINE = /^([a-z][a-z0-9_-]*): (.*)$/u;
// A sentence ends at . ! or ? followed by whitespace and a capital, or by the end.
// "e.g. 'x'" and "tools/k6-proofs" therefore do not end one.
const SENTENCE_END = /[.!?](?=\s+[A-Z]|\s*$)/u;
const MARKDOWN_LINK = /\[[^\]]*\]\(([^)\s]+)(?:\s+"[^"]*")?\)/gu;
// Repository paths written from the root. The lookbehind skips paths inside URLs
// and `owner/repo:path` references to other repositories.
const REPO_PATH = /(?<![\w./:@-])(?:\.\/)?(?:tools|PROOFS|RUNBOOKS|\.agents|\.claude|\.github)\/[\w./-]*/gu;

const PYYAML_PROGRAM = [
  'import json, sys',
  'import yaml',
  'data = yaml.safe_load(sys.stdin.read())',
  "json.dump(data, sys.stdout, default=lambda value: {'__yaml_type__': type(value).__name__})",
].join('\n');

/** Split a leading `---` frontmatter block from the Markdown body. */
export function splitFrontmatter(text) {
  const lines = text.replace(/^\uFEFF/u, '').replace(/\r\n?/gu, '\n').split('\n');
  if (lines[0].trimEnd() !== '---') {
    return { error: 'missing frontmatter: line 1 must be ---' };
  }
  const close = lines.findIndex((line, index) => index > 0 && line.trimEnd() === '---');
  if (close < 0) {
    return { error: 'unterminated frontmatter: no closing --- line' };
  }
  return { block: lines.slice(1, close).join('\n'), body: lines.slice(close + 1).join('\n'), bodyStartLine: close + 2 };
}

function plainScalarProblem(value) {
  if (value === '') return 'is empty';
  if (value !== value.trim()) return 'has leading or trailing whitespace';
  if (/^[-?:,[\]{}#&*!|>'"%@`]/u.test(value)) return 'starts with a YAML indicator character; write it as a plain unquoted scalar';
  if (/:\s/u.test(value) || value.endsWith(':')) return 'contains ": ", which YAML reads as a nested mapping';
  if (/\s#/u.test(value)) return 'contains " #", which YAML reads as a comment';
  if (value.includes('\t')) return 'contains a tab';
  return null;
}

/**
 * Parse a frontmatter block as single-line `key: value` pairs. Values must be plain
 * YAML scalars, so this reading and a YAML parser's agree.
 */
export function parseSingleLineFrontmatter(block) {
  const values = {};
  const errors = [];
  block.split('\n').forEach((line, index) => {
    const lineNumber = index + 2;
    const match = KEY_LINE.exec(line);
    if (!match) {
      errors.push(`frontmatter line ${lineNumber}: expected a single-line "key: value" pair`);
      return;
    }
    const [, key, value] = match;
    if (Object.hasOwn(values, key)) errors.push(`frontmatter line ${lineNumber}: duplicate key "${key}"`);
    const problem = plainScalarProblem(value);
    if (problem) errors.push(`frontmatter line ${lineNumber}: ${key} ${problem}`);
    values[key] = value;
  });
  return { values, errors };
}

/** Parse a frontmatter block with PyYAML's safe_load through python3. */
export function parseWithPyYaml(block, { python = process.env.OPENCLAW_PROOFS_PYTHON || 'python3' } = {}) {
  const result = spawnSync(python, ['-c', PYYAML_PROGRAM], { input: block, encoding: 'utf8' });
  if (result.error) return { unavailable: `${python} could not run (${result.error.code || result.error.message})` };
  if (result.status !== 0) {
    if (/No module named ['"]?yaml/u.test(result.stderr)) {
      return { unavailable: `PyYAML is not installed for ${python} (python3 -m pip install pyyaml)` };
    }
    const lines = result.stderr.trim().split('\n');
    return { error: lines.slice(-3).join(' | ') };
  }
  return { value: JSON.parse(result.stdout) };
}

/** Check the name and description a loader will see. */
export function checkFrontmatterValues(values, label) {
  const errors = [];
  const { name, description } = values;
  if (typeof name !== 'string' || name === '') {
    errors.push(`${label}: frontmatter needs a name`);
  } else {
    if (name.length > NAME_MAX) errors.push(`${label}: name is ${name.length} characters; the limit is ${NAME_MAX}`);
    if (!NAME_PATTERN.test(name)) errors.push(`${label}: name "${name}" must be lowercase letters and digits in hyphen-separated words`);
  }
  if (typeof description !== 'string' || description === '') {
    errors.push(`${label}: frontmatter needs a description`);
  } else {
    if (description.length > DESCRIPTION_MAX) {
      errors.push(`${label}: description is ${description.length} characters; the limit is ${DESCRIPTION_MAX}`);
    }
    const end = SENTENCE_END.exec(description);
    if (!end || end.index + 1 > SUMMARY_MAX) {
      errors.push(`${label}: description must finish its first sentence within ${SUMMARY_MAX} characters, so a truncated listing still reads as a summary`);
    }
  }
  return errors;
}

function lineOf(text, index) {
  return text.slice(0, index).split('\n').length;
}

/**
 * Every relative Markdown link must resolve from the file's directory, and every
 * repository path the file names must exist. With `allowRelativeLinks: false` a
 * relative link is itself an error.
 */
export function checkReferences({ root, file, text, allowRelativeLinks }) {
  const errors = [];
  const directory = path.dirname(path.join(root, file));
  for (const match of text.matchAll(MARKDOWN_LINK)) {
    const target = match[1];
    const where = `${file}:${lineOf(text, match.index)}`;
    if (target.startsWith('#')) continue;
    if (/^[a-z][a-z0-9+.-]*:/iu.test(target)) {
      if (!target.startsWith('https://')) errors.push(`${where}: link ${target} must use https://`);
      continue;
    }
    if (!allowRelativeLinks) {
      errors.push(`${where}: relative link ${target}; name the file by its repository path instead, because this file is also read through ${CLAUDE_ENTRY}`);
      continue;
    }
    const relative = decodeURIComponent(target.replace(/[?#].*$/u, ''));
    if (!existsSync(path.resolve(directory, relative))) errors.push(`${where}: dead link ${target}`);
  }
  for (const match of text.matchAll(REPO_PATH)) {
    const reference = match[0].replace(/^\.\//u, '').replace(/[.,;:]+$/u, '');
    if (!existsSync(path.join(root, reference))) {
      errors.push(`${file}:${lineOf(text, match.index)}: names ${reference}, which does not exist`);
    }
  }
  return errors;
}

function readSkillFile({ root, file, yaml, errors }) {
  const absolute = path.join(root, file);
  if (!existsSync(absolute)) {
    errors.push(`${file}: missing`);
    return null;
  }
  const text = readFileSync(absolute, 'utf8');
  const split = splitFrontmatter(text);
  if (split.error) {
    errors.push(`${file}: ${split.error}`);
    return { text, values: {} };
  }
  const lineParse = parseSingleLineFrontmatter(split.block);
  errors.push(...lineParse.errors.map((error) => `${file}: ${error}`));
  if (yaml.required || yaml.available !== false) {
    const parsed = parseWithPyYaml(split.block, { python: yaml.python });
    if (parsed.unavailable) {
      yaml.available = false;
      yaml.reason = parsed.unavailable;
      if (yaml.required) errors.push(`${file}: no YAML parser to check the frontmatter with: ${parsed.unavailable}`);
    } else if (parsed.error) {
      yaml.available = true;
      errors.push(`${file}: frontmatter is not valid YAML: ${parsed.error}`);
    } else {
      yaml.available = true;
      const same = JSON.stringify(parsed.value) === JSON.stringify(lineParse.values);
      if (!same) {
        errors.push(`${file}: the YAML parser reads ${JSON.stringify(parsed.value)} but the line parser reads ${JSON.stringify(lineParse.values)}`);
      }
    }
  }
  return { text, body: split.body, values: lineParse.values };
}

function checkEntryDirectory({ entry, name, errors }) {
  if (typeof name === 'string' && path.basename(entry) !== name) {
    errors.push(`${entry}: directory name must equal the skill name "${name}"`);
  }
}

/** Run every invariant against one repository checkout. */
export function checkSkill({ root, requireYamlParser = true, python } = {}) {
  const errors = [];
  const yaml = { required: requireYamlParser, python, available: undefined, reason: null };

  const source = readSkillFile({ root, file: SKILL_SOURCE, yaml, errors });
  if (source) {
    errors.push(...checkFrontmatterValues(source.values, SKILL_SOURCE));
    errors.push(...checkReferences({ root, file: SKILL_SOURCE, text: source.text, allowRelativeLinks: false }));
  }

  const pointerDir = path.dirname(AGENTS_POINTER);
  if (existsSync(path.join(root, pointerDir)) && lstatSync(path.join(root, pointerDir)).isSymbolicLink()) {
    errors.push(`${pointerDir}: must be a real directory; OpenClaw skips a symlinked skill directory that leaves .agents/skills`);
  }
  if (existsSync(path.join(root, AGENTS_POINTER)) && lstatSync(path.join(root, AGENTS_POINTER)).isSymbolicLink()) {
    errors.push(`${AGENTS_POINTER}: must be a real file, not a symlink`);
  }
  const pointer = readSkillFile({ root, file: AGENTS_POINTER, yaml, errors });
  if (pointer) {
    errors.push(...checkFrontmatterValues(pointer.values, AGENTS_POINTER));
    errors.push(...checkReferences({ root, file: AGENTS_POINTER, text: pointer.text, allowRelativeLinks: true }));
    if (source) {
      for (const key of new Set([...Object.keys(source.values), ...Object.keys(pointer.values)])) {
        if (source.values[key] !== pointer.values[key]) {
          errors.push(`${AGENTS_POINTER}: frontmatter ${key} differs from ${SKILL_SOURCE}; copy the source's frontmatter`);
        }
      }
    }
    if (pointer.body !== undefined) {
      if (!pointer.body.includes(SKILL_SOURCE)) errors.push(`${AGENTS_POINTER}: must name ${SKILL_SOURCE}`);
      const bodyLines = pointer.body.split('\n').filter((line) => line.trim() !== '').length;
      if (bodyLines > POINTER_MAX_BODY_LINES) {
        errors.push(`${AGENTS_POINTER}: body has ${bodyLines} non-blank lines; a pointer carries at most ${POINTER_MAX_BODY_LINES}, and guidance belongs in ${SKILL_SOURCE}`);
      }
    }
  }
  checkEntryDirectory({ entry: pointerDir, name: source?.values.name, errors });

  const claudeEntry = path.join(root, CLAUDE_ENTRY);
  let claudeStat = null;
  try {
    claudeStat = lstatSync(claudeEntry);
  } catch {
    errors.push(`${CLAUDE_ENTRY}: missing; it must be a symlink to ${path.dirname(SKILL_SOURCE)}`);
  }
  if (claudeStat && !claudeStat.isSymbolicLink()) {
    errors.push(`${CLAUDE_ENTRY}: must be a symlink to ${path.dirname(SKILL_SOURCE)}, not a copy`);
  } else if (claudeStat) {
    const target = readlinkSync(claudeEntry);
    if (path.isAbsolute(target)) errors.push(`${CLAUDE_ENTRY}: symlink target ${target} must be relative`);
    let resolved = null;
    try {
      resolved = realpathSync(claudeEntry);
    } catch {
      errors.push(`${CLAUDE_ENTRY}: dangling symlink to ${target}`);
    }
    if (resolved && resolved !== realpathSync(path.join(root, path.dirname(SKILL_SOURCE)))) {
      errors.push(`${CLAUDE_ENTRY}: resolves to ${path.relative(realpathSync(root), resolved)}, not ${path.dirname(SKILL_SOURCE)}`);
    }
  }
  checkEntryDirectory({ entry: CLAUDE_ENTRY, name: source?.values.name, errors });

  return {
    ok: errors.length === 0,
    name: source?.values.name ?? null,
    yamlParser: yaml.available === true ? 'pyyaml' : yaml.available === false ? `unavailable: ${yaml.reason}` : 'not run',
    errors,
  };
}

function main(argv) {
  let resolved;
  try {
    resolved = resolveRepositoryRoot({ argv });
  } catch (error) {
    console.error(`check-k6-skill: ${error.message}`);
    return 2;
  }
  const flags = new Set(resolved.rest);
  const unknown = [...flags].filter((flag) => flag !== '--json' && flag !== '--allow-missing-yaml-parser');
  if (unknown.length > 0) {
    console.error(`check-k6-skill: unknown argument ${unknown.join(' ')}`);
    console.error('usage: check-k6-skill.mjs [--repo-root <dir>] [--json] [--allow-missing-yaml-parser]');
    return 2;
  }
  const result = checkSkill({ root: resolved.root, requireYamlParser: !flags.has('--allow-missing-yaml-parser') });
  if (flags.has('--json')) {
    console.log(JSON.stringify(result, null, 2));
  } else {
    console.log(`k6 skill: ${result.name ?? '(no name)'} | YAML parser: ${result.yamlParser} | ${result.ok ? 'ok' : `${result.errors.length} problem(s)`}`);
    for (const error of result.errors) console.error(`  - ${error}`);
  }
  return result.ok ? 0 : 1;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  process.exitCode = main(process.argv.slice(2));
}
