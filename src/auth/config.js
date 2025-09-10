// Supabase Configuration für E-Mail-Bestätigung
// Diese Datei sollte in der Produktion durch Umgebungsvariablen ersetzt werden

export const SUPABASE_CONFIG = {
    // Echte Supabase-Konfiguration
    url: 'https://yktycclozgsgaasduyol.supabase.co',
    anonKey: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlrdHljY2xvemdzZ2Fhc2R1eW9sIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTMwODYzNTEsImV4cCI6MjA2ODY2MjM1MX0.6TM9Td6iKgmXV_fEPMJWZiD9n--X9TeNk0FoeL5B-9c',
    
    // Optional: Redirect URLs nach erfolgreicher Bestätigung
    redirectUrls: {
        success: '/', // Weiterleitung nach erfolgreicher Bestätigung
        login: '/login', // Weiterleitung zum Login
        register: '/register', // Weiterleitung zur Registrierung bei Fehlern
        dashboard: '/' // Weiterleitung zum Dashboard
    }
}

// Development/Production Environment Check
export const isDevelopment = () => {
    return window.location.hostname === 'localhost' || 
           window.location.hostname === '127.0.0.1' || 
           window.location.hostname.includes('local')
}

// Get Supabase Configuration
export const getSupabaseConfig = () => {
    // In einer echten Anwendung würden Sie hier Umgebungsvariablen verwenden
    if (isDevelopment()) {
        console.log('🔧 Development Mode: Verwenden Sie lokale Konfiguration')
    }
    
    // Validierung der Konfiguration
    if (SUPABASE_CONFIG.url === 'YOUR_SUPABASE_URL' || 
        SUPABASE_CONFIG.anonKey === 'YOUR_SUPABASE_ANON_KEY') {
        console.error('❌ Supabase-Konfiguration nicht vollständig! Bitte konfigurieren Sie SUPABASE_CONFIG in config.js')
        return null
    }
    
    return SUPABASE_CONFIG
}

// Beispiel für Umgebungsvariablen-basierte Konfiguration:
/*
export const SUPABASE_CONFIG = {
    url: process.env.VITE_SUPABASE_URL || import.meta.env.VITE_SUPABASE_URL,
    anonKey: process.env.VITE_SUPABASE_ANON_KEY || import.meta.env.VITE_SUPABASE_ANON_KEY,
    redirectUrls: {
        success: process.env.VITE_REDIRECT_SUCCESS || '/',
        login: process.env.VITE_REDIRECT_LOGIN || '/login',
        register: process.env.VITE_REDIRECT_REGISTER || '/register',
        dashboard: process.env.VITE_REDIRECT_DASHBOARD || '/'
    }
}
*/

