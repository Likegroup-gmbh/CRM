// Supabase Configuration für E-Mail-Bestätigung
// Werte werden aus Umgebungsvariablen geladen (Vite: import.meta.env.VITE_*)

export const SUPABASE_CONFIG = {
    // Aus .env-Datei laden (VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY)
    url: import.meta.env.VITE_SUPABASE_URL || '',
    anonKey: import.meta.env.VITE_SUPABASE_ANON_KEY || '',
    
    // Optional: Redirect URLs nach erfolgreicher Bestätigung
    redirectUrls: {
        success: '/', // Weiterleitung nach erfolgreicher Bestätigung
        login: '/login', // Weiterleitung zum Login
        register: '/register', // Weiterleitung zur Registrierung bei Fehlern
        dashboard: '/', // Weiterleitung zum Dashboard
        resetPassword: '/src/auth/reset-password.html' // Weiterleitung zur Passwort-Reset-Seite
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
    if (isDevelopment()) {
        console.log('🔧 Development Mode: Lade Konfiguration aus .env')
    }
    
    // Validierung: Prüfe ob Umgebungsvariablen gesetzt sind
    if (!SUPABASE_CONFIG.url || !SUPABASE_CONFIG.anonKey) {
        console.error('❌ Supabase-Konfiguration nicht vollständig!')
        console.error('   Bitte .env-Datei mit VITE_SUPABASE_URL und VITE_SUPABASE_ANON_KEY erstellen.')
        return null
    }
    
    return SUPABASE_CONFIG
}

