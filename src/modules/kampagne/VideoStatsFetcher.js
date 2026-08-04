// VideoStatsFetcher
// Die beiden Aktionen der Live-Link-Zelle: Views, Likes und Kommentare zum
// veroeffentlichten Reel holen, oder Link und Zahlen wieder zuruecksetzen.
// Gleiche Mechanik wie der Instagram-Abruf im Sourcing
// (CreatorAuswahlDetail.handleInstagramFetch).
//
// Aktualisiert wird gezielt im DOM statt ueber ein Re-Render der Tabelle: ein
// render() wuerde Scroll-Position, offene Dropdowns und den Fokus in einem
// gerade bearbeiteten Feld verlieren.
//
// Die Buttons sitzen in der LiveLinkToolbar an document.body, nicht mehr in der
// Zeile - der Weg zur Zelle laeuft daher ueber die Video-ID statt ueber
// closest().

import { authorizedFetch } from '../../core/auth/getAccessToken.js';
import { formatCompactNumber, formatExactNumber } from '../../core/format/compactNumber.js';
import { applyLiveLinkCellState, findLiveLinkCell, findVideoInTable } from './liveLinkCell.js';

const SUCCESS_FLASH_MS = 2000;

// Kompletter Reset der Live-Performance einer Zeile
const CLEAR_PATCH = {
  link_live: null,
  stats_views: null,
  stats_likes: null,
  stats_comments: null,
  stats_fetched_at: null,
  stats_error: null,
  stats_raw: null
};

export class VideoStatsFetcher {
  constructor(table) {
    this.table = table;
  }

  _findVideo(videoId) {
    return findVideoInTable(this.table, videoId);
  }

  /** Abgerufene Zahlen in die drei Stats-Inputs schreiben */
  _applyStatsToDom(videoId, video) {
    const felder = ['stats_views', 'stats_likes', 'stats_comments'];
    const grid = document.querySelector('.kooperation-video-grid');
    if (!grid) return;

    for (const feld of felder) {
      const wert = video[feld];
      const input = grid.querySelector(`input[data-entity="video"][data-id="${videoId}"][data-field="${feld}"]`);
      if (!input) continue;

      input.value = wert != null ? wert : '';
      input.classList.add('save-success');
      setTimeout(() => input.classList.remove('save-success'), 1000);

      // Der Input haelt den Rohwert, sichtbar ist das kompakte Overlay
      const display = input.parentElement?.querySelector('[data-number-display]');
      if (display) {
        display.textContent = formatCompactNumber(wert) || '—';
        display.title = formatExactNumber(wert);
      }
    }
  }

  /**
   * Chip, Status-Punkt und Input der Zelle auf den aktuellen Stand bringen.
   * Auch vom Realtime-Handler und nach manueller Link-Eingabe genutzt, weil die
   * Tabelle einzelne Zellen nie neu rendert.
   */
  _applyLinkStateToDom(videoId, video) {
    applyLiveLinkCellState(findLiveLinkCell(videoId), video);
  }

  /**
   * Button auf den Zustand bringen, den ein frischer Toolbar-Render zeigen
   * wuerde. Der Erfolgs-Flash laeuft bewusst auf dem Button und nicht ueber
   * einen Neuaufbau der Leiste, sonst waere er sofort wieder weg.
   */
  _applyButtonState(button, video, { flashSuccess = false } = {}) {
    button.disabled = false;
    button.classList.remove('is-loading', 'is-error', 'is-refresh', 'is-success');

    if (video.stats_error) {
      button.classList.add('is-error');
      button.title = `Abruf fehlgeschlagen: ${video.stats_error}`;
      this.table._liveLinkToolbar?.unpin();
      this.table._liveLinkToolbar?.refresh();
      return;
    }

    if (flashSuccess) {
      button.classList.add('is-success');
      setTimeout(() => {
        button.classList.remove('is-success');
        button.classList.add('is-refresh');
        const toolbar = this.table._liveLinkToolbar;
        toolbar?.unpin();
        toolbar?.refresh();
      }, SUCCESS_FLASH_MS);
    } else if (video.stats_fetched_at) {
      button.classList.add('is-refresh');
    }

    button.title = video.stats_fetched_at
      ? `Stand: ${new Date(video.stats_fetched_at).toLocaleString('de-DE')} · frisch abrufen`
      : 'Views, Likes und Kommentare bei Instagram abrufen';
  }

  /**
   * Eigenen Schreibvorgang markieren, damit der Realtime-Handler das Echo
   * ueberspringt und das gezielte DOM-Update nicht durch ein Re-Render ersetzt.
   */
  _markOwnUpdate(videoId) {
    const t = this.table;
    if (!t._pendingOwnUpdates) t._pendingOwnUpdates = new Map();
    t._pendingOwnUpdates.set(videoId, Date.now());
    t._lastUpdateBy = window.currentUser?.id;
    t._lastUpdateTime = Date.now();
  }

  /**
   * Papierkorb in der Toolbar: Link und abgerufene Zahlen in einem Schritt
   * zuruecksetzen. Bewusst mit Rueckfrage, weil auch von Hand eingetragene
   * Zahlen wegfallen.
   */
  async handleClear(button) {
    if (button.disabled) return;

    const videoId = button.dataset.videoId;
    const video = this._findVideo(videoId);
    if (!video) return;

    const meldung = 'Der Link und die abgerufenen Zahlen (Views, Likes, Kommentare) werden entfernt.';
    // Die Rueckfrage liegt ueber der Leiste; ohne pin() wuerde sie durch das
    // mouseleave beim Wechsel zum Modal verschwinden.
    this.table._liveLinkToolbar?.pin();

    if (window.confirmationModal) {
      const res = await window.confirmationModal.open({
        title: 'Live-Link entfernen',
        message: meldung,
        confirmText: 'Entfernen',
        cancelText: 'Abbrechen',
        danger: true
      });
      if (!res?.confirmed) {
        this.table._liveLinkToolbar?.unpin();
        return;
      }
    } else if (!confirm(meldung)) {
      this.table._liveLinkToolbar?.unpin();
      return;
    }

    button.disabled = true;
    this._markOwnUpdate(videoId);

    try {
      const { error } = await window.supabase
        .from('kooperation_videos')
        .update(CLEAR_PATCH)
        .eq('id', videoId);

      if (error) throw error;

      Object.assign(video, CLEAR_PATCH);
      this.table.store?.updateVideo(videoId, { ...CLEAR_PATCH });

      this._applyLinkStateToDom(videoId, video);
      this._applyStatsToDom(videoId, video);

      // Ohne Link hat die Leiste keine sinnvolle Aktion mehr
      this.table._liveLinkToolbar?.close();
    } catch (error) {
      console.error('Fehler beim Entfernen des Live-Links:', error);
      this.table._pendingOwnUpdates?.delete(videoId);
      button.disabled = false;
      this.table._liveLinkToolbar?.unpin();
      window.toastSystem?.show('Live-Link konnte nicht entfernt werden', 'error');
    }
  }

  async handleFetch(button) {
    if (button.disabled) return;

    const videoId = button.dataset.videoId;
    const video = this._findVideo(videoId);
    if (!video) return;

    const grid = document.querySelector('.kooperation-video-grid');
    const linkInput = grid?.querySelector(`input[data-entity="video"][data-id="${videoId}"][data-field="link_live"]`);
    const link = linkInput?.value?.trim();
    if (!link) {
      window.toastSystem?.show('Bitte zuerst den Link zum veröffentlichten Video eintragen', 'error');
      return;
    }

    // Noch nicht gespeicherte Eingabe zuerst persistieren, sonst liest die
    // Function den alten Wert aus der DB
    if (link !== video.link_live) {
      const gespeichert = await this.table.handleFieldUpdate(linkInput);
      if (!gespeichert) {
        window.toastSystem?.show('Link konnte nicht gespeichert werden', 'error');
        return;
      }
    }

    button.disabled = true;
    button.classList.remove('is-error', 'is-success', 'is-refresh');
    button.classList.add('is-loading');
    // Der Abruf dauert; die Leiste muss offen bleiben, auch wenn der Zeiger sie
    // in der Zwischenzeit verlaesst.
    this.table._liveLinkToolbar?.pin();
    findLiveLinkCell(videoId)?.querySelector('[data-live-link-dot]')?.classList.add('is-loading');

    // Die Function schreibt mit dem Service-Key, das Realtime-Echo kommt also
    // nicht ueber handleFieldUpdate und wuerde die Zeile neu rendern - damit
    // waeren gezieltes DOM-Update und Erfolgs-Flash wieder weg.
    const t = this.table;
    this._markOwnUpdate(videoId);

    try {
      const response = await authorizedFetch('/.netlify/functions/kooperation-video-stats', {
        method: 'POST',
        body: JSON.stringify({ video_id: videoId })
      });
      const result = await response.json().catch(() => ({}));

      if (!response.ok || !result.ok) {
        const error = new Error(result.error || 'Abruf fehlgeschlagen');
        error.retryable = response.status === 429;
        error.hint = result.hint || null;
        throw error;
      }

      const patch = {
        stats_views: result.video.stats_views,
        stats_likes: result.video.stats_likes,
        stats_comments: result.video.stats_comments,
        stats_fetched_at: result.video.stats_fetched_at,
        stats_error: null
      };
      Object.assign(video, patch);
      t.store?.updateVideo(videoId, patch);

      this._applyStatsToDom(videoId, video);
      this._applyLinkStateToDom(videoId, video);
      this._applyButtonState(button, video, { flashSuccess: true });

      const views = patch.stats_views;
      window.toastSystem?.show(
        views != null
          ? `Statistiken aktualisiert (${Number(views).toLocaleString('de-DE')} Views)`
          : 'Statistiken aktualisiert – Instagram liefert für diesen Beitrag keine Views',
        views != null ? 'success' : 'info'
      );
    } catch (error) {
      console.error('Fehler beim Abruf der Video-Statistiken:', error);
      // Bei toter Session hat authorizedFetch schon Hinweis und Logout uebernommen;
      // der Abbruch gehoert dann nicht als Abruf-Fehler an die Zeile
      if (error.sessionDead) {
        button.disabled = false;
        button.classList.remove('is-loading');
        this.table._liveLinkToolbar?.unpin();
        this._applyLinkStateToDom(videoId, video);
        return;
      }

      const patch = { stats_error: error.message };
      Object.assign(video, patch);
      t.store?.updateVideo(videoId, patch);

      this._applyLinkStateToDom(videoId, video);
      this._applyButtonState(button, video);
      window.toastSystem?.show(error.hint || error.message, error.retryable ? 'info' : 'error');
    }
  }
}
