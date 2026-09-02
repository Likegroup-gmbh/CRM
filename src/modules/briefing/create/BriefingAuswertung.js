// BriefingAuswertung.js
// Client-Haelfte: nach finalem Briefing-Submit einen Background-Job anlegen
// und briefing-auswertung-background triggern. skript_id bleibt leer -
// der Job-Adapter aus SkripteService reicht.

import { skripteService } from '../../skripte/SkripteService.js';

export async function starteBriefingAuswertung({
  briefingId,
  service = skripteService
} = {}) {
  if (!briefingId) throw new Error('briefingId fehlt');
  const job = await service.createJob();
  await service.triggerFunction('briefing-auswertung-background', {
    jobId: job.id,
    briefing_id: briefingId
  });
  return job;
}
