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
 * Whether a row is process-local is read from its transport and from the
 * artifact class its runner declares in `invocation.artifactClass`, never from
 * the key that names the runner (docs#615). R-CD-RETURN-COVENANT-AUTHORITY's
 * restart control restarts a real disposable gateway process, so it declares
 * `disposable-real-process` and is not capped; a runner with no declared class
 * is read as a process-local fixture.
 *
 * The grader (grade-preflight-gated-row.mjs), the catalog check
 * (check-proof-row-manifests.mjs) and the corpus validator (validate-corpus.mjs)
 * share this one copy of the rules. Plain ESM with no Node or k6 imports.
 */
import { canonicalRowId } from './required-preflight.mjs';

/** The only cap a row manifest may declare. */
export const ROW_VERDICT_CAP = 'PARTIAL-candidate';
/** The artifact class every process-local row's cap names. */
export const PROCESS_LOCAL_ARTIFACT_CLASS = 'process-local-fixture';
/**
 * A runner that starts, restarts and stops a real gateway process it set up for
 * the run, never the live one: R-CD-RETURN-COVENANT-AUTHORITY's restart control
 * (docs#615). It is not process-local, so the ruling does not cap it.
 */
export const DISPOSABLE_REAL_PROCESS_ARTIFACT_CLASS = 'disposable-real-process';
/**
 * The classes `invocation.artifactClass` may declare. A runner's class is read
 * from that declaration, never inferred from the key that names the runner.
 */
export const INVOCATION_ARTIFACT_CLASSES = [PROCESS_LOCAL_ARTIFACT_CLASS, DISPOSABLE_REAL_PROCESS_ARTIFACT_CLASS];
/**
 * The rows the ruling caps by name. Their manifests must declare the cap however
 * they are otherwise edited, so dropping the process-local markers cannot un-cap
 * them; lifting it is a method change to this list as well.
 */
export const RULED_CAPPED_ROWS = ['R-CW-5', 'R-CW-6'];
/** The transports a row manifest may name; anything else cannot be judged. */
export const KNOWN_TRANSPORTS = ['websocket', 'http-tools-invoke', 'offline', 'process-local', 'github-source-contract'];
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

/** A transport as the cap compares it: trimmed, lower-cased, `_` and spaces as `-`. */
export function canonicalTransport(transport) {
  return typeof transport === 'string' ? transport.trim().toLowerCase().replace(/[\s_]+/g, '-') : null;
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
 * The artifact class of the runner a manifest's invocation names, read from
 * `invocation.artifactClass`: `{ processLocal, declared, capRequired, failures }`.
 * A runner is named under `invocation.fixture` (a process-local fixture) or
 * `invocation.control`. A runner named with no class is read as a process-local
 * fixture, so a missing class fails closed exactly as #616 reads
 * `invocation.fixture`; `capRequired` says why such a row must declare a cap. A
 * class this rule does not know is refused. `disposable-real-process` is the
 * only class that is not process-local, and only when nothing else about the
 * row is: its runner is `invocation.control`, it names no `invocation.fixture`,
 * its transport is declared and not process-local, and the ruling does not cap
 * it by id. Any contradiction is refused and read as process-local.
 */
function runnerArtifactClass(manifest, processLocalTransport) {
  const rowId = manifest?.rowId;
  const invocation = isObject(manifest?.invocation) ? manifest.invocation : {};
  const names = (key) => typeof invocation[key] === 'string' && invocation[key] !== '';
  const fixture = names('fixture');
  const control = names('control');
  const mustDeclare = `must declare verdictCap (rowCap ${ROW_VERDICT_CAP})`;
  if (!Object.prototype.hasOwnProperty.call(invocation, 'artifactClass')) {
    const capRequired = [];
    if (fixture) capRequired.push(`${rowId} names a process-local fixture (invocation.fixture), so it ${mustDeclare}`);
    if (control) {
      capRequired.push(`${rowId} names a runner (invocation.control) without invocation.artifactClass, so it is read as a process-local fixture and ${mustDeclare}`);
    }
    return { processLocal: capRequired.length > 0, declared: null, capRequired, failures: [] };
  }
  const declared = invocation.artifactClass;
  if (!INVOCATION_ARTIFACT_CLASSES.includes(declared)) {
    return {
      processLocal: true,
      declared: null,
      capRequired: [],
      failures: [
        `invocation.artifactClass ${JSON.stringify(declared)} is not a known artifact class (${INVOCATION_ARTIFACT_CLASSES.join(', ')}), ` +
          `so whether ${rowId} is process-local cannot be decided`,
      ],
    };
  }
  if (declared === PROCESS_LOCAL_ARTIFACT_CLASS) {
    return { processLocal: true, declared, capRequired: [`${rowId} declares invocation.artifactClass "${declared}", so it ${mustDeclare}`], failures: [] };
  }
  const claim = `${rowId} declares invocation.artifactClass "${declared}"`;
  const failures = [];
  if (processLocalTransport) failures.push(`${claim}, but its transport ${JSON.stringify(manifest.transport)} is process-local`);
  if (manifest?.transport === undefined) failures.push(`${claim} but declares no transport, so whether it is process-local cannot be decided`);
  if (fixture) failures.push(`${claim} but names a process-local fixture (invocation.fixture); a disposable real process's runner is invocation.control`);
  if (!control) failures.push(`${claim} without naming its runner in invocation.control`);
  if (RULED_CAPPED_ROWS.includes(canonicalRowId(rowId))) {
    failures.push(`${rowId} is capped by 🌊's ruling on docs#616 as a process-local fixture, so it cannot declare invocation.artifactClass "${declared}"`);
  }
  return { processLocal: failures.length > 0, declared, capRequired: [], failures };
}

/**
 * Problems with one manifest's cap declaration, without a file prefix. A row
 * whose transport is process-local (however spelled), whose runner is a
 * process-local fixture (runnerArtifactClass: `invocation.fixture` or a runner
 * with no declared class) or that the ruling names (RULED_CAPPED_ROWS) must
 * declare one, and a declared transport or runner class this rule does not know
 * is refused rather than read as "not process-local" (a missing transport is
 * the schema's to require; the grader refuses it). A row that declares a cap
 * must declare it whole, for the class its runner declares, and its expected
 * artifact class may not lie above it.
 */
export function manifestVerdictCapFailures(manifest) {
  const failures = [];
  const rowId = manifest?.rowId;
  const transport = canonicalTransport(manifest?.transport);
  if (manifest?.transport !== undefined && !KNOWN_TRANSPORTS.includes(transport)) {
    failures.push(
      `transport ${JSON.stringify(manifest?.transport)} is not a known transport (${KNOWN_TRANSPORTS.join(', ')}), ` +
        `so whether ${rowId} is process-local cannot be decided`,
    );
  }
  const processLocal = transport === 'process-local';
  const runner = runnerArtifactClass(manifest, processLocal);
  failures.push(...runner.failures);
  if (!Object.prototype.hasOwnProperty.call(manifest || {}, 'verdictCap') || manifest.verdictCap === undefined) {
    if (processLocal) failures.push(`${rowId} is process-local, so it must declare verdictCap (rowCap ${ROW_VERDICT_CAP})`);
    failures.push(...runner.capRequired);
    if (RULED_CAPPED_ROWS.includes(canonicalRowId(rowId))) {
      failures.push(`${rowId} is capped by 🌊's ruling on docs#616, so it must declare verdictCap (rowCap ${ROW_VERDICT_CAP})`);
    }
    return failures;
  }
  const cap = manifest.verdictCap;
  if (!isObject(cap)) return [...failures, 'verdictCap must be an object'];
  if (cap.rowCap !== ROW_VERDICT_CAP) failures.push(`verdictCap.rowCap must be "${ROW_VERDICT_CAP}", not ${JSON.stringify(cap.rowCap)}`);
  if (typeof cap.artifactClass !== 'string' || !cap.artifactClass) {
    failures.push('verdictCap.artifactClass must name the artifact class the cap belongs to');
  } else if ((processLocal || runner.processLocal) && cap.artifactClass !== PROCESS_LOCAL_ARTIFACT_CLASS) {
    failures.push(`verdictCap.artifactClass must be "${PROCESS_LOCAL_ARTIFACT_CLASS}" for a process-local row, not ${JSON.stringify(cap.artifactClass)}`);
  } else if (!processLocal && !runner.processLocal && runner.declared && cap.artifactClass !== runner.declared) {
    failures.push(`verdictCap.artifactClass must be "${runner.declared}", the class invocation.artifactClass declares, not ${JSON.stringify(cap.artifactClass)}`);
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
