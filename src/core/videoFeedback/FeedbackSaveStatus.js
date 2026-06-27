// FeedbackSaveStatus
// Einheitliche, dezente Speicher-Statusanzeige fuer Video-Feedback-Felder.
//  - Player (.media-viewer-feedback) + Detailseite (.feedback-status-host):
//    neutrales Tag (vorhandenes .tag-System) direkt in der Slot-Ueberschrift,
//    auf gleicher Hoehe wie h4/h3. Kein eigenes CSS, nicht farbig.
//  - Tabelle (grid-textarea ohne Ueberschrift): schwebendes Badge am Feld.
// Haeufiger Zustand (Speichern.../Gespeichert) wird ruhig gezeigt, Fehler
// eskalieren zusaetzlich ueber das globale Toast-System und bleiben mit Retry
// am Feld stehen, bis der Save erfolgreich war.

const SAVED_HIDE_MS = 2000;

export class FeedbackSaveStatus {
  // Fokus ohne (noch) ungespeicherte Aenderung: ruhiges, neutrales Tag, damit
  // das Auge des Users vorbereitet ist, wo der Speicher-Status erscheint.
  setEditing(field) {
    this._render(field, 'is-editing', 'Auto-Speichern aktiv', null);
  }

  // Status fuer dieses Feld komplett ausblenden (z.B. Feld verlassen ohne Aenderung).
  clear(field) {
    const el = this._statusEl(field);
    if (!el) return;
    this._clearHide(el);
    this._reset(el);
  }

  setSaving(field) {
    this._render(field, 'is-saving', 'Speichern…', null);
  }

  setSaved(field) {
    const el = this._render(field, 'is-saved', 'Gespeichert', null);
    if (el) {
      el._hideTimer = setTimeout(() => this._reset(el), SAVED_HIDE_MS);
    }
  }

  setError(field, retry) {
    this._render(field, 'is-error', 'Nicht gespeichert – erneut versuchen',
      typeof retry === 'function' ? retry : null);
    window.toastSystem?.error('Feedback konnte nicht gespeichert werden. Bitte erneut versuchen.');
  }

  _render(field, stateClass, text, retry) {
    const el = this._statusEl(field);
    if (!el) return null;
    this._clearHide(el);

    if (el.classList.contains('feedback-save-tag')) {
      // Neutrales Tag (vorhandenes .tag-System) – nur Text/Sichtbarkeit.
      el.style.display = 'inline-flex';
      el.textContent = text;
    } else {
      const floating = el.classList.contains('feedback-save-status--floating');
      el.className = `feedback-save-status${floating ? ' feedback-save-status--floating' : ''} ${stateClass}`;
      el.textContent = text;
      if (floating) this._positionFloating(field, el);
    }

    el.onclick = retry ? (() => retry()) : null;
    el.style.cursor = retry ? 'pointer' : '';
    return el;
  }

  _reset(el) {
    if (el.classList.contains('feedback-save-tag')) {
      el.style.display = 'none';
      el.textContent = '';
    } else {
      const floating = el.classList.contains('feedback-save-status--floating');
      el.className = `feedback-save-status${floating ? ' feedback-save-status--floating' : ''}`;
      el.textContent = '';
    }
    el.onclick = null;
  }

  // Loest das passende Status-Element fuer das Feld auf (Kontext-abhaengig).
  _statusEl(field) {
    if (!field) return null;
    const playerHost = field.closest?.('.media-viewer-feedback');
    if (playerHost) return this._ensureHeadingTag(playerHost, 'h4');
    const host = field.closest?.('.feedback-status-host');
    if (host) return this._ensureHeadingTag(host, 'h3');
    return this._floatingEl();
  }

  // Neutrales Tag in die Slot-Ueberschrift haengen: Headline links, Tag rechts.
  // Layout per Inline-Flex am Heading (kein CSS-Eintrag, nutzt nur .tag).
  _ensureHeadingTag(host, headingSel) {
    const heading = host.querySelector(headingSel) || host;
    let el = heading.querySelector(':scope > .feedback-save-tag');
    if (!el) {
      heading.style.display = 'flex';
      heading.style.alignItems = 'center';
      el = document.createElement('span');
      el.className = 'feedback-save-tag tag';
      el.style.display = 'none';
      el.style.marginLeft = 'auto';
      heading.appendChild(el);
    }
    return el;
  }

  // Ein einziges, wiederverwendetes Badge fuer Tabellen-Felder ohne Ueberschrift.
  _floatingEl() {
    let el = document.getElementById('feedback-save-status-floating');
    if (!el) {
      el = document.createElement('div');
      el.id = 'feedback-save-status-floating';
      el.className = 'feedback-save-status feedback-save-status--floating';
      document.body.appendChild(el);
    }
    return el;
  }

  _positionFloating(field, el) {
    const r = field.getBoundingClientRect();
    el.style.top = `${Math.max(4, r.top - 22)}px`;
    el.style.left = `${Math.max(4, r.left)}px`;
  }

  _clearHide(el) {
    if (el?._hideTimer) {
      clearTimeout(el._hideTimer);
      el._hideTimer = null;
    }
  }
}
