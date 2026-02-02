import { permissionSystem } from '../../core/PermissionSystem.js';
// AuthService.js (ES6-Modul)
// Authentifizierung und Benutzer-Management

export class AuthService {
  constructor() {
    this._loginAttempts = new Map();
    this._maxAttempts = 3;
    this._lockoutTime = 900000; // 15 Minuten
  }

  // Auth-Status prüfen
  async checkAuth() {
    try {
      console.log('🔐 Prüfe Authentifizierung...');
      
      // Prüfe ob Supabase verfügbar ist
      if (!window.supabase || !window.supabase.auth) {
        console.error('❌ Supabase nicht verfügbar');
        return false;
      }

      const { data: { session }, error } = await window.supabase.auth.getSession();
      
      if (error) {
        console.error('❌ Auth-Fehler:', error.message);
        return false;
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
      console.error('❌ Auth check failed:', error);
      return false;
    }
  }

  // Aktuellen Benutzer laden
  async loadCurrentUser(authUserId) {
    try {
      if (!window.supabase) {
        console.error('❌ Supabase nicht verfügbar');
        return;
      }

      const { data, error } = await window.supabase
        .from('benutzer')
        .select('*')
        .eq('auth_user_id', authUserId)
        .single();

      if (error) {
        console.error('❌ Fehler beim Laden des Benutzers:', error);
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
          // notificationSystem deaktiviert - FeedbackNotifications übernimmt
          // window.notificationSystem?.init?.();
          
          // Header-Buttons basierend auf Rolle anpassen (Education, Notifications für Kunden ausblenden)
          this.updateHeaderForRole(data.rolle);
          
          // Aktuelle Route neu navigieren, damit Berechtigungen greifen
          const currentRoute = location.pathname;
          if (currentRoute) {
            window.moduleRegistry?.navigateTo?.(currentRoute);
          }
        } catch (uiErr) {
          console.warn('⚠️ UI-Refresh nach loadCurrentUser fehlgeschlagen', uiErr);
        }
        
        // 4) Realtime-Subscription für Benutzer-Updates (inkl. Rechte-Änderungen)
        if (!this._userSubscription) {
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
                
                // Header-Buttons basierend auf Rolle anpassen
                this.updateHeaderForRole(updatedUser.rolle);
                
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
      console.error('❌ Fehler beim Laden des Benutzers:', error);
    }
  }

  // Passwort-basierte Anmeldung
  async signInWithPassword(email, password) {
    try {
      // Rate Limiting prüfen
      if (this.checkRateLimit(email)) {
        throw new Error('Zu viele Anmeldeversuche. Bitte warten Sie 15 Minuten.');
      }

      // Passwort-Stärke validieren
      if (!this.validatePasswordStrength(password)) {
        throw new Error('Passwort muss mindestens 4 Zeichen haben.');
      }

      if (!window.supabase) {
        throw new Error('Verbindung zum Server nicht möglich. Bitte später erneut versuchen.');
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
  async signUp(email, vorname, nachname, password, klasseId = null) {
    try {
      // Rate Limiting prüfen
      if (this.checkRateLimit(email)) {
        throw new Error('Zu viele Registrierungsversuche. Bitte warten Sie 15 Minuten.');
      }

      // Passwort-Stärke validieren
      if (!this.validatePasswordStrength(password)) {
        throw new Error('Passwort muss mindestens 4 Zeichen haben.');
      }

      if (!window.supabase) {
        throw new Error('Verbindung zum Server nicht möglich. Bitte später erneut versuchen.');
      }

      // Kombinierter Name für Abwärtskompatibilität
      const fullName = `${vorname} ${nachname}`.trim();

      const { data, error } = await window.supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            role: 'mitarbeiter',  // Klare Kennzeichnung als Mitarbeiter
            name: fullName,
            vorname: vorname,
            nachname: nachname
          }
        }
      });

      if (error) {
        this.recordFailedAttempt(email);
        throw error;
      }

      if (data.user) {
        await this.createBenutzerRecord(data.user.id, vorname, nachname, email, klasseId);
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
  async createBenutzerRecord(authUserId, vorname, nachname, email = null, klasseId = null) {
    try {
      if (!window.supabase) {
        console.warn('⚠️ Supabase nicht verfügbar - überspringe Benutzer-Erstellung');
        return;
      }

      // Kombinierter Name für Abwärtskompatibilität
      const fullName = `${vorname} ${nachname}`.trim();

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
        
        // Update E-Mail, Name und Mitarbeiter-Klasse falls angegeben und noch nicht gesetzt
        const updateData = {};
        if (email && !existingUser.email) updateData.email = email;
        if (klasseId) updateData.mitarbeiter_klasse_id = klasseId;
        if (vorname) updateData.vorname = vorname;
        if (nachname) updateData.nachname = nachname;
        if (fullName) updateData.name = fullName;
        
        if (Object.keys(updateData).length > 0) {
          const { error: updateError } = await window.supabase
            .from('benutzer')
            .update(updateData)
            .eq('auth_user_id', authUserId);
            
          if (updateError) {
            console.error('❌ Fehler beim Update des Benutzer-Records:', updateError.message);
          } else {
            console.log('✅ Benutzer-Record aktualisiert (E-Mail/Name/Klasse)');
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
          name: fullName,
          vorname: vorname,
          nachname: nachname,
          email: email,
          rolle: 'pending',
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
            .update({ email: email, name: fullName, vorname: vorname, nachname: nachname })
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
        await window.supabase?.removeChannel(this._userSubscription);
        this._userSubscription = null;
        console.log('✅ Realtime-Subscription entfernt');
      }
      
      if (window.supabase) {
        await window.supabase.auth.signOut();
      }
      
      window.currentUser = null;
      
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

      if (!window.supabase) {
        throw new Error('Verbindung zum Server nicht möglich. Bitte später erneut versuchen.');
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
        throw new Error('Verbindung zum Server nicht möglich.');
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

  // Header-Buttons basierend auf Rolle anpassen
  updateHeaderForRole(rolle) {
    const isKunde = rolle === 'kunde' || rolle === 'kunde_editor';
    
    // Education Button ausblenden für Kunden
    const educationBtn = document.querySelector('.education-btn');
    if (educationBtn) {
      educationBtn.style.display = isKunde ? 'none' : '';
    }
    
    // Notification Menu ausblenden für Kunden
    const notificationMenu = document.getElementById('feedbackNotificationMenu');
    if (notificationMenu) {
      notificationMenu.style.display = isKunde ? 'none' : '';
    }
    
    console.log(`🎨 Header aktualisiert für Rolle: ${rolle}, isKunde: ${isKunde}`);
  }
}

// Exportiere Instanz
export const authService = new AuthService();
