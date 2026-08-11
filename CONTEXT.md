# Spelling Pro

A mobile-first spelling practice app: users capture spelling worksheets via camera/OCR, then work through the extracted words in a practice session.

## Language

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
