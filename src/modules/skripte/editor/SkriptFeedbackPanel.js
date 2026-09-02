// SkriptFeedbackPanel.js
// Controller der rechten Editor-Spalte: Kommentar-Threads laden, rendern,
// Events binden und per Realtime aktuell halten. Anders als der Liky-Chat
// laeuft das Panel auch fuer Kunden - sie markieren Text und kommentieren,
// nur die AI-Aktionen und der Erledigt-Haken bleiben intern.

import { skriptKommentarService } from '../SkriptKommentarService.js';
import {
  gruppiereThreads, threadHtml, neuerKommentarHtml, feedbackLeerHtml
} from './SkriptFeedbackRenderer.js';

export class SkriptFeedbackPanel {
  constructor(view) {
    this.view = view;
    this.channel = null;
    this.neueSelektion = null;
    // Erledigte Threads, die der User manuell wieder aufgeklappt hat
    this.aufgeklappt = new Set();
  }

  get kommentare() {
    return this.view.kommentare || [];
  }

  set kommentare(rows) {
    this.view.kommentare = rows;
  }

  async load(skriptId) {
    try {
      return await skriptKommentarService.loadKommentare(skriptId);
    } catch (err) {
      console.warn('Feedback konnte nicht geladen werden:', err.message);
      return [];
    }
  }

  // ------------------------------------------------------------------
  // Rendern
  // ------------------------------------------------------------------
  render() {
    const el = document.getElementById('ed-fb-log');
    if (!el) return;

    const vorherigerScroll = el.scrollTop;
    const threads = gruppiereThreads(this.kommentare);
    const kannAntworten = this.view.kannKommentieren;

    const threadsHtml = threads.map((t) => threadHtml(t, {
      kannErledigen: this.view.kannErledigen,
      kannAntworten,
      aufgeklappt: this.aufgeklappt.has(t.id)
    })).join('');

    const composer = this.neueSelektion && kannAntworten
      ? neuerKommentarHtml(this.neueSelektion)
      : '';

    el.innerHTML = threads.length || composer
      ? composer + threadsHtml
      : feedbackLeerHtml(kannAntworten);

    this.bindEvents(el);
    el.scrollTop = vorherigerScroll;
  }

  bindEvents(el) {
    el.querySelectorAll('[data-fb-action]').forEach((btn) => {
      btn.addEventListener('click', () => this.handleAction(btn.dataset.fbAction, btn.dataset.fbId));
    });
    // Enter sendet, Shift+Enter macht einen Zeilenumbruch - wie im Chat
    el.querySelectorAll('textarea').forEach((ta) => {
      ta.addEventListener('keydown', (e) => {
        if (e.key !== 'Enter' || e.shiftKey) return;
        e.preventDefault();
        const threadId = ta.dataset.fbReplyInput;
        if (threadId) this.handleAction('antworten', threadId);
        else if (ta.id === 'ed-fb-neu-input') this.handleAction('neu-senden');
      });
    });
  }

  handleAction(action, id) {
    if (action === 'erledigt') return this.toggleErledigt(id);
    if (action === 'aufklappen') return this.aufklappen(id);
    if (action === 'antworten') return this.sendAntwort(id);
    if (action === 'neu-senden') return this.sendNeuerKommentar();
    if (action === 'neu-abbrechen') return this.abbrechenNeuerKommentar();
    return undefined;
  }

  // ------------------------------------------------------------------
  // Neuer Thread aus einer Textmarkierung
  // ------------------------------------------------------------------
  /** @param {{ sektion: string, text: string, istVisuell: boolean }} selektion */
  startNeuerKommentar(selektion) {
    if (!this.view.kannKommentieren || !selektion) return;
    this.neueSelektion = { ...selektion };
    window.getSelection()?.removeAllRanges();
    this.render();

    const input = document.getElementById('ed-fb-neu-input');
    if (input) {
      input.focus();
      document.getElementById('ed-fb-log').scrollTop = 0;
    }
  }

  abbrechenNeuerKommentar() {
    this.neueSelektion = null;
    this.render();
  }

  async sendNeuerKommentar() {
    const input = document.getElementById('ed-fb-neu-input');
    const text = input?.value.trim();
    if (!text) return;
    const skriptId = this.view.skript?.id;
    if (!skriptId) return;

    const selektion = this.neueSelektion;
    input.disabled = true;
    try {
      const kommentar = await skriptKommentarService.createKommentar({
        skriptId,
        sektion: selektion?.sektion || 'gesamt',
        istVisuell: selektion?.istVisuell || false,
        selektionText: selektion?.text || null,
        inhalt: text
      });
      this.neueSelektion = null;
      this.upsert(kommentar);
      this.render();
    } catch (err) {
      input.disabled = false;
      window.toastSystem?.error(`Feedback konnte nicht gespeichert werden: ${err.message}`);
    }
  }

  // ------------------------------------------------------------------
  // Antworten und Erledigt
  // ------------------------------------------------------------------
  async sendAntwort(threadId) {
    const input = document.querySelector(`[data-fb-reply-input="${threadId}"]`);
    const text = input?.value.trim();
    if (!text) return;
    const skriptId = this.view.skript?.id;
    if (!skriptId) return;

    input.disabled = true;
    try {
      const antwort = await skriptKommentarService.createKommentar({
        skriptId,
        parentId: threadId,
        inhalt: text
      });
      this.upsert(antwort);
      this.render();
    } catch (err) {
      input.disabled = false;
      window.toastSystem?.error(`Antwort konnte nicht gespeichert werden: ${err.message}`);
    }
  }

  async toggleErledigt(threadId) {
    if (!this.view.kannErledigen) return;
    const thread = this.kommentare.find((k) => k.id === threadId);
    if (!thread) return;
    const neuErledigt = !thread.erledigt_at;

    // Optimistisch umschalten, damit der Haken sofort reagiert
    const vorher = thread.erledigt_at;
    thread.erledigt_at = neuErledigt ? new Date().toISOString() : null;
    if (neuErledigt) this.aufgeklappt.delete(threadId);
    this.render();

    try {
      await skriptKommentarService.setErledigt(threadId, neuErledigt);
    } catch (err) {
      thread.erledigt_at = vorher;
      this.render();
      window.toastSystem?.error(`Status konnte nicht gesetzt werden: ${err.message}`);
    }
  }

  aufklappen(threadId) {
    this.aufgeklappt.add(threadId);
    this.render();
  }

  // ------------------------------------------------------------------
  // Realtime
  // ------------------------------------------------------------------
  subscribe() {
    this.unsubscribe();
    const skriptId = this.view.skript?.id;
    if (!skriptId) return;
    this.channel = skriptKommentarService.subscribeToKommentare(
      skriptId,
      (row, eventType) => this.applyUpdate(row, eventType)
    );
  }

  unsubscribe() {
    if (!this.channel) return;
    window.supabase?.removeChannel(this.channel);
    this.channel = null;
  }

  /**
   * Realtime liefert nur die rohen Spalten, der Autor fehlt. Bei INSERT/UPDATE
   * wird die Zeile deshalb einmal mit Join nachgeladen - eigene Schreibvorgaenge
   * sind da schon im State und werden uebersprungen.
   */
  async applyUpdate(row, eventType) {
    if (!row?.id) return;

    if (eventType === 'DELETE') {
      this.kommentare = this.kommentare.filter((k) => k.id !== row.id);
      this.render();
      return;
    }

    const vorhanden = this.kommentare.find((k) => k.id === row.id);
    if (vorhanden && vorhanden.inhalt === row.inhalt
      && vorhanden.erledigt_at === row.erledigt_at) return;

    try {
      const voll = await skriptKommentarService.loadKommentar(row.id);
      if (!voll) return;
      this.upsert(voll);
      this.render();
    } catch (_) { /* naechstes Event oder Reload holt es nach */ }
  }

  upsert(kommentar) {
    const rows = [...this.kommentare];
    const idx = rows.findIndex((k) => k.id === kommentar.id);
    if (idx >= 0) rows[idx] = kommentar;
    else rows.push(kommentar);
    rows.sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
    this.kommentare = rows;
  }

  destroy() {
    this.unsubscribe();
    this.neueSelektion = null;
    this.aufgeklappt.clear();
  }
}
