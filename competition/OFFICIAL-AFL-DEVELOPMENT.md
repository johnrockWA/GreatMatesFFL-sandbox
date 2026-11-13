# Official AFL development pipeline

The official AFL source now feeds the existing FFL scoring engine and an isolated
Google Sheets shadow store in Development. This is a manually invoked completed-round
test pipeline. It does not feed the working app, run on a schedule, enable live mode,
publish final results or approve historical corrections.

## Modules

- `official-afl-provider.js`: projects the website JSON, verifies fixture/provider IDs,
  dates, venues, historical clubs, exact player-ID/name/jumper mappings, roster coverage,
  integer statistics, disposal identities and team goal totals. It keeps canonical
  names and explicitly omits the incompatible incumbent rating field.
- `official-round-preview.js`: requires a complete, explicitly closed round; applies
  the existing position/reserve scorer to frozen nominations. It retains the agreed
  AFL-primary/AFL-Tables-verifier policy and cannot publish. This supersedes the
  FinalSiren-only requirement on 7 November; see `AFLTABLES-VERIFIER.md`.
- `correction-preview.js`: compares with the frozen canonical historical baseline,
  recording old/new statistics and team-score effects. It never applies or approves a
  correction, including when official AFL and AFL Tables agree.
- `shadow-store.js`: uses immutable checksum-protected snapshot records, a single-cell
  head pointer, commit-intent records and an injected lock. It checks the expected
  revision, verifies staged and committed readback, handles a lost commit response,
  and supports restoration as a new revision. Orphan stage/intent rows are allowed;
  only the verified head identifies the committed snapshot.

The private GAS host is generated from these same modules with an explicit test
manifest, registry, frozen nominations and historical baseline. Its target store has
a fixed ID and sentinel, separate from every competition workbook. Operational
write-enable properties remain off. The original scraper statistics, health cells
and script properties are fingerprinted before/after the connected tests.

## Evidence from 5 November 2026

All 414 official player IDs map to existing canonical IDs using the historical match,
club, exact known name variant and jumper. The nine official games agree with the
captured AFL Tables comparison on all 4,140 common-statistic fields. This diagnostic
agreement does not replace the selected FinalSiren verification requirement.

The connected GAS host retrieved all nine matches, calculated all ten team previews,
saved the shadow snapshot and reloaded it with a verified checksum. A second run
returned `changed:false` at the same revision. Internal runtimes were 8.238 seconds
for the first save and 5.267 seconds for the duplicate. The later full run including
the stored correction proposal took 12.308 seconds internally and 14.021 seconds in
GAS execution history. These are completed-match
tests, including the isolated storage path, not a sustained live or scheduled trial.

The connected shadow recovery drill blocked stale revisions and a deliberately
corrupted uncommitted record, detected a disposable changed snapshot and restored
the original payload/checksum as a new revision. Original snapshots were preserved.
This certifies that test store's drill, not whole-system recovery or deployment rollback.

The historical proposal reproduces 27 differences, including 24 scoring fields. The
simulated totals for Robbo's Roosters and Boucher's Broachmen each fall by one point.
Stored historical competition results stay unchanged.

103 repository tests pass and the generated preview build matches committed bytes.
The generated GAS scoring code also reproduces the actual captured round offline.
The source is prepared locally for review; it has not been pushed or merged by this step.

## Open gates

FinalSiren redirects normally to `www.finalsiren.com`, which still returns HTTP 403
from GAS. No proxy, access-control bypass or unapproved substitute verifier is used.
The previous preview therefore remained `awaiting-verification`, with `canPublish:false`.
The Development verifier has since changed to AFL Tables. Its new connected outcome
is recorded separately in `AFLTABLES-VERIFIER.md`; operational publication stays off.

The provisional/final/stale display contract and authenticated read-only preview
adapter have since been implemented in Development source; see
[SCORE-STATUS.md](SCORE-STATUS.md) for the connected read check and remaining deployment work.

Still required: independent verification transport/parser, deployed authenticated app read
integration, the human correction
approval path, live/incomplete-match semantics, scheduler/quota instrumentation,
source data-use requirements, sustained live trials, deployment ownership and whole
system rollback. Defaults remain five minutes for regular FFL rounds and one minute
for FFL finals when optional live scoring is eventually enabled.
