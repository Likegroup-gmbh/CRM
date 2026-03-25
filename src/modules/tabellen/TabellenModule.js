// TabellenModule.js
// Übersichtsseite: Liste aller Grid-Dokumente

import { GridEditor } from './GridEditor.js';

export class TabellenModule {
  constructor() {
    this.documents = [];
    this.currentEditor = null;
    this.container = null;
  }

  // Initialisiere Modul (wird von ModuleRegistry aufgerufen)
  async init() {
    console.log('📋 TabellenModule: Lade Tabellen-Übersicht');
    this.container = window.content;

    // Prüfe ob wir eine Dokument-ID in der URL haben
    const urlParams = new URLSearchParams(window.location.search);
    const documentId = window.location.pathname.split('/')[2];

    if (documentId && documentId !== 'new') {
      // Editor-Ansicht
      await this.loadEditor(documentId);
    } else if (documentId === 'new') {
      // Neues Dokument erstellen
      await this.createNewDocument();
    } else {
      // Listen-Ansicht
      window.setHeadline('Tabellen');
      
      await this.renderList();
    }
  }

  // Rendere Liste aller Dokumente
  async renderList() {
    // Entferne grid-view CSS-Klasse
    if (this.container) {
      this.container.classList.remove('grid-view-active');
    }
    const mainContent = document.querySelector('.main-content');
    if (mainContent) {
      mainContent.classList.remove('grid-view-active');
    }
    
    // Lade Dokumente aus Supabase
    await this.loadDocuments();

    const html = `
      <div class="tabellen-overview">
        <div class="page-header">
          <h1>Tabellen</h1>
          <button class="btn-primary" id="new-table-btn">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" style="width: 20px; height: 20px;">
              <path stroke-linecap="round" stroke-linejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
            </svg>
            Neue Tabelle
          </button>
        </div>

        <div class="documents-grid">
          ${this.documents.length === 0 ? this.renderEmptyState() : this.renderDocumentCards()}
        </div>
      </div>
    `;

    window.setContentSafely(this.container, html);
    this.bindListEvents();
  }

  // Rendere Document-Cards
  renderDocumentCards() {
    return this.documents.map(doc => `
      <div class="document-card" data-id="${doc.id}">
        <div class="document-card-icon">
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" d="M3.375 19.5h17.25m-17.25 0a1.125 1.125 0 0 1-1.125-1.125M3.375 19.5h7.5c.621 0 1.125-.504 1.125-1.125m-9.75 0V5.625m0 12.75v-1.5c0-.621.504-1.125 1.125-1.125m18.375 2.625V5.625m0 12.75c0 .621-.504 1.125-1.125 1.125m1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125m0 3.75h-7.5A1.125 1.125 0 0 1 12 18.375m9.75-12.75c0-.621-.504-1.125-1.125-1.125H3.375c-.621 0-1.125.504-1.125 1.125m19.5 0v1.5c0 .621-.504 1.125-1.125 1.125M2.25 5.625v1.5c0 .621.504 1.125 1.125 1.125m0 0h17.25m-17.25 0h7.5c.621 0 1.125.504 1.125 1.125M3.375 8.25c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125m17.25-3.75h-7.5c-.621 0-1.125.504-1.125 1.125m8.625-1.125c.621 0 1.125.504 1.125 1.125v1.5c0 .621-.504 1.125-1.125 1.125m-17.25 0h7.5m-7.5 0c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125M12 10.875v-1.5m0 1.5c0 .621-.504 1.125-1.125 1.125M12 10.875c0 .621.504 1.125 1.125 1.125m-2.25 0c.621 0 1.125.504 1.125 1.125M13.125 12h7.5m-7.5 0c-.621 0-1.125.504-1.125 1.125M20.625 12c.621 0 1.125.504 1.125 1.125v1.5c0 .621-.504 1.125-1.125 1.125m-17.25 0h7.5M12 14.625v-1.5m0 1.5c0 .621-.504 1.125-1.125 1.125M12 14.625c0 .621.504 1.125 1.125 1.125m-2.25 0c.621 0 1.125.504 1.125 1.125m0 1.5v-1.5m0 0c0-.621.504-1.125 1.125-1.125m0 0h7.5" />
          </svg>
        </div>
        <div class="document-card-body">
          <h3 class="document-card-title">${this.escapeHtml(doc.name)}</h3>
          <p class="document-card-meta">
            Erstellt: ${this.formatDate(doc.created_at)}
          </p>
          <p class="document-card-meta">
            Geändert: ${this.formatDate(doc.updated_at)}
          </p>
        </div>
        <div class="document-card-actions">
          <button class="btn-icon open-doc-btn" data-id="${doc.id}" title="Öffnen">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" d="M13.5 6H5.25A2.25 2.25 0 0 0 3 8.25v10.5A2.25 2.25 0 0 0 5.25 21h10.5A2.25 2.25 0 0 0 18 18.75V10.5m-10.5 6L21 3m0 0h-5.25M21 3v5.25" />
            </svg>
          </button>
          <button class="btn-icon delete-doc-btn" data-id="${doc.id}" title="Löschen">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" d="m14.74 9-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 0 1-2.244 2.077H8.084a2.25 2.25 0 0 1-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 0 0-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 0 1 3.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 0 0-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 0 0-7.5 0" />
            </svg>
          </button>
        </div>
      </div>
    `).join('');
  }

  // Empty State wenn keine Dokumente
  renderEmptyState() {
    return `
      <div class="empty-state">
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" style="width: 64px; height: 64px; color: var(--gray-400);">
          <path stroke-linecap="round" stroke-linejoin="round" d="M3.375 19.5h17.25m-17.25 0a1.125 1.125 0 0 1-1.125-1.125M3.375 19.5h7.5c.621 0 1.125-.504 1.125-1.125m-9.75 0V5.625m0 12.75v-1.5c0-.621.504-1.125 1.125-1.125m18.375 2.625V5.625m0 12.75c0 .621-.504 1.125-1.125 1.125m1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125m0 3.75h-7.5A1.125 1.125 0 0 1 12 18.375m9.75-12.75c0-.621-.504-1.125-1.125-1.125H3.375c-.621 0-1.125.504-1.125 1.125m19.5 0v1.5c0 .621-.504 1.125-1.125 1.125M2.25 5.625v1.5c0 .621.504 1.125 1.125 1.125m0 0h17.25m-17.25 0h7.5c.621 0 1.125.504 1.125 1.125M3.375 8.25c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125m17.25-3.75h-7.5c-.621 0-1.125.504-1.125 1.125m8.625-1.125c.621 0 1.125.504 1.125 1.125v1.5c0 .621-.504 1.125-1.125 1.125m-17.25 0h7.5m-7.5 0c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125M12 10.875v-1.5m0 1.5c0 .621-.504 1.125-1.125 1.125M12 10.875c0 .621.504 1.125 1.125 1.125m-2.25 0c.621 0 1.125.504 1.125 1.125M13.125 12h7.5m-7.5 0c-.621 0-1.125.504-1.125 1.125M20.625 12c.621 0 1.125.504 1.125 1.125v1.5c0 .621-.504 1.125-1.125 1.125m-17.25 0h7.5M12 14.625v-1.5m0 1.5c0 .621-.504 1.125-1.125 1.125M12 14.625c0 .621.504 1.125 1.125 1.125m-2.25 0c.621 0 1.125.504 1.125 1.125m0 1.5v-1.5m0 0c0-.621.504-1.125 1.125-1.125m0 0h7.5" />
        </svg>
        <h3>Keine Tabellen vorhanden</h3>
        <p>Erstellen Sie Ihre erste Tabelle</p>
      </div>
    `;
  }

  // Bind List-Events
  bindListEvents() {
    // Neue Tabelle erstellen
    const newBtn = document.getElementById('new-table-btn');
    if (newBtn) {
      newBtn.addEventListener('click', () => {
        this.promptCreateDocument();
      });
    }

    // Dokument öffnen
    this.container.querySelectorAll('.open-doc-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const id = btn.dataset.id;
        window.navigateTo(`/tabellen/${id}`);
      });
    });

    // Dokument löschen
    this.container.querySelectorAll('.delete-doc-btn').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        e.stopPropagation();
        const id = btn.dataset.id;
        const doc = this.documents.find(d => d.id === id);
        if (doc && confirm(`Tabelle "${doc.name}" wirklich löschen?`)) {
          await this.deleteDocument(id);
        }
      });
    });

    // Card-Click = öffnen
    this.container.querySelectorAll('.document-card').forEach(card => {
      card.addEventListener('click', () => {
        const id = card.dataset.id;
        window.navigateTo(`/tabellen/${id}`);
      });
    });
  }

  // Lade alle Dokumente aus Supabase
  async loadDocuments() {
    try {
      const { data, error } = await window.supabase
        .from('grid_documents')
        .select('*')
        .order('updated_at', { ascending: false });

      if (error) throw error;
      
      this.documents = data || [];
      console.log(`✅ ${this.documents.length} Dokumente geladen`);

    } catch (error) {
      console.error('❌ Fehler beim Laden der Dokumente:', error);
      this.documents = [];
    }
  }

  // Erstelle neues Dokument (Dialog)
  async promptCreateDocument() {
    const name = prompt('Name der neuen Tabelle:');
    if (!name || name.trim() === '') return;

    await this.createDocument(name.trim());
  }

  // Erstelle neues Dokument in Supabase
  async createDocument(name) {
    try {
      const { data, error } = await window.supabase
        .from('grid_documents')
        .insert({
          name,
          metadata: {}
          // created_by wird automatisch durch Trigger gesetzt
        })
        .select()
        .single();

      if (error) throw error;

      console.log('✅ Dokument erstellt:', data);
      
      // Navigiere zum neuen Dokument
      window.navigateTo(`/tabellen/${data.id}`);

    } catch (error) {
      console.error('❌ Fehler beim Erstellen:', error);
      alert('Fehler beim Erstellen der Tabelle');
    }
  }

  // Erstelle neues Dokument (von URL /tabellen/new)
  async createNewDocument() {
    const name = prompt('Name der neuen Tabelle:');
    if (!name || name.trim() === '') {
      window.navigateTo('/tabellen');
      return;
    }

    await this.createDocument(name.trim());
  }

  // Lösche Dokument
  async deleteDocument(id) {
    try {
      // Lösche Dokument (Zellen werden durch CASCADE gelöscht)
      const { error } = await window.supabase
        .from('grid_documents')
        .delete()
        .eq('id', id);

      if (error) throw error;

      console.log('✅ Dokument gelöscht');
      
      // Neu laden
      await this.renderList();

    } catch (error) {
      console.error('❌ Fehler beim Löschen:', error);
      alert('Fehler beim Löschen der Tabelle');
    }
  }

  // Lade Editor-Ansicht
  async loadEditor(documentId) {
    try {
      // Setze grid-view CSS-Klasse auf Container und main-content
      if (this.container) {
        this.container.classList.add('grid-view-active');
      }
      const mainContent = document.querySelector('.main-content');
      if (mainContent) {
        mainContent.classList.add('grid-view-active');
      }
      
      // Lade Dokument-Metadaten
      const { data, error } = await window.supabase
        .from('grid_documents')
        .select('*')
        .eq('id', documentId)
        .single();

      if (error) throw error;

      if (!data) {
        alert('Tabelle nicht gefunden');
        window.navigateTo('/tabellen');
        return;
      }

      // Setze Headline und Breadcrumb
      window.setHeadline(data.name);
      
      if (window.breadcrumbSystem) {
        window.breadcrumbSystem.updateDetailLabel(data.name);
      }

      // Erstelle und initialisiere Editor
      this.currentEditor = new GridEditor(documentId, data.name, data.metadata || {});
      await this.currentEditor.init(this.container);

    } catch (error) {
      console.error('❌ Fehler beim Laden des Editors:', error);
      alert('Fehler beim Laden der Tabelle');
      window.navigateTo('/tabellen');
    }
  }

  // Hilfsfunktionen
  formatDate(dateString) {
    const date = new Date(dateString);
    return date.toLocaleDateString('de-DE', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  }

  escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  // Cleanup
  destroy() {
    console.log('🗑️ TabellenModule: Destroy aufgerufen');
    
    // Entferne grid-view CSS-Klasse
    if (this.container) {
      this.container.classList.remove('grid-view-active');
    }
    const mainContent = document.querySelector('.main-content');
    if (mainContent) {
      mainContent.classList.remove('grid-view-active');
    }
    
    if (this.currentEditor) {
      this.currentEditor.destroy();
      this.currentEditor = null;
    }
    
    if (this.container) {
      this.container.innerHTML = '';
    }
  }
}

// Exportiere Instanz
export const tabellenModule = new TabellenModule();

