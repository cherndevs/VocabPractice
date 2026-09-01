# Add Practice Talk as a new, coexisting session mode fed by a per-card mastery composite

Write Mode (spelling) and Read Mode (flashcard recall, currently the only place mastery is marked via "I've Got This") stay as they are. Practice Talk is added as a third, coexisting `Session` mode: a multi-turn spoken conversation between the app and the user, grounded in the current Lesson's topic and its reading list. It is not a replacement for the existing modes — it is structurally different (multi-card, conversational) from a single-word drill, and the redesign explicitly rejected folding it into them.

**A Lesson's writing (spelling) list and reading list are independently captured content, not guaranteed to be the same set of words.** They typically come from different source material (a spelling-list worksheet vs. a reading-comprehension worksheet) and are reviewed/confirmed separately at capture time. A word can appear in one, the other, or both — there is no assumption that capturing a word for one list makes it available to the other. This matters for mastery: a word only carries a Reading score if it exists in the Lesson's reading list, and only a Writing score if it exists in the writing list; a word present in both accrues both independently. Practice Talk draws on the reading list specifically (its conversational evidence feeds the Reading composite, described below), not a hypothetical merged card pool.

Mastery itself moves from a flat per-mode flag to a composite per skill:

- **Reading** (per-card) is a blend of three sub-signals — recognition, pronunciation, comprehension — each updated only by a mode that actually tests it. Read Mode currently tests recognition + pronunciation, not comprehension; grading it as if it also verified comprehension would silently inflate a score nothing actually checked, which is exactly the "silent decay hidden inside one number" problem the wider CHE-39 redesign's Coverage/Retained split exists to prevent.
- **Writing** (per-card) stays Write Mode's domain.
- **Speaking** is not per-card at all — it's a coarser, per-Lesson conversational-fluency score, separate from any card's mastery bar.

Read Mode's old "I've Got This" flag is replaced by Again/Hard/Good/Easy (AHGE) grading, which feeds the Reading composite and drives interleaved queue construction. Write Mode does not get AHGE *self-report* buttons: its correctness is objectively checkable in principle, so asking the learner to also self-assess would be redundant friction. It does get the same two buttons operated by a parent — see the reversal below.

**Reversed: Write Mode does produce a mastery signal, via Offline Grading.** This ADR originally gave Write Mode no signal, on the grounds that its correctness is objectively checkable in principle and self-report would be redundant friction. That reasoning held only while the app was expected to check the work itself — and handwriting recognition for Chinese is not close. The cost of waiting was that a Spelling session recorded nothing at all, leaving Writing mastery permanently dark and, with Speaking deferred, leaving Reading as the only live signal in a redesign whose whole premise is per-skill decay.

So Write Mode gets the same two AHGE buttons as Read Mode, with a different meaning: a **parent** marks the word right or wrong against what the child wrote on paper. This is not the learner self-reporting confidence — the objection to self-report in Write Mode still stands — it is a human standing in for a capability the app lacks.

**Parent-derived grades are stored untagged**, indistinguishable from grades a future recognition system would produce. This was a deliberate choice against recording provenance. The known cost is the one this ADR originally cited as the reason not to do any of this: a Writing score will mix two different measurements, and once recognition ships there will be no way to separate the parent-marked history from the machine-marked history, or to weight them differently. Accepted on the grounds that the alternative — no Writing signal for the foreseeable future — is worse, and that a young learner's history is short enough that the mixed period washes out quickly.

Practice Talk has no button-press moment, so its evidence comes from a post-session pass over the conversation transcript, classifying each touched card into the same AHGE vocabulary (one grading system, not two parallel ones) — e.g. produced-correctly-unprompted ≈ Easy, flagged-confused ≈ Again, heard-without-confusion ≈ Good. The AI drawing on the Lesson's card set may still use ordinary connective/filler vocabulary beyond it; only card-mapped words are evidence.

Beyond AHGE, a Practice Talk session also produces two additional outputs, persisted rather than shown once and discarded:

- **Insight notes**: cross-cutting patterns a single card grade can't capture (e.g. "consistently confuses X and Y"), persisted per card/Lesson so a future Progress screen can use them longitudinally.
- **Candidate vocabulary**: words the user engaged with that aren't in the current card bank, surfaced for the parent to approve (never auto-added — preserves the syllabus-anchored, not app-directed, principle). Approved words join the current Lesson by default and are tagged as **Bonus words**, distinguishing them from syllabus-sourced cards.

A Lesson is upgraded from a free-text session tag to a structured catalog entry, created implicitly the first time a session is tagged with a new name (same authoring flow as today's tag picker) rather than through a separate admin screen. Its topic/theme text — what grounds Practice Talk's conversation — is written by the parent at that point, not auto-summarized from card content.

## Considered Options

- **Deprecate Read/Peek Mode in favor of the new composite model** — rejected: Read Mode's existing recall-test structure is worth keeping as its own drill; the composite is additive, not a replacement.
- **One shared card list per Lesson, drilled differently by each mode** — reversed after further review of actual worksheet content: writing and reading lists come from different source material and aren't guaranteed to overlap, so treating them as one shared list would silently assume a word is reading-known just because it was captured for spelling (or vice versa). Writing and reading lists are captured and reviewed independently (see above); a shared list remains the model only for whatever words happen to appear in both.
- **Auto-generate a Lesson's theme/topic text from its card content** — rejected: this is exactly the kind of app-directed inference the wider redesign moved away from; a parent typing a short label once is cheap and accurate.
- **Practice Talk's conversational evidence feeding mastery through a separate, non-AHGE-shaped path** — rejected: one grading vocabulary the whole mastery engine understands is simpler than maintaining two parallel scoring inputs.
- **AHGE self-report buttons in Write Mode, matching Read Mode** — rejected: Write Mode already has (in principle) an objective correctness signal; self-report there is redundant, unlike Read Mode and Practice Talk, which have no objective fallback.

## Full Review: a second, non-decay-filtered session construction mode

Alongside the due-filtered Refresher (pulls only (card, skill) pairs whose live retrievability has dropped below the retention target), a Lesson also supports **Full Review**: pulls every card in the relevant list — the Lesson's writing list for a Write Mode review, its reading list for a Read Mode review — regardless of current due status. Since writing and reading lists aren't the same set (above), "the Lesson's scope" for a Full Review session is always mode-specific, not a merged pool. This exists for comprehensive pre-test practice — a parent/user who doesn't trust that the algorithm's retrievability estimate has caught everything wants to drill the whole lesson, possibly several times in one sitting, ahead of a school test.

Unlike Anki's analogous "cram mode" (which explicitly does not reschedule or affect the underlying algorithm state), Full Review grades **do** feed back into the normal mastery/decay model. The premise for offering this mode at all is distrust of the algorithm's current estimate; discarding the resulting evidence, as Anki's cram mode does, would mean the estimate never actually gets corrected. A card that turns out to be shakier than its retrievability estimate suggested should have its stability lowered by that result, the same as it would from a normal due-triggered review. Full Review is surfaced in the UI as **Revise all**, and applies to Spelling sessions as well as Reading ones — pulling the Lesson's entire writing list for dictation rather than only the due subset. Because Full Review isn't gated by due status, it is trivially re-runnable any number of times in a session — each pass simply commits fresh grades, compounding normally (e.g. several correct passes in one evening push the next due interval out further, same as any other review history).

**Session construction always loads the full Lesson card set**, not just the due subset — Lesson card counts are small enough that this costs nothing. "Refresher" vs "Full Review" is a filter predicate over that already-loaded set (due-only vs everything), not two different queries. This makes the mode switchable **mid-session**, not just a choice made before starting or at the end: the queue tracks which cards have already been shown this session regardless of mode, and up-next is always (candidate set for the current mode) minus (already shown) — so switching from Refresher to Full Review mid-session just appends the previously-filtered-out cards to what's left, without re-fetching or repeating anything already answered.

## Status: deferred

Speaking sessions are deferred as an epic and are not being built. The type is not offered in the session-creation flow, and the three questions under "Open / deferred" below are parked with it rather than blocking spec work on Spelling and Reading.

What survives the deferral and remains in force: the independence of a Lesson's writing and reading lists, the Reading mastery composite, AHGE grading in Read Mode, Full Review vs Refresher, Lessons as structured catalog entries, and Write Mode's mastery signal (see the reversal below, which post-dates this deferral). What defers with it: Speaking sessions themselves, the Speaking mastery composite, Insight Notes, and Candidate Vocabulary / Bonus Words.

This ADR calls the mode **Practice Talk** throughout. That name has since been collapsed into **Speaking**, the Session Type — they were two names for one thing, since the type has exactly one drill and no views.

## Superseded in part

Session Type, and the separation of it from the in-session view toggle, are settled in [ADR-0008](0008-session-type-chosen-at-creation.md). Where this ADR says "mode" of Write/Read/Practice Talk, read Session Type for Practice Talk and Session View for Write/Read.

## Open / deferred

Not settled — carried forward rather than silently assumed:

- Whether Practice Talk's confusion detection is explicit self-report only, or also inferred from response quality.
- What "coverage" means for the coverage-based session-termination trigger (whole Lesson vs. currently-due subset).
- Whether an approved candidate/Bonus card starts blank or seeded from the conversational evidence that surfaced it.
