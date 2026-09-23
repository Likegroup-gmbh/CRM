import { describe, expect, it } from 'vitest';
import { lineNames } from '../modules/produktion/produktionNames.js';

describe('lineNames', () => {
  it('hängt Casting und Konzept an den Briefing-Titel', () => {
    expect(lineNames('Neuer Süßer Senf 2.0')).toEqual({
      produktion: 'Neuer Süßer Senf 2.0',
      casting: 'Neuer Süßer Senf 2.0 Casting',
      konzept: 'Neuer Süßer Senf 2.0 Konzept'
    });
  });

  it('liefert leere Namen ohne Titel', () => {
    expect(lineNames('  ')).toEqual({ produktion: '', casting: '', konzept: '' });
  });
});
