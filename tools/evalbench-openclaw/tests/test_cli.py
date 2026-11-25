"""The command line's refusals: nothing fires by accident, and the live gateway is out of reach."""
import json

import pytest
from conftest import ROOT

from openclaw_evalbench import __main__ as cli
from openclaw_evalbench.adapter import read_token


@pytest.fixture
def tokens(tmp_path, monkeypatch):
    for name in "ABC":
        path = tmp_path / f"token-{name}"
        path.write_text(f"token-{name}\n")
        monkeypatch.setenv(f"OPENCLAW_EVAL_TOKEN_FILE_{name}", str(path))
    return tmp_path


@pytest.fixture(autouse=True)
def no_jobs(monkeypatch):
    async def never(*_args, **_kwargs):
        raise AssertionError("a refused command must not start a job")
    monkeypatch.setattr(cli, "run_jobs", never)


@pytest.mark.parametrize("go", [None, "", "yes", "12345", "15730862113863844950000"])
def test_run_refuses_without_an_owner_message_id(tokens, go):
    argv = ["run", "--out", str(tokens / "out")] + (["--go", go] if go is not None else [])
    with pytest.raises(SystemExit, match="--go"):
        cli.main(argv)
    assert not (tokens / "out").exists()


@pytest.mark.parametrize("url", ["A=ws://127.0.0.1:18789", "A=ws://example.com:18846"])
def test_run_refuses_a_live_or_remote_gateway(tokens, url):
    with pytest.raises(SystemExit, match="refusing"):
        cli.main(["run", "--go", "1573086211386384495", "--out", str(tokens / "out"), "--gateway-url", url])
    assert not (tokens / "out").exists()


def test_run_refuses_a_missing_token_file(tokens, monkeypatch):
    monkeypatch.delenv("OPENCLAW_EVAL_TOKEN_FILE_B")
    with pytest.raises(SystemExit, match="OPENCLAW_EVAL_TOKEN_FILE_B"):
        cli.main(["run", "--go", "1573086211386384495", "--out", str(tokens / "out")])


def test_run_and_offline_refuse_a_used_directory(tokens):
    for argv in (["run", "--go", "1573086211386384495", "--out", str(tokens)], ["offline", "--out", str(tokens)]):
        with pytest.raises(SystemExit, match="never reuses"):
            cli.main(argv)


@pytest.mark.parametrize("argv", [["--arms", "D"], ["--arms", "A,A"], ["--arms", ""], ["--scenarios", "nope"], ["--num-trials", "0"], ["--token-budget", "0"]])
def test_bad_choices_are_refused(argv):
    with pytest.raises(SystemExit):
        cli.main(["offline", "--out", "/nonexistent/x", *argv])


def test_a_token_comes_only_from_its_file(tokens):
    assert read_token("A") == "token-A"
    (tokens / "token-A").write_text("\n")
    with pytest.raises(ValueError, match="empty"):
        read_token("A")


def test_overlay_writes_one_arm_into_an_isolated_config(tmp_path, capsys):
    path = tmp_path / "openclaw.json"
    path.write_text(json.dumps({"gateway": {"auth": {"token": "t"}}, "tools": {}}))
    assert cli.main(["overlay", "B", str(path)]) == 0
    written = json.loads(path.read_text())
    assert written["tools"] == {"toolSearch": False, "codeMode": False} and written["gateway"] == {"auth": {"token": "t"}}
    assert path.stat().st_mode & 0o777 == 0o600 and [p.name for p in tmp_path.iterdir()] == ["openclaw.json"]
    assert '"t"' not in capsys.readouterr().out


def test_overlay_refuses_the_live_config_and_a_config_with_channels(tmp_path, monkeypatch):
    monkeypatch.setenv("HOME", str(tmp_path))
    live = tmp_path / ".openclaw"
    live.mkdir()
    (live / "openclaw.json").write_text("{}")
    (tmp_path / "link.json").symlink_to(live / "openclaw.json")
    for path in (live / "openclaw.json", tmp_path / "link.json"):
        with pytest.raises(SystemExit, match="live gateway"):
            cli.main(["overlay", "A", str(path)])
    other = tmp_path / "other.json"
    other.write_text(json.dumps({"channels": {"discord": {}}}))
    with pytest.raises(SystemExit, match="channel"):
        cli.main(["overlay", "A", str(other)])
    assert (live / "openclaw.json").read_text() == "{}"


def test_build_configs_holds_no_token_and_keeps_repository_paths_relative(tokens, tmp_path):
    out = tmp_path / "o"
    out.mkdir()
    configs = cli.build_configs(out, ["A", "B", "C"], num_trials=2, scenarios=["c1-arithmetic"])
    text = "".join(p.read_text() for p in (out / "config").iterdir())
    assert "token-" not in text and str(ROOT) not in text
    assert {c["experiment_name"] for c in configs.values()} == {f"openclaw-continuation-propensity-{n}" for n in "ABC"}
    assert all(c["num_trials"] == 2 and c["scenarios"] == ["c1-arithmetic"] and c["dataset_config"].startswith("datasets/") for c in configs.values())


def test_preflight_names_the_failing_arm(tokens, capsys):
    assert cli.main(["preflight", "--arms", "A", "--gateway-url", "A=ws://127.0.0.1:9"]) == 1
    receipt = json.loads(capsys.readouterr().out)
    assert receipt[0]["ok"] is False and receipt[0]["arm"] == "A" and "token-A" not in json.dumps(receipt)
