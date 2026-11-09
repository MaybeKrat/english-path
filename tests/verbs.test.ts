import assert from 'node:assert/strict';
import test from 'node:test';
import { defaultState, getStudyQueue, scheduleCard } from '../src/lib/scheduler.ts';
import { parseBackup } from '../src/lib/storage.ts';
import { askedForm, rateVerb, spokenForms, verbQueue, verbStats, type IrregularVerb } from '../src/lib/verbs.ts';
import type { Word } from '../src/lib/types.ts';

const NOW = new Date(2026, 10, 9, 12).getTime();
const verb = (base: string, past: string, participle: string, level: IrregularVerb['level'] = 'A1'): IrregularVerb =>
  ({ id: `verb-${base}`, base, past, participle, translation: '—', level, example: '', exampleTranslation: '', cards: [`card-${base}`] });
const allLearned = () => true;
const VERBS = [verb('go', 'went', 'gone'), verb('spit', 'spat', 'spat', 'B2'), verb('learn', 'learnt / learned', 'learnt / learned'), verb('see', 'saw', 'seen')];

test('Voices read both accepted forms', () => {
  assert.equal(spokenForms(VERBS[2]), 'learn, learnt or learned, learnt or learned');
});

test('Verbs have their own daily limit and do not use up new words', () => {
  let state = defaultState();
  state.settings.verbsDailyNew = 2;
  state.settings.dailyNewLimit = 1;
  // Level first, then list order: B2 "spit" waits for the A1 verbs.
  assert.deepEqual(verbQueue(VERBS, state, NOW, allLearned).map((item) => item.base), ['go', 'learn']);
  state = rateVerb(state, VERBS[0], 'good', NOW);
  state = rateVerb(state, VERBS[2], 'again', NOW + 1000);
  assert.deepEqual(state.cards, {});
  assert.deepEqual(verbQueue(VERBS, state, NOW + 2000, allLearned), []);
  assert.deepEqual(verbQueue(VERBS, state, NOW + 120_000, allLearned).map((item) => item.base), ['learn']);
  const words = [{ id: 'oxford-a', word: 'a', translation: 'а', level: 'A1', pos: 'сущ.' }] as Word[];
  assert.equal(getStudyQueue(words, state, NOW + 2000).length, 1);
  assert.deepEqual(verbStats(VERBS, state, NOW + 2000, allLearned), { learned: 1, started: 2, open: 2, total: 4, answersToday: 2 });
});

test('A new verb opens only after its word is learned; started verbs keep their reviews', () => {
  const learned = (id: string) => id === 'card-see';
  let state = defaultState();
  assert.deepEqual(verbQueue(VERBS, state, NOW, learned).map((item) => item.base), ['see']);
  state = rateVerb(state, VERBS[0], 'again', NOW);
  // "go" was started earlier, so it stays in reviews although its word is not learned now.
  assert.deepEqual(verbQueue(VERBS, state, NOW + 120_000, learned).map((item) => item.base), ['go', 'see']);
  assert.equal(verbStats(VERBS, state, NOW, learned).open, 1);
});

test('Backups keep verb progress and older backups get the default verb limit', () => {
  const ids = new Set(VERBS.map((item) => item.id));
  const state = rateVerb(defaultState(), VERBS[0], 'good', NOW);
  assert.deepEqual(parseBackup(JSON.stringify(state), ids), state);
  const old = defaultState() as Partial<ReturnType<typeof defaultState>> & { settings: Record<string, unknown> };
  delete old.settings.verbsDailyNew;
  assert.equal(parseBackup(JSON.stringify(old), ids).settings.verbsDailyNew, 5);
  const broken = { ...state, verbs: { cards: { 'verb-fly': scheduleCard(undefined, 'good', NOW) }, reviews: [] } };
  assert.throws(() => parseBackup(JSON.stringify(broken), ids), /неизвестная карточка/);
});

test('A card asks one form, Past Simple and Past Participle by turns', () => {
  let state = defaultState();
  assert.equal(askedForm(VERBS[0], state), 'past');
  state = rateVerb(state, VERBS[0], 'good', NOW);
  assert.equal(askedForm(VERBS[0], state), 'participle');
  assert.equal(askedForm(VERBS[1], state), 'past');
  state = rateVerb(state, VERBS[0], 'again', NOW + 1000);
  assert.equal(askedForm(VERBS[0], state), 'past');
});
