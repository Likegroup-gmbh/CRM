// Extrahiert Hook/Hauptteil/CTA (+ Visuals) und Varianten aus einem
// Master-Markdown-Dokument (Creator-facing-Zweispalter, Variantenuebersicht,
// "Alternativer Opener B:"-Zeilen). Reines CJS, von Generate + UI genutzt.

const CREATOR_FACING_RE = /creator-facing|links gesprochen|rechts zu sehen|was gesprochen wird|was zu sehen ist/i;
const VARIANTEN_SEKTION_RE = /varianten(uebersicht|übersicht)?|alternative[nr]?[-\s](opener|hooks?|ctas?|closer)|hook-optionen|hook-varianten/i;
const OPENER_LINE_RE = /^\s*(?:[-*]|\d+\.)?\s*alternativ(?:er|e|es)?\s+(?:opener|hook|cta|closer)\s+[A-Z0-9]+/i;

function slugifyHeading(title) {
  const slug = String(title || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
  return slug || 'sektion';
}

function parseMasterSektionen(md) {
  const text = String(md || '');
  const re = /^##[ \t]+(.+)$/gm;
  const matches = [...text.matchAll(re)];

  if (!matches.length) {
    const body = text.replace(/\n+$/, '');
    if (!body.trim()) return [];
    return [{
      slug: 'dokument',
      title: 'Dokument',
      heading: '## Dokument',
      body
    }];
  }

  const sections = [];
  const first = matches[0];
  const pre = text.slice(0, first.index).trim();
  if (pre) {
    sections.push({
      slug: 'einleitung',
      title: 'Einleitung',
      heading: '## Einleitung',
      body: pre
    });
  }

  for (let i = 0; i < matches.length; i++) {
    const m = matches[i];
    const title = m[1].trim();
    const start = m.index;
    const end = i + 1 < matches.length ? matches[i + 1].index : text.length;
    const headingLineEnd = start + m[0].length;
    const body = text.slice(headingLineEnd, end).replace(/^\n/, '').replace(/\n+$/, '');
    sections.push({
      slug: slugifyHeading(title),
      title,
      heading: m[0],
      body
    });
  }
  return sections;
}

function splitTableRow(line) {
  return line.replace(/^\|/, '').replace(/\|$/, '').split('|').map((c) => c.trim());
}

function isTableSep(line) {
  return /^\|?\s*:?-{3,}:?\s*(\|\s*:?-{3,}:?\s*)+\|?\s*$/.test(line);
}

function extractTables(body) {
  const lines = String(body || '').split('\n');
  const tables = [];
  let i = 0;
  while (i < lines.length) {
    if (/^\|/.test(lines[i]) && i + 1 < lines.length && isTableSep(lines[i + 1])) {
      const rows = [];
      while (i < lines.length && /^\|/.test(lines[i])) {
        rows.push(lines[i]);
        i += 1;
      }
      if (rows.length >= 3) {
        tables.push({
          heads: splitTableRow(rows[0]),
          rows: rows.slice(2).map(splitTableRow)
        });
      }
      continue;
    }
    i += 1;
  }
  return tables;
}

function normHead(h) {
  return String(h || '').replace(/\*/g, '').toLowerCase();
}

function isZweispalter(heads) {
  if (!heads || heads.length < 2) return false;
  const left = normHead(heads[0]);
  const right = normHead(heads[1]);
  return (CREATOR_FACING_RE.test(left) || /gesprochen|gesagt|links|audio/.test(left))
    && (CREATOR_FACING_RE.test(right) || /sehen|rechts|visual|bild/.test(right));
}

function emptyish(s) {
  return !s || !String(s).trim() || /^[.…\-–—\s]+$/.test(s);
}

function nonempty(s) {
  return emptyish(s) ? null : String(s).trim();
}

const SKRIPT_TEXT_FELDER = [
  'hook', 'hauptteil', 'cta',
  'hook_visuell', 'hauptteil_visuell', 'cta_visuell'
];

/**
 * Packt "Sek. 0: … Sek. 3–7: …" in eigene Absaetze. Schon gesplitteter
 * Text bleibt unveraendert (keine extra Leerzeilen).
 */
function splitZeitmarkerAbsaetze(text) {
  if (text == null) return text;
  const raw = String(text);
  if (!raw.trim()) return raw.trim();
  return raw
    .replace(/(?<!\n\n)(?<!^)\s+(?=Sek\.?\s*\d+)/gi, '\n\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function splitSkriptFelder(felder) {
  if (!felder) return felder;
  const out = { ...felder };
  for (const key of SKRIPT_TEXT_FELDER) {
    if (out[key]) out[key] = splitZeitmarkerAbsaetze(out[key]);
  }
  return out;
}

function joinBlocks(parts) {
  return parts.map((p) => String(p || '').trim()).filter(Boolean).join('\n\n') || null;
}

function parseSekStart(text) {
  const m = String(text || '').match(/Sek\.?\s*(\d+)/i);
  return m ? Number(m[1]) : null;
}

function rowRolle(row, index, total, maxSek) {
  const spoken = row[0] || '';
  const visual = row[1] || '';
  const both = `${spoken} ${visual}`;
  if (total <= 3) return ['hook', 'hauptteil', 'cta'][index] || 'hauptteil';

  const ctaHit = /endframe|on-screen-cta|jetzt entdecken|cta\b/i.test(both)
    || (/passt\.?$|klick auf|hier der link/i.test(spoken) && index >= total - 2);
  if (ctaHit && index >= total - 2) return 'cta';

  const sek = parseSekStart(visual) ?? parseSekStart(spoken);
  if (sek != null && maxSek) {
    if (sek >= Math.max(maxSek - 5, maxSek * 0.85) && ctaHit) return 'cta';
    if (sek < 10 || sek <= maxSek * 0.35) return 'hook';
    return 'hauptteil';
  }

  const hookCount = Math.max(1, Math.ceil(total * 0.35));
  if (index < hookCount) return 'hook';
  if (index === total - 1) return 'cta';
  return 'hauptteil';
}

function extractGridFromTables(tables) {
  for (const t of tables) {
    if (!isZweispalter(t.heads) && t.heads.length !== 2) continue;
    if (!t.rows.length) continue;
    const maxSek = Math.max(0, ...t.rows.map((r) => parseSekStart(r[1]) || parseSekStart(r[0]) || 0));
    const buckets = { hook: { s: [], v: [] }, hauptteil: { s: [], v: [] }, cta: { s: [], v: [] } };
    t.rows.forEach((r, i) => {
      const rolle = rowRolle(r, i, t.rows.length, maxSek || null);
      buckets[rolle].s.push(r[0]);
      buckets[rolle].v.push(r[1]);
    });
    return {
      hook: joinBlocks(buckets.hook.s),
      hook_visuell: joinBlocks(buckets.hook.v),
      hauptteil: joinBlocks(buckets.hauptteil.s),
      hauptteil_visuell: joinBlocks(buckets.hauptteil.v),
      cta: joinBlocks(buckets.cta.s),
      cta_visuell: joinBlocks(buckets.cta.v)
    };
  }
  return null;
}

function colIndex(heads, re) {
  return heads.findIndex((h) => re.test(normHead(h)));
}

function isBasisVariante(label) {
  return /^(a|1|kontrolle|basis|haupt)\b/i.test(String(label || '').trim());
}

function extractVariantenFromTables(tables, basis) {
  const variants = [];
  for (const t of tables) {
    const heads = t.heads;
    const versionIdx = colIndex(heads, /version|variante/);
    if (versionIdx < 0) continue;
    const audioIdx = colIndex(heads, /audio/);
    const textIdx = colIndex(heads, /text-hook|text hook|^text$/);
    const visualIdx = colIndex(heads, /visual/);
    const testIdx = colIndex(heads, /testvariable|was getestet/);
    const ctaIdx = colIndex(heads, /^cta$/);
    if (audioIdx < 0 && visualIdx < 0 && textIdx < 0) continue;

    for (const row of t.rows) {
      const label = (row[versionIdx] || '').trim();
      if (!label || isBasisVariante(label)) continue;
      const audio = audioIdx >= 0 ? row[audioIdx] : '';
      const textHook = textIdx >= 0 ? row[textIdx] : '';
      const visual = visualIdx >= 0 ? row[visualIdx] : '';
      const testVar = testIdx >= 0 ? row[testIdx] : '';
      const cta = ctaIdx >= 0 ? row[ctaIdx] : '';

      const felder = { ...basis };
      if (nonempty(audio)) felder.hook = nonempty(audio);
      if (nonempty(visual) || nonempty(textHook)) {
        const vis = [];
        if (nonempty(visual)) vis.push(nonempty(visual));
        else if (basis.hook_visuell) vis.push(basis.hook_visuell);
        if (nonempty(textHook)) vis.push(`Text-Overlay: ${nonempty(textHook)}`);
        felder.hook_visuell = vis.join('\n\n');
      }
      if (nonempty(cta)) felder.cta = nonempty(cta);

      const kurz = nonempty(testVar) || nonempty(visual) || nonempty(audio) || label;
      variants.push({
        label,
        beschreibung: `Variante ${label}${kurz && kurz !== label ? ` · ${kurz}` : ''}`.slice(0, 200),
        felder
      });
    }
  }
  return variants;
}

function stripQuotes(s) {
  return String(s || '').trim().replace(/^[„""']|[„""']$/g, '').trim();
}

function extractOpenerBullets(md, basis) {
  const variants = [];
  const re = /alternativ(?:er|e|es)?\s+(opener|hook|cta|closer)\s+([A-Z0-9]+)\s*[:–—-]\s*(.+)/gi;
  let m;
  while ((m = re.exec(md))) {
    const art = m[1].toLowerCase();
    const label = m[2];
    if (isBasisVariante(label)) continue;
    const raw = m[3].trim().replace(/\*+$/, '').trim();
    const felder = { ...basis };
    const quoted = /^[„""']/.test(raw);
    if (art === 'cta' || art === 'closer') {
      if (quoted || raw.length < 90) felder.cta = stripQuotes(raw);
      else felder.cta_visuell = raw;
    } else if (quoted) {
      felder.hook = stripQuotes(raw);
    } else {
      felder.hook_visuell = raw;
    }
    variants.push({
      label,
      beschreibung: `Variante ${label} · Alternativer ${art[0].toUpperCase()}${art.slice(1)}`.slice(0, 200),
      felder
    });
  }
  return variants;
}

function mergeVariants(fromTable, fromBullets) {
  const byLabel = new Map();
  for (const v of fromTable) byLabel.set(String(v.label).toUpperCase(), v);
  for (const v of fromBullets) {
    const k = String(v.label).toUpperCase();
    if (!byLabel.has(k)) {
      byLabel.set(k, v);
      continue;
    }
    const ex = byLabel.get(k);
    const felder = { ...ex.felder };
    if (v.felder.hook && v.felder.hook !== ex.felder.hook) felder.hook = v.felder.hook;
    if (v.felder.hook_visuell && v.felder.hook_visuell !== ex.felder.hook_visuell) {
      felder.hook_visuell = v.felder.hook_visuell;
    }
    if (v.felder.cta && v.felder.cta !== ex.felder.cta) felder.cta = v.felder.cta;
    if (v.felder.cta_visuell && v.felder.cta_visuell !== ex.felder.cta_visuell) {
      felder.cta_visuell = v.felder.cta_visuell;
    }
    byLabel.set(k, { ...ex, felder });
  }
  return [...byLabel.values()];
}

function istCreatorFacingSektion(titleOrSlug) {
  return CREATOR_FACING_RE.test(String(titleOrSlug || ''));
}

function istVariantenSektion(titleOrSlug) {
  return VARIANTEN_SEKTION_RE.test(String(titleOrSlug || ''));
}

function istSkriptDuplikatSektion(s) {
  return istCreatorFacingSektion(s.title) || istCreatorFacingSektion(s.slug)
    || istVariantenSektion(s.title) || istVariantenSektion(s.slug);
}

function isVariantenTable(heads) {
  const h = (heads || []).map(normHead).join(' ');
  return /version|variante/.test(h) && /audio|visual|hook/.test(h);
}

function stripSkriptDuplikateAusBody(body) {
  const lines = String(body || '').split('\n');
  const out = [];
  let i = 0;
  while (i < lines.length) {
    if (/^\|/.test(lines[i]) && i + 1 < lines.length && isTableSep(lines[i + 1])) {
      const rows = [];
      while (i < lines.length && /^\|/.test(lines[i])) {
        rows.push(lines[i]);
        i += 1;
      }
      const heads = splitTableRow(rows[0]);
      if (isZweispalter(heads) || isVariantenTable(heads)) continue;
      out.push(...rows);
      continue;
    }
    if (OPENER_LINE_RE.test(lines[i])) {
      i += 1;
      continue;
    }
    out.push(lines[i]);
    i += 1;
  }
  return out.join('\n').replace(/\n{3,}/g, '\n\n').trim();
}

function zusatzInfosMarkdown(md) {
  const sections = parseMasterSektionen(md);
  const kept = sections
    .filter((s) => !istSkriptDuplikatSektion(s))
    .map((s) => ({ ...s, body: stripSkriptDuplikateAusBody(s.body) }))
    .filter((s) => s.body);
  if (!kept.length) return '';
  return `${kept.map((s) => `${s.heading}\n${s.body}`.replace(/\n+$/, '')).join('\n\n')}\n`;
}

function hatZusatzInfos(md) {
  return Boolean(zusatzInfosMarkdown(md).trim());
}

function normalizeToolVarianten(raw, basis) {
  if (!Array.isArray(raw)) return [];
  return raw.map((v, i) => {
    if (!v || typeof v !== 'object') return null;
    const label = nonempty(v.label) || String.fromCharCode(66 + i);
    if (isBasisVariante(label)) return null;
    const felder = { ...basis };
    if (nonempty(v.hook)) felder.hook = nonempty(v.hook);
    if (nonempty(v.hauptteil)) felder.hauptteil = nonempty(v.hauptteil);
    if (nonempty(v.cta)) felder.cta = nonempty(v.cta);
    if (nonempty(v.hook_visuell)) felder.hook_visuell = nonempty(v.hook_visuell);
    if (nonempty(v.hauptteil_visuell)) felder.hauptteil_visuell = nonempty(v.hauptteil_visuell);
    if (nonempty(v.cta_visuell)) felder.cta_visuell = nonempty(v.cta_visuell);
    return {
      label,
      beschreibung: (nonempty(v.beschreibung) || `Variante ${label}`).slice(0, 200),
      felder
    };
  }).filter(Boolean);
}

function extractSkriptAusMaster(md, parsedTool = {}) {
  const sections = parseMasterSektionen(md);
  const allTables = [];
  const creatorTables = [];
  for (const s of sections) {
    const tables = extractTables(s.body);
    allTables.push(...tables);
    if (istCreatorFacingSektion(s.title) || istCreatorFacingSektion(s.slug)) {
      creatorTables.push(...tables);
    }
  }

  const grid = extractGridFromTables(creatorTables.length ? creatorTables : allTables) || {};
  const felder = splitSkriptFelder({
    hook: nonempty(parsedTool.hook) || grid.hook || null,
    hauptteil: nonempty(parsedTool.hauptteil) || grid.hauptteil || null,
    cta: nonempty(parsedTool.cta) || grid.cta || null,
    hook_visuell: nonempty(parsedTool.hook_visuell) || grid.hook_visuell || null,
    hauptteil_visuell: nonempty(parsedTool.hauptteil_visuell) || grid.hauptteil_visuell || null,
    cta_visuell: nonempty(parsedTool.cta_visuell) || grid.cta_visuell || null
  });

  const fromTool = normalizeToolVarianten(parsedTool.varianten, felder);
  const fromMd = mergeVariants(
    extractVariantenFromTables(allTables, felder),
    extractOpenerBullets(md, felder)
  );
  const varianten = (fromTool.length ? fromTool : fromMd)
    .map((v) => ({ ...v, felder: splitSkriptFelder(v.felder) }));

  return { felder, varianten, inhalt_md: zusatzInfosMarkdown(md) };
}

function hatPersistiertesGrid(skript) {
  return Boolean(
    skript?.hook || skript?.hauptteil || skript?.cta
    || skript?.hook_visuell || skript?.hauptteil_visuell || skript?.cta_visuell
  );
}

function hatGridInhalt(skript) {
  if (hatPersistiertesGrid(skript)) return true;
  if (!skript?.inhalt_md) return false;
  const { felder } = extractSkriptAusMaster(skript.inhalt_md);
  return Boolean(felder.hook || felder.hauptteil || felder.cta
    || felder.hook_visuell || felder.hauptteil_visuell || felder.cta_visuell);
}

function gridFelderFuerSkript(skript) {
  if (hatPersistiertesGrid(skript)) {
    return {
      hook: skript.hook || null,
      hauptteil: skript.hauptteil || null,
      cta: skript.cta || null,
      hook_visuell: skript.hook_visuell || null,
      hauptteil_visuell: skript.hauptteil_visuell || null,
      cta_visuell: skript.cta_visuell || null
    };
  }
  if (skript?.inhalt_md) return extractSkriptAusMaster(skript.inhalt_md).felder;
  return {
    hook: null, hauptteil: null, cta: null,
    hook_visuell: null, hauptteil_visuell: null, cta_visuell: null
  };
}

module.exports = {
  extractSkriptAusMaster,
  zusatzInfosMarkdown,
  hatZusatzInfos,
  hatGridInhalt,
  gridFelderFuerSkript,
  istCreatorFacingSektion,
  istVariantenSektion,
  parseMasterSektionen,
  splitZeitmarkerAbsaetze
};
