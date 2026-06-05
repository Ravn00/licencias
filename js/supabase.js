async function loadParts() {
  try {
    const data = await sbFetchAll("/rest/v1/partes?select=id,data,created_at&order=created_at.desc");
    parts = data.map(d => {
      const p = { id: d.id, ...(d.data || {}), created_at: d.created_at };
      if (p.photoUrl) { p.preview = p.photoUrl; p.previewFull = p.photoUrl; }
      return p;
    });
    updateCatalogCount();
    updateDashboardStats();
    if (isModalOpen("catalog")) renderCatalogInModal();
  } catch(e) { console.error("loadParts:", e); toast("Error al cargar catálogo"); }
}

async function loadDevices() {
  try {
    const data = await sbFetchAll("/rest/v1/devices?select=*&order=last_seen.desc");
    devices = data || [];
    updateDeviceCount();
    updateDashboardStats();
    if (isModalOpen("devices")) renderDevicesInModal();
  } catch(e) { console.error("loadDevices:", e); toast("Error al cargar dispositivos"); }
}

async function loadScanLogs(append) {
  try {
    const offset = append ? slPage * SL_PAGE_SIZE : 0;
    const params = `/rest/v1/scan_log?select=*&order=timestamp.desc&limit=${SL_PAGE_SIZE}&offset=${offset}`;
    const data = await sbFetch(params, "GET");
    if (!append) {
      scanLogs = data || [];
      const countRes = await fetch(`${SB_URL}/rest/v1/scan_log?select=id&limit=0`, { headers: { "apikey": SB_KEY, "Authorization": `Bearer ${SB_KEY}`, "Prefer": "count=exact" } });
      if (countRes.ok) slTotal = parseInt(countRes.headers.get("content-range")?.split("/")[1] || countRes.headers.get("x-total-count") || "0", 10) || 0;
    } else { scanLogs = scanLogs.concat(data || []); }
    slPage = append ? slPage + 1 : 1;
    if (isModalOpen("scanlog")) renderScanLogInModal();
  } catch(e) { console.error("loadScanLogs:", e); toast("Error al cargar historial"); }
}

async function loadAuditLogs(append) {
  try {
    const offset = append ? auditPage * AUDIT_PAGE_SIZE : 0;
    const params = `/rest/v1/partes_log?select=*&order=timestamp.desc&limit=${AUDIT_PAGE_SIZE}&offset=${offset}`;
    const data = await sbFetch(params, "GET");
    if (!append) {
      auditLogs = data || [];
      const cr = await fetch(`${SB_URL}/rest/v1/partes_log?select=id&limit=0`, { headers: { "apikey": SB_KEY, "Authorization": `Bearer ${SB_KEY}`, "Prefer": "count=exact" } });
      if (cr.ok) auditTotal = parseInt(cr.headers.get("content-range")?.split("/")[1] || cr.headers.get("x-total-count") || "0", 10) || 0;
    } else { auditLogs = auditLogs.concat(data || []); }
    auditPage = append ? auditPage + 1 : 1;
    if (isModalOpen("audit")) renderAuditLogInModal();
  } catch(e) { console.error("loadAuditLogs:", e); }
}

async function updateDeviceStatus(deviceId, status) {
  try {
    await sbFetch(`/rest/v1/devices?id=eq.${encodeURIComponent(deviceId)}`, "PATCH", { status });
    await loadDevices();
    toast(`Dispositivo ${status === "active" ? "activado" : "bloqueado"}`);
  } catch(e) { toast("Error al actualizar dispositivo"); }
}

async function deleteDevice(deviceId) {
  try {
    await sbFetch(`/rest/v1/devices?id=eq.${encodeURIComponent(deviceId)}`, "DELETE");
    await loadDevices();
    toast("Dispositivo eliminado");
  } catch(e) { toast("Error al eliminar dispositivo"); }
}

async function deletePart(partId) {
  try {
    await sbFetch(`/rest/v1/partes?id=eq.${encodeURIComponent(partId)}`, "DELETE");
    parts = parts.filter(p => p.id !== partId);
    updateCatalogCount();
    if (isModalOpen("catalog")) renderCatalogInModal();
    toast("Parte eliminada");
  } catch(e) { toast("Error al eliminar"); }
}

async function loadAllData() {
  await loadAdminConfig();
  await Promise.all([
    loadParts(),
    loadDevices(),
    loadScanLogs(false),
    loadAuditLogs(false)
  ]);
  allLoaded = true;
}
