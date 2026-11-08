# Scraper hardening and successor release

## Separation from incumbent

The intended release is a separate successor competition, based on cloned operational
workbooks and inherited logic. The original remains the fallback. We do not switch
coaches, enable schedules or retire the original merely because source tests pass.

Current known clones: WebApp Data, Season, Player Stats, Draft/Team Lists and Records.
Sandbox Apps Script uses a five-workbook allowlist and sandbox environment/write
checks. Those checks constrain wrapped script access; they do not isolate arbitrary
spreadsheet formulas or every unreviewed legacy helper.

Read-only checks on 3 November 2026 confirmed:
- Season Master points its current player stats and draft links at sandbox clones.
- It still lists external 2024/2025 historical workbook URLs; active use is not yet
  fully traced. No claim of complete formula-level isolation is made.
- SquadsMaster imports through Master B9; Consolidated Stats imports through B8.
- Round01_Data imports through a named reference PLAYER_STATS_URL whose actual
  destination still needs verification.
- Season Averages contains #REF! values, including its round-status and team/position
  references. Diagnose against authoritative formulas before repairing; do not replace
  errors with plausible numbers or waive import access checks.
- Existing read-only historical replays are frozen evidence, not proof that these
  current linked formulas or deployments recalculate correctly.

## Coordinator implementation

`scraper-pipeline.js` is a server-side coordinator with injected services. It contains
no enabled scheduler, credentials, real network provider, Google script changes or
live storage integration. `ingestion.js` remains a separate change-planning helper.

Each manifest comes from trusted fixture data and describes every completed match
expected in the published round snapshot. It includes stable match ID, season, home,
away, canonical playedAt, verified venue, provider-neutral rowDate and exact player
counts for each team. Counts must come from verified competition/team-sheet rules;
the tests use tiny synthetic teams, not a production AFL headcount assumption.

Provider adapters must supply independent upstream sources, normalise their round,
club/name/date vocabulary and return raw match stats in the documented 17-column
shape. Merely changing provider IDs does not make sources independent. Aliases must
be explicit and ambiguous identities must fail. No provider is connected yet.

The default requires two independently validated providers. A named official primary
source remains authoritative when every per-player scoring-stat difference is at most
one. Both source values and the signed verifier-minus-primary difference are retained
in the snapshot and run status. Any difference above one blocks publication, as do
identity, coverage, completion and missing-source failures. This tolerance does not
permit a verifier to replace the official primary values.
A trusted host may explicitly permit one-source degraded operation, but this is off
by default and status stays degraded. There is no silent fallback, averaging or
choosing the most favourable statistics. Provider differences found in the earlier
archive audit remain open and may prevent the strict policy publishing in reality.

Retries are bounded to three attempts for explicitly retryable transport exceptions,
429 and 5xx responses, with injected exponential backoff. Other HTTP errors, malformed
HTML and invalid parsed matches are not treated as success.

Rows must cover both teams exactly and have the expected opponent, venue and date;
scoring statistics must be present and non-negative, and disposals must equal kicks
plus handballs. Duplicate players and provider disagreements block publication.

The full snapshot is staged and hash-verified before a lock-protected revision check
and atomic published-pointer swap. A failed fetch or stage never touches the old
published release. Corrections create a new immutable snapshot. Already-published
matches cannot disappear because a later manifest is incomplete. Identical retries
are no-ops. The coordinator verifies publication with readback and reconciles a lost
commit response by checking the snapshot hash. Unresolved commit state is labelled
unknown, never silently claimed rolled back or successful.

## Storage adapter obligations — not implemented by mocks

The host must implement durable immutable stages, locking across independent requests,
compare-and-swap revision enforcement, atomic publication together with correction
audit, backups and restore. Tests of fake services exercise coordinator behaviour;
they do not prove Google writes, cross-process locks or a production transaction.
Every weekly consumer must read the published snapshot, not a half-updated raw tab.

Health storage is separate from competition scores. It must distinguish last attempt,
last validated retrieval and data publication timestamps, expected/missing matches,
source disagreements and old data being served. A successful unchanged retrieval
must refresh monitoring freshness without creating a new score version. Monitoring
write failures must be exposed separately. The included freshness helper accepts a
verified success timestamp; it does not fetch or persist one itself.

## Before activation

1. Finish clone dependency/named-range audit and resolve reference errors.
2. Capture actual provider HTML fixtures and test current/legacy/failure layouts.
3. Reconcile provider differences by match dates/opponents and explicit aliases.
4. Implement provider, schedule, storage and authenticated consumer adapters.
5. Exercise partial writes, durable readback, concurrent runs, retry, recovery and
   restore on disposable sandbox data; prove last-good score availability.
6. Replay historical results through the complete connected path, then run a shared
   coach mock including lockouts, submission receipts and mobile reloads.
7. Present the exact release/Google targets, remaining limitations and rollback for
   activation approval. Original competition remains available as fallback.

No Google installation, formula edits, import authorisation, trigger creation, live
email or cutover occurred in this source stage.
