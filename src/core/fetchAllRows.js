// fetchAllRows.js
// Laedt eine Tabelle seitenweise, damit keine Zeile am PostgREST-Limit
// (Standard: 1000) still verloren geht. kooperation_videos hat z. B. ueber
// 2.500 Zeilen. Stabile Sortierung nach id, damit die Seiten deterministisch sind.
export async function fetchAllRows(supabase, table, select, pageSize = 1000) {
  const rows = [];
  for (let offset = 0; ; offset += pageSize) {
    const { data, error } = await supabase
      .from(table)
      .select(select)
      .order('id', { ascending: true })
      .range(offset, offset + pageSize - 1);
    if (error) throw error;
    rows.push(...(data || []));
    if (!data || data.length < pageSize) return rows;
  }
}
