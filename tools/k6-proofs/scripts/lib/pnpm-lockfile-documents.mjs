/**
 * pnpm lockfile documents, split the way pnpm splits them.
 *
 * A committed pnpm-lock.yaml may open with an env document that pins the
 * package manager itself (`packageManagerDependencies`) and any config
 * dependencies. pnpm 12 writes one whenever `packageManager` pins it. The file
 * is then `---\n<env>\n---\n<lockfile>`, and pnpm installs from, and writes to
 * node_modules/.pnpm/lock.yaml, only the lockfile document. The markers are
 * pnpm's own (`YAML_DOCUMENT_START` and `YAML_DOCUMENT_SEPARATOR` in
 * lockfile/fs). Splitting works on the committed bytes, so a fixture keeps
 * requiring byte equality with the document pnpm installed, never a normalized
 * or re-serialized copy.
 */
const DOCUMENT_START = Buffer.from('---\n');
const DOCUMENT_SEPARATOR = Buffer.from('\n---\n');

export const SINGLE_DOCUMENT = 'single-document';
export const ENV_AND_LOCKFILE_DOCUMENTS = 'env-and-lockfile-documents';

function startsWithDocumentStart(bytes) {
  return bytes.subarray(0, DOCUMENT_START.length).equals(DOCUMENT_START);
}

export function splitPnpmLockfile(bytes) {
  if (!startsWithDocumentStart(bytes)) {
    return { layout: SINGLE_DOCUMENT, envDocument: null, lockfileDocument: bytes };
  }
  const separator = bytes.indexOf(DOCUMENT_SEPARATOR, DOCUMENT_START.length);
  if (separator === -1) {
    throw new Error('candidate pnpm-lock.yaml opens a YAML document but has no lockfile document after it');
  }
  const lockfileDocument = bytes.subarray(separator + DOCUMENT_SEPARATOR.length);
  if (startsWithDocumentStart(lockfileDocument) || lockfileDocument.includes(DOCUMENT_SEPARATOR)) {
    throw new Error('candidate pnpm-lock.yaml has more than two YAML documents');
  }
  return {
    layout: ENV_AND_LOCKFILE_DOCUMENTS,
    envDocument: bytes.subarray(DOCUMENT_START.length, separator),
    lockfileDocument,
  };
}

// pnpm dumps the env document with js-yaml in one small shape: nested block
// mappings, plain or single-quoted keys and scalars, and one-line flow mappings
// and sequences of scalars. This reader accepts that shape and refuses any
// other YAML rather than guess at it. Scalars stay strings.
const PLAIN_KEY = String.raw`[^\s'"#&*!|>%@\x60{}[\],?:-][^:]*?`;
const QUOTED = String.raw`'((?:[^']|'')*)'`;
const BLOCK_LINE = new RegExp(String.raw`^( *)(?:${QUOTED}|(${PLAIN_KEY})):(?: (.*))?$`, 'u');
const FLOW_ENTRY = new RegExp(String.raw`^(?:${QUOTED}|(${PLAIN_KEY})): (.+)$`, 'u');
const PLAIN_SCALAR = /^[^\s'"#&*!|>%@`{}[\],?:-](?:[^#{}[\],]*[^\s#{}[\],])?$/u;

function unsupported(lineNumber) {
  return new Error(`candidate pnpm-lock.yaml env document has unsupported YAML at line ${lineNumber}`);
}

function setKey(mapping, key, value, lineNumber) {
  if (key === '__proto__') throw unsupported(lineNumber);
  if (Object.hasOwn(mapping, key)) {
    throw new Error(`candidate pnpm-lock.yaml env document repeats key ${key} at line ${lineNumber}`);
  }
  mapping[key] = value;
}

function parseScalar(raw, lineNumber) {
  const quoted = new RegExp(`^${QUOTED}$`, 'u').exec(raw);
  if (quoted) return quoted[1].replaceAll("''", "'");
  if (PLAIN_SCALAR.test(raw) && !raw.includes(': ')) return raw;
  throw unsupported(lineNumber);
}

function parseValue(raw, lineNumber) {
  if (raw.startsWith('{') && raw.endsWith('}')) {
    const mapping = {};
    const body = raw.slice(1, -1);
    if (body === '') return mapping;
    for (const part of body.split(', ')) {
      const entry = FLOW_ENTRY.exec(part);
      if (!entry) throw unsupported(lineNumber);
      setKey(mapping, entry[1] !== undefined ? entry[1].replaceAll("''", "'") : entry[2], parseScalar(entry[3], lineNumber), lineNumber);
    }
    return mapping;
  }
  if (raw.startsWith('[') && raw.endsWith(']')) {
    const body = raw.slice(1, -1);
    return body === '' ? [] : body.split(', ').map((item) => parseScalar(item, lineNumber));
  }
  return parseScalar(raw, lineNumber);
}

export function parsePnpmEnvDocument(text) {
  const root = {};
  const stack = [{ indent: -1, mapping: root, childIndent: null }];
  for (const [index, line] of text.split('\n').entries()) {
    const lineNumber = index + 1;
    if (line.trim() === '') continue;
    const match = BLOCK_LINE.exec(line);
    if (!match) throw unsupported(lineNumber);
    const indent = match[1].length;
    while (stack.at(-1).indent >= indent) stack.pop();
    const parent = stack.at(-1);
    if (parent.childIndent === null) parent.childIndent = indent;
    if (parent.childIndent !== indent) {
      throw new Error(`candidate pnpm-lock.yaml env document has inconsistent indentation at line ${lineNumber}`);
    }
    const key = match[2] !== undefined ? match[2].replaceAll("''", "'") : match[3];
    if (match[4] === undefined) {
      const mapping = {};
      setKey(parent.mapping, key, mapping, lineNumber);
      stack.push({ indent, mapping, childIndent: null });
    } else {
      setKey(parent.mapping, key, parseValue(match[4], lineNumber), lineNumber);
    }
  }
  return root;
}

function isMapping(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

// pnpm treats its own pin as resolved only when every package-manager
// dependency the env document lists is at the running pnpm version. A fixture
// holds the candidate to the same rule against the pnpm it resolved, and reads
// the registry integrity each env-document package records.
export function readPnpmEnvDocumentPins(envDocument, resolvedPnpmVersion) {
  const env = parsePnpmEnvDocument(envDocument.toString('utf8'));
  const dependencies = isMapping(env.importers) && isMapping(env.importers['.'])
    ? env.importers['.'].packageManagerDependencies
    : undefined;
  if (!isMapping(dependencies) || !isMapping(dependencies.pnpm)) {
    throw new Error('candidate pnpm-lock.yaml env document does not pin pnpm in packageManagerDependencies');
  }
  const packageManagerDependencies = {};
  for (const [name, dependency] of Object.entries(dependencies)) {
    const version = isMapping(dependency) ? dependency.version : undefined;
    if (version !== resolvedPnpmVersion) {
      throw new Error(
        `candidate pnpm-lock.yaml env document pins ${name} ${version ?? '<missing>'}, not the resolved pnpm ${resolvedPnpmVersion}`,
      );
    }
    packageManagerDependencies[name] = version;
  }
  const packageIntegrities = {};
  for (const [packageId, entry] of Object.entries(isMapping(env.packages) ? env.packages : {})) {
    const integrity = isMapping(entry) && isMapping(entry.resolution) ? entry.resolution.integrity : undefined;
    if (typeof integrity === 'string') packageIntegrities[packageId] = integrity;
  }
  return { packageManagerDependencies, packageIntegrities };
}
