# Spelling Pro

A mobile-first spelling practice app: users capture spelling worksheets via camera/OCR, then work through the extracted words in a practice session.

## Language

### Sessions

**Write Mode**:
The session mode where a word is played aloud (dictation), hidden from view, and the user writes it down off-app. Repeats the word per the configured repetition count.
_Avoid_: Test, test mode

**Read Mode**:
The session mode where the word is displayed on screen for the user to read aloud, with no pinyin, no audio playback, and no repetition — a recall test. Session-scoped mastery marking ("I've Got This") happens here.
_Avoid_: Practice, practice mode

**Peek Mode**:
The session mode where the word is displayed alongside its Pinyin Annotation and an audio playback button, for checking a Read Mode guess. Has no "I've Got This" marking of its own — mastery is only ever recorded from Read Mode. Hidden from the tab bar whenever the current word has no Pinyin Annotation (e.g. an English word in a mixed-language session).
_Avoid_: Test, test mode, Check mode

**Pinyin Annotation**:
The auto-detected, auto-generated romanization line shown below a word in Peek Mode whenever the word contains Chinese characters. Computed at render time from the word's stored text — never typed in by the user or persisted.
_Avoid_: Translation, transliteration

**Practice Talk**:
A session mode where the app and the user hold a multi-turn spoken conversation grounded in the current Lesson's topic and reading list. Coexists with Write Mode and Read Mode rather than replacing them. Ends on an AI-inferred natural stopping point, a turn cap, or coverage of due cards (exact coverage definition not yet settled). Produces no live "I've Got This"-style marking; instead a post-session pass classifies each touched card's evidence into Again/Hard/Good/Easy (see AHGE Grading), plus two additional outputs: persisted Insight Notes and Candidate Vocabulary. See [ADR-0007](docs/adr/0007-practice-talk-session-mode.md).
_Avoid_: Speaking session, conversation mode, chat mode

**AHGE Grading**:
The self-report scale that replaces the old flat "I've Got This" flag with structured input to per-card mastery and interleaved queue construction. Implemented as a 2-point scale — "Oops" / "I've got this" (Again/Good under the hood, the FSRS-compatible reduction of the full 4-point Again/Hard/Good/Easy scale) — rather than 4 buttons, since the Hard/Easy distinction isn't a reliable self-judgment for young children and a noisy 4-point signal isn't actually richer than a clean 2-point one. The "I've got this" copy deliberately echoes the original mastery-marking phrase — same words, now backed by decay math instead of a flat flag. Read Mode and Practice Talk use it (no objective correctness signal exists for either); Write Mode does not, since it has an objective correctness signal in principle, even though that signal isn't computed today (see Write Mode).
_Avoid_: Grade, rating, difficulty rating, Again/Hard/Good/Easy (as the shipped UI — that's the underlying algorithm's full scale, not what the user sees)

**Reading** (mastery composite):
A per-card mastery score blended from three sub-signals — recognition (identify on sight), pronunciation (say it correctly), comprehension (know what it means) — each updated only by whichever mode actually tested it. Read Mode currently updates recognition and pronunciation, not comprehension.
_Avoid_: Reading mastery, reading score (ambiguous with Read Mode)

**Speaking** (mastery composite):
A per-Lesson (not per-card) conversational-fluency score produced by Practice Talk sessions, tracked separately from any card's Reading or Writing mastery.
_Avoid_: Speaking mastery, speaking score

**Insight Notes**:
Cross-cutting patterns surfaced from a Practice Talk transcript that a single card's AHGE grade can't capture (e.g. "consistently confuses X and Y"). Persisted per card/Lesson rather than shown once and discarded.

**Candidate Vocabulary / Bonus Word**:
A word noticed in a Practice Talk conversation that isn't yet in the Lesson's reading list, surfaced for the parent to approve — never auto-added. Once approved it joins the current Lesson's reading list by default and is tagged as a **Bonus Word**, distinguishing it from syllabus-sourced cards.
_Avoid_: Suggested word, auto-added word

### Workspaces

**Workspace**:
The operating context for learning one Subject — the sessions page and everything reached from it. Today there are two: Chinese and English.
_Avoid_: Space, page

**Subject**:
What the user is learning in a Workspace — the dimension workspaces are defined by. Every Session belongs to exactly one Subject, though its words may include another language's content.
_Avoid_: Language (as the dimension name)

**Lesson**:
The structured catalog a session's tag resolves to — the app's model of a real school unit/week's worth of syllabus content (e.g. "Unit 3: Going to the Market"). Created implicitly the first time a session is tagged with a new name, same authoring flow as tagging today, rather than through a separate management screen. Carries a writing (spelling) list and a reading list as independently-captured content — not the same set of words, since they typically come from different worksheets — plus a parent-written topic/theme description, which grounds Practice Talk's conversation.
_Avoid_: Unit, tag (a Lesson is the structured entity a tag now resolves to, not a loose label)

**Writing list / Reading list**:
A Lesson's two independently-captured word lists. The writing list feeds Write Mode (spelling/dictation); the reading list feeds Read Mode and grounds Practice Talk. A word may appear in one, the other, or both — capturing it for one list does not add it to the other. Each is reviewed and confirmed separately at session-creation time; both lists can carry a meaning per word (a spelling word benefits from a meaning too, not just a reading one), captured the same way regardless of which list it's for.
_Avoid_: Card list, word bank (as if singular/shared across modes)
