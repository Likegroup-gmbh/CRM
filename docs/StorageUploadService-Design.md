# StorageUploadService – Interface Design

## 1. Interface-Signatur & vorkonfigurierte Profile

```javascript
// StorageUploadService.js

/**
 * Vorkonfigurierte Profile für 80% der Fälle.
 * Jedes Profil definiert: bucket, pathSchema, validation, dbMapping
 */
const PROFILES = {
  logo: {
    provider: 'supabase',
    bucket: 'logos',
    pathSchema: ({ entityType, entityId }) => `${entityType}/${entityId}/logo.{ext}`,
    maxSize: 500 * 1024,
    allowedTypes: ['image/jpeg', 'image/png'],
    db: { table: null, urlField: 'logo_url', pathField: 'logo_path' }, // table = entityType
    replaceExisting: true,
  },
  profile: {
    provider: 'supabase',
    bucket: 'profile-images',
    pathSchema: ({ userId }) => `${userId}/profile.{ext}`,
    maxSize: 500 * 1024,
    allowedTypes: ['image/jpeg', 'image/png'],
    db: { table: 'benutzer', urlField: 'profile_image_url', pathField: null },
    replaceExisting: true,
    resolveUserId: 'auth', // nutzt auth.getUser().id
  },
  profileAnsprechpartner: {
    provider: 'supabase',
    bucket: 'ansprechpartner-images',
    pathSchema: ({ ansprechpartnerId }) => `${ansprechpartnerId}/profile.{ext}`,
    maxSize: 500 * 1024,
    allowedTypes: ['image/jpeg', 'image/png'],
    db: { table: 'ansprechpartner', urlField: 'profile_image_url', pathField: 'profile_image_path' },
    replaceExisting: true,
  },
  signedContract: {
    provider: 'supabase',
    bucket: 'unterschriebene-vertraege',
    pathSchema: ({ vertragId }) => `${vertragId}/{timestamp}_{filename}`,
    maxSize: 10 * 1024 * 1024,
    allowedTypes: ['application/pdf'],
    db: { table: 'vertraege', urlField: 'unterschriebener_vertrag_url', pathField: 'unterschriebener_vertrag_path' },
    replaceExisting: true,
  },
  generatedContract: {
    provider: 'supabase',
    bucket: 'vertraege',
    pathSchema: ({ unternehmenId, vertragId, filename }) =>
      unternehmenId ? `unternehmen/${unternehmenId}/${vertragId}/${filename}` : `${vertragId}/${filename}`,
    validation: false, // generiert, keine Client-Validierung
    db: { table: 'vertraege', urlField: 'datei_url', pathField: 'datei_path' },
    replaceExisting: false,
  },
  briefingDocument: {
    provider: 'supabase',
    bucket: 'documents',
    pathSchema: ({ briefingId }) => `briefings/${briefingId}/{timestamp}_{random}_{filename}`,
    maxSize: 10 * 1024 * 1024,
    allowedTypes: ['image/png', 'image/gif', 'image/webp'],
    db: { table: 'briefing_documents', insertMode: true, urlField: 'file_url', pathField: 'file_path' },
    replaceExisting: false,
  },
  auftragsbestaetigung: {
    provider: 'supabase',
    bucket: 'auftragsbestaetigung',
    pathSchema: ({ auftragId }) => `${auftragId}/{timestamp}_{filename}`,
    db: { table: 'auftrag', urlField: 'auftragsbestaetigung_url', pathField: 'auftragsbestaetigung_path' },
    replaceExisting: false,
  },
  dropboxVideo: {
    provider: 'dropbox',
    netlifyFunction: '/.netlify/functions/dropbox-upload',
    pathSchema: null, // wird von Netlify Function berechnet
    maxSize: 500 * 1024 * 1024,
    allowedTypes: ['video/mp4', 'video/quicktime', 'video/x-msvideo', 'video/x-matroska', 'video/webm'],
    db: null, // Caller macht DB-Update selbst (kooperation_videos)
  },
};

/**
 * StorageUploadService
 * @param {Object} supabase - window.supabase (optional, nutzt window.supabase wenn nicht übergeben)
 */
class StorageUploadService {
  constructor(supabase = null) {
    this.supabase = supabase || (typeof window !== 'undefined' ? window.supabase : null);
  }

  /**
   * Standard-Upload: Profil + Kontext + Datei.
   * Trivialer Fall: 1–2 Zeilen.
   *
   * @param {string} profileName - Name aus PROFILES (z.B. 'logo', 'profile', 'signedContract')
   * @param {Object} context - IDs/Parameter für pathSchema (z.B. { entityType, entityId } oder { vertragId })
   * @param {File|Blob} file - Die Datei
   * @param {Object} [options] - Overrides (dbId, skipDbUpdate, customPath, …)
   * @returns {Promise<{ url: string, path: string }>}
   */
  async upload(profileName, context, file, options = {}) { /* ... */ }

  /**
   * Custom Upload ohne Profil (für Sonderfälle).
   * @param {Object} config - Vollständige Konfiguration
   */
  async uploadCustom(config) { /* ... */ }

  /**
   * Datei aus Storage löschen (optional mit DB-Clear).
   * @param {string} profileName
   * @param {Object} context - z.B. { vertragId } für signedContract
   * @param {string} [existingPath] - Falls bekannt, sonst aus DB geholt
   */
  async remove(profileName, context, existingPath = null) { /* ... */ }
}
```

---

## 2. Verwendungsbeispiele

### Trivialer Fall (1–2 Zeilen)

```javascript
import { storageUpload } from './core/StorageUploadService.js';

// Logo: Unternehmen oder Marke
await storageUpload.upload('logo', { entityType: 'unternehmen', entityId: uId }, file);

// Profilbild (Benutzer) – userId wird aus auth.getUser() geholt
await storageUpload.upload('profile', { userId: null }, file);  // oder explizit: { userId: authUserId }

// Unterschriebener Vertrag
await storageUpload.upload('signedContract', { vertragId }, file);

// Briefing-Dokument (Insert in briefing_documents)
await storageUpload.upload('briefingDocument', { briefingId }, file, { dbId: briefingId });
```

### Custom Case (mehr Zeilen, aber klar strukturiert)

```javascript
// Override einzelner Parameter
await storageUpload.upload('logo', { entityType: 'marke', entityId: mId }, file, {
  maxSize: 1024 * 1024,  // 1 MB statt 500 KB
});

// Ohne DB-Update (nur Storage)
const { url, path } = await storageUpload.upload('signedContract', { vertragId }, file, {
  skipDbUpdate: true,
});

// Vollständig custom
await storageUpload.uploadCustom({
  provider: 'supabase',
  bucket: 'custom-bucket',
  path: `custom/${id}/${file.name}`,
  file,
  db: { table: 'custom_table', urlField: 'file_url', pathField: 'file_path', id: customId },
});
```

### Dropbox (verboser, aber einheitlich)

```javascript
// Dropbox: Service orchestriert Token + Pfad + Upload; DB-Update macht Caller
const { url, path } = await storageUpload.upload('dropboxVideo', {
  unternehmen, marke, kampagne, kooperation, videoTitel, versionNumber, fileName
}, file);

await window.supabase.from('kooperation_videos').update({
  file_url: url,
  file_path: path,
  video_name: videoName,
}).eq('id', videoId);
```

---

## 3. Komplexität, die intern versteckt wird

| Schritt | Was passiert intern |
|--------|---------------------|
| **1. Profil auflösen** | `PROFILES[profileName]` + Merge mit `options` Overrides |
| **2. Kontext auflösen** | `resolveUserId: 'auth'` → `supabase.auth.getUser()` für userId |
| **3. Pfad berechnen** | `pathSchema(context)` mit Platzhaltern: `{ext}`, `{timestamp}`, `{filename}`, `{random}` |
| **4. Validierung** | `maxSize`, `allowedTypes` (außer `validation: false`) |
| **5. Replace existing** | `list()` im Pfad-Prefix → `remove()` aller Treffer |
| **6. Upload** | Supabase: `storage.from(bucket).upload(path, file, opts)` oder Dropbox: Token holen → XHR an content.dropboxapi.com |
| **7. Public URL** | Supabase: `getPublicUrl(path)`; Dropbox: `create_shared_link_with_settings` |
| **8. DB-Update** | `update()` oder `insert()` je nach `db.insertMode`; `db.table` aus Profil oder `context.entityType` (Logo) |
| **9. Fehlerbehandlung** | Einheitliche Fehlermeldungen, ggf. Retry-Logik für Dropbox-Token |

---

## 4. Dependency-Strategie

```
StorageUploadService
├── window.supabase (oder injiziert)
├── window.supabase.auth (für profile.resolveUserId)
└── fetch('/.netlify/functions/dropbox-upload') (nur bei dropboxVideo)
```

- **Kein neuer Build-Step**: Reines ES-Modul, kein Bundler nötig.
- **Lazy-Init**: `window.supabase` wird bei erstem Aufruf geprüft; Fehler klar melden.
- **Testbarkeit**: `new StorageUploadService(mockSupabase)` für Unit-Tests.
- **Globale Instanz**: `export const storageUpload = new StorageUploadService();` in `main.js` oder als Singleton.

---

## 5. Trade-offs

| Entscheidung | Pro | Contra |
|-------------|-----|--------|
| **Profile als Objekt** | Einfach erweiterbar, kein Switch-Code | Neue Profile = neues Objekt; keine Laufzeit-Validierung der Keys |
| **pathSchema als Funktion** | Flexibel für alle Pfad-Varianten | Etwas mehr Boilerplate pro Profil |
| **context-Objekt** | Caller übergibt nur relevante IDs | Verschiedene Profile brauchen verschiedene Keys (entityType/entityId vs. vertragId) |
| **Dropbox als Profil** | Einheitliche API | Dropbox braucht andere Parameter (metadaten für Pfad), DB-Update oft caller-spezifisch |
| **replaceExisting: true** | Kein manuelles list/remove | Bei großen Ordnern evtl. langsam; bei Logo/Profile unkritisch |
| **db.table = null bei Logo** | entityType kommt aus context | Sonderfall-Dokumentation nötig |

**Empfehlung**: Profile für Logo, Profile, SignedContract, BriefingDocument, Auftragsbestaetigung sofort einführen. GeneratedContract und DropboxVideo können optional über `uploadCustom` oder eigene Profile integriert werden, da sie Sonderlogik haben (Blob statt File, Dropbox-XHR mit Progress).

---

## 6. Migrations-Roadmap

1. **Phase 1**: `StorageUploadService` implementieren, Profile definieren.
2. **Phase 2**: `LogoUploadHelper`, `ImageUploadHelper` auf Service umstellen.
3. **Phase 3**: `ProfileImageUpload`, `ProfileDetailV2`, `FormSystem` (Ansprechpartner) umstellen.
4. **Phase 4**: `VertraegeList.saveSignedContract`, `BriefingList.uploadBriefingDocuments`, `AuftragList.handleAuftragsbestaetigungUpload` umstellen.
5. **Phase 5**: `VideoUploadDrawer` – Dropbox-Profil nutzen, DB-Update im Caller belassen.
6. **Phase 6**: `VertraegeCreate` (generated PDF) – optional, da serverseitig generiert und weniger Duplikat-Code.
