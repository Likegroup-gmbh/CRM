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
   * @param {number} expiresInDays - Gültigkeit in Tagen (Standard: 7)
   * @returns {Promise<{success: boolean, link?: string, expiresAt?: Date, error?: string}>}
   */
  async createMagicLink(ansprechpartnerId, expiresInDays = 7) {
    try {
      if (!window.supabase) {
        throw new Error('Supabase nicht verfügbar');
      }

      const token = this.generateToken();
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + expiresInDays);

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
   * Validiert einen Token und lädt Ansprechpartner-Daten
   * @param {string} token - Der zu validierende Token
   * @returns {Promise<{valid: boolean, ansprechpartner?: object, magicLink?: object, error?: string}>}
   */
  async validateToken(token) {
    try {
      if (!window.supabase) {
        throw new Error('Supabase nicht verfügbar');
      }

      // Magic Link mit Ansprechpartner-Daten laden
      const { data: magicLink, error: linkError } = await window.supabase
        .from('magic_links')
        .select(`
          *,
          ansprechpartner:ansprechpartner_id (
            id,
            vorname,
            nachname,
            email,
            ansprechpartner_unternehmen (
              unternehmen:unternehmen_id (id, firmenname)
            ),
            ansprechpartner_marke (
              marke:marke_id (id, markenname)
            )
          )
        `)
        .eq('token', token)
        .single();

      if (linkError || !magicLink) {
        console.log('❌ Token nicht gefunden');
        return { valid: false, error: 'Ungültiger oder abgelaufener Link' };
      }

      // Prüfen ob bereits verwendet
      if (magicLink.used_at) {
        console.log('❌ Token bereits verwendet');
        return { valid: false, error: 'Dieser Link wurde bereits verwendet' };
      }

      // Prüfen ob abgelaufen
      if (new Date(magicLink.expires_at) < new Date()) {
        console.log('❌ Token abgelaufen');
        return { valid: false, error: 'Dieser Link ist abgelaufen' };
      }

      console.log('✅ Token gültig:', { ansprechpartner: magicLink.ansprechpartner });

      return {
        valid: true,
        ansprechpartner: magicLink.ansprechpartner,
        magicLink: {
          id: magicLink.id,
          expiresAt: magicLink.expires_at
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

  async syncCustomerLinksFromAnsprechpartner(kundeId, ansprechpartner) {
    if (!kundeId || !ansprechpartner) return;

    // Unternehmen-Zuordnungen idempotent ergänzen
    const unternehmenLinks = (ansprechpartner.ansprechpartner_unternehmen || [])
      .map(au => au?.unternehmen?.id)
      .filter(Boolean)
      .map(unternehmenId => ({
        kunde_id: kundeId,
        unternehmen_id: unternehmenId
      }));

    if (unternehmenLinks.length > 0) {
      const { error: unternehmenError } = await window.supabase
        .from('kunde_unternehmen')
        .upsert(unternehmenLinks, { onConflict: 'kunde_id,unternehmen_id', ignoreDuplicates: true });

      if (unternehmenError) {
        console.warn('⚠️ Unternehmen-Verknüpfung fehlgeschlagen:', unternehmenError);
      } else {
        console.log('✅ Unternehmen verknüpft:', unternehmenLinks.length);
      }
    }

    // Marken-Zuordnungen idempotent ergänzen
    const markenLinks = (ansprechpartner.ansprechpartner_marke || [])
      .map(am => am?.marke?.id)
      .filter(Boolean)
      .map(markeId => ({
        kunde_id: kundeId,
        marke_id: markeId
      }));

    if (markenLinks.length > 0) {
      const { error: markenError } = await window.supabase
        .from('kunde_marke')
        .upsert(markenLinks, { onConflict: 'kunde_id,marke_id', ignoreDuplicates: true });

      if (markenError) {
        console.warn('⚠️ Marken-Verknüpfung fehlgeschlagen:', markenError);
      } else {
        console.log('✅ Marken verknüpft:', markenLinks.length);
      }
    }

    // Kunde ↔ Ansprechpartner idempotent ergänzen
    const { error: linkError } = await window.supabase
      .from('kunde_ansprechpartner')
      .upsert({
        kunde_id: kundeId,
        ansprechpartner_id: ansprechpartner.id
      }, { onConflict: 'kunde_id,ansprechpartner_id', ignoreDuplicates: true });

    if (linkError) {
      console.warn('⚠️ Kunde-Ansprechpartner Verknüpfung fehlgeschlagen:', linkError);
    } else {
      console.log('✅ Kunde mit Ansprechpartner verknüpft');
    }
  }

  /**
   * Registriert einen neuen Kunden über Magic Link
   * @param {string} token - Magic Link Token
   * @param {string} email - E-Mail des Kunden
   * @param {string} password - Passwort
   * @param {string} name - Name des Kunden
   * @returns {Promise<{success: boolean, userId?: string, error?: string}>}
   */
  async registerWithMagicLink(token, email, password, name) {
    try {
      if (!window.supabase) {
        throw new Error('Supabase nicht verfügbar');
      }

      // 1. Token validieren
      const validation = await this.validateToken(token);
      if (!validation.valid) {
        return { success: false, error: validation.error };
      }

      const { ansprechpartner, magicLink } = validation;

      // 2. Supabase Auth User erstellen
      const { data: authData, error: authError } = await window.supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: `${this.baseUrl}/src/auth/verify-email.html?redirect_to=/kunden`,
          data: { 
            role: 'kunde', 
            subrole: 'can_view', 
            name,
            source: 'magic_link',
            ansprechpartner_id: ansprechpartner.id
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

      // 3. Bestehenden Kunden via E-Mail wiederverwenden, sonst neu anlegen
      const { data: existingByEmail, error: existingLookupError } = await window.supabase
        .from('benutzer')
        .select('id, auth_user_id')
        .ilike('email', email)
        .order('created_at', { ascending: false })
        .limit(1);

      if (existingLookupError) {
        throw existingLookupError;
      }

      const existingKunde = existingByEmail?.[0] || null;
      if (existingKunde?.auth_user_id && existingKunde.auth_user_id !== authUserId) {
        throw new Error('E-Mail ist bereits mit einem anderen Login verknüpft.');
      }

      let benutzerData = null;

      if (existingKunde) {
        const { data, error: updateError } = await window.supabase
          .from('benutzer')
          .update({
            auth_user_id: authUserId,
            name,
            rolle: 'kunde',
            freigeschaltet: true,
            zugriffsrechte: null
          })
          .eq('id', existingKunde.id)
          .select()
          .single();

        if (updateError) throw updateError;
        benutzerData = data;
      } else {
        const { data, error: benutzerError } = await window.supabase
          .from('benutzer')
          .upsert({
            auth_user_id: authUserId,
            name,
            email,
            rolle: 'kunde',
            freigeschaltet: true, // Direkt freigeschaltet da über Magic Link
            zugriffsrechte: null
          }, {
            onConflict: 'auth_user_id'
          })
          .select()
          .single();

        if (benutzerError) throw benutzerError;
        benutzerData = data;
      }

      const kundeId = benutzerData?.id;

      // 4. Fehlende Zuordnungen vom Ansprechpartner idempotent ergänzen
      if (kundeId) {
        await this.syncCustomerLinksFromAnsprechpartner(kundeId, ansprechpartner);
      }

      // 7. Magic Link als verwendet markieren
      const { error: usedError } = await window.supabase
        .from('magic_links')
        .update({ used_at: new Date().toISOString() })
        .eq('id', magicLink.id);

      if (usedError) {
        console.warn('⚠️ Magic Link konnte nicht als verwendet markiert werden:', usedError);
      } else {
        console.log('✅ Magic Link als verwendet markiert');
      }

      console.log('✅ Registrierung über Magic Link erfolgreich:', { kundeId, email });

      return {
        success: true,
        userId: kundeId,
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
