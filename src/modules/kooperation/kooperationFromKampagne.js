import { KampagneUtils } from '../kampagne/KampagneUtils.js';

export function setKooperationPrefillCache(kampagneId, kampagneData) {
  if (!kampagneId || !kampagneData) return;
  window.kooperationPrefillCache = {
    kampagne_id: kampagneId,
    kampagnenname: KampagneUtils.getDisplayName(kampagneData),
    eigener_name: kampagneData.eigener_name,
    unternehmen_id: kampagneData.unternehmen_id,
    marke_id: kampagneData.marke_id || null,
    unternehmen: kampagneData.unternehmen,
    marke: kampagneData.marke,
    timestamp: Date.now()
  };
}

export function navigateToNewKooperationFromKampagne(kampagneId, kampagneData = null) {
  const data = kampagneData || window.kampagneDetail?.kampagneData || null;
  setKooperationPrefillCache(kampagneId, data);
  window.navigateTo(`/kooperation/new?kampagne_id=${kampagneId}`);
}

export function resolveKampagneIdFromCreateContext({ submitData, form, search } = {}) {
  if (submitData?.kampagne_id) return submitData.kampagne_id;

  if (form?.dataset?.prefillFromKampagne === 'true' && form.dataset.prefillData) {
    try {
      const prefill = JSON.parse(form.dataset.prefillData);
      if (prefill.kampagne_id) return prefill.kampagne_id;
    } catch {
      // Prefill-JSON ungueltig – URL-Fallback
    }
  }

  const urlParams = new URLSearchParams(search ?? window.location.search);
  return urlParams.get('kampagne_id') || null;
}

export function resolveKooperationCreateRedirect({ kampagneId, newKooperationId } = {}) {
  if (kampagneId) return `/kampagne/${kampagneId}`;
  return `/kooperation/${newKooperationId}`;
}

if (typeof window !== 'undefined') {
  window.navigateToNewKooperationFromKampagne = navigateToNewKooperationFromKampagne;
}
