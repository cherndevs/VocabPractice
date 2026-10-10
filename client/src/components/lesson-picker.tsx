import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { Lesson, LessonSummary, Subject } from "@shared/schema";

interface LessonPickerProps {
  subject: Subject;
  /** The chosen Lesson's name, or null for none. */
  value: string | null;
  /** The chosen Lesson's Year, or null for none. */
  year: string | null;
  onChange: (name: string | null, year: string | null) => void;
  /**
   * The Lesson the session is already tagged with, on the edit page. Its Year
   * can be changed here, which moves the whole Lesson; any other saved
   * Lesson's Year is fixed.
   */
  currentLesson?: LessonSummary | null;
}

const chipClass = (selected: boolean) =>
  `h-9 rounded-full border-[1.5px] px-3.5 ${
    selected ? "border-primary bg-primary-tint text-primary hover:bg-primary-tint hover:text-primary" : ""
  }`;

// Optional grouping for a session: pick one of the Subject's Lessons, tap it
// again to clear, or "+ New" to type a name. A new name becomes a Lesson when
// the session is saved; there is no other way to create one. A new Lesson can
// be given a Year (ADR-0012), chosen from the Years in use or typed.
export function LessonPicker({ subject, value, year, onChange, currentLesson }: LessonPickerProps) {
  const [newOpen, setNewOpen] = useState(false);
  const [draft, setDraft] = useState("");
  const [newYearOpen, setNewYearOpen] = useState(false);
  const [yearDraft, setYearDraft] = useState("");
  const { data: lessons = [] } = useQuery<Lesson[]>({
    queryKey: ["/api/lessons", { subject }],
    queryFn: async () => {
      const response = await fetch(`/api/lessons?subject=${subject}`);
      if (!response.ok) throw new Error("Failed to fetch lessons");
      return response.json();
    },
  });

  // A Lesson is its name within its Year.
  type Choice = { name: string; year: string | null };
  const same = (a: Choice, b: Choice) => a.name === b.name && a.year === b.year;
  // Ordered as in the Library: by Year (none last), then creation.
  const saved: Choice[] = [...lessons]
    .sort(
      (a, b) =>
        (a.year === null ? 1 : 0) - (b.year === null ? 1 : 0) ||
        (a.year ?? "").localeCompare(b.year ?? "", undefined, { numeric: true }) ||
        new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
    )
    .map((l) => ({ name: l.name, year: l.year }));
  const chosen: Choice | null = value ? { name: value, year } : null;
  // Still the current Lesson, possibly with an edited Year, unless the edited
  // Year names another saved Lesson: then that one is simply picked instead.
  const isCurrent =
    !!chosen &&
    !!currentLesson &&
    chosen.name === currentLesson.name &&
    (chosen.year === currentLesson.year || !saved.some((c) => same(c, chosen)));
  // A typed name that isn't saved yet still shows as a chip, so it can be undone.
  // So does the current Lesson while its Year is being changed.
  const chips = chosen && !saved.some((c) => same(c, chosen)) && !isCurrent ? [...saved, chosen] : saved;
  const isNew = !!chosen && !saved.some((c) => same(c, chosen)) && !isCurrent;
  const showYear = isNew || isCurrent;

  const years = Array.from(new Set([...lessons.map((l) => l.year), year].filter((y): y is string => !!y))).sort((a, b) =>
    a.localeCompare(b, undefined, { numeric: true }),
  );

  const addNew = () => {
    const name = draft.trim();
    if (!name) return;
    onChange(name, year);
    setDraft("");
    setNewOpen(false);
  };

  const addYear = () => {
    const next = yearDraft.trim();
    if (!next || !value) return;
    onChange(value, next);
    setYearDraft("");
    setNewYearOpen(false);
  };

  return (
    <div data-testid="lesson-picker">
      <div className="mb-2 text-xs font-semibold text-muted-foreground">Group with other sessions? (optional)</div>
      <div className="flex flex-wrap gap-2">
        {chips.map((chip) => {
          // The current Lesson keeps its chip lit while its Year is edited.
          const selected = !!chosen && (same(chip, chosen) || (isCurrent && chip.name === currentLesson!.name && chip.year === currentLesson!.year));
          const label = chip.year ? `${chip.name} · ${chip.year}` : chip.name;
          return (
            <Button
              key={`${chip.year ?? ""}|${chip.name}`}
              type="button"
              size="sm"
              variant="outline"
              className={chipClass(selected)}
              aria-pressed={selected}
              onClick={() => onChange(selected ? null : chip.name, selected ? null : chip.year)}
              data-testid={`chip-lesson-${label}`}
            >
              {label}
            </Button>
          );
        })}
        <Button
          type="button"
          size="sm"
          variant="outline"
          className="h-9 rounded-full border-[1.5px] border-dashed px-3.5 text-muted-foreground"
          onClick={() => setNewOpen((open) => !open)}
          data-testid="chip-lesson-new"
        >
          + New
        </Button>
      </div>
      {newOpen && (
        <div className="mt-2.5 flex gap-2">
          <Input
            autoFocus
            value={draft}
            placeholder="e.g. Unit 3"
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                addNew();
              }
            }}
            data-testid="input-new-lesson"
          />
          <Button type="button" onClick={addNew} disabled={!draft.trim()} data-testid="button-add-lesson">
            Add
          </Button>
        </div>
      )}
      {showYear && value && (
        <div className="mt-3" data-testid="lesson-year-picker">
          <div className="mb-2 text-xs font-semibold text-muted-foreground">Year (optional)</div>
          <div className="flex flex-wrap gap-2">
            {years.map((y) => {
              const selected = y === year;
              return (
                <Button
                  key={y}
                  type="button"
                  size="sm"
                  variant="outline"
                  className={chipClass(selected)}
                  aria-pressed={selected}
                  onClick={() => onChange(value, selected ? null : y)}
                  data-testid={`chip-year-${y}`}
                >
                  {y}
                </Button>
              );
            })}
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="h-9 rounded-full border-[1.5px] border-dashed px-3.5 text-muted-foreground"
              onClick={() => setNewYearOpen((open) => !open)}
              data-testid="chip-year-new"
            >
              + New
            </Button>
          </div>
          {newYearOpen && (
            <div className="mt-2.5 flex gap-2">
              <Input
                autoFocus
                value={yearDraft}
                placeholder="e.g. P1"
                onChange={(e) => setYearDraft(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    addYear();
                  }
                }}
                data-testid="input-new-year"
              />
              <Button type="button" onClick={addYear} disabled={!yearDraft.trim()} data-testid="button-add-year">
                Add
              </Button>
            </div>
          )}
          {isCurrent && (
            <p className="mt-2 text-xs text-muted-foreground" data-testid="text-year-applies-to-lesson">
              Changing the Year moves every session in this lesson.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
