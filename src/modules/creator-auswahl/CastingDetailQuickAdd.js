// CastingDetailQuickAdd.js
// Schnell anlegen: Profil-Link oder Instagram-Handle in die Leiste einfuegen, Eintrag ist da und der
// Profilabruf laeuft (Prototype-Mixin von CreatorAuswahlDetail).
// Alles Weitere ist wiederverwendet: Anlegen wie im Drawer, Abruf ueber den
// Zellen-Button der neuen Zeile (erst Creator-Pool, dann Meta bzw. Apify).
// TikTok nur per Profil-Link: ein reiner Handle ist immer Instagram.

import { creatorAuswahlService } from './CreatorAuswahlService.js';
import { leererCastingEintrag } from './leererCastingEintrag.js';
import { listeHatInstagram, listeHatTiktok } from './castingDetailDrawerView.js';
import { profilUrl } from './sourcingProfilPlattformen.js';
import { bareInstagramHandle, parseSocialLink } from '../../core/format/socialLink.js';

export const QUICK_ADD_FORM = 'quick-add';
export const QUICK_ADD_INPUT = 'quick-add-link';

/** Link oder Instagram-Handle -> { platform, handle, field, value } oder { error }. */
export function leseQuickAddLink(raw, { tiktok = false, instagram = true } = {}) {
  const text = String(raw || '').trim();
  const parsed = parseSocialLink(text);
  const handleNur = parsed.type === 'profile' ? null : bareInstagramHandle(text);
  if (handleNur) {
    if (!instagram && tiktok) return { error: 'Für TikTok bitte den Profil-Link einfügen' };
    return { platform: 'instagram', handle: handleNur, field: 'link_instagram', value: profilUrl('instagram', handleNur) };
  }
  if (parsed.type !== 'profile' || !parsed.handle) {
    return { error: 'Bitte einen Profil-Link oder Instagram-Handle einfügen (kein Reel oder Post)' };
  }
  const handle = parsed.handle.toLowerCase();
  if (parsed.platform === 'instagram') {
    return { platform: 'instagram', handle, field: 'link_instagram', value: profilUrl('instagram', handle) };
  }
  if (parsed.platform === 'tiktok' && tiktok) {
    return { platform: 'tiktok', handle, field: 'link_tiktok', value: profilUrl('tiktok', handle) };
  }
  return { error: parsed.platform === 'tiktok' ? 'Diese Liste hat kein TikTok' : 'Nur Instagram-Profile werden unterstützt' };
}

/** Eintrag der Liste mit demselben Profil, falls vorhanden. */
export function findeQuickAddDuplikat(items, { platform, handle, field }) {
  return (items || []).find((item) => {
    const parsed = parseSocialLink(item?.[field]);
    return parsed.platform === platform && parsed.type === 'profile' && parsed.handle?.toLowerCase() === handle;
  }) || null;
}

function scrolleZuZeile(detail, itemId) {
  detail._q(`.item-row[data-item-id="${itemId}"]`)?.scrollIntoView({ block: 'center', behavior: 'smooth' });
}

export function _quickAddInput() {
  return document.querySelector(`#${QUICK_ADD_INPUT}`);
}

export async function handleQuickAdd(raw) {
  if (this.isKunde || !this._canSourcing('create') || this._quickAddBusy) return;

  const input = this._quickAddInput();
  const link = leseQuickAddLink(raw, { tiktok: listeHatTiktok(this.liste), instagram: listeHatInstagram(this.liste) });
  if (link.error) {
    window.toastSystem?.show(link.error, 'info');
    return;
  }

  const vorhanden = findeQuickAddDuplikat(this.items, link);
  if (vorhanden) {
    this.ensureNewItemVisible();
    this.rerenderTable();
    scrolleZuZeile(this, vorhanden.id);
    window.toastSystem?.show('Dieser Creator steht schon in der Liste', 'info');
    return;
  }

  this._quickAddBusy = true;
  if (input) input.disabled = true;
  try {
    const item = await creatorAuswahlService.createItem(
      leererCastingEintrag(this.listeId, this.items.length, { [link.field]: link.value })
    );
    this.items.push(item);
    this.ensureNewItemVisible();
    this.rerenderTable();
    scrolleZuZeile(this, item.id);
    if (input) input.value = '';

    await this._meldeBekanntenCreator(item);
    const abruf = this._profilAbrufStarten(item.id, link.platform);
    // Ein TikTok-Lauf dauert bis zu einer Minute; die Leiste soll solange nicht blockieren
    if (link.platform === 'instagram') await abruf;
  } catch (error) {
    console.error('Fehler beim Schnell-Anlegen:', error);
    window.toastSystem?.show(error.message || 'Fehler beim Hinzufügen', 'error');
  } finally {
    this._quickAddBusy = false;
    const next = this._quickAddInput();
    if (next) {
      next.disabled = false;
      next.focus();
    }
  }
}

export const castingDetailQuickAddMethods = {
  _quickAddInput,
  handleQuickAdd
};
