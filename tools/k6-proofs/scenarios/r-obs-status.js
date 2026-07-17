/**
 * R-OBS-STATUS — exact-candidate contract for #1172's continuation status row.
 *
 * This intentionally does not call the gateway `status` RPC: that endpoint
 * proves transport health, not the user-visible status-text behavior fixed by
 * #1172. Instead it evaluates exact candidate source prefetched by the runner
 * from its immutable GitHub SHA (the k6 sandbox itself has no outbound network),
 * extracts the dependency-free status-row formatter, and executes its two
 * public-safe contract cases:
 *
 * - an active continuation state renders the continuation line; and
 * - a clean all-zero state omits that line.
 *
 * No session keys, prompts, gateway tokens, or raw source text enter evidence.
 */
import { check } from 'k6';
import crypto from 'k6/crypto';
import { Counter, Trend } from 'k6/metrics';
import { loadManifestFromEnv, validateManifest } from '../lib/manifest-loader.js';

export const options = {
  scenarios: {
    r_obs_status: {
      executor: 'shared-iterations',
      vus: 1,
      iterations: 1,
      maxDuration: '30s',
    },
  },
  thresholds: {
    proof_failures: ['count==0'],
    r_obs_status_duration: ['p(95)<20000'],
  },
};

const failures = new Counter('proof_failures');
const duration = new Trend('r_obs_status_duration');
const manifest = loadManifestFromEnv();
const prefetchedSourcePath = __ENV.OPENCLAW_STATUS_SOURCE_PATH || '';
const prefetchedSource = prefetchedSourcePath ? open(prefetchedSourcePath) : '';
const FORMATTER_START = 'export function formatStatusTextContinuationLine(params: {';
const FORMATTER_END = '\n}\n\nconst loadStatusMessageRuntime';
const FORMATTER_SIGNATURE_END = '}): string | undefined {';

function fail(message) {
  console.error(message);
  failures.add(1);
}

function extractFormatter(source) {
  const start = source.indexOf(FORMATTER_START);
  if (start < 0) throw new Error('status formatter start marker was not found');
  const end = source.indexOf(FORMATTER_END, start);
  if (end < 0) throw new Error('status formatter end marker was not found');

  const declaration = source.slice(start, end + 2);
  const bodyStart = declaration.indexOf(FORMATTER_SIGNATURE_END);
  if (bodyStart < 0) throw new Error('status formatter signature marker was not found');
  const body = declaration.slice(bodyStart + FORMATTER_SIGNATURE_END.length, -2);

  // The extracted formatter is dependency-free by design. Executing precisely
  // this candidate-owned body prevents the harness from re-implementing the
  // predicate it is meant to test.
  return new Function('params', `'use strict';\n${body}`);
}

export default function () {
  const candidateSha = (manifest && manifest.candidateSha) || __ENV.OPENCLAW_CANDIDATE_SHA || '';
  const sourcePath =
    (manifest && manifest.sourceContract && manifest.sourceContract.path) ||
    'src/status/status-text.ts';
  const sourceRepo =
    (manifest && manifest.sourceContract && manifest.sourceContract.repository) ||
    'karmaterminal/openclaw';
  const started = Date.now();
  const evidence = {
    row: 'R-OBS-STATUS',
    candidate_sha: candidateSha,
    source_repository: sourceRepo,
    source_path: sourcePath,
    source_fetch_ok: false,
    source_sha256: null,
    formatter_extracted: false,
    active_continuation_line_present: false,
    clean_session_continuation_line_absent: false,
    ended: null,
    duration_ms: null,
  };
  let preconditionFailed = false;

  if (!/^[0-9a-f]{40}$/.test(candidateSha)) {
    fail(`R-OBS-STATUS requires a 40-character candidate SHA, got ${JSON.stringify(candidateSha)}`);
    preconditionFailed = true;
  }
  if (manifest) {
    const errors = validateManifest(manifest);
    if (errors.length > 0) {
      fail(`manifest validation failed: ${errors.join('; ')}`);
      preconditionFailed = true;
    }
  }

  if (preconditionFailed) {
    evidence.ended = new Date().toISOString();
    evidence.duration_ms = Date.now() - started;
    duration.add(evidence.duration_ms);
    console.log(`R_OBS_STATUS_EVIDENCE ${JSON.stringify(evidence)}`);
    return;
  }

  if (!prefetchedSource) {
    fail('runner did not provide exact candidate status source bytes');
  } else {
    const source = prefetchedSource;
    evidence.source_fetch_ok = true;
    evidence.source_sha256 = crypto.sha256(source, 'hex');
    try {
      const formatContinuationLine = extractFormatter(source);
      evidence.formatter_extracted = true;

      const clean = formatContinuationLine({
        maxChainLength: 8,
        chainCount: 0,
        pending: 0,
        staged: 0,
        volitional: 0,
      });
      const active = formatContinuationLine({
        maxChainLength: 8,
        chainCount: 1,
        pending: 0,
        staged: 0,
        volitional: 0,
      });

      evidence.clean_session_continuation_line_absent = clean === undefined;
      evidence.active_continuation_line_present = active === '🔄 Continuation: chain 1/8';
      if (!evidence.clean_session_continuation_line_absent) {
        fail('clean all-zero status state rendered a continuation line');
      }
      if (!evidence.active_continuation_line_present) {
        fail('active continuation state did not render the expected continuation line');
      }
    } catch (error) {
      fail(`candidate status formatter contract evaluation failed: ${error}`);
    }
  }

  evidence.ended = new Date().toISOString();
  evidence.duration_ms = Date.now() - started;
  duration.add(evidence.duration_ms);

  check(null, {
    'candidate source fetched': () => evidence.source_fetch_ok,
    'candidate formatter extracted': () => evidence.formatter_extracted,
    'active continuation line present': () => evidence.active_continuation_line_present,
    'clean session continuation line absent': () => evidence.clean_session_continuation_line_absent,
  });
  console.log(`R_OBS_STATUS_EVIDENCE ${JSON.stringify(evidence)}`);
}

export function handleSummary(data) {
  const failureMetric = data.metrics.proof_failures && data.metrics.proof_failures.values;
  const failuresCount = failureMetric ? failureMetric.count : 0;
  return {
    'r-obs-status-summary.json': JSON.stringify({
      row: 'R-OBS-STATUS',
      sha: __ENV.OPENCLAW_CANDIDATE_SHA || 'unset',
      verdict: failuresCount === 0 ? 'PASS-candidate' : 'BAD_PROOF',
      contract: 'issue-1172-continuation-status-line',
      metrics: {
        failures: failuresCount,
        duration_ms: data.metrics.r_obs_status_duration ? data.metrics.r_obs_status_duration.values : null,
      },
    }, null, 2),
  };
}
