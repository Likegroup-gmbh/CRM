// ManagementConnect.js (ES6-Modul)
// "Connect" in der Management-Liste: sucht zu den ausgewaehlten Managements die
// Homepage im Netz, liest Impressum und Kontaktseite und schreibt E-Mail,
// Telefon, Webseite, Instagram und Adresse - aber nur in LEERE Felder.
//
// Die Arbeit passiert serverseitig in site-extract-background (Suche ->
// Extraktion -> Namens-Gate). Hier laeuft nur die Schleife: ein Management
// nach dem anderen, abbrechbar, danach der Patch ueber den normalen Update-Weg
// (dataService, RLS).

import { requestExtractJob } from '../../core/form/ai/SiteExtractHandler.js';

// Testphase: ausfuehrliche Console-Ausgabe pro Management. Nach dem
// Nachfuellen auf false stellen oder logConnectErgebnis samt Aufrufen loeschen.
export const CONNECT_DEBUG = true;

// Nur diese Spalten werden je beschrieben - alles andere aus der Antwort
// (z.B. firmenname, nur fuer das Namens-Gate) wird ignoriert
export const CONNECT_FELDER = ['email', 'telefonnummer', 'webseite', 'instagram', 'strasse', 'hausnummer', 'plz', 'stadt', 'land'];

// Suche (max. 60s) und Seitenauswertung (max. 120s) hintereinander
const JOB_TIMEOUT_MS = 5 * 60 * 1000;

// Button waehrend des Laufs: "Stopp" macht klar, dass ein weiterer Klick abbricht
const LAUF_PREFIX = 'Stopp';

// progress_step aus der Job-Zeile -> Kurztext am Button
const STEP_TEXT = {
  start: 'Startet…',
  suche: 'Sucht…',
  cache: 'Liest…',
  laden: 'Seite laden…',
  unterseite: 'Unterseiten…',
  auswerten: 'KI wertet aus…'
};

const STATUS_TEXT = {
  gefuellt: 'befüllt',
  nichts_neu: 'nichts Neues',
  schon_komplett: 'schon komplett',
  kein_treffer: 'kein Treffer',
  fehler: 'Fehler'
};

export function istLeer(wert) {
  return wert === null || wert === undefined || String(wert).trim() === '';
}

/**
 * Was darf in die Datenbank? Nur gefundene Werte fuer Spalten, die leer sind.
 * @param {Object} management - aktuelle Zeile
 * @param {Object} fields - result.fields der Extraktion ({ name: { value, kind, from } })
 * @returns {{ patch: Object, uebersprungen: string[], nichtGefunden: string[] }}
 */
export function baueLeerFeldPatch(management, fields) {
  const patch = {};
  const uebersprungen = [];
  const nichtGefunden = [];

  for (const name of CONNECT_FELDER) {
    const gefunden = fields?.[name]?.value;
    if (istLeer(gefunden)) {
      nichtGefunden.push(name);
    } else if (!istLeer(management?.[name])) {
      uebersprungen.push(name);
    } else {
      patch[name] = String(gefunden).trim();
    }
  }
  return { patch, uebersprungen, nichtGefunden };
}

function kostenText(cost) {
  return cost && typeof cost.eur === 'number' ? `${(cost.eur * 100).toFixed(2)} ct` : 'Kosten unbekannt';
}

/**
 * Console-Ausgabe zu einem Management (nur Testphase, siehe CONNECT_DEBUG).
 */
function logConnectErgebnis({ management, status, payload, patch, uebersprungen, nichtGefunden, fehler }) {
  if (!CONNECT_DEBUG) return;

  const agentur = payload?.diagnostics?.agentur || null;
  const geschrieben = Object.keys(patch || {});
  const kopf = [
    `🔗 MANAGEMENT-CONNECT ${management.firmenname}`,
    STATUS_TEXT[status] || status,
    status === 'gefuellt' ? `${geschrieben.length} geschrieben` : null,
    kostenText(payload?.cost)
  ].filter(Boolean).join(' · ');

  // Treffer, Ablehnungen und Fehler offen, Leerlauf zugeklappt
  const ruhig = status === 'nichts_neu' || status === 'schon_komplett';
  if (ruhig) console.groupCollapsed(kopf);
  else console.group(kopf);

  if (fehler) console.error('Fehler:', fehler);

  if (agentur) {
    const s = agentur.suche || {};
    if (s.uebersprungen) {
      console.log(`Suche: ${s.uebersprungen} (${s.gewaehlt})`);
    } else {
      console.log(
        `Suche: ${(s.queries || []).length} Anfrage(n)`
        + (s.queries?.length ? `\n  ${s.queries.map((q) => `"${q}"`).join('\n  ')}` : '')
      );
      if (s.quellen?.length) {
        console.groupCollapsed(`Quellen (${s.quellen.length})`);
        console.table(s.quellen.map((q) => ({ Host: q.host, Titel: q.titel || '', URL: q.url })));
        console.groupEnd();
      }
      console.log(
        `Modell nennt: ${s.modellUrl || '–'}`
        + (s.begruendung ? `\n  Begründung: ${s.begruendung}` : '')
      );
      console.log(`Gewählt: ${s.gewaehlt || '–'}${agentur.grund ? `\n  Abgelehnt: ${agentur.grund}` : ''}`);
    }

    if (agentur.gate) {
      const g = agentur.gate;
      console.log(
        `Namens-Gate: ${g.passt ? 'passt' : 'passt NICHT'}`
        + `\n  Stammdaten: "${g.stammdatenName}" (Wörter: ${g.stammTokens.join(', ') || '–'})`
        + `\n  Auf der Seite: "${g.extrahierterName || '–'}"`
        + `\n  Treffer: ${g.treffer.join(', ') || '–'}`
      );
    }
  }

  const fields = payload?.fields || {};
  if (Object.keys(fields).length) {
    console.log('Gefunden:');
    console.table(Object.entries(fields).map(([feld, f]) => ({ Feld: feld, Wert: f.value, Quelle: f.from || '', Art: f.kind })));
  }
  if (agentur?.verworfeneFelder && Object.keys(agentur.verworfeneFelder).length) {
    console.log('Verworfen (Namens-Gate), NICHT gespeichert:');
    console.table(Object.entries(agentur.verworfeneFelder).map(([feld, f]) => ({ Feld: feld, Wert: f.value, Quelle: f.from || '' })));
  }

  if (geschrieben.length) console.log('Geschrieben:', patch);
  if (uebersprungen?.length) console.log(`Übersprungen (schon befüllt): ${uebersprungen.join(', ')}`);
  if (status !== 'kein_treffer' && nichtGefunden?.length) console.log(`Nicht gefunden: ${nichtGefunden.join(', ')}`);
  if (payload?.notes?.length) console.log('Hinweise:', payload.notes);

  console.groupEnd();
}

export class ManagementConnect {
  /**
   * @param {Object} [hooks]
   * @param {(text: string) => void} [hooks.onProgress] - Button-Beschriftung
   * @param {() => void} [hooks.onFinish] - Lauf zu Ende (auch bei Abbruch)
   */
  constructor({ onProgress = () => {}, onFinish = () => {} } = {}) {
    this.onProgress = onProgress;
    this.onFinish = onFinish;
    this.running = false;
    this._abort = null;
  }

  /** Erster Klick startet, zweiter (waehrend des Laufs) bricht ab. */
  toggle(ids) {
    if (this.running) {
      this.stop();
      return Promise.resolve();
    }
    return this.start(ids);
  }

  stop() {
    if (!this.running || !this._abort) return;
    this._abort.abort();
    this.onProgress('Wird gestoppt…');
  }

  async start(ids) {
    const liste = Array.from(new Set(ids || []));
    if (this.running || liste.length === 0 || !window.supabase) return;

    this.running = true;
    this._abort = new AbortController();
    const stats = { gefuellt: 0, nichts_neu: 0, schon_komplett: 0, kein_treffer: 0, fehler: 0, eur: 0 };
    let limitErreicht = false;

    try {
      this.onProgress(`${LAUF_PREFIX} · Lade…`);
      const { data: zeilen, error } = await window.supabase
        .from('management')
        .select(['id', 'firmenname', ...CONNECT_FELDER].join(', '))
        .in('id', liste);
      if (error) throw error;
      const nachId = new Map((zeilen || []).map((z) => [z.id, z]));

      for (let i = 0; i < liste.length; i += 1) {
        if (this._abort.signal.aborted) break;
        const management = nachId.get(liste[i]);
        if (!management) continue;

        const position = `${i + 1}/${liste.length}`;
        this.onProgress(`${LAUF_PREFIX} · ${position}`);
        const ergebnis = await this._verarbeite(management, (step) => {
          if (this._abort?.signal.aborted) return;
          const text = STEP_TEXT[step];
          this.onProgress(text ? `${LAUF_PREFIX} · ${position} · ${text}` : `${LAUF_PREFIX} · ${position}`);
        });
        if (ergebnis.abgebrochen) break;
        stats[ergebnis.status] += 1;
        stats.eur += ergebnis.eur || 0;

        if (ergebnis.limit) {
          limitErreicht = true;
          break;
        }
      }
    } catch (err) {
      console.error('❌ MANAGEMENT-CONNECT:', err);
      window.toastSystem?.error?.(`Connect fehlgeschlagen: ${err.message}`);
    } finally {
      const abgebrochen = this._abort?.signal.aborted;
      this.running = false;
      this._abort = null;

      if (CONNECT_DEBUG) {
        console.log(
          `🔗 MANAGEMENT-CONNECT ${abgebrochen ? 'abgebrochen' : 'fertig'}: `
          + `${stats.gefuellt} befüllt, ${stats.nichts_neu} ohne Neues, ${stats.schon_komplett} schon komplett, `
          + `${stats.kein_treffer} kein Treffer, ${stats.fehler} Fehler · ${(stats.eur * 100).toFixed(2)} ct`
        );
      }
      if (abgebrochen) {
        window.toastSystem?.info?.(`Connect abgebrochen (${stats.gefuellt} befüllt)`);
      } else if (limitErreicht) {
        window.toastSystem?.warning?.('KI-Limit erreicht, Connect pausiert. Später mit den übrigen Einträgen erneut starten.');
      } else {
        window.toastSystem?.success?.(
          `Connect: ${stats.gefuellt} befüllt, ${stats.kein_treffer} kein Treffer`
          + (stats.fehler ? `, ${stats.fehler} Fehler` : '')
        );
      }

      // Einmal am Ende, damit die Liste nicht pro Zeile flackert
      window.dispatchEvent(new CustomEvent('entityUpdated', {
        detail: { entity: 'management', action: 'connected', count: stats.gefuellt }
      }));
      this.onFinish();
    }
  }

  /** Ein Management: Job, Patch, Log. Wirft nie, liefert { status, eur, limit }. */
  async _verarbeite(management, onStep = () => {}) {
    if (CONNECT_FELDER.every((name) => !istLeer(management[name]))) {
      logConnectErgebnis({ management, status: 'schon_komplett', payload: null, patch: {}, uebersprungen: [], nichtGefunden: [] });
      return { status: 'schon_komplett' };
    }

    let payload;
    try {
      payload = await requestExtractJob({
        entity: 'management',
        entityId: management.id,
        timeoutMs: JOB_TIMEOUT_MS,
        onStep: ({ step }) => onStep(step),
        signal: this._abort.signal
      });
    } catch (err) {
      if (err?.name === 'AbortError') return { status: 'fehler', eur: 0, abgebrochen: true };
      logConnectErgebnis({ management, status: 'fehler', payload: null, patch: {}, fehler: err.message });
      return { status: 'fehler', eur: 0, limit: /KI-Limit/i.test(err.message) };
    }

    const eur = payload?.cost?.eur || 0;

    if (payload.matched === false) {
      logConnectErgebnis({ management, status: 'kein_treffer', payload, patch: {}, uebersprungen: [], nichtGefunden: [] });
      return { status: 'kein_treffer', eur };
    }

    const { patch, uebersprungen, nichtGefunden } = baueLeerFeldPatch(management, payload.fields);
    if (Object.keys(patch).length === 0) {
      logConnectErgebnis({ management, status: 'nichts_neu', payload, patch, uebersprungen, nichtGefunden });
      return { status: 'nichts_neu', eur };
    }

    const res = await window.dataService.updateEntity('management', management.id, patch);
    if (!res?.success) {
      logConnectErgebnis({ management, status: 'fehler', payload, patch: {}, uebersprungen, nichtGefunden, fehler: res?.error || 'Speichern fehlgeschlagen' });
      return { status: 'fehler', eur };
    }

    logConnectErgebnis({ management, status: 'gefuellt', payload, patch, uebersprungen, nichtGefunden });
    return { status: 'gefuellt', eur };
  }
}
