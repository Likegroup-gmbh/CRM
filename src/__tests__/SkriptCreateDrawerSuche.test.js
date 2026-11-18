import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { openSkriptCreateDrawer, closeSkriptCreateDrawer } from '../modules/skripte/SkriptCreateDrawer.js';
import { skripteService } from '../modules/skripte/SkripteService.js';
import { FormSearchableSelect } from '../core/form/logic/FormSearchableSelect.js';

vi.mock('../modules/skripte/SkripteService.js', () => ({
  skripteService: {
    loadUnternehmen: vi.fn(),
    loadKonzepte: vi.fn(),
    loadFreigegebeneVideoideen: vi.fn(),
    createSkriptAusUpload: vi.fn()
  }
}));

const warte = () => new Promise((r) => setTimeout(r, 0));

function suchfeld(name) {
  return document.getElementById(`skcreate-${name}`)
    .parentNode.querySelector('.searchable-select-input');
}

async function waehle(name, label) {
  const input = suchfeld(name);
  input.dispatchEvent(new Event('focus'));
  await warte();
  const eintrag = [...input.parentNode.querySelectorAll('.searchable-select-item')]
    .find((el) => el.textContent.trim() === label);
  if (!eintrag) throw new Error(`"${label}" nicht im Dropdown von ${name}`);
  eintrag.click();
  await warte();
  await warte();
}

describe('SkriptCreateDrawer: Suchfelder', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
    const suche = new FormSearchableSelect({});
    window.formSystem = {
      createSimpleSearchableSelect: (select, options, field) =>
        suche.createSimpleSearchableSelect(select, options, field)
    };
    window.toastSystem = { show: vi.fn() };
    window.navigateTo = vi.fn();
    skripteService.loadUnternehmen.mockResolvedValue([{ id: 'u1', firmenname: 'Hautica' }]);
    skripteService.loadKonzepte.mockResolvedValue([
      { id: 'st-1', name: 'Sommer', unternehmen_id: 'u1' },
      { id: 'st-2', name: 'Winter', unternehmen_id: 'u1' }
    ]);
    skripteService.loadFreigegebeneVideoideen.mockResolvedValue([]);
    skripteService.createSkriptAusUpload.mockResolvedValue({ id: 'sk-1' });
  });

  afterEach(() => {
    closeSkriptCreateDrawer();
    window.formSystem = undefined;
  });

  it('leere Felder zeigen nur einen Platzhalter, keinen Text', async () => {
    openSkriptCreateDrawer();
    await warte();
    await warte();

    for (const name of ['unternehmen', 'konzept', 'videoidee']) {
      expect(suchfeld(name).value).toBe('');
      expect(suchfeld(name).placeholder).not.toBe('');
    }
  });

  it('gewähltes Konzept reicht für den Upload ohne Videoidee', async () => {
    openSkriptCreateDrawer();
    await warte();
    await warte();

    await waehle('unternehmen', 'Hautica');
    await waehle('konzept', 'Winter');
    expect(document.getElementById('skcreate-konzept').value).toBe('st-2');
    expect(suchfeld('videoidee').value).toBe('');

    const drawer = document.getElementById('skript-create-drawer');
    const datei = new File(['x'], 'Skript.docx');
    const form = document.getElementById('skcreate-form');
    const uploaderInput = drawer.querySelector('.uploader input[type="file"]');
    Object.defineProperty(uploaderInput, 'files', { value: [datei] });
    uploaderInput.dispatchEvent(new Event('change'));
    form.dispatchEvent(new Event('submit', { cancelable: true }));
    await warte();
    await warte();

    expect(window.toastSystem.show).not.toHaveBeenCalledWith('Bitte ein Konzept wählen', 'error');
    expect(skripteService.createSkriptAusUpload).toHaveBeenCalledWith(
      expect.objectContaining({ file: datei, item: null })
    );
  });
});
