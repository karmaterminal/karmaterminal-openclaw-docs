# Method: the preserved exact-head packet at `a22bd9c05c`

## Authority

- **Canonical process:** `RUNBOOKS/PROOF-CORPUS-METHOD.md` in openclaw-bootstrap, read at bootstrap
  `main` `a768f04231bd0a6f94cc7b845aecaec28a4a4c9e`.
- **Docs base:** karmaterminal-openclaw-docs `main` `7ca06bdb9b30cfe604fcdda60c115e5400924f59`, with
  the k6-proofs validators and the F″ rules there.
- **Instruction:** 🌊, room msg 1567926160866934866, as relayed in this lane's dispatch workorder.
  This lane could not read Discord back. It said:
  - assemble this packet from the preserved, hash-checked Gate 3 and Gate 4 evidence;
  - keep the 13-case row receipt, the Mode-B and local-shard evidence and the fold ruling distinct;
  - mark unrun rows MISSING;
  - publish no terminal INDEX or 38-PASS claim;
  - ask for no re-review until exact-head fleet readiness and the remaining live receipts exist.

  🌊's own GitHub rulings carry the same limits verbatim: docs#620 comment 6651745479, and
  openclaw#1271 comments 6653747059 and 6655365352.

## What this packet is

- A preserved record of what exists at the exact head, so the evidence survives when 🌊 advances
  the presentation ref.
- It is not an acceptance corpus, and it is not on `PROOFS/INDEX.json`.
- It lands through a draft PR rather than directly on docs `main`, because it is a preserved,
  non-terminal packet under review, not a folded cycle.

## How it was built

1. **Seeded from the current method's shape:** README, METHOD, RESOLVED-SHA, ARTIFACTS,
   `proofs-manifest.json` (`openclaw.proofs.manifest.v1`, with `capture_sha`, `ship_sha` and
   `proof_source_sha` all `a22bd9c05c4a7a9c86e72a132cb7939e399104cb`), one directory per required
   row, and a `gates/` support directory.
2. **Required matrix:**
   - Start from F′'s `required_rows`, the last seeded matrix.
   - Remove `R-CW-5A` and `R-CW-6A`. 🌊's F″ ruling (Discord 1565895695586558120; docs#616)
     retires them as rows of any corpus folded after it: `validate-corpus.mjs` refuses them as rows,
     and this corpus is not on the frozen pre-ruling list. They are recorded in
     `preflight_attachments`, both `missing` with no receipt. R-CW-5/6 therefore stay capped.
   - Add `R-CD-RECIPIENT-AUTHORITY`, gate 3 of the j12′ gate list (🌊, room msgs
     1567077062139838485 and 1567194866507841678), separate from
     `R-CD-RETURN-COVENANT-AUTHORITY`.
   - Result: 37 rows.
3. **`R-CD-RECIPIENT-AUTHORITY`:**
   - fetched the public bundle from MinIO and matched its sha256 to the one 🕯 and 🌿 recorded;
   - listed it before extracting (plain files only, no links, no absolute or `..` paths);
   - scanned it (below), then copied its 33 public files byte-identical into
     `R-CD-RECIPIENT-AUTHORITY/emeric/authority-row-20261105T060708Z/`;
   - reproduced the regrade with docs#620's grader at `6e1da8eb` and checked each trace file's
     structure (`R-CD-RECIPIENT-AUTHORITY/LANE-REGRADE.json`).

   The state is held at `partial` with the candidate verdict kept. A ruled PASS-candidate folds to
   `pass` only after a corpus fold review, and the fold needs things not in hand. They are named in
   the row's `EVIDENCE.md`. Nothing was upgraded.
4. **Gate 4:**
   - fetched the evidence bundle and matched its sha256;
   - re-read Mode-B run 41927761314 from the Actions API;
   - re-extracted the failing sets of that run and of j12's run 41266680278 from their job logs;
   - re-read each shard and counterfactual log's vitest summary.

   Only summaries are published. The raw logs stay in the bundle.
5. **Every other row** is seeded `missing`, not fired at this SHA. No historical PASS is carried.
6. **The rollup** is the tally of the required rows' states.

## The public-safety scan

Every file this packet adds was scanned, fail-closed. The scan used the docs repo's own redaction
rules from `tools/k6-proofs/scripts/sanitize-k6-artifacts.mjs`:

- session keys, proof nonces, authorization headers, `traceparent`;
- credential `key=value` pairs and URL credentials.

It added:

- GitHub, OpenAI or Anthropic, Slack and AWS token formats;
- private-key headers, Discord webhooks and JWTs;
- absolute local filesystem paths (home, temporary, user, root and data directories, and
  home-relative paths);
- IPv4 addresses and e-mail addresses;
- raw-payload JSON keys (`prompt`, `message`, `task`, …) and private acquisition directories.

A planted positive control caught every class. The result is in `RESOLVED-SHA.md`.

## Validators

The commands and their results are recorded in the PR body and the lane report.

- `validate-corpus.mjs --sha a22bd9c05c4a7a9c86e72a132cb7939e399104cb`.
- The k6-proofs catalog checks: `check-manifest-scenarios`, `check-scenario-alignment`,
  `check-proof-row-manifests` and `check-telemetry-contracts`.
- `node --test` over `tools/k6-proofs/tests` and `tools/k6-proofs/scripts/__tests__`, compared with
  docs `main`.
- The skill §8 structural `jq` checks for the manifest and rollup. The INDEX checks do not apply:
  INDEX is unchanged by design.
- `corpus-tally a22bd9c05c4a7a9c86e72a132cb7939e399104cb --ref codeagent/proofs-a22bd9c0`.
- `git diff --check`.
