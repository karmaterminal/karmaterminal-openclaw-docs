---
name: k6-proofs
description: "Use when building, running, verifying, or extending k6 PROOFS behavioral proof-row scenarios for the OpenClaw continuation feature corpus (continue_work / continue_delegate / request_compaction). Covers the k6 harness, scenario authoring, metrics naming, evidence/OTel correlation, both-forms (tool + token) mandate, caps-test procedure, Prometheus/Grafana/Loki/Tempo reporting, and the Project-81 row registry."
---

# k6 PROOFS

Scriptable, deterministic proof-row automation for the OpenClaw continuation feature
behavioral corpus. Use this skill to author a new proof scenario, run it against any
prince's gateway, capture OTel/Prometheus/Loki evidence, and land results in the PROOFS
corpus — without archaeology.

The harness, scenarios, runner, dashboards, and the machine-parseable pipeline all live in
`karmaterminal/karmaterminal-openclaw-docs` under `tools/k6-proofs/`.

## Read these two first (the source-of-truth content)

1. **`tools/k6-proofs/skill/SKILL.md`** — the detailed human-readable how-to: scenario template,
   metrics-naming conventions, evidence-correlation patterns, the both-forms mandate, and the
   caps-test procedure. This is the substance; this AgentSkill is the discoverable wrapper over it.
2. **`tools/k6-proofs/k6-proofs-pipeline.xml`** — the structured XML decision tree for one-shot model
   parse. A model actor loads it whole and knows: which row, what behavior, who owns it, what to
   fire, how to verify, where artifacts land — no line-by-line scanning. Prefer this for
   "what do I do" routing; prefer the SKILL.md for the "how exactly" detail.

> Why both an XML pipeline and prose: an agent ingests a structured graph in one parse and
> traverses it predictably, where flat prose forces the attention mechanism to search and infer.
> Same reason `PROOFS/INDEX.json` + the per-SHA `manifest.json` made the corpus machine-legible.
> XML/JSON for the queryable decision/index/manifest layer; Markdown for the human glue.

**Writing or repairing a scenario?** `tools/k6-proofs/docs/AUTHORING-A-PROOF-ROW.md`
is the code-grounded authoring guide: the k6-VU vs Node post-run boundary and why
a single reachable `node:` import aborts a run before it dispatches, the shared
helpers to reuse instead of rebuilding (`lib/proof-session.js`,
`lib/receipt-seal.mjs`, `lib/tempo-trace-id.mjs`, `lib/tempo-span-match.mjs`,
`lib/observability-outcome.mjs`), and the import-closure / `k6 inspect` /
`node --test` checks to run before pushing.

## Components

The harness is environment-agnostic; the deployment endpoints below are an **internal-fleet
example** — substitute your own. Resolve hosts/credentials from local config, never hard-code
them into committed scenarios (see the runner's env auto-detection).

- **k6 ≥ 0.53.0** (corpus standardizes on **v2.0.0**) — load-testing engine; native optional
  chaining, no compat flag. Install per `tools/k6-proofs/README.md`; the runner resolves the
  `k6` binary from `PATH`.
- **Prometheus** — metrics store (example endpoint: `prometheus.<your-domain>`).
- **Grafana** — dashboards (example: `grafana.<your-domain>`; dashboard JSON: `tools/k6-proofs/dashboards/k6-proofs.json`).
- **Loki** — log aggregation (example: `loki.<your-domain>`; a log-forwarder DaemonSet ships journal logs).
- **Tempo** — distributed tracing (example: `tempo.<your-domain>`; OTel Collector).
- **Harness** — `tools/k6-proofs/` (lib/gateway.js connection helpers + metrics, lib/report.js HTML report).
- **Runner** — `tools/k6-proofs/run-proof.sh` (auto-detects seat / SHA / Prometheus URL from local config).

## Quick start

```bash
cd tools/k6-proofs

# Preflight: verify gateway + observability stack reachable (#101)
./run-proof.sh preflight

# Run a specific proof row
./run-proof.sh r-cd-1

# Point at another seat's gateway
./run-proof.sh r-cd-1 --env GATEWAY_HOST=<gateway-ip-or-host>

# Offline / no Prometheus push
k6 run scenarios/preflight.js
```

## Build a new proof scenario (summary — full detail in `tools/k6-proofs/skill/SKILL.md`)

1. **Find the row** in `PROOFS/PROOF-CORPUS-METHOD.md` (row name, expected behavior, owner, evidence shape) and its tracked issue on Project 81.
2. **Create** `scenarios/r-<row-name>.js` (lowercase, hyphens) from the scenario template.
3. **Name metrics** with the row prefix, but **sanitize the row tag to a valid metric name first** —
   Prometheus metric names allow only `[a-zA-Z0-9_]`, so replace hyphens with underscores: row
   `r-cd-1` → metrics `r_cd_1_pass` / `_fail` / `_duration_ms` / `_pass_rate` (+ threshold `rate > 0.99`).
   Keep the hyphenated form for the row *name*; use the underscored form only inside metric names.
4. **Honor both forms** — exercise the primitive as the typed tool AND the response token (`CONTINUE_WORK`, `[[CONTINUE_DELEGATE]]`); parity is a tested seam.
5. **Correlate evidence** — capture the OTel trace (Tempo), Prometheus metrics, and Loki logs per the correlation pattern; the raw unedited trace JSON is the proof.
6. **Caps tests** — for chain/cap rows, set low caps and restart-to-arm (mid-flight config patches do NOT propagate to a running scheduler); the over-limit rejection trace is the evidence.
7. **Run + report** via `run-proof.sh`; land the PASS/FAIL + artifacts into the corpus manifest.

## Project-81 tracking

Every k6 scenario and proof task is a tracked issue on **Project 81** ("k6 scenarios init —
karmaterminal-openclaw-docs"), labeled `proofs:k6`, a category (`scenario` / `integration` /
`coordination`), the row tag, and `owner:<prince>`, with status set. Make-or-claim the issue,
self-assign, status it, and land the proof artifact before/while the work runs. Discord is for
discussion; the Project-81 board + committed artifacts are the coordination-of-record.

## Source repo

`karmaterminal/karmaterminal-openclaw-docs` → `tools/k6-proofs/` (harness) and this skill at
`.agents/skills/k6-proofs/SKILL.md` (discoverable wrapper).
