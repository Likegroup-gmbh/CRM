// auswertungErfassenAktionen.js
// Was die Erfassen-Ansicht schreibt (ADR 0078): Screenshots hochladen und lesen lassen, Link
// abrufen, bestätigen und speichern, verwerfen und Zahlen löschen (Rückgängig über eine Verzögerung),
// manuell eintragen, weitere Plattform, KI-Lauf beobachten. Das Zeichnen übernimmt der Aufrufer über
// `ctx`; hier steht nur der Ablauf.

import { STANDARD_PLATTFORM, plattformAusLink } from './auswertungKonfig.js';
import { exakt, plural, unsichereFelder } from './auswertungFormat.js';
import { abrufGrund } from './auswertungQuellen.js';
import { bestaetigungsTeil, liesFormular, pflichtFehler, zeigeFeldFehler } from './auswertungFormular.js';
import {
  beendeKiLauf, bestaetigePost, bildFehler, ladeScreenshotsHoch, legePostAn, loeschePost, nimmBestaetigungZurueck,
  rufeLinkAb, setzeKiStatus, speicherePost, starteScreenshotLesen
} from './auswertungPostsSpeichern.js';
import { laufDauer, logKi, sekunden, warteAufKi } from './auswertungKiLauf.js';

// Etwas länger als der Toast mit „Rückgängig“ steht (ToastSystem ACTION_DURATION)
const LOESCH_VERZUG_MS = 5500;
const REIHENFOLGE = {
  video: ['ig_reel', 'tiktok', 'ig_post', 'ig_story'],
  story: ['ig_story', 'tiktok', 'ig_reel', 'ig_post'],
  still: ['ig_post', 'ig_story', 'tiktok', 'ig_reel']
};

// Über das Neu-Binden hinaus: ein verworfener Post bleibt weg, bis er wirklich gelöscht ist
const ausstehend = new Map();
export const wirdGeloescht = (postId) => ausstehend.has(postId);

const heuteIso = () => new Date().toISOString().slice(0, 10);
const toast = (text, typ = 'info', optionen) => window.toastSystem?.show(text, typ, undefined, optionen);

/** Nächste Plattform für „Weitere Plattform“, null wenn die Einheit schon alle hat. */
export function freiePlattform(einheit, posts) {
  const belegt = new Set((posts || []).map(p => p.plattform));
  return (REIHENFOLGE[einheit?.art] || REIHENFOLGE.video).find(p => !belegt.has(p)) || null;
}

/**
 * @param {object} ctx
 * @param {() => object|null} ctx.eintrag - gewählter Eintrag
 * @param {() => HTMLFormElement|null} ctx.form
 * @param {(post: object, opts?: { waehle?: boolean, fokus?: boolean }) => void} ctx.uebernimm
 * @param {(postId: string, opts?: { danach?: 'weiter'|'einheit' }) => void} ctx.entferne
 * @param {(vonKey: string) => void} ctx.weiter
 * @param {(an: boolean) => void} ctx.beschaeftigt
 * @param {(post: object) => string} ctx.labelFuer
 * @param {(einheitId: string) => object[]} ctx.postsDerEinheit
 */
export function erstelleAktionen(ctx) {
  const laeufe = new Map();
  let busy = false;

  async function gesperrt(fn) {
    if (busy) return;
    busy = true;
    ctx.beschaeftigt(true);
    try {
      await fn();
    } finally {
      busy = false;
      ctx.beschaeftigt(false);
    }
  }

  function meldeKi(post) {
    const label = ctx.labelFuer(post);
    if (post.kiStatus === 'fehler') {
      toast(`${label}: ${post.kiFehler || 'Die KI konnte den Screenshot nicht lesen.'}`, 'error');
      return;
    }
    const felder = Object.keys(post.confidence || {}).length;
    const unsicher = unsichereFelder(post).length;
    toast(`${label}: ${plural(felder, 'Feld', 'Felder')} aus ${plural(post.screenshots, 'Screenshot', 'Screenshots')} gelesen${unsicher ? ` · ${exakt(unsicher)} bitte prüfen` : ''}`, unsicher ? 'warning' : 'success');
  }

  /**
   * Post abfragen, bis die KI fertig ist; je Post nur eine Beobachtung. Jeder Schritt zeichnet
   * den Post neu. Läuft eine Frist ab, steht der Fehler danach am Post, nicht nur im Toast.
   */
  function beobachte(post) {
    if (!post?.id || laeufe.has(post.id)) return;
    const abort = new AbortController();
    laeufe.set(post.id, abort);
    const onSchritt = (neu) => { if (!abort.signal.aborted) ctx.uebernimm(neu); };
    warteAufKi(post.id, { signal: abort.signal, onSchritt, schritt: post.kiSchritt || null, lauf: post.kiGestartetAt || null })
      .then((fertig) => {
        if (!fertig || abort.signal.aborted) return;
        ctx.uebernimm(fertig);
        meldeKi(fertig);
      })
      .catch(async (error) => {
        if (abort.signal.aborted) return;
        const neu = await beendeKiLauf(post, error.message).catch(() => null);
        if (!neu) {
          toast(error.message, 'warning');
          return;
        }
        ctx.uebernimm(neu);
        meldeKi(neu);
      })
      .finally(() => { if (laeufe.get(post.id) === abort) laeufe.delete(post.id); });
  }

  /** Laufenden KI-Lauf beenden. Ein spätes Ergebnis der Function fällt weg (Lauf-Token). */
  async function abbrechen() {
    const post = ctx.eintrag()?.post;
    if (!post || post.kiStatus !== 'laeuft') return;
    logKi(post.id, `vom Team abgebrochen bei Schritt „${post.kiSchritt || '–'}“ nach ${sekunden(laufDauer(post.id))}`, undefined, 'warn');
    laeufe.get(post.id)?.abort();
    laeufe.delete(post.id);
    try {
      const neu = await beendeKiLauf(post, 'Abgebrochen.');
      if (!neu) return;
      ctx.uebernimm(neu);
      if (neu.kiStatus === 'fehler') toast('Lesen abgebrochen.');
      else meldeKi(neu);
    } catch (error) {
      toast(`Abbrechen fehlgeschlagen: ${error.message}`, 'error');
      beobachte(post);
    }
  }

  async function nimmScreenshots(files, eintrag = ctx.eintrag()) {
    if (!eintrag) {
      toast('Erst links einen Post wählen.');
      return;
    }
    const gueltig = files.filter(f => !bildFehler(f));
    const grund = files.map(bildFehler).find(Boolean);
    if (grund) toast(gueltig.length ? `${plural(files.length - gueltig.length, 'Bild', 'Bilder')} übersprungen: ${grund}` : grund, 'warning');
    if (!gueltig.length) return;

    let post = eintrag.post;
    let hochgeladen = false;
    try {
      if (!post) {
        const { einheit } = eintrag;
        post = await legePostAn({ einheitId: einheit.id, plattform: STANDARD_PLATTFORM[einheit.art] || 'ig_reel', dateiId: einheit.dateien?.[0]?.id || null, source: 'ki' });
        ctx.uebernimm(post, { waehle: true });
      }
      post = await ladeScreenshotsHoch(post, gueltig);
      hochgeladen = true;
      ctx.uebernimm(post);
      await starteScreenshotLesen(post.id);
      beobachte(post);
    } catch (error) {
      console.error('Auswertung: Screenshot nicht verarbeitet', error);
      toast(error.message || 'Der Screenshot konnte nicht verarbeitet werden.', 'error');
      if (hochgeladen) {
        const neu = await setzeKiStatus(post, 'fehler', error.message || 'Start fehlgeschlagen').catch(() => null);
        if (neu) ctx.uebernimm(neu);
      }
    }
  }

  async function holeLink({ neu = false } = {}) {
    const eintrag = ctx.eintrag();
    if (!eintrag) return;
    const link = neu ? eintrag.post?.link : String(ctx.form()?.querySelector('[data-erfassen-link]')?.value || '').trim();
    const grund = abrufGrund(link);
    if (grund) {
      toast(grund);
      return;
    }
    await gesperrt(async () => {
      const { einheit } = eintrag;
      let post = eintrag.post;
      try {
        const plattform = plattformAusLink(link, einheit.art);
        if (!post) {
          post = await legePostAn({ einheitId: einheit.id, plattform, dateiId: einheit.dateien?.[0]?.id || null, link });
          ctx.uebernimm(post, { waehle: true });
        } else if (post.link !== link) {
          post = await speicherePost(post, { link, plattform });
          ctx.uebernimm(post);
        }
        const fertig = await rufeLinkAb(post.id);
        ctx.uebernimm(fertig);
        const label = ctx.labelFuer(fertig);
        if (fertig.status !== 'confirmed') {
          toast(`${label}: Zahlen von Instagram ergänzt. Die gelesenen Werte noch prüfen.`);
          return;
        }
        if (neu) {
          toast(`${label}: Zahlen neu abgerufen.`, 'success');
          return;
        }
        // Der Eintrag bleibt gewählt und an seinem Platz: erst Zahlen ansehen, dann selbst speichern
        toast(`${label}: ${exakt(fertig.metrics.views)} Aufrufe von Instagram übernommen.`, 'success');
      } catch (error) {
        toast(error.message || 'Abruf fehlgeschlagen', error.retryable ? 'warning' : 'error');
      }
    });
  }

  async function zurueck(post, vorher) {
    try {
      const alt = await nimmBestaetigungZurueck(post, vorher);
      ctx.uebernimm(alt, { waehle: true });
    } catch (error) {
      toast(`Rückgängig fehlgeschlagen: ${error.message}`, 'error');
    }
  }

  /** Bestätigen & weiter beim Entwurf, Speichern beim bestätigten Post. */
  async function bestaetige() {
    const eintrag = ctx.eintrag();
    const form = ctx.form();
    if (!eintrag || !form || eintrag.status === 'liest') return;
    const teil = liesFormular(form);
    const fehler = pflichtFehler(teil);
    zeigeFeldFehler(form, fehler);
    if (fehler) return;
    await gesperrt(async () => {
      try {
        // Ohne Post (von Hand getippt) entsteht er erst jetzt, als Entwurf, und wird gleich bestätigt
        const { einheit } = eintrag;
        const vorher = eintrag.post || await legePostAn({
          einheitId: einheit.id, plattform: teil.plattform, dateiId: teil.dateiId ?? (einheit.dateien?.[0]?.id || null), link: teil.link
        });
        const post = await bestaetigePost(vorher, bestaetigungsTeil(vorher, teil));
        ctx.uebernimm(post);
        if (vorher.status === 'confirmed') {
          toast('Gespeichert.', 'success');
          return;
        }
        toast(`${ctx.labelFuer(post)} bestätigt.`, 'success', { action: { label: 'Rückgängig', onClick: () => { void zurueck(post, vorher); } } });
        ctx.weiter(`post:${post.id}`);
      } catch (error) {
        toast(`Speichern fehlgeschlagen: ${error.message}`, 'error');
      }
    });
  }

  /** Aus der Ansicht nehmen, nach der Verzögerung löschen; Rückgängig holt ihn zurück. */
  function entferne(post, { text, danach }) {
    const timer = setTimeout(() => {
      ausstehend.delete(post.id);
      loeschePost(post).catch((error) => {
        toast(`Löschen fehlgeschlagen: ${error.message}`, 'error');
        ctx.uebernimm(post);
      });
    }, LOESCH_VERZUG_MS);
    ausstehend.set(post.id, timer);
    ctx.entferne(post.id, { danach });
    toast(text, 'info', {
      action: {
        label: 'Rückgängig',
        onClick: () => {
          clearTimeout(timer);
          ausstehend.delete(post.id);
          ctx.uebernimm(post, { waehle: true });
        }
      }
    });
  }

  function verwerfe() {
    const post = ctx.eintrag()?.post;
    if (post) entferne(post, { text: `${ctx.labelFuer(post)} verworfen.`, danach: 'weiter' });
  }

  function loescheZahlen() {
    const post = ctx.eintrag()?.post;
    if (post) entferne(post, { text: `Zahlen von ${ctx.labelFuer(post)} gelöscht.`, danach: 'einheit' });
  }

  /** Ohne Post: Entwurf mit leeren Feldern der vermuteten Plattform. Nach einem KI-Fehler: Formular frei. */
  async function manuell() {
    const eintrag = ctx.eintrag();
    if (!eintrag) return;
    await gesperrt(async () => {
      try {
        if (eintrag.post) {
          ctx.uebernimm(await setzeKiStatus(eintrag.post, null, null), { fokus: true });
          return;
        }
        const { einheit } = eintrag;
        const link = String(ctx.form()?.querySelector('[data-erfassen-link]')?.value || '').trim() || null;
        const post = await legePostAn({
          einheitId: einheit.id,
          plattform: (link && plattformAusLink(link, einheit.art)) || STANDARD_PLATTFORM[einheit.art] || 'ig_reel',
          dateiId: einheit.dateien?.[0]?.id || null,
          link,
          measuredAt: heuteIso()
        });
        ctx.uebernimm(post, { waehle: true, fokus: true });
      } catch (error) {
        toast(`Anlegen fehlgeschlagen: ${error.message}`, 'error');
      }
    });
  }

  async function erneut() {
    const post = ctx.eintrag()?.post;
    if (!post?.screenshots) return;
    try {
      const neu = await setzeKiStatus(post, 'laeuft');
      ctx.uebernimm(neu);
      await starteScreenshotLesen(post.id);
      beobachte(neu);
    } catch (error) {
      toast(error.message, 'error');
      const neu = await setzeKiStatus(post, 'fehler', error.message).catch(() => null);
      if (neu) ctx.uebernimm(neu);
    }
  }

  async function weiterePlattform() {
    const eintrag = ctx.eintrag();
    if (!eintrag?.post) return;
    const plattform = freiePlattform(eintrag.einheit, ctx.postsDerEinheit(eintrag.einheit.id));
    if (!plattform) {
      toast('Für jede Plattform gibt es schon einen Post.');
      return;
    }
    await gesperrt(async () => {
      try {
        const post = await legePostAn({
          einheitId: eintrag.einheit.id, plattform, dateiId: eintrag.post.dateiId,
          postedAt: eintrag.post.postedAt, measuredAt: heuteIso()
        });
        ctx.uebernimm(post, { waehle: true, fokus: true });
      } catch (error) {
        toast(`Anlegen fehlgeschlagen: ${error.message}`, 'error');
      }
    });
  }

  return {
    beobachte,
    nimmScreenshots,
    holeLink,
    bestaetige,
    verwerfe,
    loescheZahlen,
    manuell,
    erneut,
    abbrechen,
    weiterePlattform,
    stop: () => { laeufe.forEach(a => a.abort()); laeufe.clear(); }
  };
}
