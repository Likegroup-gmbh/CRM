// BriefingCreateCore.js
// Kern des Briefing-Generators: Klassen-Shell, State, Initialisierung,
// Stammdaten, Draft-Load, Lifecycle. Weitere Methoden werden per
// Prototype-Extension angehangen (RenderShell, FormEvents, DataPersistence).
// Struktur 1:1 wie src/modules/vertrag/create/.

import { loadProdukteForBriefing } from '../BriefingProdukte.js';
import { OHNE_QUERY } from '../BriefingFolders.js';

export class BriefingCreate {
  constructor() {
    this.currentStep = 1;      // 1 = Typ-Auswahl, 2..n = Content-Steps
    this.selectedBereich = null;
    this.formData = {};
    this.unternehmen = [];
    this.marken = [];
    this.kampagnen = [];
    this.benutzer = [];
    this.produkte = [];
    this._linieGesperrt = false;
    this.isGenerated = false;
    this.editId = null;
    this._isRendering = false;
    this._isInitializing = false;
    this.likyPanel = null;
  }
}

BriefingCreate.prototype.getBriefingPermissions = function() {
  const isAdmin = window.isAdmin();
  const perms = window.currentUser?.permissions?.briefing || {};
  return {
    isAdmin,
    canEdit: isAdmin || perms.can_edit === true,
    canView: isAdmin || perms.can_view === true
  };
};

BriefingCreate.prototype.init = async function(editId = null) {
  this.editId = editId;

  window.setHeadline(editId ? 'Briefing bearbeiten' : 'Neues Briefing');

  if (window.breadcrumbSystem) {
    window.breadcrumbSystem.updateDetailLabel(editId ? 'Bearbeiten' : 'Neues Briefing');
  }

  const { canEdit } = this.getBriefingPermissions();
  if (!canEdit) {
    window.content.innerHTML = `
      <div class="error-message">
        <p>Sie haben keine Berechtigung, Briefings zu ${editId ? 'bearbeiten' : 'erstellen'}.</p>
      </div>
    `;
    return;
  }

  await this.loadStammdaten();

  if (editId) {
    await this.loadFromDB(editId);
  } else {
    this.applyQueryPrefill();
    await this.refreshProdukte();
  }

  this.render();
};

BriefingCreate.prototype.applyQueryPrefill = function() {
  const params = new URLSearchParams(window.location.search);
  const unternehmen = params.get('unternehmen');
  const marke = params.get('marke');
  const kampagne = params.get('kampagne');
  const produkt = params.get('produkt');
  const titel = params.get('titel');
  const produktion = params.get('produktion');

  if (unternehmen) this.formData.unternehmen_id = unternehmen;
  if (marke && marke !== OHNE_QUERY) this.formData.marke_id = marke;
  if (titel) this.formData.aktivierung_name = titel;
  if (kampagne) this.formData.kampagne_id = kampagne;
  if (produkt) this.formData.produkt_id = produkt;
  this._linieGesperrt = !!(kampagne && produkt);
  this._produktionKontext = (kampagne && produkt)
    ? { kampagneId: kampagne, produktId: produkt, produktionId: produktion || null }
    : null;
};

BriefingCreate.prototype.loadStammdaten = async function() {
  if (!window.supabase) return;

  try {
    const { data: unternehmen } = await window.supabase
      .from('unternehmen')
      .select('id, firmenname')
      .order('firmenname');
    this.unternehmen = unternehmen || [];

    const { data: marken } = await window.supabase
      .from('marke')
      .select('id, markenname, unternehmen_id')
      .order('markenname');
    this.marken = marken || [];

    const { data: benutzer } = await window.supabase
      .from('benutzer')
      .select('id, name')
      .order('name');
    this.benutzer = benutzer || [];

    const { data: kampagnen } = await window.supabase
      .from('kampagne')
      .select('id, kampagnenname, eigener_name, unternehmen_id, marke_id')
      .order('kampagnenname');
    this.kampagnen = (kampagnen || []).map(k => ({
      id: k.id,
      label: k.eigener_name || k.kampagnenname || 'Unbenannte Kampagne',
      unternehmen_id: k.unternehmen_id,
      marke_id: k.marke_id
    }));
    await this.refreshProdukte();
  } catch (error) {
    console.error('Fehler beim Laden der Stammdaten:', error);
  }
};

BriefingCreate.prototype.refreshProdukte = async function() {
  try {
    this.produkte = await loadProdukteForBriefing(
      this.formData.unternehmen_id,
      this.formData.marke_id
    );
  } catch (error) {
    console.error('Fehler beim Laden der Produkte:', error);
    this.produkte = [];
  }
};

BriefingCreate.prototype.resetForm = function() {
  this.currentStep = 1;
  this.selectedBereich = null;
  this.formData = {};
  this.isGenerated = false;
  this.editId = null;
  this._linieGesperrt = false;
  this._produktionKontext = null;
  this._isRendering = false;
  this._isInitializing = false;
  this.likyPanel = null;
};

BriefingCreate.prototype.destroy = function() {
  if (this.likyPanel) {
    this.likyPanel.destroy();
  }
  this.resetForm();
  const progressContainer = document.getElementById('briefing-progress-container');
  if (progressContainer) {
    progressContainer.remove();
  }
};
