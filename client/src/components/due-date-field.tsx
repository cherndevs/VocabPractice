import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

interface DueDateFieldProps {
  /** YYYY-MM-DD, or null for none. */
  value: string | null;
  onChange: (dueDate: string | null) => void;
}

// Optional day of the test or homework a session prepares for. A native date
// input gives a date-only value, so there is no time or time zone to drift.
export function DueDateField({ value, onChange }: DueDateFieldProps) {
  return (
    <div>
      <label htmlFor="due-date" className="mb-2 block text-xs font-semibold text-muted-foreground">
        Due date (optional)
      </label>
      <div className="flex items-center gap-2">
        <Input
          id="due-date"
          type="date"
          value={value ?? ""}
          onChange={(e) => onChange(e.target.value || null)}
          className="h-[42px] flex-1 border-[1.5px] text-[15px]"
          data-testid="input-due-date"
        />
        {value && (
          <Button variant="ghost" size="sm" onClick={() => onChange(null)} data-testid="button-clear-due-date">
            Clear
          </Button>
        )}
      </div>
      <p className="mt-1.5 text-xs leading-snug text-muted-foreground">
        The day of the test or homework. The session with the nearest due date shows under This week on Practice.
      </p>
    </div>
  );
}
