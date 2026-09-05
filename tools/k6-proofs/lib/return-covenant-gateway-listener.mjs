import {
  childTerminationReason,
} from './return-covenant-candidate-io.mjs';
import {
  inspectProcessLoopbackListeners,
} from './return-covenant-driver-attestation.mjs';

const RETRYABLE_LISTENER_ERRORS = new Set([
  'EACCES',
  'ENOENT',
  'ESRCH',
]);

function delay(milliseconds) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

async function throwIfChildExited(child, stdout, stderr) {
  const termination = childTerminationReason(child);
  if (!termination) return;
  await new Promise((resolve) => setImmediate(resolve));
  throw new Error(
    `tracked gateway exited before listening (${termination}); ` +
      `stdout=${stdout()}; stderr=${stderr()}`,
  );
}

export async function waitForTrackedGatewayListeners({
  child,
  inspect = inspectProcessLoopbackListeners,
  stdout = () => '',
  stderr = () => '',
  timeoutMs = 90_000,
  retryDelayMs = 25,
}) {
  if (
    !child ||
    !Number.isInteger(child.pid) ||
    child.pid < 2 ||
    !Number.isInteger(timeoutMs) ||
    timeoutMs < 1 ||
    !Number.isInteger(retryDelayMs) ||
    retryDelayMs < 1
  ) {
    throw new Error('tracked gateway listener wait parameters are invalid');
  }
  const deadline = Date.now() + timeoutMs;
  let lastRetryableError = null;
  while (Date.now() < deadline) {
    await throwIfChildExited(child, stdout, stderr);
    try {
      const listeners = await inspect(child.pid);
      if (listeners.length > 0) return listeners;
      lastRetryableError = null;
    } catch (error) {
      if (!RETRYABLE_LISTENER_ERRORS.has(error?.code)) throw error;
      lastRetryableError = error;
      await throwIfChildExited(child, stdout, stderr);
    }
    await delay(retryDelayMs);
  }
  await throwIfChildExited(child, stdout, stderr);
  if (lastRetryableError?.code === 'EACCES') {
    throw new Error(
      'tracked gateway remained inaccessible through bounded listener ' +
        `inspection (EACCES); stdout=${stdout()}; stderr=${stderr()}`,
    );
  }
  const observerCode = lastRetryableError?.code
    ? `; last observer error=${lastRetryableError.code}`
    : '';
  throw new Error(
    `tracked gateway did not listen${observerCode}; ` +
      `stdout=${stdout()}; stderr=${stderr()}`,
  );
}
