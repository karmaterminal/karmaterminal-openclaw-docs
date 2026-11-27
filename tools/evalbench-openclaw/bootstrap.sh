#!/usr/bin/env bash
# Install EvalBench at EVALBENCH_PIN, outside this repository. Safe to re-run.
#   OPENCLAW_EVALBENCH_HOME  install root (default ~/.cache/openclaw-evalbench)
#   UV                       the uv binary (default: uv on PATH)
set -euo pipefail
HERE=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)
PIN=$(tr -d '[:space:]' < "$HERE/EVALBENCH_PIN")
[[ $PIN =~ ^[0-9a-f]{40}$ ]] || { echo "EVALBENCH_PIN is not a full commit SHA" >&2; exit 2; }
ROOT=${OPENCLAW_EVALBENCH_HOME:-$HOME/.cache/openclaw-evalbench}
UV=${UV:-$(command -v uv || true)}
[ -n "$UV" ] && [ -x "$UV" ] || { echo "uv not found; install it or set UV=/path/to/uv" >&2; exit 2; }
SRC=$ROOT/evalbench-$PIN
mkdir -p "$ROOT"
if [ ! -d "$SRC/.git" ]; then
  git init -q "$SRC"
  git -C "$SRC" remote add origin https://github.com/GoogleCloudPlatform/evalbench
fi
git -C "$SRC" cat-file -e "$PIN^{commit}" 2>/dev/null || git -C "$SRC" fetch -q --depth 1 origin "$PIN"
git -C "$SRC" checkout -q --force --detach "$PIN"
[ "$(git -C "$SRC" rev-parse HEAD)" = "$PIN" ] || { echo "checkout is not at $PIN" >&2; exit 3; }
# The locked versions, on a Python this host already has (no interpreter download).
UV_CACHE_DIR=${UV_CACHE_DIR:-$ROOT/uv-cache} UV_PROJECT_ENVIRONMENT=$ROOT/venv-$PIN \
  "$UV" sync --project "$SRC" --frozen --python-preference only-system --quiet
PY=$ROOT/venv-$PIN/bin/python
# The stubs checked in at this commit are older than the .proto files (ReportingContext is missing), and EvalBench's
# own integration test fails on them. Upstream CI regenerates first (`make proto`); so do we, with the locked grpcio-tools.
(cd "$SRC" && "$PY" -m grpc_tools.protoc --proto_path=evalbench/evalproto --python_out=evalbench/evalproto \
  --pyi_out=evalbench/evalproto --grpc_python_out=evalbench/evalproto --experimental_editions evalbench/evalproto/*.proto)
dirty=$(git -C "$SRC" status --porcelain --untracked-files=no | grep -v ' evalbench/evalproto/.*_pb2' || true)
[ -z "$dirty" ] || { echo "unexpected change in the EvalBench checkout:" >&2; echo "$dirty" >&2; exit 3; }
echo "EvalBench $PIN ready: $SRC ($("$PY" --version))"
