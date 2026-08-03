/**
 * Decode-aware extraction of proof evidence blocks from k6 output.
 *
 * k6 does not print `console.log` output verbatim. Every call is emitted as one
 * logrus record:
 *
 *   time="2026-07-30T20:15:52Z" level=info msg="=== K6-PROOF-EVIDENCE ===" source=console
 *   time="2026-07-30T20:15:52Z" level=info msg="{\n  \"row\": \"R-CD-IN-1\",\n ...}" source=console
 *   time="2026-07-30T20:15:52Z" level=info msg="--- END EVIDENCE ---" source=console
 *
 * so the whole evidence JSON lives inside a single JSON-escaped `msg=` value on
 * one physical line. Any consumer that applies a block regex to the raw file
 * finds zero records and silently degrades — the failure mode the #493 runtime
 * review reproduced in both `sanitize-k6-artifacts.mjs` and `evidence-writer.mjs`.
 *
 * This module is the single decode-aware extractor for every consumer. It also
 * accepts bare (already-decoded) marker lines so unit fixtures and locally
 * captured logs keep working, and it reports whether an evidence marker was seen
 * at all so callers can fail closed instead of attesting "0 evidence blocks".
 */

/**
 * Decode one k6 output line into the message the scenario actually printed.
 * Lines that are not logrus-framed are returned unchanged; a framed line whose
 * `msg=` value does not decode returns null (it cannot be trusted).
 */
export function decodeK6Message(line) {
  const marker = ' msg=';
  const start = line.indexOf(marker);
  if (start < 0) return line;
  const encodedStart = start + marker.length;
  const source = line.lastIndexOf(' source=');
  const encoded = line.slice(encodedStart, source > encodedStart ? source : undefined).trim();
  if (!encoded) return null;
  if (!encoded.startsWith('"')) return encoded;
  try {
    return JSON.parse(encoded);
  } catch {
    return null;
  }
}

export function parseJsonCandidate(value) {
  const text = String(value || '').trim();
  if (!text.startsWith('{')) return null;
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

const EVIDENCE_MARKER = /\bEVIDENCE SUMMARY\b|===\s*K6-PROOF-EVIDENCE\s*===/;
const EVIDENCE_END_MARKER = /---\s*END EVIDENCE\s*---|===\s*END K6-PROOF-EVIDENCE\s*===/;
const INLINE_EVIDENCE = /(?:[A-Z0-9_-]+_EVIDENCE|===\s*K6-PROOF-EVIDENCE\s*===)\s+(\{[\s\S]*\})$/;

/**
 * Extract every evidence record from a k6 log.
 *
 * Handles, in one pass:
 *   - logrus-framed blocks (production k6 stdout);
 *   - bare marker + single-line JSON (unit fixtures);
 *   - bare marker + pretty-printed multi-line JSON (locally captured logs);
 *   - inline `<ROW>_EVIDENCE { ... }` single-message form.
 *
 * @returns {{records: object[], lines: string[], markerSeen: boolean, markerCount: number}}
 */
export function extractEvidenceData(logText) {
  const records = [];
  const lines = [];
  let markerCount = 0;
  let awaitingRecord = false;
  let buffer = [];
  let bufferLines = [];

  const flushBuffer = () => {
    awaitingRecord = false;
    buffer = [];
    bufferLines = [];
  };

  for (const line of String(logText || '').split(/\r?\n/)) {
    const message = decodeK6Message(line);
    if (message === null || message === undefined) continue;
    const text = String(message).trim();

    const inline = text.match(INLINE_EVIDENCE);
    if (inline) {
      markerCount += 1;
      const record = parseJsonCandidate(inline[1]);
      if (record) {
        records.push(record);
        lines.push(line);
      }
      flushBuffer();
      continue;
    }

    if (EVIDENCE_MARKER.test(text)) {
      markerCount += 1;
      lines.push(line);
      flushBuffer();
      // The banner and the JSON can share one console.log call.
      const sameMessageJson = text.match(/(?:SUMMARY\b[^\n]*|===)\s*[\r\n]+(\{[\s\S]*\})/);
      const record = sameMessageJson ? parseJsonCandidate(sameMessageJson[1]) : null;
      if (record) {
        records.push(record);
      } else {
        awaitingRecord = true;
      }
      continue;
    }

    if (EVIDENCE_END_MARKER.test(text)) {
      // Last chance for a multi-line bare block that has not parsed yet.
      if (awaitingRecord && buffer.length > 0) {
        const record = parseJsonCandidate(buffer.join('\n'));
        if (record) {
          records.push(record);
          lines.push(...bufferLines);
        }
      }
      flushBuffer();
      continue;
    }

    if (!awaitingRecord) continue;

    // Only start buffering at a real JSON opening; interleaved k6 progress
    // output between the banner and the payload must not poison the parse.
    if (buffer.length === 0 && !text.startsWith('{')) continue;
    buffer.push(text);
    bufferLines.push(line);
    const record = parseJsonCandidate(buffer.join('\n'));
    if (record) {
      records.push(record);
      lines.push(...bufferLines);
      flushBuffer();
    }
  }

  const uniqueRecords = [...new Map(
    records.map((record) => [JSON.stringify(record), record]),
  ).values()];

  return {
    records: uniqueRecords,
    lines,
    markerSeen: markerCount > 0,
    markerCount,
  };
}
