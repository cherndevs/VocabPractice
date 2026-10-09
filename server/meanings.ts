import { MEANING_SUBJECTS, type MeaningEntry, type Subject } from "@shared/schema";
import type { IStorage } from "./storage";

// Meanings (CONTEXT.md, ADR-0011): a child-level English rendering of each
// list item. Generated while a list is reviewed (one cheap text-only call),
// shown for checking, and stored when the list is saved.

/** Word → Meaning. */
export type Meanings = Record<string, string>;

/** What the AI call is asked: the whole list and its Lesson's topic as context, and the items needing a meaning. */
export type MeaningRequest = { items: string[]; missing: string[]; topic: string | null };

/**
 * The AI call: returns a meaning per missing item. Injected so tests never
 * reach the network.
 */
export type GenerateMeanings = (request: MeaningRequest) => Promise<Meanings>;

/** The words of a list as stored and keyed: trimmed, blanks dropped, each once. */
export const normalizeWords = (words: string[]) => Array.from(new Set(words.map((w) => w.trim()).filter(Boolean)));

/**
 * The Meanings shown while a list is reviewed, before it is saved: stored
 * meanings where they exist, the rest from one AI call. Stores nothing; the
 * save does. Throws if the AI call fails.
 */
export async function previewMeanings(
  storage: IStorage,
  generate: GenerateMeanings,
  subject: Subject,
  list: string[],
  topic: string | null,
  /** The words the caller still needs; the rest are context only. Defaults to the whole list. */
  needed: string[] = list,
): Promise<Meanings> {
  if (!MEANING_SUBJECTS.includes(subject)) return {};
  const items = normalizeWords(list);
  const wantedNow = new Set(normalizeWords(needed));
  const rows = await storage.getWords(subject, items);
  // A row with no meaning is a parent's clear, which is never regenerated.
  const known = new Set(rows.map((r) => r.word));
  const missing = items.filter((w) => wantedNow.has(w) && !known.has(w));
  const stored = Object.fromEntries(rows.flatMap((r) => (r.meaning ? [[r.word, r.meaning]] : [])));
  if (missing.length === 0) return stored;

  const generated = await generate({ items, missing, topic });
  const wanted = new Set(missing);
  return {
    ...stored,
    ...Object.fromEntries(
      Object.entries(generated)
        .map(([word, meaning]) => [word.trim(), typeof meaning === "string" ? meaning.trim() : ""] as const)
        .filter(([word, meaning]) => wanted.has(word) && meaning),
    ),
  };
}

/**
 * Stores the Meanings sent with a saved list, for words in that list only. An
 * unedited (previewed) meaning never replaces a stored one; an edit always does.
 */
export async function saveMeanings(storage: IStorage, subject: Subject, list: string[], entries: MeaningEntry[]) {
  if (!MEANING_SUBJECTS.includes(subject)) return;
  const inList = new Set(normalizeWords(list));
  const generated: Meanings = {};
  for (const { word, meaning, edited } of entries) {
    const key = word.trim();
    if (!inList.has(key)) continue;
    if (edited) await storage.setEditedMeaning(subject, key, meaning.trim() || null);
    else if (meaning.trim()) generated[key] = meaning.trim();
  }
  await storage.addGeneratedMeanings(subject, generated);
}

// Text-only, no thinking step, strong at Chinese (chosen in CHE-32). Pin the
// exact id: a floating alias could change the output under us.
const MODEL = "qwen/qwen3-30b-a3b-instruct-2507";
const ENDPOINT = "https://openrouter.ai/api/v1/chat/completions";

const PROMPT = `You help a young child learning to read Chinese understand a school word list.

You get the whole list (and its topic, if known) as context, and the items that need a meaning. For each item that needs a meaning, write it in simple English a 7-year-old understands:
- a word or phrase: its plain English equivalent, not a definition (e.g. 长城 → "the Great Wall", 蝴蝶 → "butterfly", 游泳 → "to swim"). If it has several senses, give the one that fits this list. Explain only when no simple English word exists (e.g. 冲凉 → "to take a shower").
- a sentence: a natural, full English translation.

Reply with JSON only: {"meanings": {"<item exactly as given>": "<meaning>"}}`;

/** The real GenerateMeanings, over OpenRouter. */
export const generateMeaningsWithOpenRouter: GenerateMeanings = async ({ items, missing, topic }) => {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) throw new Error("OPENROUTER_API_KEY is not set");

  const res = await fetch(ENDPOINT, {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: MODEL,
      temperature: 0,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: PROMPT },
        { role: "user", content: JSON.stringify({ topic, list: items, needMeaning: missing }) },
      ],
    }),
  });
  if (!res.ok) throw new Error(`OpenRouter returned ${res.status}: ${await res.text()}`);

  const content = (await res.json()).choices?.[0]?.message?.content;
  if (typeof content !== "string") throw new Error("OpenRouter returned no content");
  const meanings = JSON.parse(content).meanings;
  if (!meanings || typeof meanings !== "object") throw new Error("OpenRouter returned no meanings");
  return meanings;
};
