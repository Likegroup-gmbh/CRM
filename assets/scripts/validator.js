// Validierungsfunktionen
window.Validator = {
  // E-Mail-Validierung
  isValidEmail(email) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  },

  // Input-Sanitization
  sanitizeInput(input, type = 'text') {
    if (!input) return '';
    
    let sanitized = input.toString().trim();
    
    switch (type) {
      case 'email':
        sanitized = sanitized.toLowerCase();
        break;
      case 'text':
        sanitized = sanitized.replace(/[<>]/g, '');
        break;
      case 'number':
        sanitized = sanitized.replace(/[^0-9]/g, '');
        break;
    }
    
    return sanitized;
  },

  // Passwort-Validierung
  validatePassword(password) {
    if (!password || password.length < 4) return false;
    return true;
  },

  // Name-Validierung
  validateName(name) {
    if (!name || name.trim().length < 2) return false;
    return true;
  }
};
