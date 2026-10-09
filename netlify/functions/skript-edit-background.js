// Netlify Background Function: Skript-Editor (Chat-basierte Ueberarbeitung)
// Die pending Assistant-Message in skript_chat_messages IST der Job:
//   pending -> running -> vorschlag (mit vorschlag_text) | fertig (nur Antwort) | error
// Modellwahl: nur neue_geschichte auf edit_write mit Thinking.
// Alles andere edit_fast, ohne Thinking. Rueckfragen laufen woanders.
// Kontext + Prompt-Bau: _shared/skript-edit-prompt.js

const { callClaude, extractJson, MODELS } = require('./_shared/anthropic');
const { withSkriptHandler } = require('./_shared/skript-handler');
const { starteKiRequest } = require('./_shared/ki-log');
const { beansprucheNachricht, autorisiereSkript, istNachrichtAbgebrochen } = require('./_shared/skript-auftrag');
const { setThinking } = require('./_shared/thinking');
const { istMasterDokument } = require('./_shared/skript-creator-facing');
const { logPrompt } = require('./_shared/prompt-log');
const { karteAusReferenz } = require('./_shared/skript-referenz-karte');
const { stempelSekunden, pruefeSkript } = require('./_shared/skript-context/formatter');
const { filtereHookSperre, trifftGesprochenenHook, hookLagImAuftrag, mitHookHinweis } = require('./_shared/hook-sperre');
const {
  loadEditContext, buildEditPrompt, mapEditResult, stripToolXml, letzterZeitstempel, formatZeitstempel,
  ladeVisuellStil, brauchtVisualStil, resolveModusSlug, editParams, filtereFestgezogen, GRID_SEKTIONEN
} = require('./_shared/skript-edit-prompt');

// Tool-Call fuer strukturierte Antworten. Bei Schreib-Aktionen laeuft
// Extended Thinking - dann erlaubt Anthropic nur tool_choice 'auto'
// (callClaude degradiert selbst), deshalb bleibt extractJson als Fallback.
const EDIT_TOOL = {
  name: 'aenderung_abgeben',
  description: 'Gibt die Antwort an den User und optional einen Textvorschlag strukturiert ab.',
  input_schema: {
    type: 'object',
    properties: {
      antwort: { type: 'string', description: 'Kurze Erklaerung fuer den User (1-3 Saetze, Deutsch)' },
      sektion: { type: ['string', 'null'], description: 'Betroffene Sektion (hook/hauptteil/cta/titel oder ##-Slug) oder null' },
      vorschlag_text: { type: ['string', 'null'], description: 'Neuer Text oder null. Bei sektion=titel der neue Skript-Titel.' },
      titel: { type: ['string', 'null'], description: 'Neuer Skript-Titel, nur wenn der Titel sich aendern soll. Sonst null.' },
      festlegung: { type: ['string', 'null'], description: 'Dauerhafte Vorgabe aus der Anweisung, sonst null. Nicht der vorgeschlagene Wortlaut.' },
      festlegungen: {
        type: ['array', 'null'],
        description: 'Mehrere dauerhafte Vorgaben aus der Anweisung (z. B. Besetzung und Ort), je ein kurzer Satz. Sonst null.',
        items: { type: 'string' }
      },
      spalte: {
        type: ['string', 'null'],
        description: 'Nur freier Chat: gesprochen, visuell oder null. Welche Spalte vorschlag_text ersetzt.'
      },
      ganze_sektion: {
        type: 'boolean',
        description: 'Nur freier Chat: true = vorschlag_text ersetzt die ganze Zelle der Sektion, nicht nur die markierte Stelle.'
      },
      umfang: {
        type: ['string', 'null'],
        enum: ['alles', 'teil', 'markierung', 'keiner', null],
        description: 'Nur freier Chat: Umfang der Anweisung. alles, teil (benannte Sektion), markierung (nur markierte Stelle) oder keiner.'
      },
      umfang_sektion: {
        type: ['string', 'null'],
        description: 'Nur bei umfang=teil: hook, hauptteil oder cta. Sonst null.'
      },
      aenderungen: {
        type: ['array', 'null'],
        description: 'Nur freier Chat bei Umfang alles oder benannter Teil: ein Eintrag pro geaenderter Zelle.',
        items: {
          type: 'object',
          properties: {
            sektion: { type: 'string', description: 'hook, hauptteil, cta, hook_variante_1..3 oder titel' },
            spalte: { type: 'string', description: 'gesprochen oder visuell' },
            vorschlag_text: { type: 'string', description: 'Komplette neue Zelle' }
          },
          required: ['sektion', 'spalte', 'vorschlag_text']
        }
      }
    },
    required: ['antwort', 'sektion', 'vorschlag_text']
  }
};

// ---------------------------------------------------------------------------
// Handler
// ---------------------------------------------------------------------------
exports.handler = withSkriptHandler(async ({ supabase, user, payload }) => {
  const { messageId } = payload;
  if (!messageId) return { statusCode: 400, body: 'messageId fehlt' };

  const fail = async (msg) => {
    await supabase.from('skript_chat_messages')
      .update({ status: 'error', error_message: msg })
      .eq('id', messageId);
  };

  let ki = null;

  try {
    const { data: message } = await supabase.from('skript_chat_messages')
      .select('*').eq('id', messageId).single();
    if (!message) return { statusCode: 404, body: 'Message nicht gefunden' };
    if (message.rolle !== 'assistant') {
      return { statusCode: 409, body: 'Message ist kein Assistant-Job' };
    }
    // Service Role umgeht RLS - Scope des Aufrufers explizit pruefen
    if (!(await autorisiereSkript(supabase, user, message.skript_id))) {
      return { statusCode: 403, body: 'Kein Zugriff auf dieses Skript' };
    }

    // Atomarer Claim pending -> running: Netlify-Auto-Retry nach einem
    // Gateway-Fehler (502/503) oder ein doppelter Client-Invoke bekommt
    // null und no-opt, statt Claude zweimal auf dieselbe Message zu rufen
    const claimed = await beansprucheNachricht(supabase, messageId);
    if (!claimed) return { statusCode: 409, body: 'Message bereits claimed oder beendet' };

    // Frequenz-Limit pruefen + Protokoll-Zeile anlegen (Fehlermeldung
    // landet ueber den catch als error_message in der Chat-Message)
    ki = await starteKiRequest(supabase, { userId: user.id, feature: 'skript_editor' });

    const ctx = await loadEditContext(supabase, message);
    if (message.aktion === 'neue_geschichte') {
      const pk = ctx.skript.prompt_kontext || {};
      const video = pk.referenz_video || pk.generator_payload?.referenz_video;
      if (!pk.referenz_karte && video) {
        const karte = await karteAusReferenz(video);
        if (karte) {
          ctx.skript.prompt_kontext = { ...pk, referenz_karte: karte };
          await supabase.from('skripte').update({
            prompt_kontext: ctx.skript.prompt_kontext
          }).eq('id', ctx.skript.id);
        }
      }
    }
    if (ctx.kontext.masterVersionen?.length) {
      const bestehend = ctx.skript.prompt_kontext || {};
      await supabase.from('skripte').update({
        prompt_kontext: {
          ...bestehend,
          master_versionen: ctx.kontext.masterVersionen,
          bereich: ctx.skript.bereich || ctx.kontext.bereich || bestehend.bereich || null
        }
      }).eq('id', ctx.skript.id);
    }
    const { stable, task, messages } = buildEditPrompt(ctx, message);
    logPrompt({ job: 'skript_editor', id: message.skript_id, aktion: message.aktion, stable, task, messages });

    // Abbruch waehrend des Kontext-Ladens: kein Claude-Call mehr
    if (await istNachrichtAbgebrochen(supabase, messageId)) {
      return { statusCode: 200 };
    }

    const stark = message.aktion === 'neue_geschichte';

    await setThinking(supabase, 'skript_chat_messages', messageId, {
      step: 'schreiben',
      label: 'Ich formuliere den Vorschlag…'
    });

    const result = await callClaude({
      model: stark ? MODELS.edit_write : MODELS.edit_fast,
      systemBlocks: [{ text: stable, cache: true }],
      userPrompt: task,
      messages,
      maxTokens: stark ? 8192 : 4096,
      thinking: stark,
      thinkingBudget: stark ? 2048 : undefined,
      tool: EDIT_TOOL,
      // Konservativ: ein haengender Claude-Call soll nicht bis zum
      // Netlify-Limit blockieren, sondern als Chat-Fehler sichtbar werden
      timeoutMs: 480000
    });
    await ki.abschliessen(result);

    // Abbruch waehrend des Calls: Ergebnis verwerfen, Message bleibt cancelled
    if (await istNachrichtAbgebrochen(supabase, messageId)) {
      return { statusCode: 200 };
    }

    const parsed = result.json || extractJson(result.text, {
      keys: ['antwort', 'sektion', 'vorschlag_text', 'spalte', 'ganze_sektion', 'titel', 'festlegung', 'festlegungen', 'umfang', 'umfang_sektion', 'aenderungen']
    });
    let vorschlag = stripToolXml(parsed.vorschlag_text);
    const antwort = stripToolXml(parsed.antwort);
    const istMaster = istMasterDokument(ctx.skript);
    const parsedSektion = (parsed.sektion || '').trim() || null;
    const titelWunsch = stripToolXml(parsed.titel);
    let sektion = istMaster
      ? (parsedSektion || message.sektion)
      : (GRID_SEKTIONEN.includes(parsedSektion) || parsedSektion === 'titel'
        ? parsedSektion
        : message.sektion);
    if (titelWunsch && (sektion === 'titel' || !vorschlag)) {
      vorschlag = titelWunsch;
      sektion = 'titel';
    }
    const spalte = mapEditResult(message, parsed);
    const gezogen = Array.isArray(ctx.skript.festgezogen) ? ctx.skript.festgezogen : [];
    const getroffen = sektion === 'titel'
      ? 'titel'
      : (spalte.ist_visuell ? `${sektion}_visuell` : sektion);
    const ziel = message.ist_visuell || message.aktion === 'visuell'
      ? `${message.sektion}_visuell`
      : message.sektion;
    // Umfang vom Modell: alles oder der benannte Teil oeffnet Festgezogen
    const umfang = message.aktion === 'chat' ? (parsed.umfang || null) : null;
    const umfangSektion = String(parsed.umfang_sektion || '').trim().toLowerCase();
    const umfangOeffnet = umfang === 'alles' || (umfang === 'teil' && sektion === umfangSektion);
    if (gezogen.includes(getroffen) && getroffen !== ziel && !umfangOeffnet) vorschlag = null;

    // Hook-Sperre (ADR 0054): der gesprochene Hook bleibt in jedem Auftrag, auch bei Umfang alles.
    // Master-Dokumente haben keinen Grid-Hook.
    const hookGesperrt = istMaster ? null : ctx.gesperrterHook;
    let hookBetroffen = false;
    if (hookGesperrt) {
      hookBetroffen = hookLagImAuftrag({ message, umfang, umfangSektion });
      // Der Visual-Button (aktion visuell) schreibt immer die Spalte „Was zu sehen ist“
      if (vorschlag && trifftGesprochenenHook({
        sektion,
        ist_visuell: spalte.ist_visuell || message.aktion === 'visuell'
      })) {
        vorschlag = null;
        hookBetroffen = true;
      }
    }
    if (spalte.ist_visuell && vorschlag && !spalte.selektion_text && ['hook', 'hauptteil', 'cta'].includes(sektion)) {
      const visKey = `${sektion}_visuell`;
      const draft = {
        hook: ctx.skript.hook,
        hauptteil: ctx.skript.hauptteil,
        cta: ctx.skript.cta,
        hook_visuell: ctx.skript.hook_visuell,
        hauptteil_visuell: ctx.skript.hauptteil_visuell,
        cta_visuell: ctx.skript.cta_visuell
      };
      draft[visKey] = vorschlag;
      vorschlag = stempelSekunden(draft)[visKey] || vorschlag;
    }

    // Freier Chat mit Umfang: Liste der geaenderten Zellen. Jede wird wie
    // eine einzelne Zelle geprueft; die Visual-Zellen bekommen die Sekunden
    // aus dem gesamten Entwurf, nicht nur aus der eigenen Zelle.
    const aenderungenRoh = (message.aktion === 'chat' && Array.isArray(parsed.aenderungen))
      ? parsed.aenderungen
          .filter((a) => a && typeof a === 'object')
          .map((a) => ({
            sektion: String(a.sektion || '').trim(),
            spalte: a.spalte === 'visuell' ? 'visuell' : 'gesprochen',
            vorschlag_text: stripToolXml(a.vorschlag_text)
          }))
          .filter((a) => a.vorschlag_text && (GRID_SEKTIONEN.includes(a.sektion) || a.sektion === 'titel'))
      : null;
    // Festgezogene Zellen ausserhalb des Umfangs verwirft der Server
    let ausgelassen = 0;
    let aenderungen = aenderungenRoh;
    if (aenderungenRoh) {
      const ohneHook = filtereHookSperre(aenderungenRoh, hookGesperrt);
      if (ohneHook.verworfen.length) hookBetroffen = true;
      const gefiltert = filtereFestgezogen(ohneHook.behalten, gezogen, { umfang, umfang_sektion: umfangSektion });
      aenderungen = gefiltert.behalten;
      ausgelassen = gefiltert.verworfen.length;
    }
    if (aenderungen && aenderungen.length) {
      const draft = {
        hook: ctx.skript.hook,
        hauptteil: ctx.skript.hauptteil,
        cta: ctx.skript.cta,
        hook_visuell: ctx.skript.hook_visuell,
        hauptteil_visuell: ctx.skript.hauptteil_visuell,
        cta_visuell: ctx.skript.cta_visuell
      };
      for (const a of aenderungen) {
        const feld = a.sektion === 'titel' ? 'titel' : (a.spalte === 'visuell' ? `${a.sektion}_visuell` : a.sektion);
        if (feld !== 'titel') draft[feld] = a.vorschlag_text;
      }
      const gestempelt = stempelSekunden(draft);
      for (const a of aenderungen) {
        if (a.spalte === 'visuell' && ['hook', 'hauptteil', 'cta'].includes(a.sektion)) {
          a.vorschlag_text = gestempelt[`${a.sektion}_visuell`] || a.vorschlag_text;
        }
      }
      vorschlag = null;
      sektion = null;
    }

    const festlegungTexte = [
      stripToolXml(parsed.festlegung),
      ...(Array.isArray(parsed.festlegungen) ? parsed.festlegungen.map(stripToolXml) : [])
    ].filter(Boolean);
    if (festlegungTexte.length) {
      const liste = Array.isArray(ctx.skript.festlegungen) ? ctx.skript.festlegungen.slice() : [];
      let neu = false;
      for (const text of festlegungTexte) {
        if (liste.some((f) => (typeof f === 'string' ? f : f?.text) === text)) continue;
        liste.push({ text, quelle: 'anweisung' });
        neu = true;
      }
      if (neu) await supabase.from('skripte').update({ festlegungen: liste }).eq('id', ctx.skript.id);
    }
    if (message.aktion === 'neue_geschichte' && vorschlag && ['hook', 'hauptteil', 'cta'].includes(sektion) && !spalte.ist_visuell) {
      const felder = {
        hook: ctx.skript.hook,
        hauptteil: ctx.skript.hauptteil,
        cta: ctx.skript.cta,
        [sektion]: vorschlag
      };
      await supabase.from('skripte').update({
        pruefung: pruefeSkript(felder, {
          video_laenge: ctx.skript.video_laenge,
          verbotene_claims: ctx.kontext?.produkt?.verbotene_claims
        })
      }).eq('id', ctx.skript.id);
    }

    await setThinking(supabase, 'skript_chat_messages', messageId, {
      step: 'speichern',
      label: 'Ich speichere die Antwort…'
    });

    // Hook-Sperre: der Mitarbeiter erfaehrt immer, dass der gesprochene Hook geblieben ist
    const antwortMitHinweis = mitHookHinweis(antwort, hookBetroffen);

    await supabase.from('skript_chat_messages').update({
      status: (aenderungen && aenderungen.length) || (vorschlag && sektion && sektion !== 'gesamt') ? 'vorschlag' : 'fertig',
      inhalt: ausgelassen
        ? [antwortMitHinweis, `${ausgelassen} festgezogene ${ausgelassen === 1 ? 'Zelle' : 'Zellen'} ausgelassen (nicht im Umfang).`].filter(Boolean).join(' ')
        : antwortMitHinweis,
      vorschlag_text: vorschlag,
      aenderungen: aenderungen && aenderungen.length ? aenderungen : null,
      sektion: (aenderungen && aenderungen.length) ? 'gesamt' : (sektion || message.sektion),
      ist_visuell: sektion === 'titel' ? false : spalte.ist_visuell,
      selektion_text: sektion === 'titel' ? null : spalte.selektion_text,
      model: result.model,
      usage: result.usage
    }).eq('id', messageId);

    return { statusCode: 200 };
  } catch (error) {
    console.error(`[skript-edit ${messageId}] Fehler:`, error.message);
    if (ki) await ki.fehlgeschlagen(error);
    try { await fail(error.message); } catch (_) { /* noop */ }
    return { statusCode: 500 };
  }
});

// Re-Exports fuer die Tests (SkriptEditPrompt.test.js importiert von hier)
exports.buildEditPrompt = buildEditPrompt;
exports.mapEditResult = mapEditResult;
exports.stripToolXml = stripToolXml;
exports.letzterZeitstempel = letzterZeitstempel;
exports.formatZeitstempel = formatZeitstempel;
exports.ladeVisuellStil = ladeVisuellStil;
exports.brauchtVisualStil = brauchtVisualStil;
exports.resolveModusSlug = resolveModusSlug;
exports.editParams = editParams;
