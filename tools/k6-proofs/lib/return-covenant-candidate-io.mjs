import { constants as fsConstants } from 'node:fs';
import { open } from 'node:fs/promises';

const CANDIDATE_JSON_ERROR_CODES = new Map([
  ['ENOENT', 'missing'],
  ['ELOOP', 'symlink'],
  ['EACCES', 'access-denied'],
  ['EPERM', 'access-denied'],
  ['EISDIR', 'invalid-file-type'],
  ['ENOTDIR', 'path-rejected'],
  ['ENXIO', 'invalid-file-type'],
  ['ENODEV', 'invalid-file-type'],
]);
const CANDIDATE_JSON_FAILURE_CATEGORIES = new Set([
  ...CANDIDATE_JSON_ERROR_CODES.values(),
  'invalid-file-type',
  'size-bound',
  'malformed-json',
  'invalid-shape',
]);

export function childTerminationReason(child) {
  if (typeof child?.signalCode === 'string' && child.signalCode.length > 0) {
    return `signal ${child.signalCode}`;
  }
  if (Number.isInteger(child?.exitCode)) {
    return `exit ${child.exitCode}`;
  }
  return null;
}

function candidateJsonFailure(category, message) {
  const error = new Error(message);
  error.candidateJsonFailureCategory = category;
  return error;
}

export function classifyCandidateJsonFailure(error) {
  if (error instanceof SyntaxError) return 'malformed-json';
  if (
    CANDIDATE_JSON_FAILURE_CATEGORIES.has(
      error?.candidateJsonFailureCategory,
    )
  ) {
    return error.candidateJsonFailureCategory;
  }
  return CANDIDATE_JSON_ERROR_CODES.get(error?.code) ?? null;
}

export async function readBoundedCandidateJson(file, maxBytes) {
  const handle = await open(
    file,
    fsConstants.O_RDONLY |
      fsConstants.O_NOFOLLOW |
      fsConstants.O_NONBLOCK,
  );
  try {
    const info = await handle.stat();
    if (!info.isFile()) {
      throw candidateJsonFailure(
        'invalid-file-type',
        `candidate JSON is not a regular file: ${file}`,
      );
    }
    if (info.size < 2 || info.size > maxBytes) {
      throw candidateJsonFailure(
        'size-bound',
        `candidate JSON is outside its size bound: ${file}`,
      );
    }
    const raw = await handle.readFile();
    if (raw.length > maxBytes) {
      throw candidateJsonFailure(
        'size-bound',
        `candidate JSON exceeded its size bound: ${file}`,
      );
    }
    return JSON.parse(raw.toString('utf8'));
  } finally {
    await handle.close();
  }
}
