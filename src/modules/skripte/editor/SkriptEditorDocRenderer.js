// SkriptEditorDocRenderer.js
// Reine Renderer fuer die Editor-Mitte: Neu-Modus (Generator), Rueckfragen-
// Phase und das eigentliche Skript-Dokument (Hook/Hauptteil/CTA + Visual).
// Alles pure Funktionen: State rein, HTML-String raus.

import { skripteService, FUNNEL_STUFEN, VIDEO_LAENGEN } from '../SkripteService.js';
import { escapeHtml, badge } from '../SkripteUtils.js';
import { icon } from '../../../core/icons/IconSystem.js';
import {
  AKTION_ICONS, SEKTION_LABELS_KURZ, VISUELL_FIELD
} from './skriptEditorKonstanten.js';
import { visuellVorgaengerFehlt, visuellVorgaengerTitle } from './skriptEditorVisuellHelfer.js';

/** Neu-Modus: Generator-Formular-Platzhalter + Start-Buttons. */
export function neuModusHtml() {
  return `
    <div class="skripte-editor-doc-head">
      <h2>Neues Skript</h2>
    </div>
    <div class="skripte-editor-genform" id="ed-genform"></div>
    <div class="skripte-actions-row">
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

/** Skript-Dokument: Kopf + Vorgaben + 2-Spalten-Tabelle (gesagt/visual). */
export function skriptDocHtml({ skript, messages, isReadonly, docHeadActionsHtml, vorgabenPanelHtml }) {
  return `
    <div class="skripte-editor-doc-head">
      <h2>${escapeHtml(skript.titel || 'Skript')}</h2>
      ${docHeadActionsHtml}
    </div>
    ${vorgabenPanelHtml}
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
          const visuellText = skript[visuellFeld] || '';
          const visuellLaeuft = messages.some((m) => m.aktion === 'visuell'
            && m.sektion === sektion && (m.status === 'pending' || m.status === 'running'));
          const gesprochen = skript[sektion] || '';
          const vorgaengerFehlt = visuellVorgaengerFehlt(skript, sektion);
          const visuellDisabled = isReadonly || !gesprochen.trim() || visuellLaeuft || vorgaengerFehlt;
          const visuellTitle = vorgaengerFehlt
            ? visuellVorgaengerTitle(sektion)
            : 'Was zu sehen ist per KI generieren';
          return `
          <tr data-sektion="${sektion}">
            <th scope="row">${SEKTION_LABELS_KURZ[sektion]}</th>
            <td>
              <div class="skripte-editor-sektion-text" data-sektion="${sektion}" data-feld="${sektion}">${escapeHtml(gesprochen)}</div>
            </td>
            <td class="skripte-editor-tabelle-zelle--visual">
              ${isReadonly ? '' : `
              <button class="skripte-editor-visual-btn" data-sektion="${sektion}"
                title="${escapeHtml(visuellTitle)}"
                ${visuellDisabled ? 'disabled' : ''}>
                ${icon('ai-visual')}
              </button>
              `}
              <div class="skripte-editor-sektion-visual" data-sektion="${sektion}" data-feld="${visuellFeld}">${escapeHtml(visuellText)}</div>
            </td>
          </tr>
        `;
        }).join('')}
        </tbody>
      </table>
    </div>
  `;
}

export function metaBadgesHtml(skript) {
  if (!skript) return '';
  return `
    ${skript.unternehmen?.firmenname ? badge(skript.unternehmen.firmenname) : ''}
    ${skript.marke?.markenname ? badge(skript.marke.markenname) : ''}
    ${skript.personas?.name ? badge(skripteService.personaLabel(skript.personas), 'info') : ''}
    ${badge(skript.mit_dna === false ? 'ohne DNA' : 'mit DNA', skript.mit_dna === false ? 'neutral' : 'success')}
  `;
}

/** Doc-Kopf: Tags links, optional Feedback, Version rechts. */
export function docHeadActionsHtml({ skript, isReadonly, feedback = false } = {}) {
  return `
    <div class="skripte-editor-input-meta" id="ed-meta">${metaBadgesHtml(skript)}</div>
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
