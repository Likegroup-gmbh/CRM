// inlineQuestion.js
// Eine Frage im Verlauf, nicht in der Box unten. Hosts (Konzept, spaeter
// Briefing und Skript) haengen dieselbe Karte in ihren Feed.
//   kind 'choice' — eine Option, Klick committet
//   kind 'input'  — Text oder Zahl, Absenden in der Karte
//   kind 'counts' — eine Zahl pro Zeile (z. B. Produkt), Summe 1..max, Absenden in der Karte
// Solange die Karte offen ist, bleibt der Composer aus. Antwort lockt die Karte.

import { icon } from '../icons/IconSystem.js';

const CHECK = icon('check-bold', { className: 'chat-ask__check' });
const SEND = icon('send');

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

const COUNTS_MAX_DEFAULT = 12;

function countsMax(spec) {
  const max = Number(spec.max);
  return Number.isInteger(max) && max > 0 ? max : COUNTS_MAX_DEFAULT;
}

function defaultHint(spec) {
  if (spec.hint != null) return String(spec.hint);
  if (spec.kind === 'counts') return `0 oder leer lässt eine Zeile aus. Zusammen höchstens ${countsMax(spec)}.`;
  if (spec.kind === 'choice') return 'Wähl eine Option in der Karte.';
  if (spec.input?.type === 'number') return 'Trag die Zahl in die Karte ein.';
  return 'Tipp die Antwort in die Karte.';
}

function stepHtml(step) {
  const current = Number(step?.current);
  const total = Number(step?.total);
  if (!Number.isInteger(current) || !Number.isInteger(total) || total < 1 || current < 1) return '';
  const pct = Math.max(0, Math.min(100, Math.round((current / total) * 100)));
  return `<div class="chat-ask__meta"><span>Frage ${current} von ${total}</span><span class="chat-ask__ring" style="--p:${pct}" aria-hidden="true"></span></div>`;
}

function choiceHtml(spec) {
  const prompt = String(spec.prompt || '').trim();
  const options = Array.isArray(spec.options) ? spec.options : [];
  const buttons = options.map((opt) => {
    const id = escapeHtml(opt?.id ?? '');
    const label = escapeHtml(opt?.label ?? '');
    return `<button type="button" class="chat-ask__option" data-option-id="${id}" role="radio" aria-checked="false">
      <span class="chat-ask__mark" aria-hidden="true">${CHECK}</span>
      <span class="chat-ask__label">${label}</span>
    </button>`;
  }).join('');
  const legend = prompt ? ` aria-label="${escapeHtml(prompt)}"` : '';
  return `<div class="chat-ask__options" role="radiogroup"${legend}>${buttons}</div>`;
}

function inputHtml(spec) {
  const input = spec.input || {};
  const type = input.type === 'number' ? 'number' : 'text';
  const prompt = String(spec.prompt || '').trim();
  const placeholder = escapeHtml(input.placeholder || '');
  const label = escapeHtml(prompt || 'Antwort');
  let extra = '';
  if (type === 'number') {
    extra = ' step="1" inputmode="numeric"';
    if (input.min != null) extra += ` min="${Number(input.min)}"`;
    if (input.max != null) extra += ` max="${Number(input.max)}"`;
  }
  return `<form class="chat-ask__form">
    <input class="chat-ask__field" type="${type}"${extra} placeholder="${placeholder}" aria-label="${label}" autocomplete="off">
    <button type="submit" class="chat-ask__send" aria-label="Antworten">${SEND}</button>
  </form>`;
}

function countsHtml(spec) {
  const rows = Array.isArray(spec.rows) ? spec.rows : [];
  const max = countsMax(spec);
  const zeilen = rows.map((row) => {
    const id = escapeHtml(row?.id ?? '');
    const label = escapeHtml(row?.label ?? '');
    return `<label class="chat-ask__row">
      <span class="chat-ask__row-label">${label}</span>
      <input class="chat-ask__field chat-ask__field--count" type="number" min="0" max="${max}" step="1" inputmode="numeric" placeholder="0" data-row-id="${id}" aria-label="${label}" autocomplete="off">
    </label>`;
  }).join('');
  return `<form class="chat-ask__form chat-ask__form--counts">
    <div class="chat-ask__rows">${zeilen}</div>
    <div class="chat-ask__footer">
      <span class="chat-ask__sum" aria-live="polite">Zusammen 0 von ${max}</span>
      <button type="submit" class="chat-ask__send" aria-label="Antworten">${SEND}</button>
    </div>
  </form>`;
}

function cardHtml(spec) {
  const prompt = String(spec.prompt || '').trim();
  const promptHtml = prompt ? `<p class="chat-ask__prompt">${escapeHtml(prompt)}</p>` : '';
  let body;
  if (spec.kind === 'choice') body = choiceHtml(spec);
  else if (spec.kind === 'counts') body = countsHtml(spec);
  else body = inputHtml(spec);
  const hint = escapeHtml(defaultHint(spec));
  return `<div class="chat-ask__card">
    ${stepHtml(spec.step)}
    ${promptHtml}
    ${body}
  </div>
  <p class="chat-ask__hint">${hint}</p>`;
}

function readNumber(raw, { min, max }) {
  if (!/^\d+$/.test(raw)) return null;
  const n = Number(raw);
  if (!Number.isInteger(n)) return null;
  if (min != null && n < Number(min)) return null;
  if (max != null && n > Number(max)) return null;
  return n;
}

/**
 * Haengt eine offene Frage in den Feed.
 * @param {HTMLElement} feedEl
 * @param {{ kind: 'choice'|'input'|'counts', prompt?: string, options?: Array<{id: string, label: string}>, rows?: Array<{id: string, label: string}>, max?: number, input?: { type?: 'text'|'number', placeholder?: string, min?: number, max?: number }, step?: { current: number, total: number }, hint?: string }} spec
 * @param {{ onAnswer?: Function, setComposerEnabled?: Function }} [hooks]
 * @returns {{ destroy: Function, lock: Function }}
 */
export function mountInlineQuestion(feedEl, spec, { onAnswer, setComposerEnabled } = {}) {
  const noop = { destroy() {}, lock() {} };
  if (!feedEl || !spec) return noop;

  const root = document.createElement('div');
  root.className = 'chat-ask';
  root.dataset.kind = spec.kind === 'choice' || spec.kind === 'counts' ? spec.kind : 'input';
  root.innerHTML = cardHtml(spec);
  feedEl.appendChild(root);

  let answered = false;
  const ac = new AbortController();

  const releaseComposer = () => setComposerEnabled?.(true);

  const markAnswered = () => {
    answered = true;
    root.dataset.answered = 'true';
    root.querySelectorAll('button, input').forEach((el) => { el.disabled = true; });
    releaseComposer();
  };

  setComposerEnabled?.(false);

  const commit = (answer) => {
    if (answered) return;
    markAnswered();
    onAnswer?.(answer);
  };

  root.addEventListener('click', (e) => {
    if (answered || spec.kind !== 'choice') return;
    const btn = e.target.closest('[data-option-id]');
    if (!btn || !root.contains(btn)) return;
    e.preventDefault();
    btn.classList.add('is-selected');
    btn.setAttribute('aria-checked', 'true');
    const optionId = btn.dataset.optionId || '';
    const label = btn.querySelector('.chat-ask__label')?.textContent || '';
    commit({ kind: 'choice', optionId, label, text: label, value: optionId });
  }, { signal: ac.signal });

  const readCounts = () => {
    const max = countsMax(spec);
    const rows = Array.isArray(spec.rows) ? spec.rows : [];
    const fields = [...root.querySelectorAll('[data-row-id]')];
    const werte = [];
    let summe = 0;
    let gueltig = true;
    for (const field of fields) {
      const raw = String(field.value || '').trim();
      const n = raw === '' ? 0 : readNumber(raw, { min: 0, max });
      if (n == null) { gueltig = false; continue; }
      summe += n;
      const row = rows.find((r) => String(r?.id ?? '') === field.dataset.rowId);
      if (n > 0 && row) werte.push({ id: row.id, label: String(row.label ?? ''), anzahl: n });
    }
    return { werte, summe, max, ok: gueltig && summe >= 1 && summe <= max };
  };

  const refreshSum = () => {
    const sumEl = root.querySelector('.chat-ask__sum');
    if (!sumEl) return { ok: false };
    const state = readCounts();
    sumEl.textContent = `Zusammen ${state.summe} von ${state.max}`;
    sumEl.classList.toggle('is-invalid', state.summe > state.max);
    return state;
  };

  if (spec.kind === 'counts') {
    root.addEventListener('input', (e) => {
      if (e.target.closest?.('[data-row-id]')) refreshSum();
    }, { signal: ac.signal });
  }

  root.addEventListener('submit', (e) => {
    if (e.target !== root.querySelector('.chat-ask__form')) return;
    e.preventDefault();
    if (answered || spec.kind === 'choice') return;
    if (spec.kind === 'counts') {
      const state = refreshSum();
      if (!state.ok) return;
      commit({
        kind: 'counts',
        optionId: null,
        label: null,
        text: state.werte.map((w) => `${w.label} ${w.anzahl}`).join(', '),
        value: state.werte.map((w) => ({ id: w.id, anzahl: w.anzahl }))
      });
      return;
    }
    const field = root.querySelector('.chat-ask__field');
    const raw = String(field?.value || '').trim();
    const input = spec.input || {};
    if (input.type === 'number') {
      const n = readNumber(raw, input);
      if (n == null) return;
      commit({ kind: 'input', optionId: null, label: null, text: String(n), value: n });
      return;
    }
    if (!raw) return;
    commit({ kind: 'input', optionId: null, label: null, text: raw, value: raw });
  }, { signal: ac.signal });

  return {
    lock() {
      if (answered) return;
      markAnswered();
    },
    destroy() {
      ac.abort();
      const wasOpen = !answered;
      root.remove();
      if (wasOpen) releaseComposer();
    }
  };
}
