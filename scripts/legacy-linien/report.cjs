'use strict';
/** CSV-Ausgabe und -Einlesen fuer den Review der Altbestand-Linien-Migration. */

function zelle(value) {
  const text = value == null ? '' : String(value);
  return /[";\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

function toCsv(spalten, zeilen) {
  const kopf = spalten.join(';');
  const body = zeilen.map(z => spalten.map(s => zelle(z[s])).join(';'));
  return `\ufeff${[kopf, ...body].join('\n')}\n`;
}

function parseCsv(text) {
  const zeilen = [];
  let aktuell = [];
  let feld = '';
  let inAnfuehrung = false;
  const src = String(text).replace(/^\ufeff/, '');
  const trenner = src.split('\n')[0].includes(';') ? ';' : ',';
  for (let i = 0; i < src.length; i += 1) {
    const c = src[i];
    if (inAnfuehrung) {
      if (c === '"' && src[i + 1] === '"') { feld += '"'; i += 1; }
      else if (c === '"') inAnfuehrung = false;
      else feld += c;
    } else if (c === '"') inAnfuehrung = true;
    else if (c === trenner) { aktuell.push(feld); feld = ''; }
    else if (c === '\n' || c === '\r') {
      if (c === '\r' && src[i + 1] === '\n') i += 1;
      aktuell.push(feld);
      feld = '';
      if (aktuell.some(x => x !== '')) zeilen.push(aktuell);
      aktuell = [];
    } else feld += c;
  }
  if (feld !== '' || aktuell.length) { aktuell.push(feld); if (aktuell.some(x => x !== '')) zeilen.push(aktuell); }
  if (!zeilen.length) return [];
  const [kopf, ...rest] = zeilen;
  return rest.map(z => Object.fromEntries(kopf.map((k, i) => [k.trim(), (z[i] ?? '').trim()])));
}

const KAMPAGNEN_SPALTEN = [
  'kampagne_id', 'kampagne', 'status', 'gruende', 'warnungen', 'gruppen', 'produktionen_neu',
  'produktionen_umbenannt', 'linien_neu', 'koops', 'castings', 'konzepte', 'skripte', 'vertraege',
  'negativer_rest', 'freigabe',
];
const LINIEN_SPALTEN = [
  'kampagne_id', 'kampagne', 'produktion', 'produktion_neu', 'produktion_umbenannt_von', 'linie',
  'bereich', 'casting', 'konzept', 'casting_neu', 'konzept_neu', 'koops',
];
const KOOPS_SPALTEN = ['kampagne_id', 'kampagne', 'kooperation_id', 'produktion', 'linie', 'regel'];

function berichtZeilen(plaene, namen = {}) {
  const kampagnen = [];
  const linien = [];
  const koops = [];
  for (const plan of plaene) {
    kampagnen.push({
      kampagne_id: plan.kampagneId,
      kampagne: plan.name,
      status: plan.status,
      gruende: plan.gruende.join(','),
      warnungen: plan.warnungen.join(' | '),
      gruppen: plan.stats.gruppen,
      produktionen_neu: plan.stats.produktionenNeu,
      produktionen_umbenannt: plan.stats.produktionenUmbenannt,
      linien_neu: plan.stats.linienNeu,
      koops: plan.stats.koops,
      castings: plan.stats.castings,
      konzepte: plan.stats.konzepte,
      skripte: plan.stats.skripte,
      vertraege: plan.stats.vertraege,
      negativer_rest: plan.negativerRest ?? '',
      freigabe: '',
    });
    const produktionNachRef = new Map(plan.produktionen.map(p => [p.ref, p]));
    const koopsNachLinie = new Map();
    for (const z of plan.koopZuordnung) {
      koopsNachLinie.set(z.linieKey, (koopsNachLinie.get(z.linieKey) || 0) + 1);
      koops.push({
        kampagne_id: plan.kampagneId,
        kampagne: plan.name,
        kooperation_id: z.koopId,
        produktion: produktionNachRef.get(z.produktionRef)?.name || z.produktionRef,
        linie: plan.linien.find(l => l.key === z.linieKey)?.titel || z.linieKey,
        regel: z.regel,
      });
    }
    for (const linie of plan.linien) {
      const produktion = produktionNachRef.get(linie.produktionRef);
      linien.push({
        kampagne_id: plan.kampagneId,
        kampagne: plan.name,
        produktion: produktion?.name || linie.produktionRef,
        produktion_neu: produktion?.neu ? 'ja' : '',
        produktion_umbenannt_von: produktion?.umbenennen ? produktion.altName : '',
        linie: linie.titel,
        bereich: linie.bereich,
        casting: (linie.castingIds || []).map(id => namen.casting?.get(id) || id).join(' + '),
        konzept: linie.konzeptId ? (namen.konzept?.get(linie.konzeptId) || linie.konzeptId) : '',
        casting_neu: linie.neuCasting ? 'ja' : '',
        konzept_neu: linie.neuKonzept ? 'ja' : '',
        koops: koopsNachLinie.get(linie.key) || 0,
      });
    }
  }
  return { kampagnen, linien, koops };
}

module.exports = { toCsv, parseCsv, berichtZeilen, KAMPAGNEN_SPALTEN, LINIEN_SPALTEN, KOOPS_SPALTEN };
