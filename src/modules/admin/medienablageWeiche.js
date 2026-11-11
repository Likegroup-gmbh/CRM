// medienablageWeiche.js
// Weiche der Medienablage-Seite (`page` = MedienablagePage): Ziel neuer Uploads je
// Unternehmen, Bestandsumzug Dropbox -> SharePoint, Umsortieren in die Feedbackschleifen
// (ADR 0065) und die Suche in der Liste.

import { escapeHtml } from '../../core/format.js';
import { ZIEL_LABEL, zahl, bestaetigen, postStand, setBusy } from './medienablageFormat.js';

export function weicheHtml(page) {
  const liste = [...(page.data?.unternehmen || [])]
    .sort((a, b) => String(a.firmenname || '').localeCompare(String(b.firmenname || ''), 'de'));
  const umzuege = new Map((page.data?.umzug || []).map(u => [String(u.unternehmen_id), u]));
  const aufSharepoint = liste.filter(u => u.ablage_ziel === 'sharepoint').length;

  const hinweis = page.notschalterAn
    ? ' · Notschalter ist aktiv: die Weiche wirkt erst wieder, wenn er aufgehoben ist.'
    : '';

  const zeilen = liste.map(u => weicheZeileHtml(u, umzuege.get(String(u.id)))).join('');

  return `
      <div class="dq-list-card">
        <div class="dq-list-header ma-list-header">
          <div>
            <h2 class="dq-list-title">Weiche</h2>
            <p class="dq-list-hint">${aufSharepoint} von ${liste.length} Unternehmen laden nach SharePoint hoch${escapeHtml(hinweis)}</p>
          </div>
          ${liste.length ? `<input type="search" class="ma-suche" data-ma-suche placeholder="Unternehmen suchen" aria-label="Unternehmen suchen" value="${escapeHtml(page._suche)}">` : ''}
        </div>
        ${liste.length ? `
        <div class="dq-scroll-x">
        <table class="dq-table ma-table">
          <thead>
            <tr>
              <th>Unternehmen</th>
              <th class="dq-num">SharePoint</th>
              <th class="dq-num">Dropbox</th>
              <th>Ziel neuer Uploads</th>
              <th>Bestand</th>
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

function weicheZeileHtml(u, umzug) {
  const ziel = u.ablage_ziel === 'sharepoint' ? 'sharepoint' : 'dropbox';
  const optionen = Object.entries(ZIEL_LABEL)
    .map(([wert, label]) => `<option value="${wert}"${wert === ziel ? ' selected' : ''}>${label}</option>`)
    .join('');

  return `
      <tr class="ma-row" data-ma-name="${escapeHtml(String(u.firmenname || '').toLowerCase())}">
        <td>
          <span class="dq-name">${escapeHtml(u.firmenname || 'Ohne Namen')}</span>
          ${u.ist_test ? '<span class="status-badge info ma-badge">Testunternehmen</span>' : ''}
        </td>
        <td class="dq-num">${zahl(u.dateien_sharepoint)}</td>
        <td class="dq-num">${zahl(u.dateien_dropbox)}</td>
        <td>
          <select class="ma-ziel" data-ma-weiche="${escapeHtml(u.id)}" data-ma-ziel="${ziel}"
                  aria-label="Ziel neuer Uploads für ${escapeHtml(u.firmenname || 'Unternehmen')}">
            ${optionen}
          </select>
        </td>
        <td>${bestandHtml(u, ziel, umzug)}</td>
      </tr>
    `;
}

function bestandHtml(u, ziel, umzug) {
  const offen = Number(umzug?.offen) || 0;
  const fertig = Number(umzug?.fertig) || 0;
  const fehler = Number(umzug?.fehler) || 0;
  const gesamt = offen + fertig + fehler;
  const fehlerText = fehler ? ` · <span class="ma-fehler-text">${zahl(fehler)} Fehler</span>` : '';

  if (offen > 0) {
    return `
        <div class="ma-umzug">
          <progress class="ma-umzug-balken" max="${gesamt}" value="${fertig}"></progress>
          <span class="ma-umzug-text">Umzug läuft · ${zahl(fertig)} von ${zahl(gesamt)}${fehlerText}</span>
        </div>
      `;
  }

  const stand = gesamt ? `<span class="ma-umzug-text">Umgezogen: ${zahl(fertig)}${fehlerText}</span>` : '';
  if (ziel !== 'sharepoint') return stand || '<span class="ma-leise">–</span>';

  const nichtsDa = !(Number(u.dateien_dropbox) > 0);
  const keinSharePoint = !(Number(u.dateien_sharepoint) > 0);
  return `
      <div class="ma-umzug">
        <button type="button" class="mdc-btn mdc-btn--secondary mdc-btn--sm" data-ma-umzug="${escapeHtml(u.id)}"
                ${nichtsDa ? 'disabled title="Keine Dateien mehr in Dropbox"' : ''}>Bestand umziehen</button>
        <button type="button" class="mdc-btn mdc-btn--secondary mdc-btn--sm" data-ma-umsortieren="${escapeHtml(u.id)}"
                ${keinSharePoint ? 'disabled title="Keine Dateien in SharePoint"' : 'title="Storys/, Bilder/ und Varianten-Ordner in die Feedbackschleifen verschieben"'}>Umsortieren</button>
        ${stand}
      </div>
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

export async function weicheSetzen(page, select) {
  const unternehmenId = select.dataset.maWeiche;
  const vorher = select.dataset.maZiel;
  const ziel = select.value;
  if (ziel === vorher) return;
  if (page._busy) {
    select.value = vorher;
    return;
  }
  const name = page.unternehmen(unternehmenId)?.firmenname || 'Unternehmen';
  if (ziel === 'sharepoint') {
    const ok = await bestaetigen({
      title: 'Weiche auf SharePoint',
      message: `Neue Uploads von „${name}“ gehen ab sofort nach SharePoint. Bestehende Dateien bleiben in Dropbox, bis der Bestand umgezogen wird.`,
      confirmText: 'Auf SharePoint stellen',
    });
    if (!ok) {
      select.value = vorher;
      return;
    }
  }
  await page.ausfuehren({ aktion: 'weiche', unternehmen_id: unternehmenId, ziel }, {
    button: select,
    erfolg: `${name}: neue Uploads gehen nach ${ZIEL_LABEL[ziel]}.`,
  });
}

export async function umzugStarten(page, button) {
  if (page._busy) return;
  const unternehmenId = button.dataset.maUmzug;
  const u = page.unternehmen(unternehmenId);
  const name = u?.firmenname || 'Unternehmen';
  const ok = await bestaetigen({
    title: 'Bestand umziehen',
    message: `${zahl(u?.dateien_dropbox)} Dateien von „${name}“ werden im Hintergrund von Dropbox nach SharePoint kopiert. Bis zum Abschluss bleiben sie in Dropbox lesbar.`,
    confirmText: 'Umzug starten',
  });
  if (!ok) return;
  await page.ausfuehren({ aktion: 'umzug_starten', unternehmen_id: unternehmenId }, {
    button,
    erfolg: (antwort) => `Umzug gestartet: ${zahl(antwort?.angelegt)} Dateien.`,
  });
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
  if (!z.dateien && !z.ordner) {
    page.toast(`${name}: alles liegt schon in den Feedbackschleifen.`, 'success');
    return;
  }
  const restText = z.rest
    ? ` ${zahl(z.rest)} Dateien ohne CRM-Eintrag bleiben liegen, ihre Ordner auch (z. B. ${(plan.rest || []).slice(0, 3).map(r => r.name).join(', ')}).`
    : '';
  const ok = await bestaetigen({
    title: 'Ablage umsortieren',
    message: `„${name}“: ${zahl(z.dateien)} Dateien (${zahl(z.videos)} Videos, ${zahl(z.storys)} Storys, ${zahl(z.bilder)} Bilder) ziehen in die Feedbackschleifen unter Videos/. Danach werden ${zahl(z.ordner)} alte Ordner (Storys/, Bilder/, Varianten) gelöscht, sobald sie leer sind.${restText}`,
    confirmText: 'Umsortieren',
  });
  if (!ok) return;
  await page.ausfuehren({ aktion: 'umsortieren_starten', unternehmen_id: unternehmenId }, {
    button,
    erfolg: (antwort) => (antwort?.angestossen ? 'Umsortieren läuft im Hintergrund.' : 'Umsortieren konnte nicht angestoßen werden.'),
  });
}
