// EntityCustomColumnDataLoader.js
// Generischer Supabase-CRUD-Layer fuer Custom Columns von Sourcing/Strategie.
// Arbeitet auf den entity_custom_column*-Tabellen. Reihenfolge wird auf dem
// Parent-Record (creator_auswahl / strategie) in custom_column_order gespeichert.

const COLUMNS_TABLE = 'entity_custom_columns';
const VALUES_TABLE = 'entity_custom_column_values';
const OPTIONS_TABLE = 'entity_custom_column_dropdown_options';
const ASSETS_TABLE = 'entity_custom_column_assets';

export class EntityCustomColumnDataLoader {
  /**
   * @param {object} cfg
   * @param {string} cfg.parentType  z.B. 'sourcing' | 'strategie'
   * @param {string} cfg.parentId    UUID des creator_auswahl / strategie Records
   * @param {string} cfg.parentTable z.B. 'creator_auswahl' | 'strategie'
   * @param {string} [cfg.orderColumn='custom_column_order']
   */
  constructor({ parentType, parentId, parentTable, orderColumn = 'custom_column_order' }) {
    this.parentType = parentType;
    this.parentId = parentId;
    this.parentTable = parentTable;
    this.orderColumn = orderColumn;
  }

  get valueTable() { return VALUES_TABLE; }
  get assetTable() { return ASSETS_TABLE; }

  async loadColumns() {
    const [colResult, optResult] = await Promise.all([
      window.supabase
        .from(COLUMNS_TABLE)
        .select('*')
        .eq('parent_type', this.parentType)
        .eq('parent_id', this.parentId)
        .order('position', { ascending: true }),
      window.supabase
        .from(OPTIONS_TABLE)
        .select('*')
        .order('position', { ascending: true })
    ]);

    if (colResult.error) {
      console.error('❌ Entity Custom Columns laden fehlgeschlagen:', colResult.error);
      return [];
    }

    const columns = colResult.data || [];
    const allOptions = optResult.data || [];

    const optionsByColumn = {};
    for (const opt of allOptions) {
      (optionsByColumn[opt.custom_column_id] ||= []).push(opt);
    }
    for (const col of columns) {
      col._dropdownOptions = optionsByColumn[col.id] || [];
    }
    return columns;
  }

  async loadValues(columnIds, entityIds) {
    if (!columnIds.length || !entityIds.length) return {};
    const { data, error } = await window.supabase
      .from(VALUES_TABLE)
      .select('custom_column_id, entity_id, value')
      .in('custom_column_id', columnIds)
      .in('entity_id', entityIds);

    if (error) {
      console.error('❌ Entity Custom Column Values laden fehlgeschlagen:', error);
      return {};
    }

    const map = {};
    for (const row of (data || [])) {
      (map[row.entity_id] ||= {})[row.custom_column_id] = row.value;
    }
    return map;
  }

  async loadColumnOrder() {
    const { data, error } = await window.supabase
      .from(this.parentTable)
      .select(this.orderColumn)
      .eq('id', this.parentId)
      .single();

    if (error) {
      console.warn('⚠️ Column Order laden fehlgeschlagen:', error);
      return null;
    }
    return data?.[this.orderColumn] || null;
  }

  async saveColumnOrder(order) {
    const { error } = await window.supabase
      .from(this.parentTable)
      .update({ [this.orderColumn]: order })
      .eq('id', this.parentId);
    if (error) throw error;
  }

  async upsertValue(columnId, entityId, value) {
    const { error } = await window.supabase
      .from(VALUES_TABLE)
      .upsert(
        { custom_column_id: columnId, entity_id: entityId, value, updated_at: new Date().toISOString() },
        { onConflict: 'custom_column_id,entity_id' }
      );
    if (error) throw error;
  }

  async createColumn({ name, field_type, visible_for_kunden = false }) {
    const maxPosResult = await window.supabase
      .from(COLUMNS_TABLE)
      .select('position')
      .eq('parent_type', this.parentType)
      .eq('parent_id', this.parentId)
      .order('position', { ascending: false })
      .limit(1);

    const nextPos = ((maxPosResult.data?.[0]?.position ?? -1) + 1);

    const { data, error } = await window.supabase
      .from(COLUMNS_TABLE)
      .insert({
        parent_type: this.parentType,
        parent_id: this.parentId,
        name,
        field_type,
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

  async updateColumn(columnId, patch) {
    const { error } = await window.supabase
      .from(COLUMNS_TABLE)
      .update({ ...patch, updated_at: new Date().toISOString() })
      .eq('id', columnId);
    if (error) throw error;
  }

  async deleteColumn(columnId) {
    const { error } = await window.supabase
      .from(COLUMNS_TABLE)
      .delete()
      .eq('id', columnId);
    if (error) throw error;
  }

  async addDropdownOption(columnId, label) {
    const maxPosResult = await window.supabase
      .from(OPTIONS_TABLE)
      .select('position')
      .eq('custom_column_id', columnId)
      .order('position', { ascending: false })
      .limit(1);

    const nextPos = ((maxPosResult.data?.[0]?.position ?? -1) + 1);

    const { data, error } = await window.supabase
      .from(OPTIONS_TABLE)
      .insert({ custom_column_id: columnId, label, position: nextPos })
      .select('*')
      .single();

    if (error) throw error;
    return data;
  }

  async deleteDropdownOption(optionId) {
    const { error } = await window.supabase
      .from(OPTIONS_TABLE)
      .delete()
      .eq('id', optionId);
    if (error) throw error;
  }

  async updateDropdownOption(optionId, patch) {
    const { error } = await window.supabase
      .from(OPTIONS_TABLE)
      .update(patch)
      .eq('id', optionId);
    if (error) throw error;
  }

  async swapDropdownPositions(optA, optB) {
    await Promise.all([
      this.updateDropdownOption(optA.id, { position: optB.position }),
      this.updateDropdownOption(optB.id, { position: optA.position })
    ]);
  }
}
