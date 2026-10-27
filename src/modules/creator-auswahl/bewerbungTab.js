// Reiter Bewerbung: nur fuer das Team. Aufnehmen legt einen Casting-Eintrag Offen an.

function esc(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export function renderBewerbungTable(rows) {
  if (!rows?.length) {
    return `<div class="table-container table-container--empty"><p>Keine Bewerbungen.</p></div>`;
  }
  const body = rows.map((row) => {
    const person = [row.ansprechpartner?.vorname, row.ansprechpartner?.nachname].filter(Boolean).join(' ');
    const herkunft = person
      ? `${person}${row.management?.firmenname ? ` · ${row.management.firmenname}` : ''}`
      : (row.management?.firmenname || '');
    return `
      <tr>
        <td>${esc(`${row.vorname || ''} ${row.nachname || ''}`.trim())}</td>
        <td>${row.link_instagram ? `<a href="${esc(row.link_instagram)}" target="_blank" rel="noopener">Instagram</a>` : ''}</td>
        <td>${row.link_tiktok ? `<a href="${esc(row.link_tiktok)}" target="_blank" rel="noopener">TikTok</a>` : ''}</td>
        <td>${esc(herkunft)}</td>
        <td>
          <button type="button" class="mdc-btn mdc-btn--sm" data-action="aufnehmen-bewerbung" data-id="${esc(row.id)}">Aufnehmen</button>
          <button type="button" class="mdc-btn mdc-btn--secondary mdc-btn--sm" data-action="verwerfen-bewerbung" data-id="${esc(row.id)}">Verwerfen</button>
        </td>
      </tr>
    `;
  }).join('');
  return `
    <div class="table-container">
      <table class="data-table">
        <thead><tr><th>Name</th><th>Instagram</th><th>TikTok</th><th>Ansprechpartner</th><th></th></tr></thead>
        <tbody>${body}</tbody>
      </table>
    </div>
  `;
}

export async function loadBewerbungen(listeId) {
  if (!listeId || !window.supabase) return [];
  const { data, error } = await window.supabase
    .from('bewerbung')
    .select(`
      id, vorname, nachname, link_instagram, link_tiktok, management_id, ansprechpartner_id, creator_auswahl_id,
      management:management_id(firmenname),
      ansprechpartner:ansprechpartner_id(vorname, nachname)
    `)
    .eq('creator_auswahl_id', listeId)
    .order('created_at', { ascending: true });
  if (error) {
    if (/bewerbung|schema cache|does not exist/i.test(error.message || '')) return [];
    throw error;
  }
  return data || [];
}
