# Spelling Pro

A mobile-first spelling practice app: users capture spelling worksheets via camera/OCR, then work through the extracted words in a practice session.

## Language

### Sessions

**Session Type**:
What a session practises, chosen up front at creation and fixed for that session's lifetime: **Spelling** or **Reading**. It determines which of the Lesson's lists the session draws from (writing list or reading list) and which drill runs. A third type, Speaking, is designed but deferred (see Deferred below). Distinct from a Session View, which is a display toggle *within* a running session.
_Avoid_: Session mode, mode (ambiguous with Session View and with the Refresher/Full Review filter)

**Session View**:
A display toggle within a running session — Write, Read, or Peek. Switched freely mid-session and resolved per word; it changes how the current word is presented, never what the session is for. Which views are offered follows from the Session Type.
_Avoid_: Session mode, tab

**Write Mode**:
The Session View where a word is played aloud (dictation), hidden from view, and the user writes it down off-app. Repeats the word per the configured repetition count. The word stays hidden throughout — the writing happens on paper, not on screen. Grading is a separate step afterwards (see Offline Grading). Because grades only arrive once dictation is over, each word appears once per Spelling session; a missed word comes back in a later session.
_Avoid_: Test, test mode

**Read Mode**:
The Session View where the word is displayed on screen for the user to read aloud, with no pinyin, no audio playback, and no repetition — a recall test. The learner grades each word here on the four-point AHGE scale, after a Read Aloud check. A word can come back later in the same session — after an "Oops", or while it is still new and hasn't yet been got right twice. A returning word is labelled "Try once more".
_Avoid_: Practice, practice mode

**Read Aloud**:
The pronunciation check inside Read Mode: the learner says the displayed word and the app checks what it heard. For a Chinese word it checks the syllables, tones included; a homophone counts as correct, since the check is on sound, not on which characters the app thinks were meant. For an English word it checks the word itself, accepting any spelling of the same sound. The learner's voice is used for the check and never kept; the first use says where the audio goes. The learner gets three tries; silence or an unheard attempt doesn't use one up. Passing unlocks the positive grades. A third miss reveals the Pinyin Annotation, exactly as Peek would, and leaves only "Oops". Where the check can't run at all — no microphone access, unsupported device, service unreachable — the session falls back to plain self-report rather than locking grading.
_Avoid_: Speech recognition, voice check, pronunciation test

**Peek Mode**:
The Session View where the word is displayed alongside its Pinyin Annotation and an audio playback button, for checking a Read Mode guess. Has no grading of its own, and peeking at a word locks out its positive grades: having seen the answer, the only honest grade left is "Oops". Hidden from the tab bar whenever the current word has no Pinyin Annotation (e.g. an English word in a mixed-language session).
_Avoid_: Test, test mode, Check mode

**Pinyin Annotation**:
The auto-detected, auto-generated romanization line shown below a word in Peek Mode whenever the word contains Chinese characters. Computed at render time from the word's stored text — never typed in by the user or persisted.
_Avoid_: Translation, transliteration

**AHGE Grading**:
The grading scale behind review scheduling, named for the Again/Hard/Good/Easy scale it maps onto. Read Mode uses all four, shown left to right as **Oops · Hard · OK · Easy** and self-reported by the learner, who is taught what each one means. "Oops" is always available; the three positive grades unlock only once Read Aloud has passed and lock again for good if the learner peeks. Write Mode uses two — Oops and a single positive — as Offline Grading: a parent marking paper can see right or wrong, but not how hard recall felt, so the finer grades would be guesses.
_Avoid_: Grade, rating, difficulty rating, Again/Hard/Good/Easy (as the shipped UI — that's the underlying algorithm's full scale, not what the user sees)

**Offline Grading**:
A parent marking a Spelling session's words right or wrong against what the child wrote on paper, using the same two AHGE buttons. It exists because the app has no handwriting recognition and a Spelling session would otherwise record nothing at all. A deliberate proxy: the grade comes from a person, not from the app checking the work, and is stored indistinguishably from any future recognition-derived grade.
_Avoid_: Marking, self-grading (the learner isn't the one grading), parent review

**Review State**:
What the app knows about how well a word is remembered in one skill, and when it will next need practice. Kept per word *per skill* — a word on both lists has a reading review state and a spelling review state, moving independently. Updated from every grade.
_Avoid_: Mastery (parked — see Deferred), progress, score

**Needs review**:
A word whose review state says it is ready for practice again in that skill. What an ordinary session draws from.
_Avoid_: Due (reserved for a Session's due date), overdue

**Refresher**:
A session made of the words that need review in one skill, across Lessons, rather than one Lesson's list. There is one per skill — a spelling refresher and a reading refresher — each offered on the Practice screen only when it has words. Never mixed, so a reading refresher can be done without a parent free to mark.
_Avoid_: Quick Refresher as a single mixed session, review session

**Due date**:
The calendar date a Session is for — typically the day of the school test or homework it prepares for. Optional: set when the session is created, and changeable whenever it is edited, since tests move. The Practice screen's "This week" shows the session with the nearest future due date; a session without one never appears there. Unrelated to whether its words need review — moving a due date never changes review state.
_Avoid_: Deadline, test date (the session may not be for a test)

**Pinned**:
A session the parent has marked to keep close at hand. Pinned sessions are listed first in the Library and also appear on the Practice screen, regardless of due date or whether their words need review. A session that is both pinned and the nearest due appears once, under "This week". Pinning and unpinning work the same from either screen.
_Avoid_: Favourite, starred, bookmarked

**Full Review**:
A session that pulls every word in the relevant list, rather than only the words that need review. Exists for comprehensive practice ahead of a school test, when the parent doesn't trust that "needs review" has caught everything. Its grades update review state like any other. Surfaced in the UI as **Revise all**.
_Avoid_: Cram mode (Anki's analogous mode explicitly discards its results; this one doesn't), review all

### Deferred

Designed but not being built yet. Kept here because the decisions were made deliberately, not because the terms are in use. The mastery composites are here for a different reason than Speaking: the drills that feed them are being built and do record grades — it is the scoring on top that is parked.

**Speaking** (Session Type):
A session type in which the app and the user hold a multi-turn spoken conversation grounded in the current Lesson's topic and reading list. Turn-based and multi-card rather than a per-word drill, so it has no Session Views and never appears as a stage inside a Spelling or Reading session. Deferred as an epic; not offered in the session-creation flow. See [ADR-0007](docs/adr/0007-practice-talk-session-mode.md), which calls it Practice Talk throughout.
_Avoid_: Practice Talk (the earlier name — Speaking session and Practice Talk were two names for one thing, since the type has exactly one drill), conversation mode, chat mode

**Speaking** (mastery composite):
A per-Lesson (not per-card) conversational-fluency score produced by Speaking sessions. Deferred with them — nothing else produces it.

**Reading** (mastery composite):
A per-card mastery score blended from three sub-signals — recognition (identify on sight), pronunciation (say it correctly), comprehension (know what it means) — each updated only by whichever drill actually tested it. Parked, not reversed: nothing blends the sub-signals, nothing decays, and no score is computed or stored. Until then Read Mode's grade is **pronunciation only** — "I've got this" means the learner said the word correctly, self-reported until Read Aloud exists — recorded as the session's result and as history a later composite can consume. Recognition and comprehension have nothing producing them.
_Avoid_: Reading mastery, reading score (ambiguous with Read Mode)

**Writing** (mastery composite):
A per-card mastery score for producing a word in writing, fed by Offline Grading until handwriting recognition exists. Parked alongside the Reading composite: Offline Grading still records the parent's right/wrong per word, but nothing computes a score from it.
_Avoid_: Writing mastery, spelling score

**Insight Notes**:
Cross-cutting patterns surfaced from a Speaking session's transcript that a single card's grade can't capture (e.g. "consistently confuses X and Y"). Deferred with Speaking sessions.

**Candidate Vocabulary / Bonus Word**:
A word noticed in a Speaking session that isn't yet in the Lesson's reading list, surfaced for the parent to approve. Deferred with Speaking sessions.

### Workspaces

**Workspace**:
The operating context for learning one Subject — the sessions page and everything reached from it. Today there are two: Chinese and English.
_Avoid_: Space, page

**Subject**:
What the user is learning in a Workspace — the dimension workspaces are defined by. Every Session belongs to exactly one Subject, though its words may include another language's content.
_Avoid_: Language (as the dimension name)

**Lesson**:
The structured catalog a session's tag resolves to — the app's model of a real school unit/week's worth of syllabus content (e.g. "Unit 3: Going to the Market"). Created implicitly the first time a session is tagged with a new name, same authoring flow as tagging today, rather than through a separate management screen. Carries a writing (spelling) list and a reading list as independently-captured content — not the same set of words, since they typically come from different worksheets — plus a parent-written topic/theme description. A Session belongs to exactly one Lesson; a Refresher, which draws across Lessons, belongs to none.
_Avoid_: Unit, tag (a Lesson is the structured entity a tag now resolves to, not a loose label)

**Writing list / Reading list**:
A Lesson's two independently-captured word lists. The writing list is what a Spelling session draws from; the reading list is what a Reading session draws from. A word may appear in one, the other, or both — capturing it for one list does not add it to the other. Each is reviewed and confirmed separately at session-creation time; both lists can carry a meaning per word (a spelling word benefits from a meaning too, not just a reading one), captured the same way regardless of which list it's for.
_Avoid_: Card list, word bank (as if singular/shared across Session Types)
