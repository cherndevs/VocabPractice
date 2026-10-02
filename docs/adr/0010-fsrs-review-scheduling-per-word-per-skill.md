# Review scheduling is FSRS, per word per skill, computed on the server

When a word next comes up for practice is decided by FSRS (via `ts-fsrs`), kept as a **review state** per word *per skill*: a word on both a Lesson's lists has a reading review state and a spelling review state that move independently. A word **needs review** when its state says so, and ordinary sessions and the per-skill Refreshers draw from those words. This replaces the earlier idea of a separate mastery score on top: FSRS already holds how well each word is remembered, so the parked mastery composites (ADR-0007) stay parked and nothing is built in their place.

Settings, chosen against a school-term rhythm rather than lifelong retention:

- **Retention target 0.95**, both skills. Simulated with default FSRS-6 weights, an always-correct word comes back after 3 → 6 → 15 → 34 → 72 days, staying in rotation across a term; Anki's default 0.9 gives 3 → 14 → 57 → 196, dropping a word for two months after three successes. The cost is roughly one or two extra reviews per word per year.
- **Reading keeps Anki's default same-session repeats** (a new word, or one marked "Oops", comes back minutes later in the same session). **Spelling has none**: its grades arrive in the marking pass after dictation is over, so a word can't come back mid-session, and FSRS is configured to schedule spelling in days from the first grade.
- **Default weights, no per-learner optimisation.** FSRS's defaults are meant as a sound starting point for a learner with no history; fitting weights needs several hundred reviews. Every raw grade is stored with its timestamp, so fitting later loses nothing.

FSRS runs **on the server**, when a grade is saved, so there is one clock and one schedule across devices. The server is a free Render web service, which sleeps after 15 minutes idle and takes about a minute to wake, so saving a grade must never hold up the next card: the UI advances immediately and the save catches up. The database is Neon, not Render's free Postgres, which is deleted after 30 days.

A Session's **due date** (the day of the test it prepares for) is a separate mechanism and does not feed FSRS. In simulation, a word got right on a Monday comes back Thursday and then two weeks later, so FSRS alone never drills a list on the days before a Friday test. Pre-test practice comes from the due date and **Revise all**, whose grades update review state like any others.

## Considered Options

- **A fixed interval ladder** (1, 2, 4, 7, 14, 30 days; "Oops" resets) — simpler and easy to explain, but no real advantage once FSRS is a free library with sensible defaults.
- **SM-2** — its ease factor needs a fine-grained grade scale to do much; Spelling has two grades.
- **Scheduling on the phone** — works offline, but two devices can disagree and the phone's clock decides due dates.
