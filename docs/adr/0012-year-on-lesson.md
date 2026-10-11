# A Lesson's Year is an optional text column on `lessons`

A **Year** (e.g. "P1") is stored as a nullable `year` text column on `lessons`, and Lesson uniqueness widens from (subject, name) to (subject, year, name) with `NULLS NOT DISTINCT`, so Lessons with no Year still can't share a name. A Session gets its Year only through its Lesson. The Library is divided by Year, with sticky Year headers, Lessons in creation order within each, and "Other" last.

The Year lives on the Lesson because a Lesson already models a school unit, and a unit belongs to one Year whatever the subject. Putting it in the key is forced by real data: every Year's textbook starts again at "Lesson 1" (第一课), so the bare name doesn't identify a Lesson. A `created_at` column came with it so Lessons can be listed in the order they were entered, which for a textbook is its order. Lessons that existed before this change all share the migration's timestamp and fall back to name order.

It is free text rather than an enum. Nothing yet needs to know which Years exist or how they relate, and a fixed list would mean choosing one school system's names. Years sort as text with numbers compared numerically ("P2" before "P10").

A Year is chosen when a new Lesson is created, from the Years already in use or typed. On the edit page, the session's own Lesson can be moved to another Year (`PUT /api/lessons/:id`), which moves every session tagged with it. If that Year already has a Lesson with the same name, picking it retags the session to that Lesson instead.

## Considered Options

- **Year on the Session.** Untagged sessions could have a Year, but two sessions of one Lesson could disagree, and the Lesson name would still collide across Years.
- **Year folded into the Lesson name** ("P1 · 第一课"). No schema change, but the Library couldn't group by it, and the name would mean two things.
- **A `years` table.** Gives each Year an identity for later settings (e.g. a child's current Year), but nothing needs that yet. A text column can be promoted to it later.
