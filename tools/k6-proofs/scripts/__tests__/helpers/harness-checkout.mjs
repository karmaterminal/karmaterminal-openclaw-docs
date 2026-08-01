/**
 * harness-checkout.mjs — build a throwaway immutable harness checkout for tests.
 *
 * The live runner refuses to fire unless repository HEAD equals the approved
 * docs ref and the tracked bytes under tools/k6-proofs are clean (#496), so a
 * runner test cannot borrow the developer's working tree. This helper copies the
 * harness under test into a fresh git repository, commits it, and returns the
 * resulting immutable ref.
 */
import { cp, mkdir, readdir, readFile, writeFile } from 'node:fs/promises';
import { execFile } from 'node:child_process';
import path from 'node:path';
import { promisify } from 'node:util';

const run = promisify(execFile);

export const HARNESS_REPOSITORY = 'karmaterminal/karmaterminal-openclaw-docs';
export const HARNESS_REMOTE = `https://github.com/${HARNESS_REPOSITORY}.git`;

export async function buildHarnessCheckout(repoRoot, checkout) {
  await mkdir(path.join(checkout, 'tools'), { recursive: true });
  await mkdir(path.join(checkout, '.github/workflows'), { recursive: true });
  await mkdir(path.join(checkout, 'PROOFS'), { recursive: true });
  await cp(path.join(repoRoot, 'tools/k6-proofs'), path.join(checkout, 'tools/k6-proofs'), { recursive: true });
  await cp(
    path.join(repoRoot, '.github/workflows/k6-proof.yml'),
    path.join(checkout, '.github/workflows/k6-proof.yml'),
  );

  // The catalog preflight reads PROOFS/INDEX.json and the current corpus row
  // directories. Only the row directory names matter, so the (large) corpus
  // contents are deliberately not copied.
  const indexRaw = await readFile(path.join(repoRoot, 'PROOFS/INDEX.json'), 'utf8');
  await writeFile(path.join(checkout, 'PROOFS/INDEX.json'), indexRaw);
  const currentSha = JSON.parse(indexRaw).current_sha;
  for (const entry of await readdir(path.join(repoRoot, 'PROOFS', currentSha), { withFileTypes: true })) {
    if (entry.isDirectory()) await mkdir(path.join(checkout, 'PROOFS', currentSha, entry.name), { recursive: true });
  }

  const git = (...args) => run('git', ['-C', checkout, ...args], { encoding: 'utf8' });
  await git('init', '--quiet', '--initial-branch=main');
  await git('config', 'user.name', 'p81-harness-contract');
  await git('config', 'user.email', 'p81-harness-contract@example.invalid');
  await git('config', 'commit.gpgsign', 'false');
  await git('remote', 'add', 'origin', HARNESS_REMOTE);
  await git('add', '--all');
  await git('commit', '--quiet', '--message', 'harness under contract test');
  const { stdout } = await git('rev-parse', 'HEAD');
  return { checkout, proofsDir: path.join(checkout, 'tools/k6-proofs'), docsRef: stdout.trim() };
}
