// _shared/ablage/creator.js
// Creator-Upload (Token-Seite) direkt nach SharePoint: Upload-Session mit deferCommit im
// Zielordner, kein Staging-Bucket. Erst complete schaltet die Datei frei, nachdem Groesse und
// Feedbackschleife geprueft sind; vorher sieht sie niemand (auch nicht der Delta-Feed).

const crypto = require('crypto');
const cu = require('../creator-upload');
const { CHUNK_BYTES } = require('./konfig');
const { zielFuerKooperation } = require('./ziel');
const { dropboxUpload } = require('./schalter');
const { dateiname, kampagnenName, MAX_PFAD } = require('./pfad');
const { dateiSpalten, fachSpalten, upsert } = require('./asset');
const { AblageFehler } = require('./http');

const ASSET_TYP = { video: 'video', story: 'story', bilder: 'still', rohmaterial: 'roh' };
// Bilder liegen in der Runde eines Videos, einen Bilder-Ordner der Kooperation gibt es nicht
const LINK_SPALTE = {
  video: (job) => ({ tabelle: 'kooperation_videos', spalte: 'folder_url', id: job.target_id }),
  story: (job, t) => ({ tabelle: 'kooperation_videos', spalte: 'story_folder_url', id: t.video.id }),
};

const linkUngueltig = () => new AblageFehler(404, 'Link ungültig oder abgelaufen');

function createCreatorAblage({ supabase, ablage, jetzt = () => new Date() }) {
  const sp = ablage?.sp;
  const driveId = sp?.driveId;
  const stand = () => jetzt().toISOString();

  async function jobSetzen(id, felder) {
    await supabase.from('creator_upload_job').update({ ...felder, updated_at: stand() }).eq('id', id);
  }

  async function dateiName(tokenRow, targetCtx, koop, targetType, fileName, version, ext, ordnerPfad) {
    const max = Math.max(20, Math.min(100, MAX_PFAD - 60 - String(ordnerPfad || '').length));
    if (!cu.isVersionedTarget(targetType)) return dateiname(fileName, max) || `datei.${ext}`;
    const p = await cu.loadPathContext(supabase, tokenRow, targetCtx.koop.id);
    // Kampagne nach der einen Namensregel (wie der Ordner), nicht nach loadPathContext
    const kampagne = kampagnenName(koop.kampagne);
    return dateiname(cu.buildVersionedFileName(p.creatorName, p.unternehmen, kampagne, targetCtx.video?.position || 1, version, ext), max);
  }

  function kontext(targetType, targetCtx, version) {
    return {
      typ: ASSET_TYP[targetType],
      kooperation_id: targetCtx.koop.id,
      kooperation_video_id: targetCtx.video?.id || null,
      story_id: targetCtx.story?.id || null,
      version_number: version || 1,
      is_final: false,
      variant_name: null,
    };
  }

  async function altJobsFreigeben(targetType, targetId) {
    if (!cu.holdsInFlightLock(targetType)) return;
    const { data: aktiv } = await supabase.from('creator_upload_job')
      .select('id, status, created_at, staging_key, ablage, upload_url')
      .eq('target_type', targetType).eq('target_id', targetId).in('status', ['pending', 'processing']);
    for (const alt of aktiv || []) {
      const stale = alt.status === 'pending' || Date.now() - new Date(alt.created_at).getTime() > 60 * 60 * 1000;
      if (!stale) continue;
      await jobSetzen(alt.id, { status: 'aborted', error: 'Verworfen — neuer Upload gestartet' });
      if (alt.ablage === 'sharepoint' && alt.upload_url) await sp?.sessionVerwerfen(alt.upload_url).catch(() => {});
      else await cu.deleteStagingObject(supabase, alt.staging_key);
    }
  }

  // ─── ablage-creator-start ───────────────────────────────────

  async function start(body) {
    // Die Seite nimmt dann den TUS-Weg ueber creator-upload-start, der den Token selbst prueft
    if (dropboxUpload()) return { ziel: 'dropbox' };
    const { token, targetType, targetId, fileName, fileSize, contentType } = body;
    if (!cu.isKnownTarget(targetType) || !targetId) throw new AblageFehler(400, 'Ungueltiges Ziel');
    const tokenRow = await cu.resolveToken(supabase, token);
    if (!tokenRow) throw linkUngueltig();
    const targetCtx = await cu.resolveTarget(supabase, tokenRow, targetType, targetId);
    if (!targetCtx) throw linkUngueltig();

    const { ziel, koop } = await zielFuerKooperation(supabase, targetCtx.koop.id);
    if (ziel !== 'sharepoint' || !sp || !koop) return { ziel: 'dropbox' };

    const check = cu.validateFile(targetType, fileName, fileSize, contentType);
    if (!check.ok) throw new AblageFehler(400, check.error, check.code);
    if (!(await cu.checkJobRateLimit(supabase, tokenRow.id))) {
      throw new AblageFehler(429, 'Zu viele Uploads. Bitte später erneut versuchen.', 'rate_limited');
    }

    let version = null;
    if (cu.isVersionedTarget(targetType)) {
      version = await cu.nextVersionNumber(supabase, targetType, targetId);
      if (version == null) throw new AblageFehler(409, 'Alle Feedbackschleifen sind bereits belegt', 'fs_full');
    }
    await altJobsFreigeben(targetType, targetId);

    const ctx = kontext(targetType, targetCtx, version);
    const { ordner, link, kooperation_video_id: videoId } = await ablage.ordner.zielOrdner(ctx, { koop });
    // Creator-Bilder haengen an der Kooperation: im Ordner des ersten Videos, also auch an ihm
    if (ctx.typ === 'still' && !ctx.kooperation_video_id) ctx.kooperation_video_id = videoId || null;
    const name = await dateiName(tokenRow, targetCtx, koop, targetType, fileName, version, check.ext, ordner.pfad);
    const session = await sp.uploadSession(ordner.item_id, name, { conflict: 'rename', deferCommit: true });
    const linkUrl = link ? (await sp.item(link.item_id, 'id,webUrl'))?.webUrl || null : null;

    const { data: job, error } = await supabase.from('creator_upload_job').insert({
      token_id: tokenRow.id,
      target_type: targetType,
      target_id: targetId,
      staging_key: `sp:${crypto.randomUUID()}`,
      version_number: version,
      file_name: String(fileName || 'datei').slice(0, 255),
      file_size: Number(fileSize),
      content_type: check.contentType,
      status: 'pending',
      ablage: 'sharepoint',
      upload_url: session.uploadUrl,
      ablage_kontext: { ...ctx, drive_id: driveId, parent_item_id: ordner.item_id, ordner_pfad: ordner.pfad, name, link_url: linkUrl },
    }).select('id').single();
    if (error) {
      await sp.sessionVerwerfen(session.uploadUrl).catch(() => {});
      if (error.code === '23505') throw new AblageFehler(409, 'Für dieses Ziel läuft bereits ein Upload', 'in_flight');
      throw error;
    }

    return { ziel: 'sharepoint', jobId: job.id, uploadUrl: session.uploadUrl, chunkBytes: CHUNK_BYTES, versionNumber: version };
  }

  // ─── ablage-creator-complete ────────────────────────────────

  async function freieVersion(job) {
    if (!cu.isVersionedTarget(job.target_type)) return null;
    const tabelle = job.target_type === 'video' ? 'kooperation_video_asset' : 'kooperation_story_asset';
    const fk = job.target_type === 'video' ? 'video_id' : 'story_id';
    const { data } = await supabase.from(tabelle).select('id').eq(fk, job.target_id)
      .eq('version_number', job.version_number).eq('is_final', false).limit(1);
    if (!data?.length) return job.version_number;
    const next = await cu.nextVersionNumber(supabase, job.target_type, job.target_id);
    if (next == null) throw new AblageFehler(409, 'Alle Feedbackschleifen sind inzwischen belegt', 'fs_full');
    return next;
  }

  async function complete(body) {
    const tokenRow = await cu.resolveToken(supabase, body.token);
    if (!tokenRow) throw linkUngueltig();
    const { data: job, error } = await supabase.from('creator_upload_job').select('*')
      .eq('id', body.jobId).eq('token_id', tokenRow.id).maybeSingle();
    if (error) throw error;
    if (!job) throw new AblageFehler(404, 'Upload nicht gefunden');
    if (job.status === 'done') return { status: 'done', versionNumber: job.version_number };
    if (job.ablage !== 'sharepoint' || !job.upload_url) throw new AblageFehler(400, 'Upload läuft über einen anderen Weg');
    if (job.status !== 'pending') throw new AblageFehler(409, 'Upload wird bereits verarbeitet');
    if (!sp) throw new AblageFehler(503, 'Medienablage ist nicht eingerichtet', 'nicht_konfiguriert');

    const targetCtx = await cu.resolveTarget(supabase, tokenRow, job.target_type, job.target_id);
    if (!targetCtx) {
      await jobSetzen(job.id, { status: 'aborted', error: 'Ziel nicht mehr verfuegbar' });
      await sp.sessionVerwerfen(job.upload_url).catch(() => {});
      throw linkUngueltig();
    }

    // Claim: Doppelklick oder zweiter Tab committen nicht doppelt
    const { data: claim } = await supabase.from('creator_upload_job')
      .update({ status: 'processing', updated_at: stand() }).eq('id', job.id).eq('status', 'pending').select('id');
    if (!claim?.length) throw new AblageFehler(409, 'Upload wird bereits verarbeitet');

    const k = job.ablage_kontext || {};
    let item = null;
    try {
      const status = await sp.sessionStatus(job.upload_url);
      if (status) {
        if ((status.nextExpectedRanges || []).length) {
          await jobSetzen(job.id, { status: 'pending' });
          throw new AblageFehler(400, 'Datei nicht vollständig hochgeladen', 'unvollstaendig');
        }
        item = await sp.sessionAbschliessen(job.upload_url);
      } else if (body.itemId) {
        // Session schon weg: frueherer Commit, dessen Antwort verloren ging
        item = await sp.item(body.itemId);
      }
      if (!item?.id) throw new AblageFehler(400, 'Datei nicht hochgeladen');
      if (item.parentReference?.id && k.parent_item_id && item.parentReference.id !== k.parent_item_id) {
        throw new AblageFehler(409, 'Datei liegt nicht im Zielordner');
      }
      if (Number(item.size) !== Number(job.file_size)) {
        await sp.loeschen(item.id).catch(() => {});
        throw new AblageFehler(400, 'Datei unvollständig angekommen, bitte erneut hochladen', 'groesse');
      }

      // Staff kann die Schleife inzwischen belegt haben: in die naechste freie verschieben
      const version = await freieVersion(job);
      let ordnerPfad = k.ordner_pfad;
      if (version && version !== job.version_number) {
        const { ordner } = await ablage.ordner.zielOrdner({ ...k, version_number: version });
        item = { ...item, ...(await sp.verschieben(item.id, ordner.item_id, { conflict: 'rename' })) };
        ordnerPfad = ordner.pfad;
      }

      const typ = ASSET_TYP[job.target_type];
      const werte = {
        ...dateiSpalten(item, { driveId, pfad: `${ordnerPfad}/${item.name}` }),
        ...fachSpalten(typ, { ...k, version_number: version || 1, folder_url: k.link_url }),
      };
      const { row } = await upsert(supabase, typ, werte, { uploadedBy: null, jetzt: stand() });

      const ls = LINK_SPALTE[job.target_type]?.(job, targetCtx);
      if (ls && k.link_url) await supabase.from(ls.tabelle).update({ [ls.spalte]: k.link_url }).eq('id', ls.id);

      await jobSetzen(job.id, { status: 'done', item_id: item.id, asset_id: row.id, version_number: version ?? job.version_number, error: null });
      return { status: 'done', versionNumber: version ?? job.version_number };
    } catch (err) {
      if (!(err instanceof AblageFehler && err.code === 'unvollstaendig')) {
        await jobSetzen(job.id, { status: 'failed', item_id: item?.id || null, error: String(err.message || err).slice(0, 500) });
      }
      throw err;
    }
  }

  return { start, complete };
}

module.exports = { createCreatorAblage, ASSET_TYP };
