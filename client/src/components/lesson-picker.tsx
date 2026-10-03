import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { Lesson, Subject } from "@shared/schema";

interface LessonPickerProps {
  subject: Subject;
  /** The chosen Lesson's name, or null for none. */
  value: string | null;
  onChange: (name: string | null) => void;
}

// Optional grouping for a session: pick one of the Subject's Lessons, tap it
// again to clear, or "+ New" to type a name. A new name becomes a Lesson when
// the session is saved; there is no other way to create one.
export function LessonPicker({ subject, value, onChange }: LessonPickerProps) {
  const [newOpen, setNewOpen] = useState(false);
  const [draft, setDraft] = useState("");
  const { data: lessons = [] } = useQuery<Lesson[]>({
    queryKey: ["/api/lessons", { subject }],
    queryFn: async () => {
      const response = await fetch(`/api/lessons?subject=${subject}`);
      if (!response.ok) throw new Error("Failed to fetch lessons");
      return response.json();
    },
  });

  // A typed name that isn't saved yet still shows as a chip, so it can be undone.
  const names = lessons.map((l) => l.name);
  const chips = value && !names.includes(value) ? [...names, value] : names;

  const addNew = () => {
    const name = draft.trim();
    if (!name) return;
    onChange(name);
    setDraft("");
    setNewOpen(false);
  };

  return (
    <div data-testid="lesson-picker">
      <div className="mb-2 text-sm font-medium text-foreground">Group with other sessions? (optional)</div>
      <div className="flex flex-wrap gap-2">
        {chips.map((name) => {
          const selected = name === value;
          return (
            <Button
              key={name}
              type="button"
              size="sm"
              variant={selected ? "default" : "outline"}
              className="rounded-full"
              aria-pressed={selected}
              onClick={() => onChange(selected ? null : name)}
              data-testid={`chip-lesson-${name}`}
            >
              {name}
            </Button>
          );
        })}
        <Button
          type="button"
          size="sm"
          variant="outline"
          className="rounded-full border-dashed"
          onClick={() => setNewOpen((open) => !open)}
          data-testid="chip-lesson-new"
        >
          + New
        </Button>
      </div>
      {newOpen && (
        <div className="mt-2 flex gap-2">
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
    </div>
  );
}
