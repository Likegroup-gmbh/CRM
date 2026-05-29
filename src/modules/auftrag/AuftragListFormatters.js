// AuftragListFormatters.js
// Formatierungs-Methoden fuer AuftragList (Prototype-Mixin)

import { AuftragList } from './AuftragListCore.js';
import { avatarBubbles } from '../../core/components/AvatarBubbles.js';
import { CustomDatePicker } from '../../core/components/CustomDatePicker.js';
import { getPaymentRowStatusClass } from './logic/PaymentRowStatus.js';

const currencyFormatter = new Intl.NumberFormat('de-DE', {
  style: 'currency', currency: 'EUR',
  minimumFractionDigits: 0, maximumFractionDigits: 0
});

const numberFormatter = new Intl.NumberFormat('de-DE', {
  minimumFractionDigits: 0, maximumFractionDigits: 0
});

const KAMPAGNE_ART_ABBR = {
  'UGC Pro Paid': 'UPP',
  'UGC Pro Organic': 'UPO',
  'UGC Video Paid': 'UVP',
  'UGC Video Organic': 'UVO',
  'Influencer Kampagne': 'IK',
  'Vor Ort Produktionen': 'VOP',
  'UGC Kampagne': 'UVO',
  'UGC': 'UVO',
  'IGC': 'UPO',
  'Influencer': 'IN',
  'Content Creation': 'CC'
};

const CHECK_ICON = `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" style="width: var(--icon-xs); height: var(--icon-xs); display: inline-block; vertical-align: middle;"><path stroke-linecap="round" stroke-linejoin="round" d="m4.5 12.75 6 6 9-13.5" /></svg>`;
const CROSS_ICON = `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" style="width: var(--icon-xs); height: var(--icon-xs); display: inline-block; vertical-align: middle;"><path stroke-linecap="round" stroke-linejoin="round" d="M6 18 18 6M6 6l12 12" /></svg>`;

AuftragList.prototype.formatCurrency = function(value) {
  return value ? currencyFormatter.format(value) : '-';
};

AuftragList.prototype.formatNumber = function(value) {
  return numberFormatter.format(value);
};

AuftragList.prototype.formatDate = function(date) {
  return date ? new Date(date).toLocaleDateString('de-DE') : '-';
};

AuftragList.prototype.formatZahlungsziel = function(tage) {
  if (tage === null || tage === undefined) return '-';
  if (tage === 0) return 'Sofort';
  return `${tage} Tage`;
};

AuftragList.prototype.formatBoolean = function(value) {
  return value ? CHECK_ICON : CROSS_ICON;
};

AuftragList.prototype.renderBillingDateCell = function(auftrag, boolField, dateField) {
  if (!this.isAdmin) {
    return this.formatBoolean(Boolean(auftrag[dateField]));
  }
  const label = boolField === 'rechnung_gestellt' ? 'Rechnung gestellt am' : 'Ueberwiesen am';
  return CustomDatePicker.render({
    id: auftrag.id,
    field: boolField,
    dateField,
    value: auftrag[dateField],
    label,
    inputClass: 'auftrag-inline-date-input'
  });
};

AuftragList.prototype.updateAuftragRowStatusClass = function(row) {
  if (!row) return;
  const statusClass = getPaymentRowStatusClass({
    ueberwiesen: row.dataset.ueberwiesen === 'true',
    rechnung_gestellt: row.dataset.rechnungGestellt === 'true',
    re_faelligkeit: row.dataset.reFaelligkeit || null
  });
  row.classList.remove(
    'auftrag-row--ueberwiesen',
    'auftrag-row--ueberfaellig',
    'auftrag-row--rechnung-gestellt'
  );
  if (statusClass) {
    row.classList.add(statusClass);
  }
};

AuftragList.prototype.syncInlineBillingUpdate = function(rowId, dateField, value) {
  const row = document.querySelector(`.data-table tr[data-tr-id="${rowId}"]`)
    || document.querySelector(`.data-table tr[data-id="${rowId}"]`);
  if (!row) {
    this.loadAndRender();
    return;
  }

  if (dateField === 'rechnung_gestellt_am') {
    row.dataset.rechnungGestellt = String(Boolean(value));
  } else if (dateField === 'ueberwiesen_am') {
    row.dataset.ueberwiesen = String(Boolean(value));
  }
  this.updateAuftragRowStatusClass(row);

  const inputSelector = dateField === 'rechnung_gestellt_am'
    ? '.col-rechnung-gestellt .auftrag-inline-date-input'
    : '.col-ueberwiesen .auftrag-inline-date-input';
  const input = row.querySelector(inputSelector);
  if (!input) return;

  CustomDatePicker.setValue(input, value || '');
  input.dataset.previousValue = value || '';
};

AuftragList.prototype.handleInlineBillingDateChange = async function(input) {
  if (!this.isAdmin || !input) return;

  const auftragId = input.dataset.id;
  const field = input.dataset.field;
  const dateField = input.dataset.dateField;
  const entity = input.dataset.entity || 'auftrag';
  if (!auftragId || !field) return;

  const previousValue = input.dataset.previousValue || '';
  const nextValue = CustomDatePicker.getValue(input);
  if (nextValue === previousValue) return;

  const isSimpleDateField = !dateField;
  let payload;
  if (isSimpleDateField) {
    payload = { [field]: nextValue || null };
  } else {
    payload = nextValue
      ? { [dateField]: nextValue, [field]: true }
      : { [dateField]: null, [field]: false };
  }

  CustomDatePicker.setDisabled(input, true);
  try {
    const result = await window.dataService.updateEntity(entity, auftragId, payload);
    if (!result?.success) {
      throw new Error(result?.error || 'Update fehlgeschlagen');
    }

    input.dataset.previousValue = nextValue;

    if (!isSimpleDateField) {
      const row = input.closest('tr');
      if (row) {
        if (field === 'rechnung_gestellt') {
          row.dataset.rechnungGestellt = String(Boolean(nextValue));
        } else if (field === 'ueberwiesen') {
          row.dataset.ueberwiesen = String(Boolean(nextValue));
        }
        this.updateAuftragRowStatusClass(row);
      }
    }

    window.dispatchEvent(new CustomEvent('entityUpdated', {
      detail: {
        entity,
        action: 'updated',
        id: auftragId,
        field: isSimpleDateField ? field : dateField,
        value: nextValue || null
      }
    }));
  } catch (error) {
    console.error('❌ Fehler beim Inline-Update des Datums:', error);
    CustomDatePicker.setValue(input, previousValue);
    window.toastSystem?.show('Aktualisierung fehlgeschlagen', 'error');
  } finally {
    CustomDatePicker.setDisabled(input, false);
  }
};

AuftragList.prototype.formatKampagneArtTags = function(arten) {
  if (!arten || !Array.isArray(arten) || arten.length === 0) return '-';

  const tags = arten.map(art => {
    const abbr = KAMPAGNE_ART_ABBR[art] || art.substring(0, 2).toUpperCase();
    return `<span class="tag tag--kampagne-art" title="${art}">${abbr}</span>`;
  }).join('');

  return `<div class="tags tags-compact">${tags}</div>`;
};

AuftragList.prototype.formatLeistungszeitraum = function(start, ende) {
  if (!start && !ende) return '-';
  const fmtShort = (d) => {
    const dt = new Date(d);
    return `${String(dt.getDate()).padStart(2, '0')}.${String(dt.getMonth() + 1).padStart(2, '0')}.`;
  };
  const fmtFull = (d) => {
    const dt = new Date(d);
    return `${String(dt.getDate()).padStart(2, '0')}.${String(dt.getMonth() + 1).padStart(2, '0')}.${dt.getFullYear()}`;
  };
  if (start && !ende) return fmtFull(start);
  if (!start && ende) return fmtFull(ende);
  const sameYear = new Date(start).getFullYear() === new Date(ende).getFullYear();
  return sameYear
    ? `${fmtShort(start)} – ${fmtFull(ende)}`
    : `${fmtFull(start)} – ${fmtFull(ende)}`;
};

AuftragList.prototype.formatRechnungskontakte = function(kontakte) {
  if (!kontakte || kontakte.length === 0) return '-';
  const items = kontakte
    .filter(ap => ap && ap.vorname && ap.nachname)
    .map(ap => ({
      name: `${ap.vorname} ${ap.nachname}`,
      type: 'person',
      id: ap.id,
      entityType: 'ansprechpartner',
      profile_image_url: ap.profile_image_url || null,
      thumb_url: ap.profile_image_thumb_url || null
    }));
  return items.length > 0 ? avatarBubbles.renderBubbles(items) : '-';
};

AuftragList.prototype.formatAnsprechpartner = function(person) {
  if (!person) return '-';
  const fullName = [person.vorname, person.nachname].filter(Boolean).join(' ');
  if (!fullName) return '-';

  return avatarBubbles.renderBubbles([{
    name: fullName,
    type: 'person',
    id: person.id,
    entityType: 'ansprechpartner',
    profile_image_url: person.profile_image_url || null,
    thumb_url: person.profile_image_thumb_url || null
  }]);
};

AuftragList.prototype.formatUnternehmenTag = function(unternehmen) {
  if (!unternehmen?.firmenname) return '-';

  const bubbleData = {
    name: unternehmen.firmenname,
    label: unternehmen.internes_kuerzel || unternehmen.firmenname,
    type: 'org',
    logo_url: unternehmen.logo_url || null,
    thumb_url: unternehmen.logo_thumb_url || null
  };
  if (!this.isKunde) {
    bubbleData.id = unternehmen.id;
    bubbleData.entityType = 'unternehmen';
  }
  return avatarBubbles.renderBubbles([bubbleData], { showLabel: true });
};

AuftragList.prototype.formatMarkeTag = function(marke) {
  if (!marke?.markenname) return '-';

  const bubbleData = {
    name: marke.markenname,
    type: 'org',
    logo_url: marke.logo_url || null,
    thumb_url: marke.logo_thumb_url || null
  };
  if (!this.isKunde) {
    bubbleData.id = marke.id;
    bubbleData.entityType = 'marke';
  }
  return avatarBubbles.renderBubbles([bubbleData], { showLabel: true });
};

AuftragList.prototype.formatMitarbeiterTags = function(entries) {
  if (!entries || entries.length === 0) return '-';

  const items = entries
    .map(item => {
      const name = item?.mitarbeiter?.name || item?.name;
      const id = item?.mitarbeiter?.id || item?.id;
      const profileImageUrl = item?.mitarbeiter?.profile_image_url || item?.profile_image_url;
      const profileImageThumbUrl = item?.mitarbeiter?.profile_image_thumb_url || item?.profile_image_thumb_url;
      if (!name) return null;
      return {
        name,
        type: 'person',
        id,
        entityType: 'mitarbeiter',
        profile_image_url: profileImageUrl || null,
        thumb_url: profileImageThumbUrl || null
      };
    })
    .filter(Boolean);

  return items.length > 0 ? avatarBubbles.renderBubbles(items) : '-';
};
