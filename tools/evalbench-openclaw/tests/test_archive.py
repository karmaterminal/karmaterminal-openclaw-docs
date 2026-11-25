"""The archived offline rehearsals still read the way their reports say: one with arm D off, one with it on."""
import json

import pytest
from conftest import MODEL, ROOT

from openclaw_evalbench.arms import load_arms
from openclaw_evalbench.report import build_report, render

ARCHIVES = {"offline-rehearsal": "ABC", "offline-rehearsal-arm-d": "ABCD"}
archives = pytest.mark.parametrize("name, arm_names", ARCHIVES.items())


def test_both_rehearsals_are_archived():
    assert {p.name for p in (ROOT / "artifacts").iterdir()} == set(ARCHIVES)


@archives
def test_the_archived_csvs_rebuild_the_archived_report(name, arm_names):
    archive = ROOT / "artifacts" / name
    archived = json.loads((archive / "report.json").read_text())
    rebuilt = build_report({n: [archive / n] for n in arm_names}, manifest=archived["manifest"])
    assert json.loads(json.dumps(rebuilt)) == archived
    assert render(archived) == (archive / "report.md").read_text()


@archives
def test_the_rehearsal_is_complete_clean_and_marked_as_one(name, arm_names):
    archive = ROOT / "artifacts" / name
    manifest = json.loads((archive / "manifest.json").read_text())
    assert manifest["offline"] is True and manifest["failures"] == [] and manifest["harnessDirty"] is False
    assert manifest["evalbenchPin"] == manifest["evalbenchHead"] == (ROOT / "EVALBENCH_PIN").read_text().strip()
    assert manifest["model"] == MODEL and "".join(manifest["arms"]) == arm_names
    assert {n: r["trials"] for n, r in manifest["results"].items()} == dict.fromkeys(arm_names, 90)
    # Supervised as a fire is: what the supervisor counted is what the harness counted, and every gateway was proved stopped.
    supervision = manifest["supervision"]
    assert supervision["halted"] is None and supervision["lost"] is None and supervision["receipt"]["unwrittenRecords"] == 0
    for arm, seen in supervision["receipt"]["arms"].items():
        assert seen["trials"] == 90 and seen["tokens"] == manifest["results"][arm]["meteredTokens"]
        assert seen["stop"]["rule"] == "run-finished" and seen["stop"]["result"]["stopped"] is True
    assert manifest["caps"] == load_arms()["caps"]["set"]
    text = (archive / "report.md").read_text()
    assert "Every number below is scripted" in text and f"Model `{MODEL}`" in text
    assert ("B → D: wording (all tools direct)" in text) is ("D" in arm_names)
