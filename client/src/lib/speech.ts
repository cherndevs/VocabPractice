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
    } = {}
  ): Promise<void> {
    if (!this.isSupported || !this.synth || !text) {
      return Promise.reject(new Error("Speech synthesis not supported"));
    }

    // Cancel any ongoing speech
    this.synth.cancel();

    return new Promise((resolve, reject) => {
      const utterance = new SpeechSynthesisUtterance(text);

      // Set speech properties
      utterance.rate = options.rate || 0.8;
      utterance.pitch = options.pitch || 1;
      utterance.volume = options.volume || 1;
      utterance.lang = options.lang || "en-US";

      if (options.voice) {
        utterance.voice = options.voice;
      }

      utterance.onend = () => resolve();
      utterance.onerror = (event) => reject(new Error(`Speech error: ${event.error}`));

      this.synth.speak(utterance);
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
        await this.pause(pauseDuration);
      }
    }
  }

  cancel(): void {
    if (this.synth) {
      this.synth.cancel();
    }
  }

  pause(): void {
    if (this.synth) {
      this.synth.pause();
    }
  }

  resume(): void {
    if (this.synth) {
      this.synth.resume();
    }
  }

  getVoices(): SpeechSynthesisVoice[] {
    return this.synth?.getVoices() || [];
  }

  private pause(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  get supported(): boolean {
    return this.isSupported;
  }

  get speaking(): boolean {
    return this.synth?.speaking || false;
  }
}

export const speechService = new SpeechService();
