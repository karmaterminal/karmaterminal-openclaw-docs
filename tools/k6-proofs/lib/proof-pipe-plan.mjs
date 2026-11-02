/**
 * The scheduled proof pipe's plan (docs#587; docs/PROOF-PIPE-DESIGN.md).
 *
 * Actions -> Temporal -> isolated proof gateway -> evidence lane -> docs PR.
 * Only the dry run is built. This module is the plan alone: every input
 * arrives as data that scripts/proof-pipe-dry-run.mjs read at exact SHAs, and
 * nothing here reads a file, starts a process or opens a socket.
 *
 * Names that must agree with temporal-thornfield-frond (its proofRunWorkflow,
 * planner and seat Activities at main 1bf4404e) are copied, not imported: that
 * repository is private and not a dependency of this one. Each copy names its
 * source.
 */
import { normalizeReceiptName, traceRequirement } from './continuation-trace-requirement.mjs';

export const PLAN_SCHEMA = 'openclaw.k6.proof-pipe-plan.v1';
export const HOLD_SCHEMA = 'openclaw.k6.proof-pipe-hold.v1';
/** The bugs-first hold, read at the pipeline's own commit and at the docs SHA. */
export const HOLD_PATH = 'tools/k6-proofs/proof-pipe/hold.json';
export const CATALOG_DIR = 'tools/k6-proofs/manifests';
export const PACKET_ROOT = 'PROOF-RUNS';
export const TRIGGERS = Object.freeze(['manual', 'nightly', 'on-deploy']);

export const EXIT = Object.freeze({
  PLANNED: 0,
  /** Input, allocation, consumption, catalog or cost refusal. */
  REFUSED: 2,
  /** dry_run=false while the hold is in effect. */
  HELD: 3,
  /** dry_run=false with the hold lifted: the live leg is not built. */
  LIVE_NOT_BUILT: 4,
});

// ttf src/contracts/proof-run.ts.
export const SHA40_RE = /^[0-9a-f]{40}$/;
export const SLUG_RE = /^[a-z0-9][a-z0-9-]{0,63}$/;
export const ROW_NAME_RE = /^[A-Za-z0-9][A-Za-z0-9._-]*$/;
export const SEAT_NAME_RE = /^[a-z0-9][a-z0-9-]*$/;
// ttf src/contracts/labels.ts KNOWN_SEATS (DEFAULT_PROOF_SEATS).
export const DEFAULT_PROOF_SEATS = Object.freeze(['silas', 'cael', 'ronan', 'elliott', 'emeric', 'rune']);
// ttf src/contracts/ids.ts.
export const ORCHESTRATOR_TASK_QUEUE = 'thornfield-orchestrator';
export const PROOF_WORKFLOW_TYPE = 'proofRunWorkflow';

/** The assembler lane's model (figs, docs#587, 2026-11-02). */
export const ASSEMBLER_MODEL = 'mai-code-2-flash';

/** Public files run-proofs.sh leaves in every live row's run directory. */
export const ROW_PUBLIC_FILES = Object.freeze([
  'run-result.json',
  'runner-metadata.json',
  'row-manifest.json',
  'row-scenario.js',
  'evidence-redaction.json',
  'evidence.jsonl',
  'evidence-lines.log',
  'k6.log',
  'gateway-journal.log',
  'gateway-journal-capture.json',
  'gateway-journal-redaction.json',
]);

/** Files a live row writes only on a named condition. */
export const ROW_CONDITIONAL_FILES = Object.freeze([
  { file: 'candidate-run-result.json', when: 'review completes (the candidate routing envelope)' },
  { file: 'verdict-reconciliation.json', when: 'the VU and handleSummary verdicts disagree' },
]);

/** What ttf's proofCollect adds per row (its receipts and the packet's row.json). */
export const COLLECTION_FILES = Object.freeze([
  'row.json',
  'receipts/tempo-fetch.stdout.json',
  'receipts/tempo-fetch.stderr.log',
  'receipts/validation.stdout.json',
  'receipts/validation.stderr.log',
]);

/** Run-level artifacts of one run-proofs.sh matrix. */
export const RUN_FILES = Object.freeze([
  'seat-readiness.json',
  'harness-provenance.json',
  'harness-provenance/<matrix-id>.json',
  'catalog-preflight.log',
  'report.html',
  'report-receipt.json',
]);

/** Paths the assembler lane may never write. */
export const ASSEMBLER_FORBIDDEN = Object.freeze(['PROOFS/INDEX.json', 'PROOFS/**', 'tools/**', '.github/**', 'RUNBOOKS/**']);

const OPERATOR_NO_HOLD = new Set(['', 'false', '0', 'off', 'no']);
const RENTED_LABEL = /^(ubuntu|windows|macos)-|^blacksmith-/iu;
const ARC_SCALE_SET = /^oc-[a-z0-9-]+$/u;

/** One line, bounded: text from a committed file or a manifest, shown in a reason. */
function oneLine(value, max = 240) {
  return String(value).replace(/\s+/gu, ' ').trim().slice(0, max);
}

function shown(value) {
  return oneLine(JSON.stringify(value) ?? 'undefined', 80);
}

function named(value) {
  return typeof value === 'string' && value.trim() !== '';
}

/** ttf src/sdlc/proof-run.ts isStaticOwner. */
export function isStaticOwner(owner) {
  return owner === 'static' || owner.endsWith('-static');
}

/** ttf src/seat/proof-run.ts stagingRef, by way of proofStateDir's safe id. */
export function workflowIdSafe(workflowId) {
  return workflowId.replace(/[^a-zA-Z0-9._-]/gu, '_');
}

/**
 * The dispatch inputs, checked before anything is read: their SHAs reach git
 * and their names reach paths. `raw` holds strings or undefined.
 */
export function parsePipeInput(raw) {
  if (raw.productSha === undefined) return { problem: 'product-sha is required' };
  if (raw.docsSha === undefined) return { problem: 'docs-sha is required' };
  for (const [name, value] of [['product-sha', raw.productSha], ['docs-sha', raw.docsSha], ['corpus-sha', raw.corpusSha]]) {
    if (value !== undefined && !SHA40_RE.test(value)) return { problem: `${name} must be a 40-character lowercase hex SHA` };
  }
  let dryRun = true;
  if (raw.dryRun !== undefined) {
    if (raw.dryRun !== 'true' && raw.dryRun !== 'false') return { problem: 'dry-run must be exactly true or false' };
    dryRun = raw.dryRun === 'true';
  }
  const trigger = raw.trigger ?? 'manual';
  if (!TRIGGERS.includes(trigger)) return { problem: `trigger must be one of ${TRIGGERS.join(', ')}` };
  const label = raw.label ?? `${trigger}-${raw.docsSha.slice(0, 8)}`;
  if (!SLUG_RE.test(label)) return { problem: 'label must be a lowercase slug' };

  const rowsText = raw.rows ?? 'all';
  let rows;
  if (rowsText === 'all') rows = { kind: 'all' };
  else if (rowsText.startsWith('owner:')) {
    const owner = rowsText.slice('owner:'.length);
    if (!SEAT_NAME_RE.test(owner)) return { problem: `unsafe owner name: ${shown(owner)}` };
    rows = { kind: 'owner', owner };
  } else {
    const list = rowsText.split(',').map((row) => row.trim());
    for (const row of list) if (!ROW_NAME_RE.test(row)) return { problem: `unsafe row name: ${shown(row)}` };
    if (new Set(list).size !== list.length) return { problem: 'a row is named twice in rows' };
    rows = { kind: 'list', rows: list };
  }

  let proofSeats = [...DEFAULT_PROOF_SEATS];
  if (raw.proofSeats !== undefined) {
    proofSeats = [...new Set(raw.proofSeats.split(',').map((seat) => seat.trim()).filter(Boolean))];
    if (proofSeats.length === 0) return { problem: 'proof-seats names no seat' };
    for (const seat of proofSeats) {
      if (!SEAT_NAME_RE.test(seat)) return { problem: `${shown(seat)} is not a seat name` };
      if (isStaticOwner(seat)) return { problem: `${seat} is a static owner, never a proof seat` };
    }
  }

  return {
    input: {
      productSha: raw.productSha,
      docsSha: raw.docsSha,
      corpusSha: raw.corpusSha ?? raw.productSha,
      pure: raw.corpusSha !== undefined && raw.corpusSha !== raw.productSha,
      dryRun,
      trigger,
      label,
      rows,
      proofSeats,
    },
  };
}

/**
 * The cost guard: ARC scale sets and self-hosted seats only, never a rented
 * runner. `raw` is the job's runs-on as JSON (an array of labels, or one
 * scale-set name); undefined is a local invocation, which rents nothing.
 */
export function costGuard(raw) {
  if (raw === undefined) return { ok: true, labels: null, reason: 'local invocation: no Actions runner' };
  let value;
  try {
    value = JSON.parse(raw);
  } catch {
    return { ok: false, labels: null, reason: 'cost guard: runner labels are not JSON' };
  }
  const labels = typeof value === 'string' ? [value] : value;
  if (!Array.isArray(labels) || labels.length === 0 || !labels.every(named)) {
    return { ok: false, labels: null, reason: 'cost guard: runner labels must be a non-empty JSON array of labels, or one ARC scale-set name' };
  }
  const rented = labels.find((label) => RENTED_LABEL.test(label));
  if (rented) return { ok: false, labels, reason: `cost guard: ${oneLine(rented, 64)} is a rented runner; ARC or self-hosted only` };
  if (labels.includes('self-hosted')) return { ok: true, labels, reason: 'self-hosted' };
  if (labels.every((label) => ARC_SCALE_SET.test(label))) return { ok: true, labels, reason: 'ARC scale set' };
  return { ok: false, labels, reason: 'cost guard: the runner is neither self-hosted nor an ARC scale set (oc-*)' };
}

/**
 * One hold source: the hold file's bytes at `ref` (undefined when absent).
 * It fails closed: only a well-formed file saying `held: false` and naming
 * who released it, where and when, is a release. Anything else is a hold.
 */
export function judgeHold(text, ref) {
  const held = (reason) => ({ ref, held: true, reason });
  if (text === undefined) return held(`no ${HOLD_PATH} at this ref: a missing hold is a hold`);
  let doc;
  try {
    doc = JSON.parse(text);
  } catch {
    return held(`${HOLD_PATH} is not JSON`);
  }
  if (!doc || typeof doc !== 'object' || Array.isArray(doc)) return held(`${HOLD_PATH} is not an object`);
  if (doc.schema !== HOLD_SCHEMA) return held(`${HOLD_PATH} schema is not ${HOLD_SCHEMA}`);
  if (doc.held !== true && doc.held !== false) return held(`held is ${shown(doc.held)}, not a boolean`);
  if (doc.held) return held(named(doc.reason) ? oneLine(doc.reason) : 'held');
  const release = doc.release;
  if (!release || typeof release !== 'object' || Array.isArray(release) || !named(release.by) || !named(release.ref) || !named(release.at)) {
    return held('held is false but no release authority is named (release.by, release.ref and release.at)');
  }
  return { ref, held: false, reason: `released by ${oneLine(release.by, 80)} (${oneLine(release.ref, 160)}, ${oneLine(release.at, 40)})` };
}

/**
 * The hold in effect: held when any source holds, or when the operator
 * variable (PROOF_PIPE_HOLD) asks for one. The variable only adds a hold; no
 * value of it lifts one.
 */
export function combineHold(sources, operatorValue) {
  const operatorHold = typeof operatorValue === 'string' && !OPERATOR_NO_HOLD.has(operatorValue.trim().toLowerCase());
  return { held: operatorHold || sources.some((source) => source.held), operatorHold, sources };
}

/**
 * Row authority: proofs-manifest.json::dispatch_allocation, which must cover
 * required_rows exactly once. The `supplemental` bucket (docs#613) is never a
 * firing bucket. Owners map rows to whoever fires them.
 */
export function resolveAllocation(manifest) {
  const required = manifest.required_rows;
  if (!Array.isArray(required) || required.length === 0 || !required.every((row) => typeof row === 'string')) {
    return { problem: 'required_rows must be a non-empty array of row names' };
  }
  for (const row of required) if (!ROW_NAME_RE.test(row)) return { problem: `unsafe row name in required_rows: ${shown(row)}` };
  if (new Set(required).size !== required.length) return { problem: 'required_rows contains a duplicate row' };

  const allocation = manifest.dispatch_allocation;
  if (allocation === undefined || allocation === null) return { problem: 'dispatch_allocation is missing: it is the sole firing authority' };
  const invalid = { problem: 'dispatch_allocation has an invalid shape' };
  /** [owner, row] in the manifest's own order. */
  const pairs = [];
  let supplemental = [];
  if (Array.isArray(allocation)) {
    for (const entry of allocation) {
      if (!entry || typeof entry !== 'object' || typeof entry.row !== 'string' || typeof entry.owner !== 'string') return invalid;
      if (entry.owner === 'supplemental') supplemental.push(entry.row);
      else pairs.push([entry.owner, entry.row]);
    }
  } else if (typeof allocation === 'object') {
    for (const [owner, rows] of Object.entries(allocation)) {
      if (!Array.isArray(rows) || !rows.every((row) => typeof row === 'string')) return invalid;
      if (owner === 'supplemental') supplemental = [...rows];
      else for (const row of rows) pairs.push([owner, row]);
    }
  } else return invalid;

  const requiredSet = new Set(required);
  const owners = new Map();
  const buckets = new Map();
  for (const [owner, row] of pairs) {
    if (!SEAT_NAME_RE.test(owner)) return { problem: `unsafe owner name: ${shown(owner)}` };
    if (!ROW_NAME_RE.test(row)) return { problem: `unsafe row name in dispatch_allocation: ${shown(row)}` };
    if (!requiredSet.has(row)) return { problem: `unknown row allocated: ${row}` };
    if (owners.has(row)) return { problem: `row allocated twice: ${row}` };
    owners.set(row, owner);
    if (!buckets.has(owner)) buckets.set(owner, []);
    buckets.get(owner).push(row);
  }
  for (const row of required) if (!owners.has(row)) return { problem: `row allocated to no owner: ${row}` };
  return { required, owners, buckets, supplemental };
}

/** The rows a trigger names, in the manifest's order. */
export function selectRows(rows, allocation) {
  if (rows.kind === 'all') return { rows: [...allocation.required] };
  if (rows.kind === 'owner') {
    const bucket = allocation.buckets.get(rows.owner);
    if (!bucket) return { problem: `no firing bucket named ${rows.owner} in dispatch_allocation` };
    return { rows: [...bucket] };
  }
  for (const row of rows.rows) if (!allocation.owners.has(row)) return { problem: `row is outside required_rows: ${row}` };
  return { rows: [...rows.rows] };
}

/** How a selected row would be handled: fired on its seat, validated on the orchestrator, or not run. */
export function rowDisposition(row, owner, proofSeats) {
  if (isStaticOwner(owner)) return { row, owner, seat: null, disposition: 'orchestrator-static', debt: 'static-validator-orchestrator' };
  if (!proofSeats.includes(owner)) return { row, owner, seat: null, disposition: 'not-run', debt: `owner-not-a-proof-seat (${owner})` };
  return { row, owner, seat: owner, disposition: 'fire' };
}

/** A thornfield packet row state that proves a fire happened. */
function packetStateConsumed(state) {
  return typeof state === 'string' && (state.startsWith('candidate:') || state === 'collected' || state === 'debt');
}

/**
 * Whether a row may fire: only on affirmative evidence that it never has.
 *
 * The corpus row must say `fired: false`, with no test cases, no
 * `possibly_consumed` marker and no state but `missing` (a folded `missing`
 * can follow a fire: F′'s R-CD-3). A `refires[]` entry, or any prior thornfield
 * packet row for the candidate or the corpus in a state other than `not-run`,
 * also consumes it. Anything unknown is possibly consumed.
 */
export function rowConsumption(row, { corpusRows, refires, packets }) {
  const consumed = [];
  const possibly = [];
  const entries = corpusRows.filter((entry) => entry && typeof entry === 'object' && entry.row === row);
  if (entries.length === 0) possibly.push('no rows[] entry');
  if (entries.length > 1) possibly.push('more than one rows[] entry');
  for (const entry of entries) {
    if (entry.fired === true) consumed.push('fired: true');
    else if (entry.fired !== false) possibly.push(`fired is not false: ${shown(entry.fired)}`);
    if (Array.isArray(entry.test_cases_executed) && entry.test_cases_executed.length > 0) {
      consumed.push(`test_cases_executed ×${entry.test_cases_executed.length}`);
    }
    if (entry.possibly_consumed !== undefined && entry.possibly_consumed !== false) {
      possibly.push(`possibly_consumed: ${shown(entry.possibly_consumed)}`);
    }
    if (entry.state !== undefined && entry.state !== 'missing') consumed.push(`state ${typeof entry.state === 'string' ? oneLine(entry.state, 40) : shown(entry.state)}`);
  }
  if (refires.some((entry) => entry && typeof entry === 'object' && entry.row === row)) consumed.push('refires[]');
  for (const packet of packets) {
    if (packet.row !== row || packet.state === 'not-run') continue;
    const reason = `${packet.path} state ${typeof packet.state === 'string' ? oneLine(packet.state, 60) : shown(packet.state)}`;
    (packetStateConsumed(packet.state) ? consumed : possibly).push(reason);
  }
  if (consumed.length > 0) return { eligible: false, verdict: 'consumed', reasons: [...consumed, ...possibly] };
  if (possibly.length > 0) return { eligible: false, verdict: 'possibly consumed', reasons: possibly };
  return { eligible: true, verdict: 'unfired', reasons: [] };
}

/** Why the row-list runner would not fire a catalog row live, or undefined when it would. */
export function liveFireProblem(row, entries) {
  if (entries.length === 0) return `${row}: no catalog manifest at docs`;
  if (entries.length > 1) return `${row}: more than one catalog manifest (${entries.map((entry) => entry.path).join(', ')})`;
  const { manifest } = entries[0];
  const classification = manifest.liveRunSafety?.classification;
  if (classification !== 'k6-runnable') return `${row}: not k6-runnable (${typeof classification === 'string' ? oneLine(classification, 40) : 'no classification'})`;
  if (manifest.scenario?.status !== 'runnable') return `${row}: not k6-runnable (scenario ${shown(manifest.scenario?.status)})`;
  return undefined;
}

/** The receipts a fired row's run directory would hold, and the ones its manifest names. */
export function rowReceipts(row, manifest) {
  const trace = traceRequirement(manifest);
  const files = [...ROW_PUBLIC_FILES];
  if (trace.required) files.push('tempo-trace-<trace-id>.json');
  if (trace.correlationReceipt) files.push(`${trace.correlationReceipt}.json`);
  const declared = [
    ...(Array.isArray(manifest.liveRunSafety?.requiredReceipts) ? manifest.liveRunSafety.requiredReceipts : []),
    ...(Array.isArray(manifest.expectedReceipts) ? manifest.expectedReceipts.filter((r) => r?.required === true).map((r) => r.name) : []),
  ];
  const manifestReceipts = [...new Set(declared.filter((name) => typeof name === 'string').map(normalizeReceiptName))];
  return {
    row,
    files,
    conditional: ROW_CONDITIONAL_FILES.map((entry) => ({ ...entry })),
    collection: [...COLLECTION_FILES],
    manifestReceipts,
    trace: { required: trace.required, reasons: trace.reasons, receipts: trace.receipts },
    expectedArtifactClass: manifest.liveRunSafety?.expectedArtifactClass ?? null,
  };
}

/**
 * The plan: stages (a) to (e) with what each would do and collect. `refused`
 * is true when any guard refuses; the plan still names everything it found,
 * so the refusal is reviewable.
 */
export function buildPlan({ input, cost, hold, pipelineSha, manifest, manifestPath, manifestBlob, allocation, catalog, packets, packetsRead }) {
  const { productSha, docsSha, corpusSha, label } = input;
  const selection = selectRows(input.rows, allocation);
  if (selection.problem) return { problem: selection.problem };

  const rows = selection.rows.map((row) => rowDisposition(row, allocation.owners.get(row), input.proofSeats));
  const fireRows = rows.filter((row) => row.disposition === 'fire');
  const corpusRows = Array.isArray(manifest.rows) ? manifest.rows : [];
  const refires = Array.isArray(manifest.refires) ? manifest.refires : [];

  const refusedConsumed = [];
  const catalogProblems = [];
  const receipts = [];
  for (const row of fireRows) {
    const consumption = rowConsumption(row.row, { corpusRows, refires, packets });
    row.consumption = consumption.verdict;
    if (!consumption.eligible) refusedConsumed.push(`${row.row}: ${consumption.verdict} (${consumption.reasons.join('; ')})`);
    const entries = catalog.get(row.row) ?? [];
    const problem = liveFireProblem(row.row, entries);
    if (problem) catalogProblems.push(problem);
    else receipts.push({ ...rowReceipts(row.row, entries[0].manifest), catalogManifest: entries[0].path });
  }

  const workflowId = `proofs/${productSha}/${label}`;
  const safeId = workflowIdSafe(workflowId);
  const seats = [...new Set(fireRows.map((row) => row.seat))].map((seat) => {
    const seatRows = fireRows.filter((row) => row.seat === seat).map((row) => row.row);
    return {
      seat,
      taskQueue: `thornfield-proof-${seat}`,
      rows: seatRows,
      go: 'required',
      stageOnly: {
        repo: 'karmaterminal/openclaw-bootstrap',
        workflow: 'deploy-gateway.yml',
        inputs: 'stage_only=true (Path-B lane; no stop, cutover, config or timer change)',
        approvedRef: productSha,
        stageDir: `~/flesh_beast_tmp/.openclaw-path-b/stage-only/${productSha}`,
      },
      isolatedGateway: {
        dir: `~/proof-gw/comp-${corpusSha.slice(0, 8)}`,
        unit: `openclaw-proof-comp-${corpusSha.slice(0, 8)}`,
        binding: input.pure ? 'pure corpus SHA, composite runtime (BIND=pure; pure credit is a separate reviewed materiality judgment)' : 'exact: corpus SHA is the runtime SHA',
        ownerActs: ['setup', 'login', 'login-finish', 'adopt-auth', 'stop', 'shred'],
      },
      launcher: `bash <frond-scribe>/scripts/proof-gw/composite-launcher.sh run ${corpusSha} ${productSha} ${docsSha} ${seatRows.join(',')}`,
      stateDir: `~/.local/state/thornfield-frond/proof-runs/${safeId}/${seat}`,
      liveGateway: 'never touched: openclaw-gateway.service keeps its MainPID, start time and restart count',
    };
  });

  const packetDir = `${PACKET_ROOT}/${productSha}/<start-ts>-${label}`;
  const goFlags = seats.map((seat) => ` --go ${seat.seat}=<go message id>`).join('');
  const refusals = [];
  if (refusedConsumed.length > 0) {
    refusals.push(`${refusedConsumed.length} row${refusedConsumed.length === 1 ? '' : 's'} consumed or possibly consumed: ${refusedConsumed.map((r) => r.split(':')[0]).join(', ')}`);
  }
  refusals.push(...catalogProblems);
  if (fireRows.length === 0) refusals.push('no row to fire: every selected row is static or not on a proof seat (a run that does not fire is a failure)');

  const plan = {
    schema: PLAN_SCHEMA,
    dryRun: true,
    refused: refusals.length > 0,
    ...(refusals.length > 0 ? { problem: refusals.join('; ') } : {}),
    fired: 0,
    contacted: [],
    stages: {
      trigger: {
        kind: input.trigger,
        productSha,
        docsSha,
        corpusSha,
        pipelineSha,
        label,
        manifest: { path: manifestPath, blob: manifestBlob, captureSha: manifest.capture_sha ?? null },
        rows,
      },
      handoff: {
        actions: 'proof-pipe-dry-run.yml runs this planner only; the live leg (an Actions step that starts the Workflow through the installed thornfield CLI) is not built',
        thornfieldCli: `thornfield proofs run --candidate ${productSha} --docs-ref ${docsSha}${input.pure ? ` --pure ${corpusSha}` : ''} --rows ${fireRows.map((row) => row.row).join(',')} --label ${label}${goFlags}`,
        temporal: {
          workflowType: PROOF_WORKFLOW_TYPE,
          taskQueue: ORCHESTRATOR_TASK_QUEUE,
          workflowId,
          workflowIdReusePolicy: 'REJECT_DUPLICATE',
        },
        seats,
      },
      collection: {
        rows: receipts,
        run: [...RUN_FILES],
        stagingRefs: seats.map((seat) => `proof-runs-staging/${safeId}/${seat.seat}`),
        packet: { dir: packetDir, branch: `proof-runs/${productSha.slice(0, 8)}-<start-ts>`, files: ['RUN.md', 'run.json', '<ROW>/row.json'] },
        neverLeavesSeat: ['raw k6 log', 'raw gateway journal', 'raw Tempo/OTLP responses', '<artifact-dir>.private', 'openclaw.json', 'gateway token', 'model credentials'],
      },
      assembly: {
        lane: 'copilot',
        model: ASSEMBLER_MODEL,
        host: 'open decision: which seat hosts the assembler lane',
        brief: [
          'frond-scribe skills/build-openclaw-proof-corpus/SKILL.md',
          'tools/k6-proofs/CONTRIBUTING-ROWS.md',
          'tools/k6-proofs/docs/PROOF-PIPE-DESIGN.md',
        ],
        reads: `the packet branch proof-runs/${productSha.slice(0, 8)}-<start-ts>`,
        writes: [`${packetDir}/<ROW>/EVIDENCE.md`, `${packetDir}/ASSEMBLY.md`],
        forbidden: [...ASSEMBLER_FORBIDDEN],
        rules: [
          'copy the harness verdict exactly; never promote one',
          'a row with debt stays debt; never retro-justify a missing receipt',
          'no refire, no seat or gateway contact',
          're-scan every file it writes for secret shapes before the push',
        ],
        pr: { base: 'main', draft: true, title: `proof run evidence: ${productSha.slice(0, 8)} @ docs ${docsSha.slice(0, 8)} (candidate evidence only)` },
        candidateOnly: true,
        foldRequiresReview: true,
      },
      guards: {
        hold: { ...hold, effect: hold.held ? 'a live run would be refused; this dry run fires nothing either way' : 'released; this skeleton still refuses a live run' },
        rowAuthority: {
          manifest: manifestPath,
          blob: manifestBlob,
          owners: Object.fromEntries([...allocation.buckets].map(([owner, ownerRows]) => [owner, ownerRows.length])),
          supplementalExcluded: [...allocation.supplemental],
        },
        noRefire: {
          checked: fireRows.map((row) => row.row),
          refused: refusedConsumed,
          packetsRead: [...packetsRead],
          ledgerGaps: [
            'open proof-runs/* packet branches not merged at the docs SHA',
            `Temporal workflows proofs/${productSha}/* (read by the live leg, never by the dry run)`,
            'seat state under ~/.local/state/thornfield-frond/proof-runs/',
          ],
        },
        redaction: [
          'run-proofs.sh sanitizes evidence and the journal before a row directory is final',
          "ttf proofCollect copies only the sanitizer's named outputs and refuses a secret shape, a symlink or a changed file",
          'the assembler re-scans what it writes (not built)',
        ],
        exactSha: { productSha, docsSha, corpusSha, pipelineSha, manifestBlob },
        cost,
      },
    },
  };
  return { plan };
}

function line(label, value) {
  return `  ${label}: ${value}`;
}

/** The plan for a person: every stage, then the guards, then whether it was refused. */
export function renderPlan(plan) {
  const { trigger, handoff, collection, assembly, guards } = plan.stages;
  const out = [];
  out.push('proof pipe plan (docs#587)');
  out.push('DRY RUN: zero rows fired; no seat, gateway or Temporal contact');
  out.push('');
  out.push('(a) trigger');
  out.push(line('kind', trigger.kind));
  out.push(line('product SHA', trigger.productSha));
  out.push(line('docs SHA', trigger.docsSha));
  out.push(line('corpus SHA', trigger.corpusSha));
  out.push(line('pipeline SHA', trigger.pipelineSha));
  out.push(line('manifest', `${trigger.manifest.path} (blob ${trigger.manifest.blob})`));
  for (const row of trigger.rows) {
    const detail = row.disposition === 'fire' ? `fire on ${row.seat} (${row.consumption})` : `${row.disposition}: ${row.debt}`;
    out.push(`    ${row.row}: ${detail}`);
  }
  out.push('');
  out.push('(b) hand-off');
  out.push(line('would run', handoff.thornfieldCli));
  out.push(line('Temporal', `${handoff.temporal.workflowType} ${handoff.temporal.workflowId} on ${handoff.temporal.taskQueue} (${handoff.temporal.workflowIdReusePolicy})`));
  for (const seat of handoff.seats) {
    out.push(line(`seat ${seat.seat}`, `${seat.taskQueue}, go ${seat.go}, rows ${seat.rows.join(',')}`));
    out.push(`    stage-only: ${seat.stageOnly.workflow} ${seat.stageOnly.inputs} approved_ref=${seat.stageOnly.approvedRef}`);
    out.push(`    launcher: ${seat.launcher}`);
    out.push(`    isolated gateway: ${seat.isolatedGateway.dir} (${seat.isolatedGateway.unit}); live gateway ${seat.liveGateway}`);
  }
  out.push(line('not built', handoff.actions));
  out.push('');
  out.push('(c) collection');
  for (const row of collection.rows) {
    out.push(line(row.row, row.files.join(', ')));
    out.push(`    manifest receipts: ${row.manifestReceipts.join(', ') || 'none'}`);
  }
  out.push(line('run', collection.run.join(', ')));
  out.push(line('staging', collection.stagingRefs.join(', ') || 'none'));
  out.push(line('packet', `${collection.packet.dir} on ${collection.packet.branch}`));
  out.push('');
  out.push('(d) assembly');
  out.push(line('lane', `${assembly.lane} ${assembly.model} (${assembly.host})`));
  out.push(line('writes', assembly.writes.join(', ')));
  out.push(line('never writes', assembly.forbidden.join(', ')));
  out.push(line('PR', `${assembly.pr.title} (draft, into ${assembly.pr.base}); candidate evidence only, princes review`));
  out.push('');
  out.push('(e) guards');
  out.push(line('hold', `${guards.hold.held ? 'IN EFFECT' : 'released'}${guards.hold.operatorHold ? ' (PROOF_PIPE_HOLD)' : ''}: ${guards.hold.effect}`));
  for (const source of guards.hold.sources) out.push(`    ${source.ref}: ${source.held ? 'held' : 'released'} (${source.reason})`);
  out.push(line('row authority', `${guards.rowAuthority.manifest} blob ${guards.rowAuthority.blob}`));
  out.push(line('no refire', guards.noRefire.refused.length === 0 ? `${guards.noRefire.checked.length} rows unfired` : `${guards.noRefire.refused.length} refused`));
  for (const refused of guards.noRefire.refused) out.push(`    ${refused}`);
  out.push(line('cost', `${guards.cost.ok ? 'ok' : 'REFUSED'}: ${guards.cost.reason}`));
  out.push('');
  out.push(plan.refused ? `REFUSED: ${plan.problem}` : 'PLANNED: nothing fired');
  return `${out.join('\n')}\n`;
}
