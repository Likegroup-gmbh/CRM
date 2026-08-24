// skriptMasterFormat.js
// Markdown-Sektionen fuer Master-Skripte: Split an ##-Ueberschriften,
// Replace einer Sektion, leichtes HTML-Rendering (Tabellen/Listen).

export function istMasterSkript(skript) {
  return Boolean(skript?.inhalt_md);
}

export function slugifyHeading(title) {
  const slug = String(title || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
  return slug || 'sektion';
}

/**
 * Teilt Markdown an ^## Ueberschriften.
 * Text vor der ersten ## wird zur Sektion "einleitung".
 * Ohne ##: eine Sektion "dokument".
 */
export function parseMasterSektionen(md) {
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
      body,
      start: 0,
      end: text.length
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
      body: pre,
      start: 0,
      end: first.index
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
      body,
      start,
      end
    });
  }

  const seen = {};
  for (const s of sections) {
    seen[s.slug] = (seen[s.slug] || 0) + 1;
    if (seen[s.slug] > 1) s.slug = `${s.slug}-${seen[s.slug]}`;
  }
  return sections;
}

export function rebuildMasterMarkdown(sections) {
  return sections
    .map((s) => `${s.heading}\n${s.body}`.replace(/\n+$/, ''))
    .join('\n\n') + '\n';
}

/**
 * Ersetzt den Body einer Sektion. Mit selektion: nur die markierte Stelle
 * innerhalb des Bodies. Rueckgabe null, wenn die Sektion fehlt.
 */
export function replaceMasterSektion(md, slug, newBody, { selektion = null } = {}) {
  const sections = parseMasterSektionen(md);
  const target = sections.find((s) => s.slug === slug);
  if (!target) return null;
  if (selektion && target.body.includes(selektion)) {
    target.body = target.body.replace(selektion, newBody);
  } else {
    target.body = newBody;
  }
  return rebuildMasterMarkdown(sections);
}

export function masterSektionBody(md, slug) {
  return parseMasterSektionen(md).find((s) => s.slug === slug)?.body || '';
}

function renderMdInline(s, escapeHtml) {
  let t = escapeHtml(s);
  t = t.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
  t = t.replace(/`([^`]+)`/g, '<code>$1</code>');
  return t;
}

function splitTableRow(line) {
  return line.replace(/^\|/, '').replace(/\|$/, '').split('|').map((c) => c.trim());
}

function isTableSep(line) {
  return /^\|?\s*:?-{3,}:?\s*(\|\s*:?-{3,}:?\s*)+\|?\s*$/.test(line);
}

function renderMdTable(rows, escapeHtml) {
  if (rows.length < 2) return '';
  const heads = splitTableRow(rows[0]);
  const body = rows.slice(2).map(splitTableRow);
  const th = heads.map((h) => `<th>${renderMdInline(h, escapeHtml)}</th>`).join('');
  const tr = body.map((cells) =>
    `<tr>${cells.map((c) => `<td>${renderMdInline(c, escapeHtml)}</td>`).join('')}</tr>`
  ).join('');
  return `<table class="skripte-editor-md-table"><thead><tr>${th}</tr></thead><tbody>${tr}</tbody></table>`;
}

export function renderMdBody(body, escapeHtml) {
  const lines = String(body || '').split('\n');
  const out = [];
  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    if (line.startsWith('```')) {
      const buf = [];
      i += 1;
      while (i < lines.length && !lines[i].startsWith('```')) {
        buf.push(lines[i]);
        i += 1;
      }
      if (i < lines.length) i += 1;
      out.push(`<pre class="skripte-editor-md-pre"><code>${escapeHtml(buf.join('\n'))}</code></pre>`);
      continue;
    }
    if (/^\|/.test(line) && i + 1 < lines.length && isTableSep(lines[i + 1])) {
      const rows = [];
      while (i < lines.length && /^\|/.test(lines[i])) {
        rows.push(lines[i]);
        i += 1;
      }
      out.push(renderMdTable(rows, escapeHtml));
      continue;
    }
    if (/^[-*]\s+/.test(line) || /^\d+\.\s+/.test(line)) {
      const ordered = /^\d+\.\s+/.test(line);
      const items = [];
      const itemRe = ordered ? /^\d+\.\s+/ : /^[-*]\s+/;
      while (i < lines.length && itemRe.test(lines[i])) {
        items.push(lines[i].replace(itemRe, ''));
        i += 1;
      }
      const tag = ordered ? 'ol' : 'ul';
      out.push(`<${tag}>${items.map((it) => `<li>${renderMdInline(it, escapeHtml)}</li>`).join('')}</${tag}>`);
      continue;
    }
    if (line.startsWith('>')) {
      const buf = [];
      while (i < lines.length && lines[i].startsWith('>')) {
        buf.push(lines[i].replace(/^>\s?/, ''));
        i += 1;
      }
      out.push(`<blockquote>${renderMdInline(buf.join(' '), escapeHtml)}</blockquote>`);
      continue;
    }
    if (/^###\s+/.test(line)) {
      out.push(`<h3>${escapeHtml(line.replace(/^###\s+/, ''))}</h3>`);
      i += 1;
      continue;
    }
    if (!line.trim()) {
      i += 1;
      continue;
    }
    const buf = [line];
    i += 1;
    while (
      i < lines.length
      && lines[i].trim()
      && !/^(```|\||[-*]\s+|\d+\.\s+|>|###\s+)/.test(lines[i])
    ) {
      buf.push(lines[i]);
      i += 1;
    }
    out.push(`<p>${renderMdInline(buf.join(' '), escapeHtml)}</p>`);
  }
  return out.join('\n');
}

export function renderMasterMarkdownHtml(md, escapeHtml, { feld = 'inhalt_md' } = {}) {
  const sections = parseMasterSektionen(md);
  if (!sections.length) {
    return '<div class="skripte-editor-md"><p class="skripte-hint">Noch kein Inhalt.</p></div>';
  }
  const feldAttr = feld ? ` data-feld="${escapeHtml(feld)}"` : '';
  return `<div class="skripte-editor-md">${sections.map((s) => `
    <section class="skripte-editor-md-sektion" data-sektion="${escapeHtml(s.slug)}">
      <h2 class="skripte-editor-md-heading">${escapeHtml(s.title)}</h2>
      <div class="skripte-editor-sektion-text skripte-editor-sektion-text--md"
        data-sektion="${escapeHtml(s.slug)}"${feldAttr}>${renderMdBody(s.body, escapeHtml)}</div>
    </section>
  `).join('')}</div>`;
}
