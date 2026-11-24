// Creator auf einen Platzhalter setzen: Hinweis zur Linie, Sperre an der Decke.

import { EntitySearchInput } from '../../core/components/EntitySearchInput.js';
import {
  creatorAnzeigename,
  deckenStandAus,
  kooperationsname,
  linienHinweis,
  naechsteKooperationsnummer,
  pruefeDecke
} from './platzhalter.js';

function nachKooperation(videos) {
  const map = {};
  for (const video of videos || []) {
    if (!map[video.kooperation_id]) map[video.kooperation_id] = [];
    map[video.kooperation_id].push(video);
  }
  return map;
}

async function ladeBestand(client, koopId) {
  const { data: koop, error } = await client
    .from('kooperationen')
    .select('id, name, creator_id, kampagne_id, produktion_id, briefing_id, videoanzahl')
    .eq('id', koopId)
    .single();
  if (error || !koop) throw error || new Error('Kooperation nicht gefunden');

  const { data: koops, error: koopError } = await client
    .from('kooperationen')
    .select('id, name, creator_id, produktion_id, briefing_id, videoanzahl')
    .eq('kampagne_id', koop.kampagne_id);
  if (koopError) throw koopError;

  const ids = (koops || []).map(row => row.id);
  const { data: videos, error: videoError } = ids.length
    ? await client.from('kooperation_videos').select('kooperation_id, verkaufspreis_netto').in('kooperation_id', ids)
    : { data: [], error: null };
  if (videoError) throw videoError;

  const { data: kampagne, error: kampagneError } = await client
    .from('kampagne')
    .select('videoanzahl, creatoranzahl, creator_budget, volumen, auftrag:auftrag_id(creator_budget)')
    .eq('id', koop.kampagne_id)
    .single();
  if (kampagneError) throw kampagneError;

  const { data: produktionen, error: produktionError } = await client
    .from('produktion')
    .select('id, budget')
    .eq('kampagne_id', koop.kampagne_id);
  if (produktionError) throw produktionError;

  return { koop, koops: koops || [], videos: videos || [], kampagne, produktionen: produktionen || [] };
}

function standFuer(kampagne, produktionen, vorgabe) {
  const frisch = deckenStandAus({
    kontingentVideos: kampagne?.videoanzahl,
    creatorBudget: kampagne?.creator_budget,
    auftragCreatorBudget: kampagne?.auftrag?.creator_budget,
    volumen: kampagne?.volumen,
    produktionen
  });
  if (!vorgabe) return frisch;
  return {
    ...frisch,
    kontingentVideos: vorgabe.kontingentVideos || frisch.kontingentVideos,
    kampagneDecke: vorgabe.kampagneDecke ?? frisch.kampagneDecke,
    deckeQuelle: vorgabe.deckeQuelle || frisch.deckeQuelle
  };
}

export async function hinweisFuerKooperation(client, koopId, stand) {
  const bestand = await ladeBestand(client, koopId);
  return pruefeDecke({
    koop: bestand.koop,
    videosDieser: bestand.videos.filter(video => video.kooperation_id === koopId),
    koops: bestand.koops,
    videosByKoopId: nachKooperation(bestand.videos),
    stand: standFuer(bestand.kampagne, bestand.produktionen, stand)
  }).text;
}

export async function setzeCreator(client, { koopId, creator, stand }) {
  const bestand = await ladeBestand(client, koopId);
  if (bestand.koop.creator_id) return { ok: false, text: 'Diese Kooperation hat schon einen Creator.' };

  const pruefung = pruefeDecke({
    koop: bestand.koop,
    videosDieser: bestand.videos.filter(video => video.kooperation_id === koopId),
    koops: bestand.koops,
    videosByKoopId: nachKooperation(bestand.videos),
    stand: standFuer(bestand.kampagne, bestand.produktionen, stand)
  });
  if (pruefung.text) return { ok: false, text: pruefung.text };

  const name = kooperationsname(
    creatorAnzeigename(creator),
    naechsteKooperationsnummer(bestand.koops.map(row => row.name)),
    bestand.kampagne?.creatoranzahl || 1
  );
  const { error } = await client
    .from('kooperationen')
    .update({ creator_id: creator.id, name })
    .eq('id', koopId)
    .is('creator_id', null);
  if (error) return { ok: false, text: error.message || 'Creator konnte nicht gesetzt werden.' };

  return {
    ok: true,
    name,
    linienHinweis: linienHinweis(bestand.koops, {
      creatorId: creator.id,
      briefingId: bestand.koop.briefing_id,
      ausserId: koopId
    })
  };
}

async function sucheCreator(client, term) {
  const sauber = term.replace(/[%_,.()]/g, '').trim();
  let query = client.from('creator').select('id, vorname, nachname, instagram').order('vorname').limit(20);
  if (sauber) {
    query = query.or(`vorname.ilike.%${sauber}%,nachname.ilike.%${sauber}%,instagram.ilike.%${sauber}%`);
  }
  const { data, error } = await query;
  if (error) throw error;
  return data || [];
}

export function mountCreatorSetzen(container, { koopId, stand, onDone, persistent = false }) {
  const client = window.supabase;
  if (!container || !client) return null;
  container.replaceChildren();
  let koops = [];
  let briefingId = null;

  const suche = new EntitySearchInput({
    placeholder: 'Creator suchen und auswählen...',
    persistent,
    search: async (term) => {
      if (!koops.length) {
        const bestand = await ladeBestand(client, koopId);
        koops = bestand.koops;
        briefingId = bestand.koop?.briefing_id || null;
      }
      const treffer = await sucheCreator(client, term);
      return treffer.map(creator => ({
        id: creator.id,
        label: creatorAnzeigename(creator),
        sub: linienHinweis(koops, { creatorId: creator.id, briefingId, ausserId: koopId }),
        data: creator
      }));
    },
    onSelect: async (item) => {
      const ergebnis = await setzeCreator(client, { koopId, creator: item.data, stand });
      if (!ergebnis.ok) {
        window.toastSystem?.show(ergebnis.text, 'error');
        return;
      }
      if (ergebnis.linienHinweis) window.toastSystem?.show(ergebnis.linienHinweis, 'warning');
      else window.toastSystem?.show('Creator gesetzt.', 'success');
      await onDone?.(ergebnis);
    }
  });
  suche.mount(container);
  return suche;
}

export function oeffneCreatorSetzen(button, optionen) {
  const cell = button.closest('.koop-creator-cell') || button.parentElement;
  let slot = cell.querySelector('.platzhalter-suche');
  if (!slot) {
    slot = document.createElement('div');
    slot.className = 'platzhalter-suche';
    button.after(slot);
  }
  return mountCreatorSetzen(slot, optionen);
}

function standAusFormular(form, bestand) {
  const eingabe = form.querySelector('[name="videoanzahl"]');
  const videoanzahl = eingabe && eingabe.value !== ''
    ? Number(eingabe.value)
    : bestand.koop.videoanzahl;
  const felder = [...form.querySelectorAll('.video-vk-input')];
  const videosDieser = felder.length
    ? felder.map(feld => ({ verkaufspreis_netto: feld.value }))
    : bestand.videos.filter(video => video.kooperation_id === bestand.koop.id);
  return { ...bestand.koop, videoanzahl, videosDieser };
}

function zeichneHinweis(ziel, bestand, form) {
  const { videosDieser, ...koop } = standAusFormular(form, bestand);
  const text = pruefeDecke({
    koop,
    videosDieser,
    koops: bestand.koops,
    videosByKoopId: nachKooperation(bestand.videos),
    stand: standFuer(bestand.kampagne, bestand.produktionen)
  }).text;
  ziel.textContent = text;
  ziel.hidden = !text;
}

export async function zeigeFormularHinweis(form, koopId) {
  if (!form || !koopId || !window.supabase || form.dataset.platzhalterHinweisBound === '1') return;
  form.dataset.platzhalterHinweisBound = '1';
  const ziel = document.createElement('p');
  ziel.dataset.platzhalterHinweis = '';
  ziel.className = 'platzhalter-hinweis';
  ziel.hidden = true;
  form.prepend(ziel);
  try {
    const bestand = await ladeBestand(window.supabase, koopId);
    const zeichnen = () => zeichneHinweis(ziel, bestand, form);
    zeichnen();
    form.addEventListener('input', zeichnen);
    form.addEventListener('change', zeichnen);
  } catch (error) {
    console.error('Platzhalter-Hinweis fehlgeschlagen:', error);
  }
}
