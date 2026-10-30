# Katy foundation C1 implementation record

John approved this source-only stage on 30 October 2026. It recovers the existing
workflow, fixes prepared response privacy and event evidence, and introduces FFL HQ
and Katy's deterministic explanation boundary. It authorises a feature branch from
`develop` and a draft PR. Merge, Google installation, deployment, write enablement,
sharing, mail and paid AI remain separate decisions.

## Starting point

- Repository: `johnrockWA/GreatMatesFFL-sandbox`.
- `main`, `develop` and tag `pre-katy-baseline-2026-10-29`:
  `04ae1b156dc9b63929dc42308c8a7c3e0f724fab`.
- Main-only ruleset 26115210 is active: PR required, zero mandatory reviews,
  deletion/force pushes blocked, no bypass actors. CI is not yet a required rule.
- Original rules suite passed 11 tests. No shared coach test was represented.

## Changes

1. Recovered the archived pure engine, coach/committee UI, template and prepared
   Apps Script adapter into `ffl-workflow/`. The archive remains historical evidence.
2. Recovered the existing logo and frozen **public** 200-player demo fixture from
   the baseline HTML. No private workbook or credential values were added.
3. Replaced the full-state coach response with explicit public and role projections.
   Other teams' working/submitted choices are excluded before preparation. Only
   committee-approved locked choices are public after preparation. Queues remain
   private, including in committee audit responses. The local role-switching demo
   still deliberately owns all demo state; it is not a shared security boundary.
4. Accepted actions append before/after evidence, actor, timestamp, reason, request
   identifier and rule/software versions. Pick teams derive from the validated turn.
   Failed actions and stale retries cannot append evidence. Request identifiers are
   labels only in C1; durable request-result deduplication is not implemented yet.
5. Renamed the workflow committee workspace to **FFL HQ** and added **Katy — Executive
   Administrator** with deterministic next-step guidance. Conversational AI is
   disabled; Katy has no execution or write tools. Actual role grants are unassigned.
6. Added a path-independent builder, local regression tests and read-only CI.
   CI has no deployment job, OAuth credentials, mail service or AI dependency.

The baseline `index.html`, `draft-preview.html` and preview URLs are preserved.
`draft-workflow-preview.html` is deliberately regenerated from the recovered source.
The full app's Admin integration remains a later authenticated-UI change.

## Validation

Run `npm run check`. Tests include the original eleven scenarios plus raw-response
privacy, field allowlists, correction/pick evidence, queue-event privacy, adapter
denial/finalisation boundaries, Katy's disabled AI boundary and deterministic builds
from unrelated working directories. All generated inline scripts are syntax checked.

Local result: **31 passed, 0 failed**, including the original eleven scenarios.
Browser visual checks were not run because the connected browser timed out. Real
shared sessions, mobile/desktop visual acceptance and Google integration remain open.

The starting demo was rebuilt byte-for-byte before edits (SHA-256
`7de080ed859f8fd0c467b204ea657b64fd94c5fa86288429245f6c514000099d`).
Subsequent HTML changes are intentional C1 output, checked against the builder.

## Findings retained as open

- The inspected Google source includes `refreshPlayerClubMaster()` writes outside
  the write-enable guard. A private local candidate patch and fake-service tests
  are prepared separately; no Google change is part of this PR. Remaining source,
  reminders, manifest/scopes, triggers, other deployment and dependency review must
  finish before installing or enabling it.
- Shared finalisation stays blocked. Weekly consumers/history writeback, real
  concurrency, committed request deduplication and restore proof are unimplemented.
- The public fixture has two missing career-games counts and sixteen provisional
  history flags. These have not been filled or treated as verified dynasty counts.
- Multi-team tester identity and the Commissioner/President capability matrix need
  explicit mappings; demo role selection does not assign real access.
- No required CI rule is added until real check runs and names are verified and
  John separately authorises that setting change.

## Publication and rollback

Local feature branch: `feature/katy-foundation`, intended to target `develop` in a
draft PR. GitHub branch creation returned HTTP 403, "Resource not accessible by
integration". A readback confirmed no remote feature branch was created. No source
commit or PR has been published. The unpublished patch and prepared PR description
are preserved separately pending a GitHub connection with the required write access.
`main`, `develop` and the baseline tag remain unchanged.

C1 has no data migration or Google deployment effect. Abandoning the feature branch
leaves the existing preview intact. Any later merge should be reversible by a normal
revert PR. A code tag is not a spreadsheet backup. Google version rollback and data
restoration require separate verified procedures and approval.
