// ConfigSystem.js (ES6-Modul)
// Zentrale Konfiguration für das System

export const CONFIG = {
  SUPABASE: {
    URL: import.meta.env.VITE_SUPABASE_URL,
    KEY: import.meta.env.VITE_SUPABASE_ANON_KEY
  },
  APP: {
    NAME: 'CRM Dashboard',
    VERSION: '2.0.0',
    DEBUG: import.meta.env.DEV, // Nur in Development
    OFFLINE_MODE: import.meta.env.DEV // Nur in Development
  },
  AUTH: {
    MIN_PASSWORD_LENGTH: 4,
    MAX_LOGIN_ATTEMPTS: 3,
    LOCKOUT_TIME: 15 * 60 * 1000 // 15 Minuten
  },
  UI: {
    THEME: 'light',
    LANGUAGE: 'de',
    ANIMATIONS: true
  },
  CONTRACTS: {
    DEFAULT_LANGUAGE: 'de'
  }
};

// Konfiguration global verfügbar machen (für Kompatibilität)
if (typeof window !== 'undefined') {
  window.CONFIG = CONFIG;
}

// Konfiguration exportieren
export default CONFIG;
