// KampagneUtils.js (ES6-Modul)
// Hilfsfunktionen für das Kampagnen-System

export class KampagneUtils {
  
  // Formatiere Kampagnen-Status
  static formatStatus(status) {
    const statusMap = {
      'active': 'Aktiv',
      'inactive': 'Inaktiv',
      'completed': 'Abgeschlossen',
      'cancelled': 'Storniert',
      'draft': 'Entwurf',
      'pending': 'Ausstehend'
    };
    
    return statusMap[status] || status || 'Unbekannt';
  }

  // Formatiere Kampagnen-Art
  static formatKampagnenArt(art) {
    if (!art) return '-';
    
    if (Array.isArray(art)) {
      return art.join(', ');
    }
    
    const artMap = {
      'influencer': 'Influencer Kampagne',
      'ugc': 'UGC',
      'igc': 'IGC',
      'ai': 'AI'
    };
    
    return artMap[art] || art || 'Unbekannt';
  }

  // Berechne Kampagnen-Fortschritt
  static calculateProgress(kampagne) {
    if (!kampagne.start || !kampagne.deadline) {
      return 0;
    }

    const start = new Date(kampagne.start);
    const deadline = new Date(kampagne.deadline);
    const now = new Date();

    if (now < start) {
      return 0;
    }

    if (now > deadline) {
      return 100;
    }

    const totalDuration = deadline - start;
    const elapsed = now - start;
    
    return Math.round((elapsed / totalDuration) * 100);
  }

  // Prüfe ob Kampagne aktiv ist
  static isKampagneActive(kampagne) {
    if (!kampagne.start || !kampagne.deadline) {
      return false;
    }

    const now = new Date();
    const start = new Date(kampagne.start);
    const deadline = new Date(kampagne.deadline);

    return now >= start && now <= deadline;
  }

  // Prüfe ob Kampagne abgelaufen ist
  static isKampagneExpired(kampagne) {
    if (!kampagne.deadline) {
      return false;
    }

    const now = new Date();
    const deadline = new Date(kampagne.deadline);

    return now > deadline;
  }

  // Berechne verbleibende Tage
  static getRemainingDays(kampagne) {
    if (!kampagne.deadline) {
      return null;
    }

    const now = new Date();
    const deadline = new Date(kampagne.deadline);
    const diffTime = deadline - now;
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    return diffDays;
  }

  // Formatiere Budget
  static formatBudget(budget) {
    if (!budget) {
      return '-';
    }

    return new Intl.NumberFormat('de-DE', {
      style: 'currency',
      currency: 'EUR'
    }).format(budget);
  }

  // Formatiere Datum
  static formatDate(date) {
    if (!date) {
      return '-';
    }

    return new Date(date).toLocaleDateString('de-DE');
  }

  // Formatiere Datum mit Zeit
  static formatDateTime(date) {
    if (!date) {
      return '-';
    }

    return new Date(date).toLocaleString('de-DE');
  }

  // Validiere Kampagnen-Daten
  static validateKampagneData(data) {
    const errors = {};

    // Pflichtfelder prüfen
    if (!data.kampagnenname || data.kampagnenname.trim() === '') {
      errors.kampagnenname = 'Kampagnenname ist erforderlich';
    }

    if (!data.unternehmen_id) {
      errors.unternehmen_id = 'Unternehmen ist erforderlich';
    }

    if (!data.start) {
      errors.start = 'Startdatum ist erforderlich';
    }

    if (!data.deadline) {
      errors.deadline = 'Deadline ist erforderlich';
    }

    // Datum-Logik prüfen
    if (data.start && data.deadline) {
      const start = new Date(data.start);
      const deadline = new Date(data.deadline);

      if (start >= deadline) {
        errors.deadline = 'Deadline muss nach dem Startdatum liegen';
      }
    }

    // Zahlen validieren
    if (data.creatoranzahl && (isNaN(data.creatoranzahl) || data.creatoranzahl < 0)) {
      errors.creatoranzahl = 'Creator Anzahl muss eine positive Zahl sein';
    }

    if (data.videoanzahl && (isNaN(data.videoanzahl) || data.videoanzahl < 0)) {
      errors.videoanzahl = 'Video Anzahl muss eine positive Zahl sein';
    }

    return {
      isValid: Object.keys(errors).length === 0,
      errors
    };
  }

  // Erstelle Kampagnen-Summary
  static createKampagneSummary(kampagne) {
    const progress = this.calculateProgress(kampagne);
    const isActive = this.isKampagneActive(kampagne);
    const remainingDays = this.getRemainingDays(kampagne);

    return {
      id: kampagne.id,
      name: kampagne.kampagnenname,
      status: kampagne.status,
      progress,
      isActive,
      remainingDays,
      creatorCount: kampagne.creatoranzahl || 0,
      videoCount: kampagne.videoanzahl || 0,
      start: this.formatDate(kampagne.start),
      deadline: this.formatDate(kampagne.deadline)
    };
  }

  // Erstelle Kampagnen-Filter-Optionen
  static getFilterOptions() {
    return {
      status: [
        { value: 'active', label: 'Aktiv' },
        { value: 'inactive', label: 'Inaktiv' },
        { value: 'completed', label: 'Abgeschlossen' },
        { value: 'cancelled', label: 'Storniert' },
        { value: 'draft', label: 'Entwurf' },
        { value: 'pending', label: 'Ausstehend' }
      ],
      art_der_kampagne: [
        { value: 'influencer', label: 'Influencer Kampagne' },
        { value: 'ugc', label: 'UGC Kampagne' },
        { value: 'paid', label: 'Paid Kampagne' },
        { value: 'organic', label: 'Organische Kampagne' },
        { value: 'hybrid', label: 'Hybrid Kampagne' }
      ]
    };
  }

  // Erstelle Kampagnen-Export-Daten
  static createExportData(kampagnen) {
    return kampagnen.map(kampagne => ({
      'Kampagnenname': kampagne.kampagnenname,
      'Status': this.formatStatus(kampagne.status),
      'Art der Kampagne': this.formatKampagnenArt(kampagne.art_der_kampagne),
      'Start': this.formatDate(kampagne.start),
      'Deadline': this.formatDate(kampagne.deadline),
      'Creator Anzahl': kampagne.creatoranzahl || 0,
      'Video Anzahl': kampagne.videoanzahl || 0,
      'Drehort': kampagne.drehort || '-',
      'Ziele': kampagne.ziele || '-',
      'Budget Info': kampagne.budget_info || '-',
      'Unternehmen': kampagne.unternehmen?.firmenname || 'Unbekannt',
      'Marke': kampagne.marke?.markenname || 'Unbekannt',
      'Auftrag': kampagne.auftrag?.auftragsname || 'Unbekannt',
      'Erstellt am': this.formatDateTime(kampagne.created_at),
      'Aktualisiert am': this.formatDateTime(kampagne.updated_at)
    }));
  }

  // Erstelle Kampagnen-Statistiken
  static createKampagneStats(kampagnen) {
    const stats = {
      total: kampagnen.length,
      active: 0,
      completed: 0,
      cancelled: 0,
      draft: 0,
      totalCreators: 0,
      totalVideos: 0,
      totalBudget: 0
    };

    kampagnen.forEach(kampagne => {
      // Status zählen
      switch (kampagne.status) {
        case 'active':
          stats.active++;
          break;
        case 'completed':
          stats.completed++;
          break;
        case 'cancelled':
          stats.cancelled++;
          break;
        case 'draft':
          stats.draft++;
          break;
      }

      // Summen berechnen
      stats.totalCreators += kampagne.creatoranzahl || 0;
      stats.totalVideos += kampagne.videoanzahl || 0;
      
      // Budget summieren (falls verfügbar)
      if (kampagne.budget_info) {
        // Hier könnte eine Logik zur Extraktion des Budgets implementiert werden
        // stats.totalBudget += extractedBudget;
      }
    });

    return stats;
  }
}

// Exportiere Instanz für globale Nutzung
export const kampagneUtils = new KampagneUtils(); 