import type { AppState, GrammarAnswer, TenseId } from './types.ts';
import { localDayKey } from './scheduler.ts';

/** The four most used tenses of the reference and the exercises (decided 09.11.2026). */
export const TENSES: readonly TenseId[] = ['present-simple', 'present-continuous', 'past-simple', 'present-perfect'];

export const TENSE_NAMES: Record<TenseId, string> = {
  'present-simple': 'Present Simple',
  'present-continuous': 'Present Continuous',
  'past-simple': 'Past Simple',
  'present-perfect': 'Present Perfect',
};

export function isTense(value: unknown): value is TenseId {
  return TENSES.includes(value as TenseId);
}

/** A sentence of the "which tense?" exercise (src/data/grammar/tense-sentences.json). */
export interface TenseSentence {
  id: string;
  tense: TenseId;
  text: string;
  /** Exact parts of the text that make the verb form, in order. */
  verb: string[];
  /** Exact time marker in the text, or "" when only the verb form shows the tense. */
  cue: string;
  translation: string;
  /** Short Russian explanation. */
  why: string;
}

export const SESSION_SIZE = 10;

export function grammarAnswers(state: AppState): GrammarAnswer[] {
  return state.grammar?.answers ?? [];
}

/**
 * Sentences for one round: last answered wrong first, then never seen, then those seen longest ago;
 * the order inside the round is shuffled. `random` returns numbers in [0, 1).
 */
export function pickRound(sentences: readonly TenseSentence[], answers: readonly GrammarAnswer[], size = SESSION_SIZE, random = Math.random): TenseSentence[] {
  const last = new Map<string, GrammarAnswer>();
  for (const answer of answers) {
    const previous = last.get(answer.id);
    if (!previous || answer.at >= previous.at) last.set(answer.id, answer);
  }
  const rank = (sentence: TenseSentence) => {
    const answer = last.get(sentence.id);
    if (!answer) return 1;
    return answer.correct ? 2 : 0;
  };
  const picked = sentences
    .map((sentence) => ({ sentence, rank: rank(sentence), at: last.get(sentence.id)?.at ?? 0, tie: random() }))
    .sort((a, b) => a.rank - b.rank || a.at - b.at || a.tie - b.tie)
    .slice(0, size)
    .map((item) => ({ sentence: item.sentence, order: random() }));
  return picked.sort((a, b) => a.order - b.order).map((item) => item.sentence);
}

export function answerTense(state: AppState, sentence: TenseSentence, chosen: TenseId, at: number): AppState {
  return {
    ...state,
    grammar: { answers: [...grammarAnswers(state), { id: sentence.id, at, chosen, correct: chosen === sentence.tense }] },
  };
}

export interface Share {
  right: number;
  total: number;
}

/** Correct answers by the right tense over the latest `window` answers of each tense. */
export function tenseAccuracy(sentences: readonly TenseSentence[], answers: readonly GrammarAnswer[], window = 20): Record<TenseId, Share> {
  const tenseOf = new Map(sentences.map((sentence) => [sentence.id, sentence.tense]));
  const result = Object.fromEntries(TENSES.map((tense) => [tense, { right: 0, total: 0 }])) as Record<TenseId, Share>;
  for (const answer of [...answers].sort((a, b) => b.at - a.at)) {
    const tense = tenseOf.get(answer.id);
    if (!tense || result[tense].total >= window) continue;
    result[tense].total++;
    if (answer.correct) result[tense].right++;
  }
  return result;
}

export function answersToday(answers: readonly GrammarAnswer[], now: number): Share {
  const today = localDayKey(now);
  const list = answers.filter((answer) => localDayKey(answer.at) === today);
  return { right: list.filter((answer) => answer.correct).length, total: list.length };
}

export interface Segment {
  text: string;
  kind?: 'verb' | 'cue';
}

/** Splits the sentence so the verb parts and the time marker can be highlighted. */
export function highlight(sentence: TenseSentence): Segment[] {
  const marks: { start: number; end: number; kind: 'verb' | 'cue' }[] = [];
  let from = 0;
  for (const part of sentence.verb) {
    const start = sentence.text.indexOf(part, from);
    if (start < 0) continue;
    marks.push({ start, end: start + part.length, kind: 'verb' });
    from = start + part.length;
  }
  if (sentence.cue) {
    const start = sentence.text.indexOf(sentence.cue);
    const end = start + sentence.cue.length;
    if (start >= 0 && !marks.some((mark) => start < mark.end && mark.start < end)) marks.push({ start, end, kind: 'cue' });
  }
  marks.sort((a, b) => a.start - b.start);
  const segments: Segment[] = [];
  let at = 0;
  for (const mark of marks) {
    if (mark.start > at) segments.push({ text: sentence.text.slice(at, mark.start) });
    segments.push({ text: sentence.text.slice(mark.start, mark.end), kind: mark.kind });
    at = mark.end;
  }
  if (at < sentence.text.length) segments.push({ text: sentence.text.slice(at) });
  return segments;
}
