// castingPreisZellen.js
// TKP, Reels-Preis und die Views- und Preis-Zellen der Casting-Tabelle

import { formatExactNumber } from '../../core/format/compactNumber.js';
import { escapeHtml } from '../../core/format.js';

/** 740500 -> "740,5K", 6000 -> "6,0K", 850 -> "850" */
function formatReachShort(views) {
  const n = Number(views);
  if (!Number.isFinite(n)) return null;
  const oneDecimal = { minimumFractionDigits: 1, maximumFractionDigits: 1 };
  if (n >= 1000000) return `${(n / 1000000).toLocaleString('de-DE', oneDecimal)}M`;
  if (n >= 1000) return `${(n / 1000).toLocaleString('de-DE', oneDecimal)}K`;
  return Math.round(n).toLocaleString('de-DE');
}

/** TKP fuer Listen ohne eigenen Wert - entspricht dem alten festen Satz */
export const DEFAULT_TKP = 25;

/** Preis pro 1.000 Views dieser Liste */
export function getListenTkp(liste) {
  const tkp = Number(liste?.tkp);
  return Number.isFinite(tkp) && tkp > 0 ? tkp : DEFAULT_TKP;
}

/**
 * Eingabe aus dem Plus-Menü. Komma und Punkt gelten, das Ergebnis ist auf
 * Cent gerundet. Leer, 0 und alles andere als eine positive Zahl sind ungueltig.
 */
export function parseListenTkp(raw) {
  const text = String(raw ?? '').trim().replace(',', '.');
  if (!text) return null;
  const n = Number(text);
  if (!Number.isFinite(n) || n <= 0) return null;
  return Math.round(n * 100) / 100;
}

/** Wert, den das Zahlenfeld anzeigt. Immer mit Punkt, damit er zurueckgelesen wird. */
export function tkpAlsEingabe(wert) {
  const n = parseListenTkp(wert);
  return String(n == null ? DEFAULT_TKP : n);
}

/**
 * Speichert beim Verlassen und bei Enter. Derselbe Wert schreibt nichts,
 * eine ungueltige Eingabe stellt den bisherigen TKP wieder her.
 * @returns {() => void} Listener abbauen
 */
export function bindListenTkpFeld(input, { getAktuell, onSave }) {
  if (!input) return () => {};

  const speichere = () => {
    const aktuell = parseListenTkp(getAktuell()) ?? DEFAULT_TKP;
    const wert = parseListenTkp(input.value);
    if (wert == null) {
      input.value = tkpAlsEingabe(aktuell);
      window.toastSystem?.show('TKP muss größer als 0 sein', 'error');
      return;
    }
    input.value = tkpAlsEingabe(wert);
    if (wert === aktuell) return;
    onSave(wert);
  };

  const onBlur = () => speichere();
  const onKeydown = (event) => {
    if (event.key !== 'Enter') return;
    event.preventDefault();
    input.blur();
  };

  input.addEventListener('blur', onBlur);
  input.addEventListener('keydown', onKeydown);
  return () => {
    input.removeEventListener('blur', onBlur);
    input.removeEventListener('keydown', onKeydown);
  };
}

/**
 * Regel hinter den Views- und Preisspalten eines Fensters (Instagram-Reels und
 * TikTok-Videos, dieselbe Regel). Beschreibt sie in der Form, in der sie auch dem
 * Kunden erklaert wird - die Spalten sind sonst eine Blackbox.
 */
function fensterRegel(fenster) {
  return `Durchschnitt der letzten ${fenster} Videos (Instagram: Feed-Reels), ohne Werbung, `
    + 'ohne Videos jünger als 4 Tage und ohne angepinnte TikToks.\n'
    + 'Ausgeschlossen wird zusätzlich das stärkste Video, wenn es mindestens doppelt so viele '
    + 'Aufrufe hat wie das zweitstärkste, und das schwächste Video, wenn das zweitschwächste '
    + 'mindestens doppelt so viele Aufrufe hat.';
}

/** Kopf-Tooltip der Views-Spalten */
export function viewsTooltip(fenster) {
  return `Views im Schnitt\n${fensterRegel(fenster)}`;
}

/** Kopf-Tooltip der berechneten Preise */
export function reelsPreisTooltip(tkpLabel, fenster) {
  return `Geschätzter Preis bei ${tkpLabel} € TKP: Ø Views / 1.000 × TKP\n${fensterRegel(fenster)}`;
}

const anzahl = (n, einzahl, mehrzahl) => `${n} ${n === 1 ? einzahl : mehrzahl}`;

/** Views-Schnitt -> Preis in Euro, auf Cent gerundet */
export function berechnePreisAusViews(views, tkp) {
  // Number(null) waere 0 und wuerde einen Preis von 0,00 € statt "-" ergeben
  if (views == null || views === '') return null;
  const n = Number(views);
  if (!Number.isFinite(n)) return null;
  return Math.round((n / 1000) * tkp * 100) / 100;
}

/**
 * Zusatz fuer den Tooltip der Views-Spalten: was aus der Rechnung geflogen ist.
 * Beides muss nachvollziehbar sein, sonst wirkt der Schnitt wie eine Blackbox -
 * die konkreten Reichweiten der Ausreisser und die Zahl der Werbe-Videos.
 * @param {object} stats ig_stats oder tt_stats der Zeile
 * @param {'Reel'|'Video'} [einheit]
 */
export function beschreibeAusreisser(stats, fenster, einheit = 'Reel') {
  const outliers = stats?.[`outliers_${fenster}`];
  const werbung = Number(stats?.skipped_ads) || 0;
  const trials = Number(stats?.skipped_trials) || 0;
  const trialViews = Number(stats?.skipped_trial_views) || 0;
  const angepinnt = Number(stats?.skipped_pinned) || 0;
  const gate = stats?.trial_gate;
  const ohne = stats?.ohne_trials;
  if (!Array.isArray(outliers)) return null;

  const zeilen = [];

  if (outliers.length) {
    const beschreibe = (seite, label) => outliers
      .filter(o => o?.side === seite)
      .map(o => `${label}: ${formatExactNumber(o.views)} Views`);

    zeilen.push(
      `${outliers.length} Ausreißer entfernt`,
      ...beschreibe('high', 'nach oben'),
      ...beschreibe('low', 'nach unten')
    );
  } else {
    zeilen.push('Keine Ausreißer erkannt');
  }

  if (werbung) {
    zeilen.push(`${anzahl(werbung, einheit, `${einheit}s`)} mit Werbe-Kennzeichnung ausgeschlossen`);
  }

  if (angepinnt) {
    zeilen.push(`${anzahl(angepinnt, 'angepinntes Video', 'angepinnte Videos')} ausgeschlossen`);
  }

  if (trials) {
    const wort = einheit === 'Reel' ? 'Trial-Reel' : einheit;
    zeilen.push(`${anzahl(trials, wort, `${wort}s`)} als Duplikat ausgeschlossen`);
  }

  // Per View-Luecke erkannte Trials bleiben im Hauptwert enthalten (Variante
  // A) - der Tooltip muss das sagen, sonst wirkt die zweite Zahl willkuerlich.
  if (trialViews) {
    zeilen.push(`${trialViews} Trial-Reel${trialViews === 1 ? '' : 's'} per View-Lücke erkannt (im Hauptwert enthalten)`);
  }

  const cleanViews = ohne?.[`views_${fenster}`];
  if (gate?.aktiv && cleanViews != null) {
    const luecke = gate.gap_ratio != null ? `, Lücke ${String(gate.gap_ratio).replace('.', ',')}x` : '';
    zeilen.push(`Ohne Trials: Ø ${formatExactNumber(cleanViews)} Views (Schwelle ${formatExactNumber(gate.schwelle)}${luecke})`);
  }

  return zeilen.join('\n');
}

/**
 * Nachgestelltes Euro-Zeichen abschneiden. Die Preisfelder zeigen das Zeichen
 * fest in der Zelle an; Altbestand wie "250 €" wuerde sonst doppelt erscheinen.
 */
export function ohneEuroZeichen(wert) {
  return String(wert ?? '').replace(/\s*€\s*$/, '').trim();
}

/**
 * Preis-Zelle als Freitext mit festem Euro-Zeichen am Feldende. Gespeichert
 * wird nur der eingetippte Betrag, damit beim naechsten Bearbeiten nicht
 * "250 € €" im Feld steht.
 */
export function rowCanWrite(ctx, item) {
  if (item?.isVorschlag) return false;
  return !ctx.isKunde && (ctx.canEdit ?? true);
}

/** Inhalt der Preis-Zelle ohne td - auch fuer die Plattformzeilen. */
export function renderPreisFreitextInhalt(ctx, item, field) {
  const wert = ohneEuroZeichen(item[field]);

  return rowCanWrite(ctx, item) ? `
        <div class="cell-euro">
          <input type="text" class="strategie-textarea cell-euro__input" data-field="${field}" data-item-id="${item.id}" placeholder="Preis..." value="${escapeHtml(wert)}">
          <span class="cell-euro__suffix" aria-hidden="true">€</span>
        </div>
      ` : `<div class="cell-text-readonly">${wert ? `${escapeHtml(wert)} €` : '-'}</div>`;
}

export function renderPreisFreitextCell(ctx, item, columnClass, field, hide) {
  return `
    <td class="cell-textarea ${columnClass}" style="${hide(columnClass)}">
      ${renderPreisFreitextInhalt(ctx, item, field)}
    </td>
  `;
}

const euro = (n) => `${n.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €`;

/**
 * Zweitwert ohne Trial-Reels (Variante B) als kurze zweite Zeile. Auch die
 * Engagement-Zelle nutzt sie, damit die Zeile in jeder Spalte gleich aussieht.
 */
export function ohneTrialsZeile(text, title = 'ohne Trial-Reels') {
  return `<div class="cpm-auto-reach cpm-auto-reach--clean" title="${escapeHtml(title)}"><span class="cpm-auto-tag">o. T.</span> ${escapeHtml(text)}</div>`;
}

/** Variante B nur, wenn das Gate aktiv war und sich der Wert unterscheidet */
function zeigtOhneTrials(views, cleanViews) {
  return cleanViews != null && views != null && Number(cleanViews) !== Number(views);
}

/**
 * Inhalt der Views-Zelle eines Fensters (read-only): Schnitt in Kurzform, die exakte
 * Zahl und was aus der Rechnung geflogen ist im Tooltip. Views sind oeffentlich und
 * bleiben im Kunden-Call sichtbar, anders als der Preis daneben.
 */
export function renderAutoViewsInhalt(views, hinweis = null, cleanViews = null) {
  const basis = views != null
    ? `${Number(views).toLocaleString('de-DE')} Views im Schnitt`
    : 'Noch nicht abgerufen';
  const title = views != null && hinweis ? `${basis}\n${hinweis}` : basis;
  const zweit = zeigtOhneTrials(views, cleanViews)
    ? ohneTrialsZeile(formatReachShort(cleanViews), `ohne Trial-Reels: ${Number(cleanViews).toLocaleString('de-DE')} Views im Schnitt`)
    : '';

  return `
      <div class="cell-text-readonly cpm-auto-value" title="${escapeHtml(title)}">
        <div class="cpm-auto-views">${views != null ? formatReachShort(views) : '-'}</div>
        ${zweit}
      </div>
  `;
}

/**
 * Inhalt der automatisch berechneten Preis-Zelle (read-only). Der Preis entsteht hier aus
 * Views x Listen-TKP, nicht aus den gespeicherten cpm_ig_* - so wirkt eine
 * TKP-Aenderung sofort, ohne die Instagram-Daten neu abzurufen.
 */
export function renderAutoCpmInhalt(ctx, views, cleanViews = null) {
  const tkp = getListenTkp(ctx.liste);
  const tkpText = `${tkp.toLocaleString('de-DE')} € TKP`;
  const cpm = berechnePreisAusViews(views, tkp);
  const title = views != null
    ? `${Number(views).toLocaleString('de-DE')} Views im Schnitt × ${tkpText}`
    : 'Noch nicht abgerufen';
  const cleanCpm = berechnePreisAusViews(cleanViews, tkp);
  const zweit = zeigtOhneTrials(views, cleanViews) && cleanCpm != null
    ? ohneTrialsZeile(euro(cleanCpm), `ohne Trial-Reels: ${Number(cleanViews).toLocaleString('de-DE')} Views im Schnitt × ${tkpText}`)
    : '';

  return `
      <div class="cell-text-readonly cpm-auto-value${ctx.kundenCallActive ? ' kunden-call-blur' : ''}"
           data-blur-target
           title="${escapeHtml(title)}">
        <div class="cpm-auto-price">${cpm != null ? euro(cpm) : '-'}</div>
        ${zweit}
      </div>
  `;
}

