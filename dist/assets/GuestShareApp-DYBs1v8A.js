import{p as k}from"./auth-DqylGLjk.js";const C={kampagne:n=>`/kampagne/${n}`,sourcing:n=>`/sourcing/${n}`,strategie:n=>`/strategie/${n}`},E={kampagne:"Kampagne",sourcing:"Sourcing-Liste",strategie:"Strategie-Liste"};async function $(n){const t=document.getElementById("login-root"),i=document.getElementById("app-root");i&&(i.style.display="none"),t&&(t.style.display=""),g(t,"Link wird geprüft …");let o;try{const{data:e,error:l}=await window.supabase.functions.invoke("share-list",{body:{action:"resolve",token:n}});if(l){const c=await x(l);g(t,c||"Dieser Link ist ungültig oder wurde widerrufen.",!0);return}o=e}catch(e){console.error("Share-Resolve fehlgeschlagen:",e),g(t,"Der Link konnte nicht geprüft werden. Bitte später erneut versuchen.",!0);return}if(!o?.valid){g(t,o?.error||"Dieser Link ist ungültig oder wurde widerrufen.",!0);return}const{data:{session:a}}=await window.supabase.auth.getSession();if(a){if((a.user.email||"").toLowerCase()===o.email.toLowerCase()){await L(n,o);return}await window.supabase.auth.signOut()}_(t,n,o)}function _(n,t,i){const o=E[i.entityType]||"Liste";n.innerHTML=`
    <div class="login-split-container">
      <div class="login-left">
        <div class="login-box auth-card">
          <div class="login-logo-wrapper">
            <img src="/assets/background/Logo-Icon-gray.svg" alt="Logo" class="login-logo">
          </div>
          <h1 class="auth-title">Geteilte ${o}</h1>

          <div id="guest-step-name">
            <p class="auth-subtitle">Dieser Zugang ist bestimmt für:</p>
            <div class="email-address">${p(i.email)}</div>
            <div class="form-box guest-form">
              <label class="label" for="guest-name-input">Ihr Name</label>
              <input type="text" id="guest-name-input" class="input" placeholder="Vor- und Nachname"
                     value="${p(i.gastName||"")}" autocomplete="name">
            </div>
            <button id="guest-send-code" class="verify-button">Code anfordern</button>
            <p class="guest-onboarding-note">
              Zur Bestätigung senden wir einen 6-stelligen Code an diese E-Mail-Adresse.
              Ein Account oder Passwort ist nicht nötig.
            </p>
          </div>

          <div id="guest-step-code" style="display:none;">
            <p class="auth-subtitle">Wir haben einen 6-stelligen Code gesendet an:</p>
            <div class="email-address">${p(i.email)}</div>
            <div class="otp-container">
              <div class="otp-inputs" id="guest-otp-inputs">
                <input type="text" class="otp-input" maxlength="1" inputmode="numeric" autocomplete="off">
                <input type="text" class="otp-input" maxlength="1" inputmode="numeric" autocomplete="off">
                <input type="text" class="otp-input" maxlength="1" inputmode="numeric" autocomplete="off">
                <input type="text" class="otp-input" maxlength="1" inputmode="numeric" autocomplete="off">
                <input type="text" class="otp-input" maxlength="1" inputmode="numeric" autocomplete="off">
                <input type="text" class="otp-input" maxlength="1" inputmode="numeric" autocomplete="off">
              </div>
              <button id="guest-verify-code" class="verify-button">Code bestätigen</button>
            </div>
            <div class="resend-container">
              <span class="resend-text">Code nicht erhalten? </span>
              <button id="guest-resend-code" class="resend-button">Code erneut senden</button>
            </div>
          </div>

          <div id="guest-error" class="auth-alert auth-alert--error" style="display:none;"></div>
        </div>
      </div>
      <div class="login-right"></div>
    </div>
  `;const a=document.getElementById("guest-name-input"),e=Array.from(n.querySelectorAll(".otp-input")),l=document.getElementById("guest-error"),c=s=>{l.textContent=s,l.style.display=""},m=()=>{l.style.display="none"},f=()=>e.map(s=>s.value).join(""),y=()=>{e.forEach(s=>{s.classList.remove("filled","error"),s.value&&s.classList.add("filled")})},b=(s=!0)=>{e.forEach(r=>{r.value=""}),y(),s&&e[0].focus()},v=async(s,r)=>{if(m(),!a.value.trim()){c("Bitte geben Sie Ihren Namen ein.");return}s.disabled=!0,s.textContent="Wird gesendet …";const{error:u}=await window.supabase.auth.signInWithOtp({email:i.email,options:{shouldCreateUser:!1}});if(s.disabled=!1,s.textContent=r,u){console.error("OTP-Versand fehlgeschlagen:",u),c("Der Code konnte nicht gesendet werden. Bitte kurz warten und erneut versuchen.");return}document.getElementById("guest-step-name").style.display="none",document.getElementById("guest-step-code").style.display="",b()};document.getElementById("guest-send-code").addEventListener("click",s=>v(s.currentTarget,"Code anfordern")),document.getElementById("guest-resend-code").addEventListener("click",s=>{s.preventDefault(),v(s.currentTarget,"Code erneut senden")}),a.addEventListener("keydown",s=>{s.key==="Enter"&&v(document.getElementById("guest-send-code"),"Code anfordern")});let w=!1;const h=async()=>{if(w)return;m();const s=f();if(!/^\d{6}$/.test(s)){c("Bitte geben Sie den 6-stelligen Code ein.");return}const r=document.getElementById("guest-verify-code");w=!0,r.disabled=!0,r.textContent="Wird geprüft …";const{error:d}=await window.supabase.auth.verifyOtp({email:i.email,token:s,type:"email"});if(w=!1,r.disabled=!1,r.textContent="Code bestätigen",d){console.error("OTP-Verifikation fehlgeschlagen:",d),c("Der Code ist ungültig oder abgelaufen."),e.forEach(u=>{u.value&&u.classList.add("error")}),setTimeout(()=>b(),1500);return}await L(t,i,a.value.trim())};e.forEach((s,r)=>{s.addEventListener("input",d=>{const u=d.target.value;if(!/^\d$/.test(u)&&u!==""){d.target.value="";return}u&&r<e.length-1&&setTimeout(()=>{e[r+1].focus(),e[r+1].select()},10),y(),f().length===6&&setTimeout(()=>h(),200)}),s.addEventListener("keydown",d=>{d.key==="Backspace"&&!d.target.value&&r>0&&(e[r-1].focus(),e[r-1].value="",y()),d.key==="ArrowLeft"&&r>0&&e[r-1].focus(),d.key==="ArrowRight"&&r<e.length-1&&e[r+1].focus(),d.key==="Enter"&&h()}),s.addEventListener("paste",d=>{d.preventDefault();const u=d.clipboardData.getData("text").replace(/\D/g,"").slice(0,6);u.length===6&&(e.forEach((I,B)=>{I.value=u[B]||""}),y(),h())})}),document.getElementById("guest-verify-code").addEventListener("click",h)}async function L(n,t,i=""){const o=document.getElementById("login-root"),a=document.getElementById("app-root");g(o,"Liste wird geladen …");const{data:{session:e}}=await window.supabase.auth.getSession();if(!e){g(o,"Anmeldung fehlgeschlagen. Bitte den Link erneut öffnen.",!0);return}const{data:l,error:c}=await window.supabase.from("benutzer").select("*").eq("auth_user_id",e.user.id).single();if(c||!l){console.error("Gast-Benutzer konnte nicht geladen werden:",c),g(o,"Zugang konnte nicht geladen werden.",!0);return}if(i&&i!==l.name){const{error:f}=await window.supabase.from("benutzer").update({name:i}).eq("id",l.id);f||(l.name=i)}const m=C[t.entityType]?.(t.entityId);if(!m){g(o,"Unbekannter Listen-Typ.",!0);return}window.guestShare={token:n,entityType:t.entityType,entityId:t.entityId,rechte:t.rechte,allowedRoute:m},window.currentUser=l,k.setUserPermissions(l),k.setScopedPermissions([]);try{await window.supabase.rpc("touch_list_share",{p_token:n})}catch(f){console.warn("touch_list_share fehlgeschlagen:",f)}a.classList.add("guest-mode"),a.style.display="",o.style.display="none",await window.moduleRegistry.navigateTo(m,!0)}async function D(){const n=document.getElementById("login-root"),t=document.getElementById("app-root");t&&(t.style.display="none"),n&&(n.style.display="");let i=[];try{const{data:e}=await window.supabase.from("list_shares").select("token, entity_type, entity_id, created_at").is("revoked_at",null).order("created_at",{ascending:!1});i=e||[]}catch(e){console.warn("Shares konnten nicht geladen werden:",e)}const o=await T(i),a=i.map(e=>{const l=E[e.entity_type]||"Liste",c=o.get(e.entity_id);return`
      <a class="guest-share-link" href="/share/${p(e.token)}">
        <span class="guest-share-link-text">
          <span class="guest-share-link-title">${l} öffnen</span>
          ${c?`<span class="guest-share-link-subtitle">${p(c)}</span>`:""}
        </span>
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor" width="16" height="16">
          <path stroke-linecap="round" stroke-linejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" />
        </svg>
      </a>`}).join("");n.innerHTML=`
    <div class="login-split-container">
      <div class="login-left">
        <div class="login-box auth-card">
          <div class="login-logo-wrapper">
            <img src="/assets/background/Logo-Icon-gray.svg" alt="Logo" class="login-logo">
          </div>
          <h1 class="auth-title">Kein Zugriff auf diesen Bereich</h1>
          <p class="auth-subtitle guest-onboarding-note">
            Danke für Ihr Interesse — Ihr Zugang gilt nur für die mit Ihnen geteilten Listen.
          </p>
          ${i.length>0?`
            <div class="guest-share-links">${a}</div>
          `:`
            <p class="guest-onboarding-note">
              Ihr Zugang wurde widerrufen oder es liegen keine geteilten Listen vor.
            </p>
          `}
          <button id="guest-logout-btn" class="resend-button">Abmelden</button>
        </div>
      </div>
      <div class="login-right"></div>
    </div>
  `,document.getElementById("guest-logout-btn")?.addEventListener("click",async()=>{try{await window.supabase.auth.signOut()}finally{window.location.href="/"}})}async function T(n){const t={kampagne:[],sourcing:[],strategie:[]};for(const a of n)t[a.entity_type]&&a.entity_id&&t[a.entity_type].push(a.entity_id);const i=new Map,o=[];t.kampagne.length>0&&o.push(window.supabase.from("kampagne").select("id, eigener_name, kampagnenname").in("id",t.kampagne).then(({data:a})=>{for(const e of a||[])i.set(e.id,e.eigener_name||e.kampagnenname)})),t.sourcing.length>0&&o.push(window.supabase.from("creator_auswahl").select("id, name").in("id",t.sourcing).then(({data:a})=>{for(const e of a||[])i.set(e.id,e.name)})),t.strategie.length>0&&o.push(window.supabase.from("strategie").select("id, name").in("id",t.strategie).then(({data:a})=>{for(const e of a||[])i.set(e.id,e.name)}));try{await Promise.allSettled(o)}catch(a){console.warn("Entitätsnamen konnten nicht geladen werden:",a)}return i}function g(n,t,i=!1){n&&(n.innerHTML=`
    <div class="login-split-container">
      <div class="login-left">
        <div class="login-box auth-card">
          <div class="login-logo-wrapper">
            <img src="/assets/background/Logo-Icon-gray.svg" alt="Logo" class="login-logo">
          </div>
          ${i?`<div class="auth-alert auth-alert--error" style="margin-bottom:0;">${p(t)}</div>`:`<p class="auth-subtitle" style="margin-bottom:0;">${p(t)}</p>`}
        </div>
      </div>
      <div class="login-right"></div>
    </div>
  `)}async function x(n){try{if(n?.context&&typeof n.context.json=="function")return(await n.context.json())?.error||null}catch{}return null}function p(n){return String(n||"").replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;")}export{$ as initGuestShare,D as renderGuestNoAccess};
