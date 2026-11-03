// Modeled pnpm toolchains and lockfiles for the R-CW-5 and R-CW-6 fixture tests.
//
// The shapes follow the published packages. pnpm <=10 declares `bin/pnpm.cjs`
// and pnpm 11 `bin/pnpm.mjs`, both `#!/usr/bin/env node` scripts. pnpm 12
// declares a shebang-less `pnpm` shell launcher that hands over to
// `bin/pnpm.mjs`, which runs the native binary of whichever `@pnpm/exe.<target>`
// package npm installed, or downloads one next to itself when none is present.
//
// A pnpm 12 `pnpm-lock.yaml` is two YAML documents: an env document that pins
// the package manager (`packageManagerDependencies`), then the lockfile document
// that pnpm writes, alone, to `node_modules/.pnpm/lock.yaml`.
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { chmod, mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// The first 4604 bytes of a pnpm 12.15.0 `pnpm-lock.yaml`, through the
// separator before the lockfile document. pnpm writes the same bytes into every
// project pinned to that release (registry integrities only); the exact
// candidate 293c977f629f872a643fb94892603310b887293b commits them unchanged
// (sha256 d1d603ac25cb20ea6c047ff54f9bc2293aa74f7f1000c83237985db7ad5a0f58).
export const PNPM_12_ENV_PREFIX = readFileSync(
  fileURLToPath(new URL('../fixtures/pnpm-12.15.0-lockfile-env-prefix.yaml', import.meta.url)),
);

// The candidate's packageManager pin; the sha512 is the registry integrity of
// the pnpm@12.15.0 tarball.
export const PNPM_12_15_0 =
  'pnpm@12.15.0+sha512.b3951d6d6ff4a9f13dc7cf56cd28d2b8eb37dbcc9c68e52e1e1191873ea9f82a017287ab50baadc5ccc494f036c67c0e47eb13608c2fa36f47711b61ea128e61';

// A lockfile document exactly as pnpm 12.15.0 writes it, for one dependency.
export const LOCKFILE_DOCUMENT = Buffer.from([
  "lockfileVersion: '9.0'",
  '',
  'settings:',
  '  autoInstallPeers: true',
  '  excludeLinksFromLockfile: false',
  '',
  'importers:',
  '',
  '  .:',
  '    dependencies:',
  '      is-number:',
  '        specifier: 7.0.0',
  '        version: 7.0.0',
  '',
  'packages:',
  '',
  '  is-number@7.0.0:',
  '    resolution: {integrity: sha512-41Cifkg6e8TylSpdtTpeLVMqvSBEVzTttHvERD741+pnZ8ANv0004MRL43QKPDlK9cGvNp6NZWZUBlbGXYxxng==}',
  "    engines: {node: '>=0.12.0'}",
  '',
  'snapshots:',
  '',
  '  is-number@7.0.0: {}',
  '',
].join('\n'));

export const PLATFORM_PACKAGE = `@pnpm/exe.${process.platform}-${process.arch}`;

export function sha256(bytes) {
  return createHash('sha256').update(bytes).digest('hex');
}

export function modeledIntegrity(label) {
  const digest = createHash('sha512').update(label).digest();
  return { hex: digest.toString('hex'), sri: `sha512-${digest.toString('base64')}` };
}

function sriFromHex(hex) {
  return `sha512-${Buffer.from(hex, 'hex').toString('base64')}`;
}

// An env document shaped like pnpm 12's, with the pins under test's control.
export function pnpmEnvPrefix({
  version = '12.15.0',
  pinnedVersion = version,
  pnpmIntegrity,
  platformPackages = {},
}) {
  const lines = [
    '---',
    "lockfileVersion: '9.0'",
    '',
    'importers:',
    '',
    '  .:',
    '    configDependencies: {}',
    '    packageManagerDependencies:',
    '      pnpm:',
    `        specifier: ${pinnedVersion}`,
    `        version: ${pinnedVersion}`,
    '',
    'packages:',
    '',
  ];
  for (const [name, integrity] of Object.entries(platformPackages)) {
    lines.push(`  '${name}@${version}':`, `    resolution: {integrity: ${integrity}}`, '    os: [linux]', '');
  }
  lines.push(
    `  pnpm@${version}:`,
    `    resolution: {integrity: ${pnpmIntegrity}}`,
    "    engines: {node: '>=18'}",
    '    hasBin: true',
    '',
    'snapshots:',
    '',
  );
  for (const name of Object.keys(platformPackages)) {
    lines.push(`  '${name}@${version}':`, '    optional: true', '');
  }
  if (Object.keys(platformPackages).length === 0) {
    lines.push(`  pnpm@${version}: {}`);
  } else {
    lines.push(`  pnpm@${version}:`, '    optionalDependencies:');
    for (const name of Object.keys(platformPackages)) lines.push(`      '${name}': ${version}`);
  }
  lines.push('', '---', '');
  return Buffer.from(lines.join('\n'));
}

async function writeExecutable(file, content) {
  await mkdir(path.dirname(file), { recursive: true });
  await writeFile(file, content);
  await chmod(file, 0o755);
}

// Writes what `npm install --ignore-scripts pnpm@<version>` leaves in a private
// toolchain directory, for the requested published layout.
export async function writePnpmToolchain(toolchainDir, {
  layout,
  version,
  integrityHex,
  platformPackages = {},
  installPlatformBinary = true,
  bin,
  entrySource,
}) {
  const nodeModules = path.join(toolchainDir, 'node_modules');
  const packageDir = path.join(nodeModules, 'pnpm');
  await mkdir(packageDir, { recursive: true });
  const declaredBin = bin ?? {
    'pnpm10': { pnpm: 'bin/pnpm.cjs', pnpx: 'bin/pnpx.cjs' },
    'pnpm11': { pnpm: 'bin/pnpm.mjs', pnpx: 'bin/pnpx.mjs', pn: 'bin/pnpm.mjs', pnx: 'bin/pnpx.mjs' },
    'pnpm12': { pnpm: 'pnpm', pn: 'pn', pnpx: 'pnpx', pnx: 'pnx' },
  }[layout];
  const hiddenLock = {
    lockfileVersion: 3,
    requires: true,
    packages: {
      'node_modules/pnpm': { version, integrity: sriFromHex(integrityHex), bin: declaredBin },
    },
  };
  for (const [name, integrity] of Object.entries(platformPackages)) {
    hiddenLock.packages[`node_modules/${name}`] = { version, integrity, optional: true };
    await mkdir(path.join(nodeModules, ...name.split('/')), { recursive: true });
    await writeFile(
      path.join(nodeModules, ...name.split('/'), 'package.json'),
      `${JSON.stringify({ name, version }, null, 2)}\n`,
    );
    if (installPlatformBinary) {
      await writeExecutable(
        path.join(nodeModules, ...name.split('/'), 'pnpm'),
        `#!/bin/sh\nif [ "$1" = "--version" ]; then echo ${version}; exit 0; fi\nexit 64\n`,
      );
    }
  }
  await writeFile(path.join(nodeModules, '.package-lock.json'), `${JSON.stringify(hiddenLock, null, 2)}\n`);
  await writeFile(
    path.join(packageDir, 'package.json'),
    `${JSON.stringify({ name: 'pnpm', version, bin: declaredBin, type: 'module' }, null, 2)}\n`,
  );
  const printVersion = `#!/usr/bin/env node\nif (process.argv[2] === '--version') console.log('${version}');\n`;
  if (layout === 'pnpm10') {
    await writeExecutable(path.join(packageDir, 'bin', 'pnpm.cjs'), entrySource ?? printVersion);
  } else if (layout === 'pnpm11') {
    // pnpm 11 still ships bin/pnpm.cjs, but its bin field names bin/pnpm.mjs.
    await writeExecutable(path.join(packageDir, 'bin', 'pnpm.cjs'), printVersion);
    await writeExecutable(path.join(packageDir, 'bin', 'pnpm.mjs'), entrySource ?? printVersion);
  } else if (layout === 'pnpm12') {
    const platform = Object.keys(platformPackages)[0] ?? PLATFORM_PACKAGE;
    await writeExecutable(
      path.join(packageDir, 'pnpm'),
      entrySource ?? [
        "# pnpm's native binary replaces this file during installation (see",
        '# ./install.js). Until then this hands over to ./bin/pnpm.mjs.',
        'self=$0',
        'exec node "${self%/*}/bin/pnpm.mjs" "$@"',
        '',
      ].join('\n'),
    );
    await writeExecutable(path.join(packageDir, 'bin', 'pnpm.mjs'), [
      '#!/usr/bin/env node',
      "import { spawnSync } from 'node:child_process';",
      "import { existsSync, writeFileSync } from 'node:fs';",
      "import path from 'node:path';",
      "import { fileURLToPath } from 'node:url';",
      'const wrapperDir = path.dirname(path.dirname(fileURLToPath(import.meta.url)));',
      `const installed = path.join(wrapperDir, '..', ...${JSON.stringify(platform.split('/'))}, 'pnpm');`,
      'let binary = installed;',
      'if (!existsSync(installed)) {',
      "  binary = path.join(wrapperDir, 'pnpm-native');",
      `  writeFileSync(binary, '#!/bin/sh\\necho ${version}\\n', { mode: 0o755 });`,
      '}',
      "const result = spawnSync(binary, process.argv.slice(2), { stdio: 'inherit' });",
      'process.exitCode = result.status ?? 1;',
      '',
    ].join('\n'));
  } else {
    throw new Error(`unknown modeled pnpm layout: ${layout}`);
  }
  return { packageDir };
}
