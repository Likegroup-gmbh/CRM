// auswertungZusammenfassung.js
// Zusammenfassung des Reports (Spec 6). Bis zur KI-Zusammenfassung formuliert eine feste Vorlage die
// Fakten aus auswertungFakten aus; später übernimmt das Sprachmodell genau diese Fakten und fügt keine
// Zahlen hinzu. „Bearbeiten“ und „Neu formulieren“ sind bis dahin ohne Funktion.

import { MESSREGEL_TAGE, PLATTFORMEN } from './auswertungKonfig.js';
import { esc, kompakt, plural, prozent, sekunden } from './auswertungFormat.js';

const zitat = (t) => `„${t}“`;

const SAETZE = {
  staerksterPost: (f) => `Der stärkste Post ist ${f.einheit} von ${f.creator} als ${PLATTFORMEN[f.plattform]?.label || f.plattform} mit ${kompakt(f.aufrufe)} Aufrufen, das sind ${prozent(f.anteil, 0)} aller Aufrufe.`,
  persona: (f) => `Die Persona ${zitat(f.label)} hat mit ${prozent(f.rate)} die höchste Engagement-Rate, der Schnitt liegt bei ${prozent(f.schnitt)}.`,
  plattformVergleich: (f) => {
    const faktor = f.reelProPost > 0 ? f.tiktokProPost / f.reelProPost : null;
    const vergleich = faktor && (faktor >= 1.2 || faktor <= 0.8)
      ? ` TikTok liegt damit beim ${faktor.toLocaleString('de-DE', { maximumFractionDigits: 1 })}-Fachen.`
      : ' Beide liegen damit etwa gleichauf.';
    return `Ein TikTok holt im Schnitt ${kompakt(f.tiktokProPost)} Aufrufe, ein Reel ${kompakt(f.reelProPost)}.${vergleich}`;
  },
  ansatzWiedergabe: (f) => `Beim Ansatz ${zitat(f.label)} schauen die Leute mit Ø ${sekunden(f.sekunden)} am längsten zu, bei ${zitat(f.vergleichLabel)} sind es ${sekunden(f.vergleichSekunden)}.`,
  storyKlicks: (f) => `${plural(f.stories, 'Story brachte', 'Stories brachten')} zusammen ${kompakt(f.klicks)} Link-Klicks.`
};

export function zusammenfassungSaetze(fakten) {
  return (fakten || []).map(f => SAETZE[f.art]?.(f)).filter(Boolean);
}

function fusszeile(modell, { team }) {
  const { bestaetigt, offen } = modell.fortschritt;
  const basis = `Aus ${plural(bestaetigt, 'ausgewertetem Post', 'ausgewerteten Posts')} · Zahlen ${MESSREGEL_TAGE} Tage nach Veröffentlichung.`;
  if (!team || !offen) return `<p class="auswertung-zusammenfassung__fuss">${esc(basis)}</p>`;
  return `
    <p class="auswertung-zusammenfassung__fuss">
      ${esc(basis)}
      <span class="auswertung-zusammenfassung__offen">${esc(plural(offen, 'Post fehlt', 'Posts fehlen'))} noch ·
        <button type="button" class="auswertung-link" data-auswertung-ansicht="erfassen">Jetzt erfassen</button>
      </span>
    </p>`;
}

export function renderZusammenfassung(modell, { team = false } = {}) {
  const saetze = zusammenfassungSaetze(modell.fakten);
  const liste = saetze.length
    ? `<ol class="auswertung-zusammenfassung__liste">${saetze.map(s => `<li>${esc(s)}</li>`).join('')}</ol>`
    : '<p class="budget-tab__leer">Für eine Zusammenfassung braucht es mindestens drei ausgewertete Posts.</p>';
  const aktionen = team && saetze.length
    ? `<div class="auswertung-zusammenfassung__aktionen">
        <button type="button" class="mdc-btn mdc-btn--secondary mdc-btn--sm" disabled title="Folgt mit der KI-Zusammenfassung">Bearbeiten</button>
        <button type="button" class="mdc-btn mdc-btn--secondary mdc-btn--sm" disabled title="Folgt mit der KI-Zusammenfassung">Neu formulieren</button>
      </div>`
    : '';
  return `
    <div class="budget-tab__section-head auswertung-zusammenfassung__kopf">
      <h4 class="budget-tab__section-title">Zusammenfassung</h4>
      ${team && saetze.length ? '<span class="tag">KI-Entwurf</span>' : ''}
    </div>
    ${liste}
    ${aktionen}
    ${fusszeile(modell, { team })}`;
}
