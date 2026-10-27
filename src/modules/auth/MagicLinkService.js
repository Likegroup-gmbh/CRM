// MagicLinkService.js (ES6-Modul)
// Magic Link System für Ansprechpartner-Registrierung

export class MagicLinkService {
  constructor() {
    this.baseUrl = window.location.origin;
  }

  /**
   * Generiert einen kryptografisch sicheren Token (32 Zeichen)
   * @returns {string} Token
   */
  generateToken() {
    const array = new Uint8Array(24);
    crypto.getRandomValues(array);
    return Array.from(array, byte => byte.toString(16).padStart(2, '0')).join('');
  }

  /**
   * Erstellt einen Magic Link für einen Ansprechpartner
   * @param {string} ansprechpartnerId - UUID des Ansprechpartners
   * @param {number|null} expiresInDays - Gültigkeit in Tagen. null/undefined = unbegrenzt gültig (Default).
   * @returns {Promise<{success: boolean, link?: string, expiresAt?: Date, error?: string}>}
   */
  async createMagicLink(ansprechpartnerId, expiresInDays = null) {
    try {
      if (!window.supabase) {
        throw new Error('Supabase nicht verfügbar');
      }

      const token = this.generateToken();
      // Sentinel-Datum für "unbegrenzt gültig" (kompatibel mit NOT NULL Constraint
      // auf magic_links.expires_at und mit der bestehenden Ablauf-Validierung).
      const expiresAt = expiresInDays == null
        ? new Date('9999-12-31T23:59:59Z')
        : (() => {
            const d = new Date();
            d.setDate(d.getDate() + expiresInDays);
            return d;
          })();

      const { data, error } = await window.supabase
        .from('magic_links')
        .insert({
          token,
          ansprechpartner_id: ansprechpartnerId,
          expires_at: expiresAt.toISOString(),
          created_by: window.currentUser?.id || null
        })
        .select()
        .single();

      if (error) {
        console.error('❌ Magic Link erstellen fehlgeschlagen:', error);
        throw error;
      }

      const link = `${this.baseUrl}/src/auth/magic-register.html?token=${token}`;
      
      console.log('✅ Magic Link erstellt:', { ansprechpartnerId, expiresAt });
      
      return {
        success: true,
        link,
        token,
        expiresAt,
        id: data.id
      };
    } catch (error) {
      console.error('❌ Fehler beim Erstellen des Magic Links:', error);
      return {
        success: false,
        error: error.message || 'Unbekannter Fehler'
      };
    }
  }

  /**
   * Validiert einen Token und lädt Ansprechpartner-Daten.
   * Die Prüfung läuft serverseitig (RPC magic_link_vorschau); die Tabelle magic_links ist für
   * nicht angemeldete Besucher nicht lesbar.
   * @param {string} token - Der zu validierende Token
   * @returns {Promise<{valid: boolean, ansprechpartner?: object, magicLink?: object, error?: string}>}
   */
  async validateToken(token) {
    try {
      if (!window.supabase) {
        throw new Error('Supabase nicht verfügbar');
      }

      const { data: vorschau, error: linkError } = await window.supabase
        .rpc('magic_link_vorschau', { p_token: token });

      if (linkError || !vorschau) {
        console.log('❌ Token nicht gefunden');
        return { valid: false, error: 'Ungültiger oder abgelaufener Link' };
      }

      if (!vorschau.valid) {
        const fehler = {
          used: 'Dieser Link wurde bereits verwendet',
          expired: 'Dieser Link ist abgelaufen'
        };
        const message = fehler[vorschau.error] || 'Ungültiger oder abgelaufener Link';
        console.log('❌ Token nicht verwendbar:', vorschau.error);
        return { valid: false, error: message };
      }

      return {
        valid: true,
        ansprechpartner: vorschau.ansprechpartner,
        magicLink: {
          id: vorschau.magic_link_id,
          expiresAt: vorschau.expires_at
        }
      };
    } catch (error) {
      console.error('❌ Fehler bei Token-Validierung:', error);
      return {
        valid: false,
        error: error.message || 'Validierung fehlgeschlagen'
      };
    }
  }

  /**
   * Registriert einen neuen Kunden über Magic Link.
   * Rolle, Freischaltung und Verknüpfungen setzt ausschließlich der Datenbank-Trigger
   * handle_new_auth_user anhand des Tokens. Der Browser schickt nur den Token mit.
   * @param {string} token - Magic Link Token
   * @param {string} email - E-Mail des Kunden
   * @param {string} password - Passwort
   * @param {string} name - Name des Kunden
   * @returns {Promise<{success: boolean, authUserId?: string, email?: string, error?: string}>}
   */
  async registerWithMagicLink(token, email, password, name) {
    try {
      if (!window.supabase) {
        throw new Error('Supabase nicht verfügbar');
      }

      const validation = await this.validateToken(token);
      if (!validation.valid) {
        return { success: false, error: validation.error };
      }

      const { data: authData, error: authError } = await window.supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: `${this.baseUrl}/src/auth/verify-email.html?redirect_to=/kunden`,
          data: {
            magic_token: token,
            name,
            source: 'magic_link'
          }
        }
      });

      if (authError) {
        console.error('❌ Auth Registrierung fehlgeschlagen:', authError);
        throw authError;
      }

      const authUserId = authData.user?.id;
      if (!authUserId) {
        throw new Error('Auth User ID nicht erhalten');
      }

      // Bereits registrierte E-Mail: Supabase liefert einen Schein-User ohne Identities,
      // der Token wurde dann nicht beansprucht.
      if (Array.isArray(authData.user.identities) && authData.user.identities.length === 0) {
        throw new Error('E-Mail ist bereits mit einem anderen Login verknüpft.');
      }

      console.log('✅ Registrierung über Magic Link erfolgreich:', { authUserId, email });

      return {
        success: true,
        authUserId,
        email
      };
    } catch (error) {
      console.error('❌ Registrierung über Magic Link fehlgeschlagen:', error);
      return {
        success: false,
        error: error.message || 'Registrierung fehlgeschlagen'
      };
    }
  }

  /**
   * Lädt alle Magic Links für einen Ansprechpartner
   * @param {string} ansprechpartnerId - UUID des Ansprechpartners
   * @returns {Promise<Array>}
   */
  async getMagicLinksForAnsprechpartner(ansprechpartnerId) {
    try {
      const { data, error } = await window.supabase
        .from('magic_links')
        .select(`
          *,
          erstellt_von:created_by (name)
        `)
        .eq('ansprechpartner_id', ansprechpartnerId)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('❌ Magic Links laden fehlgeschlagen:', error);
        return [];
      }

      return data || [];
    } catch (error) {
      console.error('❌ Fehler beim Laden der Magic Links:', error);
      return [];
    }
  }

  /**
   * Widerruft einen Magic Link (löscht ihn)
   * @param {string} magicLinkId - UUID des Magic Links
   * @returns {Promise<boolean>}
   */
  async revokeMagicLink(magicLinkId) {
    try {
      const { error } = await window.supabase
        .from('magic_links')
        .delete()
        .eq('id', magicLinkId);

      if (error) {
        console.error('❌ Magic Link widerrufen fehlgeschlagen:', error);
        return false;
      }

      console.log('✅ Magic Link widerrufen:', magicLinkId);
      return true;
    } catch (error) {
      console.error('❌ Fehler beim Widerrufen:', error);
      return false;
    }
  }
}

// Singleton-Instanz exportieren
export const magicLinkService = new MagicLinkService();
