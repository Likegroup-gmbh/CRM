// _shared/ablage/zugriff.js
// Wer ruft, was darf er. Sichtbarkeit von Zeilen laeuft ueber RLS mit dem JWT des Aufrufers
// (callerClient), Schreibrechte ueber Rolle + Klasse wie PermissionSystem.canFeature('mediaUpload').

const { verifyAuth, authErrorBody } = require('../verify-auth');
const { callerClient, json } = require('./konfig');

const BENUTZER_SELECT = 'id, rolle, freigeschaltet, email, microsoft_konto, mitarbeiter_klasse:mitarbeiter_klasse_id(name)';

function klasse(b) {
  return String(b?.mitarbeiter_klasse?.name || '').trim().toLowerCase() || null;
}

const freigeschaltet = (b) => !!b && b.freigeschaltet !== false;
const istStaff = (b) => freigeschaltet(b) && (b.rolle === 'admin' || b.rolle === 'mitarbeiter');
const istAdmin = (b) => freigeschaltet(b) && b.rolle === 'admin';
// Finanzen-Klasse = Investor-Zeile der Feature-Matrix: kein Upload, auch nicht als Admin
const darfMediaUpload = (b) => istStaff(b) && klasse(b) !== 'finanzen';

/**
 * Aufrufer aus dem Bearer-Token.
 * @returns {Promise<{ ok:true, benutzer, user, caller } | { ok:false, antwort }>}
 */
async function aufrufer(event, supabase) {
  const auth = await verifyAuth(event, supabase);
  if (!auth.user) {
    const status = auth.code === 'auth_unavailable' ? 503 : auth.code === 'config_missing' ? 500 : 401;
    return { ok: false, antwort: json(status, authErrorBody(auth)) };
  }
  const { data: benutzer, error } = await supabase
    .from('benutzer')
    .select(BENUTZER_SELECT)
    .eq('auth_user_id', auth.user.id)
    .maybeSingle();
  if (error) throw error;
  if (!benutzer) return { ok: false, antwort: json(403, { error: 'Kein Benutzerprofil' }) };
  return { ok: true, benutzer, user: auth.user, caller: callerClient(event) };
}

/** Sieht der Aufrufer die Zeile (RLS)? */
async function sichtbar(caller, tabelle, id, select = 'id') {
  if (!caller) return null;
  const { data, error } = await caller.from(tabelle).select(select).eq('id', id).maybeSingle();
  if (error) {
    // RLS-Verweigerung meldet PostgREST als leeres Ergebnis; echte Fehler weiterreichen
    if (error.code === 'PGRST116') return null;
    throw error;
  }
  return data || null;
}

/**
 * Welche der Kooperationen darf der Aufrufer sehen?
 * Admin: alle. Mitarbeiter: nur zugeordnete (RPC mit seinem JWT, Regel wie kooperation_videos).
 * Kunden und Gaeste: RLS auf kooperationen.
 * @returns {Promise<Set<string>>}
 */
async function erlaubteKooperationen({ benutzer, caller }, ids) {
  const uniq = [...new Set((ids || []).filter(Boolean))];
  if (!uniq.length) return new Set();
  if (istAdmin(benutzer)) return new Set(uniq);
  if (!caller) return new Set();
  if (benutzer && (benutzer.rolle === 'admin' || benutzer.rolle === 'mitarbeiter')) {
    if (!freigeschaltet(benutzer)) return new Set();
    const { data, error } = await caller.rpc('ablage_meine_kooperationen', { p_ids: uniq });
    if (error) throw error;
    return new Set((data || []).map((r) => r.kooperation_id));
  }
  const { data, error } = await caller.from('kooperationen').select('id').in('id', uniq);
  if (error) throw error;
  return new Set((data || []).map((r) => r.id));
}

const verboten = (error = 'Keine Berechtigung') => json(403, { error });
const nichtGefunden = (error = 'Nicht gefunden') => json(404, { error });

module.exports = {
  BENUTZER_SELECT,
  klasse,
  istStaff,
  istAdmin,
  darfMediaUpload,
  aufrufer,
  sichtbar,
  erlaubteKooperationen,
  verboten,
  nichtGefunden,
};
