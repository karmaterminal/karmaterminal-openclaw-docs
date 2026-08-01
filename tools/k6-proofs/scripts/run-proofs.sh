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

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROOFS_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
REPO_ROOT="$(cd "$PROOFS_DIR/../.." && pwd)"
PROOFS_TOOL_RELPATH="tools/k6-proofs"
# Infrastructure exit code (EX_CONFIG). It is deliberately distinct from a row's
# effective exit code so a harness setup failure can never be read as a product
# verdict.
HARNESS_INFRA_EXIT=78
CATALOG_CHECKS=(check-manifest-scenarios.mjs check-scenario-alignment.mjs check-proof-row-manifests.mjs)
EVIDENCE_EXTRACTOR="$SCRIPT_DIR/extract-k6-evidence.mjs"
CONTINUATION_TRACE_COLLECTOR="$SCRIPT_DIR/collect-continuation-trace.mjs"
R_CD_2_RECEIPT_RESOLVER="$SCRIPT_DIR/resolve-r-cd-2-authoritative-receipt.mjs"
ARTIFACT_SANITIZER="$SCRIPT_DIR/sanitize-k6-artifacts.mjs"
CANDIDATE_RESULT_VALIDATOR="$SCRIPT_DIR/validate-candidate-run-result.mjs"
INTERRUPTED_RESULT_WRITER="$SCRIPT_DIR/write-interrupted-run-result.mjs"
R_CD_TOKEN_RECEIPT_RESOLVER="$SCRIPT_DIR/resolve-r-cd-token-authoritative-receipt.mjs"
PRIVATE_K6_LOG=""
PRIVATE_EVIDENCE_FILE=""
PRIVATE_GATEWAY_LOG=""
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
    "${SOURCE_CONTRACT_FILE:-}"
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

# One harness infrastructure receipt, written instead of any per-row product
# verdict. A catalog/identity failure is a setup fault: no row may execute, and
# nothing here may be read as candidate behavior.
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
    --arg docsRefInput "$(if [[ "$DOCS_REF_INPUT" =~ ^[0-9a-f]{40}$ ]]; then printf '%s' "$DOCS_REF_INPUT"; elif [[ -n "$DOCS_REF_INPUT" ]]; then printf 'malformed'; fi)" \
    --arg candidate "${OPENCLAW_CANDIDATE_SHA:-}" \
    --arg repository "$DOCS_REPOSITORY" \
    --arg recordedAt "$recorded_at" \
    --argjson exitCode "$HARNESS_INFRA_EXIT" \
    --argjson rowSelection "$ROW_SELECTION_JSON" \
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
      rowsExecuted: 0,
      rowVerdictsSynthesized: false,
      productVerdict: null,
      exitCode: $exitCode,
      detail: $detail,
      recordedAt: $recordedAt
    }' > "$OUT_ROOT/harness-control-receipt.json"
  echo "HARNESS INFRASTRUCTURE FAILURE [$stage]: $reason" >&2
  echo "CONTROL RECEIPT: $OUT_ROOT/harness-control-receipt.json" >&2
  echo "No rows executed; no per-row candidate verdict was synthesized." >&2
}

fail_harness() {
  write_harness_control_receipt "$1" "$2" "${3:-null}"
  exit "$HARNESS_INFRA_EXIT"
}

if [[ -z "$CANDIDATE_SHA" && -z "${OPENCLAW_CANDIDATE_SHA:-}" ]]; then
  CANDIDATE_SHA="$(git -C "$REPO_ROOT" rev-parse HEAD 2>/dev/null || echo 'unknown')"
fi

if [[ -n "$CANDIDATE_SHA" ]]; then export OPENCLAW_CANDIDATE_SHA="${CANDIDATE_SHA}"; fi
export OPENCLAW_SEAT_NAME="$(hostname)"

# Local Gateway Auth extraction (never logged/committed)
if [[ -z "${OPENCLAW_GATEWAY_TOKEN:-}" && -f ~/.openclaw/openclaw.json ]]; then
  export OPENCLAW_GATEWAY_TOKEN="$(jq -r '.gateway.auth.token // .auth.operatorToken // empty' ~/.openclaw/openclaw.json)"
fi
if [[ -z "${OPENCLAW_GATEWAY_TOKEN:-}" ]]; then
  echo "Warning: OPENCLAW_GATEWAY_TOKEN not found in local config."
  if [[ "$DRY_RUN" == "false" ]]; then
    exit 1
  fi
fi

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

# Portable observability endpoints. Defaults preserve the dandelion fleet, but
# reviewers can override without editing scripts or docs-local config.
export OPENCLAW_PROOFS_TEMPO_BASE_URL="${OPENCLAW_PROOFS_TEMPO_BASE_URL:-${TEMPO_BASE_URL:-http://tempo.dandelion.cult}}"
export OPENCLAW_PROOFS_LOKI_BASE_URL="${OPENCLAW_PROOFS_LOKI_BASE_URL:-${LOKI_BASE_URL:-http://loki.dandelion.cult}}"
export OPENCLAW_PROOFS_PROMETHEUS_BASE_URL="${OPENCLAW_PROOFS_PROMETHEUS_BASE_URL:-${PROMETHEUS_BASE_URL:-http://prometheus.dandelion.cult}}"

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

echo "=========================================================="
echo "Project 81: Seat-Aware k6 Proof Runner"
echo "Seat: $OPENCLAW_SEAT_NAME"
echo "Target Candidate SHA: $OPENCLAW_CANDIDATE_SHA"
echo "Deployed Runtime SHA: $OPENCLAW_RUNTIME_BUILD_SHA"
echo "Session configured: true"
echo "Artifact root: $OUT_ROOT"

# Catalog preflight (#495). The validators receive one explicit repository root,
# so they inspect the same files whatever directory the caller started in. A
# failure here stops the matrix before any row executes.
CATALOG_PREFLIGHT_LOG="$OUT_ROOT/catalog-preflight.log"
: > "$CATALOG_PREFLIGHT_LOG"
echo "Running catalog preflight (repository root: $PROOFS_TOOL_RELPATH resolved once)..."
for CATALOG_CHECK in "${CATALOG_CHECKS[@]}"; do
  printf '### %s\n' "$CATALOG_CHECK" >> "$CATALOG_PREFLIGHT_LOG"
  if ! node "$SCRIPT_DIR/$CATALOG_CHECK" --repo-root "$REPO_ROOT" >> "$CATALOG_PREFLIGHT_LOG" 2>&1; then
    fail_harness \
      "catalog-preflight" \
      "catalog validator '$CATALOG_CHECK' failed; the row catalog could not be resolved" \
      "$(jq -n --arg check "$CATALOG_CHECK" '{failedCheck:$check, log:"catalog-preflight.log"}')"
  fi
done
echo "CATALOG PREFLIGHT: $CATALOG_PREFLIGHT_LOG"

if [[ "$ROWS" == "all" ]]; then
  ROWS="$(for f in manifests/*.json; do jq -r 'select(.scenario.status == "runnable") | .rowId' "$f"; done | paste -sd, -)"
fi

if [[ -z "$ROWS" ]]; then
  echo "No runnable rows found."
  exit 1
fi

ROW_SELECTION_JSON="$(printf '%s' "$ROWS" | jq -R 'split(",") | map(ascii_upcase)')"
IFS=',' read -ra ROW_ARRAY <<< "$ROWS"

echo "Rows: $ROWS"
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
  url="$(git -C "$REPO_ROOT" config --get remote.origin.url 2>/dev/null || true)"
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
  git -C "$REPO_ROOT" cat-file -e "$DOCS_REF:$relpath" 2>/dev/null || return 1
  git -C "$REPO_ROOT" show "$DOCS_REF:$relpath" 2>/dev/null | sha256sum | cut -d' ' -f1
}

worktree_sha256() {
  sha256sum "$REPO_ROOT/$1" | cut -d' ' -f1
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

  HEAD_SHA="$(git -C "$REPO_ROOT" rev-parse HEAD 2>/dev/null || true)"
  if [[ "$HEAD_SHA" != "$DOCS_REF" ]]; then
    fail_harness \
      "harness-identity" \
      "harness checkout does not match the approved docs ref; refusing to fire a stale or mixed harness" \
      "$(jq -n --arg head "$HEAD_SHA" --arg approved "$DOCS_REF" '{check:"head-equals-docs-ref", head:(if $head == "" then null else $head end), approved:$approved}')"
  fi

  HARNESS_DIRTY="$(git -C "$REPO_ROOT" status --porcelain --untracked-files=no -- "$PROOFS_TOOL_RELPATH" 2>/dev/null || printf 'git-unavailable')"
  if [[ -n "$HARNESS_DIRTY" ]]; then
    fail_harness \
      "harness-identity" \
      "tracked bytes under $PROOFS_TOOL_RELPATH are modified; a dirty harness cannot certify which contract produced a receipt" \
      "$(jq -n --arg count "$(printf '%s\n' "$HARNESS_DIRTY" | grep -c . || true)" '{check:"harness-tree-clean", dirtyEntries:($count|tonumber)}')"
  fi

  if [[ ! "$DOCS_REPOSITORY" =~ ^[A-Za-z0-9_.-]+/[A-Za-z0-9_.-]+$ ]]; then
    fail_harness \
      "harness-identity" \
      "no public-safe repository identity for the harness; set OPENCLAW_PROOFS_DOCS_REPOSITORY=<owner>/<repo>" \
      "$(jq -n '{check:"repository-identity"}')"
  fi

  for BIND_ROW in "${ROW_ARRAY[@]}"; do
    BIND_ROW="$(printf '%s' "$BIND_ROW" | tr '[:lower:]' '[:upper:]')"
    BIND_MANIFEST=""
    BIND_MANIFEST="$(find_manifest_relpath "$BIND_ROW" || true)"
    # A row with no manifest is reported as SKIPPED by the row loop; it never
    # fires, so it has no harness contract to bind.
    [[ -n "$BIND_MANIFEST" ]] || continue
    BIND_STATUS="$(jq -r '.scenario.status // empty' "$BIND_MANIFEST")"
    [[ "$BIND_STATUS" == "runnable" ]] || continue
    BIND_SCENARIO="$(jq -r '.scenario.file // .scenario.name // empty' "$BIND_MANIFEST")"
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
      BIND_WORKTREE="$(worktree_sha256 "$BIND_PATH")"
      if [[ "$BIND_TRACKED" != "$BIND_WORKTREE" ]]; then
        fail_harness \
          "harness-identity" \
          "$BIND_PATH differs from the approved docs ref; refusing to fire mutated harness bytes" \
          "$(jq -n --arg row "$BIND_ROW" --arg path "$BIND_PATH" '{check:"bytes-match-docs-ref", row:$row, path:$path}')"
      fi
      if [[ "$BIND_PATH" == "$BIND_MANIFEST_REL" ]]; then
        ROW_MANIFEST_RELPATH["$BIND_ROW"]="$BIND_MANIFEST_REL"
        ROW_MANIFEST_SHA256["$BIND_ROW"]="$BIND_WORKTREE"
      else
        ROW_SCENARIO_RELPATH["$BIND_ROW"]="$BIND_SCENARIO_REL"
        ROW_SCENARIO_SHA256["$BIND_ROW"]="$BIND_WORKTREE"
      fi
    done
  done
  HARNESS_IDENTITY_VERIFIED=true
  echo "Approved docs ref: $DOCS_REF ($DOCS_REPOSITORY)"
  echo "Harness identity: verified clean and tracked for every selected runnable row."
elif [[ "$DOCS_REF_INPUT" =~ ^[0-9a-f]{40}$ ]]; then
  DOCS_REF="$DOCS_REF_INPUT"
  DOCS_REF_SOURCE="approved-input"
  echo "Docs ref (recorded, unenforced in dry run): $DOCS_REF"
fi

# Check for Live Bridge alignment (candidate vs deployed runtime)
if [[ "$DRY_RUN" == "false" && "$OPENCLAW_CANDIDATE_SHA" != "$OPENCLAW_RUNTIME_BUILD_SHA" && "$OPENCLAW_RUNTIME_BUILD_SHA" != *"(${OPENCLAW_CANDIDATE_SHA:0:7})"* ]]; then
  echo "WARNING: Candidate SHA ($OPENCLAW_CANDIDATE_SHA) does not match Deployed Runtime SHA ($OPENCLAW_RUNTIME_BUILD_SHA)."
  echo "Unless this is a known stale-stamp or you have proven a rebuild bridge, live proofs will be marked PARTIAL."
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
RUNNER_SCRIPT_SHA256="$(sha256sum "${BASH_SOURCE[0]}" | cut -d' ' -f1)"
RUN_MATRIX_STARTED_AT="$(date -u +%Y-%m-%dT%H:%M:%SZ)"
PROVENANCE_ROWS_JSON='[]'
for PROV_ROW in "${ROW_ARRAY[@]}"; do
  PROV_ROW="$(printf '%s' "$PROV_ROW" | tr '[:lower:]' '[:upper:]')"
  PROVENANCE_ROWS_JSON="$(
    jq -cn \
      --argjson rows "$PROVENANCE_ROWS_JSON" \
      --arg row "$PROV_ROW" \
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
  --arg repository "$DOCS_REPOSITORY" \
  --arg candidate "$OPENCLAW_CANDIDATE_SHA" \
  --arg runtimeBuildSha "$OPENCLAW_RUNTIME_BUILD_SHA" \
  --arg seat "$OPENCLAW_SEAT_NAME" \
  --arg seatReadinessSha256 "$SEAT_READINESS_SHA256" \
  --arg runnerScript "$PROOFS_TOOL_RELPATH/scripts/run-proofs.sh" \
  --arg runnerScriptSha256 "$RUNNER_SCRIPT_SHA256" \
  --arg mode "$RUN_MODE" \
  --arg startedAt "$RUN_MATRIX_STARTED_AT" \
  --argjson identityVerified "$HARNESS_IDENTITY_VERIFIED" \
  --argjson rowSelection "$ROW_SELECTION_JSON" \
  --argjson rows "$PROVENANCE_ROWS_JSON" \
  '{
    schema: "openclaw.k6.harness-provenance.v1",
    classification: "harness-provenance",
    mode: $mode,
    docsRef: (if $docsRef == "" then null else $docsRef end),
    docsRefSource: $docsRefSource,
    repository: (if $repository == "" then null else $repository end),
    harnessIdentityVerified: $identityVerified,
    candidateSha: (if $candidate == "" or $candidate == "unknown" then null else $candidate end),
    runtimeIdentity: {
      seat: $seat,
      runtimeBuildSha: (if $runtimeBuildSha == "" or $runtimeBuildSha == "unknown" then null else $runtimeBuildSha end),
      candidateMatchesRuntime: ($candidate == $runtimeBuildSha),
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
echo "HARNESS PROVENANCE: $HARNESS_PROVENANCE_JSON"
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

  echo ""
  echo "----------------------------------------"
  echo "Row: $ROW_ID"
  echo "Manifest: $MANIFEST_FILE"
  echo "Scenario: ${SCENARIO_FILE:+scenarios/$SCENARIO_FILE}"
  echo "Status: $SCENARIO_STATUS"
  echo "Live Safety: $LIVE_SAFETY"

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
    # Frozen at startup by the harness identity gate. An unbound row means the
    # gate never saw it, so it must not fire and must not produce a verdict.
    if [[ -z "$ROW_MANIFEST_DIGEST" || -z "$ROW_SCENARIO_DIGEST" ]]; then
      fail_harness \
        "harness-identity" \
        "row $ROW_ID has no frozen manifest/scenario digest bound to the approved docs ref" \
        "$(jq -n --arg row "$ROW_ID" '{check:"row-bound-to-docs-ref", row:$row}')"
    fi

    echo "[$ROW_ID] RUNNING..."
    export OPENCLAW_ROW_MANIFEST="$MANIFEST_FILE"

    RUN_ID="$(date -u +%Y%m%dT%H%M%SZ)-$(printf '%s' "$ROW_ID" | tr '[:upper:]' '[:lower:]' | tr -cs 'a-z0-9' '-')"
    RUN_DIR="$OUT_ROOT/$OPENCLAW_CANDIDATE_SHA/$ROW_ID/$OPENCLAW_SEAT_NAME/$RUN_ID"
    mkdir -p "$RUN_DIR"
    touch "$RUN_DIR/.started"
    cp "$MANIFEST_FILE" "$RUN_DIR/row-manifest.json"
    # The exact scenario source travels with the receipt so a reviewer can prove
    # which contract bytes produced it without trusting the run directory name.
    cp "scenarios/$SCENARIO_FILE" "$RUN_DIR/row-scenario.js"
    RUN_STARTED_AT="$(date -u +%Y-%m-%dT%H:%M:%SZ)"
    jq -n \
      --arg row "$ROW_ID" \
      --arg scenario "$SCENARIO_FILE" \
      --arg candidate "$OPENCLAW_CANDIDATE_SHA" \
      --arg runtime "$OPENCLAW_RUNTIME_BUILD_SHA" \
      --arg seat "$OPENCLAW_SEAT_NAME" \
      --arg started "$RUN_STARTED_AT" \
      --arg docsRef "$DOCS_REF" \
      --arg repository "$DOCS_REPOSITORY" \
      --arg manifestPath "$ROW_MANIFEST_REL" \
      --arg manifestSha256 "$ROW_MANIFEST_DIGEST" \
      --arg scenarioPath "$ROW_SCENARIO_REL" \
      --arg scenarioSha256 "$ROW_SCENARIO_DIGEST" \
      '{row:$row, scenario:$scenario, candidateSha:$candidate, runtimeBuildSha:$runtime, seat:$seat, sessionConfigured:true, startedAt:$started, docsRef:$docsRef, repository:$repository, manifestPath:$manifestPath, manifestSha256:$manifestSha256, scenarioPath:$scenarioPath, scenarioSha256:$scenarioSha256}' \
      > "$RUN_DIR/runner-metadata.json"
    if [[ "$ROW_ID" == "R-CD-TOKEN" ]]; then
      if [[ ! "$OPENCLAW_CANDIDATE_SHA" =~ ^[0-9a-f]{40}$ ||
            ! "$OPENCLAW_RUNTIME_BUILD_SHA" =~ ^[0-9a-f]{40}$ ||
            "$OPENCLAW_CANDIDATE_SHA" != "$OPENCLAW_RUNTIME_BUILD_SHA" ]]; then
        RUN_ENDED_AT="$(date -u +%Y-%m-%dT%H:%M:%SZ)"
        jq -n \
          --arg candidateSha "$OPENCLAW_CANDIDATE_SHA" \
          --arg runtimeBuildSha "$OPENCLAW_RUNTIME_BUILD_SHA" \
          --arg endedAt "$RUN_ENDED_AT" \
          '{schema:"openclaw.k6.r-cd-token.build-identity-gate.v1",row:"R-CD-TOKEN",candidateSha:$candidateSha,runtimeBuildSha:$runtimeBuildSha,equalExactSha:false,dispatched:false,verdict:"PARTIAL-candidate",endedAt:$endedAt}' \
          > "$RUN_DIR/build-identity-gate.json"
        jq -n \
          --arg endedAt "$RUN_ENDED_AT" \
          '{k6ExitCode:0,postprocessExitCode:0,effectiveExitCode:0,endedAt:$endedAt,verdict:"PARTIAL-candidate",verdictSource:"pre-dispatch-build-identity-gate",summaryFileVerdict:null,vuLogVerdict:null,summaryFiles:[],evidence:{row:"R-CD-TOKEN",dispatched:false},candidateOnly:true,foldRequiresReview:true,terminal:true,observability:{traceStatus:"not-applicable",traceId:null,tempoTraceJson:null,correlationReceipt:null,serviceLogStatus:"not-started",serviceLog:null,serviceLogCapture:null,serviceLogRedaction:null},review:{status:"review-pending",pendingReceipts:["exact-candidate-runtime-identity","attempt-state","raw-final-text-origin","parser-detected","queue-identity","child-spawned","child-completed","parent-return-event","tempo-trace-json","continuation-trace-correlation"]}}' \
          > "$RUN_DIR/run-result.json"
        rm -f "$RUN_DIR/.started"
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
    if [[ "$ROW_ID" == "R-CD-TOKEN" ]]; then ACTIVE_TOKEN_PHASE="k6-running"; fi
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
    TRACE_REQUIRED="$(jq -r '((.liveRunSafety.requiredReceipts // []) | map(ascii_downcase) | any(. == "trace-id" or . == "tempo-trace-json"))' "$MANIFEST_FILE")"
    MANIFEST_TOOL="$(jq -r '.invocation.tool // empty' "$MANIFEST_FILE")"
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
        if [[ "${OPENCLAW_PROOFS_K6_TEMPO_REQUIRED:-false}" == "true" ]]; then
          POSTPROCESS_RC=1
        fi
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
        if [[ "${OPENCLAW_PROOFS_K6_TEMPO_REQUIRED:-false}" == "true" ]]; then
          POSTPROCESS_RC=1
        fi
      fi
    elif [[ "$TRACE_REQUIRED" == "true" ]]; then
      TRACE_STATUS="missing"
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
      RESOLVER_ARGS=(--run-dir "$RUN_DIR" --evidence "$PRIVATE_EVIDENCE_FILE")
      if [[ -n "$CORRELATION_RECEIPT_PATH" && -f "$CORRELATION_RECEIPT_PATH" ]]; then
        RESOLVER_ARGS+=(--correlation "$CORRELATION_RECEIPT_PATH")
      fi
      if node "$R_CD_2_RECEIPT_RESOLVER" "${RESOLVER_ARGS[@]}" > "$RUN_DIR/r-cd-2-authoritative-resolution.json"; then
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
    METRICS_ARGS=(--run-dir "$RUN_DIR" --prometheus-out "$RUN_DIR/openclaw-proofs-k6.prom" --otlp-out "$RUN_DIR/openclaw-proofs-k6.otlp.json")
    if [[ -n "${OPENCLAW_PROOFS_K6_OTLP_ENDPOINT:-}" ]]; then
      METRICS_ARGS+=(--push-otlp "$OPENCLAW_PROOFS_K6_OTLP_ENDPOINT")
    fi
    if node scripts/export-row-metrics.mjs "${METRICS_ARGS[@]}" > "$RUN_DIR/metrics-export.json"; then
      echo "[$ROW_ID] METRICS: $RUN_DIR/openclaw-proofs-k6.prom"
    else
      echo "[$ROW_ID] METRICS EXPORT FAILED; see $RUN_DIR/metrics-export.json" >&2
      if [[ "${OPENCLAW_PROOFS_K6_METRICS_REQUIRED:-false}" == "true" ]]; then
        exit 1
      fi
    fi
    rm -f "$RUN_DIR/.started"

    echo "[$ROW_ID] ARTIFACTS: $RUN_DIR"
    if [[ "$EFFECTIVE_RC" -ne 0 ]]; then
      echo "[$ROW_ID] FAILED with effective exit code $EFFECTIVE_RC. Public-safe artifacts preserved."
      exit "$EFFECTIVE_RC"
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
