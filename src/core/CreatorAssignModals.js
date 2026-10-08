// CreatorAssignModals.js
// Creator einer Kampagne (Casting) bzw. einer Creator-Liste zuordnen.

import { KampagneUtils } from '../modules/kampagne/KampagneUtils.js';
import { openAssignSearchModal, esc } from './AssignSearchModal.js';

export async function openAddToCampaignModal(dropdown, creatorId) {
  let excludedCampaignIds = [];
  let allowedCampaignIds = null;

  return openAssignSearchModal({
    idPrefix: 'add-to-campaign',
    searchId: 'campaign-search',
    dropdownId: 'campaign-dropdown',
    title: 'Zu Kampagne hinzufügen',
    fieldLabel: 'Kampagne wählen',
    placeholder: 'Kampagne suchen...',
    confirmLabel: 'Hinzufügen',
    emptyText: 'Keine Kampagne gefunden',

    prepare: async () => {
      try {
        const [finalRes, sourcingRes] = await Promise.all([
          window.supabase.from('kampagne_creator').select('kampagne_id').eq('creator_id', creatorId),
          window.supabase.from('kampagne_creator_sourcing').select('kampagne_id').eq('creator_id', creatorId)
        ]);
        const finalIds = (finalRes?.data || []).map(r => r.kampagne_id).filter(Boolean);
        const sourcingIds = (sourcingRes?.data || []).map(r => r.kampagne_id).filter(Boolean);
        excludedCampaignIds = Array.from(new Set([...finalIds, ...sourcingIds]));

        if (!window.isAdmin()) {
          const { data: assignedK } = await window.supabase.from('kampagne_mitarbeiter').select('kampagne_id').eq('mitarbeiter_id', window.currentUser?.id);
          allowedCampaignIds = (assignedK || []).map(r => r.kampagne_id).filter(Boolean);
        }
      } catch {}
    },

    search: async (term) => {
      if (Array.isArray(allowedCampaignIds) && allowedCampaignIds.length === 0) return [];
      let query = window.supabase.from('kampagne').select('id, kampagnenname, eigener_name, status').order('created_at', { ascending: false });
      if (term.length > 0) query = query.ilike('kampagnenname', `%${term}%`);
      if (Array.isArray(allowedCampaignIds)) query = query.in('id', allowedCampaignIds);
      if (excludedCampaignIds.length > 0) query = query.not('id', 'in', `(${excludedCampaignIds.join(',')})`);
      const { data } = await query;
      const f = term.toLowerCase();
      return (data || []).filter(k => KampagneUtils.getDisplayName(k).toLowerCase().includes(f));
    },

    renderItem: (k) => esc(KampagneUtils.getDisplayName(k)),

    onConfirm: async (kampagneId) => {
      await window.supabase.from('kampagne_creator_sourcing').insert({ kampagne_id: kampagneId, creator_id: creatorId });
      window.dispatchEvent(new CustomEvent('entityUpdated', { detail: { entity: 'kampagne', action: 'sourcing-added', id: kampagneId } }));
    },
    successAlert: 'Creator wurde zum Casting der Kampagne hinzugefügt.',
    errorAlert: 'Hinzufügen fehlgeschlagen.'
  });
}

export async function openAddToListModal(dropdown, creatorId) {
  let listen = [];

  return openAssignSearchModal({
    idPrefix: 'add-to-list',
    searchId: 'list-search',
    dropdownId: 'list-dropdown',
    title: 'Zu Liste hinzufügen',
    fieldLabel: 'Liste wählen',
    placeholder: 'Liste suchen...',
    confirmLabel: 'Hinzufügen',
    emptyText: 'Keine Liste gefunden',

    prepare: async () => {
      try {
        const { data: existing } = await window.supabase.from('creator_list_member').select('list_id').eq('creator_id', creatorId);
        const excludedListIds = (existing || []).map(r => r.list_id).filter(Boolean);
        const { data } = await window.supabase.from('creator_list').select('id, name, created_at').order('created_at', { ascending: false });
        listen = (data || []).filter(l => !excludedListIds.includes(l.id));
      } catch {}
    },

    search: async (term) => {
      const f = term.toLowerCase();
      return listen.filter(l => (l.name || '').toLowerCase().includes(f));
    },

    renderItem: (l) => esc(l.name),

    onConfirm: async (listId) => {
      await window.supabase.from('creator_list_member').insert({ list_id: listId, creator_id: creatorId, added_at: new Date().toISOString() });
      window.dispatchEvent(new CustomEvent('entityUpdated', { detail: { entity: 'creator_list', action: 'member-added', id: listId } }));
    },
    successAlert: 'Creator zur Liste hinzugefügt.',
    errorAlert: 'Hinzufügen fehlgeschlagen.'
  });
}
