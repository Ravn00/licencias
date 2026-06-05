let parts = [];
let devices = [];
let scanLogs = [];
let ventas = [];

let catFilter = "all";
let catSearch = "";
let slSearch = "";
let slFilter = "all";
let slPage = 0;
let slTotal = 0;
const SL_PAGE_SIZE = 50;

let auditLogs = [];
let auditSearch = "";
let auditFilter = "all";
let auditPage = 0;
let auditTotal = 0;
const AUDIT_PAGE_SIZE = 50;

let salesPage = 0;
let salesTotal = 0;
let salesSearch = "";
let salesFilter = "all";
const SALES_PAGE_SIZE = 50;

let confirmCb = null;
const $ = id => document.getElementById(id);

const modalNames = { catalog:"Catálogo", apikeys:"API Keys", sellers:"Vendedores", sales:"Ventas", devices:"Dispositivos", scanlog:"Historial", messages:"Mensajes", maintenance:"Mantenimiento", license:"Licencias", diagnostics:"Diagnóstico", audit:"Auditoría" };
const modalIcons = { catalog:"[cat]", apikeys:"[key]", sellers:"[sel]", sales:"[sal]", devices:"[dev]", scanlog:"[log]", messages:"[msg]", maintenance:"[mnt]", license:"[lic]", diagnostics:"[diag]", audit:"[aud]" };

const DIAG_ITEMS = [
  { id:"network",     label:"Red" },
  { id:"supabase",    label:"Supabase" },
  { id:"apikeys",     label:"API Keys CAPv2" },
  { id:"tabla-admin", label:"admin_config" },
  { id:"tabla-dev",   label:"Dispositivos" },
  { id:"tabla-scan",  label:"scan_log" },
  { id:"tabla-partes",label:"partes (catálogo)" },
  { id:"tabla-plog",  label:"partes_log" },
  { id:"storage",     label:"Bucket Fotos" },
  { id:"ai-config",   label:"Config IA" },
  { id:"license",     label:"Licencia CAPv2" },
  { id:"catalog-stats",label:"Stats Catálogo" },
  { id:"foto-sync",   label:"Sinc. Fotos" },
  { id:"local-store", label:"Almacenamiento local" },
  { id:"sw",          label:"Service Worker" },
  { id:"rls",         label:"RLS Policies" },
  { id:"device",      label:"Dispositivo" },
];
const diagState = {};
DIAG_ITEMS.forEach(i => diagState[i.id] = { status:"idle", msg:"" });

let _diagContainer = null;
let _toastTimer = null;

// ---
// MODAL SYSTEM
// ---
function openModal(name) {
  const overlay = $("modal-overlay");
  const frame = $("modal-frame");
  const title = $("modal-title");
  const body = $("modal-body");
  const content = $(`content-${name}`);
  if (!content) return;
  title.textContent = modalIcons[name] + " " + modalNames[name];
  body.innerHTML = content.innerHTML;
  rebindModalHandlers(name);
  overlay.classList.add("on");
  if (name === "devices") renderDevicesInModal();
  if (name === "catalog") { catSearch = ""; const cs = body.querySelector("#cat-search"); if(cs) cs.value = ""; renderCatalogInModal(); }
  if (name === "scanlog") renderScanLogInModal();
  if (name === "audit") renderAuditLogInModal();
  if (name === "apikeys" && adminConfig) renderKeysInModal();
  if (name === "sellers" && adminConfig) renderSellersInModal();
  if (name === "sales" && ventas.length) renderSalesInModal();
}

function closeModal(e) {
  if (e && e.target !== $("modal-overlay") && e.target.closest(".modal-frame")) return;
  $("modal-overlay").classList.remove("on");
}

document.addEventListener("keydown", e => { if (e.key === "Escape") $("modal-overlay").classList.remove("on"); });

function rebindModalHandlers(name) {
  if (name === "catalog") {
    const body = $("modal-body");
    const search = body.querySelector("#cat-search");
    if (search) search.oninput = () => { catSearch = search.value.toLowerCase(); renderCatalogInModal(); };
  }
  if (name === "sales") {
    const body = $("modal-body");
    if (ventas.length) renderSalesInModal();
    const s = body.querySelector("#sales-search"); const f = body.querySelector("#sales-filter");
    const r = body.querySelector("#sales-refresh"); const m = body.querySelector("#sales-load-more");
    const ex = body.querySelector("#sales-export");
    if (s) s.oninput = () => { salesSearch = s.value.toLowerCase(); renderSalesInModal(); };
    if (f) f.onchange = () => { salesFilter = f.value; renderSalesInModal(); };
    if (r) r.onclick = () => { salesPage = 0; loadVentas(false); };
    if (m) m.onclick = () => { loadVentas(true); };
    if (ex) ex.onclick = () => {
      if (!ventas.length) { toast("Sin ventas para exportar"); return; }
      const wb = XLSX.utils.book_new();
      const rows = ventas.map(v => [v.fecha||"", v.vendedor||"Anónimo", (v.items||[]).map(it=>`${it.marca} ${it.modelo}`).join(", "), v.total||0, v.comision||0]);
      const data = [["Fecha","Vendedor","Parte","Total","Comisión 10%"], ...rows];
      const ws = XLSX.utils.aoa_to_sheet(data);
      ws["!cols"]=[{wch:20},{wch:14},{wch:30},{wch:12},{wch:12}];
      XLSX.utils.book_append_sheet(wb, ws, "Ventas");
      XLSX.writeFile(wb, `ventas-${new Date().toISOString().slice(0,10)}.xlsx`);
      toast("Excel descargado");
    };
  }
  if (name === "scanlog") {
    const body = $("modal-body");
    const s = body.querySelector("#sl-search"); const f = body.querySelector("#sl-filter");
    const r = body.querySelector("#sl-refresh"); const m = body.querySelector("#sl-load-more");
    if (s) s.oninput = () => { slSearch = s.value.toLowerCase(); renderScanLogInModal(); };
    if (f) f.onchange = () => { slFilter = f.value; renderScanLogInModal(); };
    if (r) r.onclick = () => { slPage = 0; loadScanLogs(false); };
    if (m) m.onclick = () => { loadScanLogs(true); };
  }
  if (name === "audit") {
    const body = $("modal-body");
    const s = body.querySelector("#audit-search"); const f = body.querySelector("#audit-filter");
    const r = body.querySelector("#audit-refresh"); const m = body.querySelector("#audit-load-more");
    if (s) s.oninput = () => { auditSearch = s.value.toLowerCase(); renderAuditLogInModal(); };
    if (f) f.onchange = () => { auditFilter = f.value; renderAuditLogInModal(); };
    if (r) r.onclick = () => { auditPage = 0; loadAuditLogs(false); };
    if (m) m.onclick = () => { loadAuditLogs(true); };
  }
  if (name === "apikeys") {
    const body = $("modal-body");
    const addBtn = body.querySelector("#api-add");
    const eyeBtn = body.querySelector("#api-eye");
    const sel = body.querySelector("#or-model-sel");
    if (addBtn) addBtn.onclick = addKeyHandler;
    if (eyeBtn) eyeBtn.onclick = () => { const inp = body.querySelector("#api-key-in"); if(inp) inp.type = inp.type === "password" ? "text" : "password"; };
    if (sel) sel.onchange = async () => { if (!authedOnly()) return; await updateAdminConfig({ ai_model: sel.value }); toast("Modelo actualizado"); };
  }
  if (name === "sellers") {
    const body = $("modal-body");
    if (adminConfig) renderSellersInModal();
    const addBtn = body.querySelector("#sel-add");
    if (addBtn) addBtn.onclick = addSellerHandler;
  }
  if (name === "messages") {
    const body = $("modal-body");
    const txt = body.querySelector("#msg-text");
    const typ = body.querySelector("#msg-type");
    const snd = body.querySelector("#msg-send");
    const clr = body.querySelector("#msg-clear");
    const prev = body.querySelector("#msg-preview");
    if (txt && typ && prev) {
      const upd = () => { const t = txt.value.trim(); const tp = typ.value; if (!t) { prev.style.display = "none"; return; } prev.style.display = "block"; const c = {info:"var(--t2)",warning:"var(--amber-lt)",critical:"var(--red-lt)"}; const b = {info:"var(--bdr2)",warning:"var(--amber-lt)",critical:"var(--red-lt)"}; prev.style.borderColor = b[tp]; prev.style.color = c[tp]; prev.textContent = t; };
      txt.oninput = upd; typ.onchange = upd;
    }
    if (snd) snd.onclick = async () => { if (!authedOnly()) return; const t = (body.querySelector("#msg-text")?.value||"").trim(); if (!t) { toast("Escribe un mensaje"); return; } await updateAdminConfig({ admin_message: t, admin_message_type: body.querySelector("#msg-type")?.value || "info" }); toast("Mensaje enviado"); };
    if (clr) clr.onclick = async () => { if (!authedOnly()) return; const t = body.querySelector("#msg-text"); const tp = body.querySelector("#msg-type"); if(t) t.value = ""; if(tp) tp.value = "info"; const p = body.querySelector("#msg-preview"); if(p) p.style.display = "none"; await updateAdminConfig({ admin_message: "", admin_message_type: "info" }); toast("Mensaje eliminado"); };
  }
  if (name === "maintenance") {
    const body = $("modal-body");
    const tog = body.querySelector("#maint-toggle");
    const lbl = body.querySelector("#maint-label");
    const msg = body.querySelector("#maint-msg");
    const sav = body.querySelector("#maint-save");
    if (tog && lbl) tog.onclick = () => { tog.classList.toggle("on"); lbl.textContent = tog.classList.contains("on") ? "Mantenimiento activado" : "Mantenimiento desactivado"; };
    if (sav) sav.onclick = async () => { if (!authedOnly()) return; await updateAdminConfig({ maintenance_mode: tog?.classList.contains("on") || false, maintenance_message: msg?.value.trim() || "" }); toast("Configuración guardada"); };
    const pwInp = body.querySelector("#admin-pw-input");
    const pwCfm = body.querySelector("#admin-pw-confirm");
    const pwSav = body.querySelector("#admin-pw-save");
    if (pwSav) pwSav.onclick = async () => {
      if (!authedOnly()) return;
      const v = pwInp?.value;
      if (!v || v.length < 6) { toast("La contraseña debe tener al menos 6 caracteres"); return; }
      if (v !== pwCfm?.value) { toast("Las contraseñas no coinciden"); return; }
      const h = await getHash(v);
      await updateAdminConfig({ password_hash: h });
      if (pwInp) pwInp.value = "";
      if (pwCfm) pwCfm.value = "";
      toast("Contraseña actualizada");
    };
    if (adminConfig) {
      if (adminConfig.maintenance_mode && tog) { tog.classList.add("on"); if(lbl) lbl.textContent = "Mantenimiento activado"; }
      if (msg) msg.value = adminConfig.maintenance_message || "";
    }
  }
  if (name === "license") {
    const body = $("modal-body");
    const prov = body.querySelector("#lic-provider"); const mod = body.querySelector("#lic-model");
    const sav = body.querySelector("#lic-save");
    const sec = body.querySelector("#lic-secret"); const nsec = body.querySelector("#lic-new-secret"); const secsav = body.querySelector("#lic-secret-save");
    const gcl = body.querySelector("#lic-gen-client"); const gmo = body.querySelector("#lic-gen-month"); const gyr = body.querySelector("#lic-gen-year");
    const gbtn = body.querySelector("#lic-gen-btn"); const gres = body.querySelector("#lic-gen-result"); const gout = body.querySelector("#lic-gen-output"); const gcpy = body.querySelector("#lic-gen-copy");
    if (adminConfig) {
      if (mod) mod.value = adminConfig.ai_model || "meta-llama/llama-4-scout-17b-16e-instruct";
      if (prov) prov.value = adminConfig.ai_provider || "groq";
      if (sec) sec.value = adminConfig.license_secret || "";
    }
    if (sav) sav.onclick = async () => { if (!authedOnly()) return; await updateAdminConfig({ ai_provider: prov?.value||"groq", ai_model: (mod?.value||"").trim()||"meta-llama/llama-4-scout-17b-16e-instruct" }); toast("Configuración de IA guardada"); };
    if (secsav) secsav.onclick = async () => { if (!authedOnly()) return; const v = sec?.value.trim(); const nv = nsec?.value.trim(); const u = {}; if (v) u.license_secret = v; if (nv) u.license_secret = nv; await updateAdminConfig(u); if(nsec) nsec.value = ""; toast("Secret guardado"); };
    if (gbtn) gbtn.onclick = licGenHandler;
    if (gcpy) gcpy.onclick = () => { if(gout) { gout.select(); navigator.clipboard?.writeText(gout.value); toast("Copiado"); } };
  }
  if (name === "diagnostics") {
    const body = $("modal-body");
    const grid = body.querySelector("#diag-grid-src");
    if (grid) buildDiagGrid(grid);
    const run = body.querySelector("#diag-run-all");
    if (run) run.onclick = runDiagAll;
  }
}

function isModalOpen(key) {
  if (!$("modal-overlay").classList.contains("on")) return false;
  if (!$("modal-title")) return false;
  if (!key) return true;
  const disp = modalNames[key];
  return disp ? $("modal-title").textContent.includes(disp) : false;
}

// ---
// CONFIRM DIALOG
// ---
function showConfirm(title, msg, cb, danger) {
  $("conf-title").textContent = title;
  $("conf-msg").textContent = msg;
  $("conf-ok").className = danger ? "btn-danger" : "btn-primary";
  confirmCb = cb;
  $("confirm-bg").style.display = "flex";
}
$("conf-ok").onclick = async () => {
  $("confirm-bg").style.display = "none";
  if (confirmCb) { const fn = confirmCb; confirmCb = null; await fn(); }
};
$("conf-cancel").onclick = () => { $("confirm-bg").style.display = "none"; confirmCb = null; };

// ---
// TOAST
// ---
function toast(msg, dur) {
  const el = $("toast");
  el.textContent = msg;
  el.classList.add("on");
  clearTimeout(_toastTimer);
  _toastTimer = setTimeout(() => el.classList.remove("on"), dur || 2500);
}

// ---
// LIGHTBOX
// ---
function openLightbox(src) { $("lb-img").src = src; $("lightbox").classList.add("on"); document.addEventListener("keydown", closeLightboxKey); }
function closeLightbox() { $("lightbox").classList.remove("on"); $("lb-img").src = ""; document.removeEventListener("keydown", closeLightboxKey); }
function closeLightboxKey(e) { if (e.key === "Escape") closeLightbox(); }

// ---
// UTILS
// ---
function escH(s) { return String(s).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;").replace(/'/g,"&#39;").replace(/\//g,"&#x2F;"); }
