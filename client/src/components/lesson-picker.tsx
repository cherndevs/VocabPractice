import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Check, ChevronDown, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle } from "@/components/ui/drawer";
import { lessonsMatchingTitle, sortLessonNames } from "@/lib/lesson-order";
import type { Lesson, Subject } from "@shared/schema";

interface LessonPickerProps {
  subject: Subject;
  /** The chosen Lesson's name, or null for none. */
  value: string | null;
  onChange: (name: string | null) => void;
  /** The session title, used to suggest a matching Lesson. */
  title?: string;
}

// Optional grouping for a session. A single row opens a searchable sheet of the
// Subject's Lessons; typing a name nobody has used offers to create it. A new
// name becomes a Lesson when the session is saved; there is no other way to
// create one.
export function LessonPicker({ subject, value, onChange, title = "" }: LessonPickerProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const { data: lessons = [] } = useQuery<Lesson[]>({
    queryKey: ["/api/lessons", { subject }],
    queryFn: async () => {
      const response = await fetch(`/api/lessons?subject=${subject}`);
      if (!response.ok) throw new Error("Failed to fetch lessons");
      return response.json();
    },
  });

  // A typed name that isn't saved yet still shows in the list, so it can be undone.
  const saved = lessons.map((l) => l.name);
  const names = sortLessonNames(value && !saved.includes(value) ? [...saved, value] : saved);
  const suggested = lessonsMatchingTitle(title, names);
  const typed = search.trim();
  const canCreate = typed !== "" && !names.includes(typed);

  const choose = (name: string | null) => {
    onChange(name);
    setOpen(false);
  };

  const openSheet = (isOpen: boolean) => {
    setOpen(isOpen);
    if (!isOpen) setSearch("");
  };

  const item = (name: string, group: string) => (
    <CommandItem
      key={`${group}-${name}`}
      value={`${group} ${name}`}
      keywords={[name]}
      onSelect={() => choose(name)}
      className="py-2.5"
      data-testid={`option-lesson-${name}`}
    >
      <Check className={`mr-2 h-4 w-4 ${name === value ? "opacity-100" : "opacity-0"}`} />
      {name}
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
        <span className={`truncate ${value ? "" : "text-muted-foreground"}`}>{value ?? "No lesson"}</span>
        <ChevronDown className="h-4 w-4 shrink-0 opacity-60" />
      </Button>
      {!value && suggested.length === 1 && (
        <button
          type="button"
          className="mt-2 text-sm text-primary"
          onClick={() => onChange(suggested[0])}
          data-testid="button-use-suggested-lesson"
        >
          Use {suggested[0]}?
        </button>
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
              {value && !typed && (
                <CommandGroup>
                  <CommandItem value="none" onSelect={() => choose(null)} className="py-2.5" data-testid="option-lesson-none">
                    <span className="ml-6 text-muted-foreground">No lesson</span>
                  </CommandItem>
                </CommandGroup>
              )}
              {suggested.length > 0 && (
                <CommandGroup heading="Matches the title">{suggested.map((n) => item(n, "suggested"))}</CommandGroup>
              )}
              {names.length > 0 && <CommandGroup heading="All lessons">{names.map((n) => item(n, "all"))}</CommandGroup>}
              {canCreate && (
                <CommandGroup forceMount>
                  <CommandItem
                    forceMount
                    value={`create ${typed}`}
                    onSelect={() => choose(typed)}
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
