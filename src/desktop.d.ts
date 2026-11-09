interface Window {
  oxfordAudio?: {
    prepare(text: string): Promise<{ audioBase64: string; voice: string; lang: string }>;
  };
  oxfordTheme?: {
    setSource(source: "system" | "light" | "dark"): Promise<void>;
  };
  oxfordZoom?: {
    set(factor: number): void;
  };
  oxfordVoices?: {
    status(): Promise<VoicePackStatus>;
    onStatus(callback: (status: VoicePackStatus) => void): () => void;
  };
}

/** Background download of the recorded voices, from desktop/voice-pack.cjs. */
interface VoicePackStatus {
  state: "checking" | "downloading" | "verifying" | "ready" | "error";
  received: number;
  total: number;
  error?: string;
  retryAt?: number;
}
