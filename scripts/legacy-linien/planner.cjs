'use strict';
/**
 * Planer fuer die Altbestand-Linien-Migration (reine Funktionen, keine DB).
 *
 * Eingabe ist der Ist-Zustand einer Kampagne (siehe planKampagne), Ausgabe ein Plan:
 * Produktionen (vorhanden, umbenannt, neu), Altbestand-Linien, Zuordnung von
 * Kooperationen, Skripten und Vertraegen. Der Executor in
 * scripts/legacy-linien-migration.js setzt den Plan um.
 *
 * Regeln: siehe docs/adr/0058-altbestand-wird-linie-ohne-briefing.md.
 */

const MONAT = '(?:januar|februar|maerz|april|mai|juni|juli|august|september|oktober|november|dezember)';
const ZEIT_TAG_RE = new RegExp(
  `^(?:20\\d\\d|${MONAT}(?: 20\\d\\d)?|q[1-4](?: 20\\d\\d)?|\\d{1,2}\\.\\d{1,2}\\.?(?:\\d{2,4})?)$`
);

const GEDANKENSTRICH = ' – ';

function norm(value) {
  return String(value ?? '')
    .toLowerCase()
    .replace(/ä/g, 'ae')
    .replace(/ö/g, 'oe')
    .replace(/ü/g, 'ue')
    .replace(/ß/g, 'ss')
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[\u2010-\u2015]/g, '-')
    .replace(/\s+/g, ' ')
    .trim();
}

function escapeRegExp(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** Zeit-Tags (2026, Oktober, 30.10., Q3) bilden nie eine Produktion. */
function istZeitTag(tag) {
  return ZEIT_TAG_RE.test(norm(tag));
}

/** Begriff steht als eigenes Wort im Text ("Kampagne 1" passt nicht in "Kampagne 10"). */
function enthaeltBegriff(text, begriff) {
  const t = norm(text);
  const b = norm(begriff);
  if (!b || !t) return false;
  return new RegExp(`(?:^|[^a-z0-9])${escapeRegExp(b)}(?:$|[^a-z0-9])`).test(t);
}

/** Alter Casting-/Konzept-Name ohne Projekt-Praefix und ohne "Casting"/"Konzept"-Suffix. */
function altTitel(name, projekt) {
  const original = String(name ?? '').trim();
  let titel = original;
  const p = String(projekt ?? '').trim();
  if (p) {
    const rest = titel.replace(new RegExp(`^${escapeRegExp(p)}\\s*[-–—:|/]*\\s*`, 'i'), '').trim();
    if (rest && rest.length < titel.length) titel = rest;
  }
  const ohneSuffix = titel
    .replace(/\s*[-–—:]?\s*(?:casting(?:liste)?|konzepte?|creator ?liste)\s*$/i, '')
    .trim();
  if (ohneSuffix) titel = ohneSuffix;
  return titel || original;
}

/** Ab dem Gruppen-Tag im Namen ("EDEKA SW Kampagne 9 Konzept" -> "Kampagne 9"), sonst altTitel. */
function titelFuerGruppe(name, projekt, gruppenName) {
  const original = String(name ?? '');
  if (gruppenName && enthaeltBegriff(original, gruppenName)) {
    const index = original.toLowerCase().indexOf(String(gruppenName).trim().toLowerCase());
    if (index >= 0) return altTitel(original.slice(index), '');
  }
  return altTitel(original, projekt);
}

function bereichAusListeTyp(listeTyp, artDerKampagne) {
  if (listeTyp === 'influencer') return 'influencer_marketing';
  if (listeTyp === 'ugc' || listeTyp === 'mix') return 'paid_creator_ads';
  const art = (Array.isArray(artDerKampagne) ? artDerKampagne : [artDerKampagne]).map(norm).join(' ');
  if (art.includes('influencer')) return 'influencer_marketing';
  return 'paid_creator_ads';
}

function byCreated(a, b) {
  return String(a.created_at || '').localeCompare(String(b.created_at || '')) || String(a.id).localeCompare(String(b.id));
}

function groupBy(list, key) {
  const map = new Map();
  for (const item of list) {
    const k = item[key];
    if (k == null) continue;
    if (!map.has(k)) map.set(k, []);
    map.get(k).push(item);
  }
  return map;
}

function inhaltsTags(koop) {
  const seen = new Map();
  for (const tag of koop.tags || []) {
    const key = norm(tag);
    if (!key || istZeitTag(tag) || seen.has(key)) continue;
    seen.set(key, String(tag).trim());
  }
  return [...seen.entries()].map(([key, name]) => ({ key, name }));
}

function summe(list, feld) {
  return list.reduce((acc, row) => acc + (parseFloat(row?.[feld]) || 0), 0);
}

/**
 * Plant eine Kampagne.
 *
 * ctx: {
 *   kampagne: { id, kampagnenname, eigener_name, art_der_kampagne, creator_budget, volumen,
 *               auftrag: { creator_budget, nettobetrag } },
 *   produktionen: [{ id, name, budget, created_at }],
 *   briefings: [{ id, produktion_id, ist_altbestand, is_draft }],
 *   castings: [{ id, name, briefing_id, produktion_id, strategie_id, liste_typ, created_at }],
 *   konzepte: [{ id, name, briefing_id, produktion_id, creator_auswahl_id, created_at }],
 *   castingItems: [{ creator_auswahl_id, creator_id }],
 *   strategieItems: [{ id, strategie_id }],
 *   koops: [{ id, creator_id, briefing_id, produktion_id, tags: [string], created_at }],
 *   videos: [{ kooperation_id, strategie_item_id, skript_id, verkaufspreis_netto }],
 *   skripte: [{ id, briefing_id, produktion_id, strategie_item_id }],
 *   vertraege: [{ id, typ, kooperation_id, kampagne_id, produktion_id }],
 *   vertragKoops: [{ vertrag_id, kooperation_id, created_at }],
 * }
 */
function planKampagne(ctx) {
  const kampagne = ctx.kampagne;
  const projekt = String(kampagne.eigener_name || kampagne.kampagnenname || 'Kampagne').trim();
  const produktionen = [...(ctx.produktionen || [])].sort(byCreated);
  const briefings = ctx.briefings || [];
  const briefingsNachProduktion = groupBy(briefings, 'produktion_id');
  const budgetModus = produktionen.some(p => p.budget != null);
  const hatEchteLinien = briefings.some(b => !b.ist_altbestand);
  const gruende = [];
  const warnungen = [];
  const addGrund = grund => { if (!gruende.includes(grund)) gruende.push(grund); };

  const koops = ctx.koops || [];
  const legacy = {
    koops: koops.filter(x => !x.briefing_id),
    castings: (ctx.castings || []).filter(x => !x.briefing_id),
    konzepte: (ctx.konzepte || []).filter(x => !x.briefing_id),
    skripte: (ctx.skripte || []).filter(x => !x.briefing_id),
  };

  const plan = {
    kampagneId: kampagne.id,
    name: projekt,
    status: 'noop',
    gruende,
    warnungen,
    produktionen: [],
    linien: [],
    koopZuordnung: [],
    skriptZuordnung: [],
    vertragZuordnung: [],
    castingZuordnung: [],
    konzeptZuordnung: [],
    koopsOhneProduktion: [],
    stats: {},
  };

  if (!legacy.koops.length && !legacy.castings.length && !legacy.konzepte.length && !legacy.skripte.length) {
    return plan;
  }

  const allNamen = [...(ctx.castings || []), ...(ctx.konzepte || [])].map(x => x.name);

  // ---------------------------------------------------------------- Gruppen
  const gruppen = new Map(); // key -> { key, name, produktionId|null, koopIds, castingIds, konzeptIds, skriptIds }
  function gruppe(key, name, produktionId = null) {
    if (!gruppen.has(key)) {
      gruppen.set(key, { key, name, produktionId, koopIds: [], castingIds: [], konzeptIds: [], skriptIds: [] });
    }
    return gruppen.get(key);
  }
  const koopRegel = new Map();

  if (budgetModus) {
    addGrund('budgetiert');
    for (const koop of legacy.koops) {
      const p = produktionen.find(x => x.id === koop.produktion_id);
      if (!p) { plan.koopsOhneProduktion.push(koop.id); continue; }
      gruppe(`p:${p.id}`, p.name, p.id).koopIds.push(koop.id);
      koopRegel.set(koop.id, 'budget_bleibt');
    }
    if (plan.koopsOhneProduktion.length) {
      warnungen.push(`${plan.koopsOhneProduktion.length} Kooperationen ohne Produktion bleiben unangetastet (Produktionsbudget)`);
    }
  } else {
    const tagGroesse = new Map();
    for (const koop of legacy.koops) {
      for (const t of inhaltsTags(koop)) tagGroesse.set(t.key, (tagGroesse.get(t.key) || 0) + 1);
    }
    for (const koop of legacy.koops) {
      const tags = inhaltsTags(koop);
      let gewaehlt = null;
      let regel = 'tag';
      if (tags.length === 0) {
        regel = 'kein_tag';
      } else if (tags.length === 1) {
        gewaehlt = tags[0];
      } else {
        const imNamen = tags.filter(t => allNamen.some(n => enthaeltBegriff(n, t.name)));
        if (imNamen.length === 1) {
          gewaehlt = imNamen[0];
          regel = 'tag_im_namen';
        } else {
          const kandidaten = (imNamen.length ? imNamen : tags)
            .sort((a, b) => (tagGroesse.get(b.key) - tagGroesse.get(a.key)) || a.key.localeCompare(b.key));
          gewaehlt = kandidaten[0];
          regel = 'tag_groesste';
          if (kandidaten.length > 1 && tagGroesse.get(kandidaten[0].key) === tagGroesse.get(kandidaten[1].key)) {
            addGrund('tag_konflikt');
          }
        }
      }
      if (gewaehlt) gruppe(gewaehlt.key, gewaehlt.name).koopIds.push(koop.id);
      else gruppe('rest', 'Altbestand').koopIds.push(koop.id);
      koopRegel.set(koop.id, regel);
    }
  }

  const tagGruppen = [...gruppen.values()].filter(g => g.key !== 'rest');
  if (!budgetModus && tagGruppen.length >= 2) addGrund('mehrere_gruppen');

  // ------------------------------------------- Casting/Konzept auf Gruppen
  // Budget-Modus legt nie eine Produktion an: ohne Treffer gilt die aelteste vorhandene.
  function budgetStandardGruppe() {
    const meiste = [...gruppen.values()].sort((a, b) => b.koopIds.length - a.koopIds.length)[0];
    if (meiste) return meiste;
    const erste = produktionen[0];
    return erste ? gruppe(`p:${erste.id}`, erste.name, erste.id) : null;
  }

  function fallbackSchluessel() {
    if (budgetModus) return budgetStandardGruppe()?.key || null;
    if (tagGruppen.length === 0) return 'rest';
    if (tagGruppen.length === 1) {
      const rest = gruppen.get('rest');
      return (rest?.koopIds.length || 0) > tagGruppen[0].koopIds.length ? 'rest' : tagGruppen[0].key;
    }
    return 'rest';
  }

  function schluesselFuerName(name) {
    const treffer = tagGruppen
      .filter(g => enthaeltBegriff(name, g.name))
      .sort((a, b) => norm(b.name).length - norm(a.name).length);
    return treffer.length ? treffer[0].key : null;
  }

  const castingNachId = new Map((ctx.castings || []).map(c => [c.id, c]));
  const konzeptNachId = new Map((ctx.konzepte || []).map(k => [k.id, k]));
  const gruppeVonCasting = new Map();
  const gruppeVonKonzept = new Map();
  const bestehendeBriefingVonCasting = new Map();
  const bestehendeBriefingVonKonzept = new Map();

  function sicherGruppe(key) {
    if (!key) key = fallbackSchluessel() || 'rest';
    if (!gruppen.has(key)) gruppe(key, key === 'rest' ? 'Altbestand' : key);
    return gruppen.get(key);
  }

  const verarbeiteteKonzepte = new Set();
  for (const casting of legacy.castings) {
    const verknuepft = casting.strategie_id ? konzeptNachId.get(casting.strategie_id) : null;
    if (verknuepft && verknuepft.briefing_id) {
      bestehendeBriefingVonCasting.set(casting.id, { briefingId: verknuepft.briefing_id, produktionId: verknuepft.produktion_id });
      continue;
    }
    let key = schluesselFuerName(casting.name);
    if (verknuepft && !verknuepft.briefing_id) {
      const keyKonzept = schluesselFuerName(verknuepft.name);
      if (key && keyKonzept && key !== keyKonzept) addGrund('paar_gruppen_widerspruch');
      if (!key) key = keyKonzept;
      verarbeiteteKonzepte.add(verknuepft.id);
      const g = sicherGruppe(key);
      g.konzeptIds.push(verknuepft.id);
      gruppeVonKonzept.set(verknuepft.id, g.key);
    }
    const g = sicherGruppe(key);
    g.castingIds.push(casting.id);
    gruppeVonCasting.set(casting.id, g.key);
  }
  for (const konzept of legacy.konzepte) {
    if (verarbeiteteKonzepte.has(konzept.id)) continue;
    const verknuepft = konzept.creator_auswahl_id ? castingNachId.get(konzept.creator_auswahl_id) : null;
    if (verknuepft && verknuepft.briefing_id) {
      bestehendeBriefingVonKonzept.set(konzept.id, { briefingId: verknuepft.briefing_id, produktionId: verknuepft.produktion_id });
      continue;
    }
    const key = schluesselFuerName(konzept.name);
    const g = sicherGruppe(key);
    g.konzeptIds.push(konzept.id);
    gruppeVonKonzept.set(konzept.id, g.key);
  }

  // Skripte mit Konzept-Bezug folgen dem Konzept; der Rest haengt sich spaeter an eine Linie.
  const strategieItemKonzept = new Map((ctx.strategieItems || []).map(i => [i.id, i.strategie_id]));

  // Ziele (Produktionen) = Gruppen mit Inhalt
  const ziele = [...gruppen.values()]
    .filter(g => g.koopIds.length || g.castingIds.length || g.konzeptIds.length)
    .sort((a, b) =>
      (b.koopIds.length - a.koopIds.length) ||
      ((b.castingIds.length + b.konzeptIds.length) - (a.castingIds.length + a.konzeptIds.length)) ||
      a.name.localeCompare(b.name));

  if (!ziele.length && legacy.skripte.length) {
    const standard = budgetModus ? budgetStandardGruppe() : sicherGruppe('rest');
    if (standard) ziele.push(standard);
  }

  // ------------------------------------------------------ Produktionen
  const belegt = new Set();
  const huelle = produktionen.find(p => !(briefingsNachProduktion.get(p.id) || []).length);
  let huelleVergeben = false;

  function zielName(g) {
    return g.key === 'rest' ? `${projekt}${GEDANKENSTRICH}Altbestand` : `${projekt}${GEDANKENSTRICH}${g.name}`;
  }

  for (const g of ziele) {
    const ziel = {
      key: g.key,
      gruppe: g,
      id: null,
      name: null,
      neu: false,
      umbenennen: false,
      altName: null,
    };
    if (g.produktionId) {
      const p = produktionen.find(x => x.id === g.produktionId);
      ziel.id = p.id;
      ziel.name = p.name;
    } else {
      const gleichnamig = produktionen.find(p => !belegt.has(p.id) && norm(p.name) === norm(zielName(g)));
      const altbestandProduktionen = produktionen.filter(p =>
        !belegt.has(p.id) &&
        (briefingsNachProduktion.get(p.id) || []).length &&
        (briefingsNachProduktion.get(p.id) || []).every(b => b.ist_altbestand));
      let gefunden = gleichnamig || null;
      if (!gefunden && ziele.length === 1 && altbestandProduktionen.length === 1) gefunden = altbestandProduktionen[0];
      if (!gefunden && huelle && !huelleVergeben && !belegt.has(huelle.id)) {
        gefunden = huelle;
        huelleVergeben = true;
        if (ziele.length >= 2 && norm(huelle.name) !== norm(zielName(g))) {
          ziel.umbenennen = true;
          ziel.altName = huelle.name;
          ziel.name = zielName(g);
        }
      }
      if (gefunden) {
        ziel.id = gefunden.id;
        ziel.name = ziel.name || gefunden.name;
        belegt.add(gefunden.id);
      } else {
        ziel.neu = true;
        ziel.name = ziele.length === 1 && g.key === 'rest' && !hatEchteLinien ? projekt : zielName(g);
      }
    }
    ziel.ref = ziel.id || `neu:${g.key}`;
    plan.produktionen.push(ziel);
  }
  const zielNachKey = new Map(plan.produktionen.map(z => [z.key, z]));

  // ------------------------------------------------------------- Linien
  const castingItemsNachListe = groupBy(ctx.castingItems || [], 'creator_auswahl_id');
  const linienNachKey = new Map();
  const liniePerBriefingId = new Map();

  function neueLinie(ziel, daten) {
    const linie = {
      key: `${ziel.key}#${plan.linien.filter(l => l.zielKey === ziel.key).length + 1}`,
      zielKey: ziel.key,
      produktionRef: ziel.ref,
      briefingId: daten.briefingId || null,
      bestehend: Boolean(daten.briefingId),
      titel: daten.titel,
      bereich: daten.bereich || bereichAusListeTyp(null, kampagne.art_der_kampagne),
      castingIds: daten.castingIds || [],
      konzeptId: daten.konzeptId || null,
      neuCasting: Boolean(daten.neuCasting),
      neuKonzept: Boolean(daten.neuKonzept),
      verknuepfen: false,
    };
    plan.linien.push(linie);
    linienNachKey.set(linie.key, linie);
    if (linie.briefingId) liniePerBriefingId.set(linie.briefingId, linie);
    return linie;
  }

  const castingLegacyNachId = new Map(legacy.castings.map(c => [c.id, c]));
  const konzeptLegacyNachId = new Map(legacy.konzepte.map(k => [k.id, k]));

  for (const ziel of plan.produktionen) {
    const g = ziel.gruppe;
    // bereits vorhandene Altbestand-Linien dieser Produktion (Delta-Lauf)
    if (ziel.id) {
      for (const b of (briefingsNachProduktion.get(ziel.id) || []).filter(x => x.ist_altbestand)) {
        const castingIds = (ctx.castings || []).filter(c => c.briefing_id === b.id).map(c => c.id);
        const konzept = (ctx.konzepte || []).find(k => k.briefing_id === b.id);
        neueLinie(ziel, {
          briefingId: b.id,
          titel: b.aktivierung_name || ziel.name,
          castingIds: [],
          konzeptId: konzept?.id || null,
          bereich: b.bereich,
          _vorhanden: castingIds,
        });
      }
    }

    const konzepte = g.konzeptIds.map(id => konzeptLegacyNachId.get(id)).filter(Boolean).sort(byCreated);
    const castings = g.castingIds.map(id => castingLegacyNachId.get(id)).filter(Boolean).sort(byCreated);
    const gebundeneCastings = new Set();

    const neueLinienDieserRunde = [];
    for (const konzept of konzepte) {
      const verknuepft = castings.find(c => c.strategie_id === konzept.id || konzept.creator_auswahl_id === c.id);
      if (verknuepft) gebundeneCastings.add(verknuepft.id);
      const linie = neueLinie(ziel, {
        titel: titelFuerGruppe(konzept.name, projekt, g.key === 'rest' ? '' : g.name),
        konzeptId: konzept.id,
        castingIds: verknuepft ? [verknuepft.id] : [],
      });
      linie._konzept = konzept;
      neueLinienDieserRunde.push(linie);
    }
    const freieCastings = castings.filter(c => !gebundeneCastings.has(c.id));
    // Frei stehende Castings: zuerst gleicher Name wie ein Konzept ohne Casting, dann der Reihe nach.
    const ohneCasting = neueLinienDieserRunde.filter(l => !l.castingIds.length);
    const uebrig = [];
    for (const casting of freieCastings) {
      const passend = ohneCasting.find(l => !l.castingIds.length && norm(l._konzept.name) === norm(casting.name));
      if (passend) passend.castingIds.push(casting.id);
      else uebrig.push(casting);
    }
    for (const casting of uebrig) {
      const naechste = ohneCasting.find(l => !l.castingIds.length);
      if (naechste) naechste.castingIds.push(casting.id);
      else if (neueLinienDieserRunde.length) neueLinienDieserRunde[neueLinienDieserRunde.length - 1].castingIds.push(casting.id);
      else {
        const linie = neueLinie(ziel, { titel: titelFuerGruppe(casting.name, projekt, g.key === 'rest' ? '' : g.name), castingIds: [casting.id], neuKonzept: true });
        neueLinienDieserRunde.push(linie);
      }
    }
    for (const linie of neueLinienDieserRunde) {
      if (!linie.castingIds.length) linie.neuCasting = true;
      if (!linie.konzeptId) linie.neuKonzept = true;
      const erstes = castingNachId.get(linie.castingIds[0]);
      linie.bereich = bereichAusListeTyp(erstes?.liste_typ, kampagne.art_der_kampagne);
      const konzept = linie.konzeptId ? konzeptNachId.get(linie.konzeptId) : null;
      linie.verknuepfen = Boolean(
        erstes && konzept &&
        !erstes.strategie_id && !konzept.creator_auswahl_id
      );
    }

    const hatLinie = plan.linien.some(l => l.zielKey === ziel.key);
    if (!hatLinie) {
      const titel = g.key === 'rest' ? 'Altbestand' : g.name;
      neueLinie(ziel, { titel, neuCasting: true, neuKonzept: true });
    }
  }

  // Castings/Konzepte, die an bestehende (Altbestand-)Linien anschliessen
  for (const [castingId, ref] of bestehendeBriefingVonCasting) {
    const linie = liniePerBriefingId.get(ref.briefingId);
    plan.castingZuordnung.push({ id: castingId, briefingId: ref.briefingId, produktionId: ref.produktionId, linieKey: linie?.key || null });
  }
  for (const [konzeptId, ref] of bestehendeBriefingVonKonzept) {
    const linie = liniePerBriefingId.get(ref.briefingId);
    plan.konzeptZuordnung.push({ id: konzeptId, briefingId: ref.briefingId, produktionId: ref.produktionId, linieKey: linie?.key || null });
  }

  // Ungleiche Anzahl Casting/Konzept ohne Verknuepfung -> Review
  for (const ziel of plan.produktionen) {
    const g = ziel.gruppe;
    const nC = g.castingIds.length;
    const nK = g.konzeptIds.length;
    if (nC && nK && nC !== nK) addGrund('ungleich');
  }

  // ------------------------------------- Kooperationen auf Linien verteilen
  const videosNachKoop = groupBy(ctx.videos || [], 'kooperation_id');
  const linieVonKonzept = new Map();
  for (const linie of plan.linien) if (linie.konzeptId) linieVonKonzept.set(linie.konzeptId, linie);
  for (const [konzeptId, ref] of bestehendeBriefingVonKonzept) {
    const linie = liniePerBriefingId.get(ref.briefingId);
    if (linie) linieVonKonzept.set(konzeptId, linie);
  }
  for (const linie of plan.linien) {
    for (const k of (ctx.konzepte || [])) if (k.briefing_id && k.briefing_id === linie.briefingId) linieVonKonzept.set(k.id, linie);
  }

  const creatorMenge = linie => {
    const listen = [...(linie.castingIds || []), ...(linie._vorhanden || [])];
    const set = new Set();
    for (const id of listen) for (const item of castingItemsNachListe.get(id) || []) if (item.creator_id) set.add(item.creator_id);
    if (linie.briefingId) {
      for (const c of ctx.castings || []) {
        if (c.briefing_id === linie.briefingId) for (const item of castingItemsNachListe.get(c.id) || []) if (item.creator_id) set.add(item.creator_id);
      }
    }
    return set;
  };
  const creatorNachLinie = new Map(plan.linien.map(l => [l.key, creatorMenge(l)]));

  const koopLinie = new Map();
  for (const ziel of plan.produktionen) {
    const linien = plan.linien.filter(l => l.zielKey === ziel.key);
    for (const koopId of ziel.gruppe.koopIds) {
      const koop = koops.find(x => x.id === koopId);
      // (1) Video -> Videoidee -> Konzept
      const stimmen = new Map();
      for (const video of videosNachKoop.get(koopId) || []) {
        const konzeptId = video.strategie_item_id ? strategieItemKonzept.get(video.strategie_item_id) : null;
        const linie = konzeptId ? linieVonKonzept.get(konzeptId) : null;
        if (linie) stimmen.set(linie.key, (stimmen.get(linie.key) || 0) + 1);
      }
      let l1 = null;
      if (stimmen.size) l1 = linienNachKey.get([...stimmen.entries()].sort((a, b) => b[1] - a[1])[0][0]);
      if (l1 && l1.zielKey !== ziel.key) {
        addGrund('video_andere_produktion');
        l1 = null;
      }
      // (2) Creator steht in genau einem Casting
      const treffer = linien.filter(l => koop.creator_id && creatorNachLinie.get(l.key)?.has(koop.creator_id));
      const l2 = treffer.length === 1 ? treffer[0] : null;
      let linie = null;
      let regel = null;
      if (l1 && l2 && l1.key !== l2.key) {
        addGrund('video_vs_creator');
        linie = l1;
        regel = 'video_konzept';
      } else if (l1) {
        linie = l1;
        regel = 'video_konzept';
      } else if (l2) {
        linie = l2;
        regel = 'creator_im_casting';
      } else if (linien.length === 1) {
        linie = linien[0];
        regel = 'einzige_linie';
      } else {
        linie = linien[0];
        regel = 'erste_linie';
      }
      koopLinie.set(koopId, linie);
      plan.koopZuordnung.push({
        koopId,
        zielKey: ziel.key,
        produktionRef: ziel.ref,
        linieKey: linie.key,
        regel: `${koopRegel.get(koopId) || ''}>${regel}`,
      });
    }
  }

  // ------------------------------------------------------------ Skripte
  const groesstesZiel = plan.produktionen[0] || null;
  for (const skript of legacy.skripte) {
    let linie = null;
    let regel = null;
    const konzeptId = skript.strategie_item_id ? strategieItemKonzept.get(skript.strategie_item_id) : null;
    if (konzeptId && linieVonKonzept.has(konzeptId)) {
      linie = linieVonKonzept.get(konzeptId);
      regel = 'videoidee_konzept';
    }
    if (!linie) {
      const video = (ctx.videos || []).find(v => v.skript_id === skript.id);
      const zuordnung = video ? koopLinie.get(video.kooperation_id) : null;
      if (zuordnung) { linie = zuordnung; regel = 'kooperation'; }
    }
    if (!linie) {
      const eigene = skript.produktion_id
        ? plan.linien.find(l => l.produktionRef === skript.produktion_id || (zielNachKey.get(l.zielKey)?.id === skript.produktion_id))
        : null;
      linie = eigene || (groesstesZiel ? plan.linien.find(l => l.zielKey === groesstesZiel.key) : null);
      regel = eigene ? 'produktion_erste_linie' : 'erste_linie';
    }
    if (linie) plan.skriptZuordnung.push({ skriptId: skript.id, linieKey: linie.key, produktionRef: linie.produktionRef, regel });
  }

  // ----------------------------------------------------------- Vertraege
  const vertragKoopsNachVertrag = groupBy(
    [...(ctx.vertragKoops || [])].sort((a, b) => String(a.created_at || '').localeCompare(String(b.created_at || ''))),
    'vertrag_id'
  );
  const koopIds = new Set(koops.map(k => k.id));
  const koopProduktion = koopId => {
    const zuordnung = plan.koopZuordnung.find(z => z.koopId === koopId);
    if (zuordnung) return zuordnung.produktionRef;
    return koops.find(k => k.id === koopId)?.produktion_id || null;
  };
  const planKoopIds = new Set(plan.koopZuordnung.map(z => z.koopId));

  for (const vertrag of ctx.vertraege || []) {
    if (norm(vertrag.typ) === 'contracting') continue;
    const gedeckt = (vertragKoopsNachVertrag.get(vertrag.id) || []).map(x => x.kooperation_id).filter(id => koopIds.has(id));
    const erzeuger = vertrag.kooperation_id && koopIds.has(vertrag.kooperation_id) ? vertrag.kooperation_id : gedeckt[0] || null;
    if (!erzeuger) continue;
    const beteiligt = [erzeuger, ...gedeckt];
    if (!beteiligt.some(id => planKoopIds.has(id))) continue;
    if (vertrag.kampagne_id && vertrag.kampagne_id !== kampagne.id) {
      addGrund('vertrag_andere_kampagne');
      continue;
    }
    const ref = koopProduktion(erzeuger);
    if (!ref) continue;
    const refs = new Set(gedeckt.map(koopProduktion).filter(Boolean));
    if (refs.size > 1) addGrund('vertrag_mehrere_produktionen');
    plan.vertragZuordnung.push({ vertragId: vertrag.id, produktionRef: ref, erzeugerKoopId: erzeuger });
  }

  // ------------------------------------------------------------ Warnungen
  const pot = parseFloat(
    kampagne.creator_budget || kampagne.volumen || kampagne.auftrag?.creator_budget || kampagne.auftrag?.nettobetrag || 0
  ) || 0;
  if (pot > 0) {
    const mitProduktion = new Set(koops.filter(k => k.produktion_id).map(k => k.id));
    const verbrauchVorher = summe((ctx.videos || []).filter(v => mitProduktion.has(v.kooperation_id)), 'verkaufspreis_netto');
    const nachher = new Set([...mitProduktion, ...plan.koopZuordnung.map(z => z.koopId)]);
    const verbrauchNachher = summe((ctx.videos || []).filter(v => nachher.has(v.kooperation_id)), 'verkaufspreis_netto');
    if (pot - verbrauchNachher < 0 && pot - verbrauchVorher >= 0) {
      plan.negativerRest = Math.round((pot - verbrauchNachher) * 100) / 100;
      warnungen.push(`Rest wird negativ: ${plan.negativerRest} (Topf ${pot})`);
    }
  }

  for (const linie of plan.linien) {
    delete linie._konzept;
    delete linie._vorhanden;
  }
  for (const ziel of plan.produktionen) {
    ziel.gruppe = {
      key: ziel.gruppe.key,
      name: ziel.gruppe.name,
      koops: ziel.gruppe.koopIds.length,
      castings: ziel.gruppe.castingIds.length,
      konzepte: ziel.gruppe.konzeptIds.length,
    };
  }

  plan.stats = {
    koops: plan.koopZuordnung.length,
    castings: legacy.castings.length,
    konzepte: legacy.konzepte.length,
    skripte: plan.skriptZuordnung.length,
    vertraege: plan.vertragZuordnung.length,
    produktionenNeu: plan.produktionen.filter(p => p.neu).length,
    produktionenUmbenannt: plan.produktionen.filter(p => p.umbenennen).length,
    linienNeu: plan.linien.filter(l => !l.bestehend).length,
    gruppen: tagGruppen.length,
  };
  plan.status = gruende.length ? 'review' : 'auto';
  return plan;
}

module.exports = {
  norm,
  istZeitTag,
  enthaeltBegriff,
  altTitel,
  titelFuerGruppe,
  bereichAusListeTyp,
  planKampagne,
  GEDANKENSTRICH,
};
