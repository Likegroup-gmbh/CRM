// SkriptAuswertungTab.js
// Lern-Nachweis: Score-Trend pro Sektion ueber Zeit (Monatsmittel)
// + Blindvergleich (Durchschnitts-Scores mit DNA vs. ohne DNA).

import { skripteService } from './SkripteService.js';
import { escapeHtml } from './SkripteUtils.js';

const SEKTION_LABELS = { hook: 'Hook', hauptteil: 'Hauptteil', cta: 'CTA', gesamt: 'Gesamt' };

export class SkriptAuswertungTab {
  constructor(page) {
    this.page = page;
  }

  async render(container) {
    container.innerHTML = '<div class="skripte-hint">Lade Auswertung...</div>';
    const { feedback, skripte } = await skripteService.loadAuswertung();

    if (!feedback.length) {
      container.innerHTML = `<div class="empty-state"><p>Noch kein bewertetes Feedback vorhanden.
        Der Score-Trend erscheint, sobald Skripte bewertet wurden.</p></div>`;
      return;
    }

    const skriptById = {};
    for (const s of skripte) skriptById[s.id] = s;

    container.innerHTML = `
      <div class="skripte-card">
        <h3>Score-Trend pro Sektion (Monatsmittel)</h3>
        <p class="skripte-hint">Steigende Werte über Zeit = das System lernt. Nur Feedback zu generierten Skripten.</p>
        ${this.renderTrendTable(feedback, skriptById)}
      </div>
      <div class="skripte-card">
        <h3>Blindvergleich: mit DNA vs. ohne DNA</h3>
        <p class="skripte-hint">Misst, ob die DNA wirklich etwas bringt. Regelmäßig Skripte "ohne DNA" generieren und blind bewerten.</p>
        ${this.renderBlindTable(feedback, skriptById)}
      </div>
    `;
  }

  renderTrendTable(feedback, skriptById) {
    // Nur generierte Skripte fuer den Trend (historische verzerren)
    const relevant = feedback.filter((f) => skriptById[f.skript_id]?.herkunft === 'generiert');
    if (!relevant.length) return '<p class="skripte-hint">Noch kein Feedback zu generierten Skripten.</p>';

    // Gruppieren: Monat -> Sektion -> Scores
    const byMonat = {};
    for (const f of relevant) {
      const monat = (f.created_at || '').slice(0, 7);
      // numeric-Spalten kommen von PostgREST als String -> in Zahl wandeln
      ((byMonat[monat] = byMonat[monat] || {})[f.sektion] = byMonat[monat][f.sektion] || []).push(Number(f.score));
    }

    const monate = Object.keys(byMonat).sort();
    const sektionen = ['hook', 'hauptteil', 'cta', 'gesamt'];
    const avg = (arr) => arr && arr.length ? (arr.reduce((a, b) => a + b, 0) / arr.length) : null;

    return `
      <table class="skripte-table">
        <thead><tr><th>Monat</th>${sektionen.map((s) => `<th>${SEKTION_LABELS[s]}</th>`).join('')}<th>Bewertungen</th></tr></thead>
        <tbody>
          ${monate.map((monat) => {
            const zeile = byMonat[monat];
            const gesamt = Object.values(zeile).reduce((a, arr) => a + arr.length, 0);
            return `<tr>
              <td>${escapeHtml(monat)}</td>
              ${sektionen.map((s) => {
                const a = avg(zeile[s]);
                return `<td>${a !== null ? `<strong>${a.toFixed(2)}</strong> <span class="skripte-hint">(${zeile[s].length})</span>` : '–'}</td>`;
              }).join('')}
              <td>${gesamt}</td>
            </tr>`;
          }).join('')}
        </tbody>
      </table>
    `;
  }

  renderBlindTable(feedback, skriptById) {
    const gruppen = { mit: [], ohne: [] };
    for (const f of feedback) {
      const s = skriptById[f.skript_id];
      if (!s || s.herkunft !== 'generiert') continue;
      (s.mit_dna ? gruppen.mit : gruppen.ohne).push(f);
    }

    if (!gruppen.ohne.length) {
      return `<p class="skripte-hint">Noch keine Bewertungen für "ohne DNA"-Skripte.
        Im Generator die Checkbox "Ohne DNA generieren" nutzen, um Vergleichsdaten zu sammeln.</p>`;
    }

    const sektionen = ['hook', 'hauptteil', 'cta', 'gesamt'];
    const avgFor = (list, sektion) => {
      const scores = list.filter((f) => f.sektion === sektion).map((f) => Number(f.score));
      return scores.length ? (scores.reduce((a, b) => a + b, 0) / scores.length) : null;
    };

    return `
      <table class="skripte-table">
        <thead><tr><th></th>${sektionen.map((s) => `<th>${SEKTION_LABELS[s]}</th>`).join('')}<th>Skripte</th><th>Bewertungen</th></tr></thead>
        <tbody>
          ${[['mit', 'Mit DNA'], ['ohne', 'Ohne DNA (blind)']].map(([key, label]) => `
            <tr>
              <td><strong>${label}</strong></td>
              ${sektionen.map((s) => {
                const a = avgFor(gruppen[key], s);
                return `<td>${a !== null ? a.toFixed(2) : '–'}</td>`;
              }).join('')}
              <td>${new Set(gruppen[key].map((f) => f.skript_id)).size}</td>
              <td>${gruppen[key].length}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    `;
  }

  cleanup() {}
}
