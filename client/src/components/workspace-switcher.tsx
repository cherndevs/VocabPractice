import { ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useActiveSubject } from "@/hooks/use-active-subject";
import { SUBJECT_META, SUBJECT_OPTIONS } from "@/lib/subjects";

function SubjectBadge({ text, className = "" }: { text?: string; className?: string }) {
  return (
    <span
      aria-hidden
      className={`inline-flex h-6 w-6 items-center justify-center rounded-full bg-primary/10 text-[10px] font-semibold text-primary ${className}`}
    >
      {text}
    </span>
  );
}

// Sits on Practice and Library. Switching changes the active Subject, which
// both screens' queries are keyed on, so both refetch.
export default function WorkspaceSwitcher() {
  const { subject, setSubject } = useActiveSubject();
  const active = subject ? SUBJECT_META[subject] : undefined;
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="outline"
          className="gap-1 px-2"
          disabled={!subject}
          aria-label="Switch workspace"
          data-testid="button-workspace-switcher"
        >
          <SubjectBadge text={active?.badge} />
          <span className="text-sm font-medium">{active?.shortName}</span>
          <ChevronDown className="w-4 h-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start">
        {SUBJECT_OPTIONS.map((option) => (
          <DropdownMenuItem
            key={option.key}
            onSelect={() => setSubject(option.key)}
            data-testid={`workspace-option-${option.key}`}
          >
            <SubjectBadge text={option.badge} className="mr-2" />
            {option.menuLabel}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
