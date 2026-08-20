// BriefingCreateCore.js
// Kern des Briefing-Generators: Klassen-Shell, State, Initialisierung,
// Stammdaten, Draft-Load, Lifecycle. Weitere Methoden werden per
// Prototype-Extension angehangen (RenderShell, FormEvents, DataPersistence).
// Struktur 1:1 wie src/modules/vertrag/create/.

export class BriefingCreate {
  constructor() {
    this.currentStep = 1;      // 1 = Typ-Auswahl, 2..n = Content-Steps
    this.selectedBereich = null;
    this.formData = {};
    this.unternehmen = [];
    this.marken = [];
    this.benutzer = [];
    this.isGenerated = false;
    this.editId = null;
    this._isRendering = false;
    this._isInitializing = false;
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
  }

  this.render();
};

BriefingCreate.prototype.applyQueryPrefill = function() {
  const params = new URLSearchParams(window.location.search);
  const unternehmen = params.get('unternehmen');
  const marke = params.get('marke');

  if (unternehmen) this.formData.unternehmen_id = unternehmen;
  if (marke) this.formData.marke_id = marke;
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
  } catch (error) {
    console.error('Fehler beim Laden der Stammdaten:', error);
  }
};

BriefingCreate.prototype.resetForm = function() {
  this.currentStep = 1;
  this.selectedBereich = null;
  this.formData = {};
  this.isGenerated = false;
  this.editId = null;
  this._isRendering = false;
  this._isInitializing = false;
};

BriefingCreate.prototype.destroy = function() {
  this.resetForm();
  const progressContainer = document.getElementById('briefing-progress-container');
  if (progressContainer) {
    progressContainer.remove();
  }
};
