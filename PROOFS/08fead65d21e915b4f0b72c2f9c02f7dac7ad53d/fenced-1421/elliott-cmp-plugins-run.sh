#!/usr/bin/env bash
# 🌊 grant 1556829698959482941: bounded one-slot agentic-plugins comparison on elliott, upstream then cut.
for s in b51feb98eb 08fead65d2; do bash $HOME/ci-fenced-08fead65/cmp-plugins-$s/fenced-seat.sh elliott-plugins-$s; done
