# Issue tracker: Linear

Issues and specs for this repo live in Linear, team **Cherndevs** (identifiers `CHE-…`). Use the Linear connector tools (`mcp__Linear__*`) for all operations. Never use `gh issue`: GitHub Issues are not used.

## Conventions

- **Create an issue**: `save_issue` with `team: "Cherndevs"`, a title, and a markdown description.
- **Update an issue**: `save_issue` with the issue's `id` (e.g. `CHE-39`).
- **Read an issue**: `get_issue`, plus `list_comments` for its comments.
- **List issues**: `list_issues` filtered by team, label, and status.
- **Comment on an issue**: `save_comment`.
- **Apply / remove labels**: `save_issue` with the full `labels` list. If a label doesn't exist yet, create it with `create_issue_label` on the Cherndevs team first.
- **Close**: set the status to `Done` (or `Canceled` for wontfix) via `save_issue`, with a closing comment.

Pull requests stay on GitHub (`cherndevs/VocabPractice`); put the `CHE-…` identifier in the PR title or branch name so Linear links them.

## When a skill says "publish to the issue tracker"

If the work already has a Linear issue (e.g. `/to-spec` for CHE-39), write the spec into that issue's description. Otherwise create a new issue on the Cherndevs team.

## When a skill says "fetch the relevant ticket"

Call `get_issue` with the identifier, then `list_comments`.

## Tickets from a spec

Tickets produced from a spec (e.g. by `/to-tickets`) are created as **sub-issues** of the spec issue (`parentId`). Blocking is expressed with Linear's native **blocked by** relations; a ticket is unblocked when every blocker is `Done`.

## Wayfinding operations

Used by `/wayfinder`. The **map** is a single issue with **child** issues as tickets.

- **Map**: an issue labelled `wayfinder:map`, holding the Notes / Decisions-so-far / Fog body.
- **Child ticket**: a sub-issue of the map. Labels: `wayfinder:<type>` (`research`/`prototype`/`grilling`/`task`). Once claimed, the ticket is assigned to the driving dev.
- **Blocking**: Linear "blocked by" relations.
- **Frontier query**: list the map's open sub-issues, drop any with an open blocker or an assignee; first in map order wins.
- **Claim**: assign the issue to yourself, the session's first write.
- **Resolve**: `save_comment` with the answer, set the status to `Done`, then append a context pointer (gist + link) to the map's Decisions-so-far.
