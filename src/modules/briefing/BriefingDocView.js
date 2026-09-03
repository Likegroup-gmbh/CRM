// BriefingDocView.js
// Read-only Dokumentansicht fuer campaign_briefings.
// Klassifiziert fieldConfig-Felder (Hero / Callout / Prosa / Specs / Creator /
// sekundaer) und rendert die komprimierte bzw. vollstaendige Leseansicht.

import { icon } from '../../core/icons/IconSystem.js';
import {
  ANSATZ_OPTIONS,
  BEREICH_LABELS,
  MAERKTE_OPTIONS,
  SPRACHEN_OPTIONS,
  evaluateCondition,
  getStepsForBereich
} from './create/fieldConfig.js';

const HERO_KEYS = new Set(['aktivierung_name', 'ansatz']);
const CALLOUT_KEYS = new Set(['kampagne_thema', 'always_on_thema']);
const META_KEYS = new Set(['content_deadline', 'go_live', 'embargo', 'maerkte', 'sprachen']);
const CREATOR_KEYS = new Set([
  'creator_groessen', 'nischen', 'creator_merkmale', 'voraussetzungen', 'voraussetzungen_custom'
]);
const CREATOR_TITLES = new Set(['Welche Creator suchen wir?']);
const SECONDARY_TITLES = new Set([
  'Learnings aus vergleichbaren Aktivitaeten',
  'Learnings aus bisherigem bzw. vergleichbarem Content',
  'Produktion',
  'Wie soll der Content veroeffentlicht bzw. zusaetzlich genutzt werden?',
  'Wie soll Traffic bzw. Conversion erzeugt und gemessen werden?',
  'Welche Deliverables werden benoetigt?',
  'Wohin sollen die Ads fuehren?',
  'Zusaetzliche Assets'
]);
const SECONDARY_KEY_RE = /learnings|production_setup|vorort|versand|tracking|reporting|_offen$|_beispiele$|_referenzen$/;
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
  voraussetzungen_custom: 'Sonstige Voraussetzungen',
  alter: 'Alter',
  geschlecht: 'Geschlecht',
  standort: 'Standort',
  expertise: 'Expertise',
  sonstiges: 'Sonstiges'
};

const SECTION_ICONS = {
  'Rolle der Creator': 'clipboard-check',
  'Konkrete Umsetzung': 'document',
  'Konkrete Ideen fuer die Umsetzung': 'strategy',
  'Welche Creator suchen wir?': 'creator',
  'Was soll erreicht werden?': 'chart-bar',
  'Produktion': 'video',
  'Learnings aus vergleichbaren Aktivitaeten': 'lightbulb',
  'Learnings aus bisherigem bzw. vergleichbarem Content': 'lightbulb'
};

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
  if (CREATOR_KEYS.has(key) || CREATOR_TITLES.has(sectionTitle)) return 'creator';
  if (SECONDARY_TITLES.has(sectionTitle) || SECONDARY_KEY_RE.test(key)) return 'secondary';
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

export function collectPresentation(detail) {
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

      for (const field of section.fields) {
        if (field.persist === false || field.type === 'entitySelect' || field.type === 'entityMulti') continue;
        if (field.condition && !evaluateCondition(field.condition, briefing)) continue;

        const value = briefing[field.name];
        const formatted = detail.formatValue(field, value);
        if (formatted === null) continue;

        const role = classifyField(field, title);
        const item = { field, formatted, value };

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
  if (!names.length) return '';
  return `<p class="briefing-doc__products">${names.join('<span class="briefing-doc__products-sep"> · </span>')}</p>`;
}

function renderHero(detail) {
  const b = detail.briefing;
  const ansatz = optionLabel(ANSATZ_OPTIONS, b.ansatz);
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
  const embargo = b.embargo ? `Embargo ${detail.formatDate(b.embargo)}` : null;

  const maerkte = multiLabels(b.maerkte, MAERKTE_OPTIONS).map(s => detail.escape(s)).join(', ');
  const sprachen = multiLabels(b.sprachen, SPRACHEN_OPTIONS).map(s => detail.escape(s)).join(', ');

  return `
    <header class="briefing-doc__hero">
      <div class="briefing-doc__badges">
        ${ansatz ? `<span class="status-badge info">${detail.escape(ansatz)}</span>` : ''}
        <span class="status-badge ${statusClass}">${statusLabel}</span>
        ${bereich ? `<span class="tag tag--type">${detail.escape(bereich)}</span>` : ''}
      </div>
      ${renderProducts(detail)}
      <h1 class="briefing-doc__title">${detail.escape(b.aktivierung_name || 'Briefing')}</h1>
      ${subtitle ? `<p class="briefing-doc__subtitle">${subtitle}</p>` : ''}
      <div class="briefing-doc__meta">
        ${renderMetaChip('folder', folder ? detail.escape(folder) : '')}
        ${renderMetaChip('calendar', dates)}
        ${renderMetaChip('clock', embargo)}
        ${renderMetaChip('globe', maerkte)}
        ${renderMetaChip('language', sprachen)}
      </div>
    </header>
  `;
}

function renderCallout(items) {
  if (!items.length) return '';
  const text = items.map(i => i.formatted).join('\n\n');
  return `
    <aside class="briefing-doc__callout">
      <div class="briefing-doc__kicker">Thema</div>
      <div class="briefing-doc__callout-text">${text}</div>
    </aside>
  `;
}

function renderHeading(title, detail) {
  const iconKey = SECTION_ICONS[title];
  const glyph = iconKey
    ? icon(iconKey, { className: 'briefing-doc__section-icon', size: 18 })
    : '';
  return `
    <h2 class="briefing-doc__heading">
      ${glyph}
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

function renderProseItem(item) {
  return `<div class="briefing-doc__prose">${item.formatted}</div>`;
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

function renderGroupedSections(groups, detail) {
  return groups.map(group => {
    const { prose, specs } = itemsToBlocks(group.items, detail);
    if (!prose.length && !specs.length) return '';
    return `
      <section class="briefing-doc__section">
        ${renderHeading(group.title, detail)}
        ${prose.map(renderProseItem).join('')}
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

export function renderBriefingDoc({ detail, compact = true, canDelete = false }) {
  const presentation = collectPresentation(detail);
  const toggleLabel = compact ? 'Alle Felder' : 'Komprimiert';

  let prose = presentation.prose;
  let creator = presentation.creator;
  let secondary = presentation.secondary;
  if (!compact) {
    [prose, secondary] = mergeByTitle(prose, secondary);
    [creator, secondary] = mergeByTitle(creator, secondary);
  }

  return `
    <article class="briefing-doc" data-compact="${compact ? 'true' : 'false'}">
      <div class="briefing-doc__toolbar">
        <button type="button" id="btn-briefing-fields-toggle" class="mdc-btn mdc-btn--secondary mdc-btn--sm">${toggleLabel}</button>
        ${canDelete ? `<button type="button" id="btn-delete-briefing" class="mdc-btn mdc-btn--delete mdc-btn--sm">Löschen</button>` : ''}
      </div>
      ${renderHero(detail)}
      ${compact ? `<p class="briefing-doc__hint">Komprimierte Ansicht — für die komplette Felderliste oben rechts „Alle Felder“ wählen</p>` : ''}
      ${renderCallout(presentation.callout)}
      ${renderGroupedSections(prose, detail)}
      ${presentation.specs.length ? `
        <section class="briefing-doc__section">
          ${renderSpecTable(presentation.specs)}
        </section>
      ` : ''}
      ${renderGroupedSections(creator, detail)}
      ${compact ? '' : renderGroupedSections(secondary, detail)}
      ${compact ? '' : renderAdminMeta(detail)}
    </article>
  `;
}
