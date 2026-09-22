// castingPreisZellen.js
// TKP, Reels-Preis und die Preis-Zellen der Casting-Tabelle

import { formatExactNumber } from '../../core/format/compactNumber.js';
import { escapeHtml } from './CreatorAuswahlTemplates.js';

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
 * Kopf-Tooltip der berechneten Reels-Preise. Beschreibt die Rechenregel in der
 * Form, in der sie auch dem Kunden erklaert wird - die Spalte ist sonst eine
 * Blackbox aus Views und TKP.
 */
export function reelsPreisTooltip(tkpLabel, fenster) {
  return `Geschätzter Preis bei ${tkpLabel} € TKP\n`
    + `Durchschnitt der letzten ${fenster} Feed-Reels, ohne Reels mit Werbe-Kennzeichnung.\n`
    + 'Ausgeschlossen wird zusätzlich das stärkste Reel, wenn es mindestens doppelt so viele '
    + 'Aufrufe hat wie das zweitstärkste, und das schwächste Reel, wenn das zweitschwächste '
    + 'mindestens doppelt so viele Aufrufe hat.';
}

/** Views-Schnitt -> Preis in Euro, auf Cent gerundet */
export function berechnePreisAusViews(views, tkp) {
  // Number(null) waere 0 und wuerde einen Preis von 0,00 € statt "-" ergeben
  if (views == null || views === '') return null;
  const n = Number(views);
  if (!Number.isFinite(n)) return null;
  return Math.round((n / 1000) * tkp * 100) / 100;
}

/**
 * Zusatz fuer den Tooltip der Preis-Spalten: was aus der Rechnung geflogen ist.
 * Beides muss nachvollziehbar sein, sonst wirkt der Preis wie eine Blackbox -
 * die konkreten Reichweiten der Ausreisser und die Zahl der Werbe-Reels.
 */
export function beschreibeAusreisser(item, fenster) {
  const outliers = item?.ig_stats?.[`outliers_${fenster}`];
  const werbung = Number(item?.ig_stats?.skipped_ads) || 0;
  const trials = Number(item?.ig_stats?.skipped_trials) || 0;
  const trialViews = Number(item?.ig_stats?.skipped_trial_views) || 0;
  const gate = item?.ig_stats?.trial_gate;
  const ohne = item?.ig_stats?.ohne_trials;
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
    zeilen.push(`${werbung} Reel${werbung === 1 ? '' : 's'} mit Werbe-Kennzeichnung ausgeschlossen`);
  }

  if (trials) {
    zeilen.push(`${trials} Trial-Reel${trials === 1 ? '' : 's'} als Duplikat ausgeschlossen`);
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

export function renderPreisFreitextCell(ctx, item, columnClass, field, hide) {
  const wert = ohneEuroZeichen(item[field]);
  const canWrite = rowCanWrite(ctx, item);

  return `
    <td class="cell-textarea ${columnClass}" style="${hide(columnClass)}">
      ${canWrite ? `
        <div class="cell-euro">
          <input type="text" class="strategie-textarea cell-euro__input" data-field="${field}" data-item-id="${item.id}" placeholder="Preis..." value="${escapeHtml(wert)}">
          <span class="cell-euro__suffix" aria-hidden="true">€</span>
        </div>
      ` : `<div class="cell-text-readonly">${wert ? `${escapeHtml(wert)} €` : '-'}</div>`}
    </td>
  `;
}

/**
 * Automatisch berechnete Preis-Zelle (read-only). Der Preis entsteht hier aus
 * Views x Listen-TKP, nicht aus den gespeicherten cpm_ig_* - so wirkt eine
 * TKP-Aenderung sofort, ohne die Instagram-Daten neu abzurufen.
 * Mit showViews steht unter dem Preis die View-Basis, sonst waere in der
 * Tabelle nicht erkennbar, worauf sich der 8er- bzw. 30er-Wert bezieht.
 */
export function renderAutoCpmCell(ctx, item, columnClass, views, hide, showViews = false, hinweis = null, cleanViews = null) {
  const tkp = getListenTkp(ctx.liste);
  const cpm = berechnePreisAusViews(views, tkp);

  const value = cpm != null
    ? `${cpm.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €`
    : '-';
  const basis = views != null
    ? `${Number(views).toLocaleString('de-DE')} Views im Schnitt × ${tkp.toLocaleString('de-DE')} € TKP`
    : 'Noch nicht abgerufen';
  const title = views != null && hinweis ? `${basis}\n${hinweis}` : basis;

  const reach = showViews && views != null ? formatReachShort(views) : null;

  // Zweitwert ohne Trial-Reels (Variante B): nur wenn das Gate aktiv war und
  // sich der Wert unterscheidet - sonst exakt die bisherige Zelle.
  const cleanCpm = berechnePreisAusViews(cleanViews, tkp);
  const cleanReach = cleanViews != null ? formatReachShort(cleanViews) : null;
  const showClean = cleanViews != null && views != null && Number(cleanViews) !== Number(views);
  const cleanLine = showClean
    ? `<div class="cpm-auto-reach cpm-auto-reach--clean">${cleanCpm != null ? `${cleanCpm.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} € · ` : ''}Ø ${cleanReach} ohne Trials</div>`
    : '';

  return `
    <td class="cell-textarea ${columnClass}" style="${hide(columnClass)}">
      <div class="cell-text-readonly cpm-auto-value${ctx.kundenCallActive ? ' kunden-call-blur' : ''}"
           data-blur-target
           title="${escapeHtml(title)}">
        <div class="cpm-auto-price">${value}</div>
        ${reach ? `<div class="cpm-auto-reach">Ø ${reach} Views</div>` : ''}
        ${cleanLine}
      </div>
    </td>
  `;
}

