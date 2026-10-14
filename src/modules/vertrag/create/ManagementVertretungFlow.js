// ManagementVertretungFlow.js
// Lädt den Management-Bestand, legt ein Management aus dem Formular an,
// speichert die Adresse und löst den Ansprechpartner beim Finalisieren auf.

import { VertraegeCreate } from './VertraegeCreateCore.js';
import {
  addressComplete,
  legacyFreitextName,
  matchManagement,
  matchPerson,
  normName,
  pendingPersonStarted,
  personLabel,
  preselectPersonId,
  readPendingPerson,
  vertretungGiltFuer,
  vertretungLuecken
} from './managementVertretung.js';

const ADDRESS_KEYS = ['strasse', 'hausnummer', 'plz', 'stadt', 'land'];

function fieldValue(id) {
  return document.getElementById(id)?.value ?? '';
}

VertraegeCreate.prototype.loadAlleManagements = async function() {
  if (!window.supabase) {
    this.alleManagements = this.alleManagements || [];
    return;
  }
  const { data, error } = await window.supabase
    .from('management')
    .select('id, firmenname, strasse, hausnummer, plz, stadt, land')
    .order('firmenname');
  if (error) throw error;
  this.alleManagements = data || [];
};

VertraegeCreate.prototype._selectedManagement = function() {
  const id = this.formData._management_id;
  if (!id) return null;
  return (this.alleManagements || []).find((item) => item.id === id)
    || (this.creatorManagements || []).find((item) => item.id === id)
    || null;
};

VertraegeCreate.prototype._rememberManagement = function(management) {
  if (!management) return;
  const list = this.alleManagements || [];
  const index = list.findIndex((item) => item.id === management.id);
  if (index >= 0) list[index] = { ...list[index], ...management };
  else list.push(management);
  this.alleManagements = list;
};

VertraegeCreate.prototype.loadVertretungPersonen = async function(managementId) {
  this.vertretungPersonen = [];
  if (!managementId || !window.supabase) return;
  const { data, error } = await window.supabase
    .from('ansprechpartner')
    .select('id, vorname, nachname, email, telefonnummer, management_id')
    .eq('management_id', managementId)
    .order('nachname');
  if (error) throw error;
  this.vertretungPersonen = data || [];

  if (this.formData._ansprechpartner_id || pendingPersonStarted(readPendingPerson(this.formData))) return;
  if (!this.formData.creator_id) return;
  const { data: links, error: linkError } = await window.supabase
    .from('creator_ansprechpartner')
    .select('ansprechpartner_id')
    .eq('creator_id', this.formData.creator_id);
  if (linkError) throw linkError;
  const picked = preselectPersonId(
    this.vertretungPersonen,
    (links || []).map((link) => link.ansprechpartner_id)
  );
  if (picked) this.formData._ansprechpartner_id = picked;
};

VertraegeCreate.prototype.openVertragManagementForm = function() {
  const input = document.querySelector('#agentur-section-container .searchable-select-input');
  const typed = String(input?.value || '').trim();
  const selected = this._selectedManagement();
  const ignored = !typed || normName(typed) === 'kein management' || normName(typed) === 'management suchen...';
  const isCurrentLabel = selected && normName(selected.firmenname) === normName(typed);
  this.formData._management_anlegen = true;
  this.formData._neues_management_name = ignored || isCurrentLabel ? '' : typed;
  this.refreshAgenturSection();
  document.getElementById('vertrag_mgmt_name')?.focus();
};

VertraegeCreate.prototype.createVertragManagementFromForm = async function() {
  const name = String(fieldValue('vertrag_mgmt_name') || this.formData._neues_management_name || '').trim();
  const hint = document.getElementById('vertretung-name-hinweis');
  if (name.length < 2) {
    if (hint && name) {
      hint.textContent = 'Der Name braucht mindestens zwei Zeichen.';
      hint.classList.remove('hidden');
    }
    return false;
  }
  if (hint) {
    hint.textContent = '';
    hint.classList.add('hidden');
  }

  const address = this.readVertretungAddressFromForm();
  const match = matchManagement(name, this.alleManagements || []);
  if (match.exact) {
    this.formData._management_anlegen = false;
    window.toastSystem?.show(`${match.exact.firmenname} gibt es schon und ist ausgewählt.`, 'info');
    await this.selectVertragManagement(match.exact.id);
    return true;
  }

  const row = { firmenname: name };
  ADDRESS_KEYS.forEach((key) => {
    const value = String(address[key] || '').trim();
    if (value) row[key] = value;
  });
  const { data, error } = await window.supabase
    .from('management')
    .insert(row)
    .select('id, firmenname, strasse, hausnummer, plz, stadt, land')
    .single();
  if (error) {
    window.toastSystem?.show(error.message, 'error');
    return false;
  }
  this._rememberManagement(data);
  this.formData._management_anlegen = false;
  this.formData._neues_management_name = '';
  if (match.similar.length) {
    window.toastSystem?.show('Ähnlicher Name vorhanden, das Management wurde trotzdem angelegt.', 'warning');
  }
  await this.selectVertragManagement(data.id);
  return true;
};

VertraegeCreate.prototype.readVertretungAddressFromForm = function() {
  const current = this._selectedManagement() || {};
  const pick = (id, key) => {
    const node = document.getElementById(id);
    if (node) return node.value;
    const stored = this.formData[key];
    if (stored != null && String(stored).trim() !== '') return stored;
    return current[key] || (key === 'land' ? 'Deutschland' : '');
  };
  return {
    strasse: pick('vertrag_mgmt_strasse', 'influencer_agentur_strasse'),
    hausnummer: pick('vertrag_mgmt_hausnummer', 'influencer_agentur_hausnummer'),
    plz: pick('vertrag_mgmt_plz', 'influencer_agentur_plz'),
    stadt: pick('vertrag_mgmt_stadt', 'influencer_agentur_stadt'),
    land: pick('vertrag_mgmt_land', 'influencer_agentur_land')
  };
};

VertraegeCreate.prototype.saveVertretungAddress = async function() {
  const management = this._selectedManagement();
  if (!management || !window.supabase || this.formData._management_anlegen) return;
  const next = this.readVertretungAddressFromForm();
  const patch = {};
  ADDRESS_KEYS.forEach((key) => {
    const value = String(next[key] || '').trim();
    if (value && value !== String(management[key] || '').trim()) patch[key] = value;
  });
  if (!Object.keys(patch).length) return;
  const { error } = await window.supabase.from('management').update(patch).eq('id', management.id);
  if (error) {
    window.toastSystem?.show(error.message, 'error');
    return;
  }
  const updated = { ...management, ...patch };
  this._rememberManagement(updated);
  this.formData.influencer_agentur_strasse = updated.strasse || '';
  this.formData.influencer_agentur_hausnummer = updated.hausnummer || '';
  this.formData.influencer_agentur_plz = updated.plz || '';
  this.formData.influencer_agentur_stadt = updated.stadt || '';
  this.formData.influencer_agentur_land = updated.land || 'Deutschland';
};

VertraegeCreate.prototype.saveVertretungEmail = async function() {
  const personId = this.formData._ansprechpartner_id;
  const email = String(fieldValue('vertretung_email_nachtrag') || this.formData.vertretung_email_nachtrag || '').trim();
  if (!personId || !email.includes('@') || !window.supabase) return;
  const person = (this.vertretungPersonen || []).find((item) => item.id === personId);
  if (person?.email) return;
  const { error } = await window.supabase.from('ansprechpartner').update({ email }).eq('id', personId);
  if (error) {
    window.toastSystem?.show(error.message, 'error');
    return;
  }
  if (person) person.email = email;
  this.formData.vertretung_email_nachtrag = '';
};

VertraegeCreate.prototype._syncVertretungFromDom = function() {
  const personFields = [
    ['_vertretung_vorname', 'vertretung_vorname'],
    ['_vertretung_nachname', 'vertretung_nachname'],
    ['_vertretung_email', 'vertretung_email'],
    ['_vertretung_telefon', 'vertretung_telefon']
  ];
  personFields.forEach(([key, id]) => {
    const node = document.getElementById(id);
    if (node) this.formData[key] = node.value;
  });
  const name = document.getElementById('vertrag_mgmt_name');
  if (name) this.formData._neues_management_name = name.value;
  const select = document.getElementById('vertretung_ansprechpartner');
  if (select) this.formData._ansprechpartner_id = select.value || null;
};

VertraegeCreate.prototype.showVertretungLuecken = function(gaps) {
  const hint = document.getElementById('vertretung-luecken');
  if (!hint) return;
  if (!gaps.length) {
    hint.classList.add('hidden');
    hint.textContent = '';
    return;
  }
  hint.classList.remove('hidden');
  hint.textContent = gaps.join(' ');
};

VertraegeCreate.prototype._linkCreatorManagement = async function(creatorId, managementId) {
  const { data: existing, error: readError } = await window.supabase
    .from('creator_management')
    .select('id, ist_aktiv')
    .eq('creator_id', creatorId)
    .eq('management_id', managementId)
    .maybeSingle();
  if (readError) throw readError;
  if (existing?.ist_aktiv) return;
  if (existing) {
    const { error } = await window.supabase
      .from('creator_management')
      .update({ ist_aktiv: true })
      .eq('id', existing.id);
    if (error) throw error;
    return;
  }
  const { error } = await window.supabase
    .from('creator_management')
    .insert({ creator_id: creatorId, management_id: managementId, ist_aktiv: true });
  if (error) throw error;
};

VertraegeCreate.prototype._resolveVertretungPerson = async function(managementId) {
  const pending = readPendingPerson(this.formData);
  const people = this.vertretungPersonen || [];
  if (pendingPersonStarted(pending)) {
    const match = matchPerson(pending.vorname, pending.nachname, people);
    if (match.exact) {
      if (!match.exact.email && pending.email) {
        const { error } = await window.supabase
          .from('ansprechpartner')
          .update({ email: pending.email })
          .eq('id', match.exact.id);
        if (error) throw error;
        match.exact.email = pending.email;
      }
      if (!match.exact.telefonnummer && pending.telefon) {
        const { error } = await window.supabase
          .from('ansprechpartner')
          .update({ telefonnummer: pending.telefon })
          .eq('id', match.exact.id);
        if (error) throw error;
      }
      return match.exact;
    }
    if (match.similar.length) {
      window.toastSystem?.show('Ähnlicher Name vorhanden, die Person wurde trotzdem angelegt.', 'warning');
    }
    const row = {
      vorname: pending.vorname,
      nachname: pending.nachname,
      email: pending.email,
      management_id: managementId
    };
    if (pending.telefon) row.telefonnummer = pending.telefon;
    const { data, error } = await window.supabase
      .from('ansprechpartner')
      .insert(row)
      .select('id, vorname, nachname, email, telefonnummer, management_id')
      .single();
    if (error) throw error;
    this.vertretungPersonen = [...people, data];
    return data;
  }

  const person = people.find((item) => item.id === this.formData._ansprechpartner_id);
  if (!person) throw new Error('Ansprechpartner nicht gefunden.');
  return person;
};

VertraegeCreate.prototype._linkBetreuung = async function(creatorId, ansprechpartnerId) {
  const { error } = await window.supabase
    .from('creator_ansprechpartner')
    .insert({ creator_id: creatorId, ansprechpartner_id: ansprechpartnerId });
  if (error && !String(error.message || '').toLowerCase().includes('duplicate')) throw error;
};

VertraegeCreate.prototype.ensureManagementVertretung = async function() {
  const typ = this.formData.typ || this.selectedTyp;
  if (!vertretungGiltFuer(typ)) return true;
  this._syncVertretungFromDom();
  if (this.formData._management_anlegen) {
    await this.createVertragManagementFromForm();
  }
  await this.saveVertretungAddress();
  await this.saveVertretungEmail();

  const management = this._selectedManagement();
  const person = readPendingPerson(this.formData);
  const selected = (this.vertretungPersonen || []).find((item) => item.id === this.formData._ansprechpartner_id);
  const gaps = vertretungLuecken({
    managementId: this.formData._management_id,
    address: management,
    ansprechpartnerId: pendingPersonStarted(person) ? null : this.formData._ansprechpartner_id,
    person,
    personHasEmail: selected ? !!String(selected.email || '').trim() : false,
    legacyName: legacyFreitextName(this.formData)
  });
  if (gaps.length) {
    window.toastSystem?.show(gaps[0], 'warning');
    if (this.currentStep !== 2 && typeof this.goToStep === 'function') {
      this._pendingVertretungGaps = gaps;
      this.goToStep(2);
    } else {
      this.showVertretungLuecken(gaps);
    }
    return false;
  }

  if (!this.formData._management_id) {
    this.formData.influencer_agentur_vertreten = false;
    this.formData.influencer_agentur_vertretung = '';
    this.formData._ansprechpartner_id = null;
    return true;
  }

  if (!addressComplete(management)) return false;

  const resolved = await this._resolveVertretungPerson(this.formData._management_id);
  if (this.formData.creator_id) {
    await this._linkCreatorManagement(this.formData.creator_id, this.formData._management_id);
    await this._linkBetreuung(this.formData.creator_id, resolved.id);
  }
  this.formData._ansprechpartner_id = resolved.id;
  this.formData._vertretung_vorname = '';
  this.formData._vertretung_nachname = '';
  this.formData._vertretung_email = '';
  this.formData._vertretung_telefon = '';
  this.formData.influencer_agentur_vertreten = true;
  this.formData.influencer_agentur_name = management.firmenname || '';
  this.formData.influencer_agentur_strasse = management.strasse || '';
  this.formData.influencer_agentur_hausnummer = management.hausnummer || '';
  this.formData.influencer_agentur_plz = management.plz || '';
  this.formData.influencer_agentur_stadt = management.stadt || '';
  this.formData.influencer_agentur_land = management.land || 'Deutschland';
  this.formData.influencer_agentur_vertretung = personLabel(resolved);
  return true;
};
