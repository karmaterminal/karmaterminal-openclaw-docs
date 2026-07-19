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
  const bodyMarkerOffset = signatureEndMarker.lastIndexOf('{');
  if (bodyMarkerOffset < 0) {
    throw new Error(`${functionName} body start marker was not found`);
  }

  // Parse only the selected declaration header. Searching arbitrary source
  // text for the expected signature can accidentally accept a marker from a
  // later export, string, or comment in the function body. First find the
  // declaration's parameter list and its real body-opening brace lexically,
  // then require the complete expected marker to end at that exact brace.
  const parametersOpen = source.indexOf('(', declarationStart + declarationMatch[0].length - 1);
  const parametersClose = findMatchingDelimiter(source, parametersOpen, '(', ')');
  if (parametersClose < 0) {
    throw new Error(`${functionName} parameter list was not closed`);
  }
  const bodyOpen = findNextCodeCharacter(source, parametersClose + 1, '{');
  if (bodyOpen < 0) {
    throw new Error(`${functionName} body start was not found`);
  }
  const signatureStart = bodyOpen - bodyMarkerOffset;
  if (
    signatureStart < declarationStart ||
    source.slice(signatureStart, bodyOpen + 1) !== signatureEndMarker
  ) {
    throw new Error(`${functionName} signature marker was not found`);
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

function findMatchingDelimiter(source, openIndex, openCharacter, closeCharacter) {
  if (openIndex < 0 || source[openIndex] !== openCharacter) return -1;
  let depth = 1;
  let mode = 'code';
  let escaped = false;

  for (let index = openIndex + 1; index < source.length; index += 1) {
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
      if (escaped) escaped = false;
      else if (char === '\\') escaped = true;
      else if (char === mode) mode = 'code';
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
    if (char === openCharacter) depth += 1;
    else if (char === closeCharacter) {
      depth -= 1;
      if (depth === 0) return index;
    }
  }
  return -1;
}

function findNextCodeCharacter(source, startIndex, expectedCharacter) {
  let mode = 'code';
  let escaped = false;
  for (let index = startIndex; index < source.length; index += 1) {
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
      if (escaped) escaped = false;
      else if (char === '\\') escaped = true;
      else if (char === mode) mode = 'code';
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
    if (char === expectedCharacter) return index;
  }
  return -1;
}
