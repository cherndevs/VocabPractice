import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { BookOpen, PenLine, Pin } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import WorkspaceSwitcher from "@/components/workspace-switcher";
import { usePinSession } from "@/hooks/use-pin-session";
import SessionTypeIcon from "@/components/session-type-icon";
import { useActiveSubject } from "@/hooks/use-active-subject";
import { formatDueDate, localToday } from "@/lib/due-date";
import type { Skill, SessionWithLesson } from "@shared/schema";

interface PracticeData {
  /** Words needing review per skill, before the Refresher size cap. */
  refreshers: Record<Skill, number>;
  thisWeek: SessionWithLesson | null;
  pinned: SessionWithLesson[];
}

function SessionCard({ session, onTogglePin }: { session: SessionWithLesson; onTogglePin: () => void }) {
  const reading = session.sessionType === "reading";
  const meta = `${formatDueDate(session.dueDate)} · ${session.wordCount} ${session.wordCount === 1 ? "word" : "words"}`;
  return (
    <Card className="word-card hover:shadow-md transition-shadow" data-testid={`card-session-${session.id}`}>
      <Link href={`/practice/${session.id}`}>
        <CardContent className="flex items-center gap-3 px-3.5 py-3 cursor-pointer">
          <div
            className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${
              reading ? "bg-purple-100 text-purple-600" : "bg-blue-100 text-blue-600"
            }`}
          >
            <SessionTypeIcon
              sessionType={session.sessionType}
              className="w-[18px] h-[18px]"
              data-testid={`icon-session-type-${session.id}`}
            />
          </div>
          <div className="min-w-0 flex-1">
            <h3 className="truncate text-sm font-medium text-foreground" data-testid={`text-session-title-${session.id}`}>
              {session.title}
            </h3>
            <p className="mt-0.5 truncate text-[11px] text-muted-foreground" data-testid={`text-session-meta-${session.id}`}>
              {meta}
            </p>
          </div>
          <Button
            variant="ghost"
            size="icon"
            className={session.pinnedAt ? "text-primary" : "text-muted-foreground"}
            aria-label={session.pinnedAt ? "Unpin session" : "Pin session"}
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              onTogglePin();
            }}
            data-testid={`button-pin-${session.id}`}
          >
            <Pin className="w-4 h-4" />
          </Button>
        </CardContent>
      </Link>
    </Card>
  );
}

const REFRESHERS: { skill: Skill; title: string; Icon: typeof PenLine; tint: string }[] = [
  { skill: "spelling", title: "Spelling refresher", Icon: PenLine, tint: "bg-blue-100 text-blue-600" },
  { skill: "reading", title: "Reading refresher", Icon: BookOpen, tint: "bg-purple-100 text-purple-600" },
];

function Refreshers({ counts }: { counts: Record<Skill, number> }) {
  const offered = REFRESHERS.filter(({ skill }) => counts[skill] > 0);
  if (offered.length === 0) {
    return (
      <Card data-testid="card-all-caught-up">
        <CardContent className="px-3 py-8 text-center">
          <div className="text-base font-bold text-foreground">All caught up for today</div>
          <p className="mt-1 text-sm text-muted-foreground">
            No words need review right now. Check back tomorrow, or browse the Library to get ahead.
          </p>
        </CardContent>
      </Card>
    );
  }
  return (
    <div className="space-y-2" data-testid="section-refreshers">
      {offered.map(({ skill, title, Icon, tint }) => (
        <Card key={skill} data-testid={`card-refresher-${skill}`}>
          <CardContent className="flex items-center gap-3.5 p-4">
            <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-[10px] ${tint}`}>
              <Icon className="w-[22px] h-[22px]" />
            </div>
            <div className="flex-1">
              <div className="text-[15px] font-bold text-foreground">{title}</div>
              <div className="mt-0.5 text-xs text-muted-foreground" data-testid={`text-refresher-count-${skill}`}>
                {counts[skill]} {counts[skill] === 1 ? "word needs" : "words need"} review
              </div>
            </div>
            <Link href={`/refresher/${skill}`}>
              <Button size="sm" data-testid={`button-start-refresher-${skill}`}>Start</Button>
            </Link>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

export default function Practice() {
  const { subject } = useActiveSubject();
  // The client's own local date decides which due dates are still upcoming.
  const today = localToday();
  const { data, isLoading: loading } = useQuery<PracticeData>({
    queryKey: ["/api/practice", { subject, today }],
    queryFn: async () => {
      const response = await fetch(`/api/practice?subject=${subject}&today=${today}`);
      if (!response.ok) throw new Error("Failed to fetch practice");
      return response.json();
    },
    enabled: !!subject,
  });
  const isLoading = !subject || loading;

  const pinSession = usePinSession();

  const heading = "text-sm font-semibold uppercase tracking-wide text-muted-foreground mb-3";

  return (
    <div className="fade-in">
      <div className="px-4 py-6 bg-card">
        <div className="mb-4">
          <WorkspaceSwitcher />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-foreground">Practice</h1>
        </div>
      </div>

      <div className="px-4 py-4 space-y-6">
        {isLoading ? (
          <Card className="animate-pulse">
            <CardContent className="p-4">
              <div className="h-4 bg-muted rounded w-3/4 mb-2"></div>
              <div className="h-3 bg-muted rounded w-1/2"></div>
            </CardContent>
          </Card>
        ) : (
          <>
            {data && <Refreshers counts={data.refreshers} />}
            <section data-testid="section-this-week">
              <h2 className={heading}>This week</h2>
              {data?.thisWeek ? (
                <SessionCard session={data.thisWeek} onTogglePin={() => pinSession.mutate(data.thisWeek!)} />
              ) : (
                <p className="text-sm text-muted-foreground" data-testid="text-no-this-week">
                  No sessions with an upcoming due date.
                </p>
              )}
            </section>
            <section data-testid="section-pinned">
              <h2 className={heading}>Pinned</h2>
              {data?.pinned.length ? (
                <div className="space-y-3">
                  {data.pinned.map((session) => (
                    <SessionCard key={session.id} session={session} onTogglePin={() => pinSession.mutate(session)} />
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground" data-testid="text-no-pinned">
                  Pin a session to keep it here.
                </p>
              )}
            </section>
          </>
        )}
      </div>
    </div>
  );
}
