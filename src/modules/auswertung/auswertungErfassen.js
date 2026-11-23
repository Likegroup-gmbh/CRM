// auswertungErfassen.js
// Erfassen-Ansicht binden (Spec 7, ADR 0078): Auswahl, Filter, ↑/↓, Enter, Plattformwechsel,
// Messregel-Warnung, Cmd+V und Ablegen (nur solange die Ansicht hängt). Filter und Auswahl stehen in
// `zustand.erfassen`. Jede Änderung an einem Post geht über `aendere` an die Pane (Modell, Lead,
// Zähler am Unterreiter); danach zeichnet die Ansicht Liste und Prüfbereich nach, ohne neu zu laden.

import { CustomDatePicker } from '../../core/components/CustomDatePicker.js';
import { bindSegmentSwitches } from '../../core/components/SegmentSwitch.js';
import { merkeZustand, spieleUebergang } from './auswertungMotion.js';
import { ladePoster } from './auswertungTabelle.js';
import { FILTER_ATTR, STATUS, aktualisiereKopf, eintraegeAus, gefiltert, mitFixiertem, naechsterEintrag, renderZeilen } from './auswertungArbeitsliste.js';
import { abrufGrund, aktualisiereLinkHinweis, bilderAus, ziehtDateien } from './auswertungQuellen.js';
import { fokussiereErstesFeld, messWarnung, renderKennzahlFelder, setzeFeldWert, zahlAusEingabe } from './auswertungFormular.js';
import { blaettere, fuelleScreenshots } from './auswertungScreenshots.js';
import { erstelleAktionen } from './auswertungErfassenAktionen.js';
import { passt, renderPruefbereich } from './auswertungPruefbereich.js';
import { LANGSAM_AB_MS, laufDauer, laufzeitText } from './auswertungKiLauf.js';

/** Kurze CSS-Animation neu starten (Statuswechsel in der Liste, Wechsel im Prüfbereich). */
function blinke(el, klasse = 'is-neu') {
  el.classList.remove(klasse);
  void el.offsetWidth;
  el.classList.add(klasse);
  el.addEventListener('animationend', () => el.classList.remove(klasse), { once: true });
}

/**
 * @param {HTMLElement} root - [data-auswertung]
 * @param {object} opts
 * @param {() => object} opts.modell
 * @param {object} opts.zustand - mit `erfassen` (neuerErfassenZustand)
 * @param {Map} opts.posterCache
 * @param {{ post: (post: object) => boolean, weg: (postId: string) => boolean }} opts.aendere - false, wenn die Pane weg ist
 * @returns {() => void} cleanup
 */
export function bindeErfassen(root, { modell, zustand, posterCache, aendere }) {
  if (!root?.querySelector('[data-erfassen]')) return () => {};
  const abort = new AbortController();
  const { signal } = abort;
  const e = zustand.erfassen;
  // Der bearbeitete Eintrag bleibt an seinem Platz, bis ein anderer gewählt wird (siehe mitFixiertem)
  let fix = null;
  const lade = () => mitFixiertem(eintraegeAus(modell()), fix);
  let eintraege = lade();
  let geaendert = new Set();
  let merker = {};

  const form = () => root.querySelector('[data-erfassen-form]');
  const aktuell = () => eintraege.find(x => x.key === e.auswahl) || null;

  function zeichneListe() {
    const zeilen = root.querySelector('[data-erfassen-zeilen]');
    if (!zeilen) return;
    aktualisiereKopf(root.querySelector('[data-erfassen-kopf]'), eintraege, { filter: e.filter, fortschritt: modell().fortschritt });
    const status = new Map([...zeilen.querySelectorAll('[data-erfassen-eintrag]')].map(el => [el.dataset.erfassenEintrag, el.dataset.status]));
    const vorher = merkeZustand(zeilen);
    zeilen.innerHTML = renderZeilen(eintraege, { filter: e.filter, auswahl: e.auswahl });
    spieleUebergang(vorher, zeilen);
    zeilen.querySelectorAll('[data-erfassen-eintrag]').forEach((el) => {
      const alt = status.get(el.dataset.erfassenEintrag);
      if (alt && alt !== el.dataset.status) blinke(el);
    });
    ladePoster(zeilen, modell(), posterCache);
  }

  /** Offene Eingaben merken, damit ein Update von außen (KI fertig) nichts Getipptes überschreibt. */
  function offeneEingaben() {
    const f = form();
    if (!f || f.dataset.eintrag !== e.auswahl || !geaendert.size) return null;
    return [...geaendert].map((name) => {
      const el = f.querySelector(`[name="${name}"]`);
      return el ? [name, el.classList.contains('custom-date-picker__input') ? CustomDatePicker.getValue(el) : el.value] : null;
    }).filter(Boolean);
  }

  function stelleWiederHer(werte) {
    const f = form();
    if (!f) return;
    const plattform = werte.find(([name]) => name === 'plattform');
    if (plattform) {
      setzeFeldWert(f.querySelector('[name="plattform"]'), plattform[1]);
      wechslePlattform(plattform[1]);
    }
    werte.forEach(([name, wert]) => {
      const el = f.querySelector(`[name="${name}"]`);
      if (!el || name === 'plattform') return;
      if (el.classList.contains('custom-date-picker__input')) CustomDatePicker.setValue(el, wert);
      else setzeFeldWert(el, wert);
      el.closest('.erfassen-feld')?.classList.remove('is-unsicher');
    });
  }

  function zeichnePruefung({ behalte = false } = {}) {
    const slot = root.querySelector('[data-erfassen-pruefung]');
    if (!slot) return;
    const offen = behalte ? offeneEingaben() : null;
    if (!offen) { geaendert = new Set(); merker = {}; }
    const eintrag = aktuell();
    slot.innerHTML = renderPruefbereich(eintrag, eintraege, modell());
    if (!behalte) blinke(slot, 'is-wechsel');
    if (offen) stelleWiederHer(offen);
    ladePoster(slot, modell(), posterCache);
    const shots = slot.querySelector('[data-erfassen-shots]');
    if (shots && eintrag?.post) void fuelleScreenshots(shots, eintrag.post);
  }

  function waehle(key, { fokus = false, listeFokus = false } = {}) {
    e.auswahl = key;
    e.fertig = false;
    if (fix && fix.key !== key) {
      fix = null;
      eintraege = lade();
      zeichneListe();
    }
    const ziel = eintraege.find(x => x.key === key);
    if (ziel && !passt(ziel, e.filter)) {
      e.filter = 'alle';
      zeichneListe();
    }
    root.querySelectorAll('[data-erfassen-eintrag]').forEach((el) => {
      const an = el.dataset.erfassenEintrag === key;
      el.classList.toggle('is-aktiv', an);
      el.setAttribute('aria-selected', String(an));
      el.tabIndex = an ? 0 : -1;
      if (!an) return;
      el.scrollIntoView?.({ block: 'nearest' });
      if (listeFokus) el.focus({ preventScroll: true });
    });
    zeichnePruefung();
    if (fokus) fokussiereErstesFeld(form());
  }

  /** Nach dem Bestätigen: nächster „Prüfen“, sonst „Fehlt“; der Filter folgt, wenn er ihn verbirgt. */
  function weiter(vonKey) {
    fix = null;
    eintraege = lade();
    const naechster = naechsterEintrag(eintraege, vonKey);
    if (!naechster) {
      e.auswahl = null;
      e.fertig = true;
      zeichneListe();
      zeichnePruefung();
      return;
    }
    if (!passt(naechster, e.filter)) e.filter = STATUS[naechster.status].filter || 'alle';
    e.auswahl = naechster.key;
    zeichneListe();
    waehle(naechster.key, { fokus: true });
  }

  function uebernimm(post, { waehle: auswaehlen = false, fokus = false } = {}) {
    if (!aendere.post(post)) return;
    const key = `post:${post.id}`;
    const einheitKey = `einheit:${post.einheitId}`;
    const warAusgewaehlt = e.auswahl === key || e.auswahl === einheitKey;
    if (auswaehlen || warAusgewaehlt) {
      const platz = eintraege.findIndex(x => x.key === key || x.key === einheitKey);
      const gleicher = fix && (fix.key === key || fix.key === einheitKey);
      fix = platz < 0 ? null : { key, index: gleicher ? fix.index : platz };
    }
    eintraege = lade();
    if (auswaehlen || e.auswahl === einheitKey) {
      e.auswahl = key;
      e.fertig = false;
      const eintrag = eintraege.find(x => x.key === key);
      if (eintrag && !passt(eintrag, e.filter)) e.filter = 'alle';
    }
    zeichneListe();
    if (auswaehlen || warAusgewaehlt) zeichnePruefung({ behalte: !auswaehlen });
    if (fokus) fokussiereErstesFeld(form());
  }

  function entferne(postId, { danach = 'weiter' } = {}) {
    const weg = eintraege.find(x => x.key === `post:${postId}`);
    if (!aendere.weg(postId)) return;
    if (fix?.key === `post:${postId}`) fix = null;
    eintraege = lade();
    if (e.auswahl !== `post:${postId}`) {
      zeichneListe();
      return;
    }
    const einheit = weg && eintraege.find(x => x.einheit.id === weg.einheit.id);
    if (danach === 'einheit' && einheit) {
      e.auswahl = einheit.key;
      zeichneListe();
      waehle(einheit.key);
      return;
    }
    weiter(`post:${postId}`);
  }

  const aktionen = erstelleAktionen({
    eintrag: aktuell,
    form,
    uebernimm,
    entferne,
    weiter,
    beschaeftigt: (an) => {
      const f = form();
      if (!f) return;
      if (an) f.setAttribute('aria-busy', 'true');
      else f.removeAttribute('aria-busy');
      f.querySelectorAll('button[data-erfassen-aktion]').forEach((b) => { b.dataset.gesperrt = an ? '1' : ''; });
    },
    labelFuer: (post) => {
      const einheit = eintraege.find(x => x.post?.id === post.id)?.einheit || modell().einheitenById?.get(post.einheitId);
      return einheit?.titel || einheit?.label || 'Post';
    },
    postsDerEinheit: (einheitId) => modell().posts.filter(p => p.einheitId === einheitId)
  });

  /** Plattform gewechselt: Felder tauschen, gleiche Werte bleiben, andere merkt sich der Merker. */
  function wechslePlattform(plattform) {
    const f = form();
    const raster = f?.querySelector('[data-erfassen-kennzahlen]');
    if (!raster) return;
    raster.querySelectorAll('[data-kennzahl]').forEach((input) => {
      const wert = zahlAusEingabe(input.value, input.dataset.kennzahl);
      if (wert == null) delete merker[input.dataset.kennzahl];
      else if (!Number.isNaN(wert)) merker[input.dataset.kennzahl] = wert;
    });
    const post = aktuell()?.post;
    const unsicher = [...raster.querySelectorAll('.erfassen-feld.is-unsicher')].map(el => el.dataset.feld);
    raster.innerHTML = renderKennzahlFelder(plattform, { ...(post?.metrics || {}), ...merker }, unsicher);
  }

  function aktualisiereMesswarnung() {
    const f = form();
    const warnung = f?.querySelector('[data-erfassen-messwarnung]');
    if (!warnung) return;
    const text = messWarnung(CustomDatePicker.getValue(f.querySelector('[name="postedAt"]')), CustomDatePicker.getValue(f.querySelector('[name="measuredAt"]')));
    warnung.hidden = !text;
    warnung.querySelector('span').textContent = text;
  }

  const AKTION = {
    abrufen: () => aktionen.holeLink(),
    'neu-abrufen': () => aktionen.holeLink({ neu: true }),
    manuell: () => aktionen.manuell(),
    verwerfen: () => aktionen.verwerfe(),
    loeschen: () => aktionen.loescheZahlen(),
    weitere: () => aktionen.weiterePlattform(),
    erneut: () => aktionen.erneut(),
    abbrechen: () => aktionen.abbrechen()
  };

  /** Sekunden im KI-Hinweis, ohne den Prüfbereich neu zu zeichnen. */
  function tickeKiLauf() {
    const hinweis = root.querySelector('[data-erfassen-ki-lauf]');
    if (!hinweis) return;
    const dauer = laufDauer(hinweis.dataset.post);
    const zeit = hinweis.querySelector('[data-ki-sekunden]');
    if (zeit) zeit.textContent = laufzeitText(dauer);
    const langsam = hinweis.querySelector('[data-ki-langsam]');
    if (langsam) langsam.hidden = dauer < LANGSAM_AB_MS;
  }

  root.addEventListener('click', (ev) => {
    const zeile = ev.target.closest('[data-erfassen-eintrag]');
    if (zeile) { waehle(zeile.dataset.erfassenEintrag); return; }
    const knopf = ev.target.closest('[data-erfassen-aktion]');
    if (knopf && AKTION[knopf.dataset.erfassenAktion]) {
      if (knopf.dataset.gesperrt) return;
      void AKTION[knopf.dataset.erfassenAktion]();
      return;
    }
    const blatt = ev.target.closest('[data-erfassen-blaettern]');
    if (blatt) { blaettere(blatt.closest('[data-erfassen-shots]'), Number(blatt.dataset.erfassenBlaettern)); return; }
    const ablage = ev.target.closest('[data-erfassen-ablage]');
    if (ablage && !ev.target.closest('input')) ablage.querySelector('[data-erfassen-datei]')?.click();
  }, { signal });

  root.addEventListener('submit', (ev) => {
    if (!ev.target.closest('[data-erfassen-form]')) return;
    ev.preventDefault();
    void aktionen.bestaetige();
  }, { signal });

  root.addEventListener('keydown', (ev) => {
    if (ev.defaultPrevented) return;
    const zeile = ev.target.closest?.('[data-erfassen-eintrag]');
    if (zeile && (ev.key === 'ArrowDown' || ev.key === 'ArrowUp')) {
      ev.preventDefault();
      const nachbar = ev.key === 'ArrowDown' ? zeile.nextElementSibling : zeile.previousElementSibling;
      if (nachbar?.dataset.erfassenEintrag) waehle(nachbar.dataset.erfassenEintrag, { listeFokus: true });
      return;
    }
    if (zeile && ev.key === 'Enter') {
      ev.preventDefault();
      fokussiereErstesFeld(form());
      return;
    }
    const ablage = ev.target.closest?.('[data-erfassen-ablage]');
    if (ablage && ev.target === ablage && (ev.key === 'Enter' || ev.key === ' ')) {
      ev.preventDefault();
      ablage.querySelector('[data-erfassen-datei]')?.click();
      return;
    }
    if (ev.key === 'Enter' && ev.target.matches?.('[data-erfassen-link]')) {
      ev.preventDefault();
      const eintrag = aktuell();
      if (!abrufGrund(ev.target.value)) void aktionen.holeLink();
      else if (!eintrag?.post && ev.target.value.trim()) void aktionen.manuell();
      else if (eintrag?.post) form()?.requestSubmit();
    }
  }, { signal });

  root.addEventListener('input', (ev) => {
    const t = ev.target;
    if (!t.closest?.('[data-erfassen-form]') || !t.name) return;
    geaendert.add(t.name);
    if (t.matches('[data-erfassen-link]')) aktualisiereLinkHinweis(form(), t.value);
    if (t.dataset.kennzahl) {
      t.closest('.erfassen-feld')?.classList.remove('is-unsicher');
      t.removeAttribute('aria-invalid');
    }
    if (t.name === 'postedAt' || t.name === 'measuredAt') aktualisiereMesswarnung();
  }, { signal });

  root.addEventListener('change', (ev) => {
    const t = ev.target;
    if (t.matches?.('[data-erfassen-datei]')) {
      const files = [...(t.files || [])];
      t.value = '';
      if (files.length) void aktionen.nimmScreenshots(files);
      return;
    }
    if (!t.closest?.('[data-erfassen-form]') || !t.name) return;
    geaendert.add(t.name);
    if (t.name === 'postedAt' || t.name === 'measuredAt') aktualisiereMesswarnung();
  }, { signal });

  // Eigenes Dropdown (Plattform, Datei): meldet sich per table-select-change statt change
  document.addEventListener('table-select-change', (ev) => {
    const { field, value, element } = ev.detail || {};
    if (!element?.closest?.('[data-erfassen-form]') || !field) return;
    geaendert.add(field);
    element.querySelector('.table-select__trigger')?.removeAttribute('aria-invalid');
    if (field === 'plattform') wechslePlattform(value);
  }, { signal });

  document.addEventListener('paste', (ev) => {
    if (!root.isConnected) return;
    const bilder = bilderAus(ev.clipboardData);
    if (!bilder.length) return;
    ev.preventDefault();
    void aktionen.nimmScreenshots(bilder);
  }, { signal });

  const ablageZiel = (ev) => ev.target.closest?.('[data-erfassen-eintrag]') || ev.target.closest?.('[data-erfassen-pruefung]')?.querySelector('[data-erfassen-ablage]');
  const loeseMarke = () => root.querySelectorAll('.is-dropping').forEach(el => el.classList.remove('is-dropping'));
  root.addEventListener('dragover', (ev) => {
    if (!ziehtDateien(ev)) return;
    const ziel = ablageZiel(ev);
    if (!ziel) return;
    ev.preventDefault();
    ev.dataTransfer.dropEffect = 'copy';
    if (!ziel.classList.contains('is-dropping')) { loeseMarke(); ziel.classList.add('is-dropping'); }
  }, { signal });
  root.addEventListener('dragleave', (ev) => { if (!root.contains(ev.relatedTarget)) loeseMarke(); }, { signal });
  root.addEventListener('drop', (ev) => {
    const ziel = ablageZiel(ev);
    loeseMarke();
    if (!ziel) return;
    ev.preventDefault();
    const bilder = bilderAus(ev.dataTransfer);
    if (!bilder.length) return;
    if (ziel.dataset.erfassenEintrag && ziel.dataset.erfassenEintrag !== e.auswahl) waehle(ziel.dataset.erfassenEintrag);
    void aktionen.nimmScreenshots(bilder);
  }, { signal });

  CustomDatePicker.bind(root, signal);
  const loeseFilter = bindSegmentSwitches(root, (_id, filter) => {
    e.filter = filter;
    zeichneListe();
    const sichtbar = gefiltert(eintraege, filter);
    if (sichtbar.length && !sichtbar.some(x => x.key === e.auswahl)) waehle(sichtbar[0].key);
  }, { attr: FILTER_ATTR });

  const shots = root.querySelector('[data-erfassen-shots]');
  if (shots && aktuell()?.post) void fuelleScreenshots(shots, aktuell().post);
  modell().posts.filter(p => p.kiStatus === 'laeuft').forEach(p => aktionen.beobachte(p));
  const ticker = setInterval(tickeKiLauf, 1000);

  return () => {
    clearInterval(ticker);
    abort.abort();
    aktionen.stop();
    loeseFilter();
  };
}
