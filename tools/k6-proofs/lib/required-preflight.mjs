/**
 * Required preflight attachments (🌊's F″ method ruling, Discord
 * 1565895695586558120, 2026-10-31; openclaw-bootstrap#1727).
 *
 * R-CW-5A/6A are not proof rows of an F″ corpus. They are required preflights
 * of R-CW-5/6: a static source/harness check that must run at the exact
 * candidate, and a live cap row is PASS only when its preflight receipt passed
 * at that same candidate. A missing, failed, malformed or other-SHA receipt caps
 * the live row at PARTIAL-candidate; the gate never raises a verdict.
 *
 * The row manifest is the declaration of record: a live row lists
 * `requiredPreflights`, and each preflight manifest names its live row in
 * `preflightAttachment`. This module holds the one copy of the rules that the
 * k6 scenario (static-corpus-row-validator.js), the grader
 * (grade-preflight-gated-row.mjs), the catalog check
 * (check-proof-row-manifests.mjs) and the corpus validator (validate-corpus.mjs)
 * share. It is plain ESM with no Node or k6 imports, so k6 can load it too.
 */

export const REQUIRED_PREFLIGHT_RECEIPT_SCHEMA = 'openclaw.k6.required-preflight-receipt.v1';
export const REQUIRED_PREFLIGHT_RECEIPT_FILE = 'required-preflight-receipt.json';
export const PREFLIGHT_GATED_VERDICT_SCHEMA = 'openclaw.k6.preflight-gated-row-verdict.v1';
export const PREFLIGHT_EVIDENCE_BINDING = 'exact-candidate-sha';
export const PREFLIGHT_CAP = 'PARTIAL-candidate';
export const PREFLIGHT_PROOF_ROW_STATUS = 'retired';
// The checks every preflight receipt must carry, true, for its binding to hold:
// the run had the exact candidate, the material it read names that candidate,
// and it never claims live cap evidence.
export const REQUIRED_RECEIPT_CHECKS = ['exactCandidateBinding', 'materialNamesCandidate', 'nonLiveBoundary'];

const FULL_SHA = /^[0-9a-f]{40}$/;

export function isFullSha(value) {
  return typeof value === 'string' && FULL_SHA.test(value);
}

function isObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function show(value) {
  return JSON.stringify(value) ?? String(value);
}

/**
 * A row id as the gate compares it: Unicode-normalized, dash variants folded to
 * '-', whitespace and invisible characters removed, upper-cased. A corpus row
 * whose id canonicalizes to a gated row but is spelled otherwise is refused by
 * the corpus validator, never left ungated.
 */
export function canonicalRowId(value) {
  return String(value ?? '')
    .normalize('NFKC')
    .replace(/[\u2010-\u2015\u2212\uFE58\uFE63\uFF0D]/g, '-')
    .replace(/[\s\u00AD\u180E\u200B-\u200D\u2060\uFEFF]/g, '')
    .toUpperCase();
}

/** Check names whose value is not exactly `true`. */
export function falseChecks(checks) {
  return Object.entries(checks || {}).filter(([, value]) => value !== true).map(([name]) => name);
}

/**
 * The receipt a preflight run writes. `candidateSha` is null unless the run had
 * a 40-character candidate; such a run can never pass.
 */
export function buildRequiredPreflightReceipt({ preflightRow, attachedTo, candidateSha, sourceEvidenceSha, checks, passVerdict, failures = 0 }) {
  const bound = isFullSha(candidateSha) && sourceEvidenceSha === candidateSha;
  const pinned = REQUIRED_RECEIPT_CHECKS.every((name) => checks?.[name] === true);
  const passed = bound && pinned && failures === 0 && falseChecks(checks).length === 0;
  return {
    schema: REQUIRED_PREFLIGHT_RECEIPT_SCHEMA,
    preflightRow,
    attachedTo,
    candidateSha: isFullSha(candidateSha) ? candidateSha : null,
    sourceEvidenceSha: isFullSha(sourceEvidenceSha) ? sourceEvidenceSha : null,
    evidenceBinding: PREFLIGHT_EVIDENCE_BINDING,
    verdict: passed ? passVerdict : 'FAIL-candidate',
    preflightStatus: passed ? 'passed' : 'failed',
    checks: { ...checks },
  };
}

/**
 * Judge one receipt for one requirement of `liveRowId` at `candidateSha`.
 * Returns `{ status, reasons }`, status one of:
 *   missing         no receipt
 *   invalid         not a receipt for this preflight and live row
 *   wrong-candidate a receipt bound to another SHA, or not to the candidate
 *   failed          bound to the candidate, but the check did not pass
 *   passed          the only status that lets the live row keep PASS
 */
export function evaluateRequiredPreflight({ requirement, liveRowId, candidateSha, receipt }) {
  if (receipt === undefined || receipt === null) return { status: 'missing', reasons: ['no receipt supplied'] };
  if (!isObject(receipt)) return { status: 'invalid', reasons: ['receipt is not a JSON object'] };

  const invalid = [];
  if (receipt.schema !== REQUIRED_PREFLIGHT_RECEIPT_SCHEMA) {
    invalid.push(`schema is ${show(receipt.schema)}, expected ${REQUIRED_PREFLIGHT_RECEIPT_SCHEMA}`);
  }
  if (receipt.preflightRow !== requirement.rowId) {
    invalid.push(`preflightRow is ${show(receipt.preflightRow)}, expected ${requirement.rowId}`);
  }
  if (receipt.attachedTo !== liveRowId) invalid.push(`attachedTo is ${show(receipt.attachedTo)}, expected ${liveRowId}`);
  const checks = receipt.checks;
  if (!isObject(checks) || Object.keys(checks).length === 0 || Object.values(checks).some((value) => typeof value !== 'boolean')) {
    invalid.push('checks is not a non-empty object of booleans');
  } else {
    const absent = REQUIRED_RECEIPT_CHECKS.filter((name) => !Object.prototype.hasOwnProperty.call(checks, name));
    if (absent.length) invalid.push(`checks lacks ${absent.join(', ')}`);
  }
  if (invalid.length) return { status: 'invalid', reasons: invalid };

  const unbound = [];
  if (receipt.candidateSha !== candidateSha) unbound.push(`candidateSha ${receipt.candidateSha} is not the candidate ${candidateSha}`);
  if (receipt.sourceEvidenceSha !== candidateSha) {
    unbound.push(`sourceEvidenceSha ${receipt.sourceEvidenceSha} is not the candidate ${candidateSha}`);
  }
  if (receipt.evidenceBinding !== PREFLIGHT_EVIDENCE_BINDING) {
    unbound.push(`evidenceBinding is ${show(receipt.evidenceBinding)}, expected ${PREFLIGHT_EVIDENCE_BINDING}`);
  }
  if (unbound.length) return { status: 'wrong-candidate', reasons: unbound };

  const failed = [];
  if (receipt.preflightStatus !== 'passed') failed.push(`preflightStatus=${receipt.preflightStatus}`);
  if (receipt.verdict !== requirement.passVerdict) failed.push(`verdict=${receipt.verdict}`);
  const falseNames = falseChecks(checks);
  if (falseNames.length) failed.push(`failed checks: ${falseNames.join(', ')}`);
  if (failed.length) return { status: 'failed', reasons: failed };
  return { status: 'passed', reasons: [] };
}

/**
 * Cap a live row's verdict on its preflight statuses. Only PASS-candidate is
 * capped; every other verdict passes through, so the gate never raises one.
 */
export function gatePreflightedVerdict({ verdict, statuses }) {
  const blocked = statuses.some((status) => status !== 'passed');
  if (verdict === 'PASS-candidate' && blocked) return { verdict: PREFLIGHT_CAP, capped: true };
  return { verdict, capped: false };
}

/**
 * Catalog rule: every live row's requiredPreflights entry and the preflight
 * manifest it names agree in both directions. `entries` is `[{ file, manifest }]`
 * for every catalog manifest. Returns failure strings, `<file>: <problem>`.
 */
export function catalogPreflightFailures(entries) {
  const failures = [];
  const byFile = new Map(entries.map((entry) => [entry.file, entry]));
  const requiredBy = new Map();

  for (const { file, manifest } of entries) {
    if (!Object.prototype.hasOwnProperty.call(manifest || {}, 'requiredPreflights')) continue;
    const list = manifest.requiredPreflights;
    if (manifest.preflightAttachment !== undefined) failures.push(`${file}: a preflight attachment cannot itself require preflights`);
    if (!Array.isArray(list) || list.length === 0) {
      failures.push(`${file}: requiredPreflights must be a non-empty array`);
      continue;
    }
    const seen = new Set();
    for (const requirement of list) {
      if (!isObject(requirement) || typeof requirement.rowId !== 'string' || !requirement.rowId) {
        failures.push(`${file}: requiredPreflights entry ${show(requirement)} has no rowId`);
        continue;
      }
      const id = requirement.rowId;
      if (seen.has(id)) failures.push(`${file}: ${manifest.rowId} lists preflight ${id} twice`);
      seen.add(id);
      if (requirement.binding !== PREFLIGHT_EVIDENCE_BINDING) failures.push(`${file}: ${id} binding must be "${PREFLIGHT_EVIDENCE_BINDING}"`);
      if (requirement.capOnMissingOrFailed !== PREFLIGHT_CAP) failures.push(`${file}: ${id} capOnMissingOrFailed must be "${PREFLIGHT_CAP}"`);
      if (requirement.receipt !== REQUIRED_PREFLIGHT_RECEIPT_FILE) failures.push(`${file}: ${id} receipt must be "${REQUIRED_PREFLIGHT_RECEIPT_FILE}"`);
      const target = byFile.get(requirement.manifest);
      if (!target) {
        failures.push(`${file}: ${manifest.rowId} requires preflight ${id} from ${requirement.manifest}, which is not in the catalog`);
        continue;
      }
      const requirers = requiredBy.get(requirement.manifest) || [];
      requirers.push({ file, rowId: manifest.rowId, preflightRow: id });
      requiredBy.set(requirement.manifest, requirers);
      const preflight = target.manifest || {};
      if (preflight.rowId !== id) {
        failures.push(`${file}: ${manifest.rowId} requires preflight ${id}, but ${requirement.manifest} declares ${preflight.rowId}`);
      }
      if (!isObject(preflight.preflightAttachment)) {
        failures.push(`${file}: ${manifest.rowId} requires ${id}, but ${requirement.manifest} declares no preflightAttachment`);
      }
      const expected = preflight.liveRunSafety?.expectedArtifactClass;
      if (requirement.passVerdict !== expected) {
        failures.push(`${file}: ${id} passVerdict ${requirement.passVerdict} is not ${requirement.manifest}'s expectedArtifactClass ${expected}`);
      }
    }
  }

  // A preflight attaches to exactly one live row; a second requirer must fail
  // whatever order the catalog files sort in.
  for (const [target, requirers] of requiredBy) {
    if (requirers.length < 2) continue;
    const named = [...requirers].sort((a, b) => a.rowId.localeCompare(b.rowId) || a.file.localeCompare(b.file));
    failures.push(
      `${target}: ${requirers[0].preflightRow} is required by more than one live row: ${named.map((r) => `${r.rowId} (${r.file})`).join(', ')}`,
    );
  }

  for (const { file, manifest } of entries) {
    const attachment = manifest?.preflightAttachment;
    if (attachment === undefined) continue;
    if (!isObject(attachment)) {
      failures.push(`${file}: preflightAttachment must be an object`);
      continue;
    }
    if (attachment.proofRow !== PREFLIGHT_PROOF_ROW_STATUS) failures.push(`${file}: preflightAttachment.proofRow must be "${PREFLIGHT_PROOF_ROW_STATUS}"`);
    if (attachment.binding !== PREFLIGHT_EVIDENCE_BINDING) failures.push(`${file}: preflightAttachment.binding must be "${PREFLIGHT_EVIDENCE_BINDING}"`);
    if (typeof attachment.ruling !== 'string' || !attachment.ruling) failures.push(`${file}: preflightAttachment.ruling must name the ruling`);
    const classification = manifest.liveRunSafety?.classification;
    if (classification !== 'static-preflight-only') {
      failures.push(`${file}: a preflight attachment must be static-preflight-only, not ${classification}`);
    }
    if (manifest.scenario?.status !== 'runnable') failures.push(`${file}: a preflight attachment must have a runnable scenario`);
    const requirers = requiredBy.get(file) || [];
    if (requirers.length > 1) continue;
    const [requirer] = requirers;
    if (requirer && requirer.rowId !== attachment.attachedTo) {
      failures.push(`${file}: ${manifest.rowId} is attached to ${attachment.attachedTo}, but ${requirer.rowId} (${requirer.file}) requires it`);
    } else if (!requirer) {
      const live = entries.find((entry) => entry.manifest?.rowId === attachment.attachedTo);
      failures.push(
        `${file}: ${manifest.rowId} is attached to ${attachment.attachedTo}, but ${live ? live.file : 'no catalog manifest'} does not require it`,
      );
    }
  }
  return failures;
}

/**
 * Index the catalog for corpus validation. `requirementsByLiveRow` maps a live
 * row id to its requirements (each with `manifestPath`); `liveRowByPreflight`
 * maps a preflight row id to the live row that requires it.
 */
export function preflightCatalog(entries) {
  const requirementsByLiveRow = new Map();
  const liveRowByPreflight = new Map();
  for (const { manifest } of entries) {
    if (!Array.isArray(manifest?.requiredPreflights) || typeof manifest.rowId !== 'string') continue;
    const requirements = manifest.requiredPreflights
      .filter((requirement) => isObject(requirement) && typeof requirement.rowId === 'string')
      .map((requirement) => ({ ...requirement, manifestPath: `tools/k6-proofs/manifests/${requirement.manifest}` }));
    requirementsByLiveRow.set(manifest.rowId, requirements);
    for (const requirement of requirements) liveRowByPreflight.set(requirement.rowId, manifest.rowId);
  }
  return { requirementsByLiveRow, liveRowByPreflight };
}
