import { rename, rm, writeFile } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';

// Stage beside each destination; no public partial or stale packet survives a failure.
export async function publishArtifacts(entries, beforePublish = async () => {}) {
  const staged = entries.map(([file, body]) => [file, `${file}.${randomUUID()}.pending`, body]);
  try {
    for (const [, pending, body] of staged) await writeFile(pending, body, { flag: 'wx', mode: 0o600 });
    await beforePublish();
    for (const [file, pending] of staged) await rename(pending, file);
  } catch (error) {
    await Promise.all(staged.flatMap(([file, pending]) =>
      [rm(file, { force: true }).catch(() => {}), rm(pending, { force: true }).catch(() => {})]));
    throw error;
  }
}
