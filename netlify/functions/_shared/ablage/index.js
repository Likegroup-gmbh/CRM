// _shared/ablage/index.js
// Verdrahtung aus der Env: Service-Client, Token-Quelle (Zertifikat aus dem Vault),
// SharePoint-Client, Ordner-Register, Rechte. Pro warmer Instanz einmal (Token-Cache).

const { serviceClient, sharePointKonfig, istKonfiguriert } = require('./konfig');
const { createTokenQuelle, ladeZertifikat } = require('./graph-auth');
const { createSharePoint } = require('./sharepoint');
const { createSpRechte } = require('./sp-rechte');
const { createOrdner } = require('./ordner');

let _ablage = null;

/** null, wenn SharePoint nicht konfiguriert ist (dann gilt ueberall Dropbox). */
function ablageAusEnv({ supabase = serviceClient(), konfig = sharePointKonfig() } = {}) {
  if (!supabase || !istKonfiguriert(konfig)) return null;
  if (_ablage && _ablage.supabase === supabase && _ablage.konfig.driveId === konfig.driveId) return _ablage;
  const zertifikat = () => ladeZertifikat({ supabase });
  const tokenQuelle = createTokenQuelle({ konfig, zertifikat });
  const sp = createSharePoint({ konfig, tokenQuelle });
  const ordner = createOrdner({ supabase, sp });
  let rechte = null;
  _ablage = {
    konfig,
    supabase,
    sp,
    ordner,
    tokenQuelle,
    zertifikat,
    get rechte() {
      if (!rechte) rechte = createSpRechte({ konfig, tokenQuelle });
      return rechte;
    },
  };
  return _ablage;
}

function _reset() {
  _ablage = null;
}

module.exports = { ablageAusEnv, _reset };
