import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { Plus, ChevronRight, Calendar, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { Session } from "@shared/schema";
import { format } from "date-fns";

export default function Sessions() {
  const { data: sessions = [], isLoading } = useQuery<Session[]>({
    queryKey: ["/api/sessions"],
  });

  const getStatusColor = (status: string) => {
    switch (status) {
      case "completed":
        return "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300";
      case "in-progress":
        return "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300";
      default:
        return "bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300";
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case "completed":
        return "Completed";
      case "in-progress":
        return "In Progress";
      default:
        return "New";
    }
  };

  return (
    <div className="fade-in">
      {/* Header */}
      <div className="px-4 py-6 bg-card">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-bold text-foreground">Spelling Pro</h1>
          <div className="w-8 h-8 bg-muted rounded-lg flex items-center justify-center">
            <svg className="w-4 h-4 text-muted-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6"></path>
            </svg>
          </div>
        </div>

        {/* Tab Navigation */}
        <Tabs value="sessions" className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="sessions">Sessions</TabsTrigger>
            <TabsTrigger value="settings" asChild>
              <Link href="/settings">Settings</Link>
            </TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      {/* Content */}
      <div className="px-4 py-4">
        {/* Create New Session Button */}
        <div className="mb-6">
          <Button 
            asChild 
            className="w-full flex items-center justify-between p-4 h-auto bg-card text-foreground border border-border hover:shadow-md"
            variant="outline"
            data-testid="button-create-session"
          >
            <Link href="/create-session">
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 bg-primary rounded-lg flex items-center justify-center">
                  <Plus className="w-5 h-5 text-primary-foreground" />
                </div>
                <div className="text-left">
                  <div className="font-medium">Create New Session</div>
                  <div className="text-sm text-muted-foreground">Start a new spelling list from a photo or scratch</div>
                </div>
              </div>
              <ChevronRight className="w-5 h-5 text-muted-foreground" />
            </Link>
          </Button>
        </div>

        {/* Recent Sessions */}
        <div className="mb-4">
          <h2 className="text-lg font-semibold text-foreground mb-3">Recent Sessions</h2>
        </div>

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
                  <p className="text-muted-foreground text-sm">Create your first spelling session to get started</p>
                </CardContent>
              </Card>
            ) : (
              sessions.map((session) => (
                <Card 
                  key={session.id} 
                  className="word-card hover:shadow-md transition-shadow cursor-pointer"
                  data-testid={`card-session-${session.id}`}
                >
                  <Link href={`/practice/${session.id}`}>
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between mb-2">
                        <h3 className="font-medium text-foreground" data-testid={`text-session-title-${session.id}`}>
                          {session.title}
                        </h3>
                        <Badge className={getStatusColor(session.status)} data-testid={`badge-status-${session.id}`}>
                          {getStatusText(session.status)}
                        </Badge>
                      </div>
                      <div className="flex items-center justify-between text-sm text-muted-foreground">
                        <div className="flex items-center space-x-3">
                          <span className="flex items-center space-x-1">
                            <Calendar className="w-3 h-3" />
                            <span data-testid={`text-session-date-${session.id}`}>
                              {session.createdAt ? format(new Date(session.createdAt), 'MMM d, yyyy') : 'Unknown date'}
                            </span>
                          </span>
                          <span data-testid={`text-session-word-count-${session.id}`}>
                            {session.wordCount} Words
                          </span>
                        </div>
                        <ChevronRight className="w-4 h-4" />
                      </div>
                    </CardContent>
                  </Link>
                </Card>
              ))
            )}
          </div>
        )}
      </div>
    </div>
  );
}
