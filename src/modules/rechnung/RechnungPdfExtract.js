// RechnungPdfExtract.js
// Upload-first-Auslesung der Creator-Rechnung (ADR 0016): PDF an den Anfang
// des Anlege-Formulars, Liky liest Betraege/Datum/Steuer aus und fuellt nur
// leere Felder vor. Die Kooperation wird als Vorschlag MIT Begruendung
// angeboten und nie still vorausgewaehlt. Assistenz, kein Gate: bei
// Misserfolg bleibt das Formular unveraendert manuell nutzbar, und die PDF
// haengt bereits am pdf_file-Uploader des Formulars.

import { ladeAbrechenbarkeit } from '../../core/budget/koopAbrechenbarkeitLaden.js';
import { applySearchableSelection } from '../../core/form/logic/FormSearchableSelect.js';
import { escapeHtml, formatEuro } from '../../core/format.js';
import { KampagneUtils } from '../kampagne/KampagneUtils.js';

const ENDPOINT = '/.netlify/functions/rechnung-pdf-background';
const POLL_INTERVAL_MS = 2000;
const POLL_TIMEOUT_MS = 3 * 60 * 1000;
const MAX_FILE_SIZE = 10 * 1024 * 1024;

export function renderRechnungExtractCard() {
  return `
    <div class="rechnung-extract-card" id="rechnung-extract-card">
      <div class="uploader-drop rechnung-extract-drop" id="rechnung-extract-drop" tabindex="0">
        <div class="uploader-instructions">
          <strong>Rechnungs-PDF hier ablegen</strong>
          <span>Liky liest Beträge, Datum und Steuer aus und schlägt die Kooperation vor. Du prüfst nur noch.</span>
        </div>
        <button type="button" class="uploader-btn" id="rechnung-extract-btn">PDF auswählen</button>
        <input type="file" id="rechnung-extract-input" accept="application/pdf,.pdf" hidden>
      </div>
      <div class="rechnung-extract-status" id="rechnung-extract-status"></div>
      <div id="rechnung-koop-vorschlag"></div>
    </div>
  `;
}

export class RechnungPdfExtract {
  constructor() {
    this.form = null;
    this.extractedFields = null;
    this._reapplyOnNextPrefill = false;
    this._laeuft = false;
    this._wendetAn = false;
    this._manuellGeaendert = new Set();
  }

  bind(container, form) {
    this.form = form;
    const drop = container.querySelector('#rechnung-extract-drop');
    const input = container.querySelector('#rechnung-extract-input');
    const btn = container.querySelector('#rechnung-extract-btn');
    if (!drop || !input || !btn || !form) return;

    btn.addEventListener('click', () => input.click());
    drop.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); input.click(); }
    });
    input.addEventListener('change', () => {
      if (input.files?.length) this.handleFile(input.files[0]);
      input.value = '';
    });
    drop.addEventListener('dragover', (e) => {
      e.preventDefault();
      e.stopPropagation();
      drop.classList.add('is-dragover');
    });
    drop.addEventListener('dragleave', () => drop.classList.remove('is-dragover'));
    drop.addEventListener('drop', (e) => {
      e.preventDefault();
      e.stopPropagation();
      drop.classList.remove('is-dragover');
      const file = e.dataTransfer?.files?.[0];
      if (file) this.handleFile(file);
    });

    // Nach dem Uebernehmen des Kooperations-Vorschlags prefillt onKoopChange
    // die Betragsfelder. PDF-Werte kommen zurueck, ausser der Mitarbeiter
    // hat das Feld zwischen Auslesung und Uebernahme selbst geaendert.
    form.addEventListener('input', (e) => this.merkeManuelleAenderung(e));
    form.addEventListener('change', (e) => this.merkeManuelleAenderung(e));
    form.addEventListener('rechnung:koop-prefilled', () => {
      if (!this._reapplyOnNextPrefill || !this.extractedFields) return;
      this._reapplyOnNextPrefill = false;
      this.applyFields(this.extractedFields, { force: true, geschuetzt: this._manuellGeaendert });
    });
  }

  merkeManuelleAenderung(event) {
    if (this._wendetAn) return;
    const name = event.target?.name;
    if (name) this._manuellGeaendert.add(name);
  }

  setStatus(html, tone = 'info') {
    const el = document.getElementById('rechnung-extract-status');
    if (!el) return;
    el.innerHTML = html ? `<div class="notice-box notice-${tone}">${html}</div>` : '';
  }

  async handleFile(file) {
    if (this._laeuft) return;
    const istPdf = file.type === 'application/pdf' || /\.pdf$/i.test(file.name);
    if (!istPdf) {
      this.setStatus('<strong>Keine PDF.</strong> Bitte die Rechnung als PDF ablegen.', 'warning');
      return;
    }
    if (file.size > MAX_FILE_SIZE) {
      this.setStatus('<strong>PDF zu groß.</strong> Bitte unter 10 MB bleiben.', 'warning');
      return;
    }

    this._laeuft = true;
    this._manuellGeaendert = new Set();
    this.setStatus('Ich lese die Rechnung…');

    try {
      // Die PDF gehoert zur Rechnung: gleich an den Formular-Uploader haengen,
      // damit sie beim Speichern als Beleg mit hochgeladen wird.
      this.anFormUploaderHaengen(file);

      const { data: { user } } = await window.supabase.auth.getUser();
      if (!user) throw new Error('Keine aktive Sitzung');

      const path = `rechnung-extracts/${user.id}/${crypto.randomUUID()}.pdf`;
      const { error: uploadError } = await window.supabase.storage
        .from('documents')
        .upload(path, file, { upsert: false, contentType: 'application/pdf' });
      if (uploadError) throw new Error(`Upload fehlgeschlagen: ${uploadError.message}`);

      const result = await this.runJob(path);
      this.extractedFields = result.fields || {};
      const befuellt = this.applyFields(this.extractedFields);
      this.zeigeErgebnis(result, befuellt);
      if (result.creator_treffer?.length) {
        await this.zeigeKoopVorschlag(result.creator_treffer);
      }
    } catch (error) {
      console.warn('⚠️ Rechnungs-Auslesung fehlgeschlagen:', error);
      this.setStatus(
        `<strong>Konnte nicht gelesen werden.</strong> ${escapeHtml(error.message)}. `
        + 'Die PDF bleibt am Formular — bitte die Felder manuell ausfüllen.',
        'warning'
      );
    } finally {
      this._laeuft = false;
    }
  }

  // Uploader mounten sich per setTimeout(0) — kurz warten, falls noch nicht bereit.
  async anFormUploaderHaengen(file) {
    for (let i = 0; i < 10; i++) {
      const uploader = document.querySelector('.uploader[data-name="pdf_file"]')?.__uploaderInstance;
      if (uploader?.handleFiles) {
        uploader.handleFiles([file]);
        return;
      }
      await new Promise((r) => setTimeout(r, 100));
    }
    console.warn('⚠️ pdf_file-Uploader nicht gefunden — PDF nur fuer die Auslesung genutzt');
  }

  async runJob(pdfPath) {
    const session = await window.supabase.auth.getSession();
    const token = session?.data?.session?.access_token;
    if (!token) throw new Error('Keine aktive Sitzung');

    const { data: job, error: insertError } = await window.supabase
      .from('rechnung_pdf_jobs')
      .insert({ created_by: session.data.session.user.id })
      .select('id')
      .single();
    if (insertError) throw new Error(`Job konnte nicht angelegt werden: ${insertError.message}`);

    const response = await fetch(ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ jobId: job.id, pdfPath })
    });
    if (!response.ok) {
      throw new Error(`Liky konnte nicht gestartet werden (HTTP ${response.status})`);
    }

    return this.pollJob(job.id);
  }

  async pollJob(jobId) {
    const deadline = Date.now() + POLL_TIMEOUT_MS;
    while (Date.now() < deadline) {
      await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS));

      const { data: row, error } = await window.supabase
        .from('rechnung_pdf_jobs')
        .select('status, progress_step, progress_steps, result, error_message')
        .eq('id', jobId)
        .maybeSingle();
      if (error || !row) continue;

      if (row.status === 'running' && row.progress_step) {
        const steps = Array.isArray(row.progress_steps) ? row.progress_steps : [];
        const aktuell = steps.find((s) => s.key === row.progress_step);
        if (aktuell?.label) this.setStatus(escapeHtml(aktuell.label));
        continue;
      }
      if (row.status === 'done') {
        if (!row.result?.success) throw new Error(row.result?.error || 'Auslesung fehlgeschlagen');
        return row.result;
      }
      if (row.status === 'error') {
        throw new Error(row.error_message || 'Auslesung fehlgeschlagen');
      }
    }
    throw new Error('Zeitüberschreitung bei der Auslesung');
  }

  // Fuellt leere Felder. force=true (nach Kooperations-Uebernahme) schreibt
  // PDF-Betraege zurueck, die der Koop-Prefill ueberschrieben hat.
  // geschuetzt: Felder, die der Mitarbeiter danach selbst geaendert hat.
  applyFields(fields, { force = false, geschuetzt = null } = {}) {
    if (!this.form || !fields) return 0;
    this._wendetAn = true;
    try {
    let befuellt = 0;

    const darfSetzen = (name, input) => {
      if (geschuetzt?.has(name)) return false;
      if (!force && String(input.value ?? '').trim() !== '') return false;
      return true;
    };

    const setBetrag = (name, eintrag) => {
      const input = this.form.querySelector(`input[name="${name}"]`);
      if (!input || !eintrag || !darfSetzen(name, input)) return;
      input.value = Number(eintrag.value).toFixed(2);
      input.dispatchEvent(new Event('input', { bubbles: true }));
      befuellt++;
    };

    setBetrag('nettobetrag', fields.nettobetrag);
    setBetrag('zusatzkosten', fields.zusatzkosten);

    if (fields.nettobetrag_steuerfrei && Number(fields.nettobetrag_steuerfrei.value) > 0) {
      // Verstecktes Feld erst einblenden (Disclosure aufloesen)
      const input = this.form.querySelector('input[name="nettobetrag_steuerfrei"]');
      const wrapper = input?.closest('.form-row-group') || input?.closest('.form-field');
      wrapper?.classList.remove('form-row-group--hidden', 'form-field--hidden');
      this.form.querySelector('.steuerfrei-disclosure-btn')?.remove();
      setBetrag('nettobetrag_steuerfrei', fields.nettobetrag_steuerfrei);
    }

    if (fields.ksk_betrag && Number(fields.ksk_betrag.value) > 0) {
      setBetrag('ksk_betrag', fields.ksk_betrag);
    }

    // Steuer-Logik: PDF schlaegt Creator-Stammdaten (umsatzsteuerpflichtig),
    // nicht aber eine Korrektur des Mitarbeiters.
    if (fields.ust_ausgewiesen?.value === false && !geschuetzt?.has('ust_aktiv')) {
      const toggle = this.form.querySelector('input[name="ust_aktiv"]');
      if (toggle && toggle.checked) {
        toggle.checked = false;
        toggle.dispatchEvent(new Event('change', { bubbles: true }));
      }
    } else if (fields.ust_prozent && Number(fields.ust_prozent.value) > 0 && !geschuetzt?.has('ust_prozent')) {
      const prozentInput = this.form.querySelector('input[name="ust_prozent"]');
      if (prozentInput && prozentInput.value !== String(fields.ust_prozent.value)) {
        prozentInput.value = String(fields.ust_prozent.value);
        prozentInput.dispatchEvent(new Event('input', { bubbles: true }));
      }
    }

    if (fields.skonto_prozent && Number(fields.skonto_prozent.value) === 3 && !geschuetzt?.has('skonto')) {
      const skontoToggle = this.form.querySelector('input[name="skonto"]');
      if (skontoToggle && !skontoToggle.checked) {
        skontoToggle.checked = true;
        skontoToggle.dispatchEvent(new Event('change', { bubbles: true }));
      }
    }

    const setDatum = (name, eintrag) => {
      const input = this.form.querySelector(`input[name="${name}"]`);
      if (!input || !eintrag || !darfSetzen(name, input)) return;
      input.value = eintrag.value;
      input.dispatchEvent(new Event('input', { bubbles: true }));
      input.dispatchEvent(new Event('change', { bubbles: true }));
      befuellt++;
    };
    setDatum('gestellt_am', fields.gestellt_am);
    setDatum('zahlungsziel', fields.zahlungsziel);

    // Neuberechnung sicher anstossen (debouncedBerechne lauscht auf nettobetrag)
    const nettoInput = this.form.querySelector('input[name="nettobetrag"]');
    nettoInput?.dispatchEvent(new Event('input', { bubbles: true }));
    return befuellt;
    } finally {
      this._wendetAn = false;
    }
  }

  zeigeErgebnis(result, befuellt) {
    const warnungen = (result.warnungen || []).map(escapeHtml);
    if (result.fields?.waehrung && !/^eur$/i.test(result.fields.waehrung.value)) {
      warnungen.unshift(`Währung ist ${escapeHtml(result.fields.waehrung.value)} — Beträge bitte prüfen.`);
    }
    if (result.fields?.skonto_prozent && Number(result.fields.skonto_prozent.value) !== 3) {
      warnungen.push(`Skonto von ${escapeHtml(String(result.fields.skonto_prozent.value))} % erkannt — das Formular kennt nur 3 %.`);
    }

    const teile = [];
    if (befuellt > 0) {
      teile.push(`<strong>${befuellt} ${befuellt === 1 ? 'Feld' : 'Felder'} vorbefüllt.</strong> Bitte prüfen und Kooperation wählen.`);
    } else {
      teile.push('<strong>Gelesen, aber nichts übernommen</strong> — die erkannten Felder waren bereits befüllt.');
    }
    if (warnungen.length) {
      teile.push(warnungen.join('<br>'));
    }
    this.setStatus(teile.join('<br>'), warnungen.length ? 'warning' : 'info');
  }

  async zeigeKoopVorschlag(treffer) {
    const top = treffer[0];
    // Nur belastbare Treffer (voller Name, Handle oder Mail — siehe Scoring)
    if (!top || top.score < 3) return;

    try {
      const { data: koops } = await window.supabase
        .from('kooperationen')
        .select('id, name, kampagne_id, einkaufspreis_netto, ksk_selbstzahler, ksk_betrag, created_at')
        .eq('creator_id', top.id)
        .order('created_at', { ascending: false })
        .limit(10);
      if (!koops?.length) return;

      const ids = [...new Set(koops.map((k) => k.kampagne_id).filter(Boolean))];
      const [{ abrechenbarkeit }, { data: kampagnen }] = await Promise.all([
        ladeAbrechenbarkeit(window.supabase, koops),
        ids.length
          ? window.supabase.from('kampagne').select('id, kampagnenname, eigener_name').in('id', ids)
          : Promise.resolve({ data: [] })
      ]);

      const kampMap = (kampagnen || []).reduce((acc, k) => {
        acc[k.id] = KampagneUtils.getDisplayName(k);
        return acc;
      }, {});
      const offene = koops.filter((k) => abrechenbarkeit.get(k.id)?.abrechenbar);
      if (!offene.length) return;

      const vorschlag = offene[0];
      const info = abrechenbarkeit.get(vorschlag.id);
      const label = vorschlag.name && vorschlag.kampagne_id
        ? `${vorschlag.name} — ${kampMap[vorschlag.kampagne_id] || 'Kampagne'}`
        : (vorschlag.name || kampMap[vorschlag.kampagne_id] || vorschlag.id);
      const creatorName = `${top.vorname || ''} ${top.nachname || ''}`.trim();

      const restText = info?.soll > 0
        ? `Noch abrechenbar: ${formatEuro(Math.max(info.rest, 0))}`
        : 'Soll nicht gepflegt';
      const weitere = offene.length > 1
        ? `<br>Es gibt ${offene.length - 1} weitere offene ${offene.length - 1 === 1 ? 'Kooperation' : 'Kooperationen'} von ${escapeHtml(creatorName)} — im Feld wählbar.`
        : '';

      const box = document.getElementById('rechnung-koop-vorschlag');
      if (!box) return;
      box.innerHTML = `
        <div class="notice-box notice-info rechnung-koop-vorschlag-box">
          <strong>Kooperations-Vorschlag</strong>
          <div>
            Creator „${escapeHtml(creatorName)}" als Rechnungsabsender erkannt.
            Passende offene Kooperation: <b>${escapeHtml(label)}</b> (${restText}).${weitere}
          </div>
          <div class="rechnung-koop-vorschlag-actions">
            <button type="button" class="mdc-btn mdc-btn--secondary" id="rechnung-koop-uebernehmen">
              <span class="mdc-btn__label">Übernehmen</span>
            </button>
            <button type="button" class="mdc-btn mdc-btn--cancel" id="rechnung-koop-ignorieren">
              <span class="mdc-btn__label">Ignorieren</span>
            </button>
          </div>
        </div>
      `;

      box.querySelector('#rechnung-koop-uebernehmen')?.addEventListener('click', () => {
        this._reapplyOnNextPrefill = true;
        if (this.setKoopSelect(vorschlag.id, label)) {
          box.innerHTML = '';
        } else {
          this._reapplyOnNextPrefill = false;
          this.setStatus('Kooperation konnte nicht gesetzt werden — bitte manuell wählen.', 'warning');
        }
      });
      box.querySelector('#rechnung-koop-ignorieren')?.addEventListener('click', () => {
        box.innerHTML = '';
      });
    } catch (e) {
      console.warn('⚠️ Kooperations-Vorschlag fehlgeschlagen:', e);
    }
  }

  setKoopSelect(value, label) {
    const select = this.form.querySelector('select[name="kooperation_id"]')
      || this.form.querySelector('select#field-kooperation_id')
      || this.form.querySelector('select[data-field-name="kooperation_id"]');
    return applySearchableSelection(select, { value, label });
  }
}
