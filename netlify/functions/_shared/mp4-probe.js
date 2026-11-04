// mp4-probe.js
// MP4 (ISO-BMFF) gerade so weit lesen, wie die Vorschaudatei es braucht: Codec,
// Aufloesung, Bildrate, Dauer und ob die moov-Box vor den Daten liegt (Faststart,
// sonst muss der Browser vor dem ersten Bild ans Dateiende springen).
// Reicht ein Anfangsstueck der Datei, solange die moov-Box darin vollstaendig ist.

function boxes(buf, start, end) {
  const out = [];
  let p = start;
  while (p + 8 <= end) {
    let size = buf.readUInt32BE(p);
    const type = buf.toString('latin1', p + 4, p + 8);
    let header = 8;
    if (size === 1) {
      if (p + 16 > end) break;
      size = Number(buf.readBigUInt64BE(p + 8));
      header = 16;
    } else if (size === 0) {
      size = end - p;
    }
    if (size < header) break;
    const truncated = p + size > end;
    out.push({ type, at: p, start: p + header, end: Math.min(p + size, end), size, truncated });
    if (truncated) break;
    p += size;
  }
  return out;
}

const child = (buf, box, type) => (box && !box.truncated
  ? boxes(buf, box.start, box.end).find((b) => b.type === type && !b.truncated)
  : null);

/**
 * @param {Buffer} buf Datei oder Anfangsstueck
 * @param {number} [totalBytes] Gesamtgroesse (fuer die Bitrate bei einem Anfangsstueck)
 * @returns {{ codec, breite, hoehe, fps, dauer, kbps, faststart } | { fehler: string }}
 */
function probeMp4(buf, totalBytes = buf.length) {
  const top = boxes(buf, 0, buf.length);
  const moov = top.find((b) => b.type === 'moov');
  const mdat = top.find((b) => b.type === 'mdat');
  if (!moov || moov.truncated) return { fehler: 'moov fehlt oder unvollstaendig' };
  for (const trak of boxes(buf, moov.start, moov.end).filter((b) => b.type === 'trak')) {
    const mdia = child(buf, trak, 'mdia');
    const hdlr = child(buf, mdia, 'hdlr');
    if (!hdlr || buf.toString('latin1', hdlr.start + 8, hdlr.start + 12) !== 'vide') continue;
    const tkhd = child(buf, trak, 'tkhd');
    const mdhd = child(buf, mdia, 'mdhd');
    const stbl = child(buf, child(buf, mdia, 'minf'), 'stbl');
    const stts = child(buf, stbl, 'stts');
    const stsd = child(buf, stbl, 'stsd');
    if (!tkhd || !mdhd || !stts || !stsd) return { fehler: 'Videospur unvollstaendig' };

    const wOff = tkhd.start + (buf[tkhd.start] === 1 ? 88 : 76);
    const v1 = buf[mdhd.start] === 1;
    const timescale = buf.readUInt32BE(mdhd.start + (v1 ? 20 : 12));
    const units = v1 ? Number(buf.readBigUInt64BE(mdhd.start + 24)) : buf.readUInt32BE(mdhd.start + 16);
    let samples = 0;
    const n = buf.readUInt32BE(stts.start + 4);
    for (let i = 0; i < n; i += 1) samples += buf.readUInt32BE(stts.start + 8 + i * 8);
    const dauer = timescale ? units / timescale : 0;
    return {
      codec: buf.toString('latin1', stsd.start + 12, stsd.start + 16),
      breite: Math.round(buf.readUInt32BE(wOff) / 65536),
      hoehe: Math.round(buf.readUInt32BE(wOff + 4) / 65536),
      fps: dauer ? Math.round((samples / dauer) * 1000) / 1000 : null,
      dauer: Math.round(dauer * 1000) / 1000,
      kbps: dauer ? Math.round((totalBytes * 8) / dauer / 1000) : null,
      faststart: !!mdat && moov.at < mdat.at,
    };
  }
  return { fehler: 'keine Videospur' };
}

module.exports = { probeMp4 };
