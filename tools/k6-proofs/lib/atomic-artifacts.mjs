import { createHash, randomUUID } from 'node:crypto';
import { lstat, mkdir, readFile, readlink, realpath, rename, rm, symlink, writeFile } from 'node:fs/promises';
import path from 'node:path';

function bindGeneration(file, body, generation) {
  const text = String(body);
  if (path.extname(file) === '.json') {
    const value = JSON.parse(text);
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
      throw new Error('published JSON artifact must contain an object');
    }
    return `${JSON.stringify({ ...value, artifactGeneration: generation }, null, 2)}\n`;
  }
  if (path.extname(file) === '.html') {
    return text.replace(/<head(\s[^>]*)?>/iu,
      (match) => `${match}<meta name="artifact-generation" content="${generation}">`);
  }
  return `# artifact_generation ${generation}\n${text}`;
}

async function stableLinkState(file, basename) {
  const target = path.join('.artifact-current', basename);
  try {
    const stat = await lstat(file);
    if (!stat.isSymbolicLink() || await readlink(file) !== target) return 'unsafe';
    return 'existing';
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
    return 'missing';
  }
}

export async function readPublishedArtifacts(files, expectedGeneration = null) {
  if (!Array.isArray(files) || files.length === 0) throw new Error('published artifact list is required');
  const resolved = files.map((file) => path.resolve(file));
  const parent = path.dirname(resolved[0]);
  if (resolved.some((file) => path.dirname(file) !== parent)) {
    throw new Error('one pinned generation cannot span directories');
  }
  if (expectedGeneration !== null &&
      (typeof expectedGeneration !== 'string' ||
       !/^[a-f0-9-]{36}$/u.test(expectedGeneration))) {
    throw new Error('invalid expected artifact generation');
  }
  const generationDir = expectedGeneration
    ? path.join(parent, '.artifact-generations', expectedGeneration)
    : await realpath(path.join(parent, '.artifact-current'));
  if (path.dirname(generationDir) !== path.join(parent, '.artifact-generations')) {
    throw new Error('artifact generation pointer escaped its generation store');
  }
  const manifest = JSON.parse(await readFile(path.join(generationDir, 'generation.json'), 'utf8'));
  if (manifest.schema !== 'openclaw.k6.artifact-generation.v1' ||
      manifest.generation !== path.basename(generationDir) ||
      !Array.isArray(manifest.files)) {
    throw new Error('invalid artifact generation manifest');
  }
  const declared = new Map(manifest.files.map((entry) => [entry.name, entry.sha256]));
  const artifacts = new Map();
  for (const file of resolved) {
    const name = path.basename(file);
    const bytes = await readFile(path.join(generationDir, name));
    if (createHash('sha256').update(bytes).digest('hex') !== declared.get(name)) {
      throw new Error(`published artifact digest mismatch: ${name}`);
    }
    artifacts.set(file, bytes);
  }
  return { generation: manifest.generation, artifacts };
}

// Files are immutable inside a generation. One symlink swap publishes the set.
export async function publishArtifacts(entries, beforePublish = async () => {}) {
  if (entries.length === 0) return null;
  const resolved = entries.map(([file, body]) => [path.resolve(file), body]);
  if (resolved.length === 1) {
    const [[file, body]] = resolved;
    const pending = `${file}.${randomUUID()}.pending`;
    try {
      await writeFile(pending, body, { flag: 'wx', mode: 0o600 });
      await beforePublish();
      await rename(pending, file);
      return null;
    } catch (error) {
      await rm(pending, { force: true }).catch(() => {});
      throw error;
    }
  }
  const parent = path.dirname(resolved[0][0]);
  if (resolved.some(([file]) => path.dirname(file) !== parent)) {
    throw new Error('one publication generation cannot span directories');
  }
  const names = resolved.map(([file]) => path.basename(file));
  if (new Set(names).size !== names.length) throw new Error('duplicate artifact publication target');
  const generation = randomUUID();
  const generations = path.join(parent, '.artifact-generations');
  const pending = path.join(generations, `${generation}.pending`);
  const complete = path.join(generations, generation);
  const pointer = path.join(parent, '.artifact-current');
  const pendingPointer = path.join(parent, `.artifact-current.${generation}.pending`);
  const linkStates = await Promise.all(resolved.map(([file]) =>
    stableLinkState(file, path.basename(file))));
  if (linkStates.includes('unsafe')) {
    throw new Error('multi-artifact publication target is not a stable generation link');
  }
  const createdLinks = [];
  let published = false;
  try {
    await mkdir(generations, { recursive: true, mode: 0o700 });
    await mkdir(pending, { recursive: false, mode: 0o700 });
    const files = [];
    for (const [file, body] of resolved) {
      const bytes = bindGeneration(file, body, generation);
      await writeFile(path.join(pending, path.basename(file)), bytes, { flag: 'wx', mode: 0o600 });
      files.push({
        name: path.basename(file),
        sha256: createHash('sha256').update(bytes).digest('hex'),
      });
    }
    await writeFile(path.join(pending, 'generation.json'), `${JSON.stringify({
      schema: 'openclaw.k6.artifact-generation.v1',
      generation,
      files,
    }, null, 2)}\n`, { flag: 'wx', mode: 0o600 });
    await beforePublish();
    await rename(pending, complete);
    for (let index = 0; index < resolved.length; index += 1) {
      if (linkStates[index] !== 'missing') continue;
      const file = resolved[index][0];
      await symlink(path.join('.artifact-current', path.basename(file)), file);
      createdLinks.push(file);
    }
    await symlink(path.join('.artifact-generations', generation), pendingPointer);
    await rename(pendingPointer, pointer);
    published = true;
    return generation;
  } catch (error) {
    await rm(pendingPointer, { force: true }).catch(() => {});
    if (!published) {
      await Promise.all(createdLinks.map((file) => rm(file, { force: true }).catch(() => {})));
    }
    await rm(pending, { recursive: true, force: true }).catch(() => {});
    if (!published) await rm(complete, { recursive: true, force: true }).catch(() => {});
    throw error;
  }
}
