/**
 * Netlify Function: backfill-webp-originals
 *
 * Konvertiert bestehende Original-Bilder (JPG/PNG) in Supabase Storage zu WebP.
 * Läd Original herunter, konvertiert mit sharp, lädt .webp neben das Original
 * und schwenkt die DB-Spalten (*_url, *_path) auf die neue Datei um.
 * Alte JPGs bleiben im Bucket liegen (Fallback / Rollback-Möglichkeit).
 *
 * Aufruf: POST /.netlify/functions/backfill-webp-originals
 * Optional:
 *   ?table=marke   - nur eine Tabelle bearbeiten
 *   ?dryRun=true   - nur zählen, nicht konvertieren
 *   ?limit=50      - Anzahl Rows pro Aufruf (Default 100), resumable
 */

const { createClient } = require('@supabase/supabase-js');
const sharp = require('sharp');

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY;

const WEBP_QUALITY = 85;
const DEFAULT_LIMIT = 100;

const ENTITY_CONFIG = [
  {
    table: 'unternehmen',
    bucket: 'logos',
    urlField: 'logo_url',
    pathField: 'logo_path'
  },
  {
    table: 'marke',
    bucket: 'logos',
    urlField: 'logo_url',
    pathField: 'logo_path'
  },
  {
    table: 'ansprechpartner',
    bucket: 'ansprechpartner-images',
    urlField: 'profile_image_url',
    pathField: 'profile_image_path'
  },
  {
    table: 'benutzer',
    bucket: 'ansprechpartner-images',
    urlField: 'profile_image_url',
    pathField: 'profile_image_path'
  }
];

function toWebpPath(oldPath) {
  // Extension austauschen, Rest (Verzeichnis + Basename) bleibt
  const dotIdx = oldPath.lastIndexOf('.');
  const slashIdx = oldPath.lastIndexOf('/');
  if (dotIdx > slashIdx && dotIdx !== -1) {
    return `${oldPath.substring(0, dotIdx)}.webp`;
  }
  return `${oldPath}.webp`;
}

async function processEntity(supabase, config, { dryRun, limit }) {
  const { table, bucket, urlField, pathField } = config;

  // Nur Rows, deren Path NICHT bereits auf .webp endet -> idempotent
  const { data: rows, error } = await supabase
    .from(table)
    .select(`id, ${urlField}, ${pathField}`)
    .not(urlField, 'is', null)
    .not(pathField, 'is', null)
    .not(pathField, 'ilike', '%.webp')
    .limit(limit);

  if (error) {
    console.error(`❌ ${table}: Fehler beim Laden:`, error.message);
    return { table, total: 0, processed: 0, errors: 0, skipped: 0 };
  }

  const total = rows?.length || 0;
  console.log(`📋 ${table}: ${total} Einträge mit Nicht-WebP-Original gefunden`);

  if (dryRun || total === 0) {
    return { table, total, processed: 0, errors: 0, skipped: 0 };
  }

  let processed = 0;
  let errors = 0;
  let skipped = 0;

  for (const row of rows) {
    const oldPath = row[pathField];
    try {
      if (!oldPath) {
        skipped++;
        continue;
      }

      // Original herunterladen
      const { data: fileData, error: dlError } = await supabase.storage
        .from(bucket)
        .download(oldPath);

      if (dlError || !fileData) {
        console.warn(`⚠️ ${table}/${row.id}: Download fehlgeschlagen (${oldPath}):`, dlError?.message);
        errors++;
        continue;
      }

      // Zu WebP konvertieren (Originalgröße beibehalten, nur Format ändern)
      const buffer = Buffer.from(await fileData.arrayBuffer());
      const webpBuffer = await sharp(buffer)
        .webp({ quality: WEBP_QUALITY })
        .toBuffer();

      // Neuer Pfad: alter Pfad mit .webp-Endung
      const newPath = toWebpPath(oldPath);

      // Upload (upsert falls .webp bereits existiert, z.B. aus Abbruch vorher)
      const { error: upError } = await supabase.storage
        .from(bucket)
        .upload(newPath, webpBuffer, {
          cacheControl: '31536000',
          upsert: true,
          contentType: 'image/webp'
        });

      if (upError) {
        console.warn(`⚠️ ${table}/${row.id}: Upload fehlgeschlagen (${newPath}):`, upError.message);
        errors++;
        continue;
      }

      // Public URL holen
      const { data: urlData } = supabase.storage
        .from(bucket)
        .getPublicUrl(newPath);

      const newUrl = urlData?.publicUrl || '';
      if (!newUrl) {
        console.warn(`⚠️ ${table}/${row.id}: Keine Public-URL für ${newPath}`);
        errors++;
        continue;
      }

      // DB-Spalten auf neue Datei umschwenken
      const { error: dbError } = await supabase
        .from(table)
        .update({
          [urlField]: newUrl,
          [pathField]: newPath
        })
        .eq('id', row.id);

      if (dbError) {
        console.warn(`⚠️ ${table}/${row.id}: DB-Update fehlgeschlagen:`, dbError.message);
        errors++;
        continue;
      }

      processed++;
      if (processed % 10 === 0) {
        console.log(`  ✅ ${table}: ${processed}/${total} verarbeitet`);
      }
    } catch (e) {
      console.error(`❌ ${table}/${row.id} (${oldPath}): Unerwarteter Fehler:`, e.message);
      errors++;
    }
  }

  console.log(`✅ ${table}: ${processed} konvertiert, ${errors} Fehler, ${skipped} übersprungen`);
  return { table, total, processed, errors, skipped };
}

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: JSON.stringify({ error: 'POST only' }) };
  }

  if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'SUPABASE_URL und SUPABASE_SERVICE_ROLE_KEY (oder SUPABASE_SERVICE_KEY) müssen gesetzt sein' })
    };
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
  const params = event.queryStringParameters || {};
  const dryRun = params.dryRun === 'true';
  const onlyTable = params.table || null;
  const limit = Math.max(1, Math.min(500, parseInt(params.limit, 10) || DEFAULT_LIMIT));

  console.log(`🚀 WebP-Backfill gestartet (dryRun=${dryRun}, table=${onlyTable || 'alle'}, limit=${limit})`);

  const configs = onlyTable
    ? ENTITY_CONFIG.filter(c => c.table === onlyTable)
    : ENTITY_CONFIG;

  if (configs.length === 0) {
    return {
      statusCode: 400,
      body: JSON.stringify({ error: `Unbekannte Tabelle: ${onlyTable}` })
    };
  }

  const results = [];
  for (const config of configs) {
    const result = await processEntity(supabase, config, { dryRun, limit });
    results.push(result);
  }

  const summary = {
    dryRun,
    limit,
    results,
    totals: {
      total: results.reduce((s, r) => s + r.total, 0),
      processed: results.reduce((s, r) => s + r.processed, 0),
      errors: results.reduce((s, r) => s + r.errors, 0),
      skipped: results.reduce((s, r) => s + r.skipped, 0)
    }
  };

  console.log('📊 Zusammenfassung:', JSON.stringify(summary.totals));

  return {
    statusCode: 200,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(summary, null, 2)
  };
};
