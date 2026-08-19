# openclaw-local-ci - FAILURE

- target: `karmaterminal/openclaw@c3a0e5a314ecbf572911d4b2e84595bd06f64d69`
- commit: `c3a0e5a314ecbf572911d4b2e84595bd06f64d69`
- shard jobs planned: `162`
- artifacts with summaries: `163`
- run: https://github.com/karmaterminal/openclaw-bootstrap/actions/runs/32209969307

## Job results
- PASS `preflight`: success
- PASS `custom-command`: skipped
- PASS `static-gates`: success
- FAIL `test-shard`: failure

## Full-suite tally
- passed: 157772
- failed: 3
- load-flakes greened: 2

## Deterministic failures (1)
- [agentic-gateway-core-3 / test] gateway-core  src/gateway/portals/portal-http-proxy.test.ts > portal HTTP proxy > reaches IPv6-only targets through the localhost dual-stack dial
