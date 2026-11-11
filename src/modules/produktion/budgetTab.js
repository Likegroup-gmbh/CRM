// Budget-Tab der Produktion: Verbrauch und Noch frei der ganzen Produktion,
// ein Balken-Segment je Kooperation und die Aufteilung auf die Creator.
// Verbrauch = Video-Verkaufspreise netto plus Zusatzkosten der Kooperation,
// unabhängig von Vertrag-Status und Rechnungen.

import { budgetOrNull, ladeBudgetStand, roundMoney } from './produktionsbudget.js';
import { koopGehoertZurLinie } from './ProduktionService.js';
import { instagramProfilUrl, normalizeHandle } from '../creator/creatorProfil.js';
import { formatCompactNumber } from '../../core/format/compactNumber.js';
import { cancelCountTo, countTo, liveCountValue } from '../../core/animation/countTo.js';

export const BUDGET_KOOP_SELECT = `
  id, name, briefing_id, produktion_id, verkaufspreis_zusatzkosten,
  creator:creator_id(id, vorname, nachname, instagram, tiktok),
  kooperation_videos(verkaufspreis_netto),
  kooperation_tags(tag_id, kooperation_tag_typen(id, name))
`;

// Unter dieser Breite (Prozent des Balkens) bekommt ein Segment kein Label.
const LABEL_MIN_ANTEIL = 8;
// Runde Zwischenmarken, die näher am Ende liegen, würden das End-Label überdecken.
const TICK_MAX_POS = 80;
// Mindestabstand (Prozent) anderer Marken zur Budget-Marke bei Überschreitung.
const TICK_ABSTAND = 14;

const esc = (t) => window.validatorSystem?.sanitizeHtml(String(t ?? '')) || '';

function zahl(value) {
  const n = parseFloat(value);
  return Number.isFinite(n) ? n : 0;
}

function anteil(betrag, skala) {
  return skala > 0 ? (betrag / skala) * 100 : 0;
}

export function formatEuro(value) {
  const n = roundMoney(value);
  return new Intl.NumberFormat('de-DE', {
    style: 'currency',
    currency: 'EUR',
    minimumFractionDigits: Number.isInteger(n) ? 0 : 2,
    maximumFractionDigits: 2
  }).format(n);
}

function formatEuroKurz(value) {
  return `${formatCompactNumber(value).replace('K', 'k')} €`;
}

/** Betrag einer Kooperation: Videos (VK netto) plus Zusatzkosten (VK). */
export function koopBetrag(koop) {
  const videos = Array.isArray(koop?.kooperation_videos) ? koop.kooperation_videos : [];
  const honorar = roundMoney(videos.reduce((sum, v) => sum + zahl(v?.verkaufspreis_netto), 0));
  const zusatz = roundMoney(zahl(koop?.verkaufspreis_zusatzkosten));
  return { honorar, zusatz, betrag: roundMoney(honorar + zusatz), videos: videos.length };
}

/** Tags einer Kooperation als [{ id, name }], ohne Doppelte. */
export function koopTags(koop) {
  const rows = Array.isArray(koop?.kooperation_tags) ? koop.kooperation_tags : [];
  const tags = [];
  for (const row of rows) {
    const id = String(row?.tag_id ?? row?.kooperation_tag_typen?.id ?? '');
    const name = row?.kooperation_tag_typen?.name;
    if (id && name && !tags.some(t => t.id === id)) tags.push({ id, name });
  }
  return tags;
}

/** Alle Tags der Kooperationen als Dropdown-Optionen, nach Name sortiert. */
export function verfuegbareTags(koops) {
  const byId = new Map();
  for (const koop of koops || []) {
    for (const tag of koopTags(koop)) {
      if (!byId.has(tag.id)) byId.set(tag.id, tag.name);
    }
  }
  return [...byId]
    .map(([value, label]) => ({ value, label }))
    .sort((a, b) => a.label.localeCompare(b.label, 'de'));
}

/** Kooperationen mit mindestens einem der Tags. Leere Auswahl filtert nicht. */
export function filterKoopsNachTags(koops, tagIds) {
  const ids = new Set((tagIds || []).map(String));
  if (!ids.size) return koops || [];
  return (koops || []).filter(koop => koopTags(koop).some(tag => ids.has(tag.id)));
}

function creatorName(creator) {
  return `${creator?.vorname || ''} ${creator?.nachname || ''}`.trim();
}

function creatorKanal(creator) {
  const instagram = normalizeHandle(creator?.instagram);
  if (instagram) return { handle: instagram, plattform: 'Instagram' };
  const tiktok = normalizeHandle(creator?.tiktok);
  if (tiktok) return { handle: tiktok, plattform: 'TikTok' };
  return null;
}

function kanalProfilUrl(kanal) {
  if (!kanal?.handle) return '';
  if (kanal.plattform === 'TikTok') {
    const href = `https://www.tiktok.com/@${encodeURIComponent(kanal.handle)}`;
    return window.validatorSystem?.sanitizeUrl?.(href) || '';
  }
  return instagramProfilUrl(kanal.handle);
}

function kanalHtml(kanal) {
  const handle = `@${kanal.handle}`;
  const url = kanalProfilUrl(kanal);
  const name = url
    ? `<a class="budget-tab__kanal" href="${esc(url)}" target="_blank" rel="noopener noreferrer">${esc(handle)}</a>`
    : esc(handle);
  return `${name}${esc(` auf ${kanal.plattform}`)}`;
}

function creatorZeilen(posten, linieId) {
  const gruppen = new Map();
  for (const p of posten) {
    const creatorId = p.creator?.id || null;
    const key = creatorId ? `c:${creatorId}` : `k:${p.id}`;
    if (!gruppen.has(key)) {
      gruppen.set(key, {
        key,
        creatorId,
        name: creatorName(p.creator) || p.name,
        kanal: creatorId ? creatorKanal(p.creator) : null,
        betrag: 0,
        zusatz: 0,
        dieseLinie: 0,
        videos: 0,
        kooperationen: 0
      });
    }
    const g = gruppen.get(key);
    g.betrag += p.betrag;
    g.zusatz += p.zusatz;
    g.videos += p.videos;
    g.kooperationen += 1;
    if (p.dieseLinie) g.dieseLinie += p.betrag;
  }

  const zeilen = [...gruppen.values()].map(g => ({
    ...g,
    betrag: roundMoney(g.betrag),
    zusatz: roundMoney(g.zusatz),
    dieseLinie: roundMoney(g.dieseLinie)
  }));
  zeilen.sort((a, b) => (b.betrag - a.betrag) || a.name.localeCompare(b.name, 'de'));

  const max = zeilen[0]?.betrag || 0;
  return zeilen.map(z => ({
    ...z,
    anteil: anteil(z.betrag, max),
    linieAnteil: linieId ? anteil(z.dieseLinie, max) : 0
  }));
}

/**
 * Marken auf runden Werten (1, 2, 2,5, 5 × 10^n), dazu das Ende der Skala.
 * Liegt das Budget innerhalb der Skala (Überschreitung), bekommt es eine eigene
 * Marke und verdrängt die Nachbarn.
 */
export function skalaTicks(skala, budget = null) {
  if (!(skala > 0)) return [];
  const roh = skala / 4;
  const potenz = 10 ** Math.floor(Math.log10(roh));
  const schritt = [1, 2, 2.5, 5, 10].map(f => f * potenz).find(s => s >= roh * 0.75);
  const ticks = [];
  for (let wert = 0; (wert / skala) * 100 < TICK_MAX_POS; wert += schritt) {
    ticks.push({ pos: (wert / skala) * 100, wert });
  }
  ticks.push({ pos: 100, wert: roundMoney(skala) });
  if (!(budget > 0)) return ticks;

  const budgetPos = (budget / skala) * 100;
  if (budgetPos >= 100) {
    ticks[ticks.length - 1].budget = true;
    return ticks;
  }
  return [
    ...ticks.filter(t => t.pos === 0 || Math.abs(t.pos - budgetPos) >= TICK_ABSTAND),
    { pos: budgetPos, wert: roundMoney(budget), budget: true, decke: true }
  ].sort((a, b) => a.pos - b.pos);
}

/**
 * Reine Berechnung für den Budget-Tab.
 * @param {object} params
 * @param {Array} params.koops - Kooperationen der Produktion mit kooperation_videos
 * @param {number} [params.andereProduktionen] - Verbrauch der Produktionen, die denselben Topf teilen
 * @param {number|null} [params.decke] - Budget, null = keins hinterlegt
 * @param {string|null} [params.linieId] - hervorgehobene Linie, null = nichts hervorheben
 */
export function berechneBudgetTab({ koops = [], andereProduktionen = 0, decke = null, linieId = null } = {}) {
  const posten = (koops || []).map(koop => ({
    id: koop.id,
    name: koop.name || 'Kooperation',
    creator: koop.creator || null,
    dieseLinie: linieId ? koopGehoertZurLinie(koop, linieId) : false,
    ...koopBetrag(koop)
  }));

  const summe = (rows, key = 'betrag') => roundMoney(rows.reduce((sum, r) => sum + r[key], 0));
  const linienPosten = posten.filter(p => p.dieseLinie);

  const verbrauch = summe(posten);
  const zusatzkosten = summe(posten, 'zusatz');
  const andere = roundMoney(Math.max(0, zahl(andereProduktionen)));
  const belegt = roundMoney(verbrauch + andere);
  const hatDecke = decke != null && Number.isFinite(Number(decke));
  const budget = hatDecke ? roundMoney(decke) : null;
  // Negativ = Überschreitung, nicht klemmen (ADR 0007).
  const frei = hatDecke ? roundMoney(budget - belegt) : null;
  const prozent = hatDecke && budget > 0 ? Math.round((belegt / budget) * 100) : null;
  const skala = Math.max(budget || 0, belegt);

  const segmente = posten
    .filter(p => p.betrag > 0)
    .sort((a, b) => (Number(b.dieseLinie) - Number(a.dieseLinie)) || (b.betrag - a.betrag))
    .map(p => ({
      id: p.id,
      name: p.name,
      betrag: p.betrag,
      art: linieId ? (p.dieseLinie ? 'linie' : 'andere') : 'gesamt',
      anteil: anteil(p.betrag, skala)
    }));
  if (andere > 0) {
    segmente.push({
      id: 'andere-produktionen',
      name: 'Andere Produktionen',
      betrag: andere,
      art: 'produktionen',
      anteil: anteil(andere, skala)
    });
  }

  return {
    verbrauch,
    zusatzkosten,
    dieseLinie: linieId ? summe(linienPosten) : null,
    andereLinien: linieId ? roundMoney(verbrauch - summe(linienPosten)) : null,
    anzahl: {
      kooperationen: posten.length,
      dieseLinie: linienPosten.length,
      andereLinien: posten.length - linienPosten.length,
      videos: posten.reduce((sum, p) => sum + p.videos, 0)
    },
    andereProduktionen: andere,
    belegt,
    budget,
    frei,
    prozent,
    skala,
    segmente,
    freiAnteil: hatDecke && frei > 0 ? anteil(frei, skala) : 0,
    deckeMarke: hatDecke && belegt > budget ? anteil(budget, skala) : null,
    ticks: skalaTicks(skala, hatDecke ? budget : null),
    creators: creatorZeilen(posten, linieId)
  };
}

/**
 * Herkunft der Decke für die Überzeile.
 * @param {object|null} stand - Ergebnis von ladeBudgetStand
 * @param {*} eigenesBudget - produktion.budget
 */
export function budgetQuelle(stand, eigenesBudget) {
  if (!stand || stand.decke == null) {
    return { label: 'Kein Budget hinterlegt', hinweis: 'Weder Produktion noch Kampagne haben ein Budget. Gezeigt wird nur der Verbrauch.' };
  }
  if (stand.eigen && budgetOrNull(eigenesBudget) != null) return { label: 'Produktionsbudget', hinweis: '' };
  if (stand.eigen) {
    return { label: 'Kein Produktionsbudget', hinweis: 'Andere Produktionen dieser Kampagne haben ein eigenes Budget, diese nicht.' };
  }
  if (stand.quelle === 'volumen') return { label: 'Volumen der Kampagne', hinweis: '' };
  return { label: 'Creator-Budget der Kampagne', hinweis: '' };
}

/**
 * Lädt Decke und Kooperationen. Teilt die Produktion den Topf der Kampagne,
 * kommen die Kooperationen der anderen Produktionen als Summe mit.
 */
export async function ladeBudgetDaten(supabase, { produktionId, kampagneId }) {
  const stand = await ladeBudgetStand(supabase, produktionId);
  const geteilt = Boolean(stand && !stand.eigen && stand.decke != null && kampagneId);

  let query = supabase.from('kooperationen').select(BUDGET_KOOP_SELECT);
  query = geteilt
    ? query.eq('kampagne_id', kampagneId).not('produktion_id', 'is', null)
    : query.eq('produktion_id', produktionId);
  const { data, error } = await query;
  if (error) throw error;

  const rows = data || [];
  const koops = rows.filter(k => k.produktion_id === produktionId);
  const fremd = rows.filter(k => k.produktion_id && k.produktion_id !== produktionId);
  const andereProduktionen = roundMoney(fremd.reduce((sum, k) => sum + koopBetrag(k).betrag, 0));

  return { stand, koops, andereProduktionen };
}

/* ------------------------------------------------------------------ */
/* Rendering                                                           */
/* ------------------------------------------------------------------ */

function plural(n, eins, mehr) {
  return `${n} ${n === 1 ? eins : mehr}`;
}

// Zahl, die updateBudgetTab beim Filtern vom alten zum neuen Wert zählt.
// data-count ist der stabile Schlüssel, data-count-value der exakte Wert.
function zaehlAttrs(key, wert, format = 'euro') {
  return `data-count="${key}" data-count-value="${roundMoney(wert)}" data-count-format="${format}"`;
}

function renderStat({ key, art, label, wert, sub, negativ = false }) {
  return `
    <div class="budget-tab__stat">
      <div class="budget-tab__stat-label"><span class="budget-tab__swatch budget-tab__swatch--${art}"></span>${esc(label)}</div>
      <div class="budget-tab__stat-value${negativ ? ' budget-tab__stat-value--negativ' : ''}" ${zaehlAttrs(key, wert)}>${esc(formatEuro(wert))}</div>
      <div class="budget-tab__stat-sub" title="${esc(sub)}">${esc(sub)}</div>
    </div>`;
}

function renderStats(model, { linieName }) {
  const stats = [];
  if (model.dieseLinie != null) {
    stats.push(renderStat({
      key: 'linie',
      art: 'linie',
      label: 'Diese Linie',
      wert: model.dieseLinie,
      sub: [plural(model.anzahl.dieseLinie, 'Kooperation', 'Kooperationen'), linieName].filter(Boolean).join(' · ')
    }));
    stats.push(renderStat({
      key: 'andere',
      art: 'andere',
      label: 'Andere Linien',
      wert: model.andereLinien,
      sub: plural(model.anzahl.andereLinien, 'Kooperation', 'Kooperationen')
    }));
  } else {
    stats.push(renderStat({
      key: 'verbraucht',
      art: 'gesamt',
      label: 'Verbraucht',
      wert: model.verbrauch,
      sub: `${plural(model.anzahl.kooperationen, 'Kooperation', 'Kooperationen')} · ${plural(model.anzahl.videos, 'Video', 'Videos')}`
    }));
  }
  if (model.andereProduktionen > 0) {
    stats.push(renderStat({
      key: 'produktionen',
      art: 'produktionen',
      label: 'Andere Produktionen',
      wert: model.andereProduktionen,
      sub: 'teilen das Budget'
    }));
  }
  if (model.budget != null) {
    const ueber = model.frei < 0;
    // Ein Schlüssel für frei und überschritten: der Wert zählt weiter, nur Label und Farbe springen.
    stats.push(renderStat({
      key: 'status',
      art: ueber ? 'ueber' : 'frei',
      label: ueber ? 'Überschritten' : 'Noch frei',
      wert: ueber ? -model.frei : model.frei,
      sub: model.budget > 0
        ? (ueber ? `${model.prozent - 100} % über dem Budget` : `${Math.max(0, 100 - model.prozent)} % des Budgets`)
        : 'kein Budget für diese Produktion',
      negativ: ueber
    }));
  }
  return `<div class="budget-tab__stats">${stats.join('')}</div>`;
}

function renderBar(model) {
  if (!(model.skala > 0)) {
    return '<div class="budget-tab__bar budget-tab__bar--leer"><span class="budget-tab__bar-frei-label">Noch kein Verbrauch</span></div>';
  }
  // Am linken Rand wächst das Label nach rechts, am rechten nach links.
  const tipLage = (start, ende) => (ende < 30 ? ' budget-tab__segment-tip--start' : start > 70 ? ' budget-tab__segment-tip--end' : '');
  const tip = (name, wert, lage) => `
    <span class="budget-tab__segment-tip${lage}">
      ${name ? `<span class="budget-tab__segment-tip-name">${esc(name)}</span>` : ''}
      <span class="budget-tab__segment-tip-wert">${esc(wert)}</span>
    </span>`;
  let cursor = 0;
  const segmente = model.segmente.map(s => {
    const start = cursor;
    cursor += s.anteil;
    return `
    <div class="budget-tab__segment budget-tab__segment--${s.art}" style="width: ${s.anteil.toFixed(3)}%">
      ${s.anteil >= LABEL_MIN_ANTEIL ? `<span class="budget-tab__segment-label">${esc(formatEuroKurz(s.betrag))}</span>` : ''}
      ${tip(s.name, formatEuro(s.betrag), tipLage(start, cursor))}
    </div>`;
  }).join('');
  const frei = model.freiAnteil > 0
    ? `<div class="budget-tab__segment budget-tab__segment--frei" style="width: ${model.freiAnteil.toFixed(3)}%">
        ${model.freiAnteil >= LABEL_MIN_ANTEIL ? `<span class="budget-tab__bar-frei-label">${esc(formatEuro(model.frei))} frei</span>` : ''}
        ${tip('', `${formatEuro(model.frei)} frei`, tipLage(cursor, cursor + model.freiAnteil))}
      </div>`
    : '';
  const marke = model.deckeMarke != null
    ? `<div class="budget-tab__decke" style="left: ${model.deckeMarke.toFixed(3)}%" title="${esc(`Budget ${formatEuro(model.budget)}`)}"></div>`
    : '';
  const ticks = model.ticks.map(t => {
    const text = t.budget
      ? `${formatEuro(t.wert)} Budget`
      : new Intl.NumberFormat('de-DE', { maximumFractionDigits: 0 }).format(t.wert);
    const klasse = t.decke ? 'budget-tab__tick budget-tab__tick--decke' : 'budget-tab__tick';
    return `<span class="${klasse}" style="left: ${t.pos.toFixed(3)}%">${esc(text)}</span>`;
  }).join('');

  return `
    <div class="budget-tab__chart">
      <div class="budget-tab__bar">${segmente}${frei}</div>
      ${marke}
      <div class="budget-tab__scale">${ticks}</div>
    </div>`;
}

function renderCreatorZeile(z, hervorheben) {
  const name = z.creatorId
    ? `<a href="/creator/${esc(z.creatorId)}" class="table-link" data-table="creator" data-id="${esc(z.creatorId)}">${esc(z.name)}</a>`
    : esc(z.name);
  const kanal = z.kanal
    ? kanalHtml(z.kanal)
    : (z.creatorId ? '' : esc('Kooperation ohne Creator-Datensatz'));
  const details = [
    plural(z.videos, 'Video', 'Videos'),
    z.kooperationen > 1 ? plural(z.kooperationen, 'Kooperation', 'Kooperationen') : '',
    z.zusatz > 0 ? `${formatEuro(z.zusatz)} Zusatzkosten` : ''
  ].filter(Boolean).join(' · ');
  const linie = hervorheben && z.linieAnteil > 0
    ? `<div class="budget-tab__track-fill budget-tab__track-fill--linie" style="width: ${z.linieAnteil.toFixed(3)}%"></div>`
    : '';
  const rest = hervorheben ? z.anteil - z.linieAnteil : z.anteil;
  const restArt = hervorheben ? 'andere' : 'gesamt';

  return `
    <div class="budget-tab__creator">
      <div class="budget-tab__creator-name">
        <div class="budget-tab__creator-title">${name}</div>
        ${kanal ? `<div class="budget-tab__creator-sub">${kanal}</div>` : ''}
      </div>
      <div class="budget-tab__track">
        ${linie}
        ${rest > 0 ? `<div class="budget-tab__track-fill budget-tab__track-fill--${restArt}" style="width: ${rest.toFixed(3)}%"></div>` : ''}
      </div>
      <div class="budget-tab__creator-sum">
        <div class="budget-tab__creator-betrag">${esc(formatEuro(z.betrag))}</div>
        <div class="budget-tab__creator-sub">${esc(details)}</div>
      </div>
    </div>`;
}

function renderTagChips(tags) {
  if (!tags.length) return '';
  const chips = tags.map(t => `
    <span class="filter-chip" data-tag-id="${esc(t.value)}">
      <span class="filter-chip-label">${esc(t.label)}</span>
      <button type="button" class="filter-chip-remove" data-budget-tag-remove="${esc(t.value)}" aria-label="${esc(`Tag ${t.label} entfernen`)}">×</button>
    </span>`).join('');
  return `<div class="active-filters budget-tab__tags">${chips}</div>`;
}

/**
 * @param {object} daten - Ergebnis von ladeBudgetDaten
 * @param {object} opts
 * @param {string|null} opts.linieId - hervorgehobene Linie
 * @param {string} [opts.linieName]
 * @param {*} [opts.eigenesBudget] - produktion.budget
 * @param {string[]} [opts.tagIds] - nur Kooperationen mit einem dieser Tags zählen
 */
export function renderBudgetTab(daten, { linieId = null, linieName = '', eigenesBudget = null, tagIds = [] } = {}) {
  const { stand, koops = [], andereProduktionen = 0 } = daten || {};
  const aktiveTags = verfuegbareTags(koops).filter(t => (tagIds || []).includes(t.value));
  const model = berechneBudgetTab({
    koops: filterKoopsNachTags(koops, aktiveTags.map(t => t.value)),
    andereProduktionen,
    decke: stand?.decke ?? null,
    linieId
  });
  const quelle = budgetQuelle(stand, eigenesBudget);

  const belegt = `<strong ${zaehlAttrs('belegt', model.belegt)}>${esc(formatEuro(model.belegt))}</strong>`;
  const prozent = model.prozent != null
    ? ` (<span ${zaehlAttrs('prozent', model.prozent, 'prozent')}>${model.prozent}</span> %)`
    : '';
  const lead = model.budget != null
    ? `${belegt} von <strong>${esc(formatEuro(model.budget))}</strong> verbraucht${prozent}.`
    : `${belegt} verbraucht.`;
  const notizen = [
    model.zusatzkosten > 0 ? `Davon ${formatEuro(model.zusatzkosten)} Zusatzkosten.` : '',
    quelle.hinweis
  ].filter(Boolean);

  const creators = model.creators.length
    ? model.creators.map(z => renderCreatorZeile(z, Boolean(linieId))).join('')
    : '<p class="budget-tab__leer">Noch keine Kooperationen in dieser Produktion.</p>';

  return `
    <div class="budget-tab">
      <header class="budget-tab__head">
        <div class="budget-tab__head-row">
          <h3 class="budget-tab__title">Budget</h3>
          <div class="budget-tab__filter" data-budget-filter></div>
        </div>
        ${renderTagChips(aktiveTags)}
        <p class="budget-tab__lead">${lead}</p>
        ${notizen.map(n => `<p class="budget-tab__note">${esc(n)}</p>`).join('')}
      </header>
      ${renderStats(model, { linieName })}
      ${renderBar(model)}
      <section class="budget-tab__verteilung">
        <div class="budget-tab__section-head">
          <h4 class="budget-tab__section-title">Verteilung</h4>
          <p class="budget-tab__section-sub">Kosten je Creator.</p>
        </div>
        <div class="budget-tab__creators">${creators}</div>
      </section>
    </div>`;
}

// Im Lauf feste Nachkommastellen, sonst springt die Breite zwischen „1.000 €“ und „1.000,50 €“.
function euroImLauf(from, to) {
  const ganz = Number.isInteger(roundMoney(from)) && Number.isInteger(roundMoney(to));
  const fmt = new Intl.NumberFormat('de-DE', {
    style: 'currency',
    currency: 'EUR',
    minimumFractionDigits: ganz ? 0 : 2,
    maximumFractionDigits: ganz ? 0 : 2
  });
  return (v) => (v === to ? formatEuro(to) : fmt.format(ganz ? Math.round(v) : v));
}

function zaehlFormat(art, from, to) {
  if (art === 'prozent') return (v) => String(Math.round(v));
  return euroImLauf(from, to);
}

/**
 * Tab mit neuer Auswahl neu schreiben, ohne den Pane neu zu laden. Zahlen
 * mit data-count zählen vom angezeigten (oder gerade laufenden) Wert los.
 * @param {HTMLElement} root - Container, der .budget-tab enthält
 * @param {object} daten - Ergebnis von ladeBudgetDaten
 * @param {object} opts - wie renderBudgetTab
 */
export function updateBudgetTab(root, daten, opts = {}, { animate = true } = {}) {
  const alt = root?.querySelector('.budget-tab');
  if (!alt) return;

  const vorher = new Map();
  alt.querySelectorAll('[data-count]').forEach(el => {
    const live = liveCountValue(el);
    vorher.set(el.dataset.count, Number.isFinite(live) ? live : parseFloat(el.dataset.countValue));
    cancelCountTo(el);
  });

  const vorlage = document.createElement('template');
  vorlage.innerHTML = renderBudgetTab(daten, opts).trim();
  const neu = vorlage.content.firstElementChild;
  if (!neu) return;
  // Das Dropdown zieht mit um, sonst wären Auswahl, offenes Panel und Listener weg.
  const filter = alt.querySelector('[data-budget-filter]');
  const platz = neu.querySelector('[data-budget-filter]');
  if (filter && platz) platz.replaceWith(filter);
  alt.replaceWith(neu);
  if (!animate) return;

  neu.querySelectorAll('[data-count]').forEach(el => {
    const from = vorher.get(el.dataset.count);
    const to = parseFloat(el.dataset.countValue);
    if (!Number.isFinite(from) || !Number.isFinite(to) || from === to) return;
    countTo(el, to, { from, format: zaehlFormat(el.dataset.countFormat, from, to) });
  });
}
