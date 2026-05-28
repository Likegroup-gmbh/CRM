// CustomColumnDataLoader.js
// Laedt Custom Column Definitionen, Dropdown-Optionen und Werte aus Supabase.
// Speichert Werte und Reihenfolge zurueck.

export class CustomColumnDataLoader {

  /**
   * Laedt alle Custom Column Definitionen + Dropdown-Optionen fuer eine Kampagne.
   * Haengt _dropdownOptions an jede Dropdown-Column.
   */
  static async loadCustomColumns(kampagneId) {
    const [colResult, optResult] = await Promise.all([
      window.supabase
        .from('custom_columns')
        .select('*')
        .eq('kampagne_id', kampagneId)
        .order('position', { ascending: true }),
      window.supabase
        .from('custom_column_dropdown_options')
        .select('*')
        .order('position', { ascending: true })
    ]);

    if (colResult.error) {
      console.error('❌ Custom Columns laden fehlgeschlagen:', colResult.error);
      return [];
    }

    const columns = colResult.data || [];
    const allOptions = optResult.data || [];

    const optionsByColumn = {};
    for (const opt of allOptions) {
      if (!optionsByColumn[opt.custom_column_id]) {
        optionsByColumn[opt.custom_column_id] = [];
      }
      optionsByColumn[opt.custom_column_id].push(opt);
    }

    for (const col of columns) {
      col._dropdownOptions = optionsByColumn[col.id] || [];
    }

    return columns;
  }

  /**
   * Laedt alle Custom Column Values fuer gegebene Entity-IDs.
   * Gibt ein Map zurueck: { [entityId]: { [columnId]: value } }
   */
  static async loadCustomColumnValues(columnIds, entityIds) {
    if (!columnIds.length || !entityIds.length) return {};

    const { data, error } = await window.supabase
      .from('custom_column_values')
      .select('custom_column_id, entity_id, value')
      .in('custom_column_id', columnIds)
      .in('entity_id', entityIds);

    if (error) {
      console.error('❌ Custom Column Values laden fehlgeschlagen:', error);
      return {};
    }

    const map = {};
    for (const row of (data || [])) {
      if (!map[row.entity_id]) map[row.entity_id] = {};
      map[row.entity_id][row.custom_column_id] = row.value;
    }
    return map;
  }

  /**
   * Laedt die column_order von der Kampagne.
   */
  static async loadColumnOrder(kampagneId) {
    const { data, error } = await window.supabase
      .from('kampagne')
      .select('column_order')
      .eq('id', kampagneId)
      .single();

    if (error) {
      console.warn('⚠️ Column Order laden fehlgeschlagen:', error);
      return null;
    }
    return data?.column_order || null;
  }

  /**
   * UPSERT fuer einen einzelnen Custom Column Value.
   */
  static async upsertValue(columnId, entityId, value) {
    const { error } = await window.supabase
      .from('custom_column_values')
      .upsert(
        {
          custom_column_id: columnId,
          entity_id: entityId,
          value,
          updated_at: new Date().toISOString()
        },
        { onConflict: 'custom_column_id,entity_id' }
      );

    if (error) throw error;
  }

  /**
   * Speichert die column_order auf der Kampagne.
   */
  static async saveColumnOrder(kampagneId, order) {
    const { error } = await window.supabase
      .from('kampagne')
      .update({ column_order: order })
      .eq('id', kampagneId);

    if (error) throw error;
  }

  /**
   * Erstellt eine neue Custom Column Definition.
   */
  static async createColumn(kampagneId, { name, field_type, entity_type, visible_for_kunden = false }) {
    const maxPosResult = await window.supabase
      .from('custom_columns')
      .select('position')
      .eq('kampagne_id', kampagneId)
      .order('position', { ascending: false })
      .limit(1);

    const nextPos = ((maxPosResult.data?.[0]?.position ?? -1) + 1);

    const { data, error } = await window.supabase
      .from('custom_columns')
      .insert({
        kampagne_id: kampagneId,
        name,
        field_type,
        entity_type,
        position: nextPos,
        visible_for_kunden,
        created_by: window.currentUser?.auth_user_id || null
      })
      .select('*')
      .single();

    if (error) throw error;
    data._dropdownOptions = [];
    return data;
  }

  /**
   * Aktualisiert eine Custom Column Definition.
   */
  static async updateColumn(columnId, patch) {
    const { error } = await window.supabase
      .from('custom_columns')
      .update({ ...patch, updated_at: new Date().toISOString() })
      .eq('id', columnId);

    if (error) throw error;
  }

  /**
   * Loescht eine Custom Column + alle Werte (CASCADE).
   */
  static async deleteColumn(columnId) {
    const { error } = await window.supabase
      .from('custom_columns')
      .delete()
      .eq('id', columnId);

    if (error) throw error;
  }

  /**
   * Fuegt eine Dropdown-Option hinzu (dynamisch).
   */
  static async addDropdownOption(columnId, label) {
    const maxPosResult = await window.supabase
      .from('custom_column_dropdown_options')
      .select('position')
      .eq('custom_column_id', columnId)
      .order('position', { ascending: false })
      .limit(1);

    const nextPos = ((maxPosResult.data?.[0]?.position ?? -1) + 1);

    const { data, error } = await window.supabase
      .from('custom_column_dropdown_options')
      .insert({ custom_column_id: columnId, label, position: nextPos })
      .select('*')
      .single();

    if (error) throw error;
    return data;
  }

  /**
   * Loescht eine Dropdown-Option.
   */
  static async deleteDropdownOption(optionId) {
    const { error } = await window.supabase
      .from('custom_column_dropdown_options')
      .delete()
      .eq('id', optionId);

    if (error) throw error;
  }

  /**
   * Aktualisiert eine Dropdown-Option (Umbenennen, Position aendern).
   */
  static async updateDropdownOption(optionId, patch) {
    const { error } = await window.supabase
      .from('custom_column_dropdown_options')
      .update(patch)
      .eq('id', optionId);

    if (error) throw error;
  }

  /**
   * Laedt Assets (Dateien) fuer Upload-Spalten.
   * Gibt Map zurueck: { [columnId:entityId]: [{ id, file_url, file_name, ... }] }
   */
  static async loadCustomColumnAssets(columnIds, entityIds) {
    if (!columnIds.length || !entityIds.length) return {};

    const { data, error } = await window.supabase
      .from('custom_column_assets')
      .select('*')
      .in('custom_column_id', columnIds)
      .in('entity_id', entityIds)
      .order('created_at', { ascending: true });

    if (error) {
      console.error('Custom Column Assets laden fehlgeschlagen:', error);
      return {};
    }

    const map = {};
    for (const row of (data || [])) {
      const key = `${row.custom_column_id}:${row.entity_id}`;
      if (!map[key]) map[key] = [];
      map[key].push(row);
    }
    return map;
  }

  /**
   * Tauscht die Positionen zweier Dropdown-Optionen.
   */
  static async swapDropdownPositions(optA, optB) {
    const posA = optA.position;
    const posB = optB.position;

    await Promise.all([
      this.updateDropdownOption(optA.id, { position: posB }),
      this.updateDropdownOption(optB.id, { position: posA })
    ]);
  }
}
