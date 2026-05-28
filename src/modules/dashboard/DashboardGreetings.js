// DashboardGreetings.js
// Tageszeit-abhängige Begrüßungen + deutsche Feiertags-Overrides

const GREETINGS = {
  morning: [
    'Guten Morgen, {name}!',
    'Moin {name}, auf geht\'s!',
    'Hey {name}, schön dass du da bist!',
    'Guten Morgen {name}, starten wir durch!',
    'Morgen {name}! Bereit für den Tag?',
    'Hey {name}, frisch ans Werk!',
    'Guten Morgen {name}, schönen Start!',
    'Moin moin, {name}!'
  ],
  midday: [
    'Mahlzeit, {name}!',
    'Guten Mittag, {name}!',
    'Hey {name}, schon Hunger?',
    'Mittag, {name} – halbe Strecke geschafft!',
    'Hi {name}, wie läuft der Tag?',
    'Hey {name}, Mittagspause verdient!'
  ],
  afternoon: [
    'Hey {name}, schöner Nachmittag!',
    'Na {name}, Endspurt!',
    'Hi {name}, der Nachmittag gehört dir!',
    'Hey {name}, noch produktiv?',
    'Guten Nachmittag, {name}!',
    'Hi {name}, läuft bei dir!'
  ],
  evening: [
    'Guten Abend, {name}!',
    'Hey {name}, noch fleißig?',
    'Na {name}, Feierabend in Sicht!',
    'Abend {name}, du gibst ja Gas!',
    'Hey {name}, schönen Abend noch!',
    'Guten Abend {name}, fast geschafft!'
  ]
};

const HOLIDAYS = [
  { month: 1, day: 1, greetings: [
    'Frohes Neues Jahr, {name}!',
    'Happy New Year, {name}! Auf ein gutes neues Jahr!',
    'Prosit Neujahr, {name}!'
  ]},
  { month: 1, day: 6, greetings: [
    'Frohe Heilige Drei Könige, {name}!',
    'Hey {name}, schönen Dreikönigstag!'
  ]},
  { month: 5, day: 1, greetings: [
    'Schönen Tag der Arbeit, {name}!',
    'Happy 1. Mai, {name}!',
    'Hey {name}, heute mal nicht arbeiten? 😄'
  ]},
  { month: 10, day: 3, greetings: [
    'Schönen Tag der Deutschen Einheit, {name}!',
    'Happy Feiertag, {name}!'
  ]},
  { month: 10, day: 31, greetings: [
    'Happy Halloween, {name}! 🎃',
    'Süßes oder Saures, {name}?'
  ]},
  { month: 12, day: 6, greetings: [
    'Frohen Nikolaustag, {name}!',
    'Hey {name}, Stiefel schon rausgestellt?'
  ]},
  { month: 12, day: 24, greetings: [
    'Frohe Weihnachten, {name}!',
    'Fröhliche Weihnachten, {name}!',
    'Besinnliche Weihnachten, {name}!'
  ]},
  { month: 12, day: 25, greetings: [
    'Frohe Weihnachten, {name}!',
    'Schönen 1. Weihnachtsfeiertag, {name}!'
  ]},
  { month: 12, day: 26, greetings: [
    'Frohe Weihnachten, {name}!',
    'Schönen 2. Weihnachtsfeiertag, {name}!'
  ]},
  { month: 12, day: 31, greetings: [
    'Guten Rutsch, {name}!',
    'Hey {name}, guten Rutsch ins neue Jahr!',
    'Silvester-Grüße, {name}! 🎆'
  ]}
];

/**
 * Berechnet das Osterdatum für ein gegebenes Jahr (Gauss-Algorithmus).
 * Gibt ein Date-Objekt zurück.
 */
function computeEasterSunday(year) {
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31);
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  return new Date(year, month - 1, day);
}

/**
 * Gibt bewegliche Feiertage (Ostern-basiert) für das aktuelle Jahr zurück.
 */
function getEasterBasedHolidays(year) {
  const easter = computeEasterSunday(year);
  const offsetDay = (offset) => {
    const d = new Date(easter);
    d.setDate(d.getDate() + offset);
    return { month: d.getMonth() + 1, day: d.getDate() };
  };

  return [
    { ...offsetDay(-2), greetings: ['Besinnlichen Karfreitag, {name}!', 'Schönen Karfreitag, {name}!'] },
    { ...offsetDay(0), greetings: ['Frohe Ostern, {name}!', 'Happy Ostersonntag, {name}! 🐣'] },
    { ...offsetDay(1), greetings: ['Frohe Ostern, {name}!', 'Schönen Ostermontag, {name}!'] },
    { ...offsetDay(39), greetings: ['Schönen Christi Himmelfahrt, {name}!', 'Happy Vatertag, {name}!'] },
    { ...offsetDay(49), greetings: ['Frohe Pfingsten, {name}!', 'Schönen Pfingstsonntag, {name}!'] },
    { ...offsetDay(50), greetings: ['Frohe Pfingsten, {name}!', 'Schönen Pfingstmontag, {name}!'] }
  ];
}

function getTimeOfDay(hour) {
  if (hour < 11) return 'morning';
  if (hour < 14) return 'midday';
  if (hour < 17) return 'afternoon';
  return 'evening';
}

function pickRandom(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

/**
 * Gibt eine passende Begrüßung zurück.
 * Prüft zuerst Feiertage (inkl. Ostern-basierte), dann Tageszeit.
 * @param {string} name - Vorname des Users
 * @returns {string}
 */
export function getGreeting(name) {
  const now = new Date();
  const month = now.getMonth() + 1;
  const day = now.getDate();
  const year = now.getFullYear();

  const allHolidays = [...HOLIDAYS, ...getEasterBasedHolidays(year)];
  const todayHoliday = allHolidays.find(h => h.month === month && h.day === day);

  let template;
  if (todayHoliday) {
    template = pickRandom(todayHoliday.greetings);
  } else {
    const timeOfDay = getTimeOfDay(now.getHours());
    template = pickRandom(GREETINGS[timeOfDay]);
  }

  const displayName = name || '';
  return template.replace(/\{name\}/g, displayName).replace(/,\s*!/g, '!');
}
