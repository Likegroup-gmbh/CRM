import { describe, it, expect } from 'vitest';
import {
  b64url,
  fromB64url,
  generateCode,
  generateToken,
  hashCode,
  hmac,
  signJwt,
  timingSafeEqual,
} from '../../supabase/functions/_shared/zugang/krypto.ts';
import { clientIp, istUuid } from '../../supabase/functions/_shared/zugang/http.ts';

describe('zugang/krypto', () => {
  it('hasht Codes wie bisher, damit aktive Codes gültig bleiben', async () => {
    expect(await hashCode('share-code', '123456', 'geheim'))
      .toBe('5f926a58e4058b326a4a580ded4e711b5dbbb9e60c05a0ed7f600c5eda142924');
    expect(await hashCode('einladung-code', '123456', 'geheim'))
      .toBe('e9080a9a0f37a79ae0c70aabe72d4931aecffad978c170db154ba4cd4061ad5a');
  });

  it('erzeugt 48-stellige Hex-Tokens und 6-stellige Codes', () => {
    expect(generateToken()).toMatch(/^[0-9a-f]{48}$/);
    for (let i = 0; i < 20; i += 1) expect(generateCode()).toMatch(/^\d{6}$/);
  });

  it('signiert ein HS256-JWT, dessen Signatur über Header und Body geht', async () => {
    const jwt = await signJwt({ share_id: 's1', exp: 10 }, 'geheim');
    const [header, body, sig] = jwt.split('.');
    expect(JSON.parse(fromB64url(header))).toEqual({ alg: 'HS256', typ: 'JWT' });
    expect(JSON.parse(fromB64url(body))).toEqual({ share_id: 's1', exp: 10 });
    expect(sig).toBe(await hmac(`${header}.${body}`, 'geheim'));
  });

  it('kodiert base64url verlustfrei und vergleicht zeitkonstant', () => {
    expect(fromB64url(b64url('Grüße ?&/+'))).toBe('Grüße ?&/+');
    expect(timingSafeEqual('abc', 'abc')).toBe(true);
    expect(timingSafeEqual('abc', 'abd')).toBe(false);
    expect(timingSafeEqual('abc', 'abcd')).toBe(false);
  });
});

describe('zugang/http', () => {
  it('nimmt cf-connecting-ip vor dem vom Client setzbaren x-forwarded-for', () => {
    const req = new Request('https://x.test', {
      headers: { 'x-forwarded-for': '6.6.6.6, 10.0.0.1', 'cf-connecting-ip': '1.2.3.4' },
    });
    expect(clientIp(req)).toBe('1.2.3.4');
    expect(clientIp(new Request('https://x.test', { headers: { 'x-forwarded-for': '5.5.5.5, 10.0.0.1' } }))).toBe('5.5.5.5');
    expect(clientIp(new Request('https://x.test'))).toBe('');
  });

  it('erkennt UUIDs', () => {
    expect(istUuid('3f1c2a4e-1111-4222-8333-123456789abc')).toBe(true);
    expect(istUuid('paket')).toBe(false);
  });
});
