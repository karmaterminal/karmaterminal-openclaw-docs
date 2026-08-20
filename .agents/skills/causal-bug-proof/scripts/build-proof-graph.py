#!/usr/bin/env python3
"""Compatibility wrapper for the packaged causal proof graph CLI."""

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[3] / "src"))

from frond_scribe_tools.causal_proof_graph import main

if __name__ == "__main__":
    raise SystemExit(main())
