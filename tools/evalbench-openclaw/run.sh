#!/usr/bin/env bash
# run.sh <preflight|run|offline|report|overlay|test> [args]: the harness in EvalBench's own environment.
set -euo pipefail
HERE=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)
PIN=$(tr -d '[:space:]' < "$HERE/EVALBENCH_PIN")
ROOT=${OPENCLAW_EVALBENCH_HOME:-$HOME/.cache/openclaw-evalbench}
PY=$ROOT/venv-$PIN/bin/python
SRC=$ROOT/evalbench-$PIN
[ -x "$PY" ] && [ "$(git -C "$SRC" rev-parse HEAD 2>/dev/null)" = "$PIN" ] \
  || { echo "EvalBench is not installed at $PIN; run ./bootstrap.sh" >&2; exit 2; }
# EvalBench's python_scorer runs `uv` from PATH; without it every election scores 0.
UV=${UV:-$(command -v uv || true)}
[ -n "$UV" ] && [ -x "$UV" ] || { echo "uv not found; install it or set UV=/path/to/uv" >&2; exit 2; }
export PATH="$(dirname "$UV"):$PATH" UV_CACHE_DIR="${UV_CACHE_DIR:-$ROOT/uv-cache}"
# EvalBench's modules import each other as top-level names (util, evalproto, …), as its own entry points do.
export PYTHONPATH="$HERE:$SRC/evalbench" OPENCLAW_EVALBENCH_SRC="$SRC" PYTHONDONTWRITEBYTECODE=1
if [ "${1:-}" = test ]; then shift; exec "$PY" -m pytest -q -p no:cacheprovider "$HERE/tests" "$@"; fi
exec "$PY" -m openclaw_evalbench "$@"
