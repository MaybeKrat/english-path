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
  /** Word cards of this verb (Oxford 3000 or a film); a new verb opens once one of them is learned. */
  cards: string[];
}

/** Whether a word card counts as learned; learnedCheck in films.ts. */
export type LearnedCheck = (id: string) => boolean;

/** A verb is open for study after its word is learned on the cards (decided 09.11.2026); started verbs stay. */
export function isVerbOpen(verb: IrregularVerb, learned: LearnedCheck): boolean {
  return verb.cards.some(learned);
}

export const DEFAULT_VERBS_DAILY_NEW = 5;
export const MAX_VERBS_DAILY_NEW = 50;
const LEVEL_ORDER: Record<Level, number> = { A1: 0, A2: 1, B1: 2, B2: 3 };

export function verbProgress(state: AppState): VerbProgress {
  return state.verbs ?? { cards: {}, reviews: [] };
}

/** The form a card asks for: one at a time (Ivan, 09.11.2026), Past Simple and Past Participle by turns. */
export type AskedForm = 'past' | 'participle';

export const FORM_NAMES: Record<AskedForm, string> = { past: 'Past Simple', participle: 'Past Participle' };

/** Even number of earlier answers on the verb — Past Simple, odd — Past Participle; so each review switches the form. */
export function askedForm(verb: IrregularVerb, state: AppState): AskedForm {
  const answers = verbProgress(state).reviews.filter((review) => review.wordId === verb.id).length;
  return answers % 2 === 0 ? 'past' : 'participle';
}

/** Text the voices read: "learn, learnt or learned, learnt or learned". Keep in sync with scripts/build-voices.py. */
export function spokenForms(verb: IrregularVerb): string {
  return [verb.base, verb.past, verb.participle].map((form) => form.split(' / ').join(' or ')).join(', ');
}

/** New verbs order: by level, then by the order of the list (the most useful first). */
export function newVerbs(verbs: readonly IrregularVerb[], state: AppState, learned: LearnedCheck): IrregularVerb[] {
  const { cards } = verbProgress(state);
  return verbs
    .map((verb, index) => ({ verb, index }))
    .filter(({ verb }) => !cards[verb.id] && isVerbOpen(verb, learned))
    .sort((a, b) => LEVEL_ORDER[a.verb.level] - LEVEL_ORDER[b.verb.level] || a.index - b.index)
    .map(({ verb }) => verb);
}

/** Due verbs first, then new verbs within today's limit for the mode. */
export function verbQueue(verbs: readonly IrregularVerb[], state: AppState, now: number, learned: LearnedCheck): IrregularVerb[] {
  const { cards, reviews } = verbProgress(state);
  const due = verbs.filter((verb) => cards[verb.id]?.due <= now)
    .sort((a, b) => cards[a.id]!.due - cards[b.id]!.due || a.id.localeCompare(b.id));
  const today = localDayKey(now);
  const newToday = new Set(reviews.filter((review) => review.isNew && localDayKey(review.at) === today).map((review) => review.wordId));
  const remaining = Math.max(0, state.settings.verbsDailyNew - newToday.size);
  return [...due, ...newVerbs(verbs, state, learned).slice(0, remaining)];
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
  /** Not started yet, but their word is learned. */
  open: number;
  total: number;
  answersToday: number;
}

export function verbStats(verbs: readonly IrregularVerb[], state: AppState, now: number, learned: LearnedCheck): VerbStats {
  const { cards, reviews } = verbProgress(state);
  const last = new Map<string, Rating>();
  for (const review of [...reviews].sort((a, b) => a.at - b.at)) last.set(review.wordId, review.rating);
  const today = localDayKey(now);
  return {
    learned: verbs.filter((verb) => ['good', 'easy'].includes(last.get(verb.id) ?? '')).length,
    started: verbs.filter((verb) => cards[verb.id]).length,
    open: newVerbs(verbs, state, learned).length,
    total: verbs.length,
    answersToday: reviews.filter((review) => localDayKey(review.at) === today).length,
  };
}
