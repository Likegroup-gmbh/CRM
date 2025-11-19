async function g(n,a,t,e,i){if(!n||!i)return;const r=Array.isArray(n)?n:n.filters||[],c=(await v(r)).map(s=>{const d=a[s.id];return $(s,d)}).join("");Object.keys(a).length>0&&Object.values(a).some(s=>s&&(Array.isArray(s)?s.length>0:s!==""));const o=`
    <div class="filter-section">
      <div class="filter-row">
        ${c}
      </div>
    </div>
  `;i.innerHTML=o,h(t,e)}function f(n){if(!n)return;const a=n.tagName==="TBODY"?n:null,t=`
    <div class="empty-state not-found">
        <img src="https://www.dropbox.com/scl/fi/6fgrk4u4aync0qfo0mcod/noti_not_found.svg?rlkey=x0idfb8fjl6kpp7850fkp8tto&raw=1" />
      <p>Leider konnten keine Einträge gefunden werden</p>
    </div>
  `;if(a){const e=a.parentElement?.querySelector("thead tr")?.children?.length||1;a.innerHTML=`<tr><td colspan="${e}">${t}</td></tr>`}else n.innerHTML=t}async function v(n){const a=[];for(const t of n)if(t.dynamic||t.table)try{const e=await y(t);a.push({...t,options:e})}catch(e){console.error(`❌ Fehler beim Laden der dynamischen Daten für Filter ${t.id}:`,e),a.push(t)}else a.push(t);return a}async function y(n){if(!window.supabase)return console.warn("⚠️ Supabase nicht verfügbar"),[];try{let a,t,e;if(n.table)a=n.table,t=n.displayField||"name",e=n.valueField||"id";else switch(n.id){case"creator_type_id":a="creator_type",t="name",e="id";break;case"sprache_id":a="sprachen",t="name",e="id";break;case"branche_id":a="branchen_creator",t="name",e="id";break;case"unternehmen_id":a="unternehmen",t="firmenname",e="id";break;case"marke_id":a="marke",t="markenname",e="id";break;case"auftrag_id":a="auftrag",t="auftragsname",e="id";break;case"kampagne_id":a="kampagne",t="kampagnenname",e="id";break;default:return console.warn(`⚠️ Unbekannter Filter-Typ: ${n.id}`),[]}const{data:i,error:r}=await window.supabase.from(a).select(`${e}, ${t}`).order(t);return r?(console.error(`❌ Fehler beim Laden der Filter-Optionen für ${a}:`,r),[]):i.map(l=>({value:l[e],label:l[t]}))}catch(a){return console.error("❌ Fehler beim Laden der Filter-Optionen:",a),[]}}function $(n,a){const t=`filter-${n.id}`;switch(n.type){case"text":return`
        <div class="filter-group">
          <input type="text" id="${t}" name="${n.id}" 
                 placeholder="${n.placeholder||""}" 
                 value="${a||""}" class="input">
        </div>
      `;case"select":const i=(n.options||[]).map(s=>{let d,m;typeof s=="object"?(d=s.value||s.id,m=s.label||s.name):(d=s,m=s);const p=String(a)===String(d);return`<option value="${d}" ${p?"selected":""}>${m}</option>`}).join(""),r=n.placeholder||`${n.label} auswählen...`;return`
        <div class="filter-group">
          <select id="${t}" name="${n.id}" class="input">
            <option value="">${r}</option>
            ${i}
          </select>
        </div>
      `;case"tag-input":const l=a?Array.isArray(a)?a:String(a).split(",").map(s=>s.trim()).filter(Boolean):[],c=l.map(s=>`<span class="tag">
          ${s}
          <button type="button" class="tag-remove" data-tag="${s}" data-field="${n.id}">×</button>
        </span>`).join("");return`
        <div class="filter-group">
          <div class="tag-input-container">
            <input type="text" id="${t}" class="input" placeholder="${n.placeholder||""}">
            <div id="${t}-tags" class="tag-container">
              ${c}
            </div>
            <input type="hidden" name="${n.id}" id="${t}-hidden" value="${l.join(",")}">
          </div>
        </div>
      `;case"range":const o=a||{};return`
        <div class="filter-group">
          <div class="range-container">
            <input type="range" id="${t}-min" name="${n.id}_min" 
                   min="${n.min}" max="${n.max}" step="${n.step}" 
                   value="${o.min||n.min}" class="range-input">
            <input type="range" id="${t}-max" name="${n.id}_max" 
                   min="${n.min}" max="${n.max}" step="${n.step}" 
                   value="${o.max||n.max}" class="range-input">
            <div class="range-values">
              <span id="${t}-min-value">${u(o.min||n.min)}</span>
              <span>bis</span>
              <span id="${t}-max-value">${u(o.max||n.max)}</span>
            </div>
          </div>
        </div>
      `;case"date":return`
        <div class="filter-group">
          <input type="date" id="${t}" name="${n.id}" 
                 value="${a||""}" class="input">
        </div>
      `;default:return""}}function u(n){return n>=1e6?`${(n/1e6).toFixed(1)}M`:n>=1e3?`${(n/1e3).toFixed(1)}K`:n.toLocaleString("de-DE")}function h(n,a){let t=()=>{const e=new FormData;document.querySelectorAll("#filter-container input, #filter-container select").forEach(r=>{r.value&&e.append(r.name,r.value)});const i=x(e);n&&n(i)};document.getElementById("btn-filter-reset")?.addEventListener("click",()=>{document.querySelectorAll("#filter-container input, #filter-container select").forEach(e=>{e.value=""}),document.querySelectorAll(".range-input").forEach(e=>{e.name.includes("_min"),e.name.replace("_min","").replace("_max","")}),a&&a()}),document.querySelectorAll(".range-input").forEach(e=>{e.addEventListener("input",i=>{const r=i.target.name.replace("_min","").replace("_max",""),l=i.target.name.includes("_min"),c=parseInt(i.target.value),o=document.getElementById(`${r}-${l?"min":"max"}-value`);o&&(o.textContent=u(c)),clearTimeout(e.autoFilterTimeout),e.autoFilterTimeout=setTimeout(t,300)})}),document.querySelectorAll("#filter-container select").forEach(e=>{e.addEventListener("change",()=>{clearTimeout(e.autoFilterTimeout),e.autoFilterTimeout=setTimeout(t,100)})}),document.querySelectorAll('#filter-container input[type="text"]').forEach(e=>{e.closest(".tag-input-container")||e.addEventListener("input",()=>{clearTimeout(e.autoFilterTimeout),e.autoFilterTimeout=setTimeout(t,500)})}),document.querySelectorAll('input[type="text"]').forEach(e=>{e.closest(".tag-input-container")&&e.addEventListener("keydown",i=>{if(i.key==="Enter"){i.preventDefault();const r=i.target.value.trim();r&&(b(i.target,r),i.target.value="",setTimeout(t,100))}})}),document.querySelectorAll(".tag-remove").forEach(e=>{e.addEventListener("click",i=>{const r=i.target.dataset.tag,l=i.target.dataset.field;F(l,r),setTimeout(t,100)})})}function b(n,a){const t=n.id,e=document.getElementById(`${t}-tags`),i=document.getElementById(`${t}-hidden`);if(e&&i){if(Array.from(e.querySelectorAll(".tag")).map(o=>o.textContent.replace("×","").trim()).includes(a))return;const l=document.createElement("span");l.className="tag",l.innerHTML=`
      ${a}
      <button type="button" class="tag-remove" data-tag="${a}" data-field="${t.replace("filter-","")}">×</button>
    `,e.appendChild(l);const c=Array.from(e.querySelectorAll(".tag")).map(o=>o.textContent.replace("×","").trim());i.value=c.join(",")}}function F(n,a){const t=`filter-${n}`,e=document.getElementById(`${t}-tags`),i=document.getElementById(`${t}-hidden`);if(e&&i){e.querySelectorAll(".tag").forEach(c=>{c.textContent.replace("×","").trim()===a&&c.remove()});const l=Array.from(e.querySelectorAll(".tag")).map(c=>c.textContent.replace("×","").trim());i.value=l.join(",")}}function x(n){const a={};for(const[t,e]of n.entries())if(e)if(t.includes("_min")||t.includes("_max")){const i=t.replace("_min","").replace("_max","");a[i]||(a[i]={}),t.includes("_min")?a[i].min=parseInt(e):a[i].max=parseInt(e)}else if(["sprachen","branche","lieferadresse_land","bundesland"].includes(t)){const i=e.split(",").map(r=>r.trim()).filter(r=>r);i.length>0&&(a[t]=i)}else a[t]=e;return a}const _=Object.freeze(Object.defineProperty({__proto__:null,renderEmptyState:f,renderFilterBar:g},Symbol.toStringTag,{value:"Module"}));function E(n){const a={};for(const[t,e]of n.entries())if(e)if(t.includes("_min")||t.includes("_max")){const i=t.replace("_min","").replace("_max","");a[i]||(a[i]={}),t.includes("_min")?a[i].min=parseInt(e):a[i].max=parseInt(e)}else if(["lieferadresse_land","bundesland"].includes(t)){const i=e.split(",").map(r=>r.trim()).filter(r=>r);i.length>0&&(a[t]=i)}else a[t]=String(e);return a}function T(){return{}}export{_ as F,E as p,T as r};
