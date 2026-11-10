// _shared/ablage/sp-rechte.js
// Rollen und Vererbung ueber die SharePoint-REST-API (Graph kann weder eigene
// Berechtigungsstufen noch Vererbung unterbrechen). Gleiches Zertifikat, Scope = Tenant-Host.

const { sharePointKonfig } = require('./konfig');
const { createHttp } = require('./graph');
const { createTokenQuelle, scopeFuerSharePoint } = require('./graph-auth');

const ROLLE_OHNE_LOESCHEN = 'Bearbeiten ohne Löschen';
// Mitwirken (High 432, Low 0x3C431AEF) ohne DeleteListItems (0x8) und DeleteVersions (0x80)
const OHNE_LOESCHEN_RECHTE = { High: '432', Low: '1011030631' };

// SP.RoleType
const ROLLEN_TYP = { gast: 1, leser: 2, mitwirken: 3, design: 4, admin: 5, bearbeiten: 6 };

const LOGIN_PREFIX = 'i:0#.f|membership|';

const VERBOSE = 'application/json;odata=verbose';
const NOMETA = 'application/json;odata=nometadata';

function loginFuer(konto) {
  return `${LOGIN_PREFIX}${String(konto || '').trim().toLowerCase()}`;
}

function kontoAusLogin(login) {
  const s = String(login || '');
  return s.startsWith(LOGIN_PREFIX) ? s.slice(LOGIN_PREFIX.length).toLowerCase() : null;
}

/**
 * @param {object} deps
 * @param {string} deps.listeId GUID der Bibliothek "Videos"
 */
function createSpRechte({
  konfig = sharePointKonfig(),
  tokenQuelle,
  http,
  fetchImpl = (...a) => fetch(...a),
  schlafen,
  siteUrl = konfig.siteUrl,
} = {}) {
  const quelle = tokenQuelle || createTokenQuelle({ konfig, fetchImpl });
  const scope = scopeFuerSharePoint(new URL(siteUrl).host);
  const rest = http || createHttp({
    token: (o) => quelle(scope, o),
    basis: `${siteUrl}/_api`,
    fetchImpl,
    schlafen,
    standardHeader: { Accept: NOMETA },
  });

  const lesen = (pfad) => rest.get(pfad);
  const schreiben = (pfad, body) => rest.anfrage(pfad, {
    method: 'POST',
    headers: { Accept: NOMETA, 'Content-Type': VERBOSE },
    rawBody: body === undefined ? '' : JSON.stringify(body),
  });

  const scopePfad = (listeId, listItemId) => (listItemId
    ? `/web/lists(guid'${listeId}')/items(${Number(listItemId)})`
    : `/web/lists(guid'${listeId}')`);

  let _rollen = null;

  return {
    async rollen() {
      if (_rollen) return _rollen;
      const res = await lesen('/web/roledefinitions?$select=Id,Name,RoleTypeKind,Hidden');
      _rollen = res?.value || [];
      return _rollen;
    },

    /** Stellt die Stufe "Bearbeiten ohne Loeschen" sicher und liefert die IDs aller drei Stufen. */
    async stufen() {
      let rollen = await this.rollen();
      let ohne = rollen.find((r) => r.Name === ROLLE_OHNE_LOESCHEN);
      if (!ohne) {
        await schreiben('/web/roledefinitions', {
          __metadata: { type: 'SP.RoleDefinition' },
          BasePermissions: { __metadata: { type: 'SP.BasePermissions' }, ...OHNE_LOESCHEN_RECHTE },
          Name: ROLLE_OHNE_LOESCHEN,
          Description: 'Hochladen und bearbeiten, aber nicht loeschen (CRM-Medienablage)',
          Order: 160,
        });
        _rollen = null;
        rollen = await this.rollen();
        ohne = rollen.find((r) => r.Name === ROLLE_OHNE_LOESCHEN);
      }
      const leser = rollen.find((r) => r.RoleTypeKind === ROLLEN_TYP.leser);
      const mitwirken = rollen.find((r) => r.RoleTypeKind === ROLLEN_TYP.mitwirken);
      if (!ohne || !leser || !mitwirken) throw new Error('SharePoint-Berechtigungsstufen unvollstaendig');
      return { lesen: leser.Id, ohne_loeschen: ohne.Id, bearbeiten: mitwirken.Id };
    },

    /** ensureuser: Benutzer in der Site bekannt machen, liefert die Principal-ID. Unbekanntes Konto -> null. */
    async benutzer(konto) {
      try {
        const res = await schreiben('/web/ensureuser', { logonName: loginFuer(konto) });
        return res?.Id ?? null;
      } catch (err) {
        if (err.status === 400 || err.status === 404) return null;
        throw err;
      }
    },

    async hatEigeneRechte(listeId, listItemId) {
      const res = await lesen(`${scopePfad(listeId, listItemId)}?$select=HasUniqueRoleAssignments`);
      return !!res?.HasUniqueRoleAssignments;
    },

    /** Vererbung unterbrechen, ohne Rechte zu kopieren; Unter-Scopes bleiben. */
    async vererbungUnterbrechen(listeId, listItemId) {
      await schreiben(`${scopePfad(listeId, listItemId)}/breakroleinheritance(copyRoleAssignments=false,clearSubscopes=false)`);
    },

    async vererbungWiederherstellen(listeId, listItemId) {
      await schreiben(`${scopePfad(listeId, listItemId)}/resetroleinheritance`);
    },

    /** Ist-Zustand: [{ principalId, login, konto, typ, rollen:[{id, typ}] }] */
    async zuweisungen(listeId, listItemId) {
      const res = await lesen(`${scopePfad(listeId, listItemId)}/roleassignments?$expand=Member,RoleDefinitionBindings&$select=PrincipalId,Member/LoginName,Member/PrincipalType,RoleDefinitionBindings/Id,RoleDefinitionBindings/RoleTypeKind`);
      return (res?.value || []).map((ra) => ({
        principalId: ra.PrincipalId,
        login: ra.Member?.LoginName || '',
        konto: kontoAusLogin(ra.Member?.LoginName),
        typ: ra.Member?.PrincipalType ?? null,
        rollen: (ra.RoleDefinitionBindings || []).map((b) => ({ id: b.Id, typ: b.RoleTypeKind })),
      }));
    },

    async zuweisen(listeId, listItemId, principalId, rolleId) {
      await schreiben(`${scopePfad(listeId, listItemId)}/roleassignments/addroleassignment(principalid=${Number(principalId)},roledefid=${Number(rolleId)})`);
    },

    async entziehen(listeId, listItemId, principalId, rolleId) {
      await schreiben(`${scopePfad(listeId, listItemId)}/roleassignments/removeroleassignment(principalid=${Number(principalId)},roledefid=${Number(rolleId)})`);
    },
  };
}

module.exports = {
  createSpRechte,
  loginFuer,
  kontoAusLogin,
  ROLLE_OHNE_LOESCHEN,
  OHNE_LOESCHEN_RECHTE,
  ROLLEN_TYP,
};
