/**
 * Declared row verdict caps (🌊's ruling on docs#616: review 5720773113 and his
 * issue comment, Discord 1565925290008387728, 2026-10-31; openclaw-bootstrap#1727).
 *
 * A row verdict is the minimum of the fixture's or harness's verdict, the cap the
 * row manifest declares, and the preflight cap (lib/required-preflight.mjs). The
 * cap is read only from the manifest's `verdictCap` declaration, never inferred
 * from prose. R-CW-5 and R-CW-6 declare `rowCap: "PARTIAL-candidate"` because
 * their only producer is a process-local fixture, not an external gateway
 * invocation: their fixtures may report a behavioral PASS-candidate, and a passing
 * R-CW-5A/6A preflight is necessary, not sufficient, but neither lifts the row
 * above PARTIAL-candidate. Lifting a cap needs a superseding authority receipt
 * from a different artifact class, adopted by an explicit method change; no such
 * authority is adopted, so `supersedingAuthorities` must be empty.
 *
 * The grader (grade-preflight-gated-row.mjs), the catalog check
 * (check-proof-row-manifests.mjs) and the corpus validator (validate-corpus.mjs)
 * share this one copy of the rules. Plain ESM with no Node or k6 imports.
 */

/** The only cap a row manifest may declare. */
export const ROW_VERDICT_CAP = 'PARTIAL-candidate';
/** The artifact class every process-local row's cap names. */
export const PROCESS_LOCAL_ARTIFACT_CLASS = 'process-local-fixture';
export const ROW_CAP_NOTE =
  'a passing preflight is necessary, not sufficient; lifting a declared cap needs a superseding authority ' +
  'receipt from a different artifact class, adopted by an explicit method change';

// The candidate verdicts a cap compares. Every other verdict (FAIL-fixture,
// HONEST-LIMIT-candidate, construct-only, anything unknown) is not above a cap
// and passes through unchanged, so a cap never raises a verdict.
const CANDIDATE_RANK = { 'FAIL-candidate': 0, 'PARTIAL-candidate': 1, 'PASS-candidate': 2 };
// The corpus row states at or below each declarable cap, and those above it. A
// state in neither list (a typo, `passed`, `PASS-candidate`) is not shown to lie
// within the cap, so it is refused too.
const STATES_WITHIN_CAP = { 'PARTIAL-candidate': ['partial', 'thin', 'fail', 'honest_limit', 'missing'] };
const STATES_ABOVE_CAP = { 'PARTIAL-candidate': ['pass'] };

function isObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function supportedCap(cap) {
  if (cap !== ROW_VERDICT_CAP) throw new Error(`unsupported verdict cap ${JSON.stringify(cap)}; the only declarable cap is ${ROW_VERDICT_CAP}`);
  return cap;
}

/**
 * Lower `verdict` to `cap` when it ranks above it; return any other verdict
 * unchanged. Returns `{ verdict, capped }`. Throws on a cap it does not know.
 */
export function capVerdict(verdict, cap) {
  supportedCap(cap);
  const rank = Object.prototype.hasOwnProperty.call(CANDIDATE_RANK, verdict) ? CANDIDATE_RANK[verdict] : null;
  if (rank !== null && rank > CANDIDATE_RANK[cap]) return { verdict: cap, capped: true };
  return { verdict, capped: false };
}

/** The corpus state as the cap compares it: trimmed and lower-cased. */
export function canonicalCorpusState(state) {
  return typeof state === 'string' ? state.trim().toLowerCase() : '';
}

/** Whether a corpus row state (`pass`, `partial`, …) is a known state above `cap`. */
export function corpusStateAboveCap(state, cap) {
  return STATES_ABOVE_CAP[supportedCap(cap)].includes(canonicalCorpusState(state));
}

/** Whether a corpus row state is a known state at or below `cap`; anything else is not. */
export function corpusStateWithinCap(state, cap) {
  return STATES_WITHIN_CAP[supportedCap(cap)].includes(canonicalCorpusState(state));
}

/**
 * Problems with one manifest's cap declaration, without a file prefix. A
 * process-local row must declare one; a row that declares one must declare it
 * whole, and its expected artifact class may not lie above it.
 */
export function manifestVerdictCapFailures(manifest) {
  const failures = [];
  const rowId = manifest?.rowId;
  const processLocal = manifest?.transport === 'process-local';
  if (!Object.prototype.hasOwnProperty.call(manifest || {}, 'verdictCap') || manifest.verdictCap === undefined) {
    if (processLocal) failures.push(`${rowId} is process-local, so it must declare verdictCap (rowCap ${ROW_VERDICT_CAP})`);
    return failures;
  }
  const cap = manifest.verdictCap;
  if (!isObject(cap)) return [`verdictCap must be an object`];
  if (cap.rowCap !== ROW_VERDICT_CAP) failures.push(`verdictCap.rowCap must be "${ROW_VERDICT_CAP}", not ${JSON.stringify(cap.rowCap)}`);
  if (typeof cap.artifactClass !== 'string' || !cap.artifactClass) {
    failures.push('verdictCap.artifactClass must name the artifact class the cap belongs to');
  } else if (processLocal && cap.artifactClass !== PROCESS_LOCAL_ARTIFACT_CLASS) {
    failures.push(`verdictCap.artifactClass must be "${PROCESS_LOCAL_ARTIFACT_CLASS}" for a process-local row, not ${JSON.stringify(cap.artifactClass)}`);
  }
  if (!Array.isArray(cap.supersedingAuthorities) || cap.supersedingAuthorities.length !== 0) {
    failures.push(
      'verdictCap.supersedingAuthorities must be empty ([]): no superseding authority is adopted, and adopting one is a ' +
        'method change that must also teach validate-corpus.mjs and grade-preflight-gated-row.mjs to judge its receipt',
    );
  }
  if (typeof cap.ruling !== 'string' || !cap.ruling) failures.push('verdictCap.ruling must name the ruling');
  const expected = manifest.liveRunSafety?.expectedArtifactClass;
  if (cap.rowCap === ROW_VERDICT_CAP && capVerdict(expected, cap.rowCap).capped) {
    failures.push(`liveRunSafety.expectedArtifactClass ${expected} is above verdictCap.rowCap ${cap.rowCap}`);
  }
  return failures;
}

/**
 * The cap a manifest declares, `{ verdict, artifactClass }`, or null when it
 * declares none. Callers check manifestVerdictCapFailures first.
 */
export function declaredRowCap(manifest) {
  const cap = manifest?.verdictCap;
  if (!isObject(cap)) return null;
  return { verdict: cap.rowCap, artifactClass: cap.artifactClass };
}

/** Catalog rule over `[{ file, manifest }]`: failure strings, `<file>: <problem>`. */
export function catalogVerdictCapFailures(entries) {
  return entries.flatMap(({ file, manifest }) => manifestVerdictCapFailures(manifest).map((failure) => `${file}: ${failure}`));
}

/**
 * Index the catalog's declared caps by row id: `{ rowCap, artifactClass,
 * supersedingAuthorities, file }`. Only well-formed declarations are indexed;
 * catalogVerdictCapFailures reports the rest.
 */
export function verdictCapCatalog(entries) {
  const capsByRow = new Map();
  for (const { file, manifest } of entries) {
    if (typeof manifest?.rowId !== 'string' || manifestVerdictCapFailures(manifest).length) continue;
    const cap = manifest.verdictCap;
    if (!isObject(cap)) continue;
    capsByRow.set(manifest.rowId, {
      rowCap: cap.rowCap,
      artifactClass: cap.artifactClass,
      supersedingAuthorities: cap.supersedingAuthorities,
      file,
    });
  }
  return capsByRow;
}
