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

// The one ordinary non-PASS closure in the continuation matrix (run-k6-proofs).
const HONEST_LIMIT_ROWS = new Set(['R-RC-2']);
const CARRIED_FIRE = /(transpos|carried|copy|seed)/iu;
const SHA = /^[0-9a-f]{40}$/u;
const SEAT = /^[a-z0-9][a-z0-9-]{0,39}$/u;

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
 * Row observations from historical PROOFS/<sha>/proofs-manifest.json files.
 * `corpora` is [{ sha, manifest }]. Returns Map<row, observation[]>.
 */
export function corpusObservations(corpora) {
  const byRow = new Map();
  for (const { sha, manifest } of corpora) {
    const generatedAt = manifest?.generated ?? manifest?.generated_at ?? manifest?.generatedAt ?? null;
    if (!generatedAt || Number.isNaN(Date.parse(generatedAt))) continue;
    const rows = Array.isArray(manifest?.rows) ? manifest.rows : [];
    const fireType = typeof manifest.fire_type === 'string' ? manifest.fire_type : null;
    for (const entry of rows) {
      const rawRow = entry?.row ?? entry?.id;
      const cls = stateClass(entry?.state ?? entry?.status);
      if (typeof rawRow !== 'string' || !cls) continue;
      const row = rawRow.toUpperCase();
      const list = byRow.get(row) ?? [];
      list.push({
        source: 'corpus',
        sha,
        at: new Date(generatedAt).toISOString(),
        cls,
        fireType,
        carried: fireType ? CARRIED_FIRE.test(fireType) : null,
        ref: `PROOFS/${sha}/proofs-manifest.json`,
      });
      byRow.set(row, list);
    }
  }
  return byRow;
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
}) {
  const current = currentVerdicts(results.filter((result) => catalog.live.includes(result.row)));
  const fired = current.size > 0;
  const rows = catalog.live.map((row) => {
    const result = current.get(row) ?? null;
    const cls = result ? verdictClass(result.verdict) : 'missing';
    const observations = [...(history.get(row) ?? []), ...(corpus.get(row) ?? [])];
    const lastPass = newest(observations, (obs) => obs.cls === 'pass');
    const previous = newest(observations);
    const regressed = fired && previous !== null && acceptable(row, previous.cls) && !acceptable(row, cls);
    return {
      row,
      cls,
      verdict: result?.verdict ?? null,
      reviewPending: (result?.pendingReceipts ?? []).length,
      previous: previous ? { cls: previous.cls, sha: previous.sha, at: previous.at, source: previous.source } : null,
      lastPass: lastPass
        ? {
            sha: lastPass.sha,
            at: lastPass.at,
            source: lastPass.source,
            carried: lastPass.carried,
            fireType: lastPass.fireType,
            ref: lastPass.ref,
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
  lines.push('');
  lines.push('| row | now | previous | last same-row PASS | |');
  lines.push('|---|---|---|---|---|');
  for (const entry of rollup.rows) {
    const previous = entry.previous ? `${entry.previous.cls} \`${short(entry.previous.sha)}\` ${day(entry.previous.at)}` : '—';
    const lastPass = entry.lastPass
      ? `\`${short(entry.lastPass.sha)}\` ${day(entry.lastPass.at)} (${entry.lastPass.source}${entry.lastPass.carried ? ', carried' : ''})`
      : 'never (new/unproved)';
    const flag = entry.regressed ? '🔴 regressed' : entry.reviewPending ? `${entry.reviewPending} receipts pending` : '';
    lines.push(`| ${entry.row} | ${entry.cls} | ${previous} | ${lastPass} | ${flag} |`);
  }
  return `${lines.join('\n')}\n`;
}

/** The short #sprites alert. Only sent when rollup.alert is true. */
export function renderAlert(rollup) {
  if (!rollup.fired) {
    return `🔴 k6 baseline did not fire on ${rollup.seat} @ \`${short(rollup.sha)}\` (${rollup.notFiredReason}). ${rollup.runUrl}`;
  }
  return `🔴 k6 baseline on ${rollup.seat} @ \`${short(rollup.sha)}\`: regressed from last PASS — ${rollup.regressions.join(', ')}. ${rollup.runUrl}`;
}

/** Artifact name; the watchdog and deploy-check key on it. */
export function artifactName({ seat, sha, trigger, fired, runId }) {
  if (!SEAT.test(seat ?? '')) throw new Error('invalid seat');
  if (!['nightly', 'deploy', 'manual'].includes(trigger)) throw new Error('invalid trigger');
  const tag = SHA.test(sha ?? '') ? sha.slice(0, 12) : 'nosha';
  return `${ARTIFACT_PREFIX}-${seat}-${tag}-${trigger}-${fired ? 'fired' : 'nofire'}-${runId}`;
}

export function parseArtifactName(name) {
  const match = /^k6-baseline-([a-z0-9][a-z0-9-]*?)-([0-9a-f]{12}|nosha)-(nightly|deploy|manual)-(fired|nofire)-(\d+)$/u.exec(name ?? '');
  if (!match) return null;
  return { seat: match[1], shaPrefix: match[2], trigger: match[3], fired: match[4] === 'fired', runId: match[5] };
}

/**
 * On-deploy fire: fire when no baseline has been attempted for this seat and
 * deployed SHA. `artifacts` is the repository artifact listing (name, expired).
 */
export function deployCheck({ seat, sha, artifacts }) {
  if (!SHA.test(sha ?? '')) return { fire: false, reason: 'deployed-sha-invalid' };
  const attempted = artifacts
    .filter((artifact) => !artifact.expired)
    .map((artifact) => parseArtifactName(artifact.name))
    .filter((parsed) => parsed && parsed.seat === seat && parsed.shaPrefix === sha.slice(0, 12));
  return attempted.length > 0
    ? { fire: false, reason: 'already-attempted-for-deployed-sha' }
    : { fire: true, reason: 'deployed-sha-not-yet-proved' };
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
