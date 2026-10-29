import test from 'node:test';
import assert from 'node:assert/strict';

import {
  ENV_AND_LOCKFILE_DOCUMENTS,
  SINGLE_DOCUMENT,
  parsePnpmEnvDocument,
  readPnpmEnvDocumentPins,
  splitPnpmLockfile,
} from '../lib/pnpm-lockfile-documents.mjs';
import { LOCKFILE_DOCUMENT, PNPM_12_ENV_PREFIX } from './helpers/pnpm-toolchain-fixture.mjs';

const PNPM_12_LOCKFILE = Buffer.concat([PNPM_12_ENV_PREFIX, LOCKFILE_DOCUMENT]);

test('a single-document lockfile is its own lockfile document', () => {
  const split = splitPnpmLockfile(LOCKFILE_DOCUMENT);
  assert.equal(split.layout, SINGLE_DOCUMENT);
  assert.equal(split.envDocument, null);
  assert.ok(split.lockfileDocument.equals(LOCKFILE_DOCUMENT));
});

test('a pnpm 12 lockfile splits at pnpm\'s own document markers', () => {
  const split = splitPnpmLockfile(PNPM_12_LOCKFILE);
  assert.equal(split.layout, ENV_AND_LOCKFILE_DOCUMENTS);
  assert.ok(split.lockfileDocument.equals(LOCKFILE_DOCUMENT));
  // `---\n<env>\n---\n`: the env document excludes both markers, as pnpm reads it.
  assert.ok(split.envDocument.equals(PNPM_12_ENV_PREFIX.subarray(4, PNPM_12_ENV_PREFIX.length - 5)));
});

test('a lockfile that opens a document but never closes it has no lockfile document', () => {
  assert.throws(
    () => splitPnpmLockfile(Buffer.from("---\nlockfileVersion: '9.0'\n")),
    /opens a YAML document but has no lockfile document after it/,
  );
});

test('a lockfile with more than two documents is refused', () => {
  for (const candidate of [
    Buffer.concat([PNPM_12_LOCKFILE, Buffer.from('---\n'), LOCKFILE_DOCUMENT]),
    Buffer.concat([PNPM_12_ENV_PREFIX, Buffer.from('---\n'), LOCKFILE_DOCUMENT]),
  ]) {
    assert.throws(() => splitPnpmLockfile(candidate), /more than two YAML documents/);
  }
});

test('the real pnpm 12.15.0 env document parses to its pins', () => {
  const env = parsePnpmEnvDocument(splitPnpmLockfile(PNPM_12_LOCKFILE).envDocument.toString('utf8'));
  assert.equal(env.lockfileVersion, '9.0');
  assert.deepEqual(env.importers['.'].configDependencies, {});
  assert.deepEqual(env.importers['.'].packageManagerDependencies, {
    pnpm: { specifier: '12.15.0', version: '12.15.0' },
  });
  assert.deepEqual(env.packages['pnpm@12.15.0'], {
    resolution: {
      integrity: 'sha512-s5UdbW/0qfE9x89WzSjSuOs328ycaOUuHhGRhz6p+CoBcoerULqtxczElPA2xnwOR+sTYIwvo29HcRth6hKOYQ==',
    },
    engines: { node: '>=18' },
    hasBin: 'true',
  });
  assert.deepEqual(env.packages['@pnpm/exe.linux-arm64@12.15.0'].cpu, ['arm64']);
  assert.deepEqual(env.snapshots['@pnpm/exe.linux-arm64@12.15.0'], { optional: 'true' });
  assert.equal(env.snapshots['pnpm@12.15.0'].optionalDependencies['@pnpm/exe.linux-x64'], '12.15.0');
});

test('env document pins are read only when they name the resolved pnpm', () => {
  const { envDocument } = splitPnpmLockfile(PNPM_12_LOCKFILE);
  const pins = readPnpmEnvDocumentPins(envDocument, '12.15.0');
  assert.deepEqual(pins.packageManagerDependencies, { pnpm: '12.15.0' });
  assert.equal(
    pins.packageIntegrities['pnpm@12.15.0'],
    'sha512-s5UdbW/0qfE9x89WzSjSuOs328ycaOUuHhGRhz6p+CoBcoerULqtxczElPA2xnwOR+sTYIwvo29HcRth6hKOYQ==',
  );
  assert.equal(
    pins.packageIntegrities['@pnpm/exe.linux-arm64@12.15.0'],
    'sha512-qML/8aCXslh8td/w4U+HJNqUcZ2+m6EfTbWScIzZRmyPsRFN+xB4LP1U/hymxc1iSJiKtG56HJx2fvUErWFIGw==',
  );
  assert.equal(Object.keys(pins.packageIntegrities).length, 15);
  assert.throws(
    () => readPnpmEnvDocumentPins(envDocument, '12.14.0'),
    /env document pins pnpm 12\.15\.0, not the resolved pnpm 12\.14\.0/,
  );
});

test('every package-manager dependency the env document lists must be at the resolved version', () => {
  const env = Buffer.from([
    "lockfileVersion: '9.0'",
    '',
    'importers:',
    '',
    '  .:',
    '    configDependencies: {}',
    '    packageManagerDependencies:',
    "      '@pnpm/exe':",
    '        specifier: 11.21.0',
    '        version: 11.21.0',
    '      pnpm:',
    '        specifier: 11.22.0',
    '        version: 11.22.0',
    '',
    'packages: {}',
    '',
    'snapshots: {}',
    '',
  ].join('\n'));
  assert.throws(
    () => readPnpmEnvDocumentPins(env, '11.22.0'),
    /env document pins @pnpm\/exe 11\.21\.0, not the resolved pnpm 11\.22\.0/,
  );
});

test('an env document without a pnpm package-manager pin is refused', () => {
  const env = Buffer.from([
    "lockfileVersion: '9.0'",
    '',
    'importers:',
    '',
    '  .:',
    '    configDependencies: {}',
    '',
    'packages: {}',
    '',
    'snapshots: {}',
    '',
  ].join('\n'));
  assert.throws(
    () => readPnpmEnvDocumentPins(env, '12.15.0'),
    /env document does not pin pnpm in packageManagerDependencies/,
  );
});

test('the env document reader refuses YAML it does not model', () => {
  const unsupported = [
    ['tab indentation', 'importers:\n\t.: {}\n', /unsupported YAML at line 2/],
    ['block sequence', 'cpu:\n  - arm64\n', /unsupported YAML at line 2/],
    ['anchor', 'pnpm: &pin 12.15.0\n', /unsupported YAML at line 1/],
    ['alias', 'pnpm: *pin\n', /unsupported YAML at line 1/],
    ['comment', '# pinned\npnpm: 12.15.0\n', /unsupported YAML at line 1/],
    ['double-quoted scalar', 'pnpm: "12.15.0"\n', /unsupported YAML at line 1/],
    ['nested flow mapping', 'resolution: {integrity: {sha512: x}}\n', /unsupported YAML at line 1/],
    ['duplicate key', 'pnpm: 12.15.0\npnpm: 12.14.0\n', /repeats key pnpm at line 2/],
    ['inconsistent indentation', 'importers:\n  a: 1\n   b: 2\n', /inconsistent indentation at line 3/],
    ['orphan indentation', 'a: 1\n  b: 2\n', /inconsistent indentation at line 2/],
  ];
  for (const [label, text, expected] of unsupported) {
    assert.throws(() => parsePnpmEnvDocument(text), expected, label);
  }
});
