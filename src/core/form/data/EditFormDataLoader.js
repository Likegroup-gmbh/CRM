// EditFormDataLoader.js
// Registry + Orchestrierung für entity-spezifische Edit-Form-Loader.
// Eliminiert den Waterfall: statt DynamicDataLoader + DependentFields + Entity-Events
// kaskadiert aufzurufen, wird hier pro Entity ein Loader registriert, der alle Daten
// parallel (Promise.all) lädt und die Felder in einem Rutsch befüllt.
//
// Benutzung:
//   EditFormDataLoader.registerLoader('kooperation', new KooperationEditLoader());
//   const loader = EditFormDataLoader.getLoader('kooperation');
//   if (loader) { await loader.load(form, data); await loader.bindEvents(form, data); }
//
// Ein registrierter Loader muss folgende Methoden implementieren:
//   - async load(form, data)        : Lädt alle benötigten Daten parallel und befüllt Felder
//   - async bindEvents(form, data)  : Bindet Stepper/Video/spezifische Events (ohne Kaskade)

class EditFormDataLoaderRegistry {
  constructor() {
    this._loaders = new Map();
  }

  // Entity-Loader registrieren (typischerweise beim App-Start)
  registerLoader(entity, loader) {
    if (!entity || typeof entity !== 'string') {
      console.warn('⚠️ EditFormDataLoader: Entity-Name fehlt oder ungültig');
      return;
    }
    if (!loader || typeof loader.load !== 'function') {
      console.warn(`⚠️ EditFormDataLoader: Loader für "${entity}" hat keine load()-Methode`);
      return;
    }
    this._loaders.set(entity, loader);
    console.log(`✅ EditFormDataLoader: Loader für "${entity}" registriert`);
  }

  // Entity-Loader abrufen (null wenn nicht registriert -> Fallback auf Standard-Flow)
  getLoader(entity) {
    return this._loaders.get(entity) || null;
  }

  // Prüfen ob ein Loader für das Entity existiert
  hasLoader(entity) {
    return this._loaders.has(entity);
  }

  // Entity-Loader entfernen (für Tests)
  unregisterLoader(entity) {
    this._loaders.delete(entity);
  }

  // Alle registrierten Entities auflisten (debug)
  getRegisteredEntities() {
    return Array.from(this._loaders.keys());
  }
}

// Singleton-Export: EIN Registry für die gesamte App
export const EditFormDataLoader = new EditFormDataLoaderRegistry();

// Global verfügbar machen (für Konsistenz mit window.formSystem etc.)
if (typeof window !== 'undefined') {
  window.editFormDataLoader = EditFormDataLoader;
}
