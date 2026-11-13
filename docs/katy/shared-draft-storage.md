# Shared draft storage and access

8 November 2026. Source work extends the combined sandbox branch. The coach
preview remains a browser-local simulation until its authenticated HTTP path is
connected. No new coach access, official squad publication or release is enabled.

`ffl-workflow/draft-store.js` stores immutable checksummed envelopes containing
draft state and durable request receipts. It verifies a staged row before changing
the head pointer, reads back the committed pointer, and recovers an accepted write
whose response was lost. Every transaction holds the host script lock. A repeated
request returns the original acceptance revision alongside the current projected
state; reusing its identifier with a different action is rejected. The receipt
history is retained and stops further writes at its explicit archive threshold.

`draft-access.js` requires a server-validated identity and one explicit identity
registry entry. Selected teams must belong to that entry. Client roles and the old
broad Admin label do not grant committee powers. Each committee action needs its
own explicit grant; final squad publication remains blocked for everyone. Real
Commissioner/President grants still require verification before use.

The prepared `api/DraftWorkflow.gs` connects these modules to Apps Script locking
and sheet storage. Its physical format is `FFL_DRAFT_STORE_V2` in A1, a JSON pointer
in B1, and immutable snapshot rows from row 3. It requires a new initialized store
and the reviewed `FFL_DRAFT_IDENTITIES` server property. It does not migrate legacy
state, expose an HTTP route, create users, alter operational write gates or enable
mail. Both read and write responses are projected for the managing team.

## Validation

- 171 source tests pass; the generated preview matches its committed builder.
- A separate editor-only Google lab uses the same storage module, access module,
  rules engine and physical storage implementation with made-up teams/players.
  Its isolated test sheet is explicitly labelled disposable. All operational
  competition writes remain disabled; existing coach, squad and dynasty data
  were compared before/after and stayed unchanged.
- The first connected execution passed central save/readback, duplicate receipt,
  wrong-team denial, unknown-identity denial, unassigned-team denial and opponent
  private-data filtering.
- A separate execution reloaded that saved state, recovered the receipt, rejected
  stale clients, prepared/armed the synthetic draft, saved exactly one pick and
  blocked a duplicate or already-taken pick. It ended at revision 5 with one pick.

The Google checks use synthetic identities and phase clocks. They exercise actual
Google storage and locks, not coach login, real deadline transitions or genuinely
simultaneous requests. They are not a shared-coach acceptance trial. No existing
versioned web-app deployment was changed.

## Next integration

Connect the coach screens and authenticated routes to this store, supply reviewed
identity/team/capability mappings, and show submitted/saved/unsent status with the
durable receipt. Verify two independent browser sessions with genuinely concurrent
picks, reconnects, stale confirmations and lockout boundaries. Then run the small
coach mock before any official squad/history publication.
