# Use pinyin-pro for client-side pinyin generation

We need to display pinyin below Chinese words in Read Mode, generated automatically rather than typed in. The app has no per-word language metadata and the owner explicitly doesn't want to pay for backend compute (CHE-14), so this rules out a server-side NLP service or translation API — the conversion has to run entirely in the browser, on demand, from the word's raw text.

We chose `pinyin-pro`: it's pure JS/TS, bundles its own character dictionary (no network calls), and does dictionary-based word segmentation, which matters because naive character-by-character lookup gets multi-character words with contextual readings wrong (e.g. 银行 vs 校长). The trade-off is a self-contained but fixed dictionary shipped in the client bundle — completeness for rare/uncommon characters depends entirely on this library's coverage, with no fallback service to fill gaps. We're surfacing dictionary gaps to the user (a visible placeholder marker for unresolved characters, rather than silently passing the character through) specifically so this limitation stays visible instead of hiding as silently-wrong output.

## Considered Options

- **Server-side NLP/translation API** (e.g. Google Cloud Translation, Baidu NLP) — rejected: introduces per-request backend cost, directly against the "no backend spend" constraint.
- **A smaller pinyin table with no segmentation** — rejected: correct multi-character pronunciation needs word-boundary-aware lookup, not just a character-to-syllable map.
