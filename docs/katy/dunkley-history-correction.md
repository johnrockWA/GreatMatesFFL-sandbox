# Josh Dunkley / Rockstars retention correction

John reported on 30 October 2026 that the preseason demo would not let Rockstars
retain Josh Dunkley, despite his retention last year and current eligibility.

The old fixture already recorded a normal retention in 2026 but set the Rockstars
history to `verified: false`, `retains: 0`, `historyReview: true`. The UI disabled the
normal-retain option because the evidence was unverified. The three-year cap had
not been reached or applied. This was an evidence flag error, not a rule amendment.

The demo now records the coach-confirmed 2026 retention as one prior retention,
verified for this player/team only. He is eligible to use a normal retain slot for
2027. No change is made to the three-year rule, other players' evidence flags,
fookie eligibility, Google sheets or official dynasty records.

A fixture correction carries the original record, corrected record and confirmation
source. On load, an old local demo receives this correction only if its history
matches the exact stale record. Existing choices, picks, committee decisions and
revision remain intact. A different or manually corrected history is not overwritten.
The engine's field projection keeps this local metadata out of shared responses.

Regression checks cover Dunkley's eligibility, upgrade of the exact stale evidence,
preservation of local draft state, refusal to overwrite a later three-year record,
and continued rejection at the three-year cap. Other unverified histories stay blocked.

This corrects the approved private preview and proposes a separate source PR to
develop. Merge requires John's decision; Google remains untouched.

## Career-games provenance and Jagga Smith correction

The recovered original builder read `workflow-squads-source.json` and used the
fifth column (index 4, Squads column E) as careerGames. That was a saved capture of
WebApp_Data / Squads. C1 recovered its frozen values from the published October
baseline HTML; the current static builder embeds them from the fixture JSON. It
performs no live AFL, FinalsSiren or Google fetch. The source notes explicitly say
this is not a verified preseason player/statistics snapshot.

Jagga Smith's inherited value was 0. John corrected it to 25 on 30 October 2026.
The fixture now records 25 and carries that confirmation source, without claiming
an independent AFL data refresh. Exact stale zeroes in saved demos upgrade to 25;
a different value is preserved. He remains fookie eligible at both 0 and 25 under
the current <=50 rule. The correction changes the displayed count, not eligibility.
All remaining player counts still require a properly dated source reconciliation
before a shared or official draft. No Google source cells are changed.
