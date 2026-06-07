// ---
// DIAGNOSTIC PANEL
// ---
function diagLog(msg) {
  const ctx = _diagContainer || document;
  const el = ctx.querySelector("#diag-log-content") || $("diag-log-content");
  if (!el) return;
  el.textContent += msg + "\n";
  el.scrollTop = el.scrollHeight;
}

function buildDiagGrid(container) {
  if (!container) container = document.querySelector(".modal-body #diag-grid-src, #diag-grid-src");
  if (!container) return;
  container.innerHTML = "";
  _diagContainer = container.closest(".modal-body") || container;
  DIAG_ITEMS.forEach(item => {
    const st = diagState[item.id] || { status:"idle", msg:"" };
    const row = document.createElement("div");
    row.className = "diag-item";
    row.innerHTML = `<span class="diag-dot ${st.status}" data-dot="${item.id}"></span>
      <span class="diag-name">${item.label}</span>
      <span class="diag-msg" data-msg="${item.id}">${st.msg || "—"}</span>
      <button class="diag-run-btn" data-check="${item.id}">Probar</button>`;
    row.querySelector("[data-check]").onclick = () => runDiag(item.id);
    container.appendChild(row);
  });
}

function setDiagStatus(id, status, msg) {
  diagState[id] = { status, msg };
  const ctx = _diagContainer || document;
  const dot = ctx.querySelector(`[data-dot="${id}"]`); if (dot) { dot.className = `diag-dot ${status}`; }
  const msgEl = ctx.querySelector(`[data-msg="${id}"]`); if (msgEl) { msgEl.textContent = msg; }
}

async function runDiag(id) {
  if (!authedOnly()) return;
  const ctx = _diagContainer || document;
  const btn = ctx.querySelector(`[data-check="${id}"]`);
  if (btn) btn.disabled = true;
  setDiagStatus(id, "run", "Probando…");
  diagLog(`[${id}] Iniciando…`);
  try {
    const fn = { network:diagNetwork, supabase:diagSupabase, apikeys:diagApiKeys, "tabla-admin":diagTablaAdmin, "tabla-dev":diagTablaDev, "tabla-scan":diagTablaScan, "tabla-partes":diagTablaPartes, "tabla-plog":diagTablaPlog, storage:diagStorage, "ai-config":diagAIConfig, license:diagLicense, "catalog-stats":diagCatalogStats, "foto-sync":diagFotoSync, "local-store":diagLocalStore, sw:diagSW, rls:diagRLS, device:diagDevice }[id];
    if (!fn) { setDiagStatus(id, "err", "Check no encontrado"); diagLog(`[${id}] Error: check no encontrado`); return; }
    const result = await fn();
    setDiagStatus(id, result.status, result.message);
    diagLog(`[${id}] ${result.status.toUpperCase()}: ${result.message}`);
    if (result.detail) diagLog(`[${id}] Detalle: ${result.detail}`);
  } catch(e) {
    setDiagStatus(id, "err", e.message || "Error");
    diagLog(`[${id}] ERROR: ${e.message}`);
  } finally {
    if (btn) btn.disabled = false;
  }
}

async function runDiagAll() {
  if (!authedOnly()) return;
  const ctx = _diagContainer || document;
  const btn = ctx.querySelector("#diag-run-all") || $("diag-run-all");
  if (btn) { btn.disabled = true; btn.textContent = "Ejecutando…"; }
  diagLog("=== DIAGNÓSTICO COMPLETO ===");
  for (const item of DIAG_ITEMS) {
    await runDiag(item.id);
  }
  diagLog("=== FINALIZADO ===");
  if (btn) { btn.disabled = false; btn.textContent = "Ejecutar todo"; }
}

async function diagNetwork() {
  if (!navigator.onLine) return { status:"err", message:"Sin conexión a internet" };
  try {
    await fetch("https://clients3.google.com/generate_204", { mode:"no-cors", signal:AbortSignal.timeout(5000) });
    return { status:"ok", message:"Conectado a internet" };
  } catch(e) {
    return { status:"warn", message:"Red limitada o muy lenta" };
  }
}

async function diagSupabase() {
  const t0 = Date.now();
  try {
    const data = await apiProxyRead("admin_config", "id", "&limit=1");
    const ms = Date.now() - t0;
    if (Array.isArray(data)) return { status:"ok", message:`Conexión exitosa (${ms}ms)` };
    return { status:"err", message:`Respuesta inesperada (${ms}ms)` };
  } catch(e) {
    return { status:"err", message:e.message || "Sin conexión" };
  }
}

async function diagApiKeys() {
  const keys = adminConfig?.api_keys || [];
  if (!keys.length) return { status:"err", message:"Ninguna API Key configurada" };
  const provs = keys.map(k => k.startsWith("sk-or-")?"OpenRouter":k.startsWith("gsk_")?"Groq":"Gemini");
  const counts = {};
  provs.forEach(p => { counts[p] = (counts[p]||0)+1; });
  const detail = Object.entries(counts).map(([p,c]) => `${p}: ${c}`).join(", ");
  return { status:"ok", message:`${keys.length} key(s) configuradas`, detail };
}

async function diagTablaAdmin() {
  const d = await apiProxyRead("admin_config", "id", "&limit=1");
  if (Array.isArray(d)) return { status:"ok", message:`${d.length} fila(s)` };
  return { status:"err", message:"No accesible" };
}

async function diagTablaDev() {
  const d = await sbFetch("/rest/v1/devices?select=id&limit=1000", "GET");
  if (Array.isArray(d)) return { status:"ok", message:`${d.length} dispositivo(s)` };
  return { status:"err", message:"No accesible" };
}

async function diagTablaScan() {
  const d = await sbFetch("/rest/v1/scan_log?select=id&limit=1000", "GET");
  if (Array.isArray(d)) return { status:"ok", message:`${d.length} registro(s)` };
  return { status:"err", message:"No accesible" };
}

async function diagTablaPartes() {
  const d = await sbFetch("/rest/v1/partes?select=id&limit=1000", "GET");
  if (Array.isArray(d)) return { status:"ok", message:`${d.length} parte(s)` };
  return { status:"err", message:"No accesible" };
}

async function diagTablaPlog() {
  const d = await sbFetch("/rest/v1/partes_log?select=id&limit=1000", "GET");
  if (Array.isArray(d)) return { status:"ok", message:`${d.length} registro(s)` };
  return { status:"err", message:"No accesible o no existe" };
}

async function diagStorage() {
  try {
    const r = await fetch(`${SB_URL}/storage/v1/object/list/Fotos`, { method:"POST", headers:{ "apikey":SB_KEY, "Authorization":"Bearer "+SB_KEY, "Content-Type":"application/json" }, body:'{"prefix":"","limit":1}' });
    if (r.ok) return { status:"ok", message:"Bucket accesible" };
    return { status:"err", message:`Error ${r.status}` };
  } catch(e) {
    return { status:"err", message:e.message };
  }
}

async function diagAIConfig() {
  const model = adminConfig?.ai_model || "";
  const provider = adminConfig?.ai_provider || "";
  if (model) return { status:"ok", message:`${provider || "desconocido"} · ${model}` };
  return { status:"warn", message:"Sin modelo configurado" };
}

async function diagLicense() {
  const secret = adminConfig?.license_secret || "";
  const model = adminConfig?.ai_model || "";
  const provider = adminConfig?.ai_provider || "";
  const parts = [];
  if (secret) parts.push("License secret presente");
  else parts.push("License secret vacío");
  if (model) parts.push(`Modelo: ${model}`);
  else parts.push("Sin modelo");
  if (provider) parts.push(`Provider: ${provider}`);
  else parts.push("Sin provider");
  const errs = !secret || !model || !provider;
  return { status:errs?"warn":"ok", message:parts.join(" · ") };
}

async function diagCatalogStats() {
  try {
    const all = await sbFetchAll("/rest/v1/partes?select=id,data&order=created_at.desc");
    if (!Array.isArray(all)) return { status:"err", message:"No accesible" };
    const total = all.length;
    const sold = all.filter(p => p.data && (p.data.sold === true || p.data.estado === "vendido")).length;
    const avail = total - sold;
    const cats = {};
    all.forEach(p => { const c = p.data?.categoria; if (c) { cats[c] = (cats[c]||0)+1; } });
    const catList = Object.entries(cats).sort((a,b) => b[1]-a[1]).slice(0,5).map(([c,n]) => `${c}:${n}`).join(", ");
    const detail = catList ? `Categorías: ${catList}` : "Sin categorías";
    return { status:"ok", message:`${total} total · ${avail} disp. · ${sold} vend.`, detail };
  } catch(e) {
    return { status:"err", message:e.message };
  }
}

async function diagFotoSync() {
  try {
    const parts = await sbFetchAll("/rest/v1/partes?select=id,data&order=created_at.desc");
    if (!Array.isArray(parts)) return { status:"err", message:"No accesible" };
    const total = parts.length;
    const withFoto = parts.filter(p => p.data && p.data.photoUrl && p.data.photoUrl !== "").length;
    const without = total - withFoto;
    const pct = total ? ((withFoto/total)*100).toFixed(0) : "0";
    if (total === 0) return { status:"warn", message:"Catálogo vacío" };
    return { status:without > 10?"warn":"ok", message:`${withFoto} con foto · ${without} sin foto (${pct}% sinc.)` };
  } catch(e) {
    return { status:"err", message:e.message };
  }
}

async function diagRLS() {
  const testId = "_diag_" + Date.now();
  const enc = encodeURIComponent(testId);
  try {
    await sbFetch("/rest/v1/partes_log", "POST", { action:"create", part_id:testId, changes:JSON.stringify({diag:true}), device_id:"diag", timestamp:new Date().toISOString() });
    const check = await sbFetch(`/rest/v1/partes_log?part_id=eq.${enc}&select=id&limit=1`, "GET");
    const ok = Array.isArray(check) && check.length > 0;
    if (!ok) return { status:"warn", message:"El POST no arrojó error pero no se encontró el registro (quizás RLS bloquea SELECT)" };
    return { status:"ok", message:"Lectura/escritura OK" };
  } catch(e) {
    if (e.message && (e.message.includes("policy"))) return { status:"err", message:"RLS bloquea: " + e.message };
    if (e.message && e.message.includes("PGRST204")) return { status:"err", message:"Tabla partes_log no existe o columnas incorrectas" };
    return { status:"err", message:e.message || "Error desconocido" };
  } finally {
    try { await sbFetch(`/rest/v1/partes_log?part_id=eq.${enc}`, "DELETE"); } catch(_) {}
  }
}

async function diagLocalStore() {
  try {
    let total = 0;
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k) total += localStorage.getItem(k).length;
    }
    const max = 5e6;
    const free = ((max - total) / 1024).toFixed(0);
    return { status:"ok", message:`${(total/1024).toFixed(0)}KB usado, ${free}KB libre` };
  } catch(e) {
    return { status:"err", message:e.message };
  }
}

async function diagSW() {
  if (!("serviceWorker" in navigator)) return { status:"warn", message:"No soportado" };
  try {
    const reg = await navigator.serviceWorker.getRegistration();
    if (reg) return { status:"ok", message:"Registrado y activo" };
    return { status:"warn", message:"No registrado" };
  } catch(e) {
    return { status:"err", message:e.message };
  }
}

async function diagDevice() {
  const info = [];
  info.push(`SO: ${navigator.platform || "desconocido"}`);
  info.push(`Idioma: ${navigator.language}`);
  info.push(`Pantalla: ${window.innerWidth}×${window.innerHeight}`);
  try {
    const hasCam = !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia);
    info.push(`Cámara: ${hasCam ? "sí" : "no"}`);
  } catch(_) {}
  return { status:"ok", message:info.join(" · ") };
}

// ---
// EXPORT EXCEL
// ---
function exportExcel() {
  if (!parts.length) { toast("Catálogo vacío"); return; }
  const catOrder = ["parachoques","opticos","focos","guardabarros","capots","varios"];
  const catLabels = { parachoques:"Parachoques", opticos:"Ópticos", focos:"Focos", guardabarros:"Guardabarros", capots:"Capots", varios:"Varios" };
  const wb = XLSX.utils.book_new();
  let hasData = false;
  const row = (p, i) => ({
    "#": i + 1, "Archivo": p.fileName || p.id || "", "Marca": p.marca || "", "Modelo": p.modelo || "",
    "Años": p.años || "", "Posición": p.posicion || "", "Descripción": p.descripcion || "",
    "Confianza": p.confianza || "", "Estado": p.sold ? "Vendido" : "Disponible",
    "Foto URL": p.photoUrl && p.photoUrl.startsWith("http") ? p.photoUrl : "",
    "Fecha": p.created_at ? new Date(p.created_at).toLocaleDateString("es-CL") : ""
  });
  const uncategorized = parts.filter(p => !catOrder.includes(p.categoria));
  if (uncategorized.length) {
    const rows = uncategorized.map(row);
    const ws = XLSX.utils.json_to_sheet(rows);
    XLSX.utils.book_append_sheet(wb, ws, "Otros");
    hasData = true;
  }
  catOrder.forEach(key => {
    const items = parts.filter(p => p.categoria === key);
    if (!items.length) return;
    const rows = items.map(row);
    const ws = XLSX.utils.json_to_sheet(rows);
    XLSX.utils.book_append_sheet(wb, ws, catLabels[key]);
    hasData = true;
  });
  if (!hasData) { toast("Sin datos para exportar"); return; }
  XLSX.writeFile(wb, `catalogo-${new Date().toISOString().slice(0,10)}.xlsx`);
  toast("Excel descargado");
}

function exportJSON() {
  if (!parts.length) { toast("Catálogo vacío"); return; }
  const data = parts.map(p => ({
    id: p.id, marca: p.marca, modelo: p.modelo, años: p.años,
    categoria: p.categoria, descripcion: p.descripcion, posicion: p.posicion,
    confianza: p.confianza, sold: p.sold, fileName: p.fileName, fileSize: p.fileSize,
    photoUrl: p.photoUrl || null, addedAt: p.addedAt, created_at: p.created_at
  }));
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = `catalogo-backup-${new Date().toISOString().slice(0,10)}.json`;
  a.click();
  URL.revokeObjectURL(a.href);
  toast("JSON descargado");
}

document.getElementById("json-import").onchange = async (e) => {
  const file = e.target.files?.[0];
  if (!file) return;
  try {
    const text = await file.text();
    const data = JSON.parse(text);
    if (!Array.isArray(data) || !data.length) { toast("JSON vacío o inválido"); return; }
    showConfirm("Importar catálogo", `Se agregarán ${data.length} partes. ¿Continuar?`, async () => {
      let ok = 0, fail = 0;
      for (const p of data) {
        try {
          const { id, marca, modelo, años, categoria, descripcion, posicion, confianza, sold, fileName, fileSize, photoUrl, addedAt } = p;
          const partId = id || `imp-${Date.now()}-${Math.random().toString(36).slice(2)}`;
          const body = { id: partId, data: { marca, modelo, años, categoria, descripcion, posicion, confianza, sold: !!sold, fileName, fileSize, photoUrl, addedAt, preview: photoUrl, previewFull: photoUrl } };
          const existing = await sbFetch(`/rest/v1/partes?id=eq.${encodeURIComponent(partId)}&select=id`, "GET");
          if (existing && existing.length) {
            await sbFetch(`/rest/v1/partes?id=eq.${encodeURIComponent(partId)}`, "PATCH", body);
          } else {
            await sbFetch("/rest/v1/partes", "POST", body);
          }
          ok++;
        } catch(_) { fail++; }
      }
      toast(`Importadas ${ok} partes${fail ? `, ${fail} fallaron` : ""}`);
      await loadParts();
      e.target.value = "";
    });
  } catch(err) {
    toast("Error al leer el archivo JSON");
    console.error(err);
    e.target.value = "";
  }
};
