// The Tempo search window collect-continuation-trace.mjs uses for one row run.
// review-debt routing (lib/trace-debt-route.mjs) names the same window, so a
// reviewer repeats the search the collector made rather than a narrower one.

export const CORRELATION_WINDOW_PADDING_SECONDS = 60;

/**
 * `{ start, end, source }`: epoch seconds from the dispatch (or start) time to
 * the later of dispatch and the row's end, padded on both sides, and whether
 * the row's end took part (the collector receipt's searchWindow.source). Null
 * when the evidence carries no usable dispatch or start time.
 */
export function traceCorrelationWindow(evidence) {
  const dispatchMs = Number(evidence?.dispatch_accepted_at_ms || Date.parse(evidence?.started));
  if (!Number.isFinite(dispatchMs)) return null;
  const dispatchSeconds = Math.floor(dispatchMs / 1000);
  const endMs = Date.parse(evidence?.ended);
  const endSeconds = Number.isFinite(endMs) ? Math.floor(endMs / 1000) : dispatchSeconds;
  return {
    start: dispatchSeconds - CORRELATION_WINDOW_PADDING_SECONDS,
    end: Math.max(dispatchSeconds, endSeconds) + CORRELATION_WINDOW_PADDING_SECONDS,
    source: Number.isFinite(endMs) ? 'dispatch-and-evidence-ended' : 'dispatch-only',
  };
}

export function isoSeconds(epochSeconds) {
  return new Date(epochSeconds * 1000).toISOString().replace(/\.000Z$/u, 'Z');
}
