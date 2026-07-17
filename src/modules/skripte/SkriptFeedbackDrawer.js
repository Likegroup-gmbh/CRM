// SkriptFeedbackDrawer.js
// Feedback-Drawer fuer den Skript-Editor. Zwei Modi:
//   Sektions-Modus  aus dem Editor via Text-Markierung: nur die betroffene
//                   Sektion, Speichern loest die KI-Ueberarbeitung aus
//   Voll-Modus      Button im Editor-Kopf: alle Sektionen + GESAMT als
//                   aufklappbare Bloecke, Performance-Label/Notiz/Branche,
//                   Loeschen (ersetzt den frueheren Drawer der Skriptliste)
// Score als Regler 1,0-5,0 in 0,1er-Schritten ("keine Bewertung" bis der
// Regler angefasst wird).

import { skripteService, PERFORMANCE_LABELS } from './SkripteService.js';
import { escapeHtml, formatDate, badge } from './SkripteUtils.js';

const SEKTION_LABELS = { hook: 'HOOK', hauptteil: 'HAUPTTEIL', cta: 'CTA', gesamt: 'GESAMT' };

const BEWERTUNGSLEITFADEN = `
  <details class="skripte-leitfaden">
    <summary>Bewertungsleitfaden (bitte vor dem Bewerten lesen)</summary>
    <ul>
      <li><strong>5</strong> – Direkt nutzbar, keine Änderung nötig. Trifft Ton, Zielgruppe und Briefing exakt.</li>
      <li><strong>4</strong> – Sehr gut, nur Kleinigkeiten (einzelne Wörter/Formulierungen).</li>
      <li><strong>3</strong> – Brauchbares Gerüst, aber spürbare Überarbeitung nötig.</li>
      <li><strong>2</strong> – Falsche Richtung (Ton, Struktur oder Botschaft), Grundidee rettbar.</li>
      <li><strong>1</strong> – Unbrauchbar, müsste komplett neu geschrieben werden.</li>
    </ul>
    <p>Zwischenwerte sind ausdrücklich erlaubt (z.B. 3,7). Begründung immer konkret:
    WAS ist gut/schlecht und WARUM – daraus lernt die DNA.
    Wenn du eine Sektion umschreibst, trage die korrigierte Version ein: sie ist das stärkste Lernsignal.</p>
  </details>
`;

function formatScore(value) {
  return Number(value).toLocaleString('de-DE', { minimumFractionDigits: 1, maximumFractionDigits: 1 });
}

/** Sektionstext mit hervorgehobener Markierung (alles escaped). */
function highlightSelektion(text, selektion) {
  const voll = String(text || '–');
  if (!selektion) return escapeHtml(voll);
  const idx = voll.indexOf(selektion);
  if (idx === -1) return escapeHtml(voll);
  return escapeHtml(voll.slice(0, idx))
    + `<mark class="skripte-feedback-mark">${escapeHtml(selektion)}</mark>`
    + escapeHtml(voll.slice(idx + selektion.length));
}

export class SkriptFeedbackDrawer {
  // ------------------------------------------------------------------
  // Sektions-Modus
  // ------------------------------------------------------------------
  /**
   * Feedback zu EINER Sektion (optional mit markierter Stelle).
   * onSubmit({ score, begruendung, korrektur }) wird nach Klick auf
   * "Feedback senden" aufgerufen - der Aufrufer speichert und startet
   * die Ueberarbeitung.
   */
  async openSektion({ skript, sektion, selektionText = null, onSubmit }) {
    const feedback = await skripteService.loadFeedback(skript.id);
    const altes = feedback.filter((f) => f.sektion === sektion);

    const body = `
      <div class="skripte-detail-meta">
        ${badge(SEKTION_LABELS[sektion], 'info')}
        ${selektionText ? badge('Markierte Stelle') : ''}
      </div>
      <div class="skripte-sektion">
        <div class="skripte-sektion-label">${SEKTION_LABELS[sektion]}</div>
        <div class="skripte-sektion-text">${highlightSelektion(skript[sektion], selektionText)}</div>
      </div>
      ${this.altesFeedbackHtml(altes)}
      ${BEWERTUNGSLEITFADEN}
      <div class="skripte-feedback-form">
        ${this.scoreSliderHtml(sektion)}
        <textarea id="fb-text-${sektion}" class="form-input" rows="3" placeholder="Begründung: Was ist gut/schlecht und warum?"></textarea>
        <textarea id="fb-korrektur-${sektion}" class="form-input" rows="3" placeholder="Optional: So sollte es sein (Vorgabe für die Überarbeitung)"></textarea>
      </div>
      <p class="skripte-hint">Nach dem Senden wird das Feedback gespeichert und Liky schlägt direkt eine Überarbeitung vor.</p>
    `;

    this.createDrawer(`Feedback · ${SEKTION_LABELS[sektion]}`, body, [
      { label: 'Feedback senden', primary: true, onClick: async () => {
        const score = this.readScore(sektion);
        const begruendung = document.getElementById(`fb-text-${sektion}`)?.value.trim() || '';
        const korrektur = document.getElementById(`fb-korrektur-${sektion}`)?.value.trim() || '';
        if (score == null && !begruendung && !korrektur) {
          window.toastSystem?.error('Bitte mindestens Score oder Begründung angeben');
          return false;
        }
        await onSubmit({ score, begruendung, korrektur });
        return true;
      } }
    ]);

    this.bindScoreSlider(sektion);
  }

  // ------------------------------------------------------------------
  // Voll-Modus
  // ------------------------------------------------------------------
  /**
   * Komplette Bewertung (alle Sektionen + GESAMT) + Performance-Label,
   * Notiz, Branche und Loeschen. Nur speichern, keine Ueberarbeitung.
   */
  async openVoll({ skript, versionNr = null, onSaved, onDeleted }) {
    const [feedback, branchen] = await Promise.all([
      skripteService.loadFeedback(skript.id),
      skripteService.loadBranchen()
    ]);

    const feedbackBySektion = {};
    for (const f of feedback) {
      (feedbackBySektion[f.sektion] = feedbackBySektion[f.sektion] || []).push(f);
    }

    const sektionBlock = (sektion, rows) => `
      <details class="skripte-feedback-details">
        <summary>${SEKTION_LABELS[sektion]}</summary>
        <div class="skripte-sektion">
          ${sektion !== 'gesamt' ? `<div class="skripte-sektion-text">${escapeHtml(skript[sektion] || '–')}</div>` : ''}
          ${this.altesFeedbackHtml(feedbackBySektion[sektion] || [])}
          <div class="skripte-feedback-form">
            ${this.scoreSliderHtml(sektion)}
            <textarea id="fb-text-${sektion}" class="form-input" rows="2" placeholder="${sektion === 'gesamt' ? 'Gesamteindruck, Struktur, roter Faden...' : 'Begründung: Was ist gut/schlecht und warum?'}"></textarea>
            ${sektion !== 'gesamt' ? `<textarea id="fb-korrektur-${sektion}" class="form-input" rows="${rows}" placeholder="Optional: korrigierte Version dieser Sektion"></textarea>` : ''}
          </div>
        </div>
      </details>
    `;

    const body = `
      <div class="skripte-detail-meta">
        ${badge(skript.herkunft === 'historisch' ? 'Historisch' : 'Generiert', 'info')}
        ${skript.unternehmen?.firmenname ? badge(skript.unternehmen.firmenname) : ''}
        ${skript.marke?.markenname ? badge(skript.marke.markenname) : ''}
        ${skript.branchen?.name ? badge(skript.branchen.name, 'info') : ''}
        ${skript.herkunft === 'generiert' ? badge(skript.mit_dna ? 'mit DNA' : 'ohne DNA (blind)', skript.mit_dna ? 'success' : 'neutral') : ''}
      </div>

      <div class="skripte-form-grid">
        <div class="form-group">
          <label class="form-label">Performance-Label</label>
          <select id="det-label" class="form-input">
            ${Object.entries(PERFORMANCE_LABELS).map(([v, l]) =>
              `<option value="${v}" ${skript.performance_label === v ? 'selected' : ''}>${l}</option>`).join('')}
          </select>
        </div>
        <div class="form-group">
          <label class="form-label">Performance-Notiz</label>
          <input id="det-notiz" class="form-input" type="text" value="${escapeHtml(skript.performance_notiz || '')}"
            placeholder="Views, CTR, Laufzeit..." />
        </div>
        <div class="form-group">
          <label class="form-label">Branche</label>
          <select id="det-branche" class="form-input">
            <option value="">– Keine –</option>
            ${branchen.map((b) =>
              `<option value="${b.id}" ${skript.branche_id === b.id ? 'selected' : ''}>${escapeHtml(b.name)}</option>`).join('')}
          </select>
        </div>
      </div>

      ${BEWERTUNGSLEITFADEN}

      ${sektionBlock('hook', 2)}
      ${sektionBlock('hauptteil', 4)}
      ${sektionBlock('cta', 2)}
      ${sektionBlock('gesamt', 2)}
    `;

    this.createDrawer(skript.titel || 'Skript bewerten', body, [
      { label: 'Löschen', danger: true, onClick: async () => {
        const res = await window.confirmationModal?.open({
          title: 'Skript löschen?',
          message: 'Das Skript und sein Feedback werden endgültig gelöscht.',
          confirmText: 'Löschen',
          danger: true
        });
        if (res && !res.confirmed) return false;
        await skripteService.deleteSkript(skript.id);
        window.toastSystem?.success('Skript gelöscht');
        await onDeleted?.();
        return true;
      } },
      { label: 'Speichern', primary: true, onClick: async () => {
        try {
          // Performance-Label + Branche (Nachkategorisierung)
          await skripteService.updateSkript(skript.id, {
            performance_label: document.getElementById('det-label').value,
            performance_notiz: document.getElementById('det-notiz').value.trim() || null,
            branche_id: document.getElementById('det-branche').value || null
          });

          const eintraege = ['hook', 'hauptteil', 'cta', 'gesamt'].map((sektion) => ({
            sektion,
            score: this.readScore(sektion),
            begruendung: document.getElementById(`fb-text-${sektion}`)?.value || '',
            korrigierte_version: document.getElementById(`fb-korrektur-${sektion}`)?.value || '',
            version_nr: versionNr
          }));
          const gespeichert = await skripteService.saveFeedback(skript.id, eintraege);
          window.toastSystem?.success(gespeichert.length ? `Gespeichert (${gespeichert.length} Feedback-Einträge)` : 'Gespeichert');
          await onSaved?.();
          return true;
        } catch (err) {
          window.toastSystem?.error(err.message);
          return false;
        }
      } }
    ]);

    for (const sektion of ['hook', 'hauptteil', 'cta', 'gesamt']) {
      this.bindScoreSlider(sektion);
    }
  }

  // ------------------------------------------------------------------
  // Score-Regler
  // ------------------------------------------------------------------
  scoreSliderHtml(sektion) {
    return `
      <div class="skripte-score-slider-row">
        <span>Score:</span>
        <input type="range" id="fb-score-${sektion}" class="skripte-score-slider"
          min="1" max="5" step="0.1" value="3" data-touched="0" />
        <span class="skripte-score-value" id="fb-score-val-${sektion}">–</span>
        <button type="button" class="skripte-score-reset" id="fb-score-reset-${sektion}" hidden
          title="Bewertung zurücksetzen" aria-label="Bewertung zurücksetzen">&times;</button>
      </div>
    `;
  }

  bindScoreSlider(sektion) {
    const slider = document.getElementById(`fb-score-${sektion}`);
    const val = document.getElementById(`fb-score-val-${sektion}`);
    const reset = document.getElementById(`fb-score-reset-${sektion}`);
    if (!slider || !val || !reset) return;

    slider.addEventListener('input', () => {
      slider.dataset.touched = '1';
      val.textContent = `${formatScore(slider.value)} / 5`;
      reset.hidden = false;
    });
    reset.addEventListener('click', () => {
      slider.dataset.touched = '0';
      slider.value = '3';
      val.textContent = '–';
      reset.hidden = true;
    });
  }

  readScore(sektion) {
    const slider = document.getElementById(`fb-score-${sektion}`);
    if (!slider || slider.dataset.touched !== '1') return null;
    return Math.round(parseFloat(slider.value) * 10) / 10;
  }

  // ------------------------------------------------------------------
  // Bisheriges Feedback
  // ------------------------------------------------------------------
  altesFeedbackHtml(list) {
    if (!list.length) return '';
    return `<div class="skripte-altes-feedback">${list.map((f) => `
      <div class="skripte-feedback-item">
        <strong>${f.score != null ? `${formatScore(f.score)}/5` : '–'}</strong> ${escapeHtml(f.begruendung || '')}
        ${f.selektion_text ? `<div class="skripte-feedback-quote">Zu: „${escapeHtml(f.selektion_text)}“</div>` : ''}
        ${f.korrigierte_version ? `<div class="skripte-korrektur">Korrigiert: ${escapeHtml(f.korrigierte_version)}</div>` : ''}
        <span class="skripte-hint">${formatDate(f.created_at)}${f.version_nr ? ` · v${f.version_nr}` : ''}</span>
      </div>
    `).join('')}</div>`;
  }

  // ------------------------------------------------------------------
  // Drawer-Helfer (Pattern wie SkriptListeTab)
  // ------------------------------------------------------------------
  createDrawer(title, bodyHtml, buttons) {
    this.close();

    const overlay = document.createElement('div');
    overlay.className = 'drawer-overlay show';
    overlay.id = 'skripte-feedback-drawer-overlay';

    const panel = document.createElement('div');
    panel.setAttribute('role', 'dialog');
    panel.className = 'drawer-panel show skripte-drawer';
    panel.id = 'skripte-feedback-drawer';
    panel.innerHTML = `
      <div class="skripte-drawer-header">
        <h2>${escapeHtml(title)}</h2>
        <button class="skripte-drawer-close" aria-label="Schließen">&times;</button>
      </div>
      <div class="skripte-drawer-body">${bodyHtml}</div>
      <div class="skripte-drawer-footer"></div>
    `;

    const footer = panel.querySelector('.skripte-drawer-footer');
    for (const btn of buttons) {
      const el = document.createElement('button');
      el.className = btn.primary ? 'primary-btn' : (btn.danger ? 'danger-btn' : 'secondary-btn');
      el.textContent = btn.label;
      el.addEventListener('click', async () => {
        el.disabled = true;
        const close = await btn.onClick();
        el.disabled = false;
        if (close !== false) this.close();
      });
      footer.appendChild(el);
    }

    overlay.addEventListener('click', () => this.close());
    panel.querySelector('.skripte-drawer-close').addEventListener('click', () => this.close());

    document.body.appendChild(overlay);
    document.body.appendChild(panel);
  }

  close() {
    document.getElementById('skripte-feedback-drawer-overlay')?.remove();
    document.getElementById('skripte-feedback-drawer')?.remove();
  }
}
