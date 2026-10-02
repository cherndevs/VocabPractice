# Spelling Pro

- **Code layout and commands:** `WARP.md`. `replit.md` is legacy.
- **Hosting:** Render free tier, which deploys `main` on every push and sleeps after 15 min idle. The database is Neon Postgres.
- **Design canvas:** https://claude.ai/artifact/Dc4fH7D3oxx6qj2ez8732B. Only the user can edit it, via `/design`. Read single files with `Artifact` `read` + `path`, then search the saved copy rather than reading it whole. Where the canvas and `CONTEXT.md`/ADRs disagree, the docs win. A snapshot of its screens lives in `docs/design/practice-and-library/`, for sessions without the Artifact tool; it can lag the canvas, so check its README's date.
- **Test pages** (e.g. a mic test) must be linked from inside the app: the home-screen app has no address bar.

## Agent skills

### Issue tracker

Issues and specs live in Linear, team Cherndevs (`CHE-…`). See `docs/agents/issue-tracker.md`.

### Triage labels

The default five labels (`needs-triage`, `needs-info`, `ready-for-agent`, `ready-for-human`, `wontfix`). See `docs/agents/triage-labels.md`.

### Domain docs

Single-context: `CONTEXT.md` and `docs/adr/` at the repo root. See `docs/agents/domain.md`.
