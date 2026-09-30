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
function wortBudget(spanne) {
  if (!spanne) return null;
  const [von, bis] = String(spanne).split('-').map((n) => parseInt(n, 10));
  if (!Number.isFinite(von) || !Number.isFinite(bis) || bis <= 0) return null;
  const rund5 = (n) => Math.max(5, Math.round(n / 5) * 5);
  return {
    von,
    bis,
    min: rund5(von * WOERTER_PRO_SEKUNDE),
    max: rund5(bis * WOERTER_PRO_SEKUNDE)
  };
}

function videoLaengeHinweis(spanne) {
  const budget = wortBudget(spanne);
  if (!budget) return null;
  return `${budget.von}-${budget.bis} Sekunden gesprochen, das sind ca. ${budget.min}-${budget.max} Woerter GESAMT (gesamtes Skript)`;
}

function zaehleWoerter(text) {
  const t = String(text || '').trim();
  if (!t) return 0;
  return t.split(/\s+/).filter(Boolean).length;
}

function beats(text) {
  return String(text || '').split(/\n\s*\n/).map((b) => b.trim()).filter(Boolean);
}

function ohneZeitmarker(beat) {
  return String(beat || '')
    .replace(/^(Sek\.\s*)?\d+\s*[–-]\s*\d+\s*:\s*/i, '')
    .replace(/^\d{1,2}:\d{2}\s*[–-]\s*\d{1,2}:\d{2}\s*/,'')
    .trim();
}

/**
 * Setzt Sekunden aus den gesprochenen Wörtern auf die Visual-Beats.
 * Die Uhr läuft über Hook, Hauptteil und CTA durch. Leeres Visual bleibt leer.
 */
function stempelSekunden(felder) {
  const paare = [
    ['hook', 'hook_visuell'],
    ['hauptteil', 'hauptteil_visuell'],
    ['cta', 'cta_visuell']
  ];
  let sek = 0;
  const out = {};
  for (const [gesprochenKey, visuellKey] of paare) {
    const visuell = felder?.[visuellKey];
    if (!(visuell || '').trim()) {
      out[visuellKey] = visuell || null;
      sek += Math.round(zaehleWoerter(felder?.[gesprochenKey]) / WOERTER_PRO_SEKUNDE);
      continue;
    }
    const spoken = beats(felder?.[gesprochenKey]);
    const seen = beats(visuell);
    const gestempelt = seen.map((beat, i) => {
      const n = zaehleWoerter(spoken[i] || '') || Math.max(1, zaehleWoerter(ohneZeitmarker(beat)));
      const dauer = Math.max(1, Math.round(n / WOERTER_PRO_SEKUNDE));
      const von = sek;
      const bis = sek + dauer;
      sek = bis;
      return `Sek. ${von}–${bis}: ${ohneZeitmarker(beat)}`;
    });
    out[visuellKey] = gestempelt.join('\n\n');
  }
  return out;
}

function claimListe(raw) {
  return String(raw || '').split(/[\n,;]+/).map((s) => s.trim()).filter((s) => s.length >= 4);
}

function pruefeSkript(felder, { video_laenge, verbotene_claims } = {}) {
  const budget = wortBudget(video_laenge);
  const worte = zaehleWoerter(felder?.hook) + zaehleWoerter(felder?.hauptteil) + zaehleWoerter(felder?.cta);
  let laenge = null;
  if (budget) {
    let status = 'ok';
    if (worte < budget.min) status = 'unter';
    else if (worte > budget.max) status = 'ueber';
    laenge = { status, worte, min: budget.min, max: budget.max };
  }
  const hay = [felder?.hook, felder?.hauptteil, felder?.cta].filter(Boolean).join('\n').toLowerCase();
  const claims = claimListe(verbotene_claims).filter((c) => hay.includes(c.toLowerCase()));
  return { laenge, claims };
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
  videoLaengeHinweis, wortBudget, zaehleWoerter, stempelSekunden, pruefeSkript, WOERTER_PRO_SEKUNDE,
  kuerzeTranskript, REFERENZ_TRANSKRIPT_MAX,
  cap, KONTEXT_MAX
};
