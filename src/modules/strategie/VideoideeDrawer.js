// VideoideeDrawer.js
// Lese- und Schreibansicht einer Videoidee. Die Tabelle bleibt editierbar;
// dieser Drawer ist die zweite Fläche, mit Zurück/Weiter und Autosave.

import { strategieService } from './StrategieService.js';
import { escapeAttr } from '../../core/VideoUploadUtils.js';
import { icon } from '../../core/icons/IconSystem.js';
import { StrategieCreatorDrawer } from './StrategieCreatorDrawer.js';
import { StrategieProduktDrawer } from './StrategieProduktDrawer.js';
import {
  handleCreatorUnlink,
  handleProduktUnlink,
  updateItemField
} from './StrategieDetailTableEvents.js';
import { resolveVideoideeForm } from './addItemPayload.js';
import { getPlatformIcon, groupItemsByTeilbereich, renderSkriptFreigabeStatus } from './StrategieDetailRenderer.js';
import { splitVideoideeVorschlaege, isVideoideeVorschlag, beschreibungMitAbsaetzen } from './videoideeVorschlag.js';
import { STRATEGIE_PRIO_OPTIONS, getStrategiePrio } from './strategiePrioOptions.js';
import { renderTableSelect, tableSelectDisabled, tableSelect } from '../../core/components/TableSelect.js';
import { renderCustomField } from '../../core/customColumns/EntityCustomColumnRenderer.js';
import { makeCustomColumnId } from '../../core/customColumns/entityColumnUtils.js';
import { CustomDatePicker } from '../../core/components/CustomDatePicker.js';
import { cssEscape, fieldSignature, syncCustomPeer } from './videoideeFieldSync.js';

const DRAWER_ID = 'edit-item-drawer';

const VERARBEITUNG_LABELS = {
  browser: 'Browser startet...',
  screenshot: 'Screenshot...',
  navigation: 'Seite laden...',
  captions: 'Untertitel...',
  download: 'Video laden...',
  whisper: 'Transkription...',
  description: 'Beschreibung...',
  adaption: 'Kundenadaption...',
  done: 'Fertig'
};

let openDetail = null;
let keyAbort = null;
let closeTimer = null;

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function isTranscribableUrl(url) {
  const u = (url || '').toLowerCase();
  return u.includes('tiktok.com') || u.includes('instagram.com');
}

function hasText(value) {
  return String(value ?? '').trim().length > 0;
}

function contentEditable(detail, item) {
  return !detail.isKunde && !!detail.canEdit && !isVideoideeVorschlag(item);
}

function feedbackLocked(detail) {
  return !!window.isGastReadonly?.() || (!detail.isKunde && !detail.canEdit);
}

function anmerkungEditable(detail, item) {
  return !!detail.isKunde && !feedbackLocked(detail) && !isVideoideeVorschlag(item);
}

function umgesetztReadonly(detail, item) {
  if (isVideoideeVorschlag(item)) return true;
  if (typeof window.permissionSystem?.canEditField === 'function') {
    return !window.permissionSystem.canEditField('strategie', 'video_umgesetzt');
  }
  return feedbackLocked(detail);
}

function prioDisabled(detail, item) {
  const isVorschlag = isVideoideeVorschlag(item);
  return tableSelectDisabled({
    gastReadonly: feedbackLocked(detail) || isVorschlag,
    isKunde: !!detail.isKunde,
    kundeDarfWaehlen: !isVorschlag,
    canEdit: typeof window.permissionSystem?.canEditField === 'function'
      ? window.permissionSystem.canEditField('strategie', 'strategie_prio')
      : true
  });
}

/**
 * Sichtbare Reihenfolge: KI-Vorschläge, dann Kategorien wie in der Tabelle.
 */
export function visibleVideoideen(detail) {
  const { vorschlaege, rest } = splitVideoideeVorschlaege(detail?.items || []);
  const groups = groupItemsByTeilbereich(rest);
  const definierte = detail?.getTeilbereicheFromStrategie?.() || [];
  const kategorien = [...definierte];
  if (!kategorien.includes('Ohne Kategorie')) kategorien.push('Ohne Kategorie');

  const ordered = [...vorschlaege];
  for (const kategorie of kategorien) {
    for (const entry of groups[kategorie] || []) {
      ordered.push(detail.items.find((item) => item.id === entry.id) || entry);
    }
  }
  return ordered;
}

function navState(detail, itemId) {
  const order = visibleVideoideen(detail);
  const index = order.findIndex((item) => String(item.id) === String(itemId));
  return {
    order,
    index,
    total: order.length,
    label: index >= 0 ? `${index + 1} von ${order.length}` : ''
  };
}

function itemTitle(item) {
  if (isVideoideeVorschlag(item)) return 'Videoidee-Vorschlag';
  return item.video_link ? 'Videoreferenz' : 'Idee';
}

function section(name, title, body, { hidden = false } = {}) {
  return `
    <section class="videoidee-doc__section" data-videoidee-section="${name}" ${hidden ? 'hidden' : ''}>
      <h3 class="videoidee-doc__heading">${escapeHtml(title)}</h3>
      ${body}
    </section>
  `;
}

function collapsibleSection(name, title, body) {
  return `
    <section class="videoidee-doc__section is-collapsed" data-videoidee-section="${name}">
      <button type="button" class="videoidee-doc__heading videoidee-doc__heading--toggle" data-videoidee-toggle="${name}" aria-expanded="false">
        ${icon('chevron-right')}
        <span>${escapeHtml(title)}</span>
      </button>
      <div class="videoidee-doc__section-body" hidden>
        ${body}
      </div>
    </section>
  `;
}

function fieldText(item, field) {
  const raw = item[field] || '';
  return field === 'beschreibung' ? beschreibungMitAbsaetzen(raw) : raw;
}

function proseOrField(detail, item, field, placeholder) {
  const editable = contentEditable(detail, item);
  const value = fieldText(item, field);
  if (!editable) {
    return `<div class="videoidee-doc__prose">${escapeHtml(value) || '–'}</div>`;
  }
  return `
    <textarea
      class="videoidee-doc__text"
      data-field="${field}"
      data-item-id="${item.id}"
      placeholder="${escapeAttr(placeholder)}"
    >${escapeHtml(value)}</textarea>
  `;
}

function showFilledOrEditable(detail, item, value) {
  if (contentEditable(detail, item)) return true;
  return hasText(value);
}

function renderTextSection(detail, item, name, title, field, placeholder) {
  if (!showFilledOrEditable(detail, item, item[field])) return '';
  return section(name, title, proseOrField(detail, item, field, placeholder));
}

function propRow(name, label, valueHtml, rowClass = '', iconKey = '') {
  const glyph = iconKey
    ? `<span class="videoidee-props__glyph" aria-hidden="true">${icon(iconKey, { className: 'icon-16' })}</span>`
    : '';
  return `
    <div class="videoidee-props__row${rowClass ? ` ${rowClass}` : ''}" data-videoidee-prop="${escapeAttr(name)}">
      <dt class="videoidee-props__label">${glyph}${escapeHtml(label)}</dt>
      <dd class="videoidee-props__value">${valueHtml}</dd>
    </div>
  `;
}

function renderKopf(detail, item) {
  const editable = contentEditable(detail, item);
  const props = [
    renderStatusProp(detail, item),
    renderLinkField(detail, item, editable),
    renderKategorieField(detail, item, editable),
    renderEditCreatorField(item, editable),
    renderEditProduktField(item, editable),
    ...renderDecisionProps(detail, item),
    ...renderCustomProps(detail, item)
  ].filter(Boolean);

  const referenz = !!item.video_link;
  const hasMeta = props.length > 0 || referenz || item.screenshot_url;
  if (!editable && !hasMeta) return '';

  return `
    <div class="videoidee-doc__hero" data-videoidee-section="kopf">
      ${renderBild(item)}
      ${props.length ? `<dl class="videoidee-props">${props.join('')}</dl>` : ''}
    </div>
  `;
}

function renderBild(item) {
  const isIdea = !item.video_link;
  const status = item.verarbeitung_status;
  const laeuft = status === 'processing' || status === 'pending';

  let bild;
  if (isIdea) {
    bild = `<div class="idea-placeholder">${icon('light-bulb')}<span>Idee</span></div>`;
  } else if (item.screenshot_url) {
    bild = `<img src="${escapeAttr(item.screenshot_url)}" alt="Screenshot" class="strategie-screenshot">`;
  } else {
    bild = `<div class="strategie-screenshot-placeholder"><span>${laeuft ? 'Lädt...' : 'Kein Bild'}</span></div>`;
  }

  const shot = item.video_link
    ? `<a href="${escapeAttr(item.video_link)}" target="_blank" rel="noopener noreferrer" class="videoidee-doc__shot" title="Video öffnen">${bild}</a>`
    : `<div class="videoidee-doc__shot">${bild}</div>`;

  let statusHtml = '';
  if (laeuft) {
    const label = status === 'pending'
      ? 'In der Warteschlange'
      : (VERARBEITUNG_LABELS[item.verarbeitung_step] || 'Verarbeitung läuft...');
    statusHtml = `<p class="videoidee-doc__status">${escapeHtml(label)}</p>`;
  } else if (status === 'error') {
    statusHtml = `<p class="videoidee-doc__status">${escapeHtml(item.verarbeitung_fehler || 'Verarbeitung fehlgeschlagen')}</p>`;
  }

  return `
    <div class="videoidee-doc__media">
      ${shot}
      ${statusHtml}
    </div>
  `;
}

function renderPlatformLink(item) {
  if (!item.video_link) return '';
  const glyph = getPlatformIcon(item.plattform) || icon('external-link', { className: 'icon-20' });
  return `<a href="${escapeAttr(item.video_link)}" target="_blank" rel="noopener noreferrer" class="strategie-platform-link videoidee-props__platform">${glyph}</a>`;
}

function renderLinkField(detail, item, editable) {
  const platform = renderPlatformLink(item);
  if (!editable) {
    if (!item.video_link) return '';
    return propRow('video_link', 'Video-URL', `
      <div class="videoidee-props__line">
        <a href="${escapeAttr(item.video_link)}" target="_blank" rel="noopener noreferrer" class="videoidee-props__url">${escapeHtml(item.video_link)}</a>
        ${platform}
      </div>
    `, '', 'video');
  }
  return propRow('video_link', 'Video-URL', `
    <div class="videoidee-props__line">
      <input
        type="url"
        id="videoidee-video-url"
        class="videoidee-props__input"
        data-field="video_link"
        data-item-id="${item.id}"
        value="${escapeAttr(item.video_link || '')}"
        placeholder="https://tiktok.com/... oder https://instagram.com/reel/..."
      >
      ${platform}
    </div>
  `, '', 'video');
}

function renderKategorieField(detail, item, editable) {
  if (!editable) {
    if (!item.teilbereich) return '';
    return propRow('teilbereich', 'Kategorie', escapeHtml(item.teilbereich), '', 'tag');
  }
  const teilbereiche = detail.getTeilbereicheFromStrategie?.() || [];
  return propRow('teilbereich', 'Kategorie', `
    <select id="videoidee-teilbereich" class="videoidee-props__input" data-field="teilbereich" data-item-id="${item.id}">
      <option value="">Ohne Kategorie</option>
      ${teilbereiche.map((tb) => `<option value="${escapeAttr(tb)}" ${item.teilbereich === tb ? 'selected' : ''}>${escapeHtml(tb)}</option>`).join('')}
    </select>
  `, '', 'tag');
}

function renderEditCreatorField(item, editable) {
  const eintrag = item.casting_eintrag;
  const hatEintrag = !!item.creator_auswahl_item_id;

  if (hatEintrag) {
    const name = eintrag?.name
      || (eintrag?.creator ? `${eintrag.creator.vorname || ''} ${eintrag.creator.nachname || ''}`.trim() : '')
      || 'Unbekannt';
    const label = escapeHtml(name);
    const actions = editable ? propActions(`
      ${iconAction('btn-edit-creator-change', 'Ändern', 'user-add')}
      ${iconAction('btn-edit-creator-unlink', 'Lösen', 'x-mark')}
    `) : '';
    return propRow('creator', 'Creator', `
      <div class="videoidee-props__line">
        ${eintrag?.creator_id
          ? `<a href="/creator/${eintrag.creator_id}" class="table-link" onclick="event.preventDefault(); window.navigateTo('/creator/${eintrag.creator_id}')">${label}</a>`
          : `<span>${label}</span>`}
        ${actions}
      </div>
    `, 'form-field--creator', 'creator');
  }

  const legacyName = item.creator
    ? `${item.creator.vorname || ''} ${item.creator.nachname || ''}`.trim()
    : (item.creator_name || '');

  if (!editable && !legacyName) return '';

  const connect = editable ? propActions(`
    <button type="button" class="videoidee-props__action videoidee-props__action--icon" id="btn-edit-creator-connect" title="Casting-Eintrag zuordnen" aria-label="Casting-Eintrag zuordnen">${icon('user-add')}</button>
  `) : '';

  return propRow('creator', 'Creator', `
    <div class="videoidee-props__line">
      ${legacyName ? `<span>${escapeHtml(legacyName)}</span>` : '<span class="strategie-cell-muted">–</span>'}
      ${connect}
    </div>
  `, 'form-field--creator', 'creator');
}

function propActions(buttons) {
  return `<span class="videoidee-props__actions">${buttons}</span>`;
}

function iconAction(id, label, iconName) {
  return `<button type="button" class="videoidee-props__action videoidee-props__action--icon" id="${id}" title="${escapeAttr(label)}" aria-label="${escapeAttr(label)}">${icon(iconName)}</button>`;
}

function renderEditProduktField(item, editable) {
  const name = (item.produkt?.name || '').trim();
  const hatProdukt = !!item.produkt_id;
  const label = escapeHtml(name || 'Unbekannt');

  if (hatProdukt) {
    const actions = editable ? propActions(`
      ${iconAction('btn-edit-produkt-change', 'Ändern', 'cube')}
      ${iconAction('btn-edit-produkt-unlink', 'Lösen', 'x-mark')}
    `) : '';
    return propRow('produkt', 'Produkt', `
      <div class="videoidee-props__line">
        <a href="/produkt/${item.produkt_id}" class="table-link" onclick="event.preventDefault(); window.navigateTo('/produkt/${item.produkt_id}')">${label}</a>
        ${actions}
      </div>
    `, 'form-field--produkt', 'cube');
  }

  if (!editable) return '';

  return propRow('produkt', 'Produkt', `
    <div class="videoidee-props__line">
      <span class="strategie-cell-muted">–</span>
      ${propActions(`<button type="button" class="videoidee-props__action videoidee-props__action--icon" id="btn-edit-produkt-connect" title="Produkt zuordnen" aria-label="Produkt zuordnen">${icon('cube')}</button>`)}
    </div>
  `, 'form-field--produkt', 'cube');
}

function renderTranskript(detail, item) {
  if (!item.video_link || !showFilledOrEditable(detail, item, item.transkript)) return '';
  return section('transkript', 'Transkript', proseOrField(detail, item, 'transkript', 'Transkript...'));
}

function renderUmsetzungsvorgabe(detail, item) {
  if (detail.isKunde) return '';
  const referenz = !!item.video_link;
  if (isVideoideeVorschlag(item)) {
    if (!referenz || !hasText(item.umsetzungsvorgabe)) return '';
    return section('umsetzungsvorgabe', 'Umsetzungsvorgabe', proseOrField(detail, item, 'umsetzungsvorgabe', ''));
  }
  return section(
    'umsetzungsvorgabe',
    'Umsetzungsvorgabe',
    proseOrField(detail, item, 'umsetzungsvorgabe', 'Was sollen wir von diesem Video umsetzen?'),
    { hidden: !referenz }
  );
}

function renderCaption(detail, item) {
  if (!item.video_link || !showFilledOrEditable(detail, item, item.caption)) return '';
  return collapsibleSection('caption', 'Caption', proseOrField(detail, item, 'caption', 'Caption...'));
}

function renderStatusProp(detail, item) {
  if (detail.isKunde || isVideoideeVorschlag(item)) return '';
  return propRow('status', 'Status', `<span data-videoidee-status>${renderSkriptFreigabeStatus(item)}</span>`, '', 'status');
}

function renderDecisionProps(detail, item) {
  if (isVideoideeVorschlag(item)) return [];
  return [
    propRow('prio', 'Prio', `
      <div data-videoidee-prio>
        ${renderTableSelect({
          field: 'strategie_prio',
          itemId: item.id,
          value: getStrategiePrio(item),
          options: STRATEGIE_PRIO_OPTIONS,
          disabled: prioDisabled(detail, item)
        })}
      </div>
    `, '', 'prio'),
    propRow('umsetzen', 'Umsetzen', renderUmsetzen(detail, item), '', 'check')
  ];
}

function renderCustomProps(detail, item) {
  const cols = visibleCustomColumns(detail);
  if (!cols.length) return [];
  const editable = contentEditable(detail, item);
  return cols.map((col) => {
    const value = detail.customColumns.getValue(item.id, col.id) ?? '';
    if (!editable && !hasText(value)) return '';
    return propRow(
      `custom-${col.id}`,
      col.name,
      renderCustomField(col, item.id, value, editable),
      'videoidee-props__row--custom'
    );
  });
}

function visibleCustomColumns(detail) {
  const cols = detail.customColumns?.getOrderedColumns?.() || [];
  const hidden = detail.hiddenColumns || [];
  return cols.filter((col) => {
    if (detail.isKunde && !col.visible_for_kunden) return false;
    return !hidden.includes(makeCustomColumnId(col.id));
  });
}

function renderKundenadaption(detail, item) {
  if (!item.video_link && !hasText(item.kundenadaption)) return '';
  return renderTextSection(detail, item, 'kundenadaption', 'Kundenadaption', 'kundenadaption', 'Kundenadaption...');
}

function renderBody(detail, item) {
  return [
    renderKopf(detail, item),
    renderTextSection(detail, item, 'beschreibung', 'Beschreibung', 'beschreibung', 'Beschreibung...'),
    renderTranskript(detail, item),
    renderUmsetzungsvorgabe(detail, item),
    renderKundenadaption(detail, item),
    renderAnmerkung(detail, item),
    renderCaption(detail, item)
  ].join('');
}

function renderUmsetzen(detail, item) {
  const readonly = umgesetztReadonly(detail, item);
  if (readonly) {
    const on = !!item.video_umgesetzt;
    return `<span class="strategie-umgesetzt-state${on ? ' is-active' : ''}">${on ? 'Umsetzen' : 'Nicht umsetzen'}</span>`;
  }
  return `
    <label class="toggle-switch strategie-umgesetzt-toggle-wrapper">
      <input type="checkbox"
        class="strategie-umgesetzt-toggle"
        data-field="video_umgesetzt"
        data-item-id="${item.id}"
        ${item.video_umgesetzt ? 'checked' : ''}>
      <span class="toggle-slider"></span>
    </label>
  `;
}

function renderAnmerkung(detail, item) {
  if (!item.video_link && !hasText(item.kunde_anmerkung)) return '';
  const editable = anmerkungEditable(detail, item);
  const meta = item.kunde_anmerkung && item.kunde_anmerkung_author_name
    ? `<div class="feedback-author-meta">${escapeHtml(item.kunde_anmerkung_author_name)}${item.kunde_anmerkung_updated_at ? ` · ${new Date(item.kunde_anmerkung_updated_at).toLocaleDateString('de-DE')}` : ''}</div>`
    : '';
  const field = editable
    ? `<textarea class="videoidee-doc__text" data-field="kunde_anmerkung" data-item-id="${item.id}" placeholder="Ihre Anmerkung...">${escapeHtml(item.kunde_anmerkung || '')}</textarea>`
    : `<div class="videoidee-doc__prose" data-field="kunde_anmerkung" data-item-id="${item.id}">${escapeHtml(item.kunde_anmerkung || '') || '–'}</div>`;
  return section('anmerkung', 'Anmerkung', `${field}${meta}`);
}

function renderActions(detail, item) {
  if (!isVideoideeVorschlag(item)) return '';
  return renderVorschlagActions(item);
}

function renderFooter(detail, item) {
  const nav = navState(detail, item.id);
  return `
    ${navButton('videoidee-prev', 'Zurück', 'chevron-left', nav.index <= 0)}
    <span class="videoidee-drawer__pos" id="videoidee-pos">${escapeHtml(nav.label)}</span>
    ${navButton('videoidee-next', 'Weiter', 'chevron-right', nav.index < 0 || nav.index >= nav.total - 1, true)}
  `;
}

function renderVorschlagActions(item) {
  if (!isVideoideeVorschlag(item)) return '';
  return `
    <div class="videoidee-drawer__vorschlag">
      <button type="button" class="mdc-btn mdc-btn--secondary" data-action="uebernehmen-vorschlag" data-id="${item.id}">
        <span class="mdc-btn__icon" aria-hidden="true">${icon('check-bold')}</span>
        <span class="mdc-btn__label">Übernehmen</span>
      </button>
      <button type="button" class="mdc-btn mdc-btn--delete" data-action="verwerfen-vorschlag" data-id="${item.id}">
        <span class="mdc-btn__icon" aria-hidden="true">${icon('trash')}</span>
        <span class="mdc-btn__label">Verwerfen</span>
      </button>
    </div>
  `;
}

function navButton(action, label, iconName, disabled, iconAfter = false) {
  const glyph = `<span class="mdc-btn__icon" aria-hidden="true">${icon(iconName)}</span>`;
  const text = `<span class="mdc-btn__label">${label}</span>`;
  return `
    <button type="button" class="mdc-btn mdc-btn--secondary" data-action="${action}" ${disabled ? 'disabled' : ''}>
      ${iconAfter ? `${text}${glyph}` : `${glyph}${text}`}
    </button>
  `;
}

export function showEditItemDrawer(detail, itemId) {
  const item = detail.items?.find((entry) => String(entry.id) === String(itemId));
  if (!item) {
    window.toastSystem?.show('Item nicht gefunden', 'error');
    return;
  }

  if (closeTimer) {
    clearTimeout(closeTimer);
    closeTimer = null;
  }

  openDetail = detail;
  const existing = document.getElementById(DRAWER_ID);
  if (existing) {
    existing.classList.add('show');
    void stepTo(detail, itemId);
    return;
  }

  const overlay = document.createElement('div');
  overlay.className = 'drawer-overlay';
  overlay.id = `${DRAWER_ID}-overlay`;

  const panel = document.createElement('div');
  panel.setAttribute('role', 'dialog');
  panel.setAttribute('aria-modal', 'true');
  panel.setAttribute('aria-labelledby', 'videoidee-drawer-title');
  panel.className = 'drawer-panel drawer-panel--wide videoidee-drawer';
  panel.id = DRAWER_ID;
  panel.dataset.itemId = String(item.id);
  panel.innerHTML = shellHtml(detail, item);

  overlay.addEventListener('click', () => closeEditItemDrawer());
  panel.querySelector('.drawer-close-btn')?.addEventListener('click', () => closeEditItemDrawer());

  document.body.appendChild(overlay);
  document.body.appendChild(panel);

  requestAnimationFrame(() => panel.classList.add('show'));

  bindDrawer(detail, panel);
  markOpenRow(detail, item.id);
  bindKeys();
}

function shellHtml(detail, item) {
  return `
    <div class="drawer-header videoidee-drawer__header">
      <span class="drawer-title" id="videoidee-drawer-title">${escapeHtml(itemTitle(item))}</span>
      <div class="videoidee-drawer__actions" id="videoidee-actions">${renderActions(detail, item)}</div>
      <button type="button" class="drawer-close-btn" aria-label="Schließen">&times;</button>
    </div>
    <div class="drawer-body videoidee-drawer__body" id="${DRAWER_ID}-body">${renderBody(detail, item)}</div>
    <div class="videoidee-drawer__footer" id="videoidee-footer">${renderFooter(detail, item)}</div>
  `;
}

function renderOpenItem(detail, itemId, { scroll = false } = {}) {
  const panel = document.getElementById(DRAWER_ID);
  const item = detail.items?.find((entry) => String(entry.id) === String(itemId));
  if (!panel || !item) return;

  panel.dataset.itemId = String(item.id);
  panel.dataset.navIndex = String(navState(detail, item.id).index);
  const title = panel.querySelector('#videoidee-drawer-title');
  if (title) title.textContent = itemTitle(item);
  const actions = panel.querySelector('#videoidee-actions');
  if (actions) actions.innerHTML = renderActions(detail, item);
  updateNav(detail, item.id);

  const body = panel.querySelector('.videoidee-drawer__body');
  if (body) {
    body.innerHTML = renderBody(detail, item);
    if (scroll) body.scrollTop = 0;
  }

  bindDrawer(detail, panel);
  markOpenRow(detail, item.id);
}

function updateNav(detail, itemId) {
  const panel = document.getElementById(DRAWER_ID);
  if (!panel) return;
  const nav = navState(detail, itemId);
  const pos = panel.querySelector('#videoidee-pos');
  if (pos) pos.textContent = nav.label;
  const prev = panel.querySelector('[data-action="videoidee-prev"]');
  const next = panel.querySelector('[data-action="videoidee-next"]');
  if (prev) prev.disabled = nav.index <= 0;
  if (next) next.disabled = nav.index < 0 || nav.index >= nav.total - 1;
  panel.dataset.navIndex = String(nav.index);
}

async function stepTo(detail, itemId) {
  const panel = document.getElementById(DRAWER_ID);
  if (!panel) return;
  await commitFocused(panel);
  renderOpenItem(detail, itemId, { scroll: true });
}

async function step(detail, delta) {
  const panel = document.getElementById(DRAWER_ID);
  if (!panel) return;
  await commitFocused(panel);
  const nav = navState(detail, panel.dataset.itemId);
  const next = nav.order[nav.index + delta];
  if (!next) return;
  renderOpenItem(detail, next.id, { scroll: true });
}

function bindKeys() {
  keyAbort?.abort();
  keyAbort = new AbortController();
  document.addEventListener('videoidee-table-rendered', () => {
    if (openDetail) onTableRendered(openDetail);
  }, { signal: keyAbort.signal });
  document.addEventListener('keydown', (e) => {
    if (!document.getElementById(DRAWER_ID)) return;
    if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
    if (document.querySelector('.table-select__portal')) return;
    const active = document.activeElement;
    if (active?.closest?.('input, textarea, select, [contenteditable="true"]')) return;
    e.preventDefault();
    if (!openDetail) return;
    void step(openDetail, e.key === 'ArrowLeft' ? -1 : 1);
  }, { signal: keyAbort.signal });
}

function bindDrawer(detail, panel) {
  tableSelect.init();
  if (panel.dataset.navBound !== '1') {
    panel.dataset.navBound = '1';
    panel.querySelector('[data-action="videoidee-prev"]')?.addEventListener('click', () => {
      void step(detail, -1);
    });
    panel.querySelector('[data-action="videoidee-next"]')?.addEventListener('click', () => {
      void step(detail, 1);
    });
  }

  if (panel.dataset.captionBound !== '1') {
    panel.dataset.captionBound = '1';
    panel.addEventListener('click', (e) => {
      const btn = e.target.closest?.('[data-videoidee-toggle="caption"]');
      if (!btn || !panel.contains(btn)) return;
      const sectionEl = btn.closest('[data-videoidee-section="caption"]');
      const body = sectionEl?.querySelector('.videoidee-doc__section-body');
      const expanded = btn.getAttribute('aria-expanded') !== 'true';
      btn.setAttribute('aria-expanded', expanded ? 'true' : 'false');
      sectionEl?.classList.toggle('is-collapsed', !expanded);
      sectionEl?.classList.toggle('is-expanded', expanded);
      if (body) body.hidden = !expanded;
      if (expanded) {
        const area = body?.querySelector('textarea.videoidee-doc__text');
        if (area) requestAnimationFrame(() => autogrow(area));
      }
    });
  }

  panel.querySelectorAll('[data-field]').forEach((el) => {
    if (el.dataset.videoideeBound === '1') return;
    if (!('value' in el) && el.type !== 'checkbox') return;
    el.dataset.videoideeBound = '1';
    el.dataset.videoideeSaved = fieldSignature(el);
    const commit = () => commitControl(detail, el);
    el._videoideeCommit = commit;
    el.addEventListener('blur', () => { void commit(); });
    if (el.type === 'checkbox' || el.tagName === 'SELECT') {
      el.addEventListener('change', () => { void commit(); });
    }
  });

  const urlInput = panel.querySelector('[data-field="video_link"]');
  urlInput?.addEventListener('input', () => {
    const block = panel.querySelector('[data-videoidee-section="umsetzungsvorgabe"]');
    if (block) block.hidden = !urlInput.value.trim() && !detail.items.find((i) => String(i.id) === panel.dataset.itemId)?.video_link;
  });

  bindCreator(detail, panel.dataset.itemId);
  bindProdukt(detail, panel.dataset.itemId);
  bindCustom(detail, panel);
  bindVorschlag(detail, panel);
  bindAutogrow(panel);
  bindClickToWrite(panel);

  if (panel.dataset.dateBound !== '1') {
    panel.dataset.dateBound = '1';
    panel._dateCleanup = CustomDatePicker.bind(panel) || null;
  }
}

async function commitFocused(panel) {
  const el = document.activeElement;
  if (!el || !panel?.contains(el) || typeof el._videoideeCommit !== 'function') return;
  await el._videoideeCommit();
}

async function commitControl(detail, el) {
  const signature = fieldSignature(el);
  if (el.dataset.videoideeSaved === signature) return true;
  const field = el.dataset.field;
  const itemId = el.dataset.itemId;
  const item = detail.items.find((entry) => String(entry.id) === String(itemId));
  if (!item) return false;

  el.dataset.videoideeSaved = signature;
  let ok = true;

  if (field === 'video_link') ok = await commitLink(detail, el, item);
  else if (field === 'teilbereich') ok = await commitKategorie(detail, el, item);
  else if (field === 'video_umgesetzt') ok = await commitUmsetzen(detail, el, item);
  else if (field === 'umsetzungsvorgabe' && linkDirty(el, item)) ok = await commitLink(detail, linkInput(el), item);
  else ok = await commitText(detail, el, item);

  if (!ok) delete el.dataset.videoideeSaved;
  else el.dataset.videoideeSaved = fieldSignature(el);
  return ok;
}

function linkInput(from) {
  return from?.closest(`#${DRAWER_ID}`)?.querySelector('[data-field="video_link"]') || from;
}

function linkDirty(from, item) {
  const input = linkInput(from);
  if (!input) return false;
  return input.value.trim() !== (item.video_link || '');
}

async function commitText(detail, el, item) {
  const field = el.dataset.field;
  const value = el.type === 'checkbox' ? el.checked : el.value;
  const current = item[field] ?? '';
  if (String(current ?? '') === String(value ?? '')) return true;
  await updateItemField(detail, item.id, field, value, el);
  return true;
}

async function commitUmsetzen(detail, el, item) {
  if (el.checked && item.nicht_umsetzen) {
    el.checked = false;
    window.toastSystem?.show('Zuerst „Nicht umsetzen" deaktivieren', 'warning');
    return false;
  }
  if (!!item.video_umgesetzt === el.checked) return true;
  await updateItemField(detail, item.id, 'video_umgesetzt', el.checked, el);
  el.closest('label')?.classList.toggle('is-active', el.checked);
  const row = document.querySelector(`tr.item-row[data-item-id="${cssEscape(String(item.id))}"]`);
  row?.classList.toggle('strategie-item-umgesetzt', el.checked);
  return true;
}

async function commitKategorie(detail, el, item) {
  const teilbereich = el.value || null;
  if ((item.teilbereich || null) === teilbereich) return true;
  await strategieService.updateStrategieItem(item.id, { teilbereich });
  item.teilbereich = teilbereich;
  detail.rerenderItemsTable?.();
  updateNav(detail, item.id);
  return true;
}

async function commitLink(detail, el, item) {
  if (!el) return false;
  const panel = el.closest(`#${DRAWER_ID}`);
  const url = el.value || '';
  const vorgabeEl = panel?.querySelector('[data-field="umsetzungsvorgabe"]');
  const beschreibungEl = panel?.querySelector('[data-field="beschreibung"]');
  const kategorieEl = panel?.querySelector('[data-field="teilbereich"]');
  const wasReferenz = !!item.video_link;

  if (url.trim() === (item.video_link || '') && (vorgabeEl?.value ?? '') === (item.umsetzungsvorgabe || '')) {
    return true;
  }

  const data = new FormData();
  data.set('art', url.trim() ? 'videoreferenz' : 'idee');
  data.set('video_link', url);
  data.set('umsetzungsvorgabe', vorgabeEl?.value ?? item.umsetzungsvorgabe ?? '');
  data.set('beschreibung', beschreibungEl?.value ?? item.beschreibung ?? '');
  data.set('teilbereich', kategorieEl?.value ?? item.teilbereich ?? '');

  const result = await persistVideoideeEdit(detail, item.id, data);
  if (!result.ok) {
    window.toastSystem?.show(result.error, 'warning');
    const vorgabeFehlt = result.error === 'Was sollen wir von diesem Video umsetzen?';
    if (!vorgabeFehlt) el.value = item.video_link || '';
    const block = panel?.querySelector('[data-videoidee-section="umsetzungsvorgabe"]');
    if (block && url.trim()) block.hidden = false;
    return false;
  }

  if (wasReferenz !== !!item.video_link) {
    renderOpenItem(detail, item.id, { scroll: false });
  }
  detail.rerenderItemsTable?.();
  return true;
}

function bindCreator(detail, itemId) {
  const root = document.getElementById(DRAWER_ID);
  if (!root) return;
  const openCreator = () => {
    const drawer = new StrategieCreatorDrawer(detail);
    drawer.open(itemId, { onSuccess: () => refreshBlock(detail, itemId, 'creator') });
  };
  root.querySelector('#btn-edit-creator-connect')?.addEventListener('click', openCreator);
  root.querySelector('#btn-edit-creator-change')?.addEventListener('click', openCreator);
  root.querySelector('#btn-edit-creator-unlink')?.addEventListener('click', async () => {
    const done = await handleCreatorUnlink(detail, itemId);
    if (done) refreshBlock(detail, itemId, 'creator');
  });
}

function bindProdukt(detail, itemId) {
  const root = document.getElementById(DRAWER_ID);
  if (!root) return;
  const openProdukt = () => {
    const drawer = new StrategieProduktDrawer(detail);
    drawer.open(itemId, { onSuccess: () => refreshBlock(detail, itemId, 'produkt') });
  };
  root.querySelector('#btn-edit-produkt-connect')?.addEventListener('click', openProdukt);
  root.querySelector('#btn-edit-produkt-change')?.addEventListener('click', openProdukt);
  root.querySelector('#btn-edit-produkt-unlink')?.addEventListener('click', async () => {
    const done = await handleProduktUnlink(detail, itemId);
    if (done) refreshBlock(detail, itemId, 'produkt');
  });
}

function refreshBlock(detail, itemId, kind) {
  const item = detail.items.find((entry) => String(entry.id) === String(itemId));
  const field = document.querySelector(`#${DRAWER_ID} .form-field--${kind}`);
  if (!item || !field) return;
  const html = kind === 'creator'
    ? renderEditCreatorField(item, contentEditable(detail, item))
    : renderEditProduktField(item, contentEditable(detail, item));
  if (!html) {
    field.remove();
    return;
  }
  const tmp = document.createElement('div');
  tmp.innerHTML = html;
  field.replaceWith(tmp.firstElementChild);
  if (kind === 'creator') bindCreator(detail, itemId);
  else bindProdukt(detail, itemId);
}

function bindCustom(detail, panel) {
  if (!detail.customColumns?.hasColumns && !panel.querySelector('.custom-col-input')) return;
  panel.querySelectorAll('.custom-col-input').forEach((el) => {
    if (el.dataset.videoideeBound === '1') return;
    el.dataset.videoideeBound = '1';
    const handler = async () => {
      const ok = await detail.customColumns.handleFieldUpdate(el);
      if (ok) syncCustomPeer(el);
    };
    const isChangeOnly = el.type === 'checkbox' || el.tagName === 'SELECT' || el.classList.contains('custom-col-date');
    if (isChangeOnly) el.addEventListener('change', handler);
    else {
      el.addEventListener('blur', handler);
      el.addEventListener('change', handler);
    }
  });
  panel.querySelectorAll('.custom-upload-btn').forEach((btn) => {
    if (btn.dataset.videoideeBound === '1') return;
    btn.dataset.videoideeBound = '1';
    btn.addEventListener('click', () => {
      detail.customColumns.openUploadDrawer(btn, uploadMeta(detail), () => {
        detail.rerenderItemsTable?.();
        renderOpenItem(detail, panel.dataset.itemId, { scroll: false });
      });
    });
  });
}

function uploadMeta(detail) {
  const s = detail.strategie || {};
  return {
    unternehmen: s.unternehmen?.firmenname || '',
    marke: s.marke?.markenname || '',
    kampagne: s.kampagne?.kampagnenname || '',
    kooperationName: s.name || 'Konzept'
  };
}

function bindVorschlag(detail, panel) {
  panel.querySelector('[data-action="uebernehmen-vorschlag"]')?.addEventListener('click', async (e) => {
    e.preventDefault();
    const id = e.currentTarget.dataset.id;
    await detail.vorschlagPanel?.uebernehmen(id);
    if (detail.items.find((item) => String(item.id) === String(id))) {
      renderOpenItem(detail, id, { scroll: false });
    }
  });
  panel.querySelector('[data-action="verwerfen-vorschlag"]')?.addEventListener('click', async (e) => {
    e.preventDefault();
    const id = e.currentTarget.dataset.id;
    const nav = navState(detail, id);
    const neighbor = nav.order[nav.index + 1] || nav.order[nav.index - 1];
    await detail.vorschlagPanel?.verwerfen(id);
    if (detail.items.find((item) => String(item.id) === String(id))) return;
    if (neighbor && detail.items.find((item) => item.id === neighbor.id)) {
      renderOpenItem(detail, neighbor.id, { scroll: true });
    } else {
      closeEditItemDrawer();
    }
  });
}

function onTableRendered(detail) {
  const panel = document.getElementById(DRAWER_ID);
  if (!panel) return;
  const itemId = panel.dataset.itemId;
  const item = detail.items?.find((entry) => String(entry.id) === String(itemId));
  if (!item) {
    const index = Number(panel.dataset.navIndex);
    const order = visibleVideoideen(detail);
    const neighbor = order[index] || order[index - 1] || order[0];
    if (neighbor) renderOpenItem(detail, neighbor.id, { scroll: true });
    else closeEditItemDrawer();
    return;
  }
  markOpenRow(detail, item.id);
  updateNav(detail, item.id);
  patchFields(panel, item);
  if (!panel.querySelector('.form-field--creator')?.contains(document.activeElement)) {
    refreshBlock(detail, item.id, 'creator');
  }
  if (!panel.querySelector('.form-field--produkt')?.contains(document.activeElement)) {
    refreshBlock(detail, item.id, 'produkt');
  }
  patchPrio(detail, panel, item);
  patchStatus(panel, item);
}

function patchFields(panel, item) {
  panel.querySelectorAll('[data-field]').forEach((el) => {
    if (el === document.activeElement || el.contains(document.activeElement)) return;
    const field = el.dataset.field;
    if (!field || field === 'strategie_prio' || !(field in item)) return;
    const tag = el.tagName;
    if (tag !== 'INPUT' && tag !== 'TEXTAREA' && tag !== 'SELECT') return;
    const value = field === 'teilbereich' ? (item.teilbereich || '') : fieldText(item, field);
    if (el.type === 'checkbox') el.checked = !!value;
    else el.value = value ?? '';
    el.dataset.videoideeSaved = fieldSignature(el);
  });
}

function patchStatus(panel, item) {
  const slot = panel.querySelector('[data-videoidee-status]');
  if (!slot) return;
  slot.innerHTML = renderSkriptFreigabeStatus(item);
}

function patchPrio(detail, panel, item) {
  const slot = panel.querySelector('[data-videoidee-prio]');
  if (!slot || slot.contains(document.activeElement) || slot.querySelector('.table-select.show')) return;
  const current = slot.querySelector('[data-table-select]')?.dataset.value;
  const next = getStrategiePrio(item);
  if (current === next) return;
  slot.innerHTML = renderTableSelect({
    field: 'strategie_prio',
    itemId: item.id,
    value: next,
    options: STRATEGIE_PRIO_OPTIONS,
    disabled: prioDisabled(detail, item)
  });
}

function autogrow(el) {
  if (!el) return;
  el.style.height = 'auto';
  el.style.height = `${el.scrollHeight}px`;
}

function bindAutogrow(panel) {
  const areas = panel.querySelectorAll('textarea.videoidee-doc__text');
  areas.forEach((area) => {
    if (area.dataset.autogrowBound === '1') return;
    area.dataset.autogrowBound = '1';
    area.addEventListener('input', () => autogrow(area));
  });
  requestAnimationFrame(() => areas.forEach(autogrow));
}

function bindClickToWrite(panel) {
  const body = panel.querySelector('.videoidee-drawer__body');
  if (!body || body.dataset.clickWriteBound === '1') return;
  body.dataset.clickWriteBound = '1';
  body.addEventListener('mousedown', (e) => {
    const section = e.target.closest('.videoidee-doc__section');
    if (!section || section.classList.contains('is-collapsed') || e.target.closest('textarea, input, a, button, select')) return;
    const area = section.querySelector('textarea');
    if (!area) return;
    e.preventDefault();
    area.focus();
    const end = area.value.length;
    area.setSelectionRange?.(end, end);
  });
}

export function markOpenRow(detail, itemId) {
  document.querySelectorAll('tr.item-row.is-videoidee-open').forEach((row) => {
    row.classList.remove('is-videoidee-open');
  });
  const selector = `tr.item-row[data-item-id="${cssEscape(String(itemId))}"]`;
  const row = detail?._q?.(selector) || document.querySelector(selector);
  row?.classList.add('is-videoidee-open');
}

export function removeEditItemDrawer() {
  if (closeTimer) {
    clearTimeout(closeTimer);
    closeTimer = null;
  }
  keyAbort?.abort();
  keyAbort = null;
  const panel = document.getElementById(DRAWER_ID);
  panel?._dateCleanup?.();
  document.getElementById(`${DRAWER_ID}-overlay`)?.remove();
  panel?.remove();
  document.querySelectorAll('tr.item-row.is-videoidee-open').forEach((row) => {
    row.classList.remove('is-videoidee-open');
  });
  openDetail = null;
}

export function closeEditItemDrawer() {
  const panel = document.getElementById(DRAWER_ID);
  if (!panel) {
    removeEditItemDrawer();
    return;
  }
  void commitFocused(panel);
  panel.classList.remove('show');
  closeTimer = setTimeout(() => {
    closeTimer = null;
    removeEditItemDrawer();
  }, 300);
}

export async function persistVideoideeEdit(detail, itemId, formData) {
  const item = detail.items.find((entry) => String(entry.id) === String(itemId));
  const resolved = resolveVideoideeForm({
    art: formData.get('art') || (formData.get('video_link')?.trim() ? 'videoreferenz' : 'idee'),
    url: formData.get('video_link'),
    beschreibung: formData.get('beschreibung'),
    umsetzungsvorgabe: formData.get('umsetzungsvorgabe'),
    kategorie: formData.get('teilbereich') || null
  });
  if (!resolved.ok) return { ok: false, error: resolved.error };

  const videoUrl = resolved.url;
  const urlGeaendert = (videoUrl || null) !== (item?.video_link || null);

  if (videoUrl && urlGeaendert && !isTranscribableUrl(videoUrl)) {
    return { ok: false, error: 'Nur TikTok- und Instagram-Links sind erlaubt' };
  }

  let platform = null;
  if (videoUrl) {
    if (videoUrl.includes('tiktok.com')) platform = 'tiktok';
    else if (videoUrl.includes('youtube.com') || videoUrl.includes('youtu.be')) platform = 'youtube';
    else if (videoUrl.includes('instagram.com')) platform = 'instagram';
    else platform = 'other';
  }

  const updates = {
    video_link: videoUrl,
    teilbereich: resolved.kategorie,
    beschreibung: resolved.beschreibung,
    umsetzungsvorgabe: resolved.umsetzungsvorgabe,
    plattform: platform
  };

  if (resolved.beschreibung !== (item?.beschreibung || null)) {
    updates.beschreibung_quelle = resolved.beschreibung ? 'user' : null;
  }

  if (urlGeaendert) {
    updates.transkript = null;
    updates.transkript_quelle = null;
    updates.caption = null;
    updates.verarbeitung_fehler = null;
    updates.verarbeitung_step = null;
    updates.verarbeitung_status = videoUrl ? 'pending' : null;
    updates.screenshot_url = null;
    await strategieService.deleteScreenshot(item?.screenshot_url);
    if (item?.video_link && videoUrl) {
      updates.kundenadaption = null;
      updates.kundenadaption_quelle = null;
    }
  }

  await strategieService.updateStrategieItem(itemId, updates);
  if (item) Object.assign(item, updates);

  if (urlGeaendert && videoUrl) {
    try {
      await strategieService.enqueueItemProcessing(detail.strategieId, itemId);
    } catch (error) {
      console.warn('Verarbeitung konnte nicht gestartet werden:', error);
    }
  }

  return { ok: true };
}

export async function handleEditItemSubmit(detail, itemId, formData) {
  const submitBtn = document.querySelector('#edit-item-form button[type="submit"]');
  const originalText = submitBtn?.innerHTML;

  try {
    if (submitBtn) {
      submitBtn.disabled = true;
      submitBtn.innerHTML = 'Speichern...';
    }

    const result = await persistVideoideeEdit(detail, itemId, formData);
    if (!result.ok) {
      window.toastSystem?.show(result.error, 'warning');
      if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.innerHTML = originalText;
      }
      return;
    }

    window.toastSystem?.show('Änderungen gespeichert', 'success');
    closeEditItemDrawer();
    detail.rerenderItemsTable?.();
  } catch (error) {
    console.error('Fehler beim Speichern:', error);
    window.toastSystem?.show('Fehler beim Speichern', 'error');
    if (submitBtn) {
      submitBtn.disabled = false;
      submitBtn.innerHTML = originalText;
    }
  }
}
