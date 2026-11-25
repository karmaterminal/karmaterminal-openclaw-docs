"""The archived offline rehearsal still reads the way its report says."""
import json

from conftest import ROOT

from openclaw_evalbench.report import build_report

ARCHIVE = ROOT / "artifacts/offline-rehearsal"


def test_the_archived_csvs_rebuild_the_archived_report():
    archived = json.loads((ARCHIVE / "report.json").read_text())
    rebuilt = build_report({n: [ARCHIVE / n] for n in "ABC"}, manifest=archived["manifest"])
    assert json.loads(json.dumps(rebuilt)) == archived


def test_the_rehearsal_is_complete_clean_and_marked_as_one():
    manifest = json.loads((ARCHIVE / "manifest.json").read_text())
    assert manifest["offline"] is True and manifest["failures"] == [] and manifest["harnessDirty"] is False
    assert manifest["evalbenchPin"] == manifest["evalbenchHead"] == (ROOT / "EVALBENCH_PIN").read_text().strip()
    assert [r["trials"] for r in manifest["results"].values()] == [90, 90, 90]
    assert "Every number below is scripted" in (ARCHIVE / "report.md").read_text()
