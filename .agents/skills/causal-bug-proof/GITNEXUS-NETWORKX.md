# GitNexus to NetworkX Export

The `causal-proof-graph` CLI combines a hand-authored temporal proof spec with
GitNexus code-relation rows and exports a NetworkX `MultiDiGraph`.

## 1. Query GitNexus

Use a Cypher query that returns these columns:

```text
sourceId sourceName sourceFile relation targetId targetName targetFile reason
```

Keep the raw result as evidence. The loader accepts:

- a JSON row array;
- `{"rows": [...]}`;
- `{"markdown": "| sourceId | ... |"}`;
- a raw Markdown table.

`reason` is optional. The other columns are required.

Example row-array input:

```json
[
  {
    "sourceId": "Function:dispatchMessage",
    "sourceName": "dispatchMessage",
    "sourceFile": "src/dispatch.ts",
    "relation": "CALLS",
    "targetId": "Function:claimIngress",
    "targetName": "claimIngress",
    "targetFile": "src/ingress.ts",
    "reason": "direct call"
  }
]
```

## 2. Write the temporal spec

Start from `templates/proof-spec.example.json`. Add non-code layers that
GitNexus does not own:

- commits and timestamps;
- defects and owner boundaries;
- fossils and exact results;
- incidents and captured provenance;
- governance constraints;
- candidate and executed interventions.

Follow `EVIDENCE-LANGUAGE.md`: RED-only fossils use `CHARACTERIZES`, not
`PROVES`.

## 3. Build exports

```bash
python3 -m pip install -r .agents/skills/causal-bug-proof/requirements.txt

python3 .agents/skills/causal-bug-proof/scripts/build-proof-graph.py \
  --spec path/to/proof-spec.json \
  --gitnexus-result path/to/gitnexus-result.json \
  --out-dir path/to/graph-output
```

Omit `--gitnexus-result` when building only the temporal/manual layers.
The skill includes its Python implementation under `scripts/`; it does not
depend on a sibling frond-scribe source checkout or an editable package install.

The output directory contains:

- `proof.graphml`;
- `proof.gexf`;
- `proof.json` in NetworkX node-link form;
- `nodes.csv`;
- `edges.csv`;
- `manifest.json`.

GraphML/GEXF attributes are serialized as strings for portability. Parallel
edges are retained because the graph is a `MultiDiGraph`.

## 4. Analyze with NetworkX

```python
import json
import networkx as nx

payload = json.load(open("graph-output/proof.json"))
graph = nx.node_link_graph(payload, edges="edges")

path = nx.shortest_path(graph, "incident:outage", "bug:A")
ancestors = nx.ancestors(graph, "bug:A")
components = list(nx.weakly_connected_components(graph))
```

For cut analysis, project the relevant relation classes into a simple directed
graph first. A raw multiplex graph may contain governance, evidence, and
historical edges that should not all count as executable causal paths.

```python
causal_relations = {"CALLS", "BYPASSES", "DOES_NOT_REACH"}
causal = nx.DiGraph(
    (source, target)
    for source, target, attrs in graph.edges(data=True)
    if attrs.get("relation") in causal_relations
)
cut = nx.minimum_node_cut(causal, "incident:outage", "fossil:A")
```

Treat shortest paths, centrality, and minimum cuts as rankings or hypotheses,
not proof. Record the relation filter and algorithm in the resulting receipt.

## 5. Preserve provenance

Archive together:

- indexed repository and exact commit;
- GitNexus query text;
- raw GitNexus result;
- proof spec;
- exporter version or commit;
- manifest and all graph formats;
- test and intervention receipts referenced by graph nodes.

An index from another commit may aid exploration but cannot certify the frozen
proof graph.
