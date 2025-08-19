// AutoCalculation.js - Automatische Berechnung für Formularfelder
// ES6-Modul für die Berechnung von abhängigen Feldern

export class AutoCalculation {
  constructor() {
    this.calculationRules = {
      // Deckungsbeitrag (von Netto)
      deckungsbeitrag_betrag: this.calculateDeckungsbeitragBetrag.bind(this),
      // USt (19% von Netto)
      ust_betrag: this.calculateUstBetrag.bind(this),
      // Brutto Gesamtbudget (Netto + USt)
      brutto_gesamt_budget: this.calculateBruttoGesamtBudget.bind(this),
      // KSK (5% von Netto)
      ksk_betrag: this.calculateKskBetrag.bind(this),
      // Nettobetrag aus Positionen (falls Felder vorhanden)
      nettobetrag: this.calculateNettoFromItems.bind(this),
      // Creator Budget = Netto - KSK - Deckungsbeitrag
      creator_budget: this.calculateCreatorBudget.bind(this)
    };
  }

  /**
   * Initialisiere Auto-Calculation für ein Formular
   */
  initializeAutoCalculation(form) {
    if (!form) return;

    console.log('🔧 Initialisiere Auto-Calculation für Formular');

    // Finde alle Felder mit auto-calculate oder calculated-from Attributen
    const calculatedFields = form.querySelectorAll('[data-calculated-from]');
    const triggerFields = form.querySelectorAll('[data-auto-calculate="true"]');

    // Event Listener für Trigger-Felder
    triggerFields.forEach(field => {
      field.addEventListener('input', (e) => {
        this.handleFieldChange(form, e.target);
      });

      field.addEventListener('change', (e) => {
        this.handleFieldChange(form, e.target);
      });
    });

    // Event Listener für alle relevanten Felder (für berechnete Felder)
    const allRelevantFields = form.querySelectorAll('input[type="number"]');
    allRelevantFields.forEach(field => {
      field.addEventListener('input', (e) => {
        this.recalculateAllDependentFields(form);
      });

      field.addEventListener('change', (e) => {
        this.recalculateAllDependentFields(form);
      });
    });

    console.log(`✅ Auto-Calculation initialisiert für ${calculatedFields.length} berechnete Felder und ${triggerFields.length} Trigger-Felder`);
  }

  /**
   * Handle Feldänderung
   */
  handleFieldChange(form, changedField) {
    console.log(`🔄 Feld geändert: ${changedField.name} = ${changedField.value}`);
    this.recalculateAllDependentFields(form);
  }

  /**
   * Berechne alle abhängigen Felder neu
   */
  recalculateAllDependentFields(form) {
    const calculatedFields = form.querySelectorAll('[data-calculated-from]');
    
    calculatedFields.forEach(field => {
      const fieldName = field.name;
      if (this.calculationRules[fieldName]) {
        const newValue = this.calculationRules[fieldName](form, field);
        if (newValue !== null && newValue !== undefined) {
          field.value = newValue;
          console.log(`💰 ${fieldName} neu berechnet: ${newValue}`);
        }
      }
    });
  }

  /**
   * Berechne Deckungsbeitrag in Euro basierend auf Prozentsatz und Gesamtbudget
   */
  calculateDeckungsbeitragBetrag(form, targetField) {
    try {
      const prozentField = form.querySelector('[name="deckungsbeitrag_prozent"]');
      const nettoField = form.querySelector('[name="nettobetrag"]');

      if (!prozentField || !nettoField) {
        console.warn('⚠️ Erforderliche Felder für Deckungsbeitrag-Berechnung nicht gefunden');
        return 0;
      }

      const prozent = parseFloat(prozentField.value) || 0;
      const netto = parseFloat(nettoField.value) || 0;

      if (prozent === 0 || netto === 0) {
        return 0;
      }

      // Berechnung: Netto * (Prozent / 100)
      const deckungsbeitragBetrag = netto * (prozent / 100);
      
      console.log(`💰 Deckungsbeitrag berechnet: ${netto}€ * ${prozent}% = ${deckungsbeitragBetrag}€`);
      
      // Runde auf 2 Dezimalstellen
      return Math.round(deckungsbeitragBetrag * 100) / 100;

    } catch (error) {
      console.error('❌ Fehler bei Deckungsbeitrag-Berechnung:', error);
      return 0;
    }
  }

  /**
   * Berechne USt-Betrag (standardmäßig 19% von Netto)
   */
  calculateUstBetrag(form, targetField) {
    try {
      const nettoField = form.querySelector('[name="nettobetrag"]');
      if (!nettoField) return 0;
      const netto = parseFloat(nettoField.value) || 0;
      const ustProzentField = form.querySelector('[name="ust_prozent"]');
      const ustProzent = ustProzentField ? (parseFloat(ustProzentField.value) || 19) : 19;
      const ust = netto * (ustProzent / 100);
      return Math.round(ust * 100) / 100;
    } catch (error) {
      console.error('❌ Fehler bei USt-Berechnung:', error);
      return 0;
    }
  }

  /**
   * Berechne Brutto Gesamtbudget (Netto + USt)
   */
  calculateBruttoGesamtBudget(form, targetField) {
    try {
      const nettoField = form.querySelector('[name="nettobetrag"]');
      const ustField = form.querySelector('[name="ust_betrag"]');
      const netto = nettoField ? (parseFloat(nettoField.value) || 0) : 0;
      // Falls ust_betrag-Feld noch nicht berechnet wurde, on-the-fly berechnen
      const ust = ustField ? (parseFloat(ustField.value) || this.calculateUstBetrag(form)) : this.calculateUstBetrag(form);
      const brutto = netto + ust;
      return Math.round(brutto * 100) / 100;
    } catch (error) {
      console.error('❌ Fehler bei Brutto-Berechnung:', error);
      return 0;
    }
  }

  /**
   * Berechne KSK (5% von Netto)
   */
  calculateKskBetrag(form, targetField) {
    try {
      const nettoField = form.querySelector('[name="nettobetrag"]');
      if (!nettoField) return 0;
      const netto = parseFloat(nettoField.value) || 0;
      const ksk = netto * 0.05;
      return Math.round(ksk * 100) / 100;
    } catch (error) {
      console.error('❌ Fehler bei KSK-Berechnung:', error);
      return 0;
    }
  }

  /**
   * Berechne Nettobetrag anhand der Stückzahlen x Preise je Kategorie
   */
  calculateNettoFromItems(form, targetField) {
    try {
      const readNum = (name) => {
        const el = form.querySelector(`[name="${name}"]`);
        return el ? (parseFloat(el.value) || 0) : 0;
      };
      const influencer = readNum('influencer');
      const influencerPreis = readNum('influencer_preis');
      const ugc = readNum('ugc');
      const ugcPreis = readNum('ugc_preis');
      const vorOrt = readNum('vor_ort_produktion');
      const vorOrtPreis = readNum('vor_ort_preis');
      const sum = (influencer * influencerPreis) + (ugc * ugcPreis) + (vorOrt * vorOrtPreis);
      // Nur berechnen, wenn eine sinnvolle Summe > 0 herauskommt.
      // Andernfalls NICHT überschreiben (manuelle Eingabe zulassen)
      if (sum > 0) {
        return Math.round(sum * 100) / 100;
      }
      return null;
    } catch (error) {
      console.error('❌ Fehler bei Netto-Berechnung aus Items:', error);
      return 0;
    }
  }

  /**
   * Berechne Creator Budget = Netto - KSK - Deckungsbeitrag
   * KSK wird aus Feld ksk_betrag gelesen (oder 5% von Netto, falls leer)
   * Deckungsbeitrag-Betrag wird aus Feld gelesen (oder aus Prozent berechnet)
   */
  calculateCreatorBudget(form, targetField) {
    try {
      const get = (name) => form.querySelector(`[name="${name}"]`);
      const netto = parseFloat(get('nettobetrag')?.value || '0') || 0;
      // KSK: bevorzugt Feld, sonst 5%
      let ksk = parseFloat(get('ksk_betrag')?.value || '0');
      if (!ksk || ksk === 0) {
        ksk = Math.round(netto * 0.05 * 100) / 100;
      }
      // Deckungsbeitrag: bevorzugt Betrag, sonst aus Prozent
      let dbBetrag = parseFloat(get('deckungsbeitrag_betrag')?.value || '0');
      if (!dbBetrag || dbBetrag === 0) {
        const prozent = parseFloat(get('deckungsbeitrag_prozent')?.value || '0') || 0;
        dbBetrag = Math.round(netto * (Math.min(Math.max(prozent, 0), 100) / 100) * 100) / 100;
      }
      const result = Math.max(0, netto - ksk - dbBetrag);
      return Math.round(result * 100) / 100;
    } catch (error) {
      console.error('❌ Fehler bei Creator-Budget-Berechnung:', error);
      return 0;
    }
  }

  /**
   * Formatiere Währungswert
   */
  formatCurrency(value) {
    if (!value || isNaN(value)) return '0,00';
    
    return new Intl.NumberFormat('de-DE', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(value);
  }

  /**
   * Validiere Prozentwert
   */
  validatePercentage(value) {
    const numValue = parseFloat(value);
    if (isNaN(numValue)) return 0;
    if (numValue < 0) return 0;
    if (numValue > 100) return 100;
    return numValue;
  }
}

// Globale Instanz für einfachen Zugriff
export const autoCalculation = new AutoCalculation();

// Automatische Initialisierung für dynamisch geladene Formulare
document.addEventListener('DOMContentLoaded', () => {
  console.log('🔧 AutoCalculation Modul geladen');
});