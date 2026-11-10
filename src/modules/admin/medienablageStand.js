// medienablageStand.js
// Stand-Teile der Medienablage-Seite (`page` = MedienablagePage): Karten mit
// Abgleich/Eingang/Abo/Zertifikat/Speicher/Rechten, Notschalter und der Eingang
// (nicht zugeordnete und fehlerhafte Dateien).

import { escapeHtml } from '../../core/format.js';
import { icon } from '../../core/icons/IconSystem.js';
import { GB, relativ, gross, datumZeit, zahl, groesse, ablaufTon, ablaufWert } from './medienablageFormat.js';

// Ab dieser Restlaufzeit werden Webhook-Abo und Zertifikat gelb.
const ABO_WARNUNG_MS = 24 * 60 * 60 * 1000;
const ZERT_WARNUNG_MS = 30 * 24 * 60 * 60 * 1000;

export function nichtKonfiguriertHtml() {
  return `
      <div class="dq-list-card ma-nicht-konfiguriert">
        <div class="dq-leer">
          <strong>SharePoint ist nicht konfiguriert.</strong>
          Alle Uploads laufen über Dropbox. Sobald Site und Drive hinterlegt sind, erscheinen hier Abgleich, Weiche und Eingang.
        </div>
      </div>
    `;
}

function karte({ label, wert, meta = '', ton = 'ok', title = '' }) {
  return `
      <div class="dq-pruefung ma-karte ma-karte--${ton}"${title ? ` title="${escapeHtml(title)}"` : ''}>
        <div class="ma-karte-label">${escapeHtml(label)}</div>
        <div class="ma-karte-wert">${escapeHtml(wert)}</div>
        ${meta ? `<div class="ma-karte-meta">${escapeHtml(meta)}</div>` : ''}
      </div>
    `;
}

export function kartenHtml(page) {
  const s = page.stand;
  const z = page.data?.zaehler || {};

  const abgleichTon = s.fehler ? 'fehler' : (s.voll_abgleich_noetig || !s.letzter_erfolg) ? 'warn' : 'ok';
  let abgleichMeta = s.letzte_meldung || (s.letzter_lauf ? `Letzter Lauf ${relativ(s.letzter_lauf)}` : '');
  if (s.voll_abgleich_noetig) abgleichMeta = 'Vollabgleich nötig';
  if (s.fehler) abgleichMeta = `Fehler${s.fehler_seit ? ` seit ${relativ(s.fehler_seit)}` : ''}: ${s.fehler}`;

  const used = Number(s.quota_used) || 0;
  const total = Number(s.quota_total) || 0;
  const prozent = total ? (used / total) * 100 : null;
  const speicherTon = prozent == null ? 'warn' : prozent >= 90 ? 'fehler' : prozent >= 75 ? 'warn' : 'ok';

  const karten = [
    karte({
      label: 'Abgleich',
      wert: s.letzter_erfolg ? gross(relativ(s.letzter_erfolg)) : 'Noch nie erfolgreich',
      meta: abgleichMeta,
      ton: abgleichTon,
      title: s.letzter_erfolg ? `Letzter Erfolg: ${datumZeit(s.letzter_erfolg)}` : '',
    }),
    karte({
      label: 'Eingang',
      wert: `${zahl(z.offen)} offen`,
      meta: `${zahl(z.erledigt_24h)} erledigt (24 h) · ${zahl(z.unzugeordnet)} nicht zugeordnet · ${zahl(z.fehler)} Fehler`,
      ton: z.fehler ? 'fehler' : z.unzugeordnet ? 'warn' : 'ok',
    }),
    karte({
      label: 'Webhook-Abo',
      wert: ablaufWert(s.abo_ablauf),
      meta: datumZeit(s.abo_ablauf),
      ton: ablaufTon(s.abo_ablauf, ABO_WARNUNG_MS),
    }),
    karte({
      label: 'Zertifikat',
      wert: ablaufWert(s.zert_ablauf),
      meta: datumZeit(s.zert_ablauf),
      ton: ablaufTon(s.zert_ablauf, ZERT_WARNUNG_MS),
    }),
    karte({
      label: 'Speicher',
      wert: prozent == null ? '–' : `${zahl(prozent, 1)} %`,
      meta: total ? `${zahl(used / GB, 1)} von ${zahl(total / GB, 1)} GB belegt` : 'Kein Kontingent gemeldet',
      ton: speicherTon,
    }),
    karte({
      label: 'Rechte-Abgleich',
      wert: s.rechte_lauf ? gross(relativ(s.rechte_lauf)) : 'Noch nie gelaufen',
      meta: s.rechte_fehler || (s.rechte_lauf ? 'Ohne Fehler' : ''),
      ton: s.rechte_fehler ? 'fehler' : s.rechte_lauf ? 'ok' : 'warn',
      title: s.rechte_lauf ? `Letzter Lauf: ${datumZeit(s.rechte_lauf)}` : '',
    }),
  ].join('');

  return `
      <div class="ma-stand">
        <div class="dq-summary ma-karten">${karten}</div>
        <div class="ma-aktionen">
          <button type="button" class="mdc-btn mdc-btn--secondary" data-ma-aktion="jetzt_abgleichen">${icon('arrow-path')}<span>Jetzt abgleichen</span></button>
          <button type="button" class="mdc-btn mdc-btn--secondary" data-ma-aktion="voll_abgleich">${icon('arrow-path')}<span>Vollabgleich</span></button>
          <span class="ma-aktionen-hint">Der Vollabgleich liest die ganze Ablage neu ein und dauert entsprechend länger.</span>
        </div>
      </div>
    `;
}

export function notschalterHtml(page) {
  const an = page.notschalterAn;
  return `
      <div class="dq-list-card ma-notschalter${an ? ' ma-notschalter--an' : ''}">
        <div class="ma-notschalter-text">
          <h2 class="dq-list-title">Notschalter <span class="status-badge ${an ? 'danger' : 'inactive'}">${an ? 'Aktiv' : 'Aus'}</span></h2>
          <p class="dq-list-hint">${an
            ? 'Alle neuen Uploads gehen nach Dropbox, unabhängig von der Weiche. Erneut klicken hebt den Notschalter auf.'
            : 'Schickt alle neuen Uploads sofort zurück nach Dropbox, unabhängig von der Weiche. Dateien in SharePoint bleiben lesbar.'}</p>
        </div>
        <button type="button" class="mdc-btn ${an ? 'mdc-btn--delete' : 'mdc-btn--secondary'} ma-notschalter-btn"
                data-ma-notschalter aria-pressed="${an}">
          ${icon('exclamation-triangle')}<span>Alle Uploads zurück zu Dropbox</span>
        </button>
      </div>
    `;
}

export function unzugeordnetHtml(page) {
  const liste = page.data?.unzugeordnet || [];
  const gesamt = Number(page.data?.zaehler?.unzugeordnet) || liste.length;
  if (!liste.length) {
    return `
        <div class="dq-list-card">
          <div class="dq-list-header"><h2 class="dq-list-title">Nicht zugeordnet</h2></div>
          <div class="dq-leer dq-leer--ok">Alle Dateien im Eingang sind einer Kooperation zugeordnet.</div>
        </div>
      `;
  }

  const zeilen = liste.map(f => `
      <tr>
        <td class="dq-name">${escapeHtml(f.name)}</td>
        <td class="ma-pfad">${escapeHtml(f.pfad)}</td>
        <td>${escapeHtml(f.grund || '–')}</td>
        <td title="${escapeHtml(datumZeit(f.geaendert_at))}">
          ${escapeHtml(f.geaendert_von || '–')}
          <div class="ma-leise">${escapeHtml(gross(relativ(f.geaendert_at)))}</div>
        </td>
        <td class="dq-num">${groesse(f.groesse)}</td>
        <td class="ma-zeilen-aktionen">
          <button type="button" class="mdc-btn mdc-btn--secondary mdc-btn--sm" data-ma-erneut="${escapeHtml(f.item_id)}">Erneut prüfen</button>
          <button type="button" class="mdc-btn mdc-btn--cancel mdc-btn--sm" data-ma-ignorieren="${escapeHtml(f.item_id)}">Ignorieren</button>
        </td>
      </tr>
    `).join('');

  return `
      <div class="dq-list-card">
        <div class="dq-list-header">
          <h2 class="dq-list-title">Nicht zugeordnet</h2>
          <p class="dq-list-hint">${gesamt > liste.length ? `${liste.length} von ${gesamt}` : liste.length} ${gesamt === 1 ? 'Datei liegt' : 'Dateien liegen'} außerhalb der bekannten Ordnerstruktur. Nach dem Verschieben an die richtige Stelle „Erneut prüfen“.</p>
        </div>
        <div class="dq-scroll-x">
        <table class="dq-table ma-table">
          <thead>
            <tr>
              <th>Name</th>
              <th>Pfad</th>
              <th>Grund</th>
              <th>Geändert</th>
              <th class="dq-num">Größe</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            ${zeilen}
          </tbody>
        </table>
        </div>
      </div>
    `;
}

export function fehlerHtml(page) {
  const liste = page.data?.fehler || [];
  if (!liste.length) {
    return `
        <div class="dq-list-card">
          <div class="dq-list-header"><h2 class="dq-list-title">Fehler</h2></div>
          <div class="dq-leer dq-leer--ok">Keine fehlgeschlagenen Dateien.</div>
        </div>
      `;
  }

  const zeilen = liste.map(f => `
      <tr>
        <td class="dq-name">${escapeHtml(f.name)}</td>
        <td class="ma-pfad">${escapeHtml(f.pfad)}</td>
        <td class="ma-fehler-text">${escapeHtml(f.grund || '–')}</td>
        <td class="dq-num">${zahl(f.versuche)}</td>
        <td title="${escapeHtml(datumZeit(f.naechster_versuch))}">${escapeHtml(gross(relativ(f.naechster_versuch)) || '–')}</td>
        <td class="ma-zeilen-aktionen">
          <button type="button" class="mdc-btn mdc-btn--secondary mdc-btn--sm" data-ma-erneut="${escapeHtml(f.item_id)}">Erneut</button>
        </td>
      </tr>
    `).join('');

  return `
      <div class="dq-list-card">
        <div class="dq-list-header">
          <h2 class="dq-list-title">Fehler</h2>
          <p class="dq-list-hint">${liste.length} ${liste.length === 1 ? 'Datei konnte' : 'Dateien konnten'} nicht verarbeitet werden. Sie werden automatisch erneut versucht.</p>
        </div>
        <div class="dq-scroll-x">
        <table class="dq-table ma-table">
          <thead>
            <tr>
              <th>Name</th>
              <th>Pfad</th>
              <th>Grund</th>
              <th class="dq-num">Versuche</th>
              <th>Nächster Versuch</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            ${zeilen}
          </tbody>
        </table>
        </div>
      </div>
    `;
}
