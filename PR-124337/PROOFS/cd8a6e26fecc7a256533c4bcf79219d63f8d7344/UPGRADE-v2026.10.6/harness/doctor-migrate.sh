#!/usr/bin/env bash
# Upgrade step a real install runs before its first post-upgrade client: the reader tree's
# own `openclaw doctor --fix --non-interactive` over the stable-written state dir.
#   doctor-migrate.sh <tree> <run>
set -u
tree=$1; run=$2
cd "$tree" || exit 2
HOME=$run/home TMPDIR=$run/tmp OPENCLAW_STATE_DIR=$run/state OPENCLAW_CONFIG_PATH=$run/openclaw.json \
  OPENCLAW_PROFILE=proof124337 node openclaw.mjs doctor --fix --non-interactive
