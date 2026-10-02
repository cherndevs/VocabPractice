import { SUBJECTS, type Subject } from "@shared/schema";

// A short text badge stands in for the subject; flag emoji are deliberately not used.
export const SUBJECT_META: Record<Subject, { badge: string; menuLabel: string; shortName: string }> = {
  chinese: { badge: "中", menuLabel: "中文 (Chinese)", shortName: "Chinese" },
  english: { badge: "EN", menuLabel: "English", shortName: "English" },
};

export const SUBJECT_OPTIONS = SUBJECTS.map((key) => ({ key, ...SUBJECT_META[key] }));
