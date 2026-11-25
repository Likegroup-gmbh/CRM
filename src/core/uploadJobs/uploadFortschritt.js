// uploadFortschritt.js
// onProgress für hochladenNachSharePoint: geladene Bytes ans Upload-Panel melden.

export function trackUploadProgress(item, updateItem) {
  return ({ loaded, total }) => updateItem(item.id, { loaded, total });
}
