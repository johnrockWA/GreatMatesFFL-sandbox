# Coach experience — 2027

Standing direction from John, 8 November 2026: improve the coach interface
throughout development without adding complexity. Apply the useful patterns
from the earlier fantasy-platform review, rather than copying their feature sets.

- Lead with the coach's own matchup, team, submission state and next action.
- Make the team being managed unmistakable, especially for multi-team coaches.
- Keep weekly actions direct: clear deadlines in AWST, readable player information,
  an explicit submit action and a receipt that distinguishes newer unsent edits.
- Keep results, player research and draft workflows easy to scan on a phone.
- Show position averages, games, retention/fookie eligibility and data status where
  relevant; keep extra statistics and explanations behind optional disclosure.
- Preserve search, role filters, a persistent reorderable personal queue, visible
  taken-player status with team/pick and recovery after refresh in the shared draft.
- Confirm draft picks and consequential changes. An outdated confirmation must
  not act on a newer turn or a different managed team.
- Keep provisional, verified, disputed, paused and stale data visibly distinct.
- Keep Katy in the background. Summaries, updates and previews fit within ordinary
  competition content; no prominent chat or weekly conversation requirement.
- Katy supplies factual administration, never team, player or draft advice.

For each UI change ask: does it make a common task easier, reduce ambiguity or
improve readability? Prefer replacing clutter, sensible defaults and progressive
disclosure over another panel, setting or navigation item. Validate real tasks on
mobile and desktop; visual polish must not hide an outstanding data/access check.

This pass removes the greeting/chat sections, collapses preview controls and the
league board, moves the managing-team selector and coach task first, adds a concise
next-action line, and confirms picks. The preview remains a local simulation;
assigned-team authentication, shared queue persistence and weekly matchup landing
remain integration work, not features certified by this UI pass.

The shared-screen proposal keeps Katy inside the existing coach-task panel as a
small administration status. Four recognisable looks switch only from server state:
ordinary administration, a three-hour selection deadline, a recorded submission,
and the coach's confirmed draft turn. The image never selects, ranks, recommends or
changes a player. Final public assets still require John's approval before release.
