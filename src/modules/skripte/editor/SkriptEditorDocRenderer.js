// SkriptEditorDocRenderer.js
// Reine Renderer fuer die Editor-Mitte: Neu-Modus (Generator), Rueckfragen-
// Phase und das eigentliche Skript-Dokument (Hook/Hauptteil/CTA + Visual).
// Alles pure Funktionen: State rein, HTML-String raus.

import { skripteService, FUNNEL_STUFEN, VIDEO_LAENGEN, SKRIPT_BEREICHE } from '../SkripteService.js';
import { escapeHtml } from '../SkripteUtils.js';
import { renderInlineMd } from '../../../core/utils/inlineFormat.js';
import { istMasterSkript, renderMasterMarkdownHtml } from '../master/skriptMasterFormat.js';
import {
  hatGridInhalt, hatZusatzInfos, gridFelderFuerSkript, zusatzInfosMarkdown
} from '../master/skriptCreatorFacing.js';
import { icon } from '../../../core/icons/IconSystem.js';
import {
  AKTION_ICONS, SEKTION_LABELS_KURZ, VISUELL_FIELD
} from './skriptEditorKonstanten.js';
import { visuellGuardGrund, visuellVorgaengerTitle } from './skriptEditorVisuellHelfer.js';

/** Neu-Modus: Generator-Formular-Platzhalter + Start-Buttons. */
export function neuModusHtml() {
  return `
    <div class="skripte-editor-doc-scroll">
      <div class="skripte-editor-doc-head">
        <h2>Neues Skript</h2>
      </div>
      <div class="skripte-editor-genform" id="ed-genform"></div>
    </div>
    <div class="skripte-actions-row skripte-actions-row--sticky">
      <button id="ed-gen-start" class="mdc-btn" title="Liky stellt erst kluge Rückfragen zu fehlenden Infos (z.B. CTA), dann wird generiert">Skript generieren</button>
      <button id="ed-gen-direkt" class="mdc-btn mdc-btn--secondary" title="Rückfragen überspringen und sofort generieren">Direkt generieren</button>
    </div>
  `;
}

/** Rueckfragen-Phase: Vorgaben + Hinweis statt (noch leerem) Skript-Inhalt. */
export function fragenModusHtml({ skript, genStatus, docHeadActionsHtml, vorgabenPanelHtml }) {
  return `
    <div class="skripte-editor-doc-head">
      <h2>${escapeHtml(skript.titel || 'Neues Skript')}</h2>
      <span class="skripte-badge skripte-badge--info" title="Liky klärt erst offene Fragen, dann wird das Skript geschrieben">Rückfragen</span>
      ${docHeadActionsHtml}
    </div>
    ${vorgabenPanelHtml}
    <div class="skripte-editor-fragen-info">
      <p>Liky prüft die Vorgaben und stellt dir rechts Rückfragen, bevor das Skript geschrieben wird.</p>
      <p class="skripte-hint">Antworte unten im Chat. Du kannst die Fragen auch überspringen und sofort generieren lassen.</p>
    </div>
    <div class="skripte-actions-row">
      <button id="ed-fragen-gen" class="mdc-btn" ${genStatus?.laeuft ? 'disabled' : ''}>
        ${genStatus?.laeuft ? 'Läuft…' : 'Skript jetzt generieren'}
      </button>
    </div>
  `;
}

/** Neues Format: gerenderte Markdown-Sektionen aus ##-Ueberschriften. */
export function masterDocHtml({ skript, docHeadActionsHtml, vorgabenPanelHtml }) {
  return `
    <div class="skripte-editor-doc-head">
      <h2>${escapeHtml(skript.titel || 'Skript')}</h2>
      ${docHeadActionsHtml}
    </div>
    ${vorgabenPanelHtml}
    <div class="skripte-editor-doc-box skripte-editor-doc-box--md">
      ${renderMasterMarkdownHtml(skript.inhalt_md, escapeHtml)}
    </div>
  `;
}

function gridTabelleHtml({ skript, grid, messages, isReadonly }) {
  return `
    <div class="skripte-editor-doc-box">
      <table class="skripte-editor-tabelle">
        <colgroup>
          <col class="skripte-editor-tabelle-col--label">
          <col>
          <col>
        </colgroup>
        <thead>
          <tr>
            <th scope="col"></th>
            <th scope="col">Was gesagt wird</th>
            <th scope="col">Was zu sehen ist</th>
          </tr>
        </thead>
        <tbody>
        ${['hook', 'hauptteil', 'cta'].map((sektion) => {
          const visuellFeld = VISUELL_FIELD[sektion];
          const visuellText = grid[visuellFeld] || '';
          const gesprochen = grid[sektion] || '';
          const visuellGrund = visuellGuardGrund(
            { ...skript, ...grid },
            sektion,
            { readonly: isReadonly, messages }
          );
          const visuellTitle = visuellGrund === 'vorgaenger'
            ? visuellVorgaengerTitle(sektion)
            : 'Was zu sehen ist per KI generieren';
          return `
          <tr data-sektion="${sektion}">
            <th scope="row">${SEKTION_LABELS_KURZ[sektion]}</th>
            <td>
              <div class="skripte-editor-sektion-text" data-sektion="${sektion}" data-feld="${sektion}">${renderInlineMd(gesprochen).html}</div>
            </td>
            <td class="skripte-editor-tabelle-zelle--visual">
              ${isReadonly ? '' : `
              <button class="skripte-editor-visual-btn" data-sektion="${sektion}"
                title="${escapeHtml(visuellTitle)}"
                ${visuellGrund ? 'disabled' : ''}>
                ${icon('ai-visual')}
              </button>
              `}
              <div class="skripte-editor-sektion-visual" data-sektion="${sektion}" data-feld="${visuellFeld}">${renderInlineMd(visuellText).html}</div>
            </td>
          </tr>
        `;
        }).join('')}
        </tbody>
      </table>
    </div>
  `;
}

function docTabsHtml(activeTab) {
  return `
    <div class="tab-navigation skripte-editor-doc-tabs" role="tablist">
      <button type="button" class="tab-button${activeTab === 'skript' ? ' active' : ''}"
        role="tab" data-editor-tab="skript" aria-selected="${activeTab === 'skript'}">Skript</button>
      <button type="button" class="tab-button${activeTab === 'zusatz' ? ' active' : ''}"
        role="tab" data-editor-tab="zusatz" aria-selected="${activeTab === 'zusatz'}">Zusätzliche Infos</button>
    </div>
  `;
}

/** Skript-Dokument: Kopf + Vorgaben + 2-Spalten-Tabelle (gesagt/visual). */
export function skriptDocHtml({
  skript, messages, isReadonly, docHeadActionsHtml, vorgabenPanelHtml, docTab = 'skript'
}) {
  const extraMd = skript.inhalt_md ? zusatzInfosMarkdown(skript.inhalt_md) : '';
  const showExtra = hatZusatzInfos(skript.inhalt_md);
  const showGrid = hatGridInhalt(skript);

  if (istMasterSkript(skript) && !showGrid) {
    return masterDocHtml({ skript, docHeadActionsHtml, vorgabenPanelHtml });
  }

  const grid = showGrid ? gridFelderFuerSkript(skript) : {
    hook: skript.hook, hauptteil: skript.hauptteil, cta: skript.cta,
    hook_visuell: skript.hook_visuell, hauptteil_visuell: skript.hauptteil_visuell,
    cta_visuell: skript.cta_visuell
  };
  const activeTab = showExtra && docTab === 'zusatz' ? 'zusatz' : 'skript';

  return `
    <div class="skripte-editor-doc-head">
      <h2>${escapeHtml(skript.titel || 'Skript')}</h2>
      ${docHeadActionsHtml}
    </div>
    ${vorgabenPanelHtml}
    ${showExtra ? docTabsHtml(activeTab) : ''}
    <div class="skripte-editor-doc-panel" data-editor-tab-panel="skript"${activeTab === 'zusatz' ? ' hidden' : ''}>
      ${gridTabelleHtml({ skript, grid, messages, isReadonly })}
    </div>
    ${showExtra ? `
    <div class="skripte-editor-doc-panel skripte-editor-doc-panel--zusatz" data-editor-tab-panel="zusatz"${activeTab === 'skript' ? ' hidden' : ''}>
      <div class="skripte-editor-doc-box skripte-editor-doc-box--md">
        ${renderMasterMarkdownHtml(extraMd, escapeHtml, { feld: null })}
      </div>
    </div>
    ` : ''}
  `;
}

/** Doc-Kopf: optional Feedback, Version rechts. */
export function docHeadActionsHtml({ isReadonly, feedback = false } = {}) {
  return `
    ${feedback && !isReadonly ? `
    <button class="skripte-editor-feedback-btn" id="ed-feedback" title="Skript komplett bewerten (Score, Performance-Label)">
      <span class="skripte-editor-tag-icon">${AKTION_ICONS.feedback}</span>
      <span>Feedback</span>
    </button>
    ` : ''}
    <div class="skripte-editor-version" id="ed-version-wrap"></div>
  `;
}

/** Read-only Info: mit welchen Vorgaben das Skript generiert wurde. */
export function vorgabenPanelHtml(skript) {
  const s = skript;
  if (!s) return '';
  const briefingName = s.briefing?.aktivierung_name
    || s.prompt_kontext?.briefing_name
    || s.prompt_kontext?.generator_payload?.briefing_name
    || s.prompt_kontext?.briefing_pdf?.name
    || s.prompt_kontext?.generator_payload?.briefing_pdf?.name
    || null;
  // Videovorlage: nach der Generierung top-level Snapshot, davor im Payload
  const referenz = s.prompt_kontext?.referenz_video
    || s.prompt_kontext?.generator_payload?.referenz_video || null;
  const referenzInfo = referenz ? [
    referenz.platform === 'tiktok' ? 'TikTok' : referenz.platform === 'instagram' ? 'Instagram' : null,
    referenz.author_name ? `@${referenz.author_name}` : null,
    referenz.duration_seconds ? `${Math.round(referenz.duration_seconds)}s` : null,
    referenz.url
  ].filter(Boolean).join(' · ') : null;
  const transkriptAuszug = referenz?.transkript_verwendet
    ? (referenz.transkript_verwendet.length > 220
      ? `${referenz.transkript_verwendet.slice(0, 220)}…`
      : referenz.transkript_verwendet)
    : null;
  const zeilen = [
    ['Unternehmen', s.unternehmen?.firmenname],
    ['Briefing', briefingName],
    ['Videovorlage', referenzInfo],
    ['Vorlage-Transkript', transkriptAuszug],
    ['Marke', s.marke?.markenname],
    ['Kampagne', s.kampagne?.eigener_name || s.kampagne?.kampagnenname],
    ['Produkt', s.produkt?.name],
    ['Persona', s.personas ? skripteService.personaLabel(s.personas) : null],
    ['Branche', s.branchen?.name],
    ['Bereich', s.bereich ? (SKRIPT_BEREICHE[s.bereich] || s.bereich) : null],
    ['Regie-Modus', s.prompt_kontext?.modus || s.prompt_kontext?.generator_payload?.modus || null],
    ['Video-Länge', s.video_laenge ? (VIDEO_LAENGEN[s.video_laenge] || s.video_laenge) : null],
    ['Funnel-Stufe', s.funnel_stufe ? (FUNNEL_STUFEN[s.funnel_stufe] || s.funnel_stufe) : null],
    ['Tonalität', s.tonalitaet],
    ['Skript-DNA', s.mit_dna === false ? 'Ohne DNA (Blindvergleich)' : 'Mit DNA'],
    ['Video-Idee', s.video_idee],
    ['Location', s.location],
    ['Regieanweisung', s.regieanweisung]
  ].filter(([, wert]) => wert);

  if (!zeilen.length) return '';

  return `
    <div class="skripte-editor-vorgaben-wrap">
      <details class="skripte-editor-vorgaben">
        <summary>Vorgaben aus dem Generator</summary>
        <dl class="skripte-editor-vorgaben-grid">
          ${zeilen.map(([label, wert]) => `
            <div class="skripte-editor-vorgaben-zeile">
              <dt>${escapeHtml(label)}</dt>
              <dd>${escapeHtml(String(wert))}</dd>
            </div>
          `).join('')}
        </dl>
      </details>
    </div>
  `;
}
