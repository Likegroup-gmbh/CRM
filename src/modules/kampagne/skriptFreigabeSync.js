// Skript-Freigabe synchron halten: skripte.status und die Checkbox
// kooperation_videos.skript_freigegeben meinen dieselbe Freigabe. Diese
// Funktionen patchen nach einem Write beide lokalen Oberflächen
// (Produktionstabelle + Skripte-Tab), ohne auf Realtime zu warten.

/** Zielstatus, wenn die Checkbox geklickt wird. Abhaken nimmt nur eine
 * bestehende Freigabe zurück; ein Entwurf bleibt Entwurf. */
export function skriptStatusFuerCheckbox(checked, aktuellerStatus) {
  if (checked) return 'freigegeben';
  return aktuellerStatus === 'freigegeben' ? 'final' : aktuellerStatus;
}

/** Ziel-Flag, wenn der Skript-Status geändert wird. */
export function skriptFreigegebenFuerStatus(status) {
  return status === 'freigegeben';
}

/** Gehört das Video zu diesem Skript? Echt verknüpft (skript_id) oder
 * virtuell über die Konzept-Zuordnung (nur video.skript.id gesetzt). */
export function videoGehoertZuSkript(video, skriptId) {
  return video?.skript_id === skriptId || video?.skript?.id === skriptId;
}

/** Videos dieser skript_id im Store der Produktionstabelle patchen. */
export function patchVideoStoreFreigabe(store, skriptId, { freigegeben, status }) {
  if (!store?.videos) return;
  for (const koopId of Object.keys(store.videos)) {
    for (const video of store.videos[koopId]) {
      if (!videoGehoertZuSkript(video, skriptId)) continue;
      store.updateVideo(video.id, {
        skript_freigegeben: freigegeben,
        skript: { ...(video.skript || {}), id: skriptId, status }
      });
    }
  }
}

/** Checkboxen im gemounteten Produktions-Grid setzen. Die Tabelle bleibt beim
 * Tab-Wechsel im DOM (nur versteckt), deshalb reicht ein DOM-Patch. */
export function patchVideoCheckboxDom(skriptId, freigegeben, store) {
  const videoIds = new Set();
  if (store?.videos) {
    for (const koopId of Object.keys(store.videos)) {
      for (const video of store.videos[koopId]) {
        if (videoGehoertZuSkript(video, skriptId)) videoIds.add(video.id);
      }
    }
  }
  if (!videoIds.size) return;
  document
    .querySelectorAll('[data-entity="video"][data-field="skript_freigegeben"]')
    .forEach((field) => {
      if (!videoIds.has(field.getAttribute('data-id'))) return;
      if (field.checked !== freigegeben) {
        field.checked = freigegeben;
        field.classList.add('field-updated');
        setTimeout(() => field.classList.remove('field-updated'), 2000);
      }
    });
}

/** Skript-Cache des Workflow-Detail patchen; liegt der Skripte-Tab offen,
 * wird die Status-Zelle über den Pane-Renderer neu gezeichnet. */
export function patchSkripteCache(detail, skriptId, status, patchWorkflowItem) {
  const list = detail?._workflowData?.skripte;
  if (!list?.some((s) => s.id === skriptId)) return;
  patchWorkflowItem(detail, 'skripte', skriptId, { status });
}

/** Komplette lokale Synchronisation nach einem Freigabe-Write. */
export function syncSkriptFreigabeLocal(detail, skriptId, { freigegeben, status }, patchWorkflowItem) {
  const store = detail?.kooperationenVideoTable?.store || null;
  patchVideoStoreFreigabe(store, skriptId, { freigegeben, status });
  patchVideoCheckboxDom(skriptId, freigegeben, store);
  patchSkripteCache(detail, skriptId, status, patchWorkflowItem);
}
