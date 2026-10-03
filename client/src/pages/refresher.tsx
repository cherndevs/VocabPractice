import { useEffect, useState } from "react";
import { useLocation, useParams } from "wouter";
import { CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useActiveSubject } from "@/hooks/use-active-subject";
import { PracticeDrill } from "@/pages/practice-session";
import { skillSchema } from "@shared/schema";

// A refresher drills the words needing review in one skill across the active
// Subject. The words are held as loaded: grades refresh review states
// mid-drill, and the list must not shift under the drill. It reuses the
// session drill, so grades save the same way, with no sessionId.
export default function Refresher() {
  const { skill: skillParam } = useParams<{ skill: string }>();
  const skill = skillSchema.safeParse(skillParam);
  const { subject } = useActiveSubject();
  const [, navigate] = useLocation();
  const [words, setWords] = useState<string[] | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (!subject || !skill.success) return;
    let cancelled = false;
    setWords(null);
    setFailed(false);
    fetch(`/api/refresher?subject=${subject}&skill=${skill.data}`)
      .then((res) => (res.ok ? res.json() : Promise.reject(new Error(String(res.status)))))
      .then((body: { words: string[] }) => {
        if (!cancelled) setWords(body.words);
      })
      .catch(() => {
        if (!cancelled) setFailed(true);
      });
    return () => {
      cancelled = true;
    };
  }, [subject, skill.success && skill.data]);

  if (!skill.success || failed) {
    return (
      <div className="px-4 py-6">
        <Card>
          <CardContent className="pt-6 text-center">
            <p className="text-muted-foreground">Couldn't load the refresher</p>
            <Button onClick={() => navigate("/")} className="mt-4">
              Back to Practice
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!subject || !words) {
    return (
      <div className="px-4 py-6">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-muted rounded w-1/2"></div>
          <div className="h-48 bg-muted rounded"></div>
        </div>
      </div>
    );
  }

  if (words.length === 0) {
    return (
      <div className="px-4 py-12 text-center space-y-4" data-testid="section-nothing-due">
        <CheckCircle2 className="w-10 h-10 mx-auto text-green-600" />
        <p className="text-xl font-semibold text-foreground">Nothing needs review</p>
        <Button variant="outline" onClick={() => navigate("/")}>Back to Practice</Button>
      </div>
    );
  }

  return (
    <PracticeDrill
      session={{
        id: null,
        title: skill.data === "spelling" ? "Spelling refresher" : "Reading refresher",
        subject,
        sessionType: skill.data,
        pinnedAt: null,
        exitTo: "/",
        exitLabel: "Back to Practice",
      }}
      words={words}
    />
  );
}
