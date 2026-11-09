import type { Voice } from './types.ts';

/** Recorded voices bundled with the app; keep in sync with scripts/build-voices.py. */
export const voices: readonly { id: Voice; name: string; note: string }[] = [
  { id: 'ryan', name: 'Ryan', note: 'британский, мужской' },
  { id: 'sonia', name: 'Sonia', note: 'британский, женский' },
];

export function isVoice(value: unknown): value is Voice {
  return voices.some((voice) => voice.id === value);
}

/** File name of a recording: the first 16 hex digits of SHA-256 of the spoken text. */
export async function recordingKey(text: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return [...new Uint8Array(digest)].slice(0, 8).map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

/** A bundled recording, or null when the word has none and the system voice should speak. */
export async function loadRecording(voice: Voice, text: string, fetcher: typeof fetch = fetch): Promise<ArrayBuffer | null> {
  try {
    const response = await fetcher(`voices/${voice}/${await recordingKey(text.trim())}.mp3`);
    return response.ok ? await response.arrayBuffer() : null;
  } catch {
    return null;
  }
}

/** Settings line about the background download of the recordings; empty outside the desktop app. */
export function voicePackText(status: VoicePackStatus | null): string {
  if (!status) return '';
  const megabytes = (bytes: number) => Math.round(bytes / 1048576);
  switch (status.state) {
    case 'ready':
      return 'Записи скачаны.';
    case 'downloading':
      return `Скачиваются: ${megabytes(status.received)} из ${megabytes(status.total)} МБ. Пока слова читает голос Windows.`;
    case 'verifying':
      return 'Записи скачаны, идёт проверка.';
    case 'error':
      return `Записи пока не скачаны (${status.error}). Повтор автоматически; до тех пор слова читает голос Windows.`;
    default:
      return 'Проверка записей…';
  }
}

/** One line under the download bar in the sidebar. */
export function voicePackShort(status: VoicePackStatus): string {
  const megabytes = (bytes: number) => Math.round(bytes / 1048576);
  if (status.state === 'verifying') return 'проверка файла';
  if (status.state === 'error') return 'нет связи, повторим сами';
  return `скачано ${megabytes(status.received)} из ${megabytes(status.total)} МБ`;
}
