// medienablageDokumente.js
// Dokumente auf der Medienablage-Seite (`page` = MedienablagePage, ADR 0068): Verträge,
// Rechnungen mit Belegen und Auftragsdokumente haben einen eigenen Notschalter, eine eigene
// Weiche je Unternehmen und einen eigenen Bestandsumzug (Dropbox und Supabase-Storage).
// Die Suche der Medien-Weiche filtert diese Zeilen mit (gleiche .ma-row-Klasse).

import { escapeHtml } from '../../core/format.js';
import { icon } from '../../core/icons/IconSystem.js';
import { ZIEL_LABEL, zahl, bestaetigen } from './medienablageFormat.js';

export function dokumenteNotschalterAn(page) {
  return !!page.data?.einstellung?.notschalter_dokumente;
}

export function dokumenteHtml(page) {
  const an = dokumenteNotschalterAn(page);
  const firmen = new Map((page.data?.unternehmen || []).map(u => [String(u.id), u]));
  const umzuege = new Map((page.data?.dokument_umzug || []).map(u => [String(u.unternehmen_id), u]));
  const liste = (page.data?.dokumente || [])
    .map(d => ({ ...d, ...firmen.get(String(d.id)), dokument_ablage_ziel: d.dokument_ablage_ziel }))
    .sort((a, b) => String(a.firmenname || '').localeCompare(String(b.firmenname || ''), 'de'));
  const aufSharepoint = liste.filter(u => u.dokument_ablage_ziel === 'sharepoint').length;
  const hinweis = an || page.notschalterAn
    ? ' · Ein Notschalter ist aktiv: die Weiche wirkt erst wieder, wenn er aufgehoben ist.'
    : '';

  return `
      <div class="dq-list-card ma-notschalter${an ? ' ma-notschalter--an' : ''}">
        <div class="ma-notschalter-text">
          <h2 class="dq-list-title">Notschalter Dokumente <span class="status-badge ${an ? 'danger' : 'inactive'}">${an ? 'Aktiv' : 'Aus'}</span></h2>
          <p class="dq-list-hint">${an
            ? 'Verträge, Rechnungen und Auftragsdokumente gehen nach Dropbox, unabhängig von der Weiche. Erneut klicken hebt ihn auf.'
            : 'Schickt neue Verträge, Rechnungen und Auftragsdokumente sofort zurück nach Dropbox. Medien bleiben unberührt, der Medien-Notschalter wirkt auch hier.'}</p>
        </div>
        <button type="button" class="mdc-btn ${an ? 'mdc-btn--delete' : 'mdc-btn--secondary'} ma-notschalter-btn"
                data-ma-notschalter-dokumente aria-pressed="${an}">
          ${icon('exclamation-triangle')}<span>Dokumente zurück zu Dropbox</span>
        </button>
      </div>

      <div class="dq-list-card">
        <div class="dq-list-header ma-list-header">
          <div>
            <h2 class="dq-list-title">Weiche Dokumente</h2>
            <p class="dq-list-hint">Verträge, Rechnungen mit Belegen, Auftragsdokumente: ${aufSharepoint} von ${liste.length} Unternehmen laden nach SharePoint (Daten/Firma/Verträge, Rechnungen, Aufträge)${escapeHtml(hinweis)}</p>
          </div>
        </div>
        ${liste.length ? `
        <div class="dq-scroll-x">
        <table class="dq-table ma-table">
          <thead>
            <tr>
              <th>Unternehmen</th>
              <th class="dq-num">SharePoint</th>
              <th class="dq-num">Dropbox</th>
              <th class="dq-num">Supabase</th>
              <th>Ziel Dokumente</th>
              <th>Bestand</th>
            </tr>
          </thead>
          <tbody>
            ${liste.map(u => zeileHtml(u, umzuege.get(String(u.id)))).join('')}
          </tbody>
        </table>
        </div>
        ` : '<div class="dq-leer">Keine Unternehmen.</div>'}
      </div>
    `;
}

function zeileHtml(u, umzug) {
  const ziel = u.dokument_ablage_ziel === 'sharepoint' ? 'sharepoint' : 'dropbox';
  const optionen = Object.entries(ZIEL_LABEL)
    .map(([wert, label]) => `<option value="${wert}"${wert === ziel ? ' selected' : ''}>${label}</option>`)
    .join('');
  return `
      <tr class="ma-row" data-ma-name="${escapeHtml(String(u.firmenname || '').toLowerCase())}">
        <td>
          <span class="dq-name">${escapeHtml(u.firmenname || 'Ohne Namen')}</span>
          ${u.ist_test ? '<span class="status-badge info ma-badge">Testunternehmen</span>' : ''}
        </td>
        <td class="dq-num">${zahl(u.sharepoint)}</td>
        <td class="dq-num">${zahl(u.dropbox)}</td>
        <td class="dq-num">${zahl(u.storage)}</td>
        <td>
          <select class="ma-ziel" data-ma-dokument-weiche="${escapeHtml(u.id)}" data-ma-ziel="${ziel}"
                  aria-label="Ziel neuer Dokumente für ${escapeHtml(u.firmenname || 'Unternehmen')}">
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
  const uebersprungen = Number(umzug?.uebersprungen) || 0;
  const gesamt = offen + fertig + fehler;
  const fehlerText = fehler ? ` · <span class="ma-fehler-text">${zahl(fehler)} Fehler</span>` : '';
  const ohneText = uebersprungen ? ` · ${zahl(uebersprungen)} ohne Datei` : '';

  const lauf = offen > 0 ? `
          <progress class="ma-umzug-balken" max="${gesamt}" value="${fertig}"></progress>
          <span class="ma-umzug-text">Umzug läuft · ${zahl(fertig)} von ${zahl(gesamt)}${fehlerText}</span>` : '';
  if (ziel !== 'sharepoint') {
    if (lauf) return `<div class="ma-umzug">${lauf}</div>`;
    const stand = gesamt || uebersprungen ? `<span class="ma-umzug-text">Umgezogen: ${zahl(fertig)}${fehlerText}${ohneText}</span>` : '';
    return stand || '<span class="ma-leise">–</span>';
  }
  const alt = (Number(u.dropbox) || 0) + (Number(u.storage) || 0);
  const starten = offen > 0;
  const disabled = !starten && !alt;
  const title = disabled ? 'title="Keine Dokumente mehr in Dropbox oder Supabase"' : '';
  const stand = !starten && (gesamt || uebersprungen)
    ? `<span class="ma-umzug-text">Umgezogen: ${zahl(fertig)}${fehlerText}${ohneText}</span>` : '';
  return `
      <div class="ma-umzug">
        ${lauf}
        <button type="button" class="mdc-btn mdc-btn--secondary mdc-btn--sm" data-ma-dokument-umzug="${escapeHtml(u.id)}"
                ${disabled ? 'disabled' : ''} ${title}>${starten ? 'Umzug starten' : 'Dokumente umziehen'}</button>
        ${stand}
      </div>
    `;
}

export async function dokumenteNotschalterUmschalten(page, button) {
  if (page._busy) return;
  const an = !dokumenteNotschalterAn(page);
  if (an) {
    const ok = await bestaetigen({
      title: 'Notschalter Dokumente',
      message: 'Neue Verträge, Rechnungen und Auftragsdokumente gehen ab sofort wieder nach Dropbox, auch für Unternehmen mit Ziel SharePoint. Dokumente in SharePoint bleiben lesbar.',
      confirmText: 'Dokumente zu Dropbox',
      danger: true,
    });
    if (!ok) return;
  }
  await page.ausfuehren({ aktion: 'notschalter', bereich: 'dokumente', an }, {
    button,
    erfolg: an ? 'Notschalter Dokumente aktiv.' : 'Notschalter Dokumente aufgehoben: die Weiche gilt wieder.',
  });
}

export async function dokumentWeicheSetzen(page, select) {
  const unternehmenId = select.dataset.maDokumentWeiche;
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
      title: 'Dokumente auf SharePoint',
      message: `Neue Verträge, Rechnungen und Auftragsdokumente von „${name}“ gehen ab sofort nach SharePoint (Daten/${name}/…). Bestehende bleiben, wo sie sind, bis der Bestand umgezogen wird.`,
      confirmText: 'Auf SharePoint stellen',
    });
    if (!ok) {
      select.value = vorher;
      return;
    }
  }
  await page.ausfuehren({ aktion: 'weiche', bereich: 'dokumente', unternehmen_id: unternehmenId, ziel }, {
    button: select,
    erfolg: `${name}: neue Dokumente gehen nach ${ZIEL_LABEL[ziel]}.`,
  });
}

export async function dokumentUmzugStarten(page, button) {
  if (page._busy) return;
  const unternehmenId = button.dataset.maDokumentUmzug;
  const name = page.unternehmen(unternehmenId)?.firmenname || 'Unternehmen';
  const d = (page.data?.dokumente || []).find(x => String(x.id) === String(unternehmenId));
  const ok = await bestaetigen({
    title: 'Dokumente umziehen',
    message: `${zahl((d?.dropbox || 0) + (d?.storage || 0))} Dokumente von „${name}“ werden im Hintergrund aus Dropbox und Supabase nach SharePoint kopiert. Die Quelle bleibt vorerst stehen.`,
    confirmText: 'Umzug starten',
  });
  if (!ok) return;
  await page.ausfuehren({ aktion: 'dokument_umzug_starten', unternehmen_id: unternehmenId }, {
    button,
    erfolg: (antwort) => {
      const n = zahl(antwort?.angelegt);
      if (antwort?.angestossen === false) {
        return antwort?.angelegt
          ? `${n} Dateien eingereiht, der Läufer ist nicht angesprungen.`
          : 'Der Läufer ist nicht angesprungen.';
      }
      return antwort?.angelegt ? `Dokument-Umzug gestartet: ${n} Dateien.` : 'Umzug gestartet.';
    },
  });
}
