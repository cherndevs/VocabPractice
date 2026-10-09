import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import type { useMeaningDrafts } from "@/hooks/use-meanings";

// A word's Meaning under its row on the create and edit pages. Typing in it
// is a parent's edit: it is saved with the list and never regenerated.
export function MeaningField({ value, onChange, testId }: { value: string; onChange: (meaning: string) => void; testId: string }) {
  return (
    <Input
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="mt-1 ml-9 w-[calc(100%-2.25rem)] h-8 bg-transparent border-none text-sm text-muted-foreground"
      placeholder="Meaning…"
      aria-label="Meaning"
      data-testid={testId}
    />
  );
}

/**
 * Previews the list's missing Meanings. Shown only while some words lack one:
 * an extracted list fills itself on arrival, so this is for words typed in.
 */
export function FillMeaningsButton({ drafts, words }: { drafts: ReturnType<typeof useMeaningDrafts>; words: string[] }) {
  const { toast } = useToast();
  const missing = drafts.missingCount(words);
  if (missing === 0) return null;
  const fill = () =>
    drafts.fill(words).catch(() => toast({ title: "Couldn't fill meanings", description: "Try again later.", variant: "destructive" }));
  return (
    <Button variant="outline" onClick={fill} disabled={drafts.filling} className="w-full mb-4" data-testid="button-fill-meanings">
      {drafts.filling ? "Filling meanings…" : `Fill ${missing} missing meaning${missing === 1 ? "" : "s"}`}
    </Button>
  );
}
