// medienablageFinale.js
// Finale Version im Finder auf der Medienablage-Seite (`page` = MedienablagePage, ADR 0073):
// Als final markierte Dateien bekommen eine Kopie in Finale_Version. Neue Finale kopiert der
// Zeitplan von selbst; "Finale spiegeln" holt den Bestand davor, Fehler und im Finder
// gelöschte Kopien nach. Erst Trockenlauf, dann mit Anzahl und Größe bestätigen.

import { GB, zahl, groesse, postStand, setBusy, bestaetigen } from './medienablageFormat.js';

const nachzuholen = (f) => (Number(f?.ohne_kopie) || 0) + (Number(f?.fehler) || 0) + (Number(f?.entfernt) || 0);

export function finalSpiegelHtml(page) {
  const f = page.data?.final_spiegel;
  if (!f) return '';
  const offen = Number(f.offen) || 0;
  const fertig = Number(f.fertig) || 0;
  const fehlerText = f.fehler ? ` · <span class="ma-fehler-text">${zahl(f.fehler)} Fehler</span>` : '';
  const entferntText = f.entfernt ? ` · ${zahl(f.entfernt)} im Finder gelöscht` : '';
  const stand = offen > 0
    ? `<progress class="ma-umzug-balken" max="${offen + fertig}" value="${fertig}"></progress>
          <span class="ma-umzug-text">Kopien laufen · ${zahl(fertig)} von ${zahl(offen + fertig)}${fehlerText}</span>`
    : `<span class="ma-umzug-text">${zahl(fertig)} Finale im Finder (${groesse(f.kopie_bytes)})${fehlerText}${entferntText}</span>`;
  const ohne = f.ohne_kopie ? `<span class="ma-umzug-text">${zahl(f.ohne_kopie)} ohne Kopie (${groesse(f.ohne_kopie_bytes)})</span>` : '';
  const disabled = !nachzuholen(f);

  return `
      <div class="dq-list-card">
        <div class="dq-list-header ma-list-header">
          <div>
            <h2 class="dq-list-title">Finale Version im Finder</h2>
            <p class="dq-list-hint">Als final markierte Dateien liegen als Kopie in Finale_Version. Neue Finale kopiert der Zeitplan zwei Minuten nach dem Markieren; den Bestand davor holt „Finale spiegeln“ nach.</p>
          </div>
        </div>
        <div class="ma-umzug">
          ${stand}
          <button type="button" class="mdc-btn mdc-btn--secondary mdc-btn--sm" data-ma-final-spiegel
                  ${disabled ? 'disabled title="Alle Finalen liegen schon im Finder"' : ''}>Finale spiegeln</button>
          ${ohne}
        </div>
      </div>
    `;
}

export async function finalSpiegelStarten(page, button) {
  if (page._busy) return;
  let plan;
  page._busy = true;
  setBusy(button, true);
  try {
    plan = await postStand({ aktion: 'final_spiegel_planen' });
  } catch (e) {
    page.toast(`Trockenlauf fehlgeschlagen: ${e?.message || 'Unbekannt'}`, 'error');
    return;
  } finally {
    page._busy = false;
    setBusy(button, false);
  }

  if (!nachzuholen(plan)) {
    page.toast('Alle Finalen liegen schon im Finder.', 'success');
    return;
  }
  const teile = [
    plan.ohne_kopie ? `${zahl(plan.ohne_kopie)} Finale ohne Kopie (${groesse(plan.ohne_kopie_bytes)}) werden nach Finale_Version kopiert.` : '',
    plan.fehler ? `${zahl(plan.fehler)} fehlgeschlagene Kopien werden erneut versucht.` : '',
    plan.entfernt ? `${zahl(plan.entfernt)} im Finder gelöschte Kopien kommen wieder.` : '',
  ].filter(Boolean).join(' ');
  const speicher = plan.quota_total
    ? ` Belegt sind ${zahl(plan.quota_used / GB, 1)} von ${zahl(plan.quota_total / GB, 1)} GB.`
    : '';
  const ok = await bestaetigen({
    title: 'Finale spiegeln',
    message: `${teile}${speicher} Die Kopien laufen im Hintergrund in SharePoint, das CRM ändert sich nicht.`,
    confirmText: 'Finale spiegeln',
  });
  if (!ok) return;
  await page.ausfuehren({ aktion: 'final_spiegel_starten' }, {
    button,
    erfolg: (antwort) => (antwort?.angestossen === false
      ? `${zahl(antwort?.eingereiht)} Kopien eingereiht, der Läufer ist nicht angesprungen.`
      : `Finale werden gespiegelt: ${zahl(antwort?.eingereiht)} Kopien eingereiht.`),
  });
}
