import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import type { Subject } from "@shared/schema";
import { apiRequest } from "@/lib/queryClient";

// Meanings (CONTEXT.md, ADR-0011): {word: meaning} for the words that have
// one. Generated in the background after a save, so a fresh list may come
// back partly empty; words without a meaning simply show none.
export function useMeanings(subject: Subject | undefined, words: string[]): Record<string, string> {
  // Trimmed, deduplicated and sorted, so the query key is stable.
  const wordKeys = Array.from(new Set(words.map((w) => w.trim()).filter(Boolean))).sort();
  const { data } = useQuery<Record<string, string>>({
    queryKey: ["/api/meanings", subject, wordKeys],
    queryFn: async () => {
      const params = new URLSearchParams({ subject: subject! });
      for (const word of wordKeys) params.append("word", word);
      const res = await fetch(`/api/meanings?${params}`);
      if (!res.ok) throw new Error("Failed to fetch meanings");
      return res.json();
    },
    enabled: !!subject && wordKeys.length > 0,
  });
  return data ?? {};
}

/** The meaning for a word as shown, or undefined. */
export const meaningOf = (meanings: Record<string, string>, word: string | undefined) =>
  word ? meanings[word.trim()] : undefined;

/** A Meaning on a list being reviewed, not yet saved. */
export type MeaningDraft = { meaning: string; edited: boolean };

const listOf = (words: string[]) => Array.from(new Set(words.map((w) => w.trim()).filter(Boolean)));

/**
 * The Meanings of a list while it is created or edited. fill() previews the
 * missing ones (stored where they exist, otherwise one AI call); edit() is a
 * parent's change. Nothing is stored until the list is saved with entries().
 */
export function useMeaningDrafts(subject: Subject | undefined, lessonName: string | null) {
  const [drafts, setDrafts] = useState<Record<string, MeaningDraft>>({});
  // A word is missing a meaning unless it has one, or a parent cleared it on purpose.
  const isMissing = (word: string) => !drafts[word]?.meaning && !drafts[word]?.edited;

  const preview = useMutation({
    mutationFn: async (body: { words: string[]; missing: string[]; lesson: string | null }) =>
      (await apiRequest("POST", "/api/meanings/preview", { subject, words: body.words, missing: body.missing, lessonName: body.lesson })).json() as Promise<
        Record<string, string>
      >,
  });

  /**
   * Previews meanings for the words that lack one; resolves to how many were
   * added. lesson overrides the current tag, for a list just loaded into state.
   */
  const fill = async (words: string[], lesson: string | null = lessonName) => {
    const list = listOf(words);
    if (!subject || !list.some(isMissing)) return 0;
    // The whole list goes as context; only the missing words are generated.
    const found = await preview.mutateAsync({ words: list, missing: list.filter(isMissing), lesson });
    setDrafts((prev) => {
      const next = { ...prev };
      for (const word of list) {
        if (found[word] && !next[word]?.meaning && !next[word]?.edited) next[word] = { meaning: found[word], edited: false };
      }
      return next;
    });
    return list.filter((word) => found[word] && isMissing(word)).length;
  };

  /** Starts from a saved list's stored meanings, keeping anything already drafted. */
  const seed = (stored: Record<string, string>) =>
    setDrafts((prev) => ({
      ...Object.fromEntries(Object.entries(stored).map(([word, meaning]) => [word, { meaning, edited: false }])),
      ...prev,
    }));

  return {
    meaningOf: (word: string) => drafts[word.trim()]?.meaning ?? "",
    edit: (word: string, meaning: string) => setDrafts((prev) => ({ ...prev, [word.trim()]: { meaning, edited: true } })),
    missingCount: (words: string[]) => listOf(words).filter(isMissing).length,
    fill,
    filling: preview.isPending,
    seed,
    reset: () => setDrafts({}),
    /** What to send with the save: a meaning for each word in the list that has one. */
    entries: (words: string[]) => listOf(words).flatMap((word) => (drafts[word] ? [{ word, ...drafts[word] }] : [])),
  };
}
