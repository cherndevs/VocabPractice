import { Switch, Route, useLocation } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ThemeProvider } from "@/components/theme-provider";
import Sessions from "@/pages/sessions";
import Settings from "@/pages/settings";
import CreateSession from "@/pages/create-session";
import PracticeSession from "@/pages/practice-session";
import EditSession from "@/pages/edit-session";
import NotFound from "@/pages/not-found";
import BottomNavigation from "@/components/bottom-navigation";

function Router() {
  const [location] = useLocation();

  // Creating a session is a focused flow with its own back button, and the nav
  // bar sits directly under the camera controls — a stray tap there both loses
  // the work in progress and, on touch devices, catches the synthesized click
  // that follows a capture.
  const showBottomNavigation = location !== "/create-session";

  return (
    <div className="mobile-container max-w-sm mx-auto min-h-screen bg-background">
      <div className={showBottomNavigation ? "pb-20" : undefined}>
        <Switch>
          <Route path="/" component={Sessions} />
          <Route path="/sessions" component={Sessions} />
          <Route path="/settings" component={Settings} />
          <Route path="/create-session" component={CreateSession} />
          <Route path="/practice/:id" component={PracticeSession} />
          <Route path="/edit-session/:id" component={EditSession} />
          <Route component={NotFound} />
        </Switch>
      </div>
      {showBottomNavigation && <BottomNavigation />}
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
