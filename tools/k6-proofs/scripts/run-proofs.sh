#!/usr/bin/env bash
#
# Seat-aware row-list runner for Project 81 / k6-proofs
# References: #178 / #106 / #119 / #179 / #403 / #495 / #496
#
# Usage:
#   cd tools/k6-proofs
#   ./scripts/run-proofs.sh [--dry-run] [--out-dir /tmp/k6-proof-runs] \
#     [--docs-ref <40-hex>] [R-CD-2,R-CD-4] [candidate_sha]
#
# A live run binds itself to one immutable docs/harness commit before any row
# fires. --docs-ref (or OPENCLAW_PROOFS_DOCS_REF) is resolved and frozen once at
# startup; ambient HEAD is never re-read after rows have run.

set -euo pipefail

ORIGINAL_ARGS=("$@")

RUNNER_SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
RUNNER_SCRIPT_PATH="$RUNNER_SCRIPT_DIR/$(basename "${BASH_SOURCE[0]}")"
# The operator's checkout. Identity is always verified against this tree, even
# when this process is the re-executed snapshot copy of the runner.
if [[ -n "${OPENCLAW_PROOFS_ORIGIN_ROOT:-}" ]]; then
  REPO_ROOT="$OPENCLAW_PROOFS_ORIGIN_ROOT"
else
  REPO_ROOT="$(cd "$RUNNER_SCRIPT_DIR/../../.." && pwd)"
fi
PROOFS_TOOL_RELPATH="tools/k6-proofs"
# Every tree whose bytes a row can consume: the harness itself, the proof corpus
# that static rows read, and the workflow the catalog validators parse.
HARNESS_VERIFIED_PATHS=("tools/k6-proofs" "PROOFS" ".github")
# The tree harness components are executed from. For a live run this is replaced
# by an immutable snapshot of the approved docs ref (see bind_execution_roots).
EXEC_ROOT="$REPO_ROOT"
SCRIPT_DIR="$RUNNER_SCRIPT_DIR"
PROOFS_DIR="$(cd "$RUNNER_SCRIPT_DIR/.." && pwd)"
# Only ever set for a snapshot THIS process created, or one whose handoff has
# been fully authenticated. The EXIT trap removes it recursively, so an
# unauthenticated claimed path must never reach this variable.
HARNESS_SNAPSHOT_ROOT=""
HARNESS_SNAPSHOT_SENTINEL=".openclaw-harness-snapshot"
# Infrastructure exit code (EX_CONFIG). It is deliberately distinct from a row's
# effective exit code so a harness setup failure can never be read as a product
# verdict.
HARNESS_INFRA_EXIT=78
CATALOG_CHECKS=(check-manifest-scenarios.mjs check-scenario-alignment.mjs check-proof-row-manifests.mjs check-telemetry-contracts.mjs)
PRODUCER_PLAN_RESOLVER="$RUNNER_SCRIPT_DIR/resolve-producer-plan.mjs"
CATALOG_PRODUCER_RUNNER="$RUNNER_SCRIPT_DIR/run-catalog-producer.mjs"

# Point every executed harness component at the current execution root.
bind_execution_roots() {
  PROOFS_DIR="$EXEC_ROOT/$PROOFS_TOOL_RELPATH"
  SCRIPT_DIR="$PROOFS_DIR/scripts"
  EVIDENCE_EXTRACTOR="$SCRIPT_DIR/extract-k6-evidence.mjs"
  CONTINUATION_TRACE_COLLECTOR="$SCRIPT_DIR/collect-continuation-trace.mjs"
  R_CD_2_RECEIPT_RESOLVER="$SCRIPT_DIR/resolve-r-cd-2-authoritative-receipt.mjs"
  ARTIFACT_SANITIZER="$SCRIPT_DIR/sanitize-k6-artifacts.mjs"
  CANDIDATE_RESULT_VALIDATOR="$SCRIPT_DIR/validate-candidate-run-result.mjs"
  INTERRUPTED_RESULT_WRITER="$SCRIPT_DIR/write-interrupted-run-result.mjs"
  R_CD_TOKEN_RECEIPT_RESOLVER="$SCRIPT_DIR/resolve-r-cd-token-authoritative-receipt.mjs"
}
bind_execution_roots
PRIVATE_K6_LOG=""
PRIVATE_EVIDENCE_FILE=""
PRIVATE_GATEWAY_LOG=""
PRIVATE_PREREQ_STDOUT=""
PRIVATE_PREREQ_STDERR=""
SOURCE_CONTRACT_FILE=""
ACTIVE_TOKEN_RUN_DIR=""
ACTIVE_TOKEN_PHASE=""
ACTIVE_TOKEN_ATTEMPT_HASH=""
ACTIVE_TOKEN_NONCE_HASH=""
ACTIVE_TOKEN_CAUSE="runner-exit-before-terminal-result"

cleanup_private_artifacts() {
  rm -f \
    "${PRIVATE_K6_LOG:-}" \
    "${PRIVATE_EVIDENCE_FILE:-}" \
    "${PRIVATE_GATEWAY_LOG:-}" \
    "${PRIVATE_PREREQ_STDOUT:-}" \
    "${PRIVATE_PREREQ_STDERR:-}" \
    "${CATALOG_PREFLIGHT_RAW_FILE:-}" \
    "${SOURCE_CONTRACT_FILE:-}"
  if [[ -n "${HARNESS_SNAPSHOT_ROOT:-}" ]]; then rm -rf "$HARNESS_SNAPSHOT_ROOT"; fi
}

finalize_interrupted_token_run() {
  local exit_code=$?
  # ACTIVE_TOKEN_RUN_DIR is cleared only after the row's entire terminal packet
  # is complete.  If it is still set, even an already-created run-result may be
  # truncated or pre-terminal and must be superseded fail-closed.
  if [[ -n "${ACTIVE_TOKEN_RUN_DIR:-}" ]]; then
    if ! node "$INTERRUPTED_RESULT_WRITER" \
      --run-dir "$ACTIVE_TOKEN_RUN_DIR" \
      --row R-CD-TOKEN \
      --candidate-sha "$OPENCLAW_CANDIDATE_SHA" \
      --runtime-sha "$OPENCLAW_RUNTIME_BUILD_SHA" \
      --attempt-hash "$ACTIVE_TOKEN_ATTEMPT_HASH" \
      --nonce-hash "$ACTIVE_TOKEN_NONCE_HASH" \
      --phase "${ACTIVE_TOKEN_PHASE:-unknown}" \
      --cause "${ACTIVE_TOKEN_CAUSE:-runner-exit-before-terminal-result}"; then
      echo "[R-CD-TOKEN] ERROR: failed to persist interruption receipt at $ACTIVE_TOKEN_RUN_DIR" >&2
    fi
  fi
  cleanup_private_artifacts
  return "$exit_code"
}
trap finalize_interrupted_token_run EXIT
trap 'ACTIVE_TOKEN_CAUSE=signal-int; exit 130' INT
trap 'ACTIVE_TOKEN_CAUSE=signal-term; exit 143' TERM

DRY_RUN=true
ROWS=""
CANDIDATE_SHA=""
DOCS_REF_INPUT="${OPENCLAW_PROOFS_DOCS_REF:-}"
DOCS_REF=""
DOCS_REF_SOURCE="none"
DOCS_REPOSITORY=""
HARNESS_IDENTITY_VERIFIED=false
ROW_SELECTION_JSON='[]'
PROVISIONAL_RUN_DIR=""
ROWS_DISPATCHED=0
ROWS_TERMINAL_PRE_DISPATCH=0
MATRIX_EXIT_CODE=0
declare -a MATRIX_ROW_FAILURES=()
MATRIX_NONCE=""
declare -A ROW_MANIFEST_RELPATH=()
declare -A ROW_MANIFEST_SHA256=()
declare -A ROW_SCENARIO_RELPATH=()
declare -A ROW_SCENARIO_SHA256=()
SESSION_SELECTOR="discord-channel:1466192485440164011"
OUT_ROOT="${K6_PROOF_OUT_DIR:-/tmp/k6-proof-runs}"

while [[ "$#" -gt 0 ]]; do
  case $1 in
    --dry-run) DRY_RUN=true; shift ;;
    --live) DRY_RUN=false; shift ;;
    --session) SESSION_SELECTOR="$2"; shift 2 ;;
    --out-dir) OUT_ROOT="$2"; shift 2 ;;
    --docs-ref) DOCS_REF_INPUT="$2"; shift 2 ;;
    *)
      if [[ -z "$ROWS" ]]; then
        ROWS="$1"
      elif [[ -z "$CANDIDATE_SHA" ]]; then
        CANDIDATE_SHA="$1"
      else
        echo "Unknown argument: $1"
        exit 1
      fi
      shift
      ;;
  esac
done

if [[ -z "$ROWS" ]]; then
  echo "Error: must specify comma-separated list of rows (e.g. R-CD-2,R-CD-4) or 'all'."
  exit 1
fi

RUN_MODE="live"
if [[ "$DRY_RUN" == "true" ]]; then RUN_MODE="dry-run"; fi
ROW_SELECTION_JSON="$(printf '%s' "$ROWS" | jq -R 'split(",") | map(ascii_upcase)')"

mkdir -p "$OUT_ROOT"
OUT_ROOT="$(cd "$OUT_ROOT" && pwd)"
# The runner owns its own harness root. Row/scenario/manifest lookups are always
# relative to tools/k6-proofs, never to an ambient caller working directory.
cd "$PROOFS_DIR"

# Identity git calls must describe the real object store. refs/replace/* is
# honoured by default, so an ambient replacement object could let `rev-parse
# HEAD` report the approved SHA while `show`/`cat-file` served different bytes.
# Ambient GIT_DIR/GIT_WORK_TREE style overrides are cleared for the same reason.
harness_git() {
  env \
    -u GIT_DIR \
    -u GIT_WORK_TREE \
    -u GIT_INDEX_FILE \
    -u GIT_OBJECT_DIRECTORY \
    -u GIT_ALTERNATE_OBJECT_DIRECTORIES \
    -u GIT_COMMON_DIR \
    -u GIT_CEILING_DIRECTORIES \
    GIT_NO_REPLACE_OBJECTS=1 \
    git --no-replace-objects -C "$REPO_ROOT" "$@"
}

# Catalog code is executed by this runner, so it is run with an explicit minimal
# environment rather than an inherited one: no credential of any kind (gateway,
# provider, cloud, registry) can reach it, whatever it does. For a live run the
# harness identity gate has already proven these validators are the approved
# committed bytes.
run_with_minimal_env() {
  env -i \
    PATH="$PATH" \
    LANG="${LANG:-C}" \
    LC_ALL="${LC_ALL:-C}" \
    TMPDIR="${TMPDIR:-/tmp}" \
    "$@"
}

# Replace local filesystem locations with stable placeholders before any
# captured text becomes a public artifact.
scrub_public_text() {
  node -e '
    let data = "";
    process.stdin.setEncoding("utf8");
    process.stdin.on("data", (chunk) => { data += chunk; });
    process.stdin.on("end", () => {
      const replacements = [
        [process.argv[4], "<harness>"],
        [process.argv[1], "<repo-root>"],
        [process.argv[2], "<out-root>"],
        [process.argv[3], "<home>"],
      ];
      let out = data;
      for (const [value, placeholder] of replacements) {
        if (value && value.length > 4) out = out.split(value).join(placeholder);
      }
      process.stdout.write(out);
    });
  ' "$REPO_ROOT" "$OUT_ROOT" "${HOME:-}" "${EXEC_ROOT:-}"
}

# One harness infrastructure receipt. Only validated values reach this receipt:
# rejected operator input is recorded as "malformed", never echoed.
write_harness_control_receipt() {
  local stage="$1"
  local reason="$2"
  local detail_json="${3:-null}"
  local recorded_at
  recorded_at="$(date -u +%Y-%m-%dT%H:%M:%SZ)"
  mkdir -p "$OUT_ROOT"
  jq -n \
    --arg stage "$stage" \
    --arg reason "$reason" \
    --arg mode "$RUN_MODE" \
    --arg docsRef "$DOCS_REF" \
    --arg docsRefInput "$(safe_sha_or_marker "$DOCS_REF_INPUT")" \
    --arg candidate "$(safe_sha_or_marker "${OPENCLAW_CANDIDATE_SHA:-}")" \
    --arg repository "$(safe_repository_or_marker "$DOCS_REPOSITORY")" \
    --arg recordedAt "$recorded_at" \
    --argjson exitCode "$HARNESS_INFRA_EXIT" \
    --argjson rowsExecuted "${ROWS_DISPATCHED:-0}" \
    --argjson rowsTerminatedPreDispatch "${ROWS_TERMINAL_PRE_DISPATCH:-0}" \
    --argjson rowSelection "$(safe_row_selection_json)" \
    --argjson detail "$detail_json" \
    '{
      schema: "openclaw.k6.harness-control-receipt.v1",
      classification: "harness-infrastructure",
      ok: false,
      stage: $stage,
      reason: $reason,
      mode: $mode,
      docsRef: (if $docsRef == "" then null else $docsRef end),
      docsRefRequested: (if $docsRefInput == "" then null else $docsRefInput end),
      candidateSha: (if $candidate == "" then null else $candidate end),
      repository: (if $repository == "" then null else $repository end),
      rowSelection: $rowSelection,
      rowsExecuted: $rowsExecuted,
      rowsTerminatedPreDispatch: $rowsTerminatedPreDispatch,
      rowVerdictsSynthesized: false,
      rowResultsPresent: ($rowsExecuted > 0 or $rowsTerminatedPreDispatch > 0),
      productVerdict: null,
      exitCode: $exitCode,
      detail: $detail,
      recordedAt: $recordedAt
    }' > "$OUT_ROOT/harness-control-receipt.json"
  echo "HARNESS INFRASTRUCTURE FAILURE [$stage]: $reason" >&2
  echo "CONTROL RECEIPT: $OUT_ROOT/harness-control-receipt.json" >&2
  echo "Row executions before this failure: ${ROWS_DISPATCHED:-0}; pre-dispatch terminal results: ${ROWS_TERMINAL_PRE_DISPATCH:-0}." >&2
}

export_run_metrics() {
  local row_id="$1"
  local run_dir="$2"
  local metrics_args=(--run-dir "$run_dir" --prometheus-out "$run_dir/openclaw-proofs-k6.prom" --otlp-out "$run_dir/openclaw-proofs-k6.otlp.json")
  if [[ -n "${OPENCLAW_PROOFS_K6_OTLP_ENDPOINT:-}" ]]; then
    metrics_args+=(--push-otlp "$OPENCLAW_PROOFS_K6_OTLP_ENDPOINT")
  fi
  if node scripts/export-row-metrics.mjs "${metrics_args[@]}" > "$run_dir/metrics-export.json"; then
    echo "[$row_id] METRICS: $run_dir/openclaw-proofs-k6.prom"
  else
    echo "[$row_id] METRICS EXPORT FAILED; see $run_dir/metrics-export.json" >&2
    if [[ "${OPENCLAW_PROOFS_K6_METRICS_REQUIRED:-false}" == "true" ]]; then
      exit 1
    fi
  fi
}

safe_sha_or_marker() {
  if [[ "$1" =~ ^[0-9a-f]{40}$ ]]; then printf '%s' "$1"
  elif [[ -n "$1" ]]; then printf 'malformed'
  fi
}

safe_repository_or_marker() {
  if [[ "$1" =~ ^[A-Za-z0-9_.-]+/[A-Za-z0-9_.-]+$ ]]; then printf '%s' "$1"
  elif [[ -n "$1" ]]; then printf 'malformed'
  fi
}

safe_row_id_or_marker() {
  local row_pattern='^[A-Z0-9][A-Z0-9._-]*$'
  if [[ "$1" =~ $row_pattern ]]; then printf '%s' "$1"
  elif [[ -n "$1" ]]; then printf 'malformed'
  fi
}

safe_row_selection_json() {
  jq -c 'map(if test("^[A-Z0-9][A-Z0-9._-]*$") then . else "malformed" end)' <<< "$ROW_SELECTION_JSON"
}

# Product version stamps are public, but they come from external process output.
# Anything that is not an exact SHA or a conservative version string is withheld.
safe_runtime_stamp() {
  local sha_pattern='^[0-9a-f]{40}$'
  local version_pattern='^[A-Za-z0-9][A-Za-z0-9 ()._-]*$'
  if [[ "$1" =~ $sha_pattern || "$1" =~ $version_pattern ]]; then printf '%s' "$1"
  elif [[ -n "$1" ]]; then printf 'unverified'
  fi
}

fail_harness() {
  # A pre-execution infrastructure failure can happen after a run directory was
  # created but before the row dispatched. That directory holds no candidate
  # evidence, so it is removed and the interruption writer is disarmed: the
  # control receipt's rowsExecuted:0 must stay literally true.
  if [[ -n "${PROVISIONAL_RUN_DIR:-}" ]]; then
    rm -rf "$PROVISIONAL_RUN_DIR"
    PROVISIONAL_RUN_DIR=""
  fi
  ACTIVE_TOKEN_RUN_DIR=""
  write_harness_control_receipt "$1" "$2" "${3:-null}"
  exit "$HARNESS_INFRA_EXIT"
}

if [[ -z "$CANDIDATE_SHA" && -z "${OPENCLAW_CANDIDATE_SHA:-}" ]]; then
  CANDIDATE_SHA="$(harness_git rev-parse HEAD 2>/dev/null || echo 'unknown')"
fi

if [[ -n "$CANDIDATE_SHA" ]]; then export OPENCLAW_CANDIDATE_SHA="${CANDIDATE_SHA}"; fi
export OPENCLAW_SEAT_NAME="$(hostname)"

# Portable observability endpoints. Defaults preserve the dandelion fleet, but
# reviewers can override without editing scripts or docs-local config.
export OPENCLAW_PROOFS_TEMPO_BASE_URL="${OPENCLAW_PROOFS_TEMPO_BASE_URL:-${TEMPO_BASE_URL:-http://tempo.dandelion.cult}}"
export OPENCLAW_PROOFS_LOKI_BASE_URL="${OPENCLAW_PROOFS_LOKI_BASE_URL:-${LOKI_BASE_URL:-http://loki.dandelion.cult}}"
export OPENCLAW_PROOFS_PROMETHEUS_BASE_URL="${OPENCLAW_PROOFS_PROMETHEUS_BASE_URL:-${PROMETHEUS_BASE_URL:-http://prometheus.dandelion.cult}}"

echo "=========================================================="
echo "Project 81: Seat-Aware k6 Proof Runner"
echo "Seat: $OPENCLAW_SEAT_NAME"
echo "Target Candidate SHA: $OPENCLAW_CANDIDATE_SHA"
echo "Artifact root: $OUT_ROOT"


echo "Row selection: $ROWS"
echo "Dry Run: $DRY_RUN"
echo "=========================================================="

# ---------------------------------------------------------------------------
# Immutable harness identity (#496)
# ---------------------------------------------------------------------------
# Locate the manifest for a row id, echoing its tools/k6-proofs-relative path.
find_manifest_relpath() {
  local row="$1" candidate
  for candidate in manifests/*.json; do
    if jq -e --arg row "$row" '(.rowId | ascii_upcase) == $row' "$candidate" >/dev/null; then
      printf '%s' "$candidate"
      return 0
    fi
  done
  return 1
}

# Public-safe repository identity. Only a real remote (scheme or scp form) is
# accepted so a local clone path can never leak into a public receipt.
resolve_docs_repository() {
  local override url
  override="${OPENCLAW_PROOFS_DOCS_REPOSITORY:-}"
  if [[ -n "$override" ]]; then
    printf '%s' "$override"
    return 0
  fi
  url="$(harness_git config --get remote.origin.url 2>/dev/null || true)"
  case "$url" in
    *://*|*@*:*) ;;
    *) return 0 ;;
  esac
  url="${url%.git}"
  url="${url%/}"
  local slug
  slug="$(printf '%s' "$url" | sed -nE 's#^.*[:/]([A-Za-z0-9_.-]+)/([A-Za-z0-9_.-]+)$#\1/\2#p')"
  printf '%s' "$slug"
}

# sha256 of the bytes tracked at the frozen docs ref, or failure when the path is
# untracked at that commit.
tracked_blob_sha256() {
  local relpath="$1"
  harness_git cat-file -e "$DOCS_REF:$relpath" 2>/dev/null || return 1
  harness_git show "$DOCS_REF:$relpath" 2>/dev/null | sha256sum | cut -d' ' -f1
}

# Byte-integrity verification of every tracked file under tools/k6-proofs.
#
# `git status` is deliberately NOT used: it consults the index, so
# assume-unchanged / skip-worktree entries or preserved stat metadata can hide a
# modified file. Hashing the working-tree bytes with `git hash-object` and
# comparing against the blob names recorded in the approved commit cannot be
# suppressed that way. `--stdin-paths` keeps this to one process for the whole
# tree, so it is cheap enough to re-assert before every row.
harness_tree_listing() {
  harness_git ls-tree -r "$DOCS_REF" -- "${HARNESS_VERIFIED_PATHS[@]}" 2>/dev/null || true
}

assert_harness_tree_matches_docs_ref() {
  local check="$1"
  local phase="$2"
  local row="$3"
  local root="${4:-$REPO_ROOT}"
  local listing expected_objects paths actual_objects
  listing="$(harness_tree_listing)"
  if [[ -z "$listing" ]]; then
    fail_harness \
      "harness-identity" \
      "the approved docs ref records no ${HARNESS_VERIFIED_PATHS[*]} trees; refusing to fire an unrecorded harness" \
      "$(jq -n --arg check "$check" --arg phase "$phase" --arg row "$row" \
        '{check:$check, phase:$phase, row:(if $row == "" then null else $row end), reason:"empty-tree-listing"}')"
  fi
  expected_objects="$(printf '%s\n' "$listing" | cut -f1 | awk '{print $3}')"
  paths="$(printf '%s\n' "$listing" | cut -f2- | awk -v root="$root" '{print root "/" $0}')"
  # --no-filters: a configured clean filter would otherwise be able to transform
  # dirty bytes into the approved blob hash, and would itself execute here.
  actual_objects="$(printf '%s\n' "$paths" | harness_git hash-object --no-filters --stdin-paths 2>/dev/null || true)"
  if [[ "$expected_objects" != "$actual_objects" ]]; then
    local expected_count actual_count
    expected_count="$(printf '%s\n' "$expected_objects" | grep -c . || true)"
    actual_count="$(printf '%s\n' "$actual_objects" | grep -c . || true)"
    fail_harness \
      "harness-identity" \
      "bytes under ${HARNESS_VERIFIED_PATHS[*]} do not match the approved docs ref; refusing to fire a mutated or mixed harness" \
      "$(jq -n \
        --arg check "$check" \
        --arg phase "$phase" \
        --arg row "$row" \
        --arg expectedFiles "$expected_count" \
        --arg hashedFiles "$actual_count" \
        '{check:$check, phase:$phase, row:(if $row == "" then null else $row end),
          trackedFiles:($expectedFiles|tonumber), hashedFiles:($hashedFiles|tonumber)}')"
  fi
}

# Hash the bytes that will actually execute (the snapshot for a live run).
exec_sha256() {
  sha256sum "$EXEC_ROOT/$1" 2>/dev/null | cut -d' ' -f1
}

# The digests are frozen once at startup, but k6 and the scenario read the
# working tree at row time, and a scenario also imports tools/k6-proofs/lib/*.
# Re-assert both the row's own bytes and the cleanliness of every tracked byte
# under tools/k6-proofs at each step that can still change what executes, so a
# mid-matrix mutation fails closed as infrastructure instead of producing a
# receipt for unapproved source.
assert_row_bytes_frozen() {
  local row="$1"
  local phase="$2"
  local manifest_rel="${ROW_MANIFEST_RELPATH[$row]:-}"
  local scenario_rel="${ROW_SCENARIO_RELPATH[$row]:-}"
  local expected_manifest="${ROW_MANIFEST_SHA256[$row]:-}"
  local expected_scenario="${ROW_SCENARIO_SHA256[$row]:-}"
  if [[ -z "$manifest_rel" || -z "$scenario_rel" || -z "$expected_manifest" || -z "$expected_scenario" ]]; then
    fail_harness \
      "harness-identity" \
      "row $row has no frozen manifest/scenario digest bound to the approved docs ref" \
      "$(jq -n --arg row "$row" --arg phase "$phase" '{check:"row-bound-to-docs-ref", row:$row, phase:$phase}')"
  fi
  local actual_manifest actual_scenario
  actual_manifest="$(exec_sha256 "$manifest_rel" || true)"
  actual_scenario="$(exec_sha256 "$scenario_rel" || true)"
  if [[ -z "$actual_manifest" || -z "$actual_scenario" ||
        "$actual_manifest" != "$expected_manifest" || "$actual_scenario" != "$expected_scenario" ]]; then
    fail_harness \
      "harness-identity" \
      "row $row harness bytes changed after the approved docs ref was frozen; refusing to execute unapproved source" \
      "$(jq -n \
        --arg row "$row" \
        --arg phase "$phase" \
        --argjson manifestChanged "$(if [[ "$actual_manifest" != "$expected_manifest" ]]; then printf 'true'; else printf 'false'; fi)" \
        --argjson scenarioChanged "$(if [[ "$actual_scenario" != "$expected_scenario" ]]; then printf 'true'; else printf 'false'; fi)" \
        '{check:"frozen-bytes-still-current", row:$row, phase:$phase, manifestChanged:$manifestChanged, scenarioChanged:$scenarioChanged}')"
  fi
  # The executed bytes live in an immutable snapshot, so this re-verification of
  # the operator's checkout exists for a different reason: bash reads this very
  # script incrementally, so run-proofs.sh itself must still match the approved
  # ref while it is running.
  assert_harness_tree_matches_docs_ref "harness-tree-still-current" "$phase" "$row" "$REPO_ROOT"
  if [[ "$EXEC_ROOT" != "$REPO_ROOT" ]]; then
    assert_harness_tree_matches_docs_ref "harness-snapshot-still-current" "$phase" "$row" "$EXEC_ROOT"
  fi
}

assert_copied_artifact_frozen() {
  local row="$1"
  local artifact="$2"
  local expected="$3"
  local actual
  actual="$(sha256sum "$artifact" 2>/dev/null | cut -d' ' -f1 || true)"
  if [[ -z "$actual" || "$actual" != "$expected" ]]; then
    fail_harness \
      "harness-identity" \
      "row $row captured artifact $(basename "$artifact") does not match its frozen digest" \
      "$(jq -n --arg row "$row" --arg artifact "$(basename "$artifact")" '{check:"captured-artifact-matches-frozen-digest", row:$row, artifact:$artifact}')"
  fi
}

DOCS_REPOSITORY="$(resolve_docs_repository)"

if [[ "$DRY_RUN" == "false" ]]; then
  if [[ ! "$DOCS_REF_INPUT" =~ ^[0-9a-f]{40}$ ]]; then
    fail_harness \
      "harness-identity" \
      "a live matrix requires an approved docs/harness ref: pass --docs-ref <40-char-lowercase-sha> or set OPENCLAW_PROOFS_DOCS_REF" \
      "$(jq -n --arg provided "$DOCS_REF_INPUT" '{check:"docs-ref-shape", provided:(if $provided == "" then null else "malformed" end)}')"
  fi  # Frozen for the whole run. Ambient HEAD is never consulted again.
  DOCS_REF="$DOCS_REF_INPUT"
  DOCS_REF_SOURCE="approved-input"
  readonly DOCS_REF

  HEAD_SHA="$(harness_git rev-parse HEAD 2>/dev/null || true)"
  if [[ "$HEAD_SHA" != "$DOCS_REF" ]]; then
    fail_harness \
      "harness-identity" \
      "harness checkout does not match the approved docs ref; refusing to fire a stale or mixed harness" \
      "$(jq -n --arg head "$HEAD_SHA" --arg approved "$DOCS_REF" '{check:"head-equals-docs-ref", head:(if $head == "" then null else $head end), approved:$approved}')"
  fi

  assert_harness_tree_matches_docs_ref "harness-tree-clean" "startup" "" "$REPO_ROOT"

  if [[ ! "${OPENCLAW_CANDIDATE_SHA:-}" =~ ^[0-9a-f]{40}$ ]]; then
    fail_harness \
      "harness-identity" \
      "a live matrix requires an exact 40-character lowercase candidate SHA; unvalidated input must not reach artifact paths or metadata" \
      "$(jq -n '{check:"candidate-sha-shape"}')"
  fi

  if [[ ! "$DOCS_REPOSITORY" =~ ^[A-Za-z0-9_.-]+/[A-Za-z0-9_.-]+$ ]]; then
    fail_harness \
      "harness-identity" \
      "no public-safe repository identity for the harness; set OPENCLAW_PROOFS_DOCS_REPOSITORY=<owner>/<repo>" \
      "$(jq -n '{check:"repository-identity"}')"
  fi

  # Everything executed from here on comes out of an immutable extract of the
  # approved commit, not the operator's mutable working tree. This closes the
  # check-then-use window for the catalog validators, seat readiness, k6, and
  # every scenario import: those bytes cannot change while the matrix runs.
  #
  # That includes this script. Bash reads its source incrementally, so the only
  # way the remaining commands are guaranteed to be approved bytes is to hand
  # execution to the snapshot's own copy before any credential is loaded.
  if [[ -z "${OPENCLAW_PROOFS_HARNESS_SNAPSHOT:-}" ]]; then
    # Created here, so this process owns its cleanup from the moment it exists.
    HARNESS_SNAPSHOT_ROOT="$(mktemp -d "${TMPDIR:-/tmp}/openclaw-k6-harness.XXXXXX")"
    chmod 700 "$HARNESS_SNAPSHOT_ROOT"
    # Every consumed tree is materialized, not referenced: static rows read the
    # proof corpus during k6 execution, so a symlink back to the operator's
    # checkout would leave exactly the check-then-use hole the snapshot exists
    # to close. The full corpus extracts in about a second.
    if ! harness_git archive "$DOCS_REF" -- "${HARNESS_VERIFIED_PATHS[@]}" | tar -x -C "$HARNESS_SNAPSHOT_ROOT"; then
      fail_harness \
        "harness-identity" \
        "the approved ${HARNESS_VERIFIED_PATHS[*]} trees could not be extracted for immutable execution" \
        "$(jq -n '{check:"harness-snapshot-extractable"}')"
    fi
    # An unguessable ownership sentinel. Only a process that was handed this
    # value may adopt (and therefore later delete) the snapshot.
    HARNESS_SNAPSHOT_TOKEN="$(tr -d '-' < /proc/sys/kernel/random/uuid 2>/dev/null || printf '%04x%04x%04x%04x' "$RANDOM" "$RANDOM" "$RANDOM" "$RANDOM")"
    (umask 077; printf '%s' "$HARNESS_SNAPSHOT_TOKEN" > "$HARNESS_SNAPSHOT_ROOT/$HARNESS_SNAPSHOT_SENTINEL")
    export OPENCLAW_PROOFS_HARNESS_SNAPSHOT="$HARNESS_SNAPSHOT_ROOT"
    export OPENCLAW_PROOFS_HARNESS_SNAPSHOT_TOKEN="$HARNESS_SNAPSHOT_TOKEN"
    export OPENCLAW_PROOFS_ORIGIN_ROOT="$REPO_ROOT"
    echo "Harness execution: handing off to the approved runner in an immutable snapshot."
    # `exec` replaces this process, so no EXIT trap fires here and the snapshot
    # survives into the approved runner, which owns its cleanup.
    exec bash "$HARNESS_SNAPSHOT_ROOT/$PROOFS_TOOL_RELPATH/scripts/run-proofs.sh" \
      "${ORIGINAL_ARGS[@]}" --out-dir "$OUT_ROOT"
  fi

  # Re-executed copy. The handoff variables are ambient input, so before any of
  # it is trusted this process must prove that it really is the snapshot's own
  # runner and that the snapshot is a distinct tree from the checkout. Otherwise
  # a modified external copy could set both variables, point them at clean
  # trees, skip the exec, and keep running.
  # The claimed path stays untrusted — and therefore NOT cleanup-owned — until
  # every check below passes. Assigning it to HARNESS_SNAPSHOT_ROOT early would
  # let a rejected handoff hand an arbitrary directory to the EXIT trap's rm -rf.
  CLAIMED_SNAPSHOT_ROOT="$OPENCLAW_PROOFS_HARNESS_SNAPSHOT"
  CLAIMED_SNAPSHOT_TOKEN="${OPENCLAW_PROOFS_HARNESS_SNAPSHOT_TOKEN:-}"
  SNAPSHOT_RUNNER="$(readlink -f "$CLAIMED_SNAPSHOT_ROOT/$PROOFS_TOOL_RELPATH/scripts/run-proofs.sh" 2>/dev/null || true)"
  EXECUTING_RUNNER="$(readlink -f "$RUNNER_SCRIPT_PATH" 2>/dev/null || true)"
  CANONICAL_SNAPSHOT="$(readlink -f "$CLAIMED_SNAPSHOT_ROOT" 2>/dev/null || true)"
  CANONICAL_ORIGIN="$(readlink -f "$REPO_ROOT" 2>/dev/null || true)"
  SENTINEL_VALUE="$(cat "$CLAIMED_SNAPSHOT_ROOT/$HARNESS_SNAPSHOT_SENTINEL" 2>/dev/null || true)"
  if [[ -z "$SNAPSHOT_RUNNER" || -z "$EXECUTING_RUNNER" || "$EXECUTING_RUNNER" != "$SNAPSHOT_RUNNER" ||
        -z "$CANONICAL_SNAPSHOT" || -z "$CANONICAL_ORIGIN" ||
        "$CANONICAL_SNAPSHOT" == "$CANONICAL_ORIGIN" || "$CANONICAL_SNAPSHOT" == "$CANONICAL_ORIGIN"/* ||
        -z "$CLAIMED_SNAPSHOT_TOKEN" || "$SENTINEL_VALUE" != "$CLAIMED_SNAPSHOT_TOKEN" ]]; then
    fail_harness \
      "harness-identity" \
      "the executing runner is not the approved snapshot's own runner; refusing a spoofed or aliased handoff" \
      "$(jq -n '{check:"snapshot-handoff-authentic"}')"
  fi
  EXEC_ROOT="$CLAIMED_SNAPSHOT_ROOT"
  bind_execution_roots
  cd "$PROOFS_DIR"
  assert_harness_tree_matches_docs_ref "harness-snapshot-matches-docs-ref" "startup" "" "$EXEC_ROOT"
  # Authenticated and verified: this process may now own its removal.
  HARNESS_SNAPSHOT_ROOT="$CLAIMED_SNAPSHOT_ROOT"

  HARNESS_IDENTITY_VERIFIED=true
  echo "Approved docs ref: $DOCS_REF ($DOCS_REPOSITORY)"
  echo "Harness identity: every tracked byte under $PROOFS_TOOL_RELPATH matches the approved docs ref."
  echo "Harness execution: immutable snapshot of the approved tree (runner included)."
elif [[ "$DOCS_REF_INPUT" =~ ^[0-9a-f]{40}$ ]]; then
  DOCS_REF="$DOCS_REF_INPUT"
  DOCS_REF_SOURCE="approved-input"
  echo "Docs ref (recorded, unenforced in dry run): $DOCS_REF"
fi

# Catalog preflight (#495). The validators receive one explicit repository root,
# so they inspect the same files whatever directory the caller started in. A
# failure here stops the matrix before any row executes.
CATALOG_PREFLIGHT_LOG="$OUT_ROOT/catalog-preflight.log"
CATALOG_PREFLIGHT_RAW="$(mktemp "${TMPDIR:-/tmp}/openclaw-k6-catalog.XXXXXX")"
CATALOG_PREFLIGHT_RAW_FILE="$CATALOG_PREFLIGHT_RAW"
: > "$CATALOG_PREFLIGHT_RAW"
echo "Running catalog preflight (repository root: $PROOFS_TOOL_RELPATH resolved once)..."
publish_catalog_preflight_log() {
  scrub_public_text < "$CATALOG_PREFLIGHT_RAW" > "$CATALOG_PREFLIGHT_LOG"
}
for CATALOG_CHECK in "${CATALOG_CHECKS[@]}"; do
  printf '### %s\n' "$CATALOG_CHECK" >> "$CATALOG_PREFLIGHT_RAW"
  if ! run_with_minimal_env node "$SCRIPT_DIR/$CATALOG_CHECK" --repo-root "$EXEC_ROOT" >> "$CATALOG_PREFLIGHT_RAW" 2>&1; then
    publish_catalog_preflight_log
    fail_harness \
      "catalog-preflight" \
      "catalog validator '$CATALOG_CHECK' failed; the row catalog could not be resolved" \
      "$(jq -n --arg check "$CATALOG_CHECK" '{failedCheck:$check, log:"catalog-preflight.log"}')"
  fi
done
publish_catalog_preflight_log
rm -f "$CATALOG_PREFLIGHT_RAW"
CATALOG_PREFLIGHT_RAW_FILE=""
echo "CATALOG PREFLIGHT: $CATALOG_PREFLIGHT_LOG"

# ---------------------------------------------------------------------------
# Row selection and per-row contract binding
# ---------------------------------------------------------------------------
# Everything below parses the manifest catalog, so it runs only after the
# validators have approved that catalog and after the harness bytes have been
# proven to match the approved docs ref. Every catalog read is classified as
# infrastructure rather than allowed to abort the shell.
PRODUCER_PLAN_FILE="$OUT_ROOT/producer-plan.json"
PRODUCER_RECEIPT_ARGS=()
PRODUCER_BINDING_ARGS=()
if [[ -n "${OPENCLAW_PRODUCER_RECEIPTS:-}" ]]; then
  PRODUCER_RECEIPT_ARGS=(--receipts "$OPENCLAW_PRODUCER_RECEIPTS")
fi
if [[ -n "$OPENCLAW_CANDIDATE_SHA" ]]; then
  PRODUCER_BINDING_ARGS+=(--candidate-sha "$OPENCLAW_CANDIDATE_SHA")
fi
if [[ -n "$DOCS_REF" ]]; then
  PRODUCER_BINDING_ARGS+=(--docs-sha "$DOCS_REF")
fi
if [[ "$DRY_RUN" == "false" && "$ROWS" != "all" && "$ROWS" != "live-suite" ]]; then
  IFS=',' read -ra PREPLAN_ROWS <<< "$ROWS"
  for PREPLAN_ROW in "${PREPLAN_ROWS[@]}"; do
    PREPLAN_ROW="$(printf '%s' "$PREPLAN_ROW" | tr '[:lower:]' '[:upper:]')"
    if [[ -z "$(find_manifest_relpath "$PREPLAN_ROW" || true)" ]]; then
      fail_harness \
        "harness-identity" \
        "row $PREPLAN_ROW has no manifest at the approved docs ref; unrecorded rows cannot be fired or counted" \
        "$(jq -n --arg row "$PREPLAN_ROW" --arg approved "$DOCS_REF" '{check:"row-recorded-at-docs-ref", row:$row, approved:$approved}')"
    fi
  done
fi
if ! node "$PRODUCER_PLAN_RESOLVER" \
  --selection "$ROWS" \
  "${PRODUCER_BINDING_ARGS[@]}" \
  "${PRODUCER_RECEIPT_ARGS[@]}" > "$PRODUCER_PLAN_FILE"; then
  fail_harness \
    "producer-catalog" \
    "producer catalog or dependency DAG is invalid" \
    "$(jq -c '{failures,blocked,classifications}' "$PRODUCER_PLAN_FILE" 2>/dev/null || echo null)"
fi
DEPENDENCY_BLOCKED="$(jq -r '(.blocked | length) > 0' "$PRODUCER_PLAN_FILE")"
if [[ "$ROWS" == "all" || "$ROWS" == "live-suite" ]]; then
  ROWS="$(jq -r '[.rows[] | select(
    .blocked == false and
    (.classification == "behavioral-live" or .classification == "process-local")
  ) | .rowId] | join(",")' "$PRODUCER_PLAN_FILE")"
else
  ROWS="$(jq -r '[.rows[] | select(.blocked == false) | .rowId] | join(",")' "$PRODUCER_PLAN_FILE")"
fi
echo "PRODUCER PLAN: $PRODUCER_PLAN_FILE"
jq -c '{schema,selection,ok,classifications,blocked}' "$PRODUCER_PLAN_FILE"
if [[ "$DEPENDENCY_BLOCKED" == "true" ]]; then
  echo "Dependency-gated rows are blocked; fresh exact candidate/docs receipts are required." >&2
  jq -r '.blocked[] | "[\(.rowId)] dependencies: \(.missingDependencies | join(",")); blocker: \(.blockedBy // "fresh dependency receipt required")"' "$PRODUCER_PLAN_FILE" >&2
fi

if [[ -z "$ROWS" ]]; then
  if [[ "$DEPENDENCY_BLOCKED" == "true" ]]; then
    fail_harness \
      "dependency-gated" \
      "selected rows are blocked pending fresh dependency receipts" \
      "$(jq -c '{check:"producer-dependencies",blocked}' "$PRODUCER_PLAN_FILE")"
  fi
  echo "No runnable rows found."
  exit 1
fi

ROW_SELECTION_JSON="$(printf '%s' "$ROWS" | jq -R 'split(",") | map(ascii_upcase)')"
IFS=',' read -ra ROW_ARRAY <<< "$ROWS"
echo "Rows: $ROWS"

if [[ "$DRY_RUN" == "false" ]]; then
  for BIND_ROW in "${ROW_ARRAY[@]}"; do
    BIND_ROW="$(printf '%s' "$BIND_ROW" | tr '[:lower:]' '[:upper:]')"
    BIND_MANIFEST=""
    BIND_MANIFEST="$(find_manifest_relpath "$BIND_ROW" || true)"
    # The approved harness defines every row it can prove. A selected row with no
    # manifest at the approved ref must fail once as infrastructure rather than
    # be silently skipped, which is exactly how a matrix acquires a phantom
    # denominator.
    if [[ -z "$BIND_MANIFEST" ]]; then
      fail_harness \
        "harness-identity" \
        "row $BIND_ROW has no manifest at the approved docs ref; unrecorded rows cannot be fired or counted" \
        "$(jq -n --arg row "$BIND_ROW" --arg approved "$DOCS_REF" '{check:"row-recorded-at-docs-ref", row:$row, approved:$approved}')"
    fi
    BIND_STATUS=""
    if ! BIND_STATUS="$(jq -r '.scenario.status // empty' "$BIND_MANIFEST" 2>/dev/null)"; then
      fail_harness \
        "catalog-preflight" \
        "manifest '$BIND_MANIFEST' could not be read while binding row $BIND_ROW" \
        "$(jq -n --arg row "$BIND_ROW" --arg manifest "$BIND_MANIFEST" '{check:"manifest-readable", row:$row, manifest:$manifest}')"
    fi
    [[ "$BIND_STATUS" == "runnable" ]] || continue
    BIND_SCENARIO=""
    if ! BIND_SCENARIO="$(jq -r '.scenario.file // .scenario.name // empty' "$BIND_MANIFEST" 2>/dev/null)"; then
      fail_harness \
        "catalog-preflight" \
        "manifest '$BIND_MANIFEST' could not be read while binding row $BIND_ROW" \
        "$(jq -n --arg row "$BIND_ROW" --arg manifest "$BIND_MANIFEST" '{check:"manifest-readable", row:$row, manifest:$manifest}')"
    fi
    if [[ -z "$BIND_SCENARIO" || ! -f "scenarios/$BIND_SCENARIO" ]]; then
      fail_harness \
        "harness-identity" \
        "row $BIND_ROW is runnable but its scenario file is missing from the harness tree" \
        "$(jq -n --arg row "$BIND_ROW" --arg scenario "$BIND_SCENARIO" '{check:"scenario-present", row:$row, scenario:(if $scenario == "" then null else $scenario end)}')"
    fi
    BIND_MANIFEST_REL="$PROOFS_TOOL_RELPATH/$BIND_MANIFEST"
    BIND_SCENARIO_REL="$PROOFS_TOOL_RELPATH/scenarios/$BIND_SCENARIO"
    for BIND_PATH in "$BIND_MANIFEST_REL" "$BIND_SCENARIO_REL"; do
      BIND_TRACKED=""
      BIND_TRACKED="$(tracked_blob_sha256 "$BIND_PATH" || true)"
      if [[ -z "$BIND_TRACKED" ]]; then
        fail_harness \
          "harness-identity" \
          "$BIND_PATH is not tracked at the approved docs ref; unrecorded harness bytes cannot produce a receipt" \
          "$(jq -n --arg row "$BIND_ROW" --arg path "$BIND_PATH" --arg approved "$DOCS_REF" '{check:"tracked-at-docs-ref", row:$row, path:$path, approved:$approved}')"
      fi
      BIND_EXEC="$(exec_sha256 "$BIND_PATH")"
      if [[ -z "$BIND_EXEC" || "$BIND_TRACKED" != "$BIND_EXEC" ]]; then
        fail_harness \
          "harness-identity" \
          "$BIND_PATH differs from the approved docs ref; refusing to fire mutated harness bytes" \
          "$(jq -n --arg row "$BIND_ROW" --arg path "$BIND_PATH" '{check:"bytes-match-docs-ref", row:$row, path:$path}')"
      fi
      if [[ "$BIND_PATH" == "$BIND_MANIFEST_REL" ]]; then
        ROW_MANIFEST_RELPATH["$BIND_ROW"]="$BIND_MANIFEST_REL"
        ROW_MANIFEST_SHA256["$BIND_ROW"]="$BIND_EXEC"
      else
        ROW_SCENARIO_RELPATH["$BIND_ROW"]="$BIND_SCENARIO_REL"
        ROW_SCENARIO_SHA256["$BIND_ROW"]="$BIND_EXEC"
      fi
    done
  done
  echo "Harness contract binding: frozen manifest/scenario digests for every selected runnable row."
fi

# Runtime and session resolution run only in the verified snapshot runner: the
# bootstrap must not invoke external tooling or resolve session state while it is
# still executing unproven bytes.
# Fetch deployed runtime build stamp explicitly (do not collapse into CANDIDATE_SHA).
# Operators may provide OPENCLAW_RUNTIME_BUILD_SHA when they have an external deploy
# receipt for the exact SHA. Otherwise prefer a structured CLI receipt when available
# and fall back to the human version string (for example, "OpenClaw ... (1cc8f4e)").
DEPLOYED_BUILD_STAMP="${OPENCLAW_RUNTIME_BUILD_SHA:-unknown}"
if [[ "$DEPLOYED_BUILD_STAMP" == "unknown" && -f ~/.openclaw/openclaw.json ]]; then
  if openclaw version --json >/dev/null 2>&1; then
    DEPLOYED_BUILD_STAMP="$(openclaw version --json | jq -r '.build.sha // empty')"
  elif openclaw --version >/dev/null 2>&1; then
    DEPLOYED_BUILD_STAMP="$(openclaw --version | head -n 1)"
  fi
fi
export OPENCLAW_RUNTIME_BUILD_SHA="$DEPLOYED_BUILD_STAMP"

# Resolve Session Key
if [[ -z "${OPENCLAW_SESSION_KEY:-}" ]]; then
  echo "Resolving session key for selector: $SESSION_SELECTOR"
  case "$SESSION_SELECTOR" in
    main|agent:*)
      export OPENCLAW_SESSION_KEY="$SESSION_SELECTOR"
      ;;
    *)
      export OPENCLAW_SESSION_KEY="main" # Fallback/stub. In a full implementation this shells out to `openclaw sessions --json`
      ;;
  esac
fi

echo "Deployed Runtime SHA: $OPENCLAW_RUNTIME_BUILD_SHA"
echo "Session configured: true"

if [[ "$DRY_RUN" == "false" && "$OPENCLAW_CANDIDATE_SHA" != "$OPENCLAW_RUNTIME_BUILD_SHA" && "$OPENCLAW_RUNTIME_BUILD_SHA" != *"(${OPENCLAW_CANDIDATE_SHA:0:7})"* ]]; then
  echo "WARNING: Candidate SHA ($OPENCLAW_CANDIDATE_SHA) does not match Deployed Runtime SHA ($OPENCLAW_RUNTIME_BUILD_SHA)."
  echo "Unless this is a known stale-stamp or you have proven a rebuild bridge, live proofs will be marked PARTIAL."
fi

# Local Gateway Auth extraction (never logged/committed).
# Deliberately last: neither the harness identity gate nor the catalog
# validators run with this credential in their environment.
if [[ -z "${OPENCLAW_GATEWAY_TOKEN:-}" && -f ~/.openclaw/openclaw.json ]]; then
  OPENCLAW_GATEWAY_TOKEN="$(jq -r '.gateway.auth.token // .auth.operatorToken // empty' ~/.openclaw/openclaw.json)"
  export OPENCLAW_GATEWAY_TOKEN
fi
if [[ -z "${OPENCLAW_GATEWAY_TOKEN:-}" ]]; then
  echo "Warning: OPENCLAW_GATEWAY_TOKEN not found in local config."
  if [[ "$DRY_RUN" == "false" ]]; then
    exit 1
  fi
fi

SEAT_READINESS_JSON="$OUT_ROOT/seat-readiness.json"
SEAT_READINESS_SHA256=""
if [[ "$DRY_RUN" == "false" ]]; then
  echo "Running seat-readiness preflight (k6/tooling/gateway/continuation config)..."
  if ! node scripts/seat-readiness-preflight.mjs --json > "$SEAT_READINESS_JSON"; then
    echo "SEAT READINESS FAILED: $SEAT_READINESS_JSON" >&2
    jq -r '.outcome as $out | "outcome=\($out) continuation=\(.continuation.enabled) defaults=\(.continuation.defaultsPresent) notes=\(.notes|join("; "))"' "$SEAT_READINESS_JSON" >&2 || true
    exit 1
  fi
  SEAT_READINESS_SHA256="$(sha256sum "$SEAT_READINESS_JSON" | cut -d' ' -f1)"
  echo "SEAT READINESS: $SEAT_READINESS_JSON"
fi

# Public-safe top-level provenance receipt. It is written before the first row
# fires so the bundle always states which harness bytes and which product
# candidate produced everything beneath it.
HARNESS_PROVENANCE_JSON="$OUT_ROOT/harness-provenance.json"
RUNNER_SCRIPT_SHA256="$(sha256sum "$RUNNER_SCRIPT_PATH" | cut -d' ' -f1)"
RUN_MATRIX_STARTED_AT="$(date -u +%Y-%m-%dT%H:%M:%SZ)"
# A reused artifact root must not let a later matrix overwrite the provenance of
# rows an earlier one already wrote, so each matrix also keeps an immutable copy
# and stamps its id into every row's runner-metadata.json.
# Two matrices for the same docs ref can start within the same second, so every
# matrix carries a random nonce that also makes its run directories exclusive.
MATRIX_NONCE="$(tr -d '-' < /proc/sys/kernel/random/uuid 2>/dev/null | cut -c1-8)"
if [[ -z "$MATRIX_NONCE" ]]; then MATRIX_NONCE="$(printf '%04x%04x' "$RANDOM" "$RANDOM")"; fi
MATRIX_ID="$(date -u +%Y%m%dT%H%M%SZ)-${DOCS_REF:0:12}"
if [[ -z "$DOCS_REF" ]]; then MATRIX_ID="${MATRIX_ID}unbound"; fi
MATRIX_ID="${MATRIX_ID}-${MATRIX_NONCE}"
HARNESS_PROVENANCE_ARCHIVE="$OUT_ROOT/harness-provenance/$MATRIX_ID.json"
mkdir -p "$OUT_ROOT/harness-provenance"
PROVENANCE_ROWS_JSON='[]'
for PROV_ROW in "${ROW_ARRAY[@]}"; do
  PROV_ROW="$(printf '%s' "$PROV_ROW" | tr '[:lower:]' '[:upper:]')"
  PROVENANCE_ROWS_JSON="$(
    jq -cn \
      --argjson rows "$PROVENANCE_ROWS_JSON" \
      --arg row "$(safe_row_id_or_marker "$PROV_ROW")" \
      --arg manifest "${ROW_MANIFEST_RELPATH[$PROV_ROW]:-}" \
      --arg manifestSha256 "${ROW_MANIFEST_SHA256[$PROV_ROW]:-}" \
      --arg scenario "${ROW_SCENARIO_RELPATH[$PROV_ROW]:-}" \
      --arg scenarioSha256 "${ROW_SCENARIO_SHA256[$PROV_ROW]:-}" \
      '$rows + [{
        rowId: $row,
        manifestPath: (if $manifest == "" then null else $manifest end),
        manifestSha256: (if $manifestSha256 == "" then null else $manifestSha256 end),
        scenarioPath: (if $scenario == "" then null else $scenario end),
        scenarioSha256: (if $scenarioSha256 == "" then null else $scenarioSha256 end)
      }]'
  )"
done
jq -n \
  --arg docsRef "$DOCS_REF" \
  --arg docsRefSource "$DOCS_REF_SOURCE" \
  --arg repository "$(safe_repository_or_marker "$DOCS_REPOSITORY")" \
  --arg candidate "$(safe_sha_or_marker "$OPENCLAW_CANDIDATE_SHA")" \
  --arg runtimeBuildSha "$(safe_runtime_stamp "$OPENCLAW_RUNTIME_BUILD_SHA")" \
  --arg seat "$OPENCLAW_SEAT_NAME" \
  --arg seatReadinessSha256 "$SEAT_READINESS_SHA256" \
  --arg runnerScript "$PROOFS_TOOL_RELPATH/scripts/run-proofs.sh" \
  --arg runnerScriptSha256 "$RUNNER_SCRIPT_SHA256" \
  --arg mode "$RUN_MODE" \
  --arg matrixId "$MATRIX_ID" \
  --arg startedAt "$RUN_MATRIX_STARTED_AT" \
  --argjson identityVerified "$HARNESS_IDENTITY_VERIFIED" \
  --argjson rowSelection "$(safe_row_selection_json)" \
  --argjson rows "$PROVENANCE_ROWS_JSON" \
  '{
    schema: "openclaw.k6.harness-provenance.v1",
    classification: "harness-provenance",
    matrixId: $matrixId,
    mode: $mode,
    docsRef: (if $docsRef == "" then null else $docsRef end),
    docsRefSource: $docsRefSource,
    repository: (if $repository == "" then null else $repository end),
    harnessIdentityVerified: $identityVerified,
    candidateSha: (if $candidate == "" then null else $candidate end),
    runtimeIdentity: {
      seat: $seat,
      runtimeBuildSha: (if $runtimeBuildSha == "" or $runtimeBuildSha == "unknown" then null else $runtimeBuildSha end),
      candidateMatchesRuntime: ($candidate != "" and $candidate == $runtimeBuildSha),
      seatReadinessReceipt: (if $seatReadinessSha256 == "" then null else "seat-readiness.json" end),
      seatReadinessSha256: (if $seatReadinessSha256 == "" then null else $seatReadinessSha256 end)
    },
    runnerScript: $runnerScript,
    runnerScriptSha256: $runnerScriptSha256,
    rowSelection: $rowSelection,
    rows: $rows,
    candidateOnly: true,
    foldRequiresReview: true,
    startedAt: $startedAt
  }' > "$HARNESS_PROVENANCE_JSON"
cp "$HARNESS_PROVENANCE_JSON" "$HARNESS_PROVENANCE_ARCHIVE"
echo "HARNESS PROVENANCE: $HARNESS_PROVENANCE_JSON"
echo "HARNESS PROVENANCE (matrix $MATRIX_ID): $HARNESS_PROVENANCE_ARCHIVE"
rm -f "$OUT_ROOT/harness-control-receipt.json"

for ROW_ID in "${ROW_ARRAY[@]}"; do
  # Normalize row ID
  ROW_ID="$(echo "$ROW_ID" | tr '[:lower:]' '[:upper:]')"

  # Find manifest (case-insensitive so lowercase preflight still works)
  MANIFEST_FILE=""
  for f in manifests/*.json; do
    if jq -e --arg row "$ROW_ID" '(.rowId | ascii_upcase) == $row' "$f" >/dev/null; then
      MANIFEST_FILE="$(pwd)/$f" # Absolute path
      break
    fi
  done

  if [[ -z "$MANIFEST_FILE" ]]; then
    echo "[$ROW_ID] SKIPPED: Manifest not found."
    continue
  fi

  SCENARIO_FILE=$(jq -r '.scenario.file // .scenario.name // empty' "$MANIFEST_FILE")
  SCENARIO_STATUS=$(jq -r '.scenario.status' "$MANIFEST_FILE")
  LIVE_SAFETY=$(jq -r '.liveRunSafety.classification // "unknown"' "$MANIFEST_FILE")
  PRODUCER_CLASSIFICATION="$(jq -r --arg row "$ROW_ID" '.rows[] | select(.rowId == $row) | .classification' "$PRODUCER_PLAN_FILE")"

  echo ""
  echo "----------------------------------------"
  echo "Row: $ROW_ID"
  echo "Manifest: $MANIFEST_FILE"
  echo "Scenario: ${SCENARIO_FILE:+scenarios/$SCENARIO_FILE}"
  echo "Status: $SCENARIO_STATUS"
  echo "Live Safety: $LIVE_SAFETY"
  echo "Producer Classification: $PRODUCER_CLASSIFICATION"

  if [[ "$PRODUCER_CLASSIFICATION" == "process-local" ]]; then
    if [[ "$DRY_RUN" == "true" ]]; then
      echo "[$ROW_ID] DRY RUN: Would execute process-local producer from producer catalog."
      continue
    fi
    PROCESS_RUN_ID="$(date -u +%Y%m%dT%H%M%SZ)-$(printf '%s' "$ROW_ID" | tr '[:upper:]' '[:lower:]')-${MATRIX_NONCE}"
    PROCESS_RUN_DIR="$OUT_ROOT/$OPENCLAW_CANDIDATE_SHA/$ROW_ID/$OPENCLAW_SEAT_NAME/$PROCESS_RUN_ID"
    (umask 077; mkdir -p "$PROCESS_RUN_DIR")
    cp "$MANIFEST_FILE" "$PROCESS_RUN_DIR/row-manifest.json"
    jq -n \
      --arg row "$ROW_ID" \
      --arg scenario "$SCENARIO_FILE" \
      --arg candidateSha "$OPENCLAW_CANDIDATE_SHA" \
      --arg seat "$OPENCLAW_SEAT_NAME" \
      '{row:$row,scenario:$scenario,candidateSha:$candidateSha,seat:$seat,producerClassification:"process-local"}' \
      > "$PROCESS_RUN_DIR/runner-metadata.json"
    if [[ -z "${FINAL_PRODUCT_CHECKOUT:-}" ]] ||
       ! git -C "$FINAL_PRODUCT_CHECKOUT" rev-parse --is-inside-work-tree >/dev/null 2>&1; then
      echo "[$ROW_ID] FINAL_PRODUCT_CHECKOUT must identify an exact local candidate checkout." >&2
      jq -n \
        --arg row "$ROW_ID" \
        --arg endedAt "$(date -u +%Y-%m-%dT%H:%M:%SZ)" \
        '{k6ExitCode:0,postprocessExitCode:1,effectiveExitCode:1,endedAt:$endedAt,verdict:"FAIL-fixture",verdictSource:"process-local-product-checkout-unavailable",summaryFileVerdict:null,vuLogVerdict:null,summaryFiles:[],evidence:{row:$row,dispatched:false},candidateOnly:true,foldRequiresReview:true,terminal:true,review:{status:"review-pending",pendingReceipts:["exact-product-checkout","process-local-behavioral-receipt"]}}' \
        > "$PROCESS_RUN_DIR/run-result.json"
      ROWS_TERMINAL_PRE_DISPATCH=$((ROWS_TERMINAL_PRE_DISPATCH + 1))
      MATRIX_EXIT_CODE=1
      MATRIX_ROW_FAILURES+=("$ROW_ID:1")
      export_run_metrics "$ROW_ID" "$PROCESS_RUN_DIR"
      continue
    fi
    assert_row_bytes_frozen "$ROW_ID" "pre-process-local-execution"
    ROWS_DISPATCHED=$((ROWS_DISPATCHED + 1))
    set +e
    node "$CATALOG_PRODUCER_RUNNER" \
      --row "$ROW_ID" \
      --product-dir "${FINAL_PRODUCT_CHECKOUT:-}" \
      --candidate-sha "$OPENCLAW_CANDIDATE_SHA" \
      --artifact-dir "$PROCESS_RUN_DIR"
    process_rc=$?
    set -e
    process_result_file=""
    if [[ -f "$PROCESS_RUN_DIR/row-result.json" ]]; then
      process_result_file="row-result.json"
    elif [[ -f "$PROCESS_RUN_DIR/fixture-result.json" ]]; then
      process_result_file="fixture-result.json"
    fi
    process_verdict=""
    if [[ -n "$process_result_file" ]]; then
      process_verdict="$(jq -r '.verdict // empty' "$PROCESS_RUN_DIR/$process_result_file" 2>/dev/null || true)"
    fi
    if [[ "$process_rc" -ne 0 ]]; then
      process_verdict="FAIL-fixture"
    elif [[ -z "$process_result_file" || -z "$process_verdict" ]]; then
      process_rc=1
      process_verdict="FAIL-fixture"
    elif [[ "$process_verdict" != "PASS-candidate" ]]; then
      process_rc=1
    fi
    jq -n \
      --arg row "$ROW_ID" \
      --arg verdict "$process_verdict" \
      --arg fixtureResult "$process_result_file" \
      --arg endedAt "$(date -u +%Y-%m-%dT%H:%M:%SZ)" \
      --argjson effectiveExitCode "$process_rc" \
      '{k6ExitCode:0,postprocessExitCode:$effectiveExitCode,effectiveExitCode:$effectiveExitCode,endedAt:$endedAt,verdict:$verdict,verdictSource:"process-local-producer",summaryFileVerdict:$verdict,vuLogVerdict:null,summaryFiles:(if $fixtureResult == "" then [] else [$fixtureResult] end),evidence:{row:$row,dispatched:true,fixtureResult:(if $fixtureResult == "" then null else $fixtureResult end)},candidateOnly:true,foldRequiresReview:true,terminal:true,review:{status:"review-pending",pendingReceipts:(if $effectiveExitCode == 0 then [] else ["process-local-behavioral-receipt"] end)}}' \
      > "$PROCESS_RUN_DIR/run-result.json"
    if [[ "$process_rc" -ne 0 ]]; then
      MATRIX_EXIT_CODE=1
      MATRIX_ROW_FAILURES+=("$ROW_ID:$process_rc")
    fi
    export_run_metrics "$ROW_ID" "$PROCESS_RUN_DIR"
    continue
  fi

  if [[ "$SCENARIO_STATUS" != "runnable" ]]; then
    echo "[$ROW_ID] SKIPPED: Scenario status is $SCENARIO_STATUS (not runnable)."
    continue
  fi

  if [[ -z "$SCENARIO_FILE" || ! -f "scenarios/$SCENARIO_FILE" ]]; then
    echo "[$ROW_ID] SKIPPED: runnable scenario file missing: scenarios/$SCENARIO_FILE"
    continue
  fi

  if [[ "$DRY_RUN" == "false" && "$LIVE_SAFETY" != "k6-runnable" ]]; then
    echo "[$ROW_ID] SKIPPED: liveRunSafety classification ($LIVE_SAFETY) rejects unattended live fire."
    continue
  fi

  if [[ "$DRY_RUN" == "true" ]]; then
    echo "[$ROW_ID] DRY RUN: Would execute k6 run scenarios/$SCENARIO_FILE"
  else
    ROW_MANIFEST_REL="${ROW_MANIFEST_RELPATH[$ROW_ID]:-}"
    ROW_MANIFEST_DIGEST="${ROW_MANIFEST_SHA256[$ROW_ID]:-}"
    ROW_SCENARIO_REL="${ROW_SCENARIO_RELPATH[$ROW_ID]:-}"
    ROW_SCENARIO_DIGEST="${ROW_SCENARIO_SHA256[$ROW_ID]:-}"
    assert_row_bytes_frozen "$ROW_ID" "pre-capture"

    echo "[$ROW_ID] RUNNING..."

    # The suffix makes the directory unique to this invocation: a pre-execution
    # purge must never be able to delete evidence written by a concurrent or
    # earlier run for the same candidate/row/seat within the same second.
    RUN_ID="$(date -u +%Y%m%dT%H%M%SZ)-$(printf '%s' "$ROW_ID" | tr '[:upper:]' '[:lower:]' | tr -cs 'a-z0-9' '-')-${MATRIX_NONCE}"
    RUN_DIR="$OUT_ROOT/$OPENCLAW_CANDIDATE_SHA/$ROW_ID/$OPENCLAW_SEAT_NAME/$RUN_ID"
    # Atomic: the leaf mkdir fails if anything already owns this path, so this
    # process can only ever purge a directory it created itself.
    mkdir -p "$(dirname "$RUN_DIR")"
    if ! mkdir "$RUN_DIR" 2>/dev/null; then
      fail_harness \
        "harness-identity" \
        "row $ROW_ID run directory already exists; refusing to write into another invocation's artifacts" \
        "$(jq -n --arg row "$ROW_ID" '{check:"run-directory-exclusive", row:$row}')"
    fi
    PROVISIONAL_RUN_DIR="$RUN_DIR"
    touch "$RUN_DIR/.started"
    cp "$MANIFEST_FILE" "$RUN_DIR/row-manifest.json"
    # The exact scenario source travels with the receipt so a reviewer can prove
    # which contract bytes produced it without trusting the run directory name.
    cp "scenarios/$SCENARIO_FILE" "$RUN_DIR/row-scenario.js"
    assert_copied_artifact_frozen "$ROW_ID" "$RUN_DIR/row-manifest.json" "$ROW_MANIFEST_DIGEST"
    assert_copied_artifact_frozen "$ROW_ID" "$RUN_DIR/row-scenario.js" "$ROW_SCENARIO_DIGEST"
    # Everything downstream reads the verified copy, never the mutable worktree
    # manifest, so the contract the scenario loads is the contract that was
    # digest-bound to the approved docs ref.
    MANIFEST_FILE="$RUN_DIR/row-manifest.json"
    export OPENCLAW_ROW_MANIFEST="$MANIFEST_FILE"
    RUN_STARTED_AT="$(date -u +%Y-%m-%dT%H:%M:%SZ)"
    jq -n \
      --arg row "$ROW_ID" \
      --arg scenario "$SCENARIO_FILE" \
      --arg candidate "$OPENCLAW_CANDIDATE_SHA" \
      --arg runtime "$(safe_runtime_stamp "$OPENCLAW_RUNTIME_BUILD_SHA")" \
      --arg seat "$OPENCLAW_SEAT_NAME" \
      --arg started "$RUN_STARTED_AT" \
      --arg docsRef "$DOCS_REF" \
      --arg repository "$DOCS_REPOSITORY" \
      --arg matrixId "$MATRIX_ID" \
      --arg runId "$RUN_ID" \
      --arg manifestPath "$ROW_MANIFEST_REL" \
      --arg manifestSha256 "$ROW_MANIFEST_DIGEST" \
      --arg scenarioPath "$ROW_SCENARIO_REL" \
      --arg scenarioSha256 "$ROW_SCENARIO_DIGEST" \
      '{row:$row, scenario:$scenario, candidateSha:$candidate, runtimeBuildSha:$runtime, seat:$seat, sessionConfigured:true, startedAt:$started, docsRef:$docsRef, repository:$repository, matrixId:$matrixId, runId:$runId, manifestPath:$manifestPath, manifestSha256:$manifestSha256, scenarioPath:$scenarioPath, scenarioSha256:$scenarioSha256}' \
      > "$RUN_DIR/runner-metadata.json"
    if [[ "$ROW_ID" == "R-CD-2" ]]; then
      if ! node "$R_CD_2_RECEIPT_RESOLVER" \
        --run-dir "$RUN_DIR" \
        --candidate-sha "$OPENCLAW_CANDIDATE_SHA" \
        --runtime-sha "$OPENCLAW_RUNTIME_BUILD_SHA" \
        --docs-ref "$DOCS_REF" \
        --repository "$DOCS_REPOSITORY" \
        --seat "$OPENCLAW_SEAT_NAME" \
        --matrix-id "$MATRIX_ID" \
        --run-id "$RUN_ID" \
        --row "$ROW_ID" \
        --manifest-path "$ROW_MANIFEST_REL" \
        --manifest-sha256 "$ROW_MANIFEST_DIGEST" \
        --scenario "$SCENARIO_FILE" \
        --scenario-path "$ROW_SCENARIO_REL" \
        --scenario-sha256 "$ROW_SCENARIO_DIGEST" \
        --context-only true \
        > "$RUN_DIR/r-cd-2-authority-context.json"; then
        fail_harness \
          "harness-identity" \
          "R-CD-2 selected execution context is invalid; refusing acquisition" \
          "$(jq -n --arg row "$ROW_ID" --arg matrixId "$MATRIX_ID" \
            '{check:"r-cd-2-authority-context",row:$row,matrixId:$matrixId}')"
      fi
    fi
    case "$ROW_ID" in
      R-CD-COLLECTION-ON-COLLAPSE|R-CW-7|R-CW-DELEGATE-CHILD-LIVE|R-CW-DELEGATE-TOKEN|R-CW-MULTI)
        if [[ ! "$OPENCLAW_RUNTIME_BUILD_SHA" =~ ^[0-9a-f]{40}$ ||
              "$OPENCLAW_RUNTIME_BUILD_SHA" != "$OPENCLAW_CANDIDATE_SHA" ]]; then
          RUN_ENDED_AT="$(date -u +%Y-%m-%dT%H:%M:%SZ)"
          jq -n \
            --arg row "$ROW_ID" \
            --arg candidateSha "$(safe_sha_or_marker "$OPENCLAW_CANDIDATE_SHA")" \
            --arg runtimeBuildSha "$(safe_sha_or_marker "$OPENCLAW_RUNTIME_BUILD_SHA")" \
            --arg endedAt "$RUN_ENDED_AT" \
            '{schema:"openclaw.k6.restored-producer-build-identity-gate.v1",row:$row,candidateSha:$candidateSha,runtimeBuildSha:$runtimeBuildSha,equalExactSha:false,dispatched:false,verdict:"PARTIAL-candidate",endedAt:$endedAt}' \
            > "$RUN_DIR/build-identity-gate.json"
          jq -n \
            --arg row "$ROW_ID" \
            --arg endedAt "$RUN_ENDED_AT" \
            '{k6ExitCode:0,postprocessExitCode:0,effectiveExitCode:0,endedAt:$endedAt,verdict:"PARTIAL-candidate",verdictSource:"pre-dispatch-build-identity-gate",summaryFileVerdict:null,vuLogVerdict:null,summaryFiles:[],evidence:{row:$row,dispatched:false},candidateOnly:true,foldRequiresReview:true,terminal:true,observability:{traceStatus:"not-started",traceId:null,tempoTraceJson:null,correlationReceipt:null,serviceLogStatus:"not-started",serviceLog:null,serviceLogCapture:null,serviceLogRedaction:null},review:{status:"review-pending",pendingReceipts:["exact-candidate-runtime-identity","live-behavioral-receipt"]}}' \
            > "$RUN_DIR/run-result.json"
          rm -f "$RUN_DIR/.started"
          PROVISIONAL_RUN_DIR=""
          ROWS_TERMINAL_PRE_DISPATCH=$((ROWS_TERMINAL_PRE_DISPATCH + 1))
          echo "[$ROW_ID] PARTIAL-candidate: exact equal candidate/runtime SHAs are required; no dispatch occurred."
          continue
        fi
        ;;
    esac
    if [[ "$ROW_ID" == "R-CD-TOKEN" ]]; then
      if [[ ! "$OPENCLAW_CANDIDATE_SHA" =~ ^[0-9a-f]{40}$ ||
            ! "$OPENCLAW_RUNTIME_BUILD_SHA" =~ ^[0-9a-f]{40}$ ||
            "$OPENCLAW_CANDIDATE_SHA" != "$OPENCLAW_RUNTIME_BUILD_SHA" ]]; then
        RUN_ENDED_AT="$(date -u +%Y-%m-%dT%H:%M:%SZ)"
        jq -n \
          --arg candidateSha "$(safe_sha_or_marker "$OPENCLAW_CANDIDATE_SHA")" \
          --arg runtimeBuildSha "$(safe_sha_or_marker "$OPENCLAW_RUNTIME_BUILD_SHA")" \
          --arg endedAt "$RUN_ENDED_AT" \
          '{schema:"openclaw.k6.r-cd-token.build-identity-gate.v1",row:"R-CD-TOKEN",candidateSha:$candidateSha,runtimeBuildSha:$runtimeBuildSha,equalExactSha:false,dispatched:false,verdict:"PARTIAL-candidate",endedAt:$endedAt}' \
          > "$RUN_DIR/build-identity-gate.json"
        jq -n \
          --arg endedAt "$RUN_ENDED_AT" \
          '{k6ExitCode:0,postprocessExitCode:0,effectiveExitCode:0,endedAt:$endedAt,verdict:"PARTIAL-candidate",verdictSource:"pre-dispatch-build-identity-gate",summaryFileVerdict:null,vuLogVerdict:null,summaryFiles:[],evidence:{row:"R-CD-TOKEN",dispatched:false},candidateOnly:true,foldRequiresReview:true,terminal:true,observability:{traceStatus:"not-applicable",traceId:null,tempoTraceJson:null,correlationReceipt:null,serviceLogStatus:"not-started",serviceLog:null,serviceLogCapture:null,serviceLogRedaction:null},review:{status:"review-pending",pendingReceipts:["exact-candidate-runtime-identity","attempt-state","raw-final-text-origin","parser-detected","queue-identity","child-spawned","child-completed","parent-return-event","tempo-trace-json","continuation-trace-correlation"]}}' \
          > "$RUN_DIR/run-result.json"
        rm -f "$RUN_DIR/.started"
        PROVISIONAL_RUN_DIR=""
        ROWS_TERMINAL_PRE_DISPATCH=$((ROWS_TERMINAL_PRE_DISPATCH + 1))
        echo "[$ROW_ID] PARTIAL-candidate: exact equal candidate/runtime SHAs are required; no dispatch occurred."
        continue
      fi
      ATTEMPT_UUID="$(cat /proc/sys/kernel/random/uuid)"
      export OPENCLAW_PROOF_ATTEMPT_ID="${RUN_ID}-${ATTEMPT_UUID}"
      export OPENCLAW_ROW_NONCE="R-CD-TOKEN-${ATTEMPT_UUID}"
      ACTIVE_TOKEN_RUN_DIR="$RUN_DIR"
      ACTIVE_TOKEN_PHASE="prepared"
      ACTIVE_TOKEN_ATTEMPT_HASH="$(printf '%s' "$OPENCLAW_PROOF_ATTEMPT_ID" | sha256sum | cut -c1-16)"
      ACTIVE_TOKEN_NONCE_HASH="$(printf '%s' "$OPENCLAW_ROW_NONCE" | sha256sum | cut -c1-16)"
      jq -n \
        --arg attemptIdHash "$ACTIVE_TOKEN_ATTEMPT_HASH" \
        --arg rowNonceHash "$ACTIVE_TOKEN_NONCE_HASH" \
        --arg candidateSha "$OPENCLAW_CANDIDATE_SHA" \
        --arg runtimeBuildSha "$OPENCLAW_RUNTIME_BUILD_SHA" \
        --arg startedAt "$RUN_STARTED_AT" \
        '{schema:"openclaw.k6.r-cd-token.attempt-state.v1",row:"R-CD-TOKEN",attemptIdHash:$attemptIdHash,rowNonceHash:$rowNonceHash,candidateSha:$candidateSha,runtimeBuildSha:$runtimeBuildSha,startedAt:$startedAt,phase:"prepared",proofTerminal:false,consumptionState:"not-yet-dispatched",automaticRetryAllowed:false}' \
        > "$RUN_DIR/attempt-state.json"
    fi
    if [[ -f "$SEAT_READINESS_JSON" ]]; then
      cp "$SEAT_READINESS_JSON" "$RUN_DIR/seat-readiness.json"
    fi
    PREREQUISITE_RECEIPT="$RUN_DIR/process-local-prerequisite/prerequisite-receipt.json"
    PREREQUISITE_REQUIRED="$(jq -r '(.liveRunSafety.requiredReceipts // []) | any(. == "process-local-propagation-tests")' "$MANIFEST_FILE")"
    if [[ "$(jq -r --arg row "$ROW_ID" '.rows[] | select(.rowId == $row) | .prerequisite != null' "$PRODUCER_PLAN_FILE")" == "true" ]]; then
      if [[ -z "${FINAL_PRODUCT_CHECKOUT:-}" ]] ||
         ! git -C "$FINAL_PRODUCT_CHECKOUT" rev-parse --is-inside-work-tree >/dev/null 2>&1; then
        echo "[$ROW_ID] exact product checkout is unavailable; prerequisite and live fire are blocked." >&2
        jq -n \
          --arg row "$ROW_ID" \
          --arg endedAt "$(date -u +%Y-%m-%dT%H:%M:%SZ)" \
          '{k6ExitCode:0,postprocessExitCode:1,effectiveExitCode:1,endedAt:$endedAt,verdict:"PARTIAL-candidate",verdictSource:"process-local-prerequisite-unavailable",summaryFileVerdict:null,vuLogVerdict:null,summaryFiles:[],evidence:{row:$row,dispatched:false},candidateOnly:true,foldRequiresReview:true,terminal:true,review:{status:"review-pending",pendingReceipts:["exact-product-checkout","process-local-prerequisite","live-behavioral-receipt"]}}' \
          > "$RUN_DIR/run-result.json"
        ROWS_TERMINAL_PRE_DISPATCH=$((ROWS_TERMINAL_PRE_DISPATCH + 1))
        MATRIX_EXIT_CODE=1
        MATRIX_ROW_FAILURES+=("$ROW_ID:1")
        rm -f "$RUN_DIR/.started"
        PROVISIONAL_RUN_DIR=""
        continue
      fi
      PREREQUISITE_ARGV_JSON="$(jq -c --arg row "$ROW_ID" '.rows[] | select(.rowId == $row) | .prerequisite.argv' "$PRODUCER_PLAN_FILE")"
      (umask 077; mkdir -p "$RUN_DIR/process-local-prerequisite")
      PRIVATE_PREREQ_STDOUT="$(mktemp "${TMPDIR:-/tmp}/openclaw-prerequisite-stdout.XXXXXX")"
      PRIVATE_PREREQ_STDERR="$(mktemp "${TMPDIR:-/tmp}/openclaw-prerequisite-stderr.XXXXXX")"
      if ! node "$CATALOG_PRODUCER_RUNNER" \
        --prerequisite \
        --row "$ROW_ID" \
        --product-dir "${FINAL_PRODUCT_CHECKOUT:-}" \
        --candidate-sha "$OPENCLAW_CANDIDATE_SHA" \
        --artifact-dir "$RUN_DIR/process-local-prerequisite" \
        > "$PRIVATE_PREREQ_STDOUT" \
        2> "$PRIVATE_PREREQ_STDERR"; then
        echo "[$ROW_ID] process-local prerequisite failed; live producer was not fired." >&2
        jq -n \
          --arg row "$ROW_ID" \
          --arg endedAt "$(date -u +%Y-%m-%dT%H:%M:%SZ)" \
          '{k6ExitCode:0,postprocessExitCode:1,effectiveExitCode:1,endedAt:$endedAt,verdict:"PARTIAL-candidate",verdictSource:"process-local-prerequisite-failed",summaryFileVerdict:null,vuLogVerdict:null,summaryFiles:[],evidence:{row:$row,dispatched:false},candidateOnly:true,foldRequiresReview:true,terminal:true,review:{status:"review-pending",pendingReceipts:["process-local-prerequisite","live-behavioral-receipt"]}}' \
          > "$RUN_DIR/run-result.json"
        rm -f "$PRIVATE_PREREQ_STDOUT" "$PRIVATE_PREREQ_STDERR"
        PRIVATE_PREREQ_STDOUT=""
        PRIVATE_PREREQ_STDERR=""
        ROWS_TERMINAL_PRE_DISPATCH=$((ROWS_TERMINAL_PRE_DISPATCH + 1))
        MATRIX_EXIT_CODE=1
        MATRIX_ROW_FAILURES+=("$ROW_ID:1")
        rm -f "$RUN_DIR/.started"
        PROVISIONAL_RUN_DIR=""
        continue
      fi
      PREREQUISITE_STDOUT_SHA256="$(sha256sum "$PRIVATE_PREREQ_STDOUT" | cut -d' ' -f1)"
      PREREQUISITE_STDERR_SHA256="$(sha256sum "$PRIVATE_PREREQ_STDERR" | cut -d' ' -f1)"
      PREREQUISITE_ARGV_SHA256="$(printf '%s' "$PREREQUISITE_ARGV_JSON" | sha256sum | cut -d' ' -f1)"
      jq -n \
        --arg row "$ROW_ID" \
        --arg candidateSha "$OPENCLAW_CANDIDATE_SHA" \
        --arg docsSha "$DOCS_REF" \
        --arg completedAt "$(date -u +%Y-%m-%dT%H:%M:%SZ)" \
        --arg argvSha256 "$PREREQUISITE_ARGV_SHA256" \
        --arg stdoutSha256 "$PREREQUISITE_STDOUT_SHA256" \
        --arg stderrSha256 "$PREREQUISITE_STDERR_SHA256" \
        '{schema:"openclaw.k6.process-local-prerequisite-receipt.v1",row:$row,candidateSha:$candidateSha,docsSha:$docsSha,completedAt:$completedAt,exitCode:0,argvSha256:$argvSha256,stdoutSha256:$stdoutSha256,stderrSha256:$stderrSha256,verdict:"PASS-candidate"}' \
        > "$PREREQUISITE_RECEIPT"
      rm -f "$PRIVATE_PREREQ_STDOUT" "$PRIVATE_PREREQ_STDERR"
      PRIVATE_PREREQ_STDOUT=""
      PRIVATE_PREREQ_STDERR=""

    fi
    if [[ "$PREREQUISITE_REQUIRED" == "true" && ! -f "$PREREQUISITE_RECEIPT" ]]; then
      echo "[$ROW_ID] required process-local prerequisite receipt is missing; live producer was not fired." >&2
      jq -n \
        --arg row "$ROW_ID" \
        --arg endedAt "$(date -u +%Y-%m-%dT%H:%M:%SZ)" \
        '{k6ExitCode:0,postprocessExitCode:1,effectiveExitCode:1,endedAt:$endedAt,verdict:"PARTIAL-candidate",verdictSource:"process-local-prerequisite-missing",summaryFileVerdict:null,vuLogVerdict:null,summaryFiles:[],evidence:{row:$row,dispatched:false},candidateOnly:true,foldRequiresReview:true,terminal:true,review:{status:"review-pending",pendingReceipts:["process-local-propagation-tests","live-behavioral-receipt"]}}' \
        > "$RUN_DIR/run-result.json"
      ROWS_TERMINAL_PRE_DISPATCH=$((ROWS_TERMINAL_PRE_DISPATCH + 1))
      MATRIX_EXIT_CODE=1
      MATRIX_ROW_FAILURES+=("$ROW_ID:1")
      rm -f "$RUN_DIR/.started"
      PROVISIONAL_RUN_DIR=""
      continue
    fi
    if [[ "$ROW_ID" == "R-CD-TOKEN" ]]; then
      export OPENCLAW_SEAT_CLASS="$(jq -r '.seat.class // "unknown"' "$RUN_DIR/seat-readiness.json" 2>/dev/null || echo unknown)"
      if [[ "$OPENCLAW_SEAT_CLASS" != "raw-final-text" ]]; then
        RUN_ENDED_AT="$(date -u +%Y-%m-%dT%H:%M:%SZ)"
        jq \
          --arg endedAt "$RUN_ENDED_AT" \
          --arg surfaceClass "$OPENCLAW_SEAT_CLASS" \
          '. + {endedAt:$endedAt,phase:"pre-dispatch-surface-gate",proofTerminal:true,consumptionState:"not-dispatched",automaticRetryAllowed:false,verdict:"PARTIAL-candidate",surfaceClass:$surfaceClass,effectiveExitCode:0}' \
          "$RUN_DIR/attempt-state.json" > "$RUN_DIR/attempt-state.json.tmp"
        mv "$RUN_DIR/attempt-state.json.tmp" "$RUN_DIR/attempt-state.json"
        jq -n \
          --arg endedAt "$RUN_ENDED_AT" \
          --arg surfaceClass "$OPENCLAW_SEAT_CLASS" \
          '{k6ExitCode:0,postprocessExitCode:0,effectiveExitCode:0,endedAt:$endedAt,verdict:"PARTIAL-candidate",verdictSource:"pre-dispatch-surface-gate",summaryFileVerdict:null,vuLogVerdict:null,summaryFiles:[],evidence:{row:"R-CD-TOKEN",surface_class:$surfaceClass,dispatched:false},candidateOnly:true,foldRequiresReview:true,terminal:true,observability:{traceStatus:"not-applicable",traceId:null,tempoTraceJson:null,correlationReceipt:null,serviceLogStatus:"not-started",serviceLog:null,serviceLogCapture:null,serviceLogRedaction:null},review:{status:"review-pending",pendingReceipts:["raw-final-text-origin","parser-detected","queue-identity","child-spawned","child-completed","parent-return-event","tempo-trace-json","continuation-trace-correlation"]}}' \
          > "$RUN_DIR/run-result.json"
        rm -f "$RUN_DIR/.started"
        ACTIVE_TOKEN_PHASE="pre-dispatch-surface-gate"
        ACTIVE_TOKEN_RUN_DIR=""
        PROVISIONAL_RUN_DIR=""
        ROWS_TERMINAL_PRE_DISPATCH=$((ROWS_TERMINAL_PRE_DISPATCH + 1))
        echo "[$ROW_ID] PARTIAL-candidate: seat readiness class '$OPENCLAW_SEAT_CLASS' is not scanner-supported raw-final-text; no dispatch occurred."
        continue
      fi
      # R-CD-TOKEN is never allowed to fall back to the configured/live
      # session. The scenario independently checks creation success and key
      # distinctness before it can send the proof prompt.
      export OPENCLAW_CREATE_DISPOSABLE_SESSION=true
    fi
    PRIVATE_K6_LOG="$(mktemp "${TMPDIR:-/tmp}/openclaw-k6-log.XXXXXX")"
    PRIVATE_EVIDENCE_FILE="$(mktemp "${TMPDIR:-/tmp}/openclaw-k6-evidence.XXXXXX")"
    PRIVATE_GATEWAY_LOG="$(mktemp "${TMPDIR:-/tmp}/openclaw-gateway-journal.XXXXXX")"
    GATEWAY_UNIT="${OPENCLAW_PROOFS_GATEWAY_UNIT:-openclaw-gateway}"
    GATEWAY_JOURNAL_CURSOR=""
    GATEWAY_JOURNAL_METHOD="unavailable"
    GATEWAY_JOURNAL_RC=1
    if command -v journalctl >/dev/null 2>&1; then
      GATEWAY_JOURNAL_CURSOR="$(
        journalctl --user -u "$GATEWAY_UNIT" --show-cursor -n 0 --no-pager 2>/dev/null \
          | sed -n 's/^-- cursor: //p' \
          | tail -n 1
      )"
    fi
    SOURCE_CONTRACT_FILE=""
    SOURCE_CONTRACT_TRANSPORT="$(jq -r '.transport // empty' "$MANIFEST_FILE")"
    if [[ "$SOURCE_CONTRACT_TRANSPORT" == "github-source-contract" ]]; then
      SOURCE_CONTRACT_REPOSITORY="$(jq -r '.sourceContract.repository // empty' "$MANIFEST_FILE")"
      SOURCE_CONTRACT_PATH="$(jq -r '.sourceContract.path // empty' "$MANIFEST_FILE")"
      if [[ ! "$SOURCE_CONTRACT_REPOSITORY" =~ ^[A-Za-z0-9_.-]+/[A-Za-z0-9_.-]+$ ||
            ! "$SOURCE_CONTRACT_PATH" =~ ^[A-Za-z0-9_./-]+$ ||
            "$SOURCE_CONTRACT_PATH" == *".."* ]]; then
        echo "[$ROW_ID] SOURCE CONTRACT CONFIG INVALID; running k6 as BAD_PROOF." >&2
        SOURCE_CONTRACT_FILE="$(mktemp "${TMPDIR:-/tmp}/openclaw-k6-source.XXXXXX")"
        : > "$SOURCE_CONTRACT_FILE"
      else
        SOURCE_CONTRACT_FILE="$(mktemp "${TMPDIR:-/tmp}/openclaw-k6-source.XXXXXX")"
        SOURCE_CONTRACT_URL="https://raw.githubusercontent.com/${SOURCE_CONTRACT_REPOSITORY}/${OPENCLAW_CANDIDATE_SHA}/${SOURCE_CONTRACT_PATH}"
        if ! curl --fail --silent --show-error --location --max-time 20 "$SOURCE_CONTRACT_URL" > "$SOURCE_CONTRACT_FILE"; then
          echo "[$ROW_ID] EXACT CANDIDATE SOURCE PREFETCH FAILED; running k6 as BAD_PROOF." >&2
          : > "$SOURCE_CONTRACT_FILE"
        fi
      fi
      export OPENCLAW_STATUS_SOURCE_PATH="$SOURCE_CONTRACT_FILE"
    else
      unset OPENCLAW_STATUS_SOURCE_PATH
    fi
    POSTPROCESS_RC=0
    LINEAGE_FAILED=false
    if [[ "$ROW_ID" == "R-CD-TOKEN" ]]; then ACTIVE_TOKEN_PHASE="k6-running"; fi
    # Last assertion before unapproved bytes could be executed.
    assert_row_bytes_frozen "$ROW_ID" "pre-k6-execution"
    # From here the directory holds real candidate evidence and must survive.
    PROVISIONAL_RUN_DIR=""
    ROWS_DISPATCHED=$((ROWS_DISPATCHED + 1))
    set +e
    k6 run "scenarios/$SCENARIO_FILE" > "$PRIVATE_K6_LOG" 2>&1
    k6_rc=$?
    set -e
    if [[ "$ROW_ID" == "R-CD-TOKEN" ]]; then ACTIVE_TOKEN_PHASE="postprocess"; fi
    RUN_ENDED_AT="$(date -u +%Y-%m-%dT%H:%M:%SZ)"

    set +e
    if [[ -n "$GATEWAY_JOURNAL_CURSOR" ]]; then
      journalctl \
        --user \
        -u "$GATEWAY_UNIT" \
        --after-cursor="$GATEWAY_JOURNAL_CURSOR" \
        --output=short-iso-precise \
        --no-pager \
        > "$PRIVATE_GATEWAY_LOG" 2>&1
      GATEWAY_JOURNAL_RC="$?"
      GATEWAY_JOURNAL_METHOD="cursor"
    fi
    if [[ "$GATEWAY_JOURNAL_RC" -ne 0 ]] && command -v journalctl >/dev/null 2>&1; then
      journalctl \
        --user \
        -u "$GATEWAY_UNIT" \
        --since "$RUN_STARTED_AT" \
        --until "$RUN_ENDED_AT" \
        --output=short-iso-precise \
        --no-pager \
        > "$PRIVATE_GATEWAY_LOG" 2>&1
      GATEWAY_JOURNAL_RC="$?"
      GATEWAY_JOURNAL_METHOD="utc-window-fallback"
    fi
    set -e
    GATEWAY_JOURNAL_STATUS="captured"
    if [[ "$GATEWAY_JOURNAL_RC" -ne 0 ]]; then
      GATEWAY_JOURNAL_STATUS="unavailable"
    fi
    jq -n \
      --arg unit "$GATEWAY_UNIT" \
      --arg method "$GATEWAY_JOURNAL_METHOD" \
      --arg status "$GATEWAY_JOURNAL_STATUS" \
      --arg startedAt "$RUN_STARTED_AT" \
      --arg endedAt "$RUN_ENDED_AT" \
      --argjson exitCode "$GATEWAY_JOURNAL_RC" \
      --argjson rawLines "$(wc -l < "$PRIVATE_GATEWAY_LOG")" \
      '{
        schema: "openclaw.k6.gateway-journal-capture.v1",
        unit: $unit,
        method: $method,
        status: $status,
        startedAt: $startedAt,
        endedAt: $endedAt,
        exitCode: $exitCode,
        rawLines: $rawLines
      }' > "$RUN_DIR/gateway-journal-capture.json"

    find . -maxdepth 1 -type f -name '*summary.json' -newer "$RUN_DIR/.started" -print -exec mv {} "$RUN_DIR" \;
    if ! node "$EVIDENCE_EXTRACTOR" \
      --input "$PRIVATE_K6_LOG" \
      --out "$PRIVATE_EVIDENCE_FILE" \
      > "$RUN_DIR/evidence-extraction.json" 2> "$RUN_DIR/evidence-extraction.error.log"; then
      echo "[$ROW_ID] EVIDENCE EXTRACTION FAILED; see $RUN_DIR/evidence-extraction.error.log" >&2
      : > "$PRIVATE_EVIDENCE_FILE"
      POSTPROCESS_RC=1
    else
      rm -f "$RUN_DIR/evidence-extraction.error.log"
    fi
    if [[ "$ROW_ID" == "R-CD-COLLECTION-ON-COLLAPSE" ||
          "$ROW_ID" == "R-CW-DELEGATE-CHILD-LIVE" ||
          "$ROW_ID" == "R-CW-DELEGATE-TOKEN" ||
          "$ROW_ID" == "R-CW-MULTI" ]]; then
      LINEAGE_ARGS=(
        --row "$ROW_ID"
        --evidence "$PRIVATE_EVIDENCE_FILE"
        --manifest "$MANIFEST_FILE"
        --out "$RUN_DIR/live-producer-lineage.json"
      )
      if [[ "$ROW_ID" == "R-CW-DELEGATE-TOKEN" || "$ROW_ID" == "R-CW-MULTI" ]]; then
        LINEAGE_ARGS+=(--gateway-log "$PRIVATE_GATEWAY_LOG")
      fi
      if ! node "$RUNNER_SCRIPT_DIR/collect-live-producer-lineage.mjs" "${LINEAGE_ARGS[@]}" \
        > "$RUN_DIR/live-producer-lineage.stdout.json" \
        2> "$RUN_DIR/live-producer-lineage.error.log"; then
        echo "[$ROW_ID] TASKFLOW/PARSER LINEAGE FAILED; see $RUN_DIR/live-producer-lineage.error.log" >&2
        POSTPROCESS_RC=1
        LINEAGE_FAILED=true
      fi
    fi
    SUMMARY_VERDICT="unknown"
    SUMMARY_VERDICT_SOURCE="none"
    SUMMARY_FILE_VERDICT="unknown"
    VU_LOG_VERDICT="$(
      grep -oE 'VERDICT: (PASS|PARTIAL|HONEST-LIMIT|FAIL)-candidate' "$PRIVATE_K6_LOG" \
        | tail -n 1 \
        | sed 's/^VERDICT: //' \
        || true
    )"
    SUMMARY_FILES_JSON="[]"
    if find "$RUN_DIR" -maxdepth 1 -type f -name '*summary.json' | grep -q .; then
      SUMMARY_FILES_JSON="$(find "$RUN_DIR" -maxdepth 1 -type f -name '*summary.json' -print0 | xargs -0 -r -n1 basename | jq -R . | jq -s .)"
      SUMMARY_FILE_VERDICT="$(find "$RUN_DIR" -maxdepth 1 -type f -name '*summary.json' -print0 | xargs -0 -r jq -r 'select(.verdict != null) | .verdict' | head -n 1)"
      if [[ -z "$SUMMARY_FILE_VERDICT" ]]; then SUMMARY_FILE_VERDICT="unknown"; fi
    fi
    if [[ -n "$VU_LOG_VERDICT" ]]; then
      SUMMARY_VERDICT="$VU_LOG_VERDICT"
      SUMMARY_VERDICT_SOURCE="vu-log"
    elif [[ "$SUMMARY_FILE_VERDICT" != "unknown" ]]; then
      SUMMARY_VERDICT="$SUMMARY_FILE_VERDICT"
      SUMMARY_VERDICT_SOURCE="summary-file"
    fi
    ORIGINAL_SUMMARY_VERDICT="$SUMMARY_VERDICT"
    VERDICT_POLICY_APPLIED="false"
    VERDICT_POLICY_REASON=""
    if [[ "$SUMMARY_VERDICT" == "HONEST-LIMIT-candidate" ]]; then
      if [[ "$ROW_ID" != "R-RC-2" ]]; then
        VERDICT_POLICY_REASON="only R-RC-2 may use HONEST-LIMIT-candidate; this row is preserved as PARTIAL-candidate"
      elif ! jq -e '
        select(
          .row == "R-RC-2" and
          .parent_dispatch_accepted == true and
          .delegate_requested == true and
          .child_session_observed == true and
          .delegate_child_report_observed == true and
          .child_reported_context_threshold == true and
          .request_compaction_tool_result_observed == true and
          .request_compaction_receipt_role == "toolResult" and
          .request_compaction_receipt_tool_name == "request_compaction" and
          .request_compaction_receipt_status == "rejected" and
          .request_compaction_invocation_bound == true and
          .request_compaction_rejected_context_threshold == true and
          .guard == "context_threshold"
        )
      ' "$PRIVATE_EVIDENCE_FILE" >/dev/null 2>&1; then
        VERDICT_POLICY_REASON="R-RC-2 HONEST-LIMIT-candidate requires a nonce-bound request_compaction toolResult rejected by context_threshold; incomplete evidence is preserved as PARTIAL-candidate"
      fi
      if [[ -n "$VERDICT_POLICY_REASON" ]]; then
        SUMMARY_VERDICT="PARTIAL-candidate"
        SUMMARY_VERDICT_SOURCE="${SUMMARY_VERDICT_SOURCE}+honest-limit-policy"
        VERDICT_POLICY_APPLIED="true"
      fi
    elif [[ "$SUMMARY_VERDICT" == "PASS-candidate" && "$ROW_ID" == "R-RC-2" ]]; then
      if ! jq -e '
        select(
          .row == "R-RC-2" and
          .parent_dispatch_accepted == true and
          .delegate_requested == true and
          .child_session_observed == true and
          .delegate_child_report_observed == true and
          .post_compaction_path_observed == true and
          .request_compaction_tool_result_observed == true and
          .request_compaction_receipt_role == "toolResult" and
          .request_compaction_receipt_tool_name == "request_compaction" and
          .request_compaction_receipt_status == "accepted" and
          .request_compaction_invocation_bound == true and
          .request_compaction_accepted == true
        )
      ' "$PRIVATE_EVIDENCE_FILE" >/dev/null 2>&1; then
        VERDICT_POLICY_REASON="R-RC-2 PASS-candidate requires a nonce-bound accepted request_compaction toolResult plus the post-compaction child return; incomplete evidence is preserved as PARTIAL-candidate"
        SUMMARY_VERDICT="PARTIAL-candidate"
        SUMMARY_VERDICT_SOURCE="${SUMMARY_VERDICT_SOURCE}+r-rc-2-pass-policy"
        VERDICT_POLICY_APPLIED="true"
      fi
    fi
    if [[ "$LINEAGE_FAILED" == "true" ]]; then
      SUMMARY_VERDICT="PARTIAL-candidate"
      SUMMARY_VERDICT_SOURCE="live-producer-lineage-failed"
      VERDICT_POLICY_APPLIED="true"
      VERDICT_POLICY_REASON="required taskflow or parser lineage validation failed"
    fi
    if [[ "$VERDICT_POLICY_APPLIED" == "true" ||
          ( -n "$VU_LOG_VERDICT" &&
          "$SUMMARY_FILE_VERDICT" != "unknown" &&
          "$VU_LOG_VERDICT" != "$SUMMARY_FILE_VERDICT" ) ]]; then
      jq -n \
        --arg schema "openclaw.k6.verdict-reconciliation.v1" \
        --arg selected "$SUMMARY_VERDICT" \
        --arg selectedSource "$SUMMARY_VERDICT_SOURCE" \
        --arg vuLog "$VU_LOG_VERDICT" \
        --arg summaryFile "$SUMMARY_FILE_VERDICT" \
        --arg original "$ORIGINAL_SUMMARY_VERDICT" \
        --arg policyApplied "$VERDICT_POLICY_APPLIED" \
        --arg policyReason "$VERDICT_POLICY_REASON" \
        '{
          schema: $schema,
          selectedVerdict: $selected,
          selectedSource: $selectedSource,
          vuLogVerdict: $vuLog,
          summaryFileVerdict: $summaryFile,
          verdictPolicyApplied: ($policyApplied == "true"),
          honestLimitPolicyApplied: (($policyApplied == "true") and ($original == "HONEST-LIMIT-candidate")),
          reason: (if $policyApplied == "true"
            then $policyReason
            else "k6 handleSummary executes outside VU state; the VU-emitted verdict owns live evidence classification"
            end)
        }' > "$RUN_DIR/verdict-reconciliation.json"
    fi
    TRACE_STATUS="unknown"
    TRACE_ID=""
    TEMPO_TRACE_PATH=""
    TEMPO_TRACE_JSON=""
    CORRELATION_RECEIPT_PATH=""
    CORRELATION_RECEIPT=""
    REVIEW_PENDING_RECEIPTS='[]'
    if [[ "$GATEWAY_JOURNAL_STATUS" != "captured" ]]; then
      REVIEW_PENDING_RECEIPTS='["gateway-journal"]'
    fi
    if [[ "$LINEAGE_FAILED" == "true" ]]; then
      REVIEW_PENDING_RECEIPTS="$(
        jq -cn --argjson current "$REVIEW_PENDING_RECEIPTS" \
          '$current + ["taskflow-lineage"] | unique'
      )"
      if [[ "$ROW_ID" == "R-CW-DELEGATE-TOKEN" || "$ROW_ID" == "R-CW-MULTI" ]]; then
        REVIEW_PENDING_RECEIPTS="$(
          jq -cn --argjson current "$REVIEW_PENDING_RECEIPTS" \
            '$current + ["bracket-parser-origin"] | unique'
        )"
      fi
    fi
    TRACE_REQUIRED="$(jq -r '((.liveRunSafety.requiredReceipts // []) | map(ascii_downcase) | any(. == "trace-id" or . == "tempo-trace-json"))' "$MANIFEST_FILE")"
    MANIFEST_TOOL="$(jq -r '.invocation.traceTool // .invocation.tool // empty' "$MANIFEST_FILE")"
    if [[ -s "$PRIVATE_EVIDENCE_FILE" ]]; then
      if jq -e 'select(has("trace_id"))' "$PRIVATE_EVIDENCE_FILE" >/dev/null; then
        TRACE_ID="$(jq -r 'select((.trace_id // "") != "") | .trace_id' "$PRIVATE_EVIDENCE_FILE" | head -n 1)"
      fi
    fi
    if [[ "$TRACE_REQUIRED" == "true" && -n "$MANIFEST_TOOL" ]]; then
      COLLECTOR_RESULT="$RUN_DIR/continuation-trace-collector.json"
      COLLECTOR_ERROR="$RUN_DIR/continuation-trace-collector.error.log"
      if node "$CONTINUATION_TRACE_COLLECTOR" \
        --run-dir "$RUN_DIR" \
        --root "$OUT_ROOT" \
        --matrix-id "$MATRIX_ID" \
        --manifest "$MANIFEST_FILE" \
        --seat "$OPENCLAW_SEAT_NAME" \
        --evidence "$PRIVATE_EVIDENCE_FILE" \
        --tempo-url "$OPENCLAW_PROOFS_TEMPO_BASE_URL" \
        > "$COLLECTOR_RESULT" 2> "$COLLECTOR_ERROR"; then
        TRACE_ID="$(jq -r '.traceId' "$COLLECTOR_RESULT")"
        TEMPO_TRACE_JSON="$(jq -r '.traceFile' "$COLLECTOR_RESULT")"
        TEMPO_TRACE_PATH="$RUN_DIR/$TEMPO_TRACE_JSON"
        CORRELATION_RECEIPT="$(jq -r '.receiptFile' "$COLLECTOR_RESULT")"
        CORRELATION_RECEIPT_PATH="$RUN_DIR/$CORRELATION_RECEIPT"
        TRACE_STATUS="present"
        rm -f "$COLLECTOR_ERROR"
        echo "[$ROW_ID] CONTINUATION TRACE: $TEMPO_TRACE_PATH"
        echo "[$ROW_ID] CORRELATION RECEIPT: $CORRELATION_RECEIPT_PATH"
      else
        TRACE_STATUS="missing"
        TRACE_ID=""
        if [[ "$MANIFEST_TOOL" == "continue_delegate" || "$MANIFEST_TOOL" == "continue_work" ]]; then
          REVIEW_PENDING_RECEIPTS="$(
            jq -cn \
              --argjson current "$REVIEW_PENDING_RECEIPTS" \
              '$current + ["tempo-trace-json","continuation-trace-correlation"] | unique'
          )"
        else
          REVIEW_PENDING_RECEIPTS="$(
            jq -cn \
              --argjson current "$REVIEW_PENDING_RECEIPTS" \
              '$current + ["tempo-trace-json","tool-trace-correlation"] | unique'
          )"
        fi
        echo "[$ROW_ID] TRACE CORRELATION FAILED; see $COLLECTOR_ERROR" >&2
        POSTPROCESS_RC=1
      fi
    elif [[ -n "$TRACE_ID" ]]; then
      TEMPO_TRACE_JSON="tempo-trace-${TRACE_ID:0:12}.json"
      TEMPO_TRACE_PATH="$RUN_DIR/$TEMPO_TRACE_JSON"
      if node scripts/fetch-tempo-trace.mjs --trace-id "$TRACE_ID" --tempo-url "$OPENCLAW_PROOFS_TEMPO_BASE_URL" --out "$TEMPO_TRACE_PATH" > "$RUN_DIR/tempo-trace-receipt.json" 2> "$RUN_DIR/tempo-trace-error.log"; then
        TRACE_STATUS="present"
        echo "[$ROW_ID] TEMPO TRACE: $TEMPO_TRACE_PATH"
      else
        TRACE_STATUS="missing"
        if [[ "$TRACE_REQUIRED" == "true" ]]; then
          REVIEW_PENDING_RECEIPTS="$(
            jq -cn --argjson current "$REVIEW_PENDING_RECEIPTS" \
              '$current + ["tempo-trace-json"] | unique'
          )"
        fi
        echo "[$ROW_ID] TEMPO TRACE FETCH FAILED; see $RUN_DIR/tempo-trace-error.log" >&2
        if [[ "$TRACE_REQUIRED" == "true" ||
              "${OPENCLAW_PROOFS_K6_TEMPO_REQUIRED:-false}" == "true" ]]; then
          POSTPROCESS_RC=1
        fi
      fi
    elif [[ "$TRACE_REQUIRED" == "true" ]]; then
      TRACE_STATUS="missing"
      POSTPROCESS_RC=1
      REVIEW_PENDING_RECEIPTS="$(
        jq -cn --argjson current "$REVIEW_PENDING_RECEIPTS" \
          '$current + ["tempo-trace-json"] | unique'
      )"
    fi

    # R-CD-2 owns one candidate verdict surface.  Its scenario deliberately
    # emits PARTIAL; only this resolver may join its private accepted-run
    # lifecycle with the matching continuation trace/chain receipt.
    R_CD_2_RECEIPT=""
    R_CD_2_RECEIPT_SHA256=""
    if [[ "$ROW_ID" == "R-CD-2" ]]; then
      R_CD_2_RECEIPT="r-cd-2-authoritative-receipt.json"
      RESOLVER_ARGS=(
        --run-dir "$RUN_DIR"
        --root "$OUT_ROOT"
        --matrix-id "$MATRIX_ID"
        --evidence "$PRIVATE_EVIDENCE_FILE"
      )
      if [[ -n "$CORRELATION_RECEIPT_PATH" && -f "$CORRELATION_RECEIPT_PATH" ]]; then
        RESOLVER_ARGS+=(--correlation "$CORRELATION_RECEIPT_PATH")
      fi
      if node "$R_CD_2_RECEIPT_RESOLVER" "${RESOLVER_ARGS[@]}" > "$RUN_DIR/r-cd-2-authoritative-resolution.json" &&
         jq -e --arg matrixId "$MATRIX_ID" \
           '.authorityValidated == true and .matrixId == $matrixId' \
           "$RUN_DIR/r-cd-2-authoritative-resolution.json" >/dev/null; then
        # The row-list runner itself—not only the writer/postprocessor path—must
        # carry the signed receipt declaration into run-result.json.  Candidate
        # routing verifies this digest before it can publish an R-CD-2 envelope.
        R_CD_2_RECEIPT_SHA256="$(node --input-type=module -e 'import { createHash } from "node:crypto"; import { readFileSync } from "node:fs"; process.stdout.write(createHash("sha256").update(readFileSync(process.argv[1])).digest("hex"));' "$RUN_DIR/$R_CD_2_RECEIPT")"
        SUMMARY_VERDICT="$(jq -r '.verdict // "PARTIAL-candidate"' "$RUN_DIR/$R_CD_2_RECEIPT")"
        SUMMARY_VERDICT_SOURCE="r-cd-2-authoritative-receipt"
        SUMMARY_FILE_VERDICT="$SUMMARY_VERDICT"
        VU_LOG_VERDICT=""
      else
        SUMMARY_VERDICT="PARTIAL-candidate"
        SUMMARY_VERDICT_SOURCE="r-cd-2-authoritative-receipt-missing"
        POSTPROCESS_RC=1
      fi
    fi

    R_CD_TOKEN_RECEIPT=""
    R_CD_TOKEN_RECEIPT_SHA256=""
    if [[ "$ROW_ID" == "R-CD-TOKEN" ]]; then
      R_CD_TOKEN_RECEIPT="r-cd-token-authoritative-receipt.json"
      TOKEN_RESOLVER_ARGS=(--run-dir "$RUN_DIR" --evidence "$PRIVATE_EVIDENCE_FILE")
      if [[ -n "$CORRELATION_RECEIPT_PATH" && -f "$CORRELATION_RECEIPT_PATH" ]]; then
        TOKEN_RESOLVER_ARGS+=(--correlation "$CORRELATION_RECEIPT_PATH")
      fi
      if node "$R_CD_TOKEN_RECEIPT_RESOLVER" "${TOKEN_RESOLVER_ARGS[@]}" > "$RUN_DIR/r-cd-token-authoritative-resolution.json"; then
        SUMMARY_VERDICT="$(jq -r '.verdict // "PARTIAL-candidate"' "$RUN_DIR/$R_CD_TOKEN_RECEIPT")"
        SUMMARY_VERDICT_SOURCE="r-cd-token-authoritative-receipt"
        SUMMARY_FILE_VERDICT="$SUMMARY_VERDICT"
        VU_LOG_VERDICT=""
        R_CD_TOKEN_RECEIPT_SHA256="$(sha256sum "$RUN_DIR/$R_CD_TOKEN_RECEIPT" | cut -d' ' -f1)"
      else
        SUMMARY_VERDICT="PARTIAL-candidate"
        SUMMARY_VERDICT_SOURCE="r-cd-token-authoritative-receipt-missing"
        POSTPROCESS_RC=1
      fi
    fi

    if ! node "$ARTIFACT_SANITIZER" \
      --input "$PRIVATE_EVIDENCE_FILE" \
      --out "$RUN_DIR/evidence.jsonl" \
      --lines-out "$RUN_DIR/evidence-lines.log" \
      --receipt-out "$RUN_DIR/evidence-redaction.json" \
      --log-input "$PRIVATE_K6_LOG" \
      --log-out "$RUN_DIR/k6.log" \
      --service-log-input "$PRIVATE_GATEWAY_LOG" \
      --service-log-out "$RUN_DIR/gateway-journal.log" \
      --service-log-receipt-out "$RUN_DIR/gateway-journal-redaction.json" \
      > "$RUN_DIR/evidence-redaction.stdout.json" 2> "$RUN_DIR/evidence-redaction.error.log"; then
      echo "[$ROW_ID] PUBLIC ARTIFACT REDACTION FAILED; see $RUN_DIR/evidence-redaction.error.log" >&2
      REVIEW_PENDING_RECEIPTS="$(jq -cn --argjson current "$REVIEW_PENDING_RECEIPTS" '$current + ["public-safe-evidence"] | unique')"
      POSTPROCESS_RC=1
      if [[ ! -f "$RUN_DIR/k6.log" ]]; then
        printf '%s\n' 'Public k6 log unavailable: redaction failed; private log withheld.' > "$RUN_DIR/k6.log"
      fi
      if [[ ! -f "$RUN_DIR/gateway-journal.log" ]]; then
        printf '%s\n' 'Public gateway journal unavailable: redaction failed; private log withheld.' > "$RUN_DIR/gateway-journal.log"
      fi
      [[ -f "$RUN_DIR/evidence.jsonl" ]] || : > "$RUN_DIR/evidence.jsonl"
      [[ -f "$RUN_DIR/evidence-lines.log" ]] || : > "$RUN_DIR/evidence-lines.log"
    else
      rm -f "$RUN_DIR/evidence-redaction.error.log"
    fi
    if [[ "$ROW_ID" == "R-CD-2" && -f "$RUN_DIR/$R_CD_2_RECEIPT" ]]; then
      # Provider/RPC/journal capture remains private for this row.  The signed,
      # allowlisted receipt is the sole public candidate evidence and the sole
      # verdict authority; raw trace and correlation inputs are not exported.
      jq -cn --arg verdict "$SUMMARY_VERDICT" --arg receipt "$R_CD_2_RECEIPT" \
        '{row:"R-CD-2", verdict:$verdict, authoritativeReceipt:$receipt}' > "$RUN_DIR/evidence.jsonl"
      printf '%s\n' 'R-CD-2 private acquisition withheld; inspect the authoritative receipt.' > "$RUN_DIR/evidence-lines.log"
      printf '%s\n' 'R-CD-2 private k6 acquisition withheld; inspect the authoritative receipt.' > "$RUN_DIR/k6.log"
      printf '%s\n' 'R-CD-2 private gateway acquisition withheld; inspect the authoritative receipt.' > "$RUN_DIR/gateway-journal.log"
      rm -f "$TEMPO_TRACE_PATH" "$CORRELATION_RECEIPT_PATH"
      TRACE_ID=""
      TEMPO_TRACE_JSON=""
      CORRELATION_RECEIPT=""
      CORRELATION_RECEIPT_PATH=""
      TRACE_STATUS="r-cd-2-authoritative-receipt"
    fi
    cat "$RUN_DIR/k6.log"
    rm -f "$PRIVATE_K6_LOG" "$PRIVATE_EVIDENCE_FILE" "$PRIVATE_GATEWAY_LOG"
    PRIVATE_K6_LOG=""
    PRIVATE_EVIDENCE_FILE=""
    PRIVATE_GATEWAY_LOG=""

    if [[ "$GATEWAY_JOURNAL_RC" -ne 0 && "${OPENCLAW_PROOFS_SERVICE_LOG_REQUIRED:-true}" == "true" ]]; then
      POSTPROCESS_RC=1
    fi

    EVIDENCE_JSON="null"
    if [[ -s "$RUN_DIR/evidence.jsonl" ]]; then
      EVIDENCE_JSON="$(head -n 1 "$RUN_DIR/evidence.jsonl")"
      if [[ -z "$EVIDENCE_JSON" ]]; then EVIDENCE_JSON="null"; fi
    fi
    EFFECTIVE_RC="$k6_rc"
    if [[ "$EFFECTIVE_RC" -eq 0 && "$POSTPROCESS_RC" -ne 0 ]]; then
      EFFECTIVE_RC="$POSTPROCESS_RC"
    fi
    AUTHORITATIVE_RECEIPT=""
    AUTHORITATIVE_RECEIPT_SHA256=""
    AUTHORITATIVE_RECEIPT_SOURCE=""
    if [[ "$ROW_ID" == "R-CD-2" ]]; then
      AUTHORITATIVE_RECEIPT="$R_CD_2_RECEIPT"
      AUTHORITATIVE_RECEIPT_SHA256="$R_CD_2_RECEIPT_SHA256"
      AUTHORITATIVE_RECEIPT_SOURCE="r-cd-2-row-scoped-resolver"
    elif [[ "$ROW_ID" == "R-CD-TOKEN" ]]; then
      AUTHORITATIVE_RECEIPT="$R_CD_TOKEN_RECEIPT"
      AUTHORITATIVE_RECEIPT_SHA256="$R_CD_TOKEN_RECEIPT_SHA256"
      AUTHORITATIVE_RECEIPT_SOURCE="r-cd-token-row-scoped-resolver"
    fi
    jq -n \
      --argjson rc "$k6_rc" \
      --argjson postprocessRc "$POSTPROCESS_RC" \
      --argjson effectiveRc "$EFFECTIVE_RC" \
      --arg ended "$RUN_ENDED_AT" \
      --arg traceStatus "$TRACE_STATUS" \
      --arg traceId "$TRACE_ID" \
      --arg tempoTraceJson "$TEMPO_TRACE_JSON" \
      --arg correlationReceipt "$CORRELATION_RECEIPT" \
      --arg lifecycleReceipt "$R_CD_2_RECEIPT" \
      --arg authoritativeReceipt "$AUTHORITATIVE_RECEIPT" \
      --arg authoritativeReceiptSource "$AUTHORITATIVE_RECEIPT_SOURCE" \
      --arg authoritativeReceiptSha256 "$AUTHORITATIVE_RECEIPT_SHA256" \
      --arg serviceLogStatus "$GATEWAY_JOURNAL_STATUS" \
      --arg verdict "$SUMMARY_VERDICT" \
      --arg verdictSource "$SUMMARY_VERDICT_SOURCE" \
      --arg summaryFileVerdict "$SUMMARY_FILE_VERDICT" \
      --arg vuLogVerdict "$VU_LOG_VERDICT" \
      --argjson summaryFiles "$SUMMARY_FILES_JSON" \
      --argjson evidence "$EVIDENCE_JSON" \
      --argjson reviewPendingReceipts "$REVIEW_PENDING_RECEIPTS" \
      '{k6ExitCode:$rc, postprocessExitCode:$postprocessRc, effectiveExitCode:$effectiveRc, endedAt:$ended, verdict:(if $verdict == "unknown" then null else $verdict end), verdictSource:$verdictSource, summaryFileVerdict:(if $summaryFileVerdict == "unknown" then null else $summaryFileVerdict end), vuLogVerdict:(if $vuLogVerdict == "" then null else $vuLogVerdict end), summaryFiles:$summaryFiles, evidence:$evidence, candidateOnly:true, foldRequiresReview:true, authoritativeReceipt:(if $authoritativeReceiptSha256 == "" then null else {file:$authoritativeReceipt, sha256:$authoritativeReceiptSha256, validated:true, source:$authoritativeReceiptSource} end), observability:{traceStatus:$traceStatus, traceId:(if $traceId == "" then null else $traceId end), tempoTraceJson:(if $tempoTraceJson == "" then null else $tempoTraceJson end), correlationReceipt:(if $correlationReceipt == "" then null else $correlationReceipt end), lifecycleReceipt:(if $lifecycleReceipt == "" then null else $lifecycleReceipt end), serviceLogStatus:$serviceLogStatus, serviceLog:"gateway-journal.log", serviceLogCapture:"gateway-journal-capture.json", serviceLogRedaction:"gateway-journal-redaction.json"}, review:{status:(if ($reviewPendingReceipts|length)>0 then "review-pending" else "ready-for-human-review" end), pendingReceipts:$reviewPendingReceipts}}' \
      > "$RUN_DIR/run-result.json"
    if [[ "$ROW_ID" == "R-CD-TOKEN" ]]; then
      jq \
        --arg endedAt "$RUN_ENDED_AT" \
        --arg verdict "$SUMMARY_VERDICT" \
        --argjson effectiveExitCode "$EFFECTIVE_RC" \
        '. + {endedAt:$endedAt,phase:"terminal-result-written",proofTerminal:true,consumptionState:(if $verdict == "PASS-candidate" then "complete" else "non-pass-terminal" end),automaticRetryAllowed:false,verdict:(if $verdict == "unknown" then "PARTIAL-candidate" else $verdict end),effectiveExitCode:$effectiveExitCode}' \
        "$RUN_DIR/attempt-state.json" > "$RUN_DIR/attempt-state.json.tmp"
      mv "$RUN_DIR/attempt-state.json.tmp" "$RUN_DIR/attempt-state.json"
      ACTIVE_TOKEN_PHASE="terminal-result-written"
      ACTIVE_TOKEN_RUN_DIR=""
    fi
    # A review-complete candidate can now receive a public-safe routing
    # envelope. Review-pending runs intentionally remain represented only by
    # run-result.json so review-debt can route their missing receipts; neither
    # form is canonical proof or an automatic fold input.
    #
    # DOCS_REF was frozen before the first row fired. Ambient HEAD is never
    # re-read here: a mid-matrix checkout change must not silently relabel the
    # harness that produced this receipt.
    if node "$CANDIDATE_RESULT_VALIDATOR" \
      --manifest "$MANIFEST_FILE" \
      --candidate-dir "$RUN_DIR" \
      --docs-ref "$DOCS_REF" \
      --out "$RUN_DIR/candidate-run-result.json" \
      > "$RUN_DIR/candidate-run-result-validation.json" \
      2> "$RUN_DIR/candidate-run-result-validation.error.log"; then
      rm -f "$RUN_DIR/candidate-run-result-validation.error.log"
      echo "[$ROW_ID] CANDIDATE REVIEW ENVELOPE: $RUN_DIR/candidate-run-result.json"
    else
      rm -f "$RUN_DIR/candidate-run-result.json"
      echo "[$ROW_ID] Candidate routing envelope withheld: review is incomplete or its identity contract did not validate." >&2
    fi
    export_run_metrics "$ROW_ID" "$RUN_DIR"
    rm -f "$RUN_DIR/.started"

    echo "[$ROW_ID] ARTIFACTS: $RUN_DIR"
    if [[ "$EFFECTIVE_RC" -ne 0 ]]; then
      echo "[$ROW_ID] FAILED with effective exit code $EFFECTIVE_RC. Public-safe artifacts preserved."
      MATRIX_ROW_FAILURES+=("$ROW_ID:$EFFECTIVE_RC")
      if [[ "$MATRIX_EXIT_CODE" -eq 0 ]]; then
        MATRIX_EXIT_CODE="$EFFECTIVE_RC"
      fi
      echo "[$ROW_ID] Continuing matrix so later rows retain their one-shot execution and receipts."
      continue
    fi

    echo "[$ROW_ID] COMPLETED."

    # Observability hints
    echo "Observability check: query Grafana for run/nonce or review Tempo traces if trace ID was emitted."
  fi
done

REPORT_PATH="$OUT_ROOT/report.html"
if node scripts/render-run-report.mjs --root "$OUT_ROOT" --out "$REPORT_PATH" > "$OUT_ROOT/report-receipt.json" 2> "$OUT_ROOT/report-error.log"; then
  echo "REPORT: $REPORT_PATH"
else
  echo "REPORT GENERATION FAILED; see $OUT_ROOT/report-error.log" >&2
  if [[ "${OPENCLAW_PROOFS_K6_REPORT_REQUIRED:-false}" == "true" ]]; then
    exit 1
  fi
fi

echo ""
echo "=========================================================="
echo "Runner execution finished."
if [[ "$DEPENDENCY_BLOCKED" == "true" ]]; then
  fail_harness \
    "dependency-gated" \
    "whole-set execution completed with dependency-gated rows blocked" \
    "$(jq -c \
      --arg rowFailures "${MATRIX_ROW_FAILURES[*]}" \
      '{check:"producer-dependencies",blocked,plan:"producer-plan.json",rowFailures:($rowFailures | if length == 0 then [] else split(" ") end)}' \
      "$PRODUCER_PLAN_FILE")"
fi
if [[ "${#MATRIX_ROW_FAILURES[@]}" -gt 0 ]]; then
  echo "Rows with non-zero effective exits: ${MATRIX_ROW_FAILURES[*]}" >&2
  exit "$MATRIX_EXIT_CODE"
fi
