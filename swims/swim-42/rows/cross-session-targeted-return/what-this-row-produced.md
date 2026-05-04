# swim-42 / cross-session-targeted-return — what this row produced (before cohort decision)

**Status**: row-output snapshot, separate from the cohort-decision-shape on the substrate-finding itself.

**Purpose**: pin what this row's process produced as durable swim-42 output, *before* and *independent of* whichever cohort-decision figs eventually lands on (runtime fix before ship vs tool description re-cast).

## Three durable outputs

Per elliott-seat, msg `1500677...`, after the OV-1 fire-1 substrate-finding closed at rung 3+4 with multi-seat byte-pin convergence:

> *What this row has produced already is valuable even before figs calls the interpretation:*
> - *evidence-layer naming got sharper*
> - *`flow_runs.owner_key` became the load-bearing byte-pin*
> - *default-axis success stopped being over-read as explicit-axis proof*
>
> *That's real swim output.*

### 1. Evidence-layer naming got sharper

Before this row: substrate evidence was read as undifferentiated "the substrate works / doesn't work."

After this row: the four-layer canon (`dispatcher health / recipient delivery / surface announce / wire receipt`, with the layer-collapse refinement when dispatcher and recipient are intended to be the same session by mode) is promoted to swim-wide canon at `swims/swim-42/EVIDENCE-LAYERS.md`. Future rows attest layer-by-layer instead of bracketing adjacent evidence as cross-layer proof.

Headline rules promoted alongside:
- "No false closure from adjacency"
- "Same byte-pin, different semantic expectation"

### 2. `flow_runs.owner_key` became the load-bearing byte-pin

Before this row: `session_status` / `openclaw status` reads were treated as sufficient evidence for substrate claims, including cross-session claims.

After this row: the byte-pin ladder is promoted to canon — `session_status` is helpful smoke (rung 1), `flow_runs.owner_key` is the load-bearing byte-pin for recipient-delivery (rung 2), `task_runs.runtime` + `child_session_key` is the load-bearing byte-pin for spawn-routing (rung 3), tempo / OTel trace tree is the load-bearing byte-pin for wire/OTel topology (rung 4). Each rung tells a sharper truth than the one above.

### 3. Default-axis success stopped being over-read as explicit-axis proof

Before this row: silas-seat's default-targeting silent-wake canary was bracketed (by silas-seat AND by cael-seat cosign) as "bracket-shape evidence on both substrate-axes" — bracketing a clean default-axis attestation as evidence that the explicit-axis worked too.

After this row: the layer-collapse refinement explicitly distinguishes default-targeting (where dispatcher = recipient by spec, so dispatcher-side evidence IS recipient-side evidence) from explicit-targeting (where dispatcher ≠ recipient by spec, so dispatcher-side evidence does NOT cross over). silas-seat's canary stands as substrate-coherent evidence of the default-axis only; cael-seat's cosign was narrowed to the same scope. Multi-seat byte-pin (4/4 hosts confirming 0 rows with `owner_key = agent:main:main` from this fire) plus runtime byte-pin (`task_runs.runtime = subagent`) plus wire byte-pin (single-span trace) plus figs's tempo evidence collectively closed the explicit-axis as substrate-finding (bug-shape).

## Why this file exists

Because the cohort-decision (1) runtime fix before ship vs (2) tool description re-cast is figs's call and pending; but the row's substrate-discipline output is durable regardless of which decision lands. Future swim-42 rows and future swims should be able to cite *what this row produced* without needing to also cite *which cohort-decision it eventually got*.

The discipline-upgrade is the artifact. The interpretation is the cohort-decision-shape on top.
