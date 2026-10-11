import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Check, ChevronDown, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle } from "@/components/ui/drawer";
import { Input } from "@/components/ui/input";
import { compareLessonNames, lessonsMatchingTitle } from "@/lib/lesson-order";
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
  /** The session title, used to suggest a matching Lesson. */
  title?: string;
}

const chipClass = (selected: boolean) =>
  `h-9 rounded-full border-[1.5px] px-3.5 ${
    selected ? "border-primary bg-primary-tint text-primary hover:bg-primary-tint hover:text-primary" : ""
  }`;

// "P2" before "P10".
const yearOrder = (a: string, b: string) => a.localeCompare(b, undefined, { numeric: true });

// Optional grouping for a session. A single row opens a searchable sheet of the
// Subject's Lessons, by Year; typing a name nobody has used offers to create
// it. A new name becomes a Lesson when the session is saved; there is no other
// way to create one. A new Lesson can be given a Year (ADR-0012), chosen from
// the Years in use or typed.
export function LessonPicker({ subject, value, year, onChange, currentLesson, title = "" }: LessonPickerProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
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
  const label = (c: Choice) => (c.year ? `${c.name} · ${c.year}` : c.name);
  // Ordered as in the Library: by Year (none last), then creation, then lesson number.
  const saved: Choice[] = [...lessons]
    .sort(
      (a, b) =>
        (a.year === null ? 1 : 0) - (b.year === null ? 1 : 0) ||
        yearOrder(a.year ?? "", b.year ?? "") ||
        new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime() ||
        compareLessonNames(a.name, b.name),
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
  const isNew = !!chosen && !saved.some((c) => same(c, chosen)) && !isCurrent;
  const showYear = isNew || isCurrent;
  // A typed name that isn't saved yet still shows in the list, so it can be undone.
  const choices = isNew ? [...saved, chosen!] : saved;
  // The current Lesson stays ticked while its Year is edited.
  const isSelected = (c: Choice) =>
    !!chosen && (same(c, chosen) || (isCurrent && c.name === currentLesson!.name && c.year === currentLesson!.year));

  const matchingNames = lessonsMatchingTitle(title, Array.from(new Set(choices.map((c) => c.name))));
  const suggested = choices.filter((c) => matchingNames.includes(c.name));
  const typed = search.trim();
  const canCreate = typed !== "" && !choices.some((c) => c.name === typed && c.year === year);

  // Choices grouped under their Year, none last.
  const byYear = new Map<string | null, Choice[]>();
  for (const c of choices) byYear.set(c.year, [...(byYear.get(c.year) ?? []), c]);

  const years = Array.from(new Set([...lessons.map((l) => l.year), year].filter((y): y is string => !!y))).sort(yearOrder);

  const openSheet = (isOpen: boolean) => {
    setOpen(isOpen);
    if (!isOpen) setSearch("");
  };

  const choose = (c: Choice | null) => {
    onChange(c?.name ?? null, c?.year ?? null);
    openSheet(false);
  };

  const addYear = () => {
    const next = yearDraft.trim();
    if (!next || !value) return;
    onChange(value, next);
    setYearDraft("");
    setNewYearOpen(false);
  };

  const item = (c: Choice, group: string) => (
    <CommandItem
      key={`${group}|${c.year ?? ""}|${c.name}`}
      value={`${group} ${label(c)}`}
      keywords={[c.name]}
      onSelect={() => choose(c)}
      className="py-2.5"
      data-testid={`option-lesson-${label(c)}`}
    >
      <Check className={`mr-2 h-4 w-4 ${isSelected(c) ? "opacity-100" : "opacity-0"}`} />
      {group === "suggested" ? label(c) : c.name}
    </CommandItem>
  );

  return (
    <div data-testid="lesson-picker">
      <div className="mb-2 text-xs font-semibold text-muted-foreground">Group with other sessions? (optional)</div>
      <Button
        type="button"
        variant="outline"
        className="h-11 w-full justify-between font-normal"
        onClick={() => openSheet(true)}
        data-testid="button-lesson-picker"
      >
        <span className={`truncate ${chosen ? "" : "text-muted-foreground"}`}>{chosen ? label(chosen) : "No lesson"}</span>
        <ChevronDown className="h-4 w-4 shrink-0 opacity-60" />
      </Button>
      {!chosen && suggested.length === 1 && (
        <button
          type="button"
          className="mt-2 text-sm text-primary"
          onClick={() => onChange(suggested[0].name, suggested[0].year)}
          data-testid="button-use-suggested-lesson"
        >
          Use {label(suggested[0])}?
        </button>
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
              onClick={() => setNewYearOpen((o) => !o)}
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

      <Drawer open={open} onOpenChange={openSheet}>
        <DrawerContent className="max-h-[85vh]">
          <DrawerHeader className="pb-2 text-left">
            <DrawerTitle>Lesson</DrawerTitle>
          </DrawerHeader>
          <Command className="px-2 pb-4">
            <CommandInput
              placeholder="Search or type a new lesson"
              value={search}
              onValueChange={setSearch}
              data-testid="input-lesson-search"
            />
            <CommandList className="max-h-[60vh]">
              {!canCreate && <CommandEmpty>No lessons yet.</CommandEmpty>}
              {chosen && !typed && (
                <CommandGroup>
                  <CommandItem value="none" onSelect={() => choose(null)} className="py-2.5" data-testid="option-lesson-none">
                    <span className="ml-6 text-muted-foreground">No lesson</span>
                  </CommandItem>
                </CommandGroup>
              )}
              {suggested.length > 0 && (
                <CommandGroup heading="Matches the title">{suggested.map((c) => item(c, "suggested"))}</CommandGroup>
              )}
              {Array.from(byYear.entries()).map(([y, group]) => (
                <CommandGroup key={y ?? ""} heading={y ?? (byYear.size > 1 ? "No year" : "All lessons")}>
                  {group.map((c) => item(c, y ?? "none"))}
                </CommandGroup>
              ))}
              {canCreate && (
                <CommandGroup forceMount>
                  <CommandItem
                    forceMount
                    value={`create ${typed}`}
                    onSelect={() => choose({ name: typed, year })}
                    className="py-2.5"
                    data-testid="option-lesson-create"
                  >
                    <Plus className="mr-2 h-4 w-4" />
                    Create “{typed}”
                  </CommandItem>
                </CommandGroup>
              )}
            </CommandList>
          </Command>
        </DrawerContent>
      </Drawer>
    </div>
  );
}
