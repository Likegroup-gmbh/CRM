// skript-context/formatter.js
// Formatierungs-Helfer fuer den Prompt-Text (Sektionen, Preise, Varianten,
// Skripte, Laengen-Hinweise, Transkript-Kuerzung).

// Harte Budgets fuer Freitext-Felder im Prompt (Generate-/Fragen-Pfad; der
// Edit-Pfad hat seine EDIT_*_MAX in skript-edit-prompt.js). Schuetzt vor
// aufgeblaehten CRM-Feldern und bremst Injection-Versuche ein.
const KONTEXT_MAX = {
  dna: 4000,
  beschreibung: 2000,
  beispiel: 2000,
  antiPattern: 1000,
  caption: 2000,
  userText: 4000
};

/** Kuerzt Freitext hart auf max Zeichen. */
function cap(text, max) {
  if (!text) return '';
  const t = String(text);
  return t.length <= max ? t : `${t.slice(0, max)}…`;
}

function fmtSection(title, obj) {
  if (!obj) return '';
  const lines = Object.entries(obj)
    .filter(([, v]) => v !== null && v !== undefined && String(v).trim() !== '')
    .map(([k, v]) => `- ${k}: ${v}`);
  if (!lines.length) return '';
  return `\n## ${title}\n${lines.join('\n')}\n`;
}

const fmtEuro = (n) => Number(n).toFixed(2).replace('.', ',');

/**
 * "29,90 EUR", "29,90-49,90 EUR" oder "199,00 EUR (UVP 399,00 EUR)".
 * Der UVP gehoert dazu: die Ersparnis ist im Skript oft das Argument.
 * null, wenn kein Preis gepflegt ist.
 */
function produktPreis(produkt) {
  const von = produkt.preis_von != null ? fmtEuro(produkt.preis_von) : null;
  const bis = produkt.preis_bis != null ? fmtEuro(produkt.preis_bis) : null;

  const basis = von && bis && von !== bis
    ? `${von}-${bis} EUR`
    : von ? `${von} EUR` : bis ? `bis ${bis} EUR` : null;
  if (!basis) return null;

  // Ein UVP unterhalb des Verkaufspreises ist ein Datenfehler und waere im
  // Skript eine falsche Behauptung - dann lieber weglassen.
  const uvp = produkt.preis_uvp != null ? Number(produkt.preis_uvp) : null;
  const zeigtUvp = uvp != null && (produkt.preis_von == null || uvp > Number(produkt.preis_von));
  return zeigtUvp ? `${basis} (regulaer/UVP ${fmtEuro(uvp)} EUR)` : basis;
}

/**
 * Varianten als Liste. Wichtig fuers Skript: eine Kollektion kann mehrere
 * Ausfuehrungen haben, das Video zeigt aber eine konkrete.
 */
function fmtVarianten(varianten) {
  if (!varianten?.length) return '';
  const lines = varianten.map((v) => {
    const details = [
      v.farbe ? `Farbe: ${v.farbe}` : null,
      v.modell_kompatibilitaet ? `passend fuer: ${v.modell_kompatibilitaet}` : null,
      v.preis != null ? `Preis: ${fmtEuro(v.preis)} EUR` : null,
      v.uvp != null ? `UVP: ${fmtEuro(v.uvp)} EUR` : null,
      v.merkmal
    ].filter(Boolean).join(', ');
    return `- ${v.name}${details ? ` (${details})` : ''}`;
  });
  return `\n## Produktvarianten\n${lines.join('\n')}\n`;
}

function fmtSkript(s) {
  if (s.inhalt_md) {
    return [
      s.titel ? `Titel: ${s.titel}` : null,
      cap(s.inhalt_md, KONTEXT_MAX.beispiel)
    ].filter(Boolean).join('\n');
  }
  return [
    s.titel ? `Titel: ${s.titel}` : null,
    s.hook ? `HOOK: ${s.hook}` : null,
    s.hook_visuell ? `HOOK (was zu sehen ist): ${s.hook_visuell}` : null,
    s.hauptteil ? `HAUPTTEIL: ${s.hauptteil}` : null,
    s.hauptteil_visuell ? `HAUPTTEIL (was zu sehen ist): ${s.hauptteil_visuell}` : null,
    s.cta ? `CTA: ${s.cta}` : null,
    s.cta_visuell ? `CTA (was zu sehen ist): ${s.cta_visuell}` : null
  ].filter(Boolean).join('\n');
}

// Gesprochenes Deutsch: ca. 2,3 Woerter pro Sekunde (auf 5er gerundet)
const WOERTER_PRO_SEKUNDE = 2.3;

/**
 * Menschlich lesbarer Laengen-Hinweis inkl. Wort-Budget aus einer
 * Sekunden-Spanne wie "30-45". Liefert null bei fehlender/kaputter Angabe.
 */
function videoLaengeHinweis(spanne) {
  if (!spanne) return null;
  const [von, bis] = String(spanne).split('-').map((n) => parseInt(n, 10));
  if (!Number.isFinite(von) || !Number.isFinite(bis) || bis <= 0) return null;
  const rund5 = (n) => Math.max(5, Math.round(n / 5) * 5);
  const minWoerter = rund5(von * WOERTER_PRO_SEKUNDE);
  const maxWoerter = rund5(bis * WOERTER_PRO_SEKUNDE);
  return `${von}-${bis} Sekunden gesprochen, das sind ca. ${minWoerter}-${maxWoerter} Woerter GESAMT (gesamtes Skript)`;
}

// ---------------------------------------------------------------------------
// Videovorlage (Referenzvideo): optionale kreative Basis eines neuen Skripts
// ---------------------------------------------------------------------------
// Transkript-Budget im Prompt: bei sehr langen Vorlagen bleiben Anfang UND
// Ende erhalten (Hook + CTA), die Mitte wird gekuerzt - die Llama-Beschreibung
// deckt den Gesamtinhalt ab.
const REFERENZ_TRANSKRIPT_MAX = 12000;

function kuerzeTranskript(text, max = REFERENZ_TRANSKRIPT_MAX) {
  const t = (text || '').trim();
  if (t.length <= max) return t;
  const kopf = Math.ceil(max * 0.6);
  const rest = max - kopf;
  return `${t.slice(0, kopf)}\n[... Transkript gekuerzt ...]\n${t.slice(-rest)}`;
}

module.exports = {
  fmtSection, fmtSkript, fmtVarianten, produktPreis,
  videoLaengeHinweis, WOERTER_PRO_SEKUNDE,
  kuerzeTranskript, REFERENZ_TRANSKRIPT_MAX,
  cap, KONTEXT_MAX
};
