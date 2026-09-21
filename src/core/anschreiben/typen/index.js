import { briefingAdapter } from './briefing.js';
import { vertragAdapter } from './vertrag.js';

const CLIENT_ADAPTERS = {
  briefing: briefingAdapter,
  vertrag: vertragAdapter,
};

export function getClientAdapter(dokumentTyp) {
  const adapter = CLIENT_ADAPTERS[dokumentTyp];
  if (!adapter) throw new Error(`Unbekannter dokument_typ: ${dokumentTyp}`);
  return adapter;
}

export { CLIENT_ADAPTERS };
