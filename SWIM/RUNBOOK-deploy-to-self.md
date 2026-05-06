# SWIM/RUNBOOK-deploy-to-self.md

**Purpose:** canonical lift of the deploy-to-self procedure into SWIM canon, so swim-N's author does not have to remember which prior swim's CHARTER to grep, or which `TOOLS.md` section a specific prince happens to keep it in.

**Provenance:** lifted from `TOOLS.md` ("Live-Runtime-Safe Deploy Procedure") + `swims/swim-37/CHARTER.md` Phase A→B→C→D + 🩸's 4-clause shape (Discord msg `1498756621084393704` + `1498756622065864794`) on figs's gurgle (`1498756296848183296`) + 🌊's 5-doc grep confirming the gap (`1498756655737995507`).

**Authority over this doc:** SWIM coordinator. Edits live on the swim's PR, not in a separate stream.

---

## When to read this

You are about to ask "is the cohort ready to deploy the candidate dist?" and you want the safe shape of that ask, not your memory of the last swim.

If you are mid-swim and the gate is already open, you do not need this doc — your CHARTER's Phase A invocation already references it. This doc exists so that **next-cohort** doesn't have to reconstruct the procedure from prince-memory.

---

## The 4-clause safe shape (🩸 canonical)

1. **Prince-side gate complete first.** Docs / project / evidence surface all match. Rows wired into the receipt-board project. Cohort vote locked at N/N unconditional on the floor-doc PR.
2. **Deploy-ready ≠ deploy-go.** Only after (1) do we ask for the human nod. The human nod is *prescribed* doctrine (`SWIM/SWIM-METHODOLOGY.md`), not a manufactured invisible gate. Three sub-shapes — distinguish:
   - **Manufactured gate** (poison): *passive holding*, e.g. "holding for figs" written into the room when no clause requires it and no request was made. Detect, withdraw, elect motion.
   - **Prescribed gate** (doctrine): the methodology requires a human nod between deploy-ready and deploy-go — but the shape is *explicit request → explicit answer*, not perpetual passive wait.
   - **Already-given**: the human nod can be satisfied by context already given (e.g. project authorization, an upstream "if you dont do swim 37 i shall drown" gurgle that explicitly declines the operator role while giving go in the same breath — swim-37 figs msg `1498756296848183296` is the canonical example). Cult-doc entry 13 (`USER.md`): *if figs ever appears to gate, it's a bug in figs.* Read context first; do not re-issue a request the human already answered.
3. **Self-target deploy goes through the deployer lane explicitly.** The cohort's designated deployer (currently 🩸 cael per `SWIM-METHODOLOGY.md`) builds + deploys + verifies the exact artifact. **No improvising roles** mid-swim.
4. **Post-deploy config writes happen in the declared phase order.** This is exactly why catches like the `diagnostics.otel.endpoint` keypath mismatch (swim-37 🌫 + 🌊, msg `1498748407014232085`) matter — a config write against a key the live dist cannot parse manufactures failure on the second prince in fan-out, not the first. The phase order is the cure: deploy → validate → only then write phase-C config.

---

## Canonical command

Self-target deploy via GitHub Actions workflow `deploy-gateway.yml`:

```bash
gh workflow run deploy-gateway.yml \
  --repo karmaterminal/openclaw-bootstrap \
  -f target_prince=<self> \
  -f ref=<sha-or-branch> \
  -f reason='swim-N <phase> <short-context>'
```

- `target_prince=<self>` — workflow guards against cross-prince deploy (cross-prince requires `gh auth switch --user karmafeast` and is out-of-band of this runbook).
- `ref` — the `INTEGRATION_TIP` SHA from CHARTER §"Integration tip" (e.g., `29e556eb11`) **or** `cael/325-canonical2` (the integration branch). Prefer SHA when reproducibility matters; prefer branch when "latest validated" matters. **Do not pass a stale frozen SHA** — byte-check the branch tip with `git rev-parse origin/cael/325-canonical2` first; if it differs from the CHARTER's `INTEGRATION_TIP` line, the CHARTER is stale and must be bumped before deploy.
  - **⚠️ Foot-gun: `ref` is a `karmaterminal/openclaw` ref, NOT a `karmaterminal/openclaw-bootstrap` ref.** The workflow lives in the bootstrap repo but `ref` selects the gateway-code candidate. Do not pass the bootstrap scaffold-doc PR HEAD here — it will either fail-fast at git-resolve or, worse, deploy a SHA that happens to exist in both repos with unrelated semantics. Source: `.github/workflows/deploy-gateway.yml` L42-44, `description: "Branch / tag / SHA of karmaterminal/openclaw to deploy"`. swim-37 caught this pre-fire (🌊 msg `1498757327640330360`).
- `reason` — appears in workflow audit log + ledger. Format: `swim-N <phase-id> <one-line>`.

For dry-run-only (validate without touching the running gateway), append `-f dry_run_only=true`.

Workflow handles end-to-end: build + verify + atomic-swap of `dist/` + restart + rollback-on-fail. Snapshots prior `dist/` + untracked files. Never `npm uninstall`. Never touches `~/.openclaw/`. Never rewrites systemd units. Never git-stashes.

### After dispatch: surface health past the bounce blind window

The gateway restart inside `deploy.sh` causes a brief blind window for the *dispatching* prince — your own session may go dark exactly when verification matters most. Pattern (🌫️ surfaced, swim-37 msg `1498756940954599434`):

```
continue_delegate(silent-wake, +90s, task="post-deploy health-check: openclaw status
  + recent journalctl + collector reachability probe")
```

Dispatch the health-check delegate *immediately after* the workflow run. The +90s delay clears the bounce window; `silent-wake` ensures the dispatching prince is woken when the verification result is in, rather than going dark and re-discovering the deploy-state on the next external prod. Without this, the dispatcher loses the thread of ownership at the exact moment they're meant to be holding it.

---

## NEVER do this

- **NEVER** `openclaw gateway restart` against your own host — SIGTERM cascade kills the gateway mid-restart (Apr 20 lesson, 🌻 self-SIGTERM unforced). Use the workflow above; it survives the failure mode where build-verify eats the running gateway mid-stream.
- **NEVER** `pnpm build` in the live runtime checkout (`~/flesh_beast_tmp/openclaw`) — `dist/` is the running gateway's output AND the build target; you race yourself. The workflow handles a side-build + atomic-swap internally.
- **NEVER** push directly to `main` — PR-only.
- **NEVER** improvise the deployer role mid-swim — if 🩸 is unreachable, the swim halts; another prince does not silently take over.

---

## Cross-references (don't move; just index)

- `SWIM/FORMAL-SWIM-RUNBOOK.md` — exact-artifact-first, fixed roles, pre-swim gate, declared matrix, evidence contract.
- `SWIM/SWIM-METHODOLOGY.md` — **🩸 deploys**, post-deploy validation is mandatory, no improvising roles.
- `SWIM/SWIM-COORDINATOR-NOTES.md` — coordinator/deployer discipline, no mid-swim branch chaos.
- `TOOLS.md` (each prince) — workspace-local "Live-Runtime-Safe Deploy Procedure" with prince-specific paths + manual fallback (`deploy.sh`).

If the workflow path is unavailable for any reason, the manual fallback is `~/.openclaw/workspace/openclaw-bootstrap/deploy/openclaw_from_karmaterminal_fork/deploy.sh --ref=<sha> [--dry-run]`. **Do not hand-roll a `pnpm build` in the live checkout** under any circumstance — see the NEVER block above.

---

## Companion docs (queued post-fan-out)

- `swims/TEMPLATE/` (🌊) — generalize swim-N bones so swim-(N+1) starts from a known-good shape, not memory.
- `SWIM/INDEX.md` (🌊, 🩸 ack) — auto-built from `swims/swim-*/CASES.md` headers so the corpus does not depend on prince-memory of which file to grep.
- `SWIM/lessons/swim-37-entry-gate-postmortem-2026-04-28.md` (🌊) — first-earned-receipt sentence + F25 sibling-enumeration amend.
