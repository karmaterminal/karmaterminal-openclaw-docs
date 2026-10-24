/**
 * scheduled-baseline.mjs — pure decisions for the nightly / on-deploy
 * exact-build baseline (#587): the verdict rollup with each row's last
 * same-row PASS, the regression set, whether a deploy needs a fresh fire, and
 * which seats missed their nightly fire.
 *
 * Nothing here touches the network or a gateway; the CLI in
 * scripts/scheduled-baseline.mjs gathers inputs and writes outputs.
 */

export const ROLLUP_SCHEMA = 'openclaw.k6.scheduled-baseline-rollup.v1';
export const WATCHDOG_SCHEMA = 'openclaw.k6.scheduled-baseline-watchdog.v1';
export const ARTIFACT_PREFIX = 'k6-baseline';

// A deploy-check attempt that did not fire proves nothing, so the next poll
// retries it; after this many no-fire attempts for one seat and SHA the poll
// stops, so a broken seat cannot alert every 30 minutes. The nightly still
// retries it once a day.
export const MAX_NOFIRE_ATTEMPTS = 3;

/**
 * Rows whose retained PASS receipts from before a named epoch are documented as
 * historically non-discriminating: the row's detector could not tell a real
 * continuation from an artefact of the check itself, so such a PASS is kept as
 * history but must never anchor a current-regression claim.
 *
 * This is deliberately one explicit row, not a guess about the corpus at large.
 * R-CW-DELEGATE-SELF-CONTINUATION's own manifest records it (liveRunSafety.notes
 * in manifests/r-cw-delegate-self.json): before #570 its parent-return evidence
 * was a parent-stream substring check that the parent's own continue_delegate
 * task text could satisfy. `before` is the #570 merge commit 57478ad4. Those
 * PASSes are not re-classified as FAIL; they just cannot be an anchor.
 */
export const NON_DISCRIMINATING_PASS_EPOCHS = Object.freeze({
  'R-CW-DELEGATE-SELF-CONTINUATION': Object.freeze({
    before: '2026-10-05T05:31:56.000Z',
    reason: 'pre-#570-parent-stream-substring',
    ref: 'tools/k6-proofs/manifests/r-cw-delegate-self.json',
  }),
});

// The one ordinary non-PASS closure in the continuation matrix (run-k6-proofs).
const HONEST_LIMIT_ROWS = new Set(['R-RC-2']);
const CARRIED_FIRE = /(transpos|carried|copy|seed)/iu;
const SHA = /^[0-9a-f]{40}$/u;
const SEAT = /^[a-z0-9][a-z0-9-]{0,39}$/u;
const DIGITS = /^\d+$/u;
// Corpus `generated` values are free-form: an instant, a bare day, a day with a
// parenthesised note, or absent. Date.parse() accepts the noted forms through
// V8's legacy path and resolves them in the *runner's* local zone, so the same
// corpus could sort differently on two machines. These two shapes are the only
// ones accepted, and a bare day is pinned to UTC midnight.
const ISO_INSTANT = /^(\d{4}-\d{2}-\d{2})[T ](\d{2}:\d{2}:\d{2}(?:\.\d+)?)(Z|[+-]\d{2}:?\d{2})$/u;
const ISO_DAY = /^(\d{4}-\d{2}-\d{2})(?:\s+\([^\n]*\))?$/u;

/**
 * Split the manifest catalog into the honest denominator and the rows outside
 * it. `manifests` is an array of parsed row manifests.
 */
export function classifyCatalog(manifests) {
  const live = [];
  const orchestrationOnly = [];
  const constructOnly = [];
  for (const manifest of manifests) {
    const status = manifest.scenario?.status ?? 'missing';
    const classification = manifest.liveRunSafety?.classification ?? 'unknown';
    if (status === 'runnable' && classification === 'k6-runnable') live.push(manifest.rowId);
    else if (['orchestration-required', 'static-preflight-only'].includes(classification)) orchestrationOnly.push(manifest.rowId);
    else if (classification === 'construct-only' || status === 'construct-only') constructOnly.push(manifest.rowId);
  }
  return {
    live: live.sort(),
    orchestrationOnly: orchestrationOnly.sort(),
    constructOnly: constructOnly.sort(),
  };
}

export function verdictClass(verdict) {
  switch (verdict) {
    case 'PASS-candidate':
      return 'pass';
    case 'FAIL-candidate':
      return 'fail';
    case 'HONEST-LIMIT-candidate':
      return 'honest_limit';
    default:
      // PARTIAL-candidate, an unknown verdict, or none: the row ran but did not prove.
      return 'partial';
  }
}

function stateClass(state) {
  const value = String(state ?? '').toLowerCase().replace('-', '_');
  if (['pass', 'partial', 'fail', 'missing', 'honest_limit'].includes(value)) return value;
  if (value === 'thin') return 'partial';
  return null;
}

export function acceptable(row, cls) {
  return cls === 'pass' || (cls === 'honest_limit' && HONEST_LIMIT_ROWS.has(row));
}

/**
 * Deterministic reading of a corpus `generated` value. Returns
 * { at, precision, reason }: `at` is null when the value cannot be ordered, and
 * `reason` then names why. Never falls back to Date.parse()'s local-time path.
 */
export function parseCorpusDate(value) {
  if (typeof value !== 'string' || value.trim() === '') {
    return { at: null, precision: null, reason: 'generated-absent' };
  }
  const text = value.trim();
  const instant = ISO_INSTANT.exec(text);
  if (instant) {
    const ms = Date.parse(`${instant[1]}T${instant[2]}${instant[3]}`);
    if (Number.isNaN(ms)) return { at: null, precision: null, reason: 'generated-unparseable' };
    return { at: new Date(ms).toISOString(), precision: 'instant', reason: null };
  }
  const day = ISO_DAY.exec(text);
  if (day) {
    const ms = Date.parse(`${day[1]}T00:00:00.000Z`);
    if (Number.isNaN(ms)) return { at: null, precision: null, reason: 'generated-unparseable' };
    // Pinned to UTC midnight: a day-precision corpus must order the same way on
    // every runner, and it loses to any instant later that day.
    return { at: new Date(ms).toISOString(), precision: 'day', reason: null };
  }
  return { at: null, precision: null, reason: 'generated-unparseable' };
}

/**
 * Row observations from historical PROOFS/<sha>/proofs-manifest.json files.
 * `corpora` is [{ sha, manifest }]. Returns
 * { byRow: Map<row, observation[]>, included, skipped } — `skipped` names every
 * corpus that contributed nothing and why, so the rollup never implies that all
 * of PROOFS was weighed.
 */
export function corpusObservations(corpora) {
  const byRow = new Map();
  const included = [];
  const skipped = [];
  for (const { sha, manifest } of corpora) {
    const generated = manifest?.generated ?? manifest?.generated_at ?? manifest?.generatedAt ?? null;
    const { at, precision, reason } = parseCorpusDate(generated);
    if (!at) {
      skipped.push({ sha, reason });
      continue;
    }
    const rows = Array.isArray(manifest?.rows) ? manifest.rows : null;
    if (rows === null) {
      skipped.push({ sha, reason: 'rows-not-a-list' });
      continue;
    }
    const fireType = typeof manifest.fire_type === 'string' ? manifest.fire_type : null;
    let observed = 0;
    for (const entry of rows) {
      const rawRow = entry?.row ?? entry?.id;
      const cls = stateClass(entry?.state ?? entry?.status);
      if (typeof rawRow !== 'string' || !cls) continue;
      const row = rawRow.toUpperCase();
      const list = byRow.get(row) ?? [];
      list.push({
        source: 'corpus',
        sha,
        at,
        atPrecision: precision,
        cls,
        fireType,
        // null is "the corpus does not say", never "fresh".
        carried: fireType ? CARRIED_FIRE.test(fireType) : null,
        ref: `PROOFS/${sha}/proofs-manifest.json`,
      });
      byRow.set(row, list);
      observed += 1;
    }
    if (observed === 0) skipped.push({ sha, reason: 'no-row-states' });
    else included.push({ sha, at, precision, rows: observed });
  }
  return {
    byRow,
    included: included.sort((a, b) => (a.sha < b.sha ? -1 : 1)),
    skipped: skipped.sort((a, b) => (a.sha < b.sha ? -1 : 1)),
  };
}

/** Row observations from earlier baseline rollups (always fresh fires). */
export function historyObservations(rollups) {
  const byRow = new Map();
  for (const rollup of rollups) {
    if (rollup?.schema !== ROLLUP_SCHEMA || rollup.fired !== true) continue;
    for (const entry of rollup.rows ?? []) {
      const list = byRow.get(entry.row) ?? [];
      // Only the immediately previous rollup is downloaded. Carry its last
      // same-row PASS forward so consecutive non-PASS runs do not erase it.
      if (entry.lastPass?.sha && entry.lastPass?.at) {
        list.push({
          source: entry.lastPass.source ?? 'baseline',
          sha: entry.lastPass.sha,
          at: entry.lastPass.at,
          cls: 'pass',
          fireType: entry.lastPass.fireType ?? null,
          carried: entry.lastPass.carried ?? null,
          ref: entry.lastPass.ref ?? null,
        });
      }
      if (entry.cls !== 'missing') list.push({
        source: 'baseline',
        sha: rollup.sha,
        at: rollup.generatedAt,
        cls: entry.cls,
        fireType: `scheduled-baseline:${rollup.trigger}`,
        carried: false,
        ref: rollup.runUrl ?? null,
      });
      byRow.set(entry.row, list);
    }
  }
  return byRow;
}

function newest(list, predicate = () => true) {
  return (list ?? [])
    .filter(predicate)
    .sort((a, b) => (a.at < b.at ? 1 : a.at > b.at ? -1 : 0))[0] ?? null;
}

/**
 * The documented non-discriminating epoch covering this observation, or null.
 * An undated PASS for such a row cannot be shown to postdate the epoch, so it
 * is treated as inside it.
 */
export function nonDiscriminatingEpoch(row, observation) {
  const epoch = NON_DISCRIMINATING_PASS_EPOCHS[row];
  if (!epoch || observation?.cls !== 'pass') return null;
  if (typeof observation.at !== 'string') return epoch;
  return observation.at < epoch.before ? epoch : null;
}

/** How a PASS receipt may be described: a fresh fire, a carried one, or unknown. */
function provenance(observation) {
  if (observation.carried === true) return 'carried';
  if (observation.carried === false) return 'fresh';
  return 'unknown';
}

function markProvenance(row, observation) {
  const epoch = nonDiscriminatingEpoch(row, observation);
  return {
    ...observation,
    provenance: provenance(observation),
    nonDiscriminating: epoch !== null,
    nonDiscriminatingReason: epoch?.reason ?? null,
  };
}

/**
 * Current-run verdicts. `results` is [{ row, verdict, endedAt, pendingReceipts }]
 * from run-result.json files. The newest result per row wins.
 */
export function currentVerdicts(results) {
  const byRow = new Map();
  for (const result of results) {
    const prior = byRow.get(result.row);
    if (!prior || String(result.endedAt ?? '') > String(prior.endedAt ?? '')) byRow.set(result.row, result);
  }
  return byRow;
}

/**
 * Build the rollup. A run with no row result at all did not fire: that is a
 * failure in its own right, and the rollup says so instead of reporting 34
 * missing rows as if they had been tried.
 */
export function buildRollup({
  catalog,
  results,
  corpus,
  history,
  sha,
  seat,
  docsRef,
  trigger,
  runUrl,
  generatedAt,
  harnessControl = null,
  isolatedGateway = null,
  deployedBuild = null,
  blockedAt = null,
  historyAvailability = null,
}) {
  const current = currentVerdicts(results.filter((result) => catalog.live.includes(result.row)));
  const fired = current.size > 0;
  // The last-PASS regression gate is only as good as the history behind it. A
  // listing or download that did not happen is a gate that did not run, and the
  // rollup says so instead of reporting "no regression".
  const historyGaps = [];
  if (historyAvailability) {
    if (historyAvailability.listing && historyAvailability.listing !== 'success') {
      historyGaps.push(`artifact-listing-${historyAvailability.listing}`);
    }
    if (historyAvailability.expectedName && !historyAvailability.loaded) {
      historyGaps.push(`previous-baseline-not-loaded:${historyAvailability.expectedName}`);
    }
  }
  const rows = catalog.live.map((row) => {
    const result = current.get(row) ?? null;
    const cls = result ? verdictClass(result.verdict) : 'missing';
    const observations = [...(history.get(row) ?? []), ...(corpus.byRow.get(row) ?? [])]
      .map((obs) => markProvenance(row, obs));
    const lastPass = newest(observations, (obs) => obs.cls === 'pass');
    const previous = newest(observations);
    // A documented non-discriminating PASS is kept as history but may not
    // anchor a regression claim; the newest observation that can is used.
    const anchor = newest(observations, (obs) => !obs.nonDiscriminating);
    const regressed = fired && anchor !== null && acceptable(row, anchor.cls) && !acceptable(row, cls);
    const summarize = (obs) => ({
      cls: obs.cls,
      sha: obs.sha,
      at: obs.at,
      source: obs.source,
      nonDiscriminating: obs.nonDiscriminating,
    });
    return {
      row,
      cls,
      verdict: result?.verdict ?? null,
      reviewPending: (result?.pendingReceipts ?? []).length,
      previous: previous ? summarize(previous) : null,
      anchor: anchor ? summarize(anchor) : null,
      lastPass: lastPass
        ? {
            sha: lastPass.sha,
            at: lastPass.at,
            source: lastPass.source,
            carried: lastPass.carried,
            provenance: lastPass.provenance,
            fireType: lastPass.fireType,
            ref: lastPass.ref,
            nonDiscriminating: lastPass.nonDiscriminating,
            nonDiscriminatingReason: lastPass.nonDiscriminatingReason,
          }
        : null,
      regressed,
    };
  });
  const counts = { pass: 0, partial: 0, fail: 0, missing: 0, honest_limit: 0 };
  for (const entry of rows) counts[entry.cls] += 1;
  let notFiredReason = null;
  if (!fired) {
    // The earliest failed stage explains the silence; later stages never ran.
    if (blockedAt === 'resolve-build') {
      notFiredReason = `resolve-build:${(deployedBuild?.notes ?? []).join(',') || 'unknown'}`;
    } else if (blockedAt && blockedAt !== 'isolated-gateway') {
      notFiredReason = `blocked-at:${blockedAt}`;
    } else if (isolatedGateway && isolatedGateway.outcome !== 'READY') {
      notFiredReason = `isolated-gateway-not-ready:${(isolatedGateway.notes ?? []).join(',') || 'unknown'}`;
    } else if (harnessControl) {
      notFiredReason = `harness-${harnessControl.stage}:${harnessControl.reason}`;
    } else {
      notFiredReason = blockedAt ? `blocked-at:${blockedAt}` : 'no-row-results';
    }
  }
  return {
    schema: ROLLUP_SCHEMA,
    generatedAt,
    candidateOnly: true,
    foldRequiresReview: true,
    seat,
    sha,
    docsRef,
    trigger,
    runUrl,
    fired,
    notFiredReason,
    denominator: catalog.live.length,
    outsideDenominator: {
      orchestrationOnly: catalog.orchestrationOnly,
      constructOnly: catalog.constructOnly,
    },
    counts,
    regressions: rows.filter((entry) => entry.regressed).map((entry) => entry.row),
    historyComplete: historyGaps.length === 0,
    historyGaps,
    corpusProvenance: {
      included: corpus.included.length,
      rows: corpus.included.reduce((total, entry) => total + entry.rows, 0),
      skipped: corpus.skipped,
    },
    nonDiscriminatingEpochs: Object.fromEntries(
      Object.entries(NON_DISCRIMINATING_PASS_EPOCHS).map(([row, epoch]) => [row, { ...epoch }]),
    ),
    // Issue #587 limits #sprites alerts to regressions and non-fires. An
    // incomplete history still fails the job and is prominent in its rollup.
    alert: !fired || rows.some((entry) => entry.regressed),
    rows,
  };
}

function short(sha) {
  return typeof sha === 'string' ? sha.slice(0, 10) : 'unknown';
}

function day(at) {
  return typeof at === 'string' ? at.slice(0, 10) : '?';
}

/** The issue-comment body. Public-safe: verdicts, SHAs, dates, links only. */
export function renderRollupMarkdown(rollup) {
  const lines = [];
  const status = !rollup.fired
    ? '🔴 **NOT FIRED**'
    : rollup.regressions.length > 0
      ? `🔴 **${rollup.regressions.length} regressed**`
      : rollup.historyComplete === false
        ? '🔴 **HISTORY INCOMPLETE**'
      : '🟢 no regression';
  lines.push(`### Scheduled k6 baseline — ${rollup.seat} @ \`${short(rollup.sha)}\` — ${status}`);
  lines.push('');
  lines.push(`Trigger \`${rollup.trigger}\`, docs \`${short(rollup.docsRef)}\`, ${rollup.generatedAt}. [Run](${rollup.runUrl}).`);
  lines.push('Candidate-only: nothing here is folded into a corpus without review.');
  lines.push('');
  if (!rollup.fired) {
    lines.push(`**This run did not fire** (\`${rollup.notFiredReason}\`). No row was proven. A run that does not fire is a failure.`);
    lines.push('');
  }
  const c = rollup.counts;
  lines.push(
    `Denominator **${rollup.denominator}** live-suite rows: ${c.pass} pass, ${c.partial} partial, ${c.fail} fail, ${c.missing} missing` +
      (c.honest_limit ? `, ${c.honest_limit} honest-limit` : '') +
      '.',
  );
  const outside = rollup.outsideDenominator;
  lines.push(
    `Outside the denominator by design: orchestration-only ${outside.orchestrationOnly.join(', ') || 'none'}` +
      ` (fixture-driven, not fired by this runner); construct-only ${outside.constructOnly.join(', ') || 'none'}.`,
  );
  const corpus = rollup.corpusProvenance;
  if (corpus) {
    lines.push(
      `History weighed ${corpus.included} PROOFS corpora (${corpus.rows} row observations); ` +
        (corpus.skipped.length === 0
          ? 'none skipped.'
          : `**${corpus.skipped.length} skipped** as unorderable or empty: ` +
            `${corpus.skipped.map((entry) => `\`${short(entry.sha)}\` (${entry.reason})`).join(', ')}.`),
    );
  }
  if (rollup.historyComplete === false) {
    lines.push('');
    lines.push(
      `🔴 **Last-PASS history is incomplete** (\`${rollup.historyGaps.join('; ')}\`). The regression gate ` +
        'below could not run against this seat\'s previous baseline: treat "no regression" as unknown, not as green.',
    );
  }
  lines.push('');
  lines.push('| row | now | previous | last same-row PASS | |');
  lines.push('|---|---|---|---|---|');
  for (const entry of rollup.rows) {
    const previous = entry.previous
      ? `${entry.previous.cls} \`${short(entry.previous.sha)}\` ${day(entry.previous.at)}` +
        (entry.previous.nonDiscriminating ? ' (non-discriminating)' : '')
      : '—';
    const lastPass = entry.lastPass
      ? `\`${short(entry.lastPass.sha)}\` ${day(entry.lastPass.at)} (${entry.lastPass.source}, ` +
        `${entry.lastPass.provenance === 'unknown' ? 'provenance unknown' : entry.lastPass.provenance}` +
        `${entry.lastPass.nonDiscriminating ? `, non-discriminating: ${entry.lastPass.nonDiscriminatingReason}` : ''})`
      : 'never (new/unproved)';
    const flag = entry.regressed
      ? '🔴 regressed'
      : entry.anchor === null && entry.previous !== null
        ? '⚠️ no discriminating anchor'
        : entry.reviewPending
          ? `${entry.reviewPending} receipts pending`
          : '';
    lines.push(`| ${entry.row} | ${entry.cls} | ${previous} | ${lastPass} | ${flag} |`);
  }
  return `${lines.join('\n')}\n`;
}

/** The short #sprites alert. Only sent when rollup.alert is true. */
export function renderAlert(rollup) {
  if (!rollup.fired) {
    return `🔴 k6 baseline did not fire on ${rollup.seat} @ \`${short(rollup.sha)}\` (${rollup.notFiredReason}). ${rollup.runUrl}`;
  }
  const reasons = [];
  if (rollup.regressions.length > 0) reasons.push(`regressed from last PASS — ${rollup.regressions.join(', ')}`);
  if (rollup.historyComplete === false) {
    reasons.push(`last-PASS history incomplete (${rollup.historyGaps.join('; ')}), so the regression gate did not run`);
  }
  return `🔴 k6 baseline on ${rollup.seat} @ \`${short(rollup.sha)}\`: ${reasons.join('; ')}. ${rollup.runUrl}`;
}

/**
 * Artifact name; the watchdog and deploy-check key on it. The run attempt is
 * part of the name because upload-artifact@v4 refuses a name a previous attempt
 * of the same run already published, which would otherwise lose the rollup of
 * every re-run.
 */
export function artifactName({ seat, sha, trigger, fired, runId, runAttempt = 1 }) {
  if (!SEAT.test(seat ?? '')) throw new Error('invalid seat');
  if (!['nightly', 'deploy', 'manual'].includes(trigger)) throw new Error('invalid trigger');
  if (!DIGITS.test(String(runId ?? ''))) throw new Error('invalid runId');
  if (!DIGITS.test(String(runAttempt ?? ''))) throw new Error('invalid runAttempt');
  const tag = SHA.test(sha ?? '') ? sha.slice(0, 12) : 'nosha';
  return `${ARTIFACT_PREFIX}-${seat}-${tag}-${trigger}-${fired ? 'fired' : 'nofire'}-${runId}-r${runAttempt}`;
}

export function parseArtifactName(name) {
  // The attempt suffix is optional so that names published before it existed
  // still parse, as attempt 1, for the watchdog and the deploy-check.
  const match = /^k6-baseline-([a-z0-9][a-z0-9-]*?)-([0-9a-f]{12}|nosha)-(nightly|deploy|manual)-(fired|nofire)-(\d+)(?:-r(\d+))?$/u.exec(name ?? '');
  if (!match) return null;
  return {
    seat: match[1],
    shaPrefix: match[2],
    trigger: match[3],
    fired: match[4] === 'fired',
    runId: match[5],
    runAttempt: match[6] ?? '1',
  };
}

/**
 * The newest unexpired *fired* baseline for exactly this seat, whose rollup
 * carries the last-PASS lineage. Seat names nest (`cael` is a prefix of
 * `cael-dgx`), so the seat is compared through the parsed name, never as a
 * string prefix: a seat must never inherit another seat's history.
 */
export function selectPreviousBaseline({ artifacts, seat, excludeRunId = null }) {
  const exclude = excludeRunId === null ? null : String(excludeRunId);
  const best = (artifacts ?? [])
    .map((artifact) => ({ artifact, parsed: parseArtifactName(artifact?.name) }))
    .filter(({ artifact, parsed }) =>
      parsed !== null &&
      parsed.seat === seat &&
      parsed.fired &&
      artifact.expired !== true &&
      (exclude === null || String(artifact.run_id ?? '') !== exclude))
    .sort((a, b) => (String(a.artifact.created_at ?? '') < String(b.artifact.created_at ?? '') ? 1 : -1))[0];
  return best
    ? { name: best.artifact.name, runId: best.artifact.run_id ?? null, createdAt: best.artifact.created_at ?? null }
    : null;
}

/**
 * On-deploy fire: fire when this seat's deployed SHA has no *fired* baseline
 * yet. An attempt that did not fire proved nothing — transient contention on
 * the seat ends in a `nofire` artifact — so the poll retries it, up to
 * `maxNoFireAttempts` times for one seat and SHA. After that the poll goes
 * quiet and leaves the SHA to the nightly, so a seat that is simply broken
 * cannot alert every 30 minutes. `artifacts` is the repository artifact
 * listing (name, expired).
 */
export function deployCheck({ seat, sha, artifacts, maxNoFireAttempts = MAX_NOFIRE_ATTEMPTS }) {
  if (!SHA.test(sha ?? '')) {
    return { fire: false, reason: 'deployed-sha-invalid', attempts: 0, noFireAttempts: 0 };
  }
  const attempted = (artifacts ?? [])
    .filter((artifact) => artifact?.expired !== true)
    .map((artifact) => parseArtifactName(artifact?.name))
    .filter((parsed) => parsed && parsed.seat === seat && parsed.shaPrefix === sha.slice(0, 12));
  const fired = attempted.filter((parsed) => parsed.fired).length;
  const noFireAttempts = attempted.length - fired;
  const counts = { attempts: attempted.length, noFireAttempts };
  if (fired > 0) return { fire: false, reason: 'already-fired-for-deployed-sha', ...counts };
  if (noFireAttempts === 0) return { fire: true, reason: 'deployed-sha-not-yet-proved', ...counts };
  if (noFireAttempts >= maxNoFireAttempts) {
    return { fire: false, reason: `nofire-attempts-exhausted:${noFireAttempts}`, ...counts };
  }
  return { fire: true, reason: `retry-after-nofire:${noFireAttempts}`, ...counts };
}

/** Most recent daily occurrence of "M H * * *" (UTC) at or before `now`. */
export function lastDailyOccurrence(cron, now) {
  const match = /^(\d{1,2}) (\d{1,2}) \* \* \*$/u.exec(cron.trim());
  if (!match) throw new Error(`watchdog supports daily "M H * * *" crons only: ${cron}`);
  const at = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), Number(match[2]), Number(match[1])));
  if (at > now) at.setUTCDate(at.getUTCDate() - 1);
  return at;
}

/**
 * Missed-fire detector. Every expected seat must have a `fired` artifact
 * created since the last nightly occurrence. Missing or `nofire` alerts.
 */
export function watchdog({ seats, artifacts, nightlyCron, now, graceMinutes = 0 }) {
  const due = lastDailyOccurrence(nightlyCron, now);
  const since = new Date(due.getTime() - graceMinutes * 60_000);
  const missed = [];
  const fired = [];
  for (const seat of seats) {
    const recent = artifacts
      .filter((artifact) => new Date(artifact.created_at) >= since)
      .map((artifact) => parseArtifactName(artifact.name))
      .filter((parsed) => parsed && parsed.seat === seat && parsed.trigger === 'nightly');
    if (recent.some((parsed) => parsed.fired)) fired.push(seat);
    else missed.push({ seat, reason: recent.length > 0 ? 'ran-but-did-not-fire' : 'no-baseline-published' });
  }
  return {
    schema: WATCHDOG_SCHEMA,
    checkedAt: now.toISOString(),
    nightlyDueAt: due.toISOString(),
    seats,
    fired,
    missed,
    alert: missed.length > 0 || seats.length === 0,
  };
}

export function renderWatchdogAlert(result, runUrl) {
  if (result.seats.length === 0) return `🔴 k6 baseline watchdog: no seats configured (K6_BASELINE_SEATS). ${runUrl}`;
  const list = result.missed.map((entry) => `${entry.seat} (${entry.reason})`).join(', ');
  return `🔴 k6 baseline missed its nightly fire since ${result.nightlyDueAt}: ${list}. ${runUrl}`;
}
