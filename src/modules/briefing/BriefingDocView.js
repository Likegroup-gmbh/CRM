// BriefingDocView.js
// Dokumentansicht fuer campaign_briefings.
// Klassifiziert fieldConfig-Felder (Hero / Callout / Prosa / Specs / Creator /
// sekundaer). Textareas sind fuer Mitarbeiter inline editierbar (InlineEdit);
// Specs, Tags und Uploads bleiben read-only.

import { icon } from '../../core/icons/IconSystem.js';
import { InlineEdit } from '../../core/components/InlineEdit.js';
import {
  BEREICH_LABELS,
  MAERKTE_OPTIONS,
  SPRACHEN_OPTIONS,
  evaluateCondition,
  flattenFields,
  getAllFields,
  getStepsForBereich
} from './create/fieldConfig.js';

const HERO_KEYS = new Set(['aktivierung_name']);
const CALLOUT_KEYS = new Set(['beschreibung', 'kampagne_thema', 'always_on_thema']);
const META_KEYS = new Set(['content_deadline', 'go_live', 'embargo', 'maerkte', 'sprachen']);
const CREATOR_KEYS = new Set([
  'creator_groessen', 'nischen', 'creator_merkmale', 'voraussetzungen',
  'voraussetzungen_sonstiges'
]);
const CREATOR_TITLES = new Set(['Welche Creator suchen wir?']);
const SECONDARY_TITLES = new Set([
  'Verhandlung',
  'Zusätzliche Nutzung',
  'Learnings aus vergleichbaren Aktivitaeten',
  'Learnings aus bisherigem bzw. vergleichbarem Content',
  'Produktion'
]);
const SECONDARY_KEY_RE = /learnings|referenzen|dos_donts|verhandlungshinweis|nutzung_|rohmaterial|nutzungsdauer|hauttyp|haartyp|produkt_erfahrung/;
const PDF_SKIP = new Set(['verhandlungshinweis']);
const PROSE_TYPES = new Set(['textarea', 'repeatableText']);
const BLOCK_TYPES = new Set(['textarea', 'repeatableText', 'repeatableUpload', 'url']);

const SPEC_LABELS = {
  kampagnentypen: 'Kampagnentyp',
  always_on_bestehend: 'Bestehender Ansatz',
  funnel_stufen: 'Funnel-Stufe',
  kpis: 'Ziele / KPIs',
  objectives: 'Paid Objective',
  content_ziele: 'Content-Ziele',
  channels: 'Channels',
  formatvorgaben: 'Formatvorgaben',
  videolaenge: 'Videolänge',
  videolaengen: 'Videolänge',
  ratios: 'Format / Ratio',
  technische_anforderungen: 'Technische Anforderungen',
  zusaetzliche_versionen: 'Zusätzliche Versionen',
  zusaetzliche_sprachen: 'Zusätzliche Sprachen',
  weitere_sprachen: 'Weitere Sprachen',
  sprachadaption: 'Sprachadaption',
  weitere_deadline_bezeichnung: 'Weitere Deadline',
  weitere_deadline: 'Weitere Deadline (Datum)',
  creator_groessen: 'Creator-Größe',
  nischen: 'Nische',
  voraussetzungen: 'Voraussetzungen',
  voraussetzungen_sonstiges: 'Sonstige Voraussetzungen',
  voraussetzungen_custom: 'Produktspezifische Erfahrung',
  produkt_erfahrung: 'Produktspezifische Erfahrung',
  alter: 'Alter',
  geschlecht: 'Geschlecht',
  standort: 'Standort',
  expertise: 'Expertise',
  sonstiges: 'Sonstiges'
};

const TEXTAREA_FIELDS = new Set(
  getAllFields().filter(f => f.type === 'textarea').map(f => f.name)
);

export function stripPrefix(name) {
  return String(name || '').replace(/^(im|pa|os)_/, '');
}

export function classifyField(field, sectionTitle = '') {
  if (!field) return 'secondary';
  if (field.type === 'entitySelect' || field.type === 'entityMulti') return 'hero';
  const key = stripPrefix(field.name);
  if (HERO_KEYS.has(key)) return 'hero';
  if (CALLOUT_KEYS.has(key)) return 'callout';
  if (META_KEYS.has(key)) return 'meta';
  if (SECONDARY_TITLES.has(sectionTitle) || SECONDARY_KEY_RE.test(key)) return 'secondary';
  if (CREATOR_KEYS.has(key) || CREATOR_TITLES.has(sectionTitle)) return 'creator';
  if (PROSE_TYPES.has(field.type)) return 'prose';
  return 'spec';
}

export function specLabel(field) {
  const key = stripPrefix(field?.name);
  return SPEC_LABELS[key] || field?.label || key;
}

function escapeLabel(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function rawText(value) {
  return typeof value === 'string' ? value : '';
}

function pushGrouped(groups, title, item) {
  let group = groups.find(g => g.title === title);
  if (!group) {
    group = { title, items: [] };
    groups.push(group);
  }
  group.items.push(item);
}

function flattenGroupRows(field, value, detail) {
  if (!value || typeof value !== 'object') return [];
  return (field.fields || [])
    .filter(sub => value[sub.name])
    .map(sub => ({
      label: specLabel(sub),
      html: detail.escape(value[sub.name])
    }));
}

export function collectPresentation(detail, { includeEmptyTextareas = false, forPdf = false } = {}) {
  const briefing = detail.briefing || {};
  const steps = getStepsForBereich(briefing.bereich);
  const callout = [];
  const prose = [];
  const specs = [];
  const creator = [];
  const secondary = [];

  for (const step of steps) {
    for (const section of step.sections) {
      if (section.condition && !evaluateCondition(section.condition, briefing)) continue;
      const title = section.title || step.label;

      for (const field of flattenFields(section.fields)) {
        if (field.persist === false || field.type === 'entitySelect' || field.type === 'entityMulti' || field.type === 'disclosure') continue;
        if (forPdf && PDF_SKIP.has(field.name)) continue;
        if (field.condition && !evaluateCondition(field.condition, briefing)) continue;

        const value = briefing[field.name];
        const formatted = detail.formatValue(field, value);
        const emptyTextarea = formatted === null && includeEmptyTextareas && field.type === 'textarea';
        if (formatted === null && !emptyTextarea) continue;

        const role = classifyField(field, title);
        const item = { field, formatted: formatted ?? '', value: value ?? '' };

        if (role === 'hero' || role === 'meta') continue;
        if (role === 'callout') {
          callout.push(item);
          continue;
        }
        if (role === 'prose') {
          pushGrouped(prose, title, item);
          continue;
        }
        if (role === 'creator') {
          pushGrouped(creator, title, item);
          continue;
        }
        if (role === 'spec') {
          if (field.type === 'group') {
            specs.push(...flattenGroupRows(field, value, detail));
          } else {
            specs.push({ label: specLabel(field), html: formatted });
          }
          continue;
        }
        pushGrouped(secondary, title, item);
      }
    }
  }

  return { callout, prose, specs, creator, secondary };
}

function optionLabel(options, value) {
  return options.find(o => String(o.value) === String(value))?.label || value;
}

function multiLabels(values, options) {
  if (!Array.isArray(values) || values.length === 0) return [];
  return values.map(v => optionLabel(options, v));
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
  const names = (detail.briefing?.produkte || [])
    .map(p => detail.escape(p?.name))
    .filter(Boolean);
  const personas = (detail.briefing?.personas || [])
    .map(p => detail.escape(p?.oberbegriff ? `${p.oberbegriff} (${p.name})` : p?.name))
    .filter(Boolean);
  if (!names.length && !personas.length) return '';
  const productLine = names.length
    ? `<p class="briefing-doc__products">${names.join('<span class="briefing-doc__products-sep"> · </span>')}</p>`
    : '';
  const personaLine = personas.length
    ? `<p class="briefing-doc__products">${personas.join('<span class="briefing-doc__products-sep"> · </span>')}</p>`
    : '';
  return `${productLine}${personaLine}`;
}

function renderDocActions({ canEdit = false, canDelete = false, canAnschreiben = false, compact = true } = {}) {
  const toggleLabel = compact ? 'Alle Felder' : 'Komprimiert';
  return `
    <div class="briefing-doc__actions">
      ${canEdit ? '<span class="briefing-doc__status" data-briefing-status hidden>Gespeichert</span>' : ''}
      <button type="button" id="btn-briefing-fields-toggle" class="mdc-btn mdc-btn--secondary mdc-btn--sm">${toggleLabel}</button>
      ${canAnschreiben ? '<button type="button" id="btn-anschreiben-briefing" class="mdc-btn mdc-btn--secondary mdc-btn--sm">Anschreiben</button>' : ''}
      ${canDelete ? '<button type="button" id="btn-delete-briefing" class="mdc-btn mdc-btn--delete mdc-btn--sm">Löschen</button>' : ''}
    </div>
  `;
}

function renderBrandLockup(detail) {
  const b = detail.briefing || {};
  const customer = b.marke?.logo_url || b.unternehmen?.logo_url || '';
  const customerName = b.marke?.markenname || b.unternehmen?.firmenname || 'Kunde';
  return `
    <div class="briefing-doc__lockup">
      <img src="/assets/background/LikeGroup_Logo%201.svg" alt="LikeGroup" class="briefing-doc__lockup-logo">
      <span class="briefing-doc__lockup-x" aria-hidden="true">×</span>
      ${customer
        ? `<img src="${detail.escape(customer)}" alt="${detail.escape(customerName)}" class="briefing-doc__lockup-logo">`
        : `<span class="briefing-doc__lockup-fallback">${detail.escape(customerName)}</span>`}
    </div>
  `;
}

function renderHero(detail, { actionsHtml = '' } = {}) {
  const b = detail.briefing;
  const bereich = BEREICH_LABELS[b.bereich] || b.bereich;
  const statusClass = b.is_draft ? 'warning' : 'success';
  const statusLabel = b.is_draft ? 'Entwurf' : 'Final';
  const firma = b.unternehmen?.firmenname;
  const marke = b.marke?.markenname;
  const subtitle = [firma, marke].filter(Boolean).map(s => detail.escape(s)).join(' · ');
  const folder = marke || firma;

  const from = b.content_deadline ? detail.formatDate(b.content_deadline) : null;
  const to = b.go_live ? detail.formatDate(b.go_live) : null;
  let dates = null;
  if (from && to) dates = `${from} bis ${to}`;
  else dates = from || to;

  return `
    <header class="briefing-doc__hero">
      ${renderBrandLockup(detail)}
      <div class="briefing-doc__top">
        <div class="briefing-doc__badges">
          <span class="status-badge ${statusClass}">${statusLabel}</span>
          ${bereich ? `<span class="tag tag--type">${detail.escape(bereich)}</span>` : ''}
        </div>
        ${actionsHtml}
      </div>
      ${renderProducts(detail)}
      <h1 class="briefing-doc__title">${detail.escape(b.aktivierung_name || 'Briefing')}</h1>
      ${subtitle ? `<p class="briefing-doc__subtitle">${subtitle}</p>` : ''}
      <div class="briefing-doc__meta">
        ${renderMetaChip('folder', folder ? detail.escape(folder) : '')}
        ${renderMetaChip('calendar', dates)}
      </div>
    </header>
  `;
}

function renderEditableText(field, value, className = 'briefing-doc__prose') {
  const placeholder = field.placeholder || 'Hier schreiben…';
  return `
    <div class="${className}" data-feld="${escapeLabel(field.name)}"
         data-placeholder="${escapeLabel(placeholder)}">${escapeLabel(rawText(value))}</div>
  `;
}

function renderCallout(items, { canEdit = false } = {}) {
  if (!items.length) return '';
  if (!canEdit) {
    const text = items.map(i => i.formatted).join('\n\n');
    return `
      <aside class="briefing-doc__callout">
        <div class="briefing-doc__kicker">Thema</div>
        <div class="briefing-doc__callout-text">${text}</div>
      </aside>
    `;
  }
  return `
    <aside class="briefing-doc__callout">
      <div class="briefing-doc__kicker">Thema</div>
      ${items.map(item => renderEditableText(item.field, item.value, 'briefing-doc__callout-text')).join('')}
    </aside>
  `;
}

function renderHeading(title, detail) {
  return `
    <h2 class="briefing-doc__heading">
      <span>${detail.escape(title)}</span>
    </h2>
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

function renderProseItem(item, { canEdit = false, showLabel = false } = {}) {
  const editable = canEdit && item.field.type === 'textarea';
  const kicker = showLabel && item.field.label
    ? `<div class="briefing-doc__kicker">${escapeLabel(item.field.label)}</div>`
    : '';

  if (!editable) {
    if (!item.formatted) return '';
    return `${kicker}<div class="briefing-doc__prose">${item.formatted}</div>`;
  }

  return `${kicker}${renderEditableText(item.field, item.value)}`;
}

function itemsToBlocks(items, detail) {
  const prose = [];
  const specs = [];
  for (const item of items) {
    if (item.field.type === 'group') {
      specs.push(...flattenGroupRows(item.field, item.value, detail));
    } else if (BLOCK_TYPES.has(item.field.type)) {
      prose.push(item);
    } else {
      specs.push({ label: specLabel(item.field), html: item.formatted });
    }
  }
  return { prose, specs };
}

function renderGroupedSections(groups, detail, { canEdit = false } = {}) {
  return groups.map(group => {
    const { prose, specs } = itemsToBlocks(group.items, detail);
    if (!prose.length && !specs.length) return '';
    const editableProse = canEdit ? prose.filter(i => i.field.type === 'textarea') : [];
    const showLabels = editableProse.length > 1 || editableProse.some(i => !rawText(i.value));
    return `
      <section class="briefing-doc__section">
        ${renderHeading(group.title, detail)}
        ${prose.map(item => renderProseItem(item, {
          canEdit,
          showLabel: showLabels && item.field.type === 'textarea'
        })).join('')}
        ${renderSpecTable(specs)}
      </section>
    `;
  }).join('');
}

function mergeByTitle(groups, extras) {
  const next = groups.map(g => ({ title: g.title, items: [...g.items] }));
  const unused = [];
  for (const extra of extras) {
    const hit = next.find(g => g.title === extra.title);
    if (hit) hit.items.push(...extra.items);
    else unused.push(extra);
  }
  return [next, unused];
}

export function htmlToPlainText(html) {
  if (html == null || html === '') return '';
  const str = String(html);
  const normalized = str.replace(/<br\s*\/?>/gi, '\n');
  // Immer ueber den DOM-Parser: decodiert alle Entities (u.a. &#x2F;, &#x27;),
  // die der Validator beim Escapen erzeugt. Kein manueller Replace-Pfad.
  const node = document.createElement('div');
  node.innerHTML = normalized;
  const text = node.innerText ?? node.textContent ?? '';
  return text
    .replace(/\u00a0/g, ' ')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function groupsToPdfSections(groups, detail) {
  return groups.map((group) => {
    const { prose, specs } = itemsToBlocks(group.items, detail);
    const blocks = [];
    for (const item of prose) {
      const text = htmlToPlainText(item.formatted);
      if (!text) continue;
      blocks.push({ type: 'prose', text });
    }
    for (const row of specs) {
      const text = htmlToPlainText(row.html);
      if (!text) continue;
      blocks.push({ type: 'spec', label: row.label, text });
    }
    if (!blocks.length) return null;
    return { title: group.title, blocks };
  }).filter(Boolean);
}

/**
 * Creator-Dokument fuer das Anschreiben-PDF: gleiche Felder wie die
 * DocView (compact=false), ohne CRM-Badges und ohne Admin-Meta.
 */
export function buildBriefingPdfModel(detail) {
  const b = detail?.briefing || {};
  const presentation = collectPresentation(detail, { forPdf: true });
  let prose = presentation.prose;
  let creator = presentation.creator;
  let secondary = presentation.secondary;
  [prose, secondary] = mergeByTitle(prose, secondary);
  [creator, secondary] = mergeByTitle(creator, secondary);

  const firma = b.unternehmen?.firmenname;
  const marke = b.marke?.markenname;
  const subtitle = [firma, marke].filter(Boolean).join(' · ') || null;
  const productNames = (b.produkte || []).map((p) => p?.name).filter(Boolean);
  const personaNames = (b.personas || []).map((p) => {
    if (!p?.name) return '';
    return p.oberbegriff ? `${p.oberbegriff} (${p.name})` : p.name;
  }).filter(Boolean);
  const products = [...productNames, ...personaNames].join(' · ') || null;

  const from = b.content_deadline ? detail.formatDate(b.content_deadline) : null;
  const to = b.go_live ? detail.formatDate(b.go_live) : null;
  let dates = null;
  if (from && to) dates = `${from} bis ${to}`;
  else dates = from || to;
  const embargo = b.embargo ? `Embargo ${detail.formatDate(b.embargo)}` : null;
  const maerkte = multiLabels(b.maerkte, MAERKTE_OPTIONS).join(', ') || null;
  const sprachen = multiLabels(b.sprachen, SPRACHEN_OPTIONS).join(', ') || null;
  const meta = [dates, embargo, maerkte, sprachen].filter(Boolean).join(' · ') || null;

  const sections = [];
  const thema = presentation.callout
    .map((item) => htmlToPlainText(item.formatted))
    .filter(Boolean)
    .join('\n\n');
  if (thema) sections.push({ title: 'Thema', blocks: [{ type: 'prose', text: thema }] });

  sections.push(...groupsToPdfSections(prose, detail));

  const specBlocks = presentation.specs
    .map((row) => ({ type: 'spec', label: row.label, text: htmlToPlainText(row.html) }))
    .filter((block) => block.text);
  if (specBlocks.length) sections.push({ title: null, blocks: specBlocks });

  sections.push(...groupsToPdfSections(creator, detail));
  sections.push(...groupsToPdfSections(secondary, detail));

  return {
    title: b.aktivierung_name || 'Briefing',
    subtitle,
    products,
    meta,
    sections,
  };
}

function renderAdminMeta(detail) {
  const rows = [];
  if (detail.briefing.created_at) {
    rows.push({ label: 'Erstellt', html: detail.escape(detail.formatDate(detail.briefing.created_at)) });
  }
  if (detail.briefing.updated_at) {
    rows.push({ label: 'Aktualisiert', html: detail.escape(detail.formatDate(detail.briefing.updated_at)) });
  }
  if (detail.briefing.assignee?.name) {
    rows.push({ label: 'Zugewiesen', html: detail.escape(detail.briefing.assignee.name) });
  }
  if (!rows.length) return '';
  return `
    <section class="briefing-doc__section">
      ${renderHeading('Allgemein', detail)}
      ${renderSpecTable(rows)}
    </section>
  `;
}

export function renderBriefingDoc({
  detail,
  compact = true,
  canDelete = false,
  canEdit = false,
  canAnschreiben = false,
  print = false
} = {}) {
  if (print) {
    compact = false;
    canDelete = false;
    canEdit = false;
    canAnschreiben = false;
  }
  const presentation = collectPresentation(detail, {
    includeEmptyTextareas: canEdit && !compact
  });

  let prose = presentation.prose;
  let creator = presentation.creator;
  let secondary = presentation.secondary;
  if (!compact) {
    [prose, secondary] = mergeByTitle(prose, secondary);
    [creator, secondary] = mergeByTitle(creator, secondary);
  }

  const editClass = canEdit ? ' briefing-doc--editable' : '';
  const printClass = print ? ' briefing-doc--print' : '';
  const actionsHtml = print
    ? ''
    : renderDocActions({ canEdit, canDelete, canAnschreiben, compact });

  return `
    <article class="briefing-doc${editClass}${printClass}" data-compact="${compact ? 'true' : 'false'}">
      ${renderHero(detail, { actionsHtml })}
      ${compact ? `<p class="briefing-doc__hint">Komprimierte Ansicht — für die komplette Felderliste oben rechts „Alle Felder“ wählen</p>` : ''}
      ${renderCallout(presentation.callout, { canEdit })}
      ${renderGroupedSections(prose, detail, { canEdit })}
      ${presentation.specs.length ? `
        <section class="briefing-doc__section">
          ${renderSpecTable(presentation.specs)}
        </section>
      ` : ''}
      ${renderGroupedSections(creator, detail, { canEdit })}
      ${compact ? '' : renderGroupedSections(secondary, detail, { canEdit })}
      ${compact ? '' : renderAdminMeta(detail)}
    </article>
  `;
}

function focusFeldEnd(field) {
  field.focus();
  const sel = window.getSelection();
  const range = document.createRange();
  range.selectNodeContents(field);
  range.collapse(false);
  sel?.removeAllRanges();
  sel?.addRange(range);
}

/**
 * Haengt InlineEdit an die Textarea-Zellen. Specs bleiben read-only.
 * @returns {{ destroy: Function, inlineEdit: InlineEdit } | null}
 */
export function bindBriefingDoc(root, { briefingId, canEdit = false, onSaved } = {}) {
  if (!root) return null;

  const db = window.supabase;
  let statusTimer = null;
  const statusEl = root.querySelector('[data-briefing-status]');

  const showSaved = () => {
    if (!statusEl) return;
    statusEl.hidden = false;
    if (statusTimer) clearTimeout(statusTimer);
    statusTimer = setTimeout(() => {
      statusEl.hidden = true;
    }, 1600);
  };

  const inlineEdit = new InlineEdit({
    onSave: async (feld, text) => {
      if (!TEXTAREA_FIELDS.has(feld)) throw new Error('Feld nicht editierbar');
      if (!db) throw new Error('Supabase fehlt');
      const { error } = await db
        .from('campaign_briefings')
        .update({ [feld]: text })
        .eq('id', briefingId);
      if (error) {
        window.toastSystem?.show('Speichern fehlgeschlagen.', 'error');
        throw new Error(error.message);
      }
      onSaved?.(feld, text);
      showSaved();
    }
  });
  inlineEdit.attach(root, { readonly: !canEdit });

  if (!canEdit) {
    return {
      inlineEdit,
      async destroy() {
        if (statusTimer) clearTimeout(statusTimer);
        inlineEdit.detach();
      }
    };
  }

  root.querySelectorAll('.briefing-doc__section, .briefing-doc__callout').forEach((section) => {
    section.addEventListener('mousedown', (e) => {
      if (e.target.closest('[data-feld], a, button, table, label')) return;
      const field = section.querySelector('[data-feld]');
      if (!field) return;
      e.preventDefault();
      focusFeldEnd(field);
    });
  });

  return {
    inlineEdit,
    async destroy() {
      if (statusTimer) clearTimeout(statusTimer);
      try { await inlineEdit.flush(); } catch (_) { /* Unmount trotzdem */ }
      inlineEdit.detach();
    }
  };
}
