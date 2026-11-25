// Konzept-Einladung (ADR 0059): je Casting-Eintrag eine eigene Einladung.
// Eine bestehende aktive Einladung desselben Eintrags wird abgelöst.
// Mail an Creator, sonst Management, sonst nur Link+Code.

import { generateCode, generateToken, hashCode } from '../_shared/zugang/krypto.ts';
import { istUuid } from '../_shared/zugang/http.ts';
import type { Staff } from '../_shared/zugang/staff.ts';
import { parseEmpfaenger } from './felder.ts';
import {
  EINLADUNG_SPALTEN,
  NACHRICHT_MAX,
  eintragGesperrt,
  konzeptMailziel,
  ladeEintrag,
} from './daten.ts';
import type { Admin, EinladungRow } from './daten.ts';
import { versendeEinladung } from './versand.ts';

const KONZEPT_MAX_EINTRAEGE = 50;

interface KonzeptErgebnis {
  creatorAuswahlItemId: string;
  name: string | null;
  einladungId?: string;
  link?: string;
  code?: string;
  mailAn?: string | null;
  gesendet?: boolean;
  fehler?: string;
}

type Fehler = { status: number; data: Record<string, unknown> };

function eintragIds(body: Record<string, unknown>): string[] | Fehler {
  const roh = Array.isArray(body.creatorAuswahlItemIds)
    ? body.creatorAuswahlItemIds
    : (body.creatorAuswahlItemId ? [body.creatorAuswahlItemId] : []);
  const ids = [...new Set(roh.map((x) => String(x)))];
  if (ids.length === 0) return { status: 400, data: { error: 'Bitte mindestens einen Casting-Eintrag wählen.' } };
  if (ids.length > KONZEPT_MAX_EINTRAEGE) {
    return { status: 400, data: { error: `Höchstens ${KONZEPT_MAX_EINTRAEGE} Einträge pro Versand.` } };
  }
  if (!ids.every(istUuid)) return { status: 400, data: { error: 'Ungültiger Casting-Eintrag.' } };
  return ids;
}

/**
 * Adresse für Einträge ohne hinterlegte Mail (Creator nicht in der DB): gilt nur für diese Einladung
 * und wird nirgends gespeichert. Sie hat Vorrang vor Creator- und Management-Mail.
 */
function freieAdressen(body: Record<string, unknown>, ids: string[]): Map<string, string> | Fehler {
  const adressen = new Map<string, string>();
  const rohAdressen = body.mailAdressen && typeof body.mailAdressen === 'object'
    ? body.mailAdressen as Record<string, unknown>
    : {};
  for (const [id, wert] of Object.entries(rohAdressen)) {
    const mail = String(wert ?? '').trim();
    if (!mail || !ids.includes(id)) continue;
    const geprueft = parseEmpfaenger([mail]);
    if (geprueft.fehler || geprueft.emails.length !== 1) {
      return { status: 400, data: { error: `Ungültige E-Mail-Adresse: ${mail.slice(0, 80)}` } };
    }
    adressen.set(id, geprueft.emails[0]);
  }
  return adressen;
}

export async function legeKonzeptEinladungenAn(
  admin: Admin,
  p: {
    body: Record<string, unknown>;
    secret: string;
    origin: string;
    staff: Staff;
  },
): Promise<{ status: number; data: Record<string, unknown> }> {
  const ids = eintragIds(p.body);
  if (!Array.isArray(ids)) return ids;

  let expiresAt: string | null = null;
  if (p.body.expiresAt) {
    const d = new Date(String(p.body.expiresAt));
    if (Number.isNaN(d.getTime())) return { status: 400, data: { error: 'Ungültiges Ablaufdatum.' } };
    expiresAt = d.toISOString();
  }
  const nachricht = String(p.body.nachricht ?? '').trim().slice(0, NACHRICHT_MAX);
  const versenden = p.body.versenden !== false;
  const adressen = freieAdressen(p.body, ids);
  if (!(adressen instanceof Map)) return adressen;

  const ergebnisse: KonzeptErgebnis[] = [];
  for (const itemId of ids) {
    const eintrag = await ladeEintrag(admin, itemId);
    if (!eintrag) {
      ergebnisse.push({ creatorAuswahlItemId: itemId, name: null, fehler: 'Eintrag nicht gefunden.' });
      continue;
    }
    const ergebnis: KonzeptErgebnis = { creatorAuswahlItemId: itemId, name: eintrag.name };
    ergebnisse.push(ergebnis);

    const gesperrt = eintragGesperrt(eintrag);
    if (gesperrt) {
      ergebnis.fehler = gesperrt;
      continue;
    }
    const linieId = eintrag.creator_auswahl?.briefing_id ?? null;
    const kampagneId = eintrag.creator_auswahl?.kampagne_id ?? null;
    if (!kampagneId) {
      ergebnis.fehler = 'Das Casting gehört zu keiner Kampagne.';
      continue;
    }
    const { data: kampagne } = await admin
      .from('kampagne')
      .select('unternehmen_id, marke_id')
      .eq('id', kampagneId)
      .maybeSingle();
    if (!kampagne?.unternehmen_id) {
      ergebnis.fehler = 'Kampagne nicht gefunden.';
      continue;
    }

    // Höchstens eine aktive Einladung je Eintrag: die alte wird abgelöst.
    await admin
      .from('einladung')
      .update({ revoked_at: new Date().toISOString() })
      .eq('art', 'konzept')
      .eq('creator_auswahl_item_id', itemId)
      .is('revoked_at', null);

    const token = generateToken();
    const code = generateCode();
    const { data: inserted, error } = await admin
      .from('einladung')
      .insert({
        token,
        code_hash: await hashCode('einladung-code', code, p.secret),
        art: 'konzept',
        label: `Konzept: ${eintrag.name || 'Creator'}`.slice(0, 80),
        unternehmen_id: kampagne.unternehmen_id,
        marke_id: kampagne.marke_id ?? null,
        briefing_id: linieId,
        creator_auswahl_item_id: itemId,
        created_by: p.staff.id,
        expires_at: expiresAt,
      })
      .select(EINLADUNG_SPALTEN)
      .single();
    if (error || !inserted) {
      console.error('einladung insert error (konzept):', error);
      ergebnis.fehler = 'Einladung konnte nicht angelegt werden.';
      continue;
    }
    const link = `${p.origin}/einladung/${token}`;
    ergebnis.einladungId = (inserted as EinladungRow).id;
    ergebnis.link = link;
    ergebnis.code = code;

    const ziel = versenden
      ? (adressen.get(itemId) ?? await konzeptMailziel(admin, eintrag.creator_id, eintrag.email))
      : null;
    ergebnis.mailAn = ziel;
    if (ziel) {
      const versand = await versendeEinladung(admin, inserted as EinladungRow, {
        link,
        code,
        basisUrl: p.origin,
        emails: [ziel],
        nachricht,
        staff: p.staff,
      });
      ergebnis.gesendet = versand.gesendet.length > 0;
      if (versand.fehler) ergebnis.fehler = versand.fehler;
    }
  }
  return { status: 200, data: { success: true, einladungen: ergebnisse } };
}
