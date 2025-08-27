import { useLocation } from "wouter";
import { Home, Settings } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function BottomNavigation() {
  const [location, navigate] = useLocation();

  const isActive = (path: string) => {
    if (path === "/" && (location === "/" || location === "/sessions")) return true;
    return location === path;
  };

  return (
    <div className="fixed bottom-0 left-0 right-0 bg-card border-t border-border">
      <div className="mobile-container max-w-sm mx-auto">
        <div className="flex">
          <Button
            variant="ghost"
            className={`flex-1 flex flex-col items-center py-2 h-auto ${
              isActive("/") ? "text-primary" : "text-muted-foreground"
            }`}
            onClick={() => navigate("/sessions")}
            data-testid="nav-sessions"
          >
            <Home className="w-6 h-6 mb-1" />
            <span className="text-xs font-medium">Sessions</span>
          </Button>
          <Button
            variant="ghost"
            className={`flex-1 flex flex-col items-center py-2 h-auto ${
              isActive("/settings") ? "text-primary" : "text-muted-foreground"
            }`}
            onClick={() => navigate("/settings")}
            data-testid="nav-settings"
          >
            <Settings className="w-6 h-6 mb-1" />
            <span className="text-xs font-medium">Settings</span>
          </Button>
        </div>
      </div>
    </div>
  );
}
