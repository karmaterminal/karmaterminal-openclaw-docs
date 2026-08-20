"""Build a temporal proof MultiDiGraph from a spec and optional GitNexus rows."""

import argparse
import csv
import json
from pathlib import Path
from typing import Any

import networkx as nx

REQUIRED_GITNEXUS_COLUMNS = {
    "sourceId",
    "sourceName",
    "sourceFile",
    "relation",
    "targetId",
    "targetName",
    "targetFile",
}


def parse_markdown_table(markdown: str) -> list[dict[str, str]]:
    lines = [line for line in markdown.splitlines() if line.startswith("|")]
    if len(lines) < 3:
        return []
    headers = [part.strip() for part in lines[0].strip("|").split("|")]
    rows: list[dict[str, str]] = []
    for line in lines[2:]:
        values = [part.strip() for part in line.strip("|").split("|")]
        if len(values) == len(headers):
            rows.append(dict(zip(headers, values)))
    return rows


def strings(values: dict[str, Any]) -> dict[str, str]:
    return {key: str(value) for key, value in values.items() if value is not None}


def load_gitnexus_rows(path: Path) -> list[dict[str, str]]:
    text = path.read_text()
    try:
        payload = json.loads(text)
    except json.JSONDecodeError:
        rows = parse_markdown_table(text)
    else:
        if isinstance(payload, list):
            rows = payload
        elif isinstance(payload, str):
            rows = parse_markdown_table(payload)
        elif isinstance(payload, dict) and isinstance(payload.get("rows"), list):
            rows = payload["rows"]
        elif isinstance(payload, dict) and isinstance(payload.get("markdown"), str):
            rows = parse_markdown_table(payload["markdown"])
        else:
            raise ValueError(
                "GitNexus result must be a row array, {'rows': [...]}, "
                "{'markdown': '...'}, or a raw Markdown table"
            )

    if not rows:
        raise ValueError("GitNexus result contained no graph rows")
    if not isinstance(rows[0], dict):
        raise ValueError("GitNexus result rows must be objects")

    missing = REQUIRED_GITNEXUS_COLUMNS - set(rows[0])
    if missing:
        raise ValueError(
            "GitNexus rows are missing required columns: " + ", ".join(sorted(missing))
        )
    return rows


def build_graph(spec: dict[str, Any], gitnexus_rows: list[dict[str, str]] | None = None):
    graph = nx.MultiDiGraph(
        name=spec.get("name", "causal bug proof graph"),
        schema=spec.get("schema", "frond.causal-bug-proof.v1"),
    )

    for node in spec.get("nodes", []):
        node = dict(node)
        node_id = node.pop("id")
        graph.add_node(node_id, **strings(node))

    for edge in spec.get("edges", []):
        edge = dict(edge)
        source = edge.pop("source")
        target = edge.pop("target")
        graph.add_edge(source, target, **strings(edge))

    for row in gitnexus_rows or []:
        source = row["sourceId"]
        target = row["targetId"]
        graph.add_node(
            source,
            layer="code",
            kind=source.split(":", 1)[0],
            name=row["sourceName"],
            file=row["sourceFile"],
            source_system="gitnexus",
        )
        graph.add_node(
            target,
            layer="code",
            kind=target.split(":", 1)[0],
            name=row["targetName"],
            file=row["targetFile"],
            source_system="gitnexus",
        )
        graph.add_edge(
            source,
            target,
            relation=row["relation"],
            reason=row.get("reason", ""),
            source_system="gitnexus",
        )

    for node_id, attrs in graph.nodes(data=True):
        attrs.setdefault("label", attrs.get("name", node_id))

    return graph


def write_graph(graph, out_dir: Path) -> dict[str, Any]:
    out_dir.mkdir(parents=True, exist_ok=True)
    nx.write_graphml(graph, out_dir / "proof.graphml")
    nx.write_gexf(graph, out_dir / "proof.gexf")
    (out_dir / "proof.json").write_text(
        json.dumps(nx.node_link_data(graph, edges="edges"), indent=2) + "\n"
    )

    node_keys = sorted({key for _, attrs in graph.nodes(data=True) for key in attrs})
    with (out_dir / "nodes.csv").open("w", newline="") as handle:
        writer = csv.DictWriter(handle, fieldnames=["id", *node_keys])
        writer.writeheader()
        for node_id, attrs in graph.nodes(data=True):
            writer.writerow({"id": node_id, **attrs})

    edge_keys = sorted({key for _, _, attrs in graph.edges(data=True) for key in attrs})
    with (out_dir / "edges.csv").open("w", newline="") as handle:
        writer = csv.DictWriter(handle, fieldnames=["source", "target", *edge_keys])
        writer.writeheader()
        for source, target, attrs in graph.edges(data=True):
            writer.writerow({"source": source, "target": target, **attrs})

    manifest = {
        "schema": graph.graph["schema"],
        "nodes": graph.number_of_nodes(),
        "edges": graph.number_of_edges(),
        "layers": sorted({attrs.get("layer", "") for _, attrs in graph.nodes(data=True)}),
    }
    (out_dir / "manifest.json").write_text(json.dumps(manifest, indent=2) + "\n")
    return manifest


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--spec", type=Path, required=True)
    parser.add_argument("--gitnexus-result", type=Path)
    parser.add_argument("--out-dir", type=Path, required=True)
    args = parser.parse_args(argv)

    spec = json.loads(args.spec.read_text())
    gitnexus_rows = (
        load_gitnexus_rows(args.gitnexus_result) if args.gitnexus_result else None
    )
    manifest = write_graph(build_graph(spec, gitnexus_rows), args.out_dir)
    print(json.dumps(manifest))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
