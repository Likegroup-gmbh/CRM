// _shared/ablage/alarm.js
// Alert-Mails an die Admins, aufgerufen vom minuetlichen Zeitplan:
//   stillstand  Abgleich seit 15 Minuten ohne Erfolg
//   abo         Webhook-Abo laeuft in weniger als 3 Tagen ab (Verlaengerung schlug fehl)
//   zertifikat  App-Zertifikat laeuft in weniger als 30 Tagen ab
//   speicher    Bibliothek zu mehr als 80 % belegt
//   rechte      Rechte-Abgleich seit einer Stunde nicht gelaufen
// Je Alarm eine Mail beim Auftreten, danach taeglich, und eine, wenn er behoben ist.
// Gemerkt in ablage_stand.alarme, damit mehrere Instanzen nicht doppelt senden.

const { sendResendMail } = require('../resend');

const MIN = 60 * 1000;
const TAG = 24 * 60 * MIN;
const STILLSTAND_MS = 15 * MIN;
const ABO_MS = 3 * TAG;
const ZERT_MS = 30 * TAG;
const SPEICHER_ANTEIL = 0.8;
const RECHTE_MS = 60 * MIN;
const MESSEN_MS = 60 * MIN;
const ERINNERN_MS = TAG;
const NACH_FEHLER_MS = 15 * MIN;

const TITEL = {
  stillstand: 'Abgleich steht',
  abo: 'Webhook-Abo läuft ab',
  zertifikat: 'Zertifikat läuft ab',
  speicher: 'Speicher fast voll',
  rechte: 'Rechte-Abgleich steht',
};

const ms = (v) => (v ? Date.parse(v) : NaN);
const datum = (v) => new Date(v).toLocaleString('de-DE', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Europe/Berlin' });
const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

function dauer(diffMs) {
  const m = Math.round(diffMs / MIN);
  if (m < 120) return `${m} Minuten`;
  const h = Math.round(m / 60);
  return h < 48 ? `${h} Stunden` : `${Math.round(h / 24)} Tagen`;
}

/** Reine Pruefung: aktive Alarme mit Text. */
function alarmeAus(stand, jetzt = Date.now()) {
  const a = {};
  const erfolg = ms(stand.letzter_erfolg);
  const fehlerSeit = ms(stand.fehler_seit);
  if ((erfolg && jetzt - erfolg > STILLSTAND_MS) || (fehlerSeit && jetzt - fehlerSeit > STILLSTAND_MS)) {
    const seit = erfolg ? jetzt - erfolg : jetzt - fehlerSeit;
    a.stillstand = `Der Abgleich ist seit ${dauer(seit)} ohne Erfolg${stand.fehler ? `: ${stand.fehler}` : '.'}`
      + ' Dateien aus dem Finder kommen so lange nicht ins CRM.';
  }
  const abo = ms(stand.abo_ablauf);
  if (!abo) a.abo = 'Es besteht kein Webhook-Abo. Der Zeitplan konnte es nicht anlegen; Änderungen kommen nur noch minütlich per Abgleich.';
  else if (abo - jetzt < ABO_MS) a.abo = `Das Webhook-Abo läuft am ${datum(abo)} ab und ließ sich nicht verlängern.`;
  const zert = ms(stand.zert_ablauf);
  if (zert && zert - jetzt < ZERT_MS) {
    a.zertifikat = `Das App-Zertifikat läuft am ${datum(zert)} ab. Danach ist SharePoint für das CRM gesperrt.`
      + ' Neues Zertifikat erzeugen, in Entra hochladen und mit vault-setzen.mjs hinterlegen.';
  }
  const used = Number(stand.quota_used) || 0;
  const total = Number(stand.quota_total) || 0;
  if (total && used / total > SPEICHER_ANTEIL) {
    a.speicher = `Die Bibliothek ist zu ${Math.round((used / total) * 100)} % belegt (${(used / 1024 ** 3).toFixed(0)} von ${(total / 1024 ** 3).toFixed(0)} GB).`;
  }
  const rechte = ms(stand.rechte_lauf);
  if (rechte && jetzt - rechte > RECHTE_MS) {
    a.rechte = `Der Rechte-Abgleich lief zuletzt vor ${dauer(jetzt - rechte)}${stand.rechte_fehler ? ` (${stand.rechte_fehler})` : ''}.`
      + ' Neue Zuordnungen bekommen so lange keinen Zugriff.';
  }
  return a;
}

function createAlarm({ supabase, ablage, sendMail = sendResendMail, jetzt = () => Date.now(), seitenUrl = process.env.URL || '' }) {
  const iso = (t = jetzt()) => new Date(t).toISOString();

  /** Kontingent und Zertifikat hoechstens stuendlich; Fehler bleiben ohne Folgen. */
  async function messen(stand) {
    if (ms(stand.quota_at) && jetzt() - ms(stand.quota_at) < MESSEN_MS) return {};
    const patch = { quota_at: iso() };
    try {
      const q = await ablage.sp.quota();
      if (q.total != null) Object.assign(patch, { quota_used: q.used, quota_total: q.total });
    } catch (err) {
      console.warn('[ablage-alarm] Kontingent:', err.message);
    }
    try {
      const z = await ablage.zertifikat();
      if (z?.ablauf) patch.zert_ablauf = new Date(z.ablauf).toISOString();
    } catch (err) {
      console.warn('[ablage-alarm] Zertifikat:', err.message);
    }
    const { error } = await supabase.from('ablage_stand').update(patch).eq('drive_id', stand.drive_id);
    if (error) throw error;
    return patch;
  }

  async function empfaenger() {
    const { data, error } = await supabase.from('benutzer').select('email').eq('rolle', 'admin').eq('freigeschaltet', true);
    if (error) throw error;
    return [...new Set((data || []).map((b) => String(b.email || '').trim().toLowerCase()).filter(Boolean))];
  }

  function mail(aktiv, neuGemeldet, behoben) {
    const offen = Object.keys(aktiv);
    let titel = 'wieder in Ordnung';
    if (neuGemeldet.length) titel = neuGemeldet.map((k) => TITEL[k]).join(', ');
    else if (offen.length) titel = `Erinnerung: ${offen.map((k) => TITEL[k]).join(', ')}`;
    const zeilen = Object.entries(aktiv)
      .map(([k, text]) => `<li><strong>${esc(TITEL[k])}${neuGemeldet.includes(k) ? '' : ' (weiterhin)'}:</strong> ${esc(text)}</li>`);
    const ok = behoben.map((k) => `<li><strong>${esc(TITEL[k])}:</strong> behoben.</li>`);
    const link = seitenUrl ? `<p><a href="${esc(seitenUrl.replace(/\/+$/, ''))}/admin/medienablage">Medienablage-Stand öffnen</a></p>` : '';
    return {
      subject: `Medienablage: ${titel}`,
      html: `<p>Meldung der Medienablage (SharePoint):</p><ul>${[...zeilen, ...ok].join('')}</ul>${link}`,
    };
  }

  /** @param {object} stand Zeile aus ablage_stand (frisch gelesen) */
  async function lauf(stand) {
    if (!stand?.drive_id) return null;
    const s = { ...stand, ...(await messen(stand)) };
    const aktiv = alarmeAus(s, jetzt());
    const alt = s.alarme || {};
    const neu = {};
    const melden = [];
    for (const [k, text] of Object.entries(aktiv)) {
      const vorher = alt[k] || {};
      neu[k] = { seit: vorher.seit || iso(), gemeldet_at: vorher.gemeldet_at || null, versuch_at: vorher.versuch_at || null, text };
      const faellig = vorher.gemeldet_at
        ? jetzt() - ms(vorher.gemeldet_at) >= ERINNERN_MS
        // Ohne Zustellung (Staging ohne RESEND_API_KEY, Resend-Ausfall) erst nach 15 Minuten erneut
        : !vorher.versuch_at || jetzt() - ms(vorher.versuch_at) >= NACH_FEHLER_MS;
      if (faellig) melden.push(k);
    }
    const behoben = Object.keys(alt).filter((k) => !aktiv[k] && alt[k]?.gemeldet_at);

    let gesendet = 0;
    if (melden.length || behoben.length) {
      const an = await empfaenger();
      const { subject, html } = mail(aktiv, melden.filter((k) => !alt[k]?.gemeldet_at), behoben);
      for (const to of an) {
        const r = await sendMail({ to, subject, html });
        if (r?.ok) gesendet++;
        else console.warn(`[ablage-alarm] Mail an ${to}: ${r?.error || 'fehlgeschlagen'}`);
      }
      console.log(`[ablage-alarm] ${subject} -> ${gesendet}/${an.length}`);
      for (const k of melden) {
        neu[k].versuch_at = iso();
        if (gesendet) neu[k].gemeldet_at = iso();
      }
    }

    if (JSON.stringify(neu) !== JSON.stringify(alt)) {
      const { error } = await supabase.from('ablage_stand').update({ alarme: neu }).eq('drive_id', s.drive_id);
      if (error) throw error;
    }
    return { aktiv: Object.keys(aktiv), gemeldet: melden, behoben, gesendet };
  }

  return { lauf, messen };
}

module.exports = { createAlarm, alarmeAus, TITEL };
