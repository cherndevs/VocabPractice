import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
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

function useRefreshMeanings() {
  const queryClient = useQueryClient();
  return () => queryClient.invalidateQueries({ queryKey: ["/api/meanings"] });
}

/** A parent's edit; blank clears it. Either way it is never regenerated. */
export function useEditMeaning(subject: Subject | undefined) {
  const refresh = useRefreshMeanings();
  return useMutation({
    mutationFn: ({ word, meaning }: { word: string; meaning: string }) =>
      apiRequest("PUT", "/api/meanings", { subject, word, meaning }),
    onSuccess: refresh,
  });
}

/** Retries one list's words that have no meaning yet. */
export function useFillMeanings(sessionId: string | undefined) {
  const refresh = useRefreshMeanings();
  return useMutation({
    mutationFn: async () => (await apiRequest("POST", `/api/sessions/${sessionId}/meanings/fill`)).json() as Promise<{ filled: number }>,
    onSuccess: refresh,
  });
}
