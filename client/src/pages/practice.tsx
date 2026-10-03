import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Link } from "wouter";
import { Plus, Pin, Pencil, BookOpen, Calendar } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import WorkspaceSwitcher from "@/components/workspace-switcher";
import { useActiveSubject } from "@/hooks/use-active-subject";
import { formatDueDate, localToday } from "@/lib/due-date";
import type { SessionWithLesson } from "@shared/schema";

interface PracticeData {
  thisWeek: SessionWithLesson | null;
  pinned: SessionWithLesson[];
}

function SessionCard({ session, onTogglePin }: { session: SessionWithLesson; onTogglePin: () => void }) {
  return (
    <Card className="word-card hover:shadow-md transition-shadow" data-testid={`card-session-${session.id}`}>
      <Link href={`/practice/${session.id}`}>
        <CardContent className="p-4 cursor-pointer">
          <div className="flex items-center justify-between mb-2">
            <h3 className="flex items-center gap-2 font-medium text-foreground" data-testid={`text-session-title-${session.id}`}>
              {session.sessionType === "reading" ? (
                <BookOpen className="w-4 h-4 shrink-0 text-purple-600" aria-label="Reading session" data-testid={`icon-session-type-${session.id}`} />
              ) : (
                <Pencil className="w-4 h-4 shrink-0 text-blue-600" aria-label="Spelling session" data-testid={`icon-session-type-${session.id}`} />
              )}
              {session.title}
            </h3>
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
          </div>
          <div className="flex items-center space-x-3 text-sm text-muted-foreground">
            <span className="flex items-center space-x-1">
              <Calendar className="w-3 h-3" />
              <span data-testid={`text-session-date-${session.id}`}>{formatDueDate(session.dueDate)}</span>
            </span>
            <span data-testid={`text-session-word-count-${session.id}`}>{session.wordCount} Words</span>
          </div>
        </CardContent>
      </Link>
    </Card>
  );
}

export default function Practice() {
  const queryClient = useQueryClient();
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

  const pinMutation = useMutation({
    mutationFn: async (session: SessionWithLesson) => {
      const pinnedAt = session.pinnedAt ? null : new Date().toISOString();
      const response = await fetch(`/api/sessions/${session.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pinnedAt }),
      });
      if (!response.ok) throw new Error("Failed to update pin state");
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/practice"] });
      queryClient.invalidateQueries({ queryKey: ["/api/sessions"] });
    },
  });

  const heading = "text-sm font-semibold uppercase tracking-wide text-muted-foreground mb-3";

  return (
    <div className="fade-in">
      <div className="px-4 py-6 bg-card">
        <div className="mb-4">
          <WorkspaceSwitcher />
        </div>
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold text-foreground">Practice</h1>
          <Button asChild variant="default" size="icon" aria-label="Create New Session" data-testid="button-create-session">
            <Link href="/create-session">
              <Plus className="w-4 h-4" />
            </Link>
          </Button>
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
            <section data-testid="section-this-week">
              <h2 className={heading}>This week</h2>
              {data?.thisWeek ? (
                <SessionCard session={data.thisWeek} onTogglePin={() => pinMutation.mutate(data.thisWeek!)} />
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
                    <SessionCard key={session.id} session={session} onTogglePin={() => pinMutation.mutate(session)} />
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
