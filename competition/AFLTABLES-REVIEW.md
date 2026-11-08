# AFL Tables Development provider

AFL Tables can supply common scoring statistics when the incumbent fetch is unavailable. The adapter validates explicit fixture and player mappings before returning rows to the coordinator. It does not select an authoritative source or enable publication.

The 5 November 2026 Development Apps Script check retrieved and validated nine matches and 414 player rows from 12–15 March. These fixtures are provider round 2 and incumbent round 1. Their 4,140 common-stat comparisons contained 27 differences across 15 players, including 24 scoring-field differences. An earlier one-game match did not establish whole-round agreement. No historical result was changed.

Player identity uses existing canonical IDs joined to exact AFL Tables profile paths, including numbered paths for namesakes. Historical club membership is supplied in the match manifest; it never comes from the current post-trade club. Abbreviations in display names do not control identity. Expected rosters, teams, venue, provider round and local time offset must be explicit. Unknown IDs, missing players, missing headers, inconsistent disposals, incomplete quarters and invalid team totals fail closed.

The 17-column row preserves the legacy shape. Score points (column SC) are derived as six times goals plus behinds. AFL Tables does not supply the incumbent provider rating: that value is null with explicit unavailableStatistics metadata. The coordinator permits this declaration only for rating; every scoring statistic is still mandatory. No rating is copied from the archive and zero is not substituted for unavailable data.

The extractor expects 23 players per side, as in this 2026 fixture set. Other seasons, substitute rules, changed venue labels and live/incomplete matches are not certified. The host must supply a verified manifest and registry. Default coordinator policy still requires two independent agreeing providers; single-source policy is not enabled here. Stored archive data is a comparison baseline, not a currently functioning second source.

Validation: 81 branch tests, deterministic preview build check and clean diff check. Three additional private-evidence runs use the actual captured round with simulated storage to prove disagreement, primary unavailability and missing-player rejection before staging. The actual Apps Script adapter run is read-only and preserves diagnostic state. This is not a connected durable-storage, concurrency, deployment-rollback or whole-system recovery sign-off.

John subsequently selected official AFL statistics as primary, FinalSiren as the completed-game verifier, and live scoring as an optional feature that remains off. Existing canonical names and closed historical results are retained; corrections require approval. See `AFL-SOURCE-AND-LIVE-PLAN.md` and the pure `afl-source-policy.js` assessment. This changes the intended source policy, not the running scraper. AFL Tables remains diagnostic rather than an automatic fallback.

Open gates: reliable official and verifier transport, applying the policy in the operational host, target storage integration, whole-system recovery and deployment-owner verification. Keep the legacy competition unchanged and all operational writers, schedulers and email disabled.

## Verifier role, 7 November 2026

AFL Tables is now the selected completed-game verifier in Development. Official AFL
remains primary. Named finals labels, single-digit dates and additional mapped venues
are supported only against explicit fixture manifests; live/incomplete games fail closed.
AFL Tables lists AFL among its sources (https://afltables.com/afl/notes.html), so
separate retrieval does not establish independent statistical collection. See
`AFLTABLES-VERIFIER.md` for the wider diagnostics and connected-store outcome.
This supersedes the earlier FinalSiren-only policy above.
