import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ThemeProvider } from "@/components/theme-provider";
import Sessions from "@/pages/sessions";
import Settings from "@/pages/settings";
import CreateSession from "@/pages/create-session";
import PracticeSession from "@/pages/practice-session";
import NotFound from "@/pages/not-found";
import BottomNavigation from "@/components/bottom-navigation";
import StatusBar from "@/components/status-bar";

function Router() {
  return (
    <div className="mobile-container max-w-sm mx-auto min-h-screen bg-background">
      <StatusBar />
      <div className="pb-20">
        <Switch>
          <Route path="/" component={Sessions} />
          <Route path="/sessions" component={Sessions} />
          <Route path="/settings" component={Settings} />
          <Route path="/create-session" component={CreateSession} />
          <Route path="/practice/:id" component={PracticeSession} />
          <Route component={NotFound} />
        </Switch>
      </div>
      <BottomNavigation />
    </div>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <TooltipProvider>
          <Toaster />
          <Router />
        </TooltipProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}

export default App;
