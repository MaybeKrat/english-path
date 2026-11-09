import type { AppState, CardProgress, Level, Rating, ReviewLog, Settings } from './types.ts';
import { defaultState, MAX_DAILY_EXTRA } from './scheduler.ts';
import { finiteRange, isRecord, timestamp, validCard } from './validation.ts';
import { isVoice } from './voices.ts';
import { DEFAULT_ZOOM, isZoom } from './zoom.ts';
import { isRepeatSeconds } from './speech-modes.ts';
import { DEFAULT_VERBS_DAILY_NEW, MAX_VERBS_DAILY_NEW } from './verbs.ts';
import { isTense } from './grammar.ts';

export const STORAGE_KEY = 'oxford-cards:v1';

export interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

function invalid(detail: string): never {
  throw new Error(`Не удалось загрузить прогресс: ${detail}`);
}

function validId(value: unknown, known?: Set<string>): value is string {
  return typeof value === 'string' && value.length > 0 && value.length <= 200
    && !['__proto__', 'constructor', 'prototype'].includes(value) && (!known || known.has(value));
}

function validDayKey(value: unknown): value is string {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const at = Date.parse(`${value}T00:00:00.000Z`);
  return Number.isFinite(at) && new Date(at).toISOString().slice(0, 10) === value;
}

function parseCards(value: unknown, validWordIds?: Set<string>): Record<string, CardProgress> {
  if (!isRecord(value) || Object.keys(value).length > 10_000) invalid('некорректный список карточек.');
  const cards: Record<string, CardProgress> = {};
  for (const [id, card] of Object.entries(value)) {
    const displayId = id.slice(0, 80);
    if (!validId(id, validWordIds)) invalid(`неизвестная карточка «${displayId}».`);
    if (!validCard(card)) invalid(`некорректные интервалы или даты карточки «${displayId}».`);
    cards[id] = {
      due: card.due, interval: card.interval, ease: card.ease, repetitions: card.repetitions,
      lapses: card.lapses, lastReviewed: card.lastReviewed, startedAt: card.startedAt, state: card.state,
    };
  }
  return cards;
}

function parseReviews(value: unknown, validWordIds?: Set<string>): ReviewLog[] {
  if (!Array.isArray(value) || value.length > 250_000) invalid('некорректная история повторений.');
  return value.map((review: unknown) => {
    if (!isRecord(review) || !validId(review.wordId, validWordIds) || !timestamp(review.at)
      || typeof review.rating !== 'string' || !['again', 'hard', 'good', 'easy'].includes(review.rating) || typeof review.isNew !== 'boolean') {
      invalid('некорректная запись в истории повторений.');
    }
    return { wordId: review.wordId, at: review.at, rating: review.rating as Rating, isNew: review.isNew };
  });
}

function validateState(raw: string, validWordIds?: Set<string>): AppState {
  if (raw.length > 15_000_000) invalid('файл слишком большой (максимум 15 МБ).');
  let parsed: unknown;
  try { parsed = JSON.parse(raw); } catch { invalid('файл содержит некорректный JSON.'); }
  if (!isRecord(parsed) || parsed.version !== 1) invalid('неподдерживаемая версия файла.');
  const cards = parseCards(parsed.cards, validWordIds);
  const reviews = parseReviews(parsed.reviews, validWordIds);
  let verbs: AppState['verbs'];
  if (parsed.verbs !== undefined) {
    if (!isRecord(parsed.verbs)) invalid('некорректный прогресс неправильных глаголов.');
    verbs = { cards: parseCards(parsed.verbs.cards, validWordIds), reviews: parseReviews(parsed.verbs.reviews, validWordIds) };
  }
  let grammar: AppState['grammar'];
  if (parsed.grammar !== undefined) {
    // Sentence ids are not checked against the data: a removed sentence must not block the progress.
    if (!isRecord(parsed.grammar) || !Array.isArray(parsed.grammar.answers) || parsed.grammar.answers.length > 250_000) {
      invalid('некорректная история упражнений по грамматике.');
    }
    grammar = {
      answers: parsed.grammar.answers.map((answer: unknown) => {
        if (!isRecord(answer) || typeof answer.id !== 'string' || !/^[a-z0-9-]{1,80}$/.test(answer.id) || !timestamp(answer.at)
          || !isTense(answer.chosen) || typeof answer.correct !== 'boolean') {
          invalid('некорректная запись в истории упражнений по грамматике.');
        }
        return { id: answer.id, at: answer.at, chosen: answer.chosen, correct: answer.correct };
      }),
    };
  }
  const settings = parsed.settings;
  if (!isRecord(settings) || !finiteRange(settings.dailyNewLimit, 0, 200) || !Number.isInteger(settings.dailyNewLimit)
    || !Array.isArray(settings.levels) || settings.levels.length === 0 || settings.levels.length > 4
    || settings.levels.some((level) => !['A1', 'A2', 'B1', 'B2'].includes(level))
    || new Set(settings.levels).size !== settings.levels.length
    || typeof settings.direction !== 'string' || !['en-ru', 'ru-en'].includes(settings.direction) || typeof settings.autoSpeak !== 'boolean') {
    invalid('некорректные настройки обучения.');
  }
  if (settings.theme !== undefined
    && (typeof settings.theme !== 'string' || !['system', 'light', 'dark'].includes(settings.theme))) {
    invalid('некорректная тема оформления.');
  }
  // An unknown but well-formed film id keeps the backup usable: the app then works without a mode.
  if (settings.film !== undefined && settings.film !== null
    && (typeof settings.film !== 'string' || !/^[a-z0-9-]{1,64}$/.test(settings.film))) {
    invalid('некорректный мод фильма.');
  }
  if (settings.voice !== undefined && !isVoice(settings.voice)) invalid('некорректный голос озвучки.');
  if (settings.zoom !== undefined && !isZoom(settings.zoom)) invalid('некорректный масштаб интерфейса.');
  if (settings.verbsDailyNew !== undefined
    && (!finiteRange(settings.verbsDailyNew, 0, MAX_VERBS_DAILY_NEW) || !Number.isInteger(settings.verbsDailyNew))) {
    invalid('некорректный лимит новых глаголов.');
  }
  if (settings.repeatSeconds !== undefined && !isRepeatSeconds(settings.repeatSeconds)) invalid('некорректный повтор озвучки.');
  // The first build of the repeat mode stored an on/off flag for a 5-second repeat.
  if (settings.repeatSpeech !== undefined && typeof settings.repeatSpeech !== 'boolean') invalid('некорректный повтор озвучки.');
  let dailyExtra: AppState['dailyExtra'];
  if (parsed.dailyExtra !== undefined) {
    const extra = parsed.dailyExtra;
    if (!isRecord(extra) || !validDayKey(extra.day) || !finiteRange(extra.count, 1, MAX_DAILY_EXTRA)
      || !Number.isInteger(extra.count)) {
      invalid('некорректный дополнительный лимит новых слов.');
    }
    dailyExtra = { day: extra.day, count: extra.count };
  }
  return {
    version: 1, cards, reviews,
    ...(dailyExtra ? { dailyExtra } : {}),
    ...(verbs ? { verbs } : {}),
    ...(grammar ? { grammar } : {}),
    settings: {
      dailyNewLimit: settings.dailyNewLimit,
      levels: [...settings.levels] as Level[],
      direction: settings.direction as Settings['direction'],
      autoSpeak: settings.autoSpeak,
      // Backups made before the repeat mode do not repeat.
      repeatSeconds: (settings.repeatSeconds ?? (settings.repeatSpeech === true ? 5 : 0)) as Settings['repeatSeconds'],
      // Older version-1 backups follow the operating system without losing progress.
      theme: (settings.theme ?? 'system') as Settings['theme'],
      // Backups made before the scale setting open at 100%.
      zoom: (settings.zoom ?? DEFAULT_ZOOM) as Settings['zoom'],
      // Backups made before the irregular verbs mode get the default daily limit.
      verbsDailyNew: (settings.verbsDailyNew ?? DEFAULT_VERBS_DAILY_NEW) as number,
      // Backups made before film modes start without a mode.
      film: (settings.film ?? null) as Settings['film'],
      // Backups made before recorded voices get the default voice.
      voice: (settings.voice ?? 'ryan') as Settings['voice'],
    },
  };
}

/** Import is atomic: validate the complete backup before replacing live state. */
export function parseBackup(raw: string, validWordIds: Set<string>): AppState {
  return validateState(raw, validWordIds);
}

function browserStorage(): StorageLike {
  try {
    if (typeof globalThis.localStorage !== 'undefined') return globalThis.localStorage;
  } catch { /* SecurityError is surfaced below. */ }
  throw new Error('Хранилище браузера недоступно. Разрешите сохранение данных для этого сайта.');
}

export function readState(storage: StorageLike = browserStorage(), validWordIds?: Set<string>): AppState {
  let raw: string | null;
  try { raw = storage.getItem(STORAGE_KEY); }
  catch { throw new Error('Не удалось прочитать прогресс из хранилища браузера.'); }
  return raw === null ? defaultState() : validateState(raw, validWordIds);
}

export function writeState(state: AppState, storage: StorageLike = browserStorage()): void {
  const raw = JSON.stringify(state);
  validateState(raw);
  try { storage.setItem(STORAGE_KEY, raw); }
  catch { throw new Error('Не удалось сохранить прогресс. Возможно, хранилище браузера переполнено или заблокировано. Экспортируйте резервную копию.'); }
}
