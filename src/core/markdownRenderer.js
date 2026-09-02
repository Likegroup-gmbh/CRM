// markdownRenderer.js (ES6-Modul)
// Einfaches Markdown-Rendering ohne externe Library. Wird von Education-
// Artikeln und den Neuigkeiten ("Was ist neu") genutzt. Ausgabe ist HTML,
// die Typo-Styles haengen am Scope .md-content (siehe domain-education.css
// und tables.css).

function renderTables(html) {
  const tableRegex = /\|(.+)\|\n\|[-| ]+\|\n((?:\|.+\|\n?)+)/g;

  return html.replace(tableRegex, (match, headerRow, bodyRows) => {
    const headers = headerRow.split('|').filter(h => h.trim());
    const rows = bodyRows.trim().split('\n').map(row =>
      row.split('|').filter(c => c.trim())
    );

    const headerHtml = headers.map(h => `<th>${h.trim()}</th>`).join('');
    const bodyHtml = rows.map(row =>
      `<tr>${row.map(cell => `<td>${cell.trim()}</td>`).join('')}</tr>`
    ).join('');

    return `<table class="md-table">
      <thead><tr>${headerHtml}</tr></thead>
      <tbody>${bodyHtml}</tbody>
    </table>`;
  });
}

export function renderMarkdown(content) {
  if (!content) return '';

  let html = content;

  // Escape HTML (außer erlaubte Tags)
  html = html
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');

  // Code-Blöcke (```...```)
  html = html.replace(/```(\w*)\n([\s\S]*?)```/g, (match, lang, code) => {
    return `<pre class="code-block${lang ? ` language-${lang}` : ''}"><code>${code.trim()}</code></pre>`;
  });

  // Inline Code (`...`)
  html = html.replace(/`([^`]+)`/g, '<code class="inline-code">$1</code>');

  // Headers
  html = html.replace(/^### (.+)$/gm, '<h3>$1</h3>');
  html = html.replace(/^## (.+)$/gm, '<h2>$1</h2>');
  html = html.replace(/^# (.+)$/gm, '<h1>$1</h1>');

  // Bold & Italic
  html = html.replace(/\*\*\*(.+?)\*\*\*/g, '<strong><em>$1</em></strong>');
  html = html.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
  html = html.replace(/\*(.+?)\*/g, '<em>$1</em>');

  // Links
  html = html.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" rel="noopener">$1</a>');

  // Tabellen
  html = renderTables(html);

  // Listen (unordered)
  html = html.replace(/^- (.+)$/gm, '<li>$1</li>');
  html = html.replace(/(<li>.*<\/li>\n?)+/g, '<ul>$&</ul>');

  // Listen (ordered)
  html = html.replace(/^\d+\. (.+)$/gm, '<li>$1</li>');

  // Horizontale Linie
  html = html.replace(/^---$/gm, '<hr>');

  // Paragraphen (doppelte Newlines)
  html = html.replace(/\n\n/g, '</p><p>');
  html = '<p>' + html + '</p>';

  // Leere Paragraphen entfernen
  html = html.replace(/<p>\s*<\/p>/g, '');
  html = html.replace(/<p>(<h[1-6]>)/g, '$1');
  html = html.replace(/(<\/h[1-6]>)<\/p>/g, '$1');
  html = html.replace(/<p>(<ul>)/g, '$1');
  html = html.replace(/(<\/ul>)<\/p>/g, '$1');
  html = html.replace(/<p>(<pre)/g, '$1');
  html = html.replace(/(<\/pre>)<\/p>/g, '$1');
  html = html.replace(/<p>(<table)/g, '$1');
  html = html.replace(/(<\/table>)<\/p>/g, '$1');
  html = html.replace(/<p>(<hr>)<\/p>/g, '$1');

  return html;
}
