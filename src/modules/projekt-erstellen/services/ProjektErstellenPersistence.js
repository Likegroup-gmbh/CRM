// ProjektErstellenPersistence.js
// Insert fuer auftrag + auftrag_details + kampagne beim Submit.

import { generatePoNummer } from '../../auftrag/logic/PoNummerGenerator.js';
import { getCurrentBenutzerId } from '../../auth/CurrentUser.js';
import { CAMPAIGN_TYPES } from '../constants.js';
import {
  aggregateCampaignBlocksForLegacy,
  CHIP_PREFIX_MAP,
  CHIPS_WITHOUT_LEGACY_COLUMNS,
  DEFAULT_CAMPAIGN_BLOCK_STATUS,
  getCampaignTypesFromBlocks,
  mapBudgetsToDbColumns,
  normalizeCampaignBlocks
} from '../logic/CampaignBudgetFields.js';
import {
  allocateCreatorBudgets,
  flattenCampaignBlocks,
  kampagneDisplayName,
  normalizeKampagnenSlots
} from '../logic/kampagnenSplit.js';
import { uploadAuftragsbestaetigungen } from '../../../core/AuftragsbestaetigungUploader.js';

const SUPABASE = () => window.supabase;

export class ProjektErstellenPersistence {
  normalizeTextValue(value) {
    if (value == null) return null;
    const normalized = String(value).trim();
    return normalized || null;
  }

  parseCount(value) {
    if (value === '' || value == null) return null;
    const n = parseInt(value, 10);
    return Number.isFinite(n) ? n : null;
  }

  parseMoney(value) {
    if (value === '' || value == null) return 0;
    const n = parseFloat(value);
    return Number.isFinite(n) ? n : 0;
  }

  roundMoney(value) {
    return Math.round((this.parseMoney(value) + Number.EPSILON) * 100) / 100;
  }

  calculateAgencyDeductions(details = {}) {
    if (!details.agency_services_enabled) {
      return {
        extraServicesTotal: 0,
        agencyFee: 0,
        ksk: 0,
        total: 0
      };
    }

    const extraServicesTotal = details.extra_services_enabled && Array.isArray(details.extra_services)
      ? details.extra_services.reduce((sum, item) => sum + this.parseMoney(item?.amount), 0)
      : 0;
    const agencyFee = details.percentage_fee_enabled ? this.parseMoney(details.percentage_fee_value) : 0;
    const ksk = details.ksk_enabled ? this.parseMoney(details.ksk_value) : 0;
    const total = extraServicesTotal + agencyFee + ksk;

    return {
      extraServicesTotal: this.roundMoney(extraServicesTotal),
      agencyFee: this.roundMoney(agencyFee),
      ksk: this.roundMoney(ksk),
      total: this.roundMoney(total)
    };
  }

  calculateCreatorBudget(fd) {
    const netto = fd?.auftrag?.nettobetrag;
    if (netto === '' || netto == null) return null;

    const deductions = this.calculateAgencyDeductions(fd?.details || {});
    return this.roundMoney(Math.max(0, this.parseMoney(netto) - deductions.total));
  }

  calculateCampaignTotals(campaignBudgets = {}, activeChips = []) {
    return (activeChips || []).reduce((sum, chipValue) => {
      const values = campaignBudgets?.[chipValue] || {};
      sum.videos += this.parseCount(values.video_anzahl) || 0;
      sum.creators += this.parseCount(values.creator_anzahl) || 0;
      return sum;
    }, { videos: 0, creators: 0 });
  }

  calculateCampaignBlockTotals(blocks = []) {
    return (blocks || []).reduce((sum, block) => {
      sum.videos += this.parseCount(block.video_anzahl) || 0;
      sum.creators += this.parseCount(block.creator_anzahl) || 0;
      return sum;
    }, { videos: 0, creators: 0 });
  }

  mapCountsToKampagneColumns(campaignBudgets = {}, activeChips = []) {
    const payload = {};
    const active = new Set(activeChips || []);

    Object.entries(CHIP_PREFIX_MAP).forEach(([chipValue, prefix]) => {
      if (CHIPS_WITHOUT_LEGACY_COLUMNS.has(chipValue)) return;

      const values = active.has(chipValue) ? (campaignBudgets?.[chipValue] || {}) : {};
      payload[`${prefix}_video_anzahl`] = active.has(chipValue) ? this.parseCount(values.video_anzahl) : null;
      payload[`${prefix}_creator_anzahl`] = active.has(chipValue) ? this.parseCount(values.creator_anzahl) : null;
    });

    return payload;
  }

  buildAuftragPayload(fd) {
    const a = fd.auftrag || {};
    const d = fd.details || {};
    const creatorBudget = this.calculateCreatorBudget(fd);
    const isContracting = a.auftragtype === 'Contracting';

    const payload = {
      unternehmen_id: a.unternehmen_id || null,
      marke_id: a.marke_id || null,
      ansprechpartner_id: a.ansprechpartner_id || null,
      auftragtype: a.auftragtype || null,
      start: a.start || null,
      ende: a.ende || null,
      titel: a.titel || null,
      titel_manuell_geaendert: !!a.titel_manuell_geaendert,
      auftragsname: a.titel || null,
      angebotsnummer: this.normalizeTextValue(a.angebotsnummer),
      re_nr: this.normalizeTextValue(a.re_nr),
      externe_po: this.normalizeTextValue(a.externe_po),
      zahlungsziel_tage: a.zahlungsziel_tage ?? null,
      re_faelligkeit: a.re_faelligkeit || null,
      erwarteter_monat_zahlungseingang: a.erwarteter_monat_zahlungseingang || null,
      rechnung_gestellt: !!a.rechnung_gestellt,
      rechnung_gestellt_am: a.rechnung_gestellt_am || null,
      nettobetrag: a.nettobetrag ?? null,
      creator_budget: creatorBudget,
      ust_prozent: a.ust_prozent ?? null,
      ust_betrag: a.ust_betrag ?? null,
      bruttobetrag: a.bruttobetrag ?? null,
      anzahl_teilrechnungen: a.anzahl_teilrechnungen ?? null,
      kampagnenanzahl: a.kampagnenanzahl ?? (Array.isArray(fd.kampagnen) && fd.kampagnen.length > 0 ? fd.kampagnen.length : 1),
      is_draft: false,
      status: 'Beauftragt'
    };

    if (isContracting) {
      payload.agency_services_enabled = !!d.agency_services_enabled;
      payload.percentage_fee_enabled = !!d.percentage_fee_enabled;
      payload.percentage_fee_value = d.percentage_fee_enabled ? (d.percentage_fee_value ?? 0) : 0;
      payload.ksk_enabled = !!d.ksk_enabled;
      payload.ksk_value = d.ksk_enabled ? (d.ksk_value ?? 0) : 0;
    }

    return payload;
  }

  _slotCampaignBlocks(fd, slot) {
    const slotBlocks = Array.isArray(slot?.campaign_blocks) ? slot.campaign_blocks : [];
    const anySlotBlocks = Array.isArray(fd?.kampagnen)
      && fd.kampagnen.some(item => (item?.campaign_blocks || []).length > 0);
    if (slotBlocks.length > 0) {
      return normalizeCampaignBlocks({ campaign_blocks: slotBlocks });
    }
    if (anySlotBlocks) return [];
    return normalizeCampaignBlocks(fd?.details || {});
  }

  buildDetailsPayload(fd) {
    const d = fd.details || {};
    const blocks = flattenCampaignBlocks(fd);
    const campaignTypes = getCampaignTypesFromBlocks(blocks);
    const uniqueCampaignTypes = getCampaignTypesFromBlocks(blocks, { unique: true });
    const aggregatedBudgets = aggregateCampaignBlocksForLegacy(blocks);
    const budgetColumns = mapBudgetsToDbColumns(aggregatedBudgets, uniqueCampaignTypes);
    const totals = this.calculateCampaignBlockTotals(blocks);

    return {
      campaign_type: campaignTypes,
      gesamt_videos: totals.videos,
      gesamt_creator: totals.creators,
      agency_services_enabled: !!d.agency_services_enabled,
      retainer_type: d.retainer_type || 'none',
      retainer_amount: d.retainer_amount ?? 0,
      extra_services: d.extra_services_enabled && Array.isArray(d.extra_services) ? d.extra_services : [],
      percentage_fee_enabled: !!d.percentage_fee_enabled,
      percentage_fee_value: d.percentage_fee_value ?? 0,
      percentage_fee_base: d.percentage_fee_base || 'total_budget',
      ksk_enabled: !!d.ksk_enabled,
      ksk_type: d.ksk_type || 'fixed',
      ksk_value: d.ksk_value ?? 0,
      ...budgetColumns
    };
  }

  buildKampagnePayload(fd, slot = null, { includePrefixColumns = true, creatorBudget = null, slotCount = null } = {}) {
    const a = fd.auftrag || {};
    const blocks = this._slotCampaignBlocks(fd, slot);
    const campaignTypes = getCampaignTypesFromBlocks(blocks);
    const uniqueCampaignTypes = getCampaignTypesFromBlocks(blocks, { unique: true });
    const aggregatedBudgets = aggregateCampaignBlocksForLegacy(blocks);
    const totals = this.calculateCampaignBlockTotals(blocks);
    const artDerKampagne = campaignTypes.map(v => CAMPAIGN_TYPES.find(t => t.value === v)?.label || v);
    const count = slotCount || (Array.isArray(fd.kampagnen) && fd.kampagnen.length > 0 ? fd.kampagnen.length : 1);
    const index = slot ? Math.max(0, (slot.kampagnen_nummer || 1) - 1) : 0;
    const hasSlotBlocks = Array.isArray(slot?.campaign_blocks) && slot.campaign_blocks.length > 0;
    const videoanzahl = hasSlotBlocks
      ? totals.videos
      : (slot?.videoanzahl != null ? this.parseCount(slot.videoanzahl) : totals.videos);
    const creatoranzahl = hasSlotBlocks
      ? totals.creators
      : (slot?.creatoranzahl != null ? this.parseCount(slot.creatoranzahl) : totals.creators);
    const volumen = slot?.volumen != null ? this.roundMoney(slot.volumen) : this.roundMoney(a.nettobetrag);
    const payload = {
      kampagnenname: kampagneDisplayName(a.titel, index, count),
      eigener_name: typeof slot?.eigener_name === 'string' ? (slot.eigener_name.trim() || null) : null,
      unternehmen_id: a.unternehmen_id || null,
      marke_id: a.marke_id || null,
      art_der_kampagne: artDerKampagne,
      start: a.start || null,
      deadline: a.ende || null,
      deadline_post_produktion: a.ende || null,
      kampagnen_nummer: slot?.kampagnen_nummer || 1,
      creatoranzahl,
      videoanzahl,
      volumen,
      creator_budget: creatorBudget != null ? this.roundMoney(creatorBudget) : volumen,
      budget_info: null
    };
    if (includePrefixColumns) {
      Object.assign(payload, this.mapCountsToKampagneColumns(aggregatedBudgets, uniqueCampaignTypes));
    }
    return payload;
  }

  _asSingleKampagne(formData) {
    const blocks = flattenCampaignBlocks(formData);
    const slots = normalizeKampagnenSlots(formData);
    const first = slots[0] || {};
    return {
      ...formData,
      auftrag: { ...(formData.auftrag || {}), kampagnenanzahl: 1 },
      kampagnen: [{
        ...first,
        kampagnen_nummer: 1,
        volumen: this.roundMoney(formData?.auftrag?.nettobetrag),
        eigener_name: first.eigener_name,
        campaign_blocks: blocks
      }]
    };
  }

  _resolveKampagnenSlots(formData, { kampagneId = null, existingKampagnen = [] } = {}) {
    const slots = normalizeKampagnenSlots(formData);
    slots.forEach((slot, i) => {
      if (slot.id) return;
      slot.id = existingKampagnen[i]?.id || (i === 0 ? kampagneId : null) || null;
    });
    return slots;
  }

  async _insertKampagne(supabase, payload) {
    const { data, error } = await supabase
      .from('kampagne')
      .insert(payload)
      .select('id')
      .single();
    if (error) throw error;
    return data?.id || null;
  }

  async _syncAnsprechpartner(supabase, kampagneIds, ansprechpartnerId, { deleteFirst = false } = {}) {
    for (const kampagneId of kampagneIds.filter(Boolean)) {
      if (deleteFirst) {
        const { error: delApErr } = await supabase
          .from('ansprechpartner_kampagne')
          .delete()
          .eq('kampagne_id', kampagneId);
        if (delApErr) {
          console.warn('⚠️ ansprechpartner_kampagne delete fehlgeschlagen:', delApErr);
        }
      }
      if (!ansprechpartnerId) continue;
      const { error: insApErr } = await supabase
        .from('ansprechpartner_kampagne')
        .insert({
          kampagne_id: kampagneId,
          ansprechpartner_id: ansprechpartnerId
        });
      if (insApErr) {
        console.warn('⚠️ ansprechpartner_kampagne insert fehlgeschlagen:', insApErr);
      }
    }
  }

  async _deleteUnusedKampagnen(supabase, extraIds) {
    const skipped = [];
    for (const id of extraIds) {
      const { count, error: countErr } = await supabase
        .from('kooperationen')
        .select('id', { count: 'exact', head: true })
        .eq('kampagne_id', id);
      if (countErr) throw countErr;
      if ((count || 0) > 0) {
        skipped.push(id);
        continue;
      }
      const { error: delApErr } = await supabase
        .from('ansprechpartner_kampagne')
        .delete()
        .eq('kampagne_id', id);
      if (delApErr) {
        console.warn('⚠️ ansprechpartner_kampagne delete fehlgeschlagen:', delApErr);
      }
      const { error: delErr } = await supabase
        .from('kampagne')
        .delete()
        .eq('id', id);
      if (delErr) throw delErr;
    }
    return skipped;
  }

  _pickWizardKampagneFields(fullPayload) {
    const campaignColumns = Object.values(CHIP_PREFIX_MAP).flatMap(prefix => [
      `${prefix}_video_anzahl`,
      `${prefix}_creator_anzahl`,
      `${prefix}_bilder_anzahl`,
      `${prefix}_videographen_anzahl`
    ]);
    const WIZARD_OWNED_KEYS = [
      'kampagnenname', 'eigener_name', 'unternehmen_id', 'marke_id', 'art_der_kampagne',
      'start', 'deadline', 'deadline_post_produktion',
      'kampagnen_nummer', 'creatoranzahl', 'videoanzahl',
      'volumen', 'creator_budget',
      ...campaignColumns
    ];
    const patch = {};
    for (const key of WIZARD_OWNED_KEYS) {
      if (key in fullPayload) {
        patch[key] = fullPayload[key];
      }
    }
    return patch;
  }

  async loadCampaignArtIdMap(labels = []) {
    const supabase = SUPABASE();
    const uniqueLabels = Array.from(new Set((labels || []).filter(Boolean)));
    if (!supabase || !uniqueLabels.length) return {};

    const { data, error } = await supabase
      .from('kampagne_art_typen')
      .select('id, name')
      .in('name', uniqueLabels);

    if (error) {
      console.warn('⚠️ Kampagnenart-IDs konnten nicht geladen werden:', error);
      return {};
    }

    return (data || []).reduce((map, row) => {
      if (row?.name && row?.id) map[row.name] = row.id;
      return map;
    }, {});
  }

  buildTeilrechnungPayloads(fd, auftragId) {
    const trs = fd?.auftrag?.teilrechnungen;
    if (!Array.isArray(trs) || trs.length === 0) return [];

    return trs.map((tr, i) => ({
      auftrag_id: auftragId,
      position: tr.position ?? (i + 1),
      nettobetrag: this.roundMoney(tr.nettobetrag),
      ust_prozent: tr.ust_prozent ?? 19,
      ust_betrag: this.roundMoney(tr.ust_betrag),
      bruttobetrag: this.roundMoney(tr.bruttobetrag),
      re_nr: this.normalizeTextValue(tr.re_nr),
      externe_po: this.normalizeTextValue(tr.externe_po),
      rechnung_gestellt: !!tr.rechnung_gestellt,
      rechnung_gestellt_am: tr.rechnung_gestellt_am || null,
      re_faelligkeit: tr.re_faelligkeit || null,
      erwarteter_monat_zahlungseingang: tr.erwarteter_monat_zahlungseingang || null,
      ueberwiesen: !!tr.ueberwiesen,
      ueberwiesen_am: tr.ueberwiesen_am || null,
      notiz: this.normalizeTextValue(tr.notiz)
    }));
  }

  async _saveTeilrechnungen(supabase, formData, auftragId, { deleteFirst = false } = {}) {
    if (deleteFirst) {
      const { error: delErr } = await supabase
        .from('auftrag_teilrechnung')
        .delete()
        .eq('auftrag_id', auftragId);
      if (delErr) throw delErr;
    }

    const payloads = this.buildTeilrechnungPayloads(formData, auftragId);
    if (payloads.length > 0) {
      const { error: trErr } = await supabase
        .from('auftrag_teilrechnung')
        .insert(payloads);
      if (trErr) throw trErr;
    }
  }

  // Contracting hat keine Kampagnenbloecke, aber sehr wohl Agenturleistungen, Fee und KSK.
  // Die Stakeholder-Uebersicht liest diese Werte aus auftrag_details, nicht aus auftrag.
  async _saveContractingDetails(supabase, formData, auftragId, { createdById = null } = {}) {
    const payload = this.buildDetailsPayload(formData);
    payload.auftrag_id = auftragId;
    if (createdById) payload.created_by_id = createdById;

    const { error } = await supabase
      .from('auftrag_details')
      .upsert([payload], { onConflict: 'auftrag_id' });
    if (error) throw error;
  }

  _buildAllCampaignBlockPayloads(formData, { auftragId, kampagneIds = [], createdById, campaignArtIdMap = {} } = {}) {
    const slots = this._resolveKampagnenSlots(formData);
    const anySlotBlocks = slots.some(slot => (slot.campaign_blocks || []).length > 0);
    if (!anySlotBlocks) {
      return this.buildCampaignBlockPayloads(formData, {
        auftragId,
        kampagneId: kampagneIds[0] || null,
        createdById,
        campaignArtIdMap
      });
    }
    return slots.flatMap((slot, i) => this.buildCampaignBlockPayloads(
      { details: { campaign_blocks: slot.campaign_blocks || [] } },
      {
        auftragId,
        kampagneId: kampagneIds[i] || slot.id || null,
        createdById,
        campaignArtIdMap
      }
    ));
  }

  buildCampaignBlockPayloads(fd, { auftragId, kampagneId, createdById, campaignArtIdMap = {} } = {}) {
    const blocks = normalizeCampaignBlocks(fd.details || {});

    return blocks.map((block, index) => {
      const label = CAMPAIGN_TYPES.find(t => t.value === block.campaign_type)?.label || block.campaign_type;
      return {
        auftrag_id: auftragId,
        kampagne_id: kampagneId,
        kampagne_art_id: campaignArtIdMap[label] || null,
        campaign_type: block.campaign_type,
        campaign_type_label: label,
        sort_order: index,
        video_anzahl: this.parseCount(block.video_anzahl),
        creator_anzahl: this.parseCount(block.creator_anzahl),
        einkaufspreis_netto_von: block.einkaufspreis_netto_von ?? null,
        einkaufspreis_netto_bis: block.einkaufspreis_netto_bis ?? null,
        verkaufspreis_netto_von: block.verkaufspreis_netto_von ?? null,
        verkaufspreis_netto_bis: block.verkaufspreis_netto_bis ?? null,
        umsatz_netto: block.umsatz_netto ?? null,
        budget_info: block.budget_info || null,
        status: block.status || DEFAULT_CAMPAIGN_BLOCK_STATUS,
        created_by_id: createdById || null
      };
    });
  }

  async submitContracting({ formData }) {
    const supabase = SUPABASE();
    if (!supabase) return { success: false, error: 'Supabase nicht verfügbar' };

    try {
      const currentBenutzerId = await getCurrentBenutzerId();
      const auftragPayload = this.buildAuftragPayload(formData);
      auftragPayload.created_by_id = currentBenutzerId;

      const unternehmenId = auftragPayload.unternehmen_id;
      if (unternehmenId) {
        const poResult = await generatePoNummer(unternehmenId, {
          gesamtPoNummer: formData?.auftrag?.po_gesamt_nummer ?? null
        });
        if (!poResult.success) return { success: false, error: poResult.error };
        auftragPayload.po = poResult.poNummer;
      }

      const { data: auftragData, error: auftragErr } = await supabase
        .from('auftrag')
        .insert(auftragPayload)
        .select('id')
        .single();
      if (auftragErr) throw auftragErr;

      const auftragId = auftragData.id;

      await this._saveContractingDetails(supabase, formData, auftragId, {
        createdById: currentBenutzerId
      });

      await this._saveTeilrechnungen(supabase, formData, auftragId);

      // Auftragsbestaetigungen nach Dropbox hochladen + DB-Eintraege anlegen
      const uploadResult = await this.uploadAuftragsbestaetigungenIfAny({
        formData,
        auftragId,
        auftragPayload,
        currentBenutzerId
      });

      // Rechnungen nach Dropbox hochladen + DB-Eintraege anlegen
      const rechnungUploadResult = await this.uploadRechnungenIfAny({
        formData,
        auftragId,
        auftragPayload,
        currentBenutzerId
      });

      return {
        success: true,
        auftragId,
        uploadedDocuments: [...uploadResult.successes, ...rechnungUploadResult.successes],
        uploadErrors: [...uploadResult.errors, ...rechnungUploadResult.errors]
      };
    } catch (e) {
      const friendly = this.friendlyError(e, 'Contract konnte nicht angelegt werden');
      console.error('❌ submitContracting Fehler:', {
        message: e?.message, details: e?.details, hint: e?.hint, code: e?.code, raw: e
      });
      return { success: false, error: friendly };
    }
  }

  async uploadAuftragsbestaetigungenIfAny({ formData, auftragId, auftragPayload, currentBenutzerId }) {
    const files = formData?.auftrag?.auftragsbestaetigungen_files;
    if (!Array.isArray(files) || files.length === 0) {
      return { successes: [], errors: [] };
    }

    const supabase = SUPABASE();
    let unternehmenName = '';
    let markeName = '';

    try {
      if (auftragPayload.unternehmen_id) {
        const { data: u } = await supabase
          .from('unternehmen')
          .select('firmenname')
          .eq('id', auftragPayload.unternehmen_id)
          .single();
        unternehmenName = u?.firmenname || '';
      }
      if (auftragPayload.marke_id) {
        const { data: m } = await supabase
          .from('marke')
          .select('markenname')
          .eq('id', auftragPayload.marke_id)
          .single();
        markeName = m?.markenname || '';
      }
    } catch (lookupErr) {
      console.warn('⚠️ Unternehmen/Marke fuer Dropbox-Pfad nicht ermittelbar:', lookupErr);
    }

    return uploadAuftragsbestaetigungen(files, {
      auftragId,
      unternehmen: unternehmenName,
      marke: markeName,
      auftragstitel: auftragPayload.titel || '',
      uploadedById: currentBenutzerId
    });
  }

  async uploadRechnungenIfAny({ formData, auftragId, auftragPayload, currentBenutzerId }) {
    const files = formData?.auftrag?.rechnungen_files;
    if (!Array.isArray(files) || files.length === 0) {
      return { successes: [], errors: [] };
    }

    const supabase = SUPABASE();
    let unternehmenName = '';
    let markeName = '';

    try {
      if (auftragPayload.unternehmen_id) {
        const { data: u } = await supabase
          .from('unternehmen')
          .select('firmenname')
          .eq('id', auftragPayload.unternehmen_id)
          .single();
        unternehmenName = u?.firmenname || '';
      }
      if (auftragPayload.marke_id) {
        const { data: m } = await supabase
          .from('marke')
          .select('markenname')
          .eq('id', auftragPayload.marke_id)
          .single();
        markeName = m?.markenname || '';
      }
    } catch (lookupErr) {
      console.warn('⚠️ Unternehmen/Marke fuer Dropbox-Pfad nicht ermittelbar:', lookupErr);
    }

    return uploadAuftragsbestaetigungen(files, {
      auftragId,
      unternehmen: unternehmenName,
      marke: markeName,
      auftragstitel: auftragPayload.titel || '',
      dokumentTyp: 'rechnung',
      uploadedById: currentBenutzerId
    });
  }

  async submitEdit({ formData, auftragId, kampagneId, existingRaw } = {}) {
    const isContracting = formData.auftrag?.auftragtype === 'Contracting';
    if (isContracting) return this.submitEditContracting({ formData, auftragId, existingRaw });

    const supabase = SUPABASE();
    if (!supabase) return { success: false, error: 'Supabase nicht verfügbar' };
    if (!auftragId) return { success: false, error: 'Auftrag-ID fehlt' };

    try {
      const currentBenutzerId = await getCurrentBenutzerId();

      // 1) Auftrag updaten -- PO bleibt unangetastet (wird beim Anlegen vergeben)
      const auftragPayload = this.buildAuftragPayload(formData);
      delete auftragPayload.po; // PO niemals beim Edit ueberschreiben
      // is_draft + status nur setzen falls noch nicht existiert -- ansonsten bestehende Werte belassen
      if (existingRaw?.auftrag?.status) {
        delete auftragPayload.status;
      }
      if (existingRaw?.auftrag?.is_draft === false) {
        delete auftragPayload.is_draft;
      }

      const { error: auftragErr } = await supabase
        .from('auftrag')
        .update(auftragPayload)
        .eq('id', auftragId);
      if (auftragErr) throw auftragErr;

      // 2) auftrag_details per upsert (onConflict auftrag_id)
      const detailsPayload = this.buildDetailsPayload(formData);
      detailsPayload.auftrag_id = auftragId;
      if (!existingRaw?.details) {
        detailsPayload.created_by_id = currentBenutzerId;
      }

      const { error: detailsErr } = await supabase
        .from('auftrag_details')
        .upsert([detailsPayload], { onConflict: 'auftrag_id' });
      if (detailsErr) throw detailsErr;

      // 3) Kampagnen updaten/anlegen
      const existingKampagnen = existingRaw?.kampagnen
        || (existingRaw?.kampagne ? [existingRaw.kampagne] : []);
      const slots = this._resolveKampagnenSlots(formData, { kampagneId, existingKampagnen });
      const includePrefixColumns = slots.length === 1;
      const auftragCreatorBudget = this.calculateCreatorBudget(formData);
      const creatorBudgets = auftragCreatorBudget == null
        ? slots.map(slot => slot.volumen)
        : allocateCreatorBudgets(slots, auftragCreatorBudget);
      const savedIds = [];

      for (let i = 0; i < slots.length; i++) {
        const slot = slots[i];
        const kampagnePayload = this.buildKampagnePayload(formData, slot, {
          includePrefixColumns,
          creatorBudget: creatorBudgets[i],
          slotCount: slots.length
        });

        if (slot.id) {
          const mergedPayload = this._pickWizardKampagneFields(kampagnePayload);
          const { error: kampagneErr } = await supabase
            .from('kampagne')
            .update(mergedPayload)
            .eq('id', slot.id);
          if (kampagneErr) throw kampagneErr;
          savedIds.push(slot.id);
        } else {
          kampagnePayload.auftrag_id = auftragId;
          const insertedId = await this._insertKampagne(supabase, kampagnePayload);
          savedIds.push(insertedId);
        }
      }

      const savedKampagneId = savedIds[0] || null;
      const keptIds = new Set(savedIds.filter(Boolean));
      const extraIds = existingKampagnen.map(k => k.id).filter(id => id && !keptIds.has(id));
      const skippedKampagnen = extraIds.length > 0
        ? await this._deleteUnusedKampagnen(supabase, extraIds)
        : [];

      // 4) auftrag_kampagnenart_blocks: delete + reinsert
      const { error: deleteBlocksErr } = await supabase
        .from('auftrag_kampagnenart_blocks')
        .delete()
        .eq('auftrag_id', auftragId);
      if (deleteBlocksErr) throw deleteBlocksErr;

      const blockLabels = flattenCampaignBlocks(formData)
        .map(block => CAMPAIGN_TYPES.find(t => t.value === block.campaign_type)?.label || block.campaign_type);
      const campaignArtIdMap = await this.loadCampaignArtIdMap(blockLabels);
      const blockPayloads = this._buildAllCampaignBlockPayloads(formData, {
        auftragId,
        kampagneIds: savedIds,
        createdById: currentBenutzerId,
        campaignArtIdMap
      });

      if (blockPayloads.length > 0) {
        const { error: blocksErr } = await supabase
          .from('auftrag_kampagnenart_blocks')
          .insert(blockPayloads);
        if (blocksErr) throw blocksErr;
      }

      // 5) Teilrechnungen: delete + reinsert
      await this._saveTeilrechnungen(supabase, formData, auftragId, { deleteFirst: true });

      // 6) ansprechpartner_kampagne synchronisieren
      await this._syncAnsprechpartner(supabase, savedIds, auftragPayload.ansprechpartner_id, { deleteFirst: true });

      return { success: true, auftragId, kampagneId: savedKampagneId, skippedKampagnen };
    } catch (e) {
      const friendly = this.friendlyError(e, 'Projekt konnte nicht aktualisiert werden');
      console.error('❌ submitEdit Fehler:', {
        message: e?.message, details: e?.details, hint: e?.hint, code: e?.code, raw: e
      });
      return { success: false, error: friendly };
    }
  }

  async submitEditContracting({ formData, auftragId, existingRaw } = {}) {
    const supabase = SUPABASE();
    if (!supabase) return { success: false, error: 'Supabase nicht verfügbar' };
    if (!auftragId) return { success: false, error: 'Auftrag-ID fehlt' };

    try {
      const auftragPayload = this.buildAuftragPayload(formData);
      delete auftragPayload.po;
      if (existingRaw?.auftrag?.status) {
        delete auftragPayload.status;
      }
      if (existingRaw?.auftrag?.is_draft === false) {
        delete auftragPayload.is_draft;
      }

      const { error: auftragErr } = await supabase
        .from('auftrag')
        .update(auftragPayload)
        .eq('id', auftragId);
      if (auftragErr) throw auftragErr;

      const createdById = existingRaw?.details ? null : await getCurrentBenutzerId();
      await this._saveContractingDetails(supabase, formData, auftragId, { createdById });

      await this._saveTeilrechnungen(supabase, formData, auftragId, { deleteFirst: true });

      return { success: true, auftragId };
    } catch (e) {
      const friendly = this.friendlyError(e, 'Contract konnte nicht aktualisiert werden');
      console.error('❌ submitEditContracting Fehler:', {
        message: e?.message, details: e?.details, hint: e?.hint, code: e?.code, raw: e
      });
      return { success: false, error: friendly };
    }
  }

  async submit({ formData }) {
    const isContracting = formData.auftrag?.auftragtype === 'Contracting';
    if (isContracting) return this.submitContracting({ formData });
    formData = this._asSingleKampagne(formData);

    const supabase = SUPABASE();
    if (!supabase) return { success: false, error: 'Supabase nicht verfügbar' };

    try {
      const currentBenutzerId = await getCurrentBenutzerId();
      const auftragPayload = this.buildAuftragPayload(formData);
      auftragPayload.created_by_id = currentBenutzerId;

      const unternehmenId = auftragPayload.unternehmen_id;
      if (unternehmenId) {
        const poResult = await generatePoNummer(unternehmenId, {
          gesamtPoNummer: formData?.auftrag?.po_gesamt_nummer ?? null
        });
        if (!poResult.success) {
          return { success: false, error: poResult.error };
        }
        auftragPayload.po = poResult.poNummer;
      }

      const { data: auftragData, error: auftragErr } = await supabase
        .from('auftrag')
        .insert(auftragPayload)
        .select('id')
        .single();
      if (auftragErr) throw auftragErr;

      const savedAuftragId = auftragData.id;

      try {
        const detailsPayload = this.buildDetailsPayload(formData);
        detailsPayload.auftrag_id = savedAuftragId;
        detailsPayload.created_by_id = currentBenutzerId;

        const { error: detailsErr } = await supabase
          .from('auftrag_details')
          .insert(detailsPayload);
        if (detailsErr) throw detailsErr;

        const slots = this._resolveKampagnenSlots(formData);
        const includePrefixColumns = slots.length === 1;
        const auftragCreatorBudget = this.calculateCreatorBudget(formData);
        const creatorBudgets = auftragCreatorBudget == null
          ? slots.map(slot => slot.volumen)
          : allocateCreatorBudgets(slots, auftragCreatorBudget);
        const savedIds = [];

        for (let i = 0; i < slots.length; i++) {
          const kampagnePayload = this.buildKampagnePayload(formData, slots[i], {
            includePrefixColumns,
            creatorBudget: creatorBudgets[i],
            slotCount: slots.length
          });
          kampagnePayload.auftrag_id = savedAuftragId;
          const insertedId = await this._insertKampagne(supabase, kampagnePayload);
          savedIds.push(insertedId);
        }

        const savedKampagneId = savedIds[0] || null;

        const blockLabels = flattenCampaignBlocks(formData)
          .map(block => CAMPAIGN_TYPES.find(t => t.value === block.campaign_type)?.label || block.campaign_type);
        const campaignArtIdMap = await this.loadCampaignArtIdMap(blockLabels);
        const blockPayloads = this._buildAllCampaignBlockPayloads(formData, {
          auftragId: savedAuftragId,
          kampagneIds: savedIds,
          createdById: currentBenutzerId,
          campaignArtIdMap
        });

        if (blockPayloads.length > 0) {
          const { error: blocksErr } = await supabase
            .from('auftrag_kampagnenart_blocks')
            .insert(blockPayloads);
          if (blocksErr) throw blocksErr;
        }

        await this._saveTeilrechnungen(supabase, formData, savedAuftragId);

        await this._syncAnsprechpartner(supabase, savedIds, auftragPayload.ansprechpartner_id);

        return { success: true, auftragId: savedAuftragId, kampagneId: savedKampagneId };
      } catch (innerErr) {
        // Rollback: verwaisten Auftrag loeschen
        console.warn('⚠️ Rollback: Auftrag wird geloescht weil Folge-Inserts fehlschlugen', savedAuftragId);
        try { await supabase.from('auftrag').delete().eq('id', savedAuftragId); } catch (_) {}
        throw innerErr;
      }
    } catch (e) {
      const friendly = this.friendlyError(e, 'Projekt konnte nicht angelegt werden');
      console.error('❌ submit Fehler:', {
        message: e?.message,
        details: e?.details,
        hint: e?.hint,
        code: e?.code,
        raw: e
      });
      return { success: false, error: friendly };
    }
  }

  friendlyError(e, fallback) {
    if (e?.code === '23505') {
      return 'Dieser Wert existiert bereits und darf nur einmal vergeben werden.';
    }
    if (e?.code === '23503') {
      return 'Verknüpfter Datensatz nicht gefunden. Bitte Auswahl prüfen.';
    }
    if (e?.code === '23514') {
      return `Ungültiger Wert (${e?.message || e?.details || 'CHECK-Constraint verletzt'}).`;
    }
    return e?.message || e?.details || fallback;
  }
}
