# Connected recovery and project review 13 November 2026

Scope: owner-only Development; official publication disabled. PR 20 is draft and unmerged. Source suite: 207 passing tests; generated builds match.

## Browser lost reply

Injected one lost reply after a successful queue write. Browser reported pending confirmation. Removed injection, saved clean host and reloaded. Pending request recovery returned the original receipt at revision 22 without a second write. Restored queue order at revision 23. This proves queue recovery through the browser, not a two-browser lost-pick scenario.

## Two identities in connected Google server

Temporary owner-only helper in `ffl-workflow/rehearsal/TwoCoachServer.gs` used a dedicated synthetic sheet, two ephemeral invalid-domain accounts, real cache sessions, and the current store/rules/access implementations. Result: passed; revision 4; exactly 2 picks; private queues, turn denial, alternating picks, receipt replay after next turn, stale-pick rejection and cross-team denial passed. Protected records and original owner rehearsal remained unchanged. `browserSessions: false`.

Clean owner host restored and roundtrip verified. Synthetic cache entries and temporary injection property removed. Dedicated evidence sheet retained. No real coaches invited and no production deployment made.

## Review disposition

Strong foundations, not release-ready. Priorities: consolidate 19 draft PRs into one candidate; cover actual PR target branches in CI; generate owner host reproducibly; resolve ordinary-coach identity/session handling; freeze rules and provenance; prove distinct-browser/mobile full mock; implement controlled official squad publication and verify weekly consumers; connect completed-score staging/corrections and mail outbox; measure load and rehearse restoration.

Notification host remains explicitly uninstalled. Live collection remains off. Offline scoring replay is not a live trial. No production approval inferred from prior rehearsal approval.

Detailed six-page review prepared separately for John. Review by the implementing assistant, not independent third-party certification.
