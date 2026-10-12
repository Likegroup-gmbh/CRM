// creatorSheet.js
// Kompakte Creator-Akte in der bestehenden Drawer-Schale. Die Abschnitte
// kommen aus den Renderern der Creator-Detailseite (readOnly, ohne die
// Anlege-/Entfernen-Knoepfe), das Aufklappen laeuft ueber das vorhandene
// settings-accordion-Muster. Die Videos des Creators lassen sich ueber den
// gleichen Play-Button wie in der Kampagnenliste direkt im Media-Viewer
// abspielen (Prev/Next durch alle Videos).

import { CreatorDetail } from './CreatorDetail.js';
import { icon } from '../../core/icons/IconSystem.js';
import { renderEmptyState, renderSectionHeader } from '../../core/components/EmptyState.js';
import { pickLatestAsset } from '../../core/stills/stillAssets.js';
import { VideoPlayerLightbox } from '../../core/media/player/VideoPlayerLightbox.js';
import { VideoTableDataLoader } from '../kampagne/VideoTableDataLoader.js';
import { entityIcon } from '../../core/icons/entityIcons.js';
import { openDrawer } from './creatorDrawer.js';
import { darfRezensionSehen, formatRezension, loadCreatorRezensionen, renderRezensionListe } from './rezension.js';
import { bindCreatorMerkmale } from './creatorMerkmale.js';
import { durchschnittlicheViews } from './creatorReels.js';

const DRAWER_ID = 'creator-kontakt-drawer';
const CHEVRON_ICON = `${icon('chevron-down')}`;
const PLAY_ICON = `${icon('play-circle')}`;
const FOLDER_ICON = `${icon('folder-open')}`;
const STORYS_ICON = `${icon('device-phone')}`;

const esc = (value) => window.validatorSystem?.sanitizeHtml?.(String(value ?? '')) ?? String(value ?? '');
const escUrl = (value) => window.validatorSystem?.sanitizeUrl?.(value) || '';

// Reihenfolge wie auf der Profilseite: Informationen bis runter zur Adresse.
// Die Videos werden direkt hinter den Kooperationen eingeschoben.
const SECTIONS = [
  { key: 'instagram', icon: 'instagram', label: 'Instagram', render: (d) => d.renderInstagramSection() },
  { key: 'management', icon: 'management', label: 'Management', count: (d) => d.managements?.length, render: (d) => d.renderManagementContent() },
  { key: 'firmen', icon: 'building', label: 'Firmen', count: (d) => d.firmen?.length, render: (d) => d.renderFirmenContent() },
  { key: 'kampagnen', icon: 'kampagne', label: 'Kampagnen', count: (d) => d.kampagnen?.length, render: (d) => d.renderKampagnenContent() },
  { key: 'kooperationen', icon: 'kooperation', label: 'Kooperationen', count: (d) => d.kooperationen?.length, render: (d) => d.renderKooperationenContent() },
  { key: 'rezensionen', icon: 'rezension', label: 'Rezensionen', count: (_d, _v, reviews) => reviews?.length ?? 0, render: (_d, _v, reviews) => renderRezensionListe(reviews) },
  { key: 'videos', icon: 'video', label: 'Videos', count: (d, v) => v?.total ?? 0, render: (d, v) => renderVideosSection(d, v?.byKoop || {}) },
  { key: 'unternehmen', icon: 'unternehmen', label: 'Unternehmen', count: (d) => d.unternehmen?.length, render: (d) => d.renderUnternehmenContent() },
  { key: 'rechnungen', icon: 'rechnungen', label: 'Rechnungen', count: (d) => d.rechnungen?.length, render: (d) => d.renderRechnungenContent() },
  { key: 'vertraege', icon: 'vertraege', label: 'Verträge', count: (d) => d.vertraege?.length, render: (d) => d.renderVertraegeContent() },
  { key: 'listen', icon: 'listen', label: 'Listen', count: (d) => d.lists?.length, render: (d) => d.renderListenContent() },
  { key: 'adresse', icon: 'map-pin', label: 'Adresse', render: (d) => d.renderAdresseContent() }
];

function renderAccordion(detail, videos, reviews) {
  const sections = darfRezensionSehen() ? SECTIONS : SECTIONS.filter((section) => section.key !== 'rezensionen');
  const items = sections.map((section) => {
    const count = section.count ? section.count(detail, videos, reviews) : null;
    return `
      <div class="settings-accordion-item">
        <button type="button" class="settings-accordion-header${section.expanded ? ' expanded' : ''}" data-accordion="${section.key}">
          <span class="settings-accordion-chevron">${CHEVRON_ICON}</span>
          <span class="settings-accordion-icon">${entityIcon(section.icon)}</span>
          <span>${section.label}</span>
          ${count != null ? `<span class="settings-accordion-count">${count}</span>` : ''}
        </button>
        <div class="settings-accordion-body" style="${section.expanded ? '' : 'display:none;'}">
          ${section.render(detail, videos, reviews)}
        </div>
      </div>
    `;
  }).join('');
  return `<div class="settings-accordion">${items}</div>`;
}

// Gleiche Button-Zeile wie renderContentCell der Kampagnen-Videotabelle,
// aber ohne Upload-/Verwalten-Knoepfe (die Akte ist readOnly).
function renderVideoContentCell(koop, video) {
  const videoUrl = video.file_url || video.link_content || video.asset_url;
  const buttons = [];

  if (videoUrl) {
    buttons.push(`<button type="button" class="external-link-btn media-action-btn play-btn" data-action="play-video" data-video-id="${video.id}" data-kooperation-id="${koop.id}" title="Video abspielen">${PLAY_ICON}</button>`);
  } else if (video.folder_url) {
    buttons.push(`<a href="${escUrl(video.folder_url)}" target="_blank" rel="noopener noreferrer" class="external-link-btn" title="Ordner öffnen">${FOLDER_ICON}</a>`);
  }
  if (video.story_folder_url) {
    buttons.push(`<button type="button" class="external-link-btn media-action-btn" data-action="view-storys" data-video-id="${video.id}" data-kooperation-id="${koop.id}" title="Storys ansehen">${STORYS_ICON}</button>`);
  }

  if (!buttons.length) return '<span class="no-content-placeholder">—</span>';
  return `<div class="content-cell-actions">${buttons.join('')}</div>`;
}

function renderVideosSection(detail, videosByKoop) {
  const rows = [];
  for (const koop of detail.kooperationen || []) {
    for (const video of videosByKoop[koop.id] || []) {
      const titel = video.video_name || video.thema || (video.position ? `Video ${video.position}` : 'Video');
      rows.push(`
        <tr>
          <td>${esc(titel)}</td>
          <td>
            <a href="/kooperation/${koop.id}" class="table-link" onclick="event.preventDefault(); window.navigateTo('/kooperation/${koop.id}')">
              ${esc(koop.name || 'Kooperation')}
            </a>
          </td>
          <td>${video.stats_views != null ? Number(video.stats_views).toLocaleString('de-DE') : '–'}</td>
          <td>${renderVideoContentCell(koop, video)}</td>
        </tr>
      `);
    }
  }

  if (!rows.length) {
    return renderEmptyState({
      icon: 'video',
      title: 'Keine Videos',
      text: 'Für diesen Creator wurden noch keine Videos hochgeladen.'
    });
  }

  return `
    ${renderSectionHeader({ title: 'Videos' })}
    <div class="data-table-container">
      <table class="data-table">
        <thead>
          <tr>
            <th>Video</th>
            <th>Kooperation</th>
            <th>Aufrufe</th>
            <th>Content</th>
          </tr>
        </thead>
        <tbody>${rows.join('')}</tbody>
      </table>
    </div>
  `;
}

// Alle Videos der Kooperationen inkl. Assets, angereichert wie in der
// Kampagnen-Videotabelle (currentAsset/file_url/finalAssets).
async function loadSheetVideos(kooperationen) {
  const koopIds = (kooperationen || []).map((k) => k.id).filter(Boolean);
  if (!koopIds.length || !window.supabase) return { byKoop: {}, total: 0 };

  const { data: videoRows, error } = await window.supabase
    .from('kooperation_videos')
    .select('id, kooperation_id, position, video_name, thema, asset_url, link_content, folder_url, story_folder_url, content_art, posting_datum, stats_views')
    .in('kooperation_id', koopIds)
    .order('position', { ascending: true });
  if (error) throw error;

  const videos = videoRows || [];
  const byKoop = {};
  for (const video of videos) {
    video.currentAsset = null;
    video.file_url = video.asset_url || null;
    video.finalAssets = [];
    (byKoop[video.kooperation_id] ||= []).push(video);
  }

  const videoIds = videos.map((v) => v.id);
  if (videoIds.length) {
    const [loopResult, finalResult] = await Promise.all([
      window.supabase
        .from('kooperation_video_asset')
        .select('id, video_id, file_url, file_path, version_number, is_current, created_at')
        .in('video_id', videoIds)
        .eq('is_final', false),
      window.supabase
        .from('kooperation_video_asset')
        .select('id, video_id, file_url, file_path, variant_name, is_final, source_asset_id, created_at')
        .in('video_id', videoIds)
        .eq('is_final', true)
        .order('created_at', { ascending: true })
    ]);

    const loopByVideo = {};
    for (const asset of loopResult.data || []) (loopByVideo[asset.video_id] ||= []).push(asset);
    const finalsByVideo = {};
    for (const asset of finalResult.data || []) (finalsByVideo[asset.video_id] ||= []).push(asset);

    for (const video of videos) {
      const current = pickLatestAsset(loopByVideo[video.id] || []) || pickLatestAsset(finalsByVideo[video.id] || []);
      if (current) {
        video.currentAsset = current;
        video.file_url = current.file_url || video.asset_url || null;
      }
      video.finalAssets = finalsByVideo[video.id] || [];
    }
  }

  return { byKoop, total: videos.length };
}

// Minimale Tabellen-Fassade fuer den Media-Viewer: gleiche Form wie die
// Kampagnen-Videotabelle, aber readOnly (kein Feedback, keine Uploads).
// loadStorySlots kommt vom echten VideoTableDataLoader - ohne Store schreibt
// er die Slots direkt auf die Videos der Fassade.
function buildPlayerFacade(detail, videosByKoop) {
  const facade = {
    videos: videosByKoop,
    videoComments: {},
    stillComments: {},
    isKundeRole: () => false,
    isFieldEditableForUser: () => false,
    renderer: { getFilteredKooperationen: () => detail.kooperationen || [] }
  };
  facade.dataLoader = new VideoTableDataLoader(facade);
  return facade;
}

async function loadSheetDetail(creatorId) {
  const detail = new CreatorDetail();
  detail.creatorId = creatorId;
  detail.readOnly = true;

  await detail.loadCriticalData();
  await detail.loadKooperationen();
  // Videos haengen nur an den Kooperationen und koennen parallel zur
  // zweiten Laderunde laufen.
  const videosPromise = loadSheetVideos(detail.kooperationen);
  await Promise.all([
    detail.loadKampagnen(),
    detail.loadListen(),
    detail.loadVertraege(),
    detail.loadManagements(),
    detail.loadProfileCounts()
  ]);
  // Brauchen Kampagnen bzw. Kooperationen aus den Runden oben
  await Promise.all([
    detail.loadUnternehmen(),
    detail.loadRechnungen()
  ]);
  const videos = await videosPromise;
  return { detail, videos };
}

export async function openCreatorSheet(creator) {
  if (!creator?.id) return;
  const name = `${creator.vorname || ''} ${creator.nachname || ''}`.trim() || 'Creator';
  const avatarUrl = creator.profilbild_url ? escUrl(creator.profilbild_url) : null;

  let contacts = [];
  try {
    const { data } = await window.supabase
      .from('creator_ansprechpartner')
      .select('ansprechpartner:ansprechpartner_id(id, vorname, nachname)')
      .eq('creator_id', creator.id);
    contacts = (data || []).map((row) => row.ansprechpartner).filter(Boolean);
  } catch {
    contacts = [];
  }

  const feld = (label, value, copy) => `
    <div class="form-field">
      <label>${label}</label>
      <p class="form-readonly">${esc(value || '–')}${copy ? ` <button type="button" class="mdc-btn mdc-btn--secondary mdc-btn--sm" data-action="copy-text" data-copy="${esc(copy)}">Kopieren</button>` : ''}</p>
    </div>`;

  const zahl = (value) => (value != null && value !== '' && !Number.isNaN(Number(value))
    ? Number(value).toLocaleString('de-DE')
    : '–');

  const managements = creator.managements || [];
  const telefon = creator.telefon_nicht_vorhanden ? '' : creator.telefonnummer;
  const ansprechpartner = contacts.length
    ? contacts.map((person) => `${person.vorname || ''} ${person.nachname || ''}`.trim()).filter(Boolean).join(', ')
    : '';
  const creatorId = esc(creator.id);

  // Wird gesetzt, sobald die Profildaten da sind; Klicks vorher sind no-ops
  const playerHolder = { player: null };
  const detailHolder = { detail: null };
  const canEdit = window.canEdit?.('creator') ?? false;

  const { body, close } = openDrawer({
    id: DRAWER_ID,
    title: esc(name),
    subtitle: 'Kontaktdaten und Profil',
    avatar: avatarUrl
      ? { url: avatarUrl }
      : { initials: esc((creator.vorname || '?')[0].toUpperCase()) },
    // Breite Variante, damit die Tabellen der Profil-Abschnitte Luft haben
    panelClass: 'drawer-panel--xwide',
    body: `
      <div class="form-row-group">
        ${feld('Mail', creator.mail, creator.mail)}
        ${feld('Telefon', telefon, telefon)}
      </div>
      <div class="form-row-group">
        ${feld('Management', managements.join(', '))}
        ${feld('Ansprechpartner', ansprechpartner)}
      </div>
      <div class="creator-merkmale creator-sheet-blick" data-creator-id="${creatorId}">
        <div class="ig-stats-row">
          <div class="ig-stat">
            <span class="ig-stat-value" data-blick="follower">${zahl(creator.instagram_follower)}</span>
            <span class="ig-stat-label creator-blick-ig">${icon('instagram', { className: 'ig-stat-icon' })} Follower</span>
          </div>
          <div class="ig-stat">
            <span class="ig-stat-value" data-blick="views">${zahl(durchschnittlicheViews(creator))}</span>
            <span class="ig-stat-label creator-blick-ig">${icon('instagram', { className: 'ig-stat-icon' })} Ø Views</span>
          </div>
          <div class="ig-stat">
            <div class="creator-favorit-host"></div>
            <span class="ig-stat-label">Favorit</span>
          </div>
          ${darfRezensionSehen() ? `
            <div class="ig-stat">
              <span class="ig-stat-value" data-blick="rezension">${formatRezension(creator.rezension_schnitt)}</span>
              <span class="ig-stat-label">Rezension</span>
            </div>` : ''}
        </div>
        <div class="form-field">
          <label>Tags</label>
          <div class="creator-tag-host"></div>
        </div>
      </div>
      <div id="creator-sheet-details">
        <div class="creator-grid-loading">
          <div class="table-loading-spinner"></div>
          <span>Lade Profil...</span>
        </div>
      </div>
      <div class="drawer-footer">
        ${canEdit ? `<button type="button" class="mdc-btn mdc-btn--secondary" data-action="edit-creator">Profil bearbeiten</button>` : ''}
        <button type="button" class="mdc-btn creator-card__casting" data-id="${creator.id}">Ins Casting</button>
      </div>
    `
  });

  body.addEventListener('click', async (event) => {
    const header = event.target.closest('.settings-accordion-header');
    if (header) {
      const expanded = header.classList.toggle('expanded');
      const section = header.nextElementSibling;
      if (section) section.style.display = expanded ? '' : 'none';
      return;
    }
    const playBtn = event.target.closest('[data-action="play-video"]');
    if (playBtn) {
      playerHolder.player?.openVideo(playBtn.dataset.videoId, playBtn.dataset.kooperationId)
        ?.catch((err) => console.warn('⚠️ CREATORSHEET: Video konnte nicht geöffnet werden', err?.message || err));
      return;
    }
    const storysBtn = event.target.closest('[data-action="view-storys"]');
    if (storysBtn) {
      playerHolder.player?.openStory(storysBtn.dataset.videoId, storysBtn.dataset.kooperationId)
        ?.catch((err) => console.warn('⚠️ CREATORSHEET: Storys konnten nicht geöffnet werden', err?.message || err));
      return;
    }
    if (event.target.closest('[data-action="edit-creator"]')) {
      close();
      try {
        const detail = detailHolder.detail || new CreatorDetail();
        detail.creatorId = creator.id;
        detail.readOnly = false;
        if (!detail.creator) await detail.loadCriticalData();
        await detail.showEditForm();
      } catch (error) {
        console.warn('⚠️ CREATORSHEET: Bearbeiten konnte nicht geöffnet werden', error?.message || error);
        window.toastSystem?.show('Profil konnte nicht zum Bearbeiten geöffnet werden', 'error');
      }
      return;
    }
    const copy = event.target.closest('[data-action="copy-text"]');
    if (copy) {
      try {
        await navigator.clipboard.writeText(copy.dataset.copy);
        window.toastSystem?.show('Kopiert', 'success');
      } catch {
        window.toastSystem?.show('Kopieren nicht möglich', 'error');
      }
      return;
    }
    // Interne Links navigieren - die Schublade liegt dann nicht mehr darueber
    if (event.target.closest('a.table-link, a[onclick*="navigateTo"]')) close();
  });

  bindCreatorMerkmale(body);

  const setBlick = (source) => {
    const follower = body.querySelector('[data-blick="follower"]');
    const views = body.querySelector('[data-blick="views"]');
    const rezension = body.querySelector('[data-blick="rezension"]');
    if (follower) follower.textContent = zahl(source?.instagram_follower);
    if (views) views.textContent = zahl(durchschnittlicheViews(source));
    if (rezension) rezension.textContent = formatRezension(source?.rezension_schnitt);
  };

  // Profil-Abschnitte nachladen; der Kontakt-Block oben steht schon
  const slot = body.querySelector('#creator-sheet-details');
  try {
    const { detail, videos } = await loadSheetDetail(creator.id);
    detailHolder.detail = detail;
    let reviews = [];
    if (darfRezensionSehen()) {
      try {
        reviews = await loadCreatorRezensionen(window.supabase, creator.id);
      } catch (error) {
        console.warn('⚠️ CREATORSHEET: Rezensionen konnten nicht geladen werden', error?.message || error);
      }
    }
    if (!document.body.contains(slot)) return;
    if (videos.total > 0) {
      playerHolder.player = new VideoPlayerLightbox(buildPlayerFacade(detail, videos.byKoop));
    }
    slot.innerHTML = renderAccordion(detail, videos, reviews);
    setBlick(detail.creator);
  } catch (error) {
    console.warn('⚠️ CREATORSHEET: Profil konnte nicht geladen werden', error?.message || error);
    if (document.body.contains(slot)) {
      slot.innerHTML = '<p class="form-hint">Profil-Details konnten nicht geladen werden.</p>';
    }
  }
}
