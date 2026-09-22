# Causal-stratigraphy method used for PR #121204

The investigation treated runtime symptoms as fossils whose semantics must stay
fixed while code names, files, and line numbers move.

1. **Capture the real boundary shape.** The field specimen retained structural
   Discord facts but not message content. Real guild `MESSAGE_CREATE` rows had
   top-level numeric `channel_type`; none had the synthetic hydrated `channel`
   object used by the green tests.
2. **Write one fixed-semantics fossil.** Fossil A asks one stable behavioral
   question: does a stale ambient guild row get suppressed while a fresh
   addressed row dispatches? The assertion does not change during history
   traversal.
3. **Reproduce on the incident composite.** The fossil failed on
   `310252733a626568c98071bdaf9ee09dbdf38a88` with the exact field morphology:
   stale ambient dispatched before fresh addressed work.
4. **Walk history by ownership and behavior, not line number.** Symbol history,
   source diffs, and import adapters carried the same assertion backward across
   module splits. The freshness fence was first bad at
   `2b2019202ffdbcdb0393a76be9d0ecdcb48489fe`: it was born reading the wrong
   payload field.
5. **Separate coincident injuries.** Fossils B/C proved a distinct core
   watchdog-disposition problem. That defect was not folded into the Discord
   owner repair merely because it produces nearby replay symptoms.
6. **Repair the existing vehicle.** The smallest owner-boundary correction was
   added to open PR #121204 instead of opening a duplicate PR or transplanting
   the much broader `30613c...` experimental lineage.
7. **Replay the identical fossil.** The same Fossil A fixture passes at product
   head `b958ca22efd5e67de16746d1341d6bea7c594847` and proof composite
   `0dec285645550f6ca4d2da0cb0153ee95acf9f6a`.

This method provides a causal claim stronger than “the new test is green”: it
binds a real payload shape, a fixed behavioral assertion, a first-bad commit, an
architectural owner, and the exact correcting SHA.
