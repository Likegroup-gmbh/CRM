/**
 * Netlify Function: backfill-thumbnails
 *
 * Einmalige Funktion zum Erzeugen von 128px WebP-Thumbnails für alle
 * bestehenden Logos und Profilbilder. Schreibt die Thumb-URL + -Path
 * in die neuen DB-Spalten (logo_thumb_url, profile_image_thumb_url, etc.).
 *
 * Aufruf: POST /.netlify/functions/backfill-thumbnails
 * Optional: ?table=unternehmen  (nur eine Tabelle bearbeiten)
 *           ?dryRun=true         (nur zählen, nicht hochladen)
 */

const { createClient } = require('@supabase/supabase-js');
const sharp = require('sharp');

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

const THUMB_SIZE = 128;
const WEBP_QUALITY = 85;

const ENTITY_CONFIG = [
  {
    table: 'unternehmen',
    bucket: 'logos',
    urlField: 'logo_url',
    pathField: 'logo_path',
    thumbUrlField: 'logo_thumb_url',
    thumbPathField: 'logo_thumb_path',
    fileName: 'logo'
  },
  {
    table: 'marke',
    bucket: 'logos',
    urlField: 'logo_url',
    pathField: 'logo_path',
    thumbUrlField: 'logo_thumb_url',
    thumbPathField: 'logo_thumb_path',
    fileName: 'logo'
  },
  {
    table: 'ansprechpartner',
    bucket: 'ansprechpartner-images',
    urlField: 'profile_image_url',
    pathField: 'profile_image_path',
    thumbUrlField: 'profile_image_thumb_url',
    thumbPathField: 'profile_image_thumb_path',
    fileName: 'profile'
  },
  {
    table: 'benutzer',
    bucket: 'ansprechpartner-images',
    urlField: 'profile_image_url',
    pathField: 'profile_image_path',
    thumbUrlField: 'profile_image_thumb_url',
    thumbPathField: 'profile_image_thumb_path',
    fileName: 'profile'
  }
];

async function processEntity(supabase, config, dryRun) {
  const { table, bucket, urlField, pathField, thumbUrlField, thumbPathField, fileName } = config;

  const { data: rows, error } = await supabase
    .from(table)
    .select(`id, ${urlField}, ${pathField}, ${thumbUrlField}`)
    .not(urlField, 'is', null)
    .is(thumbUrlField, null);

  if (error) {
    console.error(`❌ ${table}: Fehler beim Laden:`, error.message);
    return { table, total: 0, processed: 0, errors: 0, skipped: 0 };
  }

  const total = rows?.length || 0;
  console.log(`📋 ${table}: ${total} Einträge ohne Thumb gefunden`);

  if (dryRun || total === 0) {
    return { table, total, processed: 0, errors: 0, skipped: 0 };
  }

  let processed = 0;
  let errors = 0;
  let skipped = 0;

  for (const row of rows) {
    try {
      const storagePath = row[pathField];
      if (!storagePath) {
        skipped++;
        continue;
      }

      // Original aus Storage laden
      const { data: fileData, error: dlError } = await supabase.storage
        .from(bucket)
        .download(storagePath);

      if (dlError || !fileData) {
        console.warn(`⚠️ ${table}/${row.id}: Download fehlgeschlagen:`, dlError?.message);
        errors++;
        continue;
      }

      // Zu Buffer konvertieren und mit sharp auf 128px resizen
      const buffer = Buffer.from(await fileData.arrayBuffer());
      const thumbBuffer = await sharp(buffer)
        .resize(THUMB_SIZE, THUMB_SIZE, { fit: 'inside', withoutEnlargement: true })
        .webp({ quality: WEBP_QUALITY })
        .toBuffer();

      // Thumb-Path: neben dem Original ablegen
      const dir = storagePath.substring(0, storagePath.lastIndexOf('/'));
      const thumbPath = dir ? `${dir}/${fileName}_thumb.webp` : `${row.id}/${fileName}_thumb.webp`;

      // Upload
      const { error: upError } = await supabase.storage
        .from(bucket)
        .upload(thumbPath, thumbBuffer, {
          cacheControl: '31536000',
          upsert: true,
          contentType: 'image/webp'
        });

      if (upError) {
        console.warn(`⚠️ ${table}/${row.id}: Upload fehlgeschlagen:`, upError.message);
        errors++;
        continue;
      }

      // Public URL holen
      const { data: urlData } = supabase.storage
        .from(bucket)
        .getPublicUrl(thumbPath);

      const thumbUrl = urlData?.publicUrl || '';

      // DB-Update
      const { error: dbError } = await supabase
        .from(table)
        .update({
          [thumbUrlField]: thumbUrl,
          [thumbPathField]: thumbPath
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
      console.error(`❌ ${table}/${row.id}: Unerwarteter Fehler:`, e.message);
      errors++;
    }
  }

  console.log(`✅ ${table}: ${processed} Thumbs erstellt, ${errors} Fehler, ${skipped} übersprungen`);
  return { table, total, processed, errors, skipped };
}

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: JSON.stringify({ error: 'POST only' }) };
  }

  if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'SUPABASE_URL und SUPABASE_SERVICE_ROLE_KEY müssen gesetzt sein' })
    };
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
  const params = event.queryStringParameters || {};
  const dryRun = params.dryRun === 'true';
  const onlyTable = params.table || null;

  console.log(`🚀 Backfill gestartet (dryRun=${dryRun}, table=${onlyTable || 'alle'})`);

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
    const result = await processEntity(supabase, config, dryRun);
    results.push(result);
  }

  const summary = {
    dryRun,
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
