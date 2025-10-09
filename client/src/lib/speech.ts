export class SpeechService {
  private synth: SpeechSynthesis | null = null;
  private isSupported = false;

  constructor() {
    this.isSupported = 'speechSynthesis' in window;
    if (this.isSupported) {
      this.synth = window.speechSynthesis;
    }
  }

  async speak(
    text: string,
    options: {
      rate?: number;
      pitch?: number;
      volume?: number;
      lang?: string;
      voice?: SpeechSynthesisVoice;
      showToast?: (msg: string) => void;
    } = {}
  ): Promise<void> {
    if (!this.isSupported || !this.synth || !text) {
      return Promise.reject(new Error("Speech synthesis not supported"));
    }

    // Cancel any ongoing speech
    this.synth.cancel();

    // Voice selection logic
    let utterLang = options.lang || "en-US";
    let utterVoice: SpeechSynthesisVoice | null = null;
    const voices = this.getVoices();
    try {
      const selRaw = localStorage.getItem('selectedVoices');
      const selected = selRaw ? JSON.parse(selRaw) : {};
      let langKey = utterLang.startsWith('zh') ? 'zh' : utterLang.startsWith('en') ? 'en' : undefined;
      console.log('[TTS DEBUG] SpeechService: utterLang:', utterLang, 'langKey:', langKey, 'selected:', selected);
      if (langKey && selected[langKey]) {
        utterVoice = voices.find(v => v.voiceURI === selected[langKey]) || null;
        console.log('[TTS DEBUG] SpeechService: matched utterVoice:', utterVoice);
        if (!utterVoice && options.showToast) {
          options.showToast(`Selected ${langKey === 'en' ? 'English' : 'Chinese'} voice not found. Using default.`);
        }
      }
    } catch (err) {
      console.log('[TTS DEBUG] SpeechService: error parsing selectedVoices', err);
    }
    // Fallback to provided voice or best match
    if (!utterVoice && options.voice) {
      utterVoice = options.voice;
    }
    if (!utterVoice) {
      // Try best match for lang
      utterVoice = voices.find(v => v.lang.startsWith(utterLang.slice(0,2))) || null;
    }

    return new Promise((resolve, reject) => {
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.rate = options.rate || 0.8;
      utterance.pitch = options.pitch || 1;
      utterance.volume = options.volume || 1;
      utterance.lang = utterLang;
  utterance.voice = utterVoice;
  console.log('[TTS DEBUG] SpeechService.speak: utter.voice object:', utterVoice);
          // Log the actual voice object used for utterance
          if (utterVoice) {
            console.log('[TTS DEBUG] SpeechService.speak: utter.voice.name:', utterVoice.name, 'voiceURI:', utterVoice.voiceURI, 'lang:', utterVoice.lang);
          } else {
            console.log('[TTS DEBUG] SpeechService.speak: utter.voice is null, using default for lang:', utterLang);
          }

      utterance.onend = () => resolve();
      utterance.onerror = (event) => {
        if (event.error === 'canceled' || event.error === 'interrupted') {
          resolve();
        } else {
          reject(new Error(`Speech error: ${event.error}`));
        }
      };

      if (this.synth) {
        this.synth.speak(utterance);
      }
    });
  }

  async speakWithPauses(
    text: string,
    repetitions: number = 2,
    pauseDuration: number = 1500,
    options: Parameters<SpeechService['speak']>[1] = {}
  ): Promise<void> {
    for (let i = 0; i < repetitions; i++) {
      await this.speak(text, options);
      
      if (i < repetitions - 1) {
        await this.delay(pauseDuration);
      }
    }
  }

  cancel(): void {
    if (this.synth) {
      this.synth.cancel();
    }
  }

  pauseSpeech(): void {
    if (this.synth) {
      this.synth.pause();
    }
  }

  resumeSpeech(): void {
    if (this.synth) {
      this.synth.resume();
    }
  }

  getVoices(): SpeechSynthesisVoice[] {
    return this.synth?.getVoices() || [];
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  get supported(): boolean {
    return this.isSupported;
  }

  get speaking(): boolean {
    return this.synth ? this.synth.speaking : false;
  }
}

export const speechService = new SpeechService();
