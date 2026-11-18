// JPEG-Bilder aus einem PDF, ohne die Seiten zu rendern.
// Viele Word-PDFs betten Fotos als JPEG ein. Winzige Marker werden verworfen.

const MIN_BYTES = 4000;
const MAX_BILDER = 12;

function jpegAusPdf(buffer) {
  const bytes = Buffer.isBuffer(buffer) ? buffer : Buffer.from(buffer);
  const bilder = [];
  let i = 0;
  while (i < bytes.length - 4 && bilder.length < MAX_BILDER) {
    if (bytes[i] !== 0xff || bytes[i + 1] !== 0xd8 || bytes[i + 2] !== 0xff) {
      i += 1;
      continue;
    }
    let ende = -1;
    for (let j = i + 3; j < bytes.length - 1; j += 1) {
      if (bytes[j] === 0xff && bytes[j + 1] === 0xd9) {
        ende = j + 2;
        break;
      }
    }
    if (ende < 0) break;
    const stueck = bytes.subarray(i, ende);
    if (stueck.length >= MIN_BYTES) bilder.push(stueck);
    i = ende;
  }
  return bilder;
}

function pdfIstGeschuetzt(buffer) {
  const kopf = buffer.subarray(0, Math.min(buffer.length, 64 * 1024)).toString('latin1');
  return kopf.includes('/Encrypt');
}

module.exports = { jpegAusPdf, pdfIstGeschuetzt };
