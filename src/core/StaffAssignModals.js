// StaffAssignModals.js
// Mitarbeiter einer Kampagne bzw. einer Marke zuordnen.

import { openAssignSearchModal, esc, errorWithMessage } from './AssignSearchModal.js';

const STAFF_SELECT = 'id, name, rolle, mitarbeiter_klasse:mitarbeiter_klasse_id(name)';

function staffQuery() {
  return window.supabase
    .from('benutzer')
    .select(STAFF_SELECT)
    .neq('rolle', 'kunde')
    .neq('rolle', 'gast');
}

export async function openAssignStaffModal(dropdown, kampagneId) {
  return openAssignSearchModal({
    idPrefix: 'assign-staff',
    searchId: 'staff-search',
    dropdownId: 'staff-dropdown',
    title: 'Mitarbeiter zuordnen',
    fieldLabel: 'Mitarbeiter wählen',
    placeholder: 'Mitarbeiter suchen...',
    confirmLabel: 'Zuordnen',
    emptyText: 'Keine Mitarbeiter gefunden',
    inlineDropdown: true,

    search: async (term) => {
      let assignedIds = [];
      try {
        const { data: assigned } = await window.supabase.from('kampagne_mitarbeiter').select('mitarbeiter_id').eq('kampagne_id', kampagneId);
        assignedIds = (assigned || []).map(r => r.mitarbeiter_id);
      } catch {}
      let query = staffQuery().order('name');
      if (term) query = query.ilike('name', `%${term}%`);
      if (assignedIds.length > 0) query = query.not('id', 'in', `(${assignedIds.join(',')})`);
      const { data } = await query;
      return data || [];
    },

    renderItem: (u) => `${esc(u.name)}${u.mitarbeiter_klasse?.name ? ` <span class="muted">(${esc(u.mitarbeiter_klasse.name)})</span>` : ''}${u.rolle ? ` <span class="muted">[${esc(u.rolle)}]</span>` : ''}`,

    onConfirm: async (mitarbeiterId) => {
      const { error } = await window.supabase.from('kampagne_mitarbeiter').insert({ kampagne_id: kampagneId, mitarbeiter_id: mitarbeiterId, role: 'projektmanager' });
      if (error) throw error;
      window.dispatchEvent(new CustomEvent('entityUpdated', { detail: { entity: 'kampagne', action: 'staff-assigned', id: kampagneId } }));
    },
    successAlert: 'Mitarbeiter zugeordnet.',
    errorAlert: 'Zuordnung fehlgeschlagen.'
  });
}

export async function openAssignMarkeStaffModal(dropdown, markeId) {
  let excludedIds = [];

  return openAssignSearchModal({
    idPrefix: 'add-mitarbeiter',
    searchId: 'mitarbeiter-search',
    dropdownId: 'mitarbeiter-dropdown',
    title: 'Mitarbeiter zur Marke hinzufügen',
    fieldLabel: 'Mitarbeiter wählen',
    placeholder: 'Mitarbeiter suchen...',
    confirmLabel: 'Hinzufügen',
    hint: 'Beginnen Sie zu tippen, um Mitarbeiter zu suchen...',
    emptyText: 'Keine verfügbaren Mitarbeiter gefunden',

    prepare: async () => {
      try {
        const { data: existing } = await window.supabase.from('marke_mitarbeiter').select('mitarbeiter_id').eq('marke_id', markeId);
        excludedIds = (existing || []).map(r => r.mitarbeiter_id).filter(Boolean);
      } catch (error) {
        console.warn('Fehler beim Laden der Mitarbeiter:', error);
      }
    },

    search: async (term) => {
      let query = staffQuery().or(`name.ilike.%${term}%,rolle.ilike.%${term}%`).order('name');
      if (excludedIds.length > 0) query = query.not('id', 'in', `(${excludedIds.join(',')})`);
      const { data } = await query;
      return data || [];
    },

    renderItem: (m) => {
      const details = [m.rolle, m.mitarbeiter_klasse?.name].filter(Boolean).map(esc).join(' • ');
      return `<div class="dropdown-item-main">${esc(m.name)}</div>${details ? `<div class="dropdown-item-details">${details}</div>` : ''}`;
    },

    onConfirm: async (mitarbeiterId) => {
      const { error } = await window.supabase.from('marke_mitarbeiter').insert({ marke_id: markeId, mitarbeiter_id: mitarbeiterId, assigned_by: window.currentUser?.id || null });
      if (error) throw error;
      window.dispatchEvent(new CustomEvent('entityUpdated', { detail: { entity: 'mitarbeiter', action: 'added', markeId } }));
      window.dispatchEvent(new CustomEvent('entityUpdated', { detail: { entity: 'marke', action: 'mitarbeiter-added', id: markeId } }));
    },
    successAlert: 'Mitarbeiter wurde erfolgreich zur Marke hinzugefügt und wird automatisch angezeigt!',
    errorAlert: errorWithMessage
  });
}
