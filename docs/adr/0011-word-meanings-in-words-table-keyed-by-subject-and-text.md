# Word meanings live in a `words` table keyed by subject and text

A word's **Meaning** (CHE-32) is stored in a new `words` table with one row per (subject, word), the same key `review_states` uses. Nothing references it by foreign key: sessions keep their `words: string[]`, and review states keep keying on text. Both join to `words` on (subject, word).

There's no single place a word lives today. A session holds plain strings, and FSRS (ADR-0010) treats (subject, text) as the word's identity. Hanging the meaning off that same identity keeps one meaning per word, matching the one review state per word per skill, so an edit fixes the meaning in every list. It also gives later per-word data a home.

Meanings come from one text-only OpenRouter call made when a lesson is saved, to `qwen/qwen3-30b-a3b-instruct-2507`, pinned by exact ID. The call gets the whole list as context and asks only for words that don't have a row yet. If it fails, the save still goes through, and a Library "Fill missing meanings" action retries. Rows a parent has edited are never overwritten.

## Considered Options

- **A `meanings` map on each session.** No new table, but the same word could end up with one review state and several different meanings, and an edit would only fix one list.
- **A full words table with surrogate ids** (a `session_words` join table, with `review_states` and `grade_log` repointed at `word_id`). This has real foreign keys, and correcting a typo would keep a word's history. But it needs a data migration on Neon and touches every session read and the FSRS code, which is too much to bundle into a feature. Deferred to CHE-56. Moving from the natural key to surrogate ids later is a mechanical migration.
- **Glossing during extraction.** No extra call, but it would complicate the carefully tuned extraction prompt (ADR-0004) and pay for words that get edited or deleted during review.
- **Paying only on cache hits across lists.** Rejected as a goal: almost no words repeat across lists. The shared key is chosen for consistency with FSRS, not for savings.
