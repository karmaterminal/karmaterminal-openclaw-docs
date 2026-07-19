/**
 * Extract the body of a named exported function from exact candidate source.
 *
 * The proof harness executes candidate-owned dependency-free functions without
 * compiling the whole repository. A declaration-following text marker is too
 * brittle for this: moving a function into its own module changes the next
 * declaration without changing the function contract. Balance the function's
 * braces instead, while ignoring brace-like characters in strings/comments.
 */
export function extractExportedFunctionBody(source, functionName, signatureEndMarker) {
  const escapedFunctionName = functionName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const declarationPattern = new RegExp(
    `^export\\s+function\\s+${escapedFunctionName}(?=\\s*\\()`,
    'gm',
  );
  const declarationMatch = declarationPattern.exec(source);
  if (!declarationMatch) {
    throw new Error(`${functionName} export was not found`);
  }
  const declarationStart = declarationMatch.index;

  // Keep signature matching inside the selected top-level declaration. If the
  // target signature drifts, a compatible marker on a later export must not
  // cause the harness to execute that later function's body.
  const nextDeclarationPattern =
    /^(?:export\s+)?(?:declare\s+)?(?:async\s+)?(?:function|class|const|let|var|interface|type|enum|namespace)\b/gm;
  nextDeclarationPattern.lastIndex = declarationStart + declarationMatch[0].length;
  const nextDeclarationMatch = nextDeclarationPattern.exec(source);
  const declarationEnd = nextDeclarationMatch ? nextDeclarationMatch.index : source.length;

  const signatureEnd = source.indexOf(signatureEndMarker, declarationStart);
  if (signatureEnd < 0 || signatureEnd >= declarationEnd) {
    throw new Error(`${functionName} signature marker was not found`);
  }
  const bodyMarkerOffset = signatureEndMarker.lastIndexOf('{');
  if (bodyMarkerOffset < 0) {
    throw new Error(`${functionName} body start marker was not found`);
  }
  const bodyOpen = signatureEnd + bodyMarkerOffset;
  if (source[bodyOpen] !== '{') {
    throw new Error(`${functionName} body start was not found`);
  }

  let depth = 1;
  let mode = 'code';
  let escaped = false;

  for (let index = bodyOpen + 1; index < source.length; index += 1) {
    const char = source[index];
    const next = source[index + 1];

    if (mode === 'line-comment') {
      if (char === '\n') mode = 'code';
      continue;
    }
    if (mode === 'block-comment') {
      if (char === '*' && next === '/') {
        mode = 'code';
        index += 1;
      }
      continue;
    }
    if (mode !== 'code') {
      if (escaped) {
        escaped = false;
      } else if (char === '\\') {
        escaped = true;
      } else if (char === mode) {
        mode = 'code';
      }
      continue;
    }

    if (char === '/' && next === '/') {
      mode = 'line-comment';
      index += 1;
      continue;
    }
    if (char === '/' && next === '*') {
      mode = 'block-comment';
      index += 1;
      continue;
    }
    if (char === "'" || char === '"' || char === '`') {
      mode = char;
      escaped = false;
      continue;
    }
    if (char === '{') {
      depth += 1;
      continue;
    }
    if (char === '}') {
      depth -= 1;
      if (depth === 0) return source.slice(bodyOpen + 1, index);
    }
  }

  throw new Error(`${functionName} closing brace was not found`);
}
