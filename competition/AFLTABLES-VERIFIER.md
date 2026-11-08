# AFL Tables verifier in Development

Official AFL is primary; AFL Tables replaces FinalSiren for completed-match checks.
Live collection, operational publishing, email and triggers remain off. Existing
canonical names and historical results stay unchanged; corrections require approval.

## Verified scope, 7 November 2026

- 123 repository tests pass; generated preview matches committed bytes.
- Fresh 27-game comparison covers official AFL rounds 12 (7 games), 24 (9 games),
  and all 11 AFL finals games, including wildcard finals.
- 1,242 player appearances and 12,420 common-statistic comparisons.
- Two tackle discrepancies in Geelong–Carlton (official match 8140): Tom Atkins
  AFL 8 / AFL Tables 7; Mark Blicavs AFL 0 / AFL Tables 1. This match is held.
- All 11 finals agree on all compared statistics.
- New fixture stages, single-digit dates and explicitly mapped venue aliases parse.
- Connected GAS repeats the 27-game result in 6.919 seconds internally, with no
  sheet/property/trigger writes; monitored statistics, health and properties unchanged.
- Connected original-round pipeline separately fetches both sources, scores all ten
  teams and reloads a checksum-verified revision 5 in the disposable shadow store.
  All nine games / 414 existing mapped players agree. Status is `verified-shadow`,
  never publishable; historical correction proposals remain unapplied.
- The stored response carries its actual verifier (`AFLTables`) and paired snapshot
  identity. Legacy snapshots retain their original verifier label.

## Limits and open work

The wider 27-game test uses diagnostic identity mappings, including 172 players
not in the original nine-game manifest. Eight distinct name aliases require review;
no new identities or aliases have been installed in the canonical player register.
Existing profile/official ID mappings showed no cross-match conflicts. No production
certification is implied by the diagnostic `final-candidate` statistics assessment.

AFL Tables lists AFL among its sources at https://afltables.com/afl/notes.html. This
is a separately retrieved/published website check, not independent collection of
statistics. Shared upstream errors can appear on both sites.

All tested matches are already completed. Actual time from final siren to availability
cannot be established retrospectively; it needs an in-season trial. Keep a completed
game awaiting verification until full verifier data arrives; bounded retries must
never manufacture a final result. Source disagreements retain the last verified
publication. Timing/access/use requirements, sustained live trials, complete canonical
identity coverage, authenticated app deployment, human correction approval, deployment
ownership and whole-system recovery remain open.

## Rollback

Local source is isolated on `dev/afltables-verifier-20261107`. The prior connected
shadow payload remains immutable at revision 4; the source and test-store backups
are held with the private evidence. No GitHub push, merge, deployment or live switch
is part of this step. Revert the source change and use the preserved prior snapshot
through the shadow store's revision-controlled restore path if needed.

## Identity follow-up, 8 November 2026

The private Development mapping pack now resolves the 172 diagnostic additions to
existing IDs by exact profile URL in the 670-player catalogue. The prepared register
contains 586 mappings: the original 414 plus 172 additions. The wider captured test
observes 511 distinct players across 1,242 appearances; 75 original mappings are
retained. No catalogue ID or display name changes. Eight new official/source name
variants have explicit profile-specific aliases, checked against fresh AFL Tables
profile titles and 2026 club/jumper rows, captured official team sheets and repeated
ID consistency. This is evidence-based Development mapping, not external identity
certification or final 2027 roster approval.

`player-identity-review.js` checks profile/ID uniqueness, canonical catalogue links,
explicit aliases and stable official IDs across matches. Historical match clubs are
not inferred from current club membership. The AFL Tables adapter now rejects a
jumper mismatch or missing entry whenever a fixture supplies jumper numbers.

Offline revalidation of the captured 27 games with the established canonical IDs
still yields 26 agreeing games and one held game. Fresh retrieval of official AFL
and AFL Tables for match 8140 still reports Atkins 8/7 and Blicavs 0/1 tackles.
This is an unresolved source disagreement, not a parser or player-link correction;
no authority was silently chosen. The original nine-game/414-row official input
also normalizes against the expanded register.

The mapping pack and code are prepared locally. They have not been installed into
the connected Apps Script lab, operational registry or app. Next: install the
expanded register into the Development lab, repeat connected checks, then continue
app integration with the disputed match held. Historical corrections, live feeds,
publication, deployment ownership and whole-system recovery remain separate gates.


## Tolerance decision superseding the match hold, 8 November 2026

John approved official AFL as the source of truth when each player scoring-statistic
difference is at most one; greater differences require verification. The previously
held match 8140 is therefore a candidate using Atkins 8 and Blicavs 0 tackles.
Both one-count differences remain in the assessment audit. The captured 27-game
replay now yields 27 candidates. This policy update is local Development source,
not a connected GAS/app installation. See `AFL-SOURCE-AND-LIVE-PLAN.md` for scope.
