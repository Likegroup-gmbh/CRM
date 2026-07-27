// ExtractDiagnostics.js
// Gibt das diagnostics-Objekt aus site-extract als aufklappbare Gruppe in der
// Browser-Console aus.
//
// Warum: Wenn eine Extraktion leer bleibt oder abbricht, ist die Ursache ohne
// diese Ausgabe nicht erkennbar - lag es am Seitentyp, am Zeitbudget, an einer
// Bot-Wall oder daran, dass das Modell die Seite anders eingeordnet hat als die
// Heuristik? Wird auch im Fehlerfall aufgerufen.

const SEITENTYP_TEXT = {
  produktseite: 'Einzelne Produktseite',
  shop_uebersicht: 'Sortiments- oder Uebersichtsseite',
  dienstleistung: 'Dienstleistung oder Abo',
  blockiert: 'Blockiert (Bot-Schutz)',
  unklar: 'Nicht eindeutig'
};

const ABBRUCH_TEXT = {
  'modell-timeout': 'Auswertung lief in ihr Zeitlimit',
  'zeitlimit-vor-auswertung': 'Zeitbudget war vor der Auswertung aufgebraucht',
  fehler: 'Fehler in der Function'
};

function sek(ms) {
  return typeof ms === 'number' ? `${(ms / 1000).toFixed(1)}s` : '–';
}

function host(url) {
  try {
    return new URL(url).host;
  } catch {
    return url;
  }
}

/**
 * @param {Object} params
 * @param {string} params.url - die angefragte URL
 * @param {string} params.entity
 * @param {Object|null} params.payload - Antwort-Body der Function
 * @param {number} [params.httpStatus]
 */
export function logExtractDiagnostics({ url, entity, payload, httpStatus }) {
  const d = payload?.diagnostics;
  const felder = Object.keys(payload?.fields || {}).length;
  const okStatus = httpStatus === undefined || httpStatus === 200;

  if (!d) {
    console.groupCollapsed(`🔎 SITE-EXTRACT ${entity} · ${url} · keine Diagnose (HTTP ${httpStatus ?? '?'})`);
    if (payload) console.log('Antwort:', payload);
    console.groupEnd();
    return;
  }

  const kopf = [
    `🔎 SITE-EXTRACT ${entity}`,
    host(url),
    payload?.cached ? 'aus Cache' : `${felder} Felder`,
    sek(d.budget?.verbrauchtMs),
    d.abbruch ? `ABBRUCH: ${ABBRUCH_TEXT[d.abbruch] || d.abbruch}` : null,
    !okStatus ? `HTTP ${httpStatus}` : null
  ].filter(Boolean).join(' · ');

  // Auffaellige Laeufe direkt offen, unauffaellige zugeklappt
  const auffaellig = Boolean(d.abbruch) || (!payload?.cached && felder === 0);
  if (auffaellig) console.group(kopf);
  else console.groupCollapsed(kopf);

  if (d.fehler) console.error('Fehler:', d.fehler);

  console.log(
    `Seitentyp (Heuristik): ${SEITENTYP_TEXT[d.seitentyp] || d.seitentyp || '–'}`
    + (d.signale?.length ? `\n  Signale: ${d.signale.join(' · ')}` : '')
    + (typeof d.produktLinks === 'number' ? `\n  Produktlink-Kandidaten: ${d.produktLinks}` : '')
  );

  if (d.modell) {
    const m = d.modell;
    // Weicht die Selbstauskunft des Modells von der Heuristik ab, ist das der
    // erste Ort, an dem man nach einer Fehlklassifikation sucht
    console.log(
      `Modell: ${m.antwortModell || m.name}`
      + `\n  Timeout: ${sek(m.timeoutMs)}, gebraucht: ${sek(d.schritte?.modell)}`
      + `\n  Prompt: ${(m.promptZeichen || 0).toLocaleString('de-DE')} Zeichen`
      + (m.tokens ? `\n  Tokens: ${m.tokens.input} in / ${m.tokens.output} out` : '')
      + (m.modellSeitentyp ? `\n  Modell ordnet die Seite ein als: ${m.modellSeitentyp}` : '')
      + (m.vollstaendigkeit !== null && m.vollstaendigkeit !== undefined
        ? `\n  Vollstaendigkeit laut Modell: ${m.vollstaendigkeit}%` : '')
    );
  }

  if (d.seiten?.length) {
    console.groupCollapsed(`Geladene Seiten (${d.seiten.length})`);
    console.table(d.seiten.map((s) => ({
      Rolle: s.rolle,
      URL: s.url,
      Quelle: s.quelle,
      'fetch ms': s.fetchMs ?? '',
      'Browser ms': s.browserMs ?? '',
      'HTML Zeichen': s.zeichenHtml,
      Eingeschraenkt: s.eingeschraenkt ? 'ja' : '',
      Consent: s.consent || '',
      Grund: s.grund || ''
    })));
    console.groupEnd();
  }

  if (d.schritte && Object.keys(d.schritte).length) {
    console.groupCollapsed('Dauer pro Schritt');
    console.table(Object.entries(d.schritte).map(([schritt, ms]) => ({ Schritt: schritt, ms })));
    console.groupEnd();
  }

  console.log(
    `Budget: ${sek(d.budget?.verbrauchtMs)} von ${sek(d.budget?.gesamtMs)} verbraucht, ${sek(d.budget?.restMs)} uebrig`
    + (d.cacheGeschrieben === false ? '\n  Nicht zwischengespeichert' : '')
    + (d.cacheTreffer ? '\n  Cache-Treffer, keine Kosten' : '')
    + (d.unterseiteUebersprungen ? `\n  Beispiel-Produktseite ausgelassen: ${d.unterseiteUebersprungen}` : '')
  );

  if (payload?.notes?.length) console.log('Hinweise:', payload.notes);
  console.groupEnd();
}

/**
 * Kurzer, sichtbarer Hinweis, wenn die Extraktion nichts gefunden hat. Ohne den
 * passiert im UI schlicht nichts und der Nutzer haelt den Button fuer kaputt.
 */
export function nullergebnisHinweis(payload) {
  const d = payload?.diagnostics;
  if (d?.abbruch === 'modell-timeout' || d?.abbruch === 'zeitlimit-vor-auswertung') {
    return 'Zeitlimit erreicht, bevor die Seite fertig ausgelesen war. Bitte erneut versuchen oder eine konkretere URL angeben.';
  }
  if (d?.seitentyp === 'blockiert') {
    return 'Die Seite blockiert automatisierte Zugriffe. Bitte eine direkte Produktseite versuchen oder die Angaben manuell eintragen.';
  }
  return 'Auf der Seite waren keine verwertbaren Angaben zu finden. Details stehen in der Browser-Console.';
}
