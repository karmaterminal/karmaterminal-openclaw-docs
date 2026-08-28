import { constants as fsConstants } from 'node:fs';
import { open } from 'node:fs/promises';

export async function readBoundedCandidateJson(file, maxBytes) {
  const handle = await open(
    file,
    fsConstants.O_RDONLY |
      fsConstants.O_NOFOLLOW |
      fsConstants.O_NONBLOCK,
  );
  try {
    const info = await handle.stat();
    if (!info.isFile() || info.size < 2 || info.size > maxBytes) {
      throw new Error(`candidate JSON is not a bounded regular file: ${file}`);
    }
    const raw = await handle.readFile();
    if (raw.length > maxBytes) {
      throw new Error(`candidate JSON exceeded its size bound: ${file}`);
    }
    return JSON.parse(raw.toString('utf8'));
  } finally {
    await handle.close();
  }
}
