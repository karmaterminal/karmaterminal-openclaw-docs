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
  const declarationMarker = `export function ${functionName}`;
  const declarationStart = source.indexOf(declarationMarker);
  if (declarationStart < 0) {
    throw new Error(`${functionName} export was not found`);
  }

  const signatureEnd = source.indexOf(signatureEndMarker, declarationStart);
  if (signatureEnd < 0) {
    throw new Error(`${functionName} signature marker was not found`);
  }
  const bodyOpen = signatureEnd + signatureEndMarker.lastIndexOf('{');
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
