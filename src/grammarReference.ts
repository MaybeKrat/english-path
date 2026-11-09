// Grammar reference: the five tenses chosen by Ivan 09.11.2026. Texts are written for a Russian-speaking learner.
import type { TenseId } from "./lib/types";

export interface Example {
  en: string;
  ru: string;
}

export interface TenseRule {
  id: TenseId;
  name: string;
  /** Russian name. */
  ru: string;
  /** One-line idea. */
  idea: string;
  formula: string;
  example: Example;
  uses: { title: string; example: Example }[];
  forms: { label: string; text: string; example: Example }[];
  markers: string[];
  mistakes: { wrong: string; right: string; note: string }[];
}

export const tenseRules: TenseRule[] = [
  {
    id: "present-simple",
    name: "Present Simple",
    ru: "Настоящее простое",
    idea: "Обычно, регулярно, всегда так",
    formula: "V / V+s",
    example: { en: "She works in a bank.", ru: "Она работает в банке." },
    uses: [
      { title: "Привычки и регулярные действия", example: { en: "I go to the gym on Mondays.", ru: "Я хожу в спортзал по понедельникам." } },
      { title: "Факты и общие истины", example: { en: "Water boils at 100 degrees.", ru: "Вода кипит при 100 градусах." } },
      { title: "Расписания", example: { en: "The train leaves at seven.", ru: "Поезд отправляется в семь." } },
      {
        title: "Состояния: know, like, want, need, believe, understand",
        example: { en: "He knows the answer.", ru: "Он знает ответ." },
      },
    ],
    forms: [
      { label: "+", text: "I / you / we / they work · he / she / it works", example: { en: "My brother lives in Kazan.", ru: "Мой брат живёт в Казани." } },
      { label: "−", text: "don't / doesn't + глагол", example: { en: "She doesn't eat meat.", ru: "Она не ест мясо." } },
      { label: "?", text: "Do / Does + подлежащее + глагол", example: { en: "Do you speak French?", ru: "Ты говоришь по-французски?" } },
    ],
    markers: ["usually", "always", "often", "sometimes", "never", "every day", "on Mondays", "twice a week"],
    mistakes: [
      { wrong: "He work here.", right: "He works here.", note: "С he, she, it к глаголу добавляется -s." },
      { wrong: "Does she likes tea?", right: "Does she like tea?", note: "После does и doesn't глагол без -s: окончание уже «забрал» does." },
      { wrong: "I am knowing him.", right: "I know him.", note: "Глаголы состояния обычно не ставят в Continuous." },
    ],
  },
  {
    id: "present-continuous",
    name: "Present Continuous",
    ru: "Настоящее продолженное",
    idea: "Происходит сейчас, временно",
    formula: "am / is / are + V-ing",
    example: { en: "She is working now.", ru: "Она сейчас работает." },
    uses: [
      { title: "Происходит прямо сейчас", example: { en: "Look! It's snowing.", ru: "Смотри! Идёт снег." } },
      { title: "Временная ситуация", example: { en: "I'm living with my parents this month.", ru: "В этом месяце я живу у родителей." } },
      { title: "Договорились на будущее", example: { en: "We're meeting Tom tomorrow.", ru: "Завтра мы встречаемся с Томом." } },
      { title: "Изменения", example: { en: "Prices are rising.", ru: "Цены растут." } },
    ],
    forms: [
      { label: "+", text: "I am · he / she / it is · you / we / they are + V-ing", example: { en: "They are watching a film.", ru: "Они смотрят фильм." } },
      { label: "−", text: "am not / isn't / aren't + V-ing", example: { en: "He isn't listening.", ru: "Он не слушает." } },
      { label: "?", text: "Am / Is / Are + подлежащее + V-ing", example: { en: "Are you waiting for a bus?", ru: "Ты ждёшь автобус?" } },
    ],
    markers: ["now", "right now", "at the moment", "today", "this week", "Look!", "Listen!", "tomorrow (договорённость)"],
    mistakes: [
      { wrong: "She working now.", right: "She is working now.", note: "Без am / is / are форма с -ing не работает." },
      { wrong: "I'm wanting a coffee.", right: "I want a coffee.", note: "want, like, know, need — состояния, они в Present Simple." },
      { wrong: "I go to the cinema tonight.", right: "I'm going to the cinema tonight.", note: "Договорённость на будущее — Continuous, не Simple." },
    ],
  },
  {
    id: "past-simple",
    name: "Past Simple",
    ru: "Прошедшее простое",
    idea: "Было и закончилось, известно когда",
    formula: "V-ed / 2-я форма",
    example: { en: "She worked late yesterday.", ru: "Вчера она работала допоздна." },
    uses: [
      { title: "Закончилось в прошлом, время известно или понятно", example: { en: "I saw him yesterday.", ru: "Я видел его вчера." } },
      { title: "Цепочка событий в прошлом", example: { en: "He came home, had dinner and went to bed.", ru: "Он пришёл домой, поужинал и лёг спать." } },
      { title: "Вопрос «когда?»", example: { en: "When did you arrive?", ru: "Когда ты приехал?" } },
    ],
    forms: [
      {
        label: "+",
        text: "правильные: V-ed (worked) · неправильные: 2-я форма (went) — раздел «Глаголы»",
        example: { en: "We visited Rome in 2019.", ru: "Мы были в Риме в 2019 году." },
      },
      { label: "−", text: "didn't + глагол", example: { en: "I didn't go out last night.", ru: "Вчера вечером я никуда не ходил." } },
      { label: "?", text: "Did + подлежащее + глагол", example: { en: "Did you call her?", ru: "Ты ей позвонил?" } },
    ],
    markers: ["yesterday", "last week", "last year", "ago", "in 2019", "when…?", "then"],
    mistakes: [
      { wrong: "Did you went there?", right: "Did you go there?", note: "После did и didn't — начальная форма: прошлое уже показал did." },
      { wrong: "I have seen him yesterday.", right: "I saw him yesterday.", note: "Есть законченное время (yesterday, ago, in 2019) — только Past Simple." },
    ],
  },
  {
    id: "present-perfect",
    name: "Present Perfect",
    ru: "Настоящее совершённое",
    idea: "Было в прошлом, важно сейчас",
    formula: "have / has + 3-я форма",
    example: { en: "She has worked here since 2020.", ru: "Она работает здесь с 2020 года." },
    uses: [
      { title: "Опыт в жизни — когда, неважно", example: { en: "Have you ever been to London?", ru: "Ты когда-нибудь был в Лондоне?" } },
      { title: "Результат виден сейчас", example: { en: "I've lost my keys.", ru: "Я потерял ключи (и их у меня нет)." } },
      { title: "Длится до сих пор — since, for", example: { en: "We have known each other for ten years.", ru: "Мы знакомы десять лет." } },
      { title: "Только что, уже, ещё не — just, already, yet", example: { en: "The film has just started.", ru: "Фильм только что начался." } },
    ],
    forms: [
      {
        label: "+",
        text: "I / you / we / they have · he / she / it has + 3-я форма (Past Participle)",
        example: { en: "She has finished her report.", ru: "Она закончила отчёт." },
      },
      { label: "−", text: "haven't / hasn't + 3-я форма", example: { en: "I haven't read this book.", ru: "Я не читал эту книгу." } },
      { label: "?", text: "Have / Has + подлежащее + 3-я форма", example: { en: "Has he called yet?", ru: "Он уже звонил?" } },
    ],
    markers: ["ever", "never", "already", "yet", "just", "since", "for", "so far", "recently", "this week (неделя не кончилась)"],
    mistakes: [
      { wrong: "I live here for five years.", right: "I have lived here for five years.", note: "«Уже столько-то времени» с for и since — Present Perfect, хотя по-русски настоящее." },
      { wrong: "I have been to Paris last year.", right: "I went to Paris last year.", note: "Назвали, когда (last year) — Past Simple." },
      {
        wrong: "Did you ever try sushi?",
        right: "Have you ever tried sushi?",
        note: "Опыт за всю жизнь, без времени — Present Perfect. В русском одна форма прошедшего, в английском выбор зависит от связи с «сейчас».",
      },
    ],
  },
  {
    id: "future-simple",
    name: "Future Simple",
    ru: "Будущее простое",
    idea: "Будет: прогноз, обещание, решение сейчас",
    formula: "will + V",
    example: { en: "She will work from home tomorrow.", ru: "Завтра она будет работать из дома." },
    uses: [
      { title: "Прогноз, предположение", example: { en: "It will probably rain tomorrow.", ru: "Завтра, наверное, будет дождь." } },
      { title: "Решение, принятое прямо сейчас", example: { en: "I'll have the soup, please.", ru: "Мне суп, пожалуйста." } },
      { title: "Обещание, предложение помощи", example: { en: "I'll call you tonight.", ru: "Я позвоню тебе вечером." } },
      { title: "Будущий факт", example: { en: "She will be thirty next year.", ru: "В следующем году ей исполнится тридцать." } },
    ],
    forms: [
      { label: "+", text: "will (в речи 'll) + глагол — одинаково для всех лиц", example: { en: "We will help you.", ru: "Мы тебе поможем." } },
      { label: "−", text: "won't (will not) + глагол", example: { en: "It won't take long.", ru: "Это не займёт много времени." } },
      { label: "?", text: "Will + подлежащее + глагол", example: { en: "Will you come to the party?", ru: "Ты придёшь на вечеринку?" } },
    ],
    markers: ["tomorrow", "next week", "next year", "soon", "later", "in two hours", "one day", "probably", "I think…"],
    mistakes: [
      { wrong: "She wills come.", right: "She will come.", note: "У will нет -s и после него глагол без to и без -s." },
      { wrong: "I will to call you.", right: "I will call you.", note: "После will — сразу глагол, без to." },
      {
        wrong: "I will meet Tom at six tomorrow — мы договорились.",
        right: "I'm meeting Tom at six tomorrow.",
        note: "Если уже договорились и есть время — Present Continuous; will — прогноз или решение в момент речи.",
      },
    ],
  },
];
