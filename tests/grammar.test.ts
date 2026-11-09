import assert from 'node:assert/strict';
import test from 'node:test';
import { defaultState, getStats } from '../src/lib/scheduler.ts';
import { parseBackup } from '../src/lib/storage.ts';
import { answerTense, highlight, pickRound, tenseAccuracy, type TenseSentence } from '../src/lib/grammar.ts';

const NOW = new Date(2026, 10, 9, 12).getTime();
const sentence = (id: string, tense: TenseSentence['tense'], text = 'She has lived here since 2020.'): TenseSentence =>
  ({ id, tense, text, verb: ['has lived'], cue: 'since 2020', translation: '—', why: '—' });
const SENTENCES = ['a', 'b', 'c', 'd', 'e'].map((id) => sentence(id, 'present-perfect'));

test('A round brings back mistakes first, then unseen sentences, then the oldest seen', () => {
  const answers = [
    { id: 'a', at: NOW - 3000, chosen: 'past-simple' as const, correct: false },
    { id: 'b', at: NOW - 2000, chosen: 'present-perfect' as const, correct: true },
    { id: 'c', at: NOW - 1000, chosen: 'present-perfect' as const, correct: true },
    // The latest answer counts: "d" was wrong once but answered right since.
    { id: 'd', at: NOW - 5000, chosen: 'past-simple' as const, correct: false },
    { id: 'd', at: NOW - 4000, chosen: 'present-perfect' as const, correct: true },
  ];
  const round = pickRound(SENTENCES, answers, 3, () => 0.5);
  assert.deepEqual(new Set(round.map((item) => item.id)), new Set(['a', 'e', 'd']));
  assert.equal(pickRound(SENTENCES, [], 10).length, 5);
});

test('The verb and the time marker are highlighted in place', () => {
  const question = { ...sentence('q', 'present-perfect', 'Have you ever been to Rome?'), verb: ['Have', 'been'], cue: 'ever' };
  assert.deepEqual(highlight(question), [
    { text: 'Have', kind: 'verb' },
    { text: ' you ' },
    { text: 'ever', kind: 'cue' },
    { text: ' ' },
    { text: 'been', kind: 'verb' },
    { text: ' to Rome?' },
  ]);
});

test('Grammar answers are saved, counted by tense and keep the streak', () => {
  let state = defaultState();
  state = answerTense(state, SENTENCES[0], 'past-simple', NOW);
  state = answerTense(state, SENTENCES[1], 'present-perfect', NOW + 1000);
  assert.deepEqual(state.grammar!.answers.map((answer) => answer.correct), [false, true]);
  assert.deepEqual(tenseAccuracy(SENTENCES, state.grammar!.answers)['present-perfect'], { right: 1, total: 2 });
  assert.deepEqual(parseBackup(JSON.stringify(state), new Set()), state);
  assert.equal(getStats([], state, NOW + 2000).streak, 1);
  const broken = { ...state, grammar: { answers: [{ id: 'a', at: NOW, chosen: 'future-perfect', correct: true }] } };
  assert.throws(() => parseBackup(JSON.stringify(broken), new Set()), /грамматике/);
});
