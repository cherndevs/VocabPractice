import { getPinyinAnnotation } from "@/lib/pinyin";

interface MarkingWordProps {
  word: string;
  index: number;
  onHear: () => void;
}

// The word on a Mark the writing row: tap to hear it, with its Pinyin
// Annotation underneath when it has Chinese characters.
export function MarkingWord({ word, index, onHear }: MarkingWordProps) {
  const pinyin = getPinyinAnnotation(word);

  return (
    <button
      type="button"
      className="min-w-0 flex-1 text-left"
      onClick={onHear}
      aria-label={`Hear ${word}`}
      data-testid={`button-hear-word-${index}`}
    >
      <span className="block text-xl font-bold text-foreground">{word}</span>
      {pinyin && (
        <span className="block text-[13px] font-normal text-muted-foreground" data-testid={`text-marking-pinyin-${index}`}>
          {pinyin}
        </span>
      )}
    </button>
  );
}
