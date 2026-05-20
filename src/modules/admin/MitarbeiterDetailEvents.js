// MitarbeiterDetailEvents.js
// Event-Binding für Mitarbeiter-Detailseite

import { renderTabContent } from './MitarbeiterDetailRendererCore.js';
import { generatePermissionsTable } from './MitarbeiterDetailRendererRechte.js';
import { autoSavePermissions } from './MitarbeiterDetailPermissions.js';
import { showChangeRolleModal, showAddUnternehmenModal } from './MitarbeiterDetailModals.js';
import { updateUnternehmenRole, removeUnternehmen, saveFirmenhandyFromForm } from './MitarbeiterDetailActions.js';

export function bindMitarbeiterDetail(detail) {
  detail.bindSidebarTabs();

  if (detail._eventsBound) return;
  detail._eventsBound = true;

  detail._abortController = new AbortController();
  const signal = detail._abortController.signal;
  const on = (type, handler) => document.addEventListener(type, handler, { signal });

  // Tab-Navigation mit Lazy-Rendering
  on('click', (e) => {
    const btn = e.target.closest('.tab-button');
    if (!btn) return;
    e.preventDefault();
    const tab = btn.dataset.tab;
    if (!tab) return;

    detail.activeMainTab = tab;
    document.querySelectorAll('.tab-button').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    document.querySelectorAll('.tab-pane').forEach(p => p.classList.remove('active'));
    const pane = document.getElementById(`tab-${tab}`);
    if (pane) {
      if (detail._renderedTabs && !detail._renderedTabs.has(tab)) {
        const content = renderTabContent(detail, tab);
        if (content) pane.innerHTML = content;
        detail._renderedTabs.add(tab);
      }
      pane.classList.add('active');
    }
  });

  // Rolle ändern
  on('click', (e) => {
    if (e.target.closest('#btn-change-rolle')) {
      e.preventDefault();
      showChangeRolleModal(detail);
    }
  });

  // Freischaltung-Toggle + Permission-Auto-Save
  on('change', async (e) => {
    if (e.target && e.target.id === 'freigeschaltet-toggle') {
      const isFreigeschaltet = e.target.checked;
      const rechteSection = document.querySelector('#tab-rechte .detail-section:nth-child(4)');
      const statusHelp = document.querySelector('#tab-rechte .form-help');

      try {
        const updateData = { freigeschaltet: isFreigeschaltet };

        if (isFreigeschaltet) {
          if (detail.user.rolle === 'pending') updateData.rolle = 'mitarbeiter';
        } else {
          updateData.rolle = 'pending';
          updateData.zugriffsrechte = null;
        }

        const { error } = await window.supabase
          .from('benutzer')
          .update(updateData)
          .eq('id', detail.userId);

        if (error) {
          console.error('Auto-Save Freigeschaltet fehlgeschlagen', error);
          e.target.checked = !isFreigeschaltet;
          alert('Fehler beim Speichern des Freischaltungs-Status');
          return;
        }

        detail.user.freigeschaltet = isFreigeschaltet;
        if (updateData.rolle) detail.user.rolle = updateData.rolle;
        if (updateData.zugriffsrechte !== undefined) detail.user.zugriffsrechte = updateData.zugriffsrechte;

        setTimeout(() => {
          detail.render().then(() => detail.bind());
        }, 100);

      } catch (err) {
        console.error('Auto-Save Fehler', err);
        e.target.checked = !isFreigeschaltet;
        alert('Fehler beim Speichern');
        return;
      }

      if (rechteSection) {
        if (isFreigeschaltet) {
          rechteSection.style.display = 'block';
          rechteSection.innerHTML = `
            <div class="data-table-container">
              <table class="data-table">
                <thead>
                  <tr>
                    <th style="text-align:left;">Recht</th>
                    <th style="width:120px; text-align:right;">Lesen</th>
                    <th style="width:120px; text-align:right;">Bearbeiten</th>
                  </tr>
                </thead>
                <tbody>
                  ${generatePermissionsTable(detail)}
                </tbody>
              </table>
            </div>
          `;
        } else {
          rechteSection.innerHTML = `
            <p class="text-muted"><em>Rechte können erst nach der Freischaltung des Benutzers vergeben werden.</em></p>
          `;
        }
      }

      if (statusHelp) {
        statusHelp.textContent = isFreigeschaltet ?
          'Dieser Benutzer ist freigeschaltet und kann sich anmelden. Sie können Rechte vergeben.' :
          'Dieser Benutzer wartet auf Freischaltung. Schalten Sie ihn frei, bevor Sie Rechte vergeben.';
      }
    }

    if (e.target && (e.target.classList.contains('perm-toggle') || e.target.classList.contains('perm-edit-toggle'))) {
      await autoSavePermissions(detail);
    }
  });

  // Zurück-Button und Firmenhandy speichern
  on('click', async (e) => {
    if (e.target && e.target.id === 'btn-back-mitarbeiter') {
      e.preventDefault();
      window.navigateTo('/mitarbeiter');
      return;
    }
    if (e.target && e.target.id === 'btn-save-firmenhandy') {
      e.preventDefault();
      await saveFirmenhandyFromForm(detail);
      return;
    }
  });

  // Unternehmen zuordnen
  on('click', (e) => {
    if (e.target.closest('#btn-add-unternehmen')) {
      e.preventDefault();
      showAddUnternehmenModal(detail);
    }
  });

  // Unternehmen-Rolle ändern
  on('change', async (e) => {
    const roleSelect = e.target.closest('.role-select');
    if (roleSelect) {
      const unternehmenId = roleSelect.dataset.unternehmenId;
      const newRole = roleSelect.value;
      await updateUnternehmenRole(detail, unternehmenId, newRole);
    }
  });

  // Unternehmen entfernen
  on('click', async (e) => {
    const removeBtn = e.target.closest('.btn-remove-unternehmen');
    if (removeBtn) {
      e.preventDefault();
      const unternehmenId = removeBtn.dataset.id;
      const unternehmenName = removeBtn.dataset.name;

      if (window.confirmationModal) {
        const result = await window.confirmationModal.open({
          title: 'Unternehmen-Zuordnung entfernen',
          message: `Möchten Sie die Zuordnung zu "${unternehmenName}" wirklich entfernen?\n\nDer Mitarbeiter verliert dadurch automatisch den Zugriff auf alle Marken, Kampagnen und Kooperationen dieses Unternehmens.`,
          confirmText: 'Zuordnung entfernen',
          cancelText: 'Abbrechen',
          danger: true
        });
        if (result?.confirmed) {
          await removeUnternehmen(detail, unternehmenId);
        }
      } else {
        if (confirm(`Möchten Sie die Zuordnung zu "${unternehmenName}" wirklich entfernen?`)) {
          await removeUnternehmen(detail, unternehmenId);
        }
      }
    }
  });
}
