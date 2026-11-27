// CreatorListFormStart.js
// Startscreen von "Creator anlegen": Instagram- und TikTok-Link (Prototype-Mixin).
// Ein bekannter Handle oeffnet den vorhandenen Creator. Sonst oeffnet das Formular sofort und
// creatorProfilLaden.js fuellt es im Hintergrund (renderCreatorForm in CreatorListForm.js).

import { CreatorList } from './CreatorListCore.js';
import { normalizeHandle } from './creatorProfil.js';
import { tiktokProfilHandle } from './creatorTiktokPrefill.js';
import { instagramProfilHandle } from '../creator-auswahl/instagramDrawerFill.js';
import { profilUrl } from '../creator-auswahl/sourcingProfilPlattformen.js';
import { creatorAuswahlService } from '../creator-auswahl/CreatorAuswahlService.js';
import { bareInstagramHandle, parseSocialLink } from '../../core/format/socialLink.js';

const NAMEN = { instagram: 'Instagram', tiktok: 'TikTok' };
const CREATOR_FELDER = 'id, vorname, nachname, mail, telefonnummer, instagram, tiktok, profilbild_url, ig_biography';

function profilZiel(feldPlattform, text) {
  const { platform } = parseSocialLink(text);
  if (!platform) {
    const handle = feldPlattform === 'tiktok' ? tiktokProfilHandle(text) : bareInstagramHandle(text);
    if (handle) return { plattform: feldPlattform, handle };
    return { fehler: `${NAMEN[feldPlattform]}: kein Profil-Link und kein Handle („${text.slice(0, 60)}“)` };
  }
  const handle = platform === 'instagram' ? instagramProfilHandle(text) : tiktokProfilHandle(text);
  if (handle) return { plattform: platform, handle };
  return {
    fehler: platform === 'instagram'
      ? 'Instagram: bitte den Profil-Link, kein Beitrag oder Reel'
      : 'TikTok: bitte den Profil-Link (tiktok.com/@name), Kurzlinks gehen nicht'
  };
}

/**
 * Profil-URLs aus den beiden Feldern. Ein Link im falschen Feld zaehlt fuer seine Plattform,
 * ein reiner Handle fuer die Plattform des Feldes.
 * @returns {{ instagram: string|null, tiktok: string|null, fehler: string|null }}
 */
export function linksZuordnen(igRaw, ttRaw) {
  const links = { instagram: null, tiktok: null, fehler: null };
  const ohneLinks = (fehler) => ({ instagram: null, tiktok: null, fehler });
  for (const [feldPlattform, raw] of [['instagram', igRaw], ['tiktok', ttRaw]]) {
    const text = String(raw || '').trim();
    if (!text) continue;
    const ziel = profilZiel(feldPlattform, text);
    if (ziel.fehler) return ohneLinks(ziel.fehler);
    if (links[ziel.plattform]) return ohneLinks(`Zwei ${NAMEN[ziel.plattform]}-Links eingetragen`);
    links[ziel.plattform] = profilUrl(ziel.plattform, ziel.handle);
  }
  if (!links.instagram && !links.tiktok) links.fehler = 'Mindestens einen Link eintragen oder ohne Link weiter';
  return links;
}

async function creatorMitHandle(spalte, handle) {
  if (!handle || !window.supabase) return null;
  const { data } = await window.supabase
    .from('creator')
    .select(CREATOR_FELDER)
    .ilike(spalte, `%${handle}%`)
    .limit(20);
  return (data || []).find((row) => normalizeHandle(row[spalte]) === handle) || null;
}

async function vorhandenerCreator(handles) {
  const [perInstagram, perTiktok] = await Promise.all([
    creatorMitHandle('instagram', handles.instagram),
    creatorMitHandle('tiktok', handles.tiktok)
  ]);
  return perInstagram || perTiktok;
}

CreatorList.prototype.showCreateForm = function() {
  window.setHeadline('Neuen Creator anlegen');
  window.breadcrumbSystem?.updateDetailLabel('Neuer Creator');
  this._profilLaden?.abbrechen();
  this._profilLaden = null;
  window.content.innerHTML = `
    <div class="form-page form-page--half">
      <form id="creator-links-start" novalidate>
        <div class="form-field">
          <label for="creator-instagram-link">Instagram-Link</label>
          <input id="creator-instagram-link" name="instagram" type="text" class="form-input"
                 placeholder="https://instagram.com/…" autocomplete="off" />
        </div>
        <div class="form-field">
          <label for="creator-tiktok-link">TikTok-Link</label>
          <input id="creator-tiktok-link" name="tiktok" type="text" class="form-input"
                 placeholder="https://www.tiktok.com/@…" autocomplete="off" />
          <span class="form-hint">Ein Link reicht. Die Links füllen das Formular, ein bekannter Handle öffnet den vorhandenen Creator.</span>
        </div>
        <p class="form-hint form-hint--error" id="creator-links-fehler" hidden></p>
        <div class="form-actions">
          <button type="submit" class="mdc-btn mdc-btn--create">
            <span class="mdc-btn__label">Weiter</span>
          </button>
          <button type="button" class="mdc-btn mdc-btn--secondary" id="creator-skip-links">
            <span class="mdc-btn__label">Ohne Link weiter</span>
          </button>
        </div>
      </form>
    </div>
  `;
  const form = document.getElementById('creator-links-start');
  form?.addEventListener('submit', async (event) => {
    event.preventDefault();
    const fehler = document.getElementById('creator-links-fehler');
    const links = linksZuordnen(form.elements.instagram.value, form.elements.tiktok.value);
    fehler.textContent = links.fehler || '';
    fehler.hidden = !links.fehler;
    if (links.fehler) return;

    const button = form.querySelector('button[type="submit"]');
    const label = button?.querySelector('.mdc-btn__label');
    const skip = document.getElementById('creator-skip-links');
    if (button) {
      button.disabled = true;
      button.classList.add('is-loading');
    }
    if (skip) skip.disabled = true;
    if (label) label.textContent = 'Wird geprüft…';
    try {
      await this.continueFromLinks(links);
    } finally {
      if (button?.isConnected) {
        button.disabled = false;
        button.classList.remove('is-loading');
        if (label) label.textContent = 'Weiter';
      }
      if (skip?.isConnected) skip.disabled = false;
    }
  });
  document.getElementById('creator-skip-links')?.addEventListener('click', () => {
    this.renderCreatorForm({});
  });
};

CreatorList.prototype.continueFromLinks = async function(links) {
  const handles = {
    instagram: links.instagram ? normalizeHandle(links.instagram) : '',
    tiktok: links.tiktok ? normalizeHandle(links.tiktok) : ''
  };
  const existing = await vorhandenerCreator(handles);
  if (existing) {
    await this.ergaenzeVorhandenen(existing, handles, links);
    window.toastSystem?.show('Den Creator gibt es schon, der vorhandene Eintrag ist geöffnet', 'info');
    window.navigateTo(`/creator/${existing.id}`);
    return;
  }
  if (!document.getElementById('creator-links-start')) return;
  this.renderCreatorForm(handles, links);
};

/** Fehlenden Handle der anderen Plattform eintragen, leere Felder aus Instagram fuellen. */
CreatorList.prototype.ergaenzeVorhandenen = async function(existing, handles, links) {
  const patch = {};
  if (handles.instagram && !existing.instagram) patch.instagram = handles.instagram;
  if (handles.tiktok && !existing.tiktok) patch.tiktok = handles.tiktok;
  if (Object.keys(patch).length) {
    try {
      await window.dataService.updateEntity('creator', existing.id, patch);
    } catch (error) {
      console.warn('Handle konnte am vorhandenen Creator nicht ergänzt werden', error);
    }
  }
  const instagram = patch.instagram || existing.instagram;
  if (links.instagram && normalizeHandle(instagram) === handles.instagram) {
    await this.fillEmptyFromScrape({ ...existing, ...patch }, links.instagram);
  }
};

CreatorList.prototype.fillEmptyFromScrape = async function(existing, rawUrl) {
  try {
    const scraped = await creatorAuswahlService.scrapeCreator(rawUrl);
    const patch = {};
    const name = String(scraped?.name || '').trim();
    const [vorname, ...rest] = name.split(/\s+/);
    if (!existing.vorname && vorname) patch.vorname = vorname;
    if (!existing.nachname && rest.length) patch.nachname = rest.join(' ');
    if (!existing.instagram && (scraped?.handle || normalizeHandle(rawUrl))) {
      patch.instagram = scraped?.handle || normalizeHandle(rawUrl);
    }
    if (!existing.ig_biography && scraped?.bio) patch.ig_biography = scraped.bio;
    const photo = scraped?.profile_image_url || scraped?.profileImageUrl;
    if (!existing.profilbild_url && photo) patch.profilbild_url = photo;
    if (Object.keys(patch).length) {
      await window.dataService.updateEntity('creator', existing.id, patch);
    }
  } catch (error) {
    console.warn('Instagram-Daten konnten leere Felder nicht füllen', error);
  }
};
