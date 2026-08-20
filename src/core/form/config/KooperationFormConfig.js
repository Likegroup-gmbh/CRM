// Formular-Konfiguration fuer "kooperation"
// Reine Datendatei, wird von FormConfig.js eingesammelt.

import { CONTENT_ART_OPTIONS } from '../../../modules/kooperation/contentArtOptions.js';
import { KSK_SATZ_PROZENT } from '../../budget/kskSelbstzahler.js';

export const kooperationConfig = {
  title: 'Neue Kooperation anlegen',
  fields: [
    // Sektion 1: Zuordnung
    { name: 'unternehmen_id', label: 'Unternehmen', type: 'select', required: true, options: [], dynamic: true, searchable: true, placeholder: 'Unternehmen suchen und auswählen...', section: 'zuordnung', sectionTitle: 'Zuordnung' },
    { name: 'marke_id', label: 'Marke', type: 'select', required: false, options: [], dynamic: true, searchable: true, placeholder: 'Marke auswählen (optional)...', dependsOn: 'unternehmen_id', section: 'zuordnung' },
    { name: 'kampagne_id', label: 'Kampagne', type: 'select', required: true, options: [], dynamic: true, searchable: true, placeholder: 'Kampagne suchen und auswählen...', dependsOn: 'unternehmen_id', section: 'zuordnung' },
    { name: 'briefing_id', label: 'Briefing', type: 'select', required: false, options: [], dynamic: true, searchable: true, placeholder: 'Briefing wählen...', dependsOn: 'kampagne_id', table: 'campaign_briefings', displayField: 'aktivierung_name', valueField: 'id', section: 'zuordnung' },
    { name: 'creator_id', label: 'Creator', type: 'select', required: true, options: [], dynamic: true, searchable: true, placeholder: 'Creator suchen und auswählen...', dependsOn: 'kampagne_id', section: 'zuordnung' },
    { name: 'name', label: 'Name', type: 'text', required: true, validation: { type: 'text', minLength: 2 }, autoGenerate: true, readonly: true, placeholder: 'Wird automatisch generiert...', section: 'zuordnung' },

    // Tags
    { name: 'tags', label: 'Tags', type: 'custom', customType: 'koopTagInput', required: false, max: 7, section: 'zuordnung' },

    // Sektion 2: Content
    { name: 'videoanzahl', label: 'Video Anzahl', type: 'number', required: false, validation: { type: 'number', min: 1 }, section: 'content', sectionTitle: 'Content' },
    { name: 'videos', label: 'Videos', type: 'custom', customType: 'videos', options: CONTENT_ART_OPTIONS, section: 'content' },

    // Sektion 3: Preise -- Einkauf
    { name: 'einkaufspreis_netto', label: 'EK Netto', type: 'number', required: false, validation: { type: 'number', min: 0 }, readonly: true, placeholder: 'Aus Videos', row: 'ek1', colSize: 'grow', section: 'preise', sectionTitle: 'Preise' },
    { name: 'einkaufspreis_zusatzkosten', label: 'EK Zusatzkosten', type: 'number', required: false, validation: { type: 'number', min: 0 }, row: 'ek1', colSize: 'grow', section: 'preise' },
    { name: 'einkaufspreis_ust_prozent', type: 'hidden', defaultValue: 19, section: 'preise' },
    // KSK-Selbstzahler: Aufschlag (KSK_SATZ_PROZENT vom EK-Netto), wird dem Creator on top gezahlt
    { name: 'ksk_selbstzahler', label: 'Creator zahlt KSK selbst', type: 'toggle', required: false, defaultValue: false, section: 'preise' },
    { name: 'ksk_prozent', type: 'hidden', defaultValue: KSK_SATZ_PROZENT, section: 'preise' },
    { name: 'ksk_betrag', label: `KSK-Aufschlag (${String(KSK_SATZ_PROZENT).replace('.', ',')}%)`, type: 'number', required: false, validation: { type: 'number', min: 0 }, readonly: true, calculatedFrom: ['einkaufspreis_netto', 'ksk_selbstzahler', 'ksk_prozent'], dependsOn: 'ksk_selbstzahler', showWhen: 'true', section: 'preise' },
    { name: 'einkaufspreis_ust', label: 'EK USt (19%)', type: 'number', required: false, validation: { type: 'number', min: 0 }, readonly: true, calculatedFrom: ['einkaufspreis_netto', 'einkaufspreis_zusatzkosten', 'einkaufspreis_ust_prozent'], row: 'ek2', colSize: 'grow', section: 'preise' },
    { name: 'einkaufspreis_gesamt', label: 'EK Gesamt', type: 'number', required: false, validation: { type: 'number', min: 0 }, readonly: true, calculatedFrom: ['einkaufspreis_netto', 'einkaufspreis_zusatzkosten', 'einkaufspreis_ust'], row: 'ek2', colSize: 'grow', section: 'preise' },
    // Sektion 3: Preise -- Verkauf
    { name: 'verkaufspreis_netto', label: 'VK Netto', type: 'number', required: false, validation: { type: 'number', min: 0 }, readonly: true, placeholder: 'Aus Videos', row: 'vk1', colSize: 'grow', section: 'preise' },
    { name: 'verkaufspreis_zusatzkosten', label: 'VK Zusatzkosten', type: 'number', required: false, validation: { type: 'number', min: 0 }, row: 'vk1', colSize: 'grow', section: 'preise' },
    { name: 'verkaufspreis_ust', label: 'VK USt (19%)', type: 'number', required: false, validation: { type: 'number', min: 0 }, readonly: true, calculatedFrom: ['verkaufspreis_netto', 'verkaufspreis_zusatzkosten'], row: 'vk2', colSize: 'grow', section: 'preise' },
    { name: 'verkaufspreis_gesamt', label: 'VK Gesamt', type: 'number', required: false, validation: { type: 'number', min: 0 }, readonly: true, calculatedFrom: ['verkaufspreis_netto', 'verkaufspreis_zusatzkosten', 'verkaufspreis_ust'], row: 'vk2', colSize: 'grow', section: 'preise' }
    // Deadlines wurden auf Video-Ebene verschoben (kooperation_videos.skript_deadline / content_deadline)
  ]
};
