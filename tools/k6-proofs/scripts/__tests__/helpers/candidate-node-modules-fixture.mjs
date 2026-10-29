// Modeled candidate dependency trees for the fixtures' candidate-local tools.
//
// pnpm's isolated linker puts each package under
// node_modules/.pnpm/<name>@<version>/node_modules/<name>, links every direct
// dependency at node_modules/<name>, and links its bins into node_modules/.bin.
// pnpm 11 (and 12.0) wrote a .bin link as a symlink to the JS entry. pnpm 12.15.0
// writes a POSIX sh cmd-shim: the two shims under ../fixtures are the bytes it
// wrote for tsx@4.23.15 and the patched vitest@5.0.5 at exact candidate
// 293c977f629f872a643fb94892603310b887293b. They contain no host path, and each
// names its target on its `# cmd-shim-target=` line.
import { readFileSync } from 'node:fs';
import { chmod, mkdir, mkdtemp, symlink, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

function fixtureBytes(name) {
  return readFileSync(fileURLToPath(new URL(`../fixtures/${name}`, import.meta.url)));
}

export const PNPM_12_SHIMS = {
  tsx: fixtureBytes('pnpm-12.15.0-bin-shim-tsx.sh'),
  vitest: fixtureBytes('pnpm-12.15.0-bin-shim-vitest.sh'),
};

// The package each real shim targets, and the bin entry that package declares.
export const CANDIDATE_TOOLS = {
  tsx: {
    storeDir: 'tsx@4.23.15',
    version: '4.23.15',
    bin: './dist/cli.mjs',
  },
  vitest: {
    storeDir: 'vitest@5.0.5_patch_hash=abb35069c56858589f463527013088f26c8da59c6cccfd5c48b35c472caac35_e7db5c12a4066ca9f2ee238e7d11dd16',
    version: '5.0.5',
    bin: { vitest: './vitest.mjs' },
  },
};

// The modeled entry prints which tool ran and with what arguments, so a test
// can tell the declared JS entry ran rather than anything else.
export function toolEntrySource(name) {
  return `#!/usr/bin/env node\nconsole.log(JSON.stringify({ tool: ${JSON.stringify(name)}, argv: process.argv.slice(2) }));\n`;
}

function declaredEntry(bin, name) {
  return typeof bin === 'string' ? bin : bin[name];
}

/**
 * A worktree whose node_modules holds the candidate tools, linked the way the
 * named pnpm generation links them. `overrides[name]` replaces parts of one
 * tool: `bin` (package.json), `entrySource`, or `shim` (pnpm 12 .bin bytes).
 */
export async function modeledCandidateNodeModules({ layout, tools = ['tsx', 'vitest'], overrides = {} }) {
  const worktree = await mkdtemp(path.join(os.tmpdir(), `candidate-node-modules-${layout}-`));
  const nodeModules = path.join(worktree, 'node_modules');
  await mkdir(path.join(nodeModules, '.bin'), { recursive: true });
  for (const name of tools) {
    const tool = { ...CANDIDATE_TOOLS[name], ...overrides[name] };
    const packageDir = path.join(nodeModules, '.pnpm', tool.storeDir, 'node_modules', name);
    await mkdir(packageDir, { recursive: true });
    await writeFile(
      path.join(packageDir, 'package.json'),
      `${JSON.stringify({ name, version: tool.version, bin: tool.bin }, null, 2)}\n`,
    );
    const entry = declaredEntry(CANDIDATE_TOOLS[name].bin, name);
    const entryPath = path.join(packageDir, entry);
    await mkdir(path.dirname(entryPath), { recursive: true });
    await writeFile(entryPath, tool.entrySource ?? toolEntrySource(name), { mode: 0o755 });
    await symlink(path.join('.pnpm', tool.storeDir, 'node_modules', name), path.join(nodeModules, name));
    const binPath = path.join(nodeModules, '.bin', name);
    if (layout === 'pnpm12') {
      await writeFile(binPath, tool.shim ?? PNPM_12_SHIMS[name]);
      await chmod(binPath, 0o755);
    } else if (layout === 'pnpm11') {
      await symlink(path.join('..', name, entry), binPath);
    } else {
      throw new Error(`unknown modeled pnpm layout: ${layout}`);
    }
  }
  return worktree;
}

export function modeledToolEntry(worktree, name) {
  return path.join(
    worktree,
    'node_modules',
    '.pnpm',
    CANDIDATE_TOOLS[name].storeDir,
    'node_modules',
    name,
    declaredEntry(CANDIDATE_TOOLS[name].bin, name),
  );
}
