// Irregular verbs mode: the card shows the Russian meaning; type or recall the three forms, then rate the answer as on
// word cards. A new verb opens once its word is learned on the cards (decided 09.11.2026).
import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowRight, AudioLines, Check, Lightbulb, Lock, RotateCcw, Search, X } from "lucide-react";
import verbData from "./data/irregular-verbs.json";
import { scheduleCard } from "./lib/scheduler";
import { stageOf } from "./lib/insights";
import {
  formMatches,
  isVerbOpen,
  rateVerb,
  spokenForms,
  verbProgress,
  verbQueue,
  verbStats,
  type IrregularVerb,
  type LearnedCheck,
} from "./lib/verbs";
import { intervalLabel, MemoryMeter, quantity } from "./shared";
import type { AppState, Rating } from "./lib/types";

export const irregularVerbs = verbData as IrregularVerb[];

const ratings: Rating[] = ["again", "hard", "good", "easy"];
const ratingLabels: Record<Rating, string> = { again: "Не помню", hard: "Сложно", good: "Помню", easy: "Легко" };

interface Props {
  state: AppState;
  now: number;
  saving: boolean;
  /** The page is shown and no dialog is open: keyboard shortcuts work. */
  active: boolean;
  save: (next: AppState) => Promise<boolean>;
  setNow: (at: number) => void;
  speak: (text: string) => void;
  prepare?: (text: string) => void;
  /** Text that is being prepared or spoken now. */
  speaking: string | null;
  openSettings: () => void;
  /** Learned word cards; see learnedCheck in src/lib/films.ts. */
  learned: LearnedCheck;
}

/** Splits the example around the first verb form it contains. */
function exampleParts(verb: IrregularVerb): [string, string, string] | null {
  const forms = [verb.past, verb.participle].flatMap((form) => form.split(" / "));
  for (const form of forms) {
    const match = new RegExp(`\\b${form}\\b`, "i").exec(verb.example);
    if (match) return [verb.example.slice(0, match.index), match[0], verb.example.slice(match.index + match[0].length)];
  }
  return null;
}

export function VerbsPage({ state, now, saving, active, save, setNow, speak, prepare, speaking, openSettings, learned }: Props) {
  const queue = useMemo(() => verbQueue(irregularVerbs, state, now, learned), [state, now, learned]);
  const stats = useMemo(() => verbStats(irregularVerbs, state, now, learned), [state, now, learned]);
  const progress = verbProgress(state);
  const verb = queue[0];
  const [revealed, setRevealed] = useState(false);
  const [hint, setHint] = useState(false);
  const [base, setBase] = useState("");
  const [past, setPast] = useState("");
  const [participle, setParticiple] = useState("");
  const [undoState, setUndoState] = useState<AppState | null>(null);
  const [query, setQuery] = useState("");
  const firstInput = useRef<HTMLInputElement>(null);
  const typed = base.trim() !== "" || past.trim() !== "" || participle.trim() !== "";
  const baseRight = verb ? formMatches(base, verb.base) : false;
  const pastRight = verb ? formMatches(past, verb.past) : false;
  const participleRight = verb ? formMatches(participle, verb.participle) : false;
  // Typed answers suggest a rating; the choice stays with the learner.
  const suggested: Rating | null = !typed ? null : baseRight && pastRight && participleRight ? "good" : "again";
  const newLeft = queue.filter((item) => !progress.cards[item.id]).length;
  const dueLeft = queue.length - newLeft;

  useEffect(() => {
    setRevealed(false);
    setHint(false);
    setBase("");
    setPast("");
    setParticiple("");
    if (verb && active) {
      firstInput.current?.focus();
      // The front is Russian: the forms are prepared silently and spoken after the answer opens.
      prepare?.(spokenForms(verb));
    }
  }, [verb?.id, active]);

  useEffect(() => {
    if (!verb || !revealed) return;
    if (state.settings.autoSpeak) speak(spokenForms(verb));
  }, [revealed]);

  function reveal() {
    if (!verb) return;
    setRevealed(true);
    (document.activeElement as HTMLElement | null)?.blur();
  }

  async function rate(rating: Rating) {
    if (!verb || !revealed || saving) return;
    const at = Date.now();
    if (await save(rateVerb(state, verb, rating, at))) {
      setUndoState(state);
      setNow(at);
    }
  }

  async function undo() {
    if (!undoState) return;
    // Only the verbs part goes back; words and settings keep their current state.
    const next: AppState = { ...state, verbs: undoState.verbs };
    if (!undoState.verbs) delete next.verbs;
    if (await save(next)) {
      setUndoState(null);
      setNow(Date.now());
    }
  }

  const rateRef = useRef(rate);
  rateRef.current = rate;
  const revealRef = useRef(reveal);
  revealRef.current = reveal;
  useEffect(() => {
    if (!active) return;
    function onKey(event: KeyboardEvent) {
      if (event.ctrlKey || event.metaKey || event.altKey || event.repeat) return;
      const target = event.target as HTMLElement;
      const inField = target.matches("input, textarea, select");
      if (!revealed) {
        if (event.key === "Enter" && (inField ? target.closest(".verb-inputs") : !target.closest("button, a"))) {
          event.preventDefault();
          revealRef.current();
        } else if (event.code === "Space" && !inField && !target.closest("button, a")) {
          event.preventDefault();
          revealRef.current();
        } else if (event.code === "KeyE" && !inField) {
          event.preventDefault();
          setHint(true);
        }
        return;
      }
      if (inField) return;
      const index = /^(?:Digit|Numpad)([1-4])$/.exec(event.code)?.[1];
      if (index) {
        event.preventDefault();
        rateRef.current(ratings[Number(index) - 1]);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [active, revealed]);

  const filtered = useMemo(() => {
    const text = query.trim().toLowerCase();
    if (!text) return irregularVerbs;
    return irregularVerbs.filter((item) =>
      [item.base, item.past, item.participle, item.translation].some((field) => field.toLowerCase().includes(text)),
    );
  }, [query]);

  function audioButton(text: string, label: string) {
    return (
      <button
        className={`audio-button${speaking === text ? " is-speaking" : ""}`}
        onClick={() => speak(text)}
        aria-label={label}
        title="Произнести с начала"
      >
        <AudioLines size={19} />
      </button>
    );
  }

  function formResult(value: string, right: boolean) {
    if (!value.trim()) return null;
    return (
      <span className={`verb-typed ${right ? "is-right" : "is-wrong"}`}>
        {right ? <Check size={14} /> : <X size={14} />}
        {value.trim()}
      </span>
    );
  }

  function renderCard(item: IrregularVerb) {
    const known = progress.cards[item.id];
    const parts = exampleParts(item);
    const intervals = ratings.map((rating) => intervalLabel(scheduleCard(known, rating, now, item.id).interval));
    return (
      <>
        <div className={`flashcard panel verb-card${revealed ? " is-revealed" : ""}`} key={item.id}>
          <div className="card-top">
            <span className="tag">Неправильные глаголы</span>
            <span className="tag tag-plain">{known ? "Повторение" : "Новый глагол"}</span>
            <span className="tag tag-level">{item.level}</span>
          </div>
          <div className="card-body">
            {!revealed && <span className="prompt-label">ВСПОМНИТЕ ТРИ ФОРМЫ</span>}
            {!revealed ? (
              <>
                <h2 className="card-word translation-prompt">{item.translation}</h2>
                {hint && <p className="example hint-example">{item.exampleTranslation}</p>}
                <div className="verb-inputs">
                  <label>
                    <span>Infinitive</span>
                    <input
                      ref={firstInput}
                      value={base}
                      onChange={(event) => setBase(event.target.value)}
                      autoComplete="off"
                      spellCheck={false}
                      placeholder="можно не вводить"
                    />
                  </label>
                  <label>
                    <span>Past Simple</span>
                    <input
                      value={past}
                      onChange={(event) => setPast(event.target.value)}
                      autoComplete="off"
                      spellCheck={false}
                      placeholder="можно не вводить"
                    />
                  </label>
                  <label>
                    <span>Past Participle</span>
                    <input
                      value={participle}
                      onChange={(event) => setParticiple(event.target.value)}
                      autoComplete="off"
                      spellCheck={false}
                      placeholder="можно не вводить"
                    />
                  </label>
                </div>
              </>
            ) : (
              <div className="answer" aria-live="polite">
                <div className="verb-forms">
                  {[
                    ["Infinitive", item.base],
                    ["Past Simple", item.past],
                    ["Past Participle", item.participle],
                  ].map(([label, form]) => (
                    <div key={label}>
                      <small>{label}</small>
                      <strong>{form}</strong>
                    </div>
                  ))}
                </div>
                <div className="word-meta">
                  <span>{item.translation}</span>
                  {audioButton(spokenForms(item), `Произнести ${item.base}, ${item.past}, ${item.participle}`)}
                </div>
                {typed && (
                  <p className="verb-check">
                    Вы ввели: {formResult(base, baseRight)} {formResult(past, pastRight)} {formResult(participle, participleRight)}
                  </p>
                )}
                <p className="example">
                  {parts ? (
                    <>
                      {parts[0]}
                      <mark>{parts[1]}</mark>
                      {parts[2]}
                    </>
                  ) : (
                    item.example
                  )}
                </p>
                <p className="example-translation">{item.exampleTranslation}</p>
              </div>
            )}
          </div>
          <div className="card-foot">
            {!revealed && !hint ? (
              <button className="hint-button" onClick={() => setHint(true)}>
                <Lightbulb size={15} />
                Не ясно, какой глагол? Покажите пример
                <kbd>E</kbd>
              </button>
            ) : (
              <span>{revealed ? "Насколько легко вспомнили?" : "Введите формы или вспомните про себя"}</span>
            )}
            <span>Русский → три формы</span>
          </div>
        </div>
        {!revealed ? (
          <button className="reveal-button" onClick={reveal}>
            {typed ? "Проверить" : "Показать формы"}
            <ArrowRight size={18} />
            <kbd>Enter</kbd>
          </button>
        ) : (
          <div className="rating-grid" aria-label="Оцените ответ">
            {ratings.map((rating, index) => (
              <button
                key={rating}
                className={`rating rating-${rating}${suggested === rating ? " is-suggested" : ""}`}
                disabled={saving}
                onClick={() => rate(rating)}
              >
                <span>{ratingLabels[rating]}</span>
                <strong>{intervals[index]}</strong>
                <kbd>{index + 1}</kbd>
              </button>
            ))}
          </div>
        )}
        <div className="practice-footer">
          <span>
            {revealed
              ? suggested === "good"
                ? "Все формы верны. Оцените ответ клавишами 1–4"
                : suggested === "again"
                  ? "Есть ошибка. Оцените ответ клавишами 1–4"
                  : "Оцените ответ клавишами 1–4"
              : "Enter — проверить, Tab — к следующему полю"}
          </span>
          <button disabled={!undoState || saving} onClick={undo}>
            <RotateCcw size={14} />
            Отменить
          </button>
        </div>
      </>
    );
  }

  function renderDone() {
    const nextDue = Object.values(progress.cards)
      .map((card) => card.due)
      .filter((due) => due > now)
      .sort((a, b) => a - b)[0];
    const locked = irregularVerbs.length - stats.started - stats.open;
    return (
      <div className="panel done-panel">
        <div className="done-center">
          <span className="done-icon">
            <Check size={26} />
          </span>
          <h2>Глаголы на сегодня пройдены</h2>
          <p>
            {nextDue
              ? `Следующее повторение — ${new Date(nextDue).toLocaleString("ru-RU", { day: "numeric", month: "long", hour: "2-digit", minute: "2-digit" })}.`
              : "Повторений пока нет."}{" "}
            {stats.open > 0
              ? `Новых глаголов в день: ${state.settings.verbsDailyNew}, открыто и ещё не начато: ${stats.open}.`
              : "Все открытые глаголы начаты."}{" "}
            {locked > 0 &&
              `Ещё ${locked} ${quantity(locked, "глагол откроется", "глагола откроются", "глаголов откроются")}, когда их слова будут выучены в «Практике».`}
          </p>
          <button className="secondary-button" onClick={openSettings}>
            Изменить лимит новых глаголов
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="verbs-page">
      <section className="practice-column verbs-practice">
        <div className="session">
          <div className="session-row">
            <h1>Неправильные глаголы</h1>
            <span className="session-left">
              {queue.length
                ? `осталось ${queue.length} ${quantity(queue.length, "глагол", "глагола", "глаголов")}: повторений ${dueLeft}, новых ${newLeft}`
                : "на сегодня всё"}
            </span>
          </div>
          <div className="session-legend">
            <span>
              Изучено <strong>{stats.learned}</strong> из {stats.total}
            </span>
            <span>
              Начато <strong>{stats.started}</strong>
            </span>
            <span title="Глагол открывается, когда его слово выучено в «Практике»">
              Открыто новых <strong>{stats.open}</strong>
            </span>
            <span>
              Ответов сегодня <strong>{stats.answersToday}</strong>
            </span>
          </div>
        </div>
        {verb ? renderCard(verb) : renderDone()}
      </section>
      <section className="verbs-table">
        <div className="page-head">
          <h2>Все глаголы</h2>
          <span>{filtered.length}</span>
        </div>
        <label className="search-field">
          <Search size={17} />
          <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Поиск по форме или переводу" />
          {query && (
            <button aria-label="Очистить поиск" onClick={() => setQuery("")}>
              <X size={15} />
            </button>
          )}
        </label>
        <div className="panel word-table">
          <div className="table-head verb-row">
            <span>INFINITIVE</span>
            <span>PAST SIMPLE</span>
            <span>PAST PARTICIPLE</span>
            <span>ПЕРЕВОД</span>
            <span>ПАМЯТЬ</span>
          </div>
          {filtered.map((item) => (
            <button key={item.id} className="word-row verb-row" onClick={() => speak(spokenForms(item))} title="Произнести три формы">
              <span className="row-word">
                <strong>{item.base}</strong>
                <small>{item.level}</small>
              </span>
              <span className="row-form">{item.past}</span>
              <span className="row-form">{item.participle}</span>
              <span className="row-translation">{item.translation}</span>
              {progress.cards[item.id] || isVerbOpen(item, learned) ? (
                <MemoryMeter stage={stageOf(progress.cards[item.id])} />
              ) : (
                <span
                  className="row-locked"
                  title={item.cards.length ? "Откроется, когда слово будет выучено в «Практике»" : "Этого слова нет в карточках"}
                >
                  <Lock size={13} />
                </span>
              )}
            </button>
          ))}
        </div>
      </section>
    </div>
  );
}
