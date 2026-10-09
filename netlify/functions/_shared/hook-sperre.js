// hook-sperre.js
// Hook-Sperre (ADR 0054): der gesprochene Hook einer Videoreferenz ist vom Kunden
// freigegeben. Generierung uebernimmt ihn woertlich, Edit-Auftraege aendern ihn nie.
// Der Hook-Text steht in strategie_items.beschreibung_struktur.hook (Altbestand:
// im Fliesstext der Beschreibung), das Flag in strategie_items.hook_gesperrt.

const { normalisiereStruktur, parseFliesstext } = require('./beschreibung-struktur');

const HOOK_SPERRE_HINWEIS = 'Den gesprochenen Hook habe ich nicht angefasst: Er ist vom Kunden freigegeben.';

/** Gesperrter Hook-Text einer Videoidee, sonst null (keine Sperre oder leerer Hook). */
function gesperrterHook(item) {
  if (!item?.hook_gesperrt) return null;
  const struktur = normalisiereStruktur(item.beschreibung_struktur) || parseFliesstext(item.beschreibung);
  const hook = String(struktur?.hook || '').trim();
  return hook || null;
}

/**
 * Laedt die Videoidee und liefert den gesperrten Hook. Ein Lesefehler (etwa
 * Spalte noch nicht migriert) bedeutet: keine Sperre, nie ein Abbruch.
 */
async function ladeGesperrtenHook(supabase, itemId) {
  if (!itemId) return null;
  const { data } = await supabase.from('strategie_items')
    .select('id, hook_gesperrt, beschreibung, beschreibung_struktur')
    .eq('id', itemId)
    .maybeSingle();
  return gesperrterHook(data);
}

/** Prompt-Block fuer den Edit-Auftrag. Leer ohne Sperre. */
function hookSperreEditBlock(hook) {
  if (!hook) return '';
  return '\n# HOOK-SPERRE\n'
    + 'Der gesprochene Hook (Zelle HOOK, Spalte „Was gesagt wird“) ist vom Kunden freigegeben und gesperrt. '
    + 'Du darfst ihn in keinem Auftrag aendern: nicht bei „alles“, nicht bei „nur der Hook“, nicht als vorschlag_text und nicht in aenderungen. '
    + 'Der Server verwirft jede Aenderung daran. '
    + 'Hook (was zu sehen ist), Text-Hook und Hook-Varianten darfst du weiter aendern, wenn der Auftrag sie trifft. '
    + 'Lag der gesprochene Hook im Auftrag, sage in antwort in einem Satz, dass du ihn nicht angefasst hast, weil der Kunde ihn freigegeben hat. '
    + 'Der gesperrte Wortlaut bleibt Teil der Geschichte: Hauptteil und CTA muessen dazu passen.\n'
    + `Gesperrter Hook:\n"""${hook}"""\n`;
}

/** Prompt-Block fuer die Generierung. Leer ohne Sperre. */
function hookSperreGenerierungBlock(hook) {
  if (!hook) return '';
  return '\n# GESPERRTER HOOK (vom Kunden freigegeben)\n'
    + 'Das Feld hook ist vorgegeben und wird unveraendert uebernommen. Schreibe ihn exakt so, ohne Kuerzung und ohne Umformulierung '
    + '(Absaetze nur, wenn der Wortlaut sie hat). Baue hook_visuell, hauptteil und cta so, dass sie an diesen Hook anschliessen. '
    + 'hook_varianten bleiben alternative Hooks, deutlich anders als dieser. '
    + 'Die VIDEOVORLAGE-REGEL (keine Hook-Formulierung der Vorlage) gilt nicht fuer diesen freigegebenen Hook.\n'
    + `Hook:\n"""${hook}"""\n`;
}

/**
 * Hook-Varianten ohne den gesperrten Wortlaut, nachgerueckt. Das Modell kennt den
 * Hook zwar aus dem Prompt, ein Treffer waere aber eine Variante ohne Unterschied.
 */
function varianteOhneGesperrtenHook(hookVarianten, hook) {
  const slots = [
    hookVarianten?.hook_variante_1,
    hookVarianten?.hook_variante_2,
    hookVarianten?.hook_variante_3
  ].filter((v) => v && (!hook || String(v).trim() !== hook));
  return {
    hook_variante_1: slots[0] || null,
    hook_variante_2: slots[1] || null,
    hook_variante_3: slots[2] || null
  };
}

/** Zelle einer Aenderung im Bundle: titel, <sektion> oder <sektion>_visuell. */
function istGesprochenerHook(a) {
  return a?.sektion === 'hook' && a?.spalte !== 'visuell';
}

/** Verwirft Bundle-Aenderungen am gesprochenen Hook. Ohne Sperre bleibt alles. */
function filtereHookSperre(aenderungen, hook) {
  const liste = Array.isArray(aenderungen) ? aenderungen : [];
  if (!hook) return { behalten: liste.slice(), verworfen: [] };
  const behalten = [];
  const verworfen = [];
  for (const a of liste) (istGesprochenerHook(a) ? verworfen : behalten).push(a);
  return { behalten, verworfen };
}

/**
 * Trifft der Einzel-Vorschlag den gesprochenen Hook?
 * sektion/ist_visuell sind die Werte nach mapEditResult. Eine Markierung im
 * gesprochenen Hook zaehlt ebenfalls.
 */
function trifftGesprochenenHook({ sektion, ist_visuell }) {
  return sektion === 'hook' && !ist_visuell;
}

/**
 * Lag der gesprochene Hook im Auftrag? Dann bekommt der Mitarbeiter den Hinweis,
 * auch wenn das Modell nichts vorgeschlagen hat.
 */
function hookLagImAuftrag({ message, umfang = null, umfangSektion = null }) {
  if (message?.aktion === 'visuell') return false;
  if (message?.aktion === 'chat') {
    return umfang === 'alles' || (umfang === 'teil' && umfangSektion === 'hook');
  }
  return message?.sektion === 'hook' && !message?.ist_visuell;
}

/** Haengt den Hinweis an die Antwort, sofern sie die Freigabe nicht schon nennt. */
function mitHookHinweis(antwort, betroffen) {
  if (!betroffen) return antwort;
  const text = String(antwort || '').trim();
  if (/freigegeben/i.test(text) && /hook/i.test(text)) return text;
  return [text, HOOK_SPERRE_HINWEIS].filter(Boolean).join(' ');
}

module.exports = {
  HOOK_SPERRE_HINWEIS,
  gesperrterHook,
  ladeGesperrtenHook,
  hookSperreEditBlock,
  hookSperreGenerierungBlock,
  varianteOhneGesperrtenHook,
  filtereHookSperre,
  trifftGesprochenenHook,
  hookLagImAuftrag,
  mitHookHinweis
};
