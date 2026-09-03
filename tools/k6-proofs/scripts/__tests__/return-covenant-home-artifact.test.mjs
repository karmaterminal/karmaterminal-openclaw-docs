import assert from 'node:assert/strict';
import { chmod, mkdir, mkdtemp, realpath, symlink } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';

import {
  attestReturnCovenantRuntimeArtifactSource,
} from '../../lib/return-covenant-home-artifact.mjs';

test('HOME-contained attested artifact root passes no-follow owner/mode checks', async () => {
  const home = await mkdtemp(path.join(os.tmpdir(), 'return-covenant-home-'));
  const artifact = path.join(home, 'proofs', 'runtime-artifact');
  await mkdir(artifact, { recursive: true, mode: 0o700 });
  await chmod(path.join(home, 'proofs'), 0o700);
  const result = await attestReturnCovenantRuntimeArtifactSource({
    suppliedPath: artifact,
    resolvedPath: await realpath(artifact),
    homePath: await realpath(home),
  });
  assert.equal(result.homeContained, true);
  assert.equal(result.mode, 0o700);
});

test('HOME artifact rejects sibling, symlink, writable, and identity-race shapes', async () => {
  const home = await mkdtemp(path.join(os.tmpdir(), 'return-covenant-home-hostile-'));
  const sibling = await mkdtemp(path.join(os.tmpdir(), 'return-covenant-sibling-'));
  const artifact = path.join(home, 'artifact');
  await mkdir(artifact, { mode: 0o700 });

  assert.deepEqual(
    await attestReturnCovenantRuntimeArtifactSource({
      suppliedPath: sibling,
      resolvedPath: await realpath(sibling),
      homePath: await realpath(home),
    }),
    { homeContained: false },
  );

  const linked = path.join(home, 'linked-artifact');
  await symlink(artifact, linked);
  await assert.rejects(
    attestReturnCovenantRuntimeArtifactSource({
      suppliedPath: linked,
      resolvedPath: await realpath(linked),
      homePath: await realpath(home),
    }),
    /must not traverse a symlink/,
  );

  await chmod(artifact, 0o722);
  await assert.rejects(
    attestReturnCovenantRuntimeArtifactSource({
      suppliedPath: artifact,
      resolvedPath: await realpath(artifact),
      homePath: await realpath(home),
    }),
    /must not be group\/world writable/,
  );

  await chmod(artifact, 0o700);
  await assert.rejects(
    attestReturnCovenantRuntimeArtifactSource({
      suppliedPath: artifact,
      resolvedPath: await realpath(artifact),
      homePath: await realpath(home),
      expectedUid: Number.MAX_SAFE_INTEGER,
    }),
    /not owned by the current user/,
  );
});

test('launcher snapshots the verified artifact after masking host HOME', async () => {
  const { readFile } = await import('node:fs/promises');
  const source = await readFile(
    new URL('../launch-return-covenant-driver.mjs', import.meta.url),
    'utf8',
  );
  const sourceContract = await readFile(
    new URL('../../lib/return-covenant-home-artifact.mjs', import.meta.url),
    'utf8',
  );
  const mask = source.indexOf("'--tmpfs', '/home'");
  const privateArtifact = source.indexOf("const runtimeArtifactPath = path.join(runRoot, 'runtime-artifact')");
  const materialize = source.indexOf('materializeReturnCovenantRuntimeArtifact({');
  const sandbox = source.indexOf('const bwrapArgs = [');
  assert.ok(privateArtifact > 0 && materialize > privateArtifact);
  assert.ok(mask > materialize && sandbox > materialize);
  assert.match(source, /'--ro-bind', snapshotPath, snapshotPath/);
  assert.doesNotMatch(source, /'--ro-bind', runtimeArtifactSource/);
  assert.match(sourceContract, /opened\.dev !== rootInfo\.dev/);
  assert.match(sourceContract, /opened\.ino !== rootInfo\.ino/);
  assert.match(sourceContract, /O_NOFOLLOW/);
});
