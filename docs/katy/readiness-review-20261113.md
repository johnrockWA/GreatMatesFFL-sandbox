# FFL readiness review — 13 November 2026

## Decision

**No-go for production or invitations to ordinary coaches today. Go for preparing a restricted synthetic coach pilot.** The project has a credible rules/storage foundation and substantially stronger connected evidence. It is still a collection of tested successor components plus an owner/editor-only rehearsal, not a complete replacement competition application.

This is a fresh critical review by the implementing assistant, not an independent third-party audit. Tests, implementation claims and observed browser evidence are distinguished below. No percentage-complete estimate is justified by the available evidence.

## Goal and scope

The goal is a straightforward 2027 competition experience: an assigned coach can retain/delist, draft, submit weekly nominations and understand their matchup/results; authorised committee members can review consequential changes; Katy provides factual administration in the background. Historical competition data must survive intact. Live scoring, notifications and automated administration are supporting functions, not substitutes for a reliable ordinary-coach journey.

The current direction fits that goal in several ways: deterministic rules, explicit submissions, private queues, central receipts, staged publication, score provenance and a simple coach screen. The weak point is delivery integration. A substantial amount of engineering evidence sits in test fixtures, editor runners and private installation bundles. Continuing to add features there without an ordinary-coach pilot would create more code without resolving the central product uncertainty.

## Evidence checked in this pass

| Area | Evidence | Conclusion and limit |
| --- | --- | --- |
| Source | 217 tests pass; generated pages match | Rules/boundaries/packaging checked, not proof of live service availability |
| Phone-width UI | Actual connected coach tab: 390px outer viewport, 375px body and scroll width; screenshot of submission/receipt | Login, submit, queue, confirmation and pick usable at this width; no physical iPhone/Safari or Android device tested |
| Separate sessions | Alpha and Beta independently authenticated as synthetic coaches under one editor-authorised Google browser | App-session separation verified; not separate Google users or ordinary non-editor deployment access |
| Midseason | Both coaches selected two delists and submitted; editor helper prepared/armed; all four subsequent picks through browser controls | Complete two-team midseason pick flow reached validation; four unique players, proposed squads [20,20]; no official publication |
| Lost reply | Alpha pick saved at revision 10, server deliberately returned UNCONFIRMED, Beta picked at 11 | Models lost application acknowledgement after commit, not an actual network outage |
| Expiry/reload/recovery | Alpha server session expiry forced; workspace hidden; page reloaded; Alpha signed in again and recovered original receipt | Receipt 57073302-5c94-41fc-80f9-230050b84c62 recovered at revision 10 while current state included Beta's pick; no duplicate pick |
| Continuation | Alpha next pick revision 12; Beta final pick revision 13 | Recovery did not prevent continuation |
| Privacy | Beta complementary queue panel empty while Alpha queue held player s20; Alpha queue survived expiry/reload | This observed case passed; broader role/multi-team denial coverage remains source-level |
| Preservation | Final connected report compared protected-sheet fingerprint, original owner-store hash, and archived preseason head hash | All unchanged; this is not a scan of every historic sheet or trigger in every account |
| Earlier full integration | Preseason 38 picks, [20,20] squads, two weekly submissions, two-team ladder, correction/restore, two captured notifications | First two picks browser-driven; rest and downstream workflow server-run synthetic evidence; zero real emails |
| Deployed endpoints | Both active Development deployments visibly version 4, 5 Nov; execute as owner; access Only myself | Latest editor code is not the code served to ordinary coaches by these endpoints |

The installed IntegrationRehearsal.gs was copied back from the editor and exactly matched the generated candidate. The synthetic browser entry switch was disabled and both test sessions signed out at the end. Prior preseason records were archived by reference, not overwritten.

## Architecture and connections

`draft-engine.js` enforces selections, time windows, preparation, turns and final squad calculations. `draft-access.js` adds explicit assigned teams and action capabilities. `draft-store.js` serialises immutable snapshots and receipts under a host lock, checks hashes, and makes retries return the current state plus the original receipt. `shared-client.js` stores the pending request before transmission, refuses mismatched receipts, and protects a newer view from older reads. These are useful foundations worth retaining.

The normal prepared Apps Script route and the synthetic integration route are different hosts. The normal route independently denies finalisation. The rehearsal connects draft/squads/nominations/scoring through `development-workflow.js`, a synthetic aggregate with its own storage. Its success cannot be used to claim that all incumbent app consumers now read a shared published squad snapshot. They do not become connected merely by passing the rehearsal.

The ordinary authentication adapter still reads password strings from the sandbox credential sheet and compares them through `draft-auth.js`. Hashed session-token cache keys, expiry and revocation are implemented; that is not a migration of password storage or a complete account-recovery experience. The owner wrapper also restricts login to the owner. Broadening the existing project's deployment audience would expose a larger legacy surface than the isolated coach screen alone. Prepare a separate minimal pilot host and review its routes/scopes before any access expansion.

The scoring implementation has strong historical replay evidence recorded in `competition/README.md`: 192 totals and 1,344 positional outputs matched frozen evidence. That is valuable regression evidence, not certification of current AFL collection. The successor scraper pipeline explicitly uses injected provider/storage adapters; synthetic evidence passed into the rehearsal does not connect a live collector or a scheduler.

## Findings in priority order

1. **Release blocker — ordinary access and deployed-version gap.** The latest candidate is reachable in the editor-only Development test context; both versioned endpoints remain owner-only version 4. Acceptance must use a versioned minimal pilot deployment, named testers, explicit team grants and a non-editor Google session. Do not grant project-editor access merely to make the test pass.
2. **Release blocker — credentials and account lifecycle.** Legacy credential comparison remains; production identity, enrolment/revocation and recovery need an explicit decision and implementation. Preserve the current owner-only boundary while this is designed. Test unknown/revoked users and cross-team requests against the deployed host.
3. **Release blocker — one end-to-end coach product.** Squad publication, weekly nominations, scores/ladder and corrections are connected in a synthetic server aggregate. They still need the actual coach and committee screens, consistent committed snapshot consumers and real reload/lockout acceptance.
4. **Release blocker — real inputs.** Full player identities, verified eligibility/history, official squads, draft order and fixture mapping remain listed as unverified in the rules register. The register still labels the rule set provisional. A two-team synthetic fixture cannot certify a real ten-team draft or multi-team coach.
5. **Release blocker — scoring collection and policy.** The provider pipeline, deployed scraper and evidence sources need reconciliation. The successor pipeline currently applies a tolerance of one to every compared scoring statistic, not only tackles. That is a concrete rule-policy decision to resolve before a feed can be certified; this review does not silently change it. Prior external-provider historical differences remain unresolved in the recorded replay evidence.
6. **Pilot quality gap — coach wording.** Midseason currently displays retention eligibility beside delist choices and lacks a clear midseason re-draft consequence warning in the shared screen. Clarify the exact league rule, then put the consequence beside submission/confirmation. Avoid adding a separate explanatory dashboard.
7. **Resilience gap — load, contention and operations.** This pass proved interleaved browser activity and recovery, not a simultaneous two-writer race on the same pick. Earlier source and connected queue tests are narrower evidence. Run the same-pick contention case on the pilot host, plus script timeout/quota/failed-write cases and notification reconciliation. No live mail transport or scheduled operations were certified.
8. **Maintenance risk — manual installation and accumulating proposals.** Packaging and CI help, but editor uploads and several historical draft PRs increase the chance of source/deployment drift. Keep one candidate PR with an exact installation manifest and change record. Archive/supersede old PRs deliberately after candidate acceptance, not by assuming they were merged.

## Recommended pathway

**Milestone A: restricted coach pilot.** Prepare a minimal host containing only the draft routes and synthetic data, with no legacy competition writer or mail sender. Select the identity approach, identify two named tester accounts and team assignments, and produce the exact deployment/access proposal. Keep a versioned source manifest and rollback instructions. Access expansion is a separate approval at the actual change, not implied by this read-only review.

**Milestone B: realistic operational mock.** After access is approved, test two actual non-editor identities and one ordinary phone. Complete the ten-team draft with agreed ordering/inputs, include a multi-team coach if required, test simultaneous claims, lost replies, expiry and correction. Extend the actual UI through weekly nomination and locked round results. Record failed/not-run tests as well as passes. Existing synthetic test accounts are not pilot invitations.

**Milestone C: production rehearsal and release decision.** Reconcile authoritative data/rules, connect and verify real providers, stage a complete round, test correction/notification dedupe/restore with real-shaped data and captured delivery. Produce the exact source/deployment/data migration and rollback package for John's go/no-go. Only then merge/release or enable official publication and real messages.

Pause portrait/chat embellishments and nonessential dashboards until Milestone A is resolved. Keep Katy as a deterministic administration layer with factual summaries; no coach-selection assistance is required to achieve the core goal.

## Proposed two-coach pilot acceptance checklist

- Ordinary non-editor access succeeds for each named tester and fails for an unassigned identity.
- Each sees only assigned team controls/private queue; committee-only actions are denied.
- Real phone can submit, queue and confirm picks without horizontal page overflow or hidden controls.
- Two clients contend for the same turn: exactly one accepted write; loser sees a clear refresh path.
- Lost acknowledgement plus session expiry/reload recovers the original receipt once.
- Ten-team squads remain unique and complete; nomination lockout uses server time.
- A frozen round publishes through reviewed screens and all readers use the same snapshot.
- Captured notification recipients/content/dedupe and a restore drill match the approved proposal.

No coach invitations, access changes, official record edits, production cutover or real mail occurred in this pass. Needed from John before a genuine external pilot: the two intended coach identities/email addresses and their team assignments. A deployment proposal must be prepared before requesting approval to expand access.

Official platform reference checked during this review: [Google Apps Script web apps](https://developers.google.com/apps-script/guides/web) states that `/dev` requires script edit access and runs the latest saved code; [deployment documentation](https://developers.google.com/apps-script/concepts/deployments) distinguishes test/head deployments from versioned releases. The observed owner-only version 4 settings above came from the actual Development deployment dialog.
