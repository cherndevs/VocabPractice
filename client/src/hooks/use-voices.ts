import { useCallback, useEffect, useMemo, useRef, useState } from "react";

export type VoiceInfo = {
  name: string;
  lang: string;
  voiceURI: string;
  localService: boolean;
  default: boolean;
};

type VoicesCacheShape = {
  timestamp: number;
  voices: VoiceInfo[];
};

const VOICES_CACHE_KEY = "voicesCache";
const SELECTED_VOICES_KEY = "selectedVoices"; // documented for consumers

function readVoicesFromSynth(): VoiceInfo[] {
  if (typeof window === "undefined" || !("speechSynthesis" in window)) return [];
  const list = window.speechSynthesis.getVoices() || [];
  return list.map((v) => ({
    name: v.name,
    lang: v.lang,
    voiceURI: v.voiceURI,
    localService: !!v.localService,
    default: !!v.default,
  }));
}

function saveCache(cache: VoicesCacheShape) {
  try {
    window.localStorage.setItem(VOICES_CACHE_KEY, JSON.stringify(cache));
  } catch {}
}

function readCache(): VoicesCacheShape | null {
  try {
    const raw = window.localStorage.getItem(VOICES_CACHE_KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export function useVoices() {
  const [all, setAll] = useState<VoiceInfo[]>([]);
  const [ready, setReady] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<number | null>(null);
  const isSupported = useMemo(() => typeof window !== "undefined" && "speechSynthesis" in window, []);
  const initializedRef = useRef(false);

  const refresh = useCallback(() => {
    if (!isSupported) return;
    const voices = readVoicesFromSynth();
    setAll(voices);
    const ts = Date.now();
    setLastUpdated(ts);
    saveCache({ timestamp: ts, voices });
    setReady(true);
  }, [isSupported]);

  // initial load: use cache (if present) for instant UI, then refresh from API
  useEffect(() => {
    if (!isSupported || initializedRef.current) return;
    initializedRef.current = true;

    const cached = readCache();
    if (cached && cached.voices?.length) {
      setAll(cached.voices);
      setLastUpdated(cached.timestamp);
      setReady(true);
    }

    // Attempt immediate load; many browsers populate asynchronously
    const immediate = readVoicesFromSynth();
    if (immediate.length) {
      setAll(immediate);
      const ts = Date.now();
      setLastUpdated(ts);
      saveCache({ timestamp: ts, voices: immediate });
      setReady(true);
    }

    const handler = () => {
      refresh();
    };

    // Listen for the async population of voices
    (window.speechSynthesis as any).onvoiceschanged = handler;

    // Fallback: trigger a refresh shortly after mount
    const t = setTimeout(refresh, 300);

    return () => {
      clearTimeout(t);
      if ((window.speechSynthesis as any).onvoiceschanged === handler) {
        (window.speechSynthesis as any).onvoiceschanged = null;
      }
    };
  }, [isSupported, refresh]);

  const groups = useMemo(() => {
    const en = all.filter((v) => v.lang?.toLowerCase().startsWith("en"));
    const zh = all.filter((v) => v.lang?.toLowerCase().startsWith("zh"));
    return { en, zh };
  }, [all]);

  return {
    all,
    en: groups.en,
    zh: groups.zh,
    ready,
    lastUpdated,
    refresh,
    isSupported,
    keys: {
      selected: SELECTED_VOICES_KEY,
      cache: VOICES_CACHE_KEY,
    },
  };
}