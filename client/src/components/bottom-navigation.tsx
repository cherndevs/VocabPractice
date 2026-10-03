import { useLocation } from "wouter";
import { Zap, Layers, TrendingUp, Settings } from "lucide-react";
import { Button } from "@/components/ui/button";

const TABS = [
  { path: "/", label: "Practice", testId: "nav-practice", Icon: Zap },
  { path: "/library", label: "Library", testId: "nav-library", Icon: Layers },
  { path: "/progress", label: "Progress", testId: "nav-progress", Icon: TrendingUp },
  { path: "/settings", label: "Settings", testId: "nav-settings", Icon: Settings },
];

export default function BottomNavigation() {
  const [location, navigate] = useLocation();

  return (
    <div className="fixed bottom-0 left-0 right-0 bg-card border-t border-border">
      <div className="mobile-container max-w-sm mx-auto">
        <div className="flex">
          {TABS.map(({ path, label, testId, Icon }) => (
            <Button
              key={path}
              variant="ghost"
              className={`flex-1 flex flex-col items-center py-2 h-auto ${
                location === path ? "text-primary" : "text-muted-foreground"
              }`}
              onClick={() => navigate(path)}
              data-testid={testId}
            >
              <Icon className="w-6 h-6 mb-1" />
              <span className="text-xs font-medium">{label}</span>
            </Button>
          ))}
        </div>
      </div>
    </div>
  );
}
