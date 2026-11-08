# Post-trade demo refresh — 30 October 2026

The dated fixture contains 670 sourced players, retaining all ten FFL squads and
stable IDs. All 200 squad players match profile evidence. Of those, 198 career-game
counts and 13 AFL clubs change. The other 470 players broaden the pool.

## Sources and scope

- https://afltables.com/afl/stats/2026.html and linked profiles: 669 participants,
  plus Toby Conway's historical profile (six career games, no 2026 appearances).
  Explicit aliases reconcile legacy names. Duplicate Bailey Williams identities
  stay separate; Rockstars' Bailey J. Williams maps to the West Coast profile.
- https://www.afl.com.au/trade/trade-tracker/2026 and its public live-blog feed:
  30 completed player movements across 30 visible entries, including the five-club
  deal. Pick swaps do not change clubs. All movement names match the pool.
- https://www.afl.com.au/news/features/retirements-and-delistings: 160 recorded
  list changes/movements. Seven squad members are retired/delisted. They remain
  visible but cannot be drafted or retained until confirmed active. Intended
  re-listings are labelled pending. These are current list changes at retrieval,
  including announcements after the trade deadline.

For players with no recorded move/exit, continued membership is inferred from
2026 participation plus the official tracker, rather than independently checked
against a complete 2027 list register. Season stats retain the playing club;
the draft display uses the post-trade club. AFL trades do not change FFL ownership.

Public numerical evidence is archived in
`ffl-workflow/data-refresh/player-evidence-20261030.json.gz`: 670 profiles,
10,028 match records, career-year totals and URLs. No HTML or private workbook data.
SHA-256: `82a4e44f929729f2fffe575e4c1ae314dbf71911ac7b61fea049f5f2556792e4`.
Movement and reconciliation JSON sit alongside it. Collection uses lxml; normal
build/test and reconciliation use Node/Python standard libraries without network.

## Statistics

Career games sum completed senior AFL seasons through 2026, including finals.
Regular-season and including-finals averages are separately labelled. Jagga Smith
has 23 regular-season games and two finals: 25 career games. No practice or junior
matches count. FFL averages score each game first, then average; the nonlinear
midfielder bonus is never applied to average disposals. All six existing FFL roles
are calculated. Kicks, handballs, disposals, marks, hitouts, tackles, goals, behinds
and free kicks are retained in summaries.

## Dynasty and discard interpretation

Historical normal-slot entries count toward dynasty tenure only if the player
had more than 50 career games before that preseason, using completed prior-season
career totals. Fookie-eligible normal-slot retentions do not advance the clock.
This resolves the original provisional flags using evidence, without changing the
three-year rule or rewriting an official ledger.

Bontempelli / Horsen has three qualifying retentions (2024–2026). His highlighted
row and Dynasty Player badge explicitly say he cannot be retained for 2027; retain
options are disabled. Dunkley / Rockstars has one qualifying retention (2026), so
normal retention remains available subject to the two normal slots. Unknown data
has a distinct verification warning rather than being labelled a proven dynasty
limit. List departures have a separate warning.

The existing preseason own-discard restriction remains enforced. The pool, queue
and disabled action show: “You delisted this player — you can draft him from Round
2.” Other coaches may select him in round one. The warning clears in round two
unless the player has already been taken. Inactive players do not receive a false
promise of round-two availability.

## Saved drafts and limits

Working choices survive evidence updates. Started/approved saved demos are not
silently rebased: a visible warning requires an explicit reset before continuing.
No Google data, official squads, live deployment or mail changes are included.

This is not a complete 2027 AFL list. Other zero-appearance listed players and
November draftees are not fully represented. Physical-device checks, real draft
order/date, multi-team identity/capability mappings, shared concurrent sessions,
official publication and restore proof remain open. The data refresh does not
certify shared volunteer testing as ready.
