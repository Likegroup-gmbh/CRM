// Zentrale Fehlerbehandlung
window.ErrorHandler = {
  handle(error, context = 'Unknown') {
    console.error(`[${context}] Error:`, error);
    
    // Einfache Fehlerbehandlung für Entwicklung
    if (error.message) {
      console.error(`Error message: ${error.message}`);
    }
    
    if (error.stack) {
      console.error(`Stack trace: ${error.stack}`);
    }
  }
};
