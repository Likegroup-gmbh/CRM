// TabellenModule.js
// Übersichtsseite: Liste aller Grid-Dokumente

import { GridEditor } from './GridEditor.js';
import { icon } from '../../core/icons/IconSystem.js';

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
          <button class="mdc-btn" id="new-table-btn">
            ${icon('plus-lg', { className: 'icon-20' })}
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
          ${icon('table-grid')}
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
            ${icon('external-link')}
          </button>
          <button class="btn-icon delete-doc-btn" data-id="${doc.id}" title="Löschen">
            ${icon('trash-alt')}
          </button>
        </div>
      </div>
    `).join('');
  }

  // Empty State wenn keine Dokumente
  renderEmptyState() {
    return `
      <div class="empty-state">
        ${icon('table-grid')}
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

