// KampagneTable.js (ES6-Modul)
// Wiederverwendbare Tabellen-Ausgabe für Kampagnen

import { KampagneUtils } from './KampagneUtils.js';

export function renderKampagnenTable(kampagnen, options = {}) {
  const { showActions = false } = options;

  const formatDate = (date) => (date ? new Date(date).toLocaleDateString('de-DE') : '-');
  const formatArray = (arr) => (Array.isArray(arr) && arr.length > 0 ? arr.join(', ') : '-');

  const rows = (kampagnen || []).map((k) => {
    // k ist flach (direkt aus kampagne) – Felder ggf. verschachtelt absichern
    const id = k.id;
    const name = KampagneUtils.getDisplayName(k);
    const unternehmen = k.unternehmen?.firmenname || '-';
    const marke = k.marke?.markenname || '-';
    const artDerKampagne = formatArray(k.art_der_kampagne);
    const start = formatDate(k.start);
    const creatorAnzahl = k.creatoranzahl ?? '-';
    const videoAnzahl = k.videoanzahl ?? '-';

    return `
      <tr data-id="${id || ''}">
        <td>
          ${id ? `<a href="/kampagne/${id}" class="table-link" data-table="kampagne" data-id="${id}">${name}</a>` : name}
        </td>
        <td>${unternehmen}</td>
        <td>${marke}</td>
        <td>${artDerKampagne}</td>
        <td>${start}</td>
        <td>${creatorAnzahl}</td>
        <td>${videoAnzahl}</td>
        ${showActions ? '<td></td>' : ''}
      </tr>
    `;
  }).join('');

  return `
    <div class="data-table-container">
      <table class="data-table">
        <thead>
          <tr>
            <th>Kampagnenname</th>
            <th>Unternehmen</th>
            <th>Marke</th>
            <th>Art der Kampagne</th>
            <th>Start</th>
            <th>Creator Anzahl</th>
            <th>Video Anzahl</th>
            ${showActions ? '<th>Aktionen</th>' : ''}
          </tr>
        </thead>
        <tbody>
          ${rows || ''}
        </tbody>
      </table>
    </div>
  `;
}


