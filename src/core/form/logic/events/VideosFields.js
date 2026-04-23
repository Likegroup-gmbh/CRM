export function setupVideosFields(form) {}

export function buildVideoSelectOptions(options = [], selectedValue = '') {
  const normalizedOptions = Array.from(new Set((options || []).filter(Boolean)));
  if (selectedValue && !normalizedOptions.includes(selectedValue)) {
    normalizedOptions.unshift(selectedValue);
  }

  return ['<option value="">Bitte wählen</option>']
    .concat(normalizedOptions.map(option => `<option value="${option}" ${selectedValue === option ? 'selected' : ''}>${option}</option>`))
    .join('');
}

export function addVideoRow(list, contentArtOptions = [], initial = {}, kampagnenartenOpts = [], onPriceChange = null) {
  const itemId = `video-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
  const videoNum = list.querySelectorAll('.video-item').length + 1;

  const kampagnenartHtml = buildVideoSelectOptions(kampagnenartenOpts, initial.kampagnenart || '');
  const contentArtHtml = buildVideoSelectOptions(contentArtOptions, initial.content_art || '');
  const ekValue = initial.einkaufspreis_netto != null ? parseFloat(initial.einkaufspreis_netto) || '' : '';
  const vkValue = initial.verkaufspreis_netto != null ? parseFloat(initial.verkaufspreis_netto) || '' : '';
  const skriptDeadlineValue = initial.skript_deadline || '';
  const contentDeadlineValue = initial.content_deadline || '';

  const html = `
    <div class="video-item" data-video-id="${itemId}">
      <div class="video-item-header">
        <span class="video-item-number">Video ${videoNum}</span>
        <button type="button" class="video-item-remove" title="Entfernen">&times;</button>
      </div>
      <div class="video-item-fields">
        <div class="video-field">
          <label>Kampagnenart</label>
          <select name="video_kampagnenart_${itemId}" class="video-kampagnenart-select" data-initial-value="${initial.kampagnenart || ''}">
            ${kampagnenartHtml}
          </select>
        </div>
        <div class="video-field">
          <label>Content Art</label>
          <select name="video_content_art_${itemId}" class="video-content-select" data-initial-value="${initial.content_art || ''}">
            ${contentArtHtml}
          </select>
        </div>
        <div class="video-field">
          <label>EK Netto (€)</label>
          <input type="number" name="video_ek_netto_${itemId}" class="video-ek-input" min="0" step="0.01" value="${ekValue}" placeholder="0,00">
        </div>
        <div class="video-field">
          <label>VK Netto (€)</label>
          <input type="number" name="video_vk_netto_${itemId}" class="video-vk-input" min="0" step="0.01" value="${vkValue}" placeholder="0,00">
        </div>
        <div class="video-field">
          <label>Skript Deadline</label>
          <input type="date" name="video_skript_deadline_${itemId}" class="video-skript-deadline-input" value="${skriptDeadlineValue}">
        </div>
        <div class="video-field">
          <label>Content Deadline</label>
          <input type="date" name="video_content_deadline_${itemId}" class="video-content-deadline-input" value="${contentDeadlineValue}">
        </div>
      </div>
    </div>`;
  list.insertAdjacentHTML('beforeend', html);

  const videoEl = list.querySelector(`.video-item[data-video-id="${itemId}"]`);
  if (videoEl && onPriceChange) {
    videoEl.querySelector('.video-ek-input')?.addEventListener('input', onPriceChange);
    videoEl.querySelector('.video-vk-input')?.addEventListener('input', onPriceChange);
  }
}
