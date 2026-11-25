export const briefingAdapter = {
  platzhalter: ['vorname', 'name', 'briefing', 'unternehmen', 'marke'],

  async prepare(opts) {
    const detail = opts.detail;
    const briefing = detail?.briefing;
    if (!briefing || briefing.is_draft) return null;
    if (!window.isInternal?.()) return null;

    return {
      dokumentName: briefing.aktivierung_name || 'Briefing',
      unternehmenId: briefing.unternehmen_id,
      markeId: briefing.marke_id || null,
      detail,
    };
  },

  async createPdf(prepared) {
    const { createBriefingPdf } = await import('../../../modules/briefing/BriefingPdf.js');
    return createBriefingPdf(prepared.detail);
  },
};
