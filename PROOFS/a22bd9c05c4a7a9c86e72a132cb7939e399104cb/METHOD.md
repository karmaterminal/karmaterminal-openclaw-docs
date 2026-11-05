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
  - publish no terminal INDEX or full-pass rollup claim;
  - ask for no re-review until exact-head fleet readiness and the remaining live receipts exist.

  🌊's GitHub rulings carry related scope limits, in his words:
  - docs#620 comment 6651745479: "This rules the **live row's Gate 3 fire only**. It does not fold
    the PR, change the corpus/INDEX verdict, bless Gate 4's unfinished shards, or claim the broader
    #129388 authority matrix and Telegram evidence complete."
  - openclaw#1271 comment 6653747059: "This does not clear fold review, immutable corpus promotion,
    exact-head fleet readiness, or the terminal 38-row acceptance gate."
  - openclaw#1271 comment 6655365352: "corpus promotion and exact-head fleet readiness remain
    separate steps."

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
   - Result: 37 rows, confirmed by 🌊 (room msg 1567933730021056636). His Gate 4 ruling's "terminal 38-row
     acceptance gate" is the old shorthand, not a terminal claim; the terminal matrix is his to set.
3. **`R-CD-RECIPIENT-AUTHORITY`:**
   - fetched the public bundle from MinIO and matched its sha256 to the one 🕯 and 🌿 recorded;
   - listed it before extracting (plain files only, no links, no absolute or `..` paths);
   - scanned it (below), then copied its 33 public files byte-identical into
     `R-CD-RECIPIENT-AUTHORITY/emeric/authority-row-20261105T060708Z/`;
   - reproduced the regrade with docs#620's grader at `6e1da8eb` and checked each trace file's
     structure (`R-CD-RECIPIENT-AUTHORITY/LANE-REGRADE.json`).

   The row is not folded, and nothing was upgraded:
   - it is held at `partial`, as 🌊 ruled (room msg 1567933730021056636), the shape F′ kept for R-CD-2;
   - its `candidate_verdict` is `PASS-candidate`.

   A ruled PASS-candidate becomes `pass` only through a corpus fold review. The fold needs things
   not in hand, named in the row's `EVIDENCE.md`. Without the observer key, the row's own grader
   returns MISSING-candidate.
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

## Validation of this packet

Run on this packet's final tree, after its last edit, with the docs `main` `7ca06bdb` tooling. The lane re-ran every check after each edit, before committing it.

| check | result |
|---|---|
| `validate-corpus.mjs --sha a22bd9c05c4a7a9c86e72a132cb7939e399104cb` | 21 passed, 0 failed, including `preflight-attachments-valid`, `live-rows-gated-by-preflights`, `rows-within-declared-cap` and `manifest-rollup-matches-required` |
| `validate-corpus.mjs --index` / `--current` | exit 1, with output byte-identical to docs `main`: the pre-existing INDEX drift (`current_sha` `e821503d` with a manifest of `139e3657`). INDEX is unchanged here |
| `check-manifest-scenarios`, `check-scenario-alignment`, `check-proof-row-manifests`, `check-telemetry-contracts`, `check-k6-skill` | each exit 0 |
| `node --test tools/k6-proofs/tests/*.test.mjs` | 349/349, as on `main` |
| `node --test tools/k6-proofs/scripts/__tests__/*.test.mjs` | 976/979, as on `main`: the same 3 pre-existing INDEX-drift reds (`current-corpus-active-scope` ×2, `harness-provenance-runner`), with the normalized failure diagnostics hashing identically at both |
| skill §8 manifest `jq` checks (structure; rollup = required-row tally) | true. The terminal check (every required row `pass`) is false, as a non-terminal packet must be. The INDEX checks do not apply |
| every manifest path (`dir`, `evidence_doc`, `traces`, `supporting_docs`, gate receipts) | exists |
| `corpus-tally a22bd9c05c4a7a9c86e72a132cb7939e399104cb --ref codeagent/proofs-a22bd9c0 --expected <the 37>` | present: 37 rows, absent: none, exit 0 |
| public-safety scan over every added file | 0 hits |
| `git diff --check` | clean |
