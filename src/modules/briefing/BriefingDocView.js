// BriefingDocView.js
// Dokumentansicht für campaign_briefings: die drei Sektionen des Creator-Briefings
// (briefingDokument.js), Produkte live, für das Team zusätzlich „Frühere Angaben“.
// Textfelder und Titel sind für Mitarbeiter inline editierbar (briefingDocBinden.js).
// Creator-PDF: briefingPdfModell.js (gleiches Modell, ohne Frühere Angaben).

import { icon } from '../../core/icons/IconSystem.js';
import { BEREICH_LABELS } from './create/fieldConfig.js';
import { FRUEHERE_ANGABEN_TITEL } from './briefingAltfelder.js';
import { isLegacyBriefing } from './briefingLegacy.js';
import { briefingSektionen, fruehereAngaben, produktNamen } from './briefingDokument.js';

export { bindBriefingDoc } from './briefingDocBinden.js';
export { buildBriefingPdfModel, htmlToPlainText } from './briefingPdfModell.js';

function escapeLabel(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function renderMetaChip(iconKey, text) {
  if (!text) return '';
  return `
    <span class="briefing-doc__chip">
      ${icon(iconKey, { className: 'briefing-doc__chip-icon', size: 16 })}
      <span>${text}</span>
    </span>
  `;
}

function renderProducts(detail) {
  const names = produktNamen(detail.briefing).map(n => detail.escape(n));
  const personas = (detail.briefing?.personas || [])
    .map(p => detail.escape(p?.oberbegriff ? `${p.oberbegriff} (${p.name})` : p?.name))
    .filter(Boolean);
  const sep = '<span class="briefing-doc__products-sep"> · </span>';
  return [names, personas]
    .filter(list => list.length)
    .map(list => `<p class="briefing-doc__products">${list.join(sep)}</p>`)
    .join('');
}

function renderActionButton({ id, label, title, variant = 'secondary', iconName }) {
  return `
    <button type="button" id="${id}" class="mdc-btn mdc-btn--${variant}" title="${escapeLabel(title || label)}">
      <span class="mdc-btn__icon">${icon(iconName)}</span>
      <span class="mdc-btn__label">${escapeLabel(label)}</span>
    </button>`;
}

function renderDocActions({ canEdit = false, canDelete = false, canAnschreiben = false, canDuplicate = false, showEdit = false, compact = true } = {}) {
  const toggleLabel = compact ? 'Alle Felder' : 'Komprimiert';
  return `
    <div class="briefing-doc__actions">
      ${canEdit ? '<span class="briefing-doc__status" data-briefing-status hidden>Gespeichert</span>' : ''}
      ${renderActionButton({
        id: 'btn-briefing-fields-toggle',
        label: toggleLabel,
        title: compact ? 'Alle Felder anzeigen' : 'Ansicht komprimieren',
        iconName: compact ? 'list-bullet' : 'arrows-collapse'
      })}
      ${showEdit && canEdit ? renderActionButton({
        id: 'btn-edit-briefing',
        label: 'Bearbeiten',
        title: 'Briefing im Formular bearbeiten',
        iconName: 'pencil-square'
      }) : ''}
      ${canDuplicate ? renderActionButton({
        id: 'btn-duplicate-briefing',
        label: 'Duplizieren',
        title: 'Briefing als neue Linie in dieser Produktion duplizieren',
        iconName: 'document-duplicate'
      }) : ''}
      ${canAnschreiben ? renderActionButton({
        id: 'btn-anschreiben-briefing',
        label: 'Anschreiben',
        title: 'Briefing per E-Mail senden',
        iconName: 'anschreiben'
      }) : ''}
      ${canDelete ? renderActionButton({
        id: 'btn-delete-briefing',
        label: 'Löschen',
        title: 'Briefing löschen',
        variant: 'delete',
        iconName: 'trash'
      }) : ''}
    </div>
  `;
}

function renderBrandLockup(detail) {
  const b = detail.briefing || {};
  const customer = b.marke?.logo_url || b.unternehmen?.logo_url || '';
  const customerName = b.marke?.markenname || b.unternehmen?.firmenname || 'Kunde';
  return `
    <div class="briefing-doc__lockup">
      <img src="/assets/background/LikeGroup_Logo.svg" alt="LikeGroup" class="briefing-doc__lockup-logo">
      <span class="briefing-doc__lockup-x" aria-hidden="true">×</span>
      ${customer
        ? `<img src="${detail.escape(customer)}" alt="${detail.escape(customerName)}" class="briefing-doc__lockup-logo">`
        : `<span class="briefing-doc__lockup-fallback">${detail.escape(customerName)}</span>`}
    </div>
  `;
}

function renderTitle(detail, titleEditable) {
  const name = detail.briefing.aktivierung_name || '';
  if (!titleEditable) {
    return `<h1 class="briefing-doc__title">${detail.escape(name || 'Briefing')}</h1>`;
  }
  return `<h1 class="briefing-doc__title" data-feld="aktivierung_name" data-placeholder="Kampagnentitel">${detail.escape(name)}</h1>`;
}

function renderHero(detail, { titleEditable = false } = {}) {
  const b = detail.briefing;
  const bereich = BEREICH_LABELS[b.bereich] || b.bereich;
  const statusClass = b.is_draft ? 'warning' : 'success';
  const statusLabel = b.is_draft ? 'Entwurf' : 'Final';
  const firma = b.unternehmen?.firmenname;
  const marke = b.marke?.markenname;
  const subtitle = [firma, marke].filter(Boolean).map(s => detail.escape(s)).join(' · ');
  const folder = marke || firma;
  const abgabe = b.content_deadline ? `Abgabe ${detail.formatDate(b.content_deadline)}` : null;
  const live = b.go_live ? `Live ${detail.formatDate(b.go_live)}` : null;

  return `
    <header class="briefing-doc__hero">
      ${renderBrandLockup(detail)}
      <div class="briefing-doc__top">
        <div class="briefing-doc__badges">
          <span class="status-badge ${statusClass}">${statusLabel}</span>
          ${bereich ? `<span class="tag tag--type">${detail.escape(bereich)}</span>` : ''}
        </div>
      </div>
      ${renderProducts(detail)}
      ${renderTitle(detail, titleEditable)}
      ${subtitle ? `<p class="briefing-doc__subtitle">${subtitle}</p>` : ''}
      <div class="briefing-doc__meta">
        ${renderMetaChip('folder', folder ? detail.escape(folder) : '')}
        ${renderMetaChip('calendar', [abgabe, live].filter(Boolean).join(' · '))}
      </div>
    </header>
  `;
}

function renderSpecTable(rows) {
  if (!rows.length) return '';
  return `
    <table class="briefing-doc__specs">
      <tbody>
        ${rows.map(row => `
          <tr>
            <th scope="row">${escapeLabel(row.label)}</th>
            <td>${row.html}</td>
          </tr>
        `).join('')}
      </tbody>
    </table>
  `;
}

function renderText(eintrag, { canEdit }) {
  const kicker = `<div class="briefing-doc__kicker">${escapeLabel(eintrag.label)}</div>`;
  if (!canEdit) return eintrag.html ? `${kicker}<div class="briefing-doc__prose">${eintrag.html}</div>` : '';
  const placeholder = eintrag.field.placeholder || 'Hier schreiben…';
  return `${kicker}
    <div class="briefing-doc__prose" data-feld="${escapeLabel(eintrag.field.name)}"
         data-placeholder="${escapeLabel(placeholder)}">${escapeLabel(eintrag.value)}</div>`;
}

function renderProdukt(eintrag, detail) {
  const name = detail.escape(eintrag.name);
  const titel = eintrag.url
    ? `<a href="${detail.escape(eintrag.url)}" target="_blank" rel="noopener">${name}</a>`
    : name;
  return `
    <div class="briefing-doc__produkt">
      <div class="briefing-doc__produkt-name">${titel}</div>
      ${renderSpecTable(eintrag.zeilen)}
    </div>
  `;
}

/** Einträge in PDF-Reihenfolge; aufeinanderfolgende Zeilen teilen sich eine Tabelle. */
function renderEintraege(eintraege, detail, { canEdit }) {
  const out = [];
  let zeilen = [];
  const flush = () => {
    out.push(renderSpecTable(zeilen));
    zeilen = [];
  };
  for (const eintrag of eintraege) {
    if (eintrag.art === 'zeile') {
      zeilen.push(eintrag);
      continue;
    }
    flush();
    if (eintrag.art === 'text') out.push(renderText(eintrag, { canEdit }));
    else if (eintrag.art === 'produkt') out.push(renderProdukt(eintrag, detail));
    else out.push(`<div class="briefing-doc__kicker">${escapeLabel(eintrag.label)}</div><div class="briefing-doc__prose briefing-doc__ideen">${eintrag.html}</div>`);
  }
  flush();
  return out.join('');
}

function renderSektion(sektion, detail, { canEdit }) {
  if (!sektion.eintraege.length) return '';
  return `
    <section class="briefing-doc__section" data-sektion="${escapeLabel(sektion.id)}">
      <h2 class="briefing-doc__heading"><span>${detail.escape(sektion.titel)}</span></h2>
      ${sektion.hinweis ? `<p class="briefing-doc__hint">${detail.escape(sektion.hinweis)}</p>` : ''}
      ${renderEintraege(sektion.eintraege, detail, { canEdit })}
    </section>
  `;
}

function renderFruehereAngaben(rows, { offen }) {
  if (!rows.length) return '';
  return `
    <details class="briefing-doc__section briefing-doc__alt"${offen ? ' open' : ''}>
      <summary class="briefing-doc__heading">${escapeLabel(FRUEHERE_ANGABEN_TITEL)}</summary>
      <p class="briefing-doc__hint">Felder aus dem früheren Briefing-Formular. Nur für das Team sichtbar, nicht im Creator-PDF.</p>
      ${renderSpecTable(rows)}
    </details>
  `;
}

function renderAdminMeta(detail) {
  const rows = [];
  if (detail.briefing.created_at) {
    rows.push({ label: 'Erstellt', html: detail.escape(detail.formatDate(detail.briefing.created_at)) });
  }
  if (detail.briefing.updated_at) {
    rows.push({ label: 'Aktualisiert', html: detail.escape(detail.formatDate(detail.briefing.updated_at)) });
  }
  if (!rows.length) return '';
  return `
    <section class="briefing-doc__section">
      <h2 class="briefing-doc__heading"><span>Allgemein</span></h2>
      ${renderSpecTable(rows)}
    </section>
  `;
}

/**
 * @param {object} opts
 * @param {boolean} [opts.fruehereAngaben] - Altfelder zeigen (nur Team, canFeature)
 */
export function renderBriefingDoc({
  detail,
  compact = true,
  canDelete = false,
  canEdit = false,
  canAnschreiben = false,
  canDuplicate = false,
  showEdit = false,
  embedded = false,
  print = false,
  fruehereAngaben: mitFrueheren = false
} = {}) {
  if (print) {
    compact = false;
    canDelete = false;
    canEdit = false;
    canAnschreiben = false;
    canDuplicate = false;
    showEdit = false;
    mitFrueheren = false;
  }
  const legacy = isLegacyBriefing(detail.briefing);
  const contentEditable = canEdit && !legacy;
  const sektionen = briefingSektionen(detail, { mitLeeren: contentEditable && !compact });
  const alt = mitFrueheren ? fruehereAngaben(detail) : [];

  const editClass = contentEditable ? ' briefing-doc--editable' : '';
  const printClass = print ? ' briefing-doc--print' : '';

  const article = `
    <article class="briefing-doc${editClass}${printClass}" data-compact="${compact ? 'true' : 'false'}">
      ${renderHero(detail, { titleEditable: canEdit })}
      ${compact && contentEditable ? '<p class="briefing-doc__hint">Komprimierte Ansicht — leere Felder zum Ausfüllen oben rechts unter „Alle Felder“</p>' : ''}
      ${sektionen.map(s => renderSektion(s, detail, { canEdit: contentEditable })).join('')}
      ${renderFruehereAngaben(alt, { offen: legacy || !compact })}
      ${compact ? '' : renderAdminMeta(detail)}
    </article>
  `;

  if (print) return article;

  return `
    <div class="briefing-detail${embedded ? ' briefing-detail--embedded' : ''}">
      <header class="briefing-doc-head">
        ${renderDocActions({ canEdit, canDelete, canAnschreiben, canDuplicate, showEdit, compact })}
      </header>
      <div class="briefing-detail__scroll">
        ${article}
      </div>
    </div>
  `;
}
