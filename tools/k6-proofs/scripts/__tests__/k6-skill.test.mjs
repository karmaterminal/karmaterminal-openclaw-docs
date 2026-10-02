/**
 * k6-skill.test.mjs — #123.
 *
 * tools/k6-proofs/skill/SKILL.md is the single k6 authoring skill. It had no
 * frontmatter, so neither Claude Code nor OpenClaw would load it, and the
 * .agents/skills/k6-proofs wrapper had become a second, drifting copy with dead
 * paths. These tests pin the committed skill to check-k6-skill.mjs, and pin the
 * checker to each failure it exists to catch.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { realpathSync } from 'node:fs';
import { mkdir, mkdtemp, readFile, rm, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  AGENTS_POINTER,
  CLAUDE_ENTRY,
  SKILL_SOURCE,
  checkSkill,
  parseWithPyYaml,
  splitFrontmatter,
} from '../check-k6-skill.mjs';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../..');
const script = path.join(repoRoot, 'tools/k6-proofs/scripts/check-k6-skill.mjs');
const probe = parseWithPyYaml('probe: ok\n');
const hasPyYaml = probe.value?.probe === 'ok';
const noYamlParser = hasPyYaml ? false : `no YAML parser here: ${probe.unavailable ?? probe.error}`;

test('the committed k6 skill loads, has one source and names no dead paths', () => {
  const result = checkSkill({ root: repoRoot, requireYamlParser: hasPyYaml });
  assert.deepEqual(result.errors, []);
  assert.equal(result.name, 'k6-proofs');
});

test('a YAML parser reads the committed frontmatter as a name and a description', { skip: noYamlParser }, async () => {
  for (const file of [SKILL_SOURCE, AGENTS_POINTER]) {
    const { block } = splitFrontmatter(await readFile(path.join(repoRoot, file), 'utf8'));
    const parsed = parseWithPyYaml(block);
    assert.deepEqual(Object.keys(parsed.value).sort(), ['description', 'name'], file);
    assert.equal(parsed.value.name, 'k6-proofs', file);
    assert.equal(typeof parsed.value.description, 'string', file);
    assert.ok(parsed.value.description.length <= 1024, file);
  }
});

test('the CLI gives one verdict from the repository root and from tools/k6-proofs', () => {
  const args = hasPyYaml ? ['--json'] : ['--json', '--allow-missing-yaml-parser'];
  const env = { ...process.env, OPENCLAW_PROOFS_REPO_ROOT: '' };
  const fromRoot = spawnSync(process.execPath, [script, ...args], { cwd: repoRoot, env, encoding: 'utf8' });
  const fromTool = spawnSync(process.execPath, [script, ...args], { cwd: path.join(repoRoot, 'tools/k6-proofs'), env, encoding: 'utf8' });
  assert.equal(fromRoot.status, 0, fromRoot.stdout + fromRoot.stderr);
  assert.equal(fromTool.status, 0, fromTool.stdout + fromTool.stderr);
  assert.equal(fromTool.stdout, fromRoot.stdout);
});

test('the CLI fails closed when no YAML parser can run, unless told to allow it', () => {
  const env = { ...process.env, OPENCLAW_PROOFS_REPO_ROOT: '', OPENCLAW_PROOFS_PYTHON: path.join(tmpdir(), 'no-such-python3') };
  const strict = spawnSync(process.execPath, [script], { cwd: repoRoot, env, encoding: 'utf8' });
  assert.equal(strict.status, 1, strict.stdout + strict.stderr);
  assert.match(strict.stderr, /no YAML parser to check the frontmatter with/);
  const allowed = spawnSync(process.execPath, [script, '--json', '--allow-missing-yaml-parser'], { cwd: repoRoot, env, encoding: 'utf8' });
  assert.equal(allowed.status, 0, allowed.stdout + allowed.stderr);
  assert.match(JSON.parse(allowed.stdout).yamlParser, /^unavailable: /);
});

const DESCRIPTION = 'Author a fixture proof row for the corpus. Use when exercising the checker.';
const frontmatter = ({ name = 'k6-proofs', description = DESCRIPTION } = {}) =>
  `---\nname: ${name}\ndescription: ${description}\n---\n`;
const SOURCE_BODY = '\n# Fixture skill\n\nRun rows with `tools/k6-proofs/run-proof.sh`.\n';
const POINTER_BODY = `\nRead \`${SKILL_SOURCE}\` ([open it](../../../${SKILL_SOURCE})).\n`;

async function withFixture(mutate, fn) {
  const created = await mkdtemp(path.join(tmpdir(), 'k6-skill-check-'));
  const root = realpathSync(created);
  try {
    for (const dir of ['tools/k6-proofs/manifests', 'tools/k6-proofs/scenarios', 'tools/k6-proofs/skill', '.agents/skills/k6-proofs', '.claude/skills']) {
      await mkdir(path.join(root, dir), { recursive: true });
    }
    await writeFile(path.join(root, 'tools/k6-proofs/run-proof.sh'), '#!/usr/bin/env bash\n');
    const files = { source: frontmatter() + SOURCE_BODY, pointer: frontmatter() + POINTER_BODY, claudeTarget: '../../tools/k6-proofs/skill' };
    await mutate?.(files, root);
    if (files.source !== null) await writeFile(path.join(root, SKILL_SOURCE), files.source);
    if (files.pointer !== null) await writeFile(path.join(root, AGENTS_POINTER), files.pointer);
    if (files.claudeTarget !== null) await symlink(files.claudeTarget, path.join(root, CLAUDE_ENTRY));
    return await fn(root);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
}

const both = (description) => (files) => {
  files.source = frontmatter({ description }) + SOURCE_BODY;
  files.pointer = frontmatter({ description }) + POINTER_BODY;
};

test('a well-formed fixture passes, so each failure below comes from its one change', async () => {
  await withFixture(null, (root) => {
    assert.deepEqual(checkSkill({ root, requireYamlParser: hasPyYaml }).errors, []);
  });
});

const FAILURES = [
  ['a skill with no frontmatter', (files) => { files.source = SOURCE_BODY.trimStart(); }, /skill\/SKILL\.md: missing frontmatter: line 1 must be ---/],
  ['an unterminated frontmatter block', (files) => { files.source = `---\nname: k6-proofs\n${SOURCE_BODY}`; }, /unterminated frontmatter/],
  ['a multi-line description', (files) => { files.source = `---\nname: k6-proofs\ndescription:\n  ${DESCRIPTION}\n---\n${SOURCE_BODY}`; }, /expected a single-line "key: value" pair/],
  ['a quoted description', both(`"${DESCRIPTION}"`), /description starts with a YAML indicator character/],
  ['": " inside the description', both('Author a fixture row. Use when: the checker runs.'), /contains ": ", which YAML reads as a nested mapping/],
  ['" #" inside the description', both('Author a fixture row. Use for row #7 only.'), /contains " #", which YAML reads as a comment/],
  ['a description over 1024 characters', both(`Author a fixture row. ${'Use it. '.repeat(130)}`.trim()), /description is \d+ characters; the limit is 1024/],
  ['a first sentence past 160 characters', both(`Author ${'a fixture row and '.repeat(10)}more. Use it.`), /finish its first sentence within 160 characters/],
  ['a name with capitals', (files) => { files.source = frontmatter({ name: 'K6-Proofs' }) + SOURCE_BODY; files.pointer = frontmatter({ name: 'K6-Proofs' }) + POINTER_BODY; }, /name "K6-Proofs" must be lowercase/],
  ['a dead repository path', (files) => { files.source += 'Copy `tools/k6-proofs/scenarios/r-cd-2.js`.\n'; }, /names tools\/k6-proofs\/scenarios\/r-cd-2\.js, which does not exist/],
  ['a relative link in the source', (files) => { files.source += 'See [the runner](../run-proof.sh).\n'; }, /relative link \.\.\/run-proof\.sh; name the file by its repository path/],
  ['an http link', (files) => { files.source += 'See [the board](http://example.com/board).\n'; }, /must use https:\/\//],
  ['a pointer whose description drifted', (files) => { files.pointer = frontmatter({ description: `${DESCRIPTION} Also more.` }) + POINTER_BODY; }, /frontmatter description differs from tools\/k6-proofs\/skill\/SKILL\.md/],
  ['a pointer that copies the skill', (files) => { files.pointer += Array.from({ length: 12 }, (_, i) => `Guidance line ${i}.`).join('\n'); }, /a pointer carries at most 12/],
  ['a pointer that does not name the source', (files) => { files.pointer = `${frontmatter()}\nRead the authoring skill.\n`; }, /must name tools\/k6-proofs\/skill\/SKILL\.md/],
  ['a dead link in the pointer', (files) => { files.pointer = `${frontmatter()}\nRead \`${SKILL_SOURCE}\` ([open it](../../${SKILL_SOURCE})).\n`; }, /dead link \.\.\/\.\.\/tools\/k6-proofs\/skill\/SKILL\.md/],
  ['a missing Claude Code entry', (files) => { files.claudeTarget = null; }, /\.claude\/skills\/k6-proofs: missing; it must be a symlink/],
  ['a Claude Code entry that resolves elsewhere', (files) => { files.claudeTarget = '../../tools/k6-proofs'; }, /resolves to tools\/k6-proofs, not tools\/k6-proofs\/skill/],
  ['an absolute Claude Code entry', (files, root) => { files.claudeTarget = path.join(root, 'tools/k6-proofs/skill'); }, /symlink target .* must be relative/],
  ['a Claude Code entry that is a copy', async (files, root) => {
    files.claudeTarget = null;
    await mkdir(path.join(root, CLAUDE_ENTRY));
    await writeFile(path.join(root, CLAUDE_ENTRY, 'SKILL.md'), files.source);
  }, /must be a symlink to tools\/k6-proofs\/skill, not a copy/],
  ['a symlinked .agents pointer directory', async (files, root) => {
    files.pointer = null;
    await rm(path.join(root, '.agents/skills/k6-proofs'), { recursive: true });
    await symlink('../../tools/k6-proofs/skill', path.join(root, '.agents/skills/k6-proofs'));
  }, /\.agents\/skills\/k6-proofs: must be a real directory/],
];

for (const [label, mutate, expected] of FAILURES) {
  test(`the checker rejects ${label}`, async () => {
    await withFixture(mutate, (root) => {
      const result = checkSkill({ root, requireYamlParser: false });
      assert.equal(result.ok, false);
      assert.ok(result.errors.some((error) => expected.test(error)), `expected ${expected}, got:\n${result.errors.join('\n')}`);
    });
  });
}

test('the checker rejects frontmatter the YAML parser types differently from the line parser', { skip: noYamlParser }, async () => {
  // PyYAML reads `2026.` as a float; a loader that trusts YAML would get no description string.
  await withFixture(both('2026.'), (root) => {
    const result = checkSkill({ root, requireYamlParser: true });
    assert.ok(result.errors.some((error) => /the YAML parser reads \{"name":"k6-proofs","description":2026\} but the line parser reads/.test(error)), result.errors.join('\n'));
  });
});
