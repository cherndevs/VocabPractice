# Store Workspace as a subject key on sessions, not a workspaces table

The domain model has Workspaces (see [0005](0005-partition-sessions-by-subject-workspace.md)), but the schema stores only the one attribute a workspace has today: a `subject` column on sessions holding a subject key — `'chinese'` or `'english'` — rather than a `workspaces` table with a foreign key. A workspace carries no other data, so a table would be structure with no behaviour. The values are subject keys rather than ISO language codes deliberately, so future subjects (e.g. maths) can join without rework.

If workspaces ever outgrow a single attribute — per-subject settings, topics, metadata — the known migration is to add a workspaces table and backfill it from the subject column, which is cheap. This future-proofing alternative was weighed and deferred.

## Considered Options

- **`workspaces` table + `workspaceId` FK from day one** — rejected: today a workspace is exactly its subject, so the table would be an empty shell; nothing is gained until subjects carry data of their own.
