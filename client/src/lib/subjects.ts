import { SUBJECTS, type Subject } from "@shared/schema";

// Flag emoji don't render in Windows browsers; accepted for now (CHE-29).
export const SUBJECT_META: Record<Subject, { icon: string; label: string; name: string }> = {
  chinese: { icon: "🇨🇳", label: "中文 (Chinese)", name: "Chinese" },
  english: { icon: "🇬🇧", label: "English", name: "English" },
};

export const SUBJECT_OPTIONS = SUBJECTS.map((key) => ({ key, ...SUBJECT_META[key] }));
