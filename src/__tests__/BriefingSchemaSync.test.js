// BriefingSchemaSync.test.js
// Guard: Feldnamen aus fieldConfig.js muessen als Spalten in der
// campaign_briefings-Migration existieren. prepareDataForDB sendet alle
// getAllFields()-Namen als Payload-Keys – eine fehlende Spalte bricht
// den Save mit einem PostgREST Schema-Cache-Fehler (vgl. os_situationen).

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { createRequire } from 'module';
import { getAllFields } from '../modules/briefing/create/fieldConfig.js';
import { isBooleanRadio } from '../modules/briefing/create/DataPersistence.js';

const require = createRequire(import.meta.url);
const { CAMPAIGN_BRIEFING_FIELD_NAMES } = require('../../netlify/functions/_shared/skript-context.js');

const MIGRATION_PATH = join(
  dirname(fileURLToPath(import.meta.url)),
  '../../supabase/migrations/20260818_campaign_briefings.sql'
);

const COLUMN_TYPES = ['uuid', 'text', 'boolean', 'jsonb', 'date', 'timestamptz', 'integer', 'numeric', 'bigint', 'real'];

function extractColumns(sql) {
  const tableMatch = sql.match(/CREATE TABLE IF NOT EXISTS campaign_briefings\s*\(([\s\S]*?)\n\);/);
  if (!tableMatch) throw new Error('CREATE TABLE campaign_briefings nicht in Migration gefunden');

  const columns = new Set();
  for (const line of tableMatch[1].split('\n')) {
    const colMatch = line.trim().match(/^([a-z_][a-z0-9_]*)\s+([a-z]+)/i);
    if (colMatch && COLUMN_TYPES.includes(colMatch[2].toLowerCase())) {
      columns.add(colMatch[1]);
    }
  }
  return columns;
}

function extractNotNullColumns(sql) {
  const tableMatch = sql.match(/CREATE TABLE IF NOT EXISTS campaign_briefings\s*\(([\s\S]*?)\n\);/);
  const notNull = new Set();
  for (const line of tableMatch[1].split('\n')) {
    const colMatch = line.trim().match(/^([a-z_][a-z0-9_]*)\s+[a-z]+[^,]*\bNOT NULL\b/i);
    if (colMatch) notNull.add(colMatch[1]);
  }
  return notNull;
}

describe('Briefing Schema-Sync (fieldConfig <-> Migration)', () => {
  const sql = readFileSync(MIGRATION_PATH, 'utf8');
  const columns = extractColumns(sql);
  const notNullColumns = extractNotNullColumns(sql);

  it('Migration enthaelt ueberhaupt Spalten', () => {
    expect(columns.size).toBeGreaterThan(50);
  });

  it('jeder Feldname aus getAllFields() existiert als Spalte', () => {
    const fieldNames = getAllFields().map(f => f.name);
    const missing = fieldNames.filter(name => !columns.has(name));
    expect(missing).toEqual([]);
  });

  it('Felder auf NOT-NULL-Spalten liefern nie null (checkbox oder Boolean-Radio)', () => {
    // prepareDataForDB koerziert checkbox -> boolean und Boolean-Radio -> false.
    // Jeder andere Feldtyp auf einer NOT-NULL-Spalte kann null senden (Constraint-Fehler).
    const offenders = getAllFields()
      .filter(f => notNullColumns.has(f.name))
      .filter(f => f.type !== 'checkbox' && !isBooleanRadio(f))
      .map(f => `${f.name} (${f.type})`);
    expect(offenders).toEqual([]);
  });
});

describe('Briefing Schema-Sync (Formatter <-> Migration)', () => {
  const sql = readFileSync(MIGRATION_PATH, 'utf8');
  const columns = extractColumns(sql);
  const META = new Set([
    'id', 'unternehmen_id', 'marke_id', 'assignee_id',
    'is_draft', 'created_at', 'updated_at'
  ]);

  it('jeder Formatter-Feldname existiert als Spalte', () => {
    const missing = CAMPAIGN_BRIEFING_FIELD_NAMES.filter((name) => !columns.has(name));
    expect(missing).toEqual([]);
  });

  it('jede Inhalts-Spalte der Migration ist im Formatter bekannt', () => {
    const contentCols = [...columns].filter((name) => !META.has(name));
    const known = new Set(CAMPAIGN_BRIEFING_FIELD_NAMES);
    const missing = contentCols.filter((name) => !known.has(name));
    expect(missing).toEqual([]);
  });
});
