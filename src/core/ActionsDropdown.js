// ActionsDropdown.js (ES6-Modul)
// Modulare Dropdown-Komponente für Listen-Aktionen

export class ActionsDropdown {
  constructor() {
    this.dropdowns = new Map();
    this.boundEventListeners = new Set();
    this._iconObserver = null;
    this._normalizingIcons = false;
  }

  // Initialisiere die Komponente
  init() {
    console.log('🎯 ACTIONSDROPDOWN: Initialisiere ActionsDropdown');
    this.bindGlobalEvents();
    this.normalizeIcons(document);
    this.observeTableMutations();
    
    // Debug: Überprüfe ob die Komponente korrekt geladen ist
    setTimeout(() => {
      console.log('🔍 ACTIONSDROPDOWN: Debug - Überprüfe Initialisierung');
      console.log('🔍 ACTIONSDROPDOWN: window.ActionsDropdown verfügbar:', !!window.ActionsDropdown);
      console.log('🔍 ACTIONSDROPDOWN: createAuftragActions verfügbar:', !!window.ActionsDropdown?.createAuftragActions);
    }, 1000);
  }

  // Einheitliche Heroicons bereitstellen
  getHeroIcon(name) {
    switch (name) {
      case 'view':
        return `
<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="size-6">
  <path stroke-linecap="round" stroke-linejoin="round" d="M2.036 12.322a1.012 1.012 0 0 1 0-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178Z" />
  <path stroke-linecap="round" stroke-linejoin="round" d="M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" />
</svg>`;
      case 'edit':
        return `
<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="size-6">
  <path stroke-linecap="round" stroke-linejoin="round" d="m16.862 4.487 1.687-1.688a1.875 1.875 0 1 1 2.652 2.652L10.582 16.07a4.5 4.5 0 0 1-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 0 1 1.13-1.897l8.932-8.931Zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0 1 15.75 21H5.25A2.25 2.25 0 0 1 3 18.75V8.25A2.25 2.25 0 0 1 5.25 6H10" />
</svg>`;
      case 'note':
      case 'notiz':
        return `
<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="size-6">
  <path stroke-linecap="round" stroke-linejoin="round" d="M7.5 8.25h9m-9 3H12m-9.75 1.51c0 1.6 1.123 2.994 2.707 3.227 1.129.166 2.27.293 3.423.379.35.026.67.21.865.501L12 21l2.755-4.133a1.14 1.14 0 0 1 .865-.501 48.172 48.172 0 0 0 3.423-.379c1.584-.233 2.707-1.626 2.707-3.228V6.741c0-1.602-1.123-2.995-2.707-3.228A48.394 48.394 0 0 0 12 3c-2.392 0-4.744.175-7.043.513C3.373 3.746 2.25 5.14 2.25 6.741v6.018Z" />
</svg>`;
      case 'delete':
        return `
<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="size-6">
  <path stroke-linecap="round" stroke-linejoin="round" d="m14.74 9-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 0 1-2.244 2.077H8.084a2.25 2.25 0 0 1-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 0 0-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 0 1 3.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 0 0-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 0 0-7.5 0" />
</svg>`;
      case 'add-to-campaign':
        return `
<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="size-6">
  <path stroke-linecap="round" stroke-linejoin="round" d="M10.34 15.84c-.688-.06-1.386-.09-2.09-.09H7.5a4.5 4.5 0 1 1 0-9h.75c.704 0 1.402-.03 2.09-.09m0 9.18c.253.962.584 1.892.985 2.783.247.55.06 1.21-.463 1.511l-.657.38c-.551.318-1.26.117-1.527-.461a20.845 20.845 0 0 1-1.44-4.282m3.102.069a18.03 18.03 0 0 1-.59-4.59c0-1.586.205-3.124.59-4.59m0 9.18a23.848 23.848 0 0 1 8.835 2.535M10.34 6.66a23.847 23.847 0 0 0 8.835-2.535m0 0A23.74 23.74 0 0 0 18.795 3m.38 1.125a23.91 23.91 0 0 1 1.014 5.395m-1.014 8.855c-.118.38-.245.754-.38 1.125m.38-1.125a23.91 23.91 0 0 0 1.014-5.395m0-3.46c.495.413.811 1.035.811 1.73 0 .695-.316 1.317-.811 1.73m0-3.46a24.347 24.347 0 0 1 0 3.46" />
</svg>`;
      case 'favorite':
        return `
<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="size-6">
  <path stroke-linecap="round" stroke-linejoin="round" d="M17.593 3.322c1.1.128 1.907 1.077 1.907 2.185V21L12 17.25 4.5 21V5.507c0-1.108.806-2.057 1.907-2.185a48.507 48.507 0 0 1 11.186 0Z" />
</svg>`;
      case 'add-to-list':
        return `
<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="size-6">
  <path stroke-linecap="round" stroke-linejoin="round" d="M8.25 6.75h12M8.25 12h12m-12 5.25h12M3.75 6.75h.007v.008H3.75V6.75Zm.375 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0ZM3.75 12h.007v.008H3.75V12Zm.375 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Zm-.375 5.25h.007v.008H3.75v-.008Zm.375 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Z" />
</svg>`;
      case 'check':
        return `
<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="size-5">
  <path stroke-linecap="round" stroke-linejoin="round" d="m4.5 12.75 6 6 9-13.5" />
</svg>`;
      case 'zap':
        return `
<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="size-6">
  <path stroke-linecap="round" stroke-linejoin="round" d="m3.75 13.5 10.5-11.25L12 10.5h8.25L9.75 21.75 12 13.5H3.75Z" />
</svg>`;
      case 'invoice':
        return `
<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="size-6">
  <path stroke-linecap="round" stroke-linejoin="round" d="m3.75 13.5 10.5-11.25L12 10.5h8.25L9.75 21.75 12 13.5H3.75Z" />
</svg>`;
      case 'quickview':
        return `
<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="size-6">
  <path stroke-linecap="round" stroke-linejoin="round" d="M3.75 3.75v4.5m0-4.5h4.5m-4.5 0L9 9M3.75 20.25v-4.5m0 4.5h4.5m-4.5 0L9 15M20.25 3.75h-4.5m4.5 0v4.5m0-4.5L15 9m5.25 11.25h-4.5m4.5 0v-4.5m0 4.5L15 15" />
</svg>`;
      case 'status-offen':
        return `
<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="size-6">
  <path stroke-linecap="round" stroke-linejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
</svg>`;
      case 'status-rueckfrage':
        return `
<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="size-6">
  <path stroke-linecap="round" stroke-linejoin="round" d="M9.879 7.519c1.171-1.025 3.071-1.025 4.242 0 1.172 1.025 1.172 2.687 0 3.712-.203.179-.43.326-.67.442-.745.361-1.45.999-1.45 1.827v.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Zm-9 5.25h.008v.008H12v-.008Z" />
</svg>`;
      case 'status-bezahlt':
        return `
<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="size-6">
  <path stroke-linecap="round" stroke-linejoin="round" d="M10.125 2.25h-4.5c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125v-9M10.125 2.25h.375a9 9 0 0 1 9 9v.375M10.125 2.25A3.375 3.375 0 0 1 13.5 5.625v1.5c0 .621.504 1.125 1.125 1.125h1.5a3.375 3.375 0 0 1 3.375 3.375M9 15l2.25 2.25L15 12" />
</svg>`;
      case 'status-qonto':
        return `
<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="size-6">
  <path stroke-linecap="round" stroke-linejoin="round" d="M6 12 3.269 3.125A59.769 59.769 0 0 1 21.485 12 59.768 59.768 0 0 1 3.27 20.875L5.999 12Zm0 0h7.5" />
</svg>`;
      default:
        return '';
    }
  }

  // Status-Icon je nach Statusnamen (zentral für alle Menüs)
  getStatusIcon(statusName) {
    const key = String(statusName || '').toLowerCase().trim();
    switch (key) {
      case 'strategie':
        return `
<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="size-6">
  <path stroke-linecap="round" stroke-linejoin="round" d="M14.25 6.087c0-.355.186-.676.401-.959.221-.29.349-.634.349-1.003 0-1.036-1.007-1.875-2.25-1.875s-2.25.84-2.25 1.875c0 .369.128.713.349 1.003.215.283.401.604.401.959v0a.64.64 0 0 1-.657.643 48.39 48.39 0 0 1-4.163-.3c.186 1.613.293 3.25.315 4.907a.656.656 0 0 1-.658.663v0c-.355 0-.676-.186-.959-.401a1.647 1.647 0 0 0-1.003-.349c-1.036 0-1.875 1.007-1.875 2.25s.84 2.25 1.875 2.25c.369 0 .713-.128 1.003-.349.283-.215.604-.401.959-.401v0c.31 0 .555.26.532.57a48.039 48.039 0 0 1-.642 5.056c1.518.19 3.058.309 4.616.354a.64.64 0 0 0 .657-.643v0c0-.355-.186-.676-.401-.959a1.647 1.647 0 0 1-.349-1.003c0-1.035 1.008-1.875 2.25-1.875 1.243 0 2.25.84 2.25 1.875 0 .369-.128.713-.349 1.003-.215.283-.4.604-.4.959v0c0 .333.277.599.61.58a48.1 48.1 0 0 0 5.427-.63 48.05 48.05 0 0 0 .582-4.717.532.532 0 0 0-.533-.57v0c-.355 0-.676.186-.959.401-.29.221-.634.349-1.003.349-1.035 0-1.875-1.007-1.875-2.25s.84-2.25 1.875-2.25c.37 0 .713.128 1.003.349.283.215.604.401.96.401v0a.656.656 0 0 0 .658-.663 48.422 48.422 0 0 0-.37-5.36c-1.886.342-3.81.574-5.766.689a.578.578 0 0 1-.61-.58v0Z" />
</svg>`;
      case 'abgeschlossen':
        return `
<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="size-6">
  <path stroke-linecap="round" stroke-linejoin="round" d="M9 12.75 11.25 15 15 9.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
</svg>`;
      case 'video produktion':
        return `
<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="size-6">
  <path stroke-linecap="round" stroke-linejoin="round" d="M3.375 19.5h17.25m-17.25 0a1.125 1.125 0 0 1-1.125-1.125M3.375 19.5h1.5C5.496 19.5 6 18.996 6 18.375m-3.75 0V5.625m0 12.75v-1.5c0-.621.504-1.125 1.125-1.125m18.375 2.625V5.625m0 12.75c0 .621-.504 1.125-1.125 1.125m1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125m0 3.75h-1.5A1.125 1.125 0 0 1 18 18.375M20.625 4.5H3.375m17.25 0c.621 0 1.125.504 1.125 1.125M20.625 4.5h-1.5C18.504 4.5 18 5.004 18 5.625m3.75 0v1.5c0 .621-.504 1.125-1.125 1.125M3.375 4.5c-.621 0-1.125.504-1.125 1.125M3.375 4.5h1.5C5.496 4.5 6 5.004 6 5.625m-3.75 0v1.5c0 .621.504 1.125 1.125 1.125m0 0h1.5m-1.5 0c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125m1.5-3.75C5.496 8.25 6 7.746 6 7.125v-1.5M4.875 8.25C5.496 8.25 6 8.754 6 9.375v1.5m0-5.25v5.25m0-5.25C6 5.004 6.504 4.5 7.125 4.5h9.75c.621 0 1.125.504 1.125 1.125m1.125 2.625h1.5m-1.5 0A1.125 1.125 0 0 1 18 7.125v-1.5m1.125 2.625c-.621 0-1.125.504-1.125 1.125v1.5m2.625-2.625c.621 0 1.125.504 1.125 1.125v1.5c0 .621-.504 1.125-1.125 1.125M18 5.625v5.25M7.125 12h9.75m-9.75 0A1.125 1.125 0 0 1 6 10.875M7.125 12C6.504 12 6 12.504 6 13.125m0-2.25C6 11.496 5.496 12 4.875 12M18 10.875c0 .621-.504 1.125-1.125 1.125M18 10.875c0 .621.504 1.125 1.125 1.125m-2.25 0c.621 0 1.125.504 1.125 1.125m-12 5.25v-5.25m0 5.25c0 .621.504 1.125 1.125 1.125h9.75c.621 0 1.125-.504 1.125-1.125m-12 0v-1.5c0-.621-.504-1.125-1.125-1.125M18 18.375v-5.25m0 5.25v-1.5c0-.621.504-1.125 1.125-1.125M18 13.125v1.5c0 .621.504 1.125 1.125 1.125M18 13.125c0-.621.504-1.125 1.125-1.125M6 13.125v1.5c0 .621-.504 1.125-1.125 1.125M6 13.125C6 12.504 5.496 12 4.875 12m-1.5 0h1.5m-1.5 0c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125M19.125 12h1.5m0 0c.621 0 1.125.504 1.125 1.125v1.5c0 .621-.504 1.125-1.125 1.125m-17.25 0h1.5m14.25 0h1.5" />
</svg>`;
      case 'creator sourcing':
        return `
<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="size-6">
  <path stroke-linecap="round" stroke-linejoin="round" d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z" />
</svg>`;
      case 'script erstellung':
        return `
<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="size-6">
  <path stroke-linecap="round" stroke-linejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Z" />
</svg>`;
      case 'post produktion':
        return `
<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="size-6">
  <path stroke-linecap="round" stroke-linejoin="round" d="m7.848 8.25 1.536.887M7.848 8.25a3 3 0 1 1-5.196-3 3 3 0 0 1 5.196 3Zm1.536.887a2.165 2.165 0 0 1 1.083 1.839c.005.351.054.695.14 1.024M9.384 9.137l2.077 1.199M7.848 15.75l1.536-.887m-1.536.887a3 3 0 1 1-5.196 3 3 3 0 0 1 5.196-3Zm1.536-.887a2.165 2.165 0 0 0 1.083-1.838c.005-.352.054-.695.14-1.025m-1.223 2.863 2.077-1.199m0-3.328a4.323 4.323 0 0 1 2.068-1.379l5.325-1.628a4.5 4.5 0 0 1 2.48-.044l.803.215-7.794 4.5m-2.882-1.664A4.33 4.33 0 0 0 10.607 12m3.736 0 7.794 4.5-.802.215a4.5 4.5 0 0 1-2.48-.043l-5.326-1.629a4.324 4.324 0 0 1-2.068-1.379M14.343 12l-2.882 1.664" />
</svg>`;
      case 'verträge':
      case 'vertraege':
        return `
<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="size-6">
  <path stroke-linecap="round" stroke-linejoin="round" d="M8.25 7.5V6.108c0-1.135.845-2.098 1.976-2.192.373-.03.748-.057 1.123-.08M15.75 18H18a2.25 2.25 0 0 0 2.25-2.25V6.108c0-1.135-.845-2.098-1.976-2.192a48.424 48.424 0 0 0-1.123-.08M15.75 18.75v-1.875a3.375 3.375 0 0 0-3.375-3.375h-1.5a1.125 1.125 0 0 1-1.125-1.125v-1.5A3.375 3.375 0 0 0 6.375 7.5H5.25m11.9-3.664A2.251 2.251 0 0 0 15 2.25h-1.5a2.251 2.251 0 0 0-2.15 1.586m5.8 0c.065.21.1.433.1.664v.75h-6V4.5c0-.231.035-.454.1-.664M6.75 7.5H4.875c-.621 0-1.125.504-1.125 1.125v12c0 .621.504 1.125 1.125 1.125h9.75c.621 0 1.125-.504 1.125-1.125V16.5a9 9 0 0 0-9-9Z" />
</svg>`;
      case 'besprechung':
        return `
<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="size-6">
  <path stroke-linecap="round" stroke-linejoin="round" d="M20.25 8.511c.884.284 1.5 1.128 1.5 2.097v4.286c0 1.136-.847 2.1-1.98 2.193-.34.027-.68.052-1.02.072v3.091l-3-3c-1.354 0-2.694-.055-4.02-.163a2.115 2.115 0 0 1-.825-.242m9.345-8.334a2.126 2.126 0 0 0-.476-.095 48.64 48.64 0 0 0-8.048 0c-1.131.094-1.976 1.057-1.976 2.192v4.286c0 .837.46 1.58 1.155 1.951m9.345-8.334V6.637c0-1.621-1.152-3.026-2.76-3.235A48.455 48.455 0 0 0 11.25 3c-2.115 0-4.198.137-6.24.402-1.608.209-2.76 1.614-2.76 3.235v6.226c0 1.621 1.152 3.026 2.76 3.235.577.075 1.157.14 1.74.194V21l4.155-4.155" />
</svg>`;
      case 'rechnungen':
        return `
<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="size-6">
  <path stroke-linecap="round" stroke-linejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m0 11.625h4.5m-4.5 2.25h4.5m2.121 1.527c-1.171 1.464-3.07 1.464-4.242 0-1.172-1.465-1.172-3.84 0-5.304 1.171-1.464 3.07-1.464 4.242 0M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Z" />
</svg>`;
      case 'kick-off':
      case 'kickoff':
        return `
<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="size-6">
  <path stroke-linecap="round" stroke-linejoin="round" d="M15.59 14.37a6 6 0 0 1-5.84 7.38v-4.8m5.84-2.58a14.98 14.98 0 0 0 6.16-12.12A14.98 14.98 0 0 0 9.631 8.41m5.96 5.96a14.926 14.926 0 0 1-5.841 2.58m-.119-8.54a6 6 0 0 0-7.381 5.84h4.8m2.581-5.84a14.927 14.927 0 0 0-2.58 5.84m2.699 2.7c-.103.021-.207.041-.311.06a15.09 15.09 0 0 1-2.448-2.448 14.9 14.9 0 0 1 .06-.312m-2.24 2.39a4.493 4.493 0 0 0-1.757 4.306 4.493 4.493 0 0 0 4.306-1.758M16.5 9a1.5 1.5 0 1 1-3 0 1.5 1.5 0 0 1 3 0Z" />
</svg>`;
      case 'creator briefing':
        return `
<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="size-6">
  <path stroke-linecap="round" stroke-linejoin="round" d="M9 12h3.75M9 15h3.75M9 18h3.75m3 .75H18a2.25 2.25 0 0 0 2.25-2.25V6.108c0-1.135-.845-2.098-1.976-2.192a48.424 48.424 0 0 0-1.123-.08m-5.801 0c-.065.21-.1.433-.1.664 0 .414.336.75.75.75h4.5a.75.75 0 0 0 .75-.75 2.25 2.25 0 0 0-.1-.664m-5.8 0A2.251 2.251 0 0 1 13.5 2.25H15c1.012 0 1.867.668 2.15 1.586m-5.8 0c-.376.023-.75.05-1.124.08C9.095 4.01 8.25 4.973 8.25 6.108V8.25m0 0H4.875c-.621 0-1.125.504-1.125 1.125v11.25c0 .621.504 1.125 1.125 1.125h9.75c.621 0 1.125-.504 1.125-1.125V9.375c0-.621-.504-1.125-1.125-1.125H8.25ZM6.75 12h.008v.008H6.75V12Zm0 3h.008v.008H6.75V15Zm0 3h.008v.008H6.75V18Z" />
</svg>`;
      default:
        return this.getHeroIcon('status-offen');
    }
  }

  async setField(entityType, entityId, fieldName, fieldValue) {
    try {
      console.log('⬆️ setField starte Update', { entityType, entityId, fieldName, fieldValue });
      if (window.supabase) {
        const table = window.dataService?.entities?.[entityType]?.table || entityType;
        const payload = { [fieldName]: fieldValue };
        if (window.dataService?.entities?.[entityType]?.fields?.updated_at) {
          payload.updated_at = new Date().toISOString();
        }
        const { error } = await window.supabase.from(table).update(payload).eq('id', entityId);
        if (error) throw error;
      } else if (window.dataService?.updateEntity) {
        const res = await window.dataService.updateEntity(entityType, entityId, { [fieldName]: fieldValue });
        if (!res?.success) throw new Error(res?.error || 'Update fehlgeschlagen');
      } else {
        throw new Error('Kein Update-Mechanismus verfügbar');
      }
      console.log('✅ setField DB-Update erfolgreich');
      window.dispatchEvent(new CustomEvent('entityUpdated', { detail: { entity: entityType, action: 'updated', id: entityId, field: fieldName, value: fieldValue } }));
    } catch (err) {
      console.error('❌ setField fehlgeschlagen', err);
      alert('Aktualisierung fehlgeschlagen.');
    }
  }

  // Ersetze Icons in bereits gerenderten Dropdowns (einheitlicher Look)
  normalizeIcons(root) {
    try {
      if (this._normalizingIcons) return; // Guard gegen Re-Entrancy
      this._normalizingIcons = true;

      const container = root || document;

      // Jede Dropdown-Box nur einmal normalisieren
      const dropdowns = container.querySelectorAll('.actions-dropdown:not([data-icons-normalized="1"])');
      dropdowns.forEach((dd) => {
        const replaceIn = (selector, iconName) => {
          dd.querySelectorAll(selector).forEach((link) => {
            const existingSvg = link.querySelector('svg');
            if (existingSvg) existingSvg.remove();
            link.insertAdjacentHTML('afterbegin', this.getHeroIcon(iconName));
          });
        };

        replaceIn('.action-item[data-action="view"]', 'view');
        replaceIn('.action-item[data-action="edit"]', 'edit');
        replaceIn('.action-item[data-action="notiz"]', 'notiz');
        replaceIn('.action-item[data-action="favorite"]', 'favorite');
        replaceIn('.action-item.action-danger[data-action="delete"]', 'delete');

        dd.setAttribute('data-icons-normalized', '1');
      });
    } catch (err) {
      console.warn('⚠️ ACTIONSDROPDOWN: normalizeIcons Fehler', err);
    } finally {
      this._normalizingIcons = false;
    }
  }

  // Beobachte DOM-Änderungen (z. B. beim Tabellen-Update) und normalisiere Icons erneut
  observeTableMutations() {
    if (this._iconObserver) return;
    const target = document.getElementById('dashboard-content') || document.body;
    const observer = new MutationObserver((mutations) => {
      for (const m of mutations) {
        if (m.addedNodes && m.addedNodes.length > 0) {
          // Normalisiere nur im Kontext der hinzugefügten Nodes
          m.addedNodes.forEach((node) => {
            if (node.nodeType === 1) {
              this.normalizeIcons(node);
            }
          });
        }
      }
    });
    observer.observe(target, { childList: true, subtree: true });
    this._iconObserver = observer;
  }

  // Globale Event-Listener binden
  bindGlobalEvents() {
    // Event-Delegation für Dropdown-Toggles
    document.addEventListener('click', (e) => {
      // Prüfe ob der Klick auf einen actions-toggle Button oder dessen Inhalt war
      const toggleButton = e.target.closest('.actions-toggle');
      if (toggleButton) {
        e.preventDefault();
        // Wichtig: Verhindere, dass andere Click-Listener auf document (z. B. Outside-Handler)
        // im selben Bubbling-Durchlauf ausgeführt werden.
        if (typeof e.stopImmediatePropagation === 'function') {
          e.stopImmediatePropagation();
        } else {
          e.stopPropagation();
        }
        this.toggleDropdown(toggleButton);
      }
    });

    // Event-Delegation für Submenu-Items (z. B. Status ändern)
    document.addEventListener('click', async (e) => {
      const submenuItem = e.target.closest('.submenu-item');
      if (!submenuItem) return;
      e.preventDefault();
      if (typeof e.stopImmediatePropagation === 'function') e.stopImmediatePropagation();

      const entityId = submenuItem.dataset.id;
      const fieldName = submenuItem.dataset.field;
      const fieldValue = submenuItem.dataset.value;
      const entityType = submenuItem.closest('.actions-dropdown-container')?.dataset?.entityType || 'auftrag';

      console.log('▶️ Submenu-Click erkannt', { entityType, entityId, fieldName, fieldValue });

      if (submenuItem.dataset.action === 'set-field') {
        try {
          if (entityType === 'kampagne' && fieldName === 'status_id') {
            const statusName = submenuItem.dataset.statusName || '';
            // Kombiniertes Update: status_id + status setzen, damit Trigger sicher feuert
            const { error } = await window.supabase
              .from('kampagne')
              .update({ status_id: fieldValue, status: statusName, updated_at: new Date().toISOString() })
              .eq('id', entityId);
            if (error) throw error;
            // Optional: Event für UI-Refresh
            window.dispatchEvent(new CustomEvent('entityUpdated', { detail: { entity: 'kampagne', action: 'updated', id: entityId, field: 'status_id', value: fieldValue } }));
            console.log('✅ Status (id+name) aktualisiert');
          } else if (entityType === 'kooperation' && fieldName === 'status_id') {
            const statusName = submenuItem.dataset.statusName || '';
            const { error } = await window.supabase
              .from('kooperationen')
              .update({ status_id: fieldValue, status: statusName, updated_at: new Date().toISOString() })
              .eq('id', entityId);
            if (error) throw error;
            window.dispatchEvent(new CustomEvent('entityUpdated', { detail: { entity: 'kooperation', action: 'updated', id: entityId, field: 'status_id', value: fieldValue } }));
            console.log('✅ Kooperation-Status (id+name) aktualisiert');
          } else {
            await this.setField(entityType, entityId, fieldName, fieldValue);
            console.log('✅ setField abgeschlossen');
          }
        } catch (err) {
          console.error('❌ setField Fehler aus Submenu', err);
          alert('Aktualisierung fehlgeschlagen.');
        }
        this.closeAllDropdowns();
      }
    });
    // Event-Delegation für Action-Items
    document.addEventListener('click', (e) => {
      const actionItem = e.target.closest('.action-item');
      if (!actionItem) return;

      const action = actionItem.dataset?.action;
      // Wenn keine data-action gesetzt ist (custom Actions wie Favoriten-Menü),
      // NICHT abfangen – lasse andere Listener (z. B. KampagneDetail) den Klick verarbeiten
      if (!action) return;

      e.preventDefault();
      if (typeof e.stopImmediatePropagation === 'function') {
        e.stopImmediatePropagation();
      } else {
        e.stopPropagation();
      }

      const entityId = actionItem.dataset.id;
      // Entity-Type aus data-attribute ermitteln
      const container = actionItem.closest('.actions-dropdown-container');
      let entityType = container?.dataset?.entityType || 'auftrag';

      console.log(`🎯 ACTIONSDROPDOWN: Entity-Type aus data-attribute: ${entityType}`);
      // Sonderfall: Favoriten im Sourcing-Tab – IDs direkt aus dem Link nehmen
      if (action === 'favorite') {
        const creatorId = actionItem.dataset.creatorId || entityId;
        let kampagneId = actionItem.dataset.kampagneId || null;
        this.addToFavorites(creatorId, kampagneId);
        this.closeAllDropdowns();
        return;
      }

      this.handleAction(action, entityId, entityType, actionItem);
      this.closeAllDropdowns();
    });

    // Schließe Dropdowns beim Klick außerhalb
    document.addEventListener('click', (e) => {
      // Klicke innerhalb des gesamten Containers NICHT schließen
      if (!e.target.closest('.actions-dropdown-container')) {
        this.closeAllDropdowns();
      }
    });

    // ESC-Taste schließt alle Dropdowns
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        this.closeAllDropdowns();
      }
    });
  }

  // Entity-Type aus dem Kontext ermitteln
  getEntityTypeFromContext(actionItem) {
    // Versuche aus der aktuellen URL zu ermitteln
    const currentPath = window.location.pathname;
    const pathSegments = currentPath.split('/').filter(segment => segment);
    
    if (pathSegments.length > 0) {
      const firstSegment = pathSegments[0];
      const entityTypes = ['creator', 'unternehmen', 'marke', 'auftrag'];
      
      if (entityTypes.includes(firstSegment)) {
        return firstSegment;
      }
    }
    
    // Fallback: Versuche aus der Tabelle zu ermitteln
    const tableRow = actionItem.closest('tr');
    if (tableRow) {
      const table = tableRow.closest('table');
      if (table) {
        const tableId = table.id;
        if (tableId.includes('creator')) return 'creator';
        if (tableId.includes('unternehmen')) return 'unternehmen';
        if (tableId.includes('marke')) return 'marke';
        if (tableId.includes('auftrag')) return 'auftrag';
      }
    }
    
    // Fallback: Versuche aus dem Action-Item selbst zu ermitteln
    const actionItemText = actionItem.textContent.toLowerCase();
    if (actionItemText.includes('creator') || actionItemText.includes('creator')) return 'creator';
    if (actionItemText.includes('unternehmen') || actionItemText.includes('firmenname')) return 'unternehmen';
    if (actionItemText.includes('marke') || actionItemText.includes('markenname')) return 'marke';
    if (actionItemText.includes('auftrag') || actionItemText.includes('auftragsname')) return 'auftrag';
    
    // Versuche aus der umgebenden Tabelle zu ermitteln
    const tableBody = actionItem.closest('tbody');
    if (tableBody) {
      const table = tableBody.closest('table');
      if (table) {
        const tableHeaders = table.querySelectorAll('th');
        for (let header of tableHeaders) {
          const headerText = header.textContent.toLowerCase();
          if (headerText.includes('creator') || headerText.includes('influencer')) return 'creator';
          if (headerText.includes('unternehmen') || headerText.includes('firmenname')) return 'unternehmen';
          if (headerText.includes('marke') || headerText.includes('markenname')) return 'marke';
          if (headerText.includes('auftrag') || headerText.includes('auftragsname')) return 'auftrag';
        }
      }
    }
    
    // Letzter Fallback: Versuche aus der URL zu ermitteln
    const urlPath = window.location.pathname;
    if (urlPath.includes('/creator')) return 'creator';
    if (urlPath.includes('/unternehmen')) return 'unternehmen';
    if (urlPath.includes('/marke')) return 'marke';
    if (urlPath.includes('/auftrag')) return 'auftrag';
    
    console.warn('⚠️ Konnte Entity-Type nicht ermitteln, verwende "auftrag" als Fallback');
    return 'auftrag'; // Fallback zu auftrag
  }

  // Dropdown umschalten
  toggleDropdown(toggleButton) {
    const dropdown = toggleButton.nextElementSibling;
    const isOpen = dropdown.classList.contains('show');

    // Alle anderen Dropdowns schließen
    this.closeAllDropdowns();

    if (!isOpen) {
      dropdown.classList.add('show');
      toggleButton.setAttribute('aria-expanded', 'true');
    }
  }

  // Alle Dropdowns schließen
  closeAllDropdowns() {
    document.querySelectorAll('.actions-dropdown').forEach(dropdown => {
      dropdown.classList.remove('show');
    });
    document.querySelectorAll('.actions-toggle').forEach(toggle => {
      toggle.setAttribute('aria-expanded', 'false');
    });
  }

  // Erstelle Actions für Creator
  createCreatorActions(creatorId) {
    return `
      <div class="actions-dropdown-container">
        <button class="actions-toggle" aria-expanded="false" aria-label="Aktionen">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
            <path d="M12 8c1.1 0 2-.9 2-2s-.9-2-2-2-2 .9-2 2 .9 2 2 2zm0 2c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2zm0 6c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2z"/>
          </svg>
        </button>
        <div class="actions-dropdown">
          <a href="#" class="action-item" data-action="view" data-id="${creatorId}">
            <i class="icon-eye"></i>
            Details anzeigen
          </a>
          <a href="#" class="action-item" data-action="edit" data-id="${creatorId}">
            <i class="icon-edit"></i>
            Bearbeiten
          </a>
          <a href="#" class="action-item" data-action="notiz" data-id="${creatorId}">
            <i class="icon-note"></i>
            Notiz hinzufügen
          </a>
          <a href="#" class="action-item" data-action="rating" data-id="${creatorId}">
            
            Bewerten
          </a>
          <a href="#" class="action-item" data-action="add_to_list" data-id="${creatorId}">
            ${this.getHeroIcon('add-to-list')}
            Zur Liste hinzufügen
          </a>
          <div class="action-separator"></div>
          <a href="#" class="action-item action-danger" data-action="delete" data-id="${creatorId}">
            <i class="icon-trash"></i>
            Löschen
          </a>
        </div>
      </div>
    `;
  }

  // Erstelle Actions für Unternehmen
  createUnternehmenActions(unternehmenId) {
    return `
      <div class="actions-dropdown-container">
        <button class="actions-toggle" aria-expanded="false" aria-label="Aktionen">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
            <path d="M12 8c1.1 0 2-.9 2-2s-.9-2-2-2-2 .9-2 2 .9 2 2 2zm0 2c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2zm0 6c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2z"/>
          </svg>
        </button>
        <div class="actions-dropdown">
          <a href="#" class="action-item" data-action="view" data-id="${unternehmenId}">
            <i class="icon-eye"></i>
            Details anzeigen
          </a>
          <a href="#" class="action-item" data-action="edit" data-id="${unternehmenId}">
            <i class="icon-edit"></i>
            Bearbeiten
          </a>
          <a href="#" class="action-item" data-action="notiz" data-id="${unternehmenId}">
            <i class="icon-note"></i>
            Notiz hinzufügen
          </a>
          <a href="#" class="action-item" data-action="marken" data-id="${unternehmenId}">
            <i class="icon-tag"></i>
            Marken anzeigen
          </a>
          <a href="#" class="action-item" data-action="auftraege" data-id="${unternehmenId}">
            <i class="icon-briefcase"></i>
            Aufträge anzeigen
          </a>
          <div class="action-separator"></div>
          <a href="#" class="action-item action-danger" data-action="delete" data-id="${unternehmenId}">
            <i class="icon-trash"></i>
            Löschen
          </a>
        </div>
      </div>
    `;
  }

  // Erstelle Actions für Marken
  createMarkeActions(markeId) {
    return `
      <div class="actions-dropdown-container">
        <button class="actions-toggle" aria-expanded="false" aria-label="Aktionen">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
            <path d="M12 8c1.1 0 2-.9 2-2s-.9-2-2-2-2 .9-2 2 .9 2 2 2zm0 2c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2zm0 6c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2z"/>
          </svg>
        </button>
        <div class="actions-dropdown">
          <a href="#" class="action-item" data-action="view" data-id="${markeId}">
            <i class="icon-eye"></i>
            Details anzeigen
          </a>
          <a href="#" class="action-item" data-action="edit" data-id="${markeId}">
            <i class="icon-edit"></i>
            Bearbeiten
          </a>
          <a href="#" class="action-item" data-action="notiz" data-id="${markeId}">
            <i class="icon-note"></i>
            Notiz hinzufügen
          </a>
          <a href="#" class="action-item" data-action="auftraege" data-id="${markeId}">
            <i class="icon-briefcase"></i>
            Aufträge anzeigen
          </a>
          <div class="action-separator"></div>
          <a href="#" class="action-item action-danger" data-action="delete" data-id="${markeId}">
            <i class="icon-trash"></i>
            Löschen
          </a>
        </div>
      </div>
    `;
  }

  // Erstelle Actions für Kooperationen
  createKooperationActions(kooperationId) {
    return `
      <div class="actions-dropdown-container" data-entity-type="kooperation">
        <button class="actions-toggle" aria-expanded="false" aria-label="Aktionen">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" class="w-5 h-5">
            <path d="M10 3a1.5 1.5 0 110 3 1.5 1.5 0 010-3zM10 8.5a1.5 1.5 0 110 3 1.5 1.5 0 010-3zM11.5 15.5a1.5 1.5 0 10-3 0 1.5 1.5 0 003 0z" />
          </svg>
        </button>
        <div class="actions-dropdown">
          <a href="#" class="action-item" data-action="view" data-id="${kooperationId}">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" class="w-5 h-5">
              <path d="M10 12.5a2.5 2.5 0 100-5 2.5 2.5 0 000 5z" />
              <path fill-rule="evenodd" d="M.661 10c1.743-2.372 4.761-5 9.339-5 4.578 0 7.601 2.628 9.339 5-1.738 2.372-4.761 5-9.339 5-4.578 0-7.601-2.628-9.339-5zM10 15a5 5 0 100-10 5 5 0 000 10z" clip-rule="evenodd" />
            </svg>
            Details anzeigen
          </a>
          <a href="#" class="action-item" data-action="edit" data-id="${kooperationId}">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" class="w-5 h-5">
              <path d="M5.433 13.917l-1.523 1.523a.75.75 0 001.06 1.06l1.523-1.523L5.433 13.917zM11.206 6.106L13.917 3.4a.75.75 0 011.06 1.06l-2.711 2.711-.693-.693z" />
              <path fill-rule="evenodd" d="M1.334 10.606a1.5 1.5 0 011.06-1.06l10.38-10.38a1.5 1.5 0 012.122 0l1.523 1.523a1.5 1.5 0 010 2.122l-10.38 10.38a1.5 1.5 0 01-1.06 1.06H1.334v-3.182z" clip-rule="evenodd" />
            </svg>
            Bearbeiten
          </a>
          <a href="#" class="action-item" data-action="notiz" data-id="${kooperationId}">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" class="w-5 h-5">
              <path fill-rule="evenodd" d="M18 10c0 3.866-3.582 7-8 7a8.841 8.841 0 01-4.083-.98L2 17l1.336-3.117C2.688 12.31 2 11.104 2 10c0-3.866 3.582-7 8-7s8 3.134 8 7zM7 9H5v2h2V9zm8 0h-2v2h2V9zM9 9h2v2H9V9z" clip-rule="evenodd" />
            </svg>
            Notiz hinzufügen
          </a>
          <a href="#" class="action-item" data-action="quickview" data-id="${kooperationId}">
            ${this.getHeroIcon('quickview')}
            Schnellansicht öffnen
          </a>
          <div class="action-separator"></div>
          <a href="#" class="action-item action-danger" data-action="delete" data-id="${kooperationId}">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" class="w-5 h-5">
              <path fill-rule="evenodd" d="M8.75 1A2.75 2.75 0 006 3.75v.443c-.795.077-1.584.176-2.368.298a.75.75 0 10.232 1.482l.175-.027c.572-.089 1.14-.19 1.706-.302A3.75 3.75 0 019.75 3h.5a3.75 3.75 0 013.657 3.234c.566.112 1.134.213 1.706.302l.175.027a.75.75 0 10.232-1.482A41.203 41.203 0 0014 4.193V3.75A2.75 2.75 0 0011.25 1h-2.5zM2.5 7.75a.75.75 0 01.75-.75h13.5a.75.75 0 010 1.5H3.25a.75.75 0 01-.75-.75zM7.25 9.75a.75.75 0 01.75-.75h4.5a.75.75 0 010 1.5H8a.75.75 0 01-.75-.75zM6 12.25a.75.75 0 01.75-.75h6.5a.75.75 0 010 1.5H6.75a.75.75 0 01-.75-.75zM4.75 14.75a.75.75 0 01.75-.75h9.5a.75.75 0 010 1.5h-9.5a.75.75 0 01-.75-.75z" clip-rule="evenodd" />
            </svg>
            Löschen
          </a>
        </div>
      </div>
    `;
  }

  // Erstelle Actions für Aufträge
  createAuftragActions(auftragId) {
    console.log('🎯 ACTIONSDROPDOWN: createAuftragActions aufgerufen für ID:', auftragId);
    
    const html = `
      <div class="actions-dropdown-container">
        <button class="actions-toggle" aria-expanded="false" aria-label="Aktionen">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
            <path d="M12 8c1.1 0 2-.9 2-2s-.9-2-2-2-2 .9-2 2 .9 2 2 2zm0 2c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2zm0 6c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2z"/>
          </svg>
        </button>
        <div class="actions-dropdown">
          <a href="#" class="action-item" data-action="view" data-id="${auftragId}">
            <i class="icon-eye"></i>
            Details anzeigen
          </a>
          <a href="#" class="action-item" data-action="edit" data-id="${auftragId}">
            <i class="icon-edit"></i>
            Bearbeiten
          </a>
          <a href="#" class="action-item" data-action="notiz" data-id="${auftragId}">
            <i class="icon-note"></i>
            Notiz hinzufügen
          </a>
          <a href="#" class="action-item" data-action="kampagnen" data-id="${auftragId}">
            <i class="icon-campaign"></i>
            Kampagnen anzeigen
          </a>
          <a href="#" class="action-item" data-action="rechnung" data-id="${auftragId}">
            <i class="icon-invoice"></i>
            Rechnung erstellen
          </a>
          <div class="action-separator"></div>
          <a href="#" class="action-item action-danger" data-action="delete" data-id="${auftragId}">
            <i class="icon-trash"></i>
            Löschen
          </a>
        </div>
      </div>
    `;
    
    console.log('🎯 ACTIONSDROPDOWN: HTML generiert:', html.substring(0, 100) + '...');
    return html;
  }

  // Generische Action-Erstellung für zukünftige Listen
  createGenericActions(entityType, entityId, customActions = []) {
    const defaultActions = [
      { action: 'view', icon: 'icon-eye', label: 'Details anzeigen' },
      { action: 'edit', icon: 'icon-edit', label: 'Bearbeiten' },
      { action: 'notiz', icon: 'icon-note', label: 'Notiz hinzufügen' }
    ];

    const allActions = [...defaultActions, ...customActions];

    const actionItems = allActions.map(item => {
      const dangerClass = item.action === 'delete' ? 'action-danger' : '';
      return `
        <a href="#" class="action-item ${dangerClass}" data-action="${item.action}" data-id="${entityId}">
          <i class="${item.icon}"></i>
          ${item.label}
        </a>
      `;
    }).join('');

    return `
      <div class="actions-dropdown-container">
        <button class="actions-toggle" aria-expanded="false" aria-label="Aktionen">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
            <path d="M12 8c1.1 0 2-.9 2-2s-.9-2-2-2-2 .9-2 2 .9 2 2 2zm0 2c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2zm0 6c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2z"/>
          </svg>
        </button>
        <div class="actions-dropdown">
          ${actionItems}
        </div>
      </div>
    `;
  }

  // Event-Handler für Actions
  handleAction(action, entityId, entityType, actionItem) {
    console.log(`🎯 ACTIONSDROPDOWN: Action ${action} für ${entityType} ${entityId}`);

    switch (action) {
      case 'view':
        window.navigateTo(`/${entityType}/${entityId}`);
        break;
      
      case 'edit':
        window.navigateTo(`/${entityType}/${entityId}/edit`);
        break;
      
      case 'delete':
        this.confirmDelete(entityId, entityType);
        break;
      
      case 'notiz':
        this.openNotizModal(entityId, entityType);
        break;
      
      case 'rating':
        this.openRatingModal(entityId, entityType);
        break;
      
      case 'marken':
        window.navigateTo(`/unternehmen/${entityId}/marken`);
        break;
      
      case 'auftraege':
        window.navigateTo(`/unternehmen/${entityId}/auftraege`);
        break;
      
      case 'kampagnen':
        window.navigateTo(`/auftrag/${entityId}/kampagnen`);
        break;
      case 'quickview':
        this.openKooperationQuickView(entityId);
        break;
      case 'assign-staff':
        // Nur Admin darf
        if (window.currentUser?.rolle !== 'admin') {
          alert('Nur Admins dürfen Mitarbeiter zuordnen.');
          break;
        }
        this.openAssignStaffModal(entityId);
        break;
      
      case 'rechnung':
        this.openRechnungModal(entityId, entityType);
        break;
      case 'invoice-view':
        window.navigateTo(`/rechnung/${entityId}`);
        break;
      case 'invoice-edit':
        window.navigateTo(`/rechnung/${entityId}/edit`);
        break;
      case 'add_to_campaign':
        this.openAddToCampaignModal(entityId);
        break;
      case 'favorite': {
        // Favorit hinzufügen wird nur im Kontext Kampagnen-Sourcing verwendet
        const kampagneId = document.querySelector('[data-kampagne-id]')?.dataset?.kampagneId;
        this.addToFavorites(entityId, kampagneId);
        break;
      }
      case 'add_to_list': {
        this.openAddToListModal(entityId);
        break;
      }
      case 'add_ansprechpartner': {
        this.openAddAnsprechpartnerModal(entityId);
        break;
      }
      case 'add_ansprechpartner_kampagne': {
        this.openAddAnsprechpartnerToKampagneModal(entityId);
        break;
      }
      case 'unassign-kampagne': {
        // Kontext: Mitarbeiter-Detail -> Kampagnen-Tabelle
        const mitarbeiterId = actionItem?.dataset?.mitarbeiterId || window.location.pathname.split('/').pop();
        if (!mitarbeiterId) {
          alert('Mitarbeiter-ID nicht gefunden');
          break;
        }
        const kampagneId = entityId;
        if (!kampagneId) break;
        if (!confirm('Zuweisung dieser Kampagne vom Mitarbeiter entfernen?')) break;
        (async () => {
          try {
            const { error } = await window.supabase
              .from('kampagne_mitarbeiter')
              .delete()
              .eq('mitarbeiter_id', mitarbeiterId)
              .eq('kampagne_id', kampagneId);
            if (error) throw error;
            // UI: Zeile entfernen
            const row = actionItem.closest('tr');
            if (row) row.remove();
            // Tab-Count aktualisieren
            const countEl = document.querySelector('.tab-button[data-tab="kampagnen"] .tab-count');
            if (countEl) {
              const current = parseInt(countEl.textContent || '1', 10);
              countEl.textContent = String(Math.max(0, current - 1));
            }
            alert('Zuweisung entfernt');
          } catch (err) {
            console.error('❌ Zuweisung entfernen fehlgeschlagen', err);
            alert('Entfernen fehlgeschlagen');
          }
        })();
        break;
      }
      
      // Video-Entity: Redirect auf /video/:id
      case 'video-view':
        window.navigateTo(`/video/${entityId}`);
        break;
      case 'video-edit':
        window.navigateTo(`/video/${entityId}`);
        break;
      case 'video-delete':
        this.confirmDelete(entityId, 'kooperation_videos');
        break;

      default:
        console.warn(`⚠️ Unbekannte Action: ${action}`);
    }
  }

  async openKooperationQuickView(kooperationId) {
    try {
      // Overlay
      const overlay = document.createElement('div');
      overlay.className = 'drawer-overlay';

      // Panel (right slide)
      const panel = document.createElement('div');
      panel.setAttribute('role', 'dialog');
      panel.className = 'drawer-panel';

      const header = document.createElement('div');
      header.className = 'drawer-header';
      const headerLeft = document.createElement('div');
      const title = document.createElement('h1');
      title.textContent = 'Kooperation · Schnellansicht';
      const subtitle = document.createElement('p');
      subtitle.style.margin = '0';
      subtitle.style.color = '#6b7280';
      subtitle.textContent = 'Videos & Kommentare';
      headerLeft.appendChild(title);
      headerLeft.appendChild(subtitle);
      
      const headerRight = document.createElement('div');
      const closeBtn = document.createElement('button');
      closeBtn.className = 'drawer-close';
      closeBtn.id = 'kvq-close';
      closeBtn.textContent = 'Schließen';
      headerRight.appendChild(closeBtn);
      
      header.appendChild(headerLeft);
      header.appendChild(headerRight);

      const body = document.createElement('div');
      body.className = 'drawer-body';
      const section = document.createElement('div');
      section.className = 'detail-section';
      
      const heading = document.createElement('h2');
      heading.textContent = 'Videos';
      
      const tableContainer = document.createElement('div');
      tableContainer.id = 'kvq-table';
      tableContainer.textContent = 'Lade...';
      
      section.appendChild(heading);
      section.appendChild(tableContainer);
      body.replaceChildren(section);

      panel.appendChild(header);
      panel.appendChild(body);
      document.body.appendChild(overlay);
      document.body.appendChild(panel);

      // Close handlers
      const close = () => { try { overlay.remove(); panel.remove(); } catch(_) {} };
      overlay.addEventListener('click', close);
      header.querySelector('#kvq-close')?.addEventListener('click', close);
      document.addEventListener('keydown', function onEsc(e){ if(e.key==='Escape'){ close(); document.removeEventListener('keydown', onEsc);} });

      // Animate in
      requestAnimationFrame(() => { panel.classList.add('show'); });

      // Load data
      const { data: videos } = await window.supabase
        .from('kooperation_videos')
        .select('id, position, content_art, titel, asset_url, status, created_at')
        .eq('kooperation_id', kooperationId)
        .order('position', { ascending: true });
      const videoList = videos || [];
      let commentsByVideo = {};
      if (videoList.length) {
        const ids = videoList.map(v => v.id);
        const { data: comments } = await window.supabase
          .from('kooperation_video_comment')
          .select('id, video_id, runde, text, author_name, created_at')
          .in('video_id', ids)
          .order('created_at', { ascending: true });
        (comments || []).forEach(c => {
          const key = c.video_id;
          if (!commentsByVideo[key]) commentsByVideo[key] = { r1: [], r2: [] };
          const bucket = (c.runde === 2 || c.runde === '2') ? 'r2' : 'r1';
          commentsByVideo[key][bucket].push(c);
        });
      }
      const safe = (s) => window.validatorSystem?.sanitizeHtml?.(s) ?? s;
      const fDate = d => d ? new Date(d).toLocaleDateString('de-DE') : '-';
      const fmtFeedback = (arr) => {
        if (!arr || !arr.length) return '-';
        return arr.map(c => {
          const t = safe(c.text || '');
          const a = safe(c.author_name || '-');
          const dt = fDate(c.created_at);
          return `<div class="fb-line"><span class="fb-meta">${a} • ${dt}</span><div class="fb-text">${t}</div></div>`;
        }).join('');
      };

      const rows = videoList.map(v => {
        const fb = commentsByVideo[v.id] || { r1: [], r2: [] };
        const linkBtn = v.asset_url ? `<a class=\"kvq-link-btn\" href=\"${v.asset_url}\" target=\"_blank\" rel=\"noopener\">${this.getHeroIcon('view')}<span>Öffnen</span></a>` : '-';
        return `
          <tr>
            <td>${v.position || '-'}</td>
            <td>${safe(v.content_art || '-')}</td>
            <td>
              <div class=\"kvq-cell\">
                <span class=\"kvq-title-text\">${safe(v.titel || '-')}</span>
                ${linkBtn}
              </div>
            </td>
            <td class="feedback-cell">${fmtFeedback(fb.r1)}</td>
            <td class="feedback-cell">${fmtFeedback(fb.r2)}</td>
            <td><span class="status-badge status-${(v.status || 'produktion').toLowerCase()}">${v.status === 'abgeschlossen' ? 'Abgeschlossen' : 'Produktion'}</span></td>
          </tr>`;
      }).join('');

      const tableHtml = videoList.length ? `
        <div class="data-table-container">
          <table class="data-table">
            <thead>
              <tr>
                <th>#</th>
                <th>Content Art</th>
                <th>Titel/URL</th>
                <th>Feedback K1</th>
                <th>Feedback K2</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>${rows}</tbody>
          </table>
        </div>` : '<p class="empty-state">Keine Videos vorhanden.</p>';

      const tableDiv = body.querySelector('#kvq-table');
      tableDiv.innerHTML = '';
      if (videoList.length) {
        const tableContainer = document.createElement('div');
        tableContainer.className = 'data-table-container';
        tableContainer.innerHTML = tableHtml;
        tableDiv.appendChild(tableContainer);
      } else {
        const emptyState = document.createElement('p');
        emptyState.className = 'empty-state';
        emptyState.textContent = 'Keine Videos vorhanden.';
        tableDiv.appendChild(emptyState);
      }
      // Normalize icons inside any dropdowns rendered later (not used here, but keep consistent)
      this.normalizeIcons(body);
    } catch (err) {
      console.error('❌ Quickview öffnen fehlgeschlagen', err);
      alert('Schnellansicht konnte nicht geöffnet werden.');
    }
  }

  // Modal: Mitarbeiter einer Kampagne zuordnen (Auto-Suggest)
  async openAssignStaffModal(kampagneId) {
    const modal = document.createElement('div');
    modal.className = 'modal overlay-modal';
    modal.innerHTML = `
      <div class="modal-dialog">
        <div class="modal-header">
          <h3>Mitarbeiter zuordnen</h3>
          <button class="modal-close" id="assign-staff-close">×</button>
        </div>
        <div class="modal-body">
          <label class="form-label">Mitarbeiter wählen</label>
          <input type="text" id="staff-search" class="form-input auto-suggest-input" placeholder="Mitarbeiter suchen..." />
          <div id="staff-dropdown" class="auto-suggest-dropdown"></div>
        </div>
        <div class="modal-footer">
          <button class="secondary-btn" id="assign-staff-cancel">Abbrechen</button>
          <button class="primary-btn" id="assign-staff-confirm" disabled>Zuordnen</button>
        </div>
      </div>`;
    document.body.appendChild(modal);

    const input = modal.querySelector('#staff-search');
    const dropdown = modal.querySelector('#staff-dropdown');
    let selectedId = null;

    const search = async (term) => {
      try {
        // Zuerst bereits zugeordnete Mitarbeiter der Kampagne laden, um sie auszuschließen
        let assignedIds = [];
        try {
          const { data: assigned } = await window.supabase
            .from('kampagne_mitarbeiter')
            .select('mitarbeiter_id')
            .eq('kampagne_id', kampagneId);
          assignedIds = (assigned || []).map(r => r.mitarbeiter_id);
        } catch (_) {}

        let query = window.supabase
          .from('benutzer')
          .select('id, name, rolle, mitarbeiter_klasse:mitarbeiter_klasse_id(name)')
          .in('rolle', ['mitarbeiter', 'Mitarbeiter', 'admin'])
          .order('name');
        if (term) query = query.ilike('name', `%${term}%`);
        if (assignedIds.length > 0) {
          query = query.not('id', 'in', `(${assignedIds.join(',')})`);
        }
        const { data } = await query;
        return data || [];
      } catch (err) {
        console.warn('⚠️ Mitarbeiter-Suche fehlgeschlagen', err);
        return [];
      }
    };

    const hydrate = (items) => {
      dropdown.innerHTML = items.length
        ? items.map(u => `<div class="dropdown-item" data-id="${u.id}">${u.name}${u.mitarbeiter_klasse?.name ? ` <span class=\"muted\">(${u.mitarbeiter_klasse.name})</span>` : ''}${u.rolle ? ` <span class=\"muted\">[${u.rolle}]</span>` : ''}</div>`).join('')
        : '<div class="dropdown-item no-results">Keine Mitarbeiter gefunden</div>';
    };

    hydrate(await search(''));
    dropdown.classList.add('show');
    input.focus();
    // Falls das generische absolute Dropdown greift, stelle sicher, dass die Position relativ zum Input richtig ist
    const ensurePosition = () => {
      if (!dropdown.style.position || dropdown.style.position === 'absolute') {
        dropdown.style.position = 'relative';
      }
      dropdown.style.display = 'block';
    };
    ensurePosition();
    input.addEventListener('focus', () => dropdown.classList.add('show'));
    input.addEventListener('blur', () => setTimeout(() => dropdown.classList.remove('show'), 150));

    let debounce;
    input.addEventListener('input', () => {
      clearTimeout(debounce);
      debounce = setTimeout(async () => hydrate(await search(input.value.trim())), 200);
    });
    dropdown.addEventListener('click', (e) => {
      const item = e.target.closest('.dropdown-item');
      if (!item || item.classList.contains('no-results')) return;
      selectedId = item.dataset.id;
      input.value = item.textContent.trim();
      modal.querySelector('#assign-staff-confirm').disabled = false;
      dropdown.classList.remove('show');
    });

    const close = () => modal.remove();
    modal.querySelector('#assign-staff-close').onclick = close;
    modal.querySelector('#assign-staff-cancel').onclick = close;
    modal.querySelector('#assign-staff-confirm').onclick = async () => {
      if (!selectedId) return;
      try {
        // Speichere Zuordnung in Relationstabelle (mit role-Feld)
        const { error: insertError } = await window.supabase
          .from('kampagne_mitarbeiter')
          .insert({ 
            kampagne_id: kampagneId, 
            mitarbeiter_id: selectedId,
            role: 'projektmanager'  // Standard-Rolle
          });
        
        if (insertError) {
          console.error('❌ Insert-Fehler:', insertError);
          throw insertError;
        }
        // Notification an zugewiesenen Mitarbeiter
        try {
          const { data: kamp } = await window.supabase
            .from('kampagne')
            .select('id, kampagnenname')
            .eq('id', kampagneId)
            .single();
          const kampName = kamp?.kampagnenname || kampagneId;
          await window.notificationSystem?.pushNotification(selectedId, {
            type: 'assign',
            entity: 'kampagne',
            entityId: kampagneId,
            title: 'Neue Kampagnen-Zuweisung',
            message: `Du wurdest der Kampagne "${kampName}" zugeordnet.`
          });
          window.dispatchEvent(new Event('notificationsRefresh'));
        } catch (_) {}
        console.log('✅ Mitarbeiter erfolgreich zugeordnet');
        close();
        window.dispatchEvent(new CustomEvent('entityUpdated', { detail: { entity: 'kampagne', action: 'staff-assigned', id: kampagneId } }));
        alert('Mitarbeiter zugeordnet.');
      } catch (err) {
        console.error('❌ Fehler beim Zuordnen', err);
        alert('Zuordnung fehlgeschlagen.');
      }
    };
  }

  async addToFavorites(creatorId, kampagneId) {
    try {
      // Fallback: kampagneId aus URL /kampagne/:id extrahieren
      if (!kampagneId) {
        const match = window.location.pathname.match(/\/kampagne\/([0-9a-fA-F-]{36})/);
        kampagneId = match ? match[1] : null;
      }
      if (!kampagneId) {
        alert('Kampagne konnte nicht ermittelt werden.');
        return;
      }
      await window.supabase
        .from('kampagne_creator_favoriten')
        .insert({ kampagne_id: kampagneId, creator_id: creatorId });
      window.dispatchEvent(new CustomEvent('entityUpdated', { detail: { entity: 'kampagne', action: 'favorite-added', id: kampagneId } }));
      alert('Zu Favoriten hinzugefügt.');
    } catch (err) {
      console.error('❌ Fehler beim Hinzufügen zu Favoriten', err);
      alert('Hinzufügen zu Favoriten fehlgeschlagen.');
    }
  }

  // Modal: Creator zu Kampagne hinzufügen
  async openAddToCampaignModal(creatorId) {
    // Kampagnen laden: Nur solche anzeigen, zu denen der Creator noch NICHT gehört
    // und für Nicht-Admins nur Kampagnen, denen der Nutzer zugeordnet ist
    let kampagnen = [];
    let excludedCampaignIds = [];
    let allowedCampaignIds = null; // null = kein Filter, [] = nichts erlaubt
    try {
      const [finalRes, sourcingRes] = await Promise.all([
        window.supabase
          .from('kampagne_creator')
          .select('kampagne_id')
          .eq('creator_id', creatorId),
        window.supabase
          .from('kampagne_creator_sourcing')
          .select('kampagne_id')
          .eq('creator_id', creatorId)
      ]);
      const finalIds = (finalRes?.data || []).map(r => r.kampagne_id).filter(Boolean);
      const sourcingIds = (sourcingRes?.data || []).map(r => r.kampagne_id).filter(Boolean);
      excludedCampaignIds = Array.from(new Set([...finalIds, ...sourcingIds]));

      // Sichtbarkeits-Filter: Nicht-Admin sieht nur ihm zugewiesene Kampagnen
      if (window.currentUser?.rolle !== 'admin') {
        const { data: assignedK } = await window.supabase
          .from('kampagne_mitarbeiter')
          .select('kampagne_id')
          .eq('mitarbeiter_id', window.currentUser?.id);
        allowedCampaignIds = (assignedK || []).map(r => r.kampagne_id).filter(Boolean);
      }

      let shouldQuery = true;
      let query = window.supabase
        .from('kampagne')
        .select('id, kampagnenname, status')
        .order('created_at', { ascending: false });
      if (Array.isArray(allowedCampaignIds)) {
        if (allowedCampaignIds.length === 0) {
          shouldQuery = false;
          kampagnen = [];
        } else {
          query = query.in('id', allowedCampaignIds);
        }
      }
      if (excludedCampaignIds.length > 0) {
        // PostgREST erwartet bei not in für UUIDs Werte ohne Quotes
        query = query.not('id', 'in', `(${excludedCampaignIds.join(',')})`);
      }
      if (shouldQuery) {
        const { data } = await query;
        kampagnen = data || [];
      }
    } catch {}

    const modal = document.createElement('div');
    modal.className = 'modal overlay-modal';
    modal.innerHTML = `
      <div class="modal-dialog">
        <div class="modal-header">
          <h3>Zu Kampagne hinzufügen</h3>
          <button class="modal-close" id="add-to-campaign-close">×</button>
        </div>
        <div class="modal-body">
          <label class="form-label">Kampagne wählen</label>
          <input type="text" id="campaign-search" class="form-input auto-suggest-input" placeholder="Kampagne suchen..." />
          <div id="campaign-dropdown" class="auto-suggest-dropdown"></div>
        </div>
        <div class="modal-footer">
          <button class="secondary-btn" id="add-to-campaign-cancel">Abbrechen</button>
          <button class="primary-btn" id="add-to-campaign-confirm" disabled>Hinzufügen</button>
        </div>
      </div>`;
    document.body.appendChild(modal);

    const input = modal.querySelector('#campaign-search');
    const dropdown = modal.querySelector('#campaign-dropdown');
    let selectedId = null;

    const hydrateDropdown = (filter = '') => {
      const f = filter.toLowerCase();
      const items = kampagnen.filter(k => (k.kampagnenname || '').toLowerCase().includes(f));
      dropdown.innerHTML = items.length
        ? items.map(k => `<div class=\"dropdown-item\" data-id=\"${k.id}\">${k.kampagnenname}</div>`).join('')
        : '<div class=\"dropdown-item no-results\">Keine Kampagne gefunden</div>';
    };
    hydrateDropdown('');
    input.addEventListener('focus', () => {
      dropdown.classList.add('show');
    });
    input.addEventListener('blur', () => {
      setTimeout(() => dropdown.classList.remove('show'), 150);
    });

    // Debounced dynamische Suche gegen DB (unter Beachtung der Exclusions und erlaubten Kampagnen)
    let debounceTimer;
    input.addEventListener('input', () => {
      const term = input.value.trim();
      clearTimeout(debounceTimer);
      debounceTimer = setTimeout(async () => {
        try {
          let query = window.supabase
            .from('kampagne')
            .select('id, kampagnenname, status')
            .order('created_at', { ascending: false });
          if (term.length > 0) {
            query = query.ilike('kampagnenname', `%${term}%`);
          }
          if (Array.isArray(allowedCampaignIds)) {
            if (allowedCampaignIds.length === 0) {
              kampagnen = [];
              hydrateDropdown(term);
              return;
            }
            query = query.in('id', allowedCampaignIds);
          }
          if (excludedCampaignIds.length > 0) {
            query = query.not('id', 'in', `(${excludedCampaignIds.join(',')})`);
          }
          const { data } = await query;
          kampagnen = data || [];
          hydrateDropdown(term);
        } catch (err) {
          console.warn('⚠️ Kampagnen-Suche fehlgeschlagen', err);
        }
      }, 200);
    });
    dropdown.addEventListener('click', (e) => {
      const item = e.target.closest('.dropdown-item');
      if (!item || item.classList.contains('no-results')) return;
      selectedId = item.dataset.id;
      input.value = item.textContent;
      modal.querySelector('#add-to-campaign-confirm').disabled = false;
      dropdown.classList.remove('show');
    });

    const close = () => modal.remove();
    modal.querySelector('#add-to-campaign-close').onclick = close;
    modal.querySelector('#add-to-campaign-cancel').onclick = close;
    modal.querySelector('#add-to-campaign-confirm').onclick = async () => {
      if (!selectedId) return;
      try {
        await window.supabase
          .from('kampagne_creator_sourcing')
          .insert({ kampagne_id: selectedId, creator_id: creatorId });
        // Notification an alle zugewiesenen Mitarbeiter der Kampagne (Sourcing update)
        try {
          const [{ data: staff }, { data: kamp }] = await Promise.all([
            window.supabase.from('kampagne_mitarbeiter').select('mitarbeiter_id').eq('kampagne_id', selectedId),
            window.supabase.from('kampagne').select('kampagnenname').eq('id', selectedId).single()
          ]);
          const kampName = kamp?.kampagnenname || selectedId;
          const mitarbeiterIds = (staff || []).map(r => r.mitarbeiter_id).filter(Boolean);
          for (const uid of mitarbeiterIds) {
            await window.notificationSystem?.pushNotification(uid, {
              type: 'update',
              entity: 'kampagne',
              entityId: selectedId,
              title: 'Sourcing-Update',
              message: `Neuer Creator wurde dem Sourcing von "${kampName}" hinzugefügt.`
            });
          }
          if (mitarbeiterIds.length) window.dispatchEvent(new Event('notificationsRefresh'));
        } catch (_) {}
        close();
        window.dispatchEvent(new CustomEvent('entityUpdated', { detail: { entity: 'kampagne', action: 'sourcing-added', id: selectedId } }));
        alert('Creator wurde zum Sourcing der Kampagne hinzugefügt.');
      } catch (err) {
        console.error('❌ Fehler beim Hinzufügen zur Kampagne', err);
        alert('Hinzufügen fehlgeschlagen.');
      }
    };
  }

  // Modal: Ansprechpartner zu Marke hinzufügen
  async openAddAnsprechpartnerModal(markeId) {
    console.log('🎯 ACTIONSDROPDOWN: Öffne Ansprechpartner-Auswahl-Modal für Marke:', markeId);

    // Bereits zugeordnete Ansprechpartner laden
    let ansprechpartner = [];
    let excludedAnsprechpartnerIds = [];
    
    try {
      const { data: existing } = await window.supabase
        .from('ansprechpartner_marke')
        .select('ansprechpartner_id')
        .eq('marke_id', markeId);
      
      excludedAnsprechpartnerIds = (existing || []).map(r => r.ansprechpartner_id).filter(Boolean);

      // Verfügbare Ansprechpartner laden (die noch nicht zugeordnet sind)
      let query = window.supabase
        .from('ansprechpartner')
        .select(`
          id, 
          vorname, 
          nachname, 
          email,
          unternehmen:unternehmen_id(firmenname),
          position:position_id(name)
        `)
        .order('nachname');
      
      if (excludedAnsprechpartnerIds.length > 0) {
        query = query.not('id', 'in', `(${excludedAnsprechpartnerIds.join(',')})`);
      }
      
      const { data } = await query;
      ansprechpartner = data || [];
      
    } catch (error) {
      console.warn('⚠️ Fehler beim Laden der Ansprechpartner:', error);
    }

    const modal = document.createElement('div');
    modal.className = 'modal overlay-modal';
    modal.innerHTML = `
      <div class="modal-dialog">
        <div class="modal-header">
          <h3>Ansprechpartner zur Marke hinzufügen</h3>
          <button class="modal-close" id="add-ansprechpartner-close">×</button>
        </div>
        <div class="modal-body">
          <label class="form-label">Ansprechpartner wählen</label>
          <input type="text" id="ansprechpartner-search" class="form-input auto-suggest-input" placeholder="Ansprechpartner suchen..." />
          <div id="ansprechpartner-dropdown" class="auto-suggest-dropdown"></div>
        </div>
        <div class="modal-footer">
          <button class="secondary-btn" id="add-ansprechpartner-cancel">Abbrechen</button>
          <button class="primary-btn" id="add-ansprechpartner-confirm" disabled>Hinzufügen</button>
        </div>
      </div>`;
    
    document.body.appendChild(modal);

    const input = modal.querySelector('#ansprechpartner-search');
    const dropdown = modal.querySelector('#ansprechpartner-dropdown');
    let selectedId = null;

    const hydrateDropdown = (filter = '') => {
      // Wenn kein Filter, zeige Hinweis zum Tippen
      if (!filter || filter.trim().length === 0) {
        dropdown.innerHTML = '<div class="dropdown-item no-results">Beginnen Sie zu tippen, um Ansprechpartner zu suchen...</div>';
        return;
      }
      
      const f = filter.toLowerCase();
      const items = ansprechpartner.filter(ap => {
        const fullName = `${ap.vorname} ${ap.nachname}`.toLowerCase();
        const email = (ap.email || '').toLowerCase();
        const unternehmen = (ap.unternehmen?.firmenname || '').toLowerCase();
        return fullName.includes(f) || email.includes(f) || unternehmen.includes(f);
      });
      
      dropdown.innerHTML = items.length
        ? items.map(ap => {
            const displayName = `${ap.vorname} ${ap.nachname}`;
            const details = [
              ap.email,
              ap.unternehmen?.firmenname,
              ap.position?.name
            ].filter(Boolean).join(' • ');
            
            return `<div class="dropdown-item" data-id="${ap.id}">
              <div class="dropdown-item-main">${displayName}</div>
              ${details ? `<div class="dropdown-item-details">${details}</div>` : ''}
            </div>`;
          }).join('')
        : '<div class="dropdown-item no-results">Keine verfügbaren Ansprechpartner gefunden</div>';
    };
    
    // Initial kein Dropdown anzeigen - erst beim Tippen
    dropdown.innerHTML = '<div class="dropdown-item no-results">Beginnen Sie zu tippen, um Ansprechpartner zu suchen...</div>';
    
    input.addEventListener('focus', () => {
      // Nur anzeigen wenn bereits Text eingegeben wurde
      if (input.value.trim().length > 0) {
        dropdown.classList.add('show');
      }
    });
    input.addEventListener('blur', () => {
      setTimeout(() => dropdown.classList.remove('show'), 150);
    });

    // Dynamische Suche
    let searchTimeout;
    input.addEventListener('input', (e) => {
      clearTimeout(searchTimeout);
      searchTimeout = setTimeout(async () => {
        const term = e.target.value.trim();
        
        // Kein Dropdown anzeigen wenn weniger als 1 Zeichen
        if (term.length < 1) {
          dropdown.classList.remove('show');
          return;
        }
        
        // Ab 1 Zeichen suchen und anzeigen
        try {
          let query = window.supabase
            .from('ansprechpartner')
            .select(`
              id, 
              vorname, 
              nachname, 
              email,
              unternehmen:unternehmen_id(firmenname),
              position:position_id(name)
            `)
            .or(`vorname.ilike.%${term}%,nachname.ilike.%${term}%,email.ilike.%${term}%`)
            .order('nachname');
          
          if (excludedAnsprechpartnerIds.length > 0) {
            query = query.not('id', 'in', `(${excludedAnsprechpartnerIds.join(',')})`);
          }
          
          const { data } = await query;
          ansprechpartner = data || [];
          hydrateDropdown(term);
          dropdown.classList.add('show');
        } catch (err) {
          console.warn('⚠️ Ansprechpartner-Suche fehlgeschlagen', err);
        }
      }, 200);
    });

    dropdown.addEventListener('click', (e) => {
      const item = e.target.closest('.dropdown-item');
      if (!item || item.classList.contains('no-results')) return;
      
      selectedId = item.dataset.id;
      const mainText = item.querySelector('.dropdown-item-main')?.textContent || item.textContent;
      input.value = mainText;
      modal.querySelector('#add-ansprechpartner-confirm').disabled = false;
      dropdown.classList.remove('show');
    });

    // Event-Handlers
    const close = () => modal.remove();
    modal.querySelector('#add-ansprechpartner-close').onclick = close;
    modal.querySelector('#add-ansprechpartner-cancel').onclick = close;
    
    // ESC-Taste zum Schließen
    const handleEsc = (e) => {
      if (e.key === 'Escape') {
        close();
        document.removeEventListener('keydown', handleEsc);
      }
    };
    document.addEventListener('keydown', handleEsc);

    // Hinzufügen-Handler
    modal.querySelector('#add-ansprechpartner-confirm').onclick = async () => {
      if (!selectedId) return;
      
      try {
        // Ansprechpartner zur Marke hinzufügen (Junction Table)
        const { error } = await window.supabase
          .from('ansprechpartner_marke')
          .insert({ 
            marke_id: markeId, 
            ansprechpartner_id: selectedId 
          });

        if (error) throw error;

        close();
        document.removeEventListener('keydown', handleEsc);
        
        // UI aktualisieren - Multiple Events für Live-Updates
        window.dispatchEvent(new CustomEvent('entityUpdated', { 
          detail: { entity: 'ansprechpartner', action: 'added', markeId: markeId } 
        }));
        // Zusätzliches Event für MarkeList Live-Update
        window.dispatchEvent(new CustomEvent('entityUpdated', { 
          detail: { entity: 'marke', action: 'ansprechpartner-added', id: markeId } 
        }));
        
        alert('✅ Ansprechpartner wurde erfolgreich zur Marke hinzugefügt und wird automatisch angezeigt!');
        console.log('✅ ACTIONSDROPDOWN: Ansprechpartner erfolgreich hinzugefügt');

      } catch (error) {
        console.error('❌ Fehler beim Hinzufügen des Ansprechpartners:', error);
        alert('Fehler beim Hinzufügen: ' + (error.message || 'Unbekannter Fehler'));
      }
    };
  }

  // Modal: Creator zu Liste hinzufügen
  async openAddToListModal(creatorId) {
    let listen = [];
    let excludedListIds = [];
    try {
      const { data: existing } = await window.supabase
        .from('creator_list_member')
        .select('list_id')
        .eq('creator_id', creatorId);
      excludedListIds = (existing || []).map(r => r.list_id).filter(Boolean);

      const { data } = await window.supabase
        .from('creator_list')
        .select('id, name, created_at')
        .order('created_at', { ascending: false });
      listen = (data || []).filter(l => !excludedListIds.includes(l.id));
    } catch (_) {}

    const modal = document.createElement('div');
    modal.className = 'modal overlay-modal';
    modal.innerHTML = `
      <div class="modal-dialog">
        <div class="modal-header">
          <h3>Zu Liste hinzufügen</h3>
          <button class="modal-close" id="add-to-list-close">×</button>
        </div>
        <div class="modal-body">
          <label class="form-label">Liste wählen</label>
          <input type="text" id="list-search" class="form-input auto-suggest-input" placeholder="Liste suchen..." />
          <div id="list-dropdown" class="auto-suggest-dropdown"></div>
        </div>
        <div class="modal-footer">
          <button class="secondary-btn" id="add-to-list-cancel">Abbrechen</button>
          <button class="primary-btn" id="add-to-list-confirm" disabled>Hinzufügen</button>
        </div>
      </div>`;
    document.body.appendChild(modal);

    const input = modal.querySelector('#list-search');
    const dropdown = modal.querySelector('#list-dropdown');
    let selectedId = null;

    const hydrate = (term = '') => {
      const f = term.toLowerCase();
      const items = listen.filter(l => (l.name || '').toLowerCase().includes(f));
      dropdown.innerHTML = items.length
        ? items.map(l => `<div class="dropdown-item" data-id="${l.id}">${l.name}</div>`).join('')
        : '<div class="dropdown-item no-results">Keine Liste gefunden</div>';
      dropdown.classList.add('show');
    };
    hydrate('');
    input.addEventListener('focus', () => dropdown.classList.add('show'));
    input.addEventListener('blur', () => setTimeout(() => dropdown.classList.remove('show'), 150));
    let debounce;
    input.addEventListener('input', () => {
      clearTimeout(debounce);
      debounce = setTimeout(() => hydrate(input.value.trim()), 150);
    });
    dropdown.addEventListener('click', (e) => {
      const item = e.target.closest('.dropdown-item');
      if (!item || item.classList.contains('no-results')) return;
      selectedId = item.dataset.id;
      input.value = item.textContent.trim();
      modal.querySelector('#add-to-list-confirm').disabled = false;
      dropdown.classList.remove('show');
    });

    const close = () => modal.remove();
    modal.querySelector('#add-to-list-close').onclick = close;
    modal.querySelector('#add-to-list-cancel').onclick = close;
    modal.querySelector('#add-to-list-confirm').onclick = async () => {
      if (!selectedId) return;
      try {
        await window.supabase
          .from('creator_list_member')
          .insert({ list_id: selectedId, creator_id: creatorId, added_at: new Date().toISOString() });
        close();
        window.dispatchEvent(new CustomEvent('entityUpdated', { detail: { entity: 'creator_list', action: 'member-added', id: selectedId } }));
        alert('Creator zur Liste hinzugefügt.');
      } catch (err) {
        console.error('❌ Fehler beim Hinzufügen zur Liste', err);
        alert('Hinzufügen fehlgeschlagen.');
      }
    };
  }

  // Bestätigungsdialog für Löschen
  confirmDelete(entityId, entityType) {
    const entityName = this.getEntityDisplayName(entityType);
    
    if (confirm(`Möchten Sie wirklich ${entityName} löschen? Diese Aktion kann nicht rückgängig gemacht werden.`)) {
      console.log(`🗑️ Lösche ${entityType} ${entityId}`);
      // TODO: Implementiere Lösch-Logik
      window.dataService.deleteEntity(entityType, entityId).then(result => {
        if (result.success) {
          // Event auslösen für Listen-Update
          window.dispatchEvent(new CustomEvent('entityUpdated', {
            detail: { entity: entityType, action: 'deleted', id: entityId }
          }));
        }
      });
    }
  }

  // Modal für Notizen öffnen
  openNotizModal(entityId, entityType) {
    console.log(`📝 Öffne Notiz-Modal für ${entityType} ${entityId}`);
    // TODO: Implementiere Notiz-Modal
  }

  // Modal für Bewertungen öffnen
  openRatingModal(entityId, entityType) {
    console.log(`⭐ Öffne Rating-Modal für ${entityType} ${entityId}`);
    // TODO: Implementiere Rating-Modal
  }

  // Modal für Rechnungen öffnen
  openRechnungModal(entityId, entityType) {
    console.log(`💰 Öffne Rechnung-Modal für ${entityType} ${entityId}`);
    // TODO: Implementiere Rechnung-Modal
  }

  // Hilfsmethode für Entity-Namen
  getEntityDisplayName(entityType) {
    const names = {
      creator: 'den Creator',
      unternehmen: 'das Unternehmen',
      marke: 'die Marke',
      auftrag: 'den Auftrag',
      kooperation: 'die Kooperation'
    };
    return names[entityType] || 'das Element';
  }

  // Modal: Ansprechpartner zu Kampagne hinzufügen
  async openAddAnsprechpartnerToKampagneModal(kampagneId) {
    console.log('🎯 ACTIONSDROPDOWN: Öffne Ansprechpartner-Auswahl-Modal für Kampagne:', kampagneId);

    // Bereits zugeordnete Ansprechpartner laden
    let ansprechpartner = [];
    let excludedAnsprechpartnerIds = [];
    
    try {
      const { data: existing } = await window.supabase
        .from('ansprechpartner_kampagne')
        .select('ansprechpartner_id')
        .eq('kampagne_id', kampagneId);
      
      excludedAnsprechpartnerIds = (existing || []).map(r => r.ansprechpartner_id).filter(Boolean);

      // Verfügbare Ansprechpartner laden (die noch nicht zugeordnet sind)
      let query = window.supabase
        .from('ansprechpartner')
        .select(`
          id, 
          vorname, 
          nachname, 
          email,
          unternehmen:unternehmen_id(firmenname),
          position:position_id(name)
        `)
        .order('nachname');
      
      if (excludedAnsprechpartnerIds.length > 0) {
        query = query.not('id', 'in', `(${excludedAnsprechpartnerIds.join(',')})`);
      }
      
      const { data } = await query;
      ansprechpartner = data || [];
      
    } catch (error) {
      console.warn('⚠️ Fehler beim Laden der Ansprechpartner:', error);
    }

    const modal = document.createElement('div');
    modal.className = 'modal overlay-modal';
    modal.innerHTML = `
      <div class="modal-dialog">
        <div class="modal-header">
          <h3>Ansprechpartner zur Kampagne hinzufügen</h3>
          <button class="modal-close" id="add-ansprechpartner-kampagne-close">×</button>
        </div>
        <div class="modal-body">
          <label class="form-label">Ansprechpartner wählen</label>
          <input type="text" id="ansprechpartner-kampagne-search" class="form-input auto-suggest-input" placeholder="Ansprechpartner suchen..." />
          <div id="ansprechpartner-kampagne-dropdown" class="auto-suggest-dropdown"></div>
        </div>
        <div class="modal-footer">
          <button class="secondary-btn" id="add-ansprechpartner-kampagne-cancel">Abbrechen</button>
          <button class="primary-btn" id="add-ansprechpartner-kampagne-confirm" disabled>Hinzufügen</button>
        </div>
      </div>`;
    
    document.body.appendChild(modal);

    const input = modal.querySelector('#ansprechpartner-kampagne-search');
    const dropdown = modal.querySelector('#ansprechpartner-kampagne-dropdown');
    let selectedId = null;

    const hydrateDropdown = (filter = '') => {
      // Wenn kein Filter, zeige Hinweis zum Tippen
      if (!filter || filter.trim().length === 0) {
        dropdown.innerHTML = '<div class="dropdown-item no-results">Beginnen Sie zu tippen, um Ansprechpartner zu suchen...</div>';
        return;
      }
      
      const f = filter.toLowerCase();
      const items = ansprechpartner.filter(ap => {
        const fullName = `${ap.vorname} ${ap.nachname}`.toLowerCase();
        const email = (ap.email || '').toLowerCase();
        const unternehmen = (ap.unternehmen?.firmenname || '').toLowerCase();
        return fullName.includes(f) || email.includes(f) || unternehmen.includes(f);
      });
      
      dropdown.innerHTML = items.length
        ? items.map(ap => {
            const displayName = `${ap.vorname} ${ap.nachname}`;
            const details = [
              ap.email,
              ap.unternehmen?.firmenname,
              ap.position?.name
            ].filter(Boolean).join(' • ');
            
            return `<div class="dropdown-item" data-id="${ap.id}">
              <div class="dropdown-item-main">${displayName}</div>
              ${details ? `<div class="dropdown-item-details">${details}</div>` : ''}
            </div>`;
          }).join('')
        : '<div class="dropdown-item no-results">Keine verfügbaren Ansprechpartner gefunden</div>';
    };
    
    // Initial kein Dropdown anzeigen - erst beim Tippen
    dropdown.innerHTML = '<div class="dropdown-item no-results">Beginnen Sie zu tippen, um Ansprechpartner zu suchen...</div>';
    
    input.addEventListener('focus', () => {
      // Nur anzeigen wenn bereits Text eingegeben wurde
      if (input.value.trim().length > 0) {
        dropdown.classList.add('show');
      }
    });
    input.addEventListener('blur', () => {
      setTimeout(() => dropdown.classList.remove('show'), 150);
    });

    // Dynamische Suche
    let searchTimeout;
    input.addEventListener('input', (e) => {
      clearTimeout(searchTimeout);
      searchTimeout = setTimeout(async () => {
        const term = e.target.value.trim();
        
        // Kein Dropdown anzeigen wenn weniger als 1 Zeichen
        if (term.length < 1) {
          dropdown.classList.remove('show');
          return;
        }
        
        // Ab 1 Zeichen suchen und anzeigen
        try {
          let query = window.supabase
            .from('ansprechpartner')
            .select(`
              id, 
              vorname, 
              nachname, 
              email,
              unternehmen:unternehmen_id(firmenname),
              position:position_id(name)
            `)
            .or(`vorname.ilike.%${term}%,nachname.ilike.%${term}%,email.ilike.%${term}%`)
            .order('nachname');
          
          if (excludedAnsprechpartnerIds.length > 0) {
            query = query.not('id', 'in', `(${excludedAnsprechpartnerIds.join(',')})`);
          }
          
          const { data } = await query;
          ansprechpartner = data || [];
          hydrateDropdown(term);
          dropdown.classList.add('show'); // Ensure dropdown is shown after search
        } catch (err) {
          console.warn('⚠️ Ansprechpartner-Suche fehlgeschlagen', err);
        }
      }, 200);
    });

    dropdown.addEventListener('click', (e) => {
      const item = e.target.closest('.dropdown-item');
      if (!item || item.classList.contains('no-results')) return;
      
      selectedId = item.dataset.id;
      const mainText = item.querySelector('.dropdown-item-main')?.textContent || item.textContent;
      input.value = mainText;
      modal.querySelector('#add-ansprechpartner-kampagne-confirm').disabled = false;
      dropdown.classList.remove('show');
    });

    // Event-Handlers
    const close = () => modal.remove();
    modal.querySelector('#add-ansprechpartner-kampagne-close').onclick = close;
    modal.querySelector('#add-ansprechpartner-kampagne-cancel').onclick = close;
    
    // ESC-Taste zum Schließen
    const handleEsc = (e) => {
      if (e.key === 'Escape') {
        close();
        document.removeEventListener('keydown', handleEsc);
      }
    };
    document.addEventListener('keydown', handleEsc);

    // Hinzufügen-Handler
    modal.querySelector('#add-ansprechpartner-kampagne-confirm').onclick = async () => {
      if (!selectedId) return;
      
      try {
        // Ansprechpartner zur Kampagne hinzufügen (Junction Table)
        const { error } = await window.supabase
          .from('ansprechpartner_kampagne')
          .insert({ 
            kampagne_id: kampagneId, 
            ansprechpartner_id: selectedId 
          });

        if (error) throw error;

        close();
        document.removeEventListener('keydown', handleEsc);
        
        // UI aktualisieren - Multiple Events für Live-Updates
        window.dispatchEvent(new CustomEvent('entityUpdated', { 
          detail: { entity: 'ansprechpartner', action: 'added', kampagneId: kampagneId } 
        }));
        // Zusätzliches Event für KampagneList Live-Update
        window.dispatchEvent(new CustomEvent('entityUpdated', { 
          detail: { entity: 'kampagne', action: 'ansprechpartner-added', id: kampagneId } 
        }));
        
        alert('✅ Ansprechpartner wurde erfolgreich zur Kampagne hinzugefügt und wird automatisch angezeigt!');
        console.log('✅ ACTIONSDROPDOWN: Ansprechpartner erfolgreich zu Kampagne hinzugefügt');

      } catch (error) {
        console.error('❌ Fehler beim Hinzufügen des Ansprechpartners:', error);
        alert('Fehler beim Hinzufügen: ' + (error.message || 'Unbekannter Fehler'));
      }
    };
  }

  // Cleanup
  destroy() {
    console.log('🗑️ ACTIONSDROPDOWN: Cleanup');
    this.closeAllDropdowns();
    this.boundEventListeners.forEach(({ element, type, handler }) => {
      element.removeEventListener(type, handler);
    });
    this.boundEventListeners.clear();
  }
}

// Singleton-Instanz erstellen
export const actionsDropdown = new ActionsDropdown(); 