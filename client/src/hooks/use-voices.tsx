import { useEffect, useState, useCallback } from 'react';

export interface VoiceInfo {
  name: string;
  lang: string;
  voiceURI: string;
  localService: boolean;
  default: boolean;
}

export interface VoicesByLang {
  en: VoiceInfo[];
  zh: VoiceInfo[];
  all: VoiceInfo[];
  ready: boolean;
  refresh: () => void;
}

const VOICES_CACHE_KEY = 'voicesCache';
const CACHE_TTL = 1000 * 60 * 60 * 24; // 24 hours

function normalizeVoices(voices: SpeechSynthesisVoice[]): VoicesByLang {
  const all = voices.map(v => ({
    name: v.name,
    lang: v.lang,
    voiceURI: v.voiceURI,
    localService: v.localService,
    default: v.default,
  }));
  const en = all.filter(v => /^en(-|$)/i.test(v.lang));
  const zh = all.filter(v => /^zh(-|$)/i.test(v.lang));
  return { en, zh, all, ready: true, refresh: () => {} };
}

function getCachedVoices(): VoiceInfo[] | null {
  try {
    const raw = localStorage.getItem(VOICES_CACHE_KEY);
    if (!raw) return null;
    const { voices, timestamp } = JSON.parse(raw);
    if (Date.now() - timestamp > CACHE_TTL) return null;
    return voices;
  } catch {
    return null;
  }
}

function setCachedVoices(voices: VoiceInfo[]) {
  localStorage.setItem(
    VOICES_CACHE_KEY,
    JSON.stringify({ voices, timestamp: Date.now() })
  );
}

export function useVoices(): VoicesByLang {
  const [voices, setVoices] = useState<VoiceInfo[]>(getCachedVoices() || []);
  const [ready, setReady] = useState(false);

  const refresh = useCallback(() => {
    if (!('speechSynthesis' in window)) return;
    const synth = window.speechSynthesis;
    const update = () => {
      const vs = synth.getVoices();
      const norm = vs.map(v => ({
        name: v.name,
        lang: v.lang,
        voiceURI: v.voiceURI,
        localService: v.localService,
        default: v.default,
      }));
      setVoices(norm);
      setCachedVoices(norm);
      setReady(true);
    };
    if (synth.onvoiceschanged !== undefined) {
      synth.onvoiceschanged = update;
    }
    update();
  }, []);

  useEffect(() => {
    if (!voices.length) refresh();
    else setReady(true);
    // Listen for voiceschanged
    if ('speechSynthesis' in window) {
      window.speechSynthesis.onvoiceschanged = refresh;
    }
    // Cleanup
    return () => {
      if ('speechSynthesis' in window) {
        window.speechSynthesis.onvoiceschanged = null;
      }
    };
  }, [refresh]);

  const norm = normalizeVoices(voices);
  norm.ready = ready;
  norm.refresh = refresh;
  return norm;
}
