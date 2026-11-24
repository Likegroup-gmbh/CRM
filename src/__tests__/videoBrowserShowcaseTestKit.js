// Gemeinsame Testdaten und Helfer für Showcase und Vollansicht (VideoBrowserShowcase.test.js,
// VideoBrowserVollansicht.test.js). Die vi.mock-Fabriken der Testdateien lesen `kit` beim Aufruf.

export const RAW = {
  kooperationen: [
    { id: 'k1', name: 'Koop A', briefing_id: null, creator_id: 'c1', creator: { id: 'c1', vorname: 'Mia', nachname: 'Roth' } },
    { id: 'k2', name: 'Koop B', briefing_id: null, creator_id: 'c2', creator: { id: 'c2', vorname: 'Jan', nachname: 'Voss' } }
  ],
  linien: [],
  videos: [
    { id: 'v1', kooperation_id: 'k1', position: 1, titel: 'Hook', created_at: '2026-01-01' },
    { id: 'v2', kooperation_id: 'k2', position: 1, titel: 'Direkt', created_at: '2026-01-02' }
  ],
  stories: [],
  videoAssets: [
    { id: 'a1', video_id: 'v1', version_number: 1, variant_name: 'A', is_final: false, created_at: '2026-02-01' },
    { id: 'a2', video_id: 'v1', version_number: 1, variant_name: 'B', is_final: false, created_at: '2026-02-02' },
    { id: 'f1', video_id: 'v1', version_number: 1, variant_name: '9:16', is_final: true, source_asset_id: 'a1', created_at: '2026-03-01' },
    { id: 'f2', video_id: 'v1', version_number: 1, variant_name: '4:5', is_final: true, source_asset_id: 'a1', created_at: '2026-03-02' },
    { id: 'f3', video_id: 'v1', version_number: 1, variant_name: '9:16', is_final: true, source_asset_id: 'a2', created_at: '2026-03-03' },
    { id: 'f4', video_id: 'v2', version_number: 1, variant_name: '9:16', is_final: true, source_asset_id: null, created_at: '2026-03-04' }
  ],
  storyAssets: [],
  stillAssets: [],
  rohmaterial: [],
  slotNotes: [],
  zeitkommentare: [],
  tagTypen: [
    { id: 't1', label: 'Persona A', gruppe: 'Persona' },
    { id: 't2', label: 'TikTok', gruppe: 'Plattform' }
  ],
  varianteTags: [
    { video_id: 'v1', variant_key: 'videoA', tag_typ_id: 't1', created_at: '1' },
    { video_id: 'v1', variant_key: 'videoA', tag_typ_id: 't2', created_at: '2' },
    { video_id: 'v1', variant_key: 'videoB', tag_typ_id: 't2', created_at: '3' }
  ],
  links: {}
};

/** Zustand der Fakes: Daten fürs nächste Laden, letzter Player, letzter Uploader. */
export const kit = { raw: RAW, player: { opts: null, destroyed: 0 }, uploader: null };

export function setup({ team = true, search = '', raw = RAW } = {}) {
  kit.raw = raw;
  window.canFeature = (name) => ({
    videoTeamSicht: team, mediaUpload: team, skriptKommentieren: true, mediaDownload: true
  }[name] ?? false);
  window.matchMedia = () => ({ matches: true, addListener() {}, removeListener() {} });
  window.history.replaceState(null, '', `/produktion/p1?tab=videos${search}`);
  const pane = document.createElement('div');
  document.body.appendChild(pane);
  const detail = { kampagneId: 'kamp', produktionId: 'p1', linien: [], linieAlle: false, linieId: null, produktion: { name: 'Prod' } };
  return { pane, detail };
}

export const click = (el) => el.dispatchEvent(new MouseEvent('click', { bubbles: true }));
export const flush = () => new Promise(resolve => setTimeout(resolve, 0));
export const tiles = (root) => [...root.querySelectorAll('[data-vb-sc-tile]')];
export const tileIds = (root) => tiles(root).map(t => t.dataset.itemId);
export const seg = (root, id, value) => root.querySelector(`[data-vb-seg="${id}"] [data-value="${value}"]`);
export const key = (k, target = document) => target.dispatchEvent(new KeyboardEvent('keydown', { key: k, bubbles: true }));
