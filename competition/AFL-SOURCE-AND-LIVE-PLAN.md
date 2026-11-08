# AFL source decision and optional live scoring

Agreed with John on 5 November 2026: use official AFL statistics as the primary
source and FinalSiren to verify completed games. **Superseded on 7 November:** AFL
Tables is the completed-game verifier in Development. Keep the existing canonical player
register and display names. Map AFL player IDs explicitly; never replace identities
using fuzzy name matches. AFL Tables is separately retrieved and parsed, but lists
AFL among its upstream sources; agreement does not establish independent statistical
collection. Live scoring is an optional future feature,
disabled by default. John subsequently selected five-minute regular-round updates
and one-minute finals updates when live mode is eventually enabled; both are
configurable. Faster regular-round updates can be considered if coaches request them.

## Implementation status

`afl-source-policy.js` now provides a pure completed-match assessment with tests:
missing primary, unavailable verification, source disagreement and historical
correction proposals all fail closed. Agreement returns the AFL data as a candidate;
it does not authorise publication. It is now connected to the isolated GAS shadow
host, scorer and test store described in `OFFICIAL-AFL-DEVELOPMENT.md`; the running
web app is not connected. The existing generic coordinator alone is not sufficient: operational
integration must apply this assessment, freshness and approval gates under its lock.

The previous official-table reconciliation covers 24 disputed scoring fields in
three completed matches, not a certified unattended feed. Two connected GAS timing
runs now retrieved metadata and player-statistics responses for all nine matches,
including 414 player rows in the full-round batch. See the benchmark below.
FinalSiren's last verified GAS response is HTTP 403, including the original scraper.
The replacement verifier is scoped to the Development test store. No operational source,
scheduler, deployment, historical score or email setting has been changed here.

## Display contract for future integration

Keep match progress, verification and freshness as separate fields. A completed AFL
game is not automatically a verified FFL result. A round containing other unfinished
games remains provisional even if an individual game's statistics are verified.

| Display | Meaning |
| --- | --- |
| Scheduled | Game has not begun; no live zero/DNP assumption |
| Live — provisional | AFL reports the game in progress; live mode explicitly enabled |
| Finished — awaiting verification | AFL reports completion, AFL Tables not yet checked |
| Held — statistics differ | A player scoring statistic differs by more than 1, or identities fail validation |
| Final — verified | Completion, separate-website comparison and host publication gates pass |
| Updates delayed | Additional freshness warning; show last successful source update |

Include source observation time and fetch time separately. A successful HTTP request
does not prove the source has updated. Preserve the last good snapshot on failure;
show its age. Never trigger reserve substitutions, official ladders or final results
from missing live statistics. Completed/closed-round scoring requires the verified
coverage and explicit closure gates already used by the scoring engine. Previously
published changes require an approval proposal with old/new player and team effects;
closed historical results remain frozen by default.

## Polling and quota design

One central collector fetches each active AFL game once per cycle; every coach reads
the same stored snapshot. Browser refreshes never initiate provider scraping. Publish
one versioned scoreboard response; batch writes and avoid rewriting/recalculating the
entire historical workbook. Use a lock to skip overlap, bounded retries and backoff,
and pause or reduce frequency as the runtime budget is approached. Treat rate limits
and source access requirements independently of Google's quotas.

Poll every five minutes in regular rounds and every minute in finals, only during
active game windows, with small pre/post-match buffers. Use an explicit FFL stage
setting: the AFL finals calendar must not be assumed to match FFL finals.
Check the schedule less often outside those windows. Fetch AFL Tables after completion
with bounded scheduled retries; it has no live feed and should not be fetched every
minute. Use explicit time zones and provider fixture IDs, not provider round numbers.

Current Google limits, checked 5 November 2026:

| Limit | Consumer account | Paid Google Workspace account |
| --- | ---: | ---: |
| URL Fetch calls per user per day | 20,000 | 100,000 |
| Total triggered runtime per user per day | 90 minutes | 360 minutes |
| Runtime per execution | 6 minutes | 6 minutes |

These quotas are shared by the executing account's scripts, not reserved for FFL.
Microsoft 365 or a ChatGPT subscription does not confer Google Workspace quotas.
Google permits everyMinutes(1); it is a polling target, not an exact latency promise.

### Planning examples, not measured performance

Assume one combined poll covering all active games takes the shown runtime. A
10-hour active day has 600 one-minute polls; a 24-hour day has 1,440. HTTP requests
for game metadata, statistics, token refreshes and retries each add to fetch use.

| Polling window | 5 seconds/poll | 10 seconds/poll | 15 seconds/poll |
| --- | ---: | ---: | ---: |
| 10 hours at one-minute intervals | 50 min/day | 100 min/day | 150 min/day |
| 24 hours at one-minute intervals | 120 min/day | 240 min/day | 360 min/day |
| 10 hours at five-minute intervals | 10 min/day | 20 min/day | 30 min/day |

With three concurrent games, two HTTP requests per game and 600 cycles, the base is
3,600 fetches/day, before authentication, retries, verification and other scripts.
Overlap reduces scheduler cycles compared with treating every game separately, but
still increases the work and requests within each cycle. fetchAll may reduce wall
time; each HTTP request still needs budgeting.

At the chosen five-minute regular cadence, ten active hours means 120 collector
runs/day: at ten seconds/run, 20 minutes of runtime. With three concurrent games and
two requests/game/run, the base is 720 fetches/day before other overhead. These
estimates exclude off-window schedule checks, verification, retries and other scripts.

At 600 daily cycles, a consumer account exhausts its entire 90-minute allowance at
9 seconds/poll; Workspace reaches 360 minutes at 36 seconds/poll. Both need spare
capacity. A conservative initial collector budget is 50% of the relevant runtime
quota after reserving other scripts' usage; fall back to five-minute polling or pause
when the configured cap is reached. This is a proposed budget, not an installed guard.

### Next implementation gates

1. Extend the successful completed-round GAS ID/statistic, scoring and shadow-storage
   tests into scheduled access and sustained timing under live overlap.
2. Complete AFL Tables identity coverage, disagreement handling and post-match availability checks.
3. Wire the tested policy into staging, approval, storage and the published API;
   test corrections, unavailable sources, stale data, concurrency and rollback.
4. Add the display states and timestamp handling; keep live mode off.
5. Before enabling live mode, conduct a live match trial and verify source access/use
   requirements. Start with five-minute updates if one-minute runtime headroom is poor.

## Connected timing results, 5 November 2026

The added Development-only `fflOfficialAflTimingReadOnly` probe performs no sheet,
property, scheduler or email writes. It retrieves one website session token, then
metadata and player statistics for batches of one, three and nine known completed
matches, using concurrent requests within each batch. It checks metadata match and
provider IDs, completion and 23-player-per-side coverage. It does not yet verify
every player ID/statistic, calculate FFL scores, store snapshots or serve browsers.

| Measure | Run 1 | Run 2 |
| --- | ---: | ---: |
| One-game batch | 0.702 s | 0.920 s |
| Three-game batch | 0.900 s | 1.035 s |
| Nine-game batch | 1.771 s | 1.686 s |
| Probe's internal total | 4.658 s | 5.126 s |
| GAS execution-history total | 5.480 s | 6.302 s |

Each successful run made 27 HTTP requests (1 session plus 2 per game across 1+3+9
game batches). All returned 200; the nine-game batch contained 414 players and
846,874 bytes. The properties and monitored scraper Master health cells were
unchanged. One initial run failed its metadata wrapper validation; that defect was
corrected before these two successful runs, and its failure log is retained.

This is a transport baseline for completed matches. Parallel archived requests are
not a trial during live matches or a certified whole pipeline runtime. They support
the proposed cadence but do not prove unattended reliability or quota headroom.

The signed-in account was visible, but its paid Google Workspace quota entitlement
and the eventual scheduler owner are not verified by this check. Budget against
consumer limits until that is established. Verifier update timing, source access/use
requirements, operational host integration and final deployment remain open.

Sources:
- https://developers.google.com/apps-script/guides/services/quotas
- https://developers.google.com/apps-script/reference/script/clock-trigger-builder
- https://developers.google.com/apps-script/guides/triggers/installable

## Statistic tolerance approved 8 November 2026

John selected AFL.com as the source of truth for small differences. Compare each
player's individual FFL scoring statistic (kicks, handballs, disposals, marks,
hitouts, tackles, goals and behinds). An absolute difference of 0 or 1 is accepted,
using the official AFL value. A difference greater than 1 in any such field holds
the match for verification. Do not net differences between players or accumulate
separate one-count differences into a larger discrepancy. Derived fantasy/team
scores and provider ratings are not the threshold's comparison units. Non-scoring
free-kick differences retain the existing non-blocking treatment.

Record every tolerated scoring difference with both source values, its signed
delta and the applied tolerance in the completed-match assessment and shadow
payload. Identity, complete coverage, freshness and source availability checks
still apply. Changes to already published historical results still need approval,
even if the verifier's current difference is within tolerance.

The two tackle differences in match 8140 now pass: use official AFL's Tom Atkins 8
and Mark Blicavs 0. Replaying the captured wider set produces 27 candidates from
27 games, with those two tolerated differences retained. All 134 tests and the
reproducible build pass. This updates local Development source and preview policy;
the connected GAS lab and running app have not yet received this source update.
The generic coordinator's strict comparison remains separate; operational routing
must apply this official-AFL policy rather than its generic exact-match gate.
