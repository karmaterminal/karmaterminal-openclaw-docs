#!/usr/bin/env python3
"""Skill-local wrapper for the packaged causal proof graph implementation."""

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

from causal_proof_graph import main

if __name__ == "__main__":
    raise SystemExit(main())
