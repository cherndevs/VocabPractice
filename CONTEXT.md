# Spelling Pro

A mobile-first spelling practice app: users capture spelling worksheets via camera/OCR, then work through the extracted words in a practice session.

## Language

**Write Mode**:
The session mode where a word is played aloud (dictation), hidden from view, and the user writes it down off-app. Repeats the word per the configured repetition count.
_Avoid_: Test, test mode

**Read Mode**:
The session mode where the word is displayed on screen for the user to read, with an optional audio playback and no repetition. Currently a static display; not yet an interactive reading exercise.
_Avoid_: Practice, practice mode

**Pinyin Annotation**:
The auto-detected, auto-generated romanization line shown below a word in Read Mode whenever the word contains Chinese characters. Computed at render time from the word's stored text — never typed in by the user or persisted.
_Avoid_: Translation, transliteration
