// skript-master.js
// Bereichs-Aufloesung + Master-Docs ins Prompt (Generate/Fragen/Edit).

const SKRIPT_BEREICHE = ['owned_social', 'paid_creator_ads', 'influencer_marketing'];
const MASTER_BEREICH_ORDER = { basis: 0, owned_social: 1, paid_creator_ads: 2, influencer_marketing: 3 };

const MASTER_BEREICH_LABELS = {
  basis: 'Basis (uebergreifend)',
  owned_social: 'Owned Social',
  paid_creator_ads: 'Paid Creator Ads',
  influencer_marketing: 'Influencer Marketing'
};

// Kampagnenart (kampagne_art_typen.name) -> Skript-Bereich. Vor-Ort, Whitelisting
// und Darkposting haben keinen eigenen Skript-Bereich.
const KAMPAGNENART_BEREICH = {
  'ugc organic': 'owned_social',
  'ugc paid': 'paid_creator_ads',
  'influencer kampagne': 'influencer_marketing',
  'influencer story': 'influencer_marketing'
};

/**
 * Bereich aus den Kampagnenarten, nur wenn genau EIN Bereich herauskommt.
 * Mischkampagnen (z.B. UGC Paid + UGC Organic) bleiben offen: dann entscheidet
 * das Briefing, sonst fragt Liky nach.
 */
function bereichAusKampagnenarten(arten) {
  const bereiche = new Set(
    (Array.isArray(arten) ? arten : [])
      .map((a) => KAMPAGNENART_BEREICH[String(a || '').trim().toLowerCase()])
      .filter(Boolean)
  );
  return bereiche.size === 1 ? [...bereiche][0] : null;
}

function resolveSkriptBereich(params = {}, briefing = null, kampagne = null) {
  if (SKRIPT_BEREICHE.includes(params.bereich)) return params.bereich;
  if (SKRIPT_BEREICHE.includes(briefing?.bereich)) return briefing.bereich;
  return bereichAusKampagnenarten(kampagne?.art_der_kampagne);
}

async function loadMasterDocs(supabase, bereich, { schlank = false } = {}) {
  const cols = schlank ? 'id, bereich, name, version' : 'id, bereich, name, version, inhalt';
  const wanted = ['basis'];
  if (SKRIPT_BEREICHE.includes(bereich)) wanted.push(bereich);

  const { data, error } = await supabase.from('skript_master')
    .select(cols)
    .eq('status', 'aktiv')
    .in('bereich', wanted);
  if (error) throw new Error(`Master-Regelwerk laden fehlgeschlagen: ${error.message}`);

  const docs = (data || []).sort(
    (a, b) => (MASTER_BEREICH_ORDER[a.bereich] ?? 9) - (MASTER_BEREICH_ORDER[b.bereich] ?? 9)
  );
  return {
    master: docs,
    masterVersionen: docs.map((d) => ({
      id: d.id, bereich: d.bereich, name: d.name, version: d.version
    }))
  };
}

const VORLAGEN_RE = /drehfertiger aufbau|beispielstruktur|shotlist/i;

/** Output-Vorlagen raus. Strategische Regeln und die Bereichstrennung bleiben. */
function stripMasterVorlagen(md) {
  if (!md) return '';
  const lines = String(md).split('\n');
  const out = [];
  let skipLevel = 0;
  for (const line of lines) {
    const heading = /^(#{1,6})\s+(.*)$/.exec(line);
    if (heading) {
      const level = heading[1].length;
      if (skipLevel && level <= skipLevel) skipLevel = 0;
      if (!skipLevel && VORLAGEN_RE.test(heading[2])) {
        skipLevel = level;
        continue;
      }
    }
    if (!skipLevel) out.push(line);
  }
  return out.join('\n').replace(/\n{3,}/g, '\n\n').trim();
}

function fmtMasterBlock(docs) {
  if (!docs?.length) return '';
  let out = '\n# MASTER-REGELWERK (verbindlich - Bereichssysteme nicht vermischen)\n'
    + 'Ausgabeformat, Felder und Visual-Stil regelt der AUSGABEFORMAT-Block im Task, nicht das Master-Regelwerk.\n';
  for (const d of docs) {
    const label = MASTER_BEREICH_LABELS[d.bereich] || d.bereich;
    const inhalt = stripMasterVorlagen(d.inhalt);
    out += `\n--- ${d.name ? `"${d.name}" - ` : ''}${label} (v${d.version}) ---\n`;
    if (inhalt) out += `${inhalt}\n`;
  }
  return out;
}

module.exports = {
  SKRIPT_BEREICHE,
  MASTER_BEREICH_LABELS,
  resolveSkriptBereich,
  bereichAusKampagnenarten,
  loadMasterDocs,
  fmtMasterBlock,
  stripMasterVorlagen
};
