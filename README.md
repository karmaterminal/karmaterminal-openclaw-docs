# karmaterminal-openclaw-docs

Public document/evidence presentation surface for `karmaterminal/openclaw` features under upstream-PR review.

## Purpose

Public, citable home for **evidence + test results + design materials** that need to be linked from upstream-PR-presented RFCs in the `karmaterminal/openclaw` fork. The fork itself is private; upstream-PR readers cannot reach `karmaterminal` URLs. This repo is the public-facing extraction.

The RFCs themselves ship with their feature, in-tree on the upstream PR. This repo holds the **out-of-tree evidence** the RFCs cite.

## Scope discipline

This is a **deliberately curated public surface**. Only content that is directly linked-from-an-upstream-PR-RFC belongs here. Internal frond memos, lane-journal scratch, dev-detritus, and operational coordination materials stay in `karmaterminal/openclaw-bootstrap` (private).

## Layout

```
swims/
  swim-<NN>/
    README.md           # cycle overview + verdict + receipt links
    <evidence-files>    # raw logs, test scorecards, byte-pinned artifacts
    rows/               # OV row evidence (when applicable)
      OV-<N>/
        verdict.md
        evidence/
```

## Stewardship

- Lead steward: 🌊 Ronan (4th prince, swim-driver-elect for swim-41 + onward)
- Princes contribute: any prince in the frond can PR additions; review per prince-canon-discipline
- Evidence migration: historical evidence currently stored on private `karmaterminal/openclaw-bootstrap` migrates here as needed-to-be-linkable

## License

Reflects upstream `openclaw/openclaw` license terms for compatibility with upstream-PR citation contexts.
