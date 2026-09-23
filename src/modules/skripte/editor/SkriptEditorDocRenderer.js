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
import { renderToolbarListenKopf } from '../../../core/components/ToolbarMenu.js';
import { avatarBubbles } from '../../../core/components/AvatarBubbles.js';
import {
  SEKTION_LABELS_KURZ, VISUELL_FIELD, HOOK_VARIANTE_FELDER, hatHookVarianten
} from './skriptEditorKonstanten.js';
import { visuellGuardGrund, visuellVorgaengerTitle } from './skriptEditorVisuellHelfer.js';

/** Logo (Marke, sonst Unternehmen) + Skripttitel – gleiche Klassen wie Strategie/Sourcing. */
function docHeadHtml(skript, extraHtml = '', fallbackName = 'Skript') {
  const marke = skript?.marke;
  const unternehmen = skript?.unternehmen;
  return `
    <div class="skripte-editor-doc-head">
      ${renderToolbarListenKopf({
        name: skript?.titel || fallbackName,
        logoUrl: marke?.logo_url || unternehmen?.logo_url || '',
        logoAlt: marke?.markenname || unternehmen?.firmenname || 'Logo'
      })}
      ${extraHtml}
    </div>`;
}

function creatorDisplayName(creator) {
  const crm = `${creator?.vorname || ''} ${creator?.nachname || ''}`.trim();
  return crm || creator?.name || 'Creator';
}

/** Creator am Konzept: CRM-Name, sonst Casting-Name, sonst creator_name. */
export function konzeptCreatorFromSkript(skript) {
  const item = skript?.strategie_item;
  if (!item) return null;
  const eintrag = item.casting_eintrag;
  const crm = eintrag?.creator;
  const crmName = `${crm?.vorname || ''} ${crm?.nachname || ''}`.trim();
  const name = crmName || eintrag?.name || item.creator_name || '';
  if (!name) return null;
  return {
    id: crm?.id || null,
    vorname: crm?.vorname || '',
    nachname: crm?.nachname || '',
    name,
    profilbild_url: crm?.profilbild_url || null,
    profilbild_thumb_url: crm?.profilbild_thumb_url || null
  };
}

function creatorsFuerKopf(verknuepfungen, konzeptCreator) {
  const proCreator = new Map();
  for (const row of verknuepfungen) {
    const creator = row.kooperation?.creator;
    if (!creator) continue;
    const key = creator.id || creatorDisplayName(creator);
    if (!proCreator.has(key)) proCreator.set(key, creator);
  }
  if (proCreator.size) return [...proCreator.values()];
  return konzeptCreator ? [konzeptCreator] : [];
}

function creatorChipHtml(creators) {
  const namen = creators.map(creatorDisplayName).join(', ');
  const bubbles = avatarBubbles.renderBubbles(creators.map((c) => ({
    name: creatorDisplayName(c),
    type: 'person',
    profile_image_url: c.profilbild_thumb_url || c.profilbild_url || null
  })), { maxVisible: creators.length });
  return `
    <button type="button" class="skripte-editor-zuweisen-chip" id="ed-skript-zuweisen"
      title="${escapeHtml(namen)}">
      <span class="skripte-editor-zuweisen-bubbles">${bubbles}</span>
      <span class="skripte-editor-zuweisen-name">${escapeHtml(namen)}</span>
    </button>`;
}

/** Doc-Kopf: Zuweisen-CTA oder Chip (Bubble + Name). */
export function verknuepfungenHtml({
  verknuepfungen = [], konzeptCreator = null, kannZuweisen = false
} = {}) {
  if (!kannZuweisen) return '';
  const creators = creatorsFuerKopf(verknuepfungen, konzeptCreator);
  if (!creators.length) {
    return `
      <button type="button" class="mdc-btn mdc-btn--secondary skripte-editor-zuweisen-btn" id="ed-skript-zuweisen"
        title="Creator zuweisen">
        <span class="mdc-btn__icon">${icon('user-add')}</span>
        <span class="mdc-btn__label">Creator zuweisen</span>
      </button>`;
  }
  return creatorChipHtml(creators);
}

/** Rueckfragen-Phase: Vorgaben + Hinweis statt (noch leerem) Skript-Inhalt. */
export function fragenModusHtml({ skript, genStatus, docHeadActionsHtml, vorgabenPanelHtml }) {
  return `
    ${docHeadHtml(skript, `
      <span class="skripte-badge skripte-badge--info" title="Liky klärt erst offene Fragen, dann wird das Skript geschrieben">Rückfragen</span>
      ${docHeadActionsHtml}
    `, 'Neues Skript')}
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
    ${docHeadHtml(skript, docHeadActionsHtml, 'Skript')}
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

function hookVariantenTabelleHtml({ skript }) {
  return `
    <div class="skripte-editor-doc-box skripte-editor-hook-varianten">
      <h2 class="skripte-editor-hook-varianten-titel">Hook-Varianten</h2>
      <table class="skripte-editor-tabelle skripte-editor-tabelle--varianten">
        <colgroup>
          <col class="skripte-editor-tabelle-col--label">
          <col>
        </colgroup>
        <thead>
          <tr>
            <th scope="col"></th>
            <th scope="col">Was gesagt wird</th>
          </tr>
        </thead>
        <tbody>
        ${HOOK_VARIANTE_FELDER.map((feld, i) => {
          const text = skript[feld] || '';
          return `
          <tr data-sektion="${feld}">
            <th scope="row">${SEKTION_LABELS_KURZ[feld] || `Hook ${i + 1}`}</th>
            <td>
              <div class="skripte-editor-sektion-text" data-sektion="${feld}" data-feld="${feld}">${renderInlineMd(text).html}</div>
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
  skript, messages, isReadonly, docHeadActionsHtml, vorgabenPanelHtml, docTab = 'skript',
  zeigeHookVarianten = false
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
    ${docHeadHtml(skript, docHeadActionsHtml, 'Skript')}
    ${vorgabenPanelHtml}
    ${showExtra ? docTabsHtml(activeTab) : ''}
    <div class="skripte-editor-doc-panel" data-editor-tab-panel="skript"${activeTab === 'zusatz' ? ' hidden' : ''}>
      ${gridTabelleHtml({ skript, grid, messages, isReadonly })}
      ${zeigeHookVarianten && hatHookVarianten(skript) ? hookVariantenTabelleHtml({ skript }) : ''}
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

/** Doc-Kopf: Version, Kundenfreigabe, optional Teilen, dann Creator-Zuweisen. */
export function docHeadActionsHtml({
  kannTeilen = false, kannFreigeben = false, status = '', verknuepfungenHtml = ''
} = {}) {
  const freigabeBadge = status === 'freigegeben'
    ? `<span class="skripte-badge skripte-badge--success" title="Vom Kunden freigegeben">Freigegeben</span>`
    : '';
  const freigebenBtn = kannFreigeben ? `
    <button type="button" class="mdc-btn skripte-editor-share-btn" id="ed-freigeben"
      title="Skript freigeben">
      <span class="mdc-btn__icon">${icon('check')}</span>
      <span class="mdc-btn__label">Freigeben</span>
    </button>` : '';
  return `
    <div class="skripte-editor-version" id="ed-version-wrap"></div>
    ${freigabeBadge}
    ${freigebenBtn}
    ${kannTeilen ? `
    <button type="button" class="mdc-btn mdc-btn--secondary skripte-editor-share-btn" id="ed-share"
      title="Skript per Link teilen">
      <span class="mdc-btn__icon">${icon('share-alt')}</span>
      <span class="mdc-btn__label">Teilen</span>
    </button>
    <button type="button" class="mdc-btn mdc-btn--secondary skripte-editor-share-btn" id="ed-anschreiben"
      title="Skript per E-Mail senden">
      <span class="mdc-btn__icon">${icon('anschreiben')}</span>
      <span class="mdc-btn__label">Senden</span>
    </button>` : ''}
    ${verknuepfungenHtml}
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
