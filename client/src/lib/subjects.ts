import { SUBJECTS, type Subject } from "@shared/schema";

// Flag emoji don't render in Windows browsers; accepted for now (CHE-29).
export const SUBJECT_META: Record<Subject, { icon: string; menuLabel: string; shortName: string }> = {
  chinese: { icon: "🇨🇳", menuLabel: "中文 (Chinese)", shortName: "Chinese" },
  english: { icon: "🇬🇧", menuLabel: "English", shortName: "English" },
};

export const SUBJECT_OPTIONS = SUBJECTS.map((key) => ({ key, ...SUBJECT_META[key] }));
