// ActionsDropdownModals.js
// QuickView, AssignStaff, AssignMarkeStaff, AddToCampaign, AddToList, AddAPToKampagne

import { KampagneUtils } from '../modules/kampagne/KampagneUtils.js';
import {
  createEmptyVideoFeedbackComments,
  getVideoFeedbackBucket,
  isMissingFeedbackTypeError,
  VIDEO_FEEDBACK_LEGACY_SELECT,
  VIDEO_FEEDBACK_FIELDS
} from './VideoFeedbackBuckets.js';

export async function openKooperationQuickView(dropdown, kooperationId) {
  try {
    const overlay = document.createElement('div');
    overlay.className = 'drawer-overlay';

    const panel = document.createElement('div');
    panel.setAttribute('role', 'dialog');
    panel.className = 'drawer-panel';

    const header = document.createElement('div');
    header.className = 'drawer-header';
    const headerLeft = document.createElement('div');
    const title = document.createElement('h1');
    title.textContent = 'Kooperation · Schnellansicht';
    const subtitle = document.createElement('p');
    subtitle.style.margin = '0';
    subtitle.style.color = '#6b7280';
    subtitle.textContent = 'Videos & Kommentare';
    headerLeft.appendChild(title);
    headerLeft.appendChild(subtitle);

    const headerRight = document.createElement('div');
    const closeBtn = document.createElement('button');
    closeBtn.className = 'drawer-close';
    closeBtn.id = 'kvq-close';
    closeBtn.textContent = 'Schließen';
    headerRight.appendChild(closeBtn);

    header.appendChild(headerLeft);
    header.appendChild(headerRight);

    const body = document.createElement('div');
    body.className = 'drawer-body';
    const section = document.createElement('div');
    section.className = 'detail-section';
    const heading = document.createElement('h2');
    heading.textContent = 'Videos';
    const tableContainer = document.createElement('div');
    tableContainer.id = 'kvq-table';
    tableContainer.textContent = 'Lade...';
    section.appendChild(heading);
    section.appendChild(tableContainer);
    body.replaceChildren(section);

    panel.appendChild(header);
    panel.appendChild(body);
    document.body.appendChild(overlay);
    document.body.appendChild(panel);

    const close = () => { try { document.removeEventListener('keydown', onEsc); overlay.remove(); panel.remove(); } catch(err) { console.warn('Drawer-Close fehlgeschlagen:', err?.message); } };
    overlay.addEventListener('click', close);
    header.querySelector('#kvq-close')?.addEventListener('click', close);
    function onEsc(e) { if (e.key === 'Escape') close(); }
    document.addEventListener('keydown', onEsc);
    requestAnimationFrame(() => { panel.classList.add('show'); });

    const { data: videos } = await window.supabase
      .from('kooperation_videos')
      .select('id, position, content_art, titel, asset_url, status, created_at')
      .eq('kooperation_id', kooperationId)
      .order('position', { ascending: true });
    const videoList = videos || [];
    let commentsByVideo = {};
    if (videoList.length) {
      const ids = videoList.map(v => v.id);
      let { data: comments, error: commentsError } = await window.supabase
        .from('kooperation_video_comment')
        .select('id, video_id, runde, feedback_typ, text, author_name, created_at, deleted_at')
        .in('video_id', ids)
        .order('created_at', { ascending: true });
      if (commentsError && isMissingFeedbackTypeError(commentsError)) {
        const legacyResult = await window.supabase
          .from('kooperation_video_comment')
          .select(`${VIDEO_FEEDBACK_LEGACY_SELECT}, deleted_at`)
          .in('video_id', ids)
          .order('created_at', { ascending: true });
        comments = legacyResult.data || [];
        commentsError = legacyResult.error;
      }
      if (commentsError) throw commentsError;
      (comments || []).forEach(c => {
        const key = c.video_id;
        if (!commentsByVideo[key]) commentsByVideo[key] = createEmptyVideoFeedbackComments();
        commentsByVideo[key][getVideoFeedbackBucket(c)].push(c);
      });
    }

    const safe = (s) => window.validatorSystem?.sanitizeHtml?.(s) ?? s;
    const fDate = d => d ? new Date(d).toLocaleDateString('de-DE') : '-';
    const fmtFeedback = (arr) => {
      if (!arr || !arr.length) return '-';
      return arr.map(c => {
        const isDeleted = !!c.deleted_at;
        const textStyle = isDeleted ? 'text-decoration: line-through; color: #999;' : '';
        const t = safe(c.text || '');
        const a = safe(c.author_name || '-');
        const dt = fDate(c.created_at);
        return `<div class="fb-line"><span class="fb-meta">${a} • ${dt}</span><div class="fb-text" style="${textStyle}">${t}</div></div>`;
      }).join('');
    };

    const rows = videoList.map(v => {
      const fb = commentsByVideo[v.id] || createEmptyVideoFeedbackComments();
      const linkBtn = v.asset_url ? `<a class="kvq-link-btn" href="${v.asset_url}" target="_blank" rel="noopener">${dropdown.getHeroIcon('view')}<span>Öffnen</span></a>` : '-';
      return `
        <tr>
          <td>${v.position || '-'}</td>
          <td>${safe(v.content_art || '-')}</td>
          <td>
            <div class="kvq-cell">
              <span class="kvq-title-text">${safe(v.titel || '-')}</span>
              ${linkBtn}
            </div>
          </td>
          ${VIDEO_FEEDBACK_FIELDS.map(slot => `<td class="feedback-cell">${fmtFeedback(fb[slot.bucket])}</td>`).join('')}
          <td><span class="status-badge status-${(v.status || 'produktion').toLowerCase()}">${v.status === 'abgeschlossen' ? 'Abgeschlossen' : 'Produktion'}</span></td>
        </tr>`;
    }).join('');

    const tableHtml = videoList.length ? `
      <div class="data-table-container">
        <table class="data-table">
          <thead><tr>
            <th>#</th><th>Content Art</th><th>Titel/URL</th>
            ${VIDEO_FEEDBACK_FIELDS.map(slot => `<th>${slot.label}</th>`).join('')}
            <th>Status</th>
          </tr></thead>
          <tbody>${rows}</tbody>
        </table>
      </div>` : '<p class="empty-state">Keine Videos vorhanden.</p>';

    const tableDiv = body.querySelector('#kvq-table');
    tableDiv.innerHTML = '';
    if (videoList.length) {
      const tc = document.createElement('div');
      tc.className = 'data-table-container';
      tc.innerHTML = tableHtml;
      tableDiv.appendChild(tc);
    } else {
      const emptyState = document.createElement('p');
      emptyState.className = 'empty-state';
      emptyState.textContent = 'Keine Videos vorhanden.';
      tableDiv.appendChild(emptyState);
    }
    dropdown.normalizeIcons(body);
  } catch (err) {
    console.error('Quickview öffnen fehlgeschlagen', err);
    alert('Schnellansicht konnte nicht geöffnet werden.');
  }
}

export async function openAssignStaffModal(dropdown, kampagneId) {
  const modal = document.createElement('div');
  modal.className = 'modal overlay-modal';
  modal.innerHTML = `
    <div class="modal-dialog">
      <div class="modal-header">
        <h3>Mitarbeiter zuordnen</h3>
        <button class="modal-close" id="assign-staff-close">×</button>
      </div>
      <div class="modal-body">
        <label class="form-label">Mitarbeiter wählen</label>
        <input type="text" id="staff-search" class="form-input auto-suggest-input" placeholder="Mitarbeiter suchen..." />
        <div id="staff-dropdown" class="auto-suggest-dropdown"></div>
      </div>
      <div class="modal-footer">
        <button class="mdc-btn mdc-btn--cancel" id="assign-staff-cancel">
          <span class="mdc-btn__icon" aria-hidden="true">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" width="16" height="16"><path stroke-linecap="round" stroke-linejoin="round" d="M18.364 18.364A9 9 0 0 0 5.636 5.636m12.728 12.728A9 9 0 0 1 5.636 5.636m12.728 12.728L5.636 5.636" /></svg>
          </span>
          <span class="mdc-btn__label">Abbrechen</span>
        </button>
        <button class="mdc-btn mdc-btn--create" id="assign-staff-confirm" disabled>
          <span class="mdc-btn__icon mdc-btn__icon--check" aria-hidden="true">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" width="16" height="16"><path d="M9 16.17l-3.88-3.88a1 1 0 10-1.41 1.41l4.59 4.59a1 1 0 001.41 0l10-10a1 1 0 10-1.41-1.41L9 16.17z"/></svg>
          </span>
          <span class="mdc-btn__spinner" aria-hidden="true">
            <svg class="mdc-spinner" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 50 50" width="16" height="16"><circle class="mdc-spinner-path" cx="25" cy="25" r="20" fill="none" stroke-width="5"/></svg>
          </span>
          <span class="mdc-btn__label">Zuordnen</span>
        </button>
      </div>
    </div>`;
  document.body.appendChild(modal);

  const input = modal.querySelector('#staff-search');
  const ddEl = modal.querySelector('#staff-dropdown');
  let selectedId = null;

  const search = async (term) => {
    try {
      let assignedIds = [];
      try {
        const { data: assigned } = await window.supabase.from('kampagne_mitarbeiter').select('mitarbeiter_id').eq('kampagne_id', kampagneId);
        assignedIds = (assigned || []).map(r => r.mitarbeiter_id);
      } catch {}
      let query = window.supabase.from('benutzer').select('id, name, rolle, mitarbeiter_klasse:mitarbeiter_klasse_id(name)').neq('rolle', 'kunde').order('name');
      if (term) query = query.ilike('name', `%${term}%`);
      if (assignedIds.length > 0) query = query.not('id', 'in', `(${assignedIds.join(',')})`);
      const { data } = await query;
      return data || [];
    } catch { return []; }
  };

  const hydrate = (items) => {
    const s = window.validatorSystem?.sanitizeHtml?.bind(window.validatorSystem) || (x => x);
    ddEl.innerHTML = items.length
      ? items.map(u => `<div class="dropdown-item" data-id="${u.id}">${s(u.name)}${u.mitarbeiter_klasse?.name ? ` <span class="muted">(${s(u.mitarbeiter_klasse.name)})</span>` : ''}${u.rolle ? ` <span class="muted">[${s(u.rolle)}]</span>` : ''}</div>`).join('')
      : '<div class="dropdown-item no-results">Keine Mitarbeiter gefunden</div>';
  };

  hydrate(await search(''));
  ddEl.classList.add('show');
  input.focus();
  const ensurePosition = () => {
    if (!ddEl.style.position || ddEl.style.position === 'absolute') ddEl.style.position = 'relative';
    ddEl.style.display = 'block';
  };
  ensurePosition();
  input.addEventListener('focus', () => ddEl.classList.add('show'));
  input.addEventListener('blur', () => setTimeout(() => ddEl.classList.remove('show'), 150));

  let debounce;
  input.addEventListener('input', () => {
    clearTimeout(debounce);
    debounce = setTimeout(async () => hydrate(await search(input.value.trim())), 200);
  });
  ddEl.addEventListener('click', (e) => {
    const item = e.target.closest('.dropdown-item');
    if (!item || item.classList.contains('no-results')) return;
    selectedId = item.dataset.id;
    input.value = item.textContent.trim();
    modal.querySelector('#assign-staff-confirm').disabled = false;
    ddEl.classList.remove('show');
  });

  const close = () => modal.remove();
  modal.querySelector('#assign-staff-close').onclick = close;
  modal.querySelector('#assign-staff-cancel').onclick = close;
  modal.querySelector('#assign-staff-confirm').onclick = async () => {
    if (!selectedId) return;
    const btn = modal.querySelector('#assign-staff-confirm');
    btn.disabled = true;
    btn.classList.add('is-loading');
    try {
      const { error: insertError } = await window.supabase.from('kampagne_mitarbeiter').insert({ kampagne_id: kampagneId, mitarbeiter_id: selectedId, role: 'projektmanager' });
      if (insertError) throw insertError;
      close();
      window.dispatchEvent(new CustomEvent('entityUpdated', { detail: { entity: 'kampagne', action: 'staff-assigned', id: kampagneId } }));
      alert('Mitarbeiter zugeordnet.');
    } catch (err) {
      console.error('Fehler beim Zuordnen', err);
      alert('Zuordnung fehlgeschlagen.');
      btn.disabled = false;
      btn.classList.remove('is-loading');
    }
  };
}

export async function openAssignMarkeStaffModal(dropdown, markeId) {
  let mitarbeiter = [];
  let excludedMitarbeiterIds = [];

  try {
    const { data: existing } = await window.supabase.from('marke_mitarbeiter').select('mitarbeiter_id').eq('marke_id', markeId);
    excludedMitarbeiterIds = (existing || []).map(r => r.mitarbeiter_id).filter(Boolean);
    let query = window.supabase.from('benutzer').select(`id, name, rolle, mitarbeiter_klasse:mitarbeiter_klasse_id(name)`).neq('rolle', 'kunde').order('name');
    if (excludedMitarbeiterIds.length > 0) query = query.not('id', 'in', `(${excludedMitarbeiterIds.join(',')})`);
    const { data } = await query;
    mitarbeiter = data || [];
  } catch (error) {
    console.warn('Fehler beim Laden der Mitarbeiter:', error);
  }

  const modal = document.createElement('div');
  modal.className = 'modal overlay-modal';
  modal.innerHTML = `
    <div class="modal-dialog">
      <div class="modal-header">
        <h3>Mitarbeiter zur Marke hinzufügen</h3>
        <button class="modal-close" id="add-mitarbeiter-close">×</button>
      </div>
      <div class="modal-body">
        <label class="form-label">Mitarbeiter wählen</label>
        <input type="text" id="mitarbeiter-search" class="form-input auto-suggest-input" placeholder="Mitarbeiter suchen..." />
        <div id="mitarbeiter-dropdown" class="auto-suggest-dropdown"></div>
      </div>
      <div class="modal-footer">
        <button class="mdc-btn mdc-btn--cancel" id="add-mitarbeiter-cancel">
          <span class="mdc-btn__icon" aria-hidden="true">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" width="16" height="16"><path stroke-linecap="round" stroke-linejoin="round" d="M18.364 18.364A9 9 0 0 0 5.636 5.636m12.728 12.728A9 9 0 0 1 5.636 5.636m12.728 12.728L5.636 5.636" /></svg>
          </span>
          <span class="mdc-btn__label">Abbrechen</span>
        </button>
        <button class="mdc-btn mdc-btn--create" id="add-mitarbeiter-confirm" disabled>
          <span class="mdc-btn__icon mdc-btn__icon--check" aria-hidden="true">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" width="16" height="16"><path d="M9 16.17l-3.88-3.88a1 1 0 10-1.41 1.41l4.59 4.59a1 1 0 001.41 0l10-10a1 1 0 10-1.41-1.41L9 16.17z"/></svg>
          </span>
          <span class="mdc-btn__spinner" aria-hidden="true">
            <svg class="mdc-spinner" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 50 50" width="16" height="16"><circle class="mdc-spinner-path" cx="25" cy="25" r="20" fill="none" stroke-width="5"/></svg>
          </span>
          <span class="mdc-btn__label">Hinzufügen</span>
        </button>
      </div>
    </div>`;
  document.body.appendChild(modal);

  const input = modal.querySelector('#mitarbeiter-search');
  const ddEl = modal.querySelector('#mitarbeiter-dropdown');
  let selectedId = null;

  const hydrateDropdown = (filter = '') => {
    if (!filter || filter.trim().length === 0) {
      ddEl.innerHTML = '<div class="dropdown-item no-results">Beginnen Sie zu tippen, um Mitarbeiter zu suchen...</div>';
      return;
    }
    const f = filter.toLowerCase();
    const items = mitarbeiter.filter(m => {
      const name = (m.name || '').toLowerCase();
      const rolle = (m.rolle || '').toLowerCase();
      const klasse = (m.mitarbeiter_klasse?.name || '').toLowerCase();
      return name.includes(f) || rolle.includes(f) || klasse.includes(f);
    });
    ddEl.innerHTML = items.length
      ? items.map(m => {
          const details = [m.rolle, m.mitarbeiter_klasse?.name].filter(Boolean).join(' • ');
          return `<div class="dropdown-item" data-id="${m.id}"><div class="dropdown-item-main">${m.name}</div>${details ? `<div class="dropdown-item-details">${details}</div>` : ''}</div>`;
        }).join('')
      : '<div class="dropdown-item no-results">Keine verfügbaren Mitarbeiter gefunden</div>';
  };

  ddEl.innerHTML = '<div class="dropdown-item no-results">Beginnen Sie zu tippen, um Mitarbeiter zu suchen...</div>';
  input.addEventListener('focus', () => { if (input.value.trim().length > 0) ddEl.classList.add('show'); });
  input.addEventListener('blur', () => { setTimeout(() => ddEl.classList.remove('show'), 150); });

  let searchTimeout;
  input.addEventListener('input', (e) => {
    clearTimeout(searchTimeout);
    searchTimeout = setTimeout(async () => {
      const term = e.target.value.trim();
      if (term.length < 1) { ddEl.classList.remove('show'); return; }
      try {
        let query = window.supabase.from('benutzer').select(`id, name, rolle, mitarbeiter_klasse:mitarbeiter_klasse_id(name)`).neq('rolle', 'kunde').or(`name.ilike.%${term}%,rolle.ilike.%${term}%`).order('name');
        if (excludedMitarbeiterIds.length > 0) query = query.not('id', 'in', `(${excludedMitarbeiterIds.join(',')})`);
        const { data } = await query;
        mitarbeiter = data || [];
        hydrateDropdown(term);
        ddEl.classList.add('show');
      } catch (err) {
        console.warn('Mitarbeiter-Suche fehlgeschlagen', err);
      }
    }, 200);
  });

  ddEl.addEventListener('click', (e) => {
    const item = e.target.closest('.dropdown-item');
    if (!item || item.classList.contains('no-results')) return;
    selectedId = item.dataset.id;
    const mainText = item.querySelector('.dropdown-item-main')?.textContent || item.textContent;
    input.value = mainText;
    modal.querySelector('#add-mitarbeiter-confirm').disabled = false;
    ddEl.classList.remove('show');
  });

  let handleEsc;
  const close = () => { document.removeEventListener('keydown', handleEsc); modal.remove(); };
  modal.querySelector('#add-mitarbeiter-close').onclick = close;
  modal.querySelector('#add-mitarbeiter-cancel').onclick = close;
  handleEsc = (e) => { if (e.key === 'Escape') close(); };
  document.addEventListener('keydown', handleEsc);

  modal.querySelector('#add-mitarbeiter-confirm').onclick = async () => {
    if (!selectedId) return;
    const btn = modal.querySelector('#add-mitarbeiter-confirm');
    btn.disabled = true;
    btn.classList.add('is-loading');
    try {
      const { error } = await window.supabase.from('marke_mitarbeiter').insert({ marke_id: markeId, mitarbeiter_id: selectedId, assigned_by: window.currentUser?.id || null });
      if (error) throw error;
      close();
      window.dispatchEvent(new CustomEvent('entityUpdated', { detail: { entity: 'mitarbeiter', action: 'added', markeId } }));
      window.dispatchEvent(new CustomEvent('entityUpdated', { detail: { entity: 'marke', action: 'mitarbeiter-added', id: markeId } }));
      alert('Mitarbeiter wurde erfolgreich zur Marke hinzugefügt und wird automatisch angezeigt!');
    } catch (error) {
      console.error('Fehler beim Hinzufügen des Mitarbeiters:', error);
      alert('Fehler beim Hinzufügen: ' + (error.message || 'Unbekannter Fehler'));
      btn.disabled = false;
      btn.classList.remove('is-loading');
    }
  };
}

export async function openAddToCampaignModal(dropdown, creatorId) {
  let kampagnen = [];
  let excludedCampaignIds = [];
  let allowedCampaignIds = null;
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

    let shouldQuery = true;
    let query = window.supabase.from('kampagne').select('id, kampagnenname, eigener_name, status').order('created_at', { ascending: false });
    if (Array.isArray(allowedCampaignIds)) {
      if (allowedCampaignIds.length === 0) { shouldQuery = false; kampagnen = []; }
      else query = query.in('id', allowedCampaignIds);
    }
    if (excludedCampaignIds.length > 0) query = query.not('id', 'in', `(${excludedCampaignIds.join(',')})`);
    if (shouldQuery) { const { data } = await query; kampagnen = data || []; }
  } catch {}

  const modal = document.createElement('div');
  modal.className = 'modal overlay-modal';
  modal.innerHTML = `
    <div class="modal-dialog">
      <div class="modal-header">
        <h3>Zu Kampagne hinzufügen</h3>
        <button class="modal-close" id="add-to-campaign-close">×</button>
      </div>
      <div class="modal-body">
        <label class="form-label">Kampagne wählen</label>
        <input type="text" id="campaign-search" class="form-input auto-suggest-input" placeholder="Kampagne suchen..." />
        <div id="campaign-dropdown" class="auto-suggest-dropdown"></div>
      </div>
      <div class="modal-footer">
        <button class="mdc-btn mdc-btn--cancel" id="add-to-campaign-cancel">
          <span class="mdc-btn__icon" aria-hidden="true">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" width="16" height="16"><path stroke-linecap="round" stroke-linejoin="round" d="M18.364 18.364A9 9 0 0 0 5.636 5.636m12.728 12.728A9 9 0 0 1 5.636 5.636m12.728 12.728L5.636 5.636" /></svg>
          </span>
          <span class="mdc-btn__label">Abbrechen</span>
        </button>
        <button class="mdc-btn mdc-btn--create" id="add-to-campaign-confirm" disabled>
          <span class="mdc-btn__icon mdc-btn__icon--check" aria-hidden="true">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" width="16" height="16"><path d="M9 16.17l-3.88-3.88a1 1 0 10-1.41 1.41l4.59 4.59a1 1 0 001.41 0l10-10a1 1 0 10-1.41-1.41L9 16.17z"/></svg>
          </span>
          <span class="mdc-btn__spinner" aria-hidden="true">
            <svg class="mdc-spinner" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 50 50" width="16" height="16"><circle class="mdc-spinner-path" cx="25" cy="25" r="20" fill="none" stroke-width="5"/></svg>
          </span>
          <span class="mdc-btn__label">Hinzufügen</span>
        </button>
      </div>
    </div>`;
  document.body.appendChild(modal);

  const input = modal.querySelector('#campaign-search');
  const ddEl = modal.querySelector('#campaign-dropdown');
  let selectedId = null;

  const hydrateDropdown = (filter = '') => {
    const f = filter.toLowerCase();
    const items = kampagnen.filter(k => KampagneUtils.getDisplayName(k).toLowerCase().includes(f));
    ddEl.innerHTML = items.length
      ? items.map(k => `<div class="dropdown-item" data-id="${k.id}">${KampagneUtils.getDisplayName(k)}</div>`).join('')
      : '<div class="dropdown-item no-results">Keine Kampagne gefunden</div>';
  };
  hydrateDropdown('');
  input.addEventListener('focus', () => { ddEl.classList.add('show'); });
  input.addEventListener('blur', () => { setTimeout(() => ddEl.classList.remove('show'), 150); });

  let debounceTimer;
  input.addEventListener('input', () => {
    const term = input.value.trim();
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(async () => {
      try {
        let query = window.supabase.from('kampagne').select('id, kampagnenname, eigener_name, status').order('created_at', { ascending: false });
        if (term.length > 0) query = query.ilike('kampagnenname', `%${term}%`);
        if (Array.isArray(allowedCampaignIds)) {
          if (allowedCampaignIds.length === 0) { kampagnen = []; hydrateDropdown(term); return; }
          query = query.in('id', allowedCampaignIds);
        }
        if (excludedCampaignIds.length > 0) query = query.not('id', 'in', `(${excludedCampaignIds.join(',')})`);
        const { data } = await query;
        kampagnen = data || [];
        hydrateDropdown(term);
      } catch {}
    }, 200);
  });
  ddEl.addEventListener('click', (e) => {
    const item = e.target.closest('.dropdown-item');
    if (!item || item.classList.contains('no-results')) return;
    selectedId = item.dataset.id;
    input.value = item.textContent;
    modal.querySelector('#add-to-campaign-confirm').disabled = false;
    ddEl.classList.remove('show');
  });

  const close = () => modal.remove();
  modal.querySelector('#add-to-campaign-close').onclick = close;
  modal.querySelector('#add-to-campaign-cancel').onclick = close;
  modal.querySelector('#add-to-campaign-confirm').onclick = async () => {
    if (!selectedId) return;
    const btn = modal.querySelector('#add-to-campaign-confirm');
    btn.disabled = true;
    btn.classList.add('is-loading');
    try {
      await window.supabase.from('kampagne_creator_sourcing').insert({ kampagne_id: selectedId, creator_id: creatorId });
      close();
      window.dispatchEvent(new CustomEvent('entityUpdated', { detail: { entity: 'kampagne', action: 'sourcing-added', id: selectedId } }));
      alert('Creator wurde zum Sourcing der Kampagne hinzugefügt.');
    } catch (err) {
      console.error('Fehler beim Hinzufügen zur Kampagne', err);
      alert('Hinzufügen fehlgeschlagen.');
      btn.disabled = false;
      btn.classList.remove('is-loading');
    }
  };
}

export async function openAddToListModal(dropdown, creatorId) {
  let listen = [];
  let excludedListIds = [];
  try {
    const { data: existing } = await window.supabase.from('creator_list_member').select('list_id').eq('creator_id', creatorId);
    excludedListIds = (existing || []).map(r => r.list_id).filter(Boolean);
    const { data } = await window.supabase.from('creator_list').select('id, name, created_at').order('created_at', { ascending: false });
    listen = (data || []).filter(l => !excludedListIds.includes(l.id));
  } catch {}

  const modal = document.createElement('div');
  modal.className = 'modal overlay-modal';
  modal.innerHTML = `
    <div class="modal-dialog">
      <div class="modal-header">
        <h3>Zu Liste hinzufügen</h3>
        <button class="modal-close" id="add-to-list-close">×</button>
      </div>
      <div class="modal-body">
        <label class="form-label">Liste wählen</label>
        <input type="text" id="list-search" class="form-input auto-suggest-input" placeholder="Liste suchen..." />
        <div id="list-dropdown" class="auto-suggest-dropdown"></div>
      </div>
      <div class="modal-footer">
        <button class="mdc-btn mdc-btn--cancel" id="add-to-list-cancel">
          <span class="mdc-btn__icon" aria-hidden="true">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" width="16" height="16"><path stroke-linecap="round" stroke-linejoin="round" d="M18.364 18.364A9 9 0 0 0 5.636 5.636m12.728 12.728A9 9 0 0 1 5.636 5.636m12.728 12.728L5.636 5.636" /></svg>
          </span>
          <span class="mdc-btn__label">Abbrechen</span>
        </button>
        <button class="mdc-btn mdc-btn--create" id="add-to-list-confirm" disabled>
          <span class="mdc-btn__icon mdc-btn__icon--check" aria-hidden="true">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" width="16" height="16"><path d="M9 16.17l-3.88-3.88a1 1 0 10-1.41 1.41l4.59 4.59a1 1 0 001.41 0l10-10a1 1 0 10-1.41-1.41L9 16.17z"/></svg>
          </span>
          <span class="mdc-btn__spinner" aria-hidden="true">
            <svg class="mdc-spinner" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 50 50" width="16" height="16"><circle class="mdc-spinner-path" cx="25" cy="25" r="20" fill="none" stroke-width="5"/></svg>
          </span>
          <span class="mdc-btn__label">Hinzufügen</span>
        </button>
      </div>
    </div>`;
  document.body.appendChild(modal);

  const input = modal.querySelector('#list-search');
  const ddEl = modal.querySelector('#list-dropdown');
  let selectedId = null;

  const hydrate = (term = '') => {
    const f = term.toLowerCase();
    const items = listen.filter(l => (l.name || '').toLowerCase().includes(f));
    ddEl.innerHTML = items.length
      ? items.map(l => `<div class="dropdown-item" data-id="${l.id}">${l.name}</div>`).join('')
      : '<div class="dropdown-item no-results">Keine Liste gefunden</div>';
    ddEl.classList.add('show');
  };
  hydrate('');
  input.addEventListener('focus', () => ddEl.classList.add('show'));
  input.addEventListener('blur', () => setTimeout(() => ddEl.classList.remove('show'), 150));
  let debounce;
  input.addEventListener('input', () => {
    clearTimeout(debounce);
    debounce = setTimeout(() => hydrate(input.value.trim()), 150);
  });
  ddEl.addEventListener('click', (e) => {
    const item = e.target.closest('.dropdown-item');
    if (!item || item.classList.contains('no-results')) return;
    selectedId = item.dataset.id;
    input.value = item.textContent.trim();
    modal.querySelector('#add-to-list-confirm').disabled = false;
    ddEl.classList.remove('show');
  });

  const close = () => modal.remove();
  modal.querySelector('#add-to-list-close').onclick = close;
  modal.querySelector('#add-to-list-cancel').onclick = close;
  modal.querySelector('#add-to-list-confirm').onclick = async () => {
    if (!selectedId) return;
    const btn = modal.querySelector('#add-to-list-confirm');
    btn.disabled = true;
    btn.classList.add('is-loading');
    try {
      await window.supabase.from('creator_list_member').insert({ list_id: selectedId, creator_id: creatorId, added_at: new Date().toISOString() });
      close();
      window.dispatchEvent(new CustomEvent('entityUpdated', { detail: { entity: 'creator_list', action: 'member-added', id: selectedId } }));
      alert('Creator zur Liste hinzugefügt.');
    } catch (err) {
      console.error('Fehler beim Hinzufügen zur Liste', err);
      alert('Hinzufügen fehlgeschlagen.');
      btn.disabled = false;
      btn.classList.remove('is-loading');
    }
  };
}

export async function openAddAnsprechpartnerToKampagneModal(dropdown, kampagneId) {
  let ansprechpartner = [];
  let excludedAnsprechpartnerIds = [];

  try {
    const { data: existing } = await window.supabase.from('ansprechpartner_kampagne').select('ansprechpartner_id').eq('kampagne_id', kampagneId);
    excludedAnsprechpartnerIds = (existing || []).map(r => r.ansprechpartner_id).filter(Boolean);
    let query = window.supabase.from('ansprechpartner').select(`id, vorname, nachname, email, unternehmen:unternehmen_id(firmenname), position:position_id(name)`).order('nachname');
    if (excludedAnsprechpartnerIds.length > 0) query = query.not('id', 'in', `(${excludedAnsprechpartnerIds.join(',')})`);
    const { data } = await query;
    ansprechpartner = data || [];
  } catch (error) {
    console.warn('Fehler beim Laden der Ansprechpartner:', error);
  }

  const modal = document.createElement('div');
  modal.className = 'modal overlay-modal';
  modal.innerHTML = `
    <div class="modal-dialog">
      <div class="modal-header">
        <h3>Ansprechpartner zur Kampagne hinzufügen</h3>
        <button class="modal-close" id="add-ansprechpartner-kampagne-close">×</button>
      </div>
      <div class="modal-body">
        <label class="form-label">Ansprechpartner wählen</label>
        <input type="text" id="ansprechpartner-kampagne-search" class="form-input auto-suggest-input" placeholder="Ansprechpartner suchen..." />
        <div id="ansprechpartner-kampagne-dropdown" class="auto-suggest-dropdown"></div>
      </div>
      <div class="modal-footer">
        <button class="mdc-btn mdc-btn--cancel" id="add-ansprechpartner-kampagne-cancel">
          <span class="mdc-btn__icon" aria-hidden="true">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" width="16" height="16"><path stroke-linecap="round" stroke-linejoin="round" d="M18.364 18.364A9 9 0 0 0 5.636 5.636m12.728 12.728A9 9 0 0 1 5.636 5.636m12.728 12.728L5.636 5.636" /></svg>
          </span>
          <span class="mdc-btn__label">Abbrechen</span>
        </button>
        <button class="mdc-btn mdc-btn--create" id="add-ansprechpartner-kampagne-confirm" disabled>
          <span class="mdc-btn__icon mdc-btn__icon--check" aria-hidden="true">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" width="16" height="16"><path d="M9 16.17l-3.88-3.88a1 1 0 10-1.41 1.41l4.59 4.59a1 1 0 001.41 0l10-10a1 1 0 10-1.41-1.41L9 16.17z"/></svg>
          </span>
          <span class="mdc-btn__spinner" aria-hidden="true">
            <svg class="mdc-spinner" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 50 50" width="16" height="16"><circle class="mdc-spinner-path" cx="25" cy="25" r="20" fill="none" stroke-width="5"/></svg>
          </span>
          <span class="mdc-btn__label">Hinzufügen</span>
        </button>
      </div>
    </div>`;
  document.body.appendChild(modal);

  const input = modal.querySelector('#ansprechpartner-kampagne-search');
  const ddEl = modal.querySelector('#ansprechpartner-kampagne-dropdown');
  let selectedId = null;

  const hydrateDropdown = (filter = '') => {
    if (!filter || filter.trim().length === 0) {
      ddEl.innerHTML = '<div class="dropdown-item no-results">Beginnen Sie zu tippen, um Ansprechpartner zu suchen...</div>';
      return;
    }
    const f = filter.toLowerCase();
    const items = ansprechpartner.filter(ap => {
      const fullName = `${ap.vorname} ${ap.nachname}`.toLowerCase();
      const email = (ap.email || '').toLowerCase();
      const unternehmen = (ap.unternehmen?.firmenname || '').toLowerCase();
      return fullName.includes(f) || email.includes(f) || unternehmen.includes(f);
    });
    const s = window.validatorSystem?.sanitizeHtml?.bind(window.validatorSystem) || (x => x);
    ddEl.innerHTML = items.length
      ? items.map(ap => {
          const displayName = `${s(ap.vorname)} ${s(ap.nachname)}`;
          const details = [ap.email ? s(ap.email) : null, ap.unternehmen?.firmenname ? s(ap.unternehmen.firmenname) : null, ap.position?.name ? s(ap.position.name) : null].filter(Boolean).join(' • ');
          return `<div class="dropdown-item" data-id="${ap.id}"><div class="dropdown-item-main">${displayName}</div>${details ? `<div class="dropdown-item-details">${details}</div>` : ''}</div>`;
        }).join('')
      : '<div class="dropdown-item no-results">Keine verfügbaren Ansprechpartner gefunden</div>';
  };

  ddEl.innerHTML = '<div class="dropdown-item no-results">Beginnen Sie zu tippen, um Ansprechpartner zu suchen...</div>';
  input.addEventListener('focus', () => { if (input.value.trim().length > 0) ddEl.classList.add('show'); });
  input.addEventListener('blur', () => { setTimeout(() => ddEl.classList.remove('show'), 150); });

  let searchTimeout;
  input.addEventListener('input', (e) => {
    clearTimeout(searchTimeout);
    searchTimeout = setTimeout(async () => {
      const term = e.target.value.trim();
      if (term.length < 1) { ddEl.classList.remove('show'); return; }
      try {
        let query = window.supabase.from('ansprechpartner').select(`id, vorname, nachname, email, unternehmen:unternehmen_id(firmenname), position:position_id(name)`).or(`vorname.ilike.%${term}%,nachname.ilike.%${term}%,email.ilike.%${term}%`).order('nachname');
        if (excludedAnsprechpartnerIds.length > 0) query = query.not('id', 'in', `(${excludedAnsprechpartnerIds.join(',')})`);
        const { data } = await query;
        ansprechpartner = data || [];
        hydrateDropdown(term);
        ddEl.classList.add('show');
      } catch (err) {
        console.warn('Ansprechpartner-Suche fehlgeschlagen', err);
      }
    }, 200);
  });

  ddEl.addEventListener('click', (e) => {
    const item = e.target.closest('.dropdown-item');
    if (!item || item.classList.contains('no-results')) return;
    selectedId = item.dataset.id;
    const mainText = item.querySelector('.dropdown-item-main')?.textContent || item.textContent;
    input.value = mainText;
    modal.querySelector('#add-ansprechpartner-kampagne-confirm').disabled = false;
    ddEl.classList.remove('show');
  });

  let handleEsc;
  const close = () => { document.removeEventListener('keydown', handleEsc); modal.remove(); };
  modal.querySelector('#add-ansprechpartner-kampagne-close').onclick = close;
  modal.querySelector('#add-ansprechpartner-kampagne-cancel').onclick = close;
  handleEsc = (e) => { if (e.key === 'Escape') close(); };
  document.addEventListener('keydown', handleEsc);

  modal.querySelector('#add-ansprechpartner-kampagne-confirm').onclick = async () => {
    if (!selectedId) return;
    const btn = modal.querySelector('#add-ansprechpartner-kampagne-confirm');
    btn.disabled = true;
    btn.classList.add('is-loading');
    try {
      const { error } = await window.supabase.from('ansprechpartner_kampagne').insert({ kampagne_id: kampagneId, ansprechpartner_id: selectedId });
      if (error) throw error;
      close();
      window.dispatchEvent(new CustomEvent('entityUpdated', { detail: { entity: 'ansprechpartner', action: 'added', kampagneId } }));
      window.dispatchEvent(new CustomEvent('entityUpdated', { detail: { entity: 'kampagne', action: 'ansprechpartner-added', id: kampagneId } }));
      alert('Ansprechpartner wurde erfolgreich zur Kampagne hinzugefügt und wird automatisch angezeigt!');
    } catch (error) {
      console.error('Fehler beim Hinzufügen des Ansprechpartners:', error);
      alert('Fehler beim Hinzufügen: ' + (error.message || 'Unbekannter Fehler'));
      btn.disabled = false;
      btn.classList.remove('is-loading');
    }
  };
}
