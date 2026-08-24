// SkriptGeneratorFormMarkup.js
// Markup des Generator-Formulars (Kontext + Videovorlage + Video-Vorgaben).
// Reine Template-Funktion: Prefix rein, HTML-String raus.

import { FUNNEL_STUFEN, VIDEO_LAENGEN, SKRIPT_BEREICHE } from './skripteKonstanten.js';

export function generatorFormMarkup(p) {
  return `
    <div class="skripte-card">
      <h3>Kontext auswählen</h3>
      <p class="skripte-hint">Unternehmen wählen – Marke ist optional (nicht jedes Unternehmen hat eine). Kickoff und Produktdaten werden automatisch aus dem CRM gezogen; das Briefing wählst du unten.</p>
      <div class="skripte-form-grid">
        <div class="form-group">
          <label class="form-label">Unternehmen *</label>
          <select id="${p}-unternehmen" class="form-input"><option value="">Laden...</option></select>
        </div>
        <div class="form-group">
          <label class="form-label">Marke</label>
          <select id="${p}-marke" class="form-input" disabled><option value="">– Erst Unternehmen wählen –</option></select>
        </div>
        <div class="form-group">
          <label class="form-label">Kampagne</label>
          <select id="${p}-kampagne" class="form-input" disabled><option value="">– Erst Unternehmen wählen –</option></select>
        </div>
        <div class="form-group">
          <label class="form-label">Produkt</label>
          <select id="${p}-produkt" class="form-input" disabled><option value="">– Erst Unternehmen wählen –</option></select>
        </div>
        <div class="form-group">
          <label class="form-label">Persona (Zielgruppe)</label>
          <select id="${p}-persona" class="form-input" disabled><option value="">– Erst Unternehmen wählen –</option></select>
        </div>
        <div class="form-group">
          <label class="form-label">Branche</label>
          <select id="${p}-branche" class="form-input"><option value="">Laden...</option></select>
          <span class="skripte-hint">Wird bei Markenwahl automatisch gesetzt, kann überschrieben werden.</span>
        </div>
      </div>
      <div class="form-group">
        <label class="form-label">Briefing</label>
        <select id="${p}-briefing" class="form-input" disabled><option value="">– Erst Unternehmen wählen –</option></select>
        <span class="skripte-hint" id="${p}-briefing-hint">Wähle ein Campaign-Briefing – Liky nutzt die Angaben als verbindliche Basis für das Skript.</span>
      </div>
    </div>

    <div class="skripte-card">
      <h3>Videovorlage (optional)</h3>
      <p class="skripte-hint">Videos aus der Strategie dieser Kampagne. Mit Vorlage übernimmt Liky deren Aufbau und Machart (Hook-Typ, Dramaturgie, Pace, CTA-Mechanik) – aber keine Formulierungen oder Produktaussagen. Die Beschreibung füllt die Video-Idee; das Transkript bleibt bei der Vorlage.</p>
      <div class="form-group">
        <label class="form-label">Video aus Strategie</label>
        <select id="${p}-ref-item" class="form-input" disabled><option value="">– Erst Kampagne wählen –</option></select>
        <span class="skripte-hint" id="${p}-ref-hint">Wähle eine Kampagne, dann ein Video aus deren Strategie.</span>
      </div>
      <div id="${p}-ref-result" hidden>
        <div id="${p}-ref-meta" class="skripte-ref-meta"></div>
        <div class="form-group">
          <label class="form-label">Transkript der Vorlage <span id="${p}-ref-source" class="skripte-hint"></span></label>
          <textarea id="${p}-ref-transkript" class="form-input" rows="6"
            placeholder="Transkript aus der Strategie – prüfen/anpassen möglich"></textarea>
        </div>
        <div class="skripte-form-grid">
          <div class="form-group">
            <label class="form-label">Beschreibung</label>
            <textarea id="${p}-ref-beschreibung" class="form-input" rows="3"
              placeholder="Beschreibung aus der Strategie"></textarea>
          </div>
          <div class="form-group">
            <label class="form-label">Caption</label>
            <textarea id="${p}-ref-caption" class="form-input" rows="3"
              placeholder="Caption des Original-Posts"></textarea>
          </div>
        </div>
        <button type="button" id="${p}-ref-clear" class="mdc-btn mdc-btn--secondary">Vorlage entfernen</button>
      </div>
    </div>

    <div class="skripte-card">
      <h3>Vorgaben für dieses Video</h3>
      <div class="form-group">
        <label class="form-label">Video-Idee *</label>
        <textarea id="${p}-idee" class="form-input" rows="3"
          placeholder="Worum soll es in dem Video gehen? (z.B. 'Morgenroutine mit Produkt X, Fokus auf Zeitersparnis')"></textarea>
      </div>
      <div class="form-group">
        <label class="form-label">Location</label>
        <textarea id="${p}-location" class="form-input" rows="3"
          placeholder="Wo findet der Dreh statt? (z.B. 'Zuhause in der Küche, morgens bei Tageslicht; zweiter Teil im Auto auf dem Weg zur Arbeit')"></textarea>
      </div>
      <div class="form-group">
        <label class="form-label">Regieanweisung</label>
        <textarea id="${p}-regie" class="form-input" rows="3"
          placeholder="Hinweise für den Creator zur Umsetzung (z.B. 'direkt in die Kamera sprechen, Produkt erst ab Sekunde 5 zeigen'). Fließt NICHT in die Skript-Generierung ein."></textarea>
        <span class="skripte-hint">Wird nur als Zusatzinfo am Skript gespeichert – kein Einfluss auf den generierten Text.</span>
      </div>
      <div class="skripte-form-grid">
        <div class="form-group">
          <label class="form-label">Bereich *</label>
          <select id="${p}-bereich" class="form-input">
            <option value="">– Bereich wählen –</option>
            ${Object.entries(SKRIPT_BEREICHE).map(([v, l]) => `<option value="${v}">${l}</option>`).join('')}
          </select>
          <span class="skripte-hint">Kommt aus dem Briefing, kann überschrieben werden. Steuert das Master-Regelwerk.</span>
        </div>
        <div class="form-group">
          <label class="form-label">Video-Länge (gesamt)</label>
          <select id="${p}-laenge" class="form-input">
            <option value="">– Keine Vorgabe –</option>
            ${Object.entries(VIDEO_LAENGEN).map(([v, l]) => `<option value="${v}">${l}</option>`).join('')}
          </select>
          <span class="skripte-hint">Wird bei Briefing-Wahl aus dem Briefing übernommen.</span>
        </div>
        <div class="form-group">
          <label class="form-label">Funnel-Stufe</label>
          <select id="${p}-funnel" class="form-input">
            <option value="">– Keine Vorgabe –</option>
            ${Object.entries(FUNNEL_STUFEN).map(([v, l]) => `<option value="${v}">${l}</option>`).join('')}
          </select>
          <span class="skripte-hint">Wird bei Briefing-Wahl aus dem Briefing übernommen.</span>
        </div>
        <div class="form-group">
          <label class="form-label">Tonalität</label>
          <input id="${p}-tonalitaet" class="form-input" type="text"
            placeholder="z.B. locker & humorvoll, seriös, emotional" />
        </div>
        <div class="form-group">
          <label class="form-label">Skript-DNA</label>
          <select id="${p}-dna" class="form-input"><option value="auto">Laden...</option></select>
          <span class="skripte-hint">"Automatisch" nutzt alle zum Kontext passenden aktiven DNA-Layer.</span>
        </div>
      </div>
    </div>
  `;
}
