import { useState } from "react";
import { Check, EyeOff, Pencil, Users, Volume2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useSpeech } from "@/hooks/use-speech";
import { CJK_CHAR, getPinyinAnnotation } from "@/lib/pinyin";
import { currentWord, gotIt, isFinished, next, notYet, progress, startLearnFlow, type LearnFlow } from "@/lib/learn-flow";

// Learn (CONTEXT.md → Learn): the child studies a Spelling session's words
// alone before dictation, look-cover-write-check. Nothing here is recorded.

const STAGE =
  "mx-4 mt-4 flex min-h-[360px] flex-col items-center gap-5 rounded-2xl bg-card px-4 py-10 text-center shadow-[0_1px_3px_rgba(0,0,0,0.08)]";
const WIDE_BUTTON = "h-[52px] w-full text-base font-bold";
const PILL = "rounded-full px-2.5 py-[5px] text-xs font-bold";

export type LearnChoice = "learn" | "all" | "skip";

/** The start choice: new & missed words (default), all words, or skip. */
export function LearnStart({
  title,
  learnCount,
  allCount,
  onClose,
  onStart,
}: {
  title: string;
  learnCount: number;
  allCount: number;
  onClose: () => void;
  onStart: (choice: LearnChoice) => void;
}) {
  const [picked, setPicked] = useState<LearnChoice>(learnCount > 0 ? "learn" : "all");
  const options: { id: LearnChoice; label: string; sub: string; count?: number; disabled?: boolean }[] = [
    { id: "learn", label: "New & missed words", sub: "Words not learned yet, or got wrong last time", count: learnCount, disabled: learnCount === 0 },
    { id: "all", label: "All words", sub: "Go over the whole list", count: allCount },
    { id: "skip", label: "Skip to the test", sub: "Straight to dictation with a grown-up" },
  ];
  const n = picked === "all" ? allCount : learnCount;
  const cta = picked === "skip" ? "Start the test" : `Learn ${n} ${n === 1 ? "word" : "words"}`;

  return (
    <div className="fade-in flex min-h-[calc(100dvh-80px)] flex-col" data-testid="section-learn-start">
      <div className="flex items-center gap-2 px-3 pt-4">
        <Button variant="ghost" size="icon" onClick={onClose} aria-label="Close" className="text-muted-foreground">
          <X className="h-5 w-5" />
        </Button>
        <div className="text-[15px] font-semibold">{title}</div>
        <div className={`${PILL} ml-auto bg-primary-tint text-primary`}>Spelling</div>
      </div>
      <div className="flex flex-col gap-1.5 px-5 pt-7">
        <h1 className="text-[26px] font-extrabold">Learn before the test</h1>
        <p className="text-[15px] leading-normal text-muted-foreground">
          Look at each word, cover it, write it on paper, then check. Have a pencil and paper ready.
        </p>
      </div>
      <div role="radiogroup" aria-label="What to learn" className="flex flex-col gap-2.5 px-4 pt-6">
        {options.map((o) => {
          const on = o.id === picked;
          return (
            <button
              key={o.id}
              type="button"
              role="radio"
              aria-checked={on}
              disabled={o.disabled}
              onClick={() => setPicked(o.id)}
              className={`flex min-h-[68px] items-center gap-3.5 rounded-xl bg-card px-4 py-3 text-left disabled:opacity-50 ${on ? "border-2 border-primary" : "border-[1.5px] border-border"}`}
              data-testid={`option-learn-${o.id}`}
            >
              <span className={`h-5 w-5 shrink-0 rounded-full ${on ? "border-[6px] border-primary" : "border-2 border-muted-foreground"}`} />
              <span className="flex flex-1 flex-col gap-0.5">
                <span className="text-base font-bold">{o.label}</span>
                <span className="text-[13px] text-muted-foreground">{o.sub}</span>
              </span>
              {o.count !== undefined && <span className="text-[15px] font-bold text-muted-foreground">{o.count}</span>}
            </button>
          );
        })}
      </div>
      <div className="mt-auto px-4 pb-8 pt-4">
        <Button className={WIDE_BUTTON} onClick={() => onStart(picked)} data-testid="button-learn-start">
          {cta}
        </Button>
      </div>
    </div>
  );
}

/** Glance → Cover → Check per word, until every word is learned. */
export function LearnRun({ words, onClose, onFinished }: { words: string[]; onClose: () => void; onFinished: () => void }) {
  const [flow, setFlow] = useState<LearnFlow>(() => startLearnFlow(words));
  const { speak } = useSpeech();
  const word = currentWord(flow);
  if (word === null) return null;
  const { done, total } = progress(flow);
  const percent = total ? Math.round((done / total) * 100) : 0;
  const pinyin = getPinyinAnnotation(word);
  const chinese = CJK_CHAR.test(word);
  const gots = flow.gotCount[word] ?? 0;

  const hear = () => {
    void speak(word, { lang: chinese ? "zh-CN" : "en-US" }).catch(() => {});
  };
  const act = (action: (f: LearnFlow) => LearnFlow) => {
    const after = action(flow);
    if (isFinished(after)) onFinished();
    else setFlow(after);
  };

  const stepLabel = { glance: "Look", cover: "Write", check: "Check" }[flow.step];
  const prompt = {
    glance: "Look carefully, then cover it",
    cover: "Now write it on your paper",
    check: chinese ? "Check your paper, stroke by stroke" : "Check your paper, letter by letter",
  }[flow.step];
  const hearButton = (
    <button
      type="button"
      onClick={hear}
      aria-label={flow.step === "cover" ? "Hear the word again" : "Hear the word"}
      className="flex h-[60px] w-[60px] items-center justify-center rounded-full border-[1.5px] border-border bg-card text-primary"
      data-testid="button-learn-hear"
    >
      <Volume2 className="h-6 w-6" />
    </button>
  );

  return (
    <div className="fade-in flex min-h-[calc(100dvh-80px)] flex-col" data-testid="section-learn">
      <div className="flex items-center px-3 pt-4">
        <Button variant="ghost" size="icon" onClick={onClose} aria-label="Close" className="text-muted-foreground">
          <X className="h-5 w-5" />
        </Button>
        <div className="mx-3 h-1.5 flex-1 overflow-hidden rounded-full bg-muted" role="progressbar" aria-valuenow={percent} aria-valuemin={0} aria-valuemax={100}>
          <div className="h-full rounded-full bg-primary transition-[width]" style={{ width: `${percent}%` }} />
        </div>
        <span className="whitespace-nowrap pr-2 text-xs font-semibold text-muted-foreground" data-testid="text-learn-progress">
          {done} of {total} learned
        </span>
      </div>
      <div className="mt-4 flex justify-center gap-2">
        <div className={`${PILL} bg-primary-tint text-primary`}>Learn</div>
        <div className={`${PILL} bg-muted text-muted-foreground`}>{stepLabel}</div>
      </div>
      <div className={`${STAGE} flex-1`}>
        <div className="text-sm font-medium text-muted-foreground">{prompt}</div>
        {flow.step === "glance" && (
          <>
            {pinyin && <div className="mt-6 text-lg tracking-[2px] text-muted-foreground" data-testid="text-learn-pinyin">{pinyin}</div>}
            <div className={`${pinyin ? "" : "mt-10"} ${chinese ? "text-[72px] font-bold leading-none tracking-[8px]" : "text-5xl font-extrabold tracking-[1px]"} break-all`} data-testid="text-learn-word">
              {word}
            </div>
            {hearButton}
          </>
        )}
        {flow.step === "cover" && (
          <>
            <div aria-label="Word hidden" className="mt-10 flex h-[72px] w-60 items-center justify-center rounded-xl border-2 border-dashed border-border bg-muted text-muted-foreground">
              <EyeOff className="h-7 w-7" />
            </div>
            {hearButton}
            <div className="mt-2 flex items-center gap-2.5 text-sm text-muted-foreground">
              <Pencil className="h-5 w-5" />
              From memory — no peeking
            </div>
          </>
        )}
        {flow.step === "check" && (
          <>
            {pinyin && <div className="mt-4 text-lg tracking-[2px] text-muted-foreground" data-testid="text-learn-pinyin">{pinyin}</div>}
            <CheckBoxes word={word} />
            {hearButton}
            <div className="text-[13px] leading-normal text-muted-foreground">
              Wrong? Fix it on your paper.
              <br />
              The word comes back after a few others.
            </div>
          </>
        )}
        {flow.step !== "cover" && (
          <div className="mt-auto flex items-center gap-2 text-[13px] text-muted-foreground">
            <span>Right twice to finish</span>
            <span aria-label={`${gots} of 2 correct`} className="flex gap-1">
              {[0, 1].map((i) => (
                <span key={i} className={`h-2.5 w-2.5 rounded-full ${i < gots ? "bg-primary" : "border-2 border-muted-foreground"}`} />
              ))}
            </span>
          </div>
        )}
      </div>
      <div className="px-4 pb-8 pt-4">
        {flow.step === "glance" && (
          <Button className={`${WIDE_BUTTON} gap-2`} onClick={() => act(next)} data-testid="button-learn-cover">
            <EyeOff className="h-[18px] w-[18px]" />
            Cover it
          </Button>
        )}
        {flow.step === "cover" && (
          <Button className={WIDE_BUTTON} onClick={() => act(next)} data-testid="button-learn-check">
            I've written it — check
          </Button>
        )}
        {flow.step === "check" && (
          <div className="grid grid-cols-2 gap-3">
            <Button variant="outline" className={WIDE_BUTTON} onClick={() => act(notYet)} data-testid="button-learn-not-yet">
              Not yet
            </Button>
            <Button className={WIDE_BUTTON} onClick={() => act(gotIt)} data-testid="button-learn-got-it">
              Got it
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}

/** The word to check against: letter boxes, or 田字格 squares for Chinese characters. */
function CheckBoxes({ word }: { word: string }) {
  const chars = Array.from(word);
  // Letters stay on one row, narrowing for long words; 田字格 squares wrap.
  const letterBox = "flex h-12 min-w-0 max-w-[34px] flex-1 basis-0 items-center justify-center rounded-lg border-[1.5px] border-border bg-muted text-[26px] font-bold";
  return (
    <div aria-label={word} className={`flex w-full ${CJK_CHAR.test(word) ? "flex-wrap" : "flex-nowrap"} justify-center gap-1`} data-testid="text-learn-word">
      {chars.map((c, i) =>
        CJK_CHAR.test(c) ? (
          <span key={i} className="relative mx-1 flex h-28 w-28 items-center justify-center rounded border-2 border-muted-foreground text-[80px] font-bold leading-none">
            <span className="absolute inset-x-0 top-1/2 border-t-[1.5px] border-dashed border-border" />
            <span className="absolute inset-y-0 left-1/2 border-l-[1.5px] border-dashed border-border" />
            <span className="relative">{c}</span>
          </span>
        ) : c.trim() === "" ? (
          <span key={i} className="w-3 shrink-0" />
        ) : (
          <span key={i} className={letterBox}>
            {c}
          </span>
        ),
      )}
    </div>
  );
}

/** "All n words learned — get a grown-up." */
export function LearnHandover({
  learned,
  testCount,
  onStartTest,
  onDone,
}: {
  learned: number;
  testCount: number;
  onStartTest: () => void;
  onDone: () => void;
}) {
  return (
    <div className="fade-in flex min-h-[calc(100dvh-80px)] flex-col" data-testid="section-learn-handover">
      <div className="flex flex-1 flex-col items-center justify-center gap-4 px-7 text-center">
        <div className="flex h-[72px] w-[72px] items-center justify-center rounded-full bg-[color-mix(in_srgb,var(--success)_15%,transparent)] text-success-ink">
          <Check className="h-9 w-9" strokeWidth={2.5} />
        </div>
        <h1 className="text-[26px] font-extrabold">
          All {learned} {learned === 1 ? "word" : "words"} learned
        </h1>
        <p className="text-[15px] leading-normal text-muted-foreground">
          Time for the spelling test.
          <br />
          Get a grown-up to read the words and mark your paper.
        </p>
        <div className="mt-2 flex items-center gap-2.5 rounded-xl border-[1.5px] border-border bg-card px-4 py-3 text-sm text-muted-foreground">
          <Users className="h-5 w-5" />
          <span>
            {testCount} {testCount === 1 ? "word" : "words"} in the test
          </span>
        </div>
      </div>
      <div className="flex flex-col gap-2.5 px-4 pb-8">
        <Button className={WIDE_BUTTON} onClick={onStartTest} data-testid="button-learn-start-test">
          Start the test now
        </Button>
        <Button variant="outline" className={WIDE_BUTTON} onClick={onDone} data-testid="button-learn-done">
          Done for now
        </Button>
      </div>
    </div>
  );
}
