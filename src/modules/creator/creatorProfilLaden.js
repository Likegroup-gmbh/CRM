// creatorProfilLaden.js
// Instagram und TikTok laden parallel ins offene Creator-Formular. Felder, die ein laufender Abruf
// noch fuellen kann, sind gesperrt (inert), alle anderen sind sofort ausfuellbar. Ein Feld wird
// frei, sobald es gefuellt ist oder kein Abruf mehr darauf wartet. Danach fasst es kein Abruf mehr
// an. Stammdaten fuellt Instagram, TikTok nur die Luecken, auch wenn TikTok zuerst fertig ist.

import { creatorAuswahlService } from '../creator-auswahl/CreatorAuswahlService.js';
import { tiktokProfilAbrufen } from '../../core/tiktok/tiktokProfil.js';
import { formularAusInstagramVorschau } from './creatorInstagramPrefill.js';
import { formularAusTiktokVorschau } from './creatorTiktokPrefill.js';

const STAMMDATEN = ['vorname', 'nachname', 'mail', 'telefonnummer', 'lieferadresse_stadt'];
const NAMEN = { instagram: 'Instagram', tiktok: 'TikTok' };
const FOLLOWER = { instagram: 'instagram_follower', tiktok: 'tiktok_follower' };

const toast = (text, typ) => window.toastSystem?.show(text, typ);

function zahl(wert) {
  if (wert == null || wert === '') return null;
  const n = Number(wert);
  return Number.isFinite(n) ? n : null;
}

const huelleVon = (feld) => feld.closest('.form-field') || feld.parentElement;

async function ladeInstagram(link) {
  const result = await creatorAuswahlService.previewInstagramStats(link);
  return {
    werte: formularAusInstagramVorschau(link, result),
    follower: zahl(result?.fields?.follower_instagram)
  };
}

async function ladeTiktok(link, steuerung) {
  const result = await tiktokProfilAbrufen({ link, ...steuerung });
  if (!result) return null;
  return {
    werte: formularAusTiktokVorschau(link, result),
    follower: zahl(result.fields?.follower_tiktok)
  };
}

class ProfilLaden {
  constructor(form, links) {
    this.form = form;
    this.links = links;
    this.aktiv = new Set(Object.keys(NAMEN).filter((plattform) => links[plattform]));
    // Feldname -> Plattformen, die das Feld noch fuellen koennen
    this.wartet = new Map();
    this.tiktokDauert = false;
    this.abgebrochen = false;
    this.leiste = null;
    this.stand = { instagramFollower: null, tiktokFollower: null, profilbild: null };
  }

  starten() {
    const alle = [...this.aktiv];
    STAMMDATEN.forEach((name) => this.sperren(name, alle));
    alle.forEach((plattform) => this.sperren(FOLLOWER[plattform], [plattform]));
    if (alle.length) {
      this.statusZeigen();
      this.submitSperren(true);
    }
    const instagram = this.aktiv.has('instagram') ? this.instagram() : Promise.resolve();
    const tiktok = this.aktiv.has('tiktok') ? this.tiktok(instagram) : Promise.resolve();
    this.fertig = Promise.all([instagram, tiktok]).then(() => this.ergebnis());
    return this;
  }

  laeuft() {
    return this.aktiv.size > 0;
  }

  ergebnis() {
    return { ...this.stand };
  }

  abbrechen() {
    this.abgebrochen = true;
    [...this.aktiv].forEach((plattform) => this.plattformFertig(plattform));
  }

  offen() {
    return !this.abgebrochen && this.form.isConnected;
  }

  async instagram() {
    try {
      const r = await ladeInstagram(this.links.instagram);
      if (!this.offen()) return;
      if (!r.werte.geladen) {
        toast('Instagram konnte nicht geladen werden', 'error');
        return;
      }
      this.uebernehmen(r.werte, [...STAMMDATEN, FOLLOWER.instagram]);
      this.stand.instagramFollower = r.follower;
      this.bildMerken(r.werte);
    } catch (error) {
      if (this.offen()) this.fehler('instagram', error);
    } finally {
      this.plattformFertig('instagram');
    }
  }

  async tiktok(instagramLauf) {
    try {
      const r = await ladeTiktok(this.links.tiktok, {
        istAbgebrochen: () => !this.offen(),
        beimWarten: () => {
          this.tiktokDauert = true;
          this.statusZeigen();
        }
      });
      if (!r || !this.offen()) return;
      if (!r.werte.geladen) {
        toast('TikTok konnte nicht geladen werden', 'error');
        return;
      }
      this.uebernehmen(r.werte, [FOLLOWER.tiktok]);
      this.stand.tiktokFollower = r.follower;
      await instagramLauf;
      if (!this.offen()) return;
      this.uebernehmen(r.werte, STAMMDATEN);
      this.bildMerken(r.werte);
    } catch (error) {
      if (this.offen()) this.fehler('tiktok', error);
    } finally {
      this.plattformFertig('tiktok');
    }
  }

  feld(name) {
    return this.form.querySelector(`[name="${name}"]`);
  }

  sperren(name, plattformen) {
    const feld = this.feld(name);
    if (!feld || !plattformen.length || String(feld.value || '').trim()) return;
    const huelle = huelleVon(feld);
    huelle.setAttribute('inert', '');
    huelle.setAttribute('aria-busy', 'true');
    huelle.classList.add('form-field--laedt');
    this.wartet.set(name, new Set(plattformen));
    this.hinweisSetzen(name);
  }

  hinweisSetzen(name) {
    const label = huelleVon(this.feld(name)).querySelector('label');
    if (!label) return;
    let hinweis = label.querySelector('.form-field__laedt');
    if (!hinweis) {
      hinweis = document.createElement('span');
      hinweis.className = 'form-field__laedt';
      label.appendChild(hinweis);
    }
    const quellen = [...this.wartet.get(name)].map((plattform) => NAMEN[plattform]).join(' und ');
    hinweis.textContent = `lädt aus ${quellen}`;
  }

  freigeben(name) {
    this.wartet.delete(name);
    const feld = this.feld(name);
    if (!feld) return;
    const huelle = huelleVon(feld);
    huelle.removeAttribute('inert');
    huelle.removeAttribute('aria-busy');
    huelle.classList.remove('form-field--laedt');
    huelle.querySelector('.form-field__laedt')?.remove();
  }

  uebernehmen(werte, namen) {
    for (const name of namen) {
      const wert = String(werte[name] ?? '').trim();
      if (!wert || !this.wartet.has(name)) continue;
      const feld = this.feld(name);
      feld.value = wert;
      // Select ohne passende Option: bleibt leer und wartet auf den naechsten Abruf
      if (feld.value !== wert) continue;
      this.freigeben(name);
      feld.dispatchEvent(new Event('input', { bubbles: true }));
      feld.dispatchEvent(new Event('change', { bubbles: true }));
    }
  }

  bildMerken(werte) {
    if (this.stand.profilbild || !werte.profilbild_url) return;
    this.stand.profilbild = { url: werte.profilbild_url, thumbUrl: werte.profilbild_thumb_url || null };
  }

  fehler(plattform, error) {
    console.warn(`${NAMEN[plattform]}-Vorschau fehlgeschlagen`, error);
    const text = [`${NAMEN[plattform]} konnte nicht geladen werden`, error?.message, error?.hint]
      .filter(Boolean)
      .join('. ');
    toast(text, 'error');
  }

  plattformFertig(plattform) {
    if (!this.aktiv.delete(plattform)) return;
    for (const [name, plattformen] of this.wartet) {
      plattformen.delete(plattform);
      if (plattformen.size) this.hinweisSetzen(name);
      else this.freigeben(name);
    }
    if (this.aktiv.size) {
      this.statusZeigen();
      return;
    }
    this.leiste?.remove();
    this.leiste = null;
    this.submitSperren(false);
  }

  statusZeigen() {
    if (!this.form.isConnected || !this.aktiv.size) return;
    if (!this.leiste) {
      this.leiste = document.createElement('div');
      this.leiste.className = 'creator-profil-status';
      this.leiste.setAttribute('role', 'status');
      this.leiste.innerHTML = `
        <span class="creator-profil-status__text"></span>
        <button type="button" class="mdc-btn mdc-btn--secondary mdc-btn--sm creator-profil-status__abbrechen">
          <span class="mdc-btn__label">Nicht abwarten</span>
        </button>
      `;
      this.leiste.querySelector('button').addEventListener('click', () => this.abbrechen());
      this.form.before(this.leiste);
    }
    this.leiste.querySelector('.creator-profil-status__text').textContent = [...this.aktiv]
      .map((plattform) => (plattform === 'tiktok' && this.tiktokDauert
        ? 'TikTok wird geladen, das kann bis zu einer Minute dauern'
        : `${NAMEN[plattform]} wird geladen…`))
      .join(' · ');
  }

  // disabled schaltet der Duplikat-Check (DuplicateCheckBinding), darum eigene Kennzeichnung.
  // Gesperrt wird in handleFormSubmit ueber laeuft().
  submitSperren(an) {
    const btn = this.form.querySelector('.mdc-btn--create');
    if (!btn) return;
    btn.classList.toggle('mdc-btn--wartet', an);
    if (an) btn.setAttribute('aria-disabled', 'true');
    else btn.removeAttribute('aria-disabled');
    btn.title = an ? 'Profil wird noch geladen' : '';
  }
}

/**
 * Startet die Abrufe fuer die Profil-Links und sperrt die Felder, die sie fuellen koennen.
 * @param {HTMLFormElement} form
 * @param {{ instagram?: string|null, tiktok?: string|null }} links Profil-URLs
 * @returns {{ laeuft(): boolean, abbrechen(): void, ergebnis(): object,
 *   fertig: Promise<{ instagramFollower: number|null, tiktokFollower: number|null,
 *   profilbild: { url: string, thumbUrl: string|null }|null }> }}
 */
export function ladeProfileInsFormular(form, links = {}) {
  return new ProfilLaden(form, links).starten();
}
