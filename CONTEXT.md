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
The Session View where a word is played aloud (dictation), hidden from view, and the user writes it down off-app. Repeats the word per the configured repetition count. The word stays hidden throughout — the writing happens on paper, not on screen. Grading is a separate step afterwards (see Offline Grading).
_Avoid_: Test, test mode

**Read Mode**:
The Session View where the word is displayed on screen for the user to read aloud, with no pinyin, no audio playback, and no repetition — a recall test. Session-scoped mastery marking ("I've Got This") happens here.
_Avoid_: Practice, practice mode

**Read Aloud**:
The pronunciation check offered inside Read Mode: the user says the displayed word and the app assesses it, supplying the Reading composite's pronunciation sub-signal objectively instead of by self-report. Designed but not built — the app has no speech capture of any kind today, only text-to-speech.
_Avoid_: Speech recognition, voice check, pronunciation test

**Peek Mode**:
The Session View where the word is displayed alongside its Pinyin Annotation and an audio playback button, for checking a Read Mode guess. Has no "I've Got This" marking of its own — mastery is only ever recorded from Read Mode. Hidden from the tab bar whenever the current word has no Pinyin Annotation (e.g. an English word in a mixed-language session).
_Avoid_: Test, test mode, Check mode

**Pinyin Annotation**:
The auto-detected, auto-generated romanization line shown below a word in Peek Mode whenever the word contains Chinese characters. Computed at render time from the word's stored text — never typed in by the user or persisted.
_Avoid_: Translation, transliteration

**AHGE Grading**:
The self-report scale that replaces the old flat "I've Got This" flag with structured input to per-card mastery and interleaved queue construction. Implemented as a 2-point scale — "Oops" / "I've got this" (Again/Good under the hood, the FSRS-compatible reduction of the full 4-point Again/Hard/Good/Easy scale) — rather than 4 buttons, since the Hard/Easy distinction isn't a reliable self-judgment for young children and a noisy 4-point signal isn't actually richer than a clean 2-point one. The "I've got this" copy deliberately echoes the original mastery-marking phrase — same words, now backed by decay math instead of a flat flag. Read Mode uses it as self-report by the learner. Write Mode uses the same two buttons, but as Offline Grading — a parent marking work the app can't see — not self-report.
_Avoid_: Grade, rating, difficulty rating, Again/Hard/Good/Easy (as the shipped UI — that's the underlying algorithm's full scale, not what the user sees)

**Offline Grading**:
A parent marking a Spelling session's words right or wrong against what the child wrote on paper, using the same two AHGE buttons. It exists because the app has no handwriting recognition and would otherwise record nothing at all for Writing. A deliberate proxy: the grade comes from a person, not from the app checking the work, and is stored indistinguishably from any future recognition-derived grade.
_Avoid_: Marking, self-grading (the learner isn't the one grading), parent review

**Full Review**:
A session that pulls every card in the relevant list regardless of due status, rather than only the cards the decay model considers due. Exists for comprehensive practice ahead of a school test, when the parent doesn't trust that the due filter has caught everything. Its grades feed the mastery model normally. Surfaced in the UI as **Revise all**.
_Avoid_: Cram mode (Anki's analogous mode explicitly discards its results; this one doesn't), review all

**Reading** (mastery composite):
A per-card mastery score blended from three sub-signals — recognition (identify on sight), pronunciation (say it correctly), comprehension (know what it means) — each updated only by whichever drill actually tested it. Read Mode currently updates recognition and pronunciation — both by self-report, until Read Aloud exists — and never comprehension.
_Avoid_: Reading mastery, reading score (ambiguous with Read Mode)

**Writing** (mastery composite):
A per-card mastery score for producing a word in writing, fed by Offline Grading until handwriting recognition exists.
_Avoid_: Writing mastery, spelling score

### Deferred

Designed but not being built yet. Kept here because the decisions were made deliberately, not because the terms are in use.

**Speaking** (Session Type):
A session type in which the app and the user hold a multi-turn spoken conversation grounded in the current Lesson's topic and reading list. Turn-based and multi-card rather than a per-word drill, so it has no Session Views and never appears as a stage inside a Spelling or Reading session. Deferred as an epic; not offered in the session-creation flow. See [ADR-0007](docs/adr/0007-practice-talk-session-mode.md), which calls it Practice Talk throughout.
_Avoid_: Practice Talk (the earlier name — Speaking session and Practice Talk were two names for one thing, since the type has exactly one drill), conversation mode, chat mode

**Speaking** (mastery composite):
A per-Lesson (not per-card) conversational-fluency score produced by Speaking sessions. Deferred with them — nothing else produces it.

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
The structured catalog a session's tag resolves to — the app's model of a real school unit/week's worth of syllabus content (e.g. "Unit 3: Going to the Market"). Created implicitly the first time a session is tagged with a new name, same authoring flow as tagging today, rather than through a separate management screen. Carries a writing (spelling) list and a reading list as independently-captured content — not the same set of words, since they typically come from different worksheets — plus a parent-written topic/theme description.
_Avoid_: Unit, tag (a Lesson is the structured entity a tag now resolves to, not a loose label)

**Writing list / Reading list**:
A Lesson's two independently-captured word lists. The writing list is what a Spelling session draws from; the reading list is what a Reading session draws from. A word may appear in one, the other, or both — capturing it for one list does not add it to the other. Each is reviewed and confirmed separately at session-creation time; both lists can carry a meaning per word (a spelling word benefits from a meaning too, not just a reading one), captured the same way regardless of which list it's for.
_Avoid_: Card list, word bank (as if singular/shared across Session Types)
