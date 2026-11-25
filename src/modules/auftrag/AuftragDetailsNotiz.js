// Notiz auf den Auftragsdetails: Lesen mit Links, Bearbeiten mit Fett und Kursiv.

import { getCurrentBenutzerId } from '../auth/CurrentUser.js';
import { icon } from '../../core/icons/IconSystem.js';
import { htmlToInlineMd } from '../../core/utils/inlineFormat.js';
import {
  applyFormatToEditor,
  formatFromShortcut,
  insertPlainTextAtSelection,
  writeEditorHtml
} from './logic/AuftragDetailsNotizFormat.js';
import {
  NOTIZ_IDLE_MS,
  NOTIZ_PLACEHOLDER,
  NOTIZ_SAVED_MS,
  canonicalNotiz,
  canSeeAuftragNotiz,
  formatNotizKonflikt,
  formatNotizMeta,
  prepareNotizText,
  renderNotizHtml
} from './logic/AuftragDetailsNotizText.js';
import { loadAuftragNotiz, writeAuftragNotiz } from './AuftragDetailsNotizStore.js';

const SAVE_ERROR = 'Die Notiz konnte nicht gespeichert werden.';
const LOAD_ERROR = 'Die Notiz konnte nicht geladen werden.';

export function renderAuftragNotizSection() {
  if (!canSeeAuftragNotiz()) return '';
  return `
    <div class="detail-section u-mt-lg auftrag-notiz is-loading" data-auftrag-notiz>
      <h3 class="section-title section-title--spaced auftrag-notiz__title">
        Notizen
        <span class="auftrag-notiz__status" data-notiz-status hidden>Gespeichert</span>
      </h3>
      <div class="auftrag-notiz__body">
        <div class="auftrag-notiz__tools" data-notiz-tools hidden role="toolbar" aria-label="Formatierung">
          <button type="button" class="btn-icon auftrag-notiz__tool" data-notiz-format="bold" aria-label="Fett" title="Fett">${icon('bold')}</button>
          <button type="button" class="btn-icon auftrag-notiz__tool" data-notiz-format="italic" aria-label="Kursiv" title="Kursiv">${icon('italic')}</button>
        </div>
        <div class="auftrag-notiz__read is-empty" data-notiz-read tabindex="0" aria-label="Notizen">${NOTIZ_PLACEHOLDER}</div>
        <div class="auftrag-notiz__input is-empty" data-notiz-input hidden contenteditable="true" role="textbox" aria-multiline="true" aria-label="Notizen" data-placeholder="${NOTIZ_PLACEHOLDER}" spellcheck="true"></div>
        <div class="notice-box notice-warning auftrag-notiz__conflict" data-notiz-conflict hidden>
          <strong data-notiz-conflict-text></strong>
          <button type="button" class="mdc-btn mdc-btn--secondary mdc-btn--sm" data-notiz-load-theirs>Deren Stand laden</button>
        </div>
        <p class="auftrag-notiz__error" data-notiz-error hidden></p>
        <p class="auftrag-notiz__limit" data-notiz-limit hidden>Die Notiz ist auf 10.000 Zeichen begrenzt.</p>
        <p class="auftrag-notiz__meta" data-notiz-meta hidden></p>
      </div>
    </div>
  `;
}

export class AuftragDetailsNotizController {
  constructor(deps = {}) {
    this._load = deps.load || ((detailsId) => loadAuftragNotiz(window.supabase, detailsId));
    this._write = deps.write || ((payload) => writeAuftragNotiz(window.supabase, payload));
    this._getUserId = deps.getUserId || getCurrentBenutzerId;
    this._idleMs = deps.idleMs ?? NOTIZ_IDLE_MS;
    this._savedMs = deps.savedMs ?? NOTIZ_SAVED_MS;
    this.root = null;
    this.detailsId = null;
    this._loaded = false;
    this._editing = false;
    this._destroyed = false;
    this.baseText = '';
    this.baseUpdatedAt = null;
    this.baseAuthor = null;
    this.draft = '';
    this._conflict = null;
    this._saveFailed = false;
    this._timer = null;
    this._statusTimer = null;
    this._chain = Promise.resolve();
    this._loading = Promise.resolve();
    this._abort = null;
  }

  mount(root, detailsId) {
    this.destroy();
    this._destroyed = false;
    this.root = root;
    this.detailsId = detailsId;
    this._abort = new AbortController();
    const signal = this._abort.signal;
    this.read = root.querySelector('[data-notiz-read]');
    this.input = root.querySelector('[data-notiz-input]');
    this.tools = root.querySelector('[data-notiz-tools]');
    this.statusEl = root.querySelector('[data-notiz-status]');
    this.conflictEl = root.querySelector('[data-notiz-conflict]');
    this.conflictText = root.querySelector('[data-notiz-conflict-text]');
    this.errorEl = root.querySelector('[data-notiz-error]');
    this.limitEl = root.querySelector('[data-notiz-limit]');
    this.metaEl = root.querySelector('[data-notiz-meta]');

    this.read?.addEventListener('click', (event) => this._onReadClick(event), { signal });
    this.read?.addEventListener('keydown', (event) => {
      if (event.key !== 'Enter' || event.target !== this.read) return;
      event.preventDefault();
      this._enterEdit();
    }, { signal });
    this.input?.addEventListener('input', () => this._onInput(), { signal });
    this.input?.addEventListener('blur', (event) => {
      if (this.tools?.contains(event.relatedTarget)) return;
      this._leaveEdit();
    }, { signal });
    this.input?.addEventListener('keydown', (event) => this._onKeyDown(event), { signal });
    this.input?.addEventListener('paste', (event) => this._onPaste(event), { signal });
    this.tools?.addEventListener('mousedown', (event) => event.preventDefault(), { signal });
    this.tools?.addEventListener('click', (event) => {
      const format = event.target.closest('[data-notiz-format]')?.dataset.notizFormat;
      if (!format) return;
      event.preventDefault();
      this._applyFormat(format);
    }, { signal });
    root.querySelector('[data-notiz-load-theirs]')?.addEventListener('click', () => this._loadTheirs(), { signal });

    this._loading = this._load(detailsId)
      .then((row) => {
        if (this._destroyed) return;
        this._applyBase(row);
        this.draft = this.baseText;
        this._loaded = true;
        this.root.classList.remove('is-loading');
        this._paint();
      })
      .catch(() => {
        if (this._destroyed) return;
        this._showError(LOAD_ERROR);
      });
  }

  destroy() {
    this._destroyed = true;
    if (this._timer) clearTimeout(this._timer);
    if (this._statusTimer) clearTimeout(this._statusTimer);
    this._timer = null;
    this._statusTimer = null;
    this._abort?.abort();
    this._abort = null;
    this.root = null;
    this._loaded = false;
    this._editing = false;
    this._conflict = null;
    this._saveFailed = false;
  }

  async beforeLeave() {
    if (!this.root) return true;
    try {
      await this._loading;
    } catch {
      return true;
    }
    // Ohne geladenen Stand gibt es nichts zu sichern. Ein Ladefehler hält die Seite nicht fest.
    if (!this._loaded) return true;
    if (this._conflict) return false;
    if (this._editing) this._leaveEdit({ flush: false });
    const ok = await this.flush();
    return ok === true && !this._conflict && !this._saveFailed;
  }

  flush() {
    if (this._timer) {
      clearTimeout(this._timer);
      this._timer = null;
    }
    const run = () => this._flushBody();
    const queued = this._chain.then(run, run);
    this._chain = queued.then(() => {}, () => {});
    return queued;
  }

  async _flushBody() {
    if (this._destroyed || !this._loaded) return false;
    if (this._conflict) return false;
    let spins = 0;
    while (canonicalNotiz(this.draft) !== this.baseText) {
      if (this._conflict || this._destroyed) return false;
      spins += 1;
      if (spins > 4) {
        this._showError(SAVE_ERROR);
        this._saveFailed = true;
        return false;
      }
      const next = canonicalNotiz(this.draft);
      const ok = await this._persist(next);
      if (!ok) return false;
    }
    if (!this._conflict) this._saveFailed = false;
    return !this._conflict;
  }

  async _persist(nextText) {
    try {
      const userId = nextText ? await this._getUserId() : await this._getUserId().catch(() => null);
      const result = await this._write({
        detailsId: this.detailsId,
        userId,
        baseUpdatedAt: this.baseUpdatedAt,
        nextText
      });
      if (this._destroyed) return false;
      if (result?.status === 'conflict') {
        this._setConflict(result.row);
        return false;
      }
      this._applyBase(result?.row || { text: '', updatedAt: null, authorName: null });
      this._saveFailed = false;
      this._hideError();
      if (canonicalNotiz(this.draft) === this.baseText) this._showSaved();
      this._paint();
      return true;
    } catch {
      if (!this._destroyed) {
        this._saveFailed = true;
        this._showError(SAVE_ERROR);
      }
      return false;
    }
  }

  _applyBase(row) {
    this.baseText = canonicalNotiz(row?.text || '');
    this.baseUpdatedAt = row?.updatedAt || null;
    this.baseAuthor = row?.authorName || null;
  }

  _setConflict(row) {
    this._conflict = {
      text: canonicalNotiz(row?.text || ''),
      updatedAt: row?.updatedAt || null,
      authorName: row?.authorName || 'Unbekannt'
    };
    this._saveFailed = false;
    if (this._timer) {
      clearTimeout(this._timer);
      this._timer = null;
    }
    this._hideError();
    if (this.conflictText) {
      this.conflictText.textContent = formatNotizKonflikt(this._conflict.authorName, this._conflict.updatedAt);
    }
    if (this.conflictEl) this.conflictEl.hidden = false;
    if (this.metaEl) this.metaEl.hidden = true;
  }

  _loadTheirs() {
    const row = this._conflict;
    if (!row) return;
    this._conflict = null;
    this._applyBase(row);
    this.draft = this.baseText;
    this._saveFailed = false;
    if (this.conflictEl) this.conflictEl.hidden = true;
    this._editing = false;
    if (this.input) this.input.hidden = true;
    if (this.tools) this.tools.hidden = true;
    if (this.read) this.read.hidden = false;
    this._hideError();
    this._paint();
  }

  _onReadClick(event) {
    if (event.target?.closest?.('a')) return;
    event.preventDefault();
    this._enterEdit();
  }

  _enterEdit() {
    if (!this._loaded || !this.input || !this.read) return;
    this._editing = true;
    writeEditorHtml(this.input, this.draft);
    this.read.hidden = true;
    this.input.hidden = false;
    if (this.tools) this.tools.hidden = false;
    this.input.focus();
  }

  _leaveEdit({ flush = true } = {}) {
    if (!this._editing) return;
    this.draft = prepareNotizText(this.input ? htmlToInlineMd(this.input) : this.draft).text;
    this._editing = false;
    if (this.input) this.input.hidden = true;
    if (this.tools) this.tools.hidden = true;
    if (this.read) this.read.hidden = false;
    this._showLimit(prepareNotizText(this.draft).limited);
    this._paint();
    if (flush) void this.flush();
  }

  _onInput() {
    if (!this._loaded || !this.input) return;
    const raw = htmlToInlineMd(this.input);
    const prepared = prepareNotizText(raw);
    this.draft = prepared.text;
    if (prepared.text !== raw) writeEditorHtml(this.input, prepared.text);
    else this.input.classList.toggle('is-empty', !prepared.text);
    this._showLimit(prepared.limited);
    if (this._conflict) return;
    this._schedule();
  }

  _onKeyDown(event) {
    const format = formatFromShortcut(event);
    if (!format) return;
    event.preventDefault();
    this._applyFormat(format);
  }

  _onPaste(event) {
    event.preventDefault();
    const text = event.clipboardData?.getData('text/plain') ?? '';
    if (insertPlainTextAtSelection(this.input, text)) this._onInput();
  }

  _applyFormat(format) {
    if (!this._editing || !this.input) return;
    const result = applyFormatToEditor(this.input, format);
    if (!result) return;
    this.draft = result.text;
    this._showLimit(result.limited);
    this._schedule();
  }

  _schedule() {
    if (!this._loaded || this._conflict) return;
    if (this._timer) clearTimeout(this._timer);
    if (canonicalNotiz(this.draft) === this.baseText) {
      this._timer = null;
      return;
    }
    this._timer = setTimeout(() => {
      this._timer = null;
      void this.flush();
    }, this._idleMs);
  }

  _paint() {
    if (!this.read) return;
    const shown = canonicalNotiz(this.draft);
    if (!shown) {
      this.read.textContent = NOTIZ_PLACEHOLDER;
      this.read.classList.add('is-empty');
    } else {
      this.read.classList.remove('is-empty');
      this.read.innerHTML = renderNotizHtml(shown);
    }
    const meta = !this._conflict && this.baseText && this.baseUpdatedAt
      ? formatNotizMeta(this.baseAuthor, this.baseUpdatedAt)
      : '';
    if (this.metaEl) {
      this.metaEl.hidden = !meta;
      this.metaEl.textContent = meta;
    }
    this._showLimit(prepareNotizText(this.draft).limited);
  }

  _showSaved() {
    if (!this.statusEl) return;
    this.statusEl.hidden = false;
    if (this._statusTimer) clearTimeout(this._statusTimer);
    this._statusTimer = setTimeout(() => {
      if (this.statusEl) this.statusEl.hidden = true;
    }, this._savedMs);
  }

  _showLimit(on) {
    if (this.limitEl) this.limitEl.hidden = !on;
  }

  _showError(message) {
    if (!this.errorEl) return;
    this.errorEl.hidden = false;
    this.errorEl.textContent = message;
  }

  _hideError() {
    if (!this.errorEl) return;
    this.errorEl.hidden = true;
    this.errorEl.textContent = '';
  }
}
