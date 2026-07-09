#!/usr/bin/env bash
set -euo pipefail
cd "/tmp/oc-p81-current/tools/k6-proofs"
echo "RUN_ID=p81-cael-live-20260709T030352Z"
echo "STARTED_AT=$(date -u +%Y-%m-%dT%H:%M:%SZ)"
echo "DOCS_SHA=2a57cd8528e43da3bc0f8adad7c48cd8470a5252"
echo "TARGET_SHA=e08f696618da57e7267a2148578fa4ab0d8b0d01"
echo "OPENCLAW_VERSION=$(openclaw --version 2>&1 || true)"
./scripts/run-proofs.sh --live --out-dir "/tmp/p81-cael-live-20260709T030352Z/out" all "e08f696618da57e7267a2148578fa4ab0d8b0d01"
rc=$?
echo "FINISHED_AT=$(date -u +%Y-%m-%dT%H:%M:%SZ)"
echo "RC=$rc"
exit "$rc"
