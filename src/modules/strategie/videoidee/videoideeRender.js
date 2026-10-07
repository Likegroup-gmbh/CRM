// videoideeRender.js
// Reine HTML-Templates des Videoidee-Drawers. Kein DOM-Zugriff, keine Listener.

import { escapeAttr } from '../../../core/VideoUploadUtils.js';
import { escapeHtml } from '../../../core/format.js';
import { icon } from '../../../core/icons/IconSystem.js';
import {
  VERARBEITUNG_LABELS,
  getPlatformIcon,
  renderSkriptFreigabeStatus
} from '../StrategieDetailRenderer.js';
import { isVideoideeVorschlag, beschreibungMitAbsaetzen } from '../videoideeVorschlag.js';
import { STRATEGIE_PRIO_OPTIONS, getStrategiePrio } from '../strategiePrioOptions.js';
import { renderTableSelect, tableSelectDisabled } from '../../../core/components/TableSelect.js';
import { renderCustomField } from '../../../core/customColumns/EntityCustomColumnRenderer.js';
import { makeCustomColumnId } from '../../../core/customColumns/entityColumnUtils.js';

import { BESCHREIBUNG_FELDER, beschreibungStrukturVon } from './beschreibungStruktur.js';

export const DRAWER_ID = 'edit-item-drawer';
export const STRUKTUR_FIELD_PREFIX = 'beschreibung_struktur.';

function hasText(value) {
  return String(value ?? '').trim().length > 0;
}

export function contentEditable(detail, item) {
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

export function prioDisabled(detail, item) {
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

export function itemTitle(item) {
  if (isVideoideeVorschlag(item)) return 'Videoidee-Vorschlag';
  return item.video_link ? 'Videoreferenz' : 'Idee';
}

function section(name, title, body, { hidden = false, actions = '' } = {}) {
  const heading = actions
    ? `<div class="videoidee-doc__head"><h3 class="videoidee-doc__heading">${escapeHtml(title)}</h3>${actions}</div>`
    : `<h3 class="videoidee-doc__heading">${escapeHtml(title)}</h3>`;
  return `
    <section class="videoidee-doc__section" data-videoidee-section="${name}" ${hidden ? 'hidden' : ''}>
      ${heading}
      ${body}
    </section>
  `;
}

function collapsibleSection(name, title, body, { hidden = false } = {}) {
  return `
    <section class="videoidee-doc__section is-collapsed" data-videoidee-section="${name}" ${hidden ? 'hidden' : ''}>
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

export function fieldText(item, field) {
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

  const hasMeta = props.length > 0 || item.video_link || item.screenshot_url;
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

export function renderEditCreatorField(item, editable) {
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

export function renderEditProduktField(item, editable) {
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

function strukturTabelle(detail, item, struktur) {
  const editable = contentEditable(detail, item);
  const rows = BESCHREIBUNG_FELDER
    .filter(({ key }) => editable || hasText(struktur[key]))
    .map(({ key, label }) => {
      const wert = editable
        ? `<textarea
            class="videoidee-doc__text"
            rows="1"
            data-field="${STRUKTUR_FIELD_PREFIX}${key}"
            data-item-id="${item.id}"
            placeholder="${escapeAttr(`${label}...`)}"
          >${escapeHtml(struktur[key])}</textarea>`
        : `<div class="videoidee-doc__prose">${escapeHtml(struktur[key])}</div>`;
      return `
        <tr class="videoidee-struktur__row" data-videoidee-struktur="${key}">
          <th scope="row" class="videoidee-struktur__label">${escapeHtml(label)}</th>
          <td class="videoidee-struktur__value">${wert}</td>
        </tr>
      `;
    }).join('');
  return `<table class="videoidee-struktur"><tbody>${rows}</tbody></table>`;
}

/** Neu analysieren: nur Team, nur Videoreferenz, nur mit gespeichertem Transkript. */
function renderAnalyseAktion(detail, item) {
  if (!contentEditable(detail, item) || !item.video_link || !hasText(item.transkript)) return '';
  return `
    <button type="button" class="videoidee-doc__action" data-action="analysiere-beschreibung" data-item-id="${item.id}" title="Beschreibung aus dem Transkript neu analysieren">
      ${icon('sparkles')}
      <span>Neu analysieren</span>
    </button>
  `;
}

function renderBeschreibung(detail, item) {
  const actions = renderAnalyseAktion(detail, item);
  const struktur = beschreibungStrukturVon(item);
  if (!struktur) {
    if (!showFilledOrEditable(detail, item, item.beschreibung)) return '';
    return section(
      'beschreibung',
      'Beschreibung',
      proseOrField(detail, item, 'beschreibung', 'Beschreibung...'),
      { actions }
    );
  }
  return section('beschreibung', 'Beschreibung', strukturTabelle(detail, item, struktur), { actions });
}

function renderTranskript(detail, item) {
  if (!item.video_link || !showFilledOrEditable(detail, item, item.transkript)) return '';
  return collapsibleSection('transkript', 'Transkript', proseOrField(detail, item, 'transkript', 'Transkript...'));
}

function renderUmsetzungsvorgabe(detail, item) {
  if (detail.isKunde) return '';
  const referenz = !!item.video_link;
  if (isVideoideeVorschlag(item)) {
    if (!referenz || !hasText(item.umsetzungsvorgabe)) return '';
    return collapsibleSection('umsetzungsvorgabe', 'Umsetzungsvorgabe', proseOrField(detail, item, 'umsetzungsvorgabe', ''));
  }
  return collapsibleSection(
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

export function renderBody(detail, item) {
  return [
    renderKopf(detail, item),
    renderBeschreibung(detail, item),
    renderKundenadaption(detail, item),
    renderTranskript(detail, item),
    renderUmsetzungsvorgabe(detail, item),
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
  return collapsibleSection('anmerkung', 'Anmerkung', `${field}${meta}`);
}

function renderFooter(nav) {
  return `
    ${navButton('videoidee-prev', 'Zurück', 'chevron-left', nav.index <= 0)}
    <span class="videoidee-drawer__pos" id="videoidee-pos">${escapeHtml(nav.label)}</span>
    ${navButton('videoidee-next', 'Weiter', 'chevron-right', nav.index < 0 || nav.index >= nav.total - 1, true)}
  `;
}

export function renderVorschlagActions(item) {
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

/** nav: Ergebnis von navState (order, index, total, label). */
export function shellHtml(detail, item, nav) {
  return `
    <div class="drawer-header videoidee-drawer__header">
      <span class="drawer-title" id="videoidee-drawer-title">${escapeHtml(itemTitle(item))}</span>
      <div class="videoidee-drawer__actions" id="videoidee-actions">${renderVorschlagActions(item)}</div>
      <button type="button" class="drawer-close-btn" aria-label="Schließen">&times;</button>
    </div>
    <div class="drawer-body videoidee-drawer__body" id="${DRAWER_ID}-body">${renderBody(detail, item)}</div>
    <div class="videoidee-drawer__footer" id="videoidee-footer">${renderFooter(nav)}</div>
  `;
}
