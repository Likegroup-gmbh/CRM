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
      rechnung_gestellt: !!a.rechnung_gestellt,
      rechnung_gestellt_am: a.rechnung_gestellt_am || null,
      erwarteter_monat_zahlungseingang: a.erwarteter_monat_zahlungseingang || null,
      nettobetrag: a.nettobetrag ?? null,
      creator_budget: creatorBudget,
      ust_prozent: a.ust_prozent ?? null,
      ust_betrag: a.ust_betrag ?? null,
      bruttobetrag: a.bruttobetrag ?? null,
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

  buildDetailsPayload(fd) {
    const d = fd.details || {};
    const blocks = normalizeCampaignBlocks(d);
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

  buildKampagnePayload(fd) {
    const k = fd.kampagne || {};
    const d = fd.details || {};
    const a = fd.auftrag || {};
    const blocks = normalizeCampaignBlocks(d);
    const campaignTypes = getCampaignTypesFromBlocks(blocks);
    const uniqueCampaignTypes = getCampaignTypesFromBlocks(blocks, { unique: true });
    const aggregatedBudgets = aggregateCampaignBlocksForLegacy(blocks);
    const totals = this.calculateCampaignBlockTotals(blocks);
    const artDerKampagne = campaignTypes.map(v => CAMPAIGN_TYPES.find(t => t.value === v)?.label || v);
    return {
      kampagnenname: k.kampagnenname || a.titel || null,
      eigener_name: null,
      unternehmen_id: a.unternehmen_id || null,
      marke_id: a.marke_id || null,
      art_der_kampagne: artDerKampagne,
      start: a.start || null,
      deadline: a.ende || null,
      deadline_post_produktion: a.ende || null,
      creatoranzahl: totals.creators,
      videoanzahl: totals.videos,
      ...this.mapCountsToKampagneColumns(aggregatedBudgets, uniqueCampaignTypes),
      budget_info: null
    };
  }

  _pickWizardKampagneFields(fullPayload) {
    const campaignColumns = Object.values(CHIP_PREFIX_MAP).flatMap(prefix => [
      `${prefix}_video_anzahl`,
      `${prefix}_creator_anzahl`,
      `${prefix}_bilder_anzahl`,
      `${prefix}_videographen_anzahl`
    ]);
    const WIZARD_OWNED_KEYS = [
      'kampagnenname', 'unternehmen_id', 'marke_id', 'art_der_kampagne',
      'start', 'deadline', 'deadline_post_produktion',
      'creatoranzahl', 'videoanzahl',
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
        const poResult = await generatePoNummer(unternehmenId);
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

      // 3) Kampagne updaten oder neu anlegen – beim Update nur Wizard-Felder patchen
      const kampagnePayload = this.buildKampagnePayload(formData);
      let savedKampagneId = kampagneId || null;

      if (savedKampagneId) {
        const mergedPayload = this._pickWizardKampagneFields(kampagnePayload);
        const { error: kampagneErr } = await supabase
          .from('kampagne')
          .update(mergedPayload)
          .eq('id', savedKampagneId);
        if (kampagneErr) throw kampagneErr;
      } else {
        kampagnePayload.auftrag_id = auftragId;
        const { data: kampagneData, error: kampagneErr } = await supabase
          .from('kampagne')
          .insert(kampagnePayload)
          .select('id')
          .single();
        if (kampagneErr) throw kampagneErr;
        savedKampagneId = kampagneData?.id || null;
      }

      // 4) auftrag_kampagnenart_blocks: delete + reinsert
      const { error: deleteBlocksErr } = await supabase
        .from('auftrag_kampagnenart_blocks')
        .delete()
        .eq('auftrag_id', auftragId);
      if (deleteBlocksErr) throw deleteBlocksErr;

      const blockLabels = normalizeCampaignBlocks(formData.details || {})
        .map(block => CAMPAIGN_TYPES.find(t => t.value === block.campaign_type)?.label || block.campaign_type);
      const campaignArtIdMap = await this.loadCampaignArtIdMap(blockLabels);
      const blockPayloads = this.buildCampaignBlockPayloads(formData, {
        auftragId,
        kampagneId: savedKampagneId,
        createdById: currentBenutzerId,
        campaignArtIdMap
      });

      if (blockPayloads.length > 0) {
        const { error: blocksErr } = await supabase
          .from('auftrag_kampagnenart_blocks')
          .insert(blockPayloads);
        if (blocksErr) throw blocksErr;
      }

      // 5) ansprechpartner_kampagne synchronisieren
      const ansprechpartnerId = auftragPayload.ansprechpartner_id;
      if (savedKampagneId) {
        const { error: delApErr } = await supabase
          .from('ansprechpartner_kampagne')
          .delete()
          .eq('kampagne_id', savedKampagneId);
        if (delApErr) {
          console.warn('⚠️ ansprechpartner_kampagne delete fehlgeschlagen:', delApErr);
        }

        if (ansprechpartnerId) {
          const { error: insApErr } = await supabase
            .from('ansprechpartner_kampagne')
            .insert({
              kampagne_id: savedKampagneId,
              ansprechpartner_id: ansprechpartnerId
            });
          if (insApErr) {
            console.warn('⚠️ ansprechpartner_kampagne insert fehlgeschlagen:', insApErr);
          }
        }
      }

      return { success: true, auftragId, kampagneId: savedKampagneId };
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

    const supabase = SUPABASE();
    if (!supabase) return { success: false, error: 'Supabase nicht verfügbar' };

    try {
      const currentBenutzerId = await getCurrentBenutzerId();
      const auftragPayload = this.buildAuftragPayload(formData);
      auftragPayload.created_by_id = currentBenutzerId;

      const unternehmenId = auftragPayload.unternehmen_id;
      if (unternehmenId) {
        const poResult = await generatePoNummer(unternehmenId);
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

        const kampagnePayload = this.buildKampagnePayload(formData);
        kampagnePayload.auftrag_id = savedAuftragId;

        const { data: kampagneData, error: kampagneErr } = await supabase
          .from('kampagne')
          .insert(kampagnePayload)
          .select('id')
          .single();
        if (kampagneErr) throw kampagneErr;

        const savedKampagneId = kampagneData.id;

        const blockLabels = normalizeCampaignBlocks(formData.details || {})
          .map(block => CAMPAIGN_TYPES.find(t => t.value === block.campaign_type)?.label || block.campaign_type);
        const campaignArtIdMap = await this.loadCampaignArtIdMap(blockLabels);
        const blockPayloads = this.buildCampaignBlockPayloads(formData, {
          auftragId: savedAuftragId,
          kampagneId: savedKampagneId,
          createdById: currentBenutzerId,
          campaignArtIdMap
        });

        if (blockPayloads.length > 0) {
          const { error: blocksErr } = await supabase
            .from('auftrag_kampagnenart_blocks')
            .insert(blockPayloads);
          if (blocksErr) throw blocksErr;
        }

        const ansprechpartnerId = auftragPayload.ansprechpartner_id;
        if (ansprechpartnerId) {
          const { error: ansprechpartnerErr } = await supabase
            .from('ansprechpartner_kampagne')
            .insert({
              kampagne_id: savedKampagneId,
              ansprechpartner_id: ansprechpartnerId
            });
          if (ansprechpartnerErr) throw ansprechpartnerErr;
        }

        return { success: true, auftragId: savedAuftragId, kampagneId: savedKampagneId };
      } catch (innerErr) {
        // Rollback: verwaisten Auftrag loeschen
        console.warn('⚠️ Rollback: Auftrag wird geloescht weil Folge-Inserts fehlschlugen', savedAuftragId);
        await supabase.from('auftrag').delete().eq('id', savedAuftragId).catch(() => {});
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
