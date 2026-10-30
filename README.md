# GreatMatesFFL-sandbox
Isolated 2027 development preview for Great Mates FFL.

The workflow preview now has reproducible source and an initial **FFL HQ / Katy**
foundation. It is still a browser-local simulation: no shared sign-in, official
spreadsheet changes, emails or conversational AI.

## Run locally

Use Node 22 and Python 3. No npm packages or Google credentials are required.

```sh
npm test
npm run build
npm run build:check
```

`npm run check` runs the suite and verifies that the committed HTML matches its
builder. The builder works from any current directory and uses the frozen public
fixture in `ffl-workflow/fixtures/`. That fixture is not a verified player/history
snapshot. The original ZIP is retained as a historical build, not the source to edit.

Open `draft-workflow-preview.html` for the workflow simulation. Select a committee
preview role and open **FFL HQ** to see Katy's deterministic guidance. Test roles and
dates are examples, not granted real access or scheduled mock dates. Existing
`index.html` and `draft-preview.html` remain in place.

The prepared API adapter is uninstalled, requires explicit verified identity
mappings, and blocks shared finalisation. See [the implementation record](docs/katy/implementation-record.md)
and [acceptance gates](docs/katy/acceptance-and-release.md) before any Google work.

Keep OAuth state, coach emails, passwords, tokens and private workbook snapshots out
of this public repository. CI only tests/builds; it cannot deploy or contact coaches.
