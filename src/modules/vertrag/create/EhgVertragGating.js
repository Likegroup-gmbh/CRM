// EhgVertragGating.js
// EHG-Vertrag = UGC-Vertragstemplate nur fuer EHG GmbH & Co. KG.
// LikeGroup ist Vertragspartei, EHG ist Drittbeguenstigte.
// Erkennung per fester Unternehmens-ID oder exaktem Firmennamen (kein Teilstring).

import { VertraegeCreate } from './VertraegeCreateCore.js';

export const EHG_UNTERNEHMEN_ID = '0d40d557-cda3-4262-86c4-aab1b9692f21';
export const EHG_FIRMENNAME_NORMALIZED = 'ehg gmbh & co. kg';

export const EHG_ANSCHRIFT = {
  name: 'EHG GmbH & Co. KG',
  strasse: 'Hugo-Ernsting-Platz 1',
  plz: '48653',
  stadt: 'Coesfeld'
};

export const EHG_FELD_NAMEN = [
  'ehg_marke_id',
  'ehg_marke_name',
  'ehg_produkt_id',
  'ehg_produkt_name',
  'ehg_ansprechpartner_id',
  'ehg_ansprechpartner',
  'ehg_content_sonstiges',
  'ehg_lieferbestandteile',
  'ehg_technische_vorgaben',
  'ehg_entwurf_bis',
  'ehg_nutzungen',
  'ehg_nutzung_sonstiges',
  'ehg_persoenlichkeitsrechte',
  'ehg_gebiet',
  'ehg_gebiet_sonstiges',
  'ehg_dauer_organic',
  'ehg_dauer_organic_sonstiges',
  'ehg_dauer_paid',
  'ehg_dauer_paid_sonstiges',
  'ehg_ust',
  'ehg_zusatzleistungen',
  'ehg_produkte_verbleiben',
  'ehg_unterlagen',
  'ehg_unterlagen_sonstiges',
  'ehg_unterlagen_bezeichnung',
  'ehg_unterlagen_weg',
  'ehg_unterlagen_datum',
  'ehg_unterschrift_ort',
  'ehg_unterschrift_datum'
];

export function normalizeFirmenname(name) {
  return (name || '').trim().toLowerCase().replace(/\s+/g, ' ');
}

export function isEhgKunde(unternehmen, kundeId) {
  if (!kundeId) return false;
  if (kundeId === EHG_UNTERNEHMEN_ID) return true;
  const kunde = (unternehmen || []).find(u => u.id === kundeId);
  return normalizeFirmenname(kunde?.firmenname) === EHG_FIRMENNAME_NORMALIZED;
}

export function mappedEhgKonzeption(contentErstellungArt) {
  if (contentErstellungArt === 'skript_fertig') return ['skript_gestellt'];
  if (contentErstellungArt === 'briefing_direkt') return ['umsetzung_briefing'];
  if (contentErstellungArt === 'briefing_skript' || contentErstellungArt === 'eigenstaendig') {
    return ['creator_konzeption'];
  }
  return [];
}

export function mappedEhgLieferbestandteile(vertrag, ehgFelder = {}) {
  const out = [];
  if (vertrag.lieferung_art === 'fertig_geschnitten') out.push('finaler_schnitt');
  if (vertrag.lieferung_art === 'raw_cut') out.push('rohschnitt');
  if (vertrag.lieferung_art === 'rohmaterial' || vertrag.rohmaterial_enthalten) out.push('rohmaterial');
  if (vertrag.untertitel) out.push('untertitel');
  (ehgFelder.lieferbestandteile || []).forEach((item) => {
    if (item && !out.includes(item)) out.push(item);
  });
  return out;
}

export function ehgKampagneAnzeige(kampagne, getDisplayName) {
  if (!kampagne) return '';
  if (typeof getDisplayName === 'function') return getDisplayName(kampagne) || '';
  return kampagne.eigener_name || kampagne.kampagnenname || '';
}

export function ehgCreatorAnzeige(creator, extractHandle) {
  if (!creator) return '';
  const name = `${creator.vorname || ''} ${creator.nachname || ''}`.trim();
  const raw = creator.instagram || creator.tiktok || '';
  const extracted = typeof extractHandle === 'function' ? extractHandle(raw) : String(raw || '').replace(/^@/, '');
  const handle = extracted ? (String(extracted).startsWith('@') ? extracted : `@${extracted}`) : '';
  return [name, handle].filter(Boolean).join(' ');
}

export function ehgMarkeProduktAnzeige(ehgFelder = {}, marken = [], produkte = []) {
  const markeName = ehgFelder.marke_name
    || (marken || []).find(m => m.id === ehgFelder.marke_id)?.markenname
    || '';
  const produktName = ehgFelder.produkt_name
    || (produkte || []).find(p => p.id === ehgFelder.produkt_id)?.name
    || '';
  return [markeName, produktName].filter(Boolean).join(' / ');
}

export function collectEhgFelder(formData, parseCurrency) {
  return {
    marke_id: formData.ehg_marke_id || null,
    marke_name: formData.ehg_marke_name || null,
    produkt_id: formData.ehg_produkt_id || null,
    produkt_name: formData.ehg_produkt_name || null,
    ansprechpartner_id: formData.ehg_ansprechpartner_id || null,
    ansprechpartner: formData.ehg_ansprechpartner || null,
    content_sonstiges: formData.ehg_content_sonstiges || null,
    lieferbestandteile: formData.ehg_lieferbestandteile || [],
    technische_vorgaben: formData.ehg_technische_vorgaben || null,
    entwurf_bis: formData.ehg_entwurf_bis || null,
    nutzungen: formData.ehg_nutzungen || [],
    nutzung_sonstiges: formData.ehg_nutzung_sonstiges || null,
    persoenlichkeitsrechte: formData.ehg_persoenlichkeitsrechte || [],
    gebiet: formData.ehg_gebiet || null,
    gebiet_sonstiges: formData.ehg_gebiet_sonstiges || null,
    dauer_organic: formData.ehg_dauer_organic || null,
    dauer_organic_sonstiges: formData.ehg_dauer_organic_sonstiges || null,
    dauer_paid: formData.ehg_dauer_paid || null,
    dauer_paid_sonstiges: formData.ehg_dauer_paid_sonstiges || null,
    ust: formData.ehg_ust || null,
    zusatzleistungen: formData.ehg_zusatzleistungen || null,
    produkte_verbleiben: !!formData.ehg_produkte_verbleiben,
    unterlagen: formData.ehg_unterlagen || [],
    unterlagen_sonstiges: formData.ehg_unterlagen_sonstiges || null,
    unterlagen_bezeichnung: formData.ehg_unterlagen_bezeichnung || null,
    unterlagen_weg: formData.ehg_unterlagen_weg || null,
    unterlagen_datum: formData.ehg_unterlagen_datum || null,
    unterschrift_ort: formData.ehg_unterschrift_ort || 'Frankfurt am Main',
    unterschrift_datum: formData.ehg_unterschrift_datum || new Date().toISOString().split('T')[0],
    verguetung_netto: typeof parseCurrency === 'function'
      ? parseCurrency(formData.verguetung_netto)
      : (formData.verguetung_netto ?? null)
  };
}

function todayIso() {
  return new Date().toISOString().split('T')[0];
}

function escapeAttr(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;');
}

function kampagneMarkeId(kampagne) {
  return kampagne?.marke?.id || kampagne?.marke_id || null;
}

function produktPasstZuMarke(produkt, markeId) {
  if (!markeId) return true;
  return (produkt.marken || []).some(m => m.marke_id === markeId || m.marke?.id === markeId);
}

VertraegeCreate.prototype.isEhgKunde = function() {
  return isEhgKunde(this.unternehmen, this.formData?.kunde_unternehmen_id);
};

VertraegeCreate.prototype.getEhgKampagneAnzeige = function() {
  const kampagne = (this.kampagnen || []).find(k => k.id === this.formData.kampagne_id);
  return ehgKampagneAnzeige(kampagne, (k) => this.getKampagneDisplayName(k));
};

VertraegeCreate.prototype.getEhgCreatorAnzeige = function() {
  const creator = (this.creators || []).find(c => c.id === this.formData.creator_id);
  return ehgCreatorAnzeige(creator, (v) => this._extractHandle?.(v) || '');
};

VertraegeCreate.prototype.filteredEhgProdukte = function() {
  const markeId = this.formData.ehg_marke_id;
  return (this.ehgProdukte || []).filter(p => produktPasstZuMarke(p, markeId));
};

VertraegeCreate.prototype.loadEhgKundenStammdaten = async function() {
  const kundeId = this.formData?.kunde_unternehmen_id;
  if (!kundeId || !window.supabase || !this.isEhgKunde()) {
    this.ehgMarken = [];
    this.ehgProdukte = [];
    this.ehgMitarbeiter = [];
    this._ehgStammdatenKundeId = null;
    return;
  }
  if (this._ehgStammdatenKundeId === kundeId && (this.ehgMarken || []).length) return;

  try {
    const [markenRes, produkteRes, mitarbeiterRes] = await Promise.all([
      window.supabase.from('marke').select('id, markenname').eq('unternehmen_id', kundeId).order('markenname'),
      window.supabase.from('produkt').select('id, name, marken:produkt_marke(marke_id)').eq('unternehmen_id', kundeId).order('name'),
      window.supabase.from('mitarbeiter_unternehmen').select('mitarbeiter_id, benutzer:mitarbeiter_id(id, name)').eq('unternehmen_id', kundeId)
    ]);
    this.ehgMarken = markenRes.data || [];
    this.ehgProdukte = produkteRes.data || [];
    const seen = new Set();
    this.ehgMitarbeiter = (mitarbeiterRes.data || []).reduce((list, row) => {
      const id = row.benutzer?.id || row.mitarbeiter_id;
      if (!id || seen.has(id)) return list;
      seen.add(id);
      list.push({ id, name: row.benutzer?.name || '' });
      return list;
    }, []).sort((a, b) => a.name.localeCompare(b.name, 'de'));
    this._ehgStammdatenKundeId = kundeId;
  } catch (error) {
    console.error('❌ EHG-Stammdaten konnten nicht geladen werden:', error);
    this.ehgMarken = this.ehgMarken || [];
    this.ehgProdukte = this.ehgProdukte || [];
    this.ehgMitarbeiter = this.ehgMitarbeiter || [];
  }
};

VertraegeCreate.prototype.updateEhgProjektblattKopf = function(opts = {}) {
  if (!this.isEhgKunde()) return;

  const kampagne = (this.kampagnen || []).find(k => k.id === this.formData.kampagne_id);
  const defaultMarkeId = kampagneMarkeId(kampagne);
  if (defaultMarkeId && (opts.syncMarkeFromKampagne || !this.formData.ehg_marke_id)) {
    this.formData.ehg_marke_id = defaultMarkeId;
  }
  if (this.formData.ehg_marke_id) {
    const marke = (this.ehgMarken || []).find(m => m.id === this.formData.ehg_marke_id);
    if (marke) this.formData.ehg_marke_name = marke.markenname;
  }
  if (this.formData.ehg_produkt_id && !this.filteredEhgProdukte().some(p => p.id === this.formData.ehg_produkt_id)) {
    this.formData.ehg_produkt_id = '';
    this.formData.ehg_produkt_name = '';
  } else if (this.formData.ehg_produkt_id) {
    const produkt = (this.ehgProdukte || []).find(p => p.id === this.formData.ehg_produkt_id);
    if (produkt) this.formData.ehg_produkt_name = produkt.name;
  }

  if (!this.formData.ehg_unterschrift_ort) this.formData.ehg_unterschrift_ort = 'Frankfurt am Main';
  if (!this.formData.ehg_unterschrift_datum) this.formData.ehg_unterschrift_datum = todayIso();

  const projektEl = document.getElementById('ehg_projekt_anzeige');
  if (projektEl) projektEl.value = this.getEhgKampagneAnzeige();
  const creatorEl = document.getElementById('ehg_creator_anzeige');
  if (creatorEl) creatorEl.value = this.getEhgCreatorAnzeige();
  this.refreshEhgKopfSelects();
};

VertraegeCreate.prototype.refreshEhgKopfSelects = function() {
  const markeSelect = document.getElementById('ehg_marke_id');
  if (markeSelect) {
    markeSelect.innerHTML = this._ehgMarkeOptionsHtml();
    markeSelect.value = this.formData.ehg_marke_id || '';
  }
  this.refreshEhgProduktSelect();
  const apSelect = document.getElementById('ehg_ansprechpartner_id');
  if (apSelect) {
    const mitarbeiter = this.ehgMitarbeiter || [];
    apSelect.disabled = mitarbeiter.length === 0;
    apSelect.innerHTML = this._ehgMitarbeiterOptionsHtml();
    apSelect.value = this.formData.ehg_ansprechpartner_id || '';
    const hint = document.getElementById('ehg_ansprechpartner_hint');
    if (hint) hint.classList.toggle('hidden', mitarbeiter.length > 0);
  }
};

VertraegeCreate.prototype.refreshEhgProduktSelect = function() {
  const produktSelect = document.getElementById('ehg_produkt_id');
  if (!produktSelect) return;
  produktSelect.innerHTML = this._ehgProduktOptionsHtml();
  produktSelect.value = this.formData.ehg_produkt_id || '';
};

VertraegeCreate.prototype._ehgMarkeOptionsHtml = function() {
  const selected = this.formData.ehg_marke_id || '';
  const options = (this.ehgMarken || []).map(m =>
    `<option value="${escapeAttr(m.id)}" ${m.id === selected ? 'selected' : ''}>${escapeAttr(m.markenname)}</option>`
  ).join('');
  return `<option value="">Marke auswählen...</option>${options}`;
};

VertraegeCreate.prototype._ehgProduktOptionsHtml = function() {
  const selected = this.formData.ehg_produkt_id || '';
  const options = this.filteredEhgProdukte().map(p =>
    `<option value="${escapeAttr(p.id)}" ${p.id === selected ? 'selected' : ''}>${escapeAttr(p.name)}</option>`
  ).join('');
  return `<option value="">Produkt auswählen...</option>${options}`;
};

VertraegeCreate.prototype._ehgMitarbeiterOptionsHtml = function() {
  const selected = this.formData.ehg_ansprechpartner_id || '';
  const mitarbeiter = this.ehgMitarbeiter || [];
  if (mitarbeiter.length === 0) {
    return '<option value="">Kein Teammitglied diesem Kunden zugeordnet</option>';
  }
  const options = mitarbeiter.map(m =>
    `<option value="${escapeAttr(m.id)}" ${m.id === selected ? 'selected' : ''}>${escapeAttr(m.name)}</option>`
  ).join('');
  return `<option value="">Teammitglied auswählen...</option>${options}`;
};

VertraegeCreate.prototype._bindEhgKopfEvents = function() {
  const markeSelect = document.getElementById('ehg_marke_id');
  if (markeSelect && !markeSelect.dataset.ehgBound) {
    markeSelect.dataset.ehgBound = '1';
    markeSelect.addEventListener('change', (e) => {
      this.formData.ehg_marke_id = e.target.value;
      const marke = (this.ehgMarken || []).find(m => m.id === e.target.value);
      this.formData.ehg_marke_name = marke?.markenname || '';
      this.formData.ehg_produkt_id = '';
      this.formData.ehg_produkt_name = '';
      this.refreshEhgProduktSelect();
    });
  }
  const produktSelect = document.getElementById('ehg_produkt_id');
  if (produktSelect && !produktSelect.dataset.ehgBound) {
    produktSelect.dataset.ehgBound = '1';
    produktSelect.addEventListener('change', (e) => {
      this.formData.ehg_produkt_id = e.target.value;
      const produkt = (this.ehgProdukte || []).find(p => p.id === e.target.value);
      this.formData.ehg_produkt_name = produkt?.name || '';
    });
  }
  const apSelect = document.getElementById('ehg_ansprechpartner_id');
  if (apSelect && !apSelect.dataset.ehgBound) {
    apSelect.dataset.ehgBound = '1';
    apSelect.addEventListener('change', (e) => {
      this.formData.ehg_ansprechpartner_id = e.target.value;
      const person = (this.ehgMitarbeiter || []).find(m => m.id === e.target.value);
      this.formData.ehg_ansprechpartner = person?.name || '';
    });
  }
};

VertraegeCreate.prototype.updateEhgSections = async function() {
  const show = this.selectedTyp === 'UGC' && this.isEhgKunde();
  document.querySelectorAll('.ehg-section').forEach(el => {
    el.classList.toggle('hidden', !show);
  });
  if (!show) {
    EHG_FELD_NAMEN.forEach(name => { delete this.formData[name]; });
    this.ehgMarken = [];
    this.ehgProdukte = [];
    this.ehgMitarbeiter = [];
    this._ehgStammdatenKundeId = null;
    if (this.formData.vertrag_template === 'ehg') {
      this.formData.vertrag_template = 'legacy';
    }
    if (typeof this.formData.ugc_pdf_variant === 'string' && this.formData.ugc_pdf_variant.startsWith('ehg-')) {
      this.formData.ugc_pdf_variant = 'legacy-de';
    }
    return;
  }
  await this.loadEhgKundenStammdaten();
  this.updateEhgProjektblattKopf();
  this._bindEhgKopfEvents();
};

function checked(formData, name, value) {
  return (formData[name] || []).includes(value) ? 'checked' : '';
}

function radio(formData, name, value) {
  return formData[name] === value ? 'checked' : '';
}

VertraegeCreate.prototype.renderEhgSection = function(step) {
  const hidden = this.isEhgKunde() ? '' : 'hidden';
  const fd = this.formData;

  if (step === 2) {
    return `
      <div class="step-section ehg-section ${hidden}">
        <div class="step-section__header">
          <h3>EHG-Vertrag — Projektblatt</h3>
          <p class="step-description">Nur für den EHG-Vertrag. Der Alte Vertrag ignoriert diese Felder.</p>
        </div>
        <div class="form-two-col">
          <div class="form-field">
            <label for="ehg_projekt_anzeige">Projekt / Kampagne</label>
            <input type="text" id="ehg_projekt_anzeige" readonly class="readonly-field"
                   value="${escapeAttr(this.getEhgKampagneAnzeige())}"
                   placeholder="Wird aus der Kampagne übernommen">
          </div>
          <div class="form-field">
            <label for="ehg_creator_anzeige">Creator / Handle</label>
            <input type="text" id="ehg_creator_anzeige" readonly class="readonly-field"
                   value="${escapeAttr(this.getEhgCreatorAnzeige())}"
                   placeholder="Wird aus dem Creator übernommen">
          </div>
        </div>
        <div class="form-two-col">
          <div class="form-field">
            <label for="ehg_marke_id">Marke</label>
            <select id="ehg_marke_id" name="ehg_marke_id">
              ${this._ehgMarkeOptionsHtml()}
            </select>
          </div>
          <div class="form-field">
            <label for="ehg_produkt_id">Produkt</label>
            <select id="ehg_produkt_id" name="ehg_produkt_id">
              ${this._ehgProduktOptionsHtml()}
            </select>
          </div>
        </div>
        <div class="form-field">
          <label for="ehg_ansprechpartner_id">Ansprechpartner Agentur</label>
          <select id="ehg_ansprechpartner_id" name="ehg_ansprechpartner_id" ${(this.ehgMitarbeiter || []).length ? '' : 'disabled'}>
            ${this._ehgMitarbeiterOptionsHtml()}
          </select>
          <p id="ehg_ansprechpartner_hint" class="step-description ${(this.ehgMitarbeiter || []).length ? 'hidden' : ''}">Kein Teammitglied diesem Kunden zugeordnet.</p>
        </div>
        <div class="form-two-col">
          <div class="form-field">
            <label for="ehg_unterschrift_ort">Ort (Unterschrift)</label>
            <input type="text" id="ehg_unterschrift_ort" name="ehg_unterschrift_ort" value="${fd.ehg_unterschrift_ort || 'Frankfurt am Main'}">
          </div>
          <div class="form-field">
            <label for="ehg_unterschrift_datum">Datum (Unterschrift)</label>
            <input type="date" id="ehg_unterschrift_datum" name="ehg_unterschrift_datum" value="${fd.ehg_unterschrift_datum || todayIso()}">
          </div>
        </div>
      </div>
    `;
  }

  if (step === 3) {
    return `
      <div class="step-section ehg-section ${hidden}">
        <div class="step-section__header">
          <h3>EHG-Projektblatt — Leistung</h3>
        </div>
        <div class="form-field">
          <label for="ehg_content_sonstiges">Sonstiger Content</label>
          <input type="text" id="ehg_content_sonstiges" name="ehg_content_sonstiges" value="${fd.ehg_content_sonstiges || ''}">
        </div>
        <div class="form-field">
          <label class="checkbox-label">
            <input type="checkbox" name="ehg_lieferbestandteile" value="thumbnail" ${checked(fd, 'ehg_lieferbestandteile', 'thumbnail')}>
            <span>Thumbnail / Cover</span>
          </label>
        </div>
        <div class="form-field">
          <label for="ehg_technische_vorgaben">Technische Vorgaben / Format</label>
          <textarea id="ehg_technische_vorgaben" name="ehg_technische_vorgaben" rows="2">${fd.ehg_technische_vorgaben || ''}</textarea>
        </div>
        <div class="form-field">
          <label for="ehg_entwurf_bis">Entwurf bis</label>
          <input type="date" id="ehg_entwurf_bis" name="ehg_entwurf_bis" value="${fd.ehg_entwurf_bis || ''}">
        </div>
      </div>
    `;
  }

  if (step === 4) {
    const nutzungen = [
      ['organic_social', 'Organic Social Media'],
      ['organic_youtube', 'Organic YouTube'],
      ['paid_youtube', 'Paid YouTube'],
      ['paid_media', 'Paid Media / Paid Social (EHG oder Dienstleister)'],
      ['website', 'Website / Onlineshop / App'],
      ['newsletter', 'Newsletter / CRM'],
      ['intern', 'Interne Kommunikation / Präsentation'],
      ['whitelisting', 'Whitelisting über Account des Creators'],
      ['partnership_ads', 'Partnership Ads / Branded Content Ads'],
      ['pr', 'PR / Presse / Unternehmenskommunikation'],
      ['print', 'Print / Katalog / Flyer / POS'],
      ['aussenwerbung', 'Außenwerbung']
    ];
    const rechte = [
      ['name', 'Name / Pseudonym'],
      ['handle', 'Social-Media-Handle'],
      ['stills', 'Einzelbilder / Thumbnail'],
      ['bio', 'Biografische Angaben'],
      ['credit', 'Credit / Namensnennung']
    ];
    return `
      <div class="step-section ehg-section ${hidden}">
        <div class="step-section__header">
          <h3>EHG-Projektblatt — Nutzung</h3>
          <p class="step-description">Es gelten ausschließlich die angekreuzten Nutzungen.</p>
        </div>
        <div class="form-field">
          <label>Nutzungsumfang</label>
          <div class="checkbox-group">
            ${nutzungen.map(([value, label]) => `
              <label class="checkbox-label">
                <input type="checkbox" name="ehg_nutzungen" value="${value}" ${checked(fd, 'ehg_nutzungen', value)}>
                <span>${label}</span>
              </label>
            `).join('')}
          </div>
        </div>
        <div class="form-field">
          <label for="ehg_nutzung_sonstiges">Sonstige Nutzung</label>
          <input type="text" id="ehg_nutzung_sonstiges" name="ehg_nutzung_sonstiges" value="${fd.ehg_nutzung_sonstiges || ''}">
        </div>
        <div class="form-field">
          <label>Rechte an Person oder Identität</label>
          <div class="checkbox-group">
            ${rechte.map(([value, label]) => `
              <label class="checkbox-label">
                <input type="checkbox" name="ehg_persoenlichkeitsrechte" value="${value}" ${checked(fd, 'ehg_persoenlichkeitsrechte', value)}>
                <span>${label}</span>
              </label>
            `).join('')}
          </div>
        </div>
        <div class="form-field">
          <label>Gebiet</label>
          <div class="radio-group">
            <label class="radio-option"><input type="radio" name="ehg_gebiet" value="weltweit" ${radio(fd, 'ehg_gebiet', 'weltweit')}><span>Weltweit</span></label>
            <label class="radio-option"><input type="radio" name="ehg_gebiet" value="deutschland" ${radio(fd, 'ehg_gebiet', 'deutschland')}><span>Deutschland</span></label>
            <label class="radio-option"><input type="radio" name="ehg_gebiet" value="eu_ewr" ${radio(fd, 'ehg_gebiet', 'eu_ewr')}><span>EU / EWR</span></label>
            <label class="radio-option"><input type="radio" name="ehg_gebiet" value="sonstiges" ${radio(fd, 'ehg_gebiet', 'sonstiges')}><span>Sonstiges</span></label>
          </div>
        </div>
        <div class="form-field">
          <label for="ehg_gebiet_sonstiges">Gebiet sonstiges</label>
          <input type="text" id="ehg_gebiet_sonstiges" name="ehg_gebiet_sonstiges" value="${fd.ehg_gebiet_sonstiges || ''}">
        </div>
        <div class="form-field">
          <label>Dauer Organic</label>
          <div class="radio-group">
            <label class="radio-option"><input type="radio" name="ehg_dauer_organic" value="unbegrenzt" ${radio(fd, 'ehg_dauer_organic', 'unbegrenzt')}><span>Unbefristet</span></label>
            <label class="radio-option"><input type="radio" name="ehg_dauer_organic" value="sonstiges" ${radio(fd, 'ehg_dauer_organic', 'sonstiges')}><span>Sonstiges</span></label>
          </div>
        </div>
        <div class="form-field">
          <label for="ehg_dauer_organic_sonstiges">Dauer Organic sonstiges</label>
          <input type="text" id="ehg_dauer_organic_sonstiges" name="ehg_dauer_organic_sonstiges" value="${fd.ehg_dauer_organic_sonstiges || ''}">
        </div>
        <div class="form-field">
          <label>Dauer Paid</label>
          <div class="radio-group">
            <label class="radio-option"><input type="radio" name="ehg_dauer_paid" value="unbegrenzt" ${radio(fd, 'ehg_dauer_paid', 'unbegrenzt')}><span>Unbefristet</span></label>
            <label class="radio-option"><input type="radio" name="ehg_dauer_paid" value="6_monate" ${radio(fd, 'ehg_dauer_paid', '6_monate')}><span>6 Monate</span></label>
            <label class="radio-option"><input type="radio" name="ehg_dauer_paid" value="12_monate" ${radio(fd, 'ehg_dauer_paid', '12_monate')}><span>12 Monate</span></label>
            <label class="radio-option"><input type="radio" name="ehg_dauer_paid" value="24_monate" ${radio(fd, 'ehg_dauer_paid', '24_monate')}><span>24 Monate</span></label>
            <label class="radio-option"><input type="radio" name="ehg_dauer_paid" value="sonstiges" ${radio(fd, 'ehg_dauer_paid', 'sonstiges')}><span>Sonstiges</span></label>
          </div>
        </div>
        <div class="form-field">
          <label for="ehg_dauer_paid_sonstiges">Dauer Paid sonstiges</label>
          <input type="text" id="ehg_dauer_paid_sonstiges" name="ehg_dauer_paid_sonstiges" value="${fd.ehg_dauer_paid_sonstiges || ''}">
        </div>
      </div>
    `;
  }

  if (step === 5) {
    return `
      <div class="step-section ehg-section ${hidden}">
        <div class="step-section__header">
          <h3>EHG-Projektblatt — Vergütung & Unterlagen</h3>
        </div>
        <div class="form-field">
          <label>Umsatzsteuer</label>
          <div class="radio-group">
            <label class="radio-option"><input type="radio" name="ehg_ust" value="faellt_an" ${radio(fd, 'ehg_ust', 'faellt_an')}><span>Fällt an</span></label>
            <label class="radio-option"><input type="radio" name="ehg_ust" value="kleinunternehmer" ${radio(fd, 'ehg_ust', 'kleinunternehmer')}><span>Fällt nicht an / Kleinunternehmerregelung</span></label>
          </div>
        </div>
        <div class="form-field">
          <label for="ehg_zusatzleistungen">Zusatzleistungen / Auslagen</label>
          <textarea id="ehg_zusatzleistungen" name="ehg_zusatzleistungen" rows="2">${fd.ehg_zusatzleistungen || ''}</textarea>
        </div>
        <div class="form-field">
          <label class="checkbox-label">
            <input type="checkbox" name="ehg_produkte_verbleiben" value="true" ${fd.ehg_produkte_verbleiben ? 'checked' : ''}>
            <span>Bereitgestellte Produkte verbleiben beim Creator</span>
          </label>
        </div>
        <div class="form-field">
          <label>Verbindliche Unterlagen</label>
          <div class="checkbox-group">
            <label class="checkbox-label"><input type="checkbox" name="ehg_unterlagen" value="briefing" ${checked(fd, 'ehg_unterlagen', 'briefing')}><span>Briefing</span></label>
            <label class="checkbox-label"><input type="checkbox" name="ehg_unterlagen" value="dos_donts" ${checked(fd, 'ehg_unterlagen', 'dos_donts')}><span>Do’s & Don’ts</span></label>
            <label class="checkbox-label"><input type="checkbox" name="ehg_unterlagen" value="technisch" ${checked(fd, 'ehg_unterlagen', 'technisch')}><span>Technische Vorgaben</span></label>
            <label class="checkbox-label"><input type="checkbox" name="ehg_unterlagen" value="sonstiges" ${checked(fd, 'ehg_unterlagen', 'sonstiges')}><span>Sonstiges</span></label>
          </div>
        </div>
        <div class="form-field">
          <label for="ehg_unterlagen_sonstiges">Unterlage sonstiges</label>
          <input type="text" id="ehg_unterlagen_sonstiges" name="ehg_unterlagen_sonstiges" value="${fd.ehg_unterlagen_sonstiges || ''}">
        </div>
        <div class="form-field">
          <label for="ehg_unterlagen_bezeichnung">Bezeichnung, Datum und Version</label>
          <input type="text" id="ehg_unterlagen_bezeichnung" name="ehg_unterlagen_bezeichnung" value="${fd.ehg_unterlagen_bezeichnung || ''}">
        </div>
        <div class="form-field">
          <label>Übermittlung</label>
          <div class="radio-group">
            <label class="radio-option"><input type="radio" name="ehg_unterlagen_weg" value="beigefuegt" ${radio(fd, 'ehg_unterlagen_weg', 'beigefuegt')}><span>Beigefügt</span></label>
            <label class="radio-option"><input type="radio" name="ehg_unterlagen_weg" value="elektronisch" ${radio(fd, 'ehg_unterlagen_weg', 'elektronisch')}><span>Elektronisch übermittelt</span></label>
          </div>
        </div>
        <div class="form-field">
          <label for="ehg_unterlagen_datum">Elektronisch übermittelt am</label>
          <input type="date" id="ehg_unterlagen_datum" name="ehg_unterlagen_datum" value="${fd.ehg_unterlagen_datum || ''}">
        </div>
      </div>
    `;
  }

  return '';
};
