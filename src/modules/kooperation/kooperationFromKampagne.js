import { KampagneUtils } from '../kampagne/KampagneUtils.js';

export function setKooperationPrefillCache(kampagneId, kampagneData, produktionId = null) {
  if (!kampagneId || !kampagneData) return;
  window.kooperationPrefillCache = {
    kampagne_id: kampagneId,
    produktion_id: produktionId || null,
    kampagnenname: KampagneUtils.getDisplayName(kampagneData),
    eigener_name: kampagneData.eigener_name,
    unternehmen_id: kampagneData.unternehmen_id,
    marke_id: kampagneData.marke_id || null,
    unternehmen: kampagneData.unternehmen,
    marke: kampagneData.marke,
    timestamp: Date.now()
  };
}

export function navigateToNewKooperationFromKampagne(kampagneId, kampagneData = null, produktionId = null) {
  const data = kampagneData || window.kampagneDetail?.kampagneData || null;
  const produktion = produktionId || window.kampagneDetail?.produktionId || null;
  setKooperationPrefillCache(kampagneId, data, produktion);
  const params = new URLSearchParams({ kampagne_id: kampagneId });
  if (produktion) params.set('produktion_id', produktion);
  window.navigateTo(`/kooperation/new?${params.toString()}`);
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

export function resolveKooperationCreateRedirect({ kampagneId, produktionId, newKooperationId } = {}) {
  if (produktionId) return `/produktion/${produktionId}`;
  if (kampagneId) return `/kampagne/${kampagneId}`;
  return `/kooperation/${newKooperationId}`;
}

if (typeof window !== 'undefined') {
  window.navigateToNewKooperationFromKampagne = navigateToNewKooperationFromKampagne;
}
