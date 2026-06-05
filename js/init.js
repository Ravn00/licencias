// ---
// COUNTERS
// ---
function updateCatalogCount() { const el = document.getElementById("c-catalog"); if (el) el.textContent = parts.length; }
function updateDeviceCount() { const el = document.getElementById("c-devices"); if (el) el.textContent = devices.length; }

// ---
// DASHBOARD STATS
// ---
function updateDashboardStats() {
  const total = parts.length;
  const avail = parts.filter(p => !p.sold).length;
  const sold = parts.filter(p => p.sold).length;
  const dTotal = document.getElementById("dash-total");
  const dAvail = document.getElementById("dash-avail");
  const dSold = document.getElementById("dash-sold");
  const dDev = document.getElementById("dash-devices");
  const dActive = document.getElementById("dash-active-devices");
  if (dTotal) dTotal.textContent = total;
  if (dAvail) dAvail.textContent = avail;
  if (dSold) dSold.textContent = sold;
  if (dDev) dDev.textContent = devices.length;
  if (dActive) {
    const activeCount = devices.filter(d => {
      if (d.status === "blocked") return false;
      if (!d.last_seen) return false;
      return (Date.now() - new Date(d.last_seen.endsWith("Z")||d.last_seen.includes("+")?d.last_seen:d.last_seen+"Z").getTime()) < 300000;
    }).length;
    dActive.textContent = activeCount + " activos";
  }
}

// ---
// CATALOG (inside modal)
// ---
function setCatFilter(f) {
  catFilter = f;
  const pills = document.querySelectorAll("#modal-body .filter-pill");
  pills.forEach(p => p.classList.toggle("on", p.dataset.f === f));
  renderCatalogInModal();
}

function renderCatalogInModal() {
  const body = $("modal-body");
  if (!body) return;
  let filtered = [...parts];
  if (catSearch) {
    const q = catSearch;
    filtered = filtered.filter(p =>
      (p.marca || "").toLowerCase().includes(q) ||
      (p.modelo || "").toLowerCase().includes(q) ||
      (p.años || "").toLowerCase().includes(q) ||
      (p.descripcion || "").toLowerCase().includes(q) ||
      (p.posicion || "").toLowerCase().includes(q)
    );
  }
  if (catFilter === "avail") filtered = filtered.filter(p => !p.sold);
  if (catFilter === "sold") filtered = filtered.filter(p => p.sold);

  const grid = body.querySelector("#cat-grid");
  const empty = body.querySelector("#cat-empty");
  const stats = body.querySelector("#cat-stats");
  if (!grid) return;
  const totalAvail = parts.filter(p => !p.sold).length;
  const totalSold = parts.filter(p => p.sold).length;
  if (stats) stats.textContent = `${parts.length} totales · ${totalAvail} disponibles · ${totalSold} vendidas`;

  if (filtered.length === 0) { grid.innerHTML = ""; if (empty) empty.style.display = "block"; return; }
  if (empty) empty.style.display = "none";

  grid.innerHTML = filtered.map(p => {
    const imgSrc = p.preview || p.previewFull || "";
    const soldClass = p.sold ? "p-card-sold" : "";
    const catLabel = { parachoques:"Parachoques", opticos:"Ópticos", focos:"Focos", guardabarros:"Guardabarros", capots:"Capots", varios:"Varios" }[p.categoria] || p.categoria || "";
    const confianza = p.confianza || "";
    return `<div class="p-card ${soldClass}">
      ${imgSrc ? `<img class="p-card-img" src="${escH(imgSrc)}" onclick="openLightbox('${escH(imgSrc)}')" alt=""/>` : `<div class="p-card-img" style="display:flex;align-items:center;justify-content:center;color:var(--t5);font-size:10px">Sin foto</div>`}
      <div class="p-card-body">
        <div class="p-card-brand">${escH(p.marca || "No determinado")}</div>
        <div class="p-card-model">${escH(p.modelo || "No determinado")}</div>
        <div class="p-card-meta">${escH(p.años || "")}${p.posicion ? " · " + escH(p.posicion) : ""}</div>
        <div class="p-card-meta">${escH((p.descripcion || "").slice(0, 80))}</div>
        <div style="display:flex;gap:6px;align-items:center;margin-top:5px">
          ${catLabel ? `<span class="p-card-cat">${catLabel}</span>` : ""}
          ${confianza ? `<span style="font-size:8px;color:var(--t4)">${confianza}</span>` : ""}
          ${p.sold ? `<span class="sold-tag">VENDIDA</span>` : ""}
        </div>
      </div>
      <div class="p-card-footer">
        <button class="btn-ghost btn-sm" onclick="showConfirm('Eliminar parte','¿Eliminar esta parte del catálogo?',function(){ deletePart('${escH(p.id)}'); },true)">Eliminar</button>
      </div>
    </div>`;
  }).join("");
}

// ---
// API KEYS (inside modal)
// ---
function renderKeysInModal() {
  const body = $("modal-body");
  const el = body?.querySelector("#keys-list"); if (!el) return;
  let keys = adminConfig?.api_keys || [];
  if (typeof keys === 'string') { try { keys = JSON.parse(keys); } catch(_) { keys = []; } }
  el.innerHTML = "";
  if (keys.length === 0) {
    el.innerHTML = '<div style="font-size:12px;color:var(--t4);text-align:center;padding:6px">Sin API keys configuradas</div>';
    return;
  }
  keys.forEach((k, i) => {
    const isOR   = k.startsWith("sk-or-");
    const label  = isOR ? "OpenRouter" : "Groq";
    const color  = isOR ? "var(--amber-lt)" : "var(--green-lt)";
    const row = document.createElement("div");
    row.className = "key-row";
    row.innerHTML = `
      <span class="key-label" style="background:${color}22;color:${color}">${label}</span>
      <span class="key-val">...${k.slice(-12)}</span>
      <button class="key-del" onclick="removeKey(${i})">X</button>`;
    el.appendChild(row);
  });
}

window.removeKey = async function(i) {
  if (!authedOnly()) return;
  const keys = adminConfig?.api_keys || [];
  keys.splice(i, 1);
  await updateAdminConfig({ api_keys: keys });
  renderKeysInModal();
  toast("Key eliminada");
};

async function addKeyHandler() {
  if (!authedOnly()) return;
  const body = $("modal-body");
  const inp = body?.querySelector("#api-key-in");
  const st = body?.querySelector("#api-status");
  if (!inp) return;
  const k = inp.value.trim();
  if (!k) return;
  const isOR   = k.startsWith("sk-or-");
  const isGroq = k.startsWith("gsk_");
  if (!isOR && !isGroq) {
    if (st) { st.textContent = "Clave inválida - verifica que sea correcta"; st.style.color = "var(--red-lt)"; }
    return;
  }
  const keys = adminConfig?.api_keys || [];
  if (keys.includes(k)) { if (st) { st.textContent = "Esta key ya está guardada"; st.style.color = "var(--amber-lt)"; } return; }
  keys.push(k);
  await updateAdminConfig({ api_keys: keys });
  inp.value = "";
  if (st) { st.textContent = `Key ${keys.length} agregada`; st.style.color = "var(--green-lt)"; }
  renderKeysInModal();
  setTimeout(() => { if (st) st.textContent = ""; }, 2000);
}

// ---
// DEVICES (inside modal, dual view)
// ---
function renderDevicesInModal() {
  const body = $("modal-body");
  if (!body) return;
  const tbody = body.querySelector("#dev-tbody");
  const grid = body.querySelector("#dev-grid");
  const empty = body.querySelector("#dev-empty");
  if (!tbody && !grid) return;
  updateDeviceCount();
  if (devices.length === 0) { if (tbody) tbody.innerHTML = ""; if (grid) grid.innerHTML = ""; if (empty) empty.style.display = "block"; return; }
  if (empty) empty.style.display = "none";

  if (tbody) {
    tbody.innerHTML = devices.map(d => {
      const lastSeen = d.last_seen ? new Date(d.last_seen.endsWith("Z")||d.last_seen.includes("+")?d.last_seen:d.last_seen+"Z").toLocaleString("es-CL") : "???";
      const isActive = d.status === "active";
      const isOnline = d.last_seen && (Date.now() - new Date(d.last_seen.endsWith("Z")||d.last_seen.includes("+")?d.last_seen:d.last_seen+"Z").getTime() < 300000);
      const statusClass = d.status === "blocked" ? "badge-blocked" : isOnline ? "badge-active" : "badge-away";
      const statusLabel = d.status === "blocked" ? "Bloqueado" : isOnline ? "Activo" : "Ausente";
      return `<tr>
        <td style="font-family:monospace;font-size:10px">${escH(d.id)}</td>
        <td>${escH(d.nombre || "---")}</td>
        <td style="font-size:10px;color:var(--t4)">${lastSeen}</td>
        <td>${d.total_scans || 0}</td>
        <td><span class="badge ${statusClass}">${statusLabel}</span></td>
        <td style="display:flex;gap:4px;flex-wrap:wrap">
          ${isActive
            ? `<button class="btn-ghost btn-sm" onclick="showConfirm('Bloquear','¿Bloquear este dispositivo?',function(){ updateDeviceStatus('${d.id}','blocked'); },true)">Bloquear</button>`
            : `<button class="btn-ghost btn-sm" onclick="updateDeviceStatus('${d.id}','active')">Activar</button>`}
          <button class="btn-danger btn-sm" onclick="showConfirm('Eliminar dispositivo','¿Eliminar este dispositivo permanentemente?',function(){ deleteDevice('${d.id}'); },true)">Eliminar</button>
        </td>
      </tr>`;
    }).join("");
  }

  if (grid) {
    grid.innerHTML = devices.map(d => {
      const lastSeen = d.last_seen ? new Date(d.last_seen.endsWith("Z")||d.last_seen.includes("+")?d.last_seen:d.last_seen+"Z").toLocaleString("es-CL") : "???";
      const isActive = d.status === "active";
      const isOnline = d.last_seen && (Date.now() - new Date(d.last_seen.endsWith("Z")||d.last_seen.includes("+")?d.last_seen:d.last_seen+"Z").getTime() < 300000);
      const statusClass = d.status === "blocked" ? "badge-blocked" : isOnline ? "badge-active" : "badge-away";
      const statusLabel = d.status === "blocked" ? "Bloqueado" : isOnline ? "Activo" : "Ausente";
      return `<div class="dev-card">
        <div class="dev-card-info">
          <div class="dev-card-id">${escH(d.id)}</div>
          <div class="dev-card-name">${escH(d.nombre || "---")}</div>
          <div class="dev-card-meta">
            <span>${lastSeen}</span>
            <span>${d.total_scans || 0} escaneos</span>
            <span class="badge ${statusClass}">${statusLabel}</span>
          </div>
        </div>
        <div class="dev-card-actions">
          ${isActive
            ? `<button class="btn-ghost btn-sm" onclick="showConfirm('Bloquear','¿Bloquear este dispositivo?',function(){ updateDeviceStatus('${d.id}','blocked'); },true)">Bloquear</button>`
            : `<button class="btn-ghost btn-sm" onclick="updateDeviceStatus('${d.id}','active')">Activar</button>`}
          <button class="btn-danger btn-sm" onclick="showConfirm('Eliminar','¿Eliminar este dispositivo permanentemente?',function(){ deleteDevice('${d.id}'); },true)">Eliminar</button>
        </div>
      </div>`;
    }).join("");
  }
}

// ---
// SCAN LOG (inside modal)
// ---
function renderScanLogInModal() {
  const body = $("modal-body");
  if (!body) return;
  const tbody = body.querySelector("#sl-tbody");
  const empty = body.querySelector("#sl-empty");
  if (!tbody) return;
  let filtered = [...scanLogs];
  if (slSearch) {
    const q = slSearch;
    filtered = filtered.filter(l => l.part_id?.includes(q) || l.device_id?.includes(q));
  }
  if (slFilter !== "all") filtered = filtered.filter(l => l.resultado === slFilter);

  const stats = body.querySelector("#sl-stats");
  if (stats) stats.textContent = slTotal > 0 ? `${scanLogs.length} cargados de ${slTotal} totales` : `${scanLogs.length} registros cargados`;

  if (filtered.length === 0) { tbody.innerHTML = ""; if (empty && allLoaded) empty.style.display = "block"; return; }
  if (empty) empty.style.display = "none";
  tbody.innerHTML = filtered.map(l => {
    const ts = l.timestamp ? new Date(l.timestamp.endsWith("Z")||l.timestamp.includes("+")?l.timestamp:l.timestamp+"Z").toLocaleString("es-CL") : "???";
    const resClass = l.resultado === "success" ? "badge-success" : "badge-error";
    return `<tr>
      <td style="font-size:10px;color:var(--t4);white-space:nowrap">${ts}</td>
      <td style="font-family:monospace;font-size:10px">${escH((l.device_id || "").slice(0, 12))}</td>
      <td style="font-family:monospace;font-size:10px">${escH(l.part_id || "")}</td>
      <td>${escH(l.categoria || "")}</td>
      <td><span class="badge ${resClass}">${l.resultado || "---"}</span></td>
      <td style="color:var(--t4)">${l.latencia_ms != null ? l.latencia_ms + "ms" : "---"}</td>
    </tr>`;
  }).join("");
}

// ---
// AUDIT LOG (inside modal)
// ---
function renderAuditLogInModal() {
  const body = $("modal-body");
  if (!body) return;
  const tbody = body.querySelector("#audit-tbody");
  const empty = body.querySelector("#audit-empty");
  if (!tbody) return;
  let filtered = [...auditLogs];
  if (auditSearch) { const q = auditSearch; filtered = filtered.filter(l => l.part_id?.includes(q)); }
  if (auditFilter !== "all") filtered = filtered.filter(l => l.action === auditFilter);
  const stats = body.querySelector("#audit-stats") || (() => { const s = document.createElement("div"); s.id = "audit-stats"; s.style.cssText = "font-size:10px;color:var(--t4);margin-bottom:6px"; body.querySelector(".tbl-wrap")?.before(s); return s; })();
  if (stats) stats.textContent = auditTotal > 0 ? `${auditLogs.length} cargados de ${auditTotal} totales` : `${auditLogs.length} registros`;
  if (filtered.length === 0) { tbody.innerHTML = ""; if (empty) empty.style.display = "block"; return; }
  if (empty) empty.style.display = "none";
  const actionLabels = { create:"Creada", update:"Editada", delete:"Eliminada" };
  tbody.innerHTML = filtered.map(l => {
    const ts = l.timestamp ? new Date(l.timestamp.endsWith("Z")||l.timestamp.includes("+")?l.timestamp:l.timestamp+"Z").toLocaleString("es-CL") : "???";
    let detail = "";
    try { const c = JSON.parse(l.changes || "{}"); detail = [c.marca, c.modelo].filter(Boolean).join(" ") || c.sold != null ? (c.sold ? "Vendido" : "Disponible") : ""; } catch(_) {}
    return `<tr>
      <td style="font-size:10px;color:var(--t4);white-space:nowrap">${ts}</td>
      <td style="font-family:monospace;font-size:10px">${escH(l.part_id || "")}</td>
      <td><span class="badge ${l.action === "delete" ? "badge-error" : l.action === "create" ? "badge-success" : "badge-warn"}">${actionLabels[l.action] || l.action}</span></td>
      <td style="font-size:10px;color:var(--t4)">${escH(detail)}</td>
      <td style="font-family:monospace;font-size:10px;color:var(--t4)">${escH((l.device_id || "").slice(0, 12))}</td>
    </tr>`;
  }).join("");
}

// ---
// REFRESH ALL
// ---
async function refreshAll() {
  if (!authedOnly()) return;
  await Promise.all([loadParts(), loadDevices()]);
  slPage = 0;
  await loadScanLogs(false);
  await updateDashboardStats();
  toast("Datos actualizados");
}
