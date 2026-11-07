# Historical competition replay

Pure, offline implementation recovered from the 2026 incumbent workbook. This is
an audit/replay module, not yet wired into the app, API, scheduled scraper or writes.

`scoring.js` accepts raw statistical fields, frozen nominations and the first
appearance order of each club in a completed round's source data. It reproduces
positional formulas, the 29-disposal midfielder threshold, paired forward reserves,
chronological claims on shared reserves and single-use allocation. Missing players
are resolved only with an explicit complete/closed-round flag. Identity matching is
case-insensitive, preserving original display names; ambiguous clubs must be resolved
from historical evidence by the caller. Do not fuzzy-match or infer a current club.

Ladder ordering follows the observed incumbent: competition points (4 win / 2 draw),
then points FOR, then percentage. Equal values use a stable display order; an official
unresolved full tie still requires a verified league rule before production use.

## Run

`npm run check` includes synthetic scorer/substitution/ladder tests.

`node competition/replay.cjs /absolute/private-evidence-directory`

The directory must contain connector-shaped JSON snapshots:
- `source.json`: `seasonrows` (SeasonResults A:AY), `nomrows` (TeamNominations C:R),
  `nomtimes` (A:A), `fixturesall` (Fixtures A:H), `ladder` (Win-Loss Record A:K).
- `allstats.json`: keyed by exact RoundNN_Data tab, with `{values:[header,...rows]}`.
- `mapping.json`: `allmapping` (MasterScoring A:H), `scoremapping` (Master I:L).
- `lookups.json`: `playerclubs` (Player Team Lookup A:B).

The replay writes `report.json` and `nominations.json` in that same private directory.
No network or spreadsheet writes occur. Keep original nomination logs, private
metadata and downloaded workbook evidence outside this public repository.

Inputs to resolution are the frozen selected/reserve identities and historical raw
stats, not the incumbent's chosen substitute or score. Expected resolved names,
outcomes, position points and totals are used only for comparison after calculation.
The separate original-submission replay chooses the latest timestamp strictly before
lockout in Perth time. It reports missing submissions rather than inventing them.

## 3 November 2026 evidence

Read-only sandbox snapshots contained 180 regular-season team results and 12 finals
team results. Replay matched all 192 totals and all 1,344 resolved positional outputs,
including NONE/empty zero-score presentation. Original pre-lockout forms were
available for 180 of these cases; their replay also matched all 180 totals. One
reserve identity differed from the published selection, without changing that score.
The remaining 12 have frozen published selections, not a recovered original form.

The 90 regular-season matches reproduce every team's played/won/lost/drawn, points,
points for, points against and ladder rank. Fixture checks find 18 rounds, 45 distinct
pairings played twice, and rounds 10–18 repeating rounds 1–9 exactly. Twelve finals
team totals cover six finals matches; this does not certify all bracket edge cases.

These are frozen sandbox copies of the incumbent, not a live deployment certification.
An independent archived AFL Tables cross-check found provider round labels differ
(the opening round is numbered 1 there); an inferred +1 alignment greatly reduces
mismatches but is not a production mapping. Of 66,304 comparable scoring-stat fields,
452 still differ; additional identities/matches remain unresolved. No source was
silently preferred and no competition data changed. Reconcile dates/opponents and
provider revisions before certifying a live feed or updating the ingestion mapping.

Still open: shared login/ownership, real submission writes and reload/lockout tests,
new draft squad publication, scheduled scraper/parser inspection and failure recovery,
finals ties/countback, reminders/mail transport, backup/restore and deployment.

## Score display states

`score-state.js` defines the successor's fail-closed display contract. Scores can be
provisional, awaiting verification, disputed, awaiting an approved correction,
verified final, collection-paused or an older recorded result whose independent
verification was not captured. Missing values remain missing while numeric zero is
retained. Only `verified-final` can declare a winner, and a tied final also requires
an explicit verified winner. Finals detail is withheld unless both the summary and
detail identify the same snapshot. Freshness uses a supplied positive age limit and
the last successful collection time; attempt, success and publication times remain
separate so a recent failed attempt cannot make old published scores look current.

The prepared `ffl-workflow/api/ScoreRead.gs` adapter reads one checksummed snapshot,
rejects an unauthorized identity, corrupt payload or changing head, and returns only
allowlisted public score fields. It is source only: there is no deployed route, write,
trigger, mail operation or production connection.

## Scraper review follow-up

Read-only browser capture of the bound sandbox scraper (Auto Scraper v5.5) on
3 November found two confirmed behaviours using offline fake services:

- `appendDedup_` skips a changed statistic when player/club/date already exists.
- `scrapeAndWrite_` can return inserted rows without reporting another match's fetch
  failure; the caller can then write an `ok` canary for that partial batch.

`ingestion.js` prepares a side-effect-free refresh plan which rejects incomplete
expected-match batches, validates scoring inputs and stages corrections with exact
before/after rows. It deliberately cannot publish. The Google host still needs a
reviewed transaction, correction audit, rollback and integration before deployment.
The editor was not modified and no Apps Script function was executed. The current
browser account's sandbox Triggers page showed zero triggers; other accounts'
production triggers were not inspected and are not inferred from this view.
