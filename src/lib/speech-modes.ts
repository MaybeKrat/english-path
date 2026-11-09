import type { Settings } from './types.ts';

/** Pauses of the repeat mode, in seconds (decided 08.11.2026). */
export const REPEAT_SECONDS = [5, 10, 15, 20, 30] as const;

/** 0 means the word is spoken once, without repeats. */
export function isRepeatSeconds(value: unknown): value is number {
  return value === 0 || (REPEAT_SECONDS as readonly unknown[]).includes(value);
}

/** Automatic pronunciation: off, once when the card appears, or again every N seconds. */
export type SpeechMode = 'off' | 'once' | (typeof REPEAT_SECONDS)[number];

export const SPEECH_MODES: readonly SpeechMode[] = ['off', 'once', ...REPEAT_SECONDS];

export function speechMode(settings: Pick<Settings, 'autoSpeak' | 'repeatSeconds'>): SpeechMode {
  if (!settings.autoSpeak) return 'off';
  return isRepeatSeconds(settings.repeatSeconds) && settings.repeatSeconds > 0
    ? (settings.repeatSeconds as SpeechMode)
    : 'once';
}

export function speechModeSettings(mode: SpeechMode): Pick<Settings, 'autoSpeak' | 'repeatSeconds'> {
  if (mode === 'off') return { autoSpeak: false, repeatSeconds: 0 };
  return { autoSpeak: true, repeatSeconds: mode === 'once' ? 0 : mode };
}

export function speechModeLabel(mode: SpeechMode): string {
  if (mode === 'off') return 'Не произносить';
  if (mode === 'once') return 'Один раз при показе';
  return `Повторять каждые ${mode} секунд`;
}
