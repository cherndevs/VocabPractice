# Read Mode grades on four points, gated by an in-browser Read Aloud check

Read Mode's two buttons ("Oops" / "I've got this") become four — **Oops · Hard · OK · Easy**, mapping onto FSRS's Again/Hard/Good/Easy — and the three positive grades stay locked until **Read Aloud** has heard the learner say the word correctly. "Oops" is always available. A Peek, or a third failed Read Aloud attempt (which reveals the Pinyin Annotation, as a Peek would), locks the positive grades for that word for good: having seen the answer, the only honest grade left is "Oops".

This reverses the two-point reduction. ADR-0007 specified the full four-point AHGE scale; the glossary then narrowed the shipped UI to two buttons on the grounds that a young child can't tell Hard from Easy reliably. It is reversed on the owner's judgment that the learner can be taught what each grade means, and because the gate changes what is being judged: the app has already confirmed the word was read correctly, so the child is no longer self-reporting *whether* they knew it, only *how hard it felt*. Write Mode keeps two buttons. Offline Grading is a parent marking paper after the fact, which shows right or wrong but not how hard recall felt, so finer grades there would be guesses.

## How Read Aloud checks a word

Recognition runs in the browser through the Web Speech API (`webkitSpeechRecognition` on Safari/iOS, supported since 14.1). It returns a transcript, not a pronunciation score, so the check is built from that:

- **Chinese**: the same characters as the target pass outright. Otherwise both sides are converted to pinyin with `pinyin-pro` (ADR-0001) and compared **with tones**. The target is converted as a whole word, which resolves characters with more than one reading from context (长城 *cháng*, 长大 *zhǎng*) and is exactly what Peek shows. The heard transcript is allowed any reading of each character, since the app's guess at which characters were meant is the unreliable part. A homophone (弯曲 heard as 湾区, both *wān qū*) therefore passes, and a wrong tone that the recogniser writes as a different word fails.
- **English**: passes if any of the recogniser's top alternatives matches the word, ignoring case and punctuation, so *two/too/to* don't false-fail.

Three attempts per word. Silence and unheard attempts don't count. Audio is never stored by the app; the first use shows a notice that the browser may send it to its recognition service (on Safari, possibly Apple; iOS may instead recognise on the device). If recognition can't run at all — API missing, microphone denied, network error, language unsupported — the session falls back to plain self-report rather than locking grading. Safari offers no way to ask in advance whether a language is supported, so this is detected by trying.

## Considered Options

- **Azure Pronunciation Assessment** — scores audio against the known word down to the phoneme and is GA for zh-CN. Rejected: paid per request, needs a server-side key, sends a child's voice to a further third party, and contradicts the no-backend-spend constraint behind ADR-0001. The tone-aware pinyin match recovers most of what it would add for single words.
- **Transcript text match alone** — rejected: an isolated two-character Chinese word is frequently transcribed as a homophone, so correct readings would fail often enough to teach the child the microphone is broken.
- **Ship the gate only once Read Aloud exists, self-report until then** — superseded by building Read Aloud now.

## Consequences

- ADR-0008's "Read Aloud: designed, not wired" no longer holds; Read Aloud is wired, and its result gates grading rather than producing a separate pronunciation sub-signal (the composites stay parked, ADR-0007).
- Known gap: `pinyin-pro`'s word dictionary is occasionally wrong (it reads 长成 as *cháng chéng* instead of *zhǎng chéng*). The same-characters rule covers the common case, but Peek would show the wrong reading for such a word. No parent override for now; revisit if it bites.
- Untested on device: microphone access from a home-screen PWA on iOS has been unreliable historically. Must be checked in Safari and launched from the home screen before relying on it.
