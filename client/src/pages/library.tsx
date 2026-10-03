import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Link, useLocation } from "wouter";
import { Plus, ChevronRight, Calendar, FileText, Pin, Pencil, BookOpen } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { SwipeableCard } from "@/components/swipeable-card";
import { useActiveSubject } from "@/hooks/use-active-subject";
import { SUBJECT_META } from "@/lib/subjects";
import WorkspaceSwitcher from "@/components/workspace-switcher";
import { formatDueDate } from "@/lib/due-date";
import type { SessionWithLesson } from "@shared/schema";
import { groupSessionsByLesson } from "@/lib/group-sessions";

// The list endpoint adds how many of a session's words have ever been graded.
type SessionWithTested = SessionWithLesson & { testedCount: number };

export default function Library() {
  const queryClient = useQueryClient();
  const [, navigate] = useLocation();
  const { subject } = useActiveSubject();
  // Only the active Workspace's sessions are listed (ADR-0005). The list waits
  // for settings so it never flashes the wrong Workspace on startup.
  const { data: sessions = [], isLoading: sessionsLoading } = useQuery<SessionWithTested[]>({
    queryKey: ["/api/sessions", { subject }],
    queryFn: async () => {
      const response = await fetch(`/api/sessions?subject=${subject}`);
      if (!response.ok) {
        throw new Error("Failed to fetch sessions");
      }
      return response.json();
    },
    enabled: !!subject,
  });
  const isLoading = !subject || sessionsLoading;
  const active = subject ? SUBJECT_META[subject] : undefined;

  const deleteSessionMutation = useMutation({
    mutationFn: async (sessionId: string) => {
      const response = await fetch(`/api/sessions/${sessionId}`, {
        method: 'DELETE',
      });
      if (!response.ok) {
        throw new Error('Failed to delete session');
      }
      return response.json();
    },
    onSuccess: () => {
      // Invalidate and refetch sessions
      queryClient.invalidateQueries({ queryKey: ["/api/sessions"] });
      queryClient.invalidateQueries({ queryKey: ["/api/practice"] });
    },
  });

  const handleDeleteSession = (sessionId: string) => {
    deleteSessionMutation.mutate(sessionId);
  };

  const pinMutation = useMutation({
    mutationFn: async ({ id, pinnedAt }: { id: string; pinnedAt: string | null }) => {
      const response = await fetch(`/api/sessions/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pinnedAt }),
      });
      if (!response.ok) {
        throw new Error('Failed to update pin state');
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/sessions"] });
      queryClient.invalidateQueries({ queryKey: ["/api/practice"] });
    },
  });

  const handleTogglePin = (e: React.MouseEvent, session: SessionWithTested) => {
    e.preventDefault();
    e.stopPropagation();
    const nextPinnedAt = session.pinnedAt ? null : new Date().toISOString();
    pinMutation.mutate({ id: session.id, pinnedAt: nextPinnedAt });
  };

  // Lesson headings first, then untagged sessions; pinned-first within each group.
  const groups = groupSessionsByLesson(sessions);

  const renderSession = (session: SessionWithTested) => (
    <SwipeableCard
      key={session.id}
      className="word-card hover:shadow-md transition-shadow cursor-pointer"
      data-testid={`card-session-${session.id}`}
      onDelete={() => handleDeleteSession(session.id)}
      onEdit={() => navigate(`/edit-session/${session.id}`)}
    >
      <Link href={`/practice/${session.id}`}>
        <CardContent className="p-4">
          <div className="flex items-center justify-between mb-2">
            <h3 className="flex items-center gap-2 font-medium text-foreground" data-testid={`text-session-title-${session.id}`}>
              {session.sessionType === "reading" ? (
                <BookOpen className="w-4 h-4 shrink-0 text-purple-600" aria-label="Reading session" data-testid={`icon-session-type-${session.id}`} />
              ) : (
                <Pencil className="w-4 h-4 shrink-0 text-blue-600" aria-label="Spelling session" data-testid={`icon-session-type-${session.id}`} />
              )}
              {session.title}
            </h3>
            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                size="icon"
                className={session.pinnedAt ? 'text-primary' : 'text-muted-foreground'}
                aria-label={session.pinnedAt ? 'Unpin session' : 'Pin session'}
                onClick={(e) => handleTogglePin(e, session)}
                data-testid={`button-pin-${session.id}`}
              >
                <Pin className="w-4 h-4" />
              </Button>
            </div>
          </div>
          <div className="flex items-center justify-between text-sm text-muted-foreground">
            <div className="flex items-center space-x-3">
              <span className="flex items-center space-x-1">
                <Calendar className="w-3 h-3" />
                <span data-testid={`text-session-date-${session.id}`}>
                  {formatDueDate(session.dueDate)}
                </span>
              </span>
              <span data-testid={`text-session-word-count-${session.id}`}>
                {session.wordCount} Words
              </span>
              <span data-testid={`text-session-tested-${session.id}`}>
                {session.testedCount} / {session.wordCount} tested
              </span>
            </div>
            <ChevronRight className="w-4 h-4" />
          </div>
        </CardContent>
      </Link>
    </SwipeableCard>
  );

  return (
    <div className="fade-in">
      {/* Header */}
      <div className="px-4 py-6 bg-card">
        <div className="mb-4">
          <WorkspaceSwitcher />
        </div>
        <div className="flex items-center justify-between mb-2">
          <h1 className="text-2xl font-bold text-foreground">Library</h1>
          <Button
            asChild
            variant="default"
            size="icon"
            aria-label="Create New Session"
            data-testid="button-create-session"
          >
            <Link href="/create-session">
              <Plus className="w-4 h-4" />
            </Link>
          </Button>
        </div>

      </div>

      {/* Content */}
      <div className="px-4 py-4">
        {isLoading ? (
          <div className="space-y-3">
            {[...Array(5)].map((_, i) => (
              <Card key={i} className="animate-pulse">
                <CardContent className="p-4">
                  <div className="h-4 bg-muted rounded w-3/4 mb-2"></div>
                  <div className="h-3 bg-muted rounded w-1/2"></div>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : (
          <div className="space-y-3">
            {sessions.length === 0 ? (
              <Card>
                <CardContent className="p-8 text-center">
                  <FileText className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                  <h3 className="text-lg font-medium text-foreground mb-2">No sessions yet</h3>
                  <p className="text-muted-foreground text-sm">
                    Create your first {active?.shortName} spelling session to get started
                  </p>
                </CardContent>
              </Card>
            ) : (
              groups.map((group) => (
                <section
                  key={group.lesson?.id ?? "untagged"}
                  className="space-y-3"
                  data-testid={group.lesson ? `group-lesson-${group.lesson.id}` : "group-untagged"}
                >
                  {group.lesson && (
                    <h2
                      className="pt-2 text-sm font-semibold uppercase tracking-wide text-muted-foreground"
                      data-testid={`heading-lesson-${group.lesson.id}`}
                    >
                      {group.lesson.name}
                    </h2>
                  )}
                  {group.sessions.map(renderSession)}
                </section>
              ))
            )}
          </div>
        )}
      </div>
    </div>
  );
}
