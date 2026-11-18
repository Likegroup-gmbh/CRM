// auswertungPruefbereich.js
// Markup der Erfassen-Ansicht (Spec 7.1, 7.5) als verbundene Tabelle in drei Spalten: Arbeitsliste
// links, in der Mitte Link und Blatt mit Screenshot und Ablage, rechts Kopf, Formular und Aktionen;
// ohne Post der Hinweis „Fehlt“ mit „Manuell eintragen“. Gebunden wird in auswertungErfassen.

import { renderEmptyState } from '../../core/components/EmptyState.js';
import { icon } from '../../core/icons/IconSystem.js';
import { esc, plural } from './auswertungFormat.js';
import { LANGSAM_AB_MS, SCHRITTE, SCHRITTE_GESAMT, laufDauer, laufzeitText, schrittLabel } from './auswertungKiLauf.js';
import { STATUS, eintraegeAus, eintragZumZiel, gefiltert, renderArbeitsliste } from './auswertungArbeitsliste.js';
import { abrufGrund, renderAblage, renderLinkLeiste } from './auswertungQuellen.js';
import { renderAktionen, renderFelder, renderKopf } from './auswertungFormular.js';
import { renderScreenshotSpalte } from './auswertungScreenshots.js';
import { freiePlattform } from './auswertungErfassenAktionen.js';
import { STANDARD_PLATTFORM } from './auswertungKonfig.js';

export const neuerErfassenZustand = () => ({ filter: 'alle', auswahl: null, fertig: false });

export const passt = (eintrag, filter) => gefiltert([eintrag], filter).length > 0;

/** Ziel aus Tabelle oder Panel, sonst die bisherige Auswahl, sonst der erste sichtbare Eintrag. */
function loeseAuswahl(eintraege, zustand) {
  const e = zustand.erfassen;
  const ziel = eintragZumZiel(eintraege, zustand.ziel);
  zustand.ziel = null;
  if (ziel) {
    if (!passt(ziel, e.filter)) e.filter = 'alle';
    e.fertig = false;
    return ziel;
  }
  if (e.fertig) return null;
  const sichtbar = gefiltert(eintraege, e.filter);
  return sichtbar.find(x => x.key === e.auswahl) || sichtbar[0] || null;
}

/** Solange die KI liest: Schritt, Sekunden und Abbrechen. Die Sekunden zieht auswertungErfassen nach. */
export function kiLaufHinweis(post) {
  const dauer = laufDauer(post.id);
  const nr = SCHRITTE[post.kiSchritt]?.nr || 1;
  return `
    <div class="erfassen-ki-lauf" role="status" data-erfassen-ki-lauf data-post="${esc(post.id)}">
      <span class="erfassen-status__puls" aria-hidden="true"></span>
      <p>
        <strong>KI liest ${esc(plural(post.screenshots || 1, 'Screenshot', 'Screenshots'))}</strong>
        <span>Schritt ${nr} von ${SCHRITTE_GESAMT}: ${esc(schrittLabel(post.kiSchritt))}</span>
        <span class="erfassen-ki-lauf__zeit" data-ki-sekunden aria-hidden="true">${laufzeitText(dauer)}</span>
        <span class="erfassen-ki-lauf__langsam" data-ki-langsam${dauer < LANGSAM_AB_MS ? ' hidden' : ''}>dauert länger als üblich</span>
      </p>
      <button type="button" class="mdc-btn mdc-btn--secondary mdc-btn--sm" data-erfassen-aktion="abbrechen">Abbrechen</button>
    </div>`;
}

function fehlerHinweis(post) {
  const wo = SCHRITTE[post.kiSchritt] ? `<span class="erfassen-fehler__schritt">Bei Schritt: ${esc(schrittLabel(post.kiSchritt))}</span>` : '';
  return `
    <div class="erfassen-fehler" role="alert">
      ${icon('exclamation-triangle', { size: 16 })}
      <p>${esc(post.kiFehler || 'Die KI konnte den Screenshot nicht lesen.')}${wo}</p>
      <button type="button" class="mdc-btn mdc-btn--secondary mdc-btn--sm" data-erfassen-aktion="erneut">Erneut versuchen</button>
      <button type="button" class="mdc-btn mdc-btn--secondary mdc-btn--sm" data-erfassen-aktion="manuell">Manuell eintragen</button>
    </div>`;
}

function fehltText({ einheit, status }) {
  if (status === 'optional') return 'Paid-Linie, hier wird kein Post erwartet. Wurde trotzdem gepostet, die Zahlen wie gewohnt erfassen.';
  if (!einheit.dateien?.length) return 'Noch keine Finale Version. Zahlen lassen sich trotzdem schon erfassen.';
  return 'Für diesen Post liegen noch keine Zahlen vor. Screenshot ablegen, Link abrufen oder die Zahlen hier eintippen.';
}

/** Leerer Stand für das Formular, solange es den Post noch nicht gibt (Plattform wie beim Anlegen). */
const entwurfOhnePost = (einheit) => ({
  plattform: STANDARD_PLATTFORM[einheit.art] || 'ig_reel', metrics: {}, confidence: null, source: 'manuell', status: 'draft'
});

/**
 * @param {object|null} eintrag - gewählter Eintrag der Arbeitsliste
 * @param {object[]} eintraege - alle Einträge (für „Alles erfasst“)
 * @param {object} modell
 */
export function renderPruefbereich(eintrag, eintraege, modell) {
  if (!eintrag) {
    const offen = eintraege.some(x => STATUS[x.status].filter && x.status !== 'erfasst');
    return offen
      ? renderEmptyState({ icon: 'inbox', title: 'Links einen Post wählen', text: 'Dann hier den Link einfügen oder den Insights-Screenshot ablegen.' })
      : renderEmptyState({ icon: 'check', title: 'Alles erfasst', text: 'Jeder Post dieser Produktion hat bestätigte Zahlen.' });
  }
  const { post } = eintrag;
  const posts = modell.posts.filter(p => p.einheitId === eintrag.einheit.id);
  // Ohne Post stehen die Felder trotzdem da: leer, zum Eintippen. Angelegt wird erst beim Bestätigen.
  const rechts = `
      ${post ? '' : `<p class="erfassen-fehlt">${esc(fehltText(eintrag))}</p>`}
      ${post && eintrag.status === 'fehler' ? fehlerHinweis(post) : ''}
      ${post && eintrag.status === 'liest' ? kiLaufHinweis(post) : ''}
      ${renderFelder({ ...eintrag, post: post || entwurfOhnePost(eintrag.einheit) })}
      ${renderAktionen(eintrag, { weiterePlattform: Boolean(post && freiePlattform(eintrag.einheit, posts)), abrufbar: Boolean(post) && !abrufGrund(post.link) })}`;
  return `
    <form class="erfassen-form" data-erfassen-form data-eintrag="${esc(eintrag.key)}" novalidate>
      <div class="erfassen-mitte">
        ${renderLinkLeiste(eintrag)}
        <div class="erfassen-buehne">
          <div class="erfassen-blatt">
            ${renderScreenshotSpalte(post)}
            ${renderAblage(eintrag)}
          </div>
        </div>
      </div>
      <div class="erfassen-rechts">
        ${renderKopf(eintrag)}
        ${rechts}
      </div>
    </form>`;
}

/** Inhalt der Ansicht. Löst dabei das Ziel aus Tabelle oder Panel in die Auswahl auf. */
export function renderErfassen(modell, zustand) {
  if (!modell.einheiten.length) {
    return renderEmptyState({ icon: 'inbox', title: 'Noch nichts zu erfassen', text: 'Sobald die Produktion Kooperationen mit Videos hat, stehen ihre Posts hier.' });
  }
  const e = zustand.erfassen;
  const eintraege = eintraegeAus(modell);
  const eintrag = loeseAuswahl(eintraege, zustand);
  e.auswahl = eintrag?.key || null;
  return `
    <div class="erfassen" data-erfassen>
      <aside class="erfassen-liste" data-erfassen-liste>${renderArbeitsliste(eintraege, { filter: e.filter, auswahl: e.auswahl, fortschritt: modell.fortschritt })}</aside>
      <section class="erfassen-pruefung" data-erfassen-pruefung aria-label="Prüfbereich">${renderPruefbereich(eintrag, eintraege, modell)}</section>
    </div>`;
}
