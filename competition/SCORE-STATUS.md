# Score display states

Implemented in Development source on 6 November 2026. No app deployment or live
collector is enabled by this change.

`score-status.js` is shared by the app and the read-only GAS preview adapter.
The results list, match detail, finals cards and Grand Final view use it. The
round selector describes the current calendar round without claiming the feed is live.

| Label | Meaning |
| --- | --- |
| Scores pending | No scores received |
| Recorded scores | Existing response has no new source/verification metadata |
| Live — provisional | Explicit live phase; scores may change |
| Finished — awaiting verification | Games finished; FinalSiren check outstanding |
| Held — statistics differ | Provider disagreement blocks finalisation |
| Correction awaiting approval | A historical change needs approval |
| Verified — awaiting finalisation | Verification passed; result not published final |
| Final — verified | Finished, complete, independently verified and explicitly finalised |
| Status unavailable | Invalid or mismatched metadata, identity or clock |

Paused collection and delays exceeding two refresh intervals are separate warnings.
The display retains last received scores. Fetch and source-update times are distinct
and shown in Perth time. A failed fetch must not update the last-good timestamp.
Old final results do not acquire an irrelevant live freshness warning.

Scores and state must be returned in one response, tied to the same
`scoreSnapshotId` / `scoreState.snapshotId`. Do not attach a shadow-store status to
totals from SeasonResults. Round identity must match when supplied in both places.
New finals need complete numeric totals, `complete:true` and the final state before
declaring a winner. Legacy results retain their explicit backend completion flag,
without being relabelled independently verified. URL previews cannot crown a premier.
Grand Final position detail from a different snapshot is withheld.

`ffl-workflow/api/ScorePreview.gs` is a prepared authenticated-admin adapter. It
checks the isolated store identity, head, chunks, SHA256 checksum and unchanged
head on readback, then returns only scores and status. It never publishes or writes.
Its projection was tested against the actual GAS shadow store; it is not yet a
deployed HTTP route. A future route must pass the server's `validateToken` result,
use the server-only `FFL_SCORE_SHADOW_ID` property and avoid caching private replies
across users. Install the shared module alongside index.html when deploying the app.
The historical reader's `n > 0` filter also needs the prepared zero-score patch
before this source is deployed against that reader.

The live/incomplete-match scorer and scheduler still require implementation and
sustained trials. This change implements their presentation contract; it does not
make the completed-round scoring engine capable of scoring live games.

## FinalSiren access

The current public website uses `/matches/2026/round-1` and clean match URLs.
Normal browser access works. On 6 November 2026 AWST, a read-only GAS test of that
round and Carlton v Richmond each returned HTTP 403 and a security challenge.
Updating the old ASP URL therefore does not resolve collector access. No challenge
workaround, copied browser cookies, proxy or alternative verifier is enabled.

The [contact form](https://www.finalsiren.com/contact) is the next route for asking
about supported machine access or a permitted export. The
[terms](https://www.finalsiren.com/terms), dated 21 September 2026, distinguish public
statistical facts from their site and presentation, restrict copying/republishing
the site, and prohibit unreasonable automated load. No request has been sent.

Proposed scope: one shared collector, post-match checks with cached results,
bounded retries and no polling while blocked. AFL remains primary. FinalSiren
verification is independent of the agreed future 5-minute regular-round / 1-minute
finals live-refresh cadence. A successful HTTP response will still require a new
identity/coverage/statistics parser and independent comparison before finalisation.
