# Partition sessions by Subject workspace, not a shared filtered pool

CHE-29 introduced Workspaces (today: Chinese and English Subjects) to segregate learning by subject, matching the owner's mental model of separate learning spaces rather than one combined list. We decided each Session belongs to exactly one Subject: the Subject is captured at session creation from the active workspace, and the sessions page shows only that workspace's sessions. The alternative — one shared pool of sessions tagged by subject and filtered in the UI — was rejected because segregation is the point: a filter would still allow one combined view, and would force filter state through every future page.

A Session's Subject is never reclassified automatically. Mixed-language word content within a session remains allowed and is handled per-word at render time (e.g. Peek Mode hiding for non-Chinese words), so the Chinese workspace can legitimately contain a session with English words in it. Legacy sessions (14 at migration time, none with any subject metadata) were classified once by dominant word language — 11 Chinese, 3 English, with an English fallback for ambiguous content — and will not be revisited.

## Considered Options

- **Tagged shared pool with filtering** — rejected: one combined list remains possible, which contradicts the segregated-spaces mental model, and every future page would have to thread the filter.
- **Auto-derive the Subject from word content on every render** — rejected: fragile for mixed worksheets; ownership should be explicit and stable, not re-derived.
