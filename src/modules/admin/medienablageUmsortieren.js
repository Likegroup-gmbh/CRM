// medienablageUmsortieren.js
// Umsortieren der Medienablage-Seite (`page` = MedienablagePage): Liste der Unternehmen mit
// Suche, je Unternehmen Umsortieren in Medien/ (ADR 0067) und die Feedbackschleifen (ADR 0065).

import { escapeHtml } from '../../core/format.js';
import { zahl, bestaetigen, postStand, setBusy } from './medienablageFormat.js';

export function umsortierenHtml(page) {
  const liste = [...(page.data?.unternehmen || [])]
    .sort((a, b) => String(a.firmenname || '').localeCompare(String(b.firmenname || ''), 'de'));
  const zeilen = liste.map(zeileHtml).join('');

  return `
      <div class="dq-list-card">
        <div class="dq-list-header ma-list-header">
          <div>
            <h2 class="dq-list-title">Umsortieren</h2>
            <p class="dq-list-hint">Zieht Marken und Kampagnen nach Daten/Firma/Medien, Kooperationen und Verträge in ihre Produktionen und die Dateien in die Feedbackschleifen. Vorher läuft ein Trockenlauf.</p>
          </div>
          ${liste.length ? `<input type="search" class="ma-suche" data-ma-suche placeholder="Unternehmen suchen" aria-label="Unternehmen suchen" value="${escapeHtml(page._suche)}">` : ''}
        </div>
        ${liste.length ? `
        <div class="dq-scroll-x">
        <table class="dq-table ma-table">
          <thead>
            <tr>
              <th>Unternehmen</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            ${zeilen}
          </tbody>
        </table>
        </div>
        <div class="dq-leer" data-ma-suche-leer hidden>Kein Unternehmen passt zur Suche.</div>
        ` : '<div class="dq-leer">Keine Unternehmen.</div>'}
      </div>
    `;
}

function zeileHtml(u) {
  return `
      <tr class="ma-row" data-ma-name="${escapeHtml(String(u.firmenname || '').toLowerCase())}">
        <td>
          <span class="dq-name">${escapeHtml(u.firmenname || 'Ohne Namen')}</span>
          ${u.ist_test ? '<span class="status-badge info ma-badge">Testunternehmen</span>' : ''}
        </td>
        <td class="ma-zeilen-aktionen">
          <button type="button" class="mdc-btn mdc-btn--secondary mdc-btn--sm" data-ma-umsortieren="${escapeHtml(u.id)}"
                  title="In Daten/Firma/Medien und Feedbackschleifen verschieben">Umsortieren</button>
        </td>
      </tr>
    `;
}

export function filterUnternehmen(page) {
  const root = window.content || document;
  const q = page._suche.trim().toLowerCase();
  const zeilen = [...root.querySelectorAll('.ma-row[data-ma-name]')];
  let sichtbar = 0;
  zeilen.forEach((row) => {
    const treffer = !q || row.dataset.maName.includes(q);
    row.hidden = !treffer;
    if (treffer) sichtbar += 1;
  });
  const leer = root.querySelector('[data-ma-suche-leer]');
  if (leer) leer.hidden = !(zeilen.length && !sichtbar);
}

// Erst Trockenlauf (nichts wird bewegt), dann mit den Zahlen bestätigen
export async function umsortierenStarten(page, button) {
  if (page._busy) return;
  const unternehmenId = button.dataset.maUmsortieren;
  const name = page.unternehmen(unternehmenId)?.firmenname || 'Unternehmen';
  let plan;
  page._busy = true;
  setBusy(button, true);
  try {
    plan = await postStand({ aktion: 'umsortieren_planen', unternehmen_id: unternehmenId });
  } catch (e) {
    page.toast(`Trockenlauf fehlgeschlagen: ${e?.message || 'Unbekannt'}`, 'error');
    return;
  } finally {
    page._busy = false;
    setBusy(button, false);
  }

  const z = plan?.zaehler || {};
  const b = z.bereich || {};
  const p = z.produktion || {};
  const ziehen = (b.marken || 0) + (b.kampagnen || 0);
  const anlegen = b.anlegen || [];
  const produktionZiehen = (p.kooperationen || 0) + (p.vertraege || 0);
  if (!ziehen && !anlegen.length && !produktionZiehen && !z.dateien && !z.ordner) {
    page.toast(`${name}: alles liegt schon in Medien/, den Produktionen und den Feedbackschleifen.`, 'success');
    return;
  }
  const bereichText = [
    anlegen.length ? `${anlegen.map(n => `${n}/`).join(' und ')} ${anlegen.length > 1 ? 'werden' : 'wird'} angelegt.` : '',
    ziehen ? `${zahl(b.marken || 0)} Marken und ${zahl(b.kampagnen || 0)} Kampagnen ziehen nach Daten/${name}/Medien.` : '',
    produktionZiehen
      ? `${zahl(p.kooperationen || 0)} Kooperationen und ${zahl(p.vertraege || 0)} Verträge ziehen in ihre Produktions-Ordner${p.neu ? ` (${zahl(p.neu)} neu)` : ''}.`
      : '',
  ].filter(Boolean).map(s => `${s} `).join('');
  const schleifenText = z.dateien || z.ordner
    ? `${zahl(z.dateien)} Dateien (${zahl(z.videos)} Videos, ${zahl(z.storys)} Storys, ${zahl(z.bilder)} Bilder) ziehen in die Feedbackschleifen unter Videos/. Danach werden ${zahl(z.ordner)} alte Ordner (Storys/, Bilder/, Varianten) gelöscht, sobald sie leer sind.`
    : '';
  const restText = z.rest
    ? ` ${zahl(z.rest)} Dateien ohne CRM-Eintrag bleiben liegen, ihre Ordner auch (z. B. ${(plan.rest || []).slice(0, 3).map(r => r.name).join(', ')}).`
    : '';
  const ok = await bestaetigen({
    title: 'Ablage umsortieren',
    message: `„${name}“: ${bereichText}${schleifenText}${restText}`.trim(),
    confirmText: 'Umsortieren',
  });
  if (!ok) return;
  await page.ausfuehren({ aktion: 'umsortieren_starten', unternehmen_id: unternehmenId }, {
    button,
    erfolg: (antwort) => (antwort?.angestossen ? 'Umsortieren läuft im Hintergrund.' : 'Umsortieren konnte nicht angestoßen werden.'),
  });
}
