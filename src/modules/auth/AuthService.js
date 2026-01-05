import { permissionSystem } from '../../core/PermissionSystem.js';
// AuthService.js (ES6-Modul)
// Authentifizierung und Benutzer-Management

export class AuthService {
  constructor() {
    this._loginAttempts = new Map();
    this._maxAttempts = 3;
    this._lockoutTime = 900000; // 15 Minuten
    this._offlineMode = false;
  }

  // Auth-Status prüfen
  async checkAuth() {
    try {
      console.log('🔐 Prüfe Authentifizierung...');
      
      // Prüfe ob Supabase verfügbar ist
      if (!window.supabase || !window.supabase.auth) {
        console.warn('⚠️ Supabase nicht verfügbar - verwende Offline-Modus');
        this._offlineMode = true;
        return this.checkOfflineAuth();
      }

      // Teste Supabase-Verbindung
      try {
        const { data: { session }, error } = await window.supabase.auth.getSession();
        
        if (error && error.message.includes('Invalid API key')) {
          console.warn('⚠️ Ungültiger Supabase API Key - schalte auf Offline-Modus um');
          this._offlineMode = true;
          return this.checkOfflineAuth();
        }

        if (session) {
          console.log('✅ Session gefunden:', session.user.email);
          await this.loadCurrentUser(session.user.id);
          return true;
        } else {
          console.log('❌ Keine Session gefunden');
          return false;
        }
      } catch (error) {
        if (error.message && error.message.includes('Invalid API key')) {
          console.warn('⚠️ Supabase API Key ungültig - Offline-Modus aktiviert');
          this._offlineMode = true;
          return this.checkOfflineAuth();
        }
        throw error;
      }
    } catch (error) {
      console.error('❌ Auth check failed:', error);
      this._offlineMode = true;
      return this.checkOfflineAuth();
    }
  }

  // Offline Auth prüfen (nur in Development)
  checkOfflineAuth() {
    // Offline-Modus nur in Development erlauben
    if (!import.meta.env.DEV) {
      console.log('🔒 Offline-Modus in Production deaktiviert');
      return false;
    }

    const offlineUser = localStorage.getItem('offline_user');
    if (offlineUser) {
      try {
        const user = JSON.parse(offlineUser);
        window.currentUser = user;
        console.log('✅ Offline-Benutzer gefunden:', user.name);
        return true;
      } catch (error) {
        console.error('❌ Offline-Benutzer ungültig:', error);
        localStorage.removeItem('offline_user');
        return false;
      }
    }
    return false;
  }

  // Aktuellen Benutzer laden
  async loadCurrentUser(authUserId) {
    try {
      // Wenn Offline-Modus aktiv ist, überspringe Supabase
      if (this._offlineMode) {
        console.log('⚠️ Offline-Modus - überspringe Benutzer-Load');
        return;
      }

      if (!window.supabase) {
        console.warn('⚠️ Supabase nicht verfügbar - verwende Offline-Modus');
        this._offlineMode = true;
        return;
      }

      const { data, error } = await window.supabase
        .from('benutzer')
        .select('id, name, rolle, unterrolle, auth_user_id, zugriffsrechte, freigeschaltet, profile_image_url')
        .eq('auth_user_id', authUserId)
        .single();

      if (error) {
        console.error('Error loading current user:', error);
        // Fallback zu Offline-Modus
        this._offlineMode = true;
        this.setOfflineUser(authUserId);
        return;
      }

      if (data) {
        // Prüfen ob Benutzer freigeschaltet ist
        // Admin ist immer freigeschaltet, andere Rollen benötigen explizite Freischaltung
        const isFreigeschaltet = data.rolle === 'admin' || data.freigeschaltet === true;
        
        if (!isFreigeschaltet) {
          console.log('⚠️ Benutzer nicht freigeschaltet:', data.name);
          window.currentUser = {
            ...data,
            isBlocked: true,
            blockReason: 'Ihr Account wartet auf Freischaltung durch einen Administrator.'
          };
        } else {
          window.currentUser = data;
          console.log('✅ Benutzer geladen:', data.name, '| Rolle:', data.rolle, '| Freigeschaltet:', isFreigeschaltet);
        }
        // 1) Rollen-/Entity-Rechte (inkl. JSON-Overrides)
        permissionSystem.setUserPermissions(data);
        
        // PERFORMANCE: Page-/Table-Scoped-Overrides nur beim Login laden, nicht bei jedem Page-Wechsel
        // 2) Page-/Table-Scoped-Overrides laden (nur wenn nicht bereits gecached)
        if (!window.currentUser._permissionsCached) {
          try {
            const { data: scoped } = await window.supabase
              .from('user_permissions')
              .select('page_id, table_id, can_view, can_edit, can_delete, data_filters')
              .eq('user_id', data.id);
            permissionSystem.setScopedPermissions(scoped || []);
            window.currentUser._permissionsCached = true; // Cache-Flag setzen
            console.log('✅ Permissions geladen und gecached');
          } catch (e) {
            console.warn('⚠️ Scoped Permissions konnten nicht geladen werden', e);
            permissionSystem.setScopedPermissions([]);
          }
        } else {
          console.log('✅ Permissions bereits gecached, überspringe DB-Query');
        }
        // 3) UI/Navigation/Dropdowns nach Rollenwechsel re-initialisieren
        try {
          window.setupHeaderUI?.();
          window.navigationSystem?.init?.();
          window.actionsDropdown?.init?.();
          window.bulkActionSystem?.init?.();
          window.notificationSystem?.init?.();
          
          // Aktuelle Route neu navigieren, damit Berechtigungen greifen
          const currentRoute = location.pathname;
          if (currentRoute) {
            window.moduleRegistry?.navigateTo?.(currentRoute);
          }
        } catch (uiErr) {
          console.warn('⚠️ UI-Refresh nach loadCurrentUser fehlgeschlagen', uiErr);
        }
        
        // 4) Realtime-Subscription für Benutzer-Updates (inkl. Rechte-Änderungen)
        if (!this._userSubscription && !this._offlineMode) {
          this._userSubscription = window.supabase
            .channel(`user-updates-${data.id}`)
            .on('postgres_changes', {
              event: 'UPDATE',
              schema: 'public',
              table: 'benutzer',
              filter: `id=eq.${data.id}`
            }, async (payload) => {
              console.log('🔄 REALTIME: Benutzer-Daten wurden aktualisiert', payload.new);
              
              // Aktualisiere window.currentUser mit neuen Daten
              const updatedUser = payload.new;
              window.currentUser = {
                ...window.currentUser,
                ...updatedUser
              };
              
              // Permissions neu berechnen
              permissionSystem.setUserPermissions(updatedUser);
              
              // Cache-Flag zurücksetzen für Scoped Permissions
              window.currentUser._permissionsCached = false;
              
              // Scoped Permissions neu laden
              try {
                const { data: scoped } = await window.supabase
                  .from('user_permissions')
                  .select('page_id, table_id, can_view, can_edit, can_delete, data_filters')
                  .eq('user_id', updatedUser.id);
                permissionSystem.setScopedPermissions(scoped || []);
                window.currentUser._permissionsCached = true;
              } catch (e) {
                console.warn('⚠️ Scoped Permissions reload failed', e);
              }
              
              // UI aktualisieren
              try {
                window.setupHeaderUI?.();
                window.navigationSystem?.init?.();
                window.actionsDropdown?.init?.();
                
                // Benachrichtigungs-Refresh triggern
                window.dispatchEvent(new Event('notificationsRefresh'));
                
                // Soft-Refresh Event dispatchen statt Full Page Reload
                // Module können selbst entscheiden ob sie updaten (z.B. wenn kein Formular aktiv)
                window.dispatchEvent(new CustomEvent('softRefresh', {
                  detail: { 
                    reason: 'user-data-updated', 
                    route: location.pathname,
                    timestamp: Date.now()
                  }
                }));
                console.log('🔄 REALTIME: softRefresh Event gesendet (kein Full Reload)');
              } catch (uiErr) {
                console.warn('⚠️ UI-Refresh nach Realtime-Update fehlgeschlagen', uiErr);
              }
            })
            .subscribe();
            
          console.log('✅ Realtime-Subscription für Benutzer-Updates aktiv');
        }
      }
    } catch (error) {
      console.error('Error loading current user:', error);
      this._offlineMode = true;
      this.setOfflineUser(authUserId);
    }
  }

  // Offline-Benutzer setzen
  setOfflineUser(authUserId) {
    const offlineUser = {
      id: 'offline-user',
      name: 'Offline Benutzer',
      rolle: 'admin',
      unterrolle: 'admin',
      auth_user_id: authUserId
    };
    window.currentUser = offlineUser;
    localStorage.setItem('offline_user', JSON.stringify(offlineUser));
    console.log('✅ Offline-Benutzer gesetzt:', offlineUser.name);
    permissionSystem.setUserPermissions(offlineUser);
  }

  // Passwort-basierte Anmeldung
  async signInWithPassword(email, password) {
    try {
      // Dev-Login nur in Development
      if (import.meta.env.DEV && email === 'test@example.com' && password === 'test123') {
        console.log('✅ Dev-Login erfolgreich (Development only)');
        const offlineUser = {
          id: 'offline-user',
          name: 'Test Benutzer',
          rolle: 'admin',
          unterrolle: 'admin',
          auth_user_id: 'offline-auth-id'
        };
        window.currentUser = offlineUser;
        localStorage.setItem('offline_user', JSON.stringify(offlineUser));
        this._offlineMode = true;
        return { user: offlineUser, error: null };
      }

      // Rate Limiting prüfen
      if (this.checkRateLimit(email)) {
        throw new Error('Zu viele Anmeldeversuche. Bitte warten Sie 15 Minuten.');
      }

      // Passwort-Stärke validieren
      if (!this.validatePasswordStrength(password)) {
        throw new Error('Passwort muss mindestens 4 Zeichen haben.');
      }

      // Wenn Offline-Modus aktiv ist, verwende nur Offline-Login
      if (this._offlineMode) {
        throw new Error('Offline-Modus aktiv. Verwenden Sie test@example.com / test123');
      }

      if (!window.supabase) {
        throw new Error('Supabase nicht verfügbar');
      }

      const { data, error } = await window.supabase.auth.signInWithPassword({
        email,
        password
      });

      if (error) {
        this.recordFailedAttempt(email);
        throw error;
      }

      this.clearAttempts(email);
      await this.loadCurrentUser(data.user.id);
      
      return { user: data.user, error: null };
    } catch (error) {
      console.error('SignIn Error:', error);
      return { user: null, error };
    }
  }

  // Registrierung
  async signUp(email, name, password, klasseId = null) {
    try {
      // Rate Limiting prüfen
      if (this.checkRateLimit(email)) {
        throw new Error('Zu viele Registrierungsversuche. Bitte warten Sie 15 Minuten.');
      }

      // Passwort-Stärke validieren
      if (!this.validatePasswordStrength(password)) {
        throw new Error('Passwort muss mindestens 4 Zeichen haben.');
      }

      // Wenn Offline-Modus aktiv ist, verwende nur Offline-Registrierung
      if (this._offlineMode) {
        throw new Error('Offline-Modus aktiv. Registrierung nicht verfügbar.');
      }

      if (!window.supabase) {
        throw new Error('Supabase nicht verfügbar');
      }

      const { data, error } = await window.supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            role: 'mitarbeiter',  // Klare Kennzeichnung als Mitarbeiter
            subrole: 'pending',
            name: name
          }
        }
      });

      if (error) {
        this.recordFailedAttempt(email);
        throw error;
      }

      if (data.user) {
        await this.createBenutzerRecord(data.user.id, name, email, klasseId);
      }

      this.clearAttempts(email);
      
      // WICHTIG: Benutzer NICHT automatisch einloggen
      // Stattdessen zur OTP-Verifikationsseite weiterleiten
      console.log('✅ Registrierung erfolgreich - Weiterleitung zur E-Mail-Verifikation');
      
      return { 
        user: data.user, 
        error: null, 
        needsEmailVerification: true,
        redirectTo: `/verify-email.html?email=${encodeURIComponent(email)}`
      };
    } catch (error) {
      console.error('SignUp Error:', error);
      return { user: null, error };
    }
  }

  // Benutzer-Record erstellen (wird vom Trigger automatisch erstellt, prüfen ob vorhanden)
  async createBenutzerRecord(authUserId, name, email = null, klasseId = null) {
    try {
      if (this._offlineMode) {
        console.warn('⚠️ Offline-Modus - überspringe Benutzer-Erstellung');
        return;
      }

      if (!window.supabase) {
        console.warn('⚠️ Supabase nicht verfügbar - überspringe Benutzer-Erstellung');
        return;
      }

      // Prüfe ob Record bereits existiert
      const { data: existingUser, error: checkError } = await window.supabase
        .from('benutzer')
        .select('id, email')
        .eq('auth_user_id', authUserId)
        .maybeSingle();

      if (checkError) {
        console.warn('⚠️ Fehler beim Prüfen des Benutzer-Records, versuche Fallback:', checkError.message);
        // Nicht abbrechen - versuche den Fallback!
      }

      if (existingUser) {
        console.log('✅ Benutzer-Record bereits vorhanden');
        
        // Update E-Mail und Mitarbeiter-Klasse falls angegeben und noch nicht gesetzt
        const updateData = {};
        if (email && !existingUser.email) updateData.email = email;
        if (klasseId) updateData.mitarbeiter_klasse_id = klasseId;
        
        if (Object.keys(updateData).length > 0) {
          const { error: updateError } = await window.supabase
            .from('benutzer')
            .update(updateData)
            .eq('auth_user_id', authUserId);
            
          if (updateError) {
            console.error('❌ Fehler beim Update des Benutzer-Records:', updateError.message);
          } else {
            console.log('✅ Benutzer-Record aktualisiert (E-Mail/Klasse)');
          }
        }
        return;
      }

      // Fallback: Erstelle Record
      console.log('📝 Erstelle neuen Benutzer-Record...');
      const { error } = await window.supabase
        .from('benutzer')
        .insert({
          auth_user_id: authUserId,
          name: name,
          email: email,
          rolle: 'pending',
          unterrolle: 'awaiting_approval',
          mitarbeiter_klasse_id: klasseId,
          zugriffsrechte: null,
          freigeschaltet: false
        });

      if (error) {
        // Falls Insert fehlschlägt wegen Unique Constraint, versuche Update
        if (error.code === '23505') {
          console.warn('⚠️ Record existiert bereits (Race Condition), versuche Update...');
          const { error: retryError } = await window.supabase
            .from('benutzer')
            .update({ email: email, name: name })
            .eq('auth_user_id', authUserId);
          
          if (retryError) {
            console.error('❌ Auch Retry-Update fehlgeschlagen:', retryError.message);
          } else {
            console.log('✅ Benutzer-Record via Retry-Update aktualisiert');
          }
        } else {
          console.error('❌ Fehler beim Erstellen des Benutzer-Records:', error.message);
        }
      } else {
        console.log('✅ Benutzer-Record erstellt');
      }
    } catch (error) {
      console.error('❌ Unerwarteter Fehler beim Erstellen des Benutzer-Records:', error);
    }
  }

  // Abmeldung
  async signOut() {
    try {
      // Cleanup Realtime-Subscription
      if (this._userSubscription) {
        await window.supabase.removeChannel(this._userSubscription);
        this._userSubscription = null;
        console.log('✅ Realtime-Subscription entfernt');
      }
      
      if (window.supabase && !this._offlineMode) {
        await window.supabase.auth.signOut();
      }
      
      // Offline-Daten löschen
      localStorage.removeItem('offline_user');
      window.currentUser = null;
      this._offlineMode = false;
      
      console.log('✅ Abmeldung erfolgreich');
      return { error: null };
    } catch (error) {
      console.error('SignOut Error:', error);
      return { error };
    }
  }

  // Passwort-Reset anfordern
  async requestPasswordReset(email) {
    try {
      // Rate Limiting prüfen
      if (this.checkRateLimit(email)) {
        throw new Error('Zu viele Anfragen. Bitte warten Sie 15 Minuten.');
      }

      // Offline-Modus erlaubt keinen Reset
      if (this._offlineMode) {
        throw new Error('Passwort-Reset ist im Offline-Modus nicht verfügbar.');
      }

      if (!window.supabase) {
        throw new Error('Supabase nicht verfügbar');
      }

      // Redirect URL für Reset-Seite
      const baseUrl = window.location.origin;
      const redirectTo = `${baseUrl}/src/auth/reset-password.html`;

      const { data, error } = await window.supabase.auth.resetPasswordForEmail(email, {
        redirectTo
      });

      // Immer Erfolg melden (Sicherheit: keine Account-Enumeration)
      // Auch wenn E-Mail nicht existiert, zeigen wir die gleiche Meldung
      if (error) {
        // Nur bei echten Fehlern (nicht "user not found") werfen
        if (!error.message.includes('not found') && !error.message.includes('User not found')) {
          this.recordFailedAttempt(email);
          throw error;
        }
        console.log('ℹ️ Password reset requested for unknown email (silent fail for security)');
      }

      console.log('✅ Passwort-Reset E-Mail angefordert');
      return { success: true, error: null };
    } catch (error) {
      console.error('Password Reset Error:', error);
      return { success: false, error };
    }
  }

  // Passwort aktualisieren (für Reset-Seite)
  async updatePassword(newPassword) {
    try {
      // Passwort-Stärke validieren
      if (!this.validatePasswordStrength(newPassword)) {
        throw new Error('Passwort muss mindestens 4 Zeichen haben.');
      }

      if (!window.supabase) {
        throw new Error('Supabase nicht verfügbar');
      }

      const { data, error } = await window.supabase.auth.updateUser({
        password: newPassword
      });

      if (error) {
        throw error;
      }

      console.log('✅ Passwort erfolgreich aktualisiert');
      return { success: true, error: null };
    } catch (error) {
      console.error('Update Password Error:', error);
      return { success: false, error };
    }
  }

  // Passwort-Stärke validieren (Entwicklung: nur 4 Zeichen)
  validatePasswordStrength(password) {
    return password.length >= 4;
  }

  // Rate Limiting prüfen
  checkRateLimit(email) {
    const attempts = this._loginAttempts.get(email);
    if (!attempts) return false;

    const now = Date.now();
    const recentAttempts = attempts.filter(timestamp => now - timestamp < this._lockoutTime);
    
    if (recentAttempts.length >= this._maxAttempts) {
      return true;
    }

    return false;
  }

  // Fehlgeschlagene Versuche aufzeichnen
  recordFailedAttempt(email) {
    const attempts = this._loginAttempts.get(email) || [];
    attempts.push(Date.now());
    this._loginAttempts.set(email, attempts);
  }

  // Versuche löschen
  clearAttempts(email) {
    this._loginAttempts.delete(email);
  }
}

// Exportiere Instanz
export const authService = new AuthService();
