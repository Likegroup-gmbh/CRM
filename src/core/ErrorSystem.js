// ErrorSystem.js (ES6-Modul)
// Zentrale Fehlerbehandlung für das System

export class ErrorHandler {
  constructor() {
    this.errorLog = [];
    this.maxLogSize = 100;
  }

  // Hauptfehlerbehandlung
  handle(error, context = 'Unknown') {
    const errorInfo = {
      message: error.message || 'Unknown error',
      stack: error.stack,
      context: context,
      timestamp: new Date().toISOString(),
      type: error.constructor.name
    };

    // Fehler loggen
    this.logError(errorInfo);

    // Fehler in Konsole ausgeben
    console.error(`[${context}] Error:`, error);
    
    if (error.message) {
      console.error(`Error message: ${error.message}`);
    }
    
    if (error.stack) {
      console.error(`Stack trace: ${error.stack}`);
    }

    // Benutzer-Feedback (optional)
    this.showUserFeedback(errorInfo);
  }

  // Fehler loggen
  logError(errorInfo) {
    this.errorLog.push(errorInfo);
    
    // Log-Größe begrenzen
    if (this.errorLog.length > this.maxLogSize) {
      this.errorLog.shift();
    }
  }

  // Benutzer-Feedback anzeigen
  showUserFeedback(errorInfo) {
    // Einfache Implementierung - kann später erweitert werden
    if (window.CONFIG?.APP?.DEBUG) {
      console.warn('Debug-Modus: Fehler-Details anzeigen');
    }
  }

  // Fehler-Log abrufen
  getErrorLog() {
    return [...this.errorLog];
  }

  // Fehler-Log löschen
  clearErrorLog() {
    this.errorLog = [];
  }

  // Spezifische Fehlerbehandlung
  handleAuthError(error) {
    this.handle(error, 'Authentication');
  }

  handleValidationError(error) {
    this.handle(error, 'Validation');
  }

  handleNetworkError(error) {
    this.handle(error, 'Network');
  }
}

// Singleton-Instanz erstellen
export const errorHandler = new ErrorHandler();

// Globale Verfügbarkeit für Kompatibilität
if (typeof window !== 'undefined') {
  window.ErrorHandler = errorHandler;
}

export default errorHandler;
