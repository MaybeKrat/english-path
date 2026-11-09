import type { AppState, Level, Rating, VerbProgress } from './types.ts';
import { localDayKey, scheduleCard } from './scheduler.ts';

/** A card of the irregular verbs mode (src/data/irregular-verbs.json). */
export interface IrregularVerb {
  id: string;
  base: string;
  /** Past Simple; two accepted forms are written as "learnt / learned". */
  past: string;
  /** Past Participle, the same way. */
  participle: string;
  translation: string;
  level: Level;
  example: string;
  exampleTranslation: string;
}

export const DEFAULT_VERBS_DAILY_NEW = 5;
export const MAX_VERBS_DAILY_NEW = 50;
const LEVEL_ORDER: Record<Level, number> = { A1: 0, A2: 1, B1: 2, B2: 3 };

export function verbProgress(state: AppState): VerbProgress {
  return state.verbs ?? { cards: {}, reviews: [] };
}

/** Text the voices read: "learn, learnt or learned, learnt or learned". Keep in sync with scripts/build-voices.py. */
export function spokenForms(verb: IrregularVerb): string {
  return [verb.base, verb.past, verb.participle].map((form) => form.split(' / ').join(' or ')).join(', ');
}

function normalize(text: string): string {
  return text.toLowerCase().replace(/[’']/g, "'").replace(/\s+/g, ' ').trim();
}

/** Whether a typed form is right: any accepted variant counts, and so does "learnt / learned" or "learnt or learned". */
export function formMatches(typed: string, expected: string): boolean {
  const accepted = new Set(expected.split('/').map(normalize));
  const parts = normalize(typed).split(/\s*(?:\/|,|\bor\b)\s*/).filter(Boolean);
  return parts.length > 0 && parts.every((part) => accepted.has(part));
}

/** New verbs order: by level, then by the order of the list (the most useful first). */
export function newVerbs(verbs: readonly IrregularVerb[], state: AppState): IrregularVerb[] {
  const { cards } = verbProgress(state);
  return verbs
    .map((verb, index) => ({ verb, index }))
    .filter(({ verb }) => !cards[verb.id])
    .sort((a, b) => LEVEL_ORDER[a.verb.level] - LEVEL_ORDER[b.verb.level] || a.index - b.index)
    .map(({ verb }) => verb);
}

/** Due verbs first, then new verbs within today's limit for the mode. */
export function verbQueue(verbs: readonly IrregularVerb[], state: AppState, now: number): IrregularVerb[] {
  const { cards, reviews } = verbProgress(state);
  const due = verbs.filter((verb) => cards[verb.id]?.due <= now)
    .sort((a, b) => cards[a.id]!.due - cards[b.id]!.due || a.id.localeCompare(b.id));
  const today = localDayKey(now);
  const newToday = new Set(reviews.filter((review) => review.isNew && localDayKey(review.at) === today).map((review) => review.wordId));
  const remaining = Math.max(0, state.settings.verbsDailyNew - newToday.size);
  return [...due, ...newVerbs(verbs, state).slice(0, remaining)];
}

export function rateVerb(state: AppState, verb: IrregularVerb, rating: Rating, at: number): AppState {
  const progress = verbProgress(state);
  return {
    ...state,
    verbs: {
      cards: { ...progress.cards, [verb.id]: scheduleCard(progress.cards[verb.id], rating, at, verb.id) },
      reviews: [...progress.reviews, { wordId: verb.id, at, rating, isNew: !progress.cards[verb.id] }],
    },
  };
}

export interface VerbStats {
  /** Latest answer is «Помню» or «Легко». */
  learned: number;
  started: number;
  total: number;
  answersToday: number;
}

export function verbStats(verbs: readonly IrregularVerb[], state: AppState, now: number): VerbStats {
  const { cards, reviews } = verbProgress(state);
  const last = new Map<string, Rating>();
  for (const review of [...reviews].sort((a, b) => a.at - b.at)) last.set(review.wordId, review.rating);
  const today = localDayKey(now);
  return {
    learned: verbs.filter((verb) => ['good', 'easy'].includes(last.get(verb.id) ?? '')).length,
    started: verbs.filter((verb) => cards[verb.id]).length,
    total: verbs.length,
    answersToday: reviews.filter((review) => localDayKey(review.at) === today).length,
  };
}
