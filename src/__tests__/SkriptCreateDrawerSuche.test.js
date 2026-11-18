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

if (!Blob.prototype.arrayBuffer) {
  Blob.prototype.arrayBuffer = function arrayBuffer() {
    return new Promise((resolve, reject) => {
      const leser = new FileReader();
      leser.onload = () => resolve(leser.result);
      leser.onerror = () => reject(leser.error);
      leser.readAsArrayBuffer(this);
    });
  };
}

const text = async (blob) => new TextDecoder().decode(await blob.arrayBuffer());

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
    vi.clearAllMocks();
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

    waehleDatei(new File(['x'], 'Skript.docx'));
    await sende();

    expect(window.toastSystem.show).not.toHaveBeenCalledWith('Bitte ein Konzept wählen', 'error');
    const { file, item } = skripteService.createSkriptAusUpload.mock.calls[0][0];
    expect(item).toBeNull();
    expect(file.name).toBe('Skript.docx');
    expect(await text(file)).toBe('x');
  });

  it('Datei, die sich nach dem Auswählen ändert, bleibt lesbar', async () => {
    openSkriptCreateDrawer();
    await warte();
    await warte();
    await waehle('unternehmen', 'Hautica');
    await waehle('konzept', 'Winter');

    const datei = new File(['inhalt'], 'Skript.docx');
    const original = datei.arrayBuffer.bind(datei);
    let gelesen = false;
    datei.arrayBuffer = () => {
      if (gelesen) return Promise.reject(new DOMException('changed', 'NotReadableError'));
      gelesen = true;
      return original();
    };
    waehleDatei(datei);
    await sende();

    expect(await text(skripteService.createSkriptAusUpload.mock.calls[0][0].file)).toBe('inhalt');
  });

  it('nicht lesbare Datei: deutsche Meldung, kein Upload', async () => {
    openSkriptCreateDrawer();
    await warte();
    await warte();
    await waehle('unternehmen', 'Hautica');
    await waehle('konzept', 'Winter');

    const datei = new File(['x'], 'Skript.docx');
    datei.arrayBuffer = () => Promise.reject(new DOMException('weg', 'NotReadableError'));
    waehleDatei(datei);
    await sende();

    expect(window.toastSystem.show).toHaveBeenCalledWith(expect.stringContaining('ließ sich nicht lesen'), 'error');
    expect(skripteService.createSkriptAusUpload).not.toHaveBeenCalled();
  });
});

function waehleDatei(datei) {
  const input = document.querySelector('#skript-create-drawer .uploader input[type="file"]');
  Object.defineProperty(input, 'files', { value: [datei], configurable: true });
  input.dispatchEvent(new Event('change'));
}

async function sende() {
  document.getElementById('skcreate-form').dispatchEvent(new Event('submit', { cancelable: true }));
  for (let i = 0; i < 4; i += 1) await warte();
}
