// ActionsDropdownAnsprechpartner.js
// Ansprechpartner zu Marke, Unternehmen oder Kampagne hinzufügen.
// Entfernen aus dem Unternehmen: AnsprechpartnerRemoveModal.js

import { openAssignSearchModal, esc, errorWithMessage } from './AssignSearchModal.js';

const ANSPRECHPARTNER_SELECT = 'id, vorname, nachname, email, unternehmen:unternehmen_id(firmenname), position:position_id(name)';

// entity → Verknüpfungstabelle `ansprechpartner_${entity}`, Spalte `${entity}_id`,
// Event-Key `${entity}Id`. idInfix hält die bestehenden DOM-IDs (CSS hängt daran).
const ENTITIES = {
  marke: { idInfix: '', to: 'zur Marke' },
  unternehmen: { idInfix: '-unternehmen', to: 'zum Unternehmen' },
  kampagne: { idInfix: '-kampagne', to: 'zur Kampagne' }
};

function openAddAnsprechpartnerSearchModal(entity, parentId) {
  const { idInfix, to } = ENTITIES[entity];
  const table = `ansprechpartner_${entity}`;
  const column = `${entity}_id`;
  let excludedIds = [];

  return openAssignSearchModal({
    idPrefix: `add-ansprechpartner${idInfix}`,
    searchId: `ansprechpartner${idInfix}-search`,
    dropdownId: `ansprechpartner${idInfix}-dropdown`,
    title: `Ansprechpartner ${to} hinzufügen`,
    fieldLabel: 'Ansprechpartner wählen',
    placeholder: 'Ansprechpartner suchen...',
    confirmLabel: 'Hinzufügen',
    hint: 'Beginnen Sie zu tippen, um Ansprechpartner zu suchen...',
    emptyText: 'Keine verfügbaren Ansprechpartner gefunden',

    prepare: async () => {
      try {
        const { data: existing } = await window.supabase.from(table).select('ansprechpartner_id').eq(column, parentId);
        excludedIds = (existing || []).map(r => r.ansprechpartner_id).filter(Boolean);
      } catch (error) {
        console.warn('Fehler beim Laden der Ansprechpartner:', error);
      }
    },

    search: async (term) => {
      let query = window.supabase
        .from('ansprechpartner')
        .select(ANSPRECHPARTNER_SELECT)
        .or(`vorname.ilike.%${term}%,nachname.ilike.%${term}%,email.ilike.%${term}%`)
        .order('nachname');
      if (excludedIds.length > 0) query = query.not('id', 'in', `(${excludedIds.join(',')})`);
      const { data } = await query;
      return data || [];
    },

    renderItem: (ap) => {
      const details = [ap.email, ap.unternehmen?.firmenname, ap.position?.name].filter(Boolean).map(esc).join(' • ');
      return `<div class="dropdown-item-main">${esc(ap.vorname)} ${esc(ap.nachname)}</div>${details ? `<div class="dropdown-item-details">${details}</div>` : ''}`;
    },

    onConfirm: async (ansprechpartnerId) => {
      const { error } = await window.supabase.from(table).insert({ [column]: parentId, ansprechpartner_id: ansprechpartnerId });
      if (error) throw error;
      window.dispatchEvent(new CustomEvent('entityUpdated', { detail: { entity: 'ansprechpartner', action: 'added', [`${entity}Id`]: parentId } }));
      window.dispatchEvent(new CustomEvent('entityUpdated', { detail: { entity, action: 'ansprechpartner-added', id: parentId } }));
    },
    successAlert: `Ansprechpartner wurde erfolgreich ${to} hinzugefügt und wird automatisch angezeigt!`,
    errorAlert: errorWithMessage
  });
}

export async function openAddAnsprechpartnerModal(dropdown, markeId) {
  return openAddAnsprechpartnerSearchModal('marke', markeId);
}

export async function openAddAnsprechpartnerToUnternehmenModal(dropdown, unternehmenId) {
  return openAddAnsprechpartnerSearchModal('unternehmen', unternehmenId);
}

export async function openAddAnsprechpartnerToKampagneModal(dropdown, kampagneId) {
  return openAddAnsprechpartnerSearchModal('kampagne', kampagneId);
}
