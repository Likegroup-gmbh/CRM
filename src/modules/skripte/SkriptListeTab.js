// SkriptListeTab.js
// Liste aller Skripte (generiert + historisch), Import-Drawer fuer Backfill,
// Detail-Drawer mit strukturiertem Feedback (Score 1-5 + Freitext pro Sektion)
// inkl. Bewertungsleitfaden und Performance-Labeling.

import { skripteService, PERFORMANCE_LABELS, FUNNEL_STUFEN } from './SkripteService.js';
import { escapeHtml, formatDate, badge, costBadge, PERFORMANCE_BADGE_VARIANT, STATUS_LABELS } from './SkripteUtils.js';

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
    <p>Begründung immer konkret: WAS ist gut/schlecht und WARUM – daraus lernt die DNA.
    Wenn du eine Sektion umschreibst, trage die korrigierte Version ein: sie ist das stärkste Lernsignal.</p>
  </details>
`;

/** Original-Generator-Eingaben als einklappbarer Block (wie Bewertungsleitfaden). */
function renderOriginalAnfrage(skript) {
  const dnaVersionen = skript.prompt_kontext?.dna_versionen || [];
  const dnaLabel = !skript.mit_dna
    ? 'Ohne DNA (Blindvergleich)'
    : dnaVersionen.length
      ? dnaVersionen.map((d) => d.name || `${d.layer} v${d.version}`).join(', ')
      : 'Automatisch (keine Layer gefunden)';

  const row = (label, value, copyable = false) => {
    if (value == null || String(value).trim() === '') return '';
    const text = String(value);
    return `
      <div class="skripte-anfrage-row">
        <div class="skripte-anfrage-label">
          <span>${escapeHtml(label)}</span>
          ${copyable ? '<button type="button" class="secondary-btn skripte-anfrage-copy">Kopieren</button>' : ''}
        </div>
        <div class="skripte-anfrage-value">${escapeHtml(text)}</div>
      </div>`;
  };

  const inhalt = [
    row('Marke', skript.marke?.markenname),
    row('Branche', skript.branchen?.name),
    row('Kampagne', skript.kampagne?.eigener_name || skript.kampagne?.kampagnenname),
    row('Produkt', skript.produkt?.name),
    row('Persona', skript.personas?.name),
    row('Funnel-Stufe', FUNNEL_STUFEN[skript.funnel_stufe] || skript.funnel_stufe),
    row('Tonalität', skript.tonalitaet, true),
    row('Skript-DNA', dnaLabel),
    row('Video-Idee', skript.video_idee, true),
    row('Location', skript.location, true),
    row('Regieanweisung', skript.regieanweisung, true)
  ].join('');

  if (!inhalt.trim()) {
    return `
      <details class="skripte-leitfaden">
        <summary>Originalanfrage (Generator)</summary>
        <p class="skripte-hint">Keine Generator-Eingaben hinterlegt (z.B. historischer Import).</p>
      </details>`;
  }

  return `
    <details class="skripte-leitfaden" open>
      <summary>Originalanfrage (Generator) – zum Wiederverwenden beim Testen</summary>
      <div class="skripte-anfrage">
        ${inhalt}
        <div class="skripte-actions-row" style="margin-top: var(--space-xs);">
          <button type="button" class="secondary-btn" id="det-anfrage-copy-all">Gesamte Anfrage kopieren</button>
        </div>
      </div>
    </details>`;
}

export class SkriptListeTab {
  constructor(page) {
    this.page = page;
    this.skripte = [];
    this.marken = [];
    this.branchen = [];
    this.brancheFilter = '';
  }

  async render(container) {
    container.innerHTML = `
      <div class="skripte-actions-row" style="margin-bottom: var(--space-md);">
        <button id="liste-import-btn" class="secondary-btn">Historisches Skript importieren</button>
        <select id="liste-branche-filter" class="form-input" style="width:auto;">
          <option value="">Alle Branchen</option>
        </select>
        <span class="skripte-hint">Backfill: alte Skripte mit Performance-Label anlegen, damit die KI Beispiele hat.</span>
      </div>
      <div id="liste-wrap"></div>
    `;
    container.querySelector('#liste-import-btn').addEventListener('click', () => this.openImportDrawer());
    container.querySelector('#liste-branche-filter').addEventListener('change', (e) => {
      this.brancheFilter = e.target.value;
      this.renderListe();
    });
    await this.reload();
  }

  async reload() {
    [this.skripte, this.marken, this.branchen] = await Promise.all([
      skripteService.loadSkripte(),
      skripteService.loadMarken(),
      skripteService.loadBranchen()
    ]);

    const filterSelect = document.getElementById('liste-branche-filter');
    if (filterSelect) {
      filterSelect.innerHTML = '<option value="">Alle Branchen</option>'
        + this.branchen.map((b) =>
          `<option value="${b.id}" ${this.brancheFilter === b.id ? 'selected' : ''}>${escapeHtml(b.name)}</option>`).join('');
    }

    this.renderListe();
  }

  renderListe() {
    const wrap = document.getElementById('liste-wrap');
    if (!wrap) return;

    if (!this.skripte.length) {
      wrap.innerHTML = `<div class="empty-state"><p>Noch keine Skripte. Generiere eins im Generator-Tab oder importiere historische Skripte.</p></div>`;
      return;
    }

    const gefiltert = this.brancheFilter
      ? this.skripte.filter((s) => s.branche_id === this.brancheFilter)
      : this.skripte;

    if (!gefiltert.length) {
      wrap.innerHTML = `<div class="empty-state"><p>Keine Skripte in dieser Branche.</p></div>`;
      return;
    }

    wrap.innerHTML = `
      <table class="skripte-table">
        <thead>
          <tr>
            <th>Titel</th><th>Marke</th><th>Branche</th><th>Herkunft</th><th>Status</th><th>Performance</th><th>DNA</th><th>Datum</th><th></th>
          </tr>
        </thead>
        <tbody>
          ${gefiltert.map((s) => `
            <tr data-id="${s.id}">
              <td class="skripte-table-titel">${escapeHtml(s.titel || s.hook?.slice(0, 60) || '(ohne Titel)')}</td>
              <td>${escapeHtml(s.marke?.markenname || '–')}</td>
              <td>${escapeHtml(s.branchen?.name || '–')}</td>
              <td>${badge(s.herkunft === 'historisch' ? 'Historisch' : 'Generiert', s.herkunft === 'historisch' ? 'neutral' : 'info')}</td>
              <td>${badge(STATUS_LABELS[s.status] || s.status)}</td>
              <td>${badge(PERFORMANCE_LABELS[s.performance_label] || s.performance_label, PERFORMANCE_BADGE_VARIANT[s.performance_label])}</td>
              <td>${s.herkunft === 'generiert' ? (s.mit_dna ? 'mit' : 'ohne') : '–'}</td>
              <td>${formatDate(s.created_at)}</td>
              <td><button class="secondary-btn skripte-row-open">Öffnen</button></td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    `;

    wrap.querySelectorAll('.skripte-row-open').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        const id = e.target.closest('tr').dataset.id;
        this.openDetailDrawer(id);
      });
    });
  }

  // ------------------------------------------------------------------
  // Import-Drawer (Backfill historischer Skripte)
  // ------------------------------------------------------------------
  openImportDrawer() {
    const body = `
      <p class="skripte-hint">Hook/Hauptteil/CTA getrennt eintragen – so kann die KI sektionsweise lernen.
      Performance-Label ehrlich setzen: falsches Label = falsche DNA.</p>
      <div class="form-group">
        <label class="form-label">Titel *</label>
        <input id="imp-titel" class="form-input" type="text" placeholder="z.B. 'EDEKA Herbstkampagne – Rezept-Hook'" />
      </div>
      <div class="skripte-form-grid">
        <div class="form-group">
          <label class="form-label">Marke</label>
          <select id="imp-marke" class="form-input">
            <option value="">– Keine –</option>
            ${this.marken.map((m) => `<option value="${m.id}">${escapeHtml(m.markenname)}</option>`).join('')}
          </select>
        </div>
        <div class="form-group">
          <label class="form-label">Branche</label>
          <select id="imp-branche" class="form-input">
            <option value="">– Keine –</option>
            ${this.branchen.map((b) => `<option value="${b.id}">${escapeHtml(b.name)}</option>`).join('')}
          </select>
        </div>
        <div class="form-group">
          <label class="form-label">Performance-Label *</label>
          <select id="imp-label" class="form-input">
            ${Object.entries(PERFORMANCE_LABELS).map(([v, l]) => `<option value="${v}">${l}</option>`).join('')}
          </select>
        </div>
        <div class="form-group">
          <label class="form-label">Funnel-Stufe</label>
          <select id="imp-funnel" class="form-input">
            <option value="">– Unbekannt –</option>
            ${Object.entries(FUNNEL_STUFEN).map(([v, l]) => `<option value="${v}">${l}</option>`).join('')}
          </select>
        </div>
      </div>
      <div class="form-group">
        <label class="form-label">Hook *</label>
        <textarea id="imp-hook" class="form-input" rows="2"></textarea>
      </div>
      <div class="form-group">
        <label class="form-label">Hauptteil *</label>
        <textarea id="imp-hauptteil" class="form-input" rows="5"></textarea>
      </div>
      <div class="form-group">
        <label class="form-label">CTA *</label>
        <textarea id="imp-cta" class="form-input" rows="2"></textarea>
      </div>
      <div class="form-group">
        <label class="form-label">Performance-Notiz (Zahlen, Kontext)</label>
        <textarea id="imp-notiz" class="form-input" rows="2" placeholder="z.B. '450k Views, 3,2% CTR, lief 6 Wochen als Paid'"></textarea>
      </div>
    `;

    this.createDrawer('Historisches Skript importieren', body, [
      { label: 'Importieren', primary: true, onClick: async () => {
        const titel = document.getElementById('imp-titel').value.trim();
        const hook = document.getElementById('imp-hook').value.trim();
        const hauptteil = document.getElementById('imp-hauptteil').value.trim();
        const cta = document.getElementById('imp-cta').value.trim();
        if (!titel || !hook || !hauptteil || !cta) {
          window.toastSystem?.error('Titel, Hook, Hauptteil und CTA sind Pflicht');
          return false;
        }
        try {
          await skripteService.importSkript({
            titel,
            hook,
            hauptteil,
            cta,
            marke_id: document.getElementById('imp-marke').value || null,
            branche_id: document.getElementById('imp-branche').value || null,
            funnel_stufe: document.getElementById('imp-funnel').value || null,
            performance_label: document.getElementById('imp-label').value,
            performance_notiz: document.getElementById('imp-notiz').value.trim() || null
          });
          window.toastSystem?.success('Skript importiert');
          await this.reload();
          return true;
        } catch (err) {
          window.toastSystem?.error(err.message);
          return false;
        }
      } }
    ]);

    // Branche der gewaehlten Marke vorbelegen (manuell ueberschreibbar)
    document.getElementById('imp-marke').addEventListener('change', (e) => {
      const marke = this.marken.find((m) => m.id === e.target.value);
      if (marke?.branche_id) document.getElementById('imp-branche').value = marke.branche_id;
    });
  }

  // ------------------------------------------------------------------
  // Detail-Drawer: Skript + Feedback + Performance-Label
  // ------------------------------------------------------------------
  async openDetailDrawer(skriptId) {
    const [skript, feedback] = await Promise.all([
      skripteService.loadSkript(skriptId),
      skripteService.loadFeedback(skriptId)
    ]);
    if (!skript) return;

    const feedbackBySektion = {};
    for (const f of feedback) {
      (feedbackBySektion[f.sektion] = feedbackBySektion[f.sektion] || []).push(f);
    }

    const renderAltesFeedback = (sektion) => {
      const list = feedbackBySektion[sektion] || [];
      if (!list.length) return '';
      return `<div class="skripte-altes-feedback">${list.map((f) => `
        <div class="skripte-feedback-item">
          <strong>${f.score ? `${f.score}/5` : '–'}</strong> ${escapeHtml(f.begruendung || '')}
          ${f.korrigierte_version ? `<div class="skripte-korrektur">Korrigiert: ${escapeHtml(f.korrigierte_version)}</div>` : ''}
          <span class="skripte-hint">${formatDate(f.created_at)}</span>
        </div>
      `).join('')}</div>`;
    };

    const sektionBlock = (sektion, label, rows) => `
      <div class="skripte-sektion">
        <div class="skripte-sektion-label">${label}</div>
        <div class="skripte-sektion-text">${escapeHtml(skript[sektion] || '–')}</div>
        ${renderAltesFeedback(sektion)}
        <div class="skripte-feedback-form">
          <div class="skripte-score-row">
            <span>Score:</span>
            ${[1, 2, 3, 4, 5].map((n) => `
              <label class="skripte-score-option">
                <input type="radio" name="fb-score-${sektion}" value="${n}" /> ${n}
              </label>
            `).join('')}
          </div>
          <textarea id="fb-text-${sektion}" class="form-input" rows="2" placeholder="Begründung: Was ist gut/schlecht und warum?"></textarea>
          <textarea id="fb-korrektur-${sektion}" class="form-input" rows="${rows}" placeholder="Optional: korrigierte Version dieser Sektion"></textarea>
        </div>
      </div>
    `;

    const body = `
      <div class="skripte-detail-meta">
        ${badge(skript.herkunft === 'historisch' ? 'Historisch' : 'Generiert', 'info')}
        ${skript.marke?.markenname ? badge(skript.marke.markenname) : ''}
        ${skript.branchen?.name ? badge(skript.branchen.name, 'info') : ''}
        ${skript.model ? badge(skript.model) : ''}
        ${skript.herkunft === 'generiert' ? badge(skript.mit_dna ? 'mit DNA' : 'ohne DNA (blind)', skript.mit_dna ? 'success' : 'neutral') : ''}
        ${skript.herkunft === 'generiert' ? costBadge(skript) : ''}
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
            ${this.branchen.map((b) =>
              `<option value="${b.id}" ${skript.branche_id === b.id ? 'selected' : ''}>${escapeHtml(b.name)}</option>`).join('')}
          </select>
        </div>
      </div>

      ${renderOriginalAnfrage(skript)}
      ${BEWERTUNGSLEITFADEN}

      ${sektionBlock('hook', 'HOOK', 2)}
      ${sektionBlock('hauptteil', 'HAUPTTEIL', 4)}
      ${sektionBlock('cta', 'CTA', 2)}

      <div class="skripte-sektion">
        <div class="skripte-sektion-label">GESAMT</div>
        ${renderAltesFeedback('gesamt')}
        <div class="skripte-feedback-form">
          <div class="skripte-score-row">
            <span>Score:</span>
            ${[1, 2, 3, 4, 5].map((n) => `
              <label class="skripte-score-option">
                <input type="radio" name="fb-score-gesamt" value="${n}" /> ${n}
              </label>
            `).join('')}
          </div>
          <textarea id="fb-text-gesamt" class="form-input" rows="2" placeholder="Gesamteindruck, Struktur, roter Faden..."></textarea>
        </div>
      </div>
    `;

    this.createDrawer(skript.titel || 'Skript', body, [
      { label: 'Löschen', danger: true, onClick: async () => {
        const res = await window.confirmationModal?.open({
          title: 'Skript löschen?',
          message: 'Das Skript und sein Feedback werden endgültig gelöscht.',
          confirmText: 'Löschen',
          danger: true
        });
        if (res && !res.confirmed) return false;
        await skripteService.deleteSkript(skriptId);
        window.toastSystem?.success('Skript gelöscht');
        await this.reload();
        return true;
      } },
      { label: 'Speichern', primary: true, onClick: async () => {
        try {
          // Performance-Label + Branche (Nachkategorisierung)
          await skripteService.updateSkript(skriptId, {
            performance_label: document.getElementById('det-label').value,
            performance_notiz: document.getElementById('det-notiz').value.trim() || null,
            branche_id: document.getElementById('det-branche').value || null
          });

          // Feedback pro Sektion einsammeln
          const eintraege = ['hook', 'hauptteil', 'cta', 'gesamt'].map((sektion) => ({
            sektion,
            score: parseInt(document.querySelector(`input[name="fb-score-${sektion}"]:checked`)?.value || '', 10) || null,
            begruendung: document.getElementById(`fb-text-${sektion}`)?.value || '',
            korrigierte_version: document.getElementById(`fb-korrektur-${sektion}`)?.value || ''
          }));
          const count = await skripteService.saveFeedback(skriptId, eintraege);
          window.toastSystem?.success(count ? `Gespeichert (${count} Feedback-Einträge)` : 'Gespeichert');
          await this.reload();
          return true;
        } catch (err) {
          window.toastSystem?.error(err.message);
          return false;
        }
      } }
    ]);

    this.bindAnfrageCopy(skript);
  }

  bindAnfrageCopy(skript) {
    const drawer = document.getElementById('skripte-drawer');
    if (!drawer) return;

    drawer.querySelectorAll('.skripte-anfrage-copy').forEach((btn) => {
      btn.addEventListener('click', () => {
        const value = btn.closest('.skripte-anfrage-row')?.querySelector('.skripte-anfrage-value')?.textContent || '';
        navigator.clipboard.writeText(value).then(() => window.toastSystem?.success('Kopiert'));
      });
    });

    drawer.querySelector('#det-anfrage-copy-all')?.addEventListener('click', () => {
      const dnaVersionen = skript.prompt_kontext?.dna_versionen || [];
      const dnaLabel = !skript.mit_dna
        ? 'Ohne DNA (Blindvergleich)'
        : dnaVersionen.length
          ? dnaVersionen.map((d) => d.name || `${d.layer} v${d.version}`).join(', ')
          : 'Automatisch';

      const lines = [
        ['Marke', skript.marke?.markenname],
        ['Branche', skript.branchen?.name],
        ['Kampagne', skript.kampagne?.eigener_name || skript.kampagne?.kampagnenname],
        ['Produkt', skript.produkt?.name],
        ['Persona', skript.personas?.name],
        ['Funnel-Stufe', FUNNEL_STUFEN[skript.funnel_stufe] || skript.funnel_stufe],
        ['Tonalität', skript.tonalitaet],
        ['Skript-DNA', dnaLabel],
        ['Video-Idee', skript.video_idee],
        ['Location', skript.location],
        ['Regieanweisung', skript.regieanweisung]
      ]
        .filter(([, v]) => v != null && String(v).trim() !== '')
        .map(([k, v]) => `${k}:\n${v}`);

      navigator.clipboard.writeText(lines.join('\n\n')).then(() => window.toastSystem?.success('Gesamte Anfrage kopiert'));
    });
  }

  // ------------------------------------------------------------------
  // Drawer-Helfer (Pattern wie FirmaCreateDrawer)
  // ------------------------------------------------------------------
  createDrawer(title, bodyHtml, buttons) {
    this.removeDrawer();

    const overlay = document.createElement('div');
    overlay.className = 'drawer-overlay show';
    overlay.id = 'skripte-drawer-overlay';

    const panel = document.createElement('div');
    panel.setAttribute('role', 'dialog');
    panel.className = 'drawer-panel show skripte-drawer';
    panel.id = 'skripte-drawer';
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
        if (close !== false) this.removeDrawer();
      });
      footer.appendChild(el);
    }

    overlay.addEventListener('click', () => this.removeDrawer());
    panel.querySelector('.skripte-drawer-close').addEventListener('click', () => this.removeDrawer());

    document.body.appendChild(overlay);
    document.body.appendChild(panel);
  }

  removeDrawer() {
    document.getElementById('skripte-drawer-overlay')?.remove();
    document.getElementById('skripte-drawer')?.remove();
  }

  cleanup() {
    this.removeDrawer();
  }
}
