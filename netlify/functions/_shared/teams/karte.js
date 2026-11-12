// _shared/teams/karte.js
// Adaptive Cards fuer Teams-Meldungen (ADR 0066). Der Workflow „Post to a channel when a
// webhook request is received“ erwartet { type: 'message', attachments: [...] } und rendert
// neuere Kartenversionen als 1.4 nicht verlaesslich.

const TEXT_MAX = 300;
const ZITAT_MAX = 120;

const sauber = (s) => String(s ?? '').replace(/\s+/g, ' ').trim();

function kuerzen(text, max) {
  const t = sauber(text);
  return t.length > max ? `${t.slice(0, max - 1).trimEnd()}…` : t;
}

function autorName(kommentar) {
  const name = sauber(kommentar?.author_name) || 'Unbekannt';
  if (kommentar?.author_benutzer_id || /\(Gast\)$/i.test(name)) return name;
  return `${name} (Gast)`;
}

function crmLink(basisUrl, { produktionId, briefingId, kooperationId, videoId, kampagneId }) {
  const basis = String(basisUrl || '').replace(/\/+$/, '');
  if (!basis) return '';
  if (produktionId) {
    const q = new URLSearchParams({ tab: 'videos', linie: briefingId || 'alle' });
    if (kooperationId) q.set('k', kooperationId);
    if (kooperationId && videoId) q.set('v', videoId);
    return `${basis}/produktion/${produktionId}?${q}`;
  }
  return kampagneId ? `${basis}/kampagne/${kampagneId}` : '';
}

/**
 * Was eine Meldung ueber einen Video-Kommentar nennt, aus der Zeile mit eingebettetem
 * Video, Kooperation, Produktion, Kampagne, Unternehmen und Marke.
 */
function kontextAus(kommentar, basisUrl) {
  const video = kommentar?.video || {};
  const koop = video.kooperation || {};
  const kampagne = koop.kampagne || {};
  const creator = [koop.creator?.vorname, koop.creator?.nachname].map(sauber).filter(Boolean).join(' ')
    || sauber(koop.name) || 'Creator';
  const nr = video.position != null ? ` – Video ${video.position}` : '';
  return {
    unternehmen: sauber(kampagne.unternehmen?.firmenname),
    marke: sauber(kampagne.marke?.markenname),
    kampagne: sauber(kampagne.eigener_name) || sauber(kampagne.kampagnenname),
    produktion: sauber(koop.produktion?.name),
    video: `${creator}${nr}`,
    videoId: video.id || kommentar?.video_id || null,
    runde: kommentar?.runde ?? null,
    link: crmLink(basisUrl, {
      produktionId: koop.produktion_id || koop.produktion?.id,
      briefingId: koop.briefing_id,
      kooperationId: koop.id,
      videoId: video.id || kommentar?.video_id,
      kampagneId: koop.kampagne_id || kampagne.id,
    }),
  };
}

function firma(k) {
  if (k.marke && k.marke !== k.unternehmen) return k.unternehmen ? `${k.unternehmen} · ${k.marke}` : k.marke;
  return k.unternehmen;
}

function kopf(titel, k) {
  const out = [{ type: 'TextBlock', text: titel, weight: 'Bolder', size: 'Medium', wrap: true }];
  const f = firma(k);
  if (f) out.push({ type: 'TextBlock', text: f, isSubtle: true, spacing: 'None', wrap: true });
  return out;
}

function fakten(k, extra = []) {
  const facts = [
    { title: 'Kampagne', value: k.kampagne },
    { title: 'Produktion', value: k.produktion },
    { title: 'Video', value: k.video },
    { title: 'Feedbackschleife', value: k.runde != null ? `v${k.runde}` : '' },
    ...extra,
  ].filter((f) => f.value);
  return { type: 'FactSet', facts };
}

function nachricht(body, link) {
  return {
    type: 'message',
    attachments: [{
      contentType: 'application/vnd.microsoft.card.adaptive',
      contentUrl: null,
      content: {
        $schema: 'http://adaptivecards.io/schemas/adaptive-card.json',
        type: 'AdaptiveCard',
        version: '1.4',
        msteams: { width: 'Full' },
        body,
        actions: link ? [{ type: 'Action.OpenUrl', title: 'Im CRM öffnen', url: link }] : [],
      },
    }],
  };
}

/** Meldung zu einem neuen Video-Kommentar der Kundenseite. */
function kommentarKarte(kommentar, basisUrl) {
  const k = kontextAus(kommentar, basisUrl);
  return nachricht([
    ...kopf('Neuer Kundenkommentar', k),
    fakten(k, [{ title: 'Von', value: autorName(kommentar) }]),
    { type: 'Container', style: 'emphasis', items: [{ type: 'TextBlock', text: kuerzen(kommentar?.text, TEXT_MAX), wrap: true }] },
  ], k.link);
}

/** Nachtrag: Kommentare desselben Videos wurden in einem Vorgang entfernt. */
function entferntKarte(kommentare, basisUrl) {
  const liste = (kommentare || []).filter(Boolean);
  const k = kontextAus(liste[0], basisUrl);
  if (liste.some((c) => c.runde !== k.runde)) k.runde = null;
  const titel = liste.length === 1 ? 'Kundenkommentar entfernt' : `${liste.length} Kundenkommentare entfernt`;
  return nachricht([
    ...kopf(titel, k),
    fakten(k),
    ...liste.map((c) => ({
      type: 'TextBlock', isSubtle: true, wrap: true, spacing: 'Small',
      text: `${autorName(c)}: „${kuerzen(c.text, ZITAT_MAX)}“`,
    })),
  ], k.link);
}

/** Probe von der Admin-Seite. */
function testKarte(kanalName) {
  return nachricht([
    { type: 'TextBlock', text: 'Testmeldung aus dem CRM', weight: 'Bolder', size: 'Medium', wrap: true },
    {
      type: 'TextBlock', wrap: true,
      text: `Der Teams-Kanal „${sauber(kanalName)}“ ist verbunden. Hier erscheinen neue Kundenkommentare aus dem Videos-Tab.`,
    },
  ], '');
}

module.exports = { TEXT_MAX, ZITAT_MAX, kuerzen, autorName, crmLink, kontextAus, kommentarKarte, entferntKarte, testKarte };
