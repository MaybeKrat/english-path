// Grammar: a reference of five tenses and the "which tense?" exercise (chosen by Ivan 09.11.2026).
import { Fragment, useEffect, useMemo, useRef, useState } from "react";
import { ArrowRight, BookOpen, Check, RotateCcw, X } from "lucide-react";
import sentenceData from "./data/grammar/tense-sentences.json";
import {
  answersToday,
  answerTense,
  grammarAnswers,
  highlight,
  pickRound,
  TENSE_NAMES,
  tenseAccuracy,
  TENSES,
  type TenseSentence,
} from "./lib/grammar";
import { tenseRules } from "./grammarReference";
import type { AppState, TenseId } from "./lib/types";

export const tenseSentences = sentenceData as TenseSentence[];

interface Props {
  state: AppState;
  now: number;
  saving: boolean;
  /** The page is shown and no dialog is open: keyboard shortcuts work. */
  active: boolean;
  save: (next: AppState) => Promise<boolean>;
}

interface Round {
  items: TenseSentence[];
  index: number;
  chosen: TenseId | null;
  results: { sentence: TenseSentence; chosen: TenseId }[];
}

function newRound(state: AppState): Round {
  return { items: pickRound(tenseSentences, grammarAnswers(state)), index: 0, chosen: null, results: [] };
}

function Sentence({ sentence, marked }: { sentence: TenseSentence; marked: boolean }) {
  if (!marked) return <>{sentence.text}</>;
  return (
    <>
      {highlight(sentence).map((segment, index) =>
        segment.kind === "verb" ? (
          <mark key={index}>{segment.text}</mark>
        ) : segment.kind === "cue" ? (
          <u key={index} className="tense-cue">
            {segment.text}
          </u>
        ) : (
          <Fragment key={index}>{segment.text}</Fragment>
        ),
      )}
    </>
  );
}

export function GrammarPage({ state, now, saving, active, save }: Props) {
  const [tab, setTab] = useState<"exercise" | "reference">("exercise");
  const [round, setRound] = useState<Round>(() => newRound(state));
  const [ruleTarget, setRuleTarget] = useState<TenseId | null>(null);
  const answers = grammarAnswers(state);
  const today = answersToday(answers, now);
  const accuracy = useMemo(() => tenseAccuracy(tenseSentences, answers), [answers]);
  const sentence = round.items[round.index];
  const finished = !sentence;

  async function choose(tense: TenseId) {
    if (!sentence || round.chosen || saving) return;
    if (await save(answerTense(state, sentence, tense, Date.now()))) {
      setRound({ ...round, chosen: tense, results: [...round.results, { sentence, chosen: tense }] });
    }
  }

  function next() {
    if (!round.chosen) return;
    setRound({ ...round, index: round.index + 1, chosen: null });
  }

  function openRule(tense: TenseId) {
    setTab("reference");
    setRuleTarget(tense);
  }

  useEffect(() => {
    if (tab !== "reference" || !ruleTarget) return;
    document.getElementById(`rule-${ruleTarget}`)?.scrollIntoView({ behavior: "smooth", block: "start" });
    setRuleTarget(null);
  }, [tab, ruleTarget]);

  const chooseRef = useRef(choose);
  chooseRef.current = choose;
  const nextRef = useRef(next);
  nextRef.current = next;
  useEffect(() => {
    if (!active || tab !== "exercise") return;
    function onKey(event: KeyboardEvent) {
      if (event.ctrlKey || event.metaKey || event.altKey || event.repeat) return;
      const target = event.target as HTMLElement;
      if (target.matches("input, textarea, select")) return;
      const digit = /^(?:Digit|Numpad)([1-5])$/.exec(event.code)?.[1];
      if (digit && !round.chosen) {
        event.preventDefault();
        chooseRef.current(TENSES[Number(digit) - 1]);
      } else if ((event.key === "Enter" || event.code === "Space") && round.chosen && !target.closest("button, a")) {
        event.preventDefault();
        nextRef.current();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [active, tab, round.chosen]);

  function renderQuestion(item: TenseSentence) {
    const chosen = round.chosen;
    const right = chosen === item.tense;
    return (
      <>
        <div className="flashcard panel tense-card" key={item.id}>
          <div className="card-top">
            <span className="tag">Определи время</span>
            <span className="tag tag-plain">
              {round.index + 1} из {round.items.length}
            </span>
          </div>
          <div className="card-body">
            {!chosen && <span className="prompt-label">КАКОЕ ЭТО ВРЕМЯ?</span>}
            <p className="tense-sentence">
              <Sentence sentence={item} marked={!!chosen} />
            </p>
            {chosen && (
              <div className="answer tense-feedback" aria-live="polite">
                <h3 className={right ? "is-right" : "is-wrong"}>
                  {right ? <Check size={20} /> : <X size={20} />}
                  {right ? `Верно: ${TENSE_NAMES[item.tense]}` : `Это ${TENSE_NAMES[item.tense]}, а не ${TENSE_NAMES[chosen]}`}
                </h3>
                <p className="tense-why">{item.why}</p>
                <p className="example-translation">{item.translation}</p>
                <button className="link-button" onClick={() => openRule(item.tense)}>
                  <BookOpen size={14} />
                  Правило: {TENSE_NAMES[item.tense]}
                </button>
              </div>
            )}
          </div>
          <div className="card-foot">
            <span>{chosen ? "Глагол выделен, подсказка подчёркнута" : "Смотрите на форму глагола и слова-подсказки"}</span>
            <span>Английский → время</span>
          </div>
        </div>
        <div className="tense-options" aria-label="Выберите время">
          {TENSES.map((tense, index) => (
            <button
              key={tense}
              className={`tense-option${chosen && tense === item.tense ? " is-right" : ""}${chosen === tense && !right ? " is-wrong" : ""}`}
              disabled={!!chosen || saving}
              onClick={() => choose(tense)}
            >
              <span>{TENSE_NAMES[tense]}</span>
              <kbd>{index + 1}</kbd>
            </button>
          ))}
        </div>
        <div className="practice-footer">
          <span>{chosen ? "Enter или Пробел — следующее предложение" : "Ответ — клавишами 1–5"}</span>
          {chosen && (
            <button onClick={next}>
              Дальше
              <ArrowRight size={14} />
            </button>
          )}
        </div>
      </>
    );
  }

  function renderSummary() {
    const right = round.results.filter((result) => result.chosen === result.sentence.tense).length;
    const mistakes = round.results.filter((result) => result.chosen !== result.sentence.tense);
    return (
      <div className="panel done-panel tense-summary">
        <div className="done-center">
          <span className="done-icon">
            <Check size={26} />
          </span>
          <h2>
            Верно {right} из {round.results.length}
          </h2>
          {mistakes.length > 0 ? (
            <ul className="tense-mistakes">
              {mistakes.map(({ sentence: item, chosen }) => (
                <li key={item.id}>
                  <p>
                    <Sentence sentence={item} marked />
                  </p>
                  <small>
                    Ваш ответ: {TENSE_NAMES[chosen]} · верно: <b>{TENSE_NAMES[item.tense]}</b>
                  </small>
                </li>
              ))}
            </ul>
          ) : (
            <p>Ошибок нет.</p>
          )}
          <p className="tense-mistakes-note">Предложения с ошибками придут в следующих раундах первыми.</p>
          <button className="primary-button" onClick={() => setRound(newRound(state))}>
            <RotateCcw size={16} />
            Ещё {round.items.length} предложений
          </button>
        </div>
      </div>
    );
  }

  function renderReference() {
    return (
      <div className="reference">
        <div className="panel reference-overview">
          <div className="reference-row reference-head">
            <span>ВРЕМЯ</span>
            <span>КОГДА</span>
            <span>ФОРМУЛА</span>
            <span>ПРИМЕР</span>
          </div>
          {tenseRules.map((rule) => (
            <button key={rule.id} className="reference-row" onClick={() => openRule(rule.id)}>
              <strong>{rule.name}</strong>
              <span>{rule.idea}</span>
              <code>{rule.formula}</code>
              <span>
                {rule.example.en}
                <small>{rule.example.ru}</small>
              </span>
            </button>
          ))}
        </div>
        {tenseRules.map((rule) => (
          <section key={rule.id} id={`rule-${rule.id}`} className="panel rule">
            <div className="rule-head">
              <h2>{rule.name}</h2>
              <span>{rule.ru}</span>
              {accuracy[rule.id].total > 0 && (
                <span className="rule-score" title="Верные ответы в упражнении за последние 20 предложений этого времени">
                  в упражнении верно {accuracy[rule.id].right} из {accuracy[rule.id].total}
                </span>
              )}
            </div>
            <h3>Когда</h3>
            <ul className="rule-uses">
              {rule.uses.map((use) => (
                <li key={use.title}>
                  <b>{use.title}</b>
                  <span>
                    {use.example.en} <small>{use.example.ru}</small>
                  </span>
                </li>
              ))}
            </ul>
            <h3>Как строится</h3>
            <div className="rule-forms">
              {rule.forms.map((form) => (
                <div key={form.label}>
                  <span className="rule-sign">{form.label}</span>
                  <span>
                    <code>{form.text}</code>
                    <span>
                      {form.example.en} <small>{form.example.ru}</small>
                    </span>
                  </span>
                </div>
              ))}
            </div>
            <h3>Слова-подсказки</h3>
            <div className="rule-markers">
              {rule.markers.map((marker) => (
                <span key={marker} className="chip">
                  {marker}
                </span>
              ))}
            </div>
            <h3>Частые ошибки</h3>
            <ul className="rule-mistakes">
              {rule.mistakes.map((mistake) => (
                <li key={mistake.wrong}>
                  <span>
                    <s>{mistake.wrong}</s> → <b>{mistake.right}</b>
                  </span>
                  <small>{mistake.note}</small>
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>
    );
  }

  return (
    <div className="grammar-page">
      <div className="session">
        <div className="session-row">
          <h1>Грамматика</h1>
          <div className="segmented grammar-tabs" role="tablist">
            <button role="tab" aria-selected={tab === "exercise"} className={tab === "exercise" ? "selected" : ""} onClick={() => setTab("exercise")}>
              Определи время
            </button>
            <button role="tab" aria-selected={tab === "reference"} className={tab === "reference" ? "selected" : ""} onClick={() => setTab("reference")}>
              Справочник
            </button>
          </div>
        </div>
        {tab === "exercise" && (
          <div className="session-legend">
            <span>
              Сегодня ответов <strong>{today.total}</strong>
            </span>
            {today.total > 0 && (
              <span>
                верно <strong>{Math.round((today.right / today.total) * 100)}%</strong>
              </span>
            )}
            <span>
              В наборе <strong>{tenseSentences.length}</strong> предложений
            </span>
          </div>
        )}
      </div>
      {tab === "reference" ? (
        renderReference()
      ) : (
        <section className="practice-column grammar-practice">{finished ? renderSummary() : renderQuestion(sentence)}</section>
      )}
    </div>
  );
}
