import{m as _,_ as B,c as Z}from"./modules-DoZ5_CqG.js";import{a as K,b as q,p as Le}from"./auth-h_Ct-JI2.js";import"./core-C7Vz5Umf.js";(function(){const e=document.createElement("link").relList;if(e&&e.supports&&e.supports("modulepreload"))return;for(const a of document.querySelectorAll('link[rel="modulepreload"]'))n(a);new MutationObserver(a=>{for(const r of a)if(r.type==="childList")for(const i of r.addedNodes)i.tagName==="LINK"&&i.rel==="modulepreload"&&n(i)}).observe(document,{childList:!0,subtree:!0});function t(a){const r={};return a.integrity&&(r.integrity=a.integrity),a.referrerPolicy&&(r.referrerPolicy=a.referrerPolicy),a.crossOrigin==="use-credentials"?r.credentials="include":a.crossOrigin==="anonymous"?r.credentials="omit":r.credentials="same-origin",r}function n(a){if(a.ep)return;a.ep=!0;const r=t(a);fetch(a.href,r)}})();const ze={SUPABASE:{URL:"https://yktycclozgsgaasduyol.supabase.co",KEY:"eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlrdHljY2xvemdzZ2Fhc2R1eW9sIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTMwODYzNTEsImV4cCI6MjA2ODY2MjM1MX0.6TM9Td6iKgmXV_fEPMJWZiD9n--X9TeNk0FoeL5B-9c"},APP:{NAME:"CRM Dashboard",VERSION:"2.0.0",DEBUG:!1,OFFLINE_MODE:!1},AUTH:{MIN_PASSWORD_LENGTH:4,MAX_LOGIN_ATTEMPTS:3,LOCKOUT_TIME:900*1e3},UI:{THEME:"light",LANGUAGE:"de",ANIMATIONS:!0}};typeof window<"u"&&(window.CONFIG=ze);class Me{constructor(){this.dropdowns=new Map,this.boundEventListeners=new Set,this._iconObserver=null,this._normalizingIcons=!1}init(){console.log("🎯 ACTIONSDROPDOWN: Initialisiere ActionsDropdown"),this.bindGlobalEvents(),this.normalizeIcons(document),this.observeTableMutations(),setTimeout(()=>{console.log("🔍 ACTIONSDROPDOWN: Debug - Überprüfe Initialisierung"),console.log("🔍 ACTIONSDROPDOWN: window.ActionsDropdown verfügbar:",!!window.ActionsDropdown),console.log("🔍 ACTIONSDROPDOWN: createAuftragActions verfügbar:",!!window.ActionsDropdown?.createAuftragActions)},1e3)}getHeroIcon(e){switch(e){case"view":return`
<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="size-6">
  <path stroke-linecap="round" stroke-linejoin="round" d="M2.036 12.322a1.012 1.012 0 0 1 0-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178Z" />
  <path stroke-linecap="round" stroke-linejoin="round" d="M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" />
</svg>`;case"edit":return`
<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="size-6">
  <path stroke-linecap="round" stroke-linejoin="round" d="m16.862 4.487 1.687-1.688a1.875 1.875 0 1 1 2.652 2.652L10.582 16.07a4.5 4.5 0 0 1-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 0 1 1.13-1.897l8.932-8.931Zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0 1 15.75 21H5.25A2.25 2.25 0 0 1 3 18.75V8.25A2.25 2.25 0 0 1 5.25 6H10" />
</svg>`;case"note":case"notiz":return`
<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="size-6">
  <path stroke-linecap="round" stroke-linejoin="round" d="M7.5 8.25h9m-9 3H12m-9.75 1.51c0 1.6 1.123 2.994 2.707 3.227 1.129.166 2.27.293 3.423.379.35.026.67.21.865.501L12 21l2.755-4.133a1.14 1.14 0 0 1 .865-.501 48.172 48.172 0 0 0 3.423-.379c1.584-.233 2.707-1.626 2.707-3.228V6.741c0-1.602-1.123-2.995-2.707-3.228A48.394 48.394 0 0 0 12 3c-2.392 0-4.744.175-7.043.513C3.373 3.746 2.25 5.14 2.25 6.741v6.018Z" />
</svg>`;case"delete":return`
<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="size-6">
  <path stroke-linecap="round" stroke-linejoin="round" d="m14.74 9-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 0 1-2.244 2.077H8.084a2.25 2.25 0 0 1-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 0 0-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 0 1 3.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 0 0-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 0 0-7.5 0" />
</svg>`;case"add-to-campaign":return`
<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="size-6">
  <path stroke-linecap="round" stroke-linejoin="round" d="M10.34 15.84c-.688-.06-1.386-.09-2.09-.09H7.5a4.5 4.5 0 1 1 0-9h.75c.704 0 1.402-.03 2.09-.09m0 9.18c.253.962.584 1.892.985 2.783.247.55.06 1.21-.463 1.511l-.657.38c-.551.318-1.26.117-1.527-.461a20.845 20.845 0 0 1-1.44-4.282m3.102.069a18.03 18.03 0 0 1-.59-4.59c0-1.586.205-3.124.59-4.59m0 9.18a23.848 23.848 0 0 1 8.835 2.535M10.34 6.66a23.847 23.847 0 0 0 8.835-2.535m0 0A23.74 23.74 0 0 0 18.795 3m.38 1.125a23.91 23.91 0 0 1 1.014 5.395m-1.014 8.855c-.118.38-.245.754-.38 1.125m.38-1.125a23.91 23.91 0 0 0 1.014-5.395m0-3.46c.495.413.811 1.035.811 1.73 0 .695-.316 1.317-.811 1.73m0-3.46a24.347 24.347 0 0 1 0 3.46" />
</svg>`;case"favorite":return`
<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="size-6">
  <path stroke-linecap="round" stroke-linejoin="round" d="M17.593 3.322c1.1.128 1.907 1.077 1.907 2.185V21L12 17.25 4.5 21V5.507c0-1.108.806-2.057 1.907-2.185a48.507 48.507 0 0 1 11.186 0Z" />
</svg>`;case"add-to-list":return`
<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="size-6">
  <path stroke-linecap="round" stroke-linejoin="round" d="M8.25 6.75h12M8.25 12h12m-12 5.25h12M3.75 6.75h.007v.008H3.75V6.75Zm.375 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0ZM3.75 12h.007v.008H3.75V12Zm.375 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Zm-.375 5.25h.007v.008H3.75v-.008Zm.375 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Z" />
</svg>`;case"check":return`
<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="size-5">
  <path stroke-linecap="round" stroke-linejoin="round" d="m4.5 12.75 6 6 9-13.5" />
</svg>`;case"zap":return`
<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="size-6">
  <path stroke-linecap="round" stroke-linejoin="round" d="m3.75 13.5 10.5-11.25L12 10.5h8.25L9.75 21.75 12 13.5H3.75Z" />
</svg>`;case"invoice":return`
<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="size-6">
  <path stroke-linecap="round" stroke-linejoin="round" d="m3.75 13.5 10.5-11.25L12 10.5h8.25L9.75 21.75 12 13.5H3.75Z" />
</svg>`;case"quickview":return`
<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="size-6">
  <path stroke-linecap="round" stroke-linejoin="round" d="M3.75 3.75v4.5m0-4.5h4.5m-4.5 0L9 9M3.75 20.25v-4.5m0 4.5h4.5m-4.5 0L9 15M20.25 3.75h-4.5m4.5 0v4.5m0-4.5L15 9m5.25 11.25h-4.5m4.5 0v-4.5m0 4.5L15 15" />
</svg>`;case"status-offen":return`
<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="size-6">
  <path stroke-linecap="round" stroke-linejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
</svg>`;case"status-rueckfrage":return`
<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="size-6">
  <path stroke-linecap="round" stroke-linejoin="round" d="M9.879 7.519c1.171-1.025 3.071-1.025 4.242 0 1.172 1.025 1.172 2.687 0 3.712-.203.179-.43.326-.67.442-.745.361-1.45.999-1.45 1.827v.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Zm-9 5.25h.008v.008H12v-.008Z" />
</svg>`;case"status-bezahlt":return`
<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="size-6">
  <path stroke-linecap="round" stroke-linejoin="round" d="M10.125 2.25h-4.5c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125v-9M10.125 2.25h.375a9 9 0 0 1 9 9v.375M10.125 2.25A3.375 3.375 0 0 1 13.5 5.625v1.5c0 .621.504 1.125 1.125 1.125h1.5a3.375 3.375 0 0 1 3.375 3.375M9 15l2.25 2.25L15 12" />
</svg>`;case"status-qonto":return`
<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="size-6">
  <path stroke-linecap="round" stroke-linejoin="round" d="M6 12 3.269 3.125A59.769 59.769 0 0 1 21.485 12 59.768 59.768 0 0 1 3.27 20.875L5.999 12Zm0 0h7.5" />
</svg>`;default:return""}}getStatusIcon(e){switch(String(e||"").toLowerCase().trim()){case"strategie":return`
<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="size-6">
  <path stroke-linecap="round" stroke-linejoin="round" d="M14.25 6.087c0-.355.186-.676.401-.959.221-.29.349-.634.349-1.003 0-1.036-1.007-1.875-2.25-1.875s-2.25.84-2.25 1.875c0 .369.128.713.349 1.003.215.283.401.604.401.959v0a.64.64 0 0 1-.657.643 48.39 48.39 0 0 1-4.163-.3c.186 1.613.293 3.25.315 4.907a.656.656 0 0 1-.658.663v0c-.355 0-.676-.186-.959-.401a1.647 1.647 0 0 0-1.003-.349c-1.036 0-1.875 1.007-1.875 2.25s.84 2.25 1.875 2.25c.369 0 .713-.128 1.003-.349.283-.215.604-.401.959-.401v0c.31 0 .555.26.532.57a48.039 48.039 0 0 1-.642 5.056c1.518.19 3.058.309 4.616.354a.64.64 0 0 0 .657-.643v0c0-.355-.186-.676-.401-.959a1.647 1.647 0 0 1-.349-1.003c0-1.035 1.008-1.875 2.25-1.875 1.243 0 2.25.84 2.25 1.875 0 .369-.128.713-.349 1.003-.215.283-.4.604-.4.959v0c0 .333.277.599.61.58a48.1 48.1 0 0 0 5.427-.63 48.05 48.05 0 0 0 .582-4.717.532.532 0 0 0-.533-.57v0c-.355 0-.676.186-.959.401-.29.221-.634.349-1.003.349-1.035 0-1.875-1.007-1.875-2.25s.84-2.25 1.875-2.25c.37 0 .713.128 1.003.349.283.215.604.401.96.401v0a.656.656 0 0 0 .658-.663 48.422 48.422 0 0 0-.37-5.36c-1.886.342-3.81.574-5.766.689a.578.578 0 0 1-.61-.58v0Z" />
</svg>`;case"abgeschlossen":return`
<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="size-6">
  <path stroke-linecap="round" stroke-linejoin="round" d="M9 12.75 11.25 15 15 9.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
</svg>`;case"video produktion":return`
<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="size-6">
  <path stroke-linecap="round" stroke-linejoin="round" d="M3.375 19.5h17.25m-17.25 0a1.125 1.125 0 0 1-1.125-1.125M3.375 19.5h1.5C5.496 19.5 6 18.996 6 18.375m-3.75 0V5.625m0 12.75v-1.5c0-.621.504-1.125 1.125-1.125m18.375 2.625V5.625m0 12.75c0 .621-.504 1.125-1.125 1.125m1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125m0 3.75h-1.5A1.125 1.125 0 0 1 18 18.375M20.625 4.5H3.375m17.25 0c.621 0 1.125.504 1.125 1.125M20.625 4.5h-1.5C18.504 4.5 18 5.004 18 5.625m3.75 0v1.5c0 .621-.504 1.125-1.125 1.125M3.375 4.5c-.621 0-1.125.504-1.125 1.125M3.375 4.5h1.5C5.496 4.5 6 5.004 6 5.625m-3.75 0v1.5c0 .621.504 1.125 1.125 1.125m0 0h1.5m-1.5 0c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125m1.5-3.75C5.496 8.25 6 7.746 6 7.125v-1.5M4.875 8.25C5.496 8.25 6 8.754 6 9.375v1.5m0-5.25v5.25m0-5.25C6 5.004 6.504 4.5 7.125 4.5h9.75c.621 0 1.125.504 1.125 1.125m1.125 2.625h1.5m-1.5 0A1.125 1.125 0 0 1 18 7.125v-1.5m1.125 2.625c-.621 0-1.125.504-1.125 1.125v1.5m2.625-2.625c.621 0 1.125.504 1.125 1.125v1.5c0 .621-.504 1.125-1.125 1.125M18 5.625v5.25M7.125 12h9.75m-9.75 0A1.125 1.125 0 0 1 6 10.875M7.125 12C6.504 12 6 12.504 6 13.125m0-2.25C6 11.496 5.496 12 4.875 12M18 10.875c0 .621-.504 1.125-1.125 1.125M18 10.875c0 .621.504 1.125 1.125 1.125m-2.25 0c.621 0 1.125.504 1.125 1.125m-12 5.25v-5.25m0 5.25c0 .621.504 1.125 1.125 1.125h9.75c.621 0 1.125-.504 1.125-1.125m-12 0v-1.5c0-.621-.504-1.125-1.125-1.125M18 18.375v-5.25m0 5.25v-1.5c0-.621.504-1.125 1.125-1.125M18 13.125v1.5c0 .621.504 1.125 1.125 1.125M18 13.125c0-.621.504-1.125 1.125-1.125M6 13.125v1.5c0 .621-.504 1.125-1.125 1.125M6 13.125C6 12.504 5.496 12 4.875 12m-1.5 0h1.5m-1.5 0c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125M19.125 12h1.5m0 0c.621 0 1.125.504 1.125 1.125v1.5c0 .621-.504 1.125-1.125 1.125m-17.25 0h1.5m14.25 0h1.5" />
</svg>`;case"creator sourcing":return`
<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="size-6">
  <path stroke-linecap="round" stroke-linejoin="round" d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z" />
</svg>`;case"script erstellung":return`
<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="size-6">
  <path stroke-linecap="round" stroke-linejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Z" />
</svg>`;case"post produktion":return`
<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="size-6">
  <path stroke-linecap="round" stroke-linejoin="round" d="m7.848 8.25 1.536.887M7.848 8.25a3 3 0 1 1-5.196-3 3 3 0 0 1 5.196 3Zm1.536.887a2.165 2.165 0 0 1 1.083 1.839c.005.351.054.695.14 1.024M9.384 9.137l2.077 1.199M7.848 15.75l1.536-.887m-1.536.887a3 3 0 1 1-5.196 3 3 3 0 0 1 5.196-3Zm1.536-.887a2.165 2.165 0 0 0 1.083-1.838c.005-.352.054-.695.14-1.025m-1.223 2.863 2.077-1.199m0-3.328a4.323 4.323 0 0 1 2.068-1.379l5.325-1.628a4.5 4.5 0 0 1 2.48-.044l.803.215-7.794 4.5m-2.882-1.664A4.33 4.33 0 0 0 10.607 12m3.736 0 7.794 4.5-.802.215a4.5 4.5 0 0 1-2.48-.043l-5.326-1.629a4.324 4.324 0 0 1-2.068-1.379M14.343 12l-2.882 1.664" />
</svg>`;case"verträge":case"vertraege":return`
<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="size-6">
  <path stroke-linecap="round" stroke-linejoin="round" d="M8.25 7.5V6.108c0-1.135.845-2.098 1.976-2.192.373-.03.748-.057 1.123-.08M15.75 18H18a2.25 2.25 0 0 0 2.25-2.25V6.108c0-1.135-.845-2.098-1.976-2.192a48.424 48.424 0 0 0-1.123-.08M15.75 18.75v-1.875a3.375 3.375 0 0 0-3.375-3.375h-1.5a1.125 1.125 0 0 1-1.125-1.125v-1.5A3.375 3.375 0 0 0 6.375 7.5H5.25m11.9-3.664A2.251 2.251 0 0 0 15 2.25h-1.5a2.251 2.251 0 0 0-2.15 1.586m5.8 0c.065.21.1.433.1.664v.75h-6V4.5c0-.231.035-.454.1-.664M6.75 7.5H4.875c-.621 0-1.125.504-1.125 1.125v12c0 .621.504 1.125 1.125 1.125h9.75c.621 0 1.125-.504 1.125-1.125V16.5a9 9 0 0 0-9-9Z" />
</svg>`;case"besprechung":return`
<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="size-6">
  <path stroke-linecap="round" stroke-linejoin="round" d="M20.25 8.511c.884.284 1.5 1.128 1.5 2.097v4.286c0 1.136-.847 2.1-1.98 2.193-.34.027-.68.052-1.02.072v3.091l-3-3c-1.354 0-2.694-.055-4.02-.163a2.115 2.115 0 0 1-.825-.242m9.345-8.334a2.126 2.126 0 0 0-.476-.095 48.64 48.64 0 0 0-8.048 0c-1.131.094-1.976 1.057-1.976 2.192v4.286c0 .837.46 1.58 1.155 1.951m9.345-8.334V6.637c0-1.621-1.152-3.026-2.76-3.235A48.455 48.455 0 0 0 11.25 3c-2.115 0-4.198.137-6.24.402-1.608.209-2.76 1.614-2.76 3.235v6.226c0 1.621 1.152 3.026 2.76 3.235.577.075 1.157.14 1.74.194V21l4.155-4.155" />
</svg>`;case"rechnungen":return`
<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="size-6">
  <path stroke-linecap="round" stroke-linejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m0 11.625h4.5m-4.5 2.25h4.5m2.121 1.527c-1.171 1.464-3.07 1.464-4.242 0-1.172-1.465-1.172-3.84 0-5.304 1.171-1.464 3.07-1.464 4.242 0M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Z" />
</svg>`;case"kick-off":case"kickoff":return`
<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="size-6">
  <path stroke-linecap="round" stroke-linejoin="round" d="M15.59 14.37a6 6 0 0 1-5.84 7.38v-4.8m5.84-2.58a14.98 14.98 0 0 0 6.16-12.12A14.98 14.98 0 0 0 9.631 8.41m5.96 5.96a14.926 14.926 0 0 1-5.841 2.58m-.119-8.54a6 6 0 0 0-7.381 5.84h4.8m2.581-5.84a14.927 14.927 0 0 0-2.58 5.84m2.699 2.7c-.103.021-.207.041-.311.06a15.09 15.09 0 0 1-2.448-2.448 14.9 14.9 0 0 1 .06-.312m-2.24 2.39a4.493 4.493 0 0 0-1.757 4.306 4.493 4.493 0 0 0 4.306-1.758M16.5 9a1.5 1.5 0 1 1-3 0 1.5 1.5 0 0 1 3 0Z" />
</svg>`;case"creator briefing":return`
<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="size-6">
  <path stroke-linecap="round" stroke-linejoin="round" d="M9 12h3.75M9 15h3.75M9 18h3.75m3 .75H18a2.25 2.25 0 0 0 2.25-2.25V6.108c0-1.135-.845-2.098-1.976-2.192a48.424 48.424 0 0 0-1.123-.08m-5.801 0c-.065.21-.1.433-.1.664 0 .414.336.75.75.75h4.5a.75.75 0 0 0 .75-.75 2.25 2.25 0 0 0-.1-.664m-5.8 0A2.251 2.251 0 0 1 13.5 2.25H15c1.012 0 1.867.668 2.15 1.586m-5.8 0c-.376.023-.75.05-1.124.08C9.095 4.01 8.25 4.973 8.25 6.108V8.25m0 0H4.875c-.621 0-1.125.504-1.125 1.125v11.25c0 .621.504 1.125 1.125 1.125h9.75c.621 0 1.125-.504 1.125-1.125V9.375c0-.621-.504-1.125-1.125-1.125H8.25ZM6.75 12h.008v.008H6.75V12Zm0 3h.008v.008H6.75V15Zm0 3h.008v.008H6.75V18Z" />
</svg>`;default:return this.getHeroIcon("status-offen")}}async setField(e,t,n,a){try{if(console.log("⬆️ setField starte Update",{entityType:e,entityId:t,fieldName:n,fieldValue:a}),window.supabase){const r=window.dataService?.entities?.[e]?.table||e,i={[n]:a};window.dataService?.entities?.[e]?.fields?.updated_at&&(i.updated_at=new Date().toISOString());const{error:s}=await window.supabase.from(r).update(i).eq("id",t);if(s)throw s}else if(window.dataService?.updateEntity){const r=await window.dataService.updateEntity(e,t,{[n]:a});if(!r?.success)throw new Error(r?.error||"Update fehlgeschlagen")}else throw new Error("Kein Update-Mechanismus verfügbar");console.log("✅ setField DB-Update erfolgreich"),window.dispatchEvent(new CustomEvent("entityUpdated",{detail:{entity:e,action:"updated",id:t,field:n,value:a}}))}catch(r){console.error("❌ setField fehlgeschlagen",r),alert("Aktualisierung fehlgeschlagen.")}}normalizeIcons(e){try{if(this._normalizingIcons)return;this._normalizingIcons=!0,(e||document).querySelectorAll('.actions-dropdown:not([data-icons-normalized="1"])').forEach(a=>{const r=(i,s)=>{a.querySelectorAll(i).forEach(o=>{const l=o.querySelector("svg");l&&l.remove(),o.insertAdjacentHTML("afterbegin",this.getHeroIcon(s))})};r('.action-item[data-action="view"]',"view"),r('.action-item[data-action="edit"]',"edit"),r('.action-item[data-action="notiz"]',"notiz"),r('.action-item[data-action="favorite"]',"favorite"),r('.action-item.action-danger[data-action="delete"]',"delete"),a.setAttribute("data-icons-normalized","1")})}catch(t){console.warn("⚠️ ACTIONSDROPDOWN: normalizeIcons Fehler",t)}finally{this._normalizingIcons=!1}}observeTableMutations(){if(this._iconObserver)return;const e=document.getElementById("dashboard-content")||document.body,t=new MutationObserver(n=>{for(const a of n)a.addedNodes&&a.addedNodes.length>0&&a.addedNodes.forEach(r=>{r.nodeType===1&&this.normalizeIcons(r)})});t.observe(e,{childList:!0,subtree:!0}),this._iconObserver=t}bindGlobalEvents(){document.addEventListener("click",e=>{const t=e.target.closest(".actions-toggle");t&&(e.preventDefault(),typeof e.stopImmediatePropagation=="function"?e.stopImmediatePropagation():e.stopPropagation(),this.toggleDropdown(t))}),document.addEventListener("click",async e=>{const t=e.target.closest(".submenu-item");if(!t)return;e.preventDefault(),typeof e.stopImmediatePropagation=="function"&&e.stopImmediatePropagation();const n=t.dataset.id,a=t.dataset.field,r=t.dataset.value,i=t.closest(".actions-dropdown-container")?.dataset?.entityType||"auftrag";if(console.log("▶️ Submenu-Click erkannt",{entityType:i,entityId:n,fieldName:a,fieldValue:r}),t.dataset.action==="set-field"){try{if(i==="kampagne"&&a==="status_id"){const s=t.dataset.statusName||"",{error:o}=await window.supabase.from("kampagne").update({status_id:r,status:s,updated_at:new Date().toISOString()}).eq("id",n);if(o)throw o;window.dispatchEvent(new CustomEvent("entityUpdated",{detail:{entity:"kampagne",action:"updated",id:n,field:"status_id",value:r}})),console.log("✅ Status (id+name) aktualisiert")}else if(i==="kooperation"&&a==="status_id"){const s=t.dataset.statusName||"",{error:o}=await window.supabase.from("kooperationen").update({status_id:r,status:s,updated_at:new Date().toISOString()}).eq("id",n);if(o)throw o;window.dispatchEvent(new CustomEvent("entityUpdated",{detail:{entity:"kooperation",action:"updated",id:n,field:"status_id",value:r}})),console.log("✅ Kooperation-Status (id+name) aktualisiert")}else await this.setField(i,n,a,r),console.log("✅ setField abgeschlossen")}catch(s){console.error("❌ setField Fehler aus Submenu",s),alert("Aktualisierung fehlgeschlagen.")}this.closeAllDropdowns()}}),document.addEventListener("click",e=>{const t=e.target.closest(".action-item");if(!t)return;const n=t.dataset?.action;if(!n)return;e.preventDefault(),typeof e.stopImmediatePropagation=="function"?e.stopImmediatePropagation():e.stopPropagation();const a=t.dataset.id;let i=t.closest(".actions-dropdown-container")?.dataset?.entityType||"auftrag";if(console.log(`🎯 ACTIONSDROPDOWN: Entity-Type aus data-attribute: ${i}`),n==="favorite"){const s=t.dataset.creatorId||a;let o=t.dataset.kampagneId||null;this.addToFavorites(s,o),this.closeAllDropdowns();return}this.handleAction(n,a,i,t),this.closeAllDropdowns()}),document.addEventListener("click",e=>{e.target.closest(".actions-dropdown-container")||this.closeAllDropdowns()}),document.addEventListener("keydown",e=>{e.key==="Escape"&&this.closeAllDropdowns()})}getEntityTypeFromContext(e){const n=window.location.pathname.split("/").filter(o=>o);if(n.length>0){const o=n[0];if(["creator","unternehmen","marke","auftrag"].includes(o))return o}const a=e.closest("tr");if(a){const o=a.closest("table");if(o){const l=o.id;if(l.includes("creator"))return"creator";if(l.includes("unternehmen"))return"unternehmen";if(l.includes("marke"))return"marke";if(l.includes("auftrag"))return"auftrag"}}const r=e.textContent.toLowerCase();if(r.includes("creator")||r.includes("creator"))return"creator";if(r.includes("unternehmen")||r.includes("firmenname"))return"unternehmen";if(r.includes("marke")||r.includes("markenname"))return"marke";if(r.includes("auftrag")||r.includes("auftragsname"))return"auftrag";const i=e.closest("tbody");if(i){const o=i.closest("table");if(o){const l=o.querySelectorAll("th");for(let c of l){const d=c.textContent.toLowerCase();if(d.includes("creator")||d.includes("influencer"))return"creator";if(d.includes("unternehmen")||d.includes("firmenname"))return"unternehmen";if(d.includes("marke")||d.includes("markenname"))return"marke";if(d.includes("auftrag")||d.includes("auftragsname"))return"auftrag"}}}const s=window.location.pathname;return s.includes("/creator")?"creator":s.includes("/unternehmen")?"unternehmen":s.includes("/marke")?"marke":(s.includes("/auftrag")||console.warn('⚠️ Konnte Entity-Type nicht ermitteln, verwende "auftrag" als Fallback'),"auftrag")}toggleDropdown(e){const t=e.nextElementSibling,n=t.classList.contains("show");this.closeAllDropdowns(),n||(t.classList.add("show"),e.setAttribute("aria-expanded","true"))}closeAllDropdowns(){document.querySelectorAll(".actions-dropdown").forEach(e=>{e.classList.remove("show")}),document.querySelectorAll(".actions-toggle").forEach(e=>{e.setAttribute("aria-expanded","false")})}createCreatorActions(e){return`
      <div class="actions-dropdown-container">
        <button class="actions-toggle" aria-expanded="false" aria-label="Aktionen">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
            <path d="M12 8c1.1 0 2-.9 2-2s-.9-2-2-2-2 .9-2 2 .9 2 2 2zm0 2c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2zm0 6c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2z"/>
          </svg>
        </button>
        <div class="actions-dropdown">
          <a href="#" class="action-item" data-action="view" data-id="${e}">
            <i class="icon-eye"></i>
            Details anzeigen
          </a>
          <a href="#" class="action-item" data-action="edit" data-id="${e}">
            <i class="icon-edit"></i>
            Bearbeiten
          </a>
          <a href="#" class="action-item" data-action="notiz" data-id="${e}">
            <i class="icon-note"></i>
            Notiz hinzufügen
          </a>
          <a href="#" class="action-item" data-action="rating" data-id="${e}">
            
            Bewerten
          </a>
          <a href="#" class="action-item" data-action="add_to_list" data-id="${e}">
            ${this.getHeroIcon("add-to-list")}
            Zur Liste hinzufügen
          </a>
          <div class="action-separator"></div>
          <a href="#" class="action-item action-danger" data-action="delete" data-id="${e}">
            <i class="icon-trash"></i>
            Löschen
          </a>
        </div>
      </div>
    `}createUnternehmenActions(e){return`
      <div class="actions-dropdown-container">
        <button class="actions-toggle" aria-expanded="false" aria-label="Aktionen">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
            <path d="M12 8c1.1 0 2-.9 2-2s-.9-2-2-2-2 .9-2 2 .9 2 2 2zm0 2c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2zm0 6c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2z"/>
          </svg>
        </button>
        <div class="actions-dropdown">
          <a href="#" class="action-item" data-action="view" data-id="${e}">
            <i class="icon-eye"></i>
            Details anzeigen
          </a>
          <a href="#" class="action-item" data-action="edit" data-id="${e}">
            <i class="icon-edit"></i>
            Bearbeiten
          </a>
          <a href="#" class="action-item" data-action="notiz" data-id="${e}">
            <i class="icon-note"></i>
            Notiz hinzufügen
          </a>
          <a href="#" class="action-item" data-action="marken" data-id="${e}">
            <i class="icon-tag"></i>
            Marken anzeigen
          </a>
          <a href="#" class="action-item" data-action="auftraege" data-id="${e}">
            <i class="icon-briefcase"></i>
            Aufträge anzeigen
          </a>
          <div class="action-separator"></div>
          <a href="#" class="action-item action-danger" data-action="delete" data-id="${e}">
            <i class="icon-trash"></i>
            Löschen
          </a>
        </div>
      </div>
    `}createMarkeActions(e){return`
      <div class="actions-dropdown-container">
        <button class="actions-toggle" aria-expanded="false" aria-label="Aktionen">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
            <path d="M12 8c1.1 0 2-.9 2-2s-.9-2-2-2-2 .9-2 2 .9 2 2 2zm0 2c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2zm0 6c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2z"/>
          </svg>
        </button>
        <div class="actions-dropdown">
          <a href="#" class="action-item" data-action="view" data-id="${e}">
            <i class="icon-eye"></i>
            Details anzeigen
          </a>
          <a href="#" class="action-item" data-action="edit" data-id="${e}">
            <i class="icon-edit"></i>
            Bearbeiten
          </a>
          <a href="#" class="action-item" data-action="notiz" data-id="${e}">
            <i class="icon-note"></i>
            Notiz hinzufügen
          </a>
          <a href="#" class="action-item" data-action="auftraege" data-id="${e}">
            <i class="icon-briefcase"></i>
            Aufträge anzeigen
          </a>
          <div class="action-separator"></div>
          <a href="#" class="action-item action-danger" data-action="delete" data-id="${e}">
            <i class="icon-trash"></i>
            Löschen
          </a>
        </div>
      </div>
    `}createKooperationActions(e){return`
      <div class="actions-dropdown-container" data-entity-type="kooperation">
        <button class="actions-toggle" aria-expanded="false" aria-label="Aktionen">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" class="w-5 h-5">
            <path d="M10 3a1.5 1.5 0 110 3 1.5 1.5 0 010-3zM10 8.5a1.5 1.5 0 110 3 1.5 1.5 0 010-3zM11.5 15.5a1.5 1.5 0 10-3 0 1.5 1.5 0 003 0z" />
          </svg>
        </button>
        <div class="actions-dropdown">
          <a href="#" class="action-item" data-action="view" data-id="${e}">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" class="w-5 h-5">
              <path d="M10 12.5a2.5 2.5 0 100-5 2.5 2.5 0 000 5z" />
              <path fill-rule="evenodd" d="M.661 10c1.743-2.372 4.761-5 9.339-5 4.578 0 7.601 2.628 9.339 5-1.738 2.372-4.761 5-9.339 5-4.578 0-7.601-2.628-9.339-5zM10 15a5 5 0 100-10 5 5 0 000 10z" clip-rule="evenodd" />
            </svg>
            Details anzeigen
          </a>
          <a href="#" class="action-item" data-action="edit" data-id="${e}">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" class="w-5 h-5">
              <path d="M5.433 13.917l-1.523 1.523a.75.75 0 001.06 1.06l1.523-1.523L5.433 13.917zM11.206 6.106L13.917 3.4a.75.75 0 011.06 1.06l-2.711 2.711-.693-.693z" />
              <path fill-rule="evenodd" d="M1.334 10.606a1.5 1.5 0 011.06-1.06l10.38-10.38a1.5 1.5 0 012.122 0l1.523 1.523a1.5 1.5 0 010 2.122l-10.38 10.38a1.5 1.5 0 01-1.06 1.06H1.334v-3.182z" clip-rule="evenodd" />
            </svg>
            Bearbeiten
          </a>
          <a href="#" class="action-item" data-action="notiz" data-id="${e}">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" class="w-5 h-5">
              <path fill-rule="evenodd" d="M18 10c0 3.866-3.582 7-8 7a8.841 8.841 0 01-4.083-.98L2 17l1.336-3.117C2.688 12.31 2 11.104 2 10c0-3.866 3.582-7 8-7s8 3.134 8 7zM7 9H5v2h2V9zm8 0h-2v2h2V9zM9 9h2v2H9V9z" clip-rule="evenodd" />
            </svg>
            Notiz hinzufügen
          </a>
          <a href="#" class="action-item" data-action="quickview" data-id="${e}">
            ${this.getHeroIcon("quickview")}
            Schnellansicht öffnen
          </a>
          <div class="action-separator"></div>
          <a href="#" class="action-item action-danger" data-action="delete" data-id="${e}">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" class="w-5 h-5">
              <path fill-rule="evenodd" d="M8.75 1A2.75 2.75 0 006 3.75v.443c-.795.077-1.584.176-2.368.298a.75.75 0 10.232 1.482l.175-.027c.572-.089 1.14-.19 1.706-.302A3.75 3.75 0 019.75 3h.5a3.75 3.75 0 013.657 3.234c.566.112 1.134.213 1.706.302l.175.027a.75.75 0 10.232-1.482A41.203 41.203 0 0014 4.193V3.75A2.75 2.75 0 0011.25 1h-2.5zM2.5 7.75a.75.75 0 01.75-.75h13.5a.75.75 0 010 1.5H3.25a.75.75 0 01-.75-.75zM7.25 9.75a.75.75 0 01.75-.75h4.5a.75.75 0 010 1.5H8a.75.75 0 01-.75-.75zM6 12.25a.75.75 0 01.75-.75h6.5a.75.75 0 010 1.5H6.75a.75.75 0 01-.75-.75zM4.75 14.75a.75.75 0 01.75-.75h9.5a.75.75 0 010 1.5h-9.5a.75.75 0 01-.75-.75z" clip-rule="evenodd" />
            </svg>
            Löschen
          </a>
        </div>
      </div>
    `}createAuftragActions(e){console.log("🎯 ACTIONSDROPDOWN: createAuftragActions aufgerufen für ID:",e);const t=`
      <div class="actions-dropdown-container">
        <button class="actions-toggle" aria-expanded="false" aria-label="Aktionen">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
            <path d="M12 8c1.1 0 2-.9 2-2s-.9-2-2-2-2 .9-2 2 .9 2 2 2zm0 2c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2zm0 6c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2z"/>
          </svg>
        </button>
        <div class="actions-dropdown">
          <a href="#" class="action-item" data-action="view" data-id="${e}">
            <i class="icon-eye"></i>
            Details anzeigen
          </a>
          <a href="#" class="action-item" data-action="edit" data-id="${e}">
            <i class="icon-edit"></i>
            Bearbeiten
          </a>
          <a href="#" class="action-item" data-action="notiz" data-id="${e}">
            <i class="icon-note"></i>
            Notiz hinzufügen
          </a>
          <a href="#" class="action-item" data-action="kampagnen" data-id="${e}">
            <i class="icon-campaign"></i>
            Kampagnen anzeigen
          </a>
          <a href="#" class="action-item" data-action="rechnung" data-id="${e}">
            <i class="icon-invoice"></i>
            Rechnung erstellen
          </a>
          <div class="action-separator"></div>
          <a href="#" class="action-item action-danger" data-action="delete" data-id="${e}">
            <i class="icon-trash"></i>
            Löschen
          </a>
        </div>
      </div>
    `;return console.log("🎯 ACTIONSDROPDOWN: HTML generiert:",t.substring(0,100)+"..."),t}createGenericActions(e,t,n=[]){return`
      <div class="actions-dropdown-container">
        <button class="actions-toggle" aria-expanded="false" aria-label="Aktionen">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
            <path d="M12 8c1.1 0 2-.9 2-2s-.9-2-2-2-2 .9-2 2 .9 2 2 2zm0 2c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2zm0 6c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2z"/>
          </svg>
        </button>
        <div class="actions-dropdown">
          ${[...[{action:"view",icon:"icon-eye",label:"Details anzeigen"},{action:"edit",icon:"icon-edit",label:"Bearbeiten"},{action:"notiz",icon:"icon-note",label:"Notiz hinzufügen"}],...n].map(s=>`
        <a href="#" class="action-item ${s.action==="delete"?"action-danger":""}" data-action="${s.action}" data-id="${t}">
          <i class="${s.icon}"></i>
          ${s.label}
        </a>
      `).join("")}
        </div>
      </div>
    `}handleAction(e,t,n,a){switch(console.log(`🎯 ACTIONSDROPDOWN: Action ${e} für ${n} ${t}`),e){case"view":window.navigateTo(`/${n}/${t}`);break;case"edit":window.navigateTo(`/${n}/${t}/edit`);break;case"delete":this.confirmDelete(t,n);break;case"notiz":this.openNotizModal(t,n);break;case"rating":this.openRatingModal(t,n);break;case"marken":window.navigateTo(`/unternehmen/${t}/marken`);break;case"auftraege":window.navigateTo(`/unternehmen/${t}/auftraege`);break;case"kampagnen":window.navigateTo(`/auftrag/${t}/kampagnen`);break;case"quickview":this.openKooperationQuickView(t);break;case"assign-staff":if(window.currentUser?.rolle!=="admin"){alert("Nur Admins dürfen Mitarbeiter zuordnen.");break}this.openAssignStaffModal(t);break;case"assign_staff":if(n==="marke"){if(window.currentUser?.rolle!=="admin"){alert("Nur Admins dürfen Mitarbeiter zuordnen.");break}this.openAssignMarkeStaffModal(t)}else console.warn("assign_staff Action nur für Marken implementiert");break;case"rechnung":this.openRechnungModal(t,n);break;case"invoice-view":window.navigateTo(`/rechnung/${t}`);break;case"invoice-edit":window.navigateTo(`/rechnung/${t}/edit`);break;case"add_to_campaign":this.openAddToCampaignModal(t);break;case"favorite":{const r=document.querySelector("[data-kampagne-id]")?.dataset?.kampagneId;this.addToFavorites(t,r);break}case"add_to_list":{this.openAddToListModal(t);break}case"add_ansprechpartner":{this.openAddAnsprechpartnerModal(t);break}case"add_ansprechpartner_kampagne":{this.openAddAnsprechpartnerToKampagneModal(t);break}case"add_ansprechpartner_unternehmen":{this.openAddAnsprechpartnerToUnternehmenModal(t);break}case"remove_ansprechpartner_unternehmen":{this.openRemoveAnsprechpartnerFromUnternehmenModalNew(t);break}case"unassign-kampagne":{const r=a?.dataset?.mitarbeiterId||window.location.pathname.split("/").pop();if(!r){alert("Mitarbeiter-ID nicht gefunden");break}const i=t;if(!i||!confirm("Zuweisung dieser Kampagne vom Mitarbeiter entfernen?"))break;(async()=>{try{const{error:s}=await window.supabase.from("kampagne_mitarbeiter").delete().eq("mitarbeiter_id",r).eq("kampagne_id",i);if(s)throw s;const o=a.closest("tr");o&&o.remove();const l=document.querySelector('.tab-button[data-tab="kampagnen"] .tab-count');if(l){const c=parseInt(l.textContent||"1",10);l.textContent=String(Math.max(0,c-1))}alert("Zuweisung entfernt")}catch(s){console.error("❌ Zuweisung entfernen fehlgeschlagen",s),alert("Entfernen fehlgeschlagen")}})();break}case"video-view":window.navigateTo(`/video/${t}`);break;case"video-edit":window.navigateTo(`/video/${t}`);break;case"video-delete":this.confirmDelete(t,"kooperation_videos");break;default:console.warn(`⚠️ Unbekannte Action: ${e}`)}}async openKooperationQuickView(e){try{const t=document.createElement("div");t.className="drawer-overlay";const n=document.createElement("div");n.setAttribute("role","dialog"),n.className="drawer-panel";const a=document.createElement("div");a.className="drawer-header";const r=document.createElement("div"),i=document.createElement("h1");i.textContent="Kooperation · Schnellansicht";const s=document.createElement("p");s.style.margin="0",s.style.color="#6b7280",s.textContent="Videos & Kommentare",r.appendChild(i),r.appendChild(s);const o=document.createElement("div"),l=document.createElement("button");l.className="drawer-close",l.id="kvq-close",l.textContent="Schließen",o.appendChild(l),a.appendChild(r),a.appendChild(o);const c=document.createElement("div");c.className="drawer-body";const d=document.createElement("div");d.className="detail-section";const u=document.createElement("h2");u.textContent="Videos";const h=document.createElement("div");h.id="kvq-table",h.textContent="Lade...",d.appendChild(u),d.appendChild(h),c.replaceChildren(d),n.appendChild(a),n.appendChild(c),document.body.appendChild(t),document.body.appendChild(n);const m=()=>{try{t.remove(),n.remove()}catch{}};t.addEventListener("click",m),a.querySelector("#kvq-close")?.addEventListener("click",m),document.addEventListener("keydown",function E(D){D.key==="Escape"&&(m(),document.removeEventListener("keydown",E))}),requestAnimationFrame(()=>{n.classList.add("show")});const{data:p}=await window.supabase.from("kooperation_videos").select("id, position, content_art, titel, asset_url, status, created_at").eq("kooperation_id",e).order("position",{ascending:!0}),g=p||[];let f={};if(g.length){const E=g.map(F=>F.id),{data:D}=await window.supabase.from("kooperation_video_comment").select("id, video_id, runde, text, author_name, created_at").in("video_id",E).order("created_at",{ascending:!0});(D||[]).forEach(F=>{const z=F.video_id;f[z]||(f[z]={r1:[],r2:[]});const C=F.runde===2||F.runde==="2"?"r2":"r1";f[z][C].push(F)})}const w=E=>window.validatorSystem?.sanitizeHtml?.(E)??E,v=E=>E?new Date(E).toLocaleDateString("de-DE"):"-",k=E=>!E||!E.length?"-":E.map(D=>{const F=w(D.text||""),z=w(D.author_name||"-"),C=v(D.created_at);return`<div class="fb-line"><span class="fb-meta">${z} • ${C}</span><div class="fb-text">${F}</div></div>`}).join(""),y=g.map(E=>{const D=f[E.id]||{r1:[],r2:[]},F=E.asset_url?`<a class="kvq-link-btn" href="${E.asset_url}" target="_blank" rel="noopener">${this.getHeroIcon("view")}<span>Öffnen</span></a>`:"-";return`
          <tr>
            <td>${E.position||"-"}</td>
            <td>${w(E.content_art||"-")}</td>
            <td>
              <div class="kvq-cell">
                <span class="kvq-title-text">${w(E.titel||"-")}</span>
                ${F}
              </div>
            </td>
            <td class="feedback-cell">${k(D.r1)}</td>
            <td class="feedback-cell">${k(D.r2)}</td>
            <td><span class="status-badge status-${(E.status||"produktion").toLowerCase()}">${E.status==="abgeschlossen"?"Abgeschlossen":"Produktion"}</span></td>
          </tr>`}).join(""),S=g.length?`
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
            <tbody>${y}</tbody>
          </table>
        </div>`:'<p class="empty-state">Keine Videos vorhanden.</p>',A=c.querySelector("#kvq-table");if(A.innerHTML="",g.length){const E=document.createElement("div");E.className="data-table-container",E.innerHTML=S,A.appendChild(E)}else{const E=document.createElement("p");E.className="empty-state",E.textContent="Keine Videos vorhanden.",A.appendChild(E)}this.normalizeIcons(c)}catch(t){console.error("❌ Quickview öffnen fehlgeschlagen",t),alert("Schnellansicht konnte nicht geöffnet werden.")}}async openAssignStaffModal(e){const t=document.createElement("div");t.className="modal overlay-modal",t.innerHTML=`
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
      </div>`,document.body.appendChild(t);const n=t.querySelector("#staff-search"),a=t.querySelector("#staff-dropdown");let r=null;const i=async d=>{try{let u=[];try{const{data:p}=await window.supabase.from("kampagne_mitarbeiter").select("mitarbeiter_id").eq("kampagne_id",e);u=(p||[]).map(g=>g.mitarbeiter_id)}catch{}let h=window.supabase.from("benutzer").select("id, name, rolle, mitarbeiter_klasse:mitarbeiter_klasse_id(name)").in("rolle",["mitarbeiter","Mitarbeiter","admin"]).order("name");d&&(h=h.ilike("name",`%${d}%`)),u.length>0&&(h=h.not("id","in",`(${u.join(",")})`));const{data:m}=await h;return m||[]}catch(u){return console.warn("⚠️ Mitarbeiter-Suche fehlgeschlagen",u),[]}},s=d=>{a.innerHTML=d.length?d.map(u=>`<div class="dropdown-item" data-id="${u.id}">${u.name}${u.mitarbeiter_klasse?.name?` <span class="muted">(${u.mitarbeiter_klasse.name})</span>`:""}${u.rolle?` <span class="muted">[${u.rolle}]</span>`:""}</div>`).join(""):'<div class="dropdown-item no-results">Keine Mitarbeiter gefunden</div>'};s(await i("")),a.classList.add("show"),n.focus(),(()=>{(!a.style.position||a.style.position==="absolute")&&(a.style.position="relative"),a.style.display="block"})(),n.addEventListener("focus",()=>a.classList.add("show")),n.addEventListener("blur",()=>setTimeout(()=>a.classList.remove("show"),150));let l;n.addEventListener("input",()=>{clearTimeout(l),l=setTimeout(async()=>s(await i(n.value.trim())),200)}),a.addEventListener("click",d=>{const u=d.target.closest(".dropdown-item");!u||u.classList.contains("no-results")||(r=u.dataset.id,n.value=u.textContent.trim(),t.querySelector("#assign-staff-confirm").disabled=!1,a.classList.remove("show"))});const c=()=>t.remove();t.querySelector("#assign-staff-close").onclick=c,t.querySelector("#assign-staff-cancel").onclick=c,t.querySelector("#assign-staff-confirm").onclick=async()=>{if(r)try{const{error:d}=await window.supabase.from("kampagne_mitarbeiter").insert({kampagne_id:e,mitarbeiter_id:r,role:"projektmanager"});if(d)throw console.error("❌ Insert-Fehler:",d),d;try{const{data:u}=await window.supabase.from("kampagne").select("id, kampagnenname").eq("id",e).single(),h=u?.kampagnenname||e;await window.notificationSystem?.pushNotification(r,{type:"assign",entity:"kampagne",entityId:e,title:"Neue Kampagnen-Zuweisung",message:`Du wurdest der Kampagne "${h}" zugeordnet.`}),window.dispatchEvent(new Event("notificationsRefresh"))}catch{}console.log("✅ Mitarbeiter erfolgreich zugeordnet"),c(),window.dispatchEvent(new CustomEvent("entityUpdated",{detail:{entity:"kampagne",action:"staff-assigned",id:e}})),alert("Mitarbeiter zugeordnet.")}catch(d){console.error("❌ Fehler beim Zuordnen",d),alert("Zuordnung fehlgeschlagen.")}}}async openAssignMarkeStaffModal(e){console.log("🎯 ACTIONSDROPDOWN: Öffne Mitarbeiter-Auswahl-Modal für Marke:",e);let t=[],n=[];try{const{data:u}=await window.supabase.from("marke_mitarbeiter").select("mitarbeiter_id").eq("marke_id",e);n=(u||[]).map(p=>p.mitarbeiter_id).filter(Boolean);let h=window.supabase.from("benutzer").select(`
          id, 
          name, 
          rolle,
          mitarbeiter_klasse:mitarbeiter_klasse_id(name)
        `).order("name");n.length>0&&(h=h.not("id","in",`(${n.join(",")})`));const{data:m}=await h;t=m||[]}catch(u){console.warn("⚠️ Fehler beim Laden der Mitarbeiter:",u)}const a=document.createElement("div");a.className="modal overlay-modal",a.innerHTML=`
      <div class="modal-dialog">
        <div class="modal-header">
          <h3>Mitarbeiter zur Marke hinzufügen</h3>
          <button class="modal-close" id="add-mitarbeiter-close">×</button>
        </div>
        <div class="modal-body">
          <label class="form-label">Mitarbeiter wählen</label>
          <input type="text" id="mitarbeiter-search" class="form-input auto-suggest-input" placeholder="Mitarbeiter suchen..." />
          <div id="mitarbeiter-dropdown" class="auto-suggest-dropdown"></div>
        </div>
        <div class="modal-footer">
          <button class="secondary-btn" id="add-mitarbeiter-cancel">Abbrechen</button>
          <button class="primary-btn" id="add-mitarbeiter-confirm" disabled>Hinzufügen</button>
        </div>
      </div>`,document.body.appendChild(a);const r=a.querySelector("#mitarbeiter-search"),i=a.querySelector("#mitarbeiter-dropdown");let s=null;const o=(u="")=>{if(!u||u.trim().length===0){i.innerHTML='<div class="dropdown-item no-results">Beginnen Sie zu tippen, um Mitarbeiter zu suchen...</div>';return}const h=u.toLowerCase(),m=t.filter(p=>{const g=(p.name||"").toLowerCase(),f=(p.rolle||"").toLowerCase(),w=(p.mitarbeiter_klasse?.name||"").toLowerCase();return g.includes(h)||f.includes(h)||w.includes(h)});i.innerHTML=m.length?m.map(p=>{const g=p.name,f=[p.rolle,p.mitarbeiter_klasse?.name].filter(Boolean).join(" • ");return`<div class="dropdown-item" data-id="${p.id}">
              <div class="dropdown-item-main">${g}</div>
              ${f?`<div class="dropdown-item-details">${f}</div>`:""}
            </div>`}).join(""):'<div class="dropdown-item no-results">Keine verfügbaren Mitarbeiter gefunden</div>'};i.innerHTML='<div class="dropdown-item no-results">Beginnen Sie zu tippen, um Mitarbeiter zu suchen...</div>',r.addEventListener("focus",()=>{r.value.trim().length>0&&i.classList.add("show")}),r.addEventListener("blur",()=>{setTimeout(()=>i.classList.remove("show"),150)});let l;r.addEventListener("input",u=>{clearTimeout(l),l=setTimeout(async()=>{const h=u.target.value.trim();if(h.length<1){i.classList.remove("show");return}try{let m=window.supabase.from("benutzer").select(`
              id, 
              name, 
              rolle,
              mitarbeiter_klasse:mitarbeiter_klasse_id(name)
            `).or(`name.ilike.%${h}%,rolle.ilike.%${h}%`).order("name");n.length>0&&(m=m.not("id","in",`(${n.join(",")})`));const{data:p}=await m;t=p||[],o(h),i.classList.add("show")}catch(m){console.warn("⚠️ Mitarbeiter-Suche fehlgeschlagen",m)}},200)}),i.addEventListener("click",u=>{const h=u.target.closest(".dropdown-item");if(!h||h.classList.contains("no-results"))return;s=h.dataset.id;const m=h.querySelector(".dropdown-item-main")?.textContent||h.textContent;r.value=m,a.querySelector("#add-mitarbeiter-confirm").disabled=!1,i.classList.remove("show")});const c=()=>a.remove();a.querySelector("#add-mitarbeiter-close").onclick=c,a.querySelector("#add-mitarbeiter-cancel").onclick=c;const d=u=>{u.key==="Escape"&&(c(),document.removeEventListener("keydown",d))};document.addEventListener("keydown",d),a.querySelector("#add-mitarbeiter-confirm").onclick=async()=>{if(s)try{const{error:u}=await window.supabase.from("marke_mitarbeiter").insert({marke_id:e,mitarbeiter_id:s,assigned_by:window.currentUser?.id||null});if(u)throw u;try{const{data:h}=await window.supabase.from("marke").select("id, markenname").eq("id",e).single(),m=h?.markenname||e;await window.notificationSystem?.pushNotification(s,{type:"assignment",entity:"marke",entityId:e,title:"Neue Marken-Zuordnung",message:`Sie wurden der Marke "${m}" zugeordnet und können nun alle zugehörigen Kampagnen und Kooperationen einsehen.`}),window.dispatchEvent(new Event("notificationsRefresh"))}catch(h){console.warn("⚠️ Benachrichtigung fehlgeschlagen:",h)}c(),document.removeEventListener("keydown",d),window.dispatchEvent(new CustomEvent("entityUpdated",{detail:{entity:"mitarbeiter",action:"added",markeId:e}})),window.dispatchEvent(new CustomEvent("entityUpdated",{detail:{entity:"marke",action:"mitarbeiter-added",id:e}})),alert("✅ Mitarbeiter wurde erfolgreich zur Marke hinzugefügt und wird automatisch angezeigt!"),console.log("✅ ACTIONSDROPDOWN: Mitarbeiter erfolgreich hinzugefügt")}catch(u){console.error("❌ Fehler beim Hinzufügen des Mitarbeiters:",u),alert("Fehler beim Hinzufügen: "+(u.message||"Unbekannter Fehler"))}}}async addToFavorites(e,t){try{if(!t){const n=window.location.pathname.match(/\/kampagne\/([0-9a-fA-F-]{36})/);t=n?n[1]:null}if(!t){alert("Kampagne konnte nicht ermittelt werden.");return}await window.supabase.from("kampagne_creator_favoriten").insert({kampagne_id:t,creator_id:e}),window.dispatchEvent(new CustomEvent("entityUpdated",{detail:{entity:"kampagne",action:"favorite-added",id:t}})),alert("Zu Favoriten hinzugefügt.")}catch(n){console.error("❌ Fehler beim Hinzufügen zu Favoriten",n),alert("Hinzufügen zu Favoriten fehlgeschlagen.")}}async openAddToCampaignModal(e){let t=[],n=[],a=null;try{const[u,h]=await Promise.all([window.supabase.from("kampagne_creator").select("kampagne_id").eq("creator_id",e),window.supabase.from("kampagne_creator_sourcing").select("kampagne_id").eq("creator_id",e)]),m=(u?.data||[]).map(w=>w.kampagne_id).filter(Boolean),p=(h?.data||[]).map(w=>w.kampagne_id).filter(Boolean);if(n=Array.from(new Set([...m,...p])),window.currentUser?.rolle!=="admin"){const{data:w}=await window.supabase.from("kampagne_mitarbeiter").select("kampagne_id").eq("mitarbeiter_id",window.currentUser?.id);a=(w||[]).map(v=>v.kampagne_id).filter(Boolean)}let g=!0,f=window.supabase.from("kampagne").select("id, kampagnenname, status").order("created_at",{ascending:!1});if(Array.isArray(a)&&(a.length===0?(g=!1,t=[]):f=f.in("id",a)),n.length>0&&(f=f.not("id","in",`(${n.join(",")})`)),g){const{data:w}=await f;t=w||[]}}catch{}const r=document.createElement("div");r.className="modal overlay-modal",r.innerHTML=`
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
      </div>`,document.body.appendChild(r);const i=r.querySelector("#campaign-search"),s=r.querySelector("#campaign-dropdown");let o=null;const l=(u="")=>{const h=u.toLowerCase(),m=t.filter(p=>(p.kampagnenname||"").toLowerCase().includes(h));s.innerHTML=m.length?m.map(p=>`<div class="dropdown-item" data-id="${p.id}">${p.kampagnenname}</div>`).join(""):'<div class="dropdown-item no-results">Keine Kampagne gefunden</div>'};l(""),i.addEventListener("focus",()=>{s.classList.add("show")}),i.addEventListener("blur",()=>{setTimeout(()=>s.classList.remove("show"),150)});let c;i.addEventListener("input",()=>{const u=i.value.trim();clearTimeout(c),c=setTimeout(async()=>{try{let h=window.supabase.from("kampagne").select("id, kampagnenname, status").order("created_at",{ascending:!1});if(u.length>0&&(h=h.ilike("kampagnenname",`%${u}%`)),Array.isArray(a)){if(a.length===0){t=[],l(u);return}h=h.in("id",a)}n.length>0&&(h=h.not("id","in",`(${n.join(",")})`));const{data:m}=await h;t=m||[],l(u)}catch(h){console.warn("⚠️ Kampagnen-Suche fehlgeschlagen",h)}},200)}),s.addEventListener("click",u=>{const h=u.target.closest(".dropdown-item");!h||h.classList.contains("no-results")||(o=h.dataset.id,i.value=h.textContent,r.querySelector("#add-to-campaign-confirm").disabled=!1,s.classList.remove("show"))});const d=()=>r.remove();r.querySelector("#add-to-campaign-close").onclick=d,r.querySelector("#add-to-campaign-cancel").onclick=d,r.querySelector("#add-to-campaign-confirm").onclick=async()=>{if(o)try{await window.supabase.from("kampagne_creator_sourcing").insert({kampagne_id:o,creator_id:e});try{const[{data:u},{data:h}]=await Promise.all([window.supabase.from("kampagne_mitarbeiter").select("mitarbeiter_id").eq("kampagne_id",o),window.supabase.from("kampagne").select("kampagnenname").eq("id",o).single()]),m=h?.kampagnenname||o,p=(u||[]).map(g=>g.mitarbeiter_id).filter(Boolean);for(const g of p)await window.notificationSystem?.pushNotification(g,{type:"update",entity:"kampagne",entityId:o,title:"Sourcing-Update",message:`Neuer Creator wurde dem Sourcing von "${m}" hinzugefügt.`});p.length&&window.dispatchEvent(new Event("notificationsRefresh"))}catch{}d(),window.dispatchEvent(new CustomEvent("entityUpdated",{detail:{entity:"kampagne",action:"sourcing-added",id:o}})),alert("Creator wurde zum Sourcing der Kampagne hinzugefügt.")}catch(u){console.error("❌ Fehler beim Hinzufügen zur Kampagne",u),alert("Hinzufügen fehlgeschlagen.")}}}async openAddAnsprechpartnerModal(e){console.log("🎯 ACTIONSDROPDOWN: Öffne Ansprechpartner-Auswahl-Modal für Marke:",e);let t=[],n=[];try{const{data:u}=await window.supabase.from("ansprechpartner_marke").select("ansprechpartner_id").eq("marke_id",e);n=(u||[]).map(p=>p.ansprechpartner_id).filter(Boolean);let h=window.supabase.from("ansprechpartner").select(`
          id, 
          vorname, 
          nachname, 
          email,
          unternehmen:unternehmen_id(firmenname),
          position:position_id(name)
        `).order("nachname");n.length>0&&(h=h.not("id","in",`(${n.join(",")})`));const{data:m}=await h;t=m||[]}catch(u){console.warn("⚠️ Fehler beim Laden der Ansprechpartner:",u)}const a=document.createElement("div");a.className="modal overlay-modal",a.innerHTML=`
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
      </div>`,document.body.appendChild(a);const r=a.querySelector("#ansprechpartner-search"),i=a.querySelector("#ansprechpartner-dropdown");let s=null;const o=(u="")=>{if(!u||u.trim().length===0){i.innerHTML='<div class="dropdown-item no-results">Beginnen Sie zu tippen, um Ansprechpartner zu suchen...</div>';return}const h=u.toLowerCase(),m=t.filter(p=>{const g=`${p.vorname} ${p.nachname}`.toLowerCase(),f=(p.email||"").toLowerCase(),w=(p.unternehmen?.firmenname||"").toLowerCase();return g.includes(h)||f.includes(h)||w.includes(h)});i.innerHTML=m.length?m.map(p=>{const g=`${p.vorname} ${p.nachname}`,f=[p.email,p.unternehmen?.firmenname,p.position?.name].filter(Boolean).join(" • ");return`<div class="dropdown-item" data-id="${p.id}">
              <div class="dropdown-item-main">${g}</div>
              ${f?`<div class="dropdown-item-details">${f}</div>`:""}
            </div>`}).join(""):'<div class="dropdown-item no-results">Keine verfügbaren Ansprechpartner gefunden</div>'};i.innerHTML='<div class="dropdown-item no-results">Beginnen Sie zu tippen, um Ansprechpartner zu suchen...</div>',r.addEventListener("focus",()=>{r.value.trim().length>0&&i.classList.add("show")}),r.addEventListener("blur",()=>{setTimeout(()=>i.classList.remove("show"),150)});let l;r.addEventListener("input",u=>{clearTimeout(l),l=setTimeout(async()=>{const h=u.target.value.trim();if(h.length<1){i.classList.remove("show");return}try{let m=window.supabase.from("ansprechpartner").select(`
              id, 
              vorname, 
              nachname, 
              email,
              unternehmen:unternehmen_id(firmenname),
              position:position_id(name)
            `).or(`vorname.ilike.%${h}%,nachname.ilike.%${h}%,email.ilike.%${h}%`).order("nachname");n.length>0&&(m=m.not("id","in",`(${n.join(",")})`));const{data:p}=await m;t=p||[],o(h),i.classList.add("show")}catch(m){console.warn("⚠️ Ansprechpartner-Suche fehlgeschlagen",m)}},200)}),i.addEventListener("click",u=>{const h=u.target.closest(".dropdown-item");if(!h||h.classList.contains("no-results"))return;s=h.dataset.id;const m=h.querySelector(".dropdown-item-main")?.textContent||h.textContent;r.value=m,a.querySelector("#add-ansprechpartner-confirm").disabled=!1,i.classList.remove("show")});const c=()=>a.remove();a.querySelector("#add-ansprechpartner-close").onclick=c,a.querySelector("#add-ansprechpartner-cancel").onclick=c;const d=u=>{u.key==="Escape"&&(c(),document.removeEventListener("keydown",d))};document.addEventListener("keydown",d),a.querySelector("#add-ansprechpartner-confirm").onclick=async()=>{if(s)try{const{error:u}=await window.supabase.from("ansprechpartner_marke").insert({marke_id:e,ansprechpartner_id:s});if(u)throw u;c(),document.removeEventListener("keydown",d),window.dispatchEvent(new CustomEvent("entityUpdated",{detail:{entity:"ansprechpartner",action:"added",markeId:e}})),window.dispatchEvent(new CustomEvent("entityUpdated",{detail:{entity:"marke",action:"ansprechpartner-added",id:e}})),alert("✅ Ansprechpartner wurde erfolgreich zur Marke hinzugefügt und wird automatisch angezeigt!"),console.log("✅ ACTIONSDROPDOWN: Ansprechpartner erfolgreich hinzugefügt")}catch(u){console.error("❌ Fehler beim Hinzufügen des Ansprechpartners:",u),alert("Fehler beim Hinzufügen: "+(u.message||"Unbekannter Fehler"))}}}async openAddAnsprechpartnerToUnternehmenModal(e){console.log("🎯 ACTIONSDROPDOWN: Öffne Ansprechpartner-Auswahl-Modal für Unternehmen:",e);let t=[],n=[];try{const{data:u}=await window.supabase.from("ansprechpartner_unternehmen").select("ansprechpartner_id").eq("unternehmen_id",e);n=(u||[]).map(p=>p.ansprechpartner_id).filter(Boolean);let h=window.supabase.from("ansprechpartner").select(`
          id, 
          vorname, 
          nachname, 
          email,
          unternehmen:unternehmen_id(firmenname),
          position:position_id(name)
        `).order("nachname");n.length>0&&(h=h.not("id","in",`(${n.join(",")})`));const{data:m}=await h;t=m||[]}catch(u){console.warn("⚠️ Fehler beim Laden der Ansprechpartner:",u)}const a=document.createElement("div");a.className="modal overlay-modal",a.innerHTML=`
      <div class="modal-dialog">
        <div class="modal-header">
          <h3>Ansprechpartner zum Unternehmen hinzufügen</h3>
          <button class="modal-close" id="add-ansprechpartner-unternehmen-close">×</button>
        </div>
        <div class="modal-body">
          <label class="form-label">Ansprechpartner wählen</label>
          <input type="text" id="ansprechpartner-unternehmen-search" class="form-input auto-suggest-input" placeholder="Ansprechpartner suchen..." />
          <div id="ansprechpartner-unternehmen-dropdown" class="auto-suggest-dropdown"></div>
        </div>
        <div class="modal-footer">
          <button class="secondary-btn" id="add-ansprechpartner-unternehmen-cancel">Abbrechen</button>
          <button class="primary-btn" id="add-ansprechpartner-unternehmen-confirm" disabled>Hinzufügen</button>
        </div>
      </div>`,document.body.appendChild(a);const r=a.querySelector("#ansprechpartner-unternehmen-search"),i=a.querySelector("#ansprechpartner-unternehmen-dropdown");let s=null;const o=(u="")=>{if(!u||u.trim().length===0){i.innerHTML='<div class="dropdown-item no-results">Beginnen Sie zu tippen, um Ansprechpartner zu suchen...</div>';return}const h=u.toLowerCase(),m=t.filter(p=>{const g=`${p.vorname} ${p.nachname}`.toLowerCase(),f=(p.email||"").toLowerCase(),w=(p.unternehmen?.firmenname||"").toLowerCase();return g.includes(h)||f.includes(h)||w.includes(h)});i.innerHTML=m.length?m.map(p=>{const g=`${p.vorname} ${p.nachname}`,f=[p.email,p.unternehmen?.firmenname,p.position?.name].filter(Boolean).join(" • ");return`<div class="dropdown-item" data-id="${p.id}">
              <div class="dropdown-item-main">${g}</div>
              ${f?`<div class="dropdown-item-details">${f}</div>`:""}
            </div>`}).join(""):'<div class="dropdown-item no-results">Keine verfügbaren Ansprechpartner gefunden</div>'};i.innerHTML='<div class="dropdown-item no-results">Beginnen Sie zu tippen, um Ansprechpartner zu suchen...</div>',r.addEventListener("focus",()=>{r.value.trim().length>0&&i.classList.add("show")}),r.addEventListener("blur",()=>{setTimeout(()=>i.classList.remove("show"),150)});let l;r.addEventListener("input",u=>{clearTimeout(l),l=setTimeout(async()=>{const h=u.target.value.trim();if(h.length<1){i.classList.remove("show");return}try{let m=window.supabase.from("ansprechpartner").select(`
              id, 
              vorname, 
              nachname, 
              email,
              unternehmen:unternehmen_id(firmenname),
              position:position_id(name)
            `).or(`vorname.ilike.%${h}%,nachname.ilike.%${h}%,email.ilike.%${h}%`).order("nachname");n.length>0&&(m=m.not("id","in",`(${n.join(",")})`));const{data:p}=await m;t=p||[],o(h),i.classList.add("show")}catch(m){console.warn("⚠️ Ansprechpartner-Suche fehlgeschlagen",m)}},200)}),i.addEventListener("click",u=>{const h=u.target.closest(".dropdown-item");if(!h||h.classList.contains("no-results"))return;s=h.dataset.id;const m=h.querySelector(".dropdown-item-main")?.textContent||h.textContent;r.value=m,a.querySelector("#add-ansprechpartner-unternehmen-confirm").disabled=!1,i.classList.remove("show")});const c=()=>{document.body.removeChild(a)},d=u=>{u.key==="Escape"&&(c(),document.removeEventListener("keydown",d))};document.addEventListener("keydown",d),a.querySelector("#add-ansprechpartner-unternehmen-close").onclick=()=>{c(),document.removeEventListener("keydown",d)},a.querySelector("#add-ansprechpartner-unternehmen-cancel").onclick=()=>{c(),document.removeEventListener("keydown",d)},a.querySelector("#add-ansprechpartner-unternehmen-confirm").onclick=async()=>{if(s)try{const{error:u}=await window.supabase.from("ansprechpartner_unternehmen").insert([{ansprechpartner_id:s,unternehmen_id:e}]);if(u)throw u;c(),document.removeEventListener("keydown",d),window.dispatchEvent(new CustomEvent("entityUpdated",{detail:{entity:"ansprechpartner",action:"added",unternehmenId:e}})),window.dispatchEvent(new CustomEvent("entityUpdated",{detail:{entity:"unternehmen",action:"ansprechpartner-added",id:e}})),alert("✅ Ansprechpartner wurde erfolgreich zum Unternehmen hinzugefügt und wird automatisch angezeigt!"),console.log("✅ ACTIONSDROPDOWN: Ansprechpartner erfolgreich zu Unternehmen hinzugefügt")}catch(u){console.error("❌ Fehler beim Hinzufügen des Ansprechpartners:",u),alert("Fehler beim Hinzufügen: "+(u.message||"Unbekannter Fehler"))}}}async openRemoveAnsprechpartnerFromUnternehmenModal(e){console.log("🎯 ACTIONSDROPDOWN: Öffne Ansprechpartner-Entfernen-Modal für Unternehmen:",e);let t=[];try{const{data:d}=await window.supabase.from("ansprechpartner_unternehmen").select(`
          ansprechpartner_id,
          ansprechpartner:ansprechpartner_id (
            id,
            vorname,
            nachname,
            email,
            position:position_id(name)
          )
        `).eq("unternehmen_id",e);t=(d||[]).filter(u=>u.ansprechpartner).map(u=>u.ansprechpartner)}catch(d){console.warn("⚠️ Fehler beim Laden der Ansprechpartner:",d)}if(t.length===0){alert("Diesem Unternehmen sind noch keine Ansprechpartner zugeordnet.");return}const n=document.createElement("div");n.className="modal overlay-modal",n.innerHTML=`
      <div class="modal-dialog">
        <div class="modal-header">
          <h3>Ansprechpartner vom Unternehmen entfernen</h3>
          <button class="modal-close" id="remove-ansprechpartner-unternehmen-close">×</button>
        </div>
        <div class="modal-body">
          <label class="form-label">Ansprechpartner wählen</label>
          <input type="text" id="ansprechpartner-unternehmen-remove-search" class="form-input auto-suggest-input" placeholder="Ansprechpartner suchen..." />
          <div id="ansprechpartner-unternehmen-remove-dropdown" class="auto-suggest-dropdown"></div>
        </div>
        <div class="modal-footer">
          <button class="secondary-btn" id="remove-ansprechpartner-unternehmen-cancel">Abbrechen</button>
          <button class="danger-btn" id="remove-ansprechpartner-unternehmen-confirm" disabled>Entfernen</button>
        </div>
      </div>`,document.body.appendChild(n);const a=n.querySelector("#ansprechpartner-unternehmen-remove-search"),r=n.querySelector("#ansprechpartner-unternehmen-remove-dropdown");let i=null;const s=(d="")=>{if(!d||d.trim().length===0){r.innerHTML='<div class="dropdown-item no-results">Beginnen Sie zu tippen, um Ansprechpartner zu suchen...</div>';return}const u=d.toLowerCase(),h=t.filter(m=>{const p=`${m.vorname} ${m.nachname}`.toLowerCase(),g=(m.email||"").toLowerCase();return p.includes(u)||g.includes(u)});r.innerHTML=h.length?h.map(m=>{const p=`${m.vorname} ${m.nachname}`,g=[m.email,m.position?.name].filter(Boolean).join(" • ");return`<div class="dropdown-item" data-id="${m.id}">
              <div class="dropdown-item-main">${p}</div>
              ${g?`<div class="dropdown-item-details">${g}</div>`:""}
            </div>`}).join(""):'<div class="dropdown-item no-results">Keine Ansprechpartner gefunden</div>'};r.innerHTML='<div class="dropdown-item no-results">Beginnen Sie zu tippen, um Ansprechpartner zu suchen...</div>',a.addEventListener("focus",()=>{a.value.trim().length>0&&r.classList.add("show")}),a.addEventListener("blur",()=>{setTimeout(()=>r.classList.remove("show"),150)});let o;a.addEventListener("input",d=>{clearTimeout(o),o=setTimeout(()=>{const u=d.target.value.trim();if(u.length<1){r.classList.remove("show");return}s(u),r.classList.add("show")},200)}),r.addEventListener("click",d=>{const u=d.target.closest(".dropdown-item");if(!u||u.classList.contains("no-results"))return;i=u.dataset.id;const h=u.querySelector(".dropdown-item-main")?.textContent||u.textContent;a.value=h,n.querySelector("#remove-ansprechpartner-unternehmen-confirm").disabled=!1,r.classList.remove("show")});const l=()=>{document.body.removeChild(n)},c=d=>{d.key==="Escape"&&(l(),document.removeEventListener("keydown",c))};document.addEventListener("keydown",c),n.querySelector("#remove-ansprechpartner-unternehmen-close").onclick=()=>{l(),document.removeEventListener("keydown",c)},n.querySelector("#remove-ansprechpartner-unternehmen-cancel").onclick=()=>{l(),document.removeEventListener("keydown",c)},n.querySelector("#remove-ansprechpartner-unternehmen-confirm").onclick=async()=>{if(i)try{const{error:d}=await window.supabase.from("ansprechpartner_unternehmen").delete().eq("ansprechpartner_id",i).eq("unternehmen_id",e);if(d)throw d;l(),document.removeEventListener("keydown",c),window.dispatchEvent(new CustomEvent("entityUpdated",{detail:{entity:"ansprechpartner",action:"removed",unternehmenId:e}})),window.dispatchEvent(new CustomEvent("entityUpdated",{detail:{entity:"unternehmen",action:"ansprechpartner-removed",id:e}})),alert("✅ Ansprechpartner wurde erfolgreich vom Unternehmen entfernt!"),console.log("✅ ACTIONSDROPDOWN: Ansprechpartner erfolgreich von Unternehmen entfernt")}catch(d){console.error("❌ Fehler beim Entfernen des Ansprechpartners:",d),alert("Fehler beim Entfernen: "+(d.message||"Unbekannter Fehler"))}}}async openRemoveAnsprechpartnerFromUnternehmenModalNew(e){console.log("🎯 ACTIONSDROPDOWN: Öffne Ansprechpartner-Entfernen-Modal für Unternehmen (Tabelle):",e);let t=[];try{const{data:m}=await window.supabase.from("ansprechpartner_unternehmen").select(`
          ansprechpartner_id,
          ansprechpartner:ansprechpartner_id (
            id,
            vorname,
            nachname,
            email,
            telefonnummer,
            position:position_id(name),
            unternehmen:unternehmen_id(firmenname)
          )
        `).eq("unternehmen_id",e);t=(m||[]).filter(p=>p.ansprechpartner).map(p=>p.ansprechpartner)}catch(m){console.warn("⚠️ Fehler beim Laden der Ansprechpartner:",m)}if(t.length===0){alert("Diesem Unternehmen sind noch keine Ansprechpartner zugeordnet.");return}const n=t.map(m=>`
      <tr>
        <td>
          <input type="checkbox" class="ansprechpartner-remove-check" data-id="${m.id}" />
        </td>
        <td>
          <a href="#" onclick="event.preventDefault(); window.navigateTo('/ansprechpartner/${m.id}')" class="table-link">
            ${m.vorname} ${m.nachname}
          </a>
        </td>
        <td>${m.email||"-"}</td>
        <td>${m.telefonnummer||"-"}</td>
        <td>${m.position?.name||"-"}</td>
        <td>
          <button class="btn-remove-single danger-btn" data-id="${m.id}" title="Einzeln entfernen">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="w-4 h-4">
              <path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </td>
      </tr>
    `).join(""),a=document.createElement("div");a.className="modal overlay-modal modal-large",a.innerHTML=`
      <div class="modal-dialog">
        <div class="modal-header">
          <h3>Ansprechpartner vom Unternehmen entfernen</h3>
          <button class="modal-close" id="remove-ansprechpartner-unternehmen-close">×</button>
        </div>
        <div class="modal-body">
          <p class="modal-description">Wählen Sie die Ansprechpartner aus, die Sie vom Unternehmen entfernen möchten:</p>
          
          <!-- Bulk Actions -->
          <div class="bulk-actions">
            <button id="select-all-ansprechpartner" class="secondary-btn">Alle auswählen</button>
            <button id="deselect-all-ansprechpartner" class="secondary-btn">Auswahl aufheben</button>
            <span class="selected-count">0 ausgewählt</span>
          </div>
          
          <!-- Ansprechpartner Tabelle -->
          <div class="data-table-container">
            <table class="data-table">
              <thead>
                <tr>
                  <th width="40">
                    <input type="checkbox" id="select-all-header" />
                  </th>
                  <th>Name</th>
                  <th>E-Mail</th>
                  <th>Telefon</th>
                  <th>Position</th>
                  <th width="80">Aktion</th>
                </tr>
              </thead>
              <tbody>
                ${n}
              </tbody>
            </table>
          </div>
        </div>
        <div class="modal-footer">
          <button class="secondary-btn" id="remove-ansprechpartner-unternehmen-cancel">Abbrechen</button>
          <button class="danger-btn" id="remove-selected-ansprechpartner" disabled>Ausgewählte entfernen</button>
        </div>
      </div>`,document.body.appendChild(a);const r=a.querySelectorAll(".ansprechpartner-remove-check"),i=a.querySelector("#select-all-header"),s=a.querySelector("#select-all-ansprechpartner"),o=a.querySelector("#deselect-all-ansprechpartner"),l=a.querySelector(".selected-count"),c=a.querySelector("#remove-selected-ansprechpartner"),d=()=>{const p=a.querySelectorAll(".ansprechpartner-remove-check:checked").length;l.textContent=`${p} ausgewählt`,c.disabled=p===0,p===0?(i.checked=!1,i.indeterminate=!1):p===r.length?(i.checked=!0,i.indeterminate=!1):(i.checked=!1,i.indeterminate=!0)};r.forEach(m=>{m.addEventListener("change",d)}),i.addEventListener("change",()=>{const m=i.checked;r.forEach(p=>{p.checked=m}),d()}),s.addEventListener("click",()=>{r.forEach(m=>{m.checked=!0}),d()}),o.addEventListener("click",()=>{r.forEach(m=>{m.checked=!1}),d()}),a.querySelectorAll(".btn-remove-single").forEach(m=>{m.addEventListener("click",async p=>{const g=p.target.closest(".btn-remove-single").dataset.id,f=t.find(v=>v.id===g),w=f?`${f.vorname} ${f.nachname}`:"Ansprechpartner";confirm(`Möchten Sie ${w} wirklich vom Unternehmen entfernen?`)&&(await this.removeAnsprechpartnerFromUnternehmen(g,e),p.target.closest("tr").remove(),d(),a.querySelectorAll("tbody tr").length===0&&u())})}),c.addEventListener("click",async()=>{const m=a.querySelectorAll(".ansprechpartner-remove-check:checked"),p=Array.from(m).map(f=>f.dataset.id);if(p.length===0)return;const g=p.length;if(confirm(`Möchten Sie wirklich ${g} Ansprechpartner vom Unternehmen entfernen?`)){let f=0,w=0;for(const k of p)try{await this.removeAnsprechpartnerFromUnternehmen(k,e),f++;const y=a.querySelector(`[data-id="${k}"]`);y&&y.closest("tr").remove()}catch(y){w++,console.error("❌ Fehler beim Entfernen:",y)}let v="";f>0&&(v+=`✅ ${f} Ansprechpartner erfolgreich entfernt.`),w>0&&(v+=`
❌ ${w} Ansprechpartner konnten nicht entfernt werden.`),alert(v),d(),a.querySelectorAll("tbody tr").length===0&&u()}});const u=()=>{document.body.removeChild(a)},h=m=>{m.key==="Escape"&&(u(),document.removeEventListener("keydown",h))};document.addEventListener("keydown",h),a.querySelector("#remove-ansprechpartner-unternehmen-close").onclick=()=>{u(),document.removeEventListener("keydown",h)},a.querySelector("#remove-ansprechpartner-unternehmen-cancel").onclick=()=>{u(),document.removeEventListener("keydown",h)},d()}async removeAnsprechpartnerFromUnternehmen(e,t){try{const{error:n}=await window.supabase.from("ansprechpartner_unternehmen").delete().eq("ansprechpartner_id",e).eq("unternehmen_id",t);if(n)throw n;return window.dispatchEvent(new CustomEvent("entityUpdated",{detail:{entity:"ansprechpartner",action:"removed",unternehmenId:t}})),console.log("✅ ACTIONSDROPDOWN: Ansprechpartner erfolgreich von Unternehmen entfernt"),!0}catch(n){throw console.error("❌ Fehler beim Entfernen des Ansprechpartners:",n),n}}async openAddToListModal(e){let t=[],n=[];try{const{data:d}=await window.supabase.from("creator_list_member").select("list_id").eq("creator_id",e);n=(d||[]).map(h=>h.list_id).filter(Boolean);const{data:u}=await window.supabase.from("creator_list").select("id, name, created_at").order("created_at",{ascending:!1});t=(u||[]).filter(h=>!n.includes(h.id))}catch{}const a=document.createElement("div");a.className="modal overlay-modal",a.innerHTML=`
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
      </div>`,document.body.appendChild(a);const r=a.querySelector("#list-search"),i=a.querySelector("#list-dropdown");let s=null;const o=(d="")=>{const u=d.toLowerCase(),h=t.filter(m=>(m.name||"").toLowerCase().includes(u));i.innerHTML=h.length?h.map(m=>`<div class="dropdown-item" data-id="${m.id}">${m.name}</div>`).join(""):'<div class="dropdown-item no-results">Keine Liste gefunden</div>',i.classList.add("show")};o(""),r.addEventListener("focus",()=>i.classList.add("show")),r.addEventListener("blur",()=>setTimeout(()=>i.classList.remove("show"),150));let l;r.addEventListener("input",()=>{clearTimeout(l),l=setTimeout(()=>o(r.value.trim()),150)}),i.addEventListener("click",d=>{const u=d.target.closest(".dropdown-item");!u||u.classList.contains("no-results")||(s=u.dataset.id,r.value=u.textContent.trim(),a.querySelector("#add-to-list-confirm").disabled=!1,i.classList.remove("show"))});const c=()=>a.remove();a.querySelector("#add-to-list-close").onclick=c,a.querySelector("#add-to-list-cancel").onclick=c,a.querySelector("#add-to-list-confirm").onclick=async()=>{if(s)try{await window.supabase.from("creator_list_member").insert({list_id:s,creator_id:e,added_at:new Date().toISOString()}),c(),window.dispatchEvent(new CustomEvent("entityUpdated",{detail:{entity:"creator_list",action:"member-added",id:s}})),alert("Creator zur Liste hinzugefügt.")}catch(d){console.error("❌ Fehler beim Hinzufügen zur Liste",d),alert("Hinzufügen fehlgeschlagen.")}}}confirmDelete(e,t){const n=this.getEntityDisplayName(t);confirm(`Möchten Sie wirklich ${n} löschen? Diese Aktion kann nicht rückgängig gemacht werden.`)&&(console.log(`🗑️ Lösche ${t} ${e}`),window.dataService.deleteEntity(t,e).then(a=>{a.success&&window.dispatchEvent(new CustomEvent("entityUpdated",{detail:{entity:t,action:"deleted",id:e}}))}))}openNotizModal(e,t){console.log(`📝 Öffne Notiz-Modal für ${t} ${e}`)}openRatingModal(e,t){console.log(`⭐ Öffne Rating-Modal für ${t} ${e}`)}openRechnungModal(e,t){console.log(`💰 Öffne Rechnung-Modal für ${t} ${e}`)}getEntityDisplayName(e){return{creator:"den Creator",unternehmen:"das Unternehmen",marke:"die Marke",auftrag:"den Auftrag",kooperation:"die Kooperation"}[e]||"das Element"}async openAddAnsprechpartnerToKampagneModal(e){console.log("🎯 ACTIONSDROPDOWN: Öffne Ansprechpartner-Auswahl-Modal für Kampagne:",e);let t=[],n=[];try{const{data:u}=await window.supabase.from("ansprechpartner_kampagne").select("ansprechpartner_id").eq("kampagne_id",e);n=(u||[]).map(p=>p.ansprechpartner_id).filter(Boolean);let h=window.supabase.from("ansprechpartner").select(`
          id, 
          vorname, 
          nachname, 
          email,
          unternehmen:unternehmen_id(firmenname),
          position:position_id(name)
        `).order("nachname");n.length>0&&(h=h.not("id","in",`(${n.join(",")})`));const{data:m}=await h;t=m||[]}catch(u){console.warn("⚠️ Fehler beim Laden der Ansprechpartner:",u)}const a=document.createElement("div");a.className="modal overlay-modal",a.innerHTML=`
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
      </div>`,document.body.appendChild(a);const r=a.querySelector("#ansprechpartner-kampagne-search"),i=a.querySelector("#ansprechpartner-kampagne-dropdown");let s=null;const o=(u="")=>{if(!u||u.trim().length===0){i.innerHTML='<div class="dropdown-item no-results">Beginnen Sie zu tippen, um Ansprechpartner zu suchen...</div>';return}const h=u.toLowerCase(),m=t.filter(p=>{const g=`${p.vorname} ${p.nachname}`.toLowerCase(),f=(p.email||"").toLowerCase(),w=(p.unternehmen?.firmenname||"").toLowerCase();return g.includes(h)||f.includes(h)||w.includes(h)});i.innerHTML=m.length?m.map(p=>{const g=`${p.vorname} ${p.nachname}`,f=[p.email,p.unternehmen?.firmenname,p.position?.name].filter(Boolean).join(" • ");return`<div class="dropdown-item" data-id="${p.id}">
              <div class="dropdown-item-main">${g}</div>
              ${f?`<div class="dropdown-item-details">${f}</div>`:""}
            </div>`}).join(""):'<div class="dropdown-item no-results">Keine verfügbaren Ansprechpartner gefunden</div>'};i.innerHTML='<div class="dropdown-item no-results">Beginnen Sie zu tippen, um Ansprechpartner zu suchen...</div>',r.addEventListener("focus",()=>{r.value.trim().length>0&&i.classList.add("show")}),r.addEventListener("blur",()=>{setTimeout(()=>i.classList.remove("show"),150)});let l;r.addEventListener("input",u=>{clearTimeout(l),l=setTimeout(async()=>{const h=u.target.value.trim();if(h.length<1){i.classList.remove("show");return}try{let m=window.supabase.from("ansprechpartner").select(`
              id, 
              vorname, 
              nachname, 
              email,
              unternehmen:unternehmen_id(firmenname),
              position:position_id(name)
            `).or(`vorname.ilike.%${h}%,nachname.ilike.%${h}%,email.ilike.%${h}%`).order("nachname");n.length>0&&(m=m.not("id","in",`(${n.join(",")})`));const{data:p}=await m;t=p||[],o(h),i.classList.add("show")}catch(m){console.warn("⚠️ Ansprechpartner-Suche fehlgeschlagen",m)}},200)}),i.addEventListener("click",u=>{const h=u.target.closest(".dropdown-item");if(!h||h.classList.contains("no-results"))return;s=h.dataset.id;const m=h.querySelector(".dropdown-item-main")?.textContent||h.textContent;r.value=m,a.querySelector("#add-ansprechpartner-kampagne-confirm").disabled=!1,i.classList.remove("show")});const c=()=>a.remove();a.querySelector("#add-ansprechpartner-kampagne-close").onclick=c,a.querySelector("#add-ansprechpartner-kampagne-cancel").onclick=c;const d=u=>{u.key==="Escape"&&(c(),document.removeEventListener("keydown",d))};document.addEventListener("keydown",d),a.querySelector("#add-ansprechpartner-kampagne-confirm").onclick=async()=>{if(s)try{const{error:u}=await window.supabase.from("ansprechpartner_kampagne").insert({kampagne_id:e,ansprechpartner_id:s});if(u)throw u;c(),document.removeEventListener("keydown",d),window.dispatchEvent(new CustomEvent("entityUpdated",{detail:{entity:"ansprechpartner",action:"added",kampagneId:e}})),window.dispatchEvent(new CustomEvent("entityUpdated",{detail:{entity:"kampagne",action:"ansprechpartner-added",id:e}})),alert("✅ Ansprechpartner wurde erfolgreich zur Kampagne hinzugefügt und wird automatisch angezeigt!"),console.log("✅ ACTIONSDROPDOWN: Ansprechpartner erfolgreich zu Kampagne hinzugefügt")}catch(u){console.error("❌ Fehler beim Hinzufügen des Ansprechpartners:",u),alert("Fehler beim Hinzufügen: "+(u.message||"Unbekannter Fehler"))}}}destroy(){console.log("🗑️ ACTIONSDROPDOWN: Cleanup"),this.closeAllDropdowns(),this.boundEventListeners.forEach(({element:e,type:t,handler:n})=>{e.removeEventListener(t,n)}),this.boundEventListeners.clear()}}const L=new Me;class Fe{constructor(){this.lists=[]}async init(){window.setHeadline("Listen"),await this.render(),await this.load(),await this.initFilters()}async render(){const e=`
      <div class="page-header">
        <div class="page-header-left">
          <h1>Listen</h1>
          <p>Gespeicherte Creator-Listen</p>
        </div>
        <div class="page-header-right">
          <button id="btn-new-list" class="primary-btn">Neue Liste</button>
        </div>
      </div>

      <div class="filter-bar">
        <div class="filter-left"><div id="filter-container"></div></div>
        <div class="filter-right">
          <button id="btn-filter-reset" class="secondary-btn" style="display:${this.hasActiveFilters()?"inline-block":"none"};">Filter zurücksetzen</button>
        </div>
      </div>

      <div class="data-table-container">
        <table class="data-table">
          <thead>
            <tr>
              <th>Name</th>
              <th>Creator</th>
              <th>Erstellt am</th>
              <th>Aktionen</th>
            </tr>
          </thead>
          <tbody id="creator-lists-body">
            <tr><td colspan="4" class="loading">Lade Listen...</td></tr>
          </tbody>
        </table>
      </div>
    `;window.setContentSafely(window.content,e),document.getElementById("btn-new-list")?.addEventListener("click",t=>{t.preventDefault(),(async()=>{const{data:n,error:a}=await window.supabase.from("creator_list").insert({name:"Neue Liste",created_by:window.currentUser?.id,created_at:new Date().toISOString()}).select("id").single();!a&&n?.id?window.navigateTo(`/creator-lists/${n.id}`):alert("Liste konnte nicht erstellt werden.")})()})}async initFilters(){const e=document.getElementById("filter-container");e&&await _.renderFilterBar("creator_list",e,t=>this.onFiltersApplied(t),()=>this.onFiltersReset())}onFiltersApplied(e){_.applyFilters("creator_list",e),this.load()}onFiltersReset(){_.resetFilters("creator_list"),this.load()}hasActiveFilters(){const e=_.getFilters("creator_list");return Object.keys(e).length>0}async load(){const{data:e,error:t}=await window.supabase.from("creator_list").select("id, name, created_at, members:creator_list_member(count)").order("created_at",{ascending:!1});if(t)return console.error("❌ Fehler beim Laden der Listen:",t),this.updateTable([]);const n=(e||[]).map(a=>({id:a.id,name:a.name,created_at:a.created_at,count:a.members&&a.members[0]?.count||0}));this.lists=n,this.updateTable(n)}updateTable(e){const t=document.getElementById("creator-lists-body");if(!t)return;if(!e||e.length===0){t.innerHTML='<tr><td colspan="4" class="empty">Keine Listen vorhanden</td></tr>';return}const n=a=>a?new Intl.DateTimeFormat("de-DE").format(new Date(a)):"-";t.innerHTML=e.map(a=>`
      <tr>
        <td><a href="/creator-lists/${a.id}" onclick="event.preventDefault(); window.navigateTo('/creator-lists/${a.id}')">${window.validatorSystem.sanitizeHtml(a.name||a.id)}</a></td>
        <td>${a.count}</td>
        <td>${n(a.created_at)}</td>
        <td>
          <div class="actions-dropdown-container" data-entity-type="creator_list">
            <button class="actions-toggle" aria-expanded="false" aria-label="Aktionen">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M12 8c1.1 0 2-.9 2-2s-.9-2-2-2-2 .9-2 2 .9 2 2 2zm0 2c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2zm0 6c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2z"/></svg>
            </button>
            <div class="actions-dropdown">
              <a href="#" class="action-item" data-action="view" data-id="${a.id}" onclick="event.preventDefault(); window.navigateTo('/creator/${a.id}')">Details anzeigen</a>
              <a href="#" class="action-item action-danger" data-action="delete" data-id="${a.id}" onclick="event.preventDefault(); (async()=>{ try{ await window.supabase.from('creator_list').delete().eq('id','${a.id}'); window.dispatchEvent(new CustomEvent('entityUpdated',{detail:{entity:'creator_list',action:'deleted',id:'${a.id}'}})); }catch(e){ alert('Löschen fehlgeschlagen'); } })()">Löschen</a>
            </div>
          </div>
        </td>
      </tr>
    `).join(""),L.normalizeIcons(document)}destroy(){}}const Te=new Fe;function Ie(b,e={}){const{showActions:t=!1}=e,n=i=>i?new Date(i).toLocaleDateString("de-DE"):"-",a=i=>Array.isArray(i)&&i.length>0?i.join(", "):"-",r=(b||[]).map(i=>{const s=i.id,o=i.kampagnenname||"Unbekannt",l=i.unternehmen?.firmenname||"-",c=i.marke?.markenname||"-",d=a(i.art_der_kampagne),u=i.status||"-",h=n(i.start),m=n(i.deadline),p=i.creatoranzahl??"-",g=i.videoanzahl??"-";return`
      <tr data-id="${s||""}">
        <td>
          ${s?`<a href="/kampagne/${s}" class="table-link" data-table="kampagne" data-id="${s}">${o}</a>`:o}
        </td>
        <td>${l}</td>
        <td>${c}</td>
        <td>${d}</td>
        <td><span class="status-badge status-${String(u).toLowerCase()}">${u}</span></td>
        <td>${h}</td>
        <td>${m}</td>
        <td>${p}</td>
        <td>${g}</td>
        ${t?"<td></td>":""}
      </tr>
    `}).join("");return`
    <div class="data-table-container">
      <table class="data-table">
        <thead>
          <tr>
            <th>Kampagnenname</th>
            <th>Unternehmen</th>
            <th>Marke</th>
            <th>Art der Kampagne</th>
            <th>Status</th>
            <th>Start</th>
            <th>Deadline</th>
            <th>Creator Anzahl</th>
            <th>Video Anzahl</th>
            ${t?"<th>Aktionen</th>":""}
          </tr>
        </thead>
        <tbody>
          ${r||""}
        </tbody>
      </table>
    </div>
  `}class Be{constructor(){this.creatorId=null,this.creator=null,this.notizen=[],this.ratings=[],this.kampagnen=[],this.lists=[],this.kooperationen=[],this.rechnungen=[]}async init(e){if(console.log("🎯 CREATORDETAIL: Initialisiere Creator-Detailseite für ID:",e),this.creatorId=e,window.moduleRegistry?.currentModule!==this){console.log("⚠️ CREATORDETAIL: Nicht mehr das aktuelle Modul, breche ab");return}try{await this.loadCreatorData(),await this.render(),this.bindEvents(),console.log("✅ CREATORDETAIL: Initialisierung abgeschlossen")}catch(t){console.error("❌ CREATORDETAIL: Fehler bei der Initialisierung:",t),window.ErrorHandler.handle(t,"CreatorDetail.init")}}async loadCreatorData(){console.log("🔄 CREATORDETAIL: Lade Creator-Daten...");const{data:e,error:t}=await window.supabase.from("creator").select("*").eq("id",this.creatorId).single();if(t)throw new Error(`Fehler beim Laden der Creator-Daten: ${t.message}`);this.creator=e,console.log("✅ CREATORDETAIL: Creator-Basisdaten geladen:",e);try{const{data:s}=await window.supabase.from("creator_sprachen").select("sprache_id, sprachen:sprache_id(id, name)").eq("creator_id",this.creatorId);this.creator.sprachen=(s||[]).map(o=>o.sprachen).filter(Boolean)}catch{}try{const{data:s}=await window.supabase.from("creator_branchen").select("branche_id, branchen_creator:branche_id(id, name)").eq("creator_id",this.creatorId);this.creator.branchen=(s||[]).map(o=>o.branchen_creator).filter(Boolean)}catch{}try{const{data:s}=await window.supabase.from("creator_creator_type").select("creator_type_id, creator_type:creator_type_id(id, name)").eq("creator_id",this.creatorId);this.creator.creator_types=(s||[]).map(o=>o.creator_type).filter(Boolean)}catch{}this.notizen=await window.notizenSystem.loadNotizen("creator",this.creatorId),console.log("✅ CREATORDETAIL: Notizen geladen:",this.notizen.length),this.ratings=await window.bewertungsSystem.loadBewertungen("creator",this.creatorId),console.log("✅ CREATORDETAIL: Ratings geladen:",this.ratings.length);const{data:n,error:a}=await window.supabase.from("kampagne_creator").select(`
        *,
        kampagne:kampagne_id (
          id,
          kampagnenname,
          status,
          start,
          deadline,
          unternehmen:unternehmen_id (
            id,
            firmenname
          ),
          marke:marke_id (
            id,
            markenname
          )
        )
      `).eq("creator_id",this.creatorId).order("hinzugefuegt_am",{ascending:!1});a||(this.kampagnen=n||[]),console.log("✅ CREATORDETAIL: Kampagnen geladen:",this.kampagnen.length);try{const{data:s}=await window.supabase.from("kooperationen").select(`
          id,
          name,
          status,
          videoanzahl,
          gesamtkosten,
          kampagne:kampagne_id ( id, kampagnenname ),
          created_at
        `).eq("creator_id",this.creatorId).order("created_at",{ascending:!1});this.kooperationen=s||[]}catch(s){console.warn("⚠️ CREATORDETAIL: Kooperationen konnten nicht geladen werden",s),this.kooperationen=[]}console.log("✅ CREATORDETAIL: Kooperationen geladen:",this.kooperationen.length);try{const s=(this.kooperationen||[]).map(o=>o.id).filter(Boolean);if(s.length>0){const{data:o}=await window.supabase.from("rechnung").select("id, rechnung_nr, status, nettobetrag, bruttobetrag, gestellt_am, bezahlt_am, pdf_url, kooperation_id").in("kooperation_id",s).order("gestellt_am",{ascending:!1});this.rechnungen=o||[]}else this.rechnungen=[]}catch{this.rechnungen=[]}try{const s=(this.kooperationen||[]).filter(d=>d.kampagne).map(d=>({kampagne:{id:d.kampagne.id,kampagnenname:d.kampagne.kampagnenname,status:d.status||null,start:null,deadline:null,unternehmen:null,marke:null},hinzugefuegt_am:d.created_at||null,notiz:null})),o=[...this.kampagnen||[],...s],l=new Set;this.kampagnen=o.filter(d=>{const u=d?.kampagne?.id||d?.kampagne_id||d?.kampagne?.kampagnenname;return u?l.has(u)?!1:(l.add(u),!0):!0});const c=Array.from(new Set(this.kampagnen.map(d=>d?.kampagne?.id||d?.kampagne_id).filter(Boolean)));if(c.length>0){const{data:d}=await window.supabase.from("kampagne").select("id, unternehmen:unternehmen_id ( firmenname ), marke:marke_id ( markenname )").in("id",c),u=(d||[]).reduce((h,m)=>(h[m.id]=m,h),{});this.kampagnen=this.kampagnen.map(h=>{const m=h?.kampagne?.id||h?.kampagne_id,p=m?u[m]:null;return p&&(h.kampagne||(h.kampagne={id:m}),h.kampagne.unternehmen||(h.kampagne.unternehmen=p.unternehmen||null),h.kampagne.marke||(h.kampagne.marke=p.marke||null)),h})}}catch(s){console.warn("⚠️ CREATORDETAIL: Kampagnen-Merge aus Kooperationen fehlgeschlagen",s)}const{data:r,error:i}=await window.supabase.from("creator_list_member").select(`
        *,
        list:list_id (
          id,
          name,
          created_at
        )
      `).eq("creator_id",this.creatorId).order("added_at",{ascending:!1});i||(this.lists=r||[]),console.log("✅ CREATORDETAIL: Listen geladen:",this.lists.length)}async render(){if(!this.creator){window.setHeadline("Creator nicht gefunden"),window.content.innerHTML=`
        <div class="error-message">
          <p>Der angeforderte Creator wurde nicht gefunden.</p>
          <button onclick="window.navigateTo('/creator')" class="secondary-btn">Zurück zur Übersicht</button>
        </div>
      `;return}window.setHeadline(`${this.creator.vorname} ${this.creator.nachname}`);const e=`
      <div class="page-header">
        <div class="page-header-left">
          <h1>${this.creator.vorname} ${this.creator.nachname}</h1>
          <p>Creator Details und Aktivitäten</p>
        </div>
        <div class="page-header-right">
          <button id="btn-edit-creator" class="primary-btn">Creator bearbeiten</button>
          <button onclick="window.navigateTo('/creator')" class="secondary-btn">Zurück zur Übersicht</button>
        </div>
      </div>

      <div class="content-section">
        <!-- Tab Navigation -->
        <div class="tab-navigation">
          <button class="tab-button active" data-tab="info">
            <i class="icon-user"></i>
            Informationen
          </button>
          <button class="tab-button" data-tab="notizen">
            <i class="icon-document-text"></i>
            Notizen
            <span class="tab-count">${this.notizen.length}</span>
          </button>
          <button class="tab-button" data-tab="ratings">
            
            Bewertungen
            <span class="tab-count">${this.ratings.length}</span>
          </button>
          <button class="tab-button" data-tab="kampagnen">
            <i class="icon-megaphone"></i>
            Kampagnen
            <span class="tab-count">${this.kampagnen.length}</span>
          </button>
          <button class="tab-button" data-tab="kooperationen">
            <i class="icon-handshake"></i>
            Kooperationen
            <span class="tab-count">${this.kooperationen.length}</span>
          </button>
          <button class="tab-button" data-tab="listen">
            <i class="icon-list"></i>
            Listen
            <span class="tab-count">${this.lists.length}</span>
          </button>
          <button class="tab-button" data-tab="rechnungen">
            <i class="icon-currency-euro"></i>
            Rechnungen
            <span class="tab-count">${this.rechnungen.length}</span>
          </button>
        </div>

        <!-- Tab Content -->
        <div class="tab-content">
          <!-- Informationen Tab -->
          <div class="tab-pane active" id="tab-info">
            <div class="detail-section">
              <h2>Creator Informationen</h2>
              <div class="detail-grid">
                <div class="detail-card">
                  <h3>Kontakt</h3>
                  <div class="detail-item">
                    <label>E-Mail:</label>
                    <span>${this.creator.mail||"-"}</span>
                  </div>
                  <div class="detail-item">
                    <label>Telefon:</label>
                    <span>${this.creator.telefonnummer||"-"}</span>
                  </div>
                  <div class="detail-item">
                    <label>Stadt:</label>
                    <span>${this.creator.lieferadresse_stadt||"-"}</span>
                  </div>
                  <div class="detail-item">
                    <label>Land:</label>
                    <span>${this.creator.lieferadresse_land||"-"}</span>
                  </div>
                </div>

                <div class="detail-card">
                  <h3>Social Media</h3>
                  <div class="detail-item">
                    <label>Instagram:</label>
                    <span>${this.creator.instagram?`@${this.creator.instagram}`:"-"}</span>
                  </div>
                  <div class="detail-item">
                    <label>Instagram Follower:</label>
                    <span>${this.creator.instagram_follower?this.formatNumber(this.creator.instagram_follower):"-"}</span>
                  </div>
                  <div class="detail-item">
                    <label>TikTok:</label>
                    <span>${this.creator.tiktok?`@${this.creator.tiktok}`:"-"}</span>
                  </div>
                  <div class="detail-item">
                    <label>TikTok Follower:</label>
                    <span>${this.creator.tiktok_follower?this.formatNumber(this.creator.tiktok_follower):"-"}</span>
                  </div>
                </div>

                <div class="detail-card">
                  <h3>Profil</h3>
                  <div class="detail-item">
                    <label>Typen:</label>
                    <span>${this.renderTagList(this.creator.creator_types)}</span>
                  </div>
                  <div class="detail-item">
                    <label>Sprachen:</label>
                    <span>${this.renderTagList(this.creator.sprachen)}</span>
                  </div>
                  <div class="detail-item">
                    <label>Branchen:</label>
                    <span>${this.renderTagList(this.creator.branchen)}</span>
                  </div>
                  <div class="detail-item">
                    <label>Portfolio:</label>
                    <span>${this.creator.portfolio_link?`<a href="${this.creator.portfolio_link}" target="_blank">Link</a>`:"-"}</span>
                  </div>
                </div>

                <div class="detail-card">
                  <h3>Finanzen</h3>
                  <div class="detail-item">
                    <label>Letztes Budget:</label>
                    <span>${this.creator.budget_letzte_buchung?this.formatCurrency(this.creator.budget_letzte_buchung):"-"}</span>
                  </div>
                  <div class="detail-item">
                    <label>Erstellt:</label>
                    <span>${this.formatDate(this.creator.created_at)}</span>
                  </div>
                  <div class="detail-item">
                    <label>Aktualisiert:</label>
                    <span>${this.formatDate(this.creator.updated_at)}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <!-- Notizen Tab -->
          <div class="tab-pane" id="tab-notizen">
            <div class="detail-section">
              <h2>Notizen</h2>
              ${this.renderNotizen()}
            </div>
          </div>

          <!-- Ratings Tab -->
          <div class="tab-pane" id="tab-ratings">
            <div class="detail-section">
              <h2>Bewertungen</h2>
              ${this.renderRatings()}
            </div>
          </div>

          <!-- Kampagnen Tab -->
          <div class="tab-pane" id="tab-kampagnen">
            <div class="detail-section">
              <h2>Kampagnen</h2>
              ${this.renderKampagnen()}
            </div>
          </div>

          <!-- Kooperationen Tab -->
          <div class="tab-pane" id="tab-kooperationen">
            <div class="detail-section">
              <h2>Kooperationen</h2>
              ${this.renderKooperationen()}
            </div>
          </div>

          <!-- Listen Tab -->
          <div class="tab-pane" id="tab-listen">
            <div class="detail-section">
              <h2>Listen</h2>
              ${this.renderLists()}
            </div>
          </div>
          
          <!-- Rechnungen Tab -->
          <div class="tab-pane" id="tab-rechnungen">
            <div class="detail-section">
              <h2>Rechnungen</h2>
              ${this.renderRechnungen()}
            </div>
          </div>
        </div>
      </div>
    `;window.setContentSafely(window.content,e)}renderTagList(e){if(!e||e.length===0)return"-";if(Array.isArray(e))return`<div class="tags">${e.map(n=>{const a=typeof n=="object"&&(n.name||n.label)||n;return`<span class="tag">${String(a).trim()}</span>`}).join("")}</div>`;if(typeof e=="object"){const t=e.name||e.label;return t?`<div class="tags"><span class="tag">${t}</span></div>`:"-"}return`<div class="tags"><span class="tag">${String(e)}</span></div>`}renderNotizen(){return window.notizenSystem.renderNotizenContainer(this.notizen,"creator",this.creatorId)}renderRatings(){return window.bewertungsSystem.renderBewertungenContainer(this.ratings,"creator",this.creatorId)}renderKampagnen(){if(!this.kampagnen||this.kampagnen.length===0)return`
        <div class="empty-state">
          <p>Noch keine Kampagnen zugeordnet.</p>
        </div>
      `;const e=this.kampagnen.map(t=>{const n=t.kampagne||t;return{id:n.id,kampagnenname:n.kampagnenname,unternehmen:n.unternehmen||null,marke:n.marke||null,art_der_kampagne:n.art_der_kampagne,status:n.status,start:n.start,deadline:n.deadline,creatoranzahl:n.creatoranzahl,videoanzahl:n.videoanzahl}});return Ie(e,{showActions:!1})}renderLists(){return this.lists.length===0?`
        <div class="empty-state">
          <p>Noch keiner Liste zugeordnet.</p>
        </div>
      `:`
      <div class="lists-container">
        ${this.lists.map(t=>`
      <div class="list-card">
        <div class="list-header">
          <h4>${t.list.name}</h4>
          <span class="list-date">Hinzugefügt: ${this.formatDate(t.added_at)}</span>
        </div>
        <div class="list-details">
          <small>Liste erstellt: ${this.formatDate(t.list.created_at)}</small>
        </div>
      </div>
    `).join("")}
      </div>
    `}renderKooperationen(){return this.kooperationen.length===0?`
        <div class="empty-state">
          <p>Noch keine Kooperationen vorhanden.</p>
        </div>
      `:`
      <div class="kooperationen-container">
        ${this.kooperationen.map(t=>`
      <div class="kooperation-card">
        <div class="kooperation-header">
          <h4>${t.name||"Kooperation"}</h4>
          <span class="kooperation-status status-${(t.status||"unknown").toLowerCase()}">${t.status||"-"}</span>
        </div>
        <div class="kooperation-details">
          <div>
            <strong>Kampagne:</strong> ${t.kampagne?.kampagnenname||"-"}
          </div>
          <div>
            <strong>Videos:</strong> ${t.videoanzahl||0}
          </div>
          <div>
            <strong>Gesamtkosten:</strong> ${t.gesamtkosten?this.formatCurrency(t.gesamtkosten):"-"}
          </div>
          <div>
            <small>Erstellt: ${this.formatDate(t.created_at)}</small>
          </div>
        </div>
      </div>
    `).join("")}
      </div>
    `}renderRechnungen(){if(!this.rechnungen||this.rechnungen.length===0)return`
        <div class="empty-state">
          <p>Keine Rechnungen vorhanden.</p>
        </div>
      `;const e=a=>a?new Intl.NumberFormat("de-DE",{style:"currency",currency:"EUR"}).format(a):"-",t=a=>a?new Date(a).toLocaleDateString("de-DE"):"-";return`
      <div class="data-table-container">
        <table class="data-table">
          <thead>
            <tr>
              <th>Rechnungs-Nr</th>
              <th>Status</th>
              <th>Netto</th>
              <th>Brutto</th>
              <th>Gestellt</th>
              <th>Bezahlt</th>
              <th>Beleg</th>
            </tr>
          </thead>
          <tbody>${this.rechnungen.map(a=>`
      <tr>
        <td><a href="/rechnung/${a.id}" onclick="event.preventDefault(); window.navigateTo('/rechnung/${a.id}')">${window.validatorSystem.sanitizeHtml(a.rechnung_nr||"—")}</a></td>
        <td>${a.status||"-"}</td>
        <td>${e(a.nettobetrag)}</td>
        <td>${e(a.bruttobetrag)}</td>
        <td>${t(a.gestellt_am)}</td>
        <td>${t(a.bezahlt_am)}</td>
        <td>${a.pdf_url?`<a href="${a.pdf_url}" target="_blank" rel="noopener">PDF</a>`:"-"}</td>
      </tr>
    `).join("")}</tbody>
        </table>
      </div>
    `}bindEvents(){document.addEventListener("click",e=>{e.target.classList.contains("tab-button")&&(e.preventDefault(),this.switchTab(e.target.dataset.tab))}),document.addEventListener("click",e=>{e.target.id==="btn-edit-creator"&&(e.preventDefault(),this.showEditForm())}),document.addEventListener("click",e=>{if(e.target.hasAttribute("data-kampagne-id")){e.preventDefault();const t=e.target.getAttribute("data-kampagne-id");window.navigateTo(`/kampagne/${t}`)}}),window.addEventListener("notizenUpdated",async e=>{e.detail.entityType==="creator"&&e.detail.entityId===this.creatorId&&(console.log("🔄 CREATORDETAIL: Notizen wurden aktualisiert, lade neu..."),this.notizen=await window.notizenSystem.loadNotizen("creator",this.creatorId),this.renderNotizen())}),window.addEventListener("bewertungenUpdated",async e=>{e.detail.entityType==="creator"&&e.detail.entityId===this.creatorId&&(console.log("🔄 CREATORDETAIL: Bewertungen wurden aktualisiert, lade neu..."),this.ratings=await window.bewertungsSystem.loadBewertungen("creator",this.creatorId),this.renderRatings())})}switchTab(e){console.log("🔄 CREATORDETAIL: Wechsle zu Tab:",e),document.querySelectorAll(".tab-button").forEach(a=>{a.classList.remove("active")}),document.querySelectorAll(".tab-pane").forEach(a=>{a.classList.remove("active")});const t=document.querySelector(`[data-tab="${e}"]`),n=document.getElementById(`tab-${e}`);t&&n&&(t.classList.add("active"),n.classList.add("active"))}showAddNotizModal(){console.log("📝 CREATORDETAIL: Zeige Add Notiz Modal")}showAddRatingModal(){console.log("⭐ CREATORDETAIL: Zeige Add Rating Modal")}showEditForm(){console.log("🎯 CREATORDETAIL: Zeige Creator-Bearbeitungsformular für ID:",this.creatorId),window.setHeadline("Creator bearbeiten");const e=window.formSystem.renderFormOnly("creator",this.creator);window.setContentSafely(window.content,`
      <div class="page-header">
        <div class="page-header-left">
          <h1>Creator bearbeiten</h1>
          <p>Bearbeiten Sie die Informationen von ${this.creator.vorname} ${this.creator.nachname}</p>
        </div>
        <div class="page-header-right">
          <button onclick="window.navigateTo('/creator/${this.creatorId}')" class="secondary-btn">Zurück zu Details</button>
        </div>
      </div>
      
      <div class="form-page">
        ${e}
      </div>
    `),window.formSystem.bindFormEvents("creator",this.creator);const t=document.getElementById("creator-form");t&&(t.onsubmit=async n=>{n.preventDefault(),await this.handleEditFormSubmit()})}async handleEditFormSubmit(){try{const e=document.getElementById("creator-form"),t=new FormData(e),n={};for(const[i,s]of t.entries())if(i.includes("[]")){const o=i.replace("[]","");n[o]||(n[o]=[]),n[o].push(s)}else n[i]=s;const a=window.validatorSystem.validateForm(n,{vorname:{type:"text",minLength:2,required:!0},nachname:{type:"text",minLength:2,required:!0},mail:{type:"email"},telefonnummer:{type:"phone"},portfolio_link:{type:"url"}});if(!a.isValid){this.showValidationErrors(a.errors);return}const r=await window.dataService.updateEntity("creator",this.creatorId,n);if(r.success)this.showSuccessMessage("Creator erfolgreich aktualisiert!"),setTimeout(async()=>{await this.loadCreatorData(),await this.render(),window.navigateTo(`/creator/${this.creatorId}`)},1500);else throw new Error(r.error||"Unbekannter Fehler")}catch(e){console.error("❌ Edit Formular-Submit Fehler:",e),this.showErrorMessage(e.message)}}showValidationErrors(e){console.log("❌ Validierungsfehler:",e),document.querySelectorAll(".validation-error").forEach(t=>t.remove()),Object.keys(e).forEach(t=>{const n=document.querySelector(`[name="${t}"]`);if(n){const a=document.createElement("div");a.className="validation-error",a.textContent=e[t],a.style.color="#dc3545",a.style.fontSize="0.875rem",a.style.marginTop="0.25rem",n.parentNode.appendChild(a),n.style.borderColor="#dc3545"}})}showSuccessMessage(e){const t=document.createElement("div");t.className="alert alert-success",t.textContent=e,t.style.cssText=`
      background: #d4edda;
      color: #155724;
      padding: 1rem;
      border-radius: 4px;
      margin-bottom: 1rem;
      border: 1px solid #c3e6cb;
    `;const n=document.querySelector(".form-page");n&&n.insertBefore(t,n.firstChild)}showErrorMessage(e){const t=document.createElement("div");t.className="alert alert-danger",t.textContent=e,t.style.cssText=`
      background: #f8d7da;
      color: #721c24;
      padding: 1rem;
      border-radius: 4px;
      margin-bottom: 1rem;
      border: 1px solid #f5c6cb;
    `;const n=document.querySelector(".form-page");n&&n.insertBefore(t,n.firstChild)}formatNumber(e){return e>=1e6?(e/1e6).toFixed(1)+"M":e>=1e3?(e/1e3).toFixed(1)+"K":e.toString()}formatCurrency(e){return new Intl.NumberFormat("de-DE",{style:"currency",currency:"EUR"}).format(e)}formatDate(e){return e?new Date(e).toLocaleDateString("de-DE"):"-"}destroy(){console.log("🗑️ CREATORDETAIL: Destroy aufgerufen"),window.setContentSafely(""),console.log("✅ CREATORDETAIL: Destroy abgeschlossen")}}const G=new Be;class Ce{constructor(){this.listId=null,this.list=null,this.members=[]}async init(e){this.listId=e,await this.load(),await this.render()}async load(){try{const[{data:e},{data:t}]=await Promise.all([window.supabase.from("creator_list").select("id, name, created_at").eq("id",this.listId).single(),window.supabase.from("creator_list_member").select(`
            id,
            added_at,
            creator:creator_id (
              id,
              vorname,
              nachname,
              instagram,
              tiktok,
              mail,
              lieferadresse_stadt,
              lieferadresse_land
            )
          `).eq("list_id",this.listId).order("added_at",{ascending:!1})]);this.list=e||{id:this.listId,name:"-"},this.members=(t||[]).filter(n=>!!n.creator)}catch(e){console.error("❌ Fehler beim Laden der Creator-Liste:",e),this.list={id:this.listId,name:"-"},this.members=[]}}async render(){const e=this.members.length;window.setHeadline(`Liste: ${window.validatorSystem.sanitizeHtml(this.list?.name||"-")}`);const t=`
      <div class="page-header">
        <div class="page-header-left">
          <h1>${window.validatorSystem.sanitizeHtml(this.list?.name||"-")}</h1>
          <p>${e} Creator</p>
        </div>
        <div class="page-header-right">
          <button class="secondary-btn" id="btn-back-lists">Zurück zu Listen</button>
        </div>
      </div>

      <div class="data-table-container">
        <table class="data-table">
          <thead>
            <tr>
              <th>Creator</th>
              <th>Instagram</th>
              <th>TikTok</th>
              <th>E-Mail</th>
              <th>Ort</th>
              <th>Hinzugefügt</th>
              <th>Aktionen</th>
            </tr>
          </thead>
          <tbody id="creator-list-detail-body">
            ${this.members.map(n=>this.renderRow(n)).join("")||'<tr><td colspan="7" class="empty">Keine Creator</td></tr>'}
          </tbody>
        </table>
      </div>
    `;window.setContentSafely(window.content,t),L.normalizeIcons(document),document.getElementById("btn-back-lists")?.addEventListener("click",n=>{n.preventDefault(),window.navigateTo("/creator-lists")})}renderRow(e){const t=e.creator||{},n=[t.vorname,t.nachname].filter(Boolean).join(" ")||t.id||"-",a=t.instagram?`@${t.instagram}`:"-",r=t.tiktok?`@${t.tiktok}`:"-",i=t.mail||"-",s=[t.lieferadresse_stadt,t.lieferadresse_land].filter(Boolean).join(", ")||"-",o=e.added_at?new Intl.DateTimeFormat("de-DE").format(new Date(e.added_at)):"-";return`
      <tr>
        <td><a href="/creator/${t.id}" onclick="event.preventDefault(); window.navigateTo('/creator/${t.id}')">${window.validatorSystem.sanitizeHtml(n)}</a></td>
        <td>${window.validatorSystem.sanitizeHtml(a)}</td>
        <td>${window.validatorSystem.sanitizeHtml(r)}</td>
        <td>${window.validatorSystem.sanitizeHtml(i)}</td>
        <td>${window.validatorSystem.sanitizeHtml(s)}</td>
        <td>${o}</td>
        <td>
          <div class="actions-dropdown-container" data-entity-type="creator">
            <button class="actions-toggle" aria-expanded="false" aria-label="Aktionen">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M12 8c1.1 0 2-.9 2-2s-.9-2-2-2-2 .9-2 2 .9 2 2 2zm0 2c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2zm0 6c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2z"/></svg>
            </button>
            <div class="actions-dropdown">
              <a href="#" class="action-item" data-action="view" data-id="${t.id}" onclick="event.preventDefault(); window.navigateTo('/creator/${t.id}')">Details anzeigen</a>
              <a href="#" class="action-item" data-action="add_to_campaign" data-id="${t.id}">
                ${L.getHeroIcon("add-to-campaign")}
                Zu Kampagne hinzufügen
              </a>
            </div>
          </div>
        </td>
      </tr>
    `}destroy(){}}const xe=new Ce;class Ne{constructor(){this.selectedUnternehmen=new Set,this._boundEventListeners=new Set}async init(){if(window.setHeadline("Unternehmen Übersicht"),!(window.canViewPage&&window.canViewPage("unternehmen")||await window.checkUserPermission("unternehmen","can_view"))){window.content.innerHTML=`
        <div class="error-message">
          <p>Sie haben keine Berechtigung, Unternehmen anzuzeigen.</p>
        </div>
      `;return}this.bindEvents(),await this.loadAndRender()}async loadAndRender(){try{const e=await window.dataService.loadFilterData("unternehmen");await this.render(e);const t=_.getFilters("unternehmen");console.log("🔍 Lade Unternehmen mit Filter:",t);const n=await window.dataService.loadEntities("unternehmen",t);console.log("📊 Unternehmen geladen:",n?.length||0),this.updateTable(n)}catch(e){window.ErrorHandler.handle(e,"UnternehmenList.loadAndRender")}}async render(e){const t=window.currentUser?.permissions?.unternehmen?.can_edit||!1,n=_.getFilters("unternehmen");Object.entries(n).forEach(([i,s])=>{});let a=`<div class="filter-bar">
      <div class="filter-left">
        <div id="filter-container"></div>
      </div>
      <div class="filter-right">
        <button id="btn-filter-reset" class="secondary-btn" style="display:${this.hasActiveFilters()?"inline-block":"none"};">Alle Filter zurücksetzen</button>
      </div>
    </div>`,r=`
      <div class="page-header">
        <div class="page-header-left">
          <h1>Unternehmen</h1>
          <p>Verwalten Sie alle Unternehmen und deren Kontakte</p>
        </div>
        <div class="page-header-right">
          ${t?'<button id="btn-unternehmen-new" class="primary-btn">Neues Unternehmen anlegen</button>':""}
        </div>
      </div>

      ${a}

      <div class="table-actions">
        <div class="table-actions-left">
          <button id="btn-select-all" class="secondary-btn">Alle auswählen</button>
          <button id="btn-deselect-all" class="secondary-btn" style="display:none;">Auswahl aufheben</button>
        </div>
        <div class="table-actions-right">
          <span id="selected-count" style="display:none;">0 ausgewählt</span>
          <button id="btn-delete-selected" class="danger-btn" style="display:none;">Ausgewählte löschen</button>
        </div>
      </div>

      <div class="table-container">
        <table class="data-table">
          <thead>
            <tr>
              <th><input type="checkbox" id="select-all-unternehmen"></th>
              <th>Name</th>
              <th>Branche</th>
              <th>Ansprechpartner</th>
              <th>Email</th>
              <th>Stadt</th>
              <th>Land</th>
              <th>Aktionen</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td colspan="9" class="no-data">Lade Unternehmen...</td>
            </tr>
          </tbody>
        </table>
      </div>
    `;window.setContentSafely(window.content,r),await this.initializeFilterBar()}async initializeFilterBar(){const e=document.getElementById("filter-container");e&&await _.renderFilterBar("unternehmen",e,t=>this.onFiltersApplied(t),()=>this.onFiltersReset())}onFiltersApplied(e){console.log("Filter angewendet:",e),_.applyFilters("unternehmen",e),this.loadAndRender()}onFiltersReset(){console.log("Filter zurückgesetzt"),_.resetFilters("unternehmen"),this.loadAndRender()}bindEvents(){this.boundFilterResetHandler=e=>{e.target.id==="btn-filter-reset"&&this.onFiltersReset()},document.addEventListener("click",this.boundFilterResetHandler),document.addEventListener("click",e=>{(e.target.id==="btn-unternehmen-new"||e.target.id==="btn-unternehmen-new-filter")&&(e.preventDefault(),window.navigateTo("/unternehmen/new"))}),document.addEventListener("click",e=>{if(e.target.classList.contains("table-link")&&e.target.dataset.table==="unternehmen"){e.preventDefault();const t=e.target.dataset.id;console.log("🎯 UNTERNEHMENLIST: Navigiere zu Unternehmen Details:",t),window.navigateTo(`/unternehmen/${t}`)}}),document.addEventListener("click",e=>{if(e.target.id==="btn-select-all"){e.preventDefault(),document.querySelectorAll(".unternehmen-check").forEach(a=>{a.checked=!0,a.dataset.id&&this.selectedUnternehmen.add(a.dataset.id)});const n=document.getElementById("select-all-unternehmen");n&&(n.indeterminate=!1,n.checked=!0),this.updateSelection()}}),document.addEventListener("click",e=>{e.target.id==="btn-deselect-all"&&(e.preventDefault(),this.deselectAll())}),window.addEventListener("entityUpdated",e=>{e.detail.entity==="unternehmen"&&this.loadAndRender()}),document.addEventListener("click",e=>{if(e.target.classList.contains("tag-x")){e.preventDefault(),e.stopPropagation();const n=e.target.closest(".filter-tag").dataset.key,a=_.getFilters("unternehmen");delete a[n],_.applyFilters("unternehmen",a),this.loadAndRender()}}),document.addEventListener("change",e=>{if(e.target.id==="select-all-unternehmen"){const t=document.querySelectorAll(".unternehmen-check"),n=e.target.checked;t.forEach(a=>{a.checked=n,n?this.selectedUnternehmen.add(a.dataset.id):this.selectedUnternehmen.delete(a.dataset.id)}),this.updateSelection(),console.log(`${n?"✅ Alle Unternehmen ausgewählt":"❌ Alle Unternehmen abgewählt"}: ${this.selectedUnternehmen.size}`)}}),document.addEventListener("change",e=>{e.target.classList.contains("unternehmen-check")&&(e.target.checked?this.selectedUnternehmen.add(e.target.dataset.id):this.selectedUnternehmen.delete(e.target.dataset.id),this.updateSelection(),this.updateSelectAllCheckbox())}),window.bulkActionSystem&&window.bulkActionSystem.registerList("unternehmen",this)}hasActiveFilters(){const e=_.getFilters("unternehmen");return Object.keys(e).length>0}updateSelection(){const e=this.selectedUnternehmen.size,t=document.getElementById("selected-count"),n=document.getElementById("btn-deselect-all"),a=document.getElementById("btn-delete-selected");t&&(t.textContent=`${e} ausgewählt`,t.style.display=e>0?"inline":"none"),n&&(n.style.display=e>0?"inline-block":"none"),a&&(a.style.display=e>0?"inline-block":"none")}async updateTable(e){const t=document.querySelector(".data-table tbody");if(!t)return;if(!e||e.length===0){const{renderEmptyState:i}=await B(async()=>{const{renderEmptyState:s}=await import("./core-C7Vz5Umf.js").then(o=>o.F);return{renderEmptyState:s}},[]);i(t);return}const n=e.map(i=>i.id).filter(Boolean),a=await this.loadAnsprechpartnerMap(n),r=e.map(i=>`
      <tr data-id="${i.id}">
        <td><input type="checkbox" class="unternehmen-check" data-id="${i.id}"></td>
        <td>
          <a href="#" class="table-link" data-table="unternehmen" data-id="${i.id}">
            ${window.validatorSystem.sanitizeHtml(i.firmenname||"")}
          </a>
        </td>
        <td>${this.renderBrancheTags(i.branchen)}</td>
        <td>${this.renderAnsprechpartnerList(a.get(i.id))}</td>
        <td>${window.validatorSystem.sanitizeHtml(i.invoice_email||"")}</td>
        <td>${window.validatorSystem.sanitizeHtml(i.rechnungsadresse_stadt||"")}</td>
        <td>${window.validatorSystem.sanitizeHtml(i.rechnungsadresse_land||"")}</td>
        <td>
          <div class="actions-dropdown-container" data-entity-type="unternehmen">
                          <button class="actions-toggle" aria-expanded="false" aria-label="Aktionen">
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" class="w-5 h-5">
                  <path d="M10 3a1.5 1.5 0 110 3 1.5 1.5 0 010-3zM10 8.5a1.5 1.5 0 110 3 1.5 1.5 0 010-3zM11.5 15.5a1.5 1.5 0 10-3 0 1.5 1.5 0 003 0z" />
                </svg>
              </button>
            <div class="actions-dropdown">
                              <a href="#" class="action-item" data-action="view" data-id="${i.id}">
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" class="w-5 h-5">
                    <path d="M10 12.5a2.5 2.5 0 100-5 2.5 2.5 0 000 5z" />
                    <path fill-rule="evenodd" d="M.661 10c1.743-2.372 4.761-5 9.339-5 4.578 0 7.601 2.628 9.339 5-1.738 2.372-4.761 5-9.339 5-4.578 0-7.601-2.628-9.339-5zM10 15a5 5 0 100-10 5 5 0 000 10z" clip-rule="evenodd" />
                  </svg>
                  Details anzeigen
                </a>
                <a href="#" class="action-item" data-action="edit" data-id="${i.id}">
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" class="w-5 h-5">
                    <path d="M5.433 13.917l-1.523 1.523a.75.75 0 001.06 1.06l1.523-1.523L5.433 13.917zM11.206 6.106L13.917 3.4a.75.75 0 011.06 1.06l-2.711 2.711-.693-.693z" />
                    <path fill-rule="evenodd" d="M1.334 10.606a1.5 1.5 0 011.06-1.06l10.38-10.38a1.5 1.5 0 012.122 0l1.523 1.523a1.5 1.5 0 010 2.122l-10.38 10.38a1.5 1.5 0 01-1.06 1.06H1.334v-3.182z" clip-rule="evenodd" />
                  </svg>
                  Bearbeiten
                </a>
                <a href="#" class="action-item" data-action="notiz" data-id="${i.id}">
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" class="w-5 h-5">
                    <path fill-rule="evenodd" d="M18 10c0 3.866-3.582 7-8 7a8.841 8.841 0 01-4.083-.98L2 17l1.336-3.117C2.688 12.31 2 11.104 2 10c0-3.866 3.582-7 8-7s8 3.134 8 7zM7 9H5v2h2V9zm8 0h-2v2h2V9zM9 9h2v2H9V9z" clip-rule="evenodd" />
                  </svg>
                  Notiz hinzufügen
                </a>
                <a href="#" class="action-item" data-action="add_ansprechpartner_unternehmen" data-id="${i.id}">
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" class="w-5 h-5">
                    <path d="M10 5a3 3 0 11-6 0 3 3 0 016 0zM1.615 16.428a1.224 1.224 0 01-.569-1.175 6.002 6.002 0 0111.908 0c.058.467-.172.92-.57 1.174A9.953 9.953 0 017 18a9.953 9.953 0 01-5.385-1.572zM16.25 5.75a.75.75 0 00-1.5 0v2h-2a.75.75 0 000 1.5h2v2a.75.75 0 001.5 0v-2h2a.75.75 0 000-1.5h-2v-2z" />
                  </svg>
                  Ansprechpartner hinzufügen
                </a>
                <a href="#" class="action-item" data-action="remove_ansprechpartner_unternehmen" data-id="${i.id}">
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" class="w-5 h-5">
                    <path d="M10 5a3 3 0 11-6 0 3 3 0 016 0zM1.615 16.428a1.224 1.224 0 01-.569-1.175 6.002 6.002 0 0111.908 0c.058.467-.172.92-.57 1.174A9.953 9.953 0 017 18a9.953 9.953 0 01-5.385-1.572zM16.25 8.25a.75.75 0 000 1.5h4a.75.75 0 000-1.5h-4z" />
                  </svg>
                  Ansprechpartner entfernen
                </a>
                
                <div class="action-separator"></div>
                <a href="#" class="action-item action-danger" data-action="delete" data-id="${i.id}">
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" class="w-5 h-5">
                    <path fill-rule="evenodd" d="M8.75 1A2.75 2.75 0 006 3.75v.443c-.795.077-1.584.176-2.368.298a.75.75 0 10.232 1.482l.175-.027c.572-.089 1.14-.19 1.706-.302A3.75 3.75 0 019.75 3h.5a3.75 3.75 0 013.657 3.234c.566.112 1.134.213 1.706.302l.175.027a.75.75 0 10.232-1.482A41.203 41.203 0 0014 4.193V3.75A2.75 2.75 0 0011.25 1h-2.5zM2.5 7.75a.75.75 0 01.75-.75h13.5a.75.75 0 010 1.5H3.25a.75.75 0 01-.75-.75zM7.25 9.75a.75.75 0 01.75-.75h4.5a.75.75 0 010 1.5H8a.75.75 0 01-.75-.75zM6 12.25a.75.75 0 01.75-.75h6.5a.75.75 0 010 1.5H6.75a.75.75 0 01-.75-.75zM4.75 14.75a.75.75 0 01.75-.75h9.5a.75.75 0 010 1.5h-9.5a.75.75 0 01-.75-.75z" clip-rule="evenodd" />
                  </svg>
                  Löschen
                </a>
            </div>
          </div>
        </td>
      </tr>
    `).join("");t.innerHTML=r}renderBrancheTags(e){if(!e||Array.isArray(e)&&e.length===0)return"-";if(typeof e=="object"&&!Array.isArray(e)&&e.name)return`<div class="tags tags-compact"><span class="tag tag--branche">${window.validatorSystem.sanitizeHtml(e.name)}</span></div>`;if(typeof e=="string"){const t=e.split(",").map(a=>a.trim()).filter(Boolean);return t.length===0?"-":`<div class="tags tags-compact">${t.map(a=>`<span class="tag tag--branche">${window.validatorSystem.sanitizeHtml(a)}</span>`).join("")}</div>`}if(Array.isArray(e))return`<div class="tags tags-compact">${e.map(n=>{const a=typeof n=="object"&&(n.name||n.label)||n;return`<span class="tag tag--branche">${window.validatorSystem.sanitizeHtml(String(a).trim())}</span>`}).join("")}</div>`;if(typeof e=="object"){const t=e.name||e.label;return t?`<div class="tags tags-compact"><span class="tag tag--branche">${window.validatorSystem.sanitizeHtml(t)}</span></div>`:"-"}return"-"}async loadAnsprechpartnerMap(e){const t=new Map;try{if(!window.supabase||!Array.isArray(e)||e.length===0)return t;const{data:n,error:a}=await window.supabase.from("ansprechpartner_unternehmen").select(`
          unternehmen_id,
          ansprechpartner:ansprechpartner_id (
            id,
            vorname,
            nachname,
            email
          )
        `).in("unternehmen_id",e);if(a)return console.warn("⚠️ Konnte Ansprechpartner nicht laden:",a),t;(n||[]).forEach(r=>{if(!r.ansprechpartner)return;const i=r.unternehmen_id,s=r.ansprechpartner,o=t.get(i)||[];o.push(s),t.set(i,o)}),console.log("✅ UNTERNEHMENLISTE: Ansprechpartner-Map geladen:",t.size,"Unternehmen")}catch(n){console.warn("⚠️ loadAnsprechpartnerMap Fehler:",n)}return t}renderAnsprechpartnerList(e){if(!e||e.length===0)return"-";const t=e.filter(a=>a&&a.vorname&&a.nachname).slice(0,3).map(a=>`<a href="#" class="tag tag--ansprechpartner" data-action="view-ansprechpartner" data-id="${a.id}" onclick="event.preventDefault(); window.navigateTo('/ansprechpartner/${a.id}')">${window.validatorSystem.sanitizeHtml(a.vorname)} ${window.validatorSystem.sanitizeHtml(a.nachname)}</a>`).join(""),n=e.length>3?`<span class="tag tag--more">+${e.length-3}</span>`:"";return`<div class="tags tags-compact">${t}${n}</div>`}destroy(){console.log("UnternehmenList: Cleaning up..."),this._boundEventListeners.forEach(({element:e,type:t,handler:n})=>{e.removeEventListener(t,n)}),this._boundEventListeners.clear(),this.boundFilterResetHandler&&(document.removeEventListener("click",this.boundFilterResetHandler),this.boundFilterResetHandler=null)}showCreateForm(){console.log("🎯 Zeige Unternehmen-Erstellungsformular"),window.setHeadline("Neues Unternehmen anlegen");const e=window.formSystem.renderFormOnly("unternehmen");window.content.innerHTML=`
      <div class="page-header">
        <div class="page-header-left">
          <h1>Neues Unternehmen anlegen</h1>
          <p>Erstellen Sie ein neues Unternehmen für das CRM</p>
        </div>
        <div class="page-header-right">
          <button onclick="window.navigateTo('/unternehmen')" class="secondary-btn">Zurück zur Übersicht</button>
        </div>
      </div>
      
      <div class="form-page">
        ${e}
      </div>
    `,window.formSystem.bindFormEvents("unternehmen",null);const t=document.getElementById("unternehmen-form");t&&(t.onsubmit=async n=>{n.preventDefault(),await this.handleFormSubmit()})}async handleFormSubmit(){try{const e=document.getElementById("unternehmen-form"),t=new FormData(e),n={};for(const[i,s]of t.entries())if(i.includes("[]")){const o=i.replace("[]","");n[o]||(n[o]=[]),n[o].push(s)}else n[i]=s;n.branche_id&&Array.isArray(n.branche_id)&&console.log("✅ branche_id Array für Junction Table:",n.branche_id);const a=window.validatorSystem.validateForm(n,{firmenname:{type:"text",minLength:2,required:!0},invoice_email:{type:"email"}});if(!a.isValid){this.showValidationErrors(a.errors);return}const r=await window.dataService.createEntity("unternehmen",n);if(r.success){if(r.id)try{const{RelationTables:i}=await B(async()=>{const{RelationTables:o}=await Promise.resolve().then(()=>V);return{RelationTables:o}},void 0);await new i().handleRelationTables("unternehmen",r.id,n,e),console.log("✅ Junction Table-Verknüpfungen verarbeitet")}catch(i){console.error("❌ Fehler beim Verarbeiten der Junction Tables:",i)}this.showSuccessMessage("Unternehmen erfolgreich erstellt!"),setTimeout(()=>{window.navigateTo("/unternehmen")},1500)}else throw new Error(r.error||"Unbekannter Fehler")}catch(e){console.error("❌ Formular-Submit Fehler:",e),this.showErrorMessage(e.message)}}showValidationErrors(e){document.querySelectorAll(".field-error").forEach(t=>t.remove()),Object.entries(e).forEach(([t,n])=>{const a=document.querySelector(`[name="${t}"]`);if(a){const r=document.createElement("div");r.className="field-error",r.textContent=n,a.parentNode.appendChild(r)}})}showSuccessMessage(e){const t=document.createElement("div");t.className="alert alert-success",t.textContent=e;const n=document.getElementById("unternehmen-form");n&&n.parentNode.insertBefore(t,n)}showErrorMessage(e){const t=document.createElement("div");t.className="alert alert-error",t.textContent=e;const n=document.getElementById("unternehmen-form");n&&n.parentNode.insertBefore(t,n)}updateSelectAllCheckbox(){const e=document.getElementById("select-all-unternehmen"),t=document.querySelectorAll(".unternehmen-check");if(!e||t.length===0)return;const n=document.querySelectorAll(".unternehmen-check:checked"),a=n.length===t.length,r=n.length>0;e.checked=a,e.indeterminate=r&&!a,console.log(`🔧 Select-All Status: ${a?"Alle":r?"Teilweise":"Keine"} (${n.length}/${t.length})`)}deselectAll(){this.selectedUnternehmen.clear(),document.querySelectorAll(".unternehmen-check").forEach(n=>{n.checked=!1});const t=document.getElementById("select-all-unternehmen");t&&(t.checked=!1,t.indeterminate=!1),this.updateSelection(),console.log("✅ Alle Unternehmen-Auswahlen aufgehoben")}showDeleteSelectedConfirmation(){const e=this.selectedUnternehmen.size;if(e===0){alert("Keine Unternehmen ausgewählt.");return}const t=e===1?"Möchten Sie das ausgewählte Unternehmen wirklich löschen?":`Möchten Sie die ${e} ausgewählten Unternehmen wirklich löschen?`;confirm(`${t}

Dieser Vorgang kann nicht rückgängig gemacht werden.`)&&this.deleteSelectedUnternehmen()}async deleteSelectedUnternehmen(){const e=Array.from(this.selectedUnternehmen),t=e.length;console.log(`🗑️ Lösche ${t} Unternehmen...`);let n=0,a=0;const r=[];for(const s of e)try{const o=await window.dataService.deleteEntity("unternehmen",s);o.success?(n++,console.log(`✅ Unternehmen ${s} gelöscht`)):(a++,r.push(`Unternehmen ${s}: ${o.error}`),console.error(`❌ Fehler beim Löschen von Unternehmen ${s}:`,o.error))}catch(o){a++,r.push(`Unternehmen ${s}: ${o.message}`),console.error(`❌ Unerwarteter Fehler beim Löschen von Unternehmen ${s}:`,o)}let i="";n>0&&(i+=`✅ ${n} Unternehmen erfolgreich gelöscht.`),a>0&&(i+=`
❌ ${a} Unternehmen konnten nicht gelöscht werden.`,r.length>0&&(i+=`

Fehler:
${r.join(`
`)}`)),alert(i),this.deselectAll(),await this.loadAndRender(),window.dispatchEvent(new CustomEvent("entityUpdated",{detail:{entity:"unternehmen",action:"bulk-deleted",count:n}}))}}const W=new Ne;class Re{constructor(){this.formData={},this.selectedBranches=[],this.allBranches=[]}async init(){if(console.log("🎯 UNTERNEHMENCREATE: Initialisiere Unternehmen-Erstellungsseite mit FormSystem"),window.moduleRegistry?.currentModule!==this){console.log("⚠️ UNTERNEHMENCREATE: Nicht mehr das aktuelle Modul, breche ab");return}try{this.showCreateForm(),console.log("✅ UNTERNEHMENCREATE: Initialisierung abgeschlossen")}catch(e){console.error("❌ UNTERNEHMENCREATE: Fehler bei der Initialisierung:",e),window.ErrorHandler.handle(e,"UnternehmenCreate.init")}}async loadBranches(){console.log("🔄 UNTERNEHMENCREATE: Lade Branchen...");const{data:e,error:t}=await window.supabase.from("branchen").select("*").order("name");if(t)throw new Error(`Fehler beim Laden der Branchen: ${t.message}`);this.allBranches=e,console.log("✅ UNTERNEHMENCREATE: Branchen geladen:",e.length)}render(){window.setHeadline("Neues Unternehmen anlegen"),window.setContentSafely(`
      <div class="create-page">
        <div class="create-container">
          <div class="create-header">
            <h1>Neues Unternehmen anlegen</h1>
            <p>Erstellen Sie ein neues Unternehmen mit allen relevanten Informationen.</p>
          </div>

          <form id="unternehmen-create-form" class="create-form">
            <!-- Grundinformationen -->
            <div class="form-section">
              <h2 class="section-title">Grundinformationen</h2>
              
              <div class="form-row">
                <div class="form-group">
                  <label for="firmenname" class="form-label required">Firmenname</label>
                  <input 
                    type="text" 
                    id="firmenname" 
                    name="firmenname" 
                    class="form-input" 
                    placeholder="Firmenname eingeben..."
                    required
                  >
                  <div class="form-error" id="firmenname-error"></div>
                </div>

                <div class="form-group">
                  <label for="webseite" class="form-label">Webseite</label>
                  <input 
                    type="url" 
                    id="webseite" 
                    name="webseite" 
                    class="form-input" 
                    placeholder="https://www.beispiel.de"
                  >
                  <div class="form-error" id="webseite-error"></div>
                </div>
              </div>

              <div class="form-row">
                <div class="form-group">
                  <label for="branche" class="form-label">Branchen</label>
                  <div class="multi-select-container">
                    <div class="selected-items" id="selected-branches"></div>
                    <div class="input-with-clear">
                      <input 
                        type="text" 
                        id="branche-input" 
                        class="form-input auto-suggest-input" 
                        placeholder="Branche suchen und hinzufügen..."
                      >
                      <button type="button" class="clear-input-btn" id="clear-branche-input" title="Eingabe löschen">
                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor">
                          <path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    </div>
                    <div class="auto-suggest-dropdown" id="branche-dropdown"></div>
                  </div>
                  <div class="form-help">Mehrere Branchen können ausgewählt werden</div>
                </div>

                <div class="form-group">
                  <label for="status" class="form-label">Status</label>
                  <select id="status" name="status" class="form-select">
                    <option value="">Status auswählen...</option>
                    <option value="aktiv">Aktiv</option>
                    <option value="inaktiv">Inaktiv</option>
                    <option value="prospekt">Prospekt</option>
                  </select>
                </div>
              </div>

              <div class="form-row">
                <div class="form-group">
                  <label for="auftragtype" class="form-label">Auftragstyp</label>
                  <select id="auftragtype" name="auftragtype" class="form-select">
                    <option value="">Auftragstyp auswählen...</option>
                    <option value="einmalig">Einmalig</option>
                    <option value="wiederkehrend">Wiederkehrend</option>
                    <option value="projekt">Projekt</option>
                  </select>
                </div>

                <div class="form-group">
                  <label for="invoice_email" class="form-label">Rechnungs-E-Mail</label>
                  <input 
                    type="email" 
                    id="invoice_email" 
                    name="invoice_email" 
                    class="form-input" 
                    placeholder="rechnung@unternehmen.de"
                  >
                  <div class="form-error" id="invoice_email-error"></div>
                </div>
              </div>
            </div>

            <!-- Rechnungsadresse -->
            <div class="form-section">
              <h2 class="section-title">Rechnungsadresse</h2>
              
              <div class="form-row">
                <div class="form-group">
                  <label for="rechnungsadresse_strasse" class="form-label">Straße</label>
                  <input 
                    type="text" 
                    id="rechnungsadresse_strasse" 
                    name="rechnungsadresse_strasse" 
                    class="form-input" 
                    placeholder="Straßenname"
                  >
                </div>

                <div class="form-group form-group-small">
                  <label for="rechnungsadresse_hausnummer" class="form-label">Hausnummer</label>
                  <input 
                    type="text" 
                    id="rechnungsadresse_hausnummer" 
                    name="rechnungsadresse_hausnummer" 
                    class="form-input" 
                    placeholder="123a"
                  >
                </div>
              </div>

              <div class="form-row">
                <div class="form-group form-group-small">
                  <label for="rechnungsadresse_plz" class="form-label">PLZ</label>
                  <input 
                    type="text" 
                    id="rechnungsadresse_plz" 
                    name="rechnungsadresse_plz" 
                    class="form-input" 
                    placeholder="12345"
                  >
                </div>

                <div class="form-group">
                  <label for="rechnungsadresse_stadt" class="form-label">Stadt</label>
                  <input 
                    type="text" 
                    id="rechnungsadresse_stadt" 
                    name="rechnungsadresse_stadt" 
                    class="form-input" 
                    placeholder="Stadtname"
                  >
                </div>

                <div class="form-group">
                  <label for="rechnungsadresse_land" class="form-label">Land</label>
                  <input 
                    type="text" 
                    id="rechnungsadresse_land" 
                    name="rechnungsadresse_land" 
                    class="form-input" 
                    placeholder="Deutschland"
                    value="Deutschland"
                  >
                </div>
              </div>
            </div>

            <!-- Aktionen -->
            <div class="form-actions">
              <button type="button" id="btn-cancel" class="btn btn-secondary">
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor">
                  <path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
                Abbrechen
              </button>
              
              <button type="submit" id="btn-save" class="btn btn-primary">
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor">
                  <path stroke-linecap="round" stroke-linejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                </svg>
                Unternehmen anlegen
              </button>
            </div>
          </form>
        </div>
      </div>
    `)}bindEvents(){document.getElementById("unternehmen-create-form").addEventListener("submit",e=>{e.preventDefault(),this.handleSubmit()}),document.getElementById("btn-cancel").addEventListener("click",()=>{window.navigateTo("/unternehmen")}),document.getElementById("clear-branche-input").addEventListener("click",()=>{const e=document.getElementById("branche-input"),t=document.getElementById("branche-dropdown");e.value="",t.style.display="none",e.focus()}),this.setupBrancheAutoSuggest()}setupBrancheAutoSuggest(){const e=document.getElementById("branche-input"),t=document.getElementById("branche-dropdown");console.log("🔧 UNTERNEHMENCREATE: Setup Auto-Suggest, Branchen verfügbar:",this.allBranches.length),e.addEventListener("input",n=>{const a=n.target.value.toLowerCase().trim();if(console.log("🔍 UNTERNEHMENCREATE: Suche nach:",a),a.length<2){t.style.display="none";return}const r=this.allBranches.filter(i=>i.name.toLowerCase().includes(a)&&!this.selectedBranches.some(s=>s.id===i.id));console.log("📋 UNTERNEHMENCREATE: Gefilterte Branchen:",r.length),this.renderBrancheDropdown(r)}),e.addEventListener("focus",()=>{e.value.length>=2&&(t.style.display="block")}),document.addEventListener("click",n=>{!e.contains(n.target)&&!t.contains(n.target)&&(t.style.display="none")})}renderBrancheDropdown(e){const t=document.getElementById("branche-dropdown");e.length===0?t.innerHTML='<div class="dropdown-item no-results">Keine Branchen gefunden</div>':(t.innerHTML=e.map(n=>`
        <div class="dropdown-item" data-branch-id="${n.id}">
          <span class="branch-name">${n.name}</span>
          ${n.beschreibung?`<span class="branch-description">${n.beschreibung}</span>`:""}
        </div>
      `).join(""),t.querySelectorAll(".dropdown-item").forEach(n=>{n.classList.contains("no-results")||n.addEventListener("click",()=>{const a=n.dataset.branchId,r=e.find(i=>i.id===a);this.addBranch(r)})})),t.style.display="block"}addBranch(e){this.selectedBranches.some(t=>t.id===e.id)||(this.selectedBranches.push(e),this.renderSelectedBranches(),document.getElementById("branche-input").value="",document.getElementById("branche-dropdown").style.display="none")}removeBranch(e){this.selectedBranches=this.selectedBranches.filter(t=>t.id!==e),this.renderSelectedBranches()}renderSelectedBranches(){const e=document.getElementById("selected-branches");if(this.selectedBranches.length===0){e.innerHTML="";return}e.innerHTML=this.selectedBranches.map(t=>`
      <div class="selected-item" data-branch-id="${t.id}">
        <span class="item-name">${t.name}</span>
        <button type="button" class="remove-item" data-branch-id="${t.id}">
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>
    `).join(""),e.querySelectorAll(".remove-item").forEach(t=>{t.addEventListener("click",n=>{n.preventDefault();const a=t.dataset.branchId;this.removeBranch(a)})})}collectFormData(){const e=new FormData(document.getElementById("unternehmen-create-form")),t={};for(let[n,a]of e.entries())t[n]=a.trim();return this.selectedBranches.length>0&&(t.branche_id=this.selectedBranches[0].id),t}validateForm(e){const t={};return e.firmenname||(t.firmenname="Firmenname ist erforderlich"),e.invoice_email&&!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e.invoice_email)&&(t.invoice_email="Bitte geben Sie eine gültige E-Mail-Adresse ein"),e.webseite&&!/^https?:\/\/.+/.test(e.webseite)&&(t.webseite="Bitte geben Sie eine gültige URL ein (z.B. https://www.beispiel.de)"),t}showValidationErrors(e){document.querySelectorAll(".form-error").forEach(t=>t.textContent=""),document.querySelectorAll(".form-input, .form-select").forEach(t=>t.classList.remove("error")),Object.keys(e).forEach(t=>{const n=document.getElementById(`${t}-error`),a=document.getElementById(t);n&&(n.textContent=e[t]),a&&a.classList.add("error")})}async handleSubmit(){try{const e=document.getElementById("btn-save"),t=e.innerHTML;e.innerHTML='<div class="loading-spinner"></div> Wird angelegt...',e.disabled=!0;const n=this.collectFormData(),a=this.validateForm(n);if(Object.keys(a).length>0){this.showValidationErrors(a),e.innerHTML=t,e.disabled=!1;return}const{data:r,error:i}=await window.supabase.from("unternehmen").insert([n]).select().single();if(i)throw i;console.log("✅ UNTERNEHMENCREATE: Unternehmen erstellt:",r),window.dispatchEvent(new CustomEvent("entityCreated",{detail:{entity:"unternehmen",data:r}})),window.showNotification("Unternehmen wurde erfolgreich angelegt!","success"),window.navigateTo(`/unternehmen/${r.id}`)}catch(e){console.error("❌ UNTERNEHMENCREATE: Fehler beim Anlegen:",e),window.showNotification("Fehler beim Anlegen des Unternehmens: "+e.message,"error");const t=document.getElementById("btn-save");t.innerHTML=originalText,t.disabled=!1}}showCreateForm(){console.log("🎯 UNTERNEHMENCREATE: Zeige Unternehmen-Erstellungsformular mit FormSystem"),window.setHeadline("Neues Unternehmen anlegen");const e=window.formSystem.renderFormOnly("unternehmen");window.content.innerHTML=`
      <div class="page-header">
        <div class="page-header-left">
          <h1>Neues Unternehmen anlegen</h1>
          <p>Erstellen Sie ein neues Unternehmen für das CRM</p>
        </div>
        <div class="page-header-right">
          <button onclick="window.navigateTo('/unternehmen')" class="secondary-btn">Zurück zur Übersicht</button>
        </div>
      </div>
      
      <div class="form-page">
        ${e}
      </div>
    `,window.formSystem.bindFormEvents("unternehmen",null);const t=document.getElementById("unternehmen-form");t&&(t.onsubmit=async n=>{n.preventDefault(),await this.handleFormSubmit()})}async handleFormSubmit(){try{console.log("🎯 UNTERNEHMENCREATE: Verarbeite Formular-Submit");const e=document.querySelector('#unternehmen-form button[type="submit"]'),t=e.innerHTML;e.innerHTML='<div class="loading-spinner"></div> Wird angelegt...',e.disabled=!0;const n=document.getElementById("unternehmen-form"),a=new FormData(n),r={},i={},s=n.querySelectorAll('select[data-tag-based="true"]');console.log("🏷️ Tag-basierte Selects gefunden:",s.length),s.forEach(c=>{let d=n.querySelector(`select[name="${c.name}"][style*="display: none"]`);if(!d){const u=n.querySelectorAll(`select[name="${c.name}"]`);u.length>1&&(d=u[1])}if(d){const u=Array.from(d.selectedOptions).map(h=>h.value).filter(h=>h!=="");u.length>0&&(i[c.name]=u,console.log(`🏷️ Tag-basiertes Multi-Select ${c.name}:`,u))}});for(let[c,d]of a.entries())if(!i.hasOwnProperty(c))if(c.includes("[]")){const u=c.replace("[]","");i[u]||(i[u]=[]),i[u].push(d),console.log(`📤 Multi-Select Array ${u}: ${d}`)}else i[c]?(Array.isArray(i[c])||(i[c]=[i[c]]),i[c].push(d)):i[c]=d;for(let[c,d]of Object.entries(i))r[c]=Array.isArray(d)?d:d.trim();r.branche_id&&Array.isArray(r.branche_id)&&console.log("✅ branche_id Array für Junction Table:",r.branche_id),console.log("📋 UNTERNEHMENCREATE: Formular-Daten gesammelt:",r);const o=await window.dataService.createEntity("unternehmen",r);if(!o.success)throw new Error(o.error||"Unbekannter Fehler beim Erstellen");const l=o.data;if(console.log("✅ UNTERNEHMENCREATE: Unternehmen erstellt:",l),o.id)try{const{RelationTables:c}=await B(async()=>{const{RelationTables:u}=await Promise.resolve().then(()=>V);return{RelationTables:u}},void 0);await new c().handleRelationTables("unternehmen",o.id,r,n),console.log("✅ Junction Table-Verknüpfungen verarbeitet")}catch(c){console.error("❌ Fehler beim Verarbeiten der Junction Tables:",c)}window.dispatchEvent(new CustomEvent("entityCreated",{detail:{entity:"unternehmen",data:l}})),window.showNotification("Unternehmen wurde erfolgreich angelegt!","success"),window.navigateTo(`/unternehmen/${l.id}`)}catch(e){console.error("❌ UNTERNEHMENCREATE: Fehler beim Anlegen:",e),window.showNotification("Fehler beim Anlegen des Unternehmens: "+e.message,"error");const t=document.querySelector('#unternehmen-form button[type="submit"]');t&&(t.innerHTML=originalText,t.disabled=!1)}}async getBranchenNamen(e){try{const{data:t,error:n}=await window.supabase.from("branchen").select("id, name").in("id",e);return n?(console.error("❌ Fehler beim Laden der Branche-Namen:",n),e):e.map(a=>{const r=t.find(i=>i.id===a);return r?r.name:a})}catch(t){return console.error("❌ Fehler beim Laden der Branche-Namen:",t),e}}destroy(){console.log("🗑️ UNTERNEHMENCREATE: Destroy aufgerufen"),window.setContentSafely(""),console.log("✅ UNTERNEHMENCREATE: Destroy abgeschlossen")}}const Y=new Re;class Ke{constructor(){this.selectedAuftraege=new Set,this._boundEventListeners=new Set,this.boundFilterResetHandler=null}async init(){console.log("📋 AUFTRAGLIST: Initialisiere Auftrags-Liste");try{window.bulkActionSystem?.registerList("auftrag",this),await this.loadAndRender(),this.bindEvents(),console.log("✅ AUFTRAGLIST: Initialisierung abgeschlossen")}catch(e){console.error("❌ AUFTRAGLIST: Fehler bei der Initialisierung:",e),window.ErrorHandler.handle(e,"AuftragList.init")}}async loadAndRender(){console.log("🔄 AUFTRAGLIST: Lade und rendere Aufträge");try{const e=await window.dataService.loadFilterData("auftrag");console.log("✅ AUFTRAGLIST: Filter-Daten geladen:",e),await this.render(e),console.log("✅ AUFTRAGLIST: Content gesetzt"),await this.initializeFilterBar(),console.log("🔍 AUFTRAGLIST: Lade Aufträge mit Beziehungen");const t=await this.loadAuftraegeWithRelations();console.log("📊 AUFTRAGLIST: Aufträge mit Beziehungen geladen:",t.length,t),this.updateTable(t),console.log("✅ AUFTRAGLIST: Tabelle aktualisiert")}catch(e){console.error("❌ AUFTRAGLIST: Fehler beim Laden und Rendern:",e),window.ErrorHandler.handle(e,"AuftragList.loadAndRender")}}async render(e){window.setHeadline("Aufträge"),window.setContentSafely(window.content,`
      <div class="page-header">
        <div class="page-header-left">
          <h1>Aufträge</h1>
          <p>Verwalten Sie alle Aufträge und Projekte</p>
        </div>
        <div class="page-header-right">
          <button id="btn-auftrag-new" class="primary-btn">
            <i class="icon-plus"></i>
            Neuen Auftrag anlegen
          </button>
        </div>
      </div>

      <div class="content-section">
        <!-- Filter-Bar -->
        <div class="filter-bar">
          <div class="filter-left">
            <div id="filter-container"></div>
          </div>
          <div class="filter-right">
            <button id="btn-filter-reset" class="secondary-btn" style="display:none;">Filter zurücksetzen</button>
          </div>
        </div>

        <div class="table-actions">
          <div class="table-actions-left">
            <button id="btn-select-all" class="secondary-btn">Alle auswählen</button>
            <button id="btn-deselect-all" class="secondary-btn" style="display:none;">Auswahl aufheben</button>
          </div>
          <div class="table-actions-right">
            <span id="selected-count" style="display:none;">0 ausgewählt</span>
            <button id="btn-delete-selected" class="danger-btn" style="display:none;">Ausgewählte löschen</button>
          </div>
        </div>

        <!-- Daten-Tabelle -->
        <div class="data-table-container">
          <table class="data-table">
            <thead>
              <tr>
                <th>
                  <input type="checkbox" id="select-all-auftraege">
                </th>
                <th>Auftragsname</th>
                <th>Unternehmen</th>
                <th>Marke</th>
                <th>PO</th>
                <th>RE. Nr</th>
                <th>RE-Fälligkeit</th>
                <th>Art der Kampagne</th>
                <th>Start</th>
                <th>Ende</th>
                <th>Kampagnenanzahl</th>
                <th>Videos Gesamt</th>
                <th>Bruttobetrag</th>
                <th>Nettobetrag</th>
                <th>Creator Budget</th>
                <th>Deckungsbeitrag (%)</th>
                <th>Deckungsbeitrag (€)</th>
                <th>Budgetverteilung</th>
                <th>Rechnung gestellt</th>
                <th>Überwiesen</th>
                <th>Status</th>
                <th>Mitarbeiter</th>
                <th>Aktionen</th>
              </tr>
            </thead>
            <tbody id="auftraege-table-body">
              <tr>
                <td colspan="10" class="loading">Lade Aufträge...</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    `)}async loadAuftraegeWithRelations(){try{if(!window.supabase)return console.warn("⚠️ Supabase nicht verfügbar - verwende Mock-Daten"),await window.dataService.loadEntities("auftrag");const{data:e,error:t}=await window.supabase.from("auftrag").select(`
          *,
          unternehmen:unternehmen_id(firmenname),
          marke:marke_id(markenname)
        `).order("created_at",{ascending:!1});if(t)throw console.error("❌ Fehler beim Laden der Aufträge mit Beziehungen:",t),t;const n=e.map(a=>({...a,unternehmen:a.unternehmen?{firmenname:a.unternehmen.firmenname}:null,marke:a.marke?{markenname:a.marke.markenname}:null}));return console.log("✅ Aufträge mit Beziehungen geladen:",n),console.log("🔍 Debug - Erster Auftrag:",n[0]),n}catch(e){return console.error("❌ Fehler beim Laden der Aufträge mit Beziehungen:",e),await window.dataService.loadEntities("auftrag")}}async initializeFilterBar(){const e=document.getElementById("filter-container");e&&await _.renderFilterBar("auftrag",e,t=>this.onFiltersApplied(t),()=>this.onFiltersReset())}onFiltersApplied(e){console.log("🔍 AUFTRAGLIST: Filter angewendet:",e),_.applyFilters("auftrag",e),this.loadAndRender()}onFiltersReset(){console.log("🔄 AUFTRAGLIST: Filter zurückgesetzt"),_.resetFilters("auftrag"),this.loadAndRender()}bindEvents(){this.boundFilterResetHandler=e=>{e.target.id==="btn-filter-reset"&&this.onFiltersReset()},document.addEventListener("click",this.boundFilterResetHandler),document.addEventListener("click",e=>{(e.target.id==="btn-auftrag-new"||e.target.id==="btn-auftrag-new-filter")&&(e.preventDefault(),window.navigateTo("/auftrag/new"))}),document.addEventListener("click",e=>{if(e.target.id==="btn-select-all"){e.preventDefault(),document.querySelectorAll(".auftrag-check").forEach(a=>{a.checked=!0,a.dataset.id&&this.selectedAuftraege.add(a.dataset.id)});const n=document.getElementById("select-all-auftraege");n&&(n.indeterminate=!1,n.checked=!0),this.updateSelection()}}),document.addEventListener("click",e=>{if(e.target.id==="btn-deselect-all"){e.preventDefault(),document.querySelectorAll(".auftrag-check").forEach(a=>{a.checked=!1}),this.selectedAuftraege.clear();const n=document.getElementById("select-all-auftraege");n&&(n.indeterminate=!1,n.checked=!1),this.updateSelection()}}),document.addEventListener("click",e=>{if(e.target.classList.contains("table-link")&&e.target.dataset.table==="auftrag"){e.preventDefault();const t=e.target.dataset.id;console.log("🎯 AUFTRAGLIST: Navigiere zu Auftrag Details:",t),window.navigateTo(`/auftrag/${t}`)}}),window.addEventListener("entityUpdated",e=>{e.detail.entity==="auftrag"&&this.loadAndRender()}),document.addEventListener("click",e=>{if(e.target.classList.contains("tag-x")){e.preventDefault(),e.stopPropagation();const n=e.target.closest(".filter-tag").dataset.key,a=window.filterSystem.getFilters("auftrag");delete a[n],window.filterSystem.applyFilters("auftrag",a),this.loadAndRender()}}),document.addEventListener("change",e=>{e.target.id==="select-all-auftraege"&&(document.querySelectorAll(".auftrag-check").forEach(n=>{n.checked=e.target.checked,e.target.checked?this.selectedAuftraege.add(n.dataset.id):this.selectedAuftraege.delete(n.dataset.id)}),this.updateSelection())}),document.addEventListener("change",e=>{e.target.classList.contains("auftrag-check")&&(e.target.checked?this.selectedAuftraege.add(e.target.dataset.id):this.selectedAuftraege.delete(e.target.dataset.id),this.updateSelection())})}hasActiveFilters(){const e=window.filterSystem.getFilters("auftrag");return Object.keys(e).length>0}updateSelection(){const e=this.selectedAuftraege.size,t=document.getElementById("selected-count"),n=document.getElementById("btn-deselect-all"),a=document.getElementById("btn-delete-selected");t&&(t.textContent=`${e} ausgewählt`,t.style.display=e>0?"inline":"none"),n&&(n.style.display=e>0?"inline-block":"none"),a&&(a.style.display=e>0?"inline-block":"none")}updateTable(e){const t=document.querySelector(".data-table tbody");if(!t)return;if(!e||e.length===0){t.innerHTML=`
        <tr>
          <td colspan="20" class="no-data">
            <div style="text-align: center; padding: 40px 20px;">
              <div style="font-size: 48px; color: #ccc; margin-bottom: 16px;">📋</div>
              <h3 style="color: #666; margin-bottom: 8px;">Keine Aufträge vorhanden</h3>
              <p style="color: #999; margin-bottom: 20px;">Es wurden noch keine Aufträge erstellt.</p>
              <button id="btn-create-first-auftrag" class="primary-btn">
                Ersten Auftrag anlegen
              </button>
            </div>
          </td>
        </tr>
      `;const a=document.getElementById("btn-create-first-auftrag");a&&a.addEventListener("click",r=>{r.preventDefault(),window.navigateTo("/auftrag/new")});return}const n=e.map(a=>{const r=c=>c?new Intl.NumberFormat("de-DE",{style:"currency",currency:"EUR"}).format(c):"-",i=c=>c?new Date(c).toLocaleDateString("de-DE"):"-",s=c=>c&&Array.isArray(c)?c.join(", "):"-",o=c=>c?"✅":"❌",l=c=>c?"👤":"-";return`
        <tr data-id="${a.id}">
          <td><input type="checkbox" class="auftrag-check" data-id="${a.id}"></td>
          <td>
            <a href="#" class="table-link" data-table="auftrag" data-id="${a.id}">
              ${window.validatorSystem.sanitizeHtml(a.auftragsname||"Unbekannt")}
            </a>
          </td>
          <td>${a.unternehmen?.firmenname||"-"}</td>
          <td>${a.marke?.markenname||"-"}</td>
          <td>${a.po||"-"}</td>
          <td>${a.re_nr||"-"}</td>
          <td>${i(a.re_faelligkeit)}</td>
          <td>${s(a.art_der_kampagne)}</td>
          <td>${i(a.start)}</td>
          <td>${i(a.ende)}</td>
          <td>${a.kampagnenanzahl||"-"}</td>
          <td>${a.gesamtanzahl_videos||"-"}</td>
          <td>${r(a.bruttobetrag)}</td>
          <td>${r(a.nettobetrag)}</td>
          <td>${r(a.creator_budget)}</td>
          <td>${a.deckungsbeitrag_prozent?a.deckungsbeitrag_prozent+"%":"-"}</td>
          <td>${r(a.deckungsbeitrag_betrag)}</td>
          <td>${a.budgetverteilung?a.budgetverteilung.substring(0,20)+(a.budgetverteilung.length>20?"...":""):"-"}</td>
          <td>${o(a.rechnung_gestellt)}</td>
          <td>${o(a.ueberwiesen)}</td>
          <td>
            <span class="status-badge status-${a.status?.toLowerCase()||"unknown"}">
              ${a.status||"-"}
            </span>
          </td>
          <td>${l(a.assignee_id)}</td>
          <td>
            <div class="actions-dropdown-container" data-entity-type="auftrag">
              <button class="actions-toggle" aria-expanded="false" aria-label="Aktionen">
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" class="w-5 h-5">
                  <path d="M10 3a1.5 1.5 0 110 3 1.5 1.5 0 010-3zM10 8.5a1.5 1.5 0 110 3 1.5 1.5 0 010-3zM11.5 15.5a1.5 1.5 0 10-3 0 1.5 1.5 0 003 0z" />
                </svg>
              </button>
              <div class="actions-dropdown">
                <a href="#" class="action-item" data-action="view" data-id="${a.id}">
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" class="w-5 h-5">
                    <path d="M10 12.5a2.5 2.5 0 100-5 2.5 2.5 0 000 5z" />
                    <path fill-rule="evenodd" d="M.661 10c1.743-2.372 4.761-5 9.339-5 4.578 0 7.601 2.628 9.339 5-1.738 2.372-4.761 5-9.339 5-4.578 0-7.601-2.628-9.339-5zM10 15a5 5 0 100-10 5 5 0 000 10z" clip-rule="evenodd" />
                  </svg>
                  Details anzeigen
                </a>
                <a href="#" class="action-item" data-action="edit" data-id="${a.id}">
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" class="w-5 h-5">
                    <path d="M5.433 13.917l-1.523 1.523a.75.75 0 001.06 1.06l1.523-1.523L5.433 13.917zM11.206 6.106L13.917 3.4a.75.75 0 011.06 1.06l-2.711 2.711-.693-.693z" />
                    <path fill-rule="evenodd" d="M1.334 10.606a1.5 1.5 0 011.06-1.06l10.38-10.38a1.5 1.5 0 012.122 0l1.523 1.523a1.5 1.5 0 010 2.122l-10.38 10.38a1.5 1.5 0 01-1.06 1.06H1.334v-3.182z" clip-rule="evenodd" />
                  </svg>
                  Bearbeiten
                </a>
                <a href="#" class="action-item" data-action="notiz" data-id="${a.id}">
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" class="w-5 h-5">
                    <path fill-rule="evenodd" d="M18 10c0 3.866-3.582 7-8 7a8.841 8.841 0 01-4.083-.98L2 17l1.336-3.117C2.688 12.31 2 11.104 2 10c0-3.866 3.582-7 8-7s8 3.134 8 7zM7 9H5v2h2V9zm8 0h-2v2h2V9zM9 9h2v2H9V9z" clip-rule="evenodd" />
                  </svg>
                  Notiz hinzufügen
                </a>
                
                <a href="#" class="action-item" data-action="rechnung" data-id="${a.id}">
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="size-6">
                    <path stroke-linecap="round" stroke-linejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m0 11.625h4.5m-4.5 2.25h4.5m2.121 1.527c-1.171 1.464-3.07 1.464-4.242 0-1.172-1.465-1.172-3.84 0-5.304 1.171-1.464 3.07-1.464 4.242 0M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Z" />
                  </svg>
                  Rechnung anlegen
                </a>
                <div class="action-separator"></div>
                <a href="#" class="action-item action-danger" data-action="delete" data-id="${a.id}">
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" class="w-5 h-5">
                    <path fill-rule="evenodd" d="M8.75 1A2.75 2.75 0 006 3.75v.443c-.795.077-1.584.176-2.368.298a.75.75 0 10.232 1.482l.175-.027c.572-.089 1.14-.19 1.706-.302A3.75 3.75 0 019.75 3h.5a3.75 3.75 0 013.657 3.234c.566.112 1.134.213 1.706.302l.175.027a.75.75 0 10.232-1.482A41.203 41.203 0 0014 4.193V3.75A2.75 2.75 0 0011.25 1h-2.5zM2.5 7.75a.75.75 0 01.75-.75h13.5a.75.75 0 010 1.5H3.25a.75.75 0 01-.75-.75zM7.25 9.75a.75.75 0 01.75-.75h4.5a.75.75 0 010 1.5H8a.75.75 0 01-.75-.75zM6 12.25a.75.75 0 01.75-.75h6.5a.75.75 0 010 1.5H6.75a.75.75 0 01-.75-.75zM4.75 14.75a.75.75 0 01.75-.75h9.5a.75.75 0 010 1.5h-9.5a.75.75 0 01-.75-.75z" clip-rule="evenodd" />
                  </svg>
                  Löschen
                </a>
              </div>
            </div>
          </td>
        </tr>
      `}).join("");t.innerHTML=n}destroy(){console.log("AuftragList: Cleaning up..."),this._boundEventListeners.forEach(({element:e,type:t,handler:n})=>{e.removeEventListener(t,n)}),this._boundEventListeners.clear(),this.boundFilterResetHandler&&(document.removeEventListener("click",this.boundFilterResetHandler),this.boundFilterResetHandler=null)}showCreateForm(){console.log("🎯 Zeige Auftrag-Erstellungsformular"),window.setHeadline("Neuen Auftrag anlegen");const e=window.formSystem.renderFormOnly("auftrag");window.content.innerHTML=`
      <div class="page-header">
        <div class="page-header-left">
          <h1>Neuen Auftrag anlegen</h1>
          <p>Erstellen Sie einen neuen Auftrag für das CRM</p>
        </div>
        <div class="page-header-right">
          <button onclick="window.navigateTo('/auftrag')" class="secondary-btn">Zurück zur Übersicht</button>
        </div>
      </div>
      
      <div class="form-page">
        ${e}
      </div>
    `,window.formSystem.bindFormEvents("auftrag",null);const t=document.getElementById("auftrag-form");t&&(t.onsubmit=async n=>{n.preventDefault(),await this.handleFormSubmit()})}async handleFormSubmit(){try{const e=document.getElementById("auftrag-form"),t=new FormData(e),n={};for(const[i,s]of t.entries())if(i.includes("[]")){const o=i.replace("[]","");n[o]||(n[o]=[]),n[o].push(s)}else n[i]=s;const a=window.validatorSystem.validateForm(n,{auftragsname:{type:"text",minLength:2,required:!0},unternehmen_id:{type:"uuid",required:!0},gesamt_budget:{type:"number",min:0},creator_budget:{type:"number",min:0},kampagnenanzahl:{type:"number",min:1}});if(!a.isValid){this.showValidationErrors(a.errors);return}const r=await window.dataService.createEntity("auftrag",n);if(r.success)this.showSuccessMessage("Auftrag erfolgreich erstellt!"),setTimeout(()=>{window.navigateTo("/auftrag")},1500);else throw new Error(r.error||"Unbekannter Fehler")}catch(e){console.error("❌ Formular-Submit Fehler:",e),this.showErrorMessage(e.message)}}showValidationErrors(e){console.log("❌ Validierungsfehler:",e),document.querySelectorAll(".validation-error").forEach(t=>t.remove()),Object.keys(e).forEach(t=>{const n=document.querySelector(`[name="${t}"]`);if(n){const a=document.createElement("div");a.className="validation-error",a.textContent=e[t],a.style.color="#dc3545",a.style.fontSize="0.875rem",a.style.marginTop="0.25rem",n.parentNode.appendChild(a),n.style.borderColor="#dc3545"}})}showSuccessMessage(e){const t=document.createElement("div");t.className="alert alert-success",t.textContent=e,t.style.cssText=`
      background: #d4edda;
      color: #155724;
      padding: 1rem;
      border-radius: 4px;
      margin-bottom: 1rem;
      border: 1px solid #c3e6cb;
    `;const n=document.querySelector(".form-page");n&&n.insertBefore(t,n.firstChild)}showErrorMessage(e){const t=document.createElement("div");t.className="alert alert-danger",t.textContent=e,t.style.cssText=`
      background: #f8d7da;
      color: #721c24;
      padding: 1rem;
      border-radius: 4px;
      margin-bottom: 1rem;
      border: 1px solid #f5c6cb;
    `;const n=document.querySelector(".form-page");n&&n.insertBefore(t,n.firstChild)}showDeleteSelectedConfirmation(){const e=this.selectedAuftraege.size;if(console.log(`🔧 AuftragList: showDeleteSelectedConfirmation aufgerufen, selectedCount: ${e}`,Array.from(this.selectedAuftraege)),e===0){alert("Keine Aufträge ausgewählt.");return}const t=e===1?"Möchten Sie den ausgewählten Auftrag wirklich löschen?":`Möchten Sie die ${e} ausgewählten Aufträge wirklich löschen?`;confirm(`${t}

Dieser Vorgang kann nicht rückgängig gemacht werden.`)&&this.deleteSelectedAuftraege()}async deleteSelectedAuftraege(){const e=Array.from(this.selectedAuftraege),t=e.length;console.log(`🗑️ Lösche ${t} Aufträge...`);let n=0,a=0;const r=[];for(const i of e)try{const s=await window.dataService.deleteEntity("auftrag",i);s.success?(n++,r.push(i),this.selectedAuftraege.delete(i)):(a++,console.error(`❌ Fehler beim Löschen von Auftrag ${i}:`,s.error))}catch(s){a++,console.error(`❌ Fehler beim Löschen von Auftrag ${i}:`,s)}if(n>0){const i=n===1?"Auftrag erfolgreich gelöscht.":`${n} Aufträge erfolgreich gelöscht.`;a>0?alert(`${i}
${a} Aufträge konnten nicht gelöscht werden.`):alert(i),r.forEach(o=>{const l=document.querySelector(`tr[data-id="${o}"]`);l&&l.remove()}),this.selectedAuftraege.clear(),this.updateSelection(),this.updateSelectAllCheckbox();const s=document.getElementById("auftraege-table-body");s&&s.children.length===0&&await this.loadAndRender(),window.dispatchEvent(new CustomEvent("entityUpdated",{detail:{entity:"auftrag",action:"bulk-deleted",count:n}}))}else alert("Keine Aufträge konnten gelöscht werden.")}}const J=new Ke;class qe{constructor(){this.formData={}}async init(){console.log("🎯 MARKECREATE: Initialisiere Marke-Erstellung"),this.showCreateForm()}showCreateForm(){console.log("🎯 MARKECREATE: Zeige Marke-Erstellungsformular mit FormSystem"),window.setHeadline("Neue Marke anlegen");const e=window.formSystem.renderFormOnly("marke");window.content.innerHTML=`
      <div class="page-header">
        <div class="page-header-left">
          <h1>Neue Marke anlegen</h1>
          <p>Erstellen Sie eine neue Marke für das CRM</p>
        </div>
        <div class="page-header-right">
          <button onclick="window.navigateTo('/marke')" class="secondary-btn">Zurück zur Übersicht</button>
        </div>
      </div>
      
      <div class="form-page">
        ${e}
      </div>
    `,window.formSystem.bindFormEvents("marke",null);const t=document.getElementById("marke-form");t&&(t.onsubmit=async n=>{n.preventDefault(),await this.handleFormSubmit()})}async handleFormSubmit(){try{console.log("🎯 MARKECREATE: Verarbeite Formular-Submit");const e=document.querySelector('#marke-form button[type="submit"]');let t="Marke anlegen";e&&(t=e.innerHTML,e.innerHTML='<div class="loading-spinner"></div> Wird angelegt...',e.disabled=!0);const n=document.getElementById("marke-form"),a=new FormData(n),r={},i={},s=n.querySelectorAll('select[data-tag-based="true"]');console.log("🏷️ Tag-basierte Selects gefunden:",s.length),s.forEach(c=>{let d=n.querySelector(`select[name="${c.name}"][style*="display: none"]`);if(!d){const u=n.querySelectorAll(`select[name="${c.name}"]`);u.length>1&&(d=u[1])}if(d){const u=Array.from(d.selectedOptions).map(h=>h.value).filter(h=>h!=="");u.length>0&&(i[c.name]=u,console.log(`🏷️ Tag-basiertes Multi-Select ${c.name}:`,u))}});for(let[c,d]of a.entries())if(!i.hasOwnProperty(c))if(c.includes("[]")){const u=c.replace("[]","");i[u]||(i[u]=[]),i[u].push(d)}else i[c]?(Array.isArray(i[c])||(i[c]=[i[c]]),i[c].push(d)):i[c]=d;for(let[c,d]of Object.entries(i))r[c]=Array.isArray(d)?d:d.trim();console.log("📤 Finale Marke-Daten:",r);const o=window.validatorSystem.validateForm(r,{markenname:{type:"text",minLength:2,required:!0}});if(!o.isValid){this.showValidationErrors(o.errors);return}const l=await window.dataService.createEntity("marke",r);if(l.success)this.showSuccessMessage("Marke erfolgreich erstellt!"),setTimeout(()=>{window.navigateTo("/marke")},1500);else throw new Error(l.error||"Fehler beim Erstellen der Marke")}catch(e){console.error("❌ Fehler beim Erstellen der Marke:",e),this.showErrorMessage(e.message||"Ein unerwarteter Fehler ist aufgetreten")}finally{const e=document.querySelector('#marke-form button[type="submit"]');e&&(e.innerHTML=originalText,e.disabled=!1)}}showValidationErrors(e){document.querySelectorAll(".field-error").forEach(t=>t.remove());for(const[t,n]of Object.entries(e)){const a=document.querySelector(`[name="${t}"]`);if(a){const r=document.createElement("div");r.className="field-error",r.textContent=n,r.style.color="red",r.style.fontSize="12px",r.style.marginTop="4px",a.parentNode.appendChild(r)}}}showSuccessMessage(e){const t=document.createElement("div");t.className="toast success",t.textContent=e,t.style.cssText=`
      position: fixed;
      top: 20px;
      right: 20px;
      background: #10b981;
      color: white;
      padding: 12px 20px;
      border-radius: 6px;
      z-index: 1000;
      opacity: 0;
      transition: opacity 0.3s ease;
    `,document.body.appendChild(t),setTimeout(()=>t.style.opacity="1",100),setTimeout(()=>{t.style.opacity="0",setTimeout(()=>t.remove(),300)},3e3)}showErrorMessage(e){const t=document.createElement("div");t.className="toast error",t.textContent=e,t.style.cssText=`
      position: fixed;
      top: 20px;
      right: 20px;
      background: #ef4444;
      color: white;
      padding: 12px 20px;
      border-radius: 6px;
      z-index: 1000;
      opacity: 0;
      transition: opacity 0.3s ease;
    `,document.body.appendChild(t),setTimeout(()=>t.style.opacity="1",100),setTimeout(()=>{t.style.opacity="0",setTimeout(()=>t.remove(),300)},3e3)}destroy(){console.log("🎯 MARKECREATE: Destroy")}}const U=new qe;class He{constructor(){this.selectedMarken=new Set,this._boundEventListeners=new Set}async init(){if(console.log("🎯 MARKELLIST: Initialisiere Marken-Liste"),window.moduleRegistry?.currentModule!==this){console.log("⚠️ MARKELLIST: Nicht mehr das aktuelle Modul, breche ab");return}window.setHeadline("Marken Übersicht"),window.bulkActionSystem?.registerList("marke",this);const e=window.canViewPage&&window.canViewPage("marke")||await window.checkUserPermission("marke","can_view");if(console.log("🔐 MARKELLIST: Berechtigung für marke.can_view:",e),!e){console.log("❌ MARKELLIST: Keine Berechtigung für Marken"),window.content.innerHTML=`
        <div class="error-message">
          <p>Sie haben keine Berechtigung, Marken anzuzeigen.</p>
        </div>
      `;return}console.log("✅ MARKELLIST: Berechtigung OK, lade Marken..."),this.bindEvents(),await this.loadAndRender(),console.log("✅ MARKELLIST: Initialisierung abgeschlossen")}async loadAndRender(){try{const e=await window.dataService.loadFilterData("marke");await this.render(e);const t=_.getFilters("marke");console.log("🔍 Lade Marken mit Filter:",t);const n=await this.loadMarkenWithRelations(t);console.log("📊 Marken geladen:",n?.length||0),this.updateTable(n)}catch(e){window.ErrorHandler.handle(e,"MarkeList.loadAndRender")}}async loadMarkenWithRelations(e={}){try{if(!window.supabase)return console.warn("⚠️ Supabase nicht verfügbar - verwende Mock-Daten"),await window.dataService.loadEntities("marke",e);const t=window.currentUser?.rolle==="admin";let n=[];if(console.log("🔍 MARKELIST: Sichtbarkeits-Check:",{currentUser:window.currentUser?.name,rolle:window.currentUser?.rolle,isAdmin:t,userId:window.currentUser?.id}),!t)try{const{data:o,error:l}=await window.supabase.from("marke_mitarbeiter").select("marke_id").eq("mitarbeiter_id",window.currentUser?.id);l&&console.error("❌ MARKELIST: Fehler beim Laden der Zuordnungen:",l),n=(o||[]).map(c=>c.marke_id).filter(Boolean),console.log("🔍 MARKELIST: Zugeordnete Marken für Nicht-Admin:",{assignedMarken:o,allowedMarkeIds:n})}catch(o){console.error("❌ MARKELIST: Exception beim Laden der Zuordnungen:",o)}let a=window.supabase.from("marke").select(`
          *,
          unternehmen:unternehmen_id(id, firmenname),
          branchen:marke_branchen(branche:branche_id(id, name)),
          ansprechpartner:ansprechpartner_marke(ansprechpartner:ansprechpartner_id(id, vorname, nachname, email)),
          mitarbeiter:marke_mitarbeiter(mitarbeiter:mitarbeiter_id(id, name))
        `).order("created_at",{ascending:!1});if(t)console.log("✅ MARKELIST: Admin-Benutzer - alle Marken werden geladen");else if(n.length>0)a=a.in("id",n),console.log("🔍 MARKELIST: Query eingeschränkt auf Marken-IDs:",n);else return console.log("⚠️ MARKELIST: Keine zugeordneten Marken - leeres Ergebnis"),[];if(e){const o=(l,c,d="string")=>{c==null||c===""||c==="[object Object]"||(d==="string"?a=a.ilike(l,`%${c}%`):(d==="exact"||d==="uuid")&&(a=a.eq(l,c)))};o("markenname",e.markenname),o("unternehmen_id",e.unternehmen_id,"uuid"),o("branche_id",e.branche_id,"uuid")}const{data:r,error:i}=await a;if(i)throw console.error("❌ Fehler beim Laden der Marken mit Beziehungen:",i),i;const s=(r||[]).map(o=>({...o,branchen:(o.branchen||[]).map(l=>l.branche).filter(Boolean),ansprechpartner:(o.ansprechpartner||[]).map(l=>l.ansprechpartner).filter(Boolean),mitarbeiter:(o.mitarbeiter||[]).map(l=>l.mitarbeiter).filter(Boolean)}));return console.log("✅ Marken mit Beziehungen geladen:",s.length),s}catch(t){return console.error("❌ Fehler beim Laden der Marken:",t),await window.dataService.loadEntities("marke",e)}}async render(e){const t=window.currentUser?.permissions?.marke?.can_edit||!1,n=_.getFilters("marke");Object.entries(n).forEach(([i,s])=>{});let a=`<div class="filter-bar">
      <div class="filter-left">
        <div id="filter-container"></div>
      </div>
      <div class="filter-right">
        <button id="btn-filter-reset" class="secondary-btn" style="display:${this.hasActiveFilters()?"inline-block":"none"};">Filter zurücksetzen</button>
      </div>
    </div>`,r=`
      <div class="page-header">
        <div class="page-header-left">
          <h1>Marken</h1>
          <p>Verwalten Sie alle Marken und deren Eigenschaften</p>
        </div>
        <div class="page-header-right">
          ${t?'<button id="btn-marke-new" class="primary-btn">Neue Marke anlegen</button>':""}
        </div>
      </div>

      ${a}

      <div class="table-actions">
        <div class="table-actions-left">
          <button id="btn-select-all" class="secondary-btn">Alle auswählen</button>
          <button id="btn-deselect-all" class="secondary-btn" style="display:none;">Auswahl aufheben</button>
        </div>
        <div class="table-actions-right">
          <span id="selected-count" style="display:none;">0 ausgewählt</span>
          <button id="btn-delete-selected" class="danger-btn" style="display:none;">Ausgewählte löschen</button>
        </div>
      </div>

      <div class="table-container">
        <table class="data-table">
          <thead>
            <tr>
              <th><input type="checkbox" id="select-all-marken"></th>
              <th>Markenname</th>
              <th>Unternehmen</th>
              <th>Branche</th>
              <th>Webseite</th>
              <th>Ansprechpartner</th>
              <th>Zuständigkeit</th>
              <th>Aktionen</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td colspan="8" class="no-data">Lade Marken...</td>
            </tr>
          </tbody>
        </table>
      </div>
    `;window.setContentSafely(window.content,r),await this.initializeFilterBar()}async initializeFilterBar(){const e=document.getElementById("filter-container");e&&await _.renderFilterBar("marke",e,t=>this.onFiltersApplied(t),()=>this.onFiltersReset())}onFiltersApplied(e){console.log("Filter angewendet:",e),_.applyFilters("marke",e),this.loadAndRender()}onFiltersReset(){console.log("Filter zurückgesetzt"),_.resetFilters("marke"),this.loadAndRender()}bindEvents(){this.boundFilterResetHandler=e=>{e.target.id==="btn-filter-reset"&&this.onFiltersReset()},document.addEventListener("click",this.boundFilterResetHandler),document.addEventListener("click",e=>{(e.target.id==="btn-marke-new"||e.target.id==="btn-marke-new-filter")&&(e.preventDefault(),window.navigateTo("/marke/new"))}),document.addEventListener("click",e=>{if(e.target.classList.contains("table-link")&&e.target.dataset.table==="marke"){e.preventDefault();const t=e.target.dataset.id;console.log("🎯 MARKELIST: Navigiere zu Marken Details:",t),window.navigateTo(`/marke/${t}`)}}),document.addEventListener("click",e=>{if(e.target.id==="btn-select-all"){e.preventDefault(),document.querySelectorAll(".marke-check").forEach(a=>{a.checked=!0,a.dataset.id&&this.selectedMarken.add(a.dataset.id)});const n=document.getElementById("select-all-marken");n&&(n.indeterminate=!1,n.checked=!0),this.updateSelection()}}),document.addEventListener("click",e=>{if(e.target.id==="btn-deselect-all"){e.preventDefault(),document.querySelectorAll(".marke-check").forEach(a=>{a.checked=!1}),this.selectedMarken.clear();const n=document.getElementById("select-all-marken");n&&(n.indeterminate=!1,n.checked=!1),this.updateSelection()}}),window.addEventListener("entityUpdated",e=>{e.detail.entity==="marke"&&this.loadAndRender()}),document.addEventListener("click",e=>{if(e.target.classList.contains("tag-x")){e.preventDefault(),e.stopPropagation();const n=e.target.closest(".filter-tag").dataset.key,a=_.getFilters("marke");delete a[n],_.applyFilters("marke",a),this.loadAndRender()}}),document.addEventListener("change",e=>{e.target.id==="select-all-marken"&&(document.querySelectorAll(".marke-check").forEach(n=>{n.checked=e.target.checked,e.target.checked?this.selectedMarken.add(n.dataset.id):this.selectedMarken.delete(n.dataset.id)}),this.updateSelection())}),document.addEventListener("change",e=>{e.target.classList.contains("marke-check")&&(e.target.checked?this.selectedMarken.add(e.target.dataset.id):this.selectedMarken.delete(e.target.dataset.id),this.updateSelection())})}hasActiveFilters(){const e=_.getFilters("marke");return Object.keys(e).length>0}updateSelection(){const e=this.selectedMarken.size,t=document.getElementById("selected-count"),n=document.getElementById("btn-deselect-all"),a=document.getElementById("btn-delete-selected");t&&(t.textContent=`${e} ausgewählt`,t.style.display=e>0?"inline":"none"),n&&(n.style.display=e>0?"inline-block":"none"),a&&(a.style.display=e>0?"inline-block":"none")}async updateTable(e){const t=document.querySelector(".data-table tbody");if(!t)return;if(!e||e.length===0){const{renderEmptyState:a}=await B(async()=>{const{renderEmptyState:r}=await import("./core-C7Vz5Umf.js").then(i=>i.F);return{renderEmptyState:r}},[]);a(t);return}const n=e.map(a=>`
      <tr data-id="${a.id}">
        <td><input type="checkbox" class="marke-check" data-id="${a.id}"></td>
        <td>
          <a href="#" class="table-link" data-table="marke" data-id="${a.id}">
            ${window.validatorSystem.sanitizeHtml(a.markenname||"")}
          </a>
        </td>
        <td>${window.validatorSystem.sanitizeHtml(a.unternehmen?.firmenname||"Kein Unternehmen zugeordnet")}</td>
        <td>${this.renderBranchen(a.branchen)}</td>
        <td>${a.webseite?`<a href="${a.webseite}" target="_blank" class="table-link">${a.webseite}</a>`:"-"}</td>
        <td>${this.renderAnsprechpartner(a.ansprechpartner)}</td>
        <td>${this.renderZustaendigkeit(a.zustaendigkeit,a.mitarbeiter)}</td>
        <td>
          <div class="actions-dropdown-container" data-entity-type="marke">
                          <button class="actions-toggle" aria-expanded="false" aria-label="Aktionen">
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" class="w-5 h-5">
                  <path d="M10 3a1.5 1.5 0 110 3 1.5 1.5 0 010-3zM10 8.5a1.5 1.5 0 110 3 1.5 1.5 0 010-3zM11.5 15.5a1.5 1.5 0 10-3 0 1.5 1.5 0 003 0z" />
                </svg>
              </button>
            <div class="actions-dropdown">
                              <a href="#" class="action-item" data-action="view" data-id="${a.id}">
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" class="w-5 h-5">
                    <path d="M10 12.5a2.5 2.5 0 100-5 2.5 2.5 0 000 5z" />
                    <path fill-rule="evenodd" d="M.661 10c1.743-2.372 4.761-5 9.339-5 4.578 0 7.601 2.628 9.339 5-1.738 2.372-4.761 5-9.339 5-4.578 0-7.601-2.628-9.339-5zM10 15a5 5 0 100-10 5 5 0 000 10z" clip-rule="evenodd" />
                  </svg>
                  Details anzeigen
                </a>
                <a href="#" class="action-item" data-action="edit" data-id="${a.id}">
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" class="w-5 h-5">
                    <path d="M5.433 13.917l-1.523 1.523a.75.75 0 001.06 1.06l1.523-1.523L5.433 13.917zM11.206 6.106L13.917 3.4a.75.75 0 011.06 1.06l-2.711 2.711-.693-.693z" />
                    <path fill-rule="evenodd" d="M1.334 10.606a1.5 1.5 0 011.06-1.06l10.38-10.38a1.5 1.5 0 012.122 0l1.523 1.523a1.5 1.5 0 010 2.122l-10.38 10.38a1.5 1.5 0 01-1.06 1.06H1.334v-3.182z" clip-rule="evenodd" />
                  </svg>
                  Bearbeiten
                </a>
                <div class="action-separator"></div>
                <a href="#" class="action-item" data-action="add_ansprechpartner" data-id="${a.id}">
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="w-5 h-5">
                    <path stroke-linecap="round" stroke-linejoin="round" d="M18 7.5v3m0 0v3m0-3h3m-3 0h-3m-2.25-4.125a3.375 3.375 0 1 1-6.75 0 3.375 3.375 0 0 1 6.75 0ZM3 19.235v-.11a6.375 6.375 0 0 1 12.75 0v.109A12.318 12.318 0 0 1 9.374 21c-2.331 0-4.512-.645-6.374-1.766Z" />
                  </svg>
                  Ansprechpartner hinzufügen
                </a>
                <a href="#" class="action-item" data-action="assign_staff" data-id="${a.id}">
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="w-5 h-5">
                    <path stroke-linecap="round" stroke-linejoin="round" d="M15 19.128a9.38 9.38 0 0 0 2.625.372 9.337 9.337 0 0 0 4.121-.952 4.125 4.125 0 0 0-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 0 1 8.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0 1 11.964-3.07M12 6.375a3.375 3.375 0 1 1-6.75 0 3.375 3.375 0 0 1 6.75 0Zm8.25 2.25a2.625 2.625 0 1 1-5.25 0 2.625 2.625 0 0 1 5.25 0Z" />
                  </svg>
                  Mitarbeiter zuordnen
                </a>
                <a href="#" class="action-item" data-action="notiz" data-id="${a.id}">
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" class="w-5 h-5">
                    <path fill-rule="evenodd" d="M18 10c0 3.866-3.582 7-8 7a8.841 8.841 0 01-4.083-.98L2 17l1.336-3.117C2.688 12.31 2 11.104 2 10c0-3.866 3.582-7 8-7s8 3.134 8 7zM7 9H5v2h2V9zm8 0h-2v2h2V9zM9 9h2v2H9V9z" clip-rule="evenodd" />
                  </svg>
                  Notiz hinzufügen
                </a>
                
                <div class="action-separator"></div>
                <a href="#" class="action-item action-danger" data-action="delete" data-id="${a.id}">
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" class="w-5 h-5">
                    <path fill-rule="evenodd" d="M8.75 1A2.75 2.75 0 006 3.75v.443c-.795.077-1.584.176-2.368.298a.75.75 0 10.232 1.482l.175-.027c.572-.089 1.14-.19 1.706-.302A3.75 3.75 0 019.75 3h.5a3.75 3.75 0 013.657 3.234c.566.112 1.134.213 1.706.302l.175.027a.75.75 0 10.232-1.482A41.203 41.203 0 0014 4.193V3.75A2.75 2.75 0 0011.25 1h-2.5zM2.5 7.75a.75.75 0 01.75-.75h13.5a.75.75 0 010 1.5H3.25a.75.75 0 01-.75-.75zM7.25 9.75a.75.75 0 01.75-.75h4.5a.75.75 0 010 1.5H8a.75.75 0 01-.75-.75zM6 12.25a.75.75 0 01.75-.75h6.5a.75.75 0 010 1.5H6.75a.75.75 0 01-.75-.75zM4.75 14.75a.75.75 0 01.75-.75h9.5a.75.75 0 010 1.5h-9.5a.75.75 0 01-.75-.75z" clip-rule="evenodd" />
                  </svg>
                  Löschen
                </a>
            </div>
          </div>
        </td>
      </tr>
    `).join("");t.innerHTML=n}renderBranchen(e){return!e||e.length===0?"-":`<div class="tags tags-compact">${e.filter(n=>n&&n.name).map(n=>`<span class="tag tag--branche">${n.name}</span>`).join("")}</div>`}renderAnsprechpartner(e){return!e||e.length===0?"-":`<div class="tags tags-compact">${e.filter(n=>n&&n.vorname&&n.nachname).map(n=>`<a href="#" class="tag tag--ansprechpartner" data-action="view-ansprechpartner" data-id="${n.id}" onclick="event.preventDefault(); window.navigateTo('/ansprechpartner/${n.id}')">${n.vorname} ${n.nachname}</a>`).join("")}</div>`}renderZustaendigkeit(e,t){if(t&&t.length>0){const n=t.filter(i=>i&&i.name).slice(0,3).map(i=>`<span class="tag tag--mitarbeiter" title="${i.name}">${i.name}</span>`).join(""),a=t.length>3?t.length-3:0,r=a>0?`<span class="tag tag--more" title="Weitere ${a} Mitarbeiter">+${a}</span>`:"";return`<div class="tags tags-compact" title="${t.map(i=>i.name).join(", ")}">${n}${r}</div>`}return!e||e.length===0?"-":Array.isArray(e)?`<span class="text-muted">${e.map(a=>a.mitarbeiter?.name||"Unbekannt").join(", ")}</span>`:`<span class="text-muted">${e.mitarbeiter?.name||"Unbekannt"}</span>`}destroy(){console.log("🗑️ MARKELLIST: Destroy aufgerufen"),this._boundEventListeners.forEach(({element:e,type:t,handler:n})=>{e.removeEventListener(t,n)}),this._boundEventListeners.clear(),this.boundFilterResetHandler&&(document.removeEventListener("click",this.boundFilterResetHandler),this.boundFilterResetHandler=null),window.setContentSafely(""),console.log("✅ MARKELLIST: Destroy abgeschlossen")}showDeleteSelectedConfirmation(){const e=this.selectedMarken.size;if(console.log(`🔧 MarkeList: showDeleteSelectedConfirmation aufgerufen, selectedCount: ${e}`,Array.from(this.selectedMarken)),e===0){alert("Keine Marken ausgewählt.");return}const t=e===1?"Möchten Sie die ausgewählte Marke wirklich löschen?":`Möchten Sie die ${e} ausgewählten Marken wirklich löschen?`;confirm(`${t}

Dieser Vorgang kann nicht rückgängig gemacht werden.`)&&this.deleteSelectedMarken()}async deleteSelectedMarken(){const e=Array.from(this.selectedMarken),t=e.length;console.log(`🗑️ Lösche ${t} Marken...`);let n=0,a=0;const r=[];for(const i of e)try{const s=await window.dataService.deleteEntity("marke",i);s.success?(n++,r.push(i),this.selectedMarken.delete(i)):(a++,console.error(`❌ Fehler beim Löschen von Marke ${i}:`,s.error))}catch(s){a++,console.error(`❌ Fehler beim Löschen von Marke ${i}:`,s)}if(n>0){const i=n===1?"Marke erfolgreich gelöscht.":`${n} Marken erfolgreich gelöscht.`;a>0?alert(`${i}
${a} Marken konnten nicht gelöscht werden.`):alert(i),r.forEach(o=>{const l=document.querySelector(`tr[data-id="${o}"]`);l&&l.remove()}),this.selectedMarken.clear(),this.updateSelection(),this.updateSelectAllCheckbox();const s=document.getElementById("marken-table-body");s&&s.children.length===0&&await this.loadAndRender(),window.dispatchEvent(new CustomEvent("entityUpdated",{detail:{entity:"marke",action:"bulk-deleted",count:n}}))}else alert("Keine Marken konnten gelöscht werden.")}showCreateForm(){console.log("🎯 Zeige Marken-Erstellungsformular mit MarkeCreate"),U.showCreateForm()}}const Q=new He;class Ue{constructor(){this.markeId=null,this.marke=null,this.notizen=[],this.ratings=[],this.kampagnen=[],this.auftraege=[],this.ansprechpartner=[],this.rechnungen=[]}async init(e){console.log("🎯 MARKENDETAIL: Initialisiere Marken-Detailseite für ID:",e);try{this.markeId=e,await this.loadMarkeData(),this.render(),this.bindEvents(),console.log("✅ MARKENDETAIL: Initialisierung abgeschlossen")}catch(t){console.error("❌ MARKENDETAIL: Fehler bei der Initialisierung:",t),window.ErrorHandler.handle(t,"MarkeDetail.init")}}async loadMarkeData(){console.log("🔄 MARKENDETAIL: Lade Marken-Daten...");try{const{data:e,error:t}=await window.supabase.from("marke").select(`
          *,
          unternehmen:unternehmen_id(firmenname),
          branche:branche_id(name)
        `).eq("id",this.markeId).single();if(t)throw t;this.marke=e,console.log("✅ MARKENDETAIL: Marken-Basisdaten geladen:",this.marke);try{const{data:l,error:c}=await window.supabase.from("marke_branchen").select(`
            branche_id,
            branche:branche_id(name)
          `).eq("marke_id",this.markeId);!c&&l&&l.length>0?(this.marke.branchen=l.map(d=>d.branche),console.log("✅ MARKENDETAIL: Branchen aus Junction Table geladen:",this.marke.branchen)):(this.marke.branchen=[],console.log("ℹ️ MARKENDETAIL: Keine Branchen in Junction Table gefunden"))}catch(l){console.warn("⚠️ MARKENDETAIL: Fehler beim Laden der Branchen:",l),this.marke.branchen=[]}window.notizenSystem&&(this.notizen=await window.notizenSystem.loadNotizen("marke",this.markeId),console.log("✅ MARKENDETAIL: Notizen geladen:",this.notizen.length)),window.bewertungsSystem&&(this.ratings=await window.bewertungsSystem.loadBewertungen("marke",this.markeId),console.log("✅ MARKENDETAIL: Ratings geladen:",this.ratings.length));const{data:n,error:a}=await window.supabase.from("kampagne").select("*").eq("marke_id",this.markeId);a||(this.kampagnen=n||[],console.log("✅ MARKENDETAIL: Kampagnen geladen:",this.kampagnen.length));const{data:r,error:i}=await window.supabase.from("auftrag").select("*").eq("marke_id",this.markeId);i||(this.auftraege=r||[],console.log("✅ MARKENDETAIL: Aufträge geladen:",this.auftraege.length));try{const l=(this.auftraege||[]).map(c=>c.id).filter(Boolean);if(l.length>0){const{data:c}=await window.supabase.from("rechnung").select("id, rechnung_nr, status, nettobetrag, bruttobetrag, gestellt_am, zahlungsziel, bezahlt_am, pdf_url, auftrag_id").in("auftrag_id",l);this.rechnungen=c||[]}else this.rechnungen=[]}catch{this.rechnungen=[]}const{data:s,error:o}=await window.supabase.from("ansprechpartner_marke").select(`
          ansprechpartner_id,
          ansprechpartner:ansprechpartner(*)
        `).eq("marke_id",this.markeId);o||(this.ansprechpartner=s?.map(l=>l.ansprechpartner)||[],console.log("✅ MARKENDETAIL: Ansprechpartner geladen:",this.ansprechpartner.length))}catch(e){throw console.error("❌ MARKENDETAIL: Fehler beim Laden der Marken-Daten:",e),e}}render(){window.setHeadline(`${this.marke?.markenname||"Marke"} - Details`);const e=`
      <div class="page-header">
        <div class="page-header-left">
          <h1>${this.marke?.markenname||"Marke"} - Details</h1>
          <p>Detaillierte Informationen zur Marke</p>
        </div>
        <div class="page-header-right">
          <button id="btn-edit-marke" class="secondary-btn">
            <i class="icon-edit"></i>
            Marke bearbeiten
          </button>
          <button onclick="window.navigateTo('/marke')" class="secondary-btn">
            Zurück zur Übersicht
          </button>
        </div>
      </div>

      <div class="content-section">
        <!-- Tab-Navigation -->
        <div class="tab-navigation">
          <button class="tab-button active" data-tab="informationen">
            Informationen
            <span class="tab-count">1</span>
          </button>
          <button class="tab-button" data-tab="notizen">
            Notizen
            <span class="tab-count">${this.notizen.length}</span>
          </button>
          <button class="tab-button" data-tab="bewertungen">
            Bewertungen
            <span class="tab-count">${this.ratings.length}</span>
          </button>
          <button class="tab-button" data-tab="kampagnen">
            Kampagnen
            <span class="tab-count">${this.kampagnen.length}</span>
          </button>
          <button class="tab-button" data-tab="auftraege">
            Aufträge
            <span class="tab-count">${this.auftraege.length}</span>
          </button>
          <button class="tab-button" data-tab="ansprechpartner">
            Ansprechpartner
            <span class="tab-count">${this.ansprechpartner.length}</span>
          </button>
          <button class="tab-button" data-tab="rechnungen">
            Rechnungen
            <span class="tab-count">${this.rechnungen.length}</span>
          </button>
        </div>

        <!-- Tab-Content -->
        <div class="tab-content">
          <!-- Informationen Tab -->
          <div class="tab-pane active" id="informationen">
            ${this.renderInformationen()}
          </div>

          <!-- Notizen Tab -->
          <div class="tab-pane" id="notizen">
            ${this.renderNotizen()}
          </div>

          <!-- Bewertungen Tab -->
          <div class="tab-pane" id="bewertungen">
            ${this.renderRatings()}
          </div>

          <!-- Kampagnen Tab -->
          <div class="tab-pane" id="kampagnen">
            ${this.renderKampagnen()}
          </div>

          <!-- Aufträge Tab -->
          <div class="tab-pane" id="auftraege">
            ${this.renderAuftraege()}
          </div>

          <!-- Ansprechpartner Tab -->
          <div class="tab-pane" id="ansprechpartner">
            ${this.renderAnsprechpartner()}
          </div>
          <div class="tab-pane" id="rechnungen">
            ${this.renderRechnungen()}
          </div>
        </div>
      </div>
    `;window.setContentSafely(window.content,e)}renderInformationen(){return`
      <div class="detail-section">
        <div class="detail-grid">
          <div class="detail-card">
            <h3>Marken-Informationen</h3>
            <div class="detail-item">
              <label>Markenname:</label>
              <span>${this.marke?.markenname||"-"}</span>
            </div>
            <div class="detail-item">
              <label>Unternehmen:</label>
              <span>${this.marke?.unternehmen?.firmenname||"-"}</span>
            </div>
            <div class="detail-item">
              <label>Webseite:</label>
              <span>
                ${this.marke?.webseite?`<a href="${this.marke.webseite}" target="_blank">${this.marke.webseite}</a>`:"-"}
              </span>
            </div>
            <div class="detail-item">
              <label>Branchen:</label>
              <span>${this.renderBranchen()}</span>
            </div>
            <div class="detail-item">
              <label>Erstellt am:</label>
              <span>${this.marke?.created_at?new Date(this.marke.created_at).toLocaleDateString("de-DE"):"-"}</span>
            </div>
            <div class="detail-item">
              <label>Zuletzt aktualisiert:</label>
              <span>${this.marke?.updated_at?new Date(this.marke.updated_at).toLocaleDateString("de-DE"):"-"}</span>
            </div>
          </div>
        </div>
      </div>
    `}renderBranchen(){return!this.marke?.branchen||this.marke.branchen.length===0?"-":`<div class="tags">${this.marke.branchen.filter(t=>t&&t.name).map(t=>`<span class="tag tag--branche">${t.name}</span>`).join("")}</div>`}renderNotizen(){return window.notizenSystem?window.notizenSystem.renderNotizenContainer(this.notizen,"marke",this.markeId):"<p>Notizen-System nicht verfügbar</p>"}renderRatings(){return window.bewertungsSystem?window.bewertungsSystem.renderBewertungenContainer(this.ratings,"marke",this.markeId):"<p>Bewertungs-System nicht verfügbar</p>"}renderKampagnen(){return!this.kampagnen||this.kampagnen.length===0?`
        <div class="empty-state">
          <div class="empty-icon">📢</div>
          <h3>Keine Kampagnen vorhanden</h3>
          <p>Es wurden noch keine Kampagnen für diese Marke erstellt.</p>
        </div>
      `:`
      <div class="kampagnen-container">
        ${this.kampagnen.map(t=>`
      <div class="kampagne-card">
        <div class="kampagne-header">
          <h4>${t.kampagnenname||"Unbekannte Kampagne"}</h4>
          <span class="kampagne-status status-${t.status?.toLowerCase()||"unknown"}">
            ${t.status||"Unbekannt"}
          </span>
        </div>
        <div class="kampagne-details">
          <p><strong>Beschreibung:</strong> ${t.beschreibung||"-"}</p>
          <p><strong>Budget:</strong> ${t.budget?new Intl.NumberFormat("de-DE",{style:"currency",currency:"EUR"}).format(t.budget):"-"}</p>
          <p><strong>Start:</strong> ${t.start?new Date(t.start).toLocaleDateString("de-DE"):"-"}</p>
          <p><strong>Ende:</strong> ${t.ende?new Date(t.ende).toLocaleDateString("de-DE"):"-"}</p>
        </div>
      </div>
    `).join("")}
      </div>
    `}renderAuftraege(){return!this.auftraege||this.auftraege.length===0?`
        <div class="empty-state">
          <div class="empty-icon">📋</div>
          <h3>Keine Aufträge vorhanden</h3>
          <p>Es wurden noch keine Aufträge für diese Marke erstellt.</p>
        </div>
      `:`
      <div class="auftraege-container">
        ${this.auftraege.map(t=>`
      <div class="auftrag-card">
        <div class="auftrag-header">
          <h4>${t.auftragsname||"Unbekannter Auftrag"}</h4>
          <span class="auftrag-status status-${t.status?.toLowerCase()||"unknown"}">
            ${t.status||"Unbekannt"}
          </span>
        </div>
        <div class="auftrag-details">
          <p><strong>Typ:</strong> ${t.auftragtype||"-"}</p>
          <p><strong>Budget:</strong> ${t.gesamt_budget?new Intl.NumberFormat("de-DE",{style:"currency",currency:"EUR"}).format(t.gesamt_budget):"-"}</p>
          <p><strong>Start:</strong> ${t.start?new Date(t.start).toLocaleDateString("de-DE"):"-"}</p>
          <p><strong>Ende:</strong> ${t.ende?new Date(t.ende).toLocaleDateString("de-DE"):"-"}</p>
        </div>
      </div>
    `).join("")}
      </div>
    `}renderAnsprechpartner(){const e=this.ansprechpartner&&this.ansprechpartner.length>0,t=e?"":`
      <div class="empty-state">
        <div class="empty-icon">👥</div>
        <h3>Keine Ansprechpartner vorhanden</h3>
        <p>Es wurden noch keine Ansprechpartner für diese Marke zugeordnet.</p>
      </div>
    `,n=`
      <div class="section-header">
        <h3>Ansprechpartner</h3>
        <button id="btn-add-ansprechpartner" class="primary-btn" data-marke-id="${this.markeId}">
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="w-5 h-5">
            <path stroke-linecap="round" stroke-linejoin="round" d="M18 7.5v3m0 0v3m0-3h3m-3 0h-3m-2.25-4.125a3.375 3.375 0 1 1-6.75 0 3.375 3.375 0 0 1 6.75 0ZM3 19.235v-.11a6.375 6.375 0 0 1 12.75 0v.109A12.318 12.318 0 0 1 9.374 21c-2.331 0-4.512-.645-6.374-1.766Z" />
          </svg>
          Ansprechpartner hinzufügen
        </button>
      </div>
    `;if(!e)return n+t;const a=this.ansprechpartner.map(r=>`
      <div class="ansprechpartner-card">
        <div class="ansprechpartner-header">
          <h4>${r.vorname} ${r.nachname}</h4>
          <span class="ansprechpartner-position">${r.position?.name||"-"}</span>
        </div>
        <div class="ansprechpartner-details">
          <p><strong>Email:</strong> ${r.email?`<a href="mailto:${r.email}">${r.email}</a>`:"-"}</p>
          <p><strong>Telefon (privat):</strong> ${r.telefonnummer?`<a href="tel:${r.telefonnummer}">${r.telefonnummer}</a>`:"-"}</p>
          <p><strong>Telefon (büro):</strong> ${r.telefonnummer_office?`<a href="tel:${r.telefonnummer_office}">${r.telefonnummer_office}</a>`:"-"}</p>
          <p><strong>Unternehmen:</strong> ${r.unternehmen?.firmenname||"-"}</p>
        </div>
      </div>
    `).join("");return`
      ${n}
      <div class="ansprechpartner-container">
        ${a}
      </div>
    `}renderRechnungen(){if(!this.rechnungen||this.rechnungen.length===0)return`
        <div class="empty-state">
          <div class="empty-icon">💶</div>
          <h3>Keine Rechnungen vorhanden</h3>
        </div>
      `;const e=a=>a?new Intl.NumberFormat("de-DE",{style:"currency",currency:"EUR"}).format(a):"-",t=a=>a?new Date(a).toLocaleDateString("de-DE"):"-";return`
      <div class="data-table-container">
        <table class="data-table">
          <thead>
            <tr>
              <th>Rechnungs-Nr</th>
              <th>Status</th>
              <th>Netto</th>
              <th>Brutto</th>
              <th>Gestellt</th>
              <th>Beleg</th>
            </tr>
          </thead>
          <tbody>${this.rechnungen.map(a=>`
      <tr>
        <td><a href="/rechnung/${a.id}" onclick="event.preventDefault(); window.navigateTo('/rechnung/${a.id}')">${window.validatorSystem.sanitizeHtml(a.rechnung_nr||"—")}</a></td>
        <td>${a.status||"-"}</td>
        <td>${e(a.nettobetrag)}</td>
        <td>${e(a.bruttobetrag)}</td>
        <td>${t(a.gestellt_am)}</td>
        <td>${a.pdf_url?`<a href="${a.pdf_url}" target="_blank" rel="noopener">PDF</a>`:"-"}</td>
      </tr>
    `).join("")}</tbody>
        </table>
      </div>
    `}bindEvents(){document.addEventListener("click",e=>{if(e.target.classList.contains("tab-button")){const t=e.target.dataset.tab;this.switchTab(t)}}),document.addEventListener("click",e=>{e.target.id==="btn-edit-marke"&&this.showEditForm()}),document.addEventListener("click",e=>{if(e.target.id==="btn-add-ansprechpartner"){const t=e.target.dataset.markeId||this.markeId;window.actionsDropdown&&window.actionsDropdown.openAddAnsprechpartnerModal(t)}}),document.addEventListener("notizenUpdated",()=>{this.loadMarkeData().then(()=>{this.render(),this.bindEvents()})}),document.addEventListener("bewertungenUpdated",()=>{this.loadMarkeData().then(()=>{this.render(),this.bindEvents()})}),document.addEventListener("entityUpdated",e=>{e.detail?.entity==="ansprechpartner"&&e.detail?.markeId===this.markeId&&(console.log("🔄 MARKEDETAIL: Ansprechpartner wurde aktualisiert, lade Daten neu"),this.loadMarkeData().then(()=>{this.render(),this.bindEvents()}))})}switchTab(e){document.querySelectorAll(".tab-button").forEach(a=>{a.classList.remove("active")}),document.querySelectorAll(".tab-pane").forEach(a=>{a.classList.remove("active")});const t=document.querySelector(`[data-tab="${e}"]`),n=document.getElementById(e);t&&t.classList.add("active"),n&&n.classList.add("active")}async showEditForm(){console.log("🎯 MARKENDETAIL: Zeige Bearbeitungsformular"),window.setHeadline("Marke bearbeiten");const e={...this.marke};e._isEditMode=!0,e._entityId=this.markeId,this.marke.unternehmen_id?(console.log("🏢 MARKENDETAIL: Formatiere Unternehmen-Daten für FormSystem:",this.marke.unternehmen_id),e.unternehmen_id=this.marke.unternehmen_id):(console.log("ℹ️ MARKENDETAIL: Keine Unternehmen-Daten vorhanden für Edit-Modus"),e.unternehmen_id=null);try{const{data:a,error:r}=await window.supabase.from("marke_branchen").select("branche_id").eq("marke_id",this.markeId);if(!r&&a&&a.length>0){const i=a.map(s=>s.branche_id);console.log("🏷️ MARKENDETAIL: Formatiere Branchen-Daten für FormSystem:",i),e.branche_id=i}else console.log("ℹ️ MARKENDETAIL: Keine Branchen-Daten vorhanden für Edit-Modus"),e.branche_id=[]}catch(a){console.warn("⚠️ MARKENDETAIL: Fehler beim Laden der Branchen-Daten:",a),e.branche_id=[]}console.log("📋 MARKENDETAIL: FormData für Rendering:",e);const t=window.formSystem.renderFormOnly("marke",e);window.content.innerHTML=`
      <div class="page-header">
        <div class="page-header-left">
          <h1>Marke bearbeiten</h1>
          <p>Bearbeiten Sie die Marken-Informationen</p>
        </div>
        <div class="page-header-right">
          <button onclick="window.navigateTo('/marke/${this.markeId}')" class="secondary-btn">Abbrechen</button>
        </div>
      </div>
      
      <div class="form-page">
        ${t}
      </div>
    `,window.formSystem.bindFormEvents("marke",e);const n=document.getElementById("marke-form");n&&(n.dataset.isEditMode="true",n.dataset.entityType="marke",n.dataset.entityId=this.markeId,e.unternehmen_id&&(n.dataset.existingUnternehmenId=e.unternehmen_id),e.branche_id&&Array.isArray(e.branche_id)&&e.branche_id.length>0&&(n.dataset.existingBranchenIds=JSON.stringify(e.branche_id)),console.log("📋 MARKENDETAIL: Form-Datasets gesetzt:",{isEditMode:n.dataset.isEditMode,entityType:n.dataset.entityType,entityId:n.dataset.entityId,existingUnternehmenId:n.dataset.existingUnternehmenId,existingBrancheId:n.dataset.existingBrancheId}),n.onsubmit=async a=>{a.preventDefault(),await this.handleEditFormSubmit()})}async handleEditFormSubmit(){try{console.log("🎯 MARKEDETAIL: Verarbeite Formular-Submit");const e=document.getElementById("marke-form"),t=new FormData(e),n={};for(const[s,o]of t.entries())n[s]=o;const a=e.querySelector('select[name="branche_id[]"]');if(a){const s=Array.from(a.selectedOptions).map(o=>o.value).filter(o=>o!=="");s.length>0&&(n["branche_id[]"]=s,console.log("🏷️ MARKEDETAIL: Alle ausgewählten Branchen gesammelt:",s))}console.log("📤 MARKEDETAIL: Submit-Daten für Update:",n);const r=window.validatorSystem.validateForm(n,{markenname:{type:"text",minLength:2,required:!0}});if(!r.isValid){this.showValidationErrors(r.errors);return}const i=await window.dataService.updateEntity("marke",this.markeId,n);if(i.success)this.showSuccessMessage("Marke erfolgreich aktualisiert!"),setTimeout(async()=>{await this.loadMarkeData(),this.render(),this.bindEvents()},1500);else throw new Error(i.error||"Unbekannter Fehler")}catch(e){console.error("❌ Formular-Submit Fehler:",e),this.showErrorMessage(e.message)}}showValidationErrors(e){console.log("❌ Validierungsfehler:",e),document.querySelectorAll(".validation-error").forEach(t=>t.remove()),Object.keys(e).forEach(t=>{const n=document.querySelector(`[name="${t}"]`);if(n){const a=document.createElement("div");a.className="validation-error",a.textContent=e[t],a.style.color="#dc3545",a.style.fontSize="0.875rem",a.style.marginTop="0.25rem",n.parentNode.appendChild(a),n.style.borderColor="#dc3545"}})}showSuccessMessage(e){const t=document.createElement("div");t.className="alert alert-success",t.textContent=e,t.style.cssText=`
      background: #d4edda;
      color: #155724;
      padding: 1rem;
      border-radius: 4px;
      margin-bottom: 1rem;
      border: 1px solid #c3e6cb;
    `;const n=document.querySelector(".form-page");n&&n.insertBefore(t,n.firstChild)}showErrorMessage(e){const t=document.createElement("div");t.className="alert alert-danger",t.textContent=e,t.style.cssText=`
      background: #f8d7da;
      color: #721c24;
      padding: 1rem;
      border-radius: 4px;
      margin-bottom: 1rem;
      border: 1px solid #f5c6cb;
    `;const n=document.querySelector(".form-page");n&&n.insertBefore(t,n.firstChild)}destroy(){console.log("MarkeDetail: Cleaning up...")}}const X=new Ue;class Oe{constructor(){this.currentRoute="/",this.navSections=[{title:"Dashboard",items:[{id:"dashboard",label:"Dashboard",icon:"icon-dashboard",url:"/dashboard"}]},{title:"Unternehmen",items:[{id:"unternehmen",label:"Unternehmen",icon:"icon-building",url:"/unternehmen"},{id:"marke",label:"Marken",icon:"icon-tag",url:"/marke"},{id:"ansprechpartner",label:"Ansprechpartner",icon:"icon-user-circle",url:"/ansprechpartner"},{id:"auftrag",label:"Aufträge",icon:"icon-briefcase",url:"/auftrag"}]},{title:"Projektmanagement",items:[{id:"kampagne",label:"Kampagne",icon:"icon-campaign",url:"/kampagne"},{id:"briefing",label:"Briefing",icon:"icon-document",url:"/briefing"},{id:"kooperation",label:"Kooperation",icon:"icon-handshake",url:"/kooperation"},{id:"rechnung",label:"Rechnung",icon:"icon-currency-euro",url:"/rechnung"}]},{title:"Creator Management",items:[{id:"creator",label:"Creator",icon:"icon-users",url:"/creator"},{id:"creator-lists",label:"Listen",icon:"icon-list",url:"/creator-lists"}]},{title:"Admin",items:[{id:"mitarbeiter",label:"Mitarbeiter",icon:"icon-users",url:"/mitarbeiter"}]}]}renderNavigation(){const e=document.getElementById("main-nav");if(!e){console.error("Navigation-Element nicht gefunden");return}const t=window.currentUser?.permissions||{},n=i=>{if(i==="dashboard")return!0;if(window.canViewPage&&typeof window.canViewPage=="function"){const l=window.canViewPage(i);if(l===!1)return!1;if(l===!0)return!0}const o={dashboard:"dashboard",unternehmen:"unternehmen",marke:"marke",auftrag:"auftrag",ansprechpartner:"ansprechpartner",kampagne:"kampagne",briefing:"briefing",kooperation:"kooperation",rechnung:"rechnung",creator:"creator","creator-lists":"creator",mitarbeiter:"dashboard"}[i]||i;return t?.[o]?.can_view||window.currentUser?.rolle==="admin"},r=`
      <div class="nav-sections">
        ${this.navSections.map(i=>{const s=i.items.filter(o=>n(o.id));return s.length===0?"":`
        <div class="nav-section">
          <h3 class="nav-section-title">${i.title}</h3>
          <ul class="nav-list">
            ${s.map(o=>`
              <li class="nav-item">
                <a href="${o.url}" class="nav-link" data-route="${o.url}">
                  <span class="nav-icon">${this.getIcon(o.icon)}</span>
                  <span class="nav-label">${o.label}</span>
                </a>
              </li>
            `).join("")}
          </ul>
        </div>`}).join("")}
      </div>
    `;e.innerHTML=r,this.bindNavigationEvents()}bindNavigationEvents(){document.querySelectorAll(".nav-link").forEach(t=>{t.addEventListener("click",n=>{n.preventDefault();const a=t.getAttribute("data-route");this.navigateTo(a)})})}navigateTo(e){console.log(`🧭 Navigation zu: ${e}`),this.currentRoute=e,this.updateActiveRoute(e),window.navigateTo?window.navigateTo(e):window.location.hash=e}updateActiveRoute(e){document.querySelectorAll(".nav-link").forEach(n=>{n.getAttribute("data-route")===e?n.classList.add("active"):n.classList.remove("active")})}getIcon(e){return{"icon-dashboard":'<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="M2.25 12l8.954-8.955c.44-.439 1.152-.439 1.591 0L21.75 12M4.5 9.75v10.125c0 .621.504 1.125 1.125 1.125H9.75v-4.875c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21h4.125c.621 0 1.125-.504 1.125-1.125V9.75M8.25 21h7.5" /></svg>',"icon-users":'<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="M15 19.128a9.38 9.38 0 0 0 2.625.372 9.337 9.337 0 0 0 4.121-.952 4.125 4.125 0 0 0-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 0 1 8.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0 1 11.964-3.07M12 6.375a3.375 3.375 0 1 1-6.75 0 3.375 3.375 0 0 1 6.75 0Zm8.25 2.25a2.625 2.625 0 1 1-5.25 0 2.625 2.625 0 0 1 5.25 0Z" /></svg>',"icon-building":'<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="M2.25 21h19.5m-18-18v18m10.5-18v18m6-13.5V21M6.75 6.75h.75m-.75 3h.75m-.75 3h.75m3-6h.75m-.75 3h.75m-.75 3h.75M6.75 21v-3.375c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21M3 3h12m-.75 4.5H21m-3.75 3.75h.008v.008h-.008v-.008Zm0 3h.008v.008h-.008v-.008Zm0 3h.008v.008h-.008v-.008Z" /></svg>',"icon-tag":'<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="M9.568 3H5.25A2.25 2.25 0 003 5.25v4.318c0 .597.237 1.17.659 1.591l9.581 9.581c.699.699 1.78.872 2.607.33a18.095 18.095 0 005.223-5.223c.542-.827.369-1.908-.33-2.607L11.16 3.66A2.25 2.25 0 009.568 3z" /><path stroke-linecap="round" stroke-linejoin="round" d="M6 6h.008v.008H6V6z" /></svg>',"icon-briefcase":'<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Z" /></svg>',"icon-user-circle":'<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="M18 18.72a9.094 9.094 0 0 0 3.741-.479 3 3 0 0 0-4.682-2.72m.94 3.198.001.031c0 .225-.012.447-.037.666A11.944 11.944 0 0 1 12 21c-2.17 0-4.207-.576-5.963-1.584A6.062 6.062 0 0 1 6 18.719m12 0a5.971 5.971 0 0 0-.941-3.197m0 0A5.995 5.995 0 0 0 12 12.75a5.995 5.995 0 0 0-5.058 2.772m0 0a3 3 0 0 0-4.681 2.72 8.986 8.986 0 0 0 3.74.477m.94-3.197a5.971 5.971 0 0 0-.94 3.197M15 6.75a3 3 0 1 1-6 0 3 3 0 0 1 6 0Zm6 3a2.25 2.25 0 1 1-4.5 0 2.25 2.25 0 0 1 4.5 0Zm-13.5 0a2.25 2.25 0 1 1-4.5 0 2.25 2.25 0 0 1 4.5 0Z" /></svg>',"icon-campaign":'<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="M10.34 15.84c-.688-.06-1.386-.09-2.09-.09H7.5a4.5 4.5 0 1 1 0-9h.75c.704 0 1.402-.03 2.09-.09m0 9.18c.253.962.584 1.892.985 2.783.247.55.06 1.21-.463 1.511l-.657.38c-.551.318-1.26.117-1.527-.461a20.845 20.845 0 0 1-1.44-4.282m3.102.069a18.03 18.03 0 0 1-.59-4.59c0-1.586.205-3.124.59-4.59m0 9.18a23.848 23.848 0 0 1 8.835 2.535M10.34 6.66a23.847 23.847 0 0 0 8.835-2.535m0 0A23.74 23.74 0 0 0 18.795 3m.38 1.125a23.91 23.91 0 0 1 1.014 5.395m-1.014 8.855c-.118.38-.245.754-.38 1.125m.38-1.125a23.91 23.91 0 0 0 1.014-5.395m0-3.46c.495.413.811 1.035.811 1.73 0 .695-.316 1.317-.811 1.73m0-3.46a24.347 24.347 0 0 1 0 3.46" /></svg>',"icon-document":'<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Z" /></svg>',"icon-handshake":'<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="M12 21a9.004 9.004 0 0 0 8.716-6.747M12 21a9.004 9.004 0 0 1-8.716-6.747M12 21c2.485 0 4.5-4.03 4.5-9S14.485 3 12 3m0 18c-2.485 0-4.5-4.03-4.5-9S9.515 3 12 3m0 0a8.997 8.997 0 0 1 7.843 4.582M12 3a8.997 8.997 0 0 0-7.843 4.582m15.686 0A11.953 11.953 0 0 1 12 10.5c-2.998 0-5.74-1.1-7.843-2.918m15.686 0A8.959 8.959 0 0 1 21 12c0 .778-.099 1.533-.284 2.253m0 0A17.919 17.919 0 0 1 12 16.5c-3.162 0-6.133-.815-8.716-2.247m0 0A9.015 9.015 0 0 1 3 12c0-1.605.42-3.113 1.157-4.418" /></svg>',"icon-currency-euro":'<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m0 11.625h4.5m-4.5 2.25h4.5m2.121 1.527c-1.171 1.464-3.07 1.464-4.242 0-1.172-1.465-1.172-3.84 0-5.304 1.171-1.464 3.07-1.464 4.242 0M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Z" /></svg>',"icon-list":'<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="M8.25 6.75h12M8.25 12h12m-12 5.25h12M3.75 6.75h.007v.008H3.75V6.75Zm.375 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0ZM3.75 12h.007v.008H3.75V12Zm.375 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0ZM3.75 17.25h.007v.008H3.75v-.008Zm.375 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Z" /></svg>'}[e]||'<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="M12 6v12m-3-2.818.879.659c1.171.879 3.07.879 4.242 0 1.172-.879 1.172-2.303 0-3.182C13.536 12.219 12.768 12 12 12c-.725 0-1.482-.22-2.121-.659-1.106-.879-1.106-2.303 0-3.182s2.9-.879 4.006 0l.415.33M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" /></svg>'}init(){console.log("🧭 NavigationSystem: Initialisiere Navigation"),this.renderNavigation()}destroy(){console.log("🗑️ NavigationSystem: Destroy aufgerufen")}}const ee=new Oe;class Pe{constructor(){this.entities={creator:{table:"creator",displayField:"vorname",fields:{vorname:"string",nachname:"string",instagram:"string",instagram_follower:"number",tiktok:"string",tiktok_follower:"number",telefonnummer:"string",mail:"string",portfolio_link:"string",budget_letzte_buchung:"number",lieferadresse_strasse:"string",lieferadresse_hausnummer:"string",lieferadresse_plz:"string",lieferadresse_stadt:"string",lieferadresse_land:"string",notiz:"string"},relations:{},manyToMany:{sprachen:{table:"sprachen",junctionTable:"creator_sprachen",localKey:"creator_id",foreignKey:"sprache_id",displayField:"name"},branchen:{table:"branchen_creator",junctionTable:"creator_branchen",localKey:"creator_id",foreignKey:"branche_id",displayField:"name"},creator_types:{table:"creator_type",junctionTable:"creator_creator_type",localKey:"creator_id",foreignKey:"creator_type_id",displayField:"name"}},filters:["vorname","nachname"],sortBy:"created_at",sortOrder:"desc"},ansprechpartner:{table:"ansprechpartner",displayField:"vorname",fields:{vorname:"string",nachname:"string",unternehmen_id:"uuid",position_id:"uuid",email:"string",telefonnummer:"string",telefonnummer_office:"string",linkedin:"string",stadt:"string",sprache_id:"uuid",notiz:"string"},relations:{unternehmen:{table:"unternehmen",foreignKey:"unternehmen_id",displayField:"firmenname"},sprache:{table:"sprachen",foreignKey:"sprache_id",displayField:"name"},position:{table:"positionen",foreignKey:"position_id",displayField:"name"}},manyToMany:{marken:{table:"marke",junctionTable:"ansprechpartner_marke",localKey:"ansprechpartner_id",foreignKey:"marke_id",displayField:"markenname"},sprachen:{table:"sprachen",junctionTable:"ansprechpartner_sprache",localKey:"ansprechpartner_id",foreignKey:"sprache_id",displayField:"name"},unternehmen:{table:"unternehmen",junctionTable:"ansprechpartner_unternehmen",localKey:"ansprechpartner_id",foreignKey:"unternehmen_id",displayField:"firmenname"}},filters:["vorname","nachname","position_id","unternehmen_id","stadt","sprache_id"],sortBy:"created_at",sortOrder:"desc"},unternehmen:{table:"unternehmen",displayField:"firmenname",fields:[{name:"firmenname",type:"string"},{name:"branche",type:"string"},{name:"branche_id",type:"uuid",relationTable:"unternehmen_branchen",relationField:"branche_id"},{name:"ansprechpartner",type:"string"},{name:"telefonnummer",type:"string"},{name:"invoice_email",type:"string"},{name:"rechnungsadresse_strasse",type:"string"},{name:"rechnungsadresse_hausnummer",type:"string"},{name:"rechnungsadresse_plz",type:"string"},{name:"rechnungsadresse_stadt",type:"string"},{name:"rechnungsadresse_land",type:"string"},{name:"webseite",type:"string"},{name:"status",type:"string"},{name:"notiz",type:"string"}],relations:{branche:{table:"branchen",foreignKey:"branche_id",displayField:"name"}},manyToMany:{branchen:{table:"branchen",junctionTable:"unternehmen_branchen",localKey:"unternehmen_id",foreignKey:"branche_id",displayField:"name"},ansprechpartner:{table:"ansprechpartner",junctionTable:"ansprechpartner_unternehmen",localKey:"unternehmen_id",foreignKey:"ansprechpartner_id",displayField:"vorname"}},filters:["firmenname","branche_id","status","rechnungsadresse_stadt","rechnungsadresse_land"],sortBy:"created_at",sortOrder:"desc"},kampagne:{table:"kampagne",displayField:"kampagnenname",fields:{kampagnenname:"string",unternehmen_id:"uuid",marke_id:"uuid",auftrag_id:"uuid",ziele:"string",art_der_kampagne:"array",start:"date",deadline:"date",kampagnen_nummer:"number",drehort_typ_id:"uuid",drehort_beschreibung:"string",status_id:"uuid",creatoranzahl:"number",videoanzahl:"number",budget_info:"string"},relations:{unternehmen:{table:"unternehmen",foreignKey:"unternehmen_id",displayField:"firmenname"},marke:{table:"marke",foreignKey:"marke_id",displayField:"markenname"},auftrag:{table:"auftrag",foreignKey:"auftrag_id",displayField:"auftragsname"},drehort_typ:{table:"drehort_typen",foreignKey:"drehort_typ_id",displayField:"name"},status:{table:"kampagne_status",foreignKey:"status_id",displayField:"name"}},manyToMany:{ansprechpartner:{table:"ansprechpartner",junctionTable:"ansprechpartner_kampagne",localKey:"kampagne_id",foreignKey:"ansprechpartner_id",displayField:"id,vorname,nachname,email"}},filters:["kampagnenname","unternehmen_id","marke_id","status_id","art_der_kampagne","start","deadline"],sortBy:"created_at",sortOrder:"desc"},kooperation:{table:"kooperationen",displayField:"id",fields:{name:"string",creator_id:"uuid",kampagne_id:"uuid",unternehmen_id:"uuid",status:"string",status_id:"uuid",content_art:"string",skript_autor:"string",nettobetrag:"number",zusatzkosten:"number",gesamtkosten:"number",vertrag_unterschrieben:"boolean",vertrag_link:"string",videoanzahl:"number",skript_deadline:"date",skript_link:"string",content_deadline:"date",content_link:"string",bewertung:"number",budget:"number",start_datum:"date",end_datum:"date",notiz:"string"},relations:{creator:{table:"creator",foreignKey:"creator_id",displayField:"vorname"},kampagne:{table:"kampagne",foreignKey:"kampagne_id",displayField:"name"}},filters:["creator_id","kampagne_id","status","budget","start_datum","end_datum"],sortBy:"created_at",sortOrder:"desc"},briefing:{table:"briefings",displayField:"product_service_offer",fields:{product_service_offer:"string",produktseite_url:"string",creator_aufgabe:"string",usp:"string",zielgruppe:"string",zieldetails:"string",deadline:"date",dos:"string",donts:"string",rechtlicher_hinweis:"string",unternehmen_id:"uuid",marke_id:"uuid",status:"string",assignee_id:"uuid",kooperation_id:"uuid",created_at:"date",updated_at:"date"},relations:{unternehmen:{table:"unternehmen",foreignKey:"unternehmen_id",displayField:"firmenname"},marke:{table:"marke",foreignKey:"marke_id",displayField:"markenname"},assignee:{table:"benutzer",foreignKey:"assignee_id",displayField:"name"}},filters:["product_service_offer","unternehmen_id","marke_id","status","assignee_id","deadline","created_at"],sortBy:"created_at",sortOrder:"desc"},creator_type:{table:"creator_type",displayField:"name",fields:{name:"string",beschreibung:"string"},filters:["name"],sortBy:"name",sortOrder:"asc"},sprachen:{table:"sprachen",displayField:"name",fields:{name:"string",code:"string"},filters:["name"],sortBy:"name",sortOrder:"asc"},branchen_creator:{table:"branchen_creator",displayField:"name",fields:{name:"string",beschreibung:"string"},filters:["name"],sortBy:"name",sortOrder:"asc"},benutzer:{table:"benutzer",displayField:"name",fields:{name:"string",email:"string",rolle:"string",unterrolle:"string",zugriffsrechte:"json",auth_user_id:"uuid",profile_image_url:"string",mitarbeiter_klasse_id:"uuid"},relations:{mitarbeiter_klasse:{table:"mitarbeiter_klasse",foreignKey:"mitarbeiter_klasse_id",displayField:"name"}}},kampagne_status:{table:"kampagne_status",displayField:"name",fields:{name:"string",beschreibung:"string",sort_order:"number",created_at:"date",updated_at:"date"}},plattform_typen:{table:"plattform_typen",displayField:"name",fields:{name:"string",beschreibung:"string",created_at:"date",updated_at:"date"}},format_typen:{table:"format_typen",displayField:"name",fields:{name:"string",beschreibung:"string",created_at:"date",updated_at:"date"}},marke:{table:"marke",displayField:"markenname",fields:{markenname:"string",unternehmen_id:"uuid",webseite:"string",branche:"string",branche_id:"uuid",created_at:"date",updated_at:"date"},relations:{unternehmen:{table:"unternehmen",foreignKey:"unternehmen_id",displayField:"firmenname"}},manyToMany:{branchen:{table:"branchen",junctionTable:"marke_branchen",localKey:"marke_id",foreignKey:"branche_id",displayField:"name"},ansprechpartner:{table:"ansprechpartner",junctionTable:"ansprechpartner_marke",localKey:"marke_id",foreignKey:"ansprechpartner_id",displayField:"id,vorname,nachname,email"},mitarbeiter:{table:"benutzer",junctionTable:"marke_mitarbeiter",localKey:"marke_id",foreignKey:"mitarbeiter_id",displayField:"name",additionalFields:"created_at,assigned_by"}},filters:["markenname","unternehmen_id","branche_id"],sortBy:"created_at",sortOrder:"desc"},auftrag:{table:"auftrag",displayField:"auftragsname",fields:{auftragsname:"string",unternehmen_id:"uuid",marke_id:"uuid",status:"string",auftragtype:"string",art_der_kampagne:"array",format_anpassung:"array",start:"date",ende:"date",gesamt_budget:"number",ust_prozent:"number",ust_betrag:"number",ksk_betrag:"number",creator_budget:"number",kampagnenanzahl:"number",gesamtanzahl_videos:"number",influencer:"number",ugc:"number",ugc_organic:"number",ugc_paid:"number",ugc_paid_pro:"number",ugc_pro_organic:"number",influencer_preis:"number",ugc_preis:"number",vor_ort_preis:"number",cut_down:"number",vor_ort_produktion:"number",re_faelligkeit:"date",re_nr:"string",po:"string",rechnung_gestellt:"boolean",ueberwiesen:"boolean",bruttobetrag:"number",nettobetrag:"number",deckungsbeitrag_prozent:"number",deckungsbeitrag_betrag:"number",budgetverteilung:"string"},relations:{unternehmen:{table:"unternehmen",foreignKey:"unternehmen_id",displayField:"firmenname"},marke:{table:"marke",foreignKey:"marke_id",displayField:"markenname"}},filters:["auftragsname","status","auftragtype","art_der_kampagne","gesamt_budget","unternehmen_id","marke_id"],sortBy:"created_at",sortOrder:"desc"},rechnung:{table:"rechnung",displayField:"rechnung_nr",fields:{rechnung_nr:"string",kooperation_id:"uuid",kampagne_id:"uuid",creator_id:"uuid",auftrag_id:"uuid",unternehmen_id:"uuid",videoanzahl:"number",nettobetrag:"number",zusatzkosten:"number",bruttobetrag:"number",gestellt_am:"date",zahlungsziel:"date",bezahlt_am:"date",status:"string",geprueft:"boolean",pdf_url:"string",pdf_path:"string",created_at:"date",updated_at:"date"},relations:{unternehmen:{table:"unternehmen",foreignKey:"unternehmen_id",displayField:"firmenname"},auftrag:{table:"auftrag",foreignKey:"auftrag_id",displayField:"auftragsname"},kooperation:{table:"kooperationen",foreignKey:"kooperation_id",displayField:"name"},creator:{table:"creator",foreignKey:"creator_id",displayField:"vorname"},kampagne:{table:"kampagne",foreignKey:"kampagne_id",displayField:"kampagnenname"}},filters:["rechnung_nr","kooperation_id","kampagne_id","unternehmen_id","auftrag_id","status","gestellt_am","zahlungsziel","bezahlt_am","nettobetrag"],sortBy:"created_at",sortOrder:"desc"},creator_list:{table:"creator_list",displayField:"name",fields:{name:"string",beschreibung:"string",created_by:"uuid",created_at:"date",updated_at:"date"},relations:{},filters:["name","created_at"],sortBy:"created_at",sortOrder:"desc"}}}async createEntity(e,t){try{if(console.log(`✅ ${e} erstellt:`,t),!window.supabase||!window.supabase.auth){console.warn("⚠️ Supabase nicht verfügbar - verwende Mock-Daten");const s={id:Date.now().toString(),...t,created_at:new Date().toISOString()},o=JSON.parse(localStorage.getItem("mock_data")||"{}");return o[e]||(o[e]=[]),o[e].push(s),localStorage.setItem("mock_data",JSON.stringify(o)),console.log(`✅ ${e} Mock-Daten gespeichert:`,s),{success:!0,id:s.id,data:s}}const n=this.entities[e];if(!n)throw new Error(`Unbekannte Entität: ${e}`);if(e==="kooperation"&&(!t.content_art||t.content_art===""))try{const s=Object.entries(t).filter(([o,l])=>o.startsWith("video_content_art_")&&l).map(([,o])=>o)[0];s?t.content_art=s:t.content_art="N/A"}catch{t.content_art="N/A"}const a=await this.prepareDataForSupabase(t,n.fields,e),{data:r,error:i}=await window.supabase.from(n.table).insert([a]).select().single();return i?(console.error(`❌ Supabase Fehler beim Erstellen von ${e}:`,i),{success:!1,error:i.message}):(console.log(`✅ ${e} erfolgreich in Supabase erstellt:`,r),await this.handleManyToManyRelations(e,r.id,t),{success:!0,id:r.id,data:r})}catch(n){return console.error(`❌ Fehler beim Erstellen von ${e}:`,n),{success:!1,error:n.message}}}async updateEntity(e,t,n){try{if(console.log(`✅ ${e} aktualisiert:`,t,n),!window.supabase)return console.warn("⚠️ Supabase nicht verfügbar - verwende Mock-Daten"),{success:!0,id:t,data:n};const a=this.entities[e];if(!a)throw new Error(`Unbekannte Entität: ${e}`);const r=await this.prepareDataForSupabase(n,a.fields,e),{data:i,error:s}=await window.supabase.from(a.table).update(r).eq("id",t).select().single();return s?(console.error(`❌ Supabase Fehler beim Aktualisieren von ${e}:`,s),{success:!1,error:s.message}):(console.log(`✅ ${e} erfolgreich in Supabase aktualisiert:`,i),await this.handleManyToManyRelations(e,t,n),{success:!0,id:t,data:i})}catch(a){return console.error(`❌ Fehler beim Aktualisieren von ${e}:`,a),{success:!1,error:a.message}}}async deleteEntity(e,t){try{if(console.log(`✅ ${e} gelöscht:`,t),!window.supabase)return console.warn("⚠️ Supabase nicht verfügbar - verwende Mock-Daten"),{success:!0,id:t};const n=this.entities[e];if(!n)throw new Error(`Unbekannte Entität: ${e}`);const{error:a}=await window.supabase.from(n.table).delete().eq("id",t);return a?(console.error(`❌ Supabase Fehler beim Löschen von ${e}:`,a),{success:!1,error:a.message}):(console.log(`✅ ${e} erfolgreich in Supabase gelöscht:`,t),{success:!0,id:t})}catch(n){return console.error(`❌ Fehler beim Löschen von ${e}:`,n),{success:!1,error:n.message}}}async loadEntities(e,t={}){try{if(!window.supabase||!window.supabase.auth){console.warn("⚠️ Supabase nicht verfügbar - verwende Mock-Daten");const s=JSON.parse(localStorage.getItem("mock_data")||"{}");return s[e]&&s[e].length>0?(console.log(`✅ Mock-Daten für ${e} geladen:`,s[e]),s[e]):this.getMockData(e)}const n=this.entities[e];if(!n)throw new Error(`Unbekannte Entität: ${e}`);let a;if(e==="marke")a=window.supabase.from(n.table).select(`
                  *,
                  unternehmen:unternehmen_id (
                    id,
                    firmenname
                  )
                `).order("created_at",{ascending:!1});else if(e==="creator"){a=window.supabase.from(n.table).select("*").order("created_at",{ascending:!1});try{let s=[];const o=l=>l==null?null:typeof l=="string"?l:typeof l=="object"?l.value||l.id||null:String(l);if(t&&t.sprache_id){const l=o(t.sprache_id),{data:c,error:d}=await window.supabase.from("creator_sprachen").select("creator_id").eq("sprache_id",l);d||s.push(new Set((c||[]).map(u=>u.creator_id))),delete t.sprache_id}if(t&&(t.branche_id||t.branche)){const l=o(t.branche_id||t.branche),{data:c,error:d}=await window.supabase.from("creator_branchen").select("creator_id").eq("branche_id",l);d||s.push(new Set((c||[]).map(u=>u.creator_id))),delete t.branche_id,delete t.branche}if(t&&t.creator_type_id){const l=o(t.creator_type_id),{data:c,error:d}=await window.supabase.from("creator_creator_type").select("creator_id").eq("creator_type_id",l);d||s.push(new Set((c||[]).map(u=>u.creator_id))),delete t.creator_type_id}if(s.length>0){let l=s[0];for(let d=1;d<s.length;d++)l=new Set([...l].filter(u=>s[d].has(u)));const c=[...l];if(c.length===0)return[];a=a.in("id",c)}}catch(s){console.warn("⚠️ Konnte Creator-Junction-Filter nicht anwenden:",s)}}else if(e==="ansprechpartner"){if(a=window.supabase.from(n.table).select(`
                  *,
                  unternehmen:unternehmen_id (
                    id,
                    firmenname
                  ),
                  sprache:sprache_id (
                    id,
                    name
                  ),
                  position:position_id (
                    id,
                    name
                  )
                `).order("created_at",{ascending:!1}),t&&t.sprache_id){const s=String(t.sprache_id),{data:o,error:l}=await window.supabase.from("ansprechpartner_sprache").select("ansprechpartner_id").eq("sprache_id",s);l&&console.error("❌ Fehler beim Laden der Sprach-Verknüpfungen:",l);const c=(o||[]).map(d=>d.ansprechpartner_id).filter(Boolean);if(c.length===0)return[];a=a.in("id",c),delete t.sprache_id}}else e==="rechnung"?a=window.supabase.from(n.table).select(`
                  *,
                  unternehmen:unternehmen_id (
                    id,
                    firmenname
                  ),
                  auftrag:auftrag_id (
                    id,
                    auftragsname
                  ),
                  creator:creator_id (
                    id,
                    vorname,
                    nachname
                  ),
                  kooperation:kooperation_id (
                    id,
                    name
                  )
                `).order("created_at",{ascending:!1}):e==="unternehmen"?a=window.supabase.from(n.table).select(`
                  *,
                  unternehmen_branchen (
                    branche_id,
                    branchen (
                      id,
                      name
                    )
                  )
                `).order("created_at",{ascending:!1}):a=window.supabase.from(n.table).select("*").order("created_at",{ascending:!1});a=await this.applyFilters(a,t,n.fields,e);const{data:r,error:i}=await a;return i?(console.error(`❌ Supabase Fehler beim Laden von ${e}:`,i),[]):(console.log(`✅ ${e} aus Supabase geladen:`,r?.length||0),e==="unternehmen"&&r&&r.forEach(s=>{s.unternehmen_branchen?(s.branchen=s.unternehmen_branchen.map(o=>o.branchen).filter(Boolean),delete s.unternehmen_branchen,console.log(`📋 Unternehmen ${s.firmenname}: ${s.branchen?.length||0} Branchen geladen`)):s.branchen=[]}),r&&n.manyToMany&&await this.loadManyToManyRelations(r,e,n.manyToMany),e==="creator"&&r&&r.forEach(s=>{s.sprachen=s.sprachen||[],s.branchen=s.branchen||[],s.creator_types=s.creator_types||[]}),r||[])}catch(n){return console.error(`❌ Fehler beim Laden von ${e}:`,n),[]}}async handleManyToManyRelations(e,t,n){try{const a=this.entities[e];if(!a||!a.manyToMany)return;for(const[r,i]of Object.entries(a.manyToMany)){let s;r==="sprachen"?s="sprachen_ids":r==="branchen"?s=e==="unternehmen"||e==="marke"?"branche_id":"branchen_ids":r==="creator_types"?s="creator_type_ids":s=`${r.slice(0,-1)}_ids`;const o=n[`${s}[]`]||n[s];if(console.log(`🔍 DATASERVICE: Prüfe ${s} für ${e}.${r}:`,{fieldData:o,"data[fieldName]":n[s],"data[fieldName + []]":n[`${s}[]`],allDataKeys:Object.keys(n)}),!o)continue;console.log(`🔗 Verarbeite Many-to-Many Beziehung: ${e}.${r} für ${s}:`,o);const l=Array.isArray(o)?o:[o],{error:c}=await window.supabase.from(i.junctionTable).delete().eq(i.localKey,t);if(c){console.error(`❌ Fehler beim Löschen bestehender ${r} Beziehungen:`,c);continue}if(l.length>0&&l[0]){const d=l.filter(u=>u).map(u=>({[i.localKey]:t,[i.foreignKey]:u}));if(d.length>0){const{error:u}=await window.supabase.from(i.junctionTable).insert(d);u?console.error(`❌ Fehler beim Erstellen neuer ${r} Beziehungen:`,u):console.log(`✅ ${r} Beziehungen erstellt: ${d.length} Einträge`)}}}}catch(a){console.error("❌ Fehler beim Verarbeiten der Many-to-Many Beziehungen:",a)}}async loadManyToManyRelations(e,t,n){try{for(const[a,r]of Object.entries(n)){console.log(`🔗 Lade Many-to-Many Beziehung: ${t}.${a}`);const i=e.map(c=>c.id).filter(c=>c);if(i.length===0)continue;const{data:s,error:o}=await window.supabase.from(r.junctionTable).select(`
            ${r.localKey},
            ${r.foreignKey},
            ${r.table}!${r.foreignKey} (
              id,
              ${r.displayField}
            )
          `).in(r.localKey,i);if(o){console.error(`❌ Fehler beim Laden der Many-to-Many Beziehung ${a}:`,o);continue}const l={};s?.forEach(c=>{const d=c[r.localKey];l[d]||(l[d]=[]),c[r.table]&&l[d].push(c[r.table])}),e.forEach(c=>{c[a]=l[c.id]||[]}),console.log(`✅ Many-to-Many Beziehung ${a} geladen für ${e.length} Entitäten`)}}catch(a){console.error("❌ Fehler beim Laden der Many-to-Many Beziehungen:",a)}}async prepareDataForSupabase(e,t,n){const a={};if(n==="auftrag"&&e&&e.brutto_gesamt_budget&&!e.bruttobetrag&&(e.bruttobetrag=e.brutto_gesamt_budget),!t)return console.warn("⚠️ fieldConfig ist undefined - verwende Standard-Behandlung"),e;for(const[r,i]of Object.entries(e)){if(n==="kooperation"&&(r.startsWith("video_")||r.startsWith("adressname_")||r.startsWith("strasse_")||r.startsWith("hausnummer_")||r.startsWith("plz_")||r.startsWith("stadt_")||r.startsWith("land_")||r.startsWith("notiz_"))){console.log(`🔧 Überspringe dynamisches Feld für ${n}: ${r}`);continue}let s=i;if(typeof s=="string"&&s.startsWith("[")&&s.endsWith("]"))try{const l=JSON.parse(s);Array.isArray(l)&&(s=l)}catch{}if(r==="branche_id"&&n==="unternehmen"){console.log(`🏷️ Verarbeite ${r}:`,s);const l=this.entities[n]?.fields?.find(d=>d.name===r);if(l?.relationTable&&l?.relationField){console.log(`🔧 ${r} ist Relation-Field - wird von RelationTables verarbeitet`);continue}else if(s){a.branche_id=s,console.log(`✅ branche_id gesetzt: ${s}`);try{const{data:d,error:u}=await window.supabase.from("branchen").select("id, name").eq("id",s).single();!u&&d&&(a.branche=d.name,console.log(`✅ branche Namen gesetzt: ${a.branche}`))}catch(d){console.error("❌ Fehler beim Laden der Branche-Namen:",d)}}continue}if(r==="marke_ids"||r==="marke_ids[]"){console.log(`🏷️ Verarbeite ${r} für Ansprechpartner:`,s);continue}if(r==="sprachen_ids"||r==="sprachen_ids[]"){console.log(`🏷️ Verarbeite ${r} für Ansprechpartner:`,s);continue}if(r==="pdf_file"||r.endsWith("_file")||r.endsWith("_ids")||r.endsWith("_ids[]")||r==="mitarbeiter_ids"||r==="kampagne_adressen"||r==="plattform_ids"||r==="format_ids"||r.startsWith("adressname_")||r.startsWith("strasse_")||r.startsWith("hausnummer_")||r.startsWith("plz_")||r.startsWith("stadt_")||r.startsWith("land_")||r.startsWith("notiz_")||r==="brutto_gesamt_budget"){if(r.endsWith("_ids")||r.endsWith("_ids[]")){const l=r.replace("_ids[]","_id").replace("_ids","_id");let c=!1;if(Array.isArray(t)?c=t.some(d=>d.name===l&&d.type==="uuid"):t&&typeof t=="object"&&(c=t[l]==="uuid"),c){const d=Array.isArray(s)?s:s?[s]:[];a[l]=d.length>0?d[0]:null,console.log(`✅ Setze ${l} aus ${r}:`,a[l])}}console.log(`🔧 Überspringe virtuelles Feld: ${r}`);continue}let o=null;if(Array.isArray(t)?o=t.find(c=>c.name===r)?.type:t&&typeof t=="object"&&(o=t[r]),o)switch(Array.isArray(s)&&(o==="uuid"||r.endsWith("_id"))&&(s=s.length>0?s[0]:null),o){case"number":a[r]=s?parseFloat(s):null;break;case"array":a[r]=Array.isArray(s)?s:s?[s]:null;break;case"date":a[r]=s?new Date(s).toISOString():null;break;case"boolean":a[r]=s==="on"||s===!0||s==="true";break;default:a[r]=s||null}else console.log(`🔧 Ignoriere unbekanntes Feld für ${n}: ${r}`)}return a}async applyFilters(e,t,n,a){for(const[r,i]of Object.entries(t)){if(r==="name"&&i){e=e.or(`vorname.ilike.%${i}%,nachname.ilike.%${i}%`);continue}if(i&&n[r]){const s=n[r],o=typeof i=="object"?"":String(i);switch(s){case"number":t[`${r}_min`]&&(e=e.gte(r,parseFloat(t[`${r}_min`]))),t[`${r}_max`]&&(e=e.lte(r,parseFloat(t[`${r}_max`]))),typeof i=="object"&&(i.min!=null&&i.min!==""&&(e=e.gte(r,parseFloat(i.min))),i.max!=null&&i.max!==""&&(e=e.lte(r,parseFloat(i.max))));break;case"string":r==="firmenname"||r==="markenname"||r==="name"?e=e.ilike(r,`%${o}%`):e=e.eq(r,o);break;case"array":Array.isArray(i)?e=e.overlaps(r,i):e=e.contains(r,[o]);break;case"date":if(t[`${r}_from`]&&(e=e.gte(r,t[`${r}_from`])),t[`${r}_to`]&&(e=e.lte(r,t[`${r}_to`])),typeof i=="object"){const l=i.from??i.min,c=i.to??i.max;l&&(e=e.gte(r,l)),c&&(e=e.lte(r,c))}break;case"uuid":if(o&&o!=="[object Object]")if(a==="unternehmen"&&r==="branche_id")try{let l=null;if(window.supabase){const{data:c,error:d}=await window.supabase.from("branchen").select("name").eq("id",o).single();d||(l=c?.name||null)}l?e=e.or(`branche_id.eq.${o},branche.ilike.%${l}%`):e=e.eq(r,o)}catch{e=e.eq(r,o)}else e=e.eq(r,o);break}}}return e}async loadFilterData(e){try{if(!window.supabase)return console.warn("⚠️ Supabase nicht verfügbar - verwende Mock-Daten"),this.getMockFilterData(e);const t=this.entities[e];if(!t)throw new Error(`Unbekannte Entität: ${e}`);let n=window.supabase.from(t.table);n=n.select("*");const{data:a,error:r}=await n;if(r)return console.error(`❌ Supabase Fehler beim Laden der Filter-Daten für ${e}:`,r),this.getMockFilterData(e);const i=await this.extractFilterOptions(a,e);if(e==="creator")try{const{data:s,error:o}=await window.supabase.from("creator_type").select("id, name").order("name");!o&&s&&(i.creator_type_id=s.map(h=>({id:h.id,name:h.name})));const{data:l,error:c}=await window.supabase.from("sprachen").select("id, name").order("name");!c&&l&&(i.sprache_id=l.map(h=>({id:h.id,name:h.name})));const{data:d,error:u}=await window.supabase.from("branchen_creator").select("id, name").order("name");!u&&d&&(i.branche_id=d.map(h=>({id:h.id,name:h.name})))}catch(s){console.error("❌ Fehler beim Laden der Creator-Filter-Optionen:",s)}if(e==="unternehmen")try{const{data:s,error:o}=await window.supabase.from("branchen").select("id, name, beschreibung").order("name");!o&&s&&(i.branche_id=s.map(l=>({id:l.id,name:l.name,description:l.beschreibung})),console.log(`✅ ${s.length} Branchen für Unternehmen-Filter geladen`))}catch(s){console.error("❌ Fehler beim Laden der Unternehmen-Filter-Optionen:",s)}if(e==="marke")try{const{data:s,error:o}=await window.supabase.from("branchen").select("id, name, beschreibung").order("name");!o&&s&&(i.branche_id=s.map(l=>({id:l.id,name:l.name,description:l.beschreibung})),console.log(`✅ ${s.length} Branchen für Marke-Filter geladen`))}catch(s){console.error("❌ Fehler beim Laden der Marke-Filter-Optionen:",s)}return console.log(`✅ Filter-Daten für ${e} geladen:`,i),i}catch(t){return console.error(`❌ Fehler beim Laden der Filter-Daten für ${e}:`,t),this.getMockFilterData(e)}}async executeQuery(e,t=[]){try{if(!window.supabase)return console.warn("⚠️ Supabase nicht verfügbar - kann SQL-Abfrage nicht ausführen"),[];const{data:n,error:a}=await window.supabase.rpc("execute_sql",{sql_query:e,sql_params:t});return a?(console.error("❌ Fehler bei der SQL-Abfrage:",a),[]):n||[]}catch(n){return console.error("❌ Fehler beim Ausführen der SQL-Abfrage:",n),[]}}async extractFilterOptions(e,t){const n={};if(t==="creator"){try{const{data:s,error:o}=await window.supabase.from("creator_type").select("id, name").order("name");if(!o&&s){const h=s.map(m=>({id:m.id,name:m.name}));n.creator_type=h,n.creator_type_id=h}const{data:l,error:c}=await window.supabase.from("sprachen").select("id, name").order("name");if(!c&&l){const h=l.map(m=>({id:m.id,name:m.name}));n.sprache=h,n.sprache_id=h}const{data:d,error:u}=await window.supabase.from("branchen_creator").select("id, name").order("name");if(!u&&d){const h=d.map(m=>({id:m.id,name:m.name}));n.branche=h,n.branche_id=h}}catch(s){console.error("❌ Fehler beim Laden der Filter-Optionen:",s)}const a=e.map(s=>s.instagram_follower).filter(s=>s&&s>0).sort((s,o)=>s-o);a.length>0&&(n.instagram_follower_min=Math.min(...a),n.instagram_follower_max=Math.max(...a));const r=new Set;e.forEach(s=>{s.lieferadresse_stadt&&r.add(s.lieferadresse_stadt)}),n.lieferadresse_stadt=Array.from(r).sort();const i=new Set;e.forEach(s=>{s.lieferadresse_land&&i.add(s.lieferadresse_land)}),n.lieferadresse_land=Array.from(i).sort()}else if(t==="unternehmen"){const a=new Set;e.forEach(o=>{o.branche&&a.add(o.branche)}),n.branche=Array.from(a).sort();const r=new Set;e.forEach(o=>{o.status&&r.add(o.status)}),n.status=Array.from(r).sort();const i=new Set;e.forEach(o=>{o.rechnungsadresse_stadt&&i.add(o.rechnungsadresse_stadt)}),n.rechnungsadresse_stadt=Array.from(i).sort();const s=new Set;e.forEach(o=>{o.rechnungsadresse_land&&s.add(o.rechnungsadresse_land)}),n.rechnungsadresse_land=Array.from(s).sort()}else if(t==="kampagne"){const a=new Set;e.forEach(i=>{i.status&&a.add(i.status)}),n.status=Array.from(a).sort();const r=e.map(i=>i.budget).filter(i=>i&&i>0).sort((i,s)=>i-s);r.length>0&&(n.budget_min=Math.min(...r),n.budget_max=Math.max(...r))}else if(t==="kooperation"){const a=new Set;e.forEach(i=>{i.status&&a.add(i.status)}),n.status=Array.from(a).sort();const r=e.map(i=>i.budget).filter(i=>i&&i>0).sort((i,s)=>i-s);r.length>0&&(n.budget_min=Math.min(...r),n.budget_max=Math.max(...r))}else if(t==="ansprechpartner"){try{const{data:r,error:i}=await window.supabase.from("positionen").select("id, name").order("sort_order, name");!i&&r&&(n.position_id=r.map(s=>({value:s.id,label:s.name})))}catch(r){console.error("❌ Fehler beim Laden der Positionen für Ansprechpartner-Filter:",r)}try{const{data:r,error:i}=await window.supabase.from("sprachen").select("id, name").order("name");!i&&r&&(n.sprache_id=r.map(s=>({value:s.id,label:s.name})))}catch(r){console.error("❌ Fehler beim Laden der Sprachen für Ansprechpartner-Filter:",r)}const a=new Set;e.forEach(r=>{r.stadt&&a.add(r.stadt)}),n.stadt=Array.from(a).sort();try{const{data:r,error:i}=await window.supabase.from("unternehmen").select("id, firmenname").order("firmenname");!i&&r&&(n.unternehmen_id=r.map(s=>({value:s.id,label:s.firmenname})))}catch(r){console.error("❌ Fehler beim Laden der Unternehmen für Ansprechpartner-Filter:",r)}}else if(t==="marke"){const a=new Set;e.forEach(i=>{i.branche&&a.add(i.branche)}),n.branche=Array.from(a).sort();const r=[...new Set(e.map(i=>i.unternehmen_id).filter(Boolean))];if(r.length>0)try{const{data:i,error:s}=await window.supabase.from("unternehmen").select("id, firmenname").in("id",r);!s&&i&&(n.unternehmen_id=i.map(o=>({value:o.id,label:o.firmenname})))}catch(i){console.error("❌ Fehler beim Laden der Unternehmen für Marken-Filter:",i)}}return n}getMockData(e){switch(console.log(`🔍 Lade Mock-Daten für ${e}`),e){case"unternehmen":return[{id:"1",firmenname:"Beispiel GmbH",branche:"Tech",webseite:"https://beispiel.de",created_at:new Date().toISOString()},{id:"2",firmenname:"Test AG",branche:"Business",webseite:"https://test.de",created_at:new Date().toISOString()}];case"marke":return[{id:"1",markenname:"Beispiel Marke",unternehmen_id:"1",branche:"Tech",webseite:"https://marke.de",created_at:new Date().toISOString(),unternehmen:{id:"1",firmenname:"Beispiel GmbH"}}];default:return[]}}getMockFilterData(e){return{creator:{sprachen:["Deutsch","Englisch","Französisch","Spanisch"],branche:["Mode","Beauty","Fitness","Food","Tech","Lifestyle"],creator_type:["Influencer","Content Creator","Künstler","Experte"],instagram_follower_min:1e3,instagram_follower_max:1e6},unternehmen:{branche:["Mode","Beauty","Fitness","Food","Tech","Lifestyle"]},marke:{branche:[{value:"Beauty & Fashion",label:"Beauty & Fashion"},{value:"Fitness & Gesundheit",label:"Fitness & Gesundheit"},{value:"Food & Lifestyle",label:"Food & Lifestyle"},{value:"Gaming",label:"Gaming"},{value:"Tech",label:"Tech"},{value:"Travel",label:"Travel"},{value:"Business",label:"Business"},{value:"Education",label:"Education"}],unternehmen_id:[{value:"1",label:"Beispiel GmbH"},{value:"2",label:"Test AG"}]},kampagne:{status:["Aktiv","In Planung","Abgeschlossen","Pausiert"],budget_min:1e3,budget_max:5e4},kooperation:{status:["Angefragt","Bestätigt","In Bearbeitung","Abgeschlossen","Abgelehnt"],budget_min:500,budget_max:1e4}}[e]||{}}}const x=new Pe;typeof window<"u"&&(window.DataService=x,window.CreatorService={loadFilterData:()=>x.loadFilterData("creator"),loadCreators:b=>x.loadEntities("creator",b),createEntity:b=>x.createEntity("creator",b),updateEntity:(b,e)=>x.updateEntity("creator",b,e),deleteEntity:b=>x.deleteEntity("creator",b)});class te{constructor(){this.sanitizeCache=new Map}sanitizeHtml(e){if(!e||typeof e!="string")return"";if(this.sanitizeCache.has(e))return this.sanitizeCache.get(e);let t=e.replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;").replace(/'/g,"&#x27;").replace(/\//g,"&#x2F;");return this.sanitizeCache.set(e,t),t}validateEmail(e){return!e||typeof e!="string"?!1:/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e.trim())}validatePhone(e){return!e||typeof e!="string"?!1:e.replace(/[^\d+\-\(\)\s]/g,"").length>=10}validateUrl(e){if(!e||typeof e!="string")return!1;try{return new URL(e),!0}catch{return!1}}validateNumber(e,t=null,n=null){const a=parseFloat(e);return!(isNaN(a)||t!==null&&a<t||n!==null&&a>n)}validateText(e,t=0,n=null){if(!e||typeof e!="string")return!1;const a=e.trim().length;return!(a<t||n!==null&&a>n)}validateRequired(e){return e==null?!1:typeof e=="string"?e.trim().length>0:Array.isArray(e)?e.length>0:!0}validateForm(e,t){const n={};for(const[a,r]of Object.entries(t)){const i=e[a];if(r.required&&!this.validateRequired(i)){n[a]=`${a} ist erforderlich`;continue}if(this.validateRequired(i)){if(r.type==="email"&&!this.validateEmail(i)){n[a]="Ungültige Email-Adresse";continue}if(r.type==="phone"&&!this.validatePhone(i)){n[a]="Ungültige Telefonnummer";continue}if(r.type==="url"&&!this.validateUrl(i)){n[a]="Ungültige URL";continue}if(r.type==="number"&&!this.validateNumber(i,r.min,r.max)){n[a]="Ungültige Zahl";continue}if(r.type==="text"&&!this.validateText(i,r.minLength,r.maxLength)){n[a]="Ungültiger Text";continue}}}return{isValid:Object.keys(n).length===0,errors:n}}clearCache(){this.sanitizeCache.clear()}}const T=new te;typeof window<"u"&&(window.Validator={sanitizeHtml:b=>T.sanitizeHtml(b),validateEmail:b=>T.validateEmail(b),validatePhone:b=>T.validatePhone(b),validateUrl:b=>T.validateUrl(b),validateNumber:(b,e,t)=>T.validateNumber(b,e,t),validateText:(b,e,t)=>T.validateText(b,e,t),validateRequired:b=>T.validateRequired(b),validateForm:(b,e)=>T.validateForm(b,e)});class Ve{constructor(){this.validator=T}sanitizeHtml(e){return this.validator.sanitizeHtml(e)}formatCreatorName(e,t){if(!e&&!t)return"Unbekannter Creator";const n=this.sanitizeHtml(e||""),a=this.sanitizeHtml(t||"");return`${n} ${a}`.trim()}formatFollowerCount(e){return!e||isNaN(e)?"-":e>=1e6?`${(e/1e6).toFixed(1)}M`:e>=1e3?`${(e/1e3).toFixed(1)}K`:e.toString()}formatBudget(e){return!e||isNaN(e)?"-":new Intl.NumberFormat("de-DE",{style:"currency",currency:"EUR"}).format(e)}formatAddress(e){const t=[];return e.lieferadresse_strasse&&t.push(this.sanitizeHtml(e.lieferadresse_strasse)),e.lieferadresse_hausnummer&&t.push(this.sanitizeHtml(e.lieferadresse_hausnummer)),e.lieferadresse_plz&&t.push(this.sanitizeHtml(e.lieferadresse_plz)),e.lieferadresse_stadt&&t.push(this.sanitizeHtml(e.lieferadresse_stadt)),e.lieferadresse_land&&t.push(this.sanitizeHtml(e.lieferadresse_land)),t.length>0?t.join(", "):"-"}formatSocialMedia(e){const t=[];return e.instagram&&t.push(`<a href="https://instagram.com/${e.instagram.replace("@","")}" target="_blank" rel="noopener noreferrer">${this.sanitizeHtml(e.instagram)}</a>`),e.tiktok&&t.push(`<a href="https://tiktok.com/@${e.tiktok.replace("@","")}" target="_blank" rel="noopener noreferrer">${this.sanitizeHtml(e.tiktok)}</a>`),t.length>0?t.join("<br>"):"-"}formatTags(e,t=3){if(!e||!Array.isArray(e))return"-";const n=e.filter(r=>r&&r.trim()).map(r=>`<span class="tag">${this.sanitizeHtml(r.trim())}</span>`).slice(0,t);if(n.length===0)return"-";let a=n.join("");return e.length>t&&(a+=`<span class="tag-more">+${e.length-t}</span>`),a}formatCreatorType(e){return e?{Influencer:"Influencer","Content Creator":"Content Creator","UGC Creator":"UGC Creator","Micro Influencer":"Micro Influencer","Macro Influencer":"Macro Influencer",Celebrity:"Celebrity",Expert:"Expert",Lifestyle:"Lifestyle"}[e]||this.sanitizeHtml(e):"-"}formatContact(e){const t=[];return e.mail&&t.push(`<a href="mailto:${this.sanitizeHtml(e.mail)}">${this.sanitizeHtml(e.mail)}</a>`),e.telefonnummer&&t.push(`<a href="tel:${this.sanitizeHtml(e.telefonnummer)}">${this.sanitizeHtml(e.telefonnummer)}</a>`),e.portfolio_link&&t.push(`<a href="${this.sanitizeHtml(e.portfolio_link)}" target="_blank" rel="noopener noreferrer">Portfolio</a>`),t.length>0?t.join("<br>"):"-"}getCreatorStatus(e){const t=e.instagram&&e.instagram_follower>0,n=e.tiktok&&e.tiktok_follower>0,a=e.mail||e.telefonnummer,r=e.lieferadresse_stadt;return t&&n&&a&&r?"complete":t||n?"partial":"incomplete"}getStatusBadge(e){const t={complete:'<span class="badge badge-success">Vollständig</span>',partial:'<span class="badge badge-warning">Teilweise</span>',incomplete:'<span class="badge badge-error">Unvollständig</span>'};return t[e]||t.incomplete}validateCreator(e){const t=[];return!e.vorname&&!e.nachname&&t.push("Name ist erforderlich"),e.mail&&!this.validator.validateEmail(e.mail)&&t.push("Ungültige Email-Adresse"),e.telefonnummer&&!this.validator.validatePhone(e.telefonnummer)&&t.push("Ungültige Telefonnummer"),e.portfolio_link&&!this.validator.validateUrl(e.portfolio_link)&&t.push("Ungültige Portfolio-URL"),{isValid:t.length===0,errors:t}}}const ne=new Ve;typeof window<"u"&&(window.CreatorUtils=ne);class O{getFormConfig(e){return{creator:{title:"Neuen Creator anlegen",fields:[{name:"vorname",label:"Vorname",type:"text",required:!0,validation:{type:"text",minLength:2}},{name:"nachname",label:"Nachname",type:"text",required:!0,validation:{type:"text",minLength:2}},{name:"instagram",label:"Instagram",type:"text",required:!1},{name:"instagram_follower",label:"Instagram Follower",type:"number",required:!1},{name:"tiktok",label:"TikTok",type:"text",required:!1},{name:"tiktok_follower",label:"TikTok Follower",type:"number",required:!1},{name:"sprachen_ids",label:"Sprachen",type:"multiselect",required:!1,options:[],dynamic:!0,searchable:!0,tagBased:!0,placeholder:"Sprachen suchen und hinzufügen...",table:"sprachen",displayField:"name",valueField:"id",customField:!0},{name:"branchen_ids",label:"Branchen",type:"multiselect",required:!1,options:[],dynamic:!0,searchable:!0,tagBased:!0,placeholder:"Branchen suchen und hinzufügen...",table:"branchen_creator",displayField:"name",valueField:"id",customField:!0},{name:"creator_type_ids",label:"Creator-Typen",type:"multiselect",required:!1,options:[],dynamic:!0,searchable:!0,tagBased:!0,placeholder:"Creator-Typen suchen und hinzufügen...",table:"creator_type",displayField:"name",valueField:"id",customField:!0},{name:"telefonnummer",label:"Telefonnummer",type:"tel",required:!1,validation:{type:"phone"}},{name:"mail",label:"Email",type:"email",required:!1,validation:{type:"email"}},{name:"portfolio_link",label:"Portfolio Link",type:"url",required:!1,validation:{type:"url"}},{name:"lieferadresse_strasse",label:"Straße",type:"text",required:!1},{name:"lieferadresse_hausnummer",label:"Hausnummer",type:"text",required:!1},{name:"lieferadresse_plz",label:"PLZ",type:"text",required:!1},{name:"lieferadresse_stadt",label:"Stadt",type:"text",required:!1},{name:"lieferadresse_land",label:"Land",type:"text",required:!1},{name:"notiz",label:"Notizen",type:"textarea",required:!1}]},unternehmen:{title:"Neues Unternehmen anlegen",fields:[{name:"firmenname",label:"Firmenname",type:"text",required:!0,validation:{type:"text",minLength:2}},{name:"branche_id",label:"Branchen",type:"multiselect",required:!1,dynamic:!0,searchable:!0,tagBased:!0,placeholder:"Branche suchen und hinzufügen...",table:"branchen",displayField:"name",valueField:"id",relationTable:"unternehmen_branchen",relationField:"branche_id"},{name:"rechnungsadresse_strasse",label:"Rechnungsadresse - Straße",type:"text",required:!1},{name:"rechnungsadresse_hausnummer",label:"Rechnungsadresse - Hausnummer",type:"text",required:!1},{name:"rechnungsadresse_plz",label:"Rechnungsadresse - PLZ",type:"text",required:!1},{name:"rechnungsadresse_stadt",label:"Rechnungsadresse - Stadt",type:"text",required:!1},{name:"rechnungsadresse_land",label:"Rechnungsadresse - Land",type:"text",required:!1},{name:"invoice_email",label:"Rechnungs-Email",type:"email",required:!1,validation:{type:"email"}},{name:"webseite",label:"Webseite",type:"url",required:!1,validation:{type:"url"}},{name:"status",label:"Status",type:"select",required:!1,options:["Aktiv","Inaktiv","Prospekt"]}]},kampagne:{title:"Neue Kampagne anlegen",fields:[{name:"kampagnenname",label:"Kampagnenname",type:"text",required:!0,validation:{type:"text",minLength:2},autoGenerate:!0,dependsOn:"auftrag_id",showWhen:"any",readonly:!0,placeholder:"Wird automatisch generiert..."},{name:"unternehmen_id",label:"Unternehmen",type:"select",required:!0,options:[],dynamic:!0,searchable:!0,placeholder:"Unternehmen suchen und auswählen..."},{name:"marke_id",label:"Marke",type:"select",required:!1,options:[],dynamic:!0,searchable:!0,placeholder:"Marke suchen und auswählen...",dependsOn:"unternehmen_id",table:"marke",displayField:"markenname",valueField:"id"},{name:"auftrag_id",label:"Auftrag",type:"select",required:!1,options:[],dynamic:!0,searchable:!0,placeholder:"Auftrag suchen und auswählen...",dependsOn:"marke_id",table:"auftrag",displayField:"auftragsname",valueField:"id"},{name:"mitarbeiter_ids",label:"Zugehörige Mitarbeiter",type:"multiselect",required:!1,options:[],dynamic:!0,searchable:!0,tagBased:!0,placeholder:"Mitarbeiter suchen und auswählen...",table:"benutzer",displayField:"name",valueField:"id",relationTable:"kampagne_mitarbeiter",relationField:"mitarbeiter_id",filter:"rolle.eq.Mitarbeiter,rolle.eq.mitarbeiter,rolle.eq.admin",directQuery:!0},{name:"pm_ids",label:"Projektmanager",type:"multiselect",required:!1,options:[],dynamic:!0,searchable:!0,tagBased:!0,placeholder:"Projektmanager suchen und auswählen...",table:"benutzer",displayField:"name",valueField:"id",filter:"rolle.eq.Mitarbeiter,rolle.eq.mitarbeiter,rolle.eq.admin",directQuery:!0,customField:!0},{name:"scripter_ids",label:"Scripter",type:"multiselect",required:!1,options:[],dynamic:!0,searchable:!0,tagBased:!0,placeholder:"Scripter suchen und auswählen...",table:"benutzer",displayField:"name",valueField:"id",filter:"rolle.eq.Mitarbeiter,rolle.eq.mitarbeiter,rolle.eq.admin",directQuery:!0,customField:!0},{name:"cutter_ids",label:"Cutter",type:"multiselect",required:!1,options:[],dynamic:!0,searchable:!0,tagBased:!0,placeholder:"Cutter suchen und auswählen...",table:"benutzer",displayField:"name",valueField:"id",filter:"rolle.eq.Mitarbeiter,rolle.eq.mitarbeiter,rolle.eq.admin",directQuery:!0,customField:!0},{name:"ziele",label:"Ziele",type:"textarea",required:!1},{name:"art_der_kampagne",label:"Art der Kampagne",type:"multiselect",required:!1,options:[],dynamic:!0,searchable:!0,tagBased:!0,placeholder:"Kampagnenarten suchen und auswählen...",table:"kampagne_art_typen",displayField:"name",valueField:"id",directQuery:!0},{name:"start",label:"Startdatum",type:"date",required:!1},{name:"deadline",label:"Deadline",type:"date",required:!1},{name:"drehort_typ_id",label:"Drehort",type:"select",required:!1,options:[],dynamic:!0,searchable:!0,placeholder:"Drehort-Typ auswählen...",table:"drehort_typen",displayField:"name",valueField:"id",directQuery:!0},{name:"drehort_beschreibung",label:"Drehort Beschreibung",type:"textarea",required:!1,dependsOn:"drehort_typ_id",showWhen:"Vor Ort Produktion"},{name:"kampagne_adressen",label:"Adressen",type:"custom",customType:"addresses",required:!1,dependsOn:"drehort_typ_id",showWhen:"Vor Ort Produktion"},{name:"status",label:"Status",type:"select",required:!1,options:[],dynamic:!0,searchable:!0,placeholder:"Status auswählen...",table:"kampagne_status",displayField:"name",valueField:"id",directQuery:!0},{name:"plattform_ids",label:"Plattformen",type:"multiselect",required:!1,options:[],dynamic:!0,searchable:!0,tagBased:!0,placeholder:"Plattformen suchen und auswählen...",table:"plattform_typen",displayField:"name",valueField:"id",relationTable:"kampagne_plattformen",relationField:"plattform_id",directQuery:!0},{name:"format_ids",label:"Formate",type:"multiselect",required:!1,options:[],dynamic:!0,searchable:!0,tagBased:!0,placeholder:"Formate suchen und auswählen...",table:"format_typen",displayField:"name",valueField:"id",relationTable:"kampagne_formate",relationField:"format_id",directQuery:!0},{name:"creatoranzahl",label:"Creator Anzahl",type:"number",required:!1,validation:{type:"number",min:1}},{name:"videoanzahl",label:"Video Anzahl",type:"number",required:!1,validation:{type:"number",min:1}},{name:"budget_info",label:"Budget Info",type:"textarea",required:!1}]},marke:{title:"Neue Marke anlegen",fields:[{name:"markenname",label:"Markenname",type:"text",required:!0,validation:{type:"text",minLength:2}},{name:"unternehmen_id",label:"Unternehmen",type:"select",required:!0,options:[],dynamic:!0,searchable:!0,placeholder:"Unternehmen suchen und auswählen...",table:"unternehmen",displayField:"firmenname",valueField:"id"},{name:"webseite",label:"Webseite",type:"url",required:!1,validation:{type:"url"}},{name:"branche_id",label:"Branchen",type:"multiselect",required:!1,dynamic:!0,searchable:!0,tagBased:!0,placeholder:"Branchen suchen und hinzufügen...",table:"branchen",displayField:"name",valueField:"id"}]},auftrag:{title:"Neuen Auftrag anlegen",fields:[{name:"auftragsname",label:"Auftragsname",type:"text",required:!0,validation:{type:"text",minLength:2}},{name:"unternehmen_id",label:"Unternehmen",type:"select",required:!0,options:[],dynamic:!0,searchable:!0,placeholder:"Unternehmen suchen und auswählen..."},{name:"marke_id",label:"Marke",type:"select",required:!1,options:[],dynamic:!0,searchable:!0,placeholder:"Marke suchen und auswählen...",dependsOn:"unternehmen_id",table:"marke",displayField:"markenname",valueField:"id"},{name:"status",label:"Status",type:"select",required:!1,options:["Beauftragt","In Produktion","Abgeschlossen","Storniert"]},{name:"po",label:"PO",type:"text",required:!1,placeholder:"Purchase Order Nummer..."},{name:"re_nr",label:"RE. Nr",type:"text",required:!1,placeholder:"Rechnungsnummer..."},{name:"re_faelligkeit",label:"RE-Fälligkeit",type:"date",required:!1},{name:"kampagnenanzahl",label:"Kampagnenanzahl",type:"number",required:!1,validation:{type:"number",min:1}},{name:"start",label:"Startdatum",type:"date",required:!1},{name:"ende",label:"Enddatum",type:"date",required:!1},{name:"nettobetrag",label:"Nettobetrag",type:"number",required:!1,validation:{type:"number",min:0},calculatedFrom:["influencer","influencer_preis","ugc","ugc_preis","vor_ort_produktion","vor_ort_preis"]},{name:"ust_prozent",label:"USt (%)",type:"number",required:!1,validation:{type:"number",min:0,max:100},readonly:!0,defaultValue:19},{name:"ust_betrag",label:"USt Betrag",type:"number",required:!1,validation:{type:"number",min:0},readonly:!0,calculatedFrom:["nettobetrag","ust_prozent"]},{name:"brutto_gesamt_budget",label:"Brutto Gesamtbudget",type:"number",required:!1,validation:{type:"number",min:0},readonly:!0,calculatedFrom:["nettobetrag","ust_betrag"]},{name:"deckungsbeitrag_prozent",label:"Geplanter Deckungsbeitrag (%)",type:"number",required:!1,validation:{type:"number",min:0,max:100},placeholder:"z.B. 20",autoCalculate:!0},{name:"deckungsbeitrag_betrag",label:"Geplanter Deckungsbeitrag (Betrag)",type:"number",required:!1,validation:{type:"number",min:0},readonly:!0,calculatedFrom:["deckungsbeitrag_prozent","nettobetrag"]},{name:"ksk_betrag",label:"KSK (5% von Netto)",type:"number",required:!1,validation:{type:"number",min:0},readonly:!0,calculatedFrom:["nettobetrag"]},{name:"creator_budget",label:"Creator Budget",type:"number",required:!1,validation:{type:"number",min:0},readonly:!0,calculatedFrom:["nettobetrag","ksk_betrag","deckungsbeitrag_betrag","deckungsbeitrag_prozent"]},{name:"budgetverteilung",label:"Budgetverteilung/Textfeld",type:"textarea",required:!1,placeholder:"Beschreibung der Budgetverteilung..."},{name:"gesamtanzahl_videos",label:"Gesamtanzahl Videos",type:"number",required:!1,validation:{type:"number",min:1}},{name:"influencer",label:"Influencer (Stückzahl)",type:"number",required:!1,validation:{type:"number",min:0}},{name:"influencer_preis",label:"Influencer (Preis pro Stück, Netto)",type:"number",required:!1,validation:{type:"number",min:0}},{name:"ugc",label:"UGC (Stückzahl)",type:"number",required:!1,validation:{type:"number",min:0}},{name:"ugc_preis",label:"UGC (Preis pro Stück, Netto)",type:"number",required:!1,validation:{type:"number",min:0}},{name:"vor_ort_produktion",label:"Vor Ort Produktion (Stückzahl)",type:"number",required:!1,validation:{type:"number",min:0}},{name:"vor_ort_preis",label:"Vor Ort Produktion (Preis pro Stück, Netto)",type:"number",required:!1,validation:{type:"number",min:0}},{name:"rechnung_gestellt",label:"Rechnung gestellt",type:"toggle",required:!1},{name:"ueberwiesen",label:"Überwiesen",type:"toggle",required:!1},{name:"assignee_id",label:"Mitarbeiter zuweisen",type:"multiselect",required:!1,options:[],dynamic:!0,searchable:!0,tagBased:!0,placeholder:"Mitarbeiter suchen und auswählen...",table:"benutzer",displayField:"name",valueField:"id"},{name:"art_der_kampagne",label:"Art der Kampagne",type:"multiselect",required:!1,options:[],dynamic:!0,searchable:!0,tagBased:!0,table:"kampagne_art_typen",displayField:"name",valueField:"id"},{name:"format_anpassung",label:"Format Anpassung",type:"multiselect",required:!1,options:[],dynamic:!0,searchable:!0,tagBased:!0,table:"format_anpassung_typen",displayField:"name",valueField:"id"}]},kooperation:{title:"Neue Kooperation anlegen",fields:[{name:"unternehmen_id",label:"Unternehmen",type:"select",required:!0,options:[],dynamic:!0,searchable:!0,placeholder:"Unternehmen suchen und auswählen..."},{name:"marke_id",label:"Marke",type:"select",required:!0,options:[],dynamic:!0,searchable:!0,placeholder:"Marke auswählen...",dependsOn:"unternehmen_id"},{name:"kampagne_id",label:"Kampagne",type:"select",required:!0,options:[],dynamic:!0,searchable:!0,placeholder:"Kampagne suchen und auswählen...",dependsOn:"marke_id"},{name:"creator_id",label:"Creator",type:"select",required:!0,options:[],dynamic:!0,searchable:!0,placeholder:"Creator suchen und auswählen...",dependsOn:"kampagne_id"},{name:"name",label:"Name",type:"text",required:!0,validation:{type:"text",minLength:2},autoGenerate:!0,readonly:!0,placeholder:"Wird automatisch generiert..."},{name:"content_art",label:"Content Art",type:"select",required:!0,options:["Paid","Organisch","Influencer"]},{name:"skript_autor",label:"Skript schreibt",type:"select",required:!1,options:["Brand","Creator"]},{name:"nettobetrag",label:"Nettobetrag",type:"number",required:!1,validation:{type:"number",min:0}},{name:"zusatzkosten",label:"Zusatzkosten",type:"number",required:!1,validation:{type:"number",min:0}},{name:"gesamtkosten",label:"Gesamtkosten",type:"number",required:!1,validation:{type:"number",min:0}},{name:"vertrag_unterschrieben",label:"Vertrag unterschrieben",type:"checkbox",required:!1},{name:"vertrag_link",label:"Vertrag Link",type:"url",required:!1,validation:{type:"url"}},{name:"videoanzahl",label:"Video Anzahl",type:"number",required:!1,validation:{type:"number",min:1}},{name:"skript_deadline",label:"Skript Deadline",type:"date",required:!1},{name:"skript_link",label:"Skript Link",type:"url",required:!1,validation:{type:"url"}},{name:"content_deadline",label:"Content Deadline",type:"date",required:!1},{name:"status",label:"Status",type:"select",required:!0,options:["Todo","In progress","Done"]}]},ansprechpartner:{title:"Neuen Ansprechpartner anlegen",fields:[{name:"vorname",label:"Vorname",type:"text",required:!0,validation:{type:"text",minLength:2}},{name:"nachname",label:"Nachname",type:"text",required:!0,validation:{type:"text",minLength:2}},{name:"unternehmen_id",label:"Unternehmen",type:"select",required:!1,options:[],dynamic:!0,searchable:!0,placeholder:"Unternehmen suchen und auswählen...",table:"unternehmen",displayField:"firmenname",valueField:"id",directQuery:!0},{name:"marke_ids",label:"Marken",type:"multiselect",required:!1,options:[],dynamic:!0,searchable:!0,tagBased:!0,placeholder:"Marken suchen und hinzufügen...",dependsOn:"unternehmen_id",table:"marke",displayField:"markenname",valueField:"id"},{name:"position_id",label:"Position",type:"select",required:!0,options:[],dynamic:!0,searchable:!0,placeholder:"Position suchen und auswählen...",table:"positionen",displayField:"name",valueField:"id",directQuery:!0},{name:"email",label:"E-Mail",type:"email",required:!1,validation:{type:"email"}},{name:"telefonnummer",label:"Telefonnummer (privat)",type:"tel",required:!1},{name:"telefonnummer_office",label:"Telefonnummer (Büro)",type:"tel",required:!1},{name:"linkedin",label:"LinkedIn Profil",type:"url",required:!1,validation:{type:"url"}},{name:"stadt",label:"Stadt",type:"text",required:!1},{name:"sprachen_ids",label:"Sprachen",type:"multiselect",required:!1,dynamic:!0,searchable:!0,tagBased:!0,placeholder:"Sprachen suchen und hinzufügen...",table:"sprachen",displayField:"name",valueField:"id",customField:!0},{name:"notiz",label:"Notizen",type:"textarea",required:!1,rows:4}]},briefing:{title:"Neues Briefing anlegen",fields:[{name:"product_service_offer",label:"Produkt/Service/Angebot",type:"text",required:!0,validation:{type:"text",minLength:2},placeholder:"Kurzbezeichnung des Produkts/Angebots"},{name:"produktseite_url",label:"Produktseite URL",type:"url",required:!1,validation:{type:"url"}},{name:"unternehmen_id",label:"Unternehmen",type:"select",required:!1,options:[],dynamic:!0,searchable:!0,placeholder:"Unternehmen suchen und auswählen...",table:"unternehmen",displayField:"firmenname",valueField:"id",directQuery:!0},{name:"marke_id",label:"Marke",type:"select",required:!1,options:[],dynamic:!0,searchable:!0,placeholder:"Marke suchen und auswählen...",dependsOn:"unternehmen_id",table:"marke",displayField:"markenname",valueField:"id"},{name:"assignee_id",label:"Zugewiesen an",type:"select",required:!1,options:[],dynamic:!0,searchable:!0,placeholder:"Mitarbeiter auswählen...",table:"benutzer",displayField:"name",valueField:"id",directQuery:!0},{name:"status",label:"Status",type:"select",required:!1,options:["active","inactive","completed","cancelled"]},{name:"deadline",label:"Deadline",type:"date",required:!1},{name:"zielgruppe",label:"Zielgruppe",type:"textarea",required:!1,rows:3},{name:"zieldetails",label:"Zieldetails",type:"textarea",required:!1,rows:3},{name:"creator_aufgabe",label:"Creator Aufgabe",type:"textarea",required:!1,rows:4},{name:"usp",label:"USPs",type:"textarea",required:!1,rows:3,placeholder:"Unique Selling Points, durch Komma getrennt oder als Fließtext"},{name:"dos",label:"Do’s",type:"textarea",required:!1,rows:3},{name:"donts",label:"Don’ts",type:"textarea",required:!1,rows:3},{name:"rechtlicher_hinweis",label:"Rechtlicher Hinweis",type:"textarea",required:!1,rows:4}]},rechnung:{title:"Neue Rechnung anlegen",fields:[{name:"rechnung_nr",label:"Rechnungs-Nr",type:"text",required:!0,validation:{type:"text",minLength:2}},{name:"kooperation_id",label:"Kooperation",type:"select",required:!0,options:[],dynamic:!0,searchable:!0,placeholder:"Kooperation wählen...",table:"kooperationen",displayField:"name",valueField:"id"},{name:"unternehmen_id",label:"Unternehmen",type:"select",required:!0,options:[],dynamic:!0,searchable:!0,placeholder:"Unternehmen wird automatisch gesetzt",readonly:!0,table:"unternehmen",displayField:"firmenname",valueField:"id"},{name:"auftrag_id",label:"Auftrag",type:"select",required:!0,options:[],dynamic:!0,searchable:!0,placeholder:"Auftrag wird automatisch gesetzt",readonly:!0,table:"auftrag",displayField:"auftragsname",valueField:"id"},{name:"kampagne_id",label:"Kampagne",type:"select",required:!0,options:[],dynamic:!0,searchable:!0,placeholder:"Kampagne wird automatisch gesetzt",readonly:!0,table:"kampagne",displayField:"kampagnenname",valueField:"id"},{name:"creator_id",label:"Creator",type:"select",required:!1,options:[],dynamic:!0,searchable:!0,placeholder:"Creator wird automatisch gesetzt",readonly:!0,table:"creator",displayField:"vorname",valueField:"id"},{name:"videoanzahl",label:"Video Anzahl (aus Kooperation)",type:"number",required:!1,validation:{type:"number",min:0}},{name:"status",label:"Status",type:"select",required:!0,options:["Offen","Rückfrage","Bezahlt","An Qonto gesendet"]},{name:"geprueft",label:"Geprüft",type:"toggle",required:!1},{name:"gestellt_am",label:"Gestellt am",type:"date",required:!0},{name:"zahlungsziel",label:"Zahlungsziel",type:"date",required:!0},{name:"bezahlt_am",label:"Bezahlt am",type:"date",required:!1},{name:"nettobetrag",label:"Betrag (Netto)",type:"number",required:!0,validation:{type:"number",min:0}},{name:"zusatzkosten",label:"Zusatzkosten",type:"number",required:!1,validation:{type:"number",min:0}},{name:"bruttobetrag",label:"Betrag (Brutto)",type:"number",required:!0,validation:{type:"number",min:0}},{name:"pdf_file",label:"Rechnungs-PDF",type:"custom",customType:"uploader",accept:"application/pdf",multiple:!1,required:!1},{name:"belege_files",label:"Belege (mehrere Dateien)",type:"custom",customType:"uploader",accept:"application/pdf,image/*",multiple:!0,required:!1}]}}[e]||null}}class je{constructor({multiple:e=!1,accept:t="*/*",onFilesChanged:n=()=>{}}={}){this.multiple=e,this.accept=t,this.onFilesChanged=n,this.files=[],this.root=null,this.input=null,this.listEl=null}mount(e){if(!e)return;this.root=e;const t=`uploader-input-${Math.random().toString(36).slice(2)}`;this.root.innerHTML=`
      <div class="uploader-drop" tabindex="0">
        <div class="uploader-instructions">
          <span>Per Drag & Drop hierher ziehen oder</span>
          <button type="button" class="uploader-btn">Datei(en) auswählen</button>
        </div>
        <input type="file" id="${t}" ${this.multiple?"multiple":""} accept="${this.accept}" style="display:none" />
      </div>
      <div class="uploader-list"></div>
    `,this.input=this.root.querySelector('input[type="file"]'),this.listEl=this.root.querySelector(".uploader-list"),this.bind(),this.root.__uploaderInstance=this,this.renderList()}bind(){const e=this.root.querySelector(".uploader-drop");this.root.querySelector(".uploader-btn").addEventListener("click",()=>this.input.click()),this.input.addEventListener("change",a=>this.handleFiles(a.target.files)),["dragenter","dragover"].forEach(a=>e.addEventListener(a,r=>{r.preventDefault(),e.classList.add("is-dragover")})),["dragleave","dragend","drop"].forEach(a=>e.addEventListener(a,r=>{r.preventDefault(),e.classList.remove("is-dragover")})),e.addEventListener("drop",a=>{const r=a.dataTransfer;if(!r)return;const i=r.files;this.handleFiles(i)});const n=this.root.closest("form");n&&["dragover","drop"].forEach(a=>n.addEventListener(a,r=>{r.preventDefault()}))}handleFiles(e){if(!e||e.length===0)return;const t=a=>!this.accept||this.accept==="*/*"?!0:this.accept.split(",").map(i=>i.trim()).some(i=>i.endsWith("/*")?a.type.startsWith(i.slice(0,-1)):a.type===i||`.${a.name.split(".").pop()}`===i),n=Array.from(e).filter(a=>t(a));this.multiple?this.files=[...this.files,...n]:this.files=n.length?[n[0]]:[],this.renderList(),this.onFilesChanged(this.files)}renderList(){if(!this.listEl)return;if(!this.files.length){this.listEl.innerHTML='<div class="uploader-empty">Keine Dateien ausgewählt</div>';return}const e=this.files.map((t,n)=>`
      <div class="uploader-item">
        <div class="uploader-meta">
          <span class="uploader-name">${t.name}</span>
          <span class="uploader-size">${this.formatSize(t.size)}</span>
        </div>
        <button type="button" class="uploader-remove" data-index="${n}">Entfernen</button>
      </div>
    `).join("");this.listEl.innerHTML=e,this.listEl.querySelectorAll(".uploader-remove").forEach(t=>{t.addEventListener("click",()=>{const n=parseInt(t.dataset.index,10);this.files.splice(n,1),this.renderList(),this.onFilesChanged(this.files)})})}formatSize(e){if(!e&&e!==0)return"";const t=["B","KB","MB","GB"];let n=e,a=0;for(;n>=1024&&a<t.length-1;)n/=1024,a++;return`${n.toFixed(1)} ${t[a]}`}}class ae{constructor(){this.validator=new te}getFieldLabel(e){return{unternehmen_id:"Unternehmen",marke_id:"Marke",auftrag_id:"Auftrag",kampagne_id:"Kampagne",creator_id:"Creator"}[e]||e}renderForm(e,t=null){const n=this.getFormConfig(e);if(!n)return console.error(`❌ Keine Konfiguration für Entity: ${e}`),"";const a=!!t,r=this.renderFormOnly(e,t);return`
      <div class="modal-header">
        <h2>${a?"Bearbeiten":n.title}</h2>
        <button type="button" class="btn-close" aria-label="Schließen">
          <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path>
          </svg>
        </button>
      </div>
      <div class="modal-body">
        <form id="${e}-form" data-entity-id="${t?.id||""}">
          ${r}
          <div class="form-actions">
            <button type="button" class="btn-secondary" onclick="this.closest('.modal-content').querySelector('.btn-close').click()">Abbrechen</button>
            <button type="submit" class="btn-primary">${a?"Aktualisieren":"Erstellen"}</button>
          </div>
        </form>
      </div>
    `}renderFormOnly(e,t=null){const n=this.getFormConfig(e);if(!n)return"";const a=n.fields||[],r=new Set(["influencer","influencer_preis","ugc","ugc_preis","vor_ort_produktion","vor_ort_preis","ust_prozent","ust_betrag","deckungsbeitrag_prozent","deckungsbeitrag_betrag"]),i=[];let s=!1;for(const o of a){const l=t?t[o.name]:"",c=r.has(o.name);c&&!s&&(i.push('<div class="form-two-col">'),s=!0),!c&&s&&(i.push("</div>"),s=!1);let d=this.renderField(o,l);c&&(d=d.replace('<div class="form-field"','<div class="form-field form-field--half"')),i.push(d)}return s&&i.push("</div>"),`
      <form id="${e}-form" data-entity-id="${t?.id||""}">
        ${i.join("")}
        <div class="form-actions">
          <button type="button" class="btn-secondary" onclick="window.navigateTo('/${e}')">Abbrechen</button>
          <button type="submit" class="btn-primary">${t?"Aktualisieren":"Erstellen"}</button>
        </div>
      </form>
    `}renderField(e,t=""){const n=`field-${e.name}`,a=e.required?"required":"",r=e.required?'<span class="required">*</span>':"";switch(e.type){case"text":case"email":case"tel":case"url":const i=e.dependsOn?`data-depends-on="${e.dependsOn}"`:"",s=e.showWhen?`data-show-when="${e.showWhen}"`:"",o=e.autoGenerate?'data-auto-generate="true"':"",l=e.readonly?"readonly":"",c=e.placeholder?`placeholder="${e.placeholder}"`:"",d=e.dependsOn?'style="display: none;"':"";return`
          <div class="form-field" ${i} ${s} ${d}>
            <label for="${n}">${e.label} ${r}</label>
            <input type="${e.type}" id="${n}" name="${e.name}" value="${this.validator.sanitizeHtml(t)}" ${a} ${o} ${l} ${c}>
            ${e.autoGenerate?'<small style="color: #6b7280; font-size: 12px;">Wird automatisch generiert</small>':""}
          </div>
        `;case"number":const u=e.readonly?"readonly":"",h=e.autoCalculate?'data-auto-calculate="true"':"",m=e.calculatedFrom?`data-calculated-from="${e.calculatedFrom.join(",")}"`:"",p=e.placeholder?`placeholder="${e.placeholder}"`:"",g=e.validation?.min!==void 0?`min="${e.validation.min}"`:"",f=e.validation?.max!==void 0?`max="${e.validation.max}"`:"",w=e.validation?.step!==void 0?`step="${e.validation.step}"`:'step="0.01"',v=e.defaultValue!==void 0&&(t===""||t===void 0||t===null)?`value="${e.defaultValue}"`:`value="${t}"`;return`
          <div class="form-field">
            <label for="${n}">${e.label} ${r}</label>
            <input type="number" id="${n}" name="${e.name}" ${v} ${a} ${u} ${h} ${m} ${p} ${g} ${f} ${w}>
            ${e.readonly&&e.calculatedFrom?'<small style="color: #6b7280; font-size: 12px;">Wird automatisch berechnet</small>':""}
          </div>
        `;case"date":return`
          <div class="form-field">
            <label for="${n}">${e.label} ${r}</label>
            <input type="date" id="${n}" name="${e.name}" value="${t}" ${a}>
          </div>
        `;case"textarea":const k=e.dependsOn?`data-depends-on="${e.dependsOn}"`:"",y=e.showWhen?`data-show-when="${e.showWhen}"`:"";return`
          <div class="form-field form-field-full" ${k} ${y}>
            <label for="${n}">${e.label} ${r}</label>
            <textarea id="${n}" name="${e.name}" rows="4" ${a}>${this.validator.sanitizeHtml(t)}</textarea>
          </div>
        `;case"select":let S="";if(e.dynamic?S=`<option value="">${e.dependsOn?`Erst ${this.getFieldLabel(e.dependsOn)} auswählen...`:e.placeholder||"Bitte wählen..."}</option>`:S=e.options.map(M=>`<option value="${M}" ${t===M?"selected":""}>${M}</option>`).join(""),e.searchable){const M=e.dependsOn?"disabled":"",I=e.readonly?"disabled":M,j=e.dependsOn?`Erst ${this.getFieldLabel(e.dependsOn)} auswählen...`:e.placeholder||"Bitte wählen...",N=[];e.table&&N.push(`data-table="${e.table}"`),e.displayField&&N.push(`data-display-field="${e.displayField}"`),e.valueField&&N.push(`data-value-field="${e.valueField}"`);const De=N.join(" ");return`
            <div class="form-field">
              <label for="${n}">${e.label} ${r}</label>
              <select id="${n}" name="${e.name}" ${a} ${I} data-searchable="true" data-placeholder="${j}" ${e.readonly?'data-readonly="true"':""} ${De}>
                ${S}
              </select>
              ${e.readonly?`<input type="hidden" name="${e.name}" id="${n}-hidden" value="">`:""}
            </div>
          `}const A=e.dependsOn?"disabled":"",E=e.readonly?"disabled":A,D=[];e.table&&D.push(`data-table="${e.table}"`),e.displayField&&D.push(`data-display-field="${e.displayField}"`),e.valueField&&D.push(`data-value-field="${e.valueField}"`);const F=D.join(" ");return`
          <div class="form-field">
            <label for="${n}">${e.label} ${r}</label>
            <select id="${n}" name="${e.name}" ${a} ${E} ${e.readonly?'data-readonly="true"':""} ${F}>
              ${S}
            </select>
            ${e.readonly?`<input type="hidden" name="${e.name}" id="${n}-hidden" value="">`:""}
          </div>
        `;case"multiselect":const z=Array.isArray(t)?t:t?t.split(","):[];let C="";if(e.dynamic||(C=e.options.map(M=>{const I=z.includes(M)?"selected":"";return`<option value="${M}" ${I}>${M}</option>`}).join("")),e.searchable){const M=z.length>0?`data-existing-values='${JSON.stringify(z)}'`:"";return`
            <div class="form-field">
              <label for="${n}">${e.label} ${r}</label>
              <select id="${n}" name="${e.name}" ${a} multiple data-searchable="true" data-tag-based="${e.tagBased||"false"}" data-placeholder="${e.placeholder||"Bitte wählen..."}" ${M}>
                ${C}
              </select>
            </div>
          `}return`
          <div class="form-field">
            <label for="${n}">${e.label} ${r}</label>
            <select id="${n}" name="${e.name}" ${a} multiple>
              ${C}
            </select>
          </div>
        `;case"checkbox":const $e=t==="on"||t===!0||t==="true"?"checked":"";return`
          <div class="form-field">
            <label class="toggle-container">
              <span>${e.label} ${r}</span>
              <div class="toggle-switch">
                <input type="checkbox" id="${n}" name="${e.name}" ${$e} ${a}>
                <span class="toggle-slider"></span>
              </div>
            </label>
          </div>
        `;case"toggle":const Ae=t==="on"||t===!0||t==="true"||t===1?"checked":"";return`
          <div class="form-field">
            <label class="toggle-container">
              <span>${e.label} ${r}</span>
              <div class="toggle-switch">
                <input type="checkbox" id="${n}" name="${e.name}" ${Ae} ${a}>
                <span class="toggle-slider"></span>
              </div>
            </label>
          </div>
        `;case"custom":if(e.customType==="addresses")return this.renderAddressesField(e,t);if(e.customType==="videos")return this.renderVideosField(e,t);if(e.customType==="file"){const M=e.accept?`accept="${e.accept}"`:"",I=e.multiple?"multiple":"";return`
            <div class="form-field">
              <label for="${n}">${e.label} ${r}</label>
              <input type="file" id="${n}" name="${e.name}" ${a} ${M} ${I}>
            </div>
          `}if(e.customType==="uploader"){const M=`uploader-${e.name}-${Math.random().toString(36).slice(2)}`;return setTimeout(()=>{const I=document.getElementById(M);I&&new je({multiple:!!e.multiple,accept:e.accept||"*/*"}).mount(I.querySelector(".uploader"))},0),`
            <div class="form-field" id="${M}">
              <label>${e.label} ${r}</label>
              <div class="uploader" data-name="${e.name}"></div>
            </div>
          `}return`<div class="form-field">Unbekannter Feldtyp: ${e.customType}</div>`;default:return`<div class="form-field">Unbekannter Feldtyp: ${e.type}</div>`}}renderAddressesField(e,t=""){const n=`field-${e.name}`,a=e.dependsOn?`data-depends-on="${e.dependsOn}"`:"",r=e.showWhen?`data-show-when="${e.showWhen}"`:"";return`
      <div class="form-field form-field-full" ${a} ${r}>
        <label for="${n}" style="display: block; margin-bottom: 8px; font-weight: 600; color: #374151;">${e.label}</label>
        <div class="addresses-container" id="${n}">
          <div class="addresses-list" style="margin-bottom: 16px;">
            <!-- Adressen werden hier dynamisch hinzugefügt -->
          </div>
          <button type="button" class="btn btn-secondary btn-sm add-address-btn" style="
            background: #6b7280;
            color: white;
            border: none;
            border-radius: 6px;
            padding: 8px 16px;
            cursor: pointer;
            font-size: 14px;
            display: inline-flex;
            align-items: center;
            gap: 8px;
            transition: background-color 0.2s;
          " onmouseover="this.style.background='#4b5563'" onmouseout="this.style.background='#6b7280'">
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" style="width: 16px; height: 16px;">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4"></path>
            </svg>
            Adresse hinzufügen
          </button>
        </div>
      </div>
    `}renderVideosField(e,t=""){const n=`field-${e.name}`,a=Array.isArray(e.options)?e.options:[],r=this.validator.sanitizeHtml(JSON.stringify(a));return`
      <div class="form-field form-field-full">
        <label for="${n}" class="form-label">${e.label}</label>
        <div class="videos-container" id="${n}" data-options='${r}'>
          <div class="videos-list videos-grid"></div>
        </div>
      </div>
    `}addAddressRow(e){const t=`address-${Date.now()}`,n=`
      <div class="address-item" data-address-id="${t}" style="
        border: 1px solid #e5e7eb;
        border-radius: 8px;
        padding: 16px;
        margin-bottom: 16px;
        background: #f9fafb;
      ">
        <div class="address-header" style="
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 16px;
        ">
          <h4 style="margin: 0; font-size: 16px; font-weight: 600; color: #374151;">Adresse ${t}</h4>
          <button type="button" class="btn-remove-address" onclick="this.closest('.address-item').remove()" style="
            background: #ef4444;
            color: white;
            border: none;
            border-radius: 4px;
            padding: 4px 8px;
            cursor: pointer;
            font-size: 12px;
            transition: background-color 0.2s;
          " onmouseover="this.style.background='#dc2626'" onmouseout="this.style.background='#ef4444'">
            Entfernen
          </button>
        </div>
        <div class="address-fields" style="
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 12px;
        ">
          <div class="form-field" style="grid-column: 1 / -1;">
            <label style="display: block; margin-bottom: 4px; font-weight: 500; color: #374151;">Adressname</label>
            <input type="text" name="adressname_${t}" placeholder="z.B. Hauptbüro, Filiale, etc." 
                   style="width: 100%; padding: 8px; border: 1px solid #d1d5db; border-radius: 4px;">
          </div>
          <div class="form-field">
            <label style="display: block; margin-bottom: 4px; font-weight: 500; color: #374151;">Straße</label>
            <input type="text" name="strasse_${t}" placeholder="Musterstraße" 
                   style="width: 100%; padding: 8px; border: 1px solid #d1d5db; border-radius: 4px;">
          </div>
          <div class="form-field">
            <label style="display: block; margin-bottom: 4px; font-weight: 500; color: #374151;">Hausnummer</label>
            <input type="text" name="hausnummer_${t}" placeholder="123" 
                   style="width: 100%; padding: 8px; border: 1px solid #d1d5db; border-radius: 4px;">
          </div>
          <div class="form-field">
            <label style="display: block; margin-bottom: 4px; font-weight: 500; color: #374151;">PLZ</label>
            <input type="text" name="plz_${t}" placeholder="12345" 
                   style="width: 100%; padding: 8px; border: 1px solid #d1d5db; border-radius: 4px;">
          </div>
          <div class="form-field">
            <label style="display: block; margin-bottom: 4px; font-weight: 500; color: #374151;">Stadt</label>
            <input type="text" name="stadt_${t}" placeholder="Musterstadt" 
                   style="width: 100%; padding: 8px; border: 1px solid #d1d5db; border-radius: 4px;">
          </div>
          <div class="form-field">
            <label style="display: block; margin-bottom: 4px; font-weight: 500; color: #374151;">Land</label>
            <input type="text" name="land_${t}" placeholder="Deutschland" 
                   style="width: 100%; padding: 8px; border: 1px solid #d1d5db; border-radius: 4px;">
          </div>
          <div class="form-field" style="grid-column: 1 / -1;">
            <label style="display: block; margin-bottom: 4px; font-weight: 500; color: #374151;">Notiz</label>
            <textarea name="notiz_${t}" rows="2" placeholder="Zusätzliche Informationen" 
                      style="width: 100%; padding: 8px; border: 1px solid #d1d5db; border-radius: 4px; resize: vertical;"></textarea>
          </div>
        </div>
      </div>
    `;e.insertAdjacentHTML("beforeend",n)}getFormConfig(e){return null}}class Ze{constructor(){this.validator=window.validatorSystem||{sanitizeHtml:e=>e||"",validateForm:(e,t)=>({isValid:!0,errors:{}})}}validateFormData(e,t){const n=[],a=this.getFormConfig(e);return a&&a.fields.forEach(r=>{if(r.required&&(!t[r.name]||t[r.name].toString().trim()==="")&&n.push(`${r.label} ist erforderlich.`),r.validation&&t[r.name]){const i=t[r.name],s=this.validateField(r,i);n.push(...s)}}),n}validateField(e,t){const n=[];if(!e.validation)return n;switch(e.validation.type){case"text":e.validation.minLength&&t.length<e.validation.minLength&&n.push(`${e.label} muss mindestens ${e.validation.minLength} Zeichen lang sein.`),e.validation.maxLength&&t.length>e.validation.maxLength&&n.push(`${e.label} darf maximal ${e.validation.maxLength} Zeichen lang sein.`);break;case"number":const a=parseFloat(t);isNaN(a)?n.push(`${e.label} muss eine Zahl sein.`):(e.validation.min!==void 0&&a<e.validation.min&&n.push(`${e.label} muss mindestens ${e.validation.min} sein.`),e.validation.max!==void 0&&a>e.validation.max&&n.push(`${e.label} darf maximal ${e.validation.max} sein.`));break;case"email":/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(t)||n.push(`${e.label} muss eine gültige E-Mail-Adresse sein.`);break;case"url":try{new URL(t)}catch{n.push(`${e.label} muss eine gültige URL sein.`)}break;case"phone":/^[\+]?[0-9\s\-\(\)]{10,}$/.test(t)||n.push(`${e.label} muss eine gültige Telefonnummer sein.`);break}return n}sanitizeHtml(e){return e?e.replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;").replace(/'/g,"&#x27;"):""}showValidationErrors(e){if(document.querySelectorAll(".field-error").forEach(t=>t.remove()),e.forEach(t=>{const n=this.extractFieldNameFromError(t);if(n){const a=document.querySelector(`[name="${n}"]`);if(a){const r=document.createElement("div");r.className="field-error",r.textContent=t,r.style.cssText=`
            color: #dc2626;
            font-size: 12px;
            margin-top: 4px;
          `,a.parentNode.appendChild(r)}}}),e.length>0){const t=e.join(`
`);alert(`Validierungsfehler:
${t}`)}}extractFieldNameFromError(e){const t=["vorname","nachname","firmenname","kampagnenname","auftragsname","markenname"];for(const n of t)if(e.toLowerCase().includes(n))return n;return null}showSuccessMessage(e){console.log(`✅ ${e}`)}showErrorMessage(e){console.error(`❌ ${e}`),alert(e)}getFormConfig(e){return null}}class re{async autoGenerateKampagnenname(e,t){try{if(!t)return;console.log(`🔧 Generiere Kampagnenname für Auftrag: ${t}`);const{data:n,error:a}=await window.supabase.from("auftrag").select(`
          *,
          unternehmen:unternehmen_id(firmenname),
          marke:marke_id(markenname)
        `).eq("id",t).single();if(a||!n){console.error("❌ Fehler beim Laden des Auftrags:",a);return}const{data:r,error:i}=await window.supabase.from("kampagne").select("id").eq("auftrag_id",t);if(i){console.error("❌ Fehler beim Zählen der Kampagnen:",i);return}const o=r.length+1,l=n.kampagnenanzahl||1,c=e.querySelector('input[name="deadline"]'),d=c?c.value:"";let h=`${n.unternehmen?.firmenname||"Unbekannte Firma"} - ${o}/${l}`;if(d){const g=new Date(d).toLocaleDateString("de-DE");h+=` - ${g}`}const m=e.querySelector('input[name="kampagnenname"]');m&&(m.value=h,m.dispatchEvent(new Event("input",{bubbles:!0})),m.dispatchEvent(new Event("change",{bubbles:!0})),m.focus(),m.blur(),console.log(`✅ Kampagnenname generiert: ${h}`),console.log(`🔍 Feld-Wert nach Setzen: "${m.value}"`))}catch(n){console.error("❌ Fehler beim Generieren des Kampagnennamens:",n)}}async autoGenerateKooperationsname(e){try{const t=e.querySelector('select[name="kampagne_id"]'),n=e.querySelector('select[name="creator_id"]'),a=e.querySelector('input[name="name"]');if(!t||!n||!a)return;const r=t.value,i=n.value;if(!r||!i)return;const{data:s,error:o}=await window.supabase.from("kampagne").select("id, creatoranzahl").eq("id",r).single();if(o||!s){console.error("❌ Fehler beim Laden der Kampagne für Kooperation:",o);return}const{data:l,error:c}=await window.supabase.from("kooperationen").select("id").eq("kampagne_id",r);if(c){console.error("❌ Fehler beim Zählen der Kooperationen:",c);return}const d=(l?.length||0)+1,u=s.creatoranzahl||1,{data:h,error:m}=await window.supabase.from("creator").select("vorname, nachname, instagram").eq("id",i).single();if(m||!h){console.error("❌ Fehler beim Laden des Creators:",m);return}const f=`${`${h.vorname||""} ${h.nachname||""}`.trim()||(h.instagram?`@${h.instagram}`:"Creator")} ${d}/${u}`;a.value=f,a.dispatchEvent(new Event("input",{bubbles:!0})),a.dispatchEvent(new Event("change",{bubbles:!0})),a.focus(),a.blur(),console.log(`✅ Kooperationsname generiert: ${f}`)}catch(t){console.error("❌ Fehler beim Generieren des Kooperationsnamens:",t)}}setupAutoGeneration(e){const t=e.querySelector('input[name="deadline"]');t&&t.addEventListener("change",()=>{const s=e.querySelector('select[name="auftrag_id"]');s&&s.value&&this.autoGenerateKampagnenname(e,s.value)});const n=e.querySelector('select[name="auftrag_id"]');n&&(n.addEventListener("change",()=>{n.value&&this.autoGenerateKampagnenname(e,n.value)}),n.value&&this.autoGenerateKampagnenname(e,n.value));const a=e.querySelector(".searchable-select-container, .tag-based-select");if(a){const s=a.querySelector(".searchable-select-input");if(s){let o;s.addEventListener("input",()=>{clearTimeout(o),o=setTimeout(()=>{const c=a.querySelector('select[style*="display: none"]');c&&c.value&&this.autoGenerateKampagnenname(e,c.value)},300)});const l=a.querySelector('select[style*="display: none"]');l&&l.value&&this.autoGenerateKampagnenname(e,l.value)}}const r=e.querySelector('select[name="kampagne_id"]'),i=e.querySelector('select[name="creator_id"]');if(r&&i){const s=()=>this.autoGenerateKooperationsname(e);r.addEventListener("change",s),i.addEventListener("change",s),r.value&&i.value&&this.autoGenerateKooperationsname(e);const o=l=>{const c=l.previousElementSibling;if(c&&c.classList.contains("searchable-select-container")){const d=c.querySelector(".searchable-select-input");if(d){let u;d.addEventListener("input",()=>{clearTimeout(u),u=setTimeout(()=>this.autoGenerateKooperationsname(e),300)})}}};o(r),o(i)}}}class ie{constructor(){this.calculationRules={deckungsbeitrag_betrag:this.calculateDeckungsbeitragBetrag.bind(this),ust_betrag:this.calculateUstBetrag.bind(this),brutto_gesamt_budget:this.calculateBruttoGesamtBudget.bind(this),ksk_betrag:this.calculateKskBetrag.bind(this),nettobetrag:this.calculateNettoFromItems.bind(this),creator_budget:this.calculateCreatorBudget.bind(this)}}initializeAutoCalculation(e){if(!e)return;console.log("🔧 Initialisiere Auto-Calculation für Formular");const t=e.querySelectorAll("[data-calculated-from]"),n=e.querySelectorAll('[data-auto-calculate="true"]');n.forEach(r=>{r.addEventListener("input",i=>{this.handleFieldChange(e,i.target)}),r.addEventListener("change",i=>{this.handleFieldChange(e,i.target)})}),e.querySelectorAll('input[type="number"]').forEach(r=>{r.addEventListener("input",i=>{this.recalculateAllDependentFields(e)}),r.addEventListener("change",i=>{this.recalculateAllDependentFields(e)})}),console.log(`✅ Auto-Calculation initialisiert für ${t.length} berechnete Felder und ${n.length} Trigger-Felder`)}handleFieldChange(e,t){console.log(`🔄 Feld geändert: ${t.name} = ${t.value}`),this.recalculateAllDependentFields(e)}recalculateAllDependentFields(e){e.querySelectorAll("[data-calculated-from]").forEach(n=>{const a=n.name;if(this.calculationRules[a]){const r=this.calculationRules[a](e,n);r!=null&&(n.value=r,console.log(`💰 ${a} neu berechnet: ${r}`))}})}calculateDeckungsbeitragBetrag(e,t){try{const n=e.querySelector('[name="deckungsbeitrag_prozent"]'),a=e.querySelector('[name="nettobetrag"]');if(!n||!a)return console.warn("⚠️ Erforderliche Felder für Deckungsbeitrag-Berechnung nicht gefunden"),0;const r=parseFloat(n.value)||0,i=parseFloat(a.value)||0;if(r===0||i===0)return 0;const s=i*(r/100);return console.log(`💰 Deckungsbeitrag berechnet: ${i}€ * ${r}% = ${s}€`),Math.round(s*100)/100}catch(n){return console.error("❌ Fehler bei Deckungsbeitrag-Berechnung:",n),0}}calculateUstBetrag(e,t){try{const n=e.querySelector('[name="nettobetrag"]');if(!n)return 0;const a=parseFloat(n.value)||0,r=e.querySelector('[name="ust_prozent"]'),i=r&&parseFloat(r.value)||19,s=a*(i/100);return Math.round(s*100)/100}catch(n){return console.error("❌ Fehler bei USt-Berechnung:",n),0}}calculateBruttoGesamtBudget(e,t){try{const n=e.querySelector('[name="nettobetrag"]'),a=e.querySelector('[name="ust_betrag"]'),r=n&&parseFloat(n.value)||0,i=a?parseFloat(a.value)||this.calculateUstBetrag(e):this.calculateUstBetrag(e),s=r+i;return Math.round(s*100)/100}catch(n){return console.error("❌ Fehler bei Brutto-Berechnung:",n),0}}calculateKskBetrag(e,t){try{const n=e.querySelector('[name="nettobetrag"]');if(!n)return 0;const r=(parseFloat(n.value)||0)*.05;return Math.round(r*100)/100}catch(n){return console.error("❌ Fehler bei KSK-Berechnung:",n),0}}calculateNettoFromItems(e,t){try{const n=d=>{const u=e.querySelector(`[name="${d}"]`);return u&&parseFloat(u.value)||0},a=n("influencer"),r=n("influencer_preis"),i=n("ugc"),s=n("ugc_preis"),o=n("vor_ort_produktion"),l=n("vor_ort_preis"),c=a*r+i*s+o*l;return c>0?Math.round(c*100)/100:null}catch(n){return console.error("❌ Fehler bei Netto-Berechnung aus Items:",n),0}}calculateCreatorBudget(e,t){try{const n=o=>e.querySelector(`[name="${o}"]`),a=parseFloat(n("nettobetrag")?.value||"0")||0;let r=parseFloat(n("ksk_betrag")?.value||"0");(!r||r===0)&&(r=Math.round(a*.05*100)/100);let i=parseFloat(n("deckungsbeitrag_betrag")?.value||"0");if(!i||i===0){const o=parseFloat(n("deckungsbeitrag_prozent")?.value||"0")||0;i=Math.round(a*(Math.min(Math.max(o,0),100)/100)*100)/100}const s=Math.max(0,a-r-i);return Math.round(s*100)/100}catch(n){return console.error("❌ Fehler bei Creator-Budget-Berechnung:",n),0}}formatCurrency(e){return!e||isNaN(e)?"0,00":new Intl.NumberFormat("de-DE",{minimumFractionDigits:2,maximumFractionDigits:2}).format(e)}validatePercentage(e){const t=parseFloat(e);return isNaN(t)||t<0?0:t>100?100:t}}new ie;document.addEventListener("DOMContentLoaded",()=>{console.log("🔧 AutoCalculation Modul geladen")});class se{constructor(e){this.autoGeneration=e,this.dynamicDataLoader=null}setupDependentFields(e){e.querySelectorAll("[data-depends-on]").forEach(n=>{const a=n.dataset.dependsOn,r=n.dataset.showWhen,i=e.querySelector(`[name="${a}"]`);if(i){const s=()=>{const o=i.value;console.log(`🔍 Prüfe abhängiges Feld: ${a} = "${o}", showWhen = "${r}"`);let l=!1;if(i.tagName==="SELECT"){const d=i.selectedOptions[0],u=d?d.textContent:"";l=r?u.includes(r):!!o,console.log(`🔍 Select-Feld: "${u}" enthält "${r}" = ${l}`)}else l=r?o===r||o.includes(r):!!o;const c=n.closest(".form-field");c&&(c.style.display=l?"block":"none",console.log(`🔍 Feld ${n.dataset.dependsOn} ${l?"angezeigt":"versteckt"}`),l&&n.dataset.autoGenerate==="true"&&this.autoGeneration.autoGenerateKampagnenname(e,o))};i.addEventListener("change",s),s()}}),this.setupDynamicDependentFields(e)}setupDynamicDependentFields(e){const t=e.dataset.entity;if(!t||!this.getFormConfig)return;const n=this.getFormConfig(t);n&&n.fields.forEach(a=>{if(a.dependsOn){const r=e.querySelector(`[name="${a.name}"]`),i=e.querySelector(`[name="${a.dependsOn}"]`);if(r&&i){console.log(`🔧 Setup dynamisches abhängiges Feld: ${a.name} abhängig von ${a.dependsOn}`);const s=async()=>{const c=this.getFieldValue(i);if(console.log(`🔍 Parent-Feld ${a.dependsOn} geändert:`,c),!c){console.log(`🧹 Kein Parent-Wert für ${a.name} - Feld wird geleert und deaktiviert`),this.clearDependentField(r,a),a.dependsOn==="unternehmen_id"?this.resetCascadeFields(e,["marke_id","kampagne_id","creator_id","auftrag_id"]):a.dependsOn==="marke_id"&&this.resetCascadeFields(e,["kampagne_id","creator_id","auftrag_id"]);return}await this.loadDependentFieldData(r,a,c,e)};i.addEventListener("change",s);const o=i.closest(".searchable-select-container, .tag-based-select");if(o){const c=o.querySelector(".searchable-select-input");if(c){let d;c.addEventListener("input",()=>{clearTimeout(d),d=setTimeout(s,300)})}}this.getFieldValue(i)||console.log(`🚫 Initial deaktiviert: ${a.name} (kein Parent-Wert)`),s()}}})}getFieldValue(e){const t=e.parentNode.querySelector('select[style*="display: none"]');return t&&t!==e?t.value:e.value}clearDependentField(e,t){if(console.log(`🧹 Leere abhängiges Feld: ${t.name}`),t.type==="multiselect"&&t.tagBased){console.log(`🏷️ Spezielle Behandlung für Tag-basiertes Multi-Select: ${t.name}`);const i=e.closest(".form-field")?.querySelector(".tag-based-select");if(i){const s=i.querySelector(".searchable-select-input");s&&(s.value="",s.placeholder=`Erst ${this.getFieldLabel(t.dependsOn)} auswählen...`,s.disabled=!0);const o=i.querySelector(".tags-container");o&&(o.innerHTML="",o.style.display="none");const l=i.querySelector(".searchable-select-dropdown");l&&(l.style.display="none");const c=i.querySelector('select[style*="display: none"]');c&&(c.innerHTML="")}e.innerHTML='<option value="">Bitte wählen...</option>',e.value="",e.disabled=!0;return}const a=`Erst ${{unternehmen_id:"Unternehmen",marke_id:"Marke",auftrag_id:"Auftrag"}[t.dependsOn]||t.dependsOn} auswählen...`,r=e.closest(".searchable-select-container, .tag-based-select");if(r){const i=r.querySelector(".searchable-select-input");i&&(i.value="",i.placeholder=a);const s=r.querySelector(".tags-container");s&&(s.innerHTML="")}e.innerHTML=`<option value="">${a}</option>`,e.value="",e.disabled=!0}async loadDependentFieldData(e,t,n,a){if(!this.dynamicDataLoader){console.error("❌ DynamicDataLoader nicht verfügbar");return}console.log(`🔄 Lade Daten für ${t.name} basierend auf ${t.dependsOn}:`,n);try{if((t.name==="marke_id"||t.name==="marke_ids")&&t.dependsOn==="unternehmen_id"){const{data:r,error:i}=await window.supabase.from("marke").select("id, markenname").eq("unternehmen_id",n).order("markenname");if(i){console.error("❌ Fehler beim Laden der Marken:",i);return}const s=r.map(o=>({value:o.id,label:o.markenname}));if(console.log(`✅ ${s.length} Marken geladen für Unternehmen ${n}`),e.disabled=!1,t.name==="marke_ids"&&t.tagBased){const o=e.closest(".form-field")?.querySelector(".tag-based-select");if(o){const l=o.querySelector(".searchable-select-input");l&&(l.disabled=!1,l.placeholder=t.placeholder||"Marken suchen und hinzufügen...")}await this.updateTagBasedMultiSelectOptions(e,t,s)}else this.updateDependentFieldOptions(e,t,s);s.length===0&&(console.log(`⚠️ Keine Marken für Unternehmen ${n} gefunden - lade Aufträge direkt`),await this.loadAuftraegeForUnternehmen(n,a))}if(t.name==="auftrag_id"&&t.dependsOn==="marke_id"){const{data:r,error:i}=await window.supabase.from("auftrag").select("id, auftragsname").eq("marke_id",n).order("auftragsname");if(i){console.error("❌ Fehler beim Laden der Aufträge:",i);return}const s=r.map(o=>({value:o.id,label:o.auftragsname}));console.log(`✅ ${s.length} Aufträge geladen für Marke ${n}`),e.disabled=!1,this.updateDependentFieldOptions(e,t,s)}if(t.name==="auftrag_id"&&t.dependsOn==="unternehmen_id"){const{data:r,error:i}=await window.supabase.from("auftrag").select("id, auftragsname").eq("unternehmen_id",n).order("auftragsname");if(i){console.error("❌ Fehler beim Laden der Aufträge für Unternehmen:",i);return}const s=r.map(o=>({value:o.id,label:o.auftragsname}));console.log(`✅ ${s.length} Aufträge direkt für Unternehmen ${n} geladen`),e.disabled=!1,this.updateDependentFieldOptions(e,t,s)}if(t.name==="kampagne_id"&&t.dependsOn==="marke_id"){const{data:r,error:i}=await window.supabase.from("kampagne").select("id, kampagnenname, marke_id, videoanzahl").eq("marke_id",n).order("kampagnenname");if(i){console.error("❌ Fehler beim Laden der Kampagnen für Marke:",i);return}let s=r||[];try{const l=s.map(c=>c.id);if(l.length>0){const{data:c,error:d}=await window.supabase.from("kooperationen").select("kampagne_id, videoanzahl").in("kampagne_id",l);if(!d&&c){const u={};c.forEach(h=>{const m=h.kampagne_id,p=parseInt(h.videoanzahl,10)||0;u[m]=(u[m]||0)+p}),s=s.filter(h=>{const m=parseInt(h.videoanzahl,10)||0,p=u[h.id]||0;return Math.max(0,m-p)>0})}}}catch(l){console.warn("⚠️ Fehler beim Filtern der Kampagnen:",l)}const o=s.map(l=>({value:l.id,label:l.kampagnenname}));console.log(`✅ ${o.length} Kampagnen geladen für Marke ${n}`),e.disabled=!1,this.updateDependentFieldOptions(e,t,o)}else if(t.name==="kampagne_id"&&t.dependsOn==="unternehmen_id"){const{data:r,error:i}=await window.supabase.from("kampagne").select("id, kampagnenname, unternehmen_id, videoanzahl").eq("unternehmen_id",n).order("kampagnenname");if(i){console.error("❌ Fehler beim Laden der Kampagnen für Unternehmen:",i);return}let s=r||[];try{const l=s.map(c=>c.id);if(l.length>0){const{data:c,error:d}=await window.supabase.from("kooperationen").select("kampagne_id, videoanzahl").in("kampagne_id",l);if(!d&&c){const u={};c.forEach(h=>{const m=h.kampagne_id,p=parseInt(h.videoanzahl,10)||0;u[m]=(u[m]||0)+p}),s=s.filter(h=>{const m=parseInt(h.videoanzahl,10)||0,p=u[h.id]||0;return Math.max(0,m-p)>0})}}}catch(l){console.warn("⚠️ Konnte belegte Videos nicht überprüfen, zeige alle Kampagnen:",l)}const o=s.map(l=>({value:l.id,label:l.kampagnenname||"Unbenannte Kampagne"}));e.disabled=!1,this.updateDependentFieldOptions(e,t,o)}if(t.name==="creator_id"&&t.dependsOn==="kampagne_id")try{const{data:r,error:i}=await window.supabase.from("kampagne_creator").select("creator_id, creator:creator_id(id, vorname, nachname)").eq("kampagne_id",n).order("creator_id");if(i){console.error("❌ Fehler beim Laden der Kampagnen-Creator:",i);return}const s=(r||[]).map(o=>{const l=o.creator||{},c=`${l.vorname||""} ${l.nachname||""}`.trim()||o.creator_id;return{value:o.creator_id,label:c}});e.disabled=!1,this.updateDependentFieldOptions(e,t,s)}catch(r){console.error("❌ Fehler beim Laden der Creator für Kampagne:",r)}}catch(r){console.error("❌ Fehler beim Laden der abhängigen Daten:",r)}}async loadAuftraegeForUnternehmen(e,t){try{const{data:n,error:a}=await window.supabase.from("auftrag").select("id, auftragsname, marke_id").eq("unternehmen_id",e).order("auftragsname");if(a){console.error("❌ Fehler beim Laden der Aufträge für Unternehmen:",a);return}if(n.length>0){console.log(`✅ ${n.length} Aufträge direkt für Unternehmen ${e} gefunden`);const r=t.querySelector('[name="auftrag_id"]');if(r){const i=n.map(o=>({value:o.id,label:o.auftragsname}));r.disabled=!1,this.updateDependentFieldOptions(r,{name:"auftrag_id"},i);const s=t.querySelector('[name="marke_id"]');s&&(s.innerHTML='<option value="">Keine Marken verfügbar</option>',s.disabled=!0),console.log("🔄 Auftrag-Feld temporär auf Unternehmen-Abhängigkeit umgestellt")}}else console.log(`⚠️ Keine Aufträge für Unternehmen ${e} gefunden`)}catch(n){console.error("❌ Fehler beim Laden der Aufträge für Unternehmen:",n)}}resetCascadeFields(e,t){console.log("🔄 Setze Kaskaden-Felder zurück:",t),t.forEach(n=>{const a=e.querySelector(`[name="${n}"]`);if(a){a.value="",a.disabled=!0;const r=a.closest(".searchable-select-container, .tag-based-select");if(r){const s=r.querySelector(".searchable-select-input");s&&(s.value="",s.placeholder=`Erst ${this.getFieldLabel(n.replace("_id",""))} auswählen...`);const o=r.querySelector(".tags-container");o&&(o.innerHTML="")}const i=`Erst ${this.getFieldLabel(n.replace("_id",""))} auswählen...`;a.innerHTML=`<option value="">${i}</option>`}})}getFieldLabel(e){return{unternehmen:"Unternehmen",marke:"Marke",auftrag:"Auftrag"}[e]||e}updateDependentFieldOptions(e,t,n){const a=e.closest(".searchable-select-container, .tag-based-select");if(a){const r=a.querySelector(".searchable-select-input");r&&(r.placeholder=t.placeholder||"Suchen...")}e.innerHTML='<option value="">Bitte wählen...</option>',n.forEach(r=>{const i=document.createElement("option");i.value=r.value,i.textContent=r.label,e.appendChild(i)}),this.dynamicDataLoader&&this.dynamicDataLoader.updateSelectOptions&&this.dynamicDataLoader.updateSelectOptions(e,n,t)}async updateTagBasedMultiSelectOptions(e,t,n){console.log(`🏷️ Aktualisiere Tag-basierte Multi-Select Optionen für ${t.name}:`,n);const a=e.closest(".form-field");if(!a){console.warn("❌ Kein Form-Field Container gefunden");return}const r=new Set,i=a.querySelector(".tag-based-select");if(i){i.querySelectorAll(".tag").forEach(l=>{const c=l.dataset?.value;c&&r.add(c)});const o=i.querySelector('select[style*="display: none"]');o&&Array.from(o.selectedOptions).forEach(l=>{l.value&&r.add(l.value)})}if(console.log("🔍 Bestehende ausgewählte Werte:",Array.from(r)),i){console.log("🔄 Tag-basiertes System existiert bereits - aktualisiere nur Optionen");const s=i.querySelector(".searchable-select-dropdown");s&&window.formSystem?.optionsManager?.updateDropdownItems&&window.formSystem.optionsManager.updateDropdownItems(s,n,""),e.innerHTML='<option value="">Bitte wählen...</option>',n.forEach(c=>{const d=document.createElement("option");d.value=c.value,d.textContent=c.label,e.appendChild(d)}),i.querySelectorAll(".tag").forEach(c=>{const d=c.dataset?.value;d&&!n.find(u=>u.value===d)&&(console.log("🗑️ Entferne ungültigen Tag:",d),c.remove(),r.delete(d))});const l=i.querySelector('select[style*="display: none"]');l&&(l.innerHTML="",r.forEach(c=>{const d=document.createElement("option");d.value=c,d.selected=!0,l.appendChild(d)}))}else console.log(`🆕 Erstelle neues Tag-basiertes System für ${t.name}`),e.innerHTML='<option value="">Bitte wählen...</option>',n.forEach(s=>{const o=document.createElement("option");o.value=s.value,o.textContent=s.label,e.appendChild(o)}),window.formSystem?.optionsManager?.createTagBasedSelect&&window.formSystem.optionsManager.createTagBasedSelect(e,n,t);console.log(`✅ Tag-basierte Multi-Select Optionen für ${t.name} aktualisiert`)}}class P{async handleRelationTables(e,t,n,a){try{const r=this.getFormConfig(e);if(!r)return;let i=[];r.sections?r.sections.forEach(s=>{i=i.concat(s.fields)}):i=r.fields;for(const s of i)if(s.relationTable&&s.relationField){const o=n[s.name];o&&await this.handleRelationTable(t,s,o)}}catch(r){console.error("❌ Fehler beim Verarbeiten der Verknüpfungstabellen:",r)}}async handleRelationTable(e,t,n){try{const a=t.relationTable,r=t.relationField;let i;t.name==="mitarbeiter_ids"||t.name==="plattform_ids"||t.name==="format_ids"?i="kampagne_id":t.name==="branche_id"&&t.relationTable==="unternehmen_branchen"?i="unternehmen_id":i=`${t.name.replace("_ids","_id")}`;const{error:s}=await window.supabase.from(a).delete().eq(i,e);if(s)throw console.error("❌ Fehler beim Löschen bestehender Verknüpfungen:",s),s;let o=[];if(Array.isArray(n)?o=n:typeof n=="string"&&n.includes(",")?o=n.split(",").map(l=>l.trim()).filter(Boolean):n&&(o=[n]),o.length>0){const l=o.map(d=>({[i]:e,[r]:d})),{error:c}=await window.supabase.from(a).insert(l);if(c)throw console.error("❌ Fehler beim Einfügen neuer Verknüpfungen:",c),c;console.log(`✅ ${o.length} Verknüpfungen in ${a} erstellt`)}console.log(`✅ Verknüpfungstabelle ${a} aktualisiert für ${e}`)}catch(a){console.error(`❌ Fehler beim Verarbeiten der Verknüpfungstabelle ${t.relationTable}:`,a)}}getFormConfig(e){return null}}const V=Object.freeze(Object.defineProperty({__proto__:null,RelationTables:P},Symbol.toStringTag,{value:"Module"}));class Ge{constructor(e){this.formSystem=e}async bindFormEvents(e,t){const n=document.getElementById(`${e}-form`);if(!n)return;n.dataset.entity=e,t&&t._isEditMode?(console.log("🎯 FORMEVENTS: Edit-Mode erkannt, setze Kontext für DynamicDataLoader"),console.log("📋 FORMEVENTS: Edit-Mode Daten:",{entityId:t._entityId,unternehmenId:t.unternehmen_id,brancheId:t.branche_id,totalFields:Object.keys(t).length}),n.dataset.editModeData=JSON.stringify(t),n.dataset.isEditMode="true",n.dataset.entityType=e,n.dataset.entityId=t._entityId,t.unternehmen_id&&(n.dataset.existingUnternehmenId=t.unternehmen_id,console.log("🏢 FORMEVENTS: Unternehmen-ID für Edit-Mode gesetzt:",t.unternehmen_id)),t.branche_id&&(n.dataset.existingBrancheId=t.branche_id,console.log("🏷️ FORMEVENTS: Branche-ID für Edit-Mode gesetzt:",t.branche_id))):console.log("ℹ️ FORMEVENTS: Kein Edit-Mode erkannt oder keine Daten verfügbar"),n.onsubmit=async r=>{r.preventDefault(),await this.formSystem.handleFormSubmit(e,t)};const a=n.querySelector(".btn-close");a&&(a.onclick=()=>this.formSystem.closeForm()),await this.formSystem.dataLoader.loadDynamicFormData(e,n),this.initializeSearchableSelects(n),this.formSystem.dependentFields.setupDependentFields(n),this.setupAddressesFields(n),this.setupVideosFields(n),this.formSystem.autoGeneration.setupAutoGeneration(n),this.formSystem.autoCalculation.initializeAutoCalculation(n),this.setupEntitySpecificEvents(e,n)}setupEntitySpecificEvents(e,t){switch(e){case"auftrag":this.setupAuftragEvents(t);break;case"kampagne":this.setupKampagneEvents(t);break;case"kooperation":this.setupKooperationEvents(t);break;case"rechnung":this.setupRechnungEvents(t);break}}setupAuftragEvents(e){const t=e.querySelector('input[name="bruttobetrag"]'),n=e.querySelector('input[name="deckungsbeitrag_prozent"]'),a=e.querySelector('input[name="deckungsbeitrag_betrag"]');if(t&&n&&a){const r=()=>{const i=parseFloat(t.value)||0,s=parseFloat(n.value)||0,o=i*s/100;a.value=o.toFixed(2)};t.addEventListener("input",r),n.addEventListener("input",r)}}setupKampagneEvents(e){const t=e.querySelector('select[name="auftrag_id"]'),n=e.querySelector('input[name="videoanzahl"]');if(!t||!n||!window.supabase)return;(()=>{if(n.dataset.stepperAttached==="true")return;try{n.type="hidden"}catch{n.style.display="none"}const o=document.createElement("div");o.className="number-stepper";const l=document.createElement("button");l.type="button",l.className="stepper-btn stepper-minus secondary-btn",l.textContent="-";const c=document.createElement("button");c.type="button",c.className="stepper-btn stepper-plus secondary-btn",c.textContent="+";const d=document.createElement("span");d.className="stepper-info",n.parentNode.insertBefore(o,n.nextSibling),o.appendChild(l),o.appendChild(c),o.appendChild(d);const u=()=>({min:parseInt(n.min||"0",10)||0,max:parseInt(n.max||"0",10)||0}),h=p=>{const{min:g,max:f}=u(),w=parseInt(p||"0",10)||0;return f?String(Math.max(g,Math.min(w,f))):""},m=()=>{const{max:p}=u(),g=parseInt(n.value||"0",10)||0,f=Math.max(0,p-g),w=g===1?"Video":"Videos";d.textContent=p>0?`${g} ${w} | Rest: ${f}`:"Bitte zuerst Auftrag wählen",l.disabled=p===0||g<=(parseInt(n.min||"0",10)||0),c.disabled=p===0||g>=p};l.addEventListener("click",()=>{const{min:p}=u(),g=parseInt(n.value||"0",10)||0,f=Math.max(p,g-1);n.value=h(String(f)),n.dispatchEvent(new Event("input",{bubbles:!0})),n.dispatchEvent(new Event("change",{bubbles:!0})),m()}),c.addEventListener("click",()=>{const{max:p}=u(),g=parseInt(n.value||"0",10)||0,f=Math.min(p,g+1);n.value=h(String(f)),n.dispatchEvent(new Event("input",{bubbles:!0})),n.dispatchEvent(new Event("change",{bubbles:!0})),m()}),n.addEventListener("input",()=>{n.value=h(n.value),m()}),n.dataset.stepperAttached="true",m()})();const r=()=>{const o=n.parentNode.querySelector(".stepper-info"),l=n.parentNode.querySelector(".stepper-minus"),c=n.parentNode.querySelector(".stepper-plus"),d=parseInt(n.max||"0",10)||0,u=parseInt(n.min||"0",10)||0,h=parseInt(n.value||"0",10)||0,m=Math.max(0,d-h),p=h===1?"Video":"Videos";o&&(o.textContent=d>0?`${h} ${p} | Rest: ${m}`:"Bitte zuerst Auftrag wählen"),l&&(l.disabled=d===0||h<=u),c&&(c.disabled=d===0||h>=d)},i=(o,l,c)=>{const d=parseInt(o,10);return isNaN(d)||c===0?"":String(Math.max(l,Math.min(d,c)))},s=async()=>{const o=t.value;if(!o){n.disabled=!0,n.removeAttribute("max"),n.removeAttribute("min"),n.value="",r();return}try{const{data:l,error:c}=await window.supabase.from("auftrag").select("id, gesamtanzahl_videos").eq("id",o).single();if(c){console.error("❌ Fehler beim Laden des Auftrags (gesamtanzahl_videos):",c);return}const d=parseInt(l?.gesamtanzahl_videos,10)||0;let u=window.supabase.from("kampagne").select("id, videoanzahl").eq("auftrag_id",o);const h=e.dataset.entityId||null;h&&(u=u.neq("id",h));const{data:m,error:p}=await u;if(p){console.error("❌ Fehler beim Laden der Kampagnen (videoanzahl):",p);return}const g=(m||[]).reduce((w,v)=>w+(parseInt(v.videoanzahl,10)||0),0),f=Math.max(0,d-g);n.disabled=f===0,n.min=f>0?"1":"0",n.max=String(f),n.step="1",n.value?n.value=i(n.value,f>0?1:0,f):f>0&&(n.value="1"),r()}catch(l){console.error("❌ Fehler beim Aktualisieren der Kampagnen-Video-Limits:",l)}};t.addEventListener("change",s),n.addEventListener("change",()=>{const o=parseInt(n.max||"0",10)||0;o>0&&(n.value=i(n.value,1,o)),r()}),e.addEventListener("submit",async o=>{const l=t.value;if(l)try{const{data:c}=await window.supabase.from("auftrag").select("gesamtanzahl_videos").eq("id",l).single(),d=parseInt(c?.gesamtanzahl_videos,10)||0;let u=window.supabase.from("kampagne").select("videoanzahl").eq("auftrag_id",l);const h=e.dataset.entityId||null;h&&(u=u.neq("id",h));const{data:m}=await u,p=(m||[]).reduce((w,v)=>w+(parseInt(v.videoanzahl,10)||0),0),g=Math.max(0,d-p);(parseInt(n.value||"0",10)||0)>g&&(o.preventDefault(),n.value=i(n.value,g>0?1:0,g),alert("Die gewählte Video Anzahl überschreitet die verfügbaren Videos dieses Auftrags."),r())}catch{}}),s()}async setupRechnungEvents(e){const t=e.querySelector('select[name="kooperation_id"]');if(!t||!window.supabase)return;const n=e.querySelector('select[name="unternehmen_id"]'),a=e.querySelector('select[name="auftrag_id"]'),r=e.querySelector('select[name="creator_id"]'),i=e.querySelector('select[name="kampagne_id"]'),s=e.querySelector('input[name="videoanzahl"]'),o=e.querySelector('input[name="nettobetrag"]'),l=e.querySelector('input[name="zusatzkosten"]');e.querySelector('input[name="ust"]');const c=e.querySelector('input[name="bruttobetrag"]');[n,a,r,i].forEach(h=>{if(h){const m=h.parentNode.querySelector(".searchable-select-container");if(m){const p=m.querySelector(".searchable-select-input");p&&p.placeholder&&h.setAttribute("data-original-placeholder",p.placeholder)}}});const d=(h,m,p)=>{if(!h)return;h.innerHTML="";const g=document.createElement("option");g.value=m||"",g.textContent=p||"—",h.appendChild(g),h.value=m||"",h.disabled=!0;const f=h.parentNode.querySelector(".searchable-select-container");if(f){const v=f.querySelector(".searchable-select-input");v&&(v.value=p||"",h.getAttribute("data-readonly")==="true"&&(v.setAttribute("disabled","true"),v.classList.add("is-disabled")),v.hasAttribute("data-was-required")&&(m&&m.trim()!==""?v.setCustomValidity(""):v.setCustomValidity("Dieses Feld ist erforderlich.")))}const w=document.getElementById(`${h.id}-hidden`);w&&(w.value=m||"")},u=async()=>{const h=t.value;if(!h){[{field:a,placeholder:"Auftrag wählen..."},{field:n,placeholder:"Unternehmen wählen..."},{field:i,placeholder:"Kampagne wählen..."},{field:r,placeholder:"Creator wählen..."}].forEach(({field:A,placeholder:E})=>{if(A){A.disabled=!1,A.setAttribute("data-readonly","false"),A.innerHTML='<option value="">Bitte wählen...</option>';const D=A.parentNode.querySelector(".searchable-select-container");if(D){const z=D.querySelector(".searchable-select-input");z&&(z.removeAttribute("disabled"),z.classList.remove("is-disabled"),z.value="",z.placeholder=E,z.hasAttribute("data-was-required")&&z.setCustomValidity("Dieses Feld ist erforderlich."))}A.getAttribute("data-table")&&window.formSystem&&window.formSystem.loadDynamicOptions(A)}}),s&&(s.value=""),o&&(o.value=""),l&&(l.value=""),c&&(c.value="");return}const{data:m,error:p}=await window.supabase.from("kooperationen").select("id, name, unternehmen_id, kampagne_id, nettobetrag, gesamtkosten, zusatzkosten, videoanzahl").eq("id",h).single();if(p){console.error("❌ Fehler beim Laden der Kooperation:",p);return}let g="";if(m?.unternehmen_id)try{const{data:S}=await window.supabase.from("unternehmen").select("id, firmenname").eq("id",m.unternehmen_id).single();g=S?.firmenname||""}catch{}d(n,m?.unternehmen_id||"",g);let f=null,w="";if(m?.kampagne_id)try{const{data:S}=await window.supabase.from("kampagne").select("auftrag_id").eq("id",m.kampagne_id).single();if(f=S?.auftrag_id||null,i){let A="";try{const{data:E}=await window.supabase.from("kampagne").select("id, kampagnenname").eq("id",m.kampagne_id).single();A=E?.kampagnenname||""}catch{}d(i,m.kampagne_id,A||`Kampagne ${m.kampagne_id}`)}if(f){const{data:A}=await window.supabase.from("auftrag").select("id, auftragsname").eq("id",f).single();w=A?.auftragsname||""}}catch(S){console.warn("⚠️ Konnte Auftrag über Kampagne nicht laden:",S)}if(d(a,f,w||(f?`Auftrag ${f}`:"")),!f&&a){console.warn("⚠️ Auftrag konnte nicht automatisch gesetzt werden. Feld wird für manuelle Auswahl freigeschaltet."),a.disabled=!1,a.setAttribute("data-readonly","false");const S=a.parentNode.querySelector(".searchable-select-container");if(S){const E=S.querySelector(".searchable-select-input");E&&(E.removeAttribute("disabled"),E.classList.remove("is-disabled"),E.placeholder="Auftrag wählen...",E.hasAttribute("data-was-required")&&E.setCustomValidity("Dieses Feld ist erforderlich."))}a.getAttribute("data-table")&&window.formSystem&&window.formSystem.loadDynamicOptions(a)}if(r)try{const{data:S}=await window.supabase.from("kooperationen").select("creator_id").eq("id",h).single(),A=S?.creator_id||null;let E="";if(A){const{data:D}=await window.supabase.from("creator").select("id, vorname, nachname").eq("id",A).single();E=D?`${D.vorname||""} ${D.nachname||""}`.trim():""}d(r,A,E)}catch(S){console.warn("⚠️ Konnte Creator nicht laden:",S)}s&&(s.value=m?.videoanzahl||"");const v=parseFloat(m?.nettobetrag||0)||0,k=parseFloat(m?.zusatzkosten||0)||0,y=m?.gesamtkosten!=null?m.gesamtkosten:v+k;o&&(o.value=v?String(v):""),l&&(l.value=k?String(k):""),c&&(c.value=isNaN(y)?"":String(y))};t.addEventListener("change",u),t.value||setTimeout(()=>u(),100),u()}setupKooperationEvents(e){const t=e.querySelector('select[name="kampagne_id"]'),n=e.querySelector('input[name="videoanzahl"]'),a=e.querySelector(".videos-container"),r=e.querySelector(".videos-list"),i=(()=>{try{return a?.dataset?.options?JSON.parse(a.dataset.options):[]}catch{return[]}})();if(!t||!n||!window.supabase)return;(()=>{if(n.dataset.stepperAttached==="true")return;try{n.type="hidden"}catch{n.style.display="none"}const d=document.createElement("div");d.className="number-stepper";const u=document.createElement("button");u.type="button",u.className="stepper-btn stepper-minus secondary-btn",u.textContent="-";const h=document.createElement("button");h.type="button",h.className="stepper-btn stepper-plus secondary-btn",h.textContent="+";const m=document.createElement("span");m.className="stepper-info",m.textContent="",n.parentNode.insertBefore(d,n.nextSibling),d.appendChild(u),d.appendChild(h),d.appendChild(m);const p=()=>({min:parseInt(n.min||"0",10)||0,max:parseInt(n.max||"0",10)||0}),g=v=>{const{min:k,max:y}=p(),S=parseInt(v||"0",10)||0;return y?String(Math.max(k,Math.min(S,y))):""},f=()=>{const{max:v}=p(),k=parseInt(n.value||"0",10)||0,y=Math.max(0,v-k),S=k===1?"Video":"Videos";m.textContent=v>0?`${k} ${S} | Rest: ${y}`:"Bitte zuerst Kampagne wählen",u.disabled=v===0||k<=(parseInt(n.min||"0",10)||0),h.disabled=v===0||k>=v},w=()=>{if(!r)return;const v=parseInt(n.value||"0",10)||0,k=r.querySelectorAll(".video-item").length;if(v>k)for(let y=0;y<v-k;y++)this.addVideoRow(r,i);else if(v<k)for(let y=0;y<k-v;y++){const S=r.querySelector(".video-item:last-of-type");S&&S.remove()}};u.addEventListener("click",()=>{const{min:v}=p(),k=parseInt(n.value||"0",10)||0,y=Math.max(v,k-1);n.value=g(String(y)),n.dispatchEvent(new Event("input",{bubbles:!0})),n.dispatchEvent(new Event("change",{bubbles:!0})),f(),w()}),h.addEventListener("click",()=>{const{max:v}=p(),k=parseInt(n.value||"0",10)||0,y=Math.min(v,k+1);n.value=g(String(y)),n.dispatchEvent(new Event("input",{bubbles:!0})),n.dispatchEvent(new Event("change",{bubbles:!0})),f(),w()}),n.addEventListener("input",()=>{n.value=g(n.value),f(),w()}),n.dataset.stepperAttached="true",f()})();const o=()=>{const d=n.parentNode.querySelector(".stepper-info"),u=n.parentNode.querySelector(".stepper-minus"),h=n.parentNode.querySelector(".stepper-plus"),m=parseInt(n.max||"0",10)||0,p=parseInt(n.min||"0",10)||0,g=parseInt(n.value||"0",10)||0,f=Math.max(0,m-g),w=g===1?"Video":"Videos";d&&(d.textContent=m>0?`${g} ${w} | Rest: ${f}`:"Bitte zuerst Kampagne wählen"),u&&(u.disabled=m===0||g<=p),h&&(h.disabled=m===0||g>=m)},l=(d,u,h)=>{const m=parseInt(d,10);return isNaN(m)||h===0?"":String(Math.max(u,Math.min(m,h)))},c=async()=>{const d=t.value;if(!d){n.disabled=!0,n.removeAttribute("max"),n.removeAttribute("min"),n.value="",o(),r&&(r.innerHTML="");return}try{const{data:u,error:h}=await window.supabase.from("kampagne").select("videoanzahl").eq("id",d).single();if(h){console.error("❌ Fehler beim Laden der Kampagne (videoanzahl):",h);return}const m=u?.videoanzahl||0,{data:p,error:g}=await window.supabase.from("kooperationen").select("videoanzahl").eq("kampagne_id",d);if(g){console.error("❌ Fehler beim Laden der Kooperationen (videoanzahl):",g);return}const f=(p||[]).reduce((k,y)=>k+(parseInt(y.videoanzahl,10)||0),0),w=Math.max(0,m-f);n.disabled=w===0,n.min=w>0?"1":"0",n.max=String(w),n.step="1",n.value?n.value=l(n.value,1,w):w>0&&(n.value="1"),o();const v=parseInt(n.value||"0",10)||0;if(r){const k=r.querySelectorAll(".video-item").length;if(v!==k){const y=v-k;if(y>0)for(let S=0;S<y;S++)this.addVideoRow(r,i);else for(let S=0;S<Math.abs(y);S++){const A=r.querySelector(".video-item:last-of-type");A&&A.remove()}}}}catch(u){console.error("❌ Fehler beim Aktualisieren der Video-Limits:",u)}};t.addEventListener("change",c),n.addEventListener("change",async()=>{const d=parseInt(n.max||"0",10)||0;if(d>0&&(n.value=l(n.value,1,d)),o(),r){const u=parseInt(n.value||"0",10)||0,h=r.querySelectorAll(".video-item").length;if(u!==h){const m=u-h;if(m>0)for(let p=0;p<m;p++)this.addVideoRow(r,i);else for(let p=0;p<Math.abs(m);p++){const g=r.querySelector(".video-item:last-of-type");g&&g.remove()}}}}),e.addEventListener("submit",async d=>{const u=t.value;if(u)try{const{data:h}=await window.supabase.from("kampagne").select("videoanzahl").eq("id",u).single(),m=h?.videoanzahl||0,{data:p}=await window.supabase.from("kooperationen").select("videoanzahl").eq("kampagne_id",u),g=(p||[]).reduce((v,k)=>v+(parseInt(k.videoanzahl,10)||0),0),f=Math.max(0,m-g);(parseInt(n.value||"0",10)||0)>f&&(d.preventDefault(),n.value=l(n.value,f>0?1:0,f),alert("Die gewählte Video Anzahl überschreitet die verfügbaren Videos dieser Kampagne."),o())}catch{}}),c(),(async()=>{try{const d=e.dataset.entityId;if(!d||!window.supabase||!r)return;const{data:u,error:h}=await window.supabase.from("kooperation_videos").select("id, content_art, titel, asset_url, kommentar, position").eq("kooperation_id",d).order("position",{ascending:!0});if(h)return;(u||[]).forEach(m=>this.addVideoRow(r,i,m)),n.value=String((u||[]).length||""),o()}catch{}})()}initializeSearchableSelects(e){console.log("⚠️ FormEvents.initializeSearchableSelects deaktiviert - wird vom Haupt-FormSystem übernommen")}setupAddressesFields(e){e.querySelectorAll(".addresses-container").forEach(n=>{const a=n.querySelector(".add-address-btn"),r=n.querySelector(".addresses-list");a&&r&&a.addEventListener("click",()=>{this.addAddressRow(r)})})}setupVideosFields(e){}addVideoRow(e,t=[],n={}){const a=`video-${Date.now()}`,r=['<option value="">Bitte wählen</option>'].concat(t.map(s=>`<option value="${s}" ${n.content_art===s?"selected":""}>${s}</option>`)).join(""),i=`
      <div class="video-item video-item-compact" data-video-id="${a}">
        <label class="sr-only">Content Art</label>
        <select name="video_content_art_${a}" class="video-content-select">
          ${r}
        </select>
      </div>`;e.insertAdjacentHTML("beforeend",i)}addAddressRow(e){const t=`address-${Date.now()}`,n=`
      <div class="address-item" data-address-id="${t}" style="
        border: 1px solid #e5e7eb;
        border-radius: 8px;
        padding: 16px;
        margin-bottom: 16px;
        background: #f9fafb;
      ">
        <div class="address-header" style="
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 16px;
        ">
          <h4 style="margin: 0; font-size: 16px; font-weight: 600; color: #374151;">Adresse ${t}</h4>
          <button type="button" class="btn-remove-address" onclick="this.closest('.address-item').remove()" style="
            background: #ef4444;
            color: white;
            border: none;
            border-radius: 4px;
            padding: 4px 8px;
            cursor: pointer;
            font-size: 12px;
            transition: background-color 0.2s;
          " onmouseover="this.style.background='#dc2626'" onmouseout="this.style.background='#ef4444'">
            Entfernen
          </button>
        </div>
        <div class="address-fields" style="
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 12px;
        ">
          <div class="form-field" style="grid-column: 1 / -1;">
            <label style="display: block; margin-bottom: 4px; font-weight: 500; color: #374151;">Adressname</label>
            <input type="text" name="adressname_${t}" placeholder="z.B. Hauptbüro, Filiale, etc." 
                   style="width: 100%; padding: 8px; border: 1px solid #d1d5db; border-radius: 4px;">
          </div>
          <div class="form-field">
            <label style="display: block; margin-bottom: 4px; font-weight: 500; color: #374151;">Straße</label>
            <input type="text" name="strasse_${t}" placeholder="Musterstraße" 
                   style="width: 100%; padding: 8px; border: 1px solid #d1d5db; border-radius: 4px;">
          </div>
          <div class="form-field">
            <label style="display: block; margin-bottom: 4px; font-weight: 500; color: #374151;">Hausnummer</label>
            <input type="text" name="hausnummer_${t}" placeholder="123" 
                   style="width: 100%; padding: 8px; border: 1px solid #d1d5db; border-radius: 4px;">
          </div>
          <div class="form-field">
            <label style="display: block; margin-bottom: 4px; font-weight: 500; color: #374151;">PLZ</label>
            <input type="text" name="plz_${t}" placeholder="12345" 
                   style="width: 100%; padding: 8px; border: 1px solid #d1d5db; border-radius: 4px;">
          </div>
          <div class="form-field">
            <label style="display: block; margin-bottom: 4px; font-weight: 500; color: #374151;">Stadt</label>
            <input type="text" name="stadt_${t}" placeholder="Musterstadt" 
                   style="width: 100%; padding: 8px; border: 1px solid #d1d5db; border-radius: 4px;">
          </div>
          <div class="form-field">
            <label style="display: block; margin-bottom: 4px; font-weight: 500; color: #374151;">Land</label>
            <input type="text" name="land_${t}" placeholder="Deutschland" 
                   style="width: 100%; padding: 8px; border: 1px solid #d1d5db; border-radius: 4px;">
          </div>
          <div class="form-field" style="grid-column: 1 / -1;">
            <label style="display: block; margin-bottom: 4px; font-weight: 500; color: #374151;">Notiz</label>
            <textarea name="notiz_${t}" rows="2" placeholder="Zusätzliche Informationen" 
                      style="width: 100%; padding: 8px; border: 1px solid #d1d5db; border-radius: 4px; resize: vertical;"></textarea>
          </div>
        </div>
      </div>
    `;e.insertAdjacentHTML("beforeend",n)}}class oe{constructor(){this.dataService=window.dataService}setDataService(e){this.dataService=e}async loadDynamicFormData(e,t){try{const n=this.getFormConfig(e);if(!n)return;const a=n.fields||[];for(const r of a)r.dynamic&&await this.loadFieldOptions(e,r,t)}catch(n){console.error("❌ Fehler beim Laden der dynamischen Formulardaten:",n)}}async loadFieldOptions(e,t,n){try{if(this.dataService||(console.error("❌ DataService ist nicht verfügbar in DynamicDataLoader"),this.dataService=window.dataService),t.dependsOn){console.log(`⏭️ Überspringe automatisches Laden für abhängiges Feld: ${t.name} (abhängig von ${t.dependsOn})`);return}let a=[];if(e==="rechnung"&&t.name==="kooperation_id")console.log("🔧 Lade Kooperationen ohne bestehende Rechnung für Rechnungsformular"),a=await this.loadKooperationenOhneRechnung(),console.log("✅ kooperation_id Optionen (ohne Rechnung):",a.length);else if(t.table)console.log(`🔧 Lade Daten direkt aus Tabelle ${t.table} für ${t.name}`),a=await this.loadDirectQueryOptions(t,n),console.log(`✅ ${t.name} Optionen geladen:`,a.length,a.slice(0,3));else switch(t.name){case"unternehmen_id":if(!window.supabase){a=(await this.dataService.loadEntities("unternehmen")).map(k=>({value:k.id,label:k.firmenname||"Unbekanntes Unternehmen"}));break}try{if(e==="kooperation"){const{data:v,error:k}=await window.supabase.from("kampagne").select("unternehmen_id").not("unternehmen_id","is",null);if(k){console.error("❌ Fehler beim Laden der Kampagnen-Unternehmen:",k);break}const y=Array.from(new Set((v||[]).map(E=>E.unternehmen_id).filter(Boolean))),{data:S,error:A}=await window.supabase.from("unternehmen").select("id, firmenname").in("id",y).order("firmenname");if(A){console.error("❌ Fehler beim Laden der Unternehmen:",A);break}a=(S||[]).map(E=>({value:E.id,label:E.firmenname||"Unbekanntes Unternehmen"}))}else if(e==="kampagne"){const{data:v,error:k}=await window.supabase.from("auftrag").select("unternehmen_id").not("unternehmen_id","is",null);if(k){console.error("❌ Fehler beim Laden der Auftrag-Unternehmen:",k);break}const y=Array.from(new Set((v||[]).map(E=>E.unternehmen_id).filter(Boolean))),{data:S,error:A}=await window.supabase.from("unternehmen").select("id, firmenname").in("id",y).order("firmenname");if(A){console.error("❌ Fehler beim Laden der Unternehmen:",A);break}a=(S||[]).map(E=>({value:E.id,label:E.firmenname||"Unbekanntes Unternehmen"}))}else if(e==="marke"){const{data:v,error:k}=await window.supabase.from("unternehmen").select("id, firmenname").order("firmenname");if(k){console.error("❌ Fehler beim Laden aller Unternehmen:",k);break}a=(v||[]).map(y=>({value:y.id,label:y.firmenname||"Unbekanntes Unternehmen"}))}else{const{data:v,error:k}=await window.supabase.from("unternehmen").select("id, firmenname").order("firmenname");if(k){console.error("❌ Fehler beim Laden aller Unternehmen:",k);break}a=(v||[]).map(y=>({value:y.id,label:y.firmenname||"Unbekanntes Unternehmen"}))}}catch(v){console.error("❌ Fehler beim Laden der Unternehmen (kontext-spezifisch):",v)}break;case"auftrag_id":a=(await this.dataService.loadEntities("auftrag")).map(v=>({value:v.id,label:v.auftragsname||"Unbekannter Auftrag"}));break;case"creator_id":a=(await this.dataService.loadEntities("creator")).map(v=>({value:v.id,label:`${v.vorname} ${v.nachname}`||"Unbekannter Creator"}));break;case"kampagne_id":a=(await this.dataService.loadEntities("kampagne")).map(v=>({value:v.id,label:v.kampagnenname||"Unbekannte Kampagne"}));break;case"creator_type_id":const{data:l,error:c}=await window.supabase.from("creator_type").select("id, name").order("name");!c&&l&&(a=l.map(v=>({value:v.id,label:v.name||"Unbekannter Typ"})),console.log("✅ Creator Types geladen:",a.length));break;case"branche_id":const{data:d,error:u}=await window.supabase.from("branchen").select("id, name, beschreibung").order("name");!u&&d&&(a=d.map(v=>({value:v.id,label:v.name||"Unbekannte Branche",description:v.beschreibung})),console.log("✅ Branchen geladen:",a.length));break;case"assignee_id":const{data:h,error:m}=await window.supabase.from("benutzer").select("id, name").order("name");m?console.error("❌ Fehler beim Laden der Benutzer:",m):h?(a=h.map(v=>({value:v.id,label:v.name||"Unbekannter Benutzer"})),console.log("✅ Benutzer geladen:",a.length,a)):console.warn("⚠️ Keine Benutzer gefunden");break;case"art_der_kampagne":const{data:p,error:g}=await window.supabase.from("kampagne_art_typen").select("id, name").order("sort_order, name");!g&&p&&(a=p.map(v=>({value:v.id,label:v.name||"Unbekannte Art"})),console.log("✅ Kampagne Art Typen geladen:",a.length));break;case"format_anpassung":const{data:f,error:w}=await window.supabase.from("format_anpassung_typen").select("id, name").order("sort_order, name");!w&&f&&(a=f.map(v=>({value:v.id,label:v.name||"Unbekanntes Format"})),console.log("✅ Format Anpassung Typen geladen:",a.length));break;default:break}const r=n.querySelector(`[name="${t.name}"]`);r?(console.log(`🔧 Update Select für ${t.name} mit ${a.length} Optionen`),this.updateSelectOptions(r,a,t)):console.log(`❌ Select-Element nicht gefunden für ${t.name}`)}catch(a){console.error(`❌ Fehler beim Laden der Optionen für ${t.name}:`,a)}}async loadKooperationenOhneRechnung(){if(!window.supabase)return[];try{const{data:e,error:t}=await window.supabase.from("rechnung").select("kooperation_id").not("kooperation_id","is",null);if(t)return console.error("❌ Fehler beim Laden vorhandener Rechnungen:",t),[];const n=Array.from(new Set((e||[]).map(o=>o.kooperation_id).filter(Boolean)));let a=window.supabase.from("kooperationen").select("id, name, kampagne_id").order("created_at",{ascending:!1});n.length>0&&(a=a.not("id","in",`(${n.join(",")})`));const{data:r,error:i}=await a;if(i)return console.error("❌ Fehler beim Laden der Kooperationen (ohne Rechnung):",i),[];let s={};try{const o=Array.from(new Set((r||[]).map(l=>l.kampagne_id).filter(Boolean)));if(o.length>0){const{data:l}=await window.supabase.from("kampagne").select("id, kampagnenname").in("id",o);s=(l||[]).reduce((c,d)=>(c[d.id]=d.kampagnenname,c),{})}}catch{}return(r||[]).map(o=>({value:o.id,label:o.name?`${o.name} ${o.kampagne_id?`— ${s[o.kampagne_id]||"Kampagne"}`:""}`:s[o.kampagne_id]||o.id}))}catch(e){return console.error("❌ Unerwarteter Fehler beim Laden der kooperation_id Optionen:",e),[]}}async loadDirectQueryOptions(e,t){try{if(!e.table)return console.warn("⚠️ Keine Tabelle für direktes Laden definiert:",e.name),[];const n=window.supabase.from(e.table).select("*");e.filter&&n.or(e.filter);const{data:a,error:r}=await n;if(r)return console.error(`❌ Fehler beim Laden der Daten aus ${e.table}:`,r),[];const i=a.map(s=>({value:s[e.valueField||"id"],label:s[e.displayField||"name"]||"Unbekannt",description:s.beschreibung||s.description}));if(t.dataset.isEditMode==="true"){if(console.log("🔍 DYNAMICDATALOADER: Edit-Modus erkannt für Feld:",e.name),e.name==="unternehmen_id"&&t.dataset.existingUnternehmenId){const o=t.dataset.existingUnternehmenId;console.log("🏢 DYNAMICDATALOADER: Markiere bestehendes Unternehmen als selected:",o),i.forEach(l=>{l.value===o&&(l.selected=!0,console.log("✅ DYNAMICDATALOADER: Unternehmen gefunden und markiert:",l.label))})}if(e.name==="branche_id"&&t.dataset.existingBrancheId){const o=t.dataset.existingBrancheId;console.log("🏷️ DYNAMICDATALOADER: Markiere bestehende Branche als selected:",o),i.forEach(l=>{l.value===o&&(l.selected=!0,console.log("✅ DYNAMICDATALOADER: Branche gefunden und markiert:",l.label))})}if(e.name==="marke_id"&&t.dataset.existingMarkeId){const o=t.dataset.existingMarkeId;console.log("🏷️ DYNAMICDATALOADER: Markiere bestehende Marke als selected:",o),i.forEach(l=>{l.value===o&&(l.selected=!0,console.log("✅ DYNAMICDATALOADER: Marke gefunden und markiert:",l.label))})}if(e.name==="auftrag_id"&&t.dataset.existingAuftragId){const o=t.dataset.existingAuftragId;console.log("📋 DYNAMICDATALOADER: Markiere bestehenden Auftrag als selected:",o),i.forEach(l=>{l.value===o&&(l.selected=!0,console.log("✅ DYNAMICDATALOADER: Auftrag gefunden und markiert:",l.label))})}const s=i.filter(o=>o.selected);s.length>0&&console.log("🎯 DYNAMICDATALOADER: Selected Optionen für",e.name,":",s.map(o=>o.label))}if(e.name==="branche_id"&&t.dataset.entityId&&(t.dataset.entityType==="unternehmen"||t.dataset.entityType==="marke"))try{const s=t.dataset.entityId;console.log("🔍 DYNAMICDATALOADER: Lade bestehende Branchen für Unternehmen:",s),console.log("🔍 DYNAMICDATALOADER: Form Datasets verfügbar:",{entityId:t.dataset.entityId,isEditMode:t.dataset.isEditMode,editModeData:!!t.dataset.editModeData,existingBranchenIds:!!t.dataset.existingBranchenIds});let o=[];if(t.dataset.editModeData)try{const l=JSON.parse(t.dataset.editModeData);l.branche_id&&Array.isArray(l.branche_id)&&(o=l.branche_id,console.log("📋 Verwende Branchen-IDs aus Edit-Mode Daten:",o))}catch(l){console.warn("⚠️ Fehler beim Parsen der Edit-Mode Daten:",l)}if(o.length===0){console.log("🔄 Lade Branchen-IDs aus Junction Table...");const l=t.dataset.entityType,c=l==="marke"?"marke_branchen":"unternehmen_branchen",d=l==="marke"?"marke_id":"unternehmen_id";console.log("🔍 DYNAMICDATALOADER: Lade aus Junction Table:",c,"mit",d,"=",s);const{data:u,error:h}=await window.supabase.from(c).select("branche_id").eq(d,s);!h&&u&&u.length>0&&(o=u.map(m=>m.branche_id),console.log("📋 Bestehende Branchen-IDs aus Junction Table:",o))}o.length>0?(o.forEach(l=>{const c=i.find(d=>d.value===l);c?(c.selected=!0,console.log("✅ Branche als ausgewählt markiert:",c.label,c.value)):console.warn("⚠️ Branche-Option nicht in verfügbaren Optionen gefunden:",l)}),console.log("✅ Insgesamt",o.length,"Branchen als ausgewählt markiert"),console.log("📋 Final Options nach Branche-Markierung:",i.map(l=>({value:l.value,label:l.label,selected:l.selected})))):console.log("ℹ️ Keine bestehenden Branchen für Unternehmen gefunden")}catch(s){console.error("❌ Fehler beim Laden der bestehenden Branchen:",s)}else if(t.dataset.entityId&&e.relationTable&&e.relationField){const s=t.dataset.entityId;let o;e.name==="mitarbeiter_ids"||e.name==="plattform_ids"||e.name==="format_ids"?o="kampagne_id":o=e.name.replace("_ids","_id");const{data:l,error:c}=await window.supabase.from(e.relationTable).select(e.relationField).eq(o,s);if(!c&&l.length>0){const d=l.map(u=>u[e.relationField]);i.forEach(u=>{d.includes(u.value)&&(u.selected=!0)})}}if(t.dataset.entityType==="kampagne"&&t.dataset.isEditMode==="true"&&await this.loadKampagneDependentFields(e,t,i),e.name==="branche_id"){const s=i.filter(o=>o.selected);console.log("🎯 DYNAMICDATALOADER: Final branche_id Optionen:",{total:i.length,selected:s.length,selectedValues:s.map(o=>({value:o.value,label:o.label}))})}return i}catch(n){return console.error("❌ Fehler beim Laden der direkten Optionen:",n),[]}}updateSelectOptions(e,t,n){console.log("🔧 Update Select-Optionen für:",n.name,"mit",t.length,"Optionen"),e.innerHTML="";const a=document.createElement("option");if(a.value="",a.textContent=n.placeholder||"Bitte wählen...",e.appendChild(a),t.forEach(r=>{const i=document.createElement("option");i.value=r.value,i.textContent=r.label,r.selected&&(i.selected=!0),e.appendChild(i)}),e.dataset.searchable==="true"){console.log("🔧 Reinitialisiere Auto-Suggestion für:",n.name);const r=t.map(s=>({value:s.value,label:s.label,selected:s.selected||!1})),i=r.filter(s=>s.selected);i.length>0&&console.log("🎯 DYNAMICDATALOADER: Übergebe selected Optionen an reinitializeSearchableSelect:",i.map(s=>s.label)),this.reinitializeSearchableSelect(e,r,n);return}}async loadKampagneDependentFields(e,t,n){try{const a=t.dataset.editModeData?JSON.parse(t.dataset.editModeData):{};if(e.name==="marke_id"&&a.unternehmen_id){console.log("🏢 DYNAMICDATALOADER: Lade Marken für Unternehmen im Kampagne Edit-Modus:",a.unternehmen_id);const{data:r,error:i}=await window.supabase.from("marke").select("id, markenname").eq("unternehmen_id",a.unternehmen_id).order("markenname");!i&&r&&(n.length=0,r.forEach(s=>{n.push({value:s.id,label:s.markenname,selected:s.id===a.marke_id})}),console.log("✅ DYNAMICDATALOADER: Marken-Optionen geladen:",n.length))}if(e.name==="auftrag_id"&&a.marke_id){console.log("🏷️ DYNAMICDATALOADER: Lade Aufträge für Marke im Kampagne Edit-Modus:",a.marke_id);const{data:r,error:i}=await window.supabase.from("auftrag").select("id, auftragsname").eq("marke_id",a.marke_id).order("auftragsname");!i&&r&&(n.length=0,r.forEach(s=>{n.push({value:s.id,label:s.auftragsname,selected:s.id===a.auftrag_id})}),console.log("✅ DYNAMICDATALOADER: Auftrags-Optionen geladen:",n.length))}}catch(a){console.error("❌ DYNAMICDATALOADER: Fehler beim Laden der Kampagne-abhängigen Felder:",a)}}reinitializeSearchableSelect(e,t,n){console.log("🔧 Reinitialisiere Searchable Select für:",n.name,"mit",t.length,"Optionen");const a=e.parentNode.querySelector(".searchable-select-container");a&&a.remove(),e.style.display="none",this.createSearchableSelect(e,t,n)}createSearchableSelect(e,t,n){console.log("🔧 Searchable Select erstellen für:",n.name)}getFormConfig(e){return null}}class We{updateSelectOptions(e,t,n){if(console.log("🔧 Update Select-Optionen für:",n.name,"mit",t.length,"Optionen"),e.dataset.searchable==="true"){console.log("🔧 Reinitialisiere Auto-Suggestion für:",n.name),this.reinitializeSearchableSelect(e,t,n);return}e.innerHTML="";const a=document.createElement("option");a.value="",a.textContent=n.placeholder||"Bitte wählen...",e.appendChild(a),t.forEach(r=>{const i=document.createElement("option");i.value=r.value,i.textContent=r.label,r.selected&&(i.selected=!0),e.appendChild(i)})}reinitializeSearchableSelect(e,t,n){const a=e.parentNode.querySelector(".searchable-select-container, .tag-based-select");a&&(console.log("🔧 Entferne bestehenden Container für:",n.name),a.remove()),e.style.display="none",this.createSearchableSelect(e,t,n)}createSearchableSelect(e,t,n){console.log("🔧 Searchable Select erstellen für:",n.name)}updateDropdownItems(e,t,n){e.innerHTML="",t.filter(r=>r.label.toLowerCase().includes(n.toLowerCase())).forEach(r=>{const i=document.createElement("div");i.className="searchable-select-item",i.textContent=r.label,i.style.cssText=`
        padding: 8px 12px;
        cursor: pointer;
        border-bottom: 1px solid #f3f4f6;
      `,i.addEventListener("click",()=>{const s=e.parentNode.parentNode.querySelector("select");s.value=r.value;const o=e.parentNode.querySelector("input");o.value=r.label,s.dispatchEvent(new Event("change")),e.classList.remove("show")}),i.addEventListener("mouseenter",()=>{i.style.backgroundColor="#f3f4f6"}),i.addEventListener("mouseleave",()=>{i.style.backgroundColor="white"}),e.appendChild(i)})}createTagBasedSelect(e,t,n){console.log(`🏷️ Erstelle Tag-basiertes Select für ${n.name} mit ${t.length} Optionen:`,t.slice(0,3));const a=e.parentNode.querySelector(".tag-based-select");a&&(console.log("🗑️ Entferne bestehenden Tag-basierten Container"),a.remove());const r=document.createElement("div");r.className="searchable-select-container tag-based-select";const i=document.createElement("input");i.type="text",i.className="searchable-select-input",i.placeholder=n.placeholder||e.dataset?.placeholder||"Suchen und Tags hinzufügen...";const s=document.createElement("div");s.className="tags-container",s.style.display="none";const o=document.createElement("div");o.className="searchable-select-dropdown";const l=document.createElement("select");l.name=e.name,l.id=e.id+"_hidden",l.multiple=!0,l.style.display="none";const c=new Set,d=(f,w)=>{const v=document.createElement("div");v.className="tag";const k=document.createElement("span");k.textContent=w;const y=document.createElement("span");return y.textContent="×",y.className="tag-remove",y.addEventListener("click",()=>{c.delete(f),s.removeChild(v),h()}),v.appendChild(k),v.appendChild(y),v},u=()=>{c.size>0?s.style.display="flex":s.style.display="none"},h=()=>{l.innerHTML="",c.forEach(w=>{const v=document.createElement("option");v.value=w,v.selected=!0,l.appendChild(v)}),u();const f=new Event("change",{bubbles:!0});l.dispatchEvent(f)},m=t.filter(f=>f.selected);console.log("🎯 Bereits ausgewählte Optionen für Tag-Select:",m),m.forEach(f=>{c.add(f.value);const w=d(f.value,f.label);s.appendChild(w),console.log(`✅ Preselected Tag hinzugefügt: ${f.label}`)}),h();const p=(f=t)=>{if(o.innerHTML="",f.length===0){const w=document.createElement("div");w.textContent="Keine Ergebnisse",w.className="searchable-select-empty",o.appendChild(w);return}f.forEach(w=>{if(c.has(w.value))return;const v=document.createElement("div");v.className="searchable-select-item",v.dataset.value=w.value;const k=document.createElement("span");if(k.className="branch-name",k.textContent=w.label,v.appendChild(k),w.description){const y=document.createElement("span");y.className="branch-description",y.textContent=w.description,v.appendChild(y)}v.classList.add("searchable-select-item"),v.addEventListener("mouseenter",()=>v.classList.add("hover")),v.addEventListener("mouseleave",()=>v.classList.remove("hover")),v.addEventListener("click",()=>{c.add(w.value);const y=d(w.value,w.label);s.appendChild(y),i.value="",o.classList.remove("show"),h(),console.log(`✅ Tag hinzugefügt: ${w.value}`)}),o.appendChild(v)})};i.addEventListener("focus",()=>{o.classList.add("show"),p()}),i.addEventListener("input",f=>{const w=f.target.value.toLowerCase(),v=t.filter(k=>k.label.toLowerCase().includes(w)&&!c.has(k.value));p(v)}),document.addEventListener("click",f=>{r.contains(f.target)||o.classList.remove("show")}),i.addEventListener("keydown",f=>{f.key==="Escape"&&o.classList.remove("show")}),r.appendChild(i),r.appendChild(s),r.appendChild(o),r.appendChild(l),e.style.display="none",e.parentNode.insertBefore(r,e);const g=r.closest("form");g&&!g.querySelector(`select[name="${l.name}"]`)&&g.appendChild(l),console.log(`✅ Tag-basierte Auto-Suggestion Select erstellt für ${n.name}`)}}let Ye=class{constructor(){this.config=new O,this.renderer=new ae,this.validator=new Ze,this.autoGeneration=new re,this.autoCalculation=new ie,this.dependentFields=new se(this.autoGeneration),this.relationTables=new P,this.dataLoader=new oe,this.optionsManager=new We,this.formEvents=new Ge(this),this.renderer.getFormConfig=this.config.getFormConfig.bind(this.config),this.relationTables.getFormConfig=this.config.getFormConfig.bind(this.config),this.dataLoader.getFormConfig=this.config.getFormConfig.bind(this.config),this.validator.getFormConfig=this.config.getFormConfig.bind(this.config),this.dependentFields.getFormConfig=this.config.getFormConfig.bind(this.config),this.dataLoader.createSearchableSelect=this.createSearchableSelect.bind(this),this.dataLoader.reinitializeSearchableSelect=this.reinitializeSearchableSelect.bind(this),this.optionsManager.createSearchableSelect=this.createSearchableSelect.bind(this),this.dependentFields.dynamicDataLoader=this.dataLoader,this.injectDataService(),this.currentForm=null}async loadDynamicOptions(e){if(!e||!e.getAttribute("data-table"))return;const t=e.getAttribute("data-table"),n=e.getAttribute("data-display-field")||"name",a=e.getAttribute("data-value-field")||"id";try{const{data:r,error:i}=await window.supabase.from(t).select(`${a}, ${n}`).order(n);if(i)throw i;e.innerHTML='<option value="">Bitte wählen...</option>';const s=r.map(o=>{const l=document.createElement("option");return l.value=o[a],l.textContent=o[n],e.appendChild(l),{value:o[a],label:o[n]}});if(e.getAttribute("data-searchable")==="true"){const o=e.parentNode.querySelector(".searchable-select-container");if(o){const l=o.querySelector(".searchable-select-dropdown"),c=o.querySelector(".searchable-select-input");l&&c&&(this.updateDropdownItems(l,s,""),c.value||(c.placeholder=e.getAttribute("data-placeholder")||"Bitte wählen..."))}}console.log(`✅ Dynamische Optionen geladen für ${e.name}: ${s.length} Optionen`)}catch(r){console.error(`❌ Fehler beim Laden der Optionen für ${t}:`,r)}}async openForm(e,t=null){try{const n=this.renderer.renderForm(e,t),a=document.createElement("div");a.className="modal-overlay",a.innerHTML=`
        <div class="modal-content">
          ${n}
        </div>
      `,document.body.appendChild(a),this.currentForm={entity:e,data:t,modal:a},await this.formEvents.bindFormEvents(e,t),console.log(`✅ Formular geöffnet: ${e}`)}catch(n){console.error("❌ Fehler beim Öffnen des Formulars:",n)}}closeForm(){this.currentForm&&this.currentForm.modal&&(document.body.removeChild(this.currentForm.modal),this.currentForm=null,console.log("✅ Formular geschlossen"))}renderFormOnly(e,t=null){return this.renderer.renderFormOnly(e,t)}async bindFormEvents(e,t){return this.formEvents.bindFormEvents(e,t)}injectDataService(){window.dataService?(this.dataLoader.setDataService(window.dataService),console.log("✅ DataService erfolgreich injiziert")):(console.warn("⚠️ DataService noch nicht verfügbar, wird später injiziert"),setTimeout(()=>this.injectDataService(),100))}async handleFormSubmit(e,t){try{const n=document.getElementById(`${e}-form`);if(!n)return;const a=new FormData(n),r={},i=n.querySelectorAll("input, select, textarea");for(const l of i){const c=l.name;if(!c)continue;let d="";l.type==="checkbox"?d=l.checked?l.value||"true":"":l.type==="radio"?l.checked&&(d=l.value):d=l.value||"",(d!==""||l.readOnly)&&(r[c]=d)}const s=this.validator.validateFormData(e,r);if(s.length>0){this.validator.showValidationErrors(s);return}let o;t&&t.id?o=await window.dataService.updateEntity(e,t.id,r):o=await window.dataService.createEntity(e,r),o.success?(await this.relationTables.handleRelationTables(e,o.id,r,n),e==="kampagne"&&await this.handleKampagneAddresses(o.id,n),e==="kooperation"&&await this.handleKooperationVideos(o.id,n),this.validator.showSuccessMessage(t?"Erfolgreich aktualisiert!":"Erfolgreich erstellt!"),this.closeForm(),window.dispatchEvent(new CustomEvent("entityUpdated",{detail:{entity:e,id:o.id,action:t?"updated":"created"}}))):this.validator.showErrorMessage(`Fehler beim ${t?"Aktualisieren":"Erstellen"}: ${o.error}`)}catch(n){console.error("❌ Fehler beim Formular-Submit:",n),this.validator.showErrorMessage("Ein unerwarteter Fehler ist aufgetreten.")}}async handleKampagneAddresses(e,t){try{const n=t.querySelector(".addresses-list");if(!n)return;const a=n.querySelectorAll(".address-item"),r=[];if(a.forEach(i=>{const s=i.dataset.addressId,o={kampagne_id:e,adressname:t.querySelector(`input[name="adressname_${s}"]`)?.value||"",strasse:t.querySelector(`input[name="strasse_${s}"]`)?.value||"",hausnummer:t.querySelector(`input[name="hausnummer_${s}"]`)?.value||"",plz:t.querySelector(`input[name="plz_${s}"]`)?.value||"",stadt:t.querySelector(`input[name="stadt_${s}"]`)?.value||"",land:t.querySelector(`input[name="land_${s}"]`)?.value||"",notiz:t.querySelector(`textarea[name="notiz_${s}"]`)?.value||""};o.adressname.trim()&&r.push(o)}),r.length>0){await window.supabase.from("kampagne_adressen").delete().eq("kampagne_id",e);const{error:i}=await window.supabase.from("kampagne_adressen").insert(r);i?console.error("❌ Fehler beim Speichern der Adressen:",i):console.log(`✅ ${r.length} Adressen für Kampagne ${e} gespeichert`)}}catch(n){console.error("❌ Fehler beim Verarbeiten der Kampagnen-Adressen:",n)}}setupAddressesFields(e){e.querySelectorAll(".addresses-container").forEach(n=>{const a=n.querySelector(".add-address-btn"),r=n.querySelector(".addresses-list");a&&r&&a.addEventListener("click",()=>{this.renderer.addAddressRow(r)})})}async handleKooperationVideos(e,t){try{if(!window.supabase)return;const n=t.querySelector(".videos-list");if(!n)return;const r=Array.from(n.querySelectorAll(".video-item")).map((i,s)=>{const o=i.getAttribute("data-video-id"),l=t.querySelector(`select[name="video_content_art_${o}"]`)?.value||null;return{kooperation_id:e,content_art:l,titel:null,asset_url:null,kommentar:null,position:s+1,created_at:new Date().toISOString(),updated_at:new Date().toISOString()}}).filter(i=>i.content_art||i.titel||i.asset_url||i.kommentar);if(await window.supabase.from("kooperation_videos").delete().eq("kooperation_id",e),r.length>0){const{data:i,error:s}=await window.supabase.from("kooperation_videos").insert(r).select("id, content_art, position");s?console.error("❌ Fehler beim Speichern der Kooperation-Videos:",s):(console.log(`✅ ${i?.length||0} Videos für Kooperation ${e} gespeichert`,i),(!i||i.length===0)&&console.warn("⚠️ Insert meldete Erfolg, aber keine Zeilen wurden zurückgegeben. Prüfe RLS/Policies für kooperation_videos."))}}catch(n){console.error("❌ Fehler in handleKooperationVideos:",n)}}initializeSearchableSelects(e){e.querySelectorAll('select[data-searchable="true"]').forEach(n=>{this.createSearchableSelect(n,[],{placeholder:n.dataset.placeholder||"Bitte wählen...",type:n.multiple?"multiselect":"select",tagBased:n.dataset.tagBased==="true"})})}createSearchableSelect(e,t,n){if((n?.type==="multiselect"||e.multiple)&&(n?.tagBased===!0||e.dataset.tagBased==="true")){if(!t||t.length===0)t=Array.from(e.options).slice(1).map(r=>({value:r.value,label:r.textContent,selected:r.selected||!1})),console.log("🔧 FORMSYSTEM: Optionen aus DOM extrahiert für Tag-basiertes Select:",t.filter(r=>r.selected));else{const r=t.filter(i=>i.selected);r.length>0&&console.log("🎯 FORMSYSTEM: Übergebe selected Optionen an OptionsManager:",r.map(i=>i.label))}return this.optionsManager.createTagBasedSelect(e,t,n)}return(!t||t.length===0)&&(t=Array.from(e.options).slice(1).map(r=>({value:r.value,label:r.textContent}))),this.createSimpleSearchableSelect(e,t,n)}createSimpleSearchableSelect(e,t,n){const a=e.parentNode.querySelector(".searchable-select-container");a&&a.remove();const r=document.createElement("div");r.className="searchable-select-container";const i=document.createElement("input");i.type="text",i.className="searchable-select-input",i.placeholder=n.placeholder||"Suchen...";const s=document.createElement("div");s.className="searchable-select-dropdown",e.style.display="none",e.hasAttribute("required")&&(e.removeAttribute("required"),i.setAttribute("required",""),i.setAttribute("data-was-required","true")),e.parentNode.insertBefore(r,e),r.appendChild(i),r.appendChild(s);const l=t.find(c=>c.selected);l&&(i.value=l.label,Array.from(e.options).forEach(c=>{c.value===l.value&&(c.selected=!0)}),console.log("✅ FORMSYSTEM: Bestehender Wert gesetzt für",n.name,":",l.label)),i.addEventListener("focus",()=>{s.classList.add("show"),this.updateDropdownItems(s,t,i.value)}),i.addEventListener("blur",()=>{setTimeout(()=>{s.classList.remove("show")},200)}),i.addEventListener("input",()=>{this.updateDropdownItems(s,t,i.value),i.hasAttribute("data-was-required")&&(i.value.trim()===""?i.setCustomValidity("Dieses Feld ist erforderlich."):i.setCustomValidity(""))}),this.updateDropdownItems(s,t,"")}updateDropdownItems(e,t,n){e.innerHTML="",t.filter(r=>r.label.toLowerCase().includes(n.toLowerCase())).forEach(r=>{const i=document.createElement("div");i.className="searchable-select-item",i.textContent=r.label,i.addEventListener("click",()=>{const s=e.parentNode.parentNode.querySelector("select");let o=Array.from(s.options).find(c=>c.value===r.value);o||(o=document.createElement("option"),o.value=r.value,o.textContent=r.label,s.appendChild(o)),s.value=r.value;const l=e.parentNode.querySelector("input");l.value=r.label,l.hasAttribute("data-was-required")&&l.setCustomValidity(""),s.dispatchEvent(new Event("change")),e.classList.remove("show"),console.log(`✅ Searchable Select ${s.name} aktualisiert: ${r.label} → ${r.value}`)}),i.addEventListener("mouseenter",()=>i.classList.add("hover")),i.addEventListener("mouseleave",()=>i.classList.remove("hover")),e.appendChild(i)})}reinitializeSearchableSelect(e,t,n){e.style.display="none",this.createSearchableSelect(e,t,n)}validateFormData(e,t){const n=[],a=this.config.getFormConfig(e);return a&&a.fields.forEach(r=>{if(r.required&&(!t[r.name]||t[r.name].toString().trim()==="")&&n.push(`${r.label} ist erforderlich.`),r.validation&&t[r.name]){const i=t[r.name];switch(r.validation.type){case"text":r.validation.minLength&&i.length<r.validation.minLength&&n.push(`${r.label} muss mindestens ${r.validation.minLength} Zeichen lang sein.`);break;case"number":r.validation.min!==void 0&&parseFloat(i)<r.validation.min&&n.push(`${r.label} muss mindestens ${r.validation.min} sein.`),r.validation.max!==void 0&&parseFloat(i)>r.validation.max&&n.push(`${r.label} darf maximal ${r.validation.max} sein.`);break;case"email":/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(i)||n.push(`${r.label} muss eine gültige E-Mail-Adresse sein.`);break;case"url":try{new URL(i)}catch{n.push(`${r.label} muss eine gültige URL sein.`)}break}}}),n}showValidationErrors(e){const t=e.join(`
`);alert(`Validierungsfehler:
${t}`)}showSuccessMessage(e){console.log(`✅ ${e}`)}showErrorMessage(e){console.error(`❌ ${e}`),alert(e)}};const le=new Ye;typeof window<"u"&&(window.formSystem=le);class de{constructor(){this.config=new O,this.renderer=new ae,this.autoGeneration=new re,this.dependentFields=new se(this.autoGeneration),this.relationTables=new P,this.dataLoader=new oe,this.renderer.getFormConfig=this.config.getFormConfig.bind(this.config),this.relationTables.getFormConfig=this.config.getFormConfig.bind(this.config),this.dataLoader.getFormConfig=this.config.getFormConfig.bind(this.config),this.dependentFields.getFormConfig=this.config.getFormConfig.bind(this.config),this.dependentFields.dynamicDataLoader=this.dataLoader,this.dataLoader.createSearchableSelect=this.createSearchableSelect.bind(this),this.dataLoader.reinitializeSearchableSelect=this.reinitializeSearchableSelect.bind(this),this.currentForm=null}async loadDynamicOptions(e){if(!e||!e.getAttribute("data-table"))return;const t=e.getAttribute("data-table"),n=e.getAttribute("data-display-field")||"name",a=e.getAttribute("data-value-field")||"id";try{const{data:r,error:i}=await window.supabase.from(t).select(`${a}, ${n}`).order(n);if(i)throw i;e.innerHTML='<option value="">Bitte wählen...</option>',r.forEach(s=>{const o=document.createElement("option");o.value=s[a],o.textContent=s[n],e.appendChild(o)})}catch(r){console.error(`❌ Fehler beim Laden der Optionen für ${t}:`,r)}}async openForm(e,t=null){try{const n=this.renderer.renderForm(e,t),a=document.createElement("div");a.className="modal-overlay",a.innerHTML=`
        <div class="modal-content">
          ${n}
        </div>
      `,document.body.appendChild(a),this.currentForm={entity:e,data:t,modal:a},await this.bindFormEvents(e,t),console.log(`✅ Formular geöffnet: ${e}`)}catch(n){console.error("❌ Fehler beim Öffnen des Formulars:",n)}}closeForm(){this.currentForm&&this.currentForm.modal&&(document.body.removeChild(this.currentForm.modal),this.currentForm=null,console.log("✅ Formular geschlossen"))}async bindFormEvents(e,t){const n=document.getElementById(`${e}-form`);if(!n)return;n.onsubmit=async r=>{r.preventDefault(),await this.handleFormSubmit(e,t)};const a=n.querySelector(".btn-close");a&&(a.onclick=()=>this.closeForm()),t&&t._isEditMode?(console.log("🎯 FORMSYSTEM: Edit-Mode erkannt, setze Kontext für DynamicDataLoader"),console.log("📋 FORMSYSTEM: Edit-Mode Daten:",{entityId:t._entityId,brancheIds:t.branche_id,totalFields:Object.keys(t).length}),n.dataset.editModeData=JSON.stringify(t),t.branche_id&&Array.isArray(t.branche_id)?console.log("🏷️ FORMSYSTEM: Branchen-IDs für Edit-Mode verfügbar:",t.branche_id):console.log("ℹ️ FORMSYSTEM: Keine Branchen-IDs im Edit-Mode vorhanden")):console.log("ℹ️ FORMSYSTEM: Kein Edit-Mode erkannt oder keine Daten verfügbar"),await this.dataLoader.loadDynamicFormData(e,n),this.dependentFields.setupDependentFields(n),this.setupAddressesFields(n),this.autoGeneration.setupAutoGeneration(n)}async handleFormSubmit(e,t){try{const n=document.getElementById(`${e}-form`);if(!n)return;const a=new FormData(n),r={};console.log("📤 FormData sammeln...");const i=n.querySelectorAll('select[data-tag-based="true"]');console.log("🏷️ Tag-basierte Selects gefunden:",i.length),i.forEach(d=>{console.log(`🔍 Verarbeite Tag-basiertes Select: ${d.name}`);const u=n.querySelectorAll(`select[name^="${d.name}"]`);console.log(`🔍 Alle Selects für ${d.name}:`,u.length,Array.from(u).map(m=>({name:m.name,hidden:m.style.display==="none",options:m.options.length})));let h=n.querySelector(`select[name="${d.name}[]"][style*="display: none"]`);if(console.log("🔍 Verstecktes Select mit [] gefunden:",!!h),h||(h=n.querySelector(`select[name="${d.name}"][style*="display: none"]`),console.log("🔍 Verstecktes Select ohne [] gefunden:",!!h)),h||u.length>1&&(h=u[1],console.log("🔍 Fallback: Zweites Select verwendet:",!!h)),h){console.log("🔍 Verstecktes Select Details:",{name:h.name,optionsCount:h.options.length,selectedCount:h.selectedOptions.length});const m=Array.from(h.selectedOptions).map(p=>p.value).filter(p=>p!=="");console.log("🔍 Ausgewählte Werte:",m),m.length>0&&(r[d.name]=m,console.log(`🏷️ Tag-basiertes Multi-Select ${d.name}:`,m))}else console.log(`⚠️ Verstecktes Select für ${d.name} nicht gefunden`)});const s=n.querySelectorAll('select[multiple]:not([data-tag-based="true"])');console.log("🔧 Normale Multi-Select Felder gefunden:",s.length),s.forEach(d=>{const u=Array.from(d.selectedOptions).map(h=>h.value).filter(h=>h!=="");u.length>0&&(r[d.name]=u,console.log(`✅ Multi-Select ${d.name}:`,u))});for(const[d,u]of a.entries())if(u!=="")if(d.includes("[]")){const h=d.replace("[]","");r[h]||(r[h]=[]),r[h].push(u),console.log(`📤 Multi-Select Array ${h}: ${u}`)}else r.hasOwnProperty(d)||(r[d]=u,console.log(`📤 FormData ${d}: ${u}`));const o=n.querySelectorAll('select[data-searchable="true"]');console.log("🔧 Searchable Selects gefunden:",o.length),o.forEach(d=>{console.log(`🔧 Prüfe Select ${d.name}:`,{value:d.value,options:d.options.length,selectedIndex:d.selectedIndex}),d.value&&d.value!==""?(r[d.name]=d.value,console.log(`✅ Searchable Select ${d.name}: ${d.value}`)):console.log(`❌ Searchable Select ${d.name}: Kein Wert`)}),console.log("📤 Finale Submit-Daten:",r);const l=this.validateFormData(e,r);if(l.length>0){this.showValidationErrors(l);return}let c;t&&t.id?c=await window.dataService.updateEntity(e,t.id,r):c=await window.dataService.createEntity(e,r),c.success?(await this.relationTables.handleRelationTables(e,c.id,r,n),e==="kampagne"&&await this.handleKampagneAddresses(c.id,n),this.showSuccessMessage(t?"Erfolgreich aktualisiert!":"Erfolgreich erstellt!"),this.closeForm(),window.dispatchEvent(new CustomEvent("entityUpdated",{detail:{entity:e,id:c.id,action:t?"updated":"created"}}))):this.showErrorMessage(`Fehler beim ${t?"Aktualisieren":"Erstellen"}: ${c.error}`)}catch(n){console.error("❌ Fehler beim Formular-Submit:",n),this.showErrorMessage("Ein unerwarteter Fehler ist aufgetreten.")}}async handleKampagneAddresses(e,t){try{const n=t.querySelector(".addresses-list");if(!n)return;const a=n.querySelectorAll(".address-item"),r=[];if(a.forEach(i=>{const s=i.dataset.addressId,o={kampagne_id:e,adressname:t.querySelector(`input[name="adressname_${s}"]`)?.value||"",strasse:t.querySelector(`input[name="strasse_${s}"]`)?.value||"",hausnummer:t.querySelector(`input[name="hausnummer_${s}"]`)?.value||"",plz:t.querySelector(`input[name="plz_${s}"]`)?.value||"",stadt:t.querySelector(`input[name="stadt_${s}"]`)?.value||"",land:t.querySelector(`input[name="land_${s}"]`)?.value||"",notiz:t.querySelector(`textarea[name="notiz_${s}"]`)?.value||""};o.adressname.trim()&&r.push(o)}),r.length>0){await window.supabase.from("kampagne_adressen").delete().eq("kampagne_id",e);const{error:i}=await window.supabase.from("kampagne_adressen").insert(r);i?console.error("❌ Fehler beim Speichern der Adressen:",i):console.log(`✅ ${r.length} Adressen für Kampagne ${e} gespeichert`)}}catch(n){console.error("❌ Fehler beim Verarbeiten der Kampagnen-Adressen:",n)}}setupAddressesFields(e){e.querySelectorAll(".addresses-container").forEach(n=>{const a=n.querySelector(".add-address-btn"),r=n.querySelector(".addresses-list");a&&r&&a.addEventListener("click",()=>{this.renderer.addAddressRow(r)})})}initializeSearchableSelects(e){e.querySelectorAll('select[data-searchable="true"]').forEach(n=>{if(n.options.length>1){const r=Array.from(n.options).slice(1).map(i=>({value:i.value,label:i.textContent}));console.log(`🔧 Initialisiere Searchable Select ${n.name} mit ${r.length} Optionen`),this.createSearchableSelect(n,r,{placeholder:n.dataset.placeholder||"Bitte wählen..."})}else console.log(`🔧 Initialisiere Searchable Select ${n.name} mit leeren Optionen`),this.createSearchableSelect(n,[],{placeholder:n.dataset.placeholder||"Bitte wählen..."})})}createSearchableSelect(e,t,n){if((n?.type==="multiselect"||e.multiple)&&(n?.tagBased===!0||e.dataset.tagBased==="true")&&window.formSystem?.optionsManager?.createTagBasedSelect)return window.formSystem.optionsManager.createTagBasedSelect(e,t,n);const r=e.parentNode.querySelector(".searchable-select-container");r&&r.remove();const i=document.createElement("div");i.className="searchable-select-container",i.style.position="relative";const s=document.createElement("input");s.type="text",s.className="searchable-select-input",s.placeholder=n.placeholder||"Suchen...",s.style.cssText=`
      width: 100%;
      padding: 8px 12px;
      border: 1px solid #d1d5db;
      border-radius: 6px;
      font-size: 14px;
      background: white;
    `;const o=document.createElement("div");o.className="searchable-select-dropdown",o.style.cssText=`
      position: absolute;
      top: 100%;
      left: 0;
      right: 0;
      background: white;
      border: 1px solid #d1d5db;
      border-top: none;
      border-radius: 0 0 6px 6px;
      max-height: 200px;
      overflow-y: auto;
      z-index: 1000;
      display: none;
    `,e.style.display="none",e.parentNode.insertBefore(i,e),i.appendChild(s),i.appendChild(o),s.addEventListener("focus",()=>{o.style.display="block",this.updateDropdownItems(o,t,s.value)}),s.addEventListener("blur",()=>{setTimeout(()=>{o.style.display="none"},200)}),s.addEventListener("input",()=>{this.updateDropdownItems(o,t,s.value)}),this.updateDropdownItems(o,t,"")}updateDropdownItems(e,t,n){e.innerHTML="",t.filter(r=>r.label.toLowerCase().includes(n.toLowerCase())).forEach(r=>{const i=document.createElement("div");i.className="searchable-select-item",i.textContent=r.label,i.style.cssText=`
        padding: 8px 12px;
        cursor: pointer;
        border-bottom: 1px solid #f3f4f6;
      `,i.addEventListener("click",()=>{const s=e.parentNode,o=s.parentNode.querySelector("select");if(o){o.value=r.value,console.log(`🔧 Select ${o.name} auf Wert gesetzt:`,r.value);const l=s.querySelector("input");l&&(l.value=r.label),o.dispatchEvent(new Event("change"))}else console.error("❌ Select-Element nicht gefunden für Dropdown");e.style.display="none"}),i.addEventListener("mouseenter",()=>{i.style.backgroundColor="#f3f4f6"}),i.addEventListener("mouseleave",()=>{i.style.backgroundColor="white"}),e.appendChild(i)})}initializeSearchableSelectValue(e,t,n){console.log(`🔧 Initialisiere Searchable Select für ${n.name} mit vorausgewähltem Wert`);const a=t.find(r=>r.selected);if(a){console.log(`✅ Vorausgewählte Option gefunden: ${a.label}`),e.value=a.value;const r=e.parentNode.querySelector(".searchable-select-container");if(r){const i=r.querySelector("input");i&&(i.value=a.label,console.log(`✅ Input-Wert gesetzt: ${a.label}`))}}}reinitializeSearchableSelect(e,t,n){this.createSearchableSelect(e,t,n),this.initializeSearchableSelectValue(e,t,n)}validateFormData(e,t){const n=[],a=this.config.getFormConfig(e);return a&&a.fields.forEach(r=>{if(r.required&&(!t[r.name]||t[r.name].toString().trim()==="")&&n.push(`${r.label} ist erforderlich.`),r.validation&&t[r.name]){const i=t[r.name];switch(r.validation.type){case"text":r.validation.minLength&&i.length<r.validation.minLength&&n.push(`${r.label} muss mindestens ${r.validation.minLength} Zeichen lang sein.`);break;case"number":r.validation.min!==void 0&&parseFloat(i)<r.validation.min&&n.push(`${r.label} muss mindestens ${r.validation.min} sein.`),r.validation.max!==void 0&&parseFloat(i)>r.validation.max&&n.push(`${r.label} darf maximal ${r.validation.max} sein.`);break;case"email":/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(i)||n.push(`${r.label} muss eine gültige E-Mail-Adresse sein.`);break;case"url":try{new URL(i)}catch{n.push(`${r.label} muss eine gültige URL sein.`)}break}}}),n}showValidationErrors(e){const t=e.join(`
`);alert(`Validierungsfehler:
${t}`)}showSuccessMessage(e){console.log(`✅ ${e}`)}showErrorMessage(e){console.error(`❌ ${e}`),alert(e)}}class Je{constructor(){this.currentEntity=null,this.currentEntityId=null}async init(e,t){console.log("📝 NOTIZENSYSTEM: Initialisiere für",e,t),this.currentEntity=e,this.currentEntityId=t}async loadNotizen(e,t){console.log("🔄 NOTIZENSYSTEM: Lade Notizen für",e,t);try{const n=this.getNotizenTable(e);if(!n)return console.warn("⚠️ NOTIZENSYSTEM: Keine Notizen-Tabelle für",e),[];let a="*";n==="creator_notiz"&&(a+=`,
          kampagne:kampagne_id (
            id,
            kampagnenname,
            unternehmen:unternehmen_id (
              id,
              firmenname
            ),
            marke:marke_id (
              id,
              markenname
            )
          )`);const{data:r,error:i}=await window.supabase.from(n).select(a).eq(`${e}_id`,t).order("created_at",{ascending:!1});return i?(console.error("❌ NOTIZENSYSTEM: Fehler beim Laden der Notizen:",i),[]):(console.log("✅ NOTIZENSYSTEM: Notizen geladen:",r?.length||0),r||[])}catch(n){return console.error("❌ NOTIZENSYSTEM: Fehler beim Laden der Notizen:",n),[]}}async createNotiz(e,t,n){console.log("📝 NOTIZENSYSTEM: Erstelle Notiz für",e,t);try{const a=this.getNotizenTable(e);if(!a)throw new Error(`Keine Notizen-Tabelle für ${e} gefunden`);const r={[`${e}_id`]:t,text:n.text,user_name:n.user_name||"System",kampagne_id:n.kampagne_id||null,created_at:new Date().toISOString()},{data:i,error:s}=await window.supabase.from(a).insert(r).select().single();if(s)throw new Error(`Fehler beim Erstellen der Notiz: ${s.message}`);return console.log("✅ NOTIZENSYSTEM: Notiz erstellt:",i),{success:!0,data:i}}catch(a){return console.error("❌ NOTIZENSYSTEM: Fehler beim Erstellen der Notiz:",a),{success:!1,error:a.message}}}async deleteNotiz(e,t){console.log("🗑️ NOTIZENSYSTEM: Lösche Notiz",t);try{const n=this.getNotizenTable(e);if(!n)throw new Error(`Keine Notizen-Tabelle für ${e} gefunden`);const{error:a}=await window.supabase.from(n).delete().eq("id",t);if(a)throw new Error(`Fehler beim Löschen der Notiz: ${a.message}`);return console.log("✅ NOTIZENSYSTEM: Notiz gelöscht"),{success:!0}}catch(n){return console.error("❌ NOTIZENSYSTEM: Fehler beim Löschen der Notiz:",n),{success:!1,error:n.message}}}async updateNotiz(e,t,n){console.log("✏️ NOTIZENSYSTEM: Aktualisiere Notiz",t);try{const a=this.getNotizenTable(e);if(!a)throw new Error(`Keine Notizen-Tabelle für ${e} gefunden`);const r={text:n.text,kampagne_id:n.kampagne_id||null,updated_at:new Date().toISOString()},{data:i,error:s}=await window.supabase.from(a).update(r).eq("id",t).select().single();if(s)throw new Error(`Fehler beim Aktualisieren der Notiz: ${s.message}`);return console.log("✅ NOTIZENSYSTEM: Notiz aktualisiert:",i),{success:!0,data:i}}catch(a){return console.error("❌ NOTIZENSYSTEM: Fehler beim Aktualisieren der Notiz:",a),{success:!1,error:a.message}}}getNotizenTable(e){return{creator:"creator_notiz",kampagne:"creator_notiz",briefing:"briefing_notiz",kooperation:"kooperation_notiz"}[e]||null}renderNotizenContainer(e,t,n){return!e||e.length===0?`
        <div class="notizen-container">
          <div class="empty-state">
            <p>Noch keine Notizen vorhanden.</p>
            <button class="primary-btn" onclick="window.notizenSystem.showAddNotizModal('${t}', '${n}')">
              Notiz hinzufügen
            </button>
          </div>
        </div>
      `:`
      <div class="notizen-container">
        ${e.map(r=>`
      <div class="notiz-card" data-notiz-id="${r.id}">
        <div class="notiz-header">
          <span class="notiz-date">${this.formatDate(r.created_at)}</span>
          <span class="notiz-user">${r.user_name||"Unbekannt"}</span>
          <div class="notiz-actions">
            <button class="icon-btn edit-notiz" onclick="window.notizenSystem.showEditNotizModal('${t}', '${r.id}')" title="Bearbeiten">
              <i class="icon-pencil"></i>
            </button>
            <button class="icon-btn delete-notiz" onclick="window.notizenSystem.deleteNotiz('${t}', '${r.id}')" title="Löschen">
              <i class="icon-trash"></i>
            </button>
          </div>
        </div>
        <div class="notiz-content">
          <p>${r.text}</p>
        </div>
        ${r.kampagne?`
          <div class="notiz-kampagne">
            <small>Kampagne: <a href="#" data-kampagne-id="${r.kampagne.id}">${r.kampagne.kampagnenname}</a></small>
          </div>
        `:""}
      </div>
    `).join("")}
        <button class="primary-btn" onclick="window.notizenSystem.showAddNotizModal('${t}', '${n}')">
          Neue Notiz hinzufügen
        </button>
      </div>
    `}showAddNotizModal(e,t){console.log("📝 NOTIZENSYSTEM: Zeige Add Notiz Modal für",e,t),document.body.insertAdjacentHTML("beforeend",`
      <div class="modal-overlay" id="notiz-modal">
        <div class="modal-content">
          <div class="modal-header">
            <h3>Neue Notiz hinzufügen</h3>
            <button class="modal-close" onclick="window.notizenSystem.closeModal()">
              <i class="icon-x"></i>
            </button>
          </div>
          <div class="modal-body">
            <form id="add-notiz-form">
              <div class="form-group">
                <label for="notiz-text">Notiz</label>
                <textarea id="notiz-text" name="text" rows="4" required placeholder="Notiz eingeben..."></textarea>
              </div>
              <div class="form-group">
                <label for="notiz-kampagne">Kampagne (optional)</label>
                <select id="notiz-kampagne" name="kampagne_id">
                  <option value="">Keine Kampagne</option>
                  <!-- Kampagnen werden dynamisch geladen -->
                </select>
              </div>
              <div class="form-actions">
                <button type="button" class="secondary-btn" onclick="window.notizenSystem.closeModal()">Abbrechen</button>
                <button type="submit" class="primary-btn">Notiz speichern</button>
              </div>
            </form>
          </div>
        </div>
      </div>
    `),this.loadKampagnenForSelect(),this.bindNotizFormEvents(e,t)}showEditNotizModal(e,t){console.log("✏️ NOTIZENSYSTEM: Zeige Edit Notiz Modal für",e,t),console.log("TODO: Edit Notiz Modal implementieren")}async loadKampagnenForSelect(){try{const{data:e,error:t}=await window.supabase.from("kampagne").select(`
          id,
          kampagnenname,
          unternehmen:unternehmen_id (
            id,
            firmenname
          ),
          marke:marke_id (
            id,
            markenname
          )
        `).order("kampagnenname");if(!t&&e){const n=document.getElementById("notiz-kampagne");n&&e.forEach(a=>{const r=document.createElement("option");r.value=a.id,r.textContent=`${a.kampagnenname} (${a.unternehmen?.firmenname||"Unbekannt"})`,n.appendChild(r)})}}catch(e){console.error("❌ NOTIZENSYSTEM: Fehler beim Laden der Kampagnen:",e)}}bindNotizFormEvents(e,t){const n=document.getElementById("add-notiz-form");n&&(n.onsubmit=async a=>{a.preventDefault(),await this.handleNotizSubmit(e,t)})}async handleNotizSubmit(e,t){try{const n=document.getElementById("add-notiz-form"),a=new FormData(n),r={text:a.get("text"),kampagne_id:a.get("kampagne_id")||null,user_name:"Aktueller Benutzer"},i=await this.createNotiz(e,t,r);i.success?(this.showSuccessMessage("Notiz erfolgreich erstellt!"),this.closeModal(),window.dispatchEvent(new CustomEvent("notizenUpdated",{detail:{entityType:e,entityId:t}}))):this.showErrorMessage(i.error)}catch(n){console.error("❌ NOTIZENSYSTEM: Fehler beim Erstellen der Notiz:",n),this.showErrorMessage(n.message)}}closeModal(){const e=document.getElementById("notiz-modal");e&&e.remove()}showSuccessMessage(e){console.log("✅",e)}showErrorMessage(e){console.error("❌",e)}formatDate(e){return e?new Date(e).toLocaleDateString("de-DE"):"-"}destroy(){console.log("🗑️ NOTIZENSYSTEM: Destroy aufgerufen"),this.closeModal()}}const Qe=new Je;class Xe{constructor(){this.currentEntity=null,this.currentEntityId=null}async init(e,t){console.log("⭐ BEWERTUNGSSYSTEM: Initialisiere für",e,t),this.currentEntity=e,this.currentEntityId=t}async loadBewertungen(e,t){console.log("🔄 BEWERTUNGSSYSTEM: Lade Bewertungen für",e,t);try{const n=this.getBewertungsTable(e);if(!n)return console.warn("⚠️ BEWERTUNGSSYSTEM: Keine Bewertungs-Tabelle für",e),[];if(e==="kooperation"){const{data:i,error:s}=await window.supabase.from("kooperationen").select(`
            id,
            bewertung,
            created_at,
            updated_at
          `).eq("id",t).single();return s?(console.error("❌ BEWERTUNGSSYSTEM: Fehler beim Laden der Kooperation:",s),[]):i.bewertung?[{id:i.id,rating:i.bewertung,created_at:i.created_at,updated_at:i.updated_at,user_name:"System"}]:[]}const{data:a,error:r}=await window.supabase.from(n).select(`
          *,
          kampagne:kampagne_id (
            id,
            kampagnenname,
            unternehmen:unternehmen_id (
              id,
              firmenname
            ),
            marke:marke_id (
              id,
              markenname
            )
          )
        `).eq(`${e}_id`,t).order("created_at",{ascending:!1});return r?(console.error("❌ BEWERTUNGSSYSTEM: Fehler beim Laden der Bewertungen:",r),[]):(console.log("✅ BEWERTUNGSSYSTEM: Bewertungen geladen:",a?.length||0),a||[])}catch(n){return console.error("❌ BEWERTUNGSSYSTEM: Fehler beim Laden der Bewertungen:",n),[]}}async createBewertung(e,t,n){console.log("⭐ BEWERTUNGSSYSTEM: Erstelle Bewertung für",e,t);try{const a=this.getBewertungsTable(e);if(!a)throw new Error(`Keine Bewertungs-Tabelle für ${e} gefunden`);if(e==="kooperation"){const{data:o,error:l}=await window.supabase.from("kooperationen").update({bewertung:n.rating,updated_at:new Date().toISOString()}).eq("id",t).select().single();if(l)throw new Error(`Fehler beim Erstellen der Bewertung: ${l.message}`);return console.log("✅ BEWERTUNGSSYSTEM: Bewertung erstellt:",o),{success:!0,data:o}}const r={[`${e}_id`]:t,rating:n.rating,user_name:n.user_name||"System",kampagne_id:n.kampagne_id||null,created_at:new Date().toISOString()},{data:i,error:s}=await window.supabase.from(a).insert(r).select().single();if(s)throw new Error(`Fehler beim Erstellen der Bewertung: ${s.message}`);return console.log("✅ BEWERTUNGSSYSTEM: Bewertung erstellt:",i),{success:!0,data:i}}catch(a){return console.error("❌ BEWERTUNGSSYSTEM: Fehler beim Erstellen der Bewertung:",a),{success:!1,error:a.message}}}async deleteBewertung(e,t){console.log("🗑️ BEWERTUNGSSYSTEM: Lösche Bewertung",t);try{const n=this.getBewertungsTable(e);if(!n)throw new Error(`Keine Bewertungs-Tabelle für ${e} gefunden`);if(e==="kooperation"){const{error:r}=await window.supabase.from("kooperationen").update({bewertung:null,updated_at:new Date().toISOString()}).eq("id",t);if(r)throw new Error(`Fehler beim Löschen der Bewertung: ${r.message}`);return console.log("✅ BEWERTUNGSSYSTEM: Bewertung gelöscht"),{success:!0}}const{error:a}=await window.supabase.from(n).delete().eq("id",t);if(a)throw new Error(`Fehler beim Löschen der Bewertung: ${a.message}`);return console.log("✅ BEWERTUNGSSYSTEM: Bewertung gelöscht"),{success:!0}}catch(n){return console.error("❌ BEWERTUNGSSYSTEM: Fehler beim Löschen der Bewertung:",n),{success:!1,error:n.message}}}async updateBewertung(e,t,n){console.log("✏️ BEWERTUNGSSYSTEM: Aktualisiere Bewertung",t);try{const a=this.getBewertungsTable(e);if(!a)throw new Error(`Keine Bewertungs-Tabelle für ${e} gefunden`);if(e==="kooperation"){const{data:o,error:l}=await window.supabase.from("kooperationen").update({bewertung:n.rating,updated_at:new Date().toISOString()}).eq("id",t).select().single();if(l)throw new Error(`Fehler beim Aktualisieren der Bewertung: ${l.message}`);return console.log("✅ BEWERTUNGSSYSTEM: Bewertung aktualisiert:",o),{success:!0,data:o}}const r={rating:n.rating,kampagne_id:n.kampagne_id||null,updated_at:new Date().toISOString()},{data:i,error:s}=await window.supabase.from(a).update(r).eq("id",t).select().single();if(s)throw new Error(`Fehler beim Aktualisieren der Bewertung: ${s.message}`);return console.log("✅ BEWERTUNGSSYSTEM: Bewertung aktualisiert:",i),{success:!0,data:i}}catch(a){return console.error("❌ BEWERTUNGSSYSTEM: Fehler beim Aktualisieren der Bewertung:",a),{success:!1,error:a.message}}}getBewertungsTable(e){return{creator:"creator_rating",kampagne:"creator_rating",kooperation:"kooperationen",briefing:"briefing_rating"}[e]||null}renderBewertungenContainer(e,t,n){return!e||e.length===0?`
        <div class="bewertungen-container">
          <div class="empty-state">
            <p>Noch keine Bewertungen vorhanden.</p>
            <button class="primary-btn" onclick="window.bewertungsSystem.showAddBewertungModal('${t}', '${n}')">
              Bewertung hinzufügen
            </button>
          </div>
        </div>
      `:`
      <div class="bewertungen-container">
        ${e.map(r=>`
      <div class="bewertung-card" data-bewertung-id="${r.id}">
        <div class="bewertung-header">
          <div class="bewertung-stars">
            ${this.renderStars(r.rating)}
          </div>
          <span class="bewertung-date">${this.formatDate(r.created_at)}</span>
          <span class="bewertung-user">${r.user_name||"Unbekannt"}</span>
          <div class="bewertung-actions">
            <button class="icon-btn edit-bewertung" onclick="window.bewertungsSystem.showEditBewertungModal('${t}', '${r.id}')" title="Bearbeiten">
              <i class="icon-pencil"></i>
            </button>
            <button class="icon-btn delete-bewertung" onclick="window.bewertungsSystem.deleteBewertung('${t}', '${r.id}')" title="Löschen">
              <i class="icon-trash"></i>
            </button>
          </div>
        </div>
        ${r.kampagne?`
          <div class="bewertung-kampagne">
            <small>Kampagne: <a href="#" data-kampagne-id="${r.kampagne.id}">${r.kampagne.kampagnenname}</a></small>
          </div>
        `:""}
      </div>
    `).join("")}
        <button class="primary-btn" onclick="window.bewertungsSystem.showAddBewertungModal('${t}', '${n}')">
          Neue Bewertung hinzufügen
        </button>
      </div>
    `}renderStars(e){const t=[];for(let n=1;n<=5;n++)t.push(`<span class="star ${n<=e?"filled":""}">★</span>`);return t.join("")}showAddBewertungModal(e,t){console.log("⭐ BEWERTUNGSSYSTEM: Zeige Add Bewertung Modal für",e,t),document.body.insertAdjacentHTML("beforeend",`
      <div class="modal-overlay" id="bewertung-modal">
        <div class="modal-content">
          <div class="modal-header">
            <h3>Neue Bewertung hinzufügen</h3>
            <button class="modal-close" onclick="window.bewertungsSystem.closeModal()">
              <i class="icon-x"></i>
            </button>
          </div>
          <div class="modal-body">
            <form id="add-bewertung-form">
              <div class="form-group">
                <label>Bewertung</label>
                <div class="rating-input">
                  <div class="stars-container">
                    <span class="star-input" data-rating="1">★</span>
                    <span class="star-input" data-rating="2">★</span>
                    <span class="star-input" data-rating="3">★</span>
                    <span class="star-input" data-rating="4">★</span>
                    <span class="star-input" data-rating="5">★</span>
                  </div>
                  <input type="hidden" id="bewertung-rating" name="rating" value="0" required>
                  <div class="rating-text">Bitte wählen Sie eine Bewertung</div>
                </div>
              </div>
              <div class="form-group">
                <label for="bewertung-kampagne">Kampagne (optional)</label>
                <select id="bewertung-kampagne" name="kampagne_id">
                  <option value="">Keine Kampagne</option>
                  <!-- Kampagnen werden dynamisch geladen -->
                </select>
              </div>
              <div class="form-actions">
                <button type="button" class="secondary-btn" onclick="window.bewertungsSystem.closeModal()">Abbrechen</button>
                <button type="submit" class="primary-btn">Bewertung speichern</button>
              </div>
            </form>
          </div>
        </div>
      </div>
    `),this.loadKampagnenForSelect(),this.bindStarEvents(),this.bindBewertungFormEvents(e,t)}showEditBewertungModal(e,t){console.log("✏️ BEWERTUNGSSYSTEM: Zeige Edit Bewertung Modal für",e,t),console.log("TODO: Edit Bewertung Modal implementieren")}async loadKampagnenForSelect(){try{const{data:e,error:t}=await window.supabase.from("kampagne").select(`
          id,
          kampagnenname,
          unternehmen:unternehmen_id (
            id,
            firmenname
          ),
          marke:marke_id (
            id,
            markenname
          )
        `).order("kampagnenname");if(!t&&e){const n=document.getElementById("bewertung-kampagne");n&&e.forEach(a=>{const r=document.createElement("option");r.value=a.id,r.textContent=`${a.kampagnenname} (${a.unternehmen?.firmenname||"Unbekannt"})`,n.appendChild(r)})}}catch(e){console.error("❌ BEWERTUNGSSYSTEM: Fehler beim Laden der Kampagnen:",e)}}bindStarEvents(){const e=document.querySelectorAll(".star-input"),t=document.getElementById("bewertung-rating"),n=document.querySelector(".rating-text");e.forEach(a=>{a.addEventListener("click",()=>{const r=parseInt(a.dataset.rating);t.value=r,e.forEach((s,o)=>{s.classList.toggle("filled",o<r)});const i=["","Sehr schlecht","Schlecht","Okay","Gut","Sehr gut"];n.textContent=i[r]||"Bitte wählen Sie eine Bewertung"}),a.addEventListener("mouseenter",()=>{const r=parseInt(a.dataset.rating);e.forEach((i,s)=>{i.classList.toggle("filled",s<r)})}),a.addEventListener("mouseleave",()=>{const r=parseInt(t.value)||0;e.forEach((i,s)=>{i.classList.toggle("filled",s<r)})})})}bindBewertungFormEvents(e,t){const n=document.getElementById("add-bewertung-form");n&&(n.onsubmit=async a=>{a.preventDefault(),await this.handleBewertungSubmit(e,t)})}async handleBewertungSubmit(e,t){try{const n=document.getElementById("add-bewertung-form"),a=new FormData(n),r=parseInt(a.get("rating"));if(r===0){this.showErrorMessage("Bitte wählen Sie eine Bewertung aus.");return}const i={rating:r,kampagne_id:a.get("kampagne_id")||null,user_name:"Aktueller Benutzer"},s=await this.createBewertung(e,t,i);s.success?(this.showSuccessMessage("Bewertung erfolgreich erstellt!"),this.closeModal(),window.dispatchEvent(new CustomEvent("bewertungenUpdated",{detail:{entityType:e,entityId:t}}))):this.showErrorMessage(s.error)}catch(n){console.error("❌ BEWERTUNGSSYSTEM: Fehler beim Erstellen der Bewertung:",n),this.showErrorMessage(n.message)}}closeModal(){const e=document.getElementById("bewertung-modal");e&&e.remove()}showSuccessMessage(e){console.log("✅",e)}showErrorMessage(e){console.error("❌",e)}formatDate(e){return e?new Date(e).toLocaleDateString("de-DE"):"-"}destroy(){console.log("🗑️ BEWERTUNGSSYSTEM: Destroy aufgerufen"),this.closeModal()}}const et=new Xe;function R(b,e={}){const{showFavoriteAction:t=!1,showFavoritesMenu:n=!1,showSelection:a=!1,kampagneId:r=null}=e||{},i=(b||[]).map(s=>{const o=s.id,l=`${s.vorname||""} ${s.nachname||""}`.trim()||"Unbekannt",c=Array.isArray(s.creator_types)&&s.creator_types.length?s.creator_types.map(w=>typeof w=="object"&&(w.name||w.label)||w).join(", "):"-",d=Array.isArray(s.sprachen)&&s.sprachen.length?s.sprachen.map(w=>typeof w=="object"&&(w.name||w.label)||w).join(", "):"-",u=Array.isArray(s.branchen)&&s.branchen.length?s.branchen.map(w=>typeof w=="object"&&(w.name||w.label)||w).join(", "):"-",h=s.instagram_follower!=null?new Intl.NumberFormat("de-DE").format(s.instagram_follower):"-",m=s.tiktok_follower!=null?new Intl.NumberFormat("de-DE").format(s.tiktok_follower):"-",p=s.lieferadresse_stadt||"-",g=s.lieferadresse_land||"-",f=t?`
        <td>
          <div class="actions-dropdown-container" data-entity-type="creator">
            <button class="actions-toggle" aria-expanded="false" aria-label="Aktionen">
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" d="M12 6.75a.75.75 0 1 1 0-1.5.75.75 0 0 1 0 1.5ZM12 12.75a.75.75 0 1 1 0-1.5.75.75 0 0 1 0 1.5ZM12 18.75a.75.75 0 1 1 0-1.5.75.75 0 0 1 0 1.5Z" />
              </svg>
            </button>
            <div class="actions-dropdown">
              <a href="#" class="action-item" data-action="view" data-id="${o}">Details anzeigen</a>
              <a href="#" class="action-item" data-action="add_to_list" data-id="${o}">
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="size-6">
                  <path stroke-linecap="round" stroke-linejoin="round" d="M8.25 6.75h12M8.25 12h12m-12 5.25h12M3.75 6.75h.007v.008H3.75V6.75Zm.375 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0ZM3.75 12h.007v.008H3.75V12Zm.375 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Zm-.375 5.25h.007v.008H3.75v-.008Zm.375 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Z" />
                </svg>
                Zur Liste hinzufügen
              </a>
              <a href="#" class="action-item" data-action="favorite" data-creator-id="${o}" data-kampagne-id="${r}">
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="size-6">
                  <path stroke-linecap="round" stroke-linejoin="round" d="M17.593 3.322c1.1.128 1.907 1.077 1.907 2.185V21L12 17.25 4.5 21V5.507c0-1.108.806-2.057 1.907-2.185a48.507 48.507 0 0 1 11.186 0Z" />
                </svg>
                Favorit speichern
              </a>
              <div class="action-separator"></div>
              <a href="#" class="action-item action-danger" data-action="delete" data-id="${o}">Löschen</a>
            </div>
          </div>
        </td>
      `:n?`
        <td>
          <div class="actions-dropdown-container" data-entity-type="creator">
            <button class="actions-toggle" aria-expanded="false" aria-label="Aktionen">
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" d="M12 6.75a.75.75 0 1 1 0-1.5.75.75 0 0 1 0 1.5ZM12 12.75a.75.75 0 1 1 0-1.5.75.75 0 0 1 0 1.5ZM12 18.75a.75.75 0 1 1 0-1.5.75.75 0 0 1 0 1.5Z" />
              </svg>
            </button>
            <div class="actions-dropdown">
              <a href="#" class="action-item assign-to-campaign" data-creator-id="${o}" data-kampagne-id="${r}">
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="size-6">
                  <path stroke-linecap="round" stroke-linejoin="round" d="M18 7.5v3m0 0v3m0-3h3m-3 0h-3m-2.25-4.125a3.375 3.375 0 1 1-6.75 0 3.375 3.375 0 0 1 6.75 0ZM3 19.235v-.11a6.375 6.375 0 0 1 12.75 0v.109A12.318 12.318 0 0 1 9.374 21c-2.331 0-4.512-.645-6.374-1.766Z" />
                </svg>
                Zu Kampagne hinzufügen
              </a>
              <div class="action-separator"></div>
              <a href="#" class="action-item action-danger remove-favorite" data-creator-id="${o}" data-kampagne-id="${r}">
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="size-6">
                  <path stroke-linecap="round" stroke-linejoin="round" d="m3 3 1.664 1.664M21 21l-1.5-1.5m-5.485-1.242L12 17.25 4.5 21V8.742m.164-4.078a2.15 2.15 0 0 1 1.743-1.342 48.507 48.507 0 0 1 11.186 0c1.1.128 1.907 1.077 1.907 2.185V19.5M4.664 4.664 19.5 19.5" />
                </svg>
                Aus Favoriten entfernen
              </a>
            </div>
          </div>
        </td>
      `:"";return`
      <tr data-id="${o||""}">
        ${a?`<td><input type="checkbox" class="creator-check" data-id="${o}"></td>`:""}
        <td>${o?`<a href="#" class="table-link" data-table="creator" data-id="${o}">${l}</a>`:l}</td>
        <td>${c}</td>
        <td>${d}</td>
        <td>${u}</td>
        <td>${h}</td>
        <td>${m}</td>
        <td>${p}</td>
        <td>${g}</td>
        ${f}
      </tr>
    `}).join("");return`
    <div class="data-table-container">
      <table class="data-table">
        <thead>
          <tr>
            ${a?"<th></th>":""}
            <th>Name</th>
            <th>Typen</th>
            <th>Sprachen</th>
            <th>Branchen</th>
            <th>Instagram</th>
            <th>TikTok</th>
            <th>Stadt</th>
            <th>Land</th>
            ${t||n?"<th>Aktionen</th>":""}
          </tr>
        </thead>
        <tbody>
          ${i}
        </tbody>
      </table>
    </div>
  `}class tt{constructor(){this.unternehmenId=null,this.unternehmen=null,this.notizen=[],this.ratings=[],this.marken=[],this.auftraege=[],this.ansprechpartner=[],this.kampagnen=[],this.kooperationen=[],this.creators=[],this.rechnungen=[],this._creatorMap={}}async init(e){console.log("🎯 UNTERNEHMENDETAIL: Initialisiere Unternehmen-Detailseite für ID:",e);try{this.unternehmenId=e,await this.loadUnternehmenData(),this.render(),this.bindEvents(),console.log("✅ UNTERNEHMENDETAIL: Initialisierung abgeschlossen")}catch(t){console.error("❌ UNTERNEHMENDETAIL: Fehler bei der Initialisierung:",t),window.ErrorHandler.handle(t,"UnternehmenDetail.init")}}async loadUnternehmenData(){console.log("🔄 UNTERNEHMENDETAIL: Lade Unternehmen-Daten...");try{const{data:e,error:t}=await window.supabase.from("unternehmen").select("*").eq("id",this.unternehmenId).single();if(t)throw t;this.unternehmen=e,console.log("✅ UNTERNEHMENDETAIL: Unternehmen-Basisdaten geladen:",this.unternehmen);try{const{data:l,error:c}=await window.supabase.from("unternehmen_branchen").select(`
            branche_id,
            branchen:branche_id (id, name)
          `).eq("unternehmen_id",this.unternehmenId);!c&&l&&(this.unternehmen.branche_id=l.map(d=>d.branche_id),this.unternehmen.branchen_names=l.map(d=>d.branchen?.name).filter(Boolean),console.log("✅ UNTERNEHMENDETAIL: Branchen geladen:",this.unternehmen.branche_id))}catch(l){console.warn("⚠️ UNTERNEHMENDETAIL: Branchen konnten nicht geladen werden:",l)}window.notizenSystem&&(this.notizen=await window.notizenSystem.loadNotizen("unternehmen",this.unternehmenId),console.log("✅ UNTERNEHMENDETAIL: Notizen geladen:",this.notizen.length)),window.bewertungsSystem&&(this.ratings=await window.bewertungsSystem.loadBewertungen("unternehmen",this.unternehmenId),console.log("✅ UNTERNEHMENDETAIL: Ratings geladen:",this.ratings.length));const{data:n,error:a}=await window.supabase.from("marke").select("*").eq("unternehmen_id",this.unternehmenId);a||(this.marken=n||[],console.log("✅ UNTERNEHMENDETAIL: Marken geladen:",this.marken.length));const{data:r,error:i}=await window.supabase.from("auftrag").select("*").eq("unternehmen_id",this.unternehmenId);i||(this.auftraege=r||[],console.log("✅ UNTERNEHMENDETAIL: Aufträge geladen:",this.auftraege.length));try{const{data:l}=await window.supabase.from("kampagne").select("id, kampagnenname, status, start, deadline, unternehmen_id").eq("unternehmen_id",this.unternehmenId).order("created_at",{ascending:!1});this.kampagnen=l||[],console.log("✅ UNTERNEHMENDETAIL: Kampagnen geladen:",this.kampagnen.length)}catch(l){console.warn("⚠️ Kampagnen konnten nicht geladen werden",l),this.kampagnen=[]}try{const{data:l,error:c}=await window.supabase.from("rechnung").select("id, rechnung_nr, status, nettobetrag, bruttobetrag, gestellt_am, zahlungsziel, bezahlt_am, pdf_url").eq("unternehmen_id",this.unternehmenId).order("gestellt_am",{ascending:!1});if(c)throw c;this.rechnungen=l||[]}catch(l){console.warn("⚠️ Rechnungen konnten nicht geladen werden",l),this.rechnungen=[]}try{const l=(this.kampagnen||[]).map(c=>c.id).filter(Boolean);if(l.length>0){const{data:c}=await window.supabase.from("kooperationen").select("id, name, status, videoanzahl, gesamtkosten, kampagne_id, creator_id, created_at").in("kampagne_id",l).order("created_at",{ascending:!1});this.kooperationen=c||[];const d=Array.from(new Set((this.kooperationen||[]).map(u=>u.creator_id).filter(Boolean)));if(d.length>0){const{data:u}=await window.supabase.from("creator").select("id, vorname, nachname, instagram, lieferadresse_strasse, lieferadresse_hausnummer, lieferadresse_plz, lieferadresse_stadt, lieferadresse_land").in("id",d);this.creators=u||[]}else this.creators=[];console.log("✅ UNTERNEHMENDETAIL: Kooperationen geladen:",this.kooperationen.length,"Creators:",this.creators.length)}else this.kooperationen=[],this.creators=[]}catch(l){console.warn("⚠️ Kooperationen/Creators konnten nicht geladen werden",l),this.kooperationen=[],this.creators=[]}const{data:s,error:o}=await window.supabase.from("ansprechpartner_unternehmen").select(`
          ansprechpartner_id,
          ansprechpartner:ansprechpartner_id (
            *,
            position:position_id(name),
            unternehmen:unternehmen_id(firmenname)
          )
        `).eq("unternehmen_id",this.unternehmenId);o||(this.ansprechpartner=(s||[]).filter(l=>l.ansprechpartner).map(l=>l.ansprechpartner),console.log("✅ UNTERNEHMENDETAIL: Ansprechpartner geladen:",this.ansprechpartner.length));try{const{data:l}=await window.supabase.from("kampagne").select("id").eq("unternehmen_id",this.unternehmenId),c=(l||[]).map(u=>u.id);let d=[];if(c.length>0){const{data:u}=await window.supabase.from("kooperationen").select("creator_id").in("kampagne_id",c);d=Array.from(new Set((u||[]).map(h=>h.creator_id).filter(Boolean)))}if(d.length>0){const{data:u}=await window.supabase.from("creator").select("id, vorname, nachname, instagram_follower, tiktok_follower, lieferadresse_stadt, lieferadresse_land").in("id",d);this.creators=u||[],this._creatorMap=(u||[]).reduce((h,m)=>(h[m.id]=m,h),{})}else this.creators=[],this._creatorMap={}}catch(l){console.warn("⚠️ Creator für Unternehmen konnten nicht geladen werden",l),this.creators=[],this._creatorMap={}}}catch(e){throw console.error("❌ UNTERNEHMENDETAIL: Fehler beim Laden der Unternehmen-Daten:",e),e}}render(){window.setHeadline(`${this.unternehmen?.firmenname||"Unternehmen"} - Details`);const e=`
      <div class="page-header">
        <div class="page-header-left">
          <h1>${this.unternehmen?.firmenname||"Unternehmen"} - Details</h1>
          <p>Detaillierte Informationen zum Unternehmen</p>
        </div>
        <div class="page-header-right">
          <button id="btn-edit-unternehmen" class="secondary-btn">
            <i class="icon-edit"></i>
            Unternehmen bearbeiten
          </button>
          <button onclick="window.navigateTo('/unternehmen')" class="secondary-btn">
            Zurück zur Übersicht
          </button>
        </div>
      </div>

      <div class="content-section">
        <!-- Tab-Navigation -->
        <div class="tab-navigation">
          <button class="tab-button active" data-tab="informationen">
            Informationen
            <span class="tab-count">1</span>
          </button>
          <button class="tab-button" data-tab="notizen">
            Notizen
            <span class="tab-count">${this.notizen.length}</span>
          </button>
          <button class="tab-button" data-tab="bewertungen">
            Bewertungen
            <span class="tab-count">${this.ratings.length}</span>
          </button>
          <button class="tab-button" data-tab="marken">
            Marken
            <span class="tab-count">${this.marken.length}</span>
          </button>
          <button class="tab-button" data-tab="auftraege">
            Aufträge
            <span class="tab-count">${this.auftraege.length}</span>
          </button>
          <button class="tab-button" data-tab="kampagnen">
            Kampagnen
            <span class="tab-count">${this.kampagnen.length}</span>
          </button>
          <button class="tab-button" data-tab="kooperationen">
            Kooperationen
            <span class="tab-count">${this.kooperationen.length}</span>
          </button>
          <button class="tab-button" data-tab="creators">
            Creator
            <span class="tab-count">${this.creators.length}</span>
          </button>
          <button class="tab-button" data-tab="ansprechpartner">
            Ansprechpartner
            <span class="tab-count">${this.ansprechpartner.length}</span>
          </button>
      <button class="tab-button" data-tab="rechnungen">
        Rechnungen
        <span class="tab-count">${this.rechnungen.length}</span>
      </button>
        </div>

        <!-- Tab-Content -->
        <div class="tab-content">
          <!-- Informationen Tab -->
          <div class="tab-pane active" id="informationen">
            ${this.renderInformationen()}
          </div>

          <!-- Notizen Tab -->
          <div class="tab-pane" id="notizen">
            ${this.renderNotizen()}
          </div>

          <!-- Bewertungen Tab -->
          <div class="tab-pane" id="bewertungen">
            ${this.renderRatings()}
          </div>

          <!-- Marken Tab -->
          <div class="tab-pane" id="marken">
            ${this.renderMarken()}
          </div>

          <!-- Aufträge Tab -->
          <div class="tab-pane" id="auftraege">
            ${this.renderAuftraege()}
          </div>

          <!-- Kampagnen Tab -->
          <div class="tab-pane" id="kampagnen">
            ${this.renderKampagnen()}
          </div>

          <!-- Kooperationen Tab -->
          <div class="tab-pane" id="kooperationen">
            ${this.renderKooperationen()}
          </div>

          <!-- Creator Tab -->
          <div class="tab-pane" id="creators">
            ${this.renderCreators()}
          </div>

          <!-- Ansprechpartner Tab -->
          <div class="tab-pane" id="ansprechpartner">
            ${this.renderAnsprechpartner()}
          </div>
          
          <!-- Rechnungen Tab -->
          <div class="tab-pane" id="rechnungen">
            ${this.renderRechnungen()}
          </div>
        </div>
      </div>
    `;window.setContentSafely(window.content,e)}renderInformationen(){return`
      <div class="detail-section">
        <div class="detail-grid">
          <div class="detail-card">
            <h3>Unternehmen-Informationen</h3>
            <div class="detail-item">
              <label>Firmenname:</label>
              <span>${this.unternehmen?.firmenname||"-"}</span>
            </div>
            <div class="detail-item">
              <label>Webseite:</label>
              <span>
                ${this.unternehmen?.webseite?`<a href="${this.unternehmen.webseite}" target="_blank">${this.unternehmen.webseite}</a>`:"-"}
              </span>
            </div>
            <div class="detail-item">
              <label>Branche:</label>
              <span>${this.unternehmen?.branche||"-"}</span>
            </div>
            <div class="detail-item">
              <label>Rechnungsadresse:</label>
              <span>${[this.unternehmen?.rechnungsadresse_strasse,this.unternehmen?.rechnungsadresse_hausnummer].filter(Boolean).join(" ")||"-"}</span>
            </div>
            <div class="detail-item">
              <label>PLZ:</label>
              <span>${this.unternehmen?.rechnungsadresse_plz||"-"}</span>
            </div>
            <div class="detail-item">
              <label>Ort:</label>
              <span>${this.unternehmen?.rechnungsadresse_stadt||"-"}</span>
            </div>
            <div class="detail-item">
              <label>Land:</label>
              <span>${this.unternehmen?.rechnungsadresse_land||"-"}</span>
            </div>
            <div class="detail-item">
              <label>Erstellt am:</label>
              <span>${this.unternehmen?.created_at?new Date(this.unternehmen.created_at).toLocaleDateString("de-DE"):"-"}</span>
            </div>
            <div class="detail-item">
              <label>Zuletzt aktualisiert:</label>
              <span>${this.unternehmen?.updated_at?new Date(this.unternehmen.updated_at).toLocaleDateString("de-DE"):"-"}</span>
            </div>
          </div>
        </div>
      </div>
    `}renderNotizen(){return window.notizenSystem?window.notizenSystem.renderNotizenContainer(this.notizen,"unternehmen",this.unternehmenId):"<p>Notizen-System nicht verfügbar</p>"}renderRatings(){return window.bewertungsSystem?window.bewertungsSystem.renderBewertungenContainer(this.ratings,"unternehmen",this.unternehmenId):"<p>Bewertungs-System nicht verfügbar</p>"}renderMarken(){return!this.marken||this.marken.length===0?`
        <div class="empty-state">
          <div class="empty-icon">🏷️</div>
          <h3>Keine Marken vorhanden</h3>
          <p>Es wurden noch keine Marken für dieses Unternehmen erstellt.</p>
        </div>
      `:`
      <div class="marken-container">
        ${this.marken.map(t=>`
      <div class="marke-card">
        <div class="marke-header">
          <h4>${t.markenname||"Unbekannte Marke"}</h4>
        </div>
        <div class="marke-details">
          <p><strong>Webseite:</strong> ${t.webseite?`<a href="${t.webseite}" target="_blank">${t.webseite}</a>`:"-"}</p>
          <p><strong>Branche:</strong> ${t.branche||"-"}</p>
          <p><strong>Erstellt am:</strong> ${t.created_at?new Date(t.created_at).toLocaleDateString("de-DE"):"-"}</p>
        </div>
      </div>
    `).join("")}
      </div>
    `}renderAuftraege(){return!this.auftraege||this.auftraege.length===0?`
        <div class="empty-state">
          <div class="empty-icon">📋</div>
          <h3>Keine Aufträge vorhanden</h3>
          <p>Es wurden noch keine Aufträge für dieses Unternehmen erstellt.</p>
        </div>
      `:`
      <div class="auftraege-container">
        ${this.auftraege.map(t=>`
      <div class="auftrag-card">
        <div class="auftrag-header">
          <h4>${t.auftragsname||"Unbekannter Auftrag"}</h4>
          <span class="auftrag-status status-${t.status?.toLowerCase()||"unknown"}">
            ${t.status||"Unbekannt"}
          </span>
        </div>
        <div class="auftrag-details">
          <p><strong>Typ:</strong> ${t.auftragtype||"-"}</p>
          <p><strong>Budget:</strong> ${t.gesamt_budget?new Intl.NumberFormat("de-DE",{style:"currency",currency:"EUR"}).format(t.gesamt_budget):"-"}</p>
          <p><strong>Start:</strong> ${t.start?new Date(t.start).toLocaleDateString("de-DE"):"-"}</p>
          <p><strong>Ende:</strong> ${t.ende?new Date(t.ende).toLocaleDateString("de-DE"):"-"}</p>
        </div>
      </div>
    `).join("")}
      </div>
    `}renderKampagnen(){return!this.kampagnen||this.kampagnen.length===0?`
        <div class="empty-state">
          <div class="empty-icon">📣</div>
          <h3>Keine Kampagnen vorhanden</h3>
          <p>Es wurden noch keine Kampagnen für dieses Unternehmen erstellt.</p>
        </div>
      `:`<div class="kampagnen-container">${this.kampagnen.map(t=>`
      <div class="kampagne-card">
        <div class="kampagne-header">
          <h4>${t.kampagnenname||"Unbekannte Kampagne"}</h4>
          <span class="kampagne-status status-${t.status?.toLowerCase()||"unknown"}">${t.status||"-"}</span>
        </div>
        <div class="kampagne-details">
          <p><strong>Start:</strong> ${t.start?new Date(t.start).toLocaleDateString("de-DE"):"-"}</p>
          <p><strong>Deadline:</strong> ${t.deadline?new Date(t.deadline).toLocaleDateString("de-DE"):"-"}</p>
        </div>
      </div>
    `).join("")}</div>`}renderKooperationen(){return!this.kooperationen||this.kooperationen.length===0?`
        <div class="empty-state">
          <div class="empty-icon">🤝</div>
          <h3>Keine Kooperationen vorhanden</h3>
          <p>Für die Kampagnen dieses Unternehmens wurden keine Kooperationen gefunden.</p>
        </div>
      `:`<div class="kooperationen-container">${this.kooperationen.map(t=>`
      <div class="kooperation-card">
        <div class="kooperation-header">
          <h4>${t.name||"Kooperation"}</h4>
          <span class="kooperation-status status-${t.status?.toLowerCase()||"unknown"}">${t.status||"-"}</span>
        </div>
        <div class="kooperation-details">
          <p><strong>Videos:</strong> ${t.videoanzahl||0}</p>
          <p><strong>Gesamtkosten:</strong> ${t.gesamtkosten?new Intl.NumberFormat("de-DE",{style:"currency",currency:"EUR"}).format(t.gesamtkosten):"-"}</p>
        </div>
      </div>
    `).join("")}</div>`}renderCreators(){return!this.creators||this.creators.length===0?`
        <div class="empty-state">
          <div class="empty-icon">👤</div>
          <h3>Keine Creator vorhanden</h3>
          <p>Es gibt keine Creator in Kooperationen für dieses Unternehmen.</p>
        </div>
      `:R(this.creators)}renderAnsprechpartner(){const e=this.ansprechpartner&&this.ansprechpartner.length>0,t=e?"":`
      <div class="empty-state">
        <div class="empty-icon">👥</div>
        <h3>Keine Ansprechpartner vorhanden</h3>
        <p>Es wurden noch keine Ansprechpartner für dieses Unternehmen zugeordnet.</p>
      </div>
    `,n=`
      <div class="section-header">
        <h3>Ansprechpartner</h3>
        <button id="btn-add-ansprechpartner-unternehmen" class="primary-btn" data-unternehmen-id="${this.unternehmenId}">
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="w-5 h-5">
            <path stroke-linecap="round" stroke-linejoin="round" d="M18 7.5v3m0 0v3m0-3h3m-3 0h-3m-2.25-4.125a3.375 3.375 0 1 1-6.75 0 3.375 3.375 0 0 1 6.75 0ZM3 19.235v-.11a6.375 6.375 0 0 1 12.75 0v.109A12.318 12.318 0 0 1 9.374 21c-2.331 0-4.512-.645-6.374-1.766Z" />
          </svg>
          Ansprechpartner hinzufügen
        </button>
      </div>
    `;if(!e)return n+t;const a=this.ansprechpartner.map(r=>`
      <div class="ansprechpartner-card">
        <div class="ansprechpartner-header">
          <h4>
            <a href="#" onclick="event.preventDefault(); window.navigateTo('/ansprechpartner/${r.id}')" class="ansprechpartner-link">
              ${r.vorname} ${r.nachname}
            </a>
          </h4>
          <span class="ansprechpartner-position">${r.position?.name||"-"}</span>
          <div class="ansprechpartner-actions">
            <button class="btn-remove-ansprechpartner" data-ansprechpartner-id="${r.id}" data-unternehmen-id="${this.unternehmenId}" title="Ansprechpartner entfernen">
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="w-4 h-4">
                <path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>
        <div class="ansprechpartner-details">
          <p><strong>Email:</strong> ${r.email?`<a href="mailto:${r.email}">${r.email}</a>`:"-"}</p>
          <p><strong>Telefon (privat):</strong> ${r.telefonnummer?`<a href="tel:${r.telefonnummer}">${r.telefonnummer}</a>`:"-"}</p>
          <p><strong>Telefon (büro):</strong> ${r.telefonnummer_office?`<a href="tel:${r.telefonnummer_office}">${r.telefonnummer_office}</a>`:"-"}</p>
          <p><strong>Unternehmen:</strong> ${r.unternehmen?.firmenname||"-"}</p>
          <p><strong>Stadt:</strong> ${r.stadt||"-"}</p>
        </div>
      </div>
    `).join("");return`
      ${n}
      <div class="ansprechpartner-container">
        ${a}
      </div>
    `}renderRechnungen(){if(!this.rechnungen||this.rechnungen.length===0)return`
        <div class="empty-state">
          <div class="empty-icon">💶</div>
          <h3>Keine Rechnungen vorhanden</h3>
          <p>Für dieses Unternehmen wurden noch keine Rechnungen erfasst.</p>
        </div>
      `;const e=a=>a?new Intl.NumberFormat("de-DE",{style:"currency",currency:"EUR"}).format(a):"-",t=a=>a?new Date(a).toLocaleDateString("de-DE"):"-";return`
      <div class="data-table-container">
        <table class="data-table">
          <thead>
            <tr>
              <th>Rechnungs-Nr</th>
              <th>Status</th>
              <th>Netto</th>
              <th>Brutto</th>
              <th>Gestellt</th>
              <th>Fällig</th>
              <th>Bezahlt</th>
              <th>Beleg</th>
            </tr>
          </thead>
          <tbody>${this.rechnungen.map(a=>`
      <tr>
        <td><a href="/rechnung/${a.id}" onclick="event.preventDefault(); window.navigateTo('/rechnung/${a.id}')">${window.validatorSystem.sanitizeHtml(a.rechnung_nr||"—")}</a></td>
        <td><span class="status-badge status-${(a.status||"unknown").toLowerCase()}">${a.status||"-"}</span></td>
        <td>${e(a.nettobetrag)}</td>
        <td>${e(a.bruttobetrag)}</td>
        <td>${t(a.gestellt_am)}</td>
        <td>${t(a.zahlungsziel)}</td>
        <td>${t(a.bezahlt_am)}</td>
        <td>${a.pdf_url?`<a href="${a.pdf_url}" target="_blank" rel="noopener">PDF</a>`:"-"}</td>
      </tr>
    `).join("")}</tbody>
        </table>
      </div>
    `}bindEvents(){document.addEventListener("click",e=>{if(e.target.classList.contains("tab-button")){const t=e.target.dataset.tab;this.switchTab(t)}}),document.addEventListener("click",e=>{e.target.id==="btn-edit-unternehmen"&&this.showEditForm()}),document.addEventListener("notizenUpdated",()=>{this.loadUnternehmenData().then(()=>{this.render(),this.bindEvents()})}),document.addEventListener("bewertungenUpdated",()=>{this.loadUnternehmenData().then(()=>{this.render(),this.bindEvents()})})}switchTab(e){document.querySelectorAll(".tab-button").forEach(a=>{a.classList.remove("active")}),document.querySelectorAll(".tab-pane").forEach(a=>{a.classList.remove("active")});const t=document.querySelector(`[data-tab="${e}"]`),n=document.getElementById(e);t&&t.classList.add("active"),n&&n.classList.add("active")}showEditForm(){console.log("🎯 UNTERNEHMENDETAIL: Zeige Bearbeitungsformular"),window.setHeadline("Unternehmen bearbeiten");const e={...this.unternehmen};e._isEditMode=!0,e._entityId=this.unternehmenId,this.unternehmen.branche_id&&Array.isArray(this.unternehmen.branche_id)?(console.log("🏷️ UNTERNEHMENDETAIL: Formatiere Branchen-Daten für FormSystem:",this.unternehmen.branche_id),e.branche_id=this.unternehmen.branche_id):(console.log("ℹ️ UNTERNEHMENDETAIL: Keine Branchen-Daten vorhanden für Edit-Modus"),e.branche_id=[]),console.log("📋 UNTERNEHMENDETAIL: FormData für Rendering:",e);const t=window.formSystem.renderFormOnly("unternehmen",e);window.content.innerHTML=`
      <div class="page-header">
        <div class="page-header-left">
          <h1>Unternehmen bearbeiten</h1>
          <p>Bearbeiten Sie die Unternehmen-Informationen</p>
        </div>
        <div class="page-header-right">
          <button onclick="window.navigateTo('/unternehmen/${this.unternehmenId}')" class="secondary-btn">Abbrechen</button>
        </div>
      </div>
      
      <div class="form-page">
        ${t}
      </div>
    `,window.formSystem.bindFormEvents("unternehmen",e);const n=document.getElementById("unternehmen-form");n&&(n.dataset.entityId=this.unternehmenId,n.dataset.isEditMode="true",n.dataset.entityType="unternehmen",console.log("✅ Entity-ID und Edit-Mode für Form gesetzt:",this.unternehmenId),this.unternehmen.branche_id&&Array.isArray(this.unternehmen.branche_id)&&(n.dataset.existingBranchenIds=JSON.stringify(this.unternehmen.branche_id),console.log("📋 Bestehende Branchen-IDs für DynamicDataLoader gesetzt:",this.unternehmen.branche_id)),console.log("🔍 UNTERNEHMENDETAIL: Form Datasets:",{entityId:n.dataset.entityId,isEditMode:n.dataset.isEditMode,entityType:n.dataset.entityType,existingBranchenIds:n.dataset.existingBranchenIds,editModeData:n.dataset.editModeData?"Present":"Missing"}),n.onsubmit=async a=>{a.preventDefault(),await this.handleEditFormSubmit()})}async handleEditFormSubmit(){try{const e=document.getElementById("unternehmen-form"),t=new FormData(e),n={},a={};for(let[o,l]of t.entries())a[o]?(Array.isArray(a[o])||(a[o]=[a[o]]),a[o].push(l)):a[o]=l;const r=e.querySelector('select[name="branche_id[]"]');if(r&&r.multiple){const o=Array.from(r.selectedOptions);if(o.length>0){const l=o.map(c=>c.value).filter(c=>c!=="");l.length>0&&(a["branche_id[]"]=l,console.log("🏷️ UNTERNEHMENDETAIL: Verstecktes Branchen-Select manuell verarbeitet:",l))}}for(let[o,l]of Object.entries(a))n[o]=(Array.isArray(l),l);n.branche_id&&Array.isArray(n.branche_id)&&console.log("✅ branche_id Array für Junction Table:",n.branche_id);const i=window.validatorSystem.validateForm(n,{firmenname:{type:"text",minLength:2,required:!0}});if(!i.isValid){this.showValidationErrors(i.errors);return}console.log("📤 Submit-Daten für Update:",n);const s=await window.dataService.updateEntity("unternehmen",this.unternehmenId,n);if(s.success){try{const{RelationTables:o}=await B(async()=>{const{RelationTables:c}=await Promise.resolve().then(()=>V);return{RelationTables:c}},void 0);await new o().handleRelationTables("unternehmen",this.unternehmenId,n,e),console.log("✅ Junction Table-Verknüpfungen aktualisiert")}catch(o){console.error("❌ Fehler beim Aktualisieren der Junction Tables:",o)}this.showSuccessMessage("Unternehmen erfolgreich aktualisiert!"),window.dispatchEvent(new CustomEvent("entityUpdated",{detail:{entity:"unternehmen",id:this.unternehmenId,action:"updated"}})),setTimeout(async()=>{await this.loadUnternehmenData(),this.render(),this.bindEvents()},1500)}else throw new Error(s.error||"Unbekannter Fehler")}catch(e){console.error("❌ Formular-Submit Fehler:",e),this.showErrorMessage(e.message)}}showValidationErrors(e){console.log("❌ Validierungsfehler:",e),document.querySelectorAll(".validation-error").forEach(t=>t.remove()),Object.keys(e).forEach(t=>{const n=document.querySelector(`[name="${t}"]`);if(n){const a=document.createElement("div");a.className="validation-error",a.textContent=e[t],a.style.color="#dc3545",a.style.fontSize="0.875rem",a.style.marginTop="0.25rem",n.parentNode.appendChild(a),n.style.borderColor="#dc3545"}})}showSuccessMessage(e){const t=document.createElement("div");t.className="alert alert-success",t.textContent=e,t.style.cssText=`
      background: #d4edda;
      color: #155724;
      padding: 1rem;
      border-radius: 4px;
      margin-bottom: 1rem;
      border: 1px solid #c3e6cb;
    `;const n=document.querySelector(".form-page");n&&n.insertBefore(t,n.firstChild)}bindEvents(){document.addEventListener("click",e=>{if(e.target.classList.contains("tab-button")){const t=e.target.dataset.tab;this.switchTab(t)}}),document.addEventListener("click",e=>{e.target.id==="btn-edit-unternehmen"&&this.showEditForm()}),document.addEventListener("click",e=>{if(e.target.id==="btn-add-ansprechpartner-unternehmen"){const t=e.target.dataset.unternehmenId||this.unternehmenId;window.actionsDropdown&&window.actionsDropdown.openAddAnsprechpartnerToUnternehmenModal(t)}}),document.addEventListener("click",e=>{if(e.target.classList.contains("btn-remove-ansprechpartner")){const t=e.target.dataset.ansprechpartnerId,n=e.target.dataset.unternehmenId||this.unternehmenId;confirm("Möchten Sie diesen Ansprechpartner wirklich vom Unternehmen entfernen?")&&this.removeAnsprechpartner(t,n)}}),document.addEventListener("entityUpdated",e=>{e.detail?.entity==="ansprechpartner"&&e.detail?.unternehmenId===this.unternehmenId&&(console.log("🔄 UNTERNEHMENDETAIL: Ansprechpartner wurde aktualisiert, lade Daten neu"),this.loadUnternehmenData().then(()=>{this.render(),this.bindEvents()})),e.detail?.entity==="unternehmen"&&e.detail?.id===this.unternehmenId&&(console.log("🔄 UNTERNEHMENDETAIL: Unternehmen wurde aktualisiert, lade Daten neu"),this.loadUnternehmenData().then(()=>{this.render(),this.bindEvents()}))})}async removeAnsprechpartner(e,t){try{const{error:n}=await window.supabase.from("ansprechpartner_unternehmen").delete().eq("ansprechpartner_id",e).eq("unternehmen_id",t);if(n)throw n;window.dispatchEvent(new CustomEvent("entityUpdated",{detail:{entity:"ansprechpartner",action:"removed",unternehmenId:t}})),console.log("✅ UNTERNEHMENDETAIL: Ansprechpartner erfolgreich entfernt")}catch(n){console.error("❌ Fehler beim Entfernen des Ansprechpartners:",n),alert("Fehler beim Entfernen: "+(n.message||"Unbekannter Fehler"))}}switchTab(e){document.querySelectorAll(".tab-button").forEach(a=>{a.classList.remove("active")});const t=document.querySelector(`[data-tab="${e}"]`);t&&t.classList.add("active"),document.querySelectorAll(".tab-content").forEach(a=>{a.style.display="none"});const n=document.getElementById(`tab-${e}`);n&&(n.style.display="block")}showErrorMessage(e){const t=document.createElement("div");t.className="alert alert-danger",t.textContent=e,t.style.cssText=`
      background: #f8d7da;
      color: #721c24;
      padding: 1rem;
      border-radius: 4px;
      margin-bottom: 1rem;
      border: 1px solid #f5c6cb;
    `;const n=document.querySelector(".form-page");n&&n.insertBefore(t,n.firstChild)}async getBranchenNamen(e){try{const{data:t,error:n}=await window.supabase.from("branchen").select("id, name").in("id",e);return n?(console.error("❌ Fehler beim Laden der Branche-Namen:",n),e):e.map(a=>{const r=t.find(i=>i.id===a);return r?r.name:a})}catch(t){return console.error("❌ Fehler beim Laden der Branche-Namen:",t),e}}destroy(){console.log("UnternehmenDetail: Cleaning up...")}}const ce=new tt;class nt{constructor(){this.auftragId=null,this.auftrag=null,this.notizen=[],this.ratings=[],this.creator=[],this.marke=null,this.unternehmen=null,this.rechnungen=[],this.rechnungSummary={count:0,sumNetto:0,sumBrutto:0,paidCount:0,openCount:0},this.koopSummary={count:0,sumNetto:0,sumGesamt:0}}async init(e){console.log("🎯 AUFTRAGDETAIL: Initialisiere Auftrags-Detailseite für ID:",e);try{this.auftragId=e,await this.loadAuftragData(),this.render(),this.bindEvents(),console.log("✅ AUFTRAGDETAIL: Initialisierung abgeschlossen")}catch(t){console.error("❌ AUFTRAGDETAIL: Fehler bei der Initialisierung:",t),window.ErrorHandler.handle(t,"AuftragDetail.init")}}async loadAuftragData(){console.log("🔄 AUFTRAGDETAIL: Lade Auftrags-Daten...");try{const{data:e,error:t}=await window.supabase.from("auftrag").select(`
          *,
          marke:marke_id(markenname),
          unternehmen:unternehmen_id(firmenname)
        `).eq("id",this.auftragId).single();if(t)throw t;this.auftrag=e,console.log("✅ AUFTRAGDETAIL: Auftrags-Basisdaten geladen:",this.auftrag),window.notizenSystem&&(this.notizen=await window.notizenSystem.loadNotizen("auftrag",this.auftragId),console.log("✅ AUFTRAGDETAIL: Notizen geladen:",this.notizen.length)),window.bewertungsSystem&&(this.ratings=await window.bewertungsSystem.loadBewertungen("auftrag",this.auftragId),console.log("✅ AUFTRAGDETAIL: Ratings geladen:",this.ratings.length));const{data:n,error:a}=await window.supabase.from("creator_auftrag").select(`
          creator:creator_id(*)
        `).eq("auftrag_id",this.auftragId);a||(this.creator=n?.map(r=>r.creator)||[],console.log("✅ AUFTRAGDETAIL: Creator geladen:",this.creator.length));try{const{data:r}=await window.supabase.from("rechnung").select("id, rechnung_nr, status, nettobetrag, bruttobetrag, gestellt_am, bezahlt_am, pdf_url").eq("auftrag_id",this.auftragId).order("gestellt_am",{ascending:!1});this.rechnungen=r||[];const i=(this.rechnungen||[]).reduce((c,d)=>c+(parseFloat(d.nettobetrag)||0),0),s=(this.rechnungen||[]).reduce((c,d)=>c+(parseFloat(d.bruttobetrag)||0),0),o=(this.rechnungen||[]).filter(c=>c.status==="Bezahlt").length,l=(this.rechnungen||[]).filter(c=>c.status!=="Bezahlt").length;this.rechnungSummary={count:(this.rechnungen||[]).length,sumNetto:i,sumBrutto:s,paidCount:o,openCount:l}}catch{this.rechnungen=[],this.rechnungSummary={count:0,sumNetto:0,sumBrutto:0,paidCount:0,openCount:0}}try{const{data:r}=await window.supabase.from("kampagne").select("id").eq("auftrag_id",this.auftragId),i=(r||[]).map(s=>s.id);if(i.length>0){const{data:s}=await window.supabase.from("kooperationen").select("nettobetrag, gesamtkosten").in("kampagne_id",i),o=(s||[]).reduce((c,d)=>c+(parseFloat(d.nettobetrag)||0),0),l=(s||[]).reduce((c,d)=>c+(parseFloat(d.gesamtkosten)||0),0);this.koopSummary={count:(s||[]).length,sumNetto:o,sumGesamt:l}}else this.koopSummary={count:0,sumNetto:0,sumGesamt:0}}catch{this.koopSummary={count:0,sumNetto:0,sumGesamt:0}}}catch(e){throw console.error("❌ AUFTRAGDETAIL: Fehler beim Laden der Auftrags-Daten:",e),e}}render(){window.setHeadline(`${this.auftrag?.auftragsname||"Auftrag"} - Details`);const e=`
      <div class="page-header">
        <div class="page-header-left">
          <h1>${this.auftrag?.auftragsname||"Auftrag"} - Details</h1>
          <p>Detaillierte Informationen zum Auftrag</p>
        </div>
        <div class="page-header-right">
          <button id="btn-edit-auftrag" class="secondary-btn">
            <i class="icon-edit"></i>
            Auftrag bearbeiten
          </button>
          <button onclick="window.navigateTo('/auftrag')" class="secondary-btn">
            Zurück zur Übersicht
          </button>
        </div>
      </div>

      <div class="content-section">
        <!-- Tab-Navigation -->
        <div class="tab-navigation">
          <button class="tab-button active" data-tab="informationen">
            Informationen
            <span class="tab-count">1</span>
          </button>
          <button class="tab-button" data-tab="notizen">
            Notizen
            <span class="tab-count">${this.notizen.length}</span>
          </button>
          <button class="tab-button" data-tab="bewertungen">
            Bewertungen
            <span class="tab-count">${this.ratings.length}</span>
          </button>
          <button class="tab-button" data-tab="creator">
            Creator
            <span class="tab-count">${this.creator.length}</span>
          </button>
          <button class="tab-button" data-tab="rechnungen">
            Rechnungen
            <span class="tab-count">${this.rechnungen.length}</span>
          </button>
          <button class="tab-button" data-tab="budget">
            Budget
          </button>
        </div>

        <!-- Tab-Content -->
        <div class="tab-content">
          <!-- Informationen Tab -->
          <div class="tab-pane active" id="informationen">
            ${this.renderInformationen()}
          </div>

          <!-- Notizen Tab -->
          <div class="tab-pane" id="notizen">
            ${this.renderNotizen()}
          </div>

          <!-- Bewertungen Tab -->
          <div class="tab-pane" id="bewertungen">
            ${this.renderRatings()}
          </div>

          <!-- Creator Tab -->
          <div class="tab-pane" id="creator">
            ${this.renderCreator()}
          </div>
          
          <!-- Rechnungen Tab -->
          <div class="tab-pane" id="rechnungen">
            ${this.renderRechnungen()}
          </div>

          <!-- Budget Tab -->
          <div class="tab-pane" id="budget">
            ${this.renderBudget()}
          </div>
        </div>
      </div>
    `;window.setContentSafely(window.content,e)}renderBudget(){const e=l=>l||l===0?new Intl.NumberFormat("de-DE",{style:"currency",currency:"EUR"}).format(l):"-",t=l=>l||l===0?new Intl.NumberFormat("de-DE").format(l):"-",n=this.auftrag||{},a=n.ust_prozent!=null?n.ust_prozent:19,r=n.ust_betrag!=null?n.ust_betrag:parseFloat(n.nettobetrag||0)*(parseFloat(a)/100),i=n.deckungsbeitrag_prozent!=null?n.deckungsbeitrag_prozent:0,s=n.deckungsbeitrag_betrag!=null?n.deckungsbeitrag_betrag:parseFloat(n.nettobetrag||0)*(parseFloat(i)/100),o=parseFloat(n.influencer||0)*parseFloat(n.influencer_preis||0)+parseFloat(n.ugc||0)*parseFloat(n.ugc_preis||0)+parseFloat(n.vor_ort_produktion||0)*parseFloat(n.vor_ort_preis||0);return`
      <div class="detail-section">
        <div class="detail-grid">
          <div class="detail-card">
            <h3>Einnahmen (Auftrag)</h3>
            <div class="detail-item"><label>Netto:</label><span>${e(n.nettobetrag)}</span></div>
            <div class="detail-item"><label>USt (%):</label><span>${t(a)}</span></div>
            <div class="detail-item"><label>USt Betrag:</label><span>${e(r)}</span></div>
            <div class="detail-item"><label>Brutto Gesamtbudget:</label><span>${e(n.bruttobetrag)}</span></div>
          </div>
          <div class="detail-card">
            <h3>Planwerte</h3>
            <div class="detail-item"><label>Geplanter Deckungsbeitrag (%):</label><span>${t(i)}</span></div>
            <div class="detail-item"><label>Geplanter Deckungsbeitrag (Betrag):</label><span>${e(s)}</span></div>
            <div class="detail-item"><label>KSK (5% von Netto):</label><span>${e(n.ksk_betrag)}</span></div>
            <div class="detail-item"><label>Creator Budget:</label><span>${e(n.creator_budget)}</span></div>
          </div>
          <div class="detail-card">
            <h3>Preisaufbau (Netto)</h3>
            <div class="detail-item"><label>Influencer:</label><span>${t(n.influencer)} × ${e(n.influencer_preis)}</span></div>
            <div class="detail-item"><label>UGC:</label><span>${t(n.ugc)} × ${e(n.ugc_preis)}</span></div>
            <div class="detail-item"><label>Vor Ort Produktion:</label><span>${t(n.vor_ort_produktion)} × ${e(n.vor_ort_preis)}</span></div>
            <div class="detail-item"><label>Summe Positionen (Netto):</label><span>${e(o)}</span></div>
          </div>
          <div class="detail-card">
            <h3>Rechnungen</h3>
            <div class="detail-item"><label>Anzahl:</label><span>${t(this.rechnungSummary.count)}</span></div>
            <div class="detail-item"><label>Summe Netto:</label><span>${e(this.rechnungSummary.sumNetto)}</span></div>
            <div class="detail-item"><label>Summe Brutto:</label><span>${e(this.rechnungSummary.sumBrutto)}</span></div>
            <div class="detail-item"><label>Bezahlt / Offen:</label><span>${t(this.rechnungSummary.paidCount)} / ${t(this.rechnungSummary.openCount)}</span></div>
          </div>
          <div class="detail-card">
            <h3>Ausgaben (Kooperationen)</h3>
            <div class="detail-item"><label>Anzahl Kooperationen:</label><span>${t(this.koopSummary.count)}</span></div>
            <div class="detail-item"><label>Summe Nettokosten:</label><span>${e(this.koopSummary.sumNetto)}</span></div>
            <div class="detail-item"><label>Summe Gesamtkosten:</label><span>${e(this.koopSummary.sumGesamt)}</span></div>
          </div>
        </div>
      </div>
    `}renderInformationen(){return`
      <div class="detail-section">
        <div class="detail-grid">
          <div class="detail-card">
            <h3>Auftrags-Informationen</h3>
            <div class="detail-item">
              <label>Auftragsname:</label>
              <span>${this.auftrag?.auftragsname||"-"}</span>
            </div>
            <div class="detail-item">
              <label>Marke:</label>
              <span>${this.auftrag?.marke?.markenname||"-"}</span>
            </div>
            <div class="detail-item">
              <label>Unternehmen:</label>
              <span>${this.auftrag?.unternehmen?.firmenname||"-"}</span>
            </div>
            <div class="detail-item">
              <label>Status:</label>
              <span class="status-${this.auftrag?.status?.toLowerCase()||"unknown"}">
                ${this.auftrag?.status||"Unbekannt"}
              </span>
            </div>
            <div class="detail-item">
              <label>Typ:</label>
              <span>${this.auftrag?.auftragtype||"-"}</span>
            </div>
            <div class="detail-item">
              <label>Budget:</label>
              <span>${this.auftrag?.gesamt_budget?new Intl.NumberFormat("de-DE",{style:"currency",currency:"EUR"}).format(this.auftrag.gesamt_budget):"-"}</span>
            </div>
            <div class="detail-item">
              <label>Start:</label>
              <span>${this.auftrag?.start?new Date(this.auftrag.start).toLocaleDateString("de-DE"):"-"}</span>
            </div>
            <div class="detail-item">
              <label>Ende:</label>
              <span>${this.auftrag?.ende?new Date(this.auftrag.ende).toLocaleDateString("de-DE"):"-"}</span>
            </div>
            <div class="detail-item">
              <label>Erstellt am:</label>
              <span>${this.auftrag?.created_at?new Date(this.auftrag.created_at).toLocaleDateString("de-DE"):"-"}</span>
            </div>
            <div class="detail-item">
              <label>Zuletzt aktualisiert:</label>
              <span>${this.auftrag?.updated_at?new Date(this.auftrag.updated_at).toLocaleDateString("de-DE"):"-"}</span>
            </div>
          </div>
        </div>
      </div>
    `}renderNotizen(){return window.notizenSystem?window.notizenSystem.renderNotizenContainer(this.notizen,"auftrag",this.auftragId):"<p>Notizen-System nicht verfügbar</p>"}renderRatings(){return window.bewertungsSystem?window.bewertungsSystem.renderBewertungenContainer(this.ratings,"auftrag",this.auftragId):"<p>Bewertungs-System nicht verfügbar</p>"}renderCreator(){return!this.creator||this.creator.length===0?`
        <div class="empty-state">
          <div class="empty-icon">👤</div>
          <h3>Keine Creator zugewiesen</h3>
          <p>Es wurden noch keine Creator diesem Auftrag zugewiesen.</p>
        </div>
      `:`
      <div class="creator-container">
        ${this.creator.map(t=>`
      <div class="creator-card">
        <div class="creator-header">
          <h4>${t.vorname} ${t.nachname}</h4>
          <span class="creator-status status-${t.status?.toLowerCase()||"unknown"}">
            ${t.status||"Unbekannt"}
          </span>
        </div>
        <div class="creator-details">
          <p><strong>Email:</strong> ${t.email?`<a href="mailto:${t.email}">${t.email}</a>`:"-"}</p>
          <p><strong>Telefon:</strong> ${t.telefonnummer?`<a href="tel:${t.telefonnummer}">${t.telefonnummer}</a>`:"-"}</p>
          <p><strong>Kategorie:</strong> ${t.kategorie||"-"}</p>
        </div>
      </div>
    `).join("")}
      </div>
    `}renderRechnungen(){if(!this.rechnungen||this.rechnungen.length===0)return`
        <div class="empty-state">
          <div class="empty-icon">💶</div>
          <h3>Keine Rechnungen vorhanden</h3>
        </div>
      `;const e=a=>a?new Intl.NumberFormat("de-DE",{style:"currency",currency:"EUR"}).format(a):"-",t=a=>a?new Date(a).toLocaleDateString("de-DE"):"-";return`
      <div class="data-table-container">
        <table class="data-table">
          <thead>
            <tr>
              <th>Rechnungs-Nr</th>
              <th>Status</th>
              <th>Netto</th>
              <th>Brutto</th>
              <th>Gestellt</th>
              <th>Bezahlt</th>
              <th>Beleg</th>
            </tr>
          </thead>
          <tbody>${this.rechnungen.map(a=>`
      <tr>
        <td><a href="/rechnung/${a.id}" onclick="event.preventDefault(); window.navigateTo('/rechnung/${a.id}')">${window.validatorSystem.sanitizeHtml(a.rechnung_nr||"—")}</a></td>
        <td>${a.status||"-"}</td>
        <td>${e(a.nettobetrag)}</td>
        <td>${e(a.bruttobetrag)}</td>
        <td>${t(a.gestellt_am)}</td>
        <td>${t(a.bezahlt_am)}</td>
        <td>${a.pdf_url?`<a href="${a.pdf_url}" target="_blank" rel="noopener">PDF</a>`:"-"}</td>
      </tr>
    `).join("")}</tbody>
        </table>
      </div>
    `}bindEvents(){document.addEventListener("click",e=>{if(e.target.classList.contains("tab-button")){const t=e.target.dataset.tab;this.switchTab(t)}}),document.addEventListener("click",e=>{e.target.id==="btn-edit-auftrag"&&this.showEditForm()}),document.addEventListener("notizenUpdated",()=>{this.loadAuftragData().then(()=>{this.render(),this.bindEvents()})}),document.addEventListener("bewertungenUpdated",()=>{this.loadAuftragData().then(()=>{this.render(),this.bindEvents()})})}switchTab(e){document.querySelectorAll(".tab-button").forEach(a=>{a.classList.remove("active")}),document.querySelectorAll(".tab-pane").forEach(a=>{a.classList.remove("active")});const t=document.querySelector(`[data-tab="${e}"]`),n=document.getElementById(e);t&&t.classList.add("active"),n&&n.classList.add("active")}showEditForm(){console.log("🎯 AUFTRAGDETAIL: Zeige Bearbeitungsformular"),window.setHeadline("Auftrag bearbeiten");const e=window.formSystem.renderFormOnly("auftrag",this.auftrag);window.content.innerHTML=`
      <div class="page-header">
        <div class="page-header-left">
          <h1>Auftrag bearbeiten</h1>
          <p>Bearbeiten Sie die Auftrags-Informationen</p>
        </div>
        <div class="page-header-right">
          <button onclick="window.navigateTo('/auftrag/${this.auftragId}')" class="secondary-btn">Abbrechen</button>
        </div>
      </div>
      
      <div class="form-page">
        ${e}
      </div>
    `,window.formSystem.bindFormEvents("auftrag",this.auftrag);const t=document.getElementById("auftrag-form");t&&(t.onsubmit=async n=>{n.preventDefault(),await this.handleEditFormSubmit()})}async handleEditFormSubmit(){try{const e=document.getElementById("auftrag-form"),t=new FormData(e),n={};for(const[i,s]of t.entries())n[i]=s;const a=window.validatorSystem.validateForm(n,{auftragsname:{type:"text",minLength:2,required:!0}});if(!a.isValid){this.showValidationErrors(a.errors);return}const r=await window.dataService.updateEntity("auftrag",this.auftragId,n);if(r.success)this.showSuccessMessage("Auftrag erfolgreich aktualisiert!"),setTimeout(async()=>{await this.loadAuftragData(),this.render(),this.bindEvents()},1500);else throw new Error(r.error||"Unbekannter Fehler")}catch(e){console.error("❌ Formular-Submit Fehler:",e),this.showErrorMessage(e.message)}}showValidationErrors(e){console.log("❌ Validierungsfehler:",e),document.querySelectorAll(".validation-error").forEach(t=>t.remove()),Object.keys(e).forEach(t=>{const n=document.querySelector(`[name="${t}"]`);if(n){const a=document.createElement("div");a.className="validation-error",a.textContent=e[t],a.style.color="#dc3545",a.style.fontSize="0.875rem",a.style.marginTop="0.25rem",n.parentNode.appendChild(a),n.style.borderColor="#dc3545"}})}showSuccessMessage(e){const t=document.createElement("div");t.className="alert alert-success",t.textContent=e,t.style.cssText=`
      background: #d4edda;
      color: #155724;
      padding: 1rem;
      border-radius: 4px;
      margin-bottom: 1rem;
      border: 1px solid #c3e6cb;
    `;const n=document.querySelector(".form-page");n&&n.insertBefore(t,n.firstChild)}showErrorMessage(e){const t=document.createElement("div");t.className="alert alert-danger",t.textContent=e,t.style.cssText=`
      background: #f8d7da;
      color: #721c24;
      padding: 1rem;
      border-radius: 4px;
      margin-bottom: 1rem;
      border: 1px solid #f5c6cb;
    `;const n=document.querySelector(".form-page");n&&n.insertBefore(t,n.firstChild)}destroy(){console.log("AuftragDetail: Cleaning up...")}}const ue=new nt;class at{constructor(){this.selectedKooperation=new Set,this._boundEventListeners=new Set,this.statusOptions=[]}async init(){if(window.setHeadline("Kooperationen Übersicht"),!(window.canViewPage&&window.canViewPage("kooperation")||await window.checkUserPermission("kooperation","can_view"))){window.content.innerHTML=`
        <div class="error-message">
          <p>Sie haben keine Berechtigung, Kooperationen anzuzeigen.</p>
        </div>
      `;return}this.bindEvents(),await this.loadAndRender()}async loadAndRender(){try{const e=await window.dataService.loadFilterData("kooperation");await this.render(e),await this.initializeFilterBar();const t=_.getFilters("kooperation");console.log("🔍 Lade Kooperationen mit Filter:",t);const n=await this.loadKooperationenWithRelations();console.log("📊 Kooperationen geladen:",n?.length||0),this.updateTable(n)}catch(e){window.ErrorHandler.handle(e,"KooperationList.loadAndRender")}}async loadKooperationenWithRelations(){try{if(!window.supabase)return console.warn("⚠️ Supabase nicht verfügbar - verwende Mock-Daten"),await window.dataService.loadEntities("kooperation");try{const{data:d}=await window.supabase.from("kampagne_status").select("id, name, sort_order").order("sort_order",{ascending:!0}).order("name",{ascending:!0});this.statusOptions=d||[]}catch(d){console.warn("⚠️ Konnte Status-Optionen nicht laden",d),this.statusOptions=[]}const e=window.currentUser?.rolle==="admin";let t=[];if(!e)try{const{data:d}=await window.supabase.from("kampagne_mitarbeiter").select("kampagne_id").eq("mitarbeiter_id",window.currentUser?.id),u=(d||[]).map(g=>g.kampagne_id).filter(Boolean),{data:h}=await window.supabase.from("marke_mitarbeiter").select("marke_id").eq("mitarbeiter_id",window.currentUser?.id),m=(h||[]).map(g=>g.marke_id).filter(Boolean);let p=[];if(m.length>0){const{data:g}=await window.supabase.from("kampagne").select("id").in("marke_id",m);p=(g||[]).map(f=>f.id).filter(Boolean)}t=[...new Set([...u,...p])],console.log(`🔍 KOOPERATIONLIST: Mitarbeiter ${window.currentUser?.id} hat Zugriff auf:`,{direkteKampagnen:u.length,markenKampagnen:p.length,gesamt:t.length})}catch(d){console.error("❌ Fehler beim Laden der Kampagnen-Zuordnungen:",d)}let n=window.supabase.from("kooperationen").select("id, name, status, status_id, videoanzahl, gesamtkosten, kampagne_id, creator_id, assignee_id, skript_deadline, content_deadline, created_at").order("created_at",{ascending:!1});e||(n=n.or(`assignee_id.eq.${window.currentUser?.id}${t.length?`,kampagne_id.in.(${t.join(",")})`:""}`));const{data:a,error:r}=await n;if(r)throw console.error("❌ Fehler beim Laden der Kooperationen mit Beziehungen:",r),r;const i=Array.from(new Set((a||[]).map(d=>d.kampagne_id).filter(Boolean))),s=Array.from(new Set((a||[]).map(d=>d.creator_id).filter(Boolean)));let o={},l={};try{if(i.length>0){const{data:d}=await window.supabase.from("kampagne").select("id, kampagnenname, status, start, deadline").in("id",i);o=(d||[]).reduce((u,h)=>(u[h.id]=h,u),{})}if(s.length>0){const{data:d}=await window.supabase.from("creator").select("id, vorname, nachname, instagram").in("id",s);l=(d||[]).reduce((u,h)=>(u[h.id]=h,u),{})}}catch(d){console.warn("⚠️ Beziehungen konnten nicht vollständig geladen werden:",d)}const c=(a||[]).map(d=>({...d,creator:l[d.creator_id]||null,kampagne:o[d.kampagne_id]||null}));return this._kampagneMap=o,this._creatorMap=l,console.log("✅ Kooperationen mit Beziehungen geladen:",c),c}catch(e){return console.error("❌ Fehler beim Laden der Kooperationen mit Beziehungen:",e),await window.dataService.loadEntities("kooperation")}}async render(e){const t=window.currentUser?.permissions?.kooperation?.can_edit||!1,n=_.getFilters("kooperation");Object.entries(n).forEach(([i,s])=>{});let a=`<div class="filter-bar">
      <div class="filter-left">
        <div id="filter-container"></div>
      </div>
      <div class="filter-right">
        <button id="btn-filter-reset" class="secondary-btn" style="display:${this.hasActiveFilters()?"inline-block":"none"};">Filter zurücksetzen</button>
      </div>
    </div>`,r=`
      <div class="page-header">
        <div class="page-header-left">
          <h1>Kooperationen</h1>
          <p>Verwalten Sie alle Kooperationen zwischen Creators und Kampagnen</p>
        </div>
        <div class="page-header-right">
          ${t?'<button id="btn-kooperation-new" class="primary-btn">Neue Kooperation anlegen</button>':""}
        </div>
      </div>

      ${a}

      <div class="table-actions">
        <div class="table-actions-left">
          <button id="btn-select-all" class="secondary-btn">Alle auswählen</button>
          <button id="btn-deselect-all" class="secondary-btn" style="display:none;">Auswahl aufheben</button>
        </div>
        <div class="table-actions-right">
          <button id="btn-delete-selected" class="danger-btn" style="display:none;">Ausgewählte löschen</button>
        </div>
      </div>

      <div class="data-table-container">
        <table class="data-table">
          <thead>
            <tr>
              <th><input type="checkbox" id="select-all-kooperationen"></th>
              <th>Name</th>
              <th>Kampagne</th>
              <th>Creator</th>
              <th>Videos</th>
              <th>Status</th>
           <th>Gesamtkosten</th>
              <th>Start</th>
              <th>Ende</th>
              <th>Aktionen</th>
            </tr>
          </thead>
          <tbody id="kooperationen-table-body">
            <tr>
              <td colspan="9" class="loading">Lade Kooperationen...</td>
            </tr>
          </tbody>
        </table>
      </div>
    `;window.setContentSafely(window.content,r)}async initializeFilterBar(){const e=document.getElementById("filter-container");e&&await _.renderFilterBar("kooperation",e,t=>this.onFiltersApplied(t),()=>this.onFiltersReset())}onFiltersApplied(e){console.log("🔍 KooperationList: Filter angewendet:",e),_.applyFilters("kooperation",e),this.loadAndRender()}onFiltersReset(){console.log("🔄 KooperationList: Filter zurückgesetzt"),_.resetFilters("kooperation"),this.loadAndRender()}bindEvents(){this.boundFilterResetHandler=e=>{e.target.id==="btn-filter-reset"&&this.onFiltersReset()},document.addEventListener("click",this.boundFilterResetHandler),document.addEventListener("click",e=>{(e.target.id==="btn-kooperation-new"||e.target.id==="btn-kooperation-new-filter")&&(e.preventDefault(),window.navigateTo("/kooperation/new"))}),document.addEventListener("click",e=>{if(e.target.id==="btn-select-all"){e.preventDefault(),document.querySelectorAll(".kooperation-check").forEach(a=>{a.checked=!0,a.dataset.id&&this.selectedKooperation.add(a.dataset.id)});const n=document.getElementById("select-all-kooperationen");n&&(n.indeterminate=!1,n.checked=!0),this.updateSelection()}}),document.addEventListener("click",e=>{if(e.target.id==="btn-deselect-all"){e.preventDefault(),document.querySelectorAll(".kooperation-check").forEach(a=>{a.checked=!1}),this.selectedKooperation.clear();const n=document.getElementById("select-all-kooperationen");n&&(n.indeterminate=!1,n.checked=!1),this.updateSelection()}}),document.addEventListener("click",e=>{if(e.target.classList.contains("table-link")&&e.target.dataset.table==="kooperation"){e.preventDefault();const t=e.target.dataset.id;console.log("🎯 KOOPERATIONLIST: Navigiere zu Kooperation Details:",t),window.navigateTo(`/kooperation/${t}`)}}),window.addEventListener("entityUpdated",e=>{e.detail.entity==="kooperation"&&this.loadAndRender()}),document.addEventListener("click",e=>{if(e.target.classList.contains("tag-x")){e.preventDefault(),e.stopPropagation();const n=e.target.closest(".filter-tag").dataset.key,a=_.getFilters("kooperation");delete a[n],_.applyFilters("kooperation",a),this.loadAndRender()}}),document.addEventListener("change",e=>{e.target.id==="select-all-kooperationen"&&(document.querySelectorAll(".kooperation-check").forEach(n=>{n.checked=e.target.checked,e.target.checked?this.selectedKooperation.add(n.dataset.id):this.selectedKooperation.delete(n.dataset.id)}),this.updateSelection())}),document.addEventListener("change",e=>{e.target.classList.contains("kooperation-check")&&(e.target.checked?this.selectedKooperation.add(e.target.dataset.id):this.selectedKooperation.delete(e.target.dataset.id),this.updateSelection())})}hasActiveFilters(){const e=_.getFilters("kooperation");return Object.keys(e).length>0}updateSelection(){const e=this.selectedKooperation.size,t=document.getElementById("selected-count"),n=document.getElementById("btn-deselect-all"),a=document.getElementById("btn-delete-selected");t&&(t.textContent=`${e} ausgewählt`,t.style.display=e>0?"inline":"none"),n&&(n.style.display=e>0?"inline-block":"none"),a&&(a.style.display=e>0?"inline-block":"none")}async updateTable(e){const t=document.getElementById("kooperationen-table-body");if(!t)return;if(!e||e.length===0){const{renderEmptyState:a}=await B(async()=>{const{renderEmptyState:r}=await import("./core-C7Vz5Umf.js").then(i=>i.F);return{renderEmptyState:r}},[]);a(t);return}const n=e.map(a=>{const r=s=>s?new Intl.NumberFormat("de-DE",{style:"currency",currency:"EUR"}).format(s):"-",i=s=>s?new Date(s).toLocaleDateString("de-DE"):"-";return`
        <tr data-id="${a.id}">
          <td><input type="checkbox" class="kooperation-check" data-id="${a.id}"></td>
          <td>
            <a href="#" class="table-link" data-table="kooperation" data-id="${a.id}">
              ${window.validatorSystem.sanitizeHtml(a.name||"—")}
            </a>
          </td>
          <td>${window.validatorSystem.sanitizeHtml(a.kampagne?.kampagnenname||this._kampagneMap?.[a.kampagne_id]?.kampagnenname||"Unbekannt")}</td>
          <td>
            ${window.validatorSystem.sanitizeHtml(a.creator?`${a.creator.vorname} ${a.creator.nachname}`:this._creatorMap?.[a.creator_id]?`${this._creatorMap[a.creator_id].vorname} ${this._creatorMap[a.creator_id].nachname}`:"Unbekannt")}
          </td>
          <td>${a.videoanzahl||0}</td>
          <td>
            <span class="status-badge status-${(a.status||this.statusOptions.find(s=>s.id===a.status_id)?.name||"unknown").toLowerCase()}">
              ${a.status||this.statusOptions.find(s=>s.id===a.status_id)?.name||"-"}
            </span>
          </td>
          <td>${r(a.gesamtkosten)}</td>
          <td>${i(a.skript_deadline)}</td>
          <td>${i(a.content_deadline)}</td>
          <td>
            <div class="actions-dropdown-container" data-entity-type="kooperation">
              <button class="actions-toggle" aria-expanded="false" aria-label="Aktionen">
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" class="w-5 h-5">
                  <path d="M10 3a1.5 1.5 0 110 3 1.5 1.5 0 010-3zM10 8.5a1.5 1.5 0 110 3 1.5 1.5 0 010-3zM11.5 15.5a1.5 1.5 0 10-3 0 1.5 1.5 0 003 0z" />
                </svg>
              </button>
              <div class="actions-dropdown">
                <div class="action-submenu">
                  <a href="#" class="action-item has-submenu" data-submenu="status">${L.getHeroIcon("invoice")}<span>Status ändern</span></a>
                  <div class="submenu" data-submenu="status">
                    ${(this.statusOptions||[]).map(s=>`
                      <a href="#" class="submenu-item" data-action="set-field" data-field="status_id" data-value="${s.id}" data-status-name="${s.name.replace(/\"/g,'\\"')}" data-id="${a.id}">${L.getStatusIcon(s.name)}<span>${s.name}</span>${a.status_id===s.id||a.status===s.name?'<span class=\\"submenu-check\\">'+L.getHeroIcon("check")+"</span>":""}</a>
                    `).join("")}
                  </div>
                </div>
                <a href="#" class="action-item" data-action="view" data-id="${a.id}">
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" class="w-5 h-5">
                    <path d="M10 12.5a2.5 2.5 0 100-5 2.5 2.5 0 000 5z" />
                    <path fill-rule="evenodd" d="M.661 10c1.743-2.372 4.761-5 9.339-5 4.578 0 7.601 2.628 9.339 5-1.738 2.372-4.761 5-9.339 5-4.578 0-7.601-2.628-9.339-5zM10 15a5 5 0 100-10 5 5 0 000 10z" clip-rule="evenodd" />
                  </svg>
                  Details anzeigen
                </a>
                <a href="#" class="action-item" data-action="edit" data-id="${a.id}">
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" class="w-5 h-5">
                    <path d="M5.433 13.917l-1.523 1.523a.75.75 0 001.06 1.06l1.523-1.523L5.433 13.917zM11.206 6.106L13.917 3.4a.75.75 0 011.06 1.06l-2.711 2.711-.693-.693z" />
                    <path fill-rule="evenodd" d="M1.334 10.606a1.5 1.5 0 011.06-1.06l10.38-10.38a1.5 1.5 0 012.122 0l1.523 1.523a1.5 1.5 0 010 2.122l-10.38 10.38a1.5 1.5 0 01-1.06 1.06H1.334v-3.182z" clip-rule="evenodd" />
                  </svg>
                  Bearbeiten
                </a>
                <a href="#" class="action-item" data-action="notiz" data-id="${a.id}">
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" class="w-5 h-5">
                    <path fill-rule="evenodd" d="M18 10c0 3.866-3.582 7-8 7a8.841 8.841 0 01-4.083-.98L2 17l1.336-3.117C2.688 12.31 2 11.104 2 10c0-3.866 3.582-7 8-7s8 3.134 8 7zM7 9H5v2h2V9zm8 0h-2v2h2V9zM9 9h2v2H9V9z" clip-rule="evenodd" />
                  </svg>
                  Notiz hinzufügen
                </a>
                <a href="#" class="action-item" data-action="quickview" data-id="${a.id}">
                  ${L.getHeroIcon("quickview")}
                  Schnellansicht öffnen
                </a>
                <div class="action-separator"></div>
                <a href="#" class="action-item action-danger" data-action="delete" data-id="${a.id}">
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" class="w-5 h-5">
                    <path fill-rule="evenodd" d="M8.75 1A2.75 2.75 0 006 3.75v.443c-.795.077-1.584.176-2.368.298a.75.75 0 10.232 1.482l.175-.027c.572-.089 1.14-.19 1.706-.302A3.75 3.75 0 019.75 3h.5a3.75 3.75 0 013.657 3.234c.566.112 1.134.213 1.706.302l.175.027a.75.75 0 10.232-1.482A41.203 41.203 0 0014 4.193V3.75A2.75 2.75 0 0011.25 1h-2.5zM2.5 7.75a.75.75 0 01.75-.75h13.5a.75.75 0 010 1.5H3.25a.75.75 0 01-.75-.75zM7.25 9.75a.75.75 0 01.75-.75h4.5a.75.75 0 010 1.5H8a.75.75 0 01-.75-.75zM6 12.25a.75.75 0 01.75-.75h6.5a.75.75 0 010 1.5H6.75a.75.75 0 01-.75-.75zM4.75 14.75a.75.75 0 01.75-.75h9.5a.75.75 0 010 1.5h-9.5a.75.75 0 01-.75-.75z" clip-rule="evenodd" />
                  </svg>
                  Löschen
                </a>
              </div>
            </div>
          </td>
        </tr>
      `}).join("");t.innerHTML=n}destroy(){console.log("KooperationList: Cleaning up..."),this._boundEventListeners.forEach(({element:e,type:t,handler:n})=>{e.removeEventListener(t,n)}),this._boundEventListeners.clear(),this.boundFilterResetHandler&&(document.removeEventListener("click",this.boundFilterResetHandler),this.boundFilterResetHandler=null)}showCreateForm(){console.log("🎯 Zeige Kooperations-Erstellungsformular"),window.setHeadline("Neue Kooperation anlegen");const e=window.formSystem.renderFormOnly("kooperation");window.content.innerHTML=`
      <div class="page-header">
        <div class="page-header-left">
          <h1>Neue Kooperation anlegen</h1>
          <p>Erstellen Sie eine neue Kooperation zwischen Creator und Kampagne</p>
        </div>
        <div class="page-header-right">
          <button onclick="window.navigateTo('/kooperation')" class="secondary-btn">Zurück zur Übersicht</button>
        </div>
      </div>
      
      <div class="form-page">
        ${e}
      </div>
    `,window.formSystem.bindFormEvents("kooperation",null);const t=document.getElementById("kooperation-form");t&&(t.onsubmit=async n=>{n.preventDefault(),await this.handleFormSubmit()})}async handleFormSubmit(){try{const e=document.getElementById("kooperation-form"),t=new FormData(e),n={};for(const[i,s]of t.entries())if(i.includes("[]")){const o=i.replace("[]","");n[o]||(n[o]=[]),n[o].push(s)}else n[i]=s;console.log("📝 Kooperation Submit-Daten:",n);const a=window.validatorSystem.validateForm(n,"kooperation");if(!a.isValid){this.showValidationErrors(a.errors);return}const r=await window.dataService.createEntity("kooperation",n);r.success&&window.formSystem&&await window.formSystem.handleKooperationVideos(r.id,e),r.success?(this.showSuccessMessage("Kooperation erfolgreich erstellt!"),window.dispatchEvent(new CustomEvent("entityUpdated",{detail:{entity:"kooperation",action:"created",id:r.id}})),setTimeout(()=>{window.navigateTo("/kooperation")},1500)):this.showErrorMessage(`Fehler beim Erstellen: ${r.error}`)}catch(e){console.error("❌ Fehler beim Erstellen der Kooperation:",e),this.showErrorMessage("Ein unerwarteter Fehler ist aufgetreten.")}}showValidationErrors(e){console.error("❌ Validierungsfehler:",e),document.querySelectorAll(".validation-error").forEach(t=>t.remove()),Object.entries(e).forEach(([t,n])=>{const a=document.querySelector(`[name="${t}"]`);if(a){const r=document.createElement("div");r.className="validation-error",r.textContent=n,a.parentNode.appendChild(r)}})}showSuccessMessage(e){const t=document.createElement("div");t.className="alert alert-success",t.textContent=e;const n=document.getElementById("kooperation-form");n&&(n.parentNode.insertBefore(t,n),setTimeout(()=>{t.remove()},5e3))}showErrorMessage(e){const t=document.createElement("div");t.className="alert alert-danger",t.textContent=e;const n=document.getElementById("kooperation-form");n&&(n.parentNode.insertBefore(t,n),setTimeout(()=>{t.remove()},5e3))}}const he=new at;class rt{constructor(){this.kooperationId=null,this.kooperation=null,this.notizen=[],this.ratings=[],this.creator=null,this.kampagne=null,this.rechnungen=[],this.videos=[],this.history=[],this.historyCount=0}async init(e){if(console.log("🎯 KOOPERATIONDETAIL: Initialisiere Kooperations-Detailseite für ID:",e),this.kooperationId=e,window.moduleRegistry?.currentModule!==this){console.log("⚠️ KOOPERATIONDETAIL: Nicht mehr das aktuelle Modul, breche ab");return}try{await this.loadKooperationData(),await this.render(),this.bindEvents(),console.log("✅ KOOPERATIONDETAIL: Initialisierung abgeschlossen")}catch(t){console.error("❌ KOOPERATIONDETAIL: Fehler bei der Initialisierung:",t),window.ErrorHandler.handle(t,"KooperationDetail.init")}}async loadKooperationData(){console.log("🔄 KOOPERATIONDETAIL: Lade Kooperations-Daten...");const{data:e,error:t}=await window.supabase.from("kooperationen").select(`
        id, name, status, nettobetrag, zusatzkosten, gesamtkosten, skript_deadline, content_deadline, videoanzahl,
        creator_id, kampagne_id, unternehmen_id,
        creator:creator_id ( id, vorname, nachname, instagram, instagram_follower, tiktok, tiktok_follower, mail ),
        kampagne:kampagne_id (
          id, kampagnenname, status, deadline, start, creatoranzahl,
          unternehmen:unternehmen_id ( id, firmenname ),
          marke:marke_id ( id, markenname )
        ),
        unternehmen:unternehmen_id ( id, firmenname )
      `).eq("id",this.kooperationId).single();if(t)throw new Error(`Fehler beim Laden der Kooperations-Daten: ${t.message}`);if(this.kooperation=e,console.log("✅ KOOPERATIONDETAIL: Kooperations-Basisdaten geladen:",e),this.notizen=await window.notizenSystem.loadNotizen("kooperation",this.kooperationId),console.log("✅ KOOPERATIONDETAIL: Notizen geladen:",this.notizen.length),window.bewertungsSystem)try{this.ratings=await window.bewertungsSystem.loadBewertungen("kooperation",this.kooperationId)}catch{this.ratings=[]}else this.ratings=[];this.creator=e.creator||null,this.kampagne=e.kampagne||null;try{const{data:n}=await window.supabase.from("rechnung").select("id, rechnung_nr, status, nettobetrag, bruttobetrag, gestellt_am, bezahlt_am, pdf_url").eq("kooperation_id",this.kooperationId).order("gestellt_am",{ascending:!1});this.rechnungen=n||[]}catch{this.rechnungen=[]}try{const{data:n}=await window.supabase.from("kooperation_videos").select("id, content_art, titel, asset_url, kommentar, status, position, created_at").eq("kooperation_id",this.kooperationId).order("position",{ascending:!0});this.videos=n||[];try{const a=(this.videos||[]).map(r=>r.id);if(a.length>0){const{data:r}=await window.supabase.from("kooperation_video_comment").select("id, video_id, runde, text, created_at, author_name").in("video_id",a).order("created_at",{ascending:!0}),i={};(r||[]).forEach(s=>{i[s.video_id]||(i[s.video_id]={r1:[],r2:[]});const o=s.runde===2||s.runde==="2"?"r2":"r1";i[s.video_id][o].push(s)}),this.videos=(this.videos||[]).map(s=>({...s,feedback1:i[s.id]?.r1||[],feedback2:i[s.id]?.r2||[]}))}}catch{}}catch{this.videos=[]}try{const{data:n}=await window.supabase.from("kooperation_history").select("id, old_status, new_status, comment, created_at, benutzer:changed_by(name)").eq("kooperation_id",this.kooperationId).order("created_at",{ascending:!1});this.history=(n||[]).map(a=>({id:a.id,old_status:a.old_status||null,new_status:a.new_status||null,comment:a.comment||"",created_at:a.created_at,user_name:a.benutzer?.name||"-"})),this.historyCount=this.history.length}catch{this.history=[],this.historyCount=0}}async render(){if(!this.kooperation){this.showNotFound();return}const e=window.currentUser?.permissions?.kooperation?.can_edit||!1,t=this.kooperation.name||"Kooperation";window.setHeadline&&window.setHeadline(`Kooperation: ${window.validatorSystem?.sanitizeHtml?.(t)||t}`);const n=`
      <div class="page-header">
        <div class="page-header-left">
          <h1>${window.validatorSystem.sanitizeHtml(t)}</h1>
          <p>Kooperations-Details und Aktivitäten</p>
        </div>
        <div class="page-header-right">
          <button onclick="window.navigateTo('/kooperation')" class="secondary-btn">Zurück zur Übersicht</button>
          ${e?'<button id="btn-edit-kooperation" class="primary-btn">Bearbeiten</button>':""}
        </div>
      </div>

      <div class="content-section">
        <div class="tab-navigation">
          <button class="tab-button active" data-tab="info">
            <i class="icon-information-circle"></i>
            Informationen
          </button>
          <button class="tab-button" data-tab="videos">
            <i class="icon-film"></i>
            Videos <span class="tab-count">${this.videos.length}</span>
          </button>
          <button class="tab-button" data-tab="notizen">
            <i class="icon-document-text"></i>
            Notizen <span class="tab-count">${this.notizen.length}</span>
          </button>
          <button class="tab-button" data-tab="ratings">
           
            Bewertungen <span class="tab-count">${this.ratings.length}</span>
          </button>
          <button class="tab-button" data-tab="history">
            
            History <span class="tab-count">${this.historyCount}</span>
          </button>
          <button class="tab-button" data-tab="rechnungen">
            <i class="icon-currency-euro"></i>
            Rechnungen <span class="tab-count">${this.rechnungen.length}</span>
          </button>
        </div>

        <div class="tab-content">
          <div class="tab-pane active" id="tab-info">
            ${this.renderInfo()}
          </div>
          <div class="tab-pane" id="tab-videos">
            <div class="detail-section">
              <h2>Videos</h2>
              ${this.renderVideos()}
            </div>
          </div>
          <div class="tab-pane" id="tab-notizen">
            <div class="detail-section">
              <h2>Notizen</h2>
              ${this.renderNotizen()}
            </div>
          </div>
          <div class="tab-pane" id="tab-ratings">
            <div class="detail-section">
              <h2>Bewertungen</h2>
              ${this.renderRatings()}
            </div>
          </div>
          <div class="tab-pane" id="tab-history">
            <div class="detail-section">
              <h2>History</h2>
              ${this.renderHistory()}
            </div>
          </div>
          <div class="tab-pane" id="tab-rechnungen">
            <div class="detail-section">
              <h2>Rechnungen</h2>
              ${this.renderRechnungen()}
            </div>
          </div>
        </div>
      </div>
    `;window.setContentSafely(window.content,n)}renderInfo(){const e=r=>r?new Intl.NumberFormat("de-DE",{style:"currency",currency:"EUR"}).format(r):"-",t=r=>r?new Date(r).toLocaleDateString("de-DE"):"-",n=this.creator?`
      <div class="detail-card">
        <h3>Creator</h3>
        <div class="detail-grid-2">
          <div class="detail-item"><label>Name</label><span>${this.creator.vorname} ${this.creator.nachname}</span></div>
          <div class="detail-item"><label>E-Mail</label><span>${this.creator.mail||"-"}</span></div>
          <div class="detail-item"><label>Instagram</label><span>${this.creator.instagram?`@${this.creator.instagram}`:"-"}</span></div>
          <div class="detail-item"><label>Instagram Follower</label><span>${this.creator.instagram_follower?this.formatNumber(this.creator.instagram_follower):"-"}</span></div>
          <div class="detail-item"><label>TikTok</label><span>${this.creator.tiktok?`@${this.creator.tiktok}`:"-"}</span></div>
          <div class="detail-item"><label>TikTok Follower</label><span>${this.creator.tiktok_follower?this.formatNumber(this.creator.tiktok_follower):"-"}</span></div>
        </div>
        <div class="detail-actions">
          <button onclick="window.navigateTo('/creator/${this.creator.id}')" class="secondary-btn">Creator Details anzeigen</button>
        </div>
      </div>
    `:'<div class="detail-card"><h3>Creator</h3><p>Keine Creator-Daten</p></div>',a=this.kampagne?`
      <div class="detail-card">
        <h3>Kampagne</h3>
        <div class="detail-grid-2">
          <div class="detail-item"><label>Name</label><span>${this.kampagne.kampagnenname}</span></div>
          <div class="detail-item"><label>Status</label><span class="status-badge status-${this.kampagne.status?.toLowerCase()||"unknown"}">${this.kampagne.status||"-"}</span></div>
          <div class="detail-item"><label>Unternehmen</label><span>${this.kampagne.unternehmen?.firmenname||"-"}</span></div>
          <div class="detail-item"><label>Marke</label><span>${this.kampagne.marke?.markenname||"-"}</span></div>
        </div>
        <div class="detail-actions">
          <button onclick="window.navigateTo('/kampagne/${this.kampagne.id}')" class="secondary-btn">Kampagne Details anzeigen</button>
        </div>
      </div>
    `:'<div class="detail-card"><h3>Kampagne</h3><p>Keine Kampagnen-Daten</p></div>';return`
      <div class="detail-section">
        <h2>Kooperations-Informationen</h2>
        <div class="detail-grid">
          <div class="detail-card">
            <h3>Allgemein</h3>
            <div class="detail-grid-2">
              <div class="detail-item"><label>Status</label><span class="status-badge status-${this.kooperation.status?.toLowerCase()||"unknown"}">${this.kooperation.status||"-"}</span></div>
              <div class="detail-item"><label>Budget</label><span>${e(this.kooperation.gesamtkosten??(this.kooperation.nettobetrag||0)+(this.kooperation.zusatzkosten||0))}</span></div>
              <div class="detail-item"><label>Skript-Deadline</label><span>${t(this.kooperation.skript_deadline)}</span></div>
              <div class="detail-item"><label>Content-Deadline</label><span>${t(this.kooperation.content_deadline)}</span></div>
            </div>
          </div>

          ${n}
          ${a}
        </div>
      </div>
    `}renderNotizen(){return window.notizenSystem?window.notizenSystem.renderNotizenContainer(this.notizen,"kooperation",this.kooperationId):!this.notizen||this.notizen.length===0?`
        <div class="empty-state">
          <p>Keine Notizen vorhanden</p>
        </div>
      `:`<div class="notizen-container">${this.notizen.map(t=>`
      <div class="notiz-card">
        <div class="notiz-header">
          <span>${t.user_name||"Unbekannt"}</span>
          <span>${new Date(t.created_at).toLocaleDateString("de-DE")}</span>
        </div>
        <div class="notiz-content"><p>${window.validatorSystem?.sanitizeHtml?.(t.text)||t.text}</p></div>
      </div>
    `).join("")}</div>`}renderRatings(){return window.bewertungsSystem?window.bewertungsSystem.renderBewertungenContainer(this.ratings,"kooperation",this.kooperationId):!this.ratings||this.ratings.length===0?`
        <div class="empty-state">
          <p>Keine Bewertungen vorhanden.</p>
        </div>
      `:""}renderHistory(){if(!this.history||this.history.length===0)return`
        <div class="empty-state">
          <p>Keine Historie vorhanden</p>
        </div>
      `;const e=n=>n?new Date(n).toLocaleString("de-DE"):"-";return`
      <div class="data-table-container">
        <table class="data-table">
          <thead>
            <tr>
              <th>Zeitpunkt</th>
              <th>User</th>
              <th>Alt</th>
              <th>Neu</th>
              <th>Kommentar</th>
            </tr>
          </thead>
          <tbody>${this.history.map(n=>`
      <tr>
        <td>${e(n.created_at)}</td>
        <td>${window.validatorSystem.sanitizeHtml(n.user_name||"-")}</td>
        <td>${window.validatorSystem.sanitizeHtml(n.old_status||"-")}</td>
        <td>${window.validatorSystem.sanitizeHtml(n.new_status||"-")}</td>
        <td>${window.validatorSystem.sanitizeHtml(n.comment||"")}</td>
      </tr>
    `).join("")}</tbody>
        </table>
      </div>
    `}renderRechnungen(){if(!this.rechnungen||this.rechnungen.length===0)return'<p class="empty-state">Keine Rechnungen zu dieser Kooperation.</p>';const e=a=>a?new Intl.NumberFormat("de-DE",{style:"currency",currency:"EUR"}).format(a):"-",t=a=>a?new Date(a).toLocaleDateString("de-DE"):"-";return`
      <div class="data-table-container">
        <table class="data-table">
          <thead>
            <tr>
              <th>Rechnungs-Nr</th>
              <th>Status</th>
              <th>Netto</th>
              <th>Brutto</th>
              <th>Gestellt</th>
              <th>Bezahlt</th>
              <th>Beleg</th>
            </tr>
          </thead>
          <tbody>${this.rechnungen.map(a=>`
      <tr>
        <td><a href="/rechnung/${a.id}" onclick="event.preventDefault(); window.navigateTo('/rechnung/${a.id}')">${window.validatorSystem.sanitizeHtml(a.rechnung_nr||"—")}</a></td>
        <td>${a.status||"-"}</td>
        <td>${e(a.nettobetrag)}</td>
        <td>${e(a.bruttobetrag)}</td>
        <td>${t(a.gestellt_am)}</td>
        <td>${t(a.bezahlt_am)}</td>
        <td>${a.pdf_url?`<a href="${a.pdf_url}" target="_blank" rel="noopener">PDF</a>`:"-"}</td>
      </tr>
    `).join("")}</tbody>
        </table>
      </div>
    `}renderVideos(){return!this.videos||this.videos.length===0?'<p class="empty-state">Keine Videos angelegt.</p>':`
      <div class="data-table-container">
        <table class="data-table">
          <thead>
            <tr>
              <th>#</th>
              <th>Content Art</th>
              <th>URL</th>
              <th>Feedback K1</th>
              <th>Feedback K2</th>
              <th>Status</th>
              <th>Aktion</th>
            </tr>
          </thead>
          <tbody>${this.videos.map(t=>{const n=r=>!r||r.length===0?"-":r.map(i=>{const s=i.created_at?new Date(i.created_at).toLocaleDateString("de-DE"):"",o=i.author_name||"",l=window.validatorSystem.sanitizeHtml(i.text||"");return`<div class="fb-line"><span class="fb-meta">${o}${s?" • "+s:""}</span><div class="fb-text">${l}</div></div>`}).join(""),a=`
        <div class="actions-dropdown-container" data-entity-type="kooperation_videos">
          <button class="actions-toggle" aria-expanded="false" aria-label="Aktionen">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M12 8c1.1 0 2-.9 2-2s-.9-2-2-2-2 .9-2 2 .9 2 2 2zm0 2c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2z"/></svg>
          </button>
          <div class="actions-dropdown">
            <div class="action-submenu">
              <a href="#" class="action-item has-submenu" data-submenu="status">
                ${L.getHeroIcon("invoice")}
                <span>Status ändern</span>
              </a>
              <div class="submenu" data-submenu="status">
                <a href="#" class="submenu-item" data-action="set-field" data-field="status" data-value="produktion" data-id="${t.id}">
                  ${L.getStatusIcon("Kick-Off")}
                  <span>Produktion</span>
                  ${(t.status||"produktion")==="produktion"?'<span class="submenu-check">✓</span>':""}
                </a>
                <a href="#" class="submenu-item" data-action="set-field" data-field="status" data-value="abgeschlossen" data-id="${t.id}">
                  ${L.getHeroIcon("check")}
                  <span>Abgeschlossen</span>
                  ${t.status==="abgeschlossen"?'<span class="submenu-check">✓</span>':""}
                </a>
              </div>
            </div>
            <a href="#" class="action-item" data-action="video-view" data-id="${t.id}">
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="size-6">
                <path stroke-linecap="round" stroke-linejoin="round" d="M2.036 12.322a1.012 1.012 0 0 1 0-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178Z" />
                <path stroke-linecap="round" stroke-linejoin="round" d="M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" />
              </svg>
              Details ansehen
            </a>
            <a href="#" class="action-item" data-action="video-edit" data-id="${t.id}">
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="size-6">
                <path stroke-linecap="round" stroke-linejoin="round" d="m16.862 4.487 1.687-1.688a1.875 1.875 0 1 1 2.652 2.652L10.582 16.07a4.5 4.5 0 0 1-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 0 1 1.13-1.897l8.932-8.931Zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0 1 15.75 21H5.25A2.25 2.25 0 0 1 3 18.75V8.25A2.25 2.25 0 0 1 5.25 6H10" />
              </svg>
              Bearbeiten
            </a>
            <div class="action-separator"></div>
            <a href="#" class="action-item action-danger" data-action="video-delete" data-id="${t.id}">
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="size-6">
                <path stroke-linecap="round" stroke-linejoin="round" d="m14.74 9-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 0 1-2.244 2.077H8.084a2.25 2.25 0 0 1-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 0 0-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 0 1 3.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 0 0-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 0 0-7.5 0" />
              </svg>
              Löschen
            </a>
          </div>
        </div>`;return`
        <tr>
          <td>${t.position||"-"}</td>
          <td>${window.validatorSystem.sanitizeHtml(t.content_art||"-")}</td>
          <td>${t.asset_url?`<a href="${t.asset_url}" target="_blank" rel="noopener">Link</a>`:"-"}</td>
          <td class="feedback-cell">${n(t.feedback1)}</td>
          <td class="feedback-cell">${n(t.feedback2)}</td>
          <td><span class="status-badge status-${(t.status||"produktion").toLowerCase()}">${t.status==="abgeschlossen"?"Abgeschlossen":"Produktion"}</span></td>
          <td>${a}</td>
        </tr>`}).join("")}</tbody>
        </table>
      </div>
    `}bindEvents(){document.addEventListener("click",e=>{e.target.classList?.contains("tab-button")&&(e.preventDefault(),this.switchTab(e.target.dataset.tab))}),document.addEventListener("click",e=>{e.target.id==="btn-edit-kooperation"&&(e.preventDefault(),this.showEditForm())}),window.addEventListener("notizenUpdated",async e=>{if(e.detail.entityType==="kooperation"&&e.detail.entityId===this.kooperationId){this.notizen=await window.notizenSystem.loadNotizen("kooperation",this.kooperationId);const t=document.querySelector("#tab-notizen .detail-section");t&&(t.innerHTML=`<h2>Notizen</h2>${this.renderNotizen()}`);const n=document.querySelector('.tab-button[data-tab="notizen"] .tab-count');n&&(n.textContent=String(this.notizen.length))}}),window.addEventListener("entityUpdated",async e=>{if(e.detail?.entity==="kooperation_videos"){await this.loadKooperationData();const t=document.querySelector("#tab-videos .detail-section");if(t&&(t.innerHTML=`<h2>Videos</h2>${this.renderVideos()}`),window.location.pathname.startsWith("/video/"))try{const n=window.location.pathname.split("/").pop();n&&window.navigateTo(`/video/${n}`)}catch{}}}),window.addEventListener("bewertungenUpdated",async e=>{if(e.detail.entityType==="kooperation"&&e.detail.entityId===this.kooperationId){this.ratings=await window.bewertungsSystem.loadBewertungen("kooperation",this.kooperationId);const t=document.querySelector("#tab-ratings .detail-section");t&&(t.innerHTML=`<h2>Bewertungen</h2>${this.renderRatings()}`);const n=document.querySelector('.tab-button[data-tab="ratings"] .tab-count');n&&(n.textContent=String(this.ratings.length))}})}showEditForm(){console.log("🎯 Zeige Kooperations-Bearbeitungsformular"),window.setHeadline("Kooperation bearbeiten");const e=window.formSystem.renderFormOnly("kooperation",this.kooperation);window.content.innerHTML=`
      <div class="page-header">
        <div class="page-header-left">
          <h1>Kooperation bearbeiten</h1>
          <p>Bearbeiten Sie die Kooperations-Details</p>
        </div>
        <div class="page-header-right">
          <button onclick="window.navigateTo('/kooperation/${this.kooperationId}')" class="secondary-btn">Zurück zu Details</button>
        </div>
      </div>
      
      <div class="form-page">
        ${e}
      </div>
    `,window.formSystem.bindFormEvents("kooperation",this.kooperationId);const t=document.getElementById("kooperation-form");t&&(t.onsubmit=async n=>{n.preventDefault(),await this.handleEditFormSubmit()})}async handleEditFormSubmit(){try{const e=document.getElementById("kooperation-form"),t=new FormData(e),n={};for(const[i,s]of t.entries())if(i.includes("[]")){const o=i.replace("[]","");n[o]||(n[o]=[]),n[o].push(s)}else n[i]=s;console.log("📝 Kooperation Edit Submit-Daten:",n);const a=window.validatorSystem.validateForm(n,"kooperation");if(!a.isValid){this.showValidationErrors(a.errors);return}const r=await window.dataService.updateEntity("kooperation",this.kooperationId,n);r.success?(this.showSuccessMessage("Kooperation erfolgreich aktualisiert!"),window.dispatchEvent(new CustomEvent("entityUpdated",{detail:{entity:"kooperation",action:"updated",id:this.kooperationId}})),setTimeout(()=>{window.navigateTo(`/kooperation/${this.kooperationId}`)},1500)):this.showErrorMessage(`Fehler beim Aktualisieren: ${r.error}`)}catch(e){console.error("❌ Fehler beim Aktualisieren der Kooperation:",e),this.showErrorMessage("Ein unerwarteter Fehler ist aufgetreten.")}}showAddNotizModal(){window.notizenSystem.showAddNotizModal("kooperation",this.kooperationId,()=>{this.loadKooperationData().then(()=>{this.render()})})}switchTab(e){document.querySelectorAll(".tab-button").forEach(a=>a.classList.remove("active")),document.querySelectorAll(".tab-pane").forEach(a=>a.classList.remove("active"));const t=document.querySelector(`[data-tab="${e}"]`),n=document.getElementById(`tab-${e}`);t&&n&&(t.classList.add("active"),n.classList.add("active"))}showNotFound(){window.setHeadline("Kooperation nicht gefunden"),window.content.innerHTML=`
      <div class="error-message">
        <h2>Kooperation nicht gefunden</h2>
        <p>Die angeforderte Kooperation konnte nicht gefunden werden.</p>
        <button onclick="window.navigateTo('/kooperation')" class="primary-btn">Zurück zur Übersicht</button>
      </div>
    `}showValidationErrors(e){console.error("❌ Validierungsfehler:",e),document.querySelectorAll(".validation-error").forEach(t=>t.remove()),Object.entries(e).forEach(([t,n])=>{const a=document.querySelector(`[name="${t}"]`);if(a){const r=document.createElement("div");r.className="validation-error",r.textContent=n,a.parentNode.appendChild(r)}})}showSuccessMessage(e){const t=document.createElement("div");t.className="alert alert-success",t.textContent=e;const n=document.getElementById("kooperation-form");n&&(n.parentNode.insertBefore(t,n),setTimeout(()=>{t.remove()},5e3))}showErrorMessage(e){const t=document.createElement("div");t.className="alert alert-danger",t.textContent=e;const n=document.getElementById("kooperation-form");n&&(n.parentNode.insertBefore(t,n),setTimeout(()=>{t.remove()},5e3))}formatNumber(e){return e?new Intl.NumberFormat("de-DE").format(e):"-"}formatCurrency(e){return e?new Intl.NumberFormat("de-DE",{style:"currency",currency:"EUR"}).format(e):"-"}formatDate(e){return e?new Date(e).toLocaleDateString("de-DE"):"-"}destroy(){console.log("KooperationDetail: Cleaning up...")}}const me=new rt,pe={videoId:null,video:null,kooperation:null,comments:[],assets:[],async init(b){try{if(this.videoId=b==="new"?null:b,!this.videoId){window.setHeadline("Neues Video"),window.content.innerHTML='<p class="empty-state">Neuanlage für Videos ist noch nicht implementiert.</p>';return}await this.loadData(),this.render(),this.bindEvents()}catch(e){console.error("KooperationVideoDetail init error:",e),window.notificationSystem?.error?.("Video-Detail konnte nicht geladen werden.")}},async loadData(){const{data:b,error:e}=await window.supabase.from("kooperation_videos").select("id, kooperation_id, titel, content_art, asset_url, kommentar, status, position, created_at").eq("id",this.videoId).single();if(e)throw e;this.video=b;try{const{data:t}=await window.supabase.from("kooperationen").select("id, name, kampagne:kampagne_id(id, kampagnenname)").eq("id",b.kooperation_id).single();this.kooperation=t||null}catch{this.kooperation=null}try{const{data:t}=await window.supabase.from("kooperation_video_comment").select("id, video_id, runde, text, author_name, author_benutzer_id, created_at").eq("video_id",this.videoId).order("created_at",{ascending:!0});this.comments=t||[]}catch{this.comments=[]}try{const{data:t}=await window.supabase.from("kooperation_video_asset").select("id, file_url, file_path, created_at").eq("video_id",this.videoId).order("created_at",{ascending:!0});this.assets=t||[]}catch{this.assets=[]}},render(){const b=this.video||{},e=b.titel||`Video #${b.id}`,t=this.kooperation?.name||"-",n=this.kooperation?.kampagne?.kampagnenname||"-",a=h=>window.validatorSystem?.sanitizeHtml?.(h)??h,r=h=>h?new Date(h).toLocaleString("de-DE"):"-";typeof window.setHeadline=="function"&&window.setHeadline(`Video: ${a(e)}`);const i=window.currentUser?.permissions?.kooperation?.can_edit||window.currentUser?.rolle==="admin",s=b.asset_url||"",o=/\.(mp4|webm|ogg)(\?|$)/i.test(s),l=s?o?`<video src="${s}" controls style="width:100%;max-height:60vh;border-radius:8px;"></video>`:`<a href="${s}" target="_blank" rel="noopener" class="primary-btn">Asset öffnen</a>`:'<p class="empty-state">Kein Asset hinterlegt.</p>',c={r1:[],r2:[]};(this.comments||[]).forEach(h=>{const m=h.runde===2||h.runde==="2"?"r2":"r1";c[m].push(h)});const d=this.assets.length?this.assets.map(h=>`<li><a href="${h.file_url||"#"}" target="_blank" rel="noopener">${h.file_path||h.file_url}</a></li>`).join(""):"<li>Keine weiteren Assets.</li>",u=`
      <div class="page-header">
        <div class="page-header-left">
          <h1>${a(e)}</h1>
          <p>Kooperation: ${a(t)} · Kampagne: ${a(n)}</p>
        </div>
        <div class="page-header-right">
          ${b.kooperation_id?'<button id="btn-back-kooperation" class="secondary-btn">Zur Kooperation</button>':""}
        </div>
      </div>

      <div class="content-section">
        <div class="detail-grid">
          <div class="detail-card">
            <h3>Asset</h3>
            ${l}
            ${this.assets.length?`<div class="asset-list"><h4>Zusätzliche Assets</h4><ul>${d}</ul></div>`:""}
          </div>

          <div class="detail-card">
            <h3>Informationen</h3>
            <div class="detail-grid-2">
              <div class="detail-item"><label>Content-Art</label><span>${a(b.content_art||"-")}</span></div>
              <div class="detail-item"><label>Position</label><span>${b.position||"-"}</span></div>
              <div class="detail-item"><label>Status</label>
                <span class="status-badge status-${(b.status||"produktion").toLowerCase()}">${b.status==="abgeschlossen"?"Abgeschlossen":"Produktion"}</span>
              </div>
              <div class="detail-item"><label>Erstellt</label><span>${r(b.created_at)}</span></div>
            </div>
            ${i?`
            <div class="form-inline" style="margin-top:12px;gap:8px;display:flex;align-items:center;">
              <label>Status ändern:</label>
              <select id="video-status" class="form-input" style="max-width:220px;">
                <option value="produktion" ${b.status!=="abgeschlossen"?"selected":""}>Produktion</option>
                <option value="abgeschlossen" ${b.status==="abgeschlossen"?"selected":""}>Abgeschlossen</option>
              </select>
              <button id="btn-save-status" class="primary-btn">Speichern</button>
            </div>`:""}
          </div>
        </div>

        <div class="detail-grid">
          <div class="detail-card">
            <h3>Feedback Runde 1</h3>
            <div id="comments-r1">${this.renderCommentsTable(c.r1)}</div>
          </div>
          <div class="detail-card">
            <h3>Feedback Runde 2</h3>
            <div id="comments-r2">${this.renderCommentsTable(c.r2)}</div>
          </div>
        </div>

        <div class="detail-card">
          <h3>Kommentar hinzufügen</h3>
          <form id="comment-form">
            <div class="detail-grid-2">
              <div class="form-field">
                <label>Runde</label>
                <select name="runde" class="form-input">
                  <option value="1">1</option>
                  <option value="2">2</option>
                </select>
              </div>
              <div class="form-field" style="grid-column: span 2;">
                <label>Text</label>
                <textarea name="text" class="form-input" rows="3" placeholder="Kommentar eingeben..."></textarea>
              </div>
            </div>
            <div style="margin-top:8px;">
              <button type="submit" class="primary-btn">Speichern</button>
            </div>
          </form>
        </div>
      </div>
    `;window.setContentSafely(window.content,u)},renderCommentsTable(b){const e=a=>window.validatorSystem?.sanitizeHtml?.(a)??a,t=a=>a?new Date(a).toLocaleString("de-DE"):"-";return!b||b.length===0?'<p class="empty-state">Keine Kommentare vorhanden.</p>':`
      <div class="data-table-container">
        <table class="data-table">
          <thead>
            <tr>
              <th>Name</th>
              <th>Datum</th>
              <th>Kommentar</th>
              <th>Aktion</th>
            </tr>
          </thead>
          <tbody>${b.map(a=>`
      <tr>
        <td>${e(a.author_name||"-")}</td>
        <td>${t(a.created_at)}</td>
        <td>${e(a.text||"")}</td>
        <td>
          <div class="actions-dropdown-container" data-entity-type="kooperation_video_comment">
            <button class="actions-toggle" aria-expanded="false" aria-label="Aktionen">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 8c1.1 0 2-.9 2-2s-.9-2-2-2-2 .9-2 2 .9 2 2 2zm0 2c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2zm0 6c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2z"/>
              </svg>
            </button>
            <div class="actions-dropdown">
              <a href="#" class="action-item action-danger comment-delete" data-id="${a.id}">
                ${window.ActionsDropdown?.getHeroIcon?window.ActionsDropdown.getHeroIcon("delete"):""}
                Entfernen
              </a>
            </div>
          </div>
        </td>
      </tr>
    `).join("")}</tbody>
        </table>
      </div>
    `},bindEvents(){document.getElementById("btn-back-kooperation")?.addEventListener("click",n=>{n.preventDefault(),this.video?.kooperation_id&&window.navigateTo(`/kooperation/${this.video.kooperation_id}`)});const b=document.getElementById("btn-save-status");b&&b.addEventListener("click",async n=>{n.preventDefault();try{const r=document.getElementById("video-status")?.value||"produktion",{error:i}=await window.supabase.from("kooperation_videos").update({status:r,updated_at:new Date().toISOString()}).eq("id",this.videoId);if(i)throw i;await this.loadData(),this.render(),this.bindEvents(),window.dispatchEvent(new CustomEvent("entityUpdated",{detail:{entity:"kooperation_videos",action:"updated",id:this.videoId,field:"status",value:r}}))}catch(a){console.error("Status speichern fehlgeschlagen",a),alert("Status konnte nicht gespeichert werden.")}});const e=document.getElementById("comment-form");e&&e.addEventListener("submit",async n=>{n.preventDefault();const a=new FormData(e),r=parseInt(a.get("runde")||"1",10)===2?2:1,i=String(a.get("text")||"").trim();if(i)try{const s={video_id:this.videoId,runde:r,text:i,author_benutzer_id:window.currentUser?.id||null,author_name:window.currentUser?.name||null,created_at:new Date().toISOString()},{error:o}=await window.supabase.from("kooperation_video_comment").insert(s);if(o)throw o;e.reset(),await this.loadData(),this.render(),this.bindEvents()}catch(s){console.error("Kommentar speichern fehlgeschlagen",s),alert("Kommentar konnte nicht gespeichert werden.")}});const t=document.querySelector(".content-section");t&&t.addEventListener("click",async n=>{const a=n.target.closest(".comment-delete");if(!a)return;n.preventDefault();const r=a.dataset.id;if(r&&confirm("Kommentar wirklich entfernen?"))try{const{error:i}=await window.supabase.from("kooperation_video_comment").delete().eq("id",r);if(i)throw i;await this.loadData(),this.render(),this.bindEvents()}catch(i){console.error("Kommentar löschen fehlgeschlagen",i),alert("Kommentar konnte nicht gelöscht werden.")}})},destroy(){}};class it{constructor(){this.selectedKampagnen=new Set,this._boundEventListeners=new Set,this.statusOptions=[],this.kampagneArtMap=new Map}async init(){if(window.setHeadline("Kampagnen Übersicht"),!(window.canViewPage&&window.canViewPage("kampagne")||await window.checkUserPermission("kampagne","can_view"))){window.content.innerHTML=`
        <div class="error-message">
          <p>Sie haben keine Berechtigung, Kampagnen anzuzeigen.</p>
        </div>
      `;return}this.bindEvents(),await this.loadAndRender()}async loadAndRender(){try{const e=await window.dataService.loadFilterData("kampagne");await this.render(e),await this.initializeFilterBar();const t=_.getFilters("kampagne");console.log("🔍 Lade Kampagnen mit Filter:",t);const n=await this.loadKampagnenWithRelations();console.log("📊 Kampagnen geladen:",n?.length||0),this.updateTable(n)}catch(e){window.ErrorHandler.handle(e,"KampagneList.loadAndRender")}}async loadKampagnenWithRelations(){try{if(!window.supabase)return console.warn("⚠️ Supabase nicht verfügbar - verwende Mock-Daten"),await window.dataService.loadEntities("kampagne");try{const[{data:o},{data:l}]=await Promise.all([window.supabase.from("kampagne_status").select("id, name, sort_order").order("sort_order",{ascending:!0}).order("name",{ascending:!0}),window.supabase.from("kampagne_art_typen").select("id, name")]);this.statusOptions=o||[],this.kampagneArtMap=new Map((l||[]).map(c=>[c.id,c.name]))}catch(o){console.warn("⚠️ Konnte Status/Arten nicht laden",o)}const e=window.currentUser?.rolle==="admin"||window.currentUser?.rolle?.toLowerCase()==="admin";let t=[];if(!e)try{const{data:o}=await window.supabase.from("kampagne_mitarbeiter").select("kampagne_id").eq("mitarbeiter_id",window.currentUser?.id),l=(o||[]).map(h=>h.kampagne_id).filter(Boolean),{data:c}=await window.supabase.from("marke_mitarbeiter").select("marke_id").eq("mitarbeiter_id",window.currentUser?.id),d=(c||[]).map(h=>h.marke_id).filter(Boolean);let u=[];if(d.length>0){const{data:h}=await window.supabase.from("kampagne").select("id").in("marke_id",d);u=(h||[]).map(m=>m.id).filter(Boolean)}if(t=[...new Set([...l,...u])],console.log(`🔍 KAMPAGNELIST: Mitarbeiter ${window.currentUser?.id} hat Zugriff auf:`,{direkteKampagnen:l.length,markenKampagnen:u.length,gesamt:t.length}),t.length===0)return[]}catch(o){return console.error("❌ Fehler beim Laden der Zuordnungen:",o),[]}let n=window.supabase.from("kampagne").select(`
          *,
          unternehmen:unternehmen_id(firmenname),
          marke:marke_id(markenname),
          auftrag:auftrag_id(auftragsname),
          status_ref:status_id(id, name)
        `).order("created_at",{ascending:!1});!e&&t.length>0&&(n=n.in("id",t));const{data:a,error:r}=await n;if(r)throw console.error("❌ Fehler beim Laden der Kampagnen mit Beziehungen:",r),r;const i=a.map(o=>{const c=(Array.isArray(o.art_der_kampagne)?o.art_der_kampagne:[]).map(d=>this.kampagneArtMap.get(d)||d);return{...o,art_der_kampagne_display:c,unternehmen:o.unternehmen?{firmenname:o.unternehmen.firmenname}:null,marke:o.marke?{markenname:o.marke.markenname}:null,auftrag:o.auftrag?{auftragsname:o.auftrag.auftragsname}:null,status_name:o.status_ref?.name||o.status||null}}),s=window.dataService.entities.kampagne;return s.manyToMany&&await window.dataService.loadManyToManyRelations(i,"kampagne",s.manyToMany),console.log("✅ Kampagnen mit Beziehungen geladen:",i),i}catch(e){return console.error("❌ Fehler beim Laden der Kampagnen mit Beziehungen:",e),await window.dataService.loadEntities("kampagne")}}async render(e){const t=window.currentUser?.permissions?.kampagne?.can_edit||!1,n=_.getFilters("kampagne");Object.entries(n).forEach(([i,s])=>{});let a=`<div class="filter-bar">
      <div class="filter-left">
        <div id="filter-container"></div>
      </div>
      <div class="filter-right">
        <button id="btn-filter-reset" class="secondary-btn" style="display:${this.hasActiveFilters()?"inline-block":"none"};">Filter zurücksetzen</button>
      </div>
    </div>`,r=`
      <div class="page-header">
        <div class="page-header-left">
          <h1>Kampagnen</h1>
          <p>Verwalten Sie alle Kampagnen und deren Details</p>
        </div>
        <div class="page-header-right">
          ${t?'<button id="btn-kampagne-new" class="primary-btn">Neue Kampagne anlegen</button>':""}
        </div>
      </div>

      ${a}

      <div class="table-actions">
        <div class="table-actions-left">
          <button id="btn-select-all" class="secondary-btn">Alle auswählen</button>
          <button id="btn-deselect-all" class="secondary-btn" style="display:none;">Auswahl aufheben</button>
        </div>
        <div class="table-actions-right">
          <button id="btn-delete-selected" class="danger-btn" style="display:none;">Ausgewählte löschen</button>
        </div>
      </div>

      <div class="data-table-container">
        <table class="data-table">
          <thead>
            <tr>
              <th>
                <input type="checkbox" id="select-all-kampagnen">
              </th>
              <th>Kampagnenname</th>
              <th>Unternehmen</th>
              <th>Marke</th>
              <th>Art der Kampagne</th>
              <th>Status</th>
              <th>Start</th>
              <th>Deadline</th>
              <th>Creator Anzahl</th>
              <th>Video Anzahl</th>
              <th>Ansprechpartner</th>
              <th>Aktionen</th>
            </tr>
          </thead>
          <tbody id="kampagnen-table-body">
            <tr>
              <td colspan="12" class="loading">Lade Kampagnen...</td>
            </tr>
          </tbody>
        </table>
      </div>
    `;window.setContentSafely(window.content,r)}async initializeFilterBar(){const e=document.getElementById("filter-container");e&&await _.renderFilterBar("kampagne",e,t=>this.onFiltersApplied(t),()=>this.onFiltersReset())}onFiltersApplied(e){console.log("🔍 KampagneList: Filter angewendet:",e),_.applyFilters("kampagne",e),this.loadAndRender()}onFiltersReset(){console.log("🔄 KampagneList: Filter zurückgesetzt"),_.resetFilters("kampagne"),this.loadAndRender()}bindEvents(){this.boundFilterResetHandler=e=>{e.target.id==="btn-filter-reset"&&this.onFiltersReset()},document.addEventListener("click",this.boundFilterResetHandler),document.addEventListener("click",e=>{(e.target.id==="btn-kampagne-new"||e.target.id==="btn-kampagne-new-filter")&&(e.preventDefault(),window.navigateTo("/kampagne/new"))}),document.addEventListener("click",e=>{if(e.target.id==="btn-select-all"){e.preventDefault(),document.querySelectorAll(".kampagne-check").forEach(a=>{a.checked=!0,a.dataset.id&&this.selectedKampagnen.add(a.dataset.id)});const n=document.getElementById("select-all-kampagnen");n&&(n.indeterminate=!1,n.checked=!0),this.updateSelection()}}),document.addEventListener("click",e=>{e.target.id==="btn-deselect-all"&&(e.preventDefault(),this.deselectAll())}),document.addEventListener("click",e=>{if(e.target.classList.contains("table-link")&&e.target.dataset.table==="kampagne"){e.preventDefault();const t=e.target.dataset.id;console.log("🎯 KAMPAGNELIST: Navigiere zu Kampagne Details:",t),window.navigateTo(`/kampagne/${t}`)}}),window.addEventListener("entityUpdated",e=>{e.detail.entity==="kampagne"&&this.loadAndRender()}),document.addEventListener("click",e=>{if(e.target.classList.contains("tag-x")){e.preventDefault(),e.stopPropagation();const n=e.target.closest(".filter-tag").dataset.key,a=_.getFilters("kampagne");delete a[n],_.applyFilters("kampagne",a),this.loadAndRender()}}),document.addEventListener("change",e=>{if(e.target.id==="select-all-kampagnen"){const t=document.querySelectorAll(".kampagne-check"),n=e.target.checked;t.forEach(a=>{a.checked=n,n?this.selectedKampagnen.add(a.dataset.id):this.selectedKampagnen.delete(a.dataset.id)}),this.updateSelection(),console.log(`${n?"✅ Alle Kampagnen ausgewählt":"❌ Alle Kampagnen abgewählt"}: ${this.selectedKampagnen.size}`)}}),document.addEventListener("change",e=>{e.target.classList.contains("kampagne-check")&&(e.target.checked?this.selectedKampagnen.add(e.target.dataset.id):this.selectedKampagnen.delete(e.target.dataset.id),this.updateSelection(),this.updateSelectAllCheckbox())}),window.bulkActionSystem&&window.bulkActionSystem.registerList("kampagne",this)}hasActiveFilters(){const e=_.getFilters("kampagne");return Object.keys(e).length>0}updateSelection(){const e=this.selectedKampagnen.size,t=document.getElementById("selected-count"),n=document.getElementById("btn-deselect-all"),a=document.getElementById("btn-delete-selected");t&&(t.textContent=`${e} ausgewählt`,t.style.display=e>0?"inline":"none"),n&&(n.style.display=e>0?"inline-block":"none"),a&&(a.style.display=e>0?"inline-block":"none")}async updateTable(e){const t=document.getElementById("kampagnen-table-body");if(!t)return;if(!e||e.length===0){const{renderEmptyState:a}=await B(async()=>{const{renderEmptyState:r}=await import("./core-C7Vz5Umf.js").then(i=>i.F);return{renderEmptyState:r}},[]);a(t);return}const n=e.map(a=>{const r=s=>s?new Date(s).toLocaleDateString("de-DE"):"-",i=s=>s&&Array.isArray(s)&&s.length?s.join(", "):"-";return`
        <tr data-id="${a.id}">
          <td><input type="checkbox" class="kampagne-check" data-id="${a.id}"></td>
          <td>
            <a href="#" class="table-link" data-table="kampagne" data-id="${a.id}">
              ${window.validatorSystem.sanitizeHtml(a.kampagnenname||"Unbekannt")}
            </a>
          </td>
          <td>${window.validatorSystem.sanitizeHtml(a.unternehmen?.firmenname||"Unbekannt")}</td>
          <td>${window.validatorSystem.sanitizeHtml(a.marke?.markenname||"Unbekannt")}</td>
          <td>${i(a.art_der_kampagne_display||a.art_der_kampagne)}</td>
          <td>
            <span class="status-badge status-${(a.status_name||"").toLowerCase().replace(/\s+/g,"-")||"unknown"}">
              ${a.status_name||"-"}
            </span>
          </td>
          <td>${r(a.start)}</td>
          <td>${r(a.deadline)}</td>
          <td>${a.creatoranzahl||0}</td>
          <td>${a.videoanzahl||0}</td>
          <td>${this.renderAnsprechpartner(a.ansprechpartner)}</td>
          <td>
            <div class="actions-dropdown-container" data-entity-type="kampagne">
              <button class="actions-toggle" aria-expanded="false" aria-label="Aktionen">
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" class="w-5 h-5">
                  <path d="M10 3a1.5 1.5 0 110 3 1.5 1.5 0 010-3zM10 8.5a1.5 1.5 0 110 3 1.5 1.5 0 010-3zM11.5 15.5a1.5 1.5 0 10-3 0 1.5 1.5 0 003 0z" />
                </svg>
              </button>
              <div class="actions-dropdown">
                <div class="action-submenu">
                  <a href="#" class="action-item has-submenu" data-submenu="status">${L.getHeroIcon("invoice")}<span>Status ändern</span></a>
                  <div class="submenu" data-submenu="status">
                    ${(this.statusOptions||[]).map(s=>`
                      <a href="#" class="submenu-item" data-action="set-field" data-field="status_id" data-value="${s.id}" data-status-name="${s.name}" data-id="${a.id}">
                        ${L.getStatusIcon(s.name)}
                        <span>${s.name}</span>
                        ${a.status_id&&a.status_id===s.id||a.status_name===s.name?'<span class="submenu-check">'+L.getHeroIcon("check")+"</span>":""}
                      </a>
                    `).join("")}
                  </div>
                </div>
                <a href="#" class="action-item" data-action="view" data-id="${a.id}">
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" class="w-5 h-5">
                    <path d="M10 12.5a2.5 2.5 0 100-5 2.5 2.5 0 000 5z" />
                    <path fill-rule="evenodd" d="M.661 10c1.743-2.372 4.761-5 9.339-5 4.578 0 7.601 2.628 9.339 5-1.738 2.372-4.761 5-9.339 5-4.578 0-7.601-2.628-9.339-5zM10 15a5 5 0 100-10 5 5 0 000 10z" clip-rule="evenodd" />
                  </svg>
                  Details anzeigen
                </a>
                <a href="#" class="action-item" data-action="edit" data-id="${a.id}">
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" class="w-5 h-5">
                    <path d="M5.433 13.917l-1.523 1.523a.75.75 0 001.06 1.06l1.523-1.523L5.433 13.917zM11.206 6.106L13.917 3.4a.75.75 0 011.06 1.06l-2.711 2.711-.693-.693z" />
                    <path fill-rule="evenodd" d="M1.334 10.606a1.5 1.5 0 011.06-1.06l10.38-10.38a1.5 1.5 0 012.122 0l1.523 1.523a1.5 1.5 0 010 2.122l-10.38 10.38a1.5 1.5 0 01-1.06 1.06H1.334v-3.182z" clip-rule="evenodd" />
                  </svg>
                  Bearbeiten
                </a>
                <a href="#" class="action-item" data-action="notiz" data-id="${a.id}">
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" class="w-5 h-5">
                    <path fill-rule="evenodd" d="M18 10c0 3.866-3.582 7-8 7a8.841 8.841 0 01-4.083-.98L2 17l1.336-3.117C2.688 12.31 2 11.104 2 10c0-3.866 3.582-7 8-7s8 3.134 8 7zM7 9H5v2h2V9zm8 0h-2v2h2V9zM9 9h2v2H9V9z" clip-rule="evenodd" />
                  </svg>
                  Notiz hinzufügen
                </a>
                ${window.currentUser?.rolle==="admin"||window.currentUser?.rolle?.toLowerCase()==="admin"?`
                <a href="#" class="action-item" data-action="assign-staff" data-id="${a.id}">
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="w-5 h-5">
  <path stroke-linecap="round" stroke-linejoin="round" d="M18 7.5v3m0 0v3m0-3h3m-3 0h-3m-2.25-4.125a3.375 3.375 0 1 1-6.75 0 3.375 3.375 0 0 1 6.75 0ZM3 19.235v-.11a6.375 6.375 0 0 1 12.75 0v.109A12.318 12.318 0 0 1 9.374 21c-2.331 0-4.512-.645-6.374-1.766Z" />
</svg>
                  Kampagne Mitarbeiter zuordnen
                </a>
                `:""}
                <a href="#" class="action-item" data-action="add_ansprechpartner_kampagne" data-id="${a.id}">
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="w-5 h-5">
                    <path stroke-linecap="round" stroke-linejoin="round" d="M18 7.5v3m0 0v3m0-3h3m-3 0h-3m-2.25-4.125a3.375 3.375 0 1 1-6.75 0 3.375 3.375 0 0 1 6.75 0ZM3 19.235v-.11a6.375 6.375 0 0 1 12.75 0v.109A12.318 12.318 0 0 1 9.374 21c-2.331 0-4.512-.645-6.374-1.766Z" />
                  </svg>
                  Ansprechpartner hinzufügen
                </a>
                <div class="action-separator"></div>
                <a href="#" class="action-item action-danger" data-action="delete" data-id="${a.id}">
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" class="w-5 h-5">
                    <path fill-rule="evenodd" d="M8.75 1A2.75 2.75 0 006 3.75v.443c-.795.077-1.584.176-2.368.298a.75.75 0 10.232 1.482l.175-.027c.572-.089 1.14-.19 1.706-.302A3.75 3.75 0 019.75 3h.5a3.75 3.75 0 013.657 3.234c.566.112 1.134.213 1.706.302l.175.027a.75.75 0 10.232-1.482A41.203 41.203 0 0014 4.193V3.75A2.75 2.75 0 0011.25 1h-2.5zM2.5 7.75a.75.75 0 01.75-.75h13.5a.75.75 0 010 1.5H3.25a.75.75 0 01-.75-.75zM7.25 9.75a.75.75 0 01.75-.75h4.5a.75.75 0 010 1.5H8a.75.75 0 01-.75-.75zM6 12.25a.75.75 0 01.75-.75h6.5a.75.75 0 010 1.5H6.75a.75.75 0 01-.75-.75zM4.75 14.75a.75.75 0 01.75-.75h9.5a.75.75 0 010 1.5h-9.5a.75.75 0 01-.75-.75z" clip-rule="evenodd" />
                  </svg>
                  Löschen
                </a>
              </div>
            </div>
          </td>
        </tr>
      `}).join("");t.innerHTML=n}destroy(){console.log("KampagneList: Cleaning up..."),this._boundEventListeners.forEach(({element:e,type:t,handler:n})=>{e.removeEventListener(t,n)}),this._boundEventListeners.clear(),this.boundFilterResetHandler&&(document.removeEventListener("click",this.boundFilterResetHandler),this.boundFilterResetHandler=null)}showCreateForm(){console.log("🎯 Zeige Kampagnen-Erstellungsformular"),window.setHeadline("Neue Kampagne anlegen");const e=window.formSystem.renderFormOnly("kampagne");window.content.innerHTML=`
      <div class="page-header">
        <div class="page-header-left">
          <h1>Neue Kampagne anlegen</h1>
          <p>Erstellen Sie eine neue Kampagne</p>
        </div>
        <div class="page-header-right">
          <button onclick="window.navigateTo('/kampagne')" class="secondary-btn">Zurück zur Übersicht</button>
        </div>
      </div>
      
      <div class="form-page">
        ${e}
      </div>
    `,window.formSystem.bindFormEvents("kampagne",null);const t=document.getElementById("kampagne-form");t&&(t.onsubmit=async n=>{n.preventDefault(),await this.handleFormSubmit()})}async handleFormSubmit(){try{const e=document.getElementById("kampagne-form"),t=new FormData(e),n={};for(const[s,o]of t.entries())if(s.includes("[]")){const l=s.replace("[]","");n[l]||(n[l]=[]),n[l].push(o)}else n[s]=o;const a=e.querySelector('input[name="kampagnenname"]');a&&a.value&&(n.kampagnenname=a.value),console.log("📝 Kampagne Submit-Daten:",n);const r=window.validatorSystem.validateForm(n,"kampagne");if(!r.isValid){this.showValidationErrors(r.errors);return}const i=await window.dataService.createEntity("kampagne",n);if(i.success){try{const s=i.id,o=m=>Array.isArray(m)?m:m?[m]:[],l=m=>Array.from(new Set((m||[]).filter(Boolean))),c=l(o(n.pm_ids)),d=l(o(n.scripter_ids)),u=l(o(n.cutter_ids)),h=[];c.forEach(m=>h.push({kampagne_id:s,mitarbeiter_id:m,role:"projektmanager"})),d.forEach(m=>h.push({kampagne_id:s,mitarbeiter_id:m,role:"scripter"})),u.forEach(m=>h.push({kampagne_id:s,mitarbeiter_id:m,role:"cutter"})),h.length>0&&window.supabase&&await window.supabase.from("kampagne_mitarbeiter").insert(h)}catch(s){console.warn("⚠️ Rollen-Zuweisungen konnten nicht gespeichert werden",s)}this.showSuccessMessage("Kampagne erfolgreich erstellt!"),window.dispatchEvent(new CustomEvent("entityUpdated",{detail:{entity:"kampagne",action:"created",id:i.id}})),setTimeout(()=>{window.navigateTo("/kampagne")},1500)}else this.showErrorMessage(`Fehler beim Erstellen: ${i.error}`)}catch(e){console.error("❌ Fehler beim Erstellen der Kampagne:",e),this.showErrorMessage("Ein unerwarteter Fehler ist aufgetreten.")}}showValidationErrors(e){console.error("❌ Validierungsfehler:",e),document.querySelectorAll(".validation-error").forEach(t=>t.remove()),Object.entries(e).forEach(([t,n])=>{const a=document.querySelector(`[name="${t}"]`);if(a){const r=document.createElement("div");r.className="validation-error",r.textContent=n,a.parentNode.appendChild(r)}})}showSuccessMessage(e){const t=document.createElement("div");t.className="alert alert-success",t.textContent=e;const n=document.getElementById("kampagne-form");n&&(n.parentNode.insertBefore(t,n),setTimeout(()=>{t.remove()},5e3))}showErrorMessage(e){const t=document.createElement("div");t.className="alert alert-danger",t.textContent=e;const n=document.getElementById("kampagne-form");n&&(n.parentNode.insertBefore(t,n),setTimeout(()=>{t.remove()},5e3))}updateSelectAllCheckbox(){const e=document.getElementById("select-all-kampagnen"),t=document.querySelectorAll(".kampagne-check");if(!e||t.length===0)return;const n=document.querySelectorAll(".kampagne-check:checked"),a=n.length===t.length,r=n.length>0;e.checked=a,e.indeterminate=r&&!a}deselectAll(){this.selectedKampagnen.clear(),document.querySelectorAll(".kampagne-check").forEach(n=>{n.checked=!1});const t=document.getElementById("select-all-kampagnen");t&&(t.checked=!1,t.indeterminate=!1),this.updateSelection(),console.log("✅ Alle Kampagnen-Auswahlen aufgehoben")}showDeleteSelectedConfirmation(){const e=this.selectedKampagnen.size;if(e===0){alert("Keine Kampagnen ausgewählt.");return}const t=e===1?"Möchten Sie die ausgewählte Kampagne wirklich löschen?":`Möchten Sie die ${e} ausgewählten Kampagnen wirklich löschen?`;confirm(`${t}

Dieser Vorgang kann nicht rückgängig gemacht werden.`)&&this.deleteSelectedKampagnen()}async deleteSelectedKampagnen(){const e=Array.from(this.selectedKampagnen),t=e.length;console.log(`🗑️ Lösche ${t} Kampagnen...`);let n=0,a=0;const r=[];for(const s of e)try{const o=await window.dataService.deleteEntity("kampagne",s);o.success?(n++,console.log(`✅ Kampagne ${s} gelöscht`)):(a++,r.push(`Kampagne ${s}: ${o.error}`),console.error(`❌ Fehler beim Löschen von Kampagne ${s}:`,o.error))}catch(o){a++,r.push(`Kampagne ${s}: ${o.message}`),console.error(`❌ Unerwarteter Fehler beim Löschen von Kampagne ${s}:`,o)}let i="";n>0&&(i+=`✅ ${n} Kampagnen erfolgreich gelöscht.`),a>0&&(i+=`
❌ ${a} Kampagnen konnten nicht gelöscht werden.`,r.length>0&&(i+=`

Fehler:
${r.join(`
`)}`)),alert(i),this.deselectAll(),await this.loadAndRender(),window.dispatchEvent(new CustomEvent("entityUpdated",{detail:{entity:"kampagne",action:"bulk-deleted",count:n}}))}renderAnsprechpartner(e){return!e||e.length===0?"-":`<div class="tags tags-compact">${e.filter(n=>n&&n.vorname&&n.nachname).map(n=>`<a href="#" class="tag tag--ansprechpartner" data-action="view-ansprechpartner" data-id="${n.id}" onclick="event.preventDefault(); window.navigateTo('/ansprechpartner/${n.id}')">${n.vorname} ${n.nachname}</a>`).join("")}</div>`}}const ge=new it;class st{constructor(){this.kampagneId=null,this.kampagneData=null,this.creator=[],this.notizen=[],this.ratings=[],this.kooperationen=[],this.koopBudgetSum=0,this.koopVideosUsed=0,this.sourcingCreators=[],this.favoriten=[],this.rechnungen=[],this.history=[],this.historyCount=0,this.koopHistory=[],this.koopHistoryCount=0}async init(e){if(console.log("🎯 KAMPAGNEDETAIL: Initialisiere Kampagnen-Detailseite für ID:",e),this.kampagneId=e,window.moduleRegistry?.currentModule!==this){console.log("⚠️ KAMPAGNEDETAIL: Nicht mehr das aktuelle Modul, breche ab");return}try{await this.loadKampagneData(),await this.render(),this.bindEvents(),this.bindAnsprechpartnerEvents(),console.log("✅ KAMPAGNEDETAIL: Initialisierung abgeschlossen")}catch(t){console.error("❌ KAMPAGNEDETAIL: Fehler bei der Initialisierung:",t),window.ErrorHandler.handle(t,"KampagneDetail.init")}}async loadKooperationen(){try{const{data:e,error:t}=await window.supabase.from("kooperationen").select("id, name, status, gesamtkosten, videoanzahl, creator_id").eq("kampagne_id",this.kampagneId).order("created_at",{ascending:!1});if(t)throw t;const n=Array.from(new Set((e||[]).map(r=>r.creator_id).filter(Boolean)));let a={};if(n.length>0){const{data:r}=await window.supabase.from("creator").select("id, vorname, nachname").in("id",n);a=(r||[]).reduce((i,s)=>(i[s.id]=s,i),{})}this.kooperationen=(e||[]).map(r=>({...r,creator:a[r.creator_id]||null})),this.koopBudgetSum=this.kooperationen.reduce((r,i)=>r+(parseFloat(i.gesamtkosten)||0),0),this.koopVideosUsed=this.kooperationen.reduce((r,i)=>r+(parseInt(i.videoanzahl,10)||0),0),console.log("✅ KAMPAGNEDETAIL: Kooperationen geladen:",this.kooperationen.length,"Budgetsumme:",this.koopBudgetSum)}catch(e){console.error("❌ KAMPAGNEDETAIL: Fehler beim Laden der Kooperationen:",e),this.kooperationen=[],this.koopBudgetSum=0}}renderKooperationen(){const e=d=>d?new Intl.NumberFormat("de-DE",{style:"currency",currency:"EUR"}).format(d):"-",t=this.kampagneData?.auftrag?.creator_budget||0,n=this.koopBudgetSum,a=t>0?Math.min(100,Math.round(n/t*100)):0,r=this.kampagneData?.videoanzahl||0,i=this.koopVideosUsed||0,s=Math.max(0,r-i),o=r>0?Math.min(100,Math.round(i/r*100)):0,l=`
      <div class="budget-progress">
        <div class="budget-header">
          <span>Aufgebraucht: ${e(n)} von ${e(t)}</span>
          <span>${a}%</span>
        </div>
        <div class="progress-bar"><div class="progress-fill" style="width:${a}%"></div></div>
      </div>
      <div class="budget-progress" style="margin-top:12px;">
        <div class="budget-header">
          <span>Videos: ${i} von ${r} | Rest: ${s}</span>
          <span>${o}%</span>
        </div>
        <div class="progress-bar"><div class="progress-fill" style="width:${o}%"></div></div>
      </div>`;if(!this.kooperationen||this.kooperationen.length===0)return`
        ${l}
        <div class="empty-state">
          <p>Keine Kooperationen verknüpft</p>
          <button class="primary-btn" onclick="window.navigateTo('/kooperation/new')">Kooperation anlegen</button>
        </div>
      `;const c=this.kooperationen.map(d=>`
      <tr>
        <td><a href="/kooperation/${d.id}" onclick="event.preventDefault(); window.navigateTo('/kooperation/${d.id}')">${window.validatorSystem.sanitizeHtml(d.name||"—")}</a></td>
        <td>${window.validatorSystem.sanitizeHtml(d.creator?`${d.creator.vorname} ${d.creator.nachname}`:"Unbekannt")}</td>
        <td>${d.videoanzahl||0}</td>
        <td><span class="status-badge status-${(d.status||"unknown").toLowerCase()}">${d.status||"-"}</span></td>
        <td>${e(d.gesamtkosten)}</td>
      </tr>
    `).join("");return`
      ${l}
      <div class="data-table-container">
        <table class="data-table">
          <thead>
            <tr>
              <th>Name</th>
              <th>Creator</th>
              <th>Videos</th>
              <th>Status</th>
              <th>Gesamtkosten</th>
            </tr>
          </thead>
          <tbody>
            ${c}
          </tbody>
        </table>
      </div>
    `}renderCreatorSourcing(){return!this.sourcingCreators||this.sourcingCreators.length===0?`
        <div class="empty-state">
          <p>Keine Creator gefunden.</p>
        </div>
      `:`
      <div class="table-actions">
        <div class="table-actions-left">
          <button id="btn-select-all-sourcing" class="secondary-btn">Alle auswählen</button>
        </div>
      </div>
      ${R(this.sourcingCreators,{showFavoriteAction:!0,showSelection:!0,kampagneId:this.kampagneId})}
    `}renderFavoriten(){return!this.favoriten||this.favoriten.length===0?`
        <div class="empty-state">
          <p>Noch keine Favoriten.</p>
        </div>
      `:`
      <div class="table-actions">
        <div class="table-actions-left">
          <button id="btn-select-all-favs" class="secondary-btn">Alle auswählen</button>
        </div>
      </div>
      ${R(this.favoriten,{showFavoritesMenu:!0,showSelection:!0,kampagneId:this.kampagneId})}
    `}renderRechnungen(){if(!this.rechnungen||this.rechnungen.length===0)return`
         <div class="empty-state">
           <p>Keine Rechnungen zu dieser Kampagne.</p>
         </div>
       `;const e=a=>a?new Intl.NumberFormat("de-DE",{style:"currency",currency:"EUR"}).format(a):"-",t=a=>a?new Date(a).toLocaleDateString("de-DE"):"-";return`
       <div class="data-table-container">
         <table class="data-table">
           <thead>
              <tr>
                <th>Rechnungs-Nr</th>
                <th>Status</th>
                <th>Creator</th>
                <th>Kooperation</th>
                <th>Netto</th>
                <th>Brutto</th>
                <th>Gestellt</th>
                <th>Bezahlt</th>
                <th>Beleg</th>
              </tr>
           </thead>
           <tbody>${this.rechnungen.map(a=>`
       <tr>
         <td><a href="/rechnung/${a.id}" onclick="event.preventDefault(); window.navigateTo('/rechnung/${a.id}')">${window.validatorSystem.sanitizeHtml(a.rechnung_nr||"—")}</a></td>
         <td><span class="status-badge status-${(a.status||"unknown").toLowerCase()}">${a.status||"-"}</span></td>
         <td>${a.creator?window.validatorSystem.sanitizeHtml(`${a.creator.vorname||""} ${a.creator.nachname||""}`.trim()||"-"):"-"}</td>
         <td>${a.kooperation?`<a href="/kooperation/${a.kooperation.id}" onclick="event.preventDefault(); window.navigateTo('/kooperation/${a.kooperation.id}')">${window.validatorSystem.sanitizeHtml(a.kooperation.name||a.kooperation.id)}</a>`:"-"}</td>
         <td>${e(a.nettobetrag)}</td>
         <td>${e(a.bruttobetrag)}</td>
         <td>${t(a.gestellt_am)}</td>
         <td>${t(a.bezahlt_am)}</td>
         <td>${a.pdf_url?`<a href="${a.pdf_url}" target="_blank" rel="noopener">PDF</a>`:"-"}</td>
       </tr>
     `).join("")}</tbody>
         </table>
       </div>
     `}async loadKampagneData(){console.log("🔄 KAMPAGNEDETAIL: Lade Kampagnen-Daten...");try{const{data:e,error:t}=await window.supabase.from("kampagne").select(`
          *,
          unternehmen:unternehmen_id(firmenname, webseite, branche_id),
          marke:marke_id(markenname, webseite),
          auftrag:auftrag_id(auftragsname, status, gesamt_budget, creator_budget)
        `).eq("id",this.kampagneId).single();if(t)throw t;this.kampagneData=e;const{data:n,error:a}=await window.supabase.from("ansprechpartner_kampagne").select(`
          ansprechpartner:ansprechpartner_id(
            id,
            vorname,
            nachname,
            email,
            unternehmen:unternehmen_id(firmenname),
            position:position_id(name)
          )
        `).eq("kampagne_id",this.kampagneId);if(a||(this.kampagneData.ansprechpartner=n?.map(s=>s.ansprechpartner).filter(Boolean)||[],console.log("✅ KAMPAGNEDETAIL: Ansprechpartner geladen:",this.kampagneData.ansprechpartner.length)),console.log("✅ KAMPAGNEDETAIL: Kampagnen-Basisdaten geladen:",this.kampagneData),this.kampagneData.art_der_kampagne&&this.kampagneData.art_der_kampagne.length>0){const{data:s,error:o}=await window.supabase.from("kampagne_art_typen").select("id, name, beschreibung").in("id",this.kampagneData.art_der_kampagne);o||(this.kampagneData.kampagne_art_typen=s||[],console.log("✅ KAMPAGNEDETAIL: Kampagnen-Arten geladen:",this.kampagneData.kampagne_art_typen.length))}const{data:r,error:i}=await window.supabase.from("kampagne_creator").select(`
          *,
          creator:creator_id(
            id,
            vorname,
            nachname,
            instagram,
            instagram_follower,
            tiktok,
            tiktok_follower,
            mail,
            telefonnummer
          )
        `).eq("kampagne_id",this.kampagneId);i||(this.creator=r||[],console.log("✅ KAMPAGNEDETAIL: Creators geladen:",this.creator.length));try{const{data:s}=await window.supabase.from("kampagne_creator_sourcing").select(`
            id,
            creator:creator_id (
              id,
              vorname,
              nachname,
              creator_types:creator_creator_type(creator_type:creator_type_id(name)),
              sprachen:creator_sprachen(sprachen:sprache_id(name)),
              branchen:creator_branchen(branchen_creator:branche_id(name)),
              instagram_follower,
              tiktok_follower,
              lieferadresse_stadt,
              lieferadresse_land
            )
          `).eq("kampagne_id",this.kampagneId);this.sourcingCreators=(s||[]).map(o=>{const l=o.creator||{};return{id:l.id,vorname:l.vorname,nachname:l.nachname,creator_types:(l.creator_types||[]).map(c=>c.creator_type).filter(Boolean),sprachen:(l.sprachen||[]).map(c=>c.sprachen).filter(Boolean),branchen:(l.branchen||[]).map(c=>c.branchen_creator).filter(Boolean),instagram_follower:l.instagram_follower,tiktok_follower:l.tiktok_follower,lieferadresse_stadt:l.lieferadresse_stadt,lieferadresse_land:l.lieferadresse_land}})}catch(s){console.warn("⚠️ KAMPAGNEDETAIL: Creator Sourcing konnte nicht geladen werden",s),this.sourcingCreators=[]}try{const{data:s}=await window.supabase.from("kampagne_creator_favoriten").select(`
            id,
            creator:creator_id (
              id,
              vorname,
              nachname,
              creator_types:creator_creator_type(creator_type:creator_type_id(name)),
              sprachen:creator_sprachen(sprachen:sprache_id(name)),
              branchen:creator_branchen(branchen_creator:branche_id(name)),
              instagram_follower,
              tiktok_follower,
              lieferadresse_stadt,
              lieferadresse_land
            )
          `).eq("kampagne_id",this.kampagneId);this.favoriten=(s||[]).map(o=>{const l=o.creator||{};return{id:l.id,vorname:l.vorname,nachname:l.nachname,creator_types:(l.creator_types||[]).map(c=>c.creator_type).filter(Boolean),sprachen:(l.sprachen||[]).map(c=>c.sprachen).filter(Boolean),branchen:(l.branchen||[]).map(c=>c.branchen_creator).filter(Boolean),instagram_follower:l.instagram_follower,tiktok_follower:l.tiktok_follower,lieferadresse_stadt:l.lieferadresse_stadt,lieferadresse_land:l.lieferadresse_land}})}catch(s){console.warn("⚠️ KAMPAGNEDETAIL: Favoriten konnten nicht geladen werden",s),this.favoriten=[]}window.notizenSystem&&(this.notizen=await window.notizenSystem.loadNotizen("kampagne",this.kampagneId),console.log("✅ KAMPAGNEDETAIL: Notizen geladen:",this.notizen.length)),window.bewertungsSystem&&(this.ratings=await window.bewertungsSystem.loadBewertungen("kampagne",this.kampagneId),console.log("✅ KAMPAGNEDETAIL: Ratings geladen:",this.ratings.length)),await this.loadKooperationen();try{const{data:s}=await window.supabase.from("rechnung").select("id, rechnung_nr, status, nettobetrag, bruttobetrag, gestellt_am, bezahlt_am, pdf_url, kooperation:kooperation_id(id, name), creator:creator_id(id, vorname, nachname)").eq("kampagne_id",this.kampagneId).order("gestellt_am",{ascending:!1});this.rechnungen=s||[]}catch{this.rechnungen=[]}try{const{data:s}=await window.supabase.from("kampagne_history").select("id, old_status, new_status, comment, created_at, benutzer:changed_by(name)").eq("kampagne_id",this.kampagneId).order("created_at",{ascending:!1});this.history=(s||[]).map(o=>({id:o.id,old_status:o.old_status||null,new_status:o.new_status||null,comment:o.comment||"",created_at:o.created_at,user_name:o.benutzer?.name||"-"})),this.historyCount=this.history.length}catch{this.history=[],this.historyCount=0}try{const s=(this.kooperationen||[]).map(o=>o.id).filter(Boolean);if(s.length>0){const o=(this.kooperationen||[]).reduce((c,d)=>(c[d.id]=d,c),{}),{data:l}=await window.supabase.from("kooperation_history").select("id, kooperation_id, old_status, new_status, comment, created_at, benutzer:changed_by(name)").in("kooperation_id",s).order("created_at",{ascending:!1});this.koopHistory=(l||[]).map(c=>({id:c.id,kooperation_id:c.kooperation_id,kooperation_name:o[c.kooperation_id]?.name||c.kooperation_id,old_status:c.old_status||null,new_status:c.new_status||null,comment:c.comment||"",created_at:c.created_at,user_name:c.benutzer?.name||"-"})),this.koopHistoryCount=this.koopHistory.length}else this.koopHistory=[],this.koopHistoryCount=0}catch{this.koopHistory=[],this.koopHistoryCount=0}}catch(e){throw console.error("❌ KAMPAGNEDETAIL: Fehler beim Laden der Kampagnen-Daten:",e),e}}async render(){if(!this.kampagneData){this.showNotFound();return}window.setHeadline(`Kampagne: ${this.kampagneData.kampagnenname}`);const e=window.currentUser?.permissions?.kampagne?.can_edit||!1,t=window.currentUser?.permissions?.kampagne?.can_delete||!1,n=s=>s?new Date(s).toLocaleDateString("de-DE"):"-",a=s=>s?new Intl.NumberFormat("de-DE",{style:"currency",currency:"EUR"}).format(s):"-",r=s=>s?Array.isArray(s)?s.map(o=>o.name||o).join(", "):String(s):"-",i=`
      <div class="page-header">
        <div class="page-header-left">
          <h1>${window.validatorSystem.sanitizeHtml(this.kampagneData.kampagnenname)}</h1>
          <p>Kampagnen-Details und verwandte Informationen</p>
        </div>
        <div class="page-header-right">
          <button onclick="window.navigateTo('/kampagne')" class="secondary-btn">Zurück zur Übersicht</button>
          ${e?'<button id="btn-edit-kampagne" class="primary-btn">Bearbeiten</button>':""}
          ${t?'<button id="btn-delete-kampagne" class="danger-btn">Kampagne löschen</button>':""}
        </div>
      </div>

      <div class="content-section">
        <!-- Tab Navigation -->
        <div class="tab-navigation">
          <button class="tab-button active" data-tab="info">
            <i class="icon-information-circle"></i>
            Informationen
          </button>
          ${window.canViewTable&&window.canViewTable("kampagne","creators")!==!1?`
          <button class="tab-button" data-tab="creators">
            <i class="icon-users"></i>
            Creator
            <span class="tab-count">${this.creator.length}</span>
          </button>`:""}
          ${window.canViewTable&&window.canViewTable("kampagne","notizen")!==!1?`
          <button class="tab-button" data-tab="notizen">
            <i class="icon-document-text"></i>
            Notizen
            <span class="tab-count">${this.notizen.length}</span>
          </button>`:""}
          ${window.canViewTable&&window.canViewTable("kampagne","kooperationen")!==!1?`
          <button class="tab-button" data-tab="koops">
            <i class="icon-link"></i>
            Kooperationen
            <span class="tab-count">${this.kooperationen.length}</span>
          </button>`:""}
          ${window.canViewTable&&window.canViewTable("kampagne","sourcing")!==!1?`
          <button class="tab-button" data-tab="sourcing">
            <i class="icon-user-plus"></i>
            Creator Sourcing
            <span class="tab-count">${this.sourcingCreators.length}</span>
          </button>`:""}
          ${window.canViewTable&&window.canViewTable("kampagne","favoriten")!==!1?`
          <button class="tab-button" data-tab="favs">
            
            Favoriten
            <span class="tab-count">${this.favoriten.length}</span>
          </button>`:""}
          ${window.canViewTable&&window.canViewTable("kampagne","ratings")!==!1?`
          <button class="tab-button" data-tab="ratings">
            
            Bewertungen
            <span class="tab-count">${this.ratings.length}</span>
          </button>`:""}
          ${window.canViewTable&&window.canViewTable("kampagne","history")!==!1?`
          <button class="tab-button" data-tab="history">
            
            History
            <span class="tab-count">${this.historyCount+this.koopHistoryCount}</span>
          </button>`:""}
          ${window.canViewTable&&window.canViewTable("kampagne","rechnungen")!==!1?`
          <button class="tab-button" data-tab="rechnungen">
            <i class="icon-currency-euro"></i>
            Rechnungen
            <span class="tab-count">${this.rechnungen.length}</span>
          </button>`:""}
        </div>

        <!-- Tab Content -->
        <div class="tab-content">
          <!-- Informationen Tab -->
          <div class="tab-pane active" id="tab-info">
            <div class="detail-section">
              <h2>Kampagnen Informationen</h2>
              <div class="detail-grid">
                <!-- Hauptinformationen -->
                <div class="detail-card">
                  <h3>Kampagnen-Informationen</h3>
                  <div class="detail-grid-2">
                    <div class="detail-item">
                      <label>Kampagnenname:</label>
                      <span>${window.validatorSystem.sanitizeHtml(this.kampagneData.kampagnenname)}</span>
                    </div>
                    <div class="detail-item">
                      <label>Status:</label>
                      <span class="status-badge status-${this.kampagneData.status?.toLowerCase()||"unknown"}">
                        ${this.kampagneData.status||"-"}
                      </span>
                    </div>
                    <div class="detail-item">
                      <label>Art der Kampagne:</label>
                      <span>${r(this.kampagneData.kampagne_art_typen)}</span>
                    </div>
                    <div class="detail-item">
                      <label>Kampagnen-Nummer:</label>
                      <span>${this.kampagneData.kampagnen_nummer||"-"}</span>
                    </div>
                    <div class="detail-item">
                      <label>Start:</label>
                      <span>${n(this.kampagneData.start)}</span>
                    </div>
                    <div class="detail-item">
                      <label>Deadline:</label>
                      <span>${n(this.kampagneData.deadline)}</span>
                    </div>
                    <div class="detail-item">
                      <label>Drehort:</label>
                      <span>${window.validatorSystem.sanitizeHtml(this.kampagneData.drehort||"-")}</span>
                    </div>
                    <div class="detail-item">
                      <label>Creator Anzahl:</label>
                      <span>${this.kampagneData.creatoranzahl||0}</span>
                    </div>
                    <div class="detail-item">
                      <label>Video Anzahl:</label>
                      <span>${this.kampagneData.videoanzahl||0}</span>
                    </div>
                  </div>
                </div>

                <!-- Ziele und Budget -->
                <div class="detail-card">
                  <h3>Ziele & Budget</h3>
                  <div class="detail-item">
                    <label>Ziele:</label>
                    <span>${window.validatorSystem.sanitizeHtml(this.kampagneData.ziele||"-")}</span>
                  </div>
                  <div class="detail-item">
                    <label>Budget Info:</label>
                    <span>${window.validatorSystem.sanitizeHtml(this.kampagneData.budget_info||"-")}</span>
                  </div>
                </div>

                <!-- Unternehmen -->
                <div class="detail-card">
                  <h3>Unternehmen</h3>
                  <div class="detail-item">
                    <label>Firmenname:</label>
                    <span>${window.validatorSystem.sanitizeHtml(this.kampagneData.unternehmen?.firmenname||"Unbekannt")}</span>
                  </div>
                  <div class="detail-item">
                    <label>Webseite:</label>
                    <span>${this.kampagneData.unternehmen?.webseite?`<a href="${this.kampagneData.unternehmen.webseite}" target="_blank">${this.kampagneData.unternehmen.webseite}</a>`:"-"}</span>
                  </div>
                  <div class="detail-item">
                    <label>Branche:</label>
                    <span>${window.validatorSystem.sanitizeHtml(this.kampagneData.unternehmen?.branche_id||"-")}</span>
                  </div>
                </div>

                <!-- Marke -->
                <div class="detail-card">
                  <h3>Marke</h3>
                  <div class="detail-item">
                    <label>Markenname:</label>
                    <span>${window.validatorSystem.sanitizeHtml(this.kampagneData.marke?.markenname||"Unbekannt")}</span>
                  </div>
                  <div class="detail-item">
                    <label>Webseite:</label>
                    <span>${this.kampagneData.marke?.webseite?`<a href="${this.kampagneData.marke.webseite}" target="_blank">${this.kampagneData.marke.webseite}</a>`:"-"}</span>
                  </div>
                </div>

                <!-- Auftrag -->
                <div class="detail-card">
                  <h3>Auftrag</h3>
                  <div class="detail-item">
                    <label>Auftragsname:</label>
                    <span>${window.validatorSystem.sanitizeHtml(this.kampagneData.auftrag?.auftragsname||"Unbekannt")}</span>
                  </div>
                  <div class="detail-item">
                    <label>Status:</label>
                    <span class="status-badge status-${this.kampagneData.auftrag?.status?.toLowerCase()||"unknown"}">
                      ${this.kampagneData.auftrag?.status||"-"}
                    </span>
                  </div>
                  <div class="detail-item">
                    <label>Gesamt Budget:</label>
                    <span>${a(this.kampagneData.auftrag?.gesamt_budget)}${this.koopBudgetSum?` (aufgebraucht: ${a(this.koopBudgetSum)})`:""}</span>
                  </div>
                  <div class="detail-item">
                    <label>Creator Budget:</label>
                    <span>${a(this.kampagneData.auftrag?.creator_budget)}${this.koopBudgetSum?` (aufgebraucht: ${a(this.koopBudgetSum)})`:""}</span>
                  </div>
                </div>

                <!-- Ansprechpartner -->
                <div class="detail-card">
                  <h3>Ansprechpartner
                    <button class="btn-add-ansprechpartner-kampagne btn btn-sm btn-primary" style="margin-left: 10px;">
                      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" class="w-4 h-4" style="margin-right: 5px;">
                        <path d="M8 9a3 3 0 100-6 3 3 0 000 6zM8 11a6 6 0 016 6H2a6 6 0 016-6zM16 7a1 1 0 10-2 0v1h-1a1 1 0 100 2h1v1a1 1 0 102 0v-1h1a1 1 0 100-2h-1V7z" />
                      </svg>
                      Hinzufügen
                    </button>
                  </h3>
                  <div class="detail-item">
                    ${this.renderAnsprechpartner()}
                  </div>
                </div>
              </div>
            </div>
          </div>

          <!-- Creators Tab (gebuchte Creator) -->
          <div class="tab-pane" id="tab-creators">
            <div class="detail-section">
              <h2>Creator</h2>
              <div id="creators-list">
                ${this.renderCreatorsList()}
              </div>
            </div>
          </div>

          <!-- Notizen Tab -->
          <div class="tab-pane" id="tab-notizen">
            <div class="detail-section">
              <h2>Notizen</h2>
              <div id="notizen-list">
                ${this.renderNotizen()}
              </div>
            </div>
          </div>

          <!-- Bewertungen Tab -->
          <div class="tab-pane" id="tab-ratings">
            <div class="detail-section">
              <h2>Bewertungen</h2>
              <div id="ratings-list">
                ${this.renderRatings()}
              </div>
            </div>
          </div>

          <!-- Kooperationen Tab -->
          <div class="tab-pane" id="tab-koops">
            <div class="detail-section">
              <h2>Kooperationen</h2>
              ${this.renderKooperationen()}
            </div>
          </div>

          <!-- Creator Sourcing Tab (Kandidatenliste) -->
          <div class="tab-pane" id="tab-sourcing">
            <div class="detail-section">
              <h2>Creator Sourcing</h2>
              ${this.renderCreatorSourcing()}
            </div>
          </div>

          <!-- Favoriten Tab -->
          <div class="tab-pane" id="tab-favs">
            <div class="detail-section">
              <h2>Favoriten</h2>
              ${this.renderFavoriten()}
            </div>
          </div>

          <!-- Rechnungen Tab -->
          <div class="tab-pane" id="tab-rechnungen">
            <div class="detail-section">
              <h2>Rechnungen</h2>
              ${this.renderRechnungen()}
            </div>
          </div>

          <!-- History Tab -->
          <div class="tab-pane" id="tab-history">
            <div class="detail-section">
              <h2>History</h2>
              ${this.renderHistory()}
            </div>
          </div>
        </div>
      </div>

      
    `;window.setContentSafely(window.content,i)}renderCreatorsList(){if(!this.creator||this.creator.length===0)return`
        <div class="empty-state">
          <p>Keine Creators dieser Kampagne zugewiesen</p>
          <button id="btn-add-creator" class="primary-btn">Creator hinzufügen</button>
        </div>
      `;const e=this.creator.map(n=>({id:n.creator?.id,vorname:n.creator?.vorname,nachname:n.creator?.nachname,creator_types:n.creator?.creator_types||[],sprachen:n.creator?.sprachen||[],branchen:n.creator?.branchen||[],instagram_follower:n.creator?.instagram_follower,tiktok_follower:n.creator?.tiktok_follower,lieferadresse_stadt:n.creator?.lieferadresse_stadt,lieferadresse_land:n.creator?.lieferadresse_land}));return`${R(e)}`}renderNotizen(){return!this.notizen||this.notizen.length===0?`
        <div class="empty-state">
          <p>Keine Notizen vorhanden</p>
          <button id="btn-add-notiz" class="primary-btn">Notiz hinzufügen</button>
        </div>
      `:`
      <div class="notizen-container">
        ${this.notizen.map(t=>`
      <div class="notiz-card">
        <div class="notiz-header">
          <span>${t.user_name||"Unbekannt"}</span>
          <span>${new Date(t.created_at).toLocaleDateString("de-DE")}</span>
        </div>
        <div class="notiz-content">
          <p>${window.validatorSystem.sanitizeHtml(t.text)}</p>
        </div>
      </div>
    `).join("")}
      </div>
      <div class="notizen-actions">
        <button id="btn-add-notiz" class="primary-btn">Notiz hinzufügen</button>
      </div>
    `}renderRatings(){return!this.ratings||this.ratings.length===0?`
        <div class="empty-state">
          <p>Keine Bewertungen vorhanden</p>
          <button id="btn-add-rating" class="primary-btn">Bewertung hinzufügen</button>
        </div>
      `:`
      <div class="ratings-container">
        ${this.ratings.map(t=>`
      <div class="rating-card">
        <div class="rating-header">
          <span>${t.user_name||"Unbekannt"}</span>
          <span>${new Date(t.created_at).toLocaleDateString("de-DE")}</span>
        </div>
        <div class="rating-stars">
          ${Array.from({length:5},(n,a)=>`
            <span class="star ${a<t.rating?"filled":""}">★</span>
          `).join("")}
        </div>
      </div>
    `).join("")}
      </div>
      <div class="ratings-actions">
        <button id="btn-add-rating" class="primary-btn">Bewertung hinzufügen</button>
      </div>
    `}renderHistory(){if(!this.history||this.history.length===0)return`
        <div class="empty-state">
          <p>Keine Historie vorhanden</p>
        </div>
      `;const e=i=>i?new Date(i).toLocaleString("de-DE"):"-",n=`
      <div class="data-table-container">
        <h3 style="margin:8px 0;">Kampagne</h3>
        <table class="data-table">
          <thead>
            <tr>
              <th>Zeitpunkt</th>
              <th>User</th>
              <th>Alt</th>
              <th>Neu</th>
              <th>Kommentar</th>
            </tr>
          </thead>
          <tbody>${this.history.map(i=>`
      <tr>
        <td>${e(i.created_at)}</td>
        <td>${window.validatorSystem.sanitizeHtml(i.user_name||"-")}</td>
        <td>${window.validatorSystem.sanitizeHtml(i.old_status||"-")}</td>
        <td>${window.validatorSystem.sanitizeHtml(i.new_status||"-")}</td>
        <td>${window.validatorSystem.sanitizeHtml(i.comment||"")}</td>
      </tr>
    `).join("")}</tbody>
        </table>
      </div>`,r=`
      <div class="data-table-container" style="margin-top:16px;">
        <h3 style="margin:8px 0;">Kooperationen</h3>
        <table class="data-table">
          <thead>
            <tr>
              <th>Zeitpunkt</th>
              <th>User</th>
              <th>Kooperation</th>
              <th>Alt</th>
              <th>Neu</th>
              <th>Kommentar</th>
            </tr>
          </thead>
          <tbody>${(this.koopHistory||[]).map(i=>`
      <tr>
        <td>${e(i.created_at)}</td>
        <td>${window.validatorSystem.sanitizeHtml(i.user_name||"-")}</td>
        <td><a href="/kooperation/${i.kooperation_id}" onclick="event.preventDefault(); window.navigateTo('/kooperation/${i.kooperation_id}')">${window.validatorSystem.sanitizeHtml(i.kooperation_name||"—")}</a></td>
        <td>${window.validatorSystem.sanitizeHtml(i.old_status||"-")}</td>
        <td>${window.validatorSystem.sanitizeHtml(i.new_status||"-")}</td>
        <td>${window.validatorSystem.sanitizeHtml(i.comment||"")}</td>
      </tr>
    `).join("")}</tbody>
        </table>
      </div>`;return`${n}${r}`}showNotFound(){window.setHeadline("Kampagne nicht gefunden"),window.content.innerHTML=`
      <div class="error-message">
        <h2>Kampagne nicht gefunden</h2>
        <p>Die angeforderte Kampagne konnte nicht gefunden werden.</p>
        <button onclick="window.navigateTo('/kampagne')" class="primary-btn">Zurück zur Übersicht</button>
      </div>
    `}bindEvents(){document.addEventListener("click",e=>{e.target.classList.contains("tab-button")&&(e.preventDefault(),this.switchTab(e.target.dataset.tab))}),document.addEventListener("click",e=>{(e.target.id==="btn-edit-kampagne"||e.target.id==="btn-edit-kampagne-bottom")&&(e.preventDefault(),window.navigateTo(`/kampagne/${this.kampagneId}/edit`))}),document.addEventListener("click",e=>{e.target.id==="btn-add-creator"&&(e.preventDefault(),this.showAddCreatorModal())}),document.addEventListener("click",e=>{e.target.id==="btn-add-notiz"&&(e.preventDefault(),this.showAddNotizModal())}),document.addEventListener("click",e=>{e.target.id==="btn-add-rating"&&(e.preventDefault(),this.showAddRatingModal())}),document.addEventListener("click",e=>{e.target.id==="btn-delete-kampagne"&&(e.preventDefault(),this.showDeleteConfirmation())}),window.addEventListener("notizenUpdated",async e=>{e.detail.entityType==="kampagne"&&e.detail.entityId===this.kampagneId&&(console.log("🔄 KAMPAGNEDETAIL: Notizen wurden aktualisiert, lade neu..."),this.notizen=await window.notizenSystem.loadNotizen("kampagne",this.kampagneId),this.renderNotizen())}),window.addEventListener("bewertungenUpdated",async e=>{e.detail.entityType==="kampagne"&&e.detail.entityId===this.kampagneId&&(console.log("🔄 KAMPAGNEDETAIL: Bewertungen wurden aktualisiert, lade neu..."),this.ratings=await window.bewertungsSystem.loadBewertungen("kampagne",this.kampagneId),this.renderRatings())}),window.addEventListener("entityUpdated",async e=>{if(e.detail?.entity==="kooperation"){await this.loadKampagneData();const t=document.querySelector("#tab-history .detail-section");t&&(t.innerHTML=`<h2>History</h2>${this.renderHistory()}`);const n=document.querySelector('.tab-button[data-tab="history"] .tab-count');n&&(n.textContent=String(this.historyCount+this.koopHistoryCount))}}),document.addEventListener("click",async e=>{const t=e.target.closest(".action-item.add-favorite");if(!t)return;e.preventDefault();const n=t.dataset.creatorId,a=t.dataset.kampagneId||this.kampagneId;try{await window.supabase.from("kampagne_creator_favoriten").insert({kampagne_id:a,creator_id:n});const{data:r}=await window.supabase.from("kampagne_creator_favoriten").select(`
            creator:creator_id ( id, vorname, nachname, instagram_follower, tiktok_follower, lieferadresse_stadt, lieferadresse_land )
          `).eq("kampagne_id",a);this.favoriten=(r||[]).map(s=>({id:s.creator?.id,vorname:s.creator?.vorname,nachname:s.creator?.nachname,instagram_follower:s.creator?.instagram_follower,tiktok_follower:s.creator?.tiktok_follower,lieferadresse_stadt:s.creator?.lieferadresse_stadt,lieferadresse_land:s.creator?.lieferadresse_land}));const i=document.querySelector("#tab-favs .detail-section");i&&(i.innerHTML=`<h2>Favoriten</h2>${this.renderFavoriten()}`),alert("Zu Favoriten hinzugefügt.")}catch(r){console.error("❌ Fehler beim Hinzufügen zu Favoriten",r),alert("Hinzufügen zu Favoriten fehlgeschlagen.")}}),document.addEventListener("click",e=>{e.target.id==="btn-select-all-sourcing"&&(e.preventDefault(),document.querySelectorAll("#tab-sourcing .creator-check").forEach(t=>{t.checked=!0}))}),document.addEventListener("click",e=>{e.target.id==="btn-select-all-favs"&&(e.preventDefault(),document.querySelectorAll("#tab-favs .creator-check").forEach(t=>{t.checked=!0}))}),document.addEventListener("click",async e=>{const t=e.target.closest(".action-item.assign-to-campaign");if(!t)return;e.preventDefault();const n=t.dataset.creatorId,a=t.dataset.kampagneId||this.kampagneId;try{await window.supabase.from("kampagne_creator").insert({kampagne_id:a,creator_id:n}),await window.supabase.from("kampagne_creator_favoriten").delete().eq("kampagne_id",a).eq("creator_id",n);const[{data:r},{data:i}]=await Promise.all([window.supabase.from("kampagne_creator").select("*, creator:creator_id(id, vorname, nachname, instagram_follower, tiktok_follower, lieferadresse_stadt, lieferadresse_land)").eq("kampagne_id",a),window.supabase.from("kampagne_creator_favoriten").select("creator:creator_id(id, vorname, nachname, instagram_follower, tiktok_follower, lieferadresse_stadt, lieferadresse_land)").eq("kampagne_id",a)]);this.creator=r||[],this.favoriten=(i||[]).map(d=>({id:d.creator?.id,vorname:d.creator?.vorname,nachname:d.creator?.nachname,instagram_follower:d.creator?.instagram_follower,tiktok_follower:d.creator?.tiktok_follower,lieferadresse_stadt:d.creator?.lieferadresse_stadt,lieferadresse_land:d.creator?.lieferadresse_land}));const s=document.querySelector("#tab-favs .detail-section");s&&(s.innerHTML=`<h2>Favoriten</h2>${this.renderFavoriten()}`);const o=document.querySelector("#tab-creators #creators-list");o&&(o.innerHTML=this.renderCreatorsList());const l=document.querySelector('.tab-button[data-tab="favs"] .tab-count');l&&(l.textContent=String(this.favoriten.length));const c=document.querySelector('.tab-button[data-tab="creators"] .tab-count');c&&(c.textContent=String(this.creator.length)),this.switchTab("creators")}catch(r){console.error("❌ Fehler beim Hinzufügen zur Kampagne",r),alert("Hinzufügen zur Kampagne fehlgeschlagen.")}}),document.addEventListener("click",async e=>{const t=e.target.closest(".action-item.remove-favorite");if(!t)return;e.preventDefault();const n=t.dataset.creatorId,a=t.dataset.kampagneId||this.kampagneId;try{await window.supabase.from("kampagne_creator_favoriten").delete().eq("kampagne_id",a).eq("creator_id",n);const{data:r}=await window.supabase.from("kampagne_creator_favoriten").select("creator:creator_id(id, vorname, nachname, instagram_follower, tiktok_follower, lieferadresse_stadt, lieferadresse_land)").eq("kampagne_id",a);this.favoriten=(r||[]).map(o=>({id:o.creator?.id,vorname:o.creator?.vorname,nachname:o.creator?.nachname,instagram_follower:o.creator?.instagram_follower,tiktok_follower:o.creator?.tiktok_follower,lieferadresse_stadt:o.creator?.lieferadresse_stadt,lieferadresse_land:o.creator?.lieferadresse_land}));const i=document.querySelector("#tab-favs .detail-section");i&&(i.innerHTML=`<h2>Favoriten</h2>${this.renderFavoriten()}`);const s=document.querySelector('.tab-button[data-tab="favs"] .tab-count');s&&(s.textContent=String(this.favoriten.length))}catch(r){console.error("❌ Fehler beim Entfernen aus Favoriten",r),alert("Entfernen aus Favoriten fehlgeschlagen.")}})}switchTab(e){console.log("🔄 KAMPAGNEDETAIL: Wechsle zu Tab:",e),document.querySelectorAll(".tab-button").forEach(a=>{a.classList.remove("active")}),document.querySelectorAll(".tab-pane").forEach(a=>{a.classList.remove("active")});const t=document.querySelector(`[data-tab="${e}"]`),n=document.getElementById(`tab-${e}`);t&&n&&(t.classList.add("active"),n.classList.add("active"))}showAddCreatorModal(){console.log('🎯 Zeige "Creator hinzufügen" Modal'),alert("Funktion zum Hinzufügen von Creators wird implementiert...")}showAddNotizModal(){console.log('🎯 Zeige "Notiz hinzufügen" Modal'),window.notizenSystem&&window.notizenSystem.showAddNotizModal("kampagne",this.kampagneId)}showAddRatingModal(){console.log('🎯 Zeige "Bewertung hinzufügen" Modal'),window.bewertungsSystem&&window.bewertungsSystem.showAddRatingModal("kampagne",this.kampagneId)}showDeleteConfirmation(){confirm("Sind Sie sicher, dass Sie diese Kampagne löschen möchten? Diese Aktion kann nicht rückgängig gemacht werden.")&&this.deleteKampagne()}async deleteKampagne(){try{const{error:e}=await window.supabase.from("kampagne").delete().eq("id",this.kampagneId);if(e)throw e;window.dispatchEvent(new CustomEvent("entityUpdated",{detail:{entity:"kampagne",action:"deleted",id:this.kampagneId}})),window.navigateTo("/kampagne")}catch(e){console.error("❌ Fehler beim Löschen der Kampagne:",e),alert("Ein unerwarteter Fehler ist aufgetreten.")}}destroy(){console.log("🗑️ KAMPAGNEDETAIL: Destroy aufgerufen"),window.setContentSafely(""),console.log("✅ KAMPAGNEDETAIL: Destroy abgeschlossen")}renderAnsprechpartner(){return!this.kampagneData.ansprechpartner||this.kampagneData.ansprechpartner.length===0?'<span class="text-muted">Keine Ansprechpartner zugeordnet</span>':`<div class="tags">${this.kampagneData.ansprechpartner.filter(t=>t&&t.vorname&&t.nachname).map(t=>{const n=[t.position?.name,t.unternehmen?.firmenname].filter(Boolean).join(" • ");return`<a href="#" class="tag tag--ansprechpartner" onclick="event.preventDefault(); window.navigateTo('/ansprechpartner/${t.id}')">
          ${t.vorname} ${t.nachname}
          ${n?`<small style="opacity: 0.8; margin-left: 5px;">(${n})</small>`:""}
        </a>`}).join("")}</div>`}bindAnsprechpartnerEvents(){const e=document.querySelector(".btn-add-ansprechpartner-kampagne");e&&e.addEventListener("click",()=>{window.actionsDropdown.openAddAnsprechpartnerToKampagneModal(this.kampagneId)}),window.addEventListener("entityUpdated",t=>{t.detail.entity==="ansprechpartner"&&t.detail.action==="added"&&t.detail.kampagneId===this.kampagneId&&this.loadKampagneData().then(()=>{this.render()})})}showEditForm(){console.log("🎯 KAMPAGNEDETAIL: Zeige Bearbeitungsformular"),window.setHeadline("Kampagne bearbeiten");const e={...this.kampagneData};e._isEditMode=!0,e._entityId=this.kampagneId,this.kampagneData.unternehmen_id&&(e.unternehmen_id=this.kampagneData.unternehmen_id,console.log("🏢 KAMPAGNEDETAIL: Unternehmen-ID für Edit-Mode:",this.kampagneData.unternehmen_id)),this.kampagneData.marke_id&&(e.marke_id=this.kampagneData.marke_id,console.log("🏷️ KAMPAGNEDETAIL: Marke-ID für Edit-Mode:",this.kampagneData.marke_id)),this.kampagneData.auftrag_id&&(e.auftrag_id=this.kampagneData.auftrag_id,console.log("📋 KAMPAGNEDETAIL: Auftrag-ID für Edit-Mode:",this.kampagneData.auftrag_id)),console.log("📋 KAMPAGNEDETAIL: FormData für Rendering:",e);const t=window.formSystem.renderFormOnly("kampagne",e);window.content.innerHTML=`
      <div class="page-header">
        <div class="page-header-left">
          <h1>Kampagne bearbeiten</h1>
          <p>Bearbeiten Sie die Informationen von ${this.kampagneData.kampagnenname}</p>
        </div>
        <div class="page-header-right">
          <button onclick="window.navigateTo('/kampagne/${this.kampagneId}')" class="secondary-btn">Zurück zu Details</button>
        </div>
      </div>
      
      <div class="form-page">
        ${t}
      </div>
    `,window.formSystem.bindFormEvents("kampagne",e);const n=document.getElementById("kampagne-form");n&&(n.dataset.isEditMode="true",n.dataset.entityType="kampagne",n.dataset.entityId=this.kampagneId,e.unternehmen_id&&(n.dataset.existingUnternehmenId=e.unternehmen_id),e.marke_id&&(n.dataset.existingMarkeId=e.marke_id),e.auftrag_id&&(n.dataset.existingAuftragId=e.auftrag_id),console.log("📋 KAMPAGNEDETAIL: Form-Datasets gesetzt:",{isEditMode:n.dataset.isEditMode,entityType:n.dataset.entityType,entityId:n.dataset.entityId,existingUnternehmenId:n.dataset.existingUnternehmenId,existingMarkeId:n.dataset.existingMarkeId,existingAuftragId:n.dataset.existingAuftragId}),n.onsubmit=async a=>{a.preventDefault(),await this.handleEditFormSubmit()},setTimeout(()=>{this.setReadonlyFieldsInEditMode(n),this.setNullFieldDisplayValues(n)},1500))}async loadDependentFieldsInEditMode(e){console.log("🔄 KAMPAGNEDETAIL: Lade abhängige Felder im Edit-Modus");try{if(this.kampagneData.unternehmen_id){const t=e.querySelector('select[name="marke_id"]');if(t){const{data:n,error:a}=await window.supabase.from("marke").select("id, markenname").eq("unternehmen_id",this.kampagneData.unternehmen_id).order("markenname");!a&&n&&(console.log("✅ KAMPAGNEDETAIL: Marken für Unternehmen geladen:",n.length),t.innerHTML='<option value="">Marke auswählen...</option>',n.forEach(r=>{const i=document.createElement("option");i.value=r.id,i.textContent=r.markenname,i.selected=r.id===this.kampagneData.marke_id,t.appendChild(i)}))}}if(this.kampagneData.marke_id){const t=e.querySelector('select[name="auftrag_id"]');if(t){const{data:n,error:a}=await window.supabase.from("auftrag").select("id, auftragsname").eq("marke_id",this.kampagneData.marke_id).order("auftragsname");!a&&n&&(console.log("✅ KAMPAGNEDETAIL: Aufträge für Marke geladen:",n.length),t.innerHTML='<option value="">Auftrag auswählen...</option>',n.forEach(r=>{const i=document.createElement("option");i.value=r.id,i.textContent=r.auftragsname,i.selected=r.id===this.kampagneData.auftrag_id,t.appendChild(i)}))}}}catch(t){console.error("❌ KAMPAGNEDETAIL: Fehler beim Laden abhängiger Felder:",t)}}setReadonlyFieldsInEditMode(e){["unternehmen_id","marke_id","auftrag_id"].forEach(n=>{const a=e.querySelector(`select[name="${n}"], input[name="${n}"]`);if(a){a.disabled=!0,a.style.backgroundColor="#f3f4f6",a.style.cursor="not-allowed";const s=e.querySelector(`label[for="field-${n}"]`);s&&!s.textContent.includes("(fixiert)")&&(s.textContent+=" (fixiert)",s.style.color="#6b7280"),console.log(`🔒 KAMPAGNEDETAIL: Feld ${n} als readonly gesetzt`)}const r=e.querySelector(`#field-${n}`);if(r){const s=r.closest(".form-field");if(s){const o=s.querySelector(".searchable-select-input");o&&(o.disabled=!0,o.style.backgroundColor="#f3f4f6",o.style.cursor="not-allowed",o.style.color="#6b7280",console.log(`🔒 KAMPAGNEDETAIL: Searchable Input für ${n} deaktiviert`));const l=s.querySelector(".searchable-select-container");if(l){l.style.opacity="0.7",l.style.pointerEvents="none";const c=l.querySelector(".searchable-select-dropdown");c&&(c.style.display="none"),console.log(`🔒 KAMPAGNEDETAIL: Searchable Container für ${n} deaktiviert`)}}}const i=e.querySelector(`[data-field-name="${n}"]`);i&&(i.style.opacity="0.7",i.style.pointerEvents="none",console.log(`🔒 KAMPAGNEDETAIL: Container mit data-field-name für ${n} deaktiviert`))})}setNullFieldDisplayValues(e){["unternehmen_id","marke_id","auftrag_id"].forEach(n=>{const a=this.kampagneData[n];e.querySelectorAll(`
        input[name="${n}"],
        .searchable-select-input[data-field="${n}"],
        [data-field-name="${n}"] input,
        #field-${n} input
      `).forEach(i=>{i&&i.type!=="hidden"&&this.setFieldDisplayValue(n,a,i)})})}setFieldDisplayValue(e,t,n){if(!t){n.value="Nicht zugeordnet",n.style.fontStyle="italic",n.style.color="#9ca3af";return}let a="Unbekannt";try{e==="unternehmen_id"&&this.kampagneData.unternehmen?a=this.kampagneData.unternehmen.firmenname:e==="marke_id"&&this.kampagneData.marke?a=this.kampagneData.marke.markenname:e==="auftrag_id"&&this.kampagneData.auftrag&&(a=this.kampagneData.auftrag.auftragsname),n.value=a,n.style.fontStyle="normal",n.style.color="#6b7280",console.log(`📝 KAMPAGNEDETAIL: ${e} Anzeige-Wert gesetzt: ${a}`)}catch(r){console.error(`❌ KAMPAGNEDETAIL: Fehler beim Setzen des Anzeige-Wertes für ${e}:`,r),n.value="Fehler beim Laden",n.style.fontStyle="italic",n.style.color="#ef4444"}}async handleEditFormSubmit(){try{const e=document.getElementById("kampagne-form"),t=new FormData(e),n={};for(const[r,i]of t.entries())if(r.includes("[]")){const s=r.replace("[]","");n[s]||(n[s]=[]),n[s].push(i)}else n[r]=i;console.log("📝 Kampagne Edit Submit-Daten:",n);const a=await window.dataService.updateEntity("kampagne",this.kampagneId,n);a.success?(this.showSuccessMessage("Kampagne erfolgreich aktualisiert!"),window.dispatchEvent(new CustomEvent("entityUpdated",{detail:{entity:"kampagne",action:"updated",id:this.kampagneId}})),setTimeout(()=>{window.navigateTo(`/kampagne/${this.kampagneId}`)},1500)):this.showErrorMessage(`Fehler beim Aktualisieren: ${a.error}`)}catch(e){console.error("❌ Fehler beim Aktualisieren der Kampagne:",e),this.showErrorMessage("Ein unerwarteter Fehler ist aufgetreten.")}}showSuccessMessage(e){const t=document.createElement("div");t.className="alert alert-success",t.textContent=e;const n=document.getElementById("kampagne-form");n&&(n.parentNode.insertBefore(t,n),setTimeout(()=>{t.remove()},5e3))}showErrorMessage(e){const t=document.createElement("div");t.className="alert alert-danger",t.textContent=e;const n=document.getElementById("kampagne-form");n&&(n.parentNode.insertBefore(t,n),setTimeout(()=>{t.remove()},5e3))}}const fe=new st;class ot{static formatStatus(e){return{active:"Aktiv",inactive:"Inaktiv",completed:"Abgeschlossen",cancelled:"Storniert",draft:"Entwurf",pending:"Ausstehend"}[e]||e||"Unbekannt"}static formatKampagnenArt(e){return e?Array.isArray(e)?e.join(", "):{influencer:"Influencer Kampagne",ugc:"UGC",igc:"IGC",ai:"AI"}[e]||e||"Unbekannt":"-"}static calculateProgress(e){if(!e.start||!e.deadline)return 0;const t=new Date(e.start),n=new Date(e.deadline),a=new Date;if(a<t)return 0;if(a>n)return 100;const r=n-t,i=a-t;return Math.round(i/r*100)}static isKampagneActive(e){if(!e.start||!e.deadline)return!1;const t=new Date,n=new Date(e.start),a=new Date(e.deadline);return t>=n&&t<=a}static isKampagneExpired(e){if(!e.deadline)return!1;const t=new Date,n=new Date(e.deadline);return t>n}static getRemainingDays(e){if(!e.deadline)return null;const t=new Date,a=new Date(e.deadline)-t;return Math.ceil(a/(1e3*60*60*24))}static formatBudget(e){return e?new Intl.NumberFormat("de-DE",{style:"currency",currency:"EUR"}).format(e):"-"}static formatDate(e){return e?new Date(e).toLocaleDateString("de-DE"):"-"}static formatDateTime(e){return e?new Date(e).toLocaleString("de-DE"):"-"}static validateKampagneData(e){const t={};if((!e.kampagnenname||e.kampagnenname.trim()==="")&&(t.kampagnenname="Kampagnenname ist erforderlich"),e.unternehmen_id||(t.unternehmen_id="Unternehmen ist erforderlich"),e.start||(t.start="Startdatum ist erforderlich"),e.deadline||(t.deadline="Deadline ist erforderlich"),e.start&&e.deadline){const n=new Date(e.start),a=new Date(e.deadline);n>=a&&(t.deadline="Deadline muss nach dem Startdatum liegen")}return e.creatoranzahl&&(isNaN(e.creatoranzahl)||e.creatoranzahl<0)&&(t.creatoranzahl="Creator Anzahl muss eine positive Zahl sein"),e.videoanzahl&&(isNaN(e.videoanzahl)||e.videoanzahl<0)&&(t.videoanzahl="Video Anzahl muss eine positive Zahl sein"),{isValid:Object.keys(t).length===0,errors:t}}static createKampagneSummary(e){const t=this.calculateProgress(e),n=this.isKampagneActive(e),a=this.getRemainingDays(e);return{id:e.id,name:e.kampagnenname,status:e.status,progress:t,isActive:n,remainingDays:a,creatorCount:e.creatoranzahl||0,videoCount:e.videoanzahl||0,start:this.formatDate(e.start),deadline:this.formatDate(e.deadline)}}static getFilterOptions(){return{status:[{value:"active",label:"Aktiv"},{value:"inactive",label:"Inaktiv"},{value:"completed",label:"Abgeschlossen"},{value:"cancelled",label:"Storniert"},{value:"draft",label:"Entwurf"},{value:"pending",label:"Ausstehend"}],art_der_kampagne:[{value:"influencer",label:"Influencer Kampagne"},{value:"ugc",label:"UGC Kampagne"},{value:"paid",label:"Paid Kampagne"},{value:"organic",label:"Organische Kampagne"},{value:"hybrid",label:"Hybrid Kampagne"}]}}static createExportData(e){return e.map(t=>({Kampagnenname:t.kampagnenname,Status:this.formatStatus(t.status),"Art der Kampagne":this.formatKampagnenArt(t.art_der_kampagne),Start:this.formatDate(t.start),Deadline:this.formatDate(t.deadline),"Creator Anzahl":t.creatoranzahl||0,"Video Anzahl":t.videoanzahl||0,Drehort:t.drehort||"-",Ziele:t.ziele||"-","Budget Info":t.budget_info||"-",Unternehmen:t.unternehmen?.firmenname||"Unbekannt",Marke:t.marke?.markenname||"Unbekannt",Auftrag:t.auftrag?.auftragsname||"Unbekannt","Erstellt am":this.formatDateTime(t.created_at),"Aktualisiert am":this.formatDateTime(t.updated_at)}))}static createKampagneStats(e){const t={total:e.length,active:0,completed:0,cancelled:0,draft:0,totalCreators:0,totalVideos:0,totalBudget:0};return e.forEach(n=>{switch(n.status){case"active":t.active++;break;case"completed":t.completed++;break;case"cancelled":t.cancelled++;break;case"draft":t.draft++;break}t.totalCreators+=n.creatoranzahl||0,t.totalVideos+=n.videoanzahl||0,n.budget_info}),t}}const lt=new ot;class dt{constructor(){this.selectedBriefings=new Set,this._boundEventListeners=new Set}async init(e){if(e&&e!=="new"&&window.moduleRegistry)return window.navigateTo(`/briefing/${e}`);if(window.setHeadline("Briefings Übersicht"),!(window.canViewPage&&window.canViewPage("briefing")||await window.checkUserPermission("briefing","can_view"))){window.content.innerHTML=`
        <div class="error-message">
          <p>Sie haben keine Berechtigung, Briefings anzuzeigen.</p>
        </div>
      `;return}window.bulkActionSystem?.registerList("briefing",this),this.bindEvents(),await this.loadAndRender()}async loadAndRender(){try{const e=await window.dataService.loadFilterData("briefing");await this.render(e),await this.initializeFilterBar();const t=_.getFilters("briefing");console.log("🔍 Lade Briefings mit Filter:",t);const n=await this.loadBriefingsWithRelations(t);console.log("📊 Briefings geladen:",n?.length||0),this.updateTable(n)}catch(e){window.ErrorHandler.handle(e,"BriefingList.loadAndRender")}}async loadBriefingsWithRelations(e={}){try{if(!window.supabase)return console.warn("⚠️ Supabase nicht verfügbar - verwende Mock-Daten"),await window.dataService.loadEntities("briefing",e);const t=window.currentUser?.rolle==="admin";let n=[],a=[];if(!t)try{const{data:d}=await window.supabase.from("kampagne_mitarbeiter").select("kampagne_id").eq("mitarbeiter_id",window.currentUser?.id),u=(d||[]).map(g=>g.kampagne_id).filter(Boolean),{data:h}=await window.supabase.from("marke_mitarbeiter").select("marke_id").eq("mitarbeiter_id",window.currentUser?.id),m=(h||[]).map(g=>g.marke_id).filter(Boolean);let p=[];if(m.length>0){const{data:g}=await window.supabase.from("kampagne").select("id").in("marke_id",m);p=(g||[]).map(f=>f.id).filter(Boolean)}if(n=[...new Set([...u,...p])],n.length>0){const{data:g}=await window.supabase.from("kooperationen").select("id").in("kampagne_id",n);a=(g||[]).map(f=>f.id)}console.log(`🔍 BRIEFINGLIST: Mitarbeiter ${window.currentUser?.id} hat Zugriff auf:`,{direkteKampagnen:u.length,markenKampagnen:p.length,gesamtKampagnen:n.length,kooperationen:a.length})}catch(d){console.error("❌ Fehler beim Laden der Zuordnungen:",d)}let r=window.supabase.from("briefings").select(`
          *,
          unternehmen:unternehmen_id(id, firmenname),
          marke:marke_id(id, markenname),
          assignee:assignee_id(id, name)
        `).order("created_at",{ascending:!1});if(!t){const d=[`assignee_id.eq.${window.currentUser?.id}`];a.length&&d.push(`kooperation_id.in.(${a.join(",")})`),n.length&&d.push(`kampagne_id.in.(${n.join(",")})`),r=r.or(d.join(","))}if(e){const d=(u,h,m="string")=>{if(h==null||h===""||h==="[object Object]")return;const p=String(h);switch(m){case"uuid":r=r.eq(u,p);break;case"dateRange":h.from&&(r=r.gte(u,h.from)),h.to&&(r=r.lte(u,h.to));break;case"stringIlike":r=r.ilike(u,`%${p}%`);break;default:r=r.eq(u,p)}};d("unternehmen_id",e.unternehmen_id,"uuid"),d("marke_id",e.marke_id,"uuid"),d("assignee_id",e.assignee_id,"uuid"),d("status",e.status),e.product_service_offer&&d("product_service_offer",e.product_service_offer,"stringIlike"),e.deadline&&d("deadline",e.deadline,"dateRange"),e.created_at&&d("created_at",e.created_at,"dateRange")}const{data:i,error:s}=await r;if(s)throw s;const o=i||[],l=o.filter(d=>!d.unternehmen&&d.unternehmen_id).map(d=>d.unternehmen_id),c=o.filter(d=>!d.marke&&d.marke_id).map(d=>d.marke_id);this._unternehmenMap={},this._markeMap={};try{if(l.length>0){const d=Array.from(new Set(l)),{data:u}=await window.supabase.from("unternehmen").select("id, firmenname").in("id",d);(u||[]).forEach(h=>{this._unternehmenMap[h.id]=h})}if(c.length>0){const d=Array.from(new Set(c)),{data:u}=await window.supabase.from("marke").select("id, markenname").in("id",d);(u||[]).forEach(h=>{this._markeMap[h.id]=h})}}catch(d){console.warn("⚠️ Konnte Fallback-Relationen für Briefings nicht vollständig laden:",d)}return o.map(d=>({...d,unternehmen:d.unternehmen||(d.unternehmen_id?this._unternehmenMap[d.unternehmen_id]:null)||null,marke:d.marke||(d.marke_id?this._markeMap[d.marke_id]:null)||null,assignee:d.assignee?{name:d.assignee.name}:null}))}catch(t){return console.error("❌ Fehler beim Laden der Briefings mit Beziehungen:",t),await window.dataService.loadEntities("briefing",e)}}async render(e){window.currentUser?.permissions?.briefing?.can_edit;const n=`
      <div class="page-header">
        <div class="page-header-left">
          <h1>Briefings</h1>
          <p>Verwalten Sie alle Briefings</p>
        </div>
        <div class="page-header-right">
          <button id="btn-briefing-new" class="primary-btn">Neues Briefing anlegen</button>
        </div>
      </div>

      ${`<div class="filter-bar">
      <div class="filter-left">
        <div id="filter-container"></div>
      </div>
      <div class="filter-right">
        <button id="btn-filter-reset" class="secondary-btn" style="display:${this.hasActiveFilters()?"inline-block":"none"};">Filter zurücksetzen</button>
      </div>
    </div>`}

      <div class="table-actions">
        <div class="table-actions-left">
          <button id="btn-select-all" class="secondary-btn">Alle auswählen</button>
          <button id="btn-deselect-all" class="secondary-btn" style="display:none;">Auswahl aufheben</button>
        </div>
        <div class="table-actions-right">
          <button id="btn-delete-selected" class="danger-btn" style="display:none;">Ausgewählte löschen</button>
        </div>
      </div>

      <div class="data-table-container">
        <table class="data-table">
          <thead>
            <tr>
              <th><input type="checkbox" id="select-all-briefings"></th>
              <th>Produkt/Angebot</th>
              <th>Unternehmen</th>
              <th>Marke</th>
              <th>Status</th>
              <th>Deadline</th>
              <th>Zugewiesen</th>
              <th>Erstellt</th>
              <th>Aktionen</th>
            </tr>
          </thead>
          <tbody id="briefings-table-body">
            <tr>
              <td colspan="9" class="loading">Lade Briefings...</td>
            </tr>
          </tbody>
        </table>
      </div>
    `;window.setContentSafely(window.content,n)}async initializeFilterBar(){const e=document.getElementById("filter-container");e&&await _.renderFilterBar("briefing",e,t=>this.onFiltersApplied(t),()=>this.onFiltersReset())}onFiltersApplied(e){console.log("🔍 BriefingList: Filter angewendet:",e),_.applyFilters("briefing",e),this.loadAndRender()}onFiltersReset(){console.log("🔄 BriefingList: Filter zurückgesetzt"),_.resetFilters("briefing"),this.loadAndRender()}bindEvents(){this.boundFilterResetHandler=e=>{e.target.id==="btn-filter-reset"&&this.onFiltersReset()},document.addEventListener("click",this.boundFilterResetHandler),document.addEventListener("click",e=>{(e.target.id==="btn-briefing-new"||e.target.id==="btn-briefing-new-filter")&&(e.preventDefault(),window.navigateTo("/briefing/new"))}),document.addEventListener("click",e=>{if(e.target.id==="btn-select-all"){e.preventDefault(),document.querySelectorAll(".briefing-check").forEach(a=>{a.checked=!0,a.dataset.id&&this.selectedBriefings.add(a.dataset.id)});const n=document.getElementById("select-all-briefings");n&&(n.indeterminate=!1,n.checked=!0),this.updateSelection()}}),document.addEventListener("click",e=>{if(e.target.id==="btn-deselect-all"){e.preventDefault(),document.querySelectorAll(".briefing-check").forEach(a=>{a.checked=!1}),this.selectedBriefings.clear();const n=document.getElementById("select-all-briefings");n&&(n.indeterminate=!1,n.checked=!1),this.updateSelection()}}),document.addEventListener("click",e=>{if(e.target.classList.contains("table-link")&&e.target.dataset.table==="briefing"){e.preventDefault();const t=e.target.dataset.id;window.navigateTo(`/briefing/${t}`)}}),window.addEventListener("entityUpdated",e=>{e.detail.entity==="briefing"&&this.loadAndRender()}),document.addEventListener("change",e=>{if(e.target.id==="select-all-briefings"){const t=document.querySelectorAll(".briefing-check"),n=e.target.checked;t.forEach(a=>{a.checked=n,n?this.selectedBriefings.add(a.dataset.id):this.selectedBriefings.delete(a.dataset.id)}),this.updateSelection()}}),document.addEventListener("change",e=>{e.target.classList.contains("briefing-check")&&(e.target.checked?this.selectedBriefings.add(e.target.dataset.id):this.selectedBriefings.delete(e.target.dataset.id),this.updateSelection(),this.updateSelectAllCheckbox())})}hasActiveFilters(){const e=_.getFilters("briefing");return Object.keys(e).length>0}showDeleteSelectedConfirmation(){const e=this.selectedBriefings.size;if(e===0){alert("Keine Briefings ausgewählt.");return}const t=e===1?"Möchten Sie das ausgewählte Briefing wirklich löschen?":`Möchten Sie die ${e} ausgewählten Briefings wirklich löschen?`;confirm(`${t}

Dieser Vorgang kann nicht rückgängig gemacht werden.`)&&this.deleteSelectedBriefings()}async deleteSelectedBriefings(){const e=Array.from(this.selectedBriefings),t=e.length;console.log(`🗑️ Lösche ${t} Briefings...`);let n=0,a=0;const r=[];for(const i of e)try{const s=await window.dataService.deleteEntity("briefing",i);s.success?(n++,r.push(i),this.selectedBriefings.delete(i)):(a++,console.error(`❌ Fehler beim Löschen von Briefing ${i}:`,s.error))}catch(s){a++,console.error(`❌ Fehler beim Löschen von Briefing ${i}:`,s)}if(n>0){const i=n===1?"Briefing erfolgreich gelöscht.":`${n} Briefings erfolgreich gelöscht.`;a>0?alert(`${i}
${a} Briefings konnten nicht gelöscht werden.`):alert(i),r.forEach(o=>{const l=document.querySelector(`tr[data-id="${o}"]`);l&&l.remove()}),this.selectedBriefings.clear(),this.updateSelection(),this.updateSelectAllCheckbox();const s=document.getElementById("briefings-table-body");s&&s.children.length===0&&await this.loadAndRender(),window.dispatchEvent(new CustomEvent("entityUpdated",{detail:{entity:"briefing",action:"bulk-deleted",count:n}}))}else alert("Keine Briefings konnten gelöscht werden.")}updateSelection(){const e=this.selectedBriefings.size,t=document.getElementById("btn-deselect-all"),n=document.getElementById("btn-delete-selected");t&&(t.style.display=e>0?"inline-block":"none"),n&&(n.style.display=e>0?"inline-block":"none")}updateSelectAllCheckbox(){const e=document.getElementById("select-all-briefings"),t=document.querySelectorAll(".briefing-check");if(!e||t.length===0)return;const n=Array.from(t).filter(r=>r.checked).length,a=t.length;e.checked=n===a,e.indeterminate=n>0&&n<a}async updateTable(e){const t=document.getElementById("briefings-table-body");if(!t)return;if(!e||e.length===0){const{renderEmptyState:i}=await B(async()=>{const{renderEmptyState:s}=await import("./core-C7Vz5Umf.js").then(o=>o.F);return{renderEmptyState:s}},[]);i(t);return}const n=i=>i?new Date(i).toLocaleDateString("de-DE"):"-",a=i=>window.validatorSystem.sanitizeHtml(i||"—"),r=e.map(i=>`
      <tr data-id="${i.id}">
        <td><input type="checkbox" class="briefing-check" data-id="${i.id}"></td>
        <td>
          <a href="#" class="table-link" data-table="briefing" data-id="${i.id}">
            ${a((i.product_service_offer||"").toString().slice(0,80))}
          </a>
        </td>
        <td>${a(i.unternehmen?.firmenname||this._unternehmenMap?.[i.unternehmen_id]?.firmenname)}</td>
        <td>${a(i.marke?.markenname||this._markeMap?.[i.marke_id]?.markenname)}</td>
        <td>
          <span class="status-badge status-${(i.status||"unknown").toLowerCase()}">
            ${a(i.status)}
          </span>
        </td>
        <td>${n(i.deadline)}</td>
        <td>${a(i.assignee?.name)}</td>
        <td>${n(i.created_at)}</td>
        <td>
          <div class="actions-dropdown-container" data-entity-type="briefing">
            <button class="actions-toggle" aria-expanded="false" aria-label="Aktionen">
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" class="w-5 h-5"><path d="M10 3a1.5 1.5 0 110 3 1.5 1.5 0 010-3zM10 8.5a1.5 1.5 0 110 3 1.5 1.5 0 010-3zM11.5 15.5a1.5 1.5 0 10-3 0 1.5 1.5 0 003 0z"/></svg>
            </button>
            <div class="actions-dropdown">
              <a href="#" class="action-item" data-action="view" data-id="${i.id}">
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" class="w-5 h-5"><path d="M10 12.5a2.5 2.5 0 100-5 2.5 2.5 0 000 5z"/><path fill-rule="evenodd" d="M.661 10c1.743-2.372 4.761-5 9.339-5 4.578 0 7.601 2.628 9.339 5-1.738 2.372-4.761 5-9.339 5-4.578 0-7.601-2.628-9.339-5zM10 15a5 5 0 100-10 5 5 0 000 10z" clip-rule="evenodd"/></svg>
                Details anzeigen
              </a>
              <a href="#" class="action-item" data-action="edit" data-id="${i.id}">
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" class="w-5 h-5"><path d="M5.433 13.917l-1.523 1.523a.75.75 0 001.06 1.06l1.523-1.523L5.433 13.917zM11.206 6.106L13.917 3.4a.75.75 0 011.06 1.06l-2.711 2.711-.693-.693z"/><path fill-rule="evenodd" d="M1.334 10.606a1.5 1.5 0 011.06-1.06l10.38-10.38a1.5 1.5 0 012.122 0l1.523 1.523a1.5 1.5 0 010 2.122l-10.38 10.38a1.5 1.5 0 01-1.06 1.06H1.334v-3.182z" clip-rule="evenodd"/></svg>
                Bearbeiten
              </a>
              <div class="action-separator"></div>
              <a href="#" class="action-item action-danger" data-action="delete" data-id="${i.id}">
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" class="w-5 h-5"><path fill-rule="evenodd" d="M8.75 1A2.75 2.75 0 006 3.75v.443c-.795.077-1.584.176-2.368.298a.75.75 0 10.232 1.482l.175-.027c.572-.089 1.14-.19 1.706-.302A3.75 3.75 0 019.75 3h.5a3.75 3.75 0 013.657 3.234c.566.112 1.134.213 1.706.302l.175.027a.75.75 0 10.232-1.482A41.203 41.203 0 0014 4.193V3.75A2.75 2.75 0 0011.25 1h-2.5zM2.5 7.75a.75.75 0 01.75-.75h13.5a.75.75 0 010 1.5H3.25a.75.75 0 01-.75-.75zM7.25 9.75a.75.75 0 01.75-.75h4.5a.75.75 0 010 1.5H8a.75.75 0 01-.75-.75zM6 12.25a.75.75 0 01.75-.75h6.5a.75.75 0 010 1.5H6.75a.75.75 0 01-.75-.75zM4.75 14.75a.75.75 0 01.75-.75h9.5a.75.75 0 010 1.5h-9.5a.75.75 0 01-.75-.75z" clip-rule="evenodd"/></svg>
                Löschen
              </a>
            </div>
          </div>
        </td>
      </tr>
    `).join("");t.innerHTML=r}showCreateForm(){window.setHeadline("Neues Briefing anlegen");const e=window.formSystem.renderFormOnly("briefing");window.content.innerHTML=`
      <div class="page-header">
        <div class="page-header-left">
          <h1>Neues Briefing anlegen</h1>
          <p>Erstellen Sie ein neues Briefing</p>
        </div>
        <div class="page-header-right">
          <button onclick="window.navigateTo('/briefing')" class="secondary-btn">Zurück zur Übersicht</button>
        </div>
      </div>
      <div class="form-page">
        ${e}
      </div>
    `,window.formSystem.bindFormEvents("briefing",null);const t=document.getElementById("briefing-form");t&&(t.onsubmit=async n=>{n.preventDefault(),await window.formSystem.handleFormSubmit("briefing",null),setTimeout(()=>window.navigateTo("/briefing"),300)})}destroy(){this._boundEventListeners.forEach(({element:e,type:t,handler:n})=>{e.removeEventListener(t,n)}),this._boundEventListeners.clear(),this.boundFilterResetHandler&&(document.removeEventListener("click",this.boundFilterResetHandler),this.boundFilterResetHandler=null)}}const be=new dt;class ct{constructor(){this.briefingId=null,this.briefing=null,this.notizen=[],this.ratings=[]}async init(e){if(this.briefingId=e,window.moduleRegistry?.currentModule===this)try{await this.loadBriefingData(),await this.render(),this.bindEvents()}catch(t){console.error("❌ BRIEFINGDETAIL: Fehler bei der Initialisierung:",t),window.ErrorHandler?.handle?.(t,"BriefingDetail.init")}}async loadBriefingData(){if(!(!this.briefingId||this.briefingId==="new"))try{const{data:e,error:t}=await window.supabase.from("briefings").select(`
          *,
          unternehmen:unternehmen_id(id, firmenname, webseite),
          marke:marke_id(id, markenname, webseite),
          assignee:assignee_id(id, name)
        `).eq("id",this.briefingId).single();if(t)throw t;if(this.briefing=e,this.briefing?.kooperation_id)try{const{data:n}=await window.supabase.from("kooperationen").select(`
              id,
              name,
              status,
              kampagne:kampagne_id ( id, kampagnenname )
            `).eq("id",this.briefing.kooperation_id).single();n&&(this.briefing.kooperation=n)}catch(n){console.warn("⚠️ BRIEFINGDETAIL: Kooperation konnte nicht geladen werden",n),this.briefing.kooperation=null}window.notizenSystem&&(this.notizen=await window.notizenSystem.loadNotizen("briefing",this.briefingId)),window.bewertungsSystem&&(this.ratings=await window.bewertungsSystem.loadBewertungen("briefing",this.briefingId))}catch(e){throw console.error("❌ BRIEFINGDETAIL: Fehler beim Laden der Briefing-Daten:",e),e}}async render(){if(!this.briefing){this.showNotFound();return}const e=this.briefing.product_service_offer||"Briefing";window.setHeadline(`Briefing: ${window.validatorSystem?.sanitizeHtml?.(e)||e}`);const t=window.currentUser?.permissions?.briefing?.can_edit||!1,n=window.currentUser?.permissions?.briefing?.can_delete||!1,a=s=>s?new Date(s).toLocaleDateString("de-DE"):"-",r=s=>window.validatorSystem?.sanitizeHtml?.(s||"-")||s||"-",i=`
      <div class="page-header">
        <div class="page-header-left">
          <h1>${r(e)}</h1>
          <p>Briefing-Details und verwandte Informationen</p>
        </div>
        <div class="page-header-right">
          <button onclick="window.navigateTo('/briefing')" class="secondary-btn">Zurück zur Übersicht</button>
          ${t?'<button id="btn-edit-briefing" class="primary-btn">Bearbeiten</button>':""}
        </div>
      </div>

      <div class="content-section">
        <div class="tab-navigation">
          <button class="tab-button active" data-tab="info">
            <i class="icon-information-circle"></i>
            Informationen
          </button>
          <button class="tab-button" data-tab="notizen">
            <i class="icon-document-text"></i>
            Notizen
            <span class="tab-count">${this.notizen.length}</span>
          </button>
          <button class="tab-button" data-tab="ratings">
           
            Bewertungen
            <span class="tab-count">${this.ratings.length}</span>
          </button>
        </div>

        <div class="tab-content">
          <div class="tab-pane active" id="tab-info">
            <div class="detail-section">
              <h2>Briefing Informationen</h2>
              <div class="detail-grid">
                <div class="detail-card">
                  <h3>Allgemein</h3>
                  <div class="detail-grid-2">
                    <div class="detail-item">
                      <label>Produkt/Angebot:</label>
                      <span>${r(this.briefing.product_service_offer)}</span>
                    </div>
                    <div class="detail-item">
                      <label>Status:</label>
                      <span class="status-badge status-${(this.briefing.status||"unknown").toLowerCase()}">${r(this.briefing.status)}</span>
                    </div>
                    <div class="detail-item">
                      <label>Deadline:</label>
                      <span>${a(this.briefing.deadline)}</span>
                    </div>
                    <div class="detail-item">
                      <label>Zugewiesen:</label>
                      <span>${r(this.briefing.assignee?.name)}</span>
                    </div>
                    <div class="detail-item">
                      <label>Produktseite:</label>
                      <span>${this.briefing.produktseite_url?`<a href="${this.briefing.produktseite_url}" target="_blank">Link</a>`:"-"}</span>
                    </div>
                    <div class="detail-item">
                      <label>Erstellt:</label>
                      <span>${a(this.briefing.created_at)}</span>
                    </div>
                    <div class="detail-item">
                      <label>Aktualisiert:</label>
                      <span>${a(this.briefing.updated_at)}</span>
                    </div>
                  </div>
                </div>

                <div class="detail-card">
                  <h3>Unternehmen & Marke</h3>
                  <div class="detail-item">
                    <label>Unternehmen:</label>
                    <span>${r(this.briefing.unternehmen?.firmenname)}</span>
                  </div>
                  <div class="detail-item">
                    <label>Marke:</label>
                    <span>${r(this.briefing.marke?.markenname)}</span>
                  </div>
                  <div class="detail-item">
                    <label>Kooperation:</label>
                    <span>${this.briefing.kooperation?.id?`<a href="/kooperation/${this.briefing.kooperation.id}" onclick="event.preventDefault(); window.navigateTo('/kooperation/${this.briefing.kooperation.id}')">${r(this.briefing.kooperation.name||"Kooperation")}</a>`:"-"}</span>
                  </div>
                </div>

                <div class="detail-card">
                  <h3>Briefing-Inhalte</h3>
                  <div class="detail-item">
                    <label>Creator Aufgabe:</label>
                    <span>${r(this.briefing.creator_aufgabe)}</span>
                  </div>
                  <div class="detail-item">
                    <label>USPs:</label>
                    <span>${r(this.briefing.usp)}</span>
                  </div>
                  <div class="detail-item">
                    <label>Zielgruppe:</label>
                    <span>${r(this.briefing.zielgruppe)}</span>
                  </div>
                  <div class="detail-item">
                    <label>Zieldetails:</label>
                    <span>${r(this.briefing.zieldetails)}</span>
                  </div>
                </div>

                <div class="detail-card">
                  <h3>Guidelines</h3>
                  <div class="detail-item">
                    <label>Do's:</label>
                    <span>${r(this.briefing.dos)}</span>
                  </div>
                  <div class="detail-item">
                    <label>Don'ts:</label>
                    <span>${r(this.briefing.donts)}</span>
                  </div>
                  <div class="detail-item">
                    <label>Rechtlicher Hinweis:</label>
                    <span>${r(this.briefing.rechtlicher_hinweis)}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div class="tab-pane" id="tab-notizen">
            <div class="detail-section">
              <h2>Notizen</h2>
              ${this.renderNotizen()}
            </div>
          </div>

          <div class="tab-pane" id="tab-ratings">
            <div class="detail-section">
              <h2>Bewertungen</h2>
              ${this.renderRatings()}
            </div>
          </div>
        </div>
      </div>

      <div class="detail-actions">
        ${t?'<button id="btn-edit-briefing-bottom" class="primary-btn">Briefing bearbeiten</button>':""}
        ${n?'<button id="btn-delete-briefing" class="danger-btn">Briefing löschen</button>':""}
      </div>
    `;window.setContentSafely(window.content,i)}renderNotizen(){return window.notizenSystem?window.notizenSystem.renderNotizenContainer(this.notizen,"briefing",this.briefingId):!this.notizen||this.notizen.length===0?`
        <div class="empty-state">
          <p>Keine Notizen vorhanden</p>
        </div>
      `:`<div class="notizen-container">${this.notizen.map(t=>`
      <div class="notiz-card">
        <div class="notiz-header">
          <span>${t.user_name||"Unbekannt"}</span>
          <span>${new Date(t.created_at).toLocaleDateString("de-DE")}</span>
        </div>
        <div class="notiz-content">
          <p>${window.validatorSystem?.sanitizeHtml?.(t.text)||t.text}</p>
        </div>
      </div>
    `).join("")}</div>`}renderRatings(){return window.bewertungsSystem?window.bewertungsSystem.renderBewertungenContainer(this.ratings,"briefing",this.briefingId):!this.ratings||this.ratings.length===0?`
        <div class="empty-state">
          <p>Keine Bewertungen vorhanden</p>
        </div>
      `:`<div class="ratings-container">${this.ratings.map(t=>`
      <div class="rating-card">
        <div class="rating-header">
          <span>${t.user_name||"Unbekannt"}</span>
          <span>${new Date(t.created_at).toLocaleDateString("de-DE")}</span>
        </div>
        <div class="rating-stars">
          ${Array.from({length:5},(n,a)=>`
            <span class="star ${a<t.rating?"filled":""}">★</span>
          `).join("")}
        </div>
      </div>
    `).join("")}</div>`}bindEvents(){document.addEventListener("click",e=>{e.target.classList.contains("tab-button")&&(e.preventDefault(),this.switchTab(e.target.dataset.tab))}),document.addEventListener("click",e=>{(e.target.id==="btn-edit-briefing"||e.target.id==="btn-edit-briefing-bottom")&&(e.preventDefault(),window.navigateTo(`/briefing/${this.briefingId}/edit`))}),document.addEventListener("click",async e=>{if(e.target.id==="btn-delete-briefing"){if(e.preventDefault(),!confirm("Dieses Briefing wirklich löschen?"))return;try{const{error:n}=await window.supabase.from("briefings").delete().eq("id",this.briefingId);if(n)throw n;window.dispatchEvent(new CustomEvent("entityUpdated",{detail:{entity:"briefing",action:"deleted",id:this.briefingId}})),window.navigateTo("/briefing")}catch(n){console.error("❌ Fehler beim Löschen des Briefings:",n),alert("Löschen fehlgeschlagen.")}}}),window.addEventListener("notizenUpdated",async e=>{if(e.detail.entityType==="briefing"&&e.detail.entityId===this.briefingId){this.notizen=await window.notizenSystem.loadNotizen("briefing",this.briefingId);const t=document.querySelector("#tab-notizen .detail-section");t&&(t.innerHTML=`<h2>Notizen</h2>${this.renderNotizen()}`)}}),window.addEventListener("bewertungenUpdated",async e=>{if(e.detail.entityType==="briefing"&&e.detail.entityId===this.briefingId){this.ratings=await window.bewertungsSystem.loadBewertungen("briefing",this.briefingId);const t=document.querySelector("#tab-ratings .detail-section");t&&(t.innerHTML=`<h2>Bewertungen</h2>${this.renderRatings()}`)}})}switchTab(e){document.querySelectorAll(".tab-button").forEach(a=>a.classList.remove("active")),document.querySelectorAll(".tab-pane").forEach(a=>a.classList.remove("active"));const t=document.querySelector(`[data-tab="${e}"]`),n=document.getElementById(`tab-${e}`);t&&n&&(t.classList.add("active"),n.classList.add("active"))}showNotFound(){window.setHeadline("Briefing nicht gefunden"),window.content.innerHTML=`
      <div class="error-message">
        <h2>Briefing nicht gefunden</h2>
        <p>Das angeforderte Briefing konnte nicht gefunden werden.</p>
        <button onclick="window.navigateTo('/briefing')" class="primary-btn">Zurück zur Übersicht</button>
      </div>
    `}showEditForm(){console.log("🎯 BRIEFINGDETAIL: Zeige Bearbeitungsformular"),window.setHeadline("Briefing bearbeiten");const e=window.formSystem.renderFormOnly("briefing",this.briefing);window.content.innerHTML=`
      <div class="page-header">
        <div class="page-header-left">
          <h1>Briefing bearbeiten</h1>
          <p>Bearbeiten Sie die Briefing-Informationen</p>
        </div>
        <div class="page-header-right">
          <button onclick="window.navigateTo('/briefing/${this.briefingId}')" class="secondary-btn">Zurück zu Details</button>
        </div>
      </div>
      
      <div class="form-page">
        ${e}
      </div>
    `,window.formSystem.bindFormEvents("briefing",this.briefing);const t=document.getElementById("briefing-form");t&&(t.onsubmit=async n=>{n.preventDefault(),await this.handleEditFormSubmit()})}async handleEditFormSubmit(){try{const e=document.getElementById("briefing-form"),t=new FormData(e),n={};for(const[r,i]of t.entries())if(r.includes("[]")){const s=r.replace("[]","");n[s]||(n[s]=[]),n[s].push(i)}else n[r]=i;console.log("📝 Briefing Edit Submit-Daten:",n);const a=await window.dataService.updateEntity("briefing",this.briefingId,n);a.success?(this.showSuccessMessage("Briefing erfolgreich aktualisiert!"),window.dispatchEvent(new CustomEvent("entityUpdated",{detail:{entity:"briefing",action:"updated",id:this.briefingId}})),setTimeout(()=>{window.navigateTo(`/briefing/${this.briefingId}`)},1500)):this.showErrorMessage(`Fehler beim Aktualisieren: ${a.error}`)}catch(e){console.error("❌ Fehler beim Aktualisieren des Briefings:",e),this.showErrorMessage("Ein unerwarteter Fehler ist aufgetreten.")}}showSuccessMessage(e){const t=document.createElement("div");t.className="alert alert-success",t.textContent=e;const n=document.getElementById("briefing-form");n&&(n.parentNode.insertBefore(t,n),setTimeout(()=>{t.remove()},5e3))}showErrorMessage(e){const t=document.createElement("div");t.className="alert alert-danger",t.textContent=e;const n=document.getElementById("briefing-form");n&&(n.parentNode.insertBefore(t,n),setTimeout(()=>{t.remove()},5e3))}destroy(){window.setContentSafely("")}}const ve=new ct;class ut{constructor(){this.formData={}}async init(){console.log("🎯 ANSPRECHPARTNERCREATE: Initialisiere Ansprechpartner-Erstellung"),this.showCreateForm()}showCreateForm(){console.log("🎯 ANSPRECHPARTNERCREATE: Zeige Ansprechpartner-Erstellungsformular mit FormSystem"),window.setHeadline("Neuen Ansprechpartner anlegen");const e=window.formSystem.renderFormOnly("ansprechpartner");window.content.innerHTML=`
      <div class="page-header">
        <div class="page-header-left">
          <h1>Neuen Ansprechpartner anlegen</h1>
          <p>Erstellen Sie einen neuen Ansprechpartner für das CRM</p>
        </div>
        <div class="page-header-right">
          <button onclick="window.navigateTo('/ansprechpartner')" class="secondary-btn">Zurück zur Übersicht</button>
        </div>
      </div>
      
      <div class="form-page">
        ${e}
      </div>
    `,window.formSystem.bindFormEvents("ansprechpartner",null);const t=document.getElementById("ansprechpartner-form");t&&(t.onsubmit=async n=>{n.preventDefault(),await this.handleFormSubmit()})}async handleFormSubmit(){let e="Ansprechpartner anlegen";try{console.log("🎯 ANSPRECHPARTNERCREATE: Verarbeite Formular-Submit");const t=document.querySelector('#ansprechpartner-form button[type="submit"]');t&&(e=t.innerHTML,t.innerHTML='<div class="loading-spinner"></div> Wird angelegt...',t.disabled=!0);const n=document.getElementById("ansprechpartner-form"),a=new FormData(n),r={};for(let[o,l]of a.entries())l.trim()!==""&&(r[o]?(Array.isArray(r[o])||(r[o]=[r[o]]),r[o].push(l.trim())):r[o]=l.trim());r.marke_ids&&!Array.isArray(r.marke_ids)&&(r.marke_ids=[r.marke_ids]),console.log("📤 Finale Ansprechpartner-Daten:",r);const i=window.validatorSystem.validateForm(r,{vorname:{type:"text",minLength:2,required:!0},nachname:{type:"text",minLength:2,required:!0}});if(!i.isValid){this.showValidationErrors(i.errors);return}const s=await window.dataService.createEntity("ansprechpartner",r);if(s.success)this.showSuccessMessage("Ansprechpartner erfolgreich erstellt!"),setTimeout(()=>{window.navigateTo("/ansprechpartner")},1500);else throw new Error(s.error||"Fehler beim Erstellen des Ansprechpartners")}catch(t){console.error("❌ Fehler beim Erstellen des Ansprechpartners:",t),this.showErrorMessage(t.message||"Ein unerwarteter Fehler ist aufgetreten")}finally{const t=document.querySelector('#ansprechpartner-form button[type="submit"]');t&&(t.innerHTML=e,t.disabled=!1)}}showValidationErrors(e){document.querySelectorAll(".field-error").forEach(t=>t.remove());for(const[t,n]of Object.entries(e)){const a=document.querySelector(`[name="${t}"]`);if(a){const r=document.createElement("div");r.className="field-error",r.textContent=n,r.style.color="red",r.style.fontSize="12px",r.style.marginTop="4px",a.parentNode.appendChild(r)}}}showSuccessMessage(e){const t=document.createElement("div");t.className="toast success",t.textContent=e,t.style.cssText=`
      position: fixed;
      top: 20px;
      right: 20px;
      background: #10b981;
      color: white;
      padding: 12px 20px;
      border-radius: 6px;
      z-index: 1000;
      opacity: 0;
      transition: opacity 0.3s ease;
    `,document.body.appendChild(t),setTimeout(()=>t.style.opacity="1",100),setTimeout(()=>{t.style.opacity="0",setTimeout(()=>t.remove(),300)},3e3)}showErrorMessage(e){const t=document.createElement("div");t.className="toast error",t.textContent=e,t.style.cssText=`
      position: fixed;
      top: 20px;
      right: 20px;
      background: #ef4444;
      color: white;
      padding: 12px 20px;
      border-radius: 6px;
      z-index: 1000;
      opacity: 0;
      transition: opacity 0.3s ease;
    `,document.body.appendChild(t),setTimeout(()=>t.style.opacity="1",100),setTimeout(()=>{t.style.opacity="0",setTimeout(()=>t.remove(),300)},3e3)}destroy(){console.log("🎯 ANSPRECHPARTNERCREATE: Destroy")}}const H=new ut;class ht{constructor(){this.selectedAnsprechpartner=new Set,this._boundEventListeners=new Set}async init(){window.setHeadline("Ansprechpartner Übersicht"),console.log("🎯 ANSPRECHPARTNERLIST: Initialisiere Ansprechpartner-Liste"),this.bindEvents(),await this.loadAndRender()}async render(e){const t=document.getElementById("dashboard-content");if(!t){console.error("❌ ANSPRECHPARTNERLIST: Dashboard-Content nicht gefunden");return}t.innerHTML=`
      <div class="page-header">
        <div class="page-header-left">
          <h1>Ansprechpartner</h1>
          <p>Verwalte alle Ansprechpartner von Unternehmen und Marken</p>
        </div>
        <div class="page-header-right">
          <button id="btn-ansprechpartner-new" class="primary-btn">Neuen Ansprechpartner anlegen</button>
        </div>
      </div>

      <!-- Filter Bar -->
      <div id="filter-container"></div>

      <!-- Bulk Actions -->
      <div class="bulk-actions" id="bulk-actions" style="display: none;">
        <div class="bulk-info">
          <span id="selected-count">0 ausgewählt</span>
        </div>
        <div class="bulk-buttons">
          <button id="btn-deselect-all" class="secondary-btn" style="display:none;">Auswahl aufheben</button>
          <button id="btn-delete-selected" class="danger-btn" style="display:none;">Ausgewählte löschen</button>
        </div>
      </div>

      <!-- Tabelle -->
      <div class="data-table-container">
        <table class="data-table" id="ansprechpartner-table">
          <thead>
            <tr>
              <th><input type="checkbox" id="select-all-ansprechpartner"></th>
              <th>Name</th>
              <th>Position</th>
              <th>Unternehmen</th>
              <th>Marken</th>
              <th>Email</th>
              <th>Telefon</th>
              <th>Stadt</th>
              <th>Sprache</th>
              <th>Aktionen</th>
            </tr>
          </thead>
          <tbody>
            <!-- Wird dynamisch gefüllt -->
          </tbody>
        </table>
      </div>
    `,await this.initializeFilterBar()}async initializeFilterBar(){const e=document.getElementById("filter-container");e&&await _.renderFilterBar("ansprechpartner",e,t=>this.onFiltersApplied(t),()=>this.onFiltersReset())}onFiltersApplied(e){console.log("Filter angewendet:",e),_.applyFilters("ansprechpartner",e),this.loadAndRender()}onFiltersReset(){console.log("Filter zurückgesetzt"),_.resetFilters("ansprechpartner"),this.loadAndRender()}bindEvents(){this.boundFilterResetHandler=e=>{e.target.id==="btn-filter-reset"&&this.onFiltersReset()},document.addEventListener("click",this.boundFilterResetHandler),document.addEventListener("click",e=>{e.target.id==="btn-ansprechpartner-new"&&(e.preventDefault(),window.navigateTo("/ansprechpartner/new"))}),document.addEventListener("click",e=>{if(e.target.classList.contains("table-link")&&e.target.dataset.table==="ansprechpartner"){e.preventDefault();const t=e.target.dataset.id;console.log("🎯 ANSPRECHPARTNERLIST: Navigiere zu Ansprechpartner Details:",t),window.navigateTo(`/ansprechpartner/${t}`)}}),window.addEventListener("entityUpdated",e=>{e.detail.entity==="ansprechpartner"&&this.loadAndRender()}),document.addEventListener("change",e=>{if(e.target.id==="select-all-ansprechpartner"){const t=document.querySelectorAll(".ansprechpartner-check"),n=e.target.checked;t.forEach(a=>{a.checked=n,n?this.selectedAnsprechpartner.add(a.dataset.id):this.selectedAnsprechpartner.delete(a.dataset.id)}),this.updateSelection(),console.log(`${n?"✅ Alle Ansprechpartner ausgewählt":"❌ Alle Ansprechpartner abgewählt"}: ${this.selectedAnsprechpartner.size}`)}}),document.addEventListener("change",e=>{if(e.target.classList.contains("ansprechpartner-check")){const t=e.target.dataset.id;console.log(`🔧 AnsprechpartnerList: Checkbox ${t} ${e.target.checked?"ausgewählt":"abgewählt"}`),e.target.checked?this.selectedAnsprechpartner.add(t):this.selectedAnsprechpartner.delete(t),console.log("🔧 AnsprechpartnerList: Aktuelle Auswahl:",Array.from(this.selectedAnsprechpartner)),this.updateSelection(),this.updateSelectAllCheckbox()}}),window.bulkActionSystem&&window.bulkActionSystem.registerList("ansprechpartner",this)}hasActiveFilters(){const e=_.getFilters("ansprechpartner");return Object.keys(e).length>0}updateSelection(){const e=this.selectedAnsprechpartner.size,t=document.getElementById("selected-count"),n=document.getElementById("btn-deselect-all"),a=document.getElementById("btn-delete-selected"),r=document.getElementById("bulk-actions");t&&(t.textContent=`${e} ausgewählt`),r&&(r.style.display=e>0?"flex":"none"),n&&(n.style.display=e>0?"inline-block":"none"),a&&(a.style.display=e>0?"inline-block":"none")}updateTable(e){const t=document.querySelector(".data-table tbody");if(!t)return;if(!e||e.length===0){t.innerHTML=`
        <tr>
          <td colspan="10" class="no-data">Keine Ansprechpartner gefunden</td>
        </tr>
      `;return}const n=e.map(a=>`
      <tr data-id="${a.id}">
        <td><input type="checkbox" class="ansprechpartner-check" data-id="${a.id}"></td>
        <td>
          <a href="#" class="table-link" data-table="ansprechpartner" data-id="${a.id}">
            ${window.validatorSystem.sanitizeHtml(`${a.vorname} ${a.nachname}`)}
          </a>
        </td>
        <td>${a.position?.name||"-"}</td>
        <td>${a.unternehmen?.firmenname||"-"}</td>
        <td>${a.marken?.length>0?a.marken.map(r=>r.markenname).join(", "):"-"}</td>
        <td>${a.email?`<a href="mailto:${a.email}">${a.email}</a>`:"-"}</td>
        <td>${a.telefonnummer||"-"}</td>
        <td>${a.stadt||"-"}</td>
        <td>${a.sprachen&&a.sprachen.length>0?a.sprachen.map(r=>r.name).join(", "):a.sprache?.name||"-"}</td>
        <td>
          <div class="actions-dropdown-container" data-entity-type="ansprechpartner">
            <button class="actions-toggle" aria-expanded="false" aria-label="Aktionen">
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" d="M12 6.75a.75.75 0 1 1 0-1.5.75.75 0 0 1 0 1.5ZM12 12.75a.75.75 0 1 1 0-1.5.75.75 0 0 1 0 1.5ZM12 18.75a.75.75 0 1 1 0-1.5.75.75 0 0 1 0 1.5Z" />
              </svg>
            </button>
            <div class="actions-dropdown">
              <a href="#" class="action-item" data-action="view" data-id="${a.id}">
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" class="w-5 h-5">
                  <path d="M10 12.5a2.5 2.5 0 100-5 2.5 2.5 0 000 5z" />
                  <path fill-rule="evenodd" d="M.661 10c1.743-2.372 4.761-5 9.339-5 4.578 0 7.601 2.628 9.339 5-1.738 2.372-4.761 5-9.339 5-4.578 0-7.601-2.628-9.339-5zM10 15a5 5 0 100-10 5 5 0 000 10z" clip-rule="evenodd" />
                </svg>
                Details ansehen
              </a>
              <a href="#" class="action-item" data-action="edit" data-id="${a.id}">
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" class="w-5 h-5">
                  <path d="M5.433 13.917l-1.523 1.523a.75.75 0 001.06 1.06l1.523-1.523L5.433 13.917zM11.206 6.106L13.917 3.4a.75.75 0 011.06 1.06l-2.711 2.711-.693-.693z" />
                  <path fill-rule="evenodd" d="M1.334 10.606a1.5 1.5 0 011.06-1.06l10.38-10.38a1.5 1.5 0 012.122 0l1.523 1.523a1.5 1.5 0 010 2.122l-10.38 10.38a1.5 1.5 0 01-1.06 1.06H1.334v-3.182z" clip-rule="evenodd" />
                </svg>
                Bearbeiten
              </a>
              <div class="action-separator"></div>
              <a href="#" class="action-item action-danger" data-action="delete" data-id="${a.id}">
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" class="w-5 h-5">
                  <path fill-rule="evenodd" d="M8.75 1A2.75 2.75 0 006 3.75v.443c-.795.077-1.584.176-2.368.298a.75.75 0 10.232 1.482l.175-.027c.572-.089 1.14-.19 1.706-.302A3.75 3.75 0 019.75 3h.5a3.75 3.75 0 013.657 3.234c.566.112 1.134.213 1.706.302l.175.027a.75.75 0 10.232-1.482A41.203 41.203 0 0014 4.193V3.75A2.75 2.75 0 0011.25 1h-2.5zM2.5 7.75a.75.75 0 01.75-.75h13.5a.75.75 0 010 1.5H3.25a.75.75 0 01-.75-.75zM7.25 9.75a.75.75 0 01.75-.75h4.5a.75.75 0 010 1.5H8a.75.75 0 01-.75-.75zM6 12.25a.75.75 0 01.75-.75h6.5a.75.75 0 010 1.5H6.75a.75.75 0 01-.75-.75zM4.75 14.75a.75.75 0 01.75-.75h9.5a.75.75 0 010 1.5h-9.5a.75.75 0 01-.75-.75z" clip-rule="evenodd" />
                </svg>
                Löschen
              </a>
            </div>
          </div>
        </td>
      </tr>
    `).join("");t.innerHTML=n}async loadAndRender(){try{console.log("🔄 ANSPRECHPARTNERLIST: Lade Ansprechpartner...");const e=await window.dataService.loadFilterData("ansprechpartner");await this.render(e);const t=_.getFilters("ansprechpartner");console.log("🔍 Lade Ansprechpartner mit Filter:",t);const n=await window.dataService.loadEntities("ansprechpartner",t);console.log("📊 Ansprechpartner geladen:",n?.length||0),this.updateTable(n)}catch(e){console.error("❌ ANSPRECHPARTNERLIST: Fehler beim Laden:",e);const t=document.querySelector(".data-table tbody");t&&(t.innerHTML=`
          <tr>
            <td colspan="10" class="error">Fehler beim Laden der Ansprechpartner</td>
          </tr>
        `)}}updateSelectAllCheckbox(){const e=document.getElementById("select-all-ansprechpartner"),t=document.querySelectorAll(".ansprechpartner-check");if(!e||t.length===0)return;const n=document.querySelectorAll(".ansprechpartner-check:checked"),a=n.length===t.length,r=n.length>0;e.checked=a,e.indeterminate=r&&!a}deselectAll(){this.selectedAnsprechpartner.clear(),document.querySelectorAll(".ansprechpartner-check").forEach(n=>{n.checked=!1});const t=document.getElementById("select-all-ansprechpartner");t&&(t.checked=!1,t.indeterminate=!1),this.updateSelection(),console.log("✅ Alle Ansprechpartner-Auswahlen aufgehoben")}showDeleteSelectedConfirmation(){const e=this.selectedAnsprechpartner.size;if(console.log(`🔧 AnsprechpartnerList: showDeleteSelectedConfirmation aufgerufen, selectedCount: ${e}`,Array.from(this.selectedAnsprechpartner)),e===0){alert("Keine Ansprechpartner ausgewählt.");return}const t=e===1?"Möchten Sie den ausgewählten Ansprechpartner wirklich löschen?":`Möchten Sie die ${e} ausgewählten Ansprechpartner wirklich löschen?`;confirm(`${t}

Dieser Vorgang kann nicht rückgängig gemacht werden.`)&&this.deleteSelectedAnsprechpartner()}async deleteSelectedAnsprechpartner(){const e=Array.from(this.selectedAnsprechpartner),t=e.length;console.log(`🗑️ Lösche ${t} Ansprechpartner...`);let n=0,a=0;const r=[];for(const s of e)try{const o=await window.dataService.deleteEntity("ansprechpartner",s);o.success?(n++,console.log(`✅ Ansprechpartner ${s} gelöscht`)):(a++,r.push(`Ansprechpartner ${s}: ${o.error}`),console.error(`❌ Fehler beim Löschen von Ansprechpartner ${s}:`,o.error))}catch(o){a++,r.push(`Ansprechpartner ${s}: ${o.message}`),console.error(`❌ Unerwarteter Fehler beim Löschen von Ansprechpartner ${s}:`,o)}let i="";n>0&&(i+=`✅ ${n} Ansprechpartner erfolgreich gelöscht.`),a>0&&(i+=`
❌ ${a} Ansprechpartner konnten nicht gelöscht werden.`,r.length>0&&(i+=`

Fehler:
${r.join(`
`)}`)),alert(i),this.deselectAll(),await this.loadAndRender(),window.dispatchEvent(new CustomEvent("entityUpdated",{detail:{entity:"ansprechpartner",action:"bulk-deleted",count:n}}))}showCreateForm(){console.log("🎯 Zeige Ansprechpartner-Erstellungsformular mit AnsprechpartnerCreate"),H.showCreateForm()}destroy(){console.log("AnsprechpartnerList: Cleaning up..."),this.boundFilterResetHandler&&document.removeEventListener("click",this.boundFilterResetHandler)}}const we=new ht;class mt{constructor(){this.ansprechpartner=null,this.ansprechpartnerId=null,this.formConfig=null,this.formRenderer=null,this.dataLoader=null,this.formSystem=null,this.notizen=[],this.ratings=[]}async init(e){if(this.ansprechpartnerId=e,console.log("🎯 ANSPRECHPARTNERDETAIL: Initialisiere Detail-Seite für:",e),e==="new"){console.log("🎯 ANSPRECHPARTNERDETAIL: Verwende AnsprechpartnerCreate für neuen Ansprechpartner"),H.showCreateForm();return}else await this.loadAnsprechpartnerData(),this.render(),this.bindEvents()}async loadAnsprechpartnerData(){try{console.log("🔄 ANSPRECHPARTNERDETAIL: Lade Ansprechpartner-Daten...");const{data:e,error:t}=await window.supabase.from("ansprechpartner").select(`
          *,
          unternehmen:unternehmen_id (
            id,
            firmenname
          ),
          ansprechpartner_marke (
            marke:marke_id (
              id,
              markenname
            )
          ),
          ansprechpartner_kampagne (
            kampagne:kampagne_id (
              id,
              kampagnenname
            )
          )
        `).eq("id",this.ansprechpartnerId).single();if(t){console.error("❌ ANSPRECHPARTNERDETAIL: Fehler beim Laden:",t),this.showError("Ansprechpartner konnte nicht geladen werden.");return}this.ansprechpartner=e,console.log("✅ ANSPRECHPARTNERDETAIL: Ansprechpartner geladen:",this.ansprechpartner),window.notizenSystem&&(this.notizen=await window.notizenSystem.loadNotizen("ansprechpartner",this.ansprechpartnerId),console.log("✅ ANSPRECHPARTNERDETAIL: Notizen geladen:",this.notizen.length)),window.bewertungsSystem&&(this.ratings=await window.bewertungsSystem.loadBewertungen("ansprechpartner",this.ansprechpartnerId),console.log("✅ ANSPRECHPARTNERDETAIL: Ratings geladen:",this.ratings.length))}catch(e){console.error("❌ ANSPRECHPARTNERDETAIL: Unerwarteter Fehler:",e),this.showError("Ein unerwarteter Fehler ist aufgetreten.")}}render(){if(!this.ansprechpartner){this.showError("Ansprechpartner nicht gefunden.");return}window.setHeadline(`${this.ansprechpartner.vorname} ${this.ansprechpartner.nachname} - Details`);const e=document.getElementById("dashboard-content");e&&(e.innerHTML=`
      <div class="page-header">
        <div class="page-header-left">
          <h1>${this.ansprechpartner.vorname} ${this.ansprechpartner.nachname} - Details</h1>
          <p>Detaillierte Informationen zum Ansprechpartner</p>
        </div>
        <div class="page-header-right">
          <button class="secondary-btn" id="btn-edit">
            <i class="icon-edit"></i>
            Ansprechpartner bearbeiten
          </button>
          <button class="secondary-btn" id="btn-back">
            Zurück zur Übersicht
          </button>
        </div>
      </div>

      <div class="content-section">
        <!-- Tab-Navigation -->
        <div class="tab-navigation">
          <button class="tab-button active" data-tab="informationen">
            Informationen
            <span class="tab-count">1</span>
          </button>
          <button class="tab-button" data-tab="notizen">
            Notizen
            <span class="tab-count">${this.notizen?this.notizen.length:0}</span>
          </button>
          <button class="tab-button" data-tab="bewertungen">
            Bewertungen
            <span class="tab-count">${this.ratings?this.ratings.length:0}</span>
          </button>
          <button class="tab-button" data-tab="marken">
            Zugeordnete Marken
            <span class="tab-count">${this.ansprechpartner.ansprechpartner_marke?this.ansprechpartner.ansprechpartner_marke.length:0}</span>
          </button>
          <button class="tab-button" data-tab="kampagnen">
            Zugeordnete Kampagnen
            <span class="tab-count">${this.ansprechpartner.ansprechpartner_kampagne?this.ansprechpartner.ansprechpartner_kampagne.length:0}</span>
          </button>
        </div>

        <!-- Tab-Content -->
        <div class="tab-content">
          <!-- Informationen Tab -->
          <div class="tab-pane active" id="informationen">
            ${this.renderInformationen()}
          </div>

          <!-- Notizen Tab -->
          <div class="tab-pane" id="notizen">
            ${this.renderNotizen()}
          </div>

          <!-- Bewertungen Tab -->
          <div class="tab-pane" id="bewertungen">
            ${this.renderBewertungen()}
          </div>

          <!-- Marken Tab -->
          <div class="tab-pane" id="marken">
            ${this.renderMarken()}
          </div>

          <!-- Kampagnen Tab -->
          <div class="tab-pane" id="kampagnen">
            ${this.renderKampagnen()}
          </div>
        </div>
      </div>
    `)}renderInformationen(){return`
      <div class="detail-section">
        <div class="detail-grid">
          <!-- Kontaktinformationen -->
          <div class="detail-card">
            <h3>Kontaktinformationen</h3>
            <div class="detail-item">
              <label>Name:</label>
              <span>${this.ansprechpartner.vorname} ${this.ansprechpartner.nachname}</span>
            </div>
            <div class="detail-item">
              <label>Position:</label>
              <span>${this.ansprechpartner.position||"-"}</span>
            </div>
            <div class="detail-item">
              <label>Email:</label>
              <span>${this.ansprechpartner.email?`<a href="mailto:${this.ansprechpartner.email}">${this.ansprechpartner.email}</a>`:"-"}</span>
            </div>
            <div class="detail-item">
              <label>Telefon (Mobil):</label>
              <span>${this.ansprechpartner.telefonnummer?`<a href="tel:${this.ansprechpartner.telefonnummer}">${this.ansprechpartner.telefonnummer}</a>`:"-"}</span>
            </div>
            <div class="detail-item">
              <label>Telefon (Büro):</label>
              <span>${this.ansprechpartner.telefonnummer_office?`<a href="tel:${this.ansprechpartner.telefonnummer_office}">${this.ansprechpartner.telefonnummer_office}</a>`:"-"}</span>
            </div>
            <div class="detail-item">
              <label>LinkedIn:</label>
              <span>${this.ansprechpartner.linkedin?`<a href="${this.ansprechpartner.linkedin}" target="_blank" rel="noopener noreferrer">${this.ansprechpartner.linkedin}</a>`:"-"}</span>
            </div>
          </div>

          <!-- Standort & Sprache -->
          <div class="detail-card">
            <h3>Standort & Sprache</h3>
            <div class="detail-item">
              <label>Stadt:</label>
              <span>${this.ansprechpartner.stadt||"-"}</span>
            </div>
            <div class="detail-item">
              <label>Sprache:</label>
              <span>${this.ansprechpartner.sprachen&&this.ansprechpartner.sprachen.length>0?this.ansprechpartner.sprachen.map(e=>e.name).join(", "):this.ansprechpartner.sprache?.name||this.ansprechpartner.sprache||"-"}</span>
            </div>
          </div>

          <!-- Unternehmen -->
          <div class="detail-card">
            <h3>Unternehmen</h3>
            <div class="detail-item">
              <label>Unternehmen:</label>
              <span>
                ${this.ansprechpartner.unternehmen?`<a href="#" class="table-link" data-table="unternehmen" data-id="${this.ansprechpartner.unternehmen.id}">${this.ansprechpartner.unternehmen.firmenname}</a>`:"-"}
              </span>
            </div>
            <div class="detail-item">
              <label>Erstellt am:</label>
              <span>${this.ansprechpartner.created_at?new Date(this.ansprechpartner.created_at).toLocaleDateString("de-DE"):"-"}</span>
            </div>
            <div class="detail-item">
              <label>Zuletzt aktualisiert:</label>
              <span>${this.ansprechpartner.updated_at?new Date(this.ansprechpartner.updated_at).toLocaleDateString("de-DE"):"-"}</span>
            </div>
          </div>

          <!-- Notizen (falls vorhanden) -->
          ${this.ansprechpartner.notiz?`
          <div class="detail-card full-width">
            <h3>Notizen</h3>
            <div class="detail-item">
              <p class="notiz-text">${this.ansprechpartner.notiz}</p>
            </div>
          </div>
          `:""}
        </div>
      </div>
    `}renderNotizen(){return window.notizenSystem?window.notizenSystem.renderNotizenContainer(this.notizen,"ansprechpartner",this.ansprechpartnerId):"<p>Notizen-System nicht verfügbar</p>"}renderBewertungen(){return window.bewertungsSystem?window.bewertungsSystem.renderBewertungenContainer(this.ratings,"ansprechpartner",this.ansprechpartnerId):"<p>Bewertungs-System nicht verfügbar</p>"}renderMarken(){return!this.ansprechpartner.ansprechpartner_marke||this.ansprechpartner.ansprechpartner_marke.length===0?`
        <div class="empty-state">
          <div class="empty-icon">🏷️</div>
          <h3>Keine Marken zugeordnet</h3>
          <p>Diesem Ansprechpartner sind noch keine Marken zugeordnet.</p>
        </div>
      `:`
      <div class="marken-container">
        ${this.ansprechpartner.ansprechpartner_marke.map(t=>{const n=t.marke;return`
        <div class="marke-card">
          <div class="marke-header">
            <h4>
              <a href="#" class="table-link" data-table="marke" data-id="${n.id}">
                ${n.markenname}
              </a>
            </h4>
          </div>
          <div class="marke-details">
            <p><strong>Unternehmen:</strong> ${n.unternehmen?.firmenname||"-"}</p>
            <p><strong>Webseite:</strong> ${n.webseite?`<a href="${n.webseite}" target="_blank">${n.webseite}</a>`:"-"}</p>
          </div>
        </div>
      `}).join("")}
      </div>
    `}renderKampagnen(){return!this.ansprechpartner.ansprechpartner_kampagne||this.ansprechpartner.ansprechpartner_kampagne.length===0?`
        <div class="empty-state">
          <div class="empty-icon">📢</div>
          <h3>Keine Kampagnen zugeordnet</h3>
          <p>Diesem Ansprechpartner sind noch keine Kampagnen zugeordnet.</p>
        </div>
      `:`
      <div class="kampagnen-container">
        ${this.ansprechpartner.ansprechpartner_kampagne.map(t=>{const n=t.kampagne;return`
        <div class="kampagne-card">
          <div class="kampagne-header">
            <h4>
              <a href="#" class="table-link" data-table="kampagne" data-id="${n.id}">
                ${n.kampagnenname}
              </a>
            </h4>
            <span class="kampagne-status status-${n.status?.toLowerCase()||"unknown"}">
              ${n.status||"Unbekannt"}
            </span>
          </div>
          <div class="kampagne-details">
            <p><strong>Beschreibung:</strong> ${n.beschreibung||"-"}</p>
            <p><strong>Start:</strong> ${n.start?new Date(n.start).toLocaleDateString("de-DE"):"-"}</p>
            <p><strong>Deadline:</strong> ${n.deadline?new Date(n.deadline).toLocaleDateString("de-DE"):"-"}</p>
          </div>
        </div>
      `}).join("")}
      </div>
    `}renderMarkenList(){return!this.ansprechpartner.ansprechpartner_marke||this.ansprechpartner.ansprechpartner_marke.length===0?'<p class="empty-state">Keine Marken zugeordnet.</p>':`<div class="tag-list">${this.ansprechpartner.ansprechpartner_marke.map(t=>{const n=t.marke;return`
        <div class="tag-item">
          <a href="#" class="table-link" data-table="marke" data-id="${n.id}">
            ${n.markenname}
          </a>
        </div>
      `}).join("")}</div>`}renderKampagnenList(){return!this.ansprechpartner.ansprechpartner_kampagne||this.ansprechpartner.ansprechpartner_kampagne.length===0?'<p class="empty-state">Keine Kampagnen zugeordnet.</p>':`<div class="tag-list">${this.ansprechpartner.ansprechpartner_kampagne.map(t=>{const n=t.kampagne;return`
        <div class="tag-item">
          <a href="#" class="table-link" data-table="kampagne" data-id="${n.id}">
            ${n.kampagnenname}
          </a>
        </div>
      `}).join("")}</div>`}bindEvents(){document.addEventListener("click",e=>{if(e.target.classList.contains("tab-button")){const t=e.target.dataset.tab;this.switchTab(t)}}),document.addEventListener("click",e=>{(e.target.id==="btn-back"||e.target.closest("#btn-back"))&&(e.preventDefault(),window.navigateTo("/ansprechpartner"))}),document.addEventListener("click",e=>{(e.target.id==="btn-edit"||e.target.closest("#btn-edit"))&&(e.preventDefault(),window.navigateTo(`/ansprechpartner/${this.ansprechpartnerId}/edit`))}),document.addEventListener("click",e=>{if(e.target.classList.contains("table-link")){e.preventDefault();const t=e.target.dataset.table,n=e.target.dataset.id;window.navigateTo(`/${t}/${n}`)}}),document.addEventListener("notizenUpdated",()=>{this.loadAnsprechpartnerData().then(()=>{this.render(),this.bindEvents()})}),document.addEventListener("bewertungenUpdated",()=>{this.loadAnsprechpartnerData().then(()=>{this.render(),this.bindEvents()})})}switchTab(e){document.querySelectorAll(".tab-button").forEach(a=>{a.classList.remove("active")}),document.querySelectorAll(".tab-pane").forEach(a=>{a.classList.remove("active")});const t=document.querySelector(`[data-tab="${e}"]`),n=document.getElementById(e);t&&t.classList.add("active"),n&&n.classList.add("active")}async renderCreateForm(){window.setHeadline("Neuen Ansprechpartner anlegen");const e=document.getElementById("dashboard-content");if(!e)return;const t=new O;if(this.formConfig=t.getFormConfig("ansprechpartner"),!this.formConfig){console.error("❌ Keine FormConfig für ansprechpartner gefunden"),this.showError("Formular-Konfiguration nicht gefunden.");return}this.formSystem=new de,this.formRenderer=this.formSystem.renderer,console.log("🎯 ANSPRECHPARTNERDETAIL: Rendere Formular..."),e.innerHTML=`
      <div class="page-header">
        <div class="page-header-left">
          <h1>${this.formConfig.title}</h1>
          <p>Erfasse die Daten für einen neuen Ansprechpartner</p>
        </div>
      </div>

      <div class="form-container">
        <div id="form-content">Lade Formular...</div>
      </div>
    `;try{const n=this.formRenderer.renderFormOnly("ansprechpartner");document.getElementById("form-content").innerHTML=n;const a=document.querySelector("#ansprechpartner-form .btn-secondary"),r=document.querySelector("#ansprechpartner-form .btn-primary");a&&(a.className="secondary-btn",a.id="btn-cancel-form"),r&&(r.className="action-btn",r.textContent="Ansprechpartner erstellen");const i=document.getElementById("ansprechpartner-form");i&&await this.formSystem.dataLoader.loadDynamicFormData("ansprechpartner",i),this.initializeSearchableSelects(),this.bindFormSubmitEvents(),console.log("✅ ANSPRECHPARTNERDETAIL: Formular erfolgreich geladen")}catch(n){console.error("❌ ANSPRECHPARTNERDETAIL: Fehler beim Laden des Formulars:",n),document.getElementById("form-content").innerHTML=`
        <div class="error-message">
          <p>Fehler beim Laden des Formulars: ${n.message}</p>
        </div>
      `}}bindFormEvents(){}initializeSearchableSelects(){console.log("🎯 ANSPRECHPARTNERDETAIL: Initialisiere Searchable Selects...");const e=document.getElementById("ansprechpartner-form");e&&this.formSystem.initializeSearchableSelects(e)}setupMarkenFiltering(){const e=document.querySelector('select[name="unternehmen_id"]'),t=document.querySelector('select[name="marke_ids"]');e&&t&&(console.log("🔗 ANSPRECHPARTNERDETAIL: Setup Marken-Filterung"),e.addEventListener("change",async n=>{const a=n.target.value;console.log("🏢 ANSPRECHPARTNERDETAIL: Unternehmen geändert:",a),a?await this.loadMarkenForUnternehmen(a,t):await this.loadAllMarken(t)}))}async loadMarkenForUnternehmen(e,t){try{console.log("🔄 ANSPRECHPARTNERDETAIL: Lade Marken für Unternehmen:",e);const{data:n,error:a}=await window.supabase.from("marke").select("id, markenname").eq("unternehmen_id",e).order("markenname");!a&&n?(console.log("✅ ANSPRECHPARTNERDETAIL: Marken geladen:",n.length),this.updateMarkenOptions(t,n)):console.error("❌ ANSPRECHPARTNERDETAIL: Fehler beim Laden der Marken:",a)}catch(n){console.error("❌ ANSPRECHPARTNERDETAIL: Unerwarteter Fehler beim Laden der Marken:",n)}}async loadAllMarken(e){try{console.log("🔄 ANSPRECHPARTNERDETAIL: Lade alle Marken");const{data:t,error:n}=await window.supabase.from("marke").select("id, markenname").order("markenname");!n&&t&&(console.log("✅ ANSPRECHPARTNERDETAIL: Alle Marken geladen:",t.length),this.updateMarkenOptions(e,t))}catch(t){console.error("❌ ANSPRECHPARTNERDETAIL: Fehler beim Laden aller Marken:",t)}}updateMarkenOptions(e,t){for(;e.options.length>1;)e.removeChild(e.lastChild);t.forEach(a=>{const r=document.createElement("option");r.value=a.id,r.textContent=a.markenname,e.appendChild(r)});const n=e.parentNode.querySelector(".searchable-select-container");if(n){n.remove(),e.style.display="";const a=t.map(r=>({value:r.id,label:r.markenname}));this.formSystem.createSearchableSelect(e,a,{placeholder:"Marken suchen und auswählen..."})}console.log("✅ ANSPRECHPARTNERDETAIL: Marken-Optionen aktualisiert")}bindFormSubmitEvents(){const e=document.getElementById("ansprechpartner-form");e?e.addEventListener("submit",async t=>{t.preventDefault(),console.log("📤 ANSPRECHPARTNERDETAIL: Formular wird abgesendet...");const n=new FormData(e),a={};for(const[i,s]of n.entries())s&&s.trim()!==""&&(a[i]=s.trim());const r=e.querySelector('select[name="marke_ids"]');if(r&&r.multiple){const i=Array.from(r.selectedOptions);i.length>0&&(a.marke_ids=i.map(s=>s.value))}console.log("📊 ANSPRECHPARTNERDETAIL: Gesammelte Daten:",a);try{await this.handleFormSubmit(a)}catch(i){console.error("❌ ANSPRECHPARTNERDETAIL: Fehler beim Submit:",i),alert("Fehler beim Speichern: "+i.message)}}):console.warn("⚠️ ANSPRECHPARTNERDETAIL: Formular nicht gefunden")}async handleFormSubmit(e){try{console.log("📤 ANSPRECHPARTNERDETAIL: Sende Daten:",e);const t=e.marke_ids||[],n={...e};delete n.marke_ids,n.sprache_id||delete n.sprache_id,n.unternehmen_id||delete n.unternehmen_id,n.position_id||delete n.position_id;const{data:a,error:r}=await window.supabase.from("ansprechpartner").insert([n]).select().single();if(r)throw console.error("❌ ANSPRECHPARTNERDETAIL: Fehler beim Speichern:",r),new Error("Fehler beim Speichern: "+r.message);if(console.log("✅ ANSPRECHPARTNERDETAIL: Ansprechpartner erfolgreich erstellt:",a),t.length>0){const i=t.map(o=>({ansprechpartner_id:a.id,marke_id:o})),{error:s}=await window.supabase.from("ansprechpartner_marke").insert(i);s?console.error("❌ ANSPRECHPARTNERDETAIL: Fehler beim Zuordnen der Marken:",s):console.log("✅ ANSPRECHPARTNERDETAIL: Marken-Zuordnungen erstellt:",i)}window.dispatchEvent(new CustomEvent("entityUpdated",{detail:{entity:"ansprechpartner",action:"created",id:a.id}})),window.navigateTo(`/ansprechpartner/${a.id}`)}catch(t){throw console.error("❌ ANSPRECHPARTNERDETAIL: Unerwarteter Fehler:",t),t}}showError(e){const t=document.getElementById("dashboard-content");t&&(t.innerHTML=`
      <div class="page-header">
        <div class="page-title">
          <h1>Fehler</h1>
        </div>
        <div class="page-actions">
          <button class="secondary-btn" id="btn-back-error">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="w-5 h-5">
              <path stroke-linecap="round" stroke-linejoin="round" d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18" />
            </svg>
            Zurück zur Liste
          </button>
        </div>
      </div>
      <div class="error-message">
        <p>${e}</p>
      </div>
    `,document.addEventListener("click",n=>{(n.target.id==="btn-back-error"||n.target.closest("#btn-back-error"))&&(n.preventDefault(),window.navigateTo("/ansprechpartner"))}))}showEditForm(){console.log("🎯 ANSPRECHPARTNERDETAIL: Zeige Bearbeitungsformular"),window.setHeadline("Ansprechpartner bearbeiten");const e=window.formSystem.renderFormOnly("ansprechpartner",this.ansprechpartner);window.content.innerHTML=`
      <div class="page-header">
        <div class="page-header-left">
          <h1>Ansprechpartner bearbeiten</h1>
          <p>Bearbeiten Sie die Informationen von ${this.ansprechpartner.vorname} ${this.ansprechpartner.nachname}</p>
        </div>
        <div class="page-header-right">
          <button onclick="window.navigateTo('/ansprechpartner/${this.ansprechpartnerId}')" class="secondary-btn">Zurück zu Details</button>
        </div>
      </div>
      
      <div class="form-page">
        ${e}
      </div>
    `,window.formSystem.bindFormEvents("ansprechpartner",this.ansprechpartner);const t=document.getElementById("ansprechpartner-form");t&&(t.onsubmit=async n=>{n.preventDefault(),await this.handleEditFormSubmit()})}async handleEditFormSubmit(){try{const e=document.getElementById("ansprechpartner-form"),t=new FormData(e),n={};for(const[r,i]of t.entries())if(r.includes("[]")){const s=r.replace("[]","");n[s]||(n[s]=[]),n[s].push(i)}else n[r]=i;console.log("📝 Ansprechpartner Edit Submit-Daten:",n);const a=await window.dataService.updateEntity("ansprechpartner",this.ansprechpartnerId,n);a.success?(this.showSuccessMessage("Ansprechpartner erfolgreich aktualisiert!"),window.dispatchEvent(new CustomEvent("entityUpdated",{detail:{entity:"ansprechpartner",action:"updated",id:this.ansprechpartnerId}})),setTimeout(()=>{window.navigateTo(`/ansprechpartner/${this.ansprechpartnerId}`)},1500)):this.showErrorMessage(`Fehler beim Aktualisieren: ${a.error}`)}catch(e){console.error("❌ Fehler beim Aktualisieren des Ansprechpartners:",e),this.showErrorMessage("Ein unerwarteter Fehler ist aufgetreten.")}}showSuccessMessage(e){const t=document.createElement("div");t.className="alert alert-success",t.textContent=e;const n=document.getElementById("ansprechpartner-form");n&&(n.parentNode.insertBefore(t,n),setTimeout(()=>{t.remove()},5e3))}showErrorMessage(e){const t=document.createElement("div");t.className="alert alert-danger",t.textContent=e;const n=document.getElementById("ansprechpartner-form");n&&(n.parentNode.insertBefore(t,n),setTimeout(()=>{t.remove()},5e3))}destroy(){console.log("AnsprechpartnerDetail: Cleaning up..."),this.ansprechpartner=null,this.ansprechpartnerId=null}}const ke=new mt;class pt{constructor(){this.selectedRechnungen=new Set}async init(){window.setHeadline("Rechnungen"),await this.loadAndRender(),window.addEventListener("entityUpdated",e=>{e?.detail?.entity==="rechnung"&&this.loadAndRender()}),document.addEventListener("click",e=>{e.target&&e.target.id==="btn-rechnung-new"&&(e.preventDefault(),this.showCreateForm())})}async loadAndRender(){try{const e=await window.dataService.loadFilterData("rechnung");await this.render(e),await this.initializeFilterBar();const t=_.getFilters("rechnung"),n=window.currentUser?.rolle==="admin";let a=[],r=[];if(!n&&window.supabase)try{const{data:s}=await window.supabase.from("kampagne_mitarbeiter").select("kampagne_id").eq("mitarbeiter_id",window.currentUser?.id),o=(s||[]).map(u=>u.kampagne_id).filter(Boolean),{data:l}=await window.supabase.from("marke_mitarbeiter").select("marke_id").eq("mitarbeiter_id",window.currentUser?.id),c=(l||[]).map(u=>u.marke_id).filter(Boolean);let d=[];if(c.length>0){const{data:u}=await window.supabase.from("kampagne").select("id").in("marke_id",c);d=(u||[]).map(h=>h.id).filter(Boolean)}if(a=[...new Set([...o,...d])],a.length>0){const{data:u}=await window.supabase.from("kooperationen").select("id").in("kampagne_id",a);r=(u||[]).map(h=>h.id)}console.log(`🔍 RECHNUNGLIST: Mitarbeiter ${window.currentUser?.id} hat Zugriff auf:`,{direkteKampagnen:o.length,markenKampagnen:d.length,gesamtKampagnen:a.length,kooperationen:r.length})}catch(s){console.error("❌ Fehler beim Laden der Zuordnungen:",s)}let i;if(!n&&(a.length||r.length)){const s={...t};i=await window.dataService.loadEntities("rechnung",s),i=(i||[]).filter(o=>o.kampagne_id&&a.includes(o.kampagne_id)||o.kooperation_id&&r.includes(o.kooperation_id))}else i=await window.dataService.loadEntities("rechnung",t);this.updateTable(i)}catch(e){window.ErrorHandler?.handle?.(e,"RechnungList.loadAndRender")}}async render(){const e=`
      <div class="page-header">
        <div class="page-header-left">
          <h1>Rechnungen</h1>
          <p>Alle Rechnungen im Überblick</p>
        </div>
        <div class="page-header-right">
          <button id="btn-rechnung-new" class="primary-btn">Neue Rechnung anlegen</button>
        </div>
      </div>

      <div class="filter-bar">
        <div class="filter-left">
          <div id="filter-container"></div>
        </div>
        <div class="filter-right">
          <button id="btn-filter-reset" class="secondary-btn" style="display:${this.hasActiveFilters()?"inline-block":"none"};">Filter zurücksetzen</button>
        </div>
      </div>

      <div class="table-actions">
        <div class="table-actions-left">
          <button id="btn-select-all" class="secondary-btn">Alle auswählen</button>
          <button id="btn-deselect-all" class="secondary-btn" style="display:none;">Auswahl aufheben</button>
        </div>
        <div class="table-actions-right">
          <span id="selected-count" style="display:none;">0 ausgewählt</span>
          <button id="btn-delete-selected" class="danger-btn" style="display:none;">Ausgewählte löschen</button>
        </div>
      </div>

      <div class="data-table-container">
        <table class="data-table">
          <thead>
            <tr>
              <th><input type="checkbox" id="select-all-rechnungen"></th>
              <th>Rechnungs-Nr</th>
              <th>Unternehmen</th>
              <th>Auftrag</th>
              <th>Creator</th>
              <th>Gestellt am</th>
              <th>Zahlungsziel</th>
              <th>Status</th>
              <th>Nettobetrag</th>
              <th>Bruttobetrag</th>
              <th>Beleg</th>
              <th>Aktionen</th>
            </tr>
          </thead>
          <tbody id="rechnungen-table-body">
            <tr>
              <td colspan="9" class="loading">Lade Rechnungen...</td>
            </tr>
          </tbody>
        </table>
      </div>
    `;window.setContentSafely(window.content,e)}async initializeFilterBar(){const e=document.getElementById("filter-container");e&&await _.renderFilterBar("rechnung",e,t=>this.onFiltersApplied(t),()=>this.onFiltersReset())}onFiltersApplied(e){_.applyFilters("rechnung",e),this.loadAndRender()}onFiltersReset(){_.resetFilters("rechnung"),this.loadAndRender()}hasActiveFilters(){const e=_.getFilters("rechnung");return Object.keys(e).length>0}async updateTable(e){const t=document.getElementById("rechnungen-table-body");if(!t)return;if(!e||e.length===0){const{renderEmptyState:s}=await B(async()=>{const{renderEmptyState:o}=await import("./core-C7Vz5Umf.js").then(l=>l.F);return{renderEmptyState:o}},[]);s(t);return}const n=s=>s==null?"-":new Intl.NumberFormat("de-DE",{style:"currency",currency:"EUR"}).format(s),a=s=>s?new Intl.DateTimeFormat("de-DE").format(new Date(s)):"-",r=e.map(s=>`
      <tr data-id="${s.id}">
        <td><input type="checkbox" class="rechnung-check" data-id="${s.id}"></td>
        <td>${s.rechnung_nr||"-"}</td>
        <td>${s.unternehmen?.firmenname||"-"}</td>
        <td>${s.auftrag?.auftragsname||"-"}</td>
        <td>${[s.creator?.vorname,s.creator?.nachname].filter(Boolean).join(" ")||"-"}</td>
        <td>${a(s.gestellt_am)}</td>
        <td>${a(s.zahlungsziel)}</td>
        <td>${s.status||"-"}</td>
        <td>${n(s.nettobetrag)}</td>
        <td>${n(s.bruttobetrag)}</td>
        <td>${s.pdf_url?`<a href="${s.pdf_url}" target="_blank" rel="noopener noreferrer">PDF</a>`:"-"}</td>
        <td>
          <div class="actions-dropdown-container" data-entity-type="rechnung">
            <button class="actions-toggle" aria-expanded="false" aria-label="Aktionen">
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" class="w-5 h-5">
                <path d="M10 3a1.5 1.5 0 110 3 1.5 1.5 0 010-3zM10 8.5a1.5 1.5 0 110 3 1.5 1.5 0 010-3zM11.5 15.5a1.5 1.5 0 10-3 0 1.5 1.5 0 003 0z" />
              </svg>
            </button>
            <div class="actions-dropdown">
              <div class="action-submenu">
                <a href="#" class="action-item has-submenu" data-submenu="status">${L.getHeroIcon("invoice")}<span>Status ändern</span></a>
                <div class="submenu" data-submenu="status">
                  ${[{label:"Offen",icon:"status-offen"},{label:"Rückfrage",icon:"status-rueckfrage"},{label:"Bezahlt",icon:"status-bezahlt"},{label:"An Qonto gesendet",icon:"status-qonto"}].map(o=>`
                    <a href="#" class="submenu-item" data-action="set-field" data-field="status" data-value="${o.label}" data-id="${s.id}">
                      ${L.getHeroIcon(o.icon)}
                      <span>${o.label}</span>
                      ${s.status===o.label?'<span class="submenu-check">'+L.getHeroIcon("check")+"</span>":""}
                    </a>
                  `).join("")}
                </div>
              </div>
              <a href="#" class="action-item" data-action="view" data-id="${s.id}">Details ansehen</a>
              <a href="#" class="action-item" data-action="edit" data-id="${s.id}">Bearbeiten</a>
              <div class="action-separator"></div>
              <a href="#" class="action-item action-danger" data-action="delete" data-id="${s.id}">Löschen</a>
            </div>
          </div>
        </td>
      </tr>
    `).join("");t.innerHTML=r,document.querySelectorAll(".rechnung-check").forEach(s=>{s.addEventListener("change",o=>{const l=o.target.dataset.id;o.target.checked?this.selectedRechnungen.add(l):this.selectedRechnungen.delete(l),this.updateSelectionUI(),this.updateHeaderSelectAll()})});const i=document.getElementById("select-all-rechnungen");i&&i.addEventListener("change",s=>{const o=s.target.checked;document.querySelectorAll(".rechnung-check").forEach(l=>{l.checked=o,o?this.selectedRechnungen.add(l.dataset.id):this.selectedRechnungen.delete(l.dataset.id)}),this.updateSelectionUI()}),document.getElementById("btn-select-all")?.addEventListener("click",s=>{s.preventDefault(),document.querySelectorAll(".rechnung-check").forEach(l=>{l.checked=!0,this.selectedRechnungen.add(l.dataset.id)});const o=document.getElementById("select-all-rechnungen");o&&(o.indeterminate=!1,o.checked=!0),this.updateSelectionUI()}),document.getElementById("btn-deselect-all")?.addEventListener("click",s=>{s.preventDefault(),document.querySelectorAll(".rechnung-check").forEach(l=>{l.checked=!1}),this.selectedRechnungen.clear();const o=document.getElementById("select-all-rechnungen");o&&(o.indeterminate=!1,o.checked=!1),this.updateSelectionUI()}),document.getElementById("btn-delete-selected")?.addEventListener("click",async s=>{s.preventDefault(),await this.deleteSelected()})}updateHeaderSelectAll(){const e=document.getElementById("select-all-rechnungen"),t=document.querySelectorAll(".rechnung-check");if(!e||t.length===0)return;const n=document.querySelectorAll(".rechnung-check:checked").length;e.checked=n===t.length,e.indeterminate=n>0&&n<t.length}updateSelectionUI(){const e=this.selectedRechnungen.size,t=document.getElementById("selected-count"),n=document.getElementById("btn-deselect-all"),a=document.getElementById("btn-delete-selected");t&&(t.textContent=`${e} ausgewählt`,t.style.display=e>0?"inline":"none"),n&&(n.style.display=e>0?"inline-block":"none"),a&&(a.style.display=e>0?"inline-block":"none")}async deleteSelected(){const e=Array.from(this.selectedRechnungen);if(e.length===0||!confirm(e.length===1?"Ausgewählte Rechnung löschen?":`${e.length} Rechnungen löschen?`))return;let n=0,a=0;for(const r of e)try{(await window.dataService.deleteEntity("rechnung",r)).success?n++:a++}catch{a++}alert(`Löschvorgang abgeschlossen: ${n} erfolgreich${a?`, ${a} fehlgeschlagen`:""}.`),this.selectedRechnungen.clear(),await this.loadAndRender()}showCreateForm(){window.navigateTo("/rechnung/new")}}const gt=new pt;class ft{constructor(){this.id=null,this.data=null,this.belege=[]}async init(e){if(this.id=e,e==="new")return this.showCreateForm();await this.load(),this.render(),this.bindEvents()}async load(){const{data:e,error:t}=await window.supabase.from("rechnung").select(`*,
        unternehmen:unternehmen_id(id, firmenname),
        auftrag:auftrag_id(id, auftragsname)
      `).eq("id",this.id).single();if(t)throw t;this.data=e;try{const{data:n}=await window.supabase.from("rechnung_belege").select("id, file_name, file_path, file_url, content_type, size, uploaded_at, uploaded_by").eq("rechnung_id",this.id).order("uploaded_at",{ascending:!1}),a="rechnung-belege",r=[];for(const i of n||[]){let s=i.file_url||"";try{const{data:o}=await window.supabase.storage.from(a).createSignedUrl(i.file_path,3600);o?.signedUrl&&(s=o.signedUrl)}catch{}r.push({...i,open_url:s})}this.belege=r}catch{this.belege=[]}}render(){window.setHeadline(`Rechnung ${this.data?.rechnung_nr||""}`);const e=a=>a==null?"-":new Intl.NumberFormat("de-DE",{style:"currency",currency:"EUR"}).format(a),t=a=>a?new Intl.DateTimeFormat("de-DE").format(new Date(a)):"-",n=`
      <div class="page-header">
        <div class="page-header-left">
          <h1>Rechnung ${this.data?.rechnung_nr||""}</h1>
          <p>Details zur Rechnung</p>
        </div>
        <div class="page-header-right">
          <button id="btn-edit-rechnung" class="secondary-btn">Bearbeiten</button>
          <button onclick="window.navigateTo('/rechnung')" class="secondary-btn">Zur Übersicht</button>
        </div>
      </div>

      <div class="content-section">
        <div class="detail-grid">
          <div class="detail-card">
            <h3>Allgemein</h3>
            <div class="detail-item"><label>Rechnungs-Nr</label><span>${this.data?.rechnung_nr||"-"}</span></div>
            <div class="detail-item"><label>Unternehmen</label><span>${this.data?.unternehmen?.firmenname||"-"}</span></div>
            <div class="detail-item"><label>Auftrag</label><span>${this.data?.auftrag?.auftragsname||"-"}</span></div>
            <div class="detail-item"><label>Status</label><span>${this.data?.status||"-"}</span></div>
            <div class="detail-item"><label>Gestellt am</label><span>${t(this.data?.gestellt_am)}</span></div>
            <div class="detail-item"><label>Zahlungsziel</label><span>${t(this.data?.zahlungsziel)}</span></div>
            <div class="detail-item"><label>Bezahlt am</label><span>${t(this.data?.bezahlt_am)}</span></div>
            <div class="detail-item"><label>Nettobetrag</label><span>${e(this.data?.betrag_netto)}</span></div>
            <div class="detail-item"><label>Bruttobetrag</label><span>${e(this.data?.betrag_brutto)}</span></div>
            <div class="detail-item"><label>PDF</label><span>${this.data?.pdf_url?`<a href="${this.data.pdf_url}" target="_blank" rel="noopener noreferrer">Öffnen</a>`:"-"}</span></div>
          </div>

          <div class="detail-card">
            <h3>Belege</h3>
            ${!this.belege||this.belege.length===0?`
              <p class="empty-state">Keine Belege vorhanden</p>
            `:`
              <div class="data-table-container">
                <table class="data-table">
                  <thead>
                    <tr>
                      <th>Datei</th>
                      <th>Größe</th>
                      <th>Hochgeladen am</th>
                      <th>Aktion</th>
                    </tr>
                  </thead>
                  <tbody>
                    ${this.belege.map(a=>`
                      <tr>
                        <td>${window.validatorSystem.sanitizeHtml(a.file_name||"")}</td>
                        <td>${a.size!=null?Math.round(a.size/1024*10)/10+" KB":"-"}</td>
                        <td>${t(a.uploaded_at)}</td>
                        <td>${a.open_url?`<a href="${a.open_url}" target="_blank" rel="noopener noreferrer">Öffnen</a>`:"-"}</td>
                      </tr>
                    `).join("")}
                  </tbody>
                </table>
              </div>
            `}
          </div>
        </div>
      </div>
    `;window.setContentSafely(window.content,n)}showCreateForm(){window.setHeadline("Neue Rechnung anlegen");const e=window.formSystem.renderFormOnly("rechnung");window.content.innerHTML=`
      <div class="page-header">
        <div class="page-header-left">
          <h1>Neue Rechnung anlegen</h1>
        </div>
        <div class="page-header-right">
          <button onclick="window.navigateTo('/rechnung')" class="secondary-btn">Zurück</button>
        </div>
      </div>
      <div class="form-page">${e}</div>
    `,window.formSystem.bindFormEvents("rechnung",null);const t=document.getElementById("rechnung-form");t&&(t.onsubmit=async n=>{n.preventDefault(),await this.handleCreateSubmit()})}async handleCreateSubmit(){try{const e=document.getElementById("rechnung-form"),t=new FormData(e),n={};for(const[d,u]of t.entries())n[d]=u;e.querySelectorAll('select[data-searchable="true"]').forEach(d=>{const u=d.parentNode.querySelector(".searchable-select-container");if(u){const h=u.querySelector(".searchable-select-input");if(h&&h.value){const p=Array.from(d.options).find(g=>g.textContent.trim()===h.value.trim());p&&(n[d.name]=p.value,console.log(`✅ Searchable Select ${d.name} korrigiert: ${h.value} → ${p.value}`))}}});const i=["auftrag_id","kooperation_id","unternehmen_id","kampagne_id"].filter(d=>!n[d]||n[d].trim()==="");if(i.length>0){alert(`Bitte füllen Sie alle Pflichtfelder aus: ${i.join(", ")}`);return}console.log("📋 Submit-Daten vor Übertragung:",n),console.log("🔍 auftrag_id Wert:",n.auftrag_id,typeof n.auftrag_id);const s=e.querySelector('.uploader[data-name="pdf_file"]');let o=null,l=null;if(s&&s.__uploaderInstance&&s.__uploaderInstance.files.length&&window.supabase){const d=s.__uploaderInstance.files[0],u="rechnungen",h=`${n.unternehmen_id||"unknown"}/${Date.now()}_${d.name}`,{error:m}=await window.supabase.storage.from(u).upload(h,d,{cacheControl:"3600",upsert:!1,contentType:d.type});if(m)throw m;const{data:p}=window.supabase.storage.from(u).getPublicUrl(h);o=p.publicUrl,l=h}o&&(n.pdf_url=o,n.pdf_path=l);const c=await window.dataService.createEntity("rechnung",n);if(c.success){try{const d=e.querySelector('.uploader[data-name="belege_files"]');if(d&&d.__uploaderInstance&&d.__uploaderInstance.files.length&&window.supabase){const u=c.id,h=Array.from(d.__uploaderInstance.files);for(const m of h){const p="rechnung-belege",g=`${u}/${Date.now()}_${Math.random().toString(36).slice(2)}_${m.name}`,{error:f}=await window.supabase.storage.from(p).upload(g,m,{cacheControl:"3600",upsert:!1,contentType:m.type});if(f)throw f;const{data:w}=await window.supabase.storage.from(p).createSignedUrl(g,3600*24*7),v=w?.signedUrl||"";await window.supabase.from("rechnung_belege").insert({rechnung_id:u,file_name:m.name,file_path:g,file_url:v,content_type:m.type,size:m.size,uploaded_by:window.currentUser?.id||null})}}}catch(d){console.warn("⚠️ Belege-Upload teilweise fehlgeschlagen:",d)}alert("Rechnung erstellt"),window.navigateTo(`/rechnung/${c.id}`)}else throw new Error(c.error||"Unbekannter Fehler")}catch(e){alert(`Fehler: ${e.message}`)}}bindEvents(){document.addEventListener("click",e=>{e.target.id==="btn-edit-rechnung"&&this.showEditForm()})}showEditForm(){const e=window.formSystem.renderFormOnly("rechnung",this.data);window.content.innerHTML=`
      <div class="page-header">
        <div class="page-header-left">
          <h1>Rechnung bearbeiten</h1>
        </div>
        <div class="page-header-right">
          <button onclick="window.navigateTo('/rechnung/${this.id}')" class="secondary-btn">Abbrechen</button>
        </div>
      </div>
      <div class="form-page">${e}</div>
    `,window.formSystem.bindFormEvents("rechnung",this.data)}}const bt=new ft;class vt{constructor(){this.rows=[]}async init(){if(window.setHeadline("Mitarbeiter"),!(window.currentUser?.rolle==="admin"||window.canViewPage?.("mitarbeiter")||window.checkUserPermission("dashboard","can_view"))){window.content.innerHTML=`
        <div class="error-message">
          <p>Keine Berechtigung.</p>
        </div>
      `;return}await this.load(),await this.render(),this.bind()}async load(){try{if(window.supabase){const{data:e,error:t}=await window.supabase.from("benutzer").select(`
            id, 
            name, 
            rolle, 
            unterrolle,
            freigeschaltet,
            mitarbeiter_klasse:mitarbeiter_klasse_id(name)
          `).order("name");if(t){console.warn("⚠️ Fehler beim Laden der Mitarbeiter-Liste (eventuell fehlt freigeschaltet Spalte)",t);const{data:n,error:a}=await window.supabase.from("benutzer").select("id, name, rolle, unterrolle, mitarbeiter_klasse:mitarbeiter_klasse_id(name)").order("name");if(a){console.error("❌ Auch Fallback fehlgeschlagen:",a),this.rows=[];return}this.rows=(n||[]).map(r=>({...r,freigeschaltet:r.rolle==="admin"}))}else this.rows=e||[]}else this.rows=await window.dataService.loadEntities("benutzer")}catch(e){console.error("❌ Fehler beim Laden der Mitarbeiter:",e),this.rows=[]}}async render(){const t=`
      <div class="page-header">
        <div class="page-header-left">
          <h1>Mitarbeiter</h1>
          <p>Benutzerverwaltung und Rechte</p>
        </div>
        <div class="page-header-right">
        </div>
      </div>

      <div class="data-table-container">
        <table class="data-table">
          <thead>
            <tr>
              <th>Name</th>
              <th>Rolle</th>
              <th>E-Mail</th>
              <th>Unterrolle</th>
              <th>Kategorie</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            ${this.rows.map(n=>{const a=n.freigeschaltet?'<span class="status-badge success">FREIGESCHALTET</span>':'<span class="status-badge warning">WARTET</span>';return`
        <tr>
          <td>${n.id?`<a href="#" class="table-link" data-table="mitarbeiter" data-id="${n.id}">${window.validatorSystem.sanitizeHtml(n.name||"—")}</a>`:window.validatorSystem.sanitizeHtml(n.name||"—")}</td>
          <td>${window.validatorSystem.sanitizeHtml(n.rolle||"—")}</td>
          <td>${window.validatorSystem.sanitizeHtml(n.email||"—")}</td>
          <td>${window.validatorSystem.sanitizeHtml(n.unterrolle||"—")}</td>
          <td>${window.validatorSystem.sanitizeHtml(n.mitarbeiter_klasse?.name||"—")}</td>
          <td>${a}</td>
        </tr>
      `}).join("")||'<tr><td colspan="6" class="loading">Keine Mitarbeiter gefunden</td></tr>'}
          </tbody>
        </table>
      </div>
    `;window.setContentSafely(window.content,t)}bind(){document.addEventListener("click",e=>{const t=e.target.closest(".table-link");if(t&&t.dataset.table==="mitarbeiter"){e.preventDefault();const n=t.dataset.id;window.navigateTo(`/mitarbeiter/${n}`)}})}destroy(){window.setContentSafely("")}}const wt=new vt;class kt{constructor(){this.userId=null,this.user=null,this.assignments={kampagnen:[],kooperationen:[],briefings:[]},this.budget={invoicesByKoop:{},totals:{netto:0,zusatz:0,gesamt:0,invoice_netto:0,invoice_brutto:0}},this.statusOptions=[]}async init(e){this.userId=e,await this.load(),await this.render(),this.bind()}async load(){try{const{data:e}=await window.supabase.from("benutzer").select("*").eq("id",this.userId).single();this.user=e||{};const[{data:t},{data:n},{data:a},{data:r}]=await Promise.all([window.supabase.from("kampagne_mitarbeiter").select("kampagne:kampagne_id(id, kampagnenname)").eq("mitarbeiter_id",this.userId),window.supabase.from("kooperationen").select("id, name, status, kampagne:kampagne_id(kampagnenname), nettobetrag, zusatzkosten, gesamtkosten").eq("assignee_id",this.userId),window.supabase.from("briefings").select("id, product_service_offer, status").eq("assignee_id",this.userId),window.supabase.from("kampagne_status").select("id, name, sort_order").order("sort_order",{ascending:!0}).order("name",{ascending:!0})]);this.assignments.kampagnen=(t||[]).map(l=>l.kampagne).filter(Boolean),this.assignments.kooperationen=n||[],this.assignments.briefings=a||[],this.statusOptions=r||[];const i=(this.assignments.kooperationen||[]).map(l=>l.id).filter(Boolean);let s={},o={netto:0,zusatz:0,gesamt:0,invoice_netto:0,invoice_brutto:0};if(i.length>0)try{const{data:l}=await window.supabase.from("rechnung").select("id, rechnung_nr, status, nettobetrag, bruttobetrag, gestellt_am, bezahlt_am, pdf_url, kooperation_id").in("kooperation_id",i);(l||[]).forEach(c=>{s[c.kooperation_id]||(s[c.kooperation_id]=[]),s[c.kooperation_id].push(c),o.invoice_netto+=Number(c.nettobetrag||0),o.invoice_brutto+=Number(c.bruttobetrag||0)})}catch{s={}}(this.assignments.kooperationen||[]).forEach(l=>{o.netto+=Number(l.nettobetrag||0),o.zusatz+=Number(l.zusatzkosten||0),o.gesamt+=Number(l.gesamtkosten!=null?l.gesamtkosten:Number(l.nettobetrag||0)+Number(l.zusatzkosten||0))}),this.budget={invoicesByKoop:s,totals:o}}catch(e){console.error("❌ Fehler beim Laden Mitarbeiter-Details:",e)}}renderAssignmentsList(e,t){return!e||e.length===0?'<div class="empty-state"><p>Keine Einträge</p></div>':`
      <ul class="simple-list">
        ${e.map(t).join("")}
      </ul>`}renderKampagnenTable(){const e=(this.assignments.kampagnen||[]).map(t=>`
      <tr>
        <td><a href="/kampagne/${t.id}" onclick="event.preventDefault(); window.navigateTo('/kampagne/${t.id}')">${window.validatorSystem.sanitizeHtml(t.kampagnenname||t.id)}</a></td>
        <td style="text-align:right;">
          <div class="actions-dropdown-container" data-entity-type="kampagne">
            <button class="actions-toggle" aria-expanded="false" aria-label="Aktionen">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 8c1.1 0 2-.9 2-2s-.9-2-2-2-2 .9-2 2 .9 2 2 2zm0 2c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2zm0 6c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2z"/>
              </svg>
            </button>
            <div class="actions-dropdown">
              <div class="action-submenu">
                <a href="#" class="action-item has-submenu" data-submenu="status">
                  ${L.getHeroIcon("invoice")}
                  <span>Status ändern</span>
                </a>
                <div class="submenu" data-submenu="status">
                  ${(this.statusOptions||[]).map(n=>`
                    <a href="#" class="submenu-item" data-action="set-field" data-field="status_id" data-value="${n.id}" data-status-name="${n.name.replace(/\"/g,'\\"')}" data-id="${t.id}">${L.getStatusIcon(n.name)}<span>${n.name}</span></a>
                  `).join("")}
                </div>
              </div>
              <a href="#" class="action-item" data-action="view" data-id="${t.id}">
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" class="w-5 h-5"><path d="M10 12.5a2.5 2.5 0 100-5 2.5 2.5 0 000 5z" /><path fill-rule="evenodd" d="M.661 10c1.743-2.372 4.761-5 9.339-5 4.578 0 7.601 2.628 9.339 5-1.738 2.372-4.761 5-9.339 5-4.578 0-7.601-2.628-9.339-5zM10 15a5 5 0 100-10 5 5 0 000 10z" clip-rule="evenodd" /></svg>
                Details anzeigen
              </a>
              <a href="#" class="action-item action-danger" data-action="unassign-kampagne" data-id="${t.id}" data-mitarbeiter-id="${this.userId}">
                <i class="icon-trash"></i>
                Zuweisung entfernen
              </a>
            </div>
          </div>
        </td>
      </tr>
    `).join("");return e?`
      <div class="data-table-container">
        <table class="data-table">
          <thead><tr><th>Kampagne</th><th>Aktionen</th></tr></thead>
          <tbody>${e}</tbody>
        </table>
      </div>
    `:'<div class="empty-state"><p>Keine Kampagnen zugewiesen</p></div>'}renderKooperationenTable(){const e=(this.assignments.kooperationen||[]).map(t=>`
      <tr>
        <td><a href="/kooperation/${t.id}" onclick="event.preventDefault(); window.navigateTo('/kooperation/${t.id}')">${window.validatorSystem.sanitizeHtml(t.name||t.id)}</a></td>
        <td>${window.validatorSystem.sanitizeHtml(t.kampagne?.kampagnenname||"-")}</td>
        <td><span class="status-badge status-${(t.status||"").toLowerCase().replace(/\s+/g,"-")}">${t.status||"-"}</span></td>
      </tr>
    `).join("");return e?`
      <div class="data-table-container">
        <table class="data-table">
          <thead><tr><th>Name</th><th>Kampagne</th><th>Status</th></tr></thead>
          <tbody>${e}</tbody>
        </table>
      </div>
    `:'<div class="empty-state"><p>Keine Kooperationen zugewiesen</p></div>'}renderBriefingsTable(){const e=(this.assignments.briefings||[]).map(t=>`
      <tr>
        <td><a href="/briefing/${t.id}" onclick="event.preventDefault(); window.navigateTo('/briefing/${t.id}')">${window.validatorSystem.sanitizeHtml(t.product_service_offer||t.id)}</a></td>
        <td><span class="status-badge status-${(t.status||"").toLowerCase().replace(/\s+/g,"-")}">${t.status||"-"}</span></td>
      </tr>
    `).join("");return e?`
      <div class="data-table-container">
        <table class="data-table">
          <thead><tr><th>Briefing</th><th>Status</th></tr></thead>
          <tbody>${e}</tbody>
        </table>
      </div>
    `:'<div class="empty-state"><p>Keine Briefings zugewiesen</p></div>'}generatePermissionsTable(){const e=this.user?.zugriffsrechte||{};return[["creator","Creator"],["creator-lists","Creator Listen"],["unternehmen","Unternehmen"],["marke","Marken"],["auftrag","Aufträge"],["kampagne","Kampagnen"],["kooperation","Kooperationen"],["rechnung","Rechnungen"],["briefing","Briefings"]].map(([t,n])=>`
      <tr>
        <td>${n}</td>
        <td style="text-align:right;">
          <label class="toggle-label" style="justify-content:flex-end;">
            <span class="toggle-switch">
              <input type="checkbox" class="perm-toggle" data-key="${t}" ${e?.[t]?.can_view===!1?"":e?.[t]===!0||e?.[t]?.can_view===!0?"checked":""}>
              <span class="toggle-slider"></span>
            </span>
          </label>
        </td>
        <td style="text-align:right;">
          <label class="toggle-label" style="justify-content:flex-end;">
            <span class="toggle-switch">
              <input type="checkbox" class="perm-edit-toggle" data-key="${t}" ${e?.[t]?.can_edit?"checked":""}>
              <span class="toggle-slider"></span>
            </span>
          </label>
        </td>
      </tr>
    `).join("")}async autoSavePermissions(){if(!this.user?.freigeschaltet){console.log("⚠️ Auto-Save übersprungen: Benutzer nicht freigeschaltet");return}try{const e=document.querySelectorAll(".perm-toggle"),t=document.querySelectorAll(".perm-edit-toggle");let n={};e.forEach(r=>{const i=r.dataset.key;n[i]||(n[i]={}),n[i].can_view=!!r.checked}),t.forEach(r=>{const i=r.dataset.key;n[i]||(n[i]={}),n[i].can_edit=!!r.checked});const{error:a}=await window.supabase.from("benutzer").update({zugriffsrechte:n}).eq("id",this.userId);if(a){console.error("❌ Auto-Save Rechte fehlgeschlagen",a),alert("Fehler beim Speichern der Rechte");return}this.user.zugriffsrechte=n,console.log("✅ Rechte automatisch gespeichert")}catch(e){console.error("❌ Auto-Save Rechte Fehler",e),alert("Fehler beim Speichern der Rechte")}}async render(){this.user?.zugriffsrechte;const e=`
      <div class="page-header">
        <div class="page-header-left">
          <h1>Mitarbeiter: ${window.validatorSystem.sanitizeHtml(this.user?.name||"-")}</h1>
          <p>Rechte und Zuweisungen verwalten</p>
        </div>
        <div class="page-header-right">
          <button class="secondary-btn" id="btn-back-mitarbeiter">Mitarbeiter Übersicht</button>
          <p class="text-muted" style="text-align: center; font-style: italic; margin: 1rem 0;">
            Änderungen werden automatisch gespeichert
          </p>
        </div>
      </div>

      <div class="content-section">
        <div class="tab-navigation">
          <button class="tab-button active" data-tab="rechte">Rechte</button>
          <button class="tab-button" data-tab="kampagnen">Kampagnen <span class="tab-count">${this.assignments.kampagnen.length}</span></button>
          <button class="tab-button" data-tab="koops">Kooperationen <span class="tab-count">${this.assignments.kooperationen.length}</span></button>
          <button class="tab-button" data-tab="budget">Mitarbeiter Budget</button>
          <button class="tab-button" data-tab="briefings">Briefings <span class="tab-count">${this.assignments.briefings.length}</span></button>
        </div>

        <div class="tab-content">
          <div class="tab-pane active" id="tab-rechte">
            <div class="detail-section">
              <h2>Benutzer-Status</h2>
              <div class="data-table-container">
                <table class="data-table">
                  <thead>
                    <tr>
                      <th>Status</th>
                      <th style="width:120px; text-align:right;">Aktiv</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td>
                        <div>
                          <strong>Benutzer freigeschaltet</strong>
                          <div class="form-help" style="margin-top: 4px;">
                            ${this.user?.freigeschaltet?"Dieser Benutzer ist freigeschaltet und kann sich anmelden. Sie können Rechte vergeben.":"Dieser Benutzer wartet auf Freischaltung. Schalten Sie ihn frei, bevor Sie Rechte vergeben."}
                          </div>
                        </div>
                      </td>
                      <td style="text-align:right;">
                        <label class="toggle-label" style="justify-content:flex-end;">
                          <span class="toggle-switch">
                            <input type="checkbox" id="freigeschaltet-toggle" ${this.user?.freigeschaltet?"checked":""}>
                            <span class="toggle-slider"></span>
                          </span>
                        </label>
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
            
            <div class="detail-section">
              <h2>Rechte</h2>
              ${this.user?.freigeschaltet?`<div class="data-table-container">
                  <table class="data-table">
                    <thead>
                      <tr>
                        <th>Recht</th>
                        <th style="width:120px; text-align:right;">Lesen</th>
                        <th style="width:120px; text-align:right;">Bearbeiten</th>
                      </tr>
                    </thead>
                    <tbody>
                      ${this.generatePermissionsTable()}
                    </tbody>
                  </table>
                </div>`:'<p class="text-muted"><em>Rechte können erst nach der Freischaltung des Benutzers vergeben werden.</em></p>'}
            </div>
          </div>

          <div class="tab-pane" id="tab-kampagnen">
            <div class="detail-section">
              <h2>Zugewiesene Kampagnen</h2>
              ${this.renderKampagnenTable()}
            </div>
          </div>

          <div class="tab-pane" id="tab-koops">
            <div class="detail-section">
              <h2>Zugewiesene Kooperationen</h2>
              ${this.renderKooperationenTable()}
            </div>
          </div>

          <div class="tab-pane" id="tab-budget">
            <div class="detail-section">
              <h2>Mitarbeiter Budget</h2>
              ${this.renderBudget()}
            </div>
          </div>

          <div class="tab-pane" id="tab-briefings">
            <div class="detail-section">
              <h2>Zugewiesene Briefings</h2>
              ${this.renderBriefingsTable()}
            </div>
          </div>
        </div>
      </div>
    `;window.setContentSafely(window.content,e)}formatCurrency(e){const t=Number(e||0);return new Intl.NumberFormat("de-DE",{style:"currency",currency:"EUR"}).format(t)}renderBudget(){const e=(this.assignments.kooperationen||[]).map(r=>{const i=this.budget.invoicesByKoop[r.id]||[],s=i.length?i.map(d=>`<div><a href="/rechnung/${d.id}" onclick="event.preventDefault(); window.navigateTo('/rechnung/${d.id}')">${window.validatorSystem.sanitizeHtml(d.rechnung_nr||d.id)}</a> — ${this.formatCurrency(d.bruttobetrag)} <span class="status-badge status-${(d.status||"").toLowerCase().replace(/\s+/g,"-")}">${d.status||"-"}</span></div>`).join(""):'<span class="muted">Keine Rechnung</span>',o=Number(r.nettobetrag||0),l=Number(r.zusatzkosten||0),c=r.gesamtkosten!=null?Number(r.gesamtkosten):o+l;return`
        <tr>
          <td><a href="/kooperation/${r.id}" onclick="event.preventDefault(); window.navigateTo('/kooperation/${r.id}')">${window.validatorSystem.sanitizeHtml(r.name||r.id)}</a></td>
          <td>${window.validatorSystem.sanitizeHtml(r.kampagne?.kampagnenname||"-")}</td>
          <td style="text-align:right;">${this.formatCurrency(o)}</td>
          <td style="text-align:right;">${this.formatCurrency(l)}</td>
          <td style="text-align:right;">${this.formatCurrency(c)}</td>
          <td>${s}</td>
        </tr>
      `}).join(""),t=this.budget.totals||{netto:0,zusatz:0,gesamt:0,invoice_netto:0,invoice_brutto:0},n=`
      <div class="summary-cards grid-3">
        <div class="detail-card"><h3>Summe Netto (Koops)</h3><div class="detail-value">${this.formatCurrency(t.netto)}</div></div>
        <div class="detail-card"><h3>Summe Zusatzkosten</h3><div class="detail-value">${this.formatCurrency(t.zusatz)}</div></div>
        <div class="detail-card"><h3>Summe Gesamtkosten</h3><div class="detail-value">${this.formatCurrency(t.gesamt)}</div></div>
      </div>
      <div class="summary-cards grid-2" style="margin-top:12px;">
        <div class="detail-card"><h3>Summe Rechnungen Netto</h3><div class="detail-value">${this.formatCurrency(t.invoice_netto)}</div></div>
        <div class="detail-card"><h3>Summe Rechnungen Brutto</h3><div class="detail-value">${this.formatCurrency(t.invoice_brutto)}</div></div>
      </div>
    `,a=e?`
        <div class="data-table-container" style="margin-top:12px;">
          <table class="data-table">
            <thead>
              <tr>
                <th>Kooperation</th>
                <th>Kampagne</th>
                <th style="text-align:right;">Netto</th>
                <th style="text-align:right;">Zusatz</th>
                <th style="text-align:right;">Gesamt</th>
                <th>Rechnungen</th>
              </tr>
            </thead>
            <tbody>${e}</tbody>
          </table>
        </div>
      `:'<div class="empty-state"><p>Keine Kooperationen zugewiesen</p></div>';return`${n}${a}`}bind(){document.addEventListener("click",t=>{const n=t.target.closest(".tab-button");if(!n)return;t.preventDefault();const a=n.dataset.tab;document.querySelectorAll(".tab-button").forEach(i=>i.classList.remove("active")),n.classList.add("active"),document.querySelectorAll(".tab-pane").forEach(i=>i.classList.remove("active"));const r=document.getElementById(`tab-${a}`);r&&r.classList.add("active")});const e=this;document.addEventListener("change",async t=>{if(t.target&&t.target.id==="freigeschaltet-toggle"){const n=t.target.checked,a=document.querySelector("#tab-rechte .detail-section:nth-child(2)"),r=document.querySelector("#tab-rechte .form-help");try{const i={freigeschaltet:n};n?(e.user.rolle==="pending"&&(i.rolle="user"),e.user.unterrolle==="awaiting_approval"&&(i.unterrolle="can_view")):(i.rolle="pending",i.unterrolle="awaiting_approval",i.zugriffsrechte=null);const{error:s}=await window.supabase.from("benutzer").update(i).eq("id",e.userId);if(s){console.error("❌ Auto-Save Freigeschaltet fehlgeschlagen",s),t.target.checked=!n,alert("Fehler beim Speichern des Freischaltungs-Status");return}e.user.freigeschaltet=n,i.rolle&&(e.user.rolle=i.rolle),i.unterrolle&&(e.user.unterrolle=i.unterrolle),i.zugriffsrechte!==void 0&&(e.user.zugriffsrechte=i.zugriffsrechte),window.notificationSystem&&e.user.auth_user_id&&(await window.notificationSystem.pushNotification(e.user.auth_user_id,{type:"system",entity:"benutzer",entityId:e.userId,title:n?"Ihr Account wurde freigeschaltet":"Ihr Account wurde gesperrt",message:n?"Sie können sich jetzt anmelden und das System nutzen.":"Ihr Zugang wurde vorübergehend deaktiviert."}),window.dispatchEvent(new Event("notificationsRefresh"))),console.log(`✅ Benutzer ${n?"freigeschaltet":"gesperrt"}`),setTimeout(()=>{e.render().then(()=>e.bind())},100)}catch(i){console.error("❌ Auto-Save Fehler",i),t.target.checked=!n,alert("Fehler beim Speichern");return}a&&(n?(a.style.display="block",a.innerHTML=`
              <h2>Rechte</h2>
              <div class="data-table-container">
                <table class="data-table">
                  <thead>
                    <tr>
                      <th>Recht</th>
                      <th style="width:120px; text-align:right;">Lesen</th>
                      <th style="width:120px; text-align:right;">Bearbeiten</th>
                    </tr>
                  </thead>
                  <tbody>
                    ${e.generatePermissionsTable()}
                  </tbody>
                </table>
              </div>
            `):a.innerHTML=`
              <h2>Rechte</h2>
              <p class="text-muted"><em>Rechte können erst nach der Freischaltung des Benutzers vergeben werden.</em></p>
            `),r&&(r.textContent=n?"Dieser Benutzer ist freigeschaltet und kann sich anmelden. Sie können Rechte vergeben.":"Dieser Benutzer wartet auf Freischaltung. Schalten Sie ihn frei, bevor Sie Rechte vergeben.")}t.target&&(t.target.classList.contains("perm-toggle")||t.target.classList.contains("perm-edit-toggle"))&&await e.autoSavePermissions()}),document.addEventListener("click",async t=>{if(t.target&&t.target.id==="btn-back-mitarbeiter"){t.preventDefault(),window.navigateTo("/mitarbeiter");return}if(t.target&&t.target.id==="btn-save-perms"){t.preventDefault();const n=document.getElementById("freigeschaltet-toggle"),a=n?n.checked:this.user?.freigeschaltet;let r={};if(a){const i=document.querySelectorAll(".perm-toggle"),s=document.querySelectorAll(".perm-edit-toggle");i.forEach(o=>{const l=o.dataset.key;r[l]||(r[l]={}),r[l].can_view=!!o.checked}),s.forEach(o=>{const l=o.dataset.key;r[l]||(r[l]={}),r[l].can_edit=!!o.checked})}try{const i={freigeschaltet:a,zugriffsrechte:r},{error:s}=await window.supabase.from("benutzer").update(i).eq("id",this.userId);if(s)throw s;this.user.freigeschaltet=a,this.user.zugriffsrechte=r;try{const o=a?"freigeschaltet":"gesperrt",l=Object.entries(r).map(([c,d])=>`${c}: ${d?.can_view?"R":"-"}/${d?.can_edit?"E":"-"}`).join(", ");await window.notificationSystem?.pushNotification(this.userId,{type:"update",entity:"mitarbeiter",entityId:this.userId,title:a?"Account freigeschaltet":"Account gesperrt",message:a?`Ihr Account wurde freigeschaltet. ${l?"Rechte: "+l:""}`:"Ihr Account wurde gesperrt."}),window.dispatchEvent(new Event("notificationsRefresh"))}catch{}alert(a?"Benutzer freigeschaltet und Rechte gespeichert":"Benutzer gesperrt"),await this.render(),this.bind()}catch(i){console.error("❌ Speichern fehlgeschlagen",i),alert("Fehler beim Speichern")}}})}showEditForm(){console.log("🎯 MITARBEITERDETAIL: Zeige Bearbeitungsformular"),window.setHeadline("Mitarbeiter bearbeiten"),window.content.innerHTML=`
      <div class="page-header">
        <div class="page-header-left">
          <h1>Mitarbeiter bearbeiten</h1>
          <p>Die Bearbeitung von Mitarbeitern erfolgt über die Detail-Ansicht</p>
        </div>
        <div class="page-header-right">
          <button onclick="window.navigateTo('/mitarbeiter/${this.userId}')" class="secondary-btn">Zurück zu Details</button>
        </div>
      </div>
      
      <div class="content-section">
        <div class="info-message">
          <h2>Hinweis</h2>
          <p>Die Bearbeitung von Mitarbeitern erfolgt direkt über die Detail-Ansicht mit speziellen Admin-Funktionen.</p>
          <p>Klicken Sie auf "Zurück zu Details" um zur vollständigen Mitarbeiter-Verwaltung zu gelangen.</p>
          <br>
          <button onclick="window.navigateTo('/mitarbeiter/${this.userId}')" class="primary-btn">Zurück zur Detail-Ansicht</button>
        </div>
      </div>
    `}destroy(){window.setContentSafely("")}}const yt=new kt;class Et{constructor(){this.currentEntityType=null,this.currentListInstance=null,this.boundEventListeners=new Set}init(){console.log("🔧 BulkActionSystem: Initialisiere..."),this.bindGlobalEvents()}registerList(e,t){console.log(`🔧 BulkActionSystem: Registriere ${e} Liste`),this.currentEntityType=e,this.currentListInstance=t,console.log(`✅ BulkActionSystem: ${e} als aktive Liste gesetzt`,{hasDeleteMethod:typeof t.showDeleteSelectedConfirmation=="function",currentPath:window.location.pathname})}updateActiveList(){const e=window.location.pathname;console.log(`🔧 BulkActionSystem: Prüfe aktuelle Route: ${e}`);const t=e.split("/").filter(n=>n);if(t.length>0){const n=t[0],a=`${n}List`;if(window[a])return this.currentEntityType=n,this.currentListInstance=window[a],console.log(`✅ BulkActionSystem: ${n} automatisch erkannt und gesetzt`),!0}return console.log("❌ BulkActionSystem: Keine passende Liste für aktuelle Route gefunden"),!1}bindGlobalEvents(){const e=n=>{n.target.id==="btn-deselect-all"&&(n.preventDefault(),this.handleDeselectAll())};document.addEventListener("click",e),this.boundEventListeners.add({element:document,type:"click",handler:e});const t=n=>{n.target.id==="btn-delete-selected"&&(n.preventDefault(),this.handleDeleteSelected())};document.addEventListener("click",t),this.boundEventListeners.add({element:document,type:"click",handler:t}),console.log("✅ BulkActionSystem: Globale Event-Listener registriert")}handleDeselectAll(){console.log("🔧 BulkActionSystem: Handle Deselect All"),this.currentListInstance||this.updateActiveList(),this.currentListInstance&&typeof this.currentListInstance.deselectAll=="function"?(console.log(`✅ BulkActionSystem: Rufe deselectAll() für ${this.currentEntityType} auf`),this.currentListInstance.deselectAll()):(console.log("⚠️ BulkActionSystem: Fallback - Generische Deselection"),this.genericDeselectAll())}handleDeleteSelected(){if(console.log("🔧 BulkActionSystem: Handle Delete Selected"),this.currentListInstance&&typeof this.currentListInstance.showDeleteSelectedConfirmation=="function"){console.log(`✅ BulkActionSystem: Rufe showDeleteSelectedConfirmation() für ${this.currentEntityType} auf`),this.currentListInstance.showDeleteSelectedConfirmation();return}if(!this.currentListInstance&&this.updateActiveList()&&this.currentListInstance&&typeof this.currentListInstance.showDeleteSelectedConfirmation=="function"){console.log(`✅ BulkActionSystem: Nach Update gefunden - rufe showDeleteSelectedConfirmation() für ${this.currentEntityType} auf`),this.currentListInstance.showDeleteSelectedConfirmation();return}console.log("⚠️ BulkActionSystem: Fallback - Generische Deletion"),this.genericDeleteSelected()}genericDeselectAll(){const e=this.detectCurrentEntityType();if(!e){console.log("❌ BulkActionSystem: Kann Entity-Type nicht erkennen");return}const t=this.getEntityConfig(e),n=document.querySelectorAll(t.checkboxSelector),a=document.getElementById(t.selectAllId);n.forEach(r=>{r.checked=!1}),a&&(a.checked=!1,a.indeterminate=!1),this.hideButtons(),console.log(`✅ BulkActionSystem: Generische Deselection für ${e} abgeschlossen`)}genericDeleteSelected(){const e=this.detectCurrentEntityType();if(!e){console.log("❌ BulkActionSystem: Kann Entity-Type nicht erkennen");return}const t=this.getEntityConfig(e),n=document.querySelectorAll(`${t.checkboxSelector}:checked`);if(n.length===0){alert(`Keine ${t.displayName} ausgewählt.`);return}const a=n.length===1?`Möchten Sie ${t.displayName.slice(0,-1)} wirklich löschen?`:`Möchten Sie die ${n.length} ausgewählten ${t.displayName} wirklich löschen?`;confirm(`${a}

Dieser Vorgang kann nicht rückgängig gemacht werden.`)&&this.performGenericDelete(e,n)}async performGenericDelete(e,t){const n=Array.from(t).map(c=>c.dataset.id),a=n.length;console.log(`🗑️ BulkActionSystem: Lösche ${a} ${e}...`);let r=0,i=0;const s=[];for(const c of n)try{const d=await window.dataService.deleteEntity(e,c);d.success?(r++,console.log(`✅ ${e} ${c} gelöscht`)):(i++,s.push(`${e} ${c}: ${d.error}`),console.error(`❌ Fehler beim Löschen von ${e} ${c}:`,d.error))}catch(d){i++,s.push(`${e} ${c}: ${d.message}`),console.error(`❌ Unerwarteter Fehler beim Löschen von ${e} ${c}:`,d)}const o=this.getEntityConfig(e);let l="";r>0&&(l+=`✅ ${r} ${o.displayName} erfolgreich gelöscht.`),i>0&&(l+=`
❌ ${i} ${o.displayName} konnten nicht gelöscht werden.`,s.length>0&&(l+=`

Fehler:
${s.join(`
`)}`)),alert(l),this.genericDeselectAll(),this.currentListInstance&&typeof this.currentListInstance.loadAndRender=="function"?await this.currentListInstance.loadAndRender():window.location.reload(),window.dispatchEvent(new CustomEvent("entityUpdated",{detail:{entity:e,action:"bulk-deleted",count:r}}))}detectCurrentEntityType(){const e=window.location.pathname.split("/").filter(n=>n);if(e.length>0){const n=e[0];if(["creator","unternehmen","kampagne","marke","auftrag","ansprechpartner","kooperation"].includes(n))return n}const t=["creator","unternehmen","kampagne","marke","auftrag","ansprechpartner","kooperation"];for(const n of t){const a=this.getEntityConfig(n);if(document.querySelectorAll(a.checkboxSelector).length>0)return console.log(`🔧 BulkActionSystem: Entity-Type ${n} aus Checkboxen erkannt`),n}return null}getEntityConfig(e){return{creator:{checkboxSelector:".creator-check",selectAllId:"select-all-creators",displayName:"Creator"},unternehmen:{checkboxSelector:".unternehmen-check",selectAllId:"select-all-unternehmen",displayName:"Unternehmen"},kampagne:{checkboxSelector:".kampagne-check",selectAllId:"select-all-kampagnen",displayName:"Kampagnen"},marke:{checkboxSelector:".marke-check",selectAllId:"select-all-marken",displayName:"Marken"},auftrag:{checkboxSelector:".auftrag-check",selectAllId:"select-all-auftraege",displayName:"Aufträge"},ansprechpartner:{checkboxSelector:".ansprechpartner-check",selectAllId:"select-all-ansprechpartner",displayName:"Ansprechpartner"},kooperation:{checkboxSelector:".kooperation-check",selectAllId:"select-all-kooperationen",displayName:"Kooperationen"}}[e]||{checkboxSelector:`.${e}-check`,selectAllId:`select-all-${e}`,displayName:e}}hideButtons(){const e=document.getElementById("selected-count"),t=document.getElementById("btn-deselect-all"),n=document.getElementById("btn-delete-selected");e&&(e.style.display="none"),t&&(t.style.display="none"),n&&(n.style.display="none")}destroy(){this.boundEventListeners.forEach(({element:e,type:t,handler:n})=>{e.removeEventListener(t,n)}),this.boundEventListeners.clear()}}const ye=new Et;class _t{constructor(){this.notifications=[],this.unreadCount=0,this.pollIntervalMs=6e4,this._timer=null,this._initialized=!1}init(){this._initialized||(this._initialized=!0,this.bindUI(),this.refresh(!0),this.startPolling(),window.addEventListener("notificationsRefresh",()=>this.refresh()))}destroy(){this._timer&&clearInterval(this._timer),this._timer=null,this._initialized=!1}startPolling(){this._timer&&clearInterval(this._timer),this._timer=setInterval(()=>this.refresh(),this.pollIntervalMs)}bindUI(){const e=document.querySelector("#notificationBell, .notification-bell"),t=document.querySelector("#notificationDropdown, .notification-dropdown");if(!e||!t)return;const n=()=>{t.classList.toggle("show")};e.addEventListener("click",a=>{a.preventDefault(),n()}),document.addEventListener("click",a=>{!t.contains(a.target)&&!e.contains(a.target)&&t.classList.remove("show")})}async refresh(e=!1){try{if(!window.supabase||!window.currentUser?.id)return;const{data:t,error:n}=await window.supabase.from("notifications").select("id, user_id, type, entity, entity_id, title, message, created_at, read_at").eq("user_id",window.currentUser.id).order("created_at",{ascending:!1}).limit(20);if(n)throw n;this.notifications=t||[],this.unreadCount=(this.notifications||[]).filter(a=>!a.read_at).length,this.renderBadge(),this.renderDropdown(),!e&&this.unreadCount>0}catch(t){console.warn("⚠️ Notifications refresh failed",t)}}renderBadge(){const e=document.querySelector("#notificationBadge, .notification-badge");if(!e)return;const t=this.unreadCount;e.textContent=t>99?"99+":String(t||""),e.style.display=t>0?"":"none"}renderDropdown(){const e=document.querySelector("#notificationDropdown, .notification-dropdown");if(!e)return;const t=(this.notifications||[]).map(a=>{const r=this.getEntityUrl(a.entity,a.entity_id),i=new Date(a.created_at).toLocaleString("de-DE");return`
        <div class="notification-item ${a.read_at?"":"unread"}" data-id="${a.id}">
          <div class="notification-title">${this.escape(a.title||"Benachrichtigung")}</div>
          <div class="notification-message">${this.escape(a.message||"")}</div>
          <div class="notification-meta">
            <span class="notification-time">${i}</span>
            ${r?`<a href="${r}" data-route="${r}" class="notification-open">Öffnen</a>`:""}
          </div>
        </div>`}).join(""),n=`
      <div class="notification-actions">
        <button class="btn-link" id="markAllRead">Alle als gelesen</button>
      </div>`;e.innerHTML=`<div class="notification-list">${t||'<div class="notification-empty">Keine Benachrichtigungen</div>'}</div>${n}`,e.querySelector("#markAllRead")?.addEventListener("click",async a=>{a.preventDefault(),await this.markAllAsRead(),this.refresh()}),e.querySelectorAll(".notification-open").forEach(a=>{a.addEventListener("click",async r=>{r.preventDefault();const s=r.target.closest(".notification-item")?.dataset?.id;s&&await this.markAsRead(s);const o=a.getAttribute("data-route");o&&window.navigateTo&&window.navigateTo(o),e.classList.remove("show")})})}getEntityUrl(e,t){return!e||!t?"":{kampagne:`/kampagne/${t}`,kooperation:`/kooperation/${t}`,briefing:`/briefing/${t}`,auftrag:`/auftrag/${t}`}[e]||""}async markAsRead(e){try{if(!window.supabase)return;await window.supabase.from("notifications").update({read_at:new Date().toISOString()}).eq("id",e)}catch(t){console.warn("⚠️ markAsRead failed",t)}}async markAllAsRead(){try{if(!window.supabase||!window.currentUser?.id)return;await window.supabase.from("notifications").update({read_at:new Date().toISOString()}).is("read_at",null).eq("user_id",window.currentUser.id)}catch(e){console.warn("⚠️ markAllAsRead failed",e)}}async pushNotification(e,t){try{if(!window.supabase||!e)return;const n={user_id:e,type:t?.type||"info",entity:t?.entity||null,entity_id:t?.entityId||null,title:t?.title||"Benachrichtigung",message:t?.message||"",created_at:new Date().toISOString()};await window.supabase.from("notifications").insert(n)}catch(n){console.warn("⚠️ pushNotification failed",n)}}escape(e){if(!e)return"";const t=document.createElement("div");return t.textContent=e,t.innerHTML}}const Ee=new _t;class St{constructor(){this.data={stats:{},deadlines:[],recentActivity:[],alerts:[]},this.refreshInterval=null}async init(){window.setHeadline("Dashboard"),await this.loadDashboardData(),await this.render(),this.setupEventListeners(),this.startAutoRefresh()}async loadDashboardData(){try{await Promise.all([this.loadStats(),this.loadUpcomingDeadlines(),this.loadRecentActivity(),this.loadAlerts()])}catch(e){console.error("❌ Fehler beim Laden der Dashboard-Daten:",e)}}async loadStats(){try{if(!window.supabase){this.data.stats=this.getMockStats();return}const[{data:e},{data:t},{data:n},{data:a},{data:r},{data:i}]=await Promise.all([window.supabase.from("kampagne").select("id, status_id, deadline"),window.supabase.from("auftrag").select("id, status, ende, re_faelligkeit"),window.supabase.from("briefings").select("id, status, deadline"),window.supabase.from("kooperationen").select("id, status, content_deadline, skript_deadline"),window.supabase.from("creator").select("id"),window.supabase.from("rechnungen").select("id, status, zahlungsziel")]);this.data.stats={kampagnen:{total:e?.length||0,aktiv:e?.filter(s=>s.status_id==="active")?.length||0,ueberfaellig:e?.filter(s=>s.deadline&&new Date(s.deadline)<new Date)?.length||0},auftraege:{total:t?.length||0,aktiv:t?.filter(s=>s.status==="aktiv")?.length||0,ueberfaellig:t?.filter(s=>s.ende&&new Date(s.ende)<new Date)?.length||0},briefings:{total:n?.length||0,offen:n?.filter(s=>s.status!=="completed")?.length||0,ueberfaellig:n?.filter(s=>s.deadline&&new Date(s.deadline)<new Date)?.length||0},kooperationen:{total:a?.length||0,aktiv:a?.filter(s=>s.status==="active")?.length||0},creator:{total:r?.length||0},rechnungen:{total:i?.length||0,offen:i?.filter(s=>s.status!=="bezahlt")?.length||0,ueberfaellig:i?.filter(s=>s.zahlungsziel&&new Date(s.zahlungsziel)<new Date)?.length||0}}}catch(e){console.error("❌ Fehler beim Laden der Statistiken:",e),this.data.stats=this.getMockStats()}}async loadUpcomingDeadlines(){try{if(!window.supabase){this.data.deadlines=this.getMockDeadlines();return}const e=new Date;e.setDate(e.getDate()+7);const t=e.toISOString().split("T")[0],n=window.currentUser?.rolle==="admin";let a=[],r=[];if(!n)try{const{data:g}=await window.supabase.from("kampagne_mitarbeiter").select("kampagne_id").eq("mitarbeiter_id",window.currentUser?.id),f=(g||[]).map(y=>y.kampagne_id).filter(Boolean),{data:w}=await window.supabase.from("marke_mitarbeiter").select("marke_id").eq("mitarbeiter_id",window.currentUser?.id),v=(w||[]).map(y=>y.marke_id).filter(Boolean);let k=[];if(v.length>0){const{data:y}=await window.supabase.from("kampagne").select("id").in("marke_id",v);k=(y||[]).map(S=>S.id).filter(Boolean)}if(a=[...new Set([...f,...k])],a.length>0){const{data:y}=await window.supabase.from("kooperationen").select("id").in("kampagne_id",a);r=(y||[]).map(S=>S.id)}console.log(`🔍 DASHBOARD: Mitarbeiter ${window.currentUser?.id} hat Zugriff auf:`,{direkteKampagnen:f.length,markenKampagnen:k.length,gesamtKampagnen:a.length,kooperationen:r.length})}catch(g){console.error("❌ Fehler beim Laden der Zuordnungen für Dashboard:",g)}let i=window.supabase.from("kampagne").select("id, kampagnenname, deadline, unternehmen:unternehmen_id(firmenname)").lte("deadline",t).gte("deadline",new Date().toISOString().split("T")[0]),s=window.supabase.from("briefings").select("id, product_service_offer, deadline, unternehmen:unternehmen_id(firmenname)").lte("deadline",t).gte("deadline",new Date().toISOString().split("T")[0]),o=window.supabase.from("kooperationen").select("id, name, skript_deadline, creator:creator_id(vorname, nachname)").lte("skript_deadline",t).gte("skript_deadline",new Date().toISOString().split("T")[0]),l=window.supabase.from("kooperationen").select("id, name, content_deadline, creator:creator_id(vorname, nachname)").lte("content_deadline",t).gte("content_deadline",new Date().toISOString().split("T")[0]),c=window.supabase.from("rechnungen").select("id, rechnungs_nr, zahlungsziel, unternehmen:unternehmen_id(firmenname)").lte("zahlungsziel",t).gte("zahlungsziel",new Date().toISOString().split("T")[0]);n||(a.length>0?(i=i.in("id",a),s=s.in("kampagne_id",a),c=c.in("kampagne_id",a)):(i=i.eq("id","00000000-0000-0000-0000-000000000000"),s=s.eq("kampagne_id","00000000-0000-0000-0000-000000000000"),c=c.eq("kampagne_id","00000000-0000-0000-0000-000000000000")),r.length>0?(o=o.in("id",r),l=l.in("id",r)):(o=o.eq("id","00000000-0000-0000-0000-000000000000"),l=l.eq("id","00000000-0000-0000-0000-000000000000")));const[{data:d},{data:u},{data:h},{data:m},{data:p}]=await Promise.all([i,s,o,l,c]);this.data.deadlines=[...d?.map(g=>({type:"kampagne",id:g.id,title:g.kampagnenname,subtitle:g.unternehmen?.firmenname,deadline:g.deadline,priority:this.getDeadlinePriority(g.deadline),url:`/kampagne/${g.id}`}))||[],...u?.map(g=>({type:"briefing",id:g.id,title:g.product_service_offer,subtitle:g.unternehmen?.firmenname,deadline:g.deadline,priority:this.getDeadlinePriority(g.deadline),url:`/briefing/${g.id}`}))||[],...h?.map(g=>({type:"kooperation-skript",id:g.id,title:`Skript: ${g.name||"Kooperation"}`,subtitle:`${g.creator?.vorname} ${g.creator?.nachname}`,deadline:g.skript_deadline,priority:this.getDeadlinePriority(g.skript_deadline),url:`/kooperation/${g.id}`}))||[],...m?.map(g=>({type:"kooperation-content",id:g.id,title:`Content: ${g.name||"Kooperation"}`,subtitle:`${g.creator?.vorname} ${g.creator?.nachname}`,deadline:g.content_deadline,priority:this.getDeadlinePriority(g.content_deadline),url:`/kooperation/${g.id}`}))||[],...p?.map(g=>({type:"rechnung",id:g.id,title:`Rechnung ${g.rechnungs_nr}`,subtitle:g.unternehmen?.firmenname,deadline:g.zahlungsziel,priority:this.getDeadlinePriority(g.zahlungsziel),url:`/rechnung/${g.id}`}))||[]].sort((g,f)=>new Date(g.deadline)-new Date(f.deadline))}catch(e){console.error("❌ Fehler beim Laden der Deadlines:",e),this.data.deadlines=this.getMockDeadlines()}}async loadRecentActivity(){try{if(!window.supabase){this.data.recentActivity=this.getMockActivity();return}const e=new Date;e.setDate(e.getDate()-7);const t=e.toISOString(),[{data:n},{data:a},{data:r}]=await Promise.all([window.supabase.from("kampagne").select("id, kampagnenname, created_at, unternehmen:unternehmen_id(firmenname)").gte("created_at",t).order("created_at",{ascending:!1}).limit(5),window.supabase.from("auftrag").select("id, auftragsname, created_at, unternehmen:unternehmen_id(firmenname)").gte("created_at",t).order("created_at",{ascending:!1}).limit(5),window.supabase.from("briefings").select("id, product_service_offer, created_at, unternehmen:unternehmen_id(firmenname)").gte("created_at",t).order("created_at",{ascending:!1}).limit(5)]);this.data.recentActivity=[...n?.map(i=>({type:"kampagne",title:i.kampagnenname,subtitle:i.unternehmen?.firmenname,timestamp:i.created_at,url:`/kampagne/${i.id}`}))||[],...a?.map(i=>({type:"auftrag",title:i.auftragsname,subtitle:i.unternehmen?.firmenname,timestamp:i.created_at,url:`/auftrag/${i.id}`}))||[],...r?.map(i=>({type:"briefing",title:i.product_service_offer,subtitle:i.unternehmen?.firmenname,timestamp:i.created_at,url:`/briefing/${i.id}`}))||[]].sort((i,s)=>new Date(s.timestamp)-new Date(i.timestamp)).slice(0,8)}catch(e){console.error("❌ Fehler beim Laden der Aktivitäten:",e),this.data.recentActivity=this.getMockActivity()}}async loadAlerts(){try{if(!window.supabase){this.data.alerts=this.getMockAlerts();return}const e=new Date,t=[],{data:n}=await window.supabase.from("kampagne").select("id, kampagnenname, deadline").lt("deadline",e.toISOString()).neq("status_id","completed");n?.forEach(i=>{t.push({type:"error",title:"Überfällige Kampagne",message:`${i.kampagnenname} - Deadline überschritten`,url:`/kampagne/${i.id}`,timestamp:i.deadline})});const a=e.toISOString().split("T")[0],{data:r}=await window.supabase.from("kampagne").select("id, kampagnenname, deadline").eq("deadline",a);r?.forEach(i=>{t.push({type:"warning",title:"Deadline heute",message:`${i.kampagnenname} - heute fällig`,url:`/kampagne/${i.id}`,timestamp:i.deadline})}),this.data.alerts=t.slice(0,5)}catch(e){console.error("❌ Fehler beim Laden der Alerts:",e),this.data.alerts=this.getMockAlerts()}}async render(){const e=window.currentUser?.rolle==="pending"||window.currentUser?.isBlocked,t=window.currentUser?.blockReason||"Ihr Account wartet auf Freischaltung durch einen Administrator",n=`
      <div class="dashboard-container">
        <!-- Dashboard Header -->
        <div class="page-header">
          <div class="page-header-left">
            <h1>Dashboard</h1>
            <p>${e?t:"Überblick über alle wichtigen Kennzahlen und Deadlines"}</p>
          </div>
          <div class="page-header-right">
            ${e?"":`
            <button id="dashboard-refresh" class="secondary-btn">
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" style="width: 16px; height: 16px; margin-right: 8px;">
                <path stroke-linecap="round" stroke-linejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0 3.181 3.183a8.25 8.25 0 0 0 13.803-3.7M4.031 9.865a8.25 8.25 0 0 1 13.803-3.7l3.181 3.182m0-4.991v4.99" />
              </svg>
              Aktualisieren
            </button>
            `}
          </div>
        </div>

        ${e?this.renderPendingMessage():""}

        ${e?"":`
        <!-- KPI Cards -->
        <div class="dashboard-stats">
          ${this.renderStatsCards()}
        </div>

        <!-- Deadlines Section -->
        <div class="content-section">
          <div class="section-header">
            <h2>Anstehende Deadlines</h2>
            <span class="section-count">${this.data.deadlines.length} Einträge</span>
          </div>
          ${this.renderDeadlinesTable()}
        </div>

        <!-- Alerts Section -->
        <div class="content-section">
          <div class="section-header">
            <h2>Wichtige Hinweise</h2>
            <span class="section-count">${this.data.alerts.length} Einträge</span>
          </div>
          ${this.renderAlertsTable()}
        </div>

        <!-- Recent Activity Section -->
        <div class="content-section">
          <div class="section-header">
            <h2>Letzte Aktivitäten</h2>
            <span class="section-count">${this.data.recentActivity.length} Einträge</span>
          </div>
          ${this.renderRecentActivityTable()}
        </div>
        `}
      </div>
    `;window.setContentSafely(window.content,n)}renderPendingMessage(){return`
      <div class="content-section">
        <div class="pending-user-message">
          <div class="pending-icon">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" style="width: 48px; height: 48px;">
              <path stroke-linecap="round" stroke-linejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
            </svg>
          </div>
          <h3>Account wartet auf Freischaltung</h3>
          <p>Ihr Account wurde erfolgreich erstellt und wartet nun auf die Freischaltung durch einen Administrator.</p>
          <div class="pending-details">
            <div class="pending-info">
              <strong>Name:</strong> ${window.currentUser?.name||"Unbekannt"}
            </div>
            <div class="pending-info">
              <strong>E-Mail:</strong> Aus Sicherheitsgründen ausgeblendet
            </div>
            <div class="pending-info">
              <strong>Status:</strong> <span class="pending-status">Warten auf Freischaltung</span>
            </div>
          </div>
          <div class="pending-actions">
            <p><strong>Was passiert als nächstes?</strong></p>
            <ul>
              <li>Ein Administrator wird Ihren Account in Kürze überprüfen</li>
              <li>Sie erhalten eine E-Mail, sobald Ihr Account freigeschaltet wurde</li>
              <li>Nach der Freischaltung haben Sie Zugriff auf alle freigegebenen Module</li>
            </ul>
          </div>
          <div class="pending-contact">
            <p>Bei Fragen wenden Sie sich bitte an einen Administrator.</p>
          </div>
        </div>
      </div>
      
      <style>
        .pending-user-message {
          background: linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%);
          border: 2px solid #e2e8f0;
          border-radius: 12px;
          padding: 2rem;
          text-align: center;
          max-width: 600px;
          margin: 0 auto;
        }
        
        .pending-icon {
          margin-bottom: 1rem;
          color: #64748b;
        }
        
        .pending-user-message h3 {
          color: #1e293b;
          font-size: 1.5rem;
          margin-bottom: 0.5rem;
          font-weight: 600;
        }
        
        .pending-user-message > p {
          color: #64748b;
          font-size: 1.1rem;
          margin-bottom: 1.5rem;
          line-height: 1.6;
        }
        
        .pending-details {
          background: white;
          border-radius: 8px;
          padding: 1.5rem;
          margin: 1.5rem 0;
          text-align: left;
          border: 1px solid #e2e8f0;
        }
        
        .pending-info {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 0.5rem 0;
          border-bottom: 1px solid #f1f5f9;
        }
        
        .pending-info:last-child {
          border-bottom: none;
        }
        
        .pending-status {
          color: #f59e0b;
          font-weight: 600;
          background: #fef3c7;
          padding: 0.25rem 0.75rem;
          border-radius: 20px;
          font-size: 0.875rem;
        }
        
        .pending-actions {
          background: #f8fafc;
          border-radius: 8px;
          padding: 1.5rem;
          margin: 1.5rem 0;
          text-align: left;
        }
        
        .pending-actions p {
          margin-bottom: 1rem;
          color: #1e293b;
          font-weight: 600;
        }
        
        .pending-actions ul {
          list-style: none;
          padding: 0;
          margin: 0;
        }
        
        .pending-actions li {
          color: #64748b;
          padding: 0.5rem 0;
          position: relative;
          padding-left: 1.5rem;
        }
        
        .pending-actions li::before {
          content: "✓";
          position: absolute;
          left: 0;
          color: #10b981;
          font-weight: bold;
        }
        
        .pending-contact {
          margin-top: 1.5rem;
          padding-top: 1rem;
          border-top: 1px solid #e2e8f0;
          color: #64748b;
          font-size: 0.95rem;
        }
      </style>
    `}renderStatsCards(){const e=this.data.stats;return`
      <div class="stats-card">
        <div class="stats-icon">
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" d="M10.34 15.84c-.688-.06-1.386-.09-2.09-.09H7.5a4.5 4.5 0 1 1 0-9h.75c.704 0 1.402-.03 2.09-.09m0 9.18c.253.962.584 1.892.985 2.783.247.55.06 1.21-.463 1.511l-.657.38c-.551.318-1.26.117-1.527-.461a20.845 20.845 0 0 1-1.44-4.282m3.102.069a18.03 18.03 0 0 1-.59-4.59c0-1.586.205-3.124.59-4.59m0 9.18a23.848 23.848 0 0 1 8.835 2.535M10.34 6.66a23.847 23.847 0 0 0 8.835-2.535m0 0A23.74 23.74 0 0 0 18.795 3m.38 1.125a23.91 23.91 0 0 1 1.014 5.395m-1.014 8.855c-.118.38-.245.754-.38 1.125m.38-1.125a23.91 23.91 0 0 0 1.014-5.395m0-3.46c.495.413.811 1.035.811 1.73 0 .695-.316 1.317-.811 1.73m0-3.46a24.347 24.347 0 0 1 0 3.46" />
          </svg>
        </div>
        <div class="stats-content">
          <div class="stats-number">${e.kampagnen?.aktiv||0}</div>
          <div class="stats-label">Aktive Kampagnen</div>
          <div class="stats-sublabel">${e.kampagnen?.total||0} gesamt</div>
        </div>
        ${e.kampagnen?.ueberfaellig>0?`<div class="stats-alert">${e.kampagnen.ueberfaellig} überfällig</div>`:""}
      </div>

      <div class="stats-card">
        <div class="stats-icon">
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Z" />
          </svg>
        </div>
        <div class="stats-content">
          <div class="stats-number">${e.auftraege?.aktiv||0}</div>
          <div class="stats-label">Aktive Aufträge</div>
          <div class="stats-sublabel">${e.auftraege?.total||0} gesamt</div>
        </div>
        ${e.auftraege?.ueberfaellig>0?`<div class="stats-alert">${e.auftraege.ueberfaellig} überfällig</div>`:""}
      </div>

      <div class="stats-card">
        <div class="stats-icon">
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m0 11.625h4.5m-4.5 2.25h4.5m2.121 1.527c-1.171 1.464-3.07 1.464-4.242 0-1.172-1.465-1.172-3.84 0-5.304 1.171-1.464 3.07-1.464 4.242 0M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Z" />
          </svg>
        </div>
        <div class="stats-content">
          <div class="stats-number">${e.briefings?.offen||0}</div>
          <div class="stats-label">Offene Briefings</div>
          <div class="stats-sublabel">${e.briefings?.total||0} gesamt</div>
        </div>
        ${e.briefings?.ueberfaellig>0?`<div class="stats-alert">${e.briefings.ueberfaellig} überfällig</div>`:""}
      </div>

      <div class="stats-card">
        <div class="stats-icon">
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" d="M12 6v12m-3-2.818.879.659c1.171.879 3.07.879 4.242 0 1.172-.879 1.172-2.303 0-3.182C13.536 12.219 12.768 12 12 12s-1.536.219-2.121.659c-1.172.879-1.172 2.303 0 3.182.879.659 1.879.659 2.758 0L15 13.5M12 6V4.5" />
          </svg>
        </div>
        <div class="stats-content">
          <div class="stats-number">${e.rechnungen?.offen||0}</div>
          <div class="stats-label">Offene Rechnungen</div>
          <div class="stats-sublabel">${e.rechnungen?.total||0} gesamt</div>
        </div>
        ${e.rechnungen?.ueberfaellig>0?`<div class="stats-alert">${e.rechnungen.ueberfaellig} überfällig</div>`:""}
      </div>

      <div class="stats-card">
        <div class="stats-icon">
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" d="M15 19.128a9.38 9.38 0 0 0 2.625.372 9.337 9.337 0 0 0 4.121-.952 4.125 4.125 0 0 0-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 0 1 8.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0 1 11.964-3.07M12 6.375a3.375 3.375 0 1 1-6.75 0 3.375 3.375 0 0 1 6.75 0Zm8.25 2.25a2.625 2.625 0 1 1-5.25 0 2.625 2.625 0 0 1 5.25 0Z" />
          </svg>
        </div>
        <div class="stats-content">
          <div class="stats-number">${e.creator?.total||0}</div>
          <div class="stats-label">Creator</div>
          <div class="stats-sublabel">Im System</div>
        </div>
      </div>
    `}renderDeadlinesTable(){return this.data.deadlines.length?`
      <div class="data-table-container">
        <table class="data-table">
          <thead>
            <tr>
              <th>Typ</th>
              <th>Titel</th>
              <th>Unternehmen</th>
              <th>Deadline</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            ${this.data.deadlines.map(t=>{const n=Math.ceil((new Date(t.deadline)-new Date)/864e5),a=n<0,r=n===0,i=a?'<span class="status-badge danger">Überfällig</span>':r?'<span class="status-badge warning">Heute</span>':n<=3?'<span class="status-badge warning">Dringend</span>':'<span class="status-badge info">Normal</span>',s={kampagne:"Kampagne",briefing:"Briefing","kooperation-skript":"Skript","kooperation-content":"Content",rechnung:"Rechnung"}[t.type]||t.type;return`
        <tr class="table-row-clickable" onclick="window.navigateTo('${t.url}')">
          <td>
            <span class="type-badge type-${t.type}">${s}</span>
          </td>
          <td class="cell-main">
            <div class="cell-title">${t.title}</div>
          </td>
          <td>${t.subtitle||"-"}</td>
          <td>
            <div class="deadline-cell">
              <div class="deadline-date">${new Date(t.deadline).toLocaleDateString("de-DE")}</div>
              <div class="deadline-time">${a?`${Math.abs(n)} Tage überfällig`:r?"Heute fällig":`in ${n} Tagen`}</div>
            </div>
          </td>
          <td>${i}</td>
        </tr>
      `}).join("")}
          </tbody>
        </table>
      </div>
    `:`
        <div class="data-table-container">
          <table class="data-table">
            <thead>
              <tr>
                <th>Typ</th>
                <th>Titel</th>
                <th>Unternehmen</th>
                <th>Deadline</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td colspan="5" class="no-data">Keine anstehenden Deadlines</td>
              </tr>
            </tbody>
          </table>
        </div>
      `}renderAlertsTable(){return this.data.alerts.length?`
      <div class="data-table-container">
        <table class="data-table">
          <thead>
            <tr>
              <th>Typ</th>
              <th>Nachricht</th>
              <th>Zeit</th>
            </tr>
          </thead>
          <tbody>
            ${this.data.alerts.map(t=>{const n={error:'<span class="status-badge danger">Fehler</span>',warning:'<span class="status-badge warning">Warnung</span>',info:'<span class="status-badge info">Info</span>'}[t.type]||'<span class="status-badge info">Info</span>';return`
        <tr class="table-row-clickable" onclick="window.navigateTo('${t.url}')">
          <td>${n}</td>
          <td class="cell-main">
            <div class="cell-title">${t.title}</div>
            <div class="cell-subtitle">${t.message}</div>
          </td>
          <td>${this.formatTimeAgo(t.timestamp)}</td>
        </tr>
      `}).join("")}
          </tbody>
        </table>
      </div>
    `:`
        <div class="data-table-container">
          <table class="data-table">
            <thead>
              <tr>
                <th>Typ</th>
                <th>Nachricht</th>
                <th>Zeit</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td colspan="3" class="no-data">Keine wichtigen Hinweise</td>
              </tr>
            </tbody>
          </table>
        </div>
      `}renderRecentActivityTable(){return this.data.recentActivity.length?`
      <div class="data-table-container">
        <table class="data-table">
          <thead>
            <tr>
              <th>Typ</th>
              <th>Aktivität</th>
              <th>Unternehmen</th>
              <th>Zeit</th>
            </tr>
          </thead>
          <tbody>
            ${this.data.recentActivity.map(t=>{const n={kampagne:'<span class="type-badge type-kampagne">Kampagne</span>',auftrag:'<span class="type-badge type-auftrag">Auftrag</span>',briefing:'<span class="type-badge type-briefing">Briefing</span>',kooperation:'<span class="type-badge type-kooperation">Kooperation</span>'}[t.type]||`<span class="type-badge">${t.type}</span>`;return`
        <tr class="table-row-clickable" onclick="window.navigateTo('${t.url}')">
          <td>${n}</td>
          <td class="cell-main">
            <div class="cell-title">${t.title}</div>
          </td>
          <td>${t.subtitle||"-"}</td>
          <td>${this.formatTimeAgo(t.timestamp)}</td>
        </tr>
      `}).join("")}
          </tbody>
        </table>
      </div>
    `:`
        <div class="data-table-container">
          <table class="data-table">
            <thead>
              <tr>
                <th>Typ</th>
                <th>Aktivität</th>
                <th>Unternehmen</th>
                <th>Zeit</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td colspan="4" class="no-data">Keine letzten Aktivitäten</td>
              </tr>
            </tbody>
          </table>
        </div>
      `}getDeadlinePriority(e){const t=Math.ceil((new Date(e)-new Date)/864e5);return t<0?"overdue":t===0?"today":t<=3?"urgent":t<=7?"warning":"normal"}getAlertIcon(e){const t={error:'<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="M12 9v3.75m9-.75a9 9 0 1 1-18 0 9 9 0 0 1 18 0Zm-9 3.75h.008v.008H12v-.008Z" /></svg>',warning:'<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z" /></svg>',info:'<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="m11.25 11.25.041-.02a.75.75 0 0 1 1.063.852l-.708 2.836a.75.75 0 0 0 1.063.853l.041-.021M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Zm-9-3.75h.008v.008H12V8.25Z" /></svg>'};return t[e]||t.info}formatTimeAgo(e){const t=new Date,n=new Date(e),a=Math.floor((t-n)/1e3);return a<60?"Gerade eben":a<3600?`${Math.floor(a/60)}m`:a<86400?`${Math.floor(a/3600)}h`:a<604800?`${Math.floor(a/86400)}d`:n.toLocaleDateString("de-DE")}setupEventListeners(){const e=document.getElementById("dashboard-refresh");e&&e.addEventListener("click",()=>this.refresh())}async refresh(){await this.loadDashboardData(),await this.render()}startAutoRefresh(){this.refreshInterval=setInterval(()=>{this.refresh()},300*1e3)}destroy(){this.refreshInterval&&(clearInterval(this.refreshInterval),this.refreshInterval=null)}getMockStats(){return{kampagnen:{total:12,aktiv:8,ueberfaellig:2},auftraege:{total:15,aktiv:10,ueberfaellig:1},briefings:{total:8,offen:5,ueberfaellig:1},kooperationen:{total:25,aktiv:18},creator:{total:45},rechnungen:{total:20,offen:8,ueberfaellig:3}}}getMockDeadlines(){const e=new Date;return[{type:"kampagne",id:"1",title:"Summer Collection Campaign",subtitle:"Fashion Brand GmbH",deadline:new Date(e.getTime()+1440*60*1e3).toISOString(),priority:"urgent",url:"/kampagne/1"},{type:"briefing",id:"2",title:"Produktvorstellung Sneaker",subtitle:"Sports Company",deadline:new Date(e.getTime()+4320*60*1e3).toISOString(),priority:"warning",url:"/briefing/2"}]}getMockActivity(){return[{type:"kampagne",title:"Neue Kampagne erstellt",subtitle:"Fashion Brand GmbH",timestamp:new Date(Date.now()-7200*1e3).toISOString(),url:"/kampagne/1"},{type:"auftrag",title:"Auftrag abgeschlossen",subtitle:"Tech Startup",timestamp:new Date(Date.now()-14400*1e3).toISOString(),url:"/auftrag/2"}]}getMockAlerts(){return[{type:"error",title:"Überfällige Deadline",message:"Kampagne XY ist seit 2 Tagen überfällig",url:"/kampagne/1",timestamp:new Date().toISOString()},{type:"warning",title:"Deadline heute",message:"Briefing ABC muss heute fertig werden",url:"/briefing/2",timestamp:new Date().toISOString()}]}}const _e=new St;class $t{constructor(){this.user=null,this.isEditing=!1}async init(){await this.load(),await this.render(),this.bind()}async load(){try{if(!window.currentUser?.id)throw new Error("Kein Benutzer eingeloggt");const{data:e,error:t}=await window.supabase.from("benutzer").select(`
          *,
          mitarbeiter_klasse:mitarbeiter_klasse_id(name, description)
        `).eq("id",window.currentUser.id).single();if(t)throw t;this.user=e||{},console.log("✅ Profil geladen:",this.user)}catch(e){console.error("❌ Fehler beim Laden des Profils:",e),window.ErrorHandler.handle(e,"ProfileDetail.load")}}async render(){const e=document.getElementById("dashboard-content");if(!e){console.error("❌ dashboard-content Container nicht gefunden");return}e.innerHTML=`
      <div class="page-header">
        <div class="page-title">
          <h1>Mein Profil</h1>
          <p>Persönliche Informationen und Einstellungen</p>
        </div>
        <div class="page-actions">
          <button id="edit-profile-btn" class="btn btn-primary">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="w-5 h-5">
              <path stroke-linecap="round" stroke-linejoin="round" d="m16.862 4.487 1.687-1.688a1.875 1.875 0 1 1 2.652 2.652L10.582 16.07a4.5 4.5 0 0 1-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 0 1 1.13-1.897l8.932-8.931Zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0 1 15.75 21H5.25A2.25 2.25 0 0 1 3 18.75V8.25A2.25 2.25 0 0 1 5.25 6H10" />
            </svg>
            Profil bearbeiten
          </button>
        </div>
      </div>

      <div class="detail-container">
        <div class="detail-grid">
          <!-- Profil-Informationen -->
          <div class="detail-section">
            <h2>Persönliche Informationen</h2>
            <div class="detail-grid-two">
              <div class="detail-field">
                <label>Name</label>
                <div class="detail-value" id="profile-name">
                  ${this.isEditing?`
                    <input type="text" id="name-input" class="form-input" value="${this.user.name||""}" placeholder="Vollständiger Name">
                  `:this.user.name||"Nicht angegeben"}
                </div>
              </div>
              
              <div class="detail-field">
                <label>E-Mail</label>
                <div class="detail-value">${this.user.auth_user_id?"Über Supabase Auth verwaltet":"Nicht angegeben"}</div>
              </div>
              
              <div class="detail-field">
                <label>Rolle</label>
                <div class="detail-value">
                  <span class="badge badge-${this.user.rolle?.toLowerCase()==="admin"?"primary":"secondary"}">
                    ${this.user.rolle||"Nicht definiert"}
                  </span>
                </div>
              </div>
              
              <div class="detail-field">
                <label>Unterrolle</label>
                <div class="detail-value">
                  ${this.user.unterrolle?`<span class="badge badge-outline">${this.user.unterrolle}</span>`:"Keine"}
                </div>
              </div>
              
              <div class="detail-field">
                <label>Mitarbeiter-Klasse</label>
                <div class="detail-value">
                  ${this.user.mitarbeiter_klasse?.name||"Nicht zugewiesen"}
                </div>
              </div>
              
              <div class="detail-field">
                <label>Erstellt am</label>
                <div class="detail-value">${this.formatDate(this.user.created_at)}</div>
              </div>
            </div>
            
            ${this.isEditing?`
              <div class="form-actions">
                <button id="save-profile-btn" class="btn btn-primary">
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="w-5 h-5">
                    <path stroke-linecap="round" stroke-linejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                  </svg>
                  Speichern
                </button>
                <button id="cancel-edit-btn" class="btn btn-secondary">Abbrechen</button>
              </div>
            `:""}
          </div>

          <!-- Berechtigungen -->
          <div class="detail-section">
            <h2>Berechtigungen</h2>
            <div class="permissions-grid">
              ${this.renderPermissions()}
            </div>
          </div>
        </div>
      </div>
    `}renderProfileInfo(){return`
      <div class="detail-section">
        <h2>Persönliche Informationen</h2>
        <div class="detail-grid-two">
          <div class="detail-field">
            <label>Name</label>
            <div class="detail-value">${this.user?.name||"Nicht angegeben"}</div>
          </div>
          
          <div class="detail-field">
            <label>E-Mail</label>
            <div class="detail-value">${this.user?.auth_user_id?"Über Supabase Auth verwaltet":"Nicht angegeben"}</div>
          </div>
          
          <div class="detail-field">
            <label>Rolle</label>
            <div class="detail-value">
              <span class="badge badge-${this.user?.rolle?.toLowerCase()==="admin"?"primary":"secondary"}">
                ${this.user?.rolle||"Nicht definiert"}
              </span>
            </div>
          </div>
          
          <div class="detail-field">
            <label>Unterrolle</label>
            <div class="detail-value">
              ${this.user?.unterrolle?`<span class="badge badge-outline">${this.user.unterrolle}</span>`:"Keine"}
            </div>
          </div>
          
          <div class="detail-field">
            <label>Mitarbeiter-Klasse</label>
            <div class="detail-value">
              ${this.user?.mitarbeiter_klasse?.name||"Nicht zugewiesen"}
            </div>
          </div>
          
          <div class="detail-field">
            <label>Erstellt am</label>
            <div class="detail-value">${this.formatDate(this.user?.created_at)}</div>
          </div>
        </div>
      </div>
    `}renderEditForm(){return`
      <div class="detail-section">
        <h2>Profil bearbeiten</h2>
        <div class="detail-grid-two">
          <div class="detail-field">
            <label for="name-input">Name *</label>
            <input type="text" id="name-input" class="form-input" value="${this.user?.name||""}" placeholder="Vollständiger Name">
          </div>
          
          <div class="detail-field">
            <label>E-Mail</label>
            <div class="detail-value text-muted">Über Supabase Auth verwaltet</div>
          </div>
          
          <div class="detail-field">
            <label>Rolle</label>
            <div class="detail-value text-muted">Wird vom Administrator verwaltet</div>
          </div>
          
          <div class="detail-field">
            <label>Unterrolle</label>
            <div class="detail-value text-muted">Wird vom Administrator verwaltet</div>
          </div>
        </div>
        
        <div class="form-actions">
          <button id="save-profile-btn" class="btn btn-primary">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="w-5 h-5">
              <path stroke-linecap="round" stroke-linejoin="round" d="M4.5 12.75l6 6 9-13.5" />
            </svg>
            Speichern
          </button>
          <button id="cancel-edit-btn" class="btn btn-secondary">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="w-5 h-5">
              <path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
            Abbrechen
          </button>
        </div>
      </div>
    `}renderPermissions(){if(!this.user?.zugriffsrechte)return`
        <div class="detail-section">
          <h2>Meine Berechtigungen</h2>
          <div class="empty-state">
            <p>Keine Berechtigungen definiert.</p>
          </div>
        </div>
      `;const e=this.user.zugriffsrechte;return`
      <div class="detail-section">
        <h2>Meine Berechtigungen</h2>
        <p class="text-muted">Diese Berechtigungen werden vom Administrator verwaltet.</p>
        <div class="data-table-container">
          <table class="data-table">
            <thead>
              <tr>
                <th>Bereich</th>
                <th style="width:100px; text-align:center;">Lesen</th>
                <th style="width:100px; text-align:center;">Bearbeiten</th>
                <th style="width:100px; text-align:center;">Löschen</th>
              </tr>
            </thead>
            <tbody>
              ${[{key:"creator",label:"Creator"},{key:"creator-lists",label:"Creator-Listen"},{key:"unternehmen",label:"Unternehmen"},{key:"marke",label:"Marken"},{key:"auftrag",label:"Aufträge"},{key:"kampagne",label:"Kampagnen"},{key:"kooperation",label:"Kooperationen"},{key:"briefing",label:"Briefings"},{key:"rechnung",label:"Rechnungen"},{key:"ansprechpartner",label:"Ansprechpartner"}].map(n=>{const a=e[n.key],r=a?.can_view!==!1,i=a?.can_edit===!0,s=a?.can_delete===!0;return`
                  <tr>
                    <td>${n.label}</td>
                    <td style="text-align:center;">
                      <span class="permission-indicator ${r?"granted":"denied"}">
                        ${r?"✓":"✗"}
                      </span>
                    </td>
                    <td style="text-align:center;">
                      <span class="permission-indicator ${i?"granted":"denied"}">
                        ${i?"✓":"✗"}
                      </span>
                    </td>
                    <td style="text-align:center;">
                      <span class="permission-indicator ${s?"granted":"denied"}">
                        ${s?"✓":"✗"}
                      </span>
                    </td>
                  </tr>
                `}).join("")}
            </tbody>
          </table>
        </div>
      </div>
    `}getEntityLabel(e){return{creator:"Creator",kampagne:"Kampagnen",kooperation:"Kooperationen",briefing:"Briefings",rechnung:"Rechnungen",unternehmen:"Unternehmen",marke:"Marken",auftrag:"Aufträge",ansprechpartner:"Ansprechpartner"}[e]||e}bind(){const e=document.querySelectorAll(".tab-btn"),t=document.querySelectorAll(".tab-pane");e.forEach(n=>{n.addEventListener("click",()=>{const a=n.dataset.tab;e.forEach(r=>r.classList.remove("active")),t.forEach(r=>r.classList.remove("active")),n.classList.add("active"),document.getElementById(`tab-${a}`)?.classList.add("active")})}),document.getElementById("edit-profile-btn")?.addEventListener("click",()=>{this.isEditing=!this.isEditing,this.render()}),document.getElementById("save-profile-btn")?.addEventListener("click",async()=>{await this.saveProfile()}),document.getElementById("cancel-edit-btn")?.addEventListener("click",()=>{this.isEditing=!1,this.render()})}async saveProfile(){try{const t=document.getElementById("name-input")?.value?.trim();if(!t){alert("Name darf nicht leer sein");return}const{error:n}=await window.supabase.from("benutzer").update({name:t,updated_at:new Date().toISOString()}).eq("id",this.user.id);if(n)throw n;window.currentUser.name=t,this.user.name=t,window.setupHeaderUI?.(),this.isEditing=!1,await this.render(),alert("Profil erfolgreich aktualisiert"),console.log("✅ Profil gespeichert")}catch(e){console.error("❌ Fehler beim Speichern:",e),alert("Fehler beim Speichern des Profils")}}formatDate(e){return e?new Date(e).toLocaleDateString("de-DE",{year:"numeric",month:"long",day:"numeric",hour:"2-digit",minute:"2-digit"}):"Unbekannt"}destroy(){console.log("ProfileDetail: Cleaning up...")}}class At{constructor(){this.modules=new Map,this.currentModule=null}register(e,t){this.modules.set(e,t)}navigateTo(e){const n=e.replace(/^\//,"").split("/"),[a,r,i]=n;this.currentModule&&this.currentModule.destroy&&(console.log("🗑️ Zerstöre aktuelles Modul:",this.currentModule.constructor.name),this.currentModule.destroy(),this.currentModule=null);let s=a,o=this.modules.get(s),l=i==="edit";if(r&&a==="creator"&&r!=="new"&&(s="creator-detail",o=this.modules.get(s),console.log(`🎯 Creator-Details erkannt, verwende Modul: ${s}`)),a==="creator-lists"&&r&&(s="creator-list-detail",o=this.modules.get(s),console.log("🎯 Creator-Listen-Detail erkannt")),r&&a==="mitarbeiter"&&r!=="new"&&(s="mitarbeiter-detail",o=this.modules.get(s),console.log(`🎯 Mitarbeiter-Details erkannt, verwende Modul: ${s}`)),r&&a==="marke"&&r!=="new"&&(s="marke-detail",o=this.modules.get(s),console.log(`🎯 Marken-Details erkannt, verwende Modul: ${s}`)),r==="neu"&&a==="unternehmen"?(s="unternehmen-create",o=this.modules.get(s),console.log(`🎯 Unternehmen-Erstellung erkannt, verwende Modul: ${s}`)):r&&a==="unternehmen"&&r!=="new"&&r!=="neu"&&(s="unternehmen-detail",o=this.modules.get(s),console.log(`🎯 Unternehmen-Details erkannt, verwende Modul: ${s}`)),r&&a==="auftrag"&&r!=="new"&&(s="auftrag-detail",o=this.modules.get(s),console.log(`🎯 Auftrags-Details erkannt, verwende Modul: ${s}`)),r&&a==="kooperation"&&r!=="new"&&(s="kooperation-detail",o=this.modules.get(s),console.log(`🎯 Kooperations-Details erkannt, verwende Modul: ${s}`)),r&&a==="video"&&r!=="new"&&(s="kooperation-video-detail",o=this.modules.get(s),console.log(`🎯 Video-Details erkannt, verwende Modul: ${s}`)),r&&a==="kampagne"&&r!=="new"&&(s="kampagne-detail",o=this.modules.get(s),console.log(`🎯 Kampagnen-Details erkannt, verwende Modul: ${s}`)),r&&a==="briefing"&&r!=="new"&&(s="briefing-detail",o=this.modules.get(s),console.log(`🎯 Briefing-Details erkannt, verwende Modul: ${s}`)),r&&a==="rechnung"&&r!=="new"&&(s="rechnung-detail",o=this.modules.get(s),console.log(`🎯 Rechnung-Details erkannt, verwende Modul: ${s}`)),r&&a==="ansprechpartner"&&(s="ansprechpartner-detail",o=this.modules.get(s),console.log(`🎯 Ansprechpartner-Details/Erstellung erkannt, verwende Modul: ${s}`)),o){if(console.log(`✅ Modul gefunden: ${s}`,o),this.currentModule=o,r==="new")return a==="rechnung"?(s="rechnung-detail",o=this.modules.get(s),o.init?.("new")):(console.log(`📝 Zeige Erstellungsformular für: ${a}`),s.includes("-detail")?o.init?.("new"):o.showCreateForm?.());if(r)if(l){if(console.log(`✏️ Zeige Edit-Formular für: ${a}/${r}`),o&&o.init){o.init(r).then(()=>{o.showEditForm&&o.showEditForm()});return}}else return console.log(`👁️ Zeige Details für: ${a}/${r}`),o.init?.(r);else return console.log(`🚀 Initialisiere Modul: ${a}`),o.init()}else console.warn(`❌ Modul nicht gefunden: ${s}`),this.loadDashboard()}loadDashboard(){const e=this.modules.get("dashboard");e?(this.currentModule=e,e.init()):(window.setHeadline("Dashboard"),window.content.innerHTML=`
        <div class="dashboard">
          <h1>Willkommen im CRM</h1>
          <p>Dashboard wird geladen...</p>
        </div>
      `)}}const $=new At;window.moduleRegistry=$;$.register("creator",Z);$.register("creator-detail",G);$.register("creator-lists",Te);$.register("creator-list-detail",xe);$.register("unternehmen",W);$.register("unternehmen-create",Y);$.register("auftrag",J);$.register("marke",Q);$.register("marke-detail",X);$.register("marke-create",U);$.register("unternehmen-detail",ce);$.register("auftrag-detail",ue);$.register("kooperation",he);$.register("kooperation-detail",me);$.register("kooperation-video-detail",pe);$.register("kampagne",ge);$.register("kampagne-detail",fe);$.register("ansprechpartner",we);$.register("ansprechpartner-detail",ke);$.register("ansprechpartner-create",H);$.register("briefing",be);$.register("briefing-detail",ve);$.register("rechnung",gt);$.register("rechnung-detail",bt);$.register("mitarbeiter",wt);$.register("mitarbeiter-detail",yt);$.register("dashboard",_e);const Se=new $t;window.profileDetail=Se;$.register("profile",Se);window.navigateTo=b=>{$.navigateTo(b)};window.filterSystem=_;window.creatorList=Z;window.creatorDetail=G;window.unternehmenList=W;window.unternehmenCreate=Y;window.auftragList=J;window.markeList=Q;window.markeDetail=X;window.markeCreate=U;window.unternehmenDetail=ce;window.auftragDetail=ue;window.kooperationList=he;window.kooperationDetail=me;window.kooperationVideoDetail=pe;window.kampagneList=ge;window.kampagneDetail=fe;window.briefingDetail=ve;window.kampagneUtils=lt;window.briefingList=be;window.AuthService=K;window.AuthUtils=q;window.authService=K;window.authUtils=q;window.navigationSystem=ee;window.permissionSystem=Le;window.dataService=x;window.validatorSystem=T;window.creatorUtils=ne;window.formSystem=le;window.newFormSystem=new de;window.notizenSystem=Qe;window.bewertungsSystem=et;window.ActionsDropdown=L;window.bulkActionSystem=ye;window.notificationSystem=Ee;window.ansprechpartnerList=we;window.ansprechpartnerDetail=ke;window.ansprechpartnerCreate=H;window.dashboardModule=_e;document.addEventListener("DOMContentLoaded",async()=>{if(console.log("🎯 Initialisiere Event-basiertes Modul-System..."),window.appRoot=document.getElementById("app-root"),window.loginRoot=document.getElementById("login-root"),window.content=document.getElementById("dashboard-content"),window.nav=document.getElementById("main-nav"),window.supabase&&window.CONFIG?.SUPABASE?.URL&&window.CONFIG?.SUPABASE?.KEY)try{window.supabase=window.supabase.createClient(window.CONFIG.SUPABASE.URL,window.CONFIG.SUPABASE.KEY),console.log("✅ Supabase initialisiert")}catch(e){console.error("❌ Supabase-Initialisierung fehlgeschlagen:",e)}else console.warn("⚠️ Supabase nicht verfügbar - verwende Offline-Modus");if(await K.checkAuth()){console.log("✅ Benutzer ist authentifiziert"),ee.init(),L.init(),ye.init(),Ee.init(),window.appRoot.style.display="",window.loginRoot.style.display="none";const e=location.pathname;e==="/"||e==="/dashboard"?$.loadDashboard():$.navigateTo(e),window.setupHeaderUI?.()}else console.log("🔐 Benutzer nicht authentifiziert - zeige Login"),q.showLogin()});window.handleLogout=async()=>{try{await K.signOut()}catch(b){console.warn("Logout warn:",b)}finally{window.appRoot&&(window.appRoot.style.display="none"),window.loginRoot&&(window.loginRoot.style.display="");const b=document.getElementById("mitarbeiterPanelOverlay"),e=document.getElementById("mitarbeiterPanel");b&&(b.style.display="none"),e&&(e.style.display="none"),q.showLogin?.()}};window.setupHeaderUI=()=>{try{const b=document.querySelector(".profile-img"),e=document.querySelector(".profile-initials"),t=(window.currentUser?.name||"").trim();if(t&&e){const s=t.split(/\s+/).filter(Boolean),o=(s[0]?.[0]||"").toUpperCase()+(s[1]?.[0]||"").toUpperCase();e.textContent=o||(t[0]||"?").toUpperCase()}window.currentUser?.avatar_url&&b&&(b.src=window.currentUser.avatar_url,b.style.display="",e&&(e.style.display="none"));const n=document.querySelector(".profile-btn"),a=document.querySelector(".profile-dropdown");n&&a&&!n.dataset.bound&&(n.dataset.bound="true",n.addEventListener("click",s=>{s.stopPropagation();const o=a.getAttribute("aria-hidden")==="false";a.setAttribute("aria-hidden",o?"true":"false"),n.setAttribute("aria-expanded",o?"false":"true")}),a.addEventListener("click",s=>{const o=s.target.closest("[data-action]")?.dataset.action;o&&(s.preventDefault(),a.setAttribute("aria-hidden","true"),n.setAttribute("aria-expanded","false"),o==="view-profile"&&$.navigateTo("/profile"))}),document.addEventListener("click",()=>{a.setAttribute("aria-hidden","true"),n.setAttribute("aria-expanded","false")}));const r=document.querySelector(".quick-menu-btn"),i=document.querySelector(".quick-menu-dropdown");if(r&&i&&!r.dataset.bound){const s=()=>{i.classList.remove("show"),r.setAttribute("aria-expanded","false")};r.addEventListener("click",l=>{l.preventDefault();const c=i.classList.toggle("show");r.setAttribute("aria-expanded",String(c))}),document.addEventListener("click",l=>{!i.contains(l.target)&&!r.contains(l.target)&&s()});const o={unternehmen:"unternehmen",marke:"marke",auftrag:"auftrag",ansprechpartner:"ansprechpartner",kampagne:"kampagne",briefing:"briefing",kooperation:"kooperation",creator:"creator"};i.querySelectorAll(".quick-menu-item").forEach(l=>{const c=l.getAttribute("data-entity"),d=o[c],u=d?!!window.permissionSystem?.getEntityPermissions(d)?.can_edit:!1;l.style.display=u||window.currentUser?.rolle==="admin"?"":"none"}),i.addEventListener("click",l=>{const c=l.target.closest(".quick-menu-item");if(!c)return;const d=c.getAttribute("data-entity");if(d){switch(d){case"unternehmen":window.navigateTo("/unternehmen/neu");break;case"marke":window.navigateTo("/marke/new");break;case"auftrag":window.navigateTo("/auftrag/new");break;case"ansprechpartner":window.navigateTo("/ansprechpartner/new");break;case"kampagne":window.navigateTo("/kampagne/new");break;case"briefing":window.navigateTo("/briefing/new");break;case"kooperation":window.navigateTo("/kooperation/new");break;case"creator":window.navigateTo("/creator/new");break}s()}}),r.dataset.bound="true"}}catch(b){console.warn("Header/Quick-Menu setup warn:",b)}};
