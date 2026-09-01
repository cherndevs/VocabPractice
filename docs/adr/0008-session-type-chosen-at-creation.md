# Session Type is chosen at creation and sits above the in-session view toggle

A session now carries an explicit **Session Type** — Spelling or Reading — picked as the first step of the creation flow and fixed for that session's lifetime. This is a new concept, not a rename: the shipped `sessions` table has no mode column at all, and the existing Write/Read/Peek control is a `SessionViewMode` tab resolved per word and switched freely mid-session. The two coexist deliberately, so the glossary now separates **Session Type** (what the session is for) from **Session View** (how the current word is displayed).

The trigger was the creation flow needing to know, before capture, which of the Lesson's two independently-captured lists it is filling and which drill will run. ADR-0007 established that the writing and reading lists are not the same set of words; a session that hasn't declared its type cannot know which list it belongs to, which meant the question was being asked late and, at one point, twice.

Type and view are not the same shape of thing, so collapsing them would lose something either way:

- **Type** is a property of the session, decided once, and determines the source list and the drill.
- **View** is a display toggle within a running session, per word, with no bearing on what the session is for. Peek in particular must remain switchable mid-drill — it exists precisely to check a Read Mode guess, and it already hides itself per word when the current word has no Pinyin Annotation.

Types are named for the skill practised — Spelling, Reading — matching the mastery composites (Writing, Reading) rather than the view names (Write, Read, Peek). The user-facing question is "what are we practising?", not "which screen do you want".

A third type, Speaking, is designed in ADR-0007 but deferred as an epic and **not offered in the creation flow at all** — not even disabled. A greyed-out "Soon" card was considered and rejected: it promises a date the project doesn't have, and the cost of adding a third card later is trivial next to the cost of it sitting there unexplained for months.

## Considered Options

- **Session Type replaces the Write/Read/Peek tab bar** — rejected: it would demote Peek from a freely-reachable view to a per-card reveal action, losing the mid-drill check that is Peek's whole purpose, and would change shipped behavior for no gain in the creation flow.
- **Keep asking the type late, on the Review & Confirm screen** — rejected, and in fact reverted: capture and list selection both need the answer before Review is reached, so asking there produced a duplicated question and an unanswerable capture step.
- **Reuse the existing `SessionViewMode` vocabulary (write/read/peek) for the type** — rejected: "Peek" is not a thing anyone practises, and the type maps to a list and a mastery composite, both of which are already named by skill.

## Read Aloud: designed, not wired

A Reading session's drill offers **Read Aloud** — the user says the displayed word, the app assesses the pronunciation. This exists in the design as a placeholder only: a mic affordance labelled "Soon" as the primary action, with "Stuck? Peek" demoted beneath it.

It is unbuilt because the app has no speech capture of any kind. The only audio capability is text-to-speech (`speechSynthesis`, via `useSpeech`), which is one-directional; `getUserMedia` appears only in the camera hook. This is the same shape as ADR-0007's treatment of Write Mode handwriting recognition — UI present, signal not produced — and for the same reason: the drill's structure is decidable now, the capability is not.

Until it exists, Read Mode's pronunciation sub-signal continues to come from AHGE self-report, the same as recognition. Read Aloud is what would make it objective.

## Consequences

- `sessions` needs a type column; it currently has none.
- Which Session Views a session offers becomes a function of its type, rather than a fixed three-tab bar.
- Speaking is a session type of its own, not a stage inside a per-word session. (ADR-0007 calls it Practice Talk; the two names were collapsed into Speaking, since the type has exactly one drill.) An earlier design rendered it as a single-card mic-and-grade step alongside Read and Write, which was wrong on both counts — it is turn-based and multi-card. That drill was removed. What remains on the per-word screen is a bare placeholder, reachable only by setting the design canvas's `modality` knob to `speaking` — not a user-facing view. It exists so that knob has something honest to render while Speaking is unbuilt, and it should not be read as Speaking being a view within a per-word session.
