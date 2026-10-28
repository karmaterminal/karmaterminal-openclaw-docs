#!/usr/bin/env bash
# Small, cwd-independent entrypoint for the Project 81 k6 proof set.
# Live rows still go through run-proofs.sh's immutable-harness and seat gates.
set -euo pipefail

PROOFS_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$PROOFS_DIR/../.." && pwd)"

usage() {
  cat <<'EOF'
Usage:
  tools/k6-proofs/proofs.sh list [--live-suite]
  tools/k6-proofs/proofs.sh check
  tools/k6-proofs/proofs.sh smoke [--out-dir DIR]
  tools/k6-proofs/proofs.sh dry ROWS CANDIDATE_SHA [--out-dir DIR]
  tools/k6-proofs/proofs.sh live ROWS CANDIDATE_SHA --docs-ref DOCS_SHA [--out-dir DIR] [--session SELECTOR]

ROWS is a comma-separated list of row IDs or "all". SHA values are full 40-hex
commits. Live execution needs the explicit target/auth/depth environment described
in tools/k6-proofs/README.md; this wrapper never supplies or guesses those values.
Artifacts are candidate-only and require review before folding.
EOF
}

die() {
  printf 'ERROR: %s\n' "$*" >&2
  exit 2
}

[[ $# -gt 0 ]] || { usage; exit 2; }
COMMAND="$1"
shift

case "$COMMAND" in
  help|-h|--help) usage; exit 0 ;;
  list)
    [[ $# -eq 0 || ( $# -eq 1 && "$1" == "--live-suite" ) ]] || die "list accepts only --live-suite"
    exec node "$PROOFS_DIR/scripts/list-runnable-rows.mjs" --repo-root "$REPO_ROOT" "$@"
    ;;
  check)
    [[ $# -eq 0 ]] || die "check accepts no arguments"
    CHECK_LOG="$(mktemp "${TMPDIR:-/tmp}/k6-proofs-check.XXXXXX")"
    trap 'rm -f "$CHECK_LOG"' EXIT
    for validator in check-manifest-scenarios check-scenario-alignment check-proof-row-manifests check-telemetry-contracts check-k6-skill; do
      if ! node "$PROOFS_DIR/scripts/$validator.mjs" --repo-root "$REPO_ROOT" > "$CHECK_LOG" 2>&1; then
        cat "$CHECK_LOG" >&2
        die "$validator failed"
      fi
      printf 'PASS %s\n' "$validator"
    done
    if ! node --test "$PROOFS_DIR/scripts/__tests__/golden-path.test.mjs" > "$CHECK_LOG" 2>&1; then
      cat "$CHECK_LOG" >&2
      die "offline golden-path tests failed"
    fi
    printf 'PASS offline golden-path tests\n'
    exit 0
    ;;
  smoke|dry|live) ;;
  *) die "unknown command: $COMMAND (run --help)" ;;
esac

ROWS=""
CANDIDATE_SHA=""
if [[ "$COMMAND" != "smoke" ]]; then
  [[ $# -ge 2 ]] || die "$COMMAND requires ROWS and CANDIDATE_SHA"
  ROWS="$1"
  CANDIDATE_SHA="$2"
  shift 2
  [[ "$ROWS" == "all" || "$ROWS" =~ ^[A-Za-z0-9][A-Za-z0-9._-]*(,[A-Za-z0-9][A-Za-z0-9._-]*)*$ ]] ||
    die "ROWS must be 'all' or comma-separated row IDs"
  [[ "$CANDIDATE_SHA" =~ ^[0-9a-f]{40}$ ]] || die "CANDIDATE_SHA must be a full lowercase 40-hex SHA"
fi

OUT_DIR=""
DOCS_REF=""
SESSION=""
while [[ $# -gt 0 ]]; do
  case "$1" in
    --out-dir)
      [[ $# -ge 2 && -n "$2" ]] || die "--out-dir requires a directory"
      OUT_DIR="$2"
      shift 2
      ;;
    --docs-ref)
      [[ "$COMMAND" == "live" && $# -ge 2 && -n "$2" ]] || die "--docs-ref is only valid for live and requires a SHA"
      DOCS_REF="$2"
      shift 2
      ;;
    --session)
      [[ "$COMMAND" == "live" && $# -ge 2 && -n "$2" ]] || die "--session is only valid for live and requires a selector"
      SESSION="$2"
      shift 2
      ;;
    *) die "unknown option: $1" ;;
  esac
done

if [[ "$COMMAND" == "live" ]]; then
  [[ "$DOCS_REF" =~ ^[0-9a-f]{40}$ ]] || die "live requires --docs-ref with a full lowercase 40-hex SHA"
  [[ -n "$SESSION" || -n "${OPENCLAW_SESSION_KEY:-}" ]] ||
    die "live requires --session or an explicit OPENCLAW_SESSION_KEY; no ambient session is selected"
fi

if [[ -z "$OUT_DIR" ]]; then
  OUT_DIR="$(mktemp -d "${TMPDIR:-/tmp}/k6-proofs-$COMMAND.XXXXXX")"
else
  mkdir -p "$OUT_DIR"
fi
OUT_DIR="$(cd "$OUT_DIR" && pwd)"
printf 'Candidate artifact root: %s\n' "$OUT_DIR"

if [[ "$COMMAND" == "smoke" ]]; then
  # Synthetic identity makes the fixture's output legible and prevents it from
  # being mistaken for an actual candidate or seat.
  SMOKE_SHA="0000000000000000000000000000000000000000"
  jq --arg sha "$SMOKE_SHA" \
    '.candidateSha=$sha | .seat="offline-smoke" | .sessionKey="offline-smoke" |
     .artifactDestination.sha=$sha | .artifactDestination.seat="offline-smoke"' \
    "$PROOFS_DIR/manifests/preflight.example.json" > "$OUT_DIR/offline-smoke-manifest.json"
  exec node "$PROOFS_DIR/scripts/postprocess-k6-summary.mjs" \
    --manifest "$OUT_DIR/offline-smoke-manifest.json" \
    --summary "$PROOFS_DIR/examples/k6-summary.preflight.example.json" \
    --out-root "$OUT_DIR"
fi

RUN_MODE_FLAG="--live"
if [[ "$COMMAND" == "dry" ]]; then RUN_MODE_FLAG="--dry-run"; fi
RUN_ARGS=("$RUN_MODE_FLAG" --out-dir "$OUT_DIR")
if [[ "$COMMAND" == "live" ]]; then
  RUN_ARGS+=(--docs-ref "$DOCS_REF")
  [[ -z "$SESSION" ]] || RUN_ARGS+=(--session "$SESSION")
fi
RUN_ARGS+=("$ROWS" "$CANDIDATE_SHA")
cd "$PROOFS_DIR"
exec "$PROOFS_DIR/scripts/run-proofs.sh" "${RUN_ARGS[@]}"
