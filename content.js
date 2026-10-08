(function () {
  "use strict";
  const attendance = globalThis.MCVAttendance;
  const page = new URL(location.href);
  const isAttendancePage = /(?:^|\/)attendance_check(?:\/|$)/.test(page.searchParams.get("q") || "");
  if (!attendance || !isAttendancePage || document.getElementById("mcv-attendance-overlay-host")) return;

  const DEFAULTS = { enabled: true, collapsed: false, x: null, y: 24, language: navigator.language?.toLowerCase().startsWith("th") ? "th" : "en" };
  const state = { ...DEFAULTS };
  const STRINGS = {
    en: {
      panelLabel: "MyCourseVille attendance summary", loading: "Reading Attendance Sheet…", collapse: "Collapse or expand", close: "Hide overlay", switchLanguage: "Switch to Thai",
      present: "Present", absent: "Absent", late: "Late", notChecked: "Not checked", filterHint: "Click a status to filter students", all: "All",
      empty: "No Attendance Sheet found. Select an attendance session in MyCourseVille.", checked: "Checked", noStudents: "No student data found", refresh: "Refresh",
      export: "Export CSV", exportTitle: "Download a MyCourseVille-format CSV", selectBeforeExport: "Select an Attendance Sheet before exporting", exported: "Exported",
      showing: "Showing",
    },
    th: {
      panelLabel: "สรุปการเช็คชื่อ MyCourseVille", loading: "กำลังอ่าน Attendance Sheet…", collapse: "ย่อหรือขยาย", close: "ซ่อน overlay", switchLanguage: "เปลี่ยนเป็นภาษาอังกฤษ",
      present: "เช็คชื่อ", absent: "ขาด", late: "สาย", notChecked: "ไม่ได้เช็ค", filterHint: "กดสถานะเพื่อกรองรายชื่อ", all: "ทั้งหมด",
      empty: "ยังไม่พบ Attendance Sheet กรุณาเลือกรอบเรียนจาก MyCourseVille", checked: "เช็คแล้ว", noStudents: "ไม่พบข้อมูลนิสิต", refresh: "สแกนใหม่",
      export: "Export CSV", exportTitle: "ดาวน์โหลด CSV รูปแบบ MyCourseVille", selectBeforeExport: "กรุณาเลือก Attendance Sheet ก่อน Export", exported: "Export แล้ว",
      showing: "กำลังแสดง",
    },
  };
  function t(key) { return STRINGS[state.language]?.[key] || STRINGS.en[key] || key; }
  let scanTimer;
  const host = document.createElement("div");
  host.id = "mcv-attendance-overlay-host";
  host.style.cssText = "all:initial;position:fixed;z-index:2147483647;top:0;left:0";
  const shadow = host.attachShadow({ mode: "open" });
  shadow.innerHTML = `
    <style>
      :host { all: initial; } * { box-sizing: border-box; }
      .panel { position:fixed; top:24px; right:24px; width:320px; font-family:Inter,"Noto Sans Thai",system-ui,-apple-system,sans-serif; color:#172033; background:rgba(255,255,255,.96); border:1px solid rgba(31,41,55,.12); border-radius:18px; box-shadow:0 18px 50px rgba(15,23,42,.20); overflow:hidden; backdrop-filter:blur(14px); user-select:none; }
      .header { display:flex; align-items:center; gap:10px; padding:13px 14px; cursor:move; background:linear-gradient(135deg,#172554,#1d4ed8); color:#fff; }
      .mark { width:30px; height:30px; display:grid; place-items:center; border-radius:10px; background:rgba(255,255,255,.16); font-weight:800; font-size:13px; }
      .title { flex:1; min-width:0; } .title strong { display:block; font-size:14px; line-height:1.25; } .title span { display:block; margin-top:2px; font-size:10px; opacity:.75; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
      button { appearance:none; border:0; color:inherit; cursor:pointer; font:inherit; } .icon { width:28px; height:28px; border-radius:9px; background:rgba(255,255,255,.12); font-size:15px; } .icon:hover { background:rgba(255,255,255,.22); } .language { font-size:9px; font-weight:800; letter-spacing:.02em; }
      .body { padding:14px; } .grid { display:grid; grid-template-columns:repeat(4,1fr); gap:7px; } .card { padding:11px 5px 10px; border:2px solid transparent; border-radius:13px; text-align:center; transition:transform .15s,border-color .15s; }
      .card:hover { transform:translateY(-1px); } .card.active { border-color:currentColor; box-shadow:0 0 0 2px rgba(255,255,255,.8) inset; }
      .card .status-icon { display:block; width:20px; height:20px; margin:0 auto 5px; stroke:currentColor; stroke-width:2; stroke-linecap:round; stroke-linejoin:round; fill:none; } .card strong { display:block; font-size:24px; line-height:1.05; font-variant-numeric:tabular-nums; } .card span { display:block; margin-top:5px; font-size:11px; font-weight:650; }
      .present { color:#047857; background:#ecfdf5; } .absent { color:#be123c; background:#fff1f2; } .late { color:#b45309; background:#fffbeb; } .not-checked { color:#475569; background:#f1f5f9; }
      .filter-row { display:flex; align-items:center; gap:7px; margin-top:10px; min-height:24px; color:#64748b; font-size:10px; } .filter-label { flex:1; }
      .all-filter { padding:5px 8px; border-radius:8px; color:#1d4ed8; background:#eff6ff; font-size:10px; font-weight:700; } .all-filter.active { color:#fff; background:#2563eb; }
      .footer { display:flex; align-items:center; gap:7px; margin-top:11px; color:#64748b; font-size:10px; } .dot { width:7px; height:7px; border-radius:50%; background:#10b981; box-shadow:0 0 0 3px #d1fae5; } .footer span:nth-child(2) { flex:1; }
      .refresh,.export { display:inline-flex; align-items:center; gap:4px; padding:5px 7px; border-radius:7px; font-size:10px; font-weight:700; } .refresh { color:#475569; background:#f1f5f9; } .refresh:hover { background:#e2e8f0; } .export { color:#fff; background:#047857; } .export:hover { background:#065f46; } .export svg { width:12px; height:12px; fill:none; stroke:currentColor; stroke-width:2; stroke-linecap:round; stroke-linejoin:round; }
      .empty { display:none; margin-top:10px; padding:8px 10px; border-radius:9px; background:#f8fafc; color:#64748b; font-size:10px; line-height:1.45; } .panel.is-empty .empty { display:block; }
      .panel.collapsed { width:214px; } .panel.collapsed .body { display:none; }
      @media (prefers-color-scheme:dark) { .panel{color:#e5e7eb;background:rgba(15,23,42,.95);border-color:rgba(255,255,255,.12)} .present{color:#6ee7b7;background:rgba(6,78,59,.55)} .absent{color:#fda4af;background:rgba(136,19,55,.42)} .late{color:#fcd34d;background:rgba(120,53,15,.42)} .not-checked{color:#cbd5e1;background:#334155}.filter-row,.footer{color:#94a3b8}.all-filter{color:#93c5fd;background:#1e3a8a}.refresh{color:#cbd5e1;background:#1e293b}.empty{color:#94a3b8;background:#1e293b} }
    </style>
    <section class="panel" aria-label="สรุปการเช็คชื่อ MyCourseVille"><header class="header"><div class="mark">MCV</div><div class="title"><strong>Attendance</strong><span class="source">กำลังอ่าน Attendance Sheet…</span></div><button class="icon collapse" title="ย่อ/ขยาย" aria-label="ย่อหรือขยาย">–</button><button class="icon close" title="ซ่อน" aria-label="ซ่อน">×</button></header><div class="body"><div class="grid"><button class="card present" data-filter="present" title="กรองเฉพาะ Present"><svg class="status-icon" viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M8 3v4M16 3v4M3 10h18M8 15l2.5 2.5L16 12"/></svg><strong data-count="present">0</strong><span>เช็คชื่อ</span></button><button class="card absent" data-filter="absent" title="กรองเฉพาะ Absent"><svg class="status-icon" viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M8 3v4M16 3v4M3 10h18M9 13l6 6M15 13l-6 6"/></svg><strong data-count="absent">0</strong><span>ขาด</span></button><button class="card late" data-filter="late" title="กรองเฉพาะ Late"><svg class="status-icon" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M12 7v5H8"/></svg><strong data-count="late">0</strong><span>สาย</span></button><button class="card not-checked" data-filter="notChecked" title="กรองเฉพาะ Not checked"><svg class="status-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12h14"/></svg><strong data-count="notChecked">0</strong><span>ไม่ได้เช็ค</span></button></div><div class="filter-row"><span class="filter-label">กดสถานะเพื่อกรองรายชื่อ</span><button class="all-filter active">ทั้งหมด</button></div><div class="empty">ยังไม่พบ Attendance Sheet กรุณาเลือกรอบเรียนจาก MyCourseVille</div><div class="footer"><i class="dot"></i><span class="summary">กำลังอ่าน Attendance Sheet…</span><button class="export" title="ดาวน์โหลด CSV รูปแบบ MyCourseVille"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3v12M7 10l5 5 5-5M4 21h16"/></svg>Export CSV</button><button class="refresh">สแกนใหม่</button></div></div></section>`;

  const panel = shadow.querySelector(".panel");
  const header = shadow.querySelector(".header");
  const collapseButton = shadow.querySelector(".collapse");
  const languageButton = document.createElement("button");
  languageButton.className = "icon language";
  header.insertBefore(languageButton, collapseButton);
  const FILTER_CODES = { present: 1, absent: 2, late: 3, notChecked: 0 };
  let activeFilter = "all";
  function applyLanguage() {
    panel.lang = state.language;
    panel.setAttribute("aria-label", t("panelLabel"));
    languageButton.textContent = state.language.toUpperCase();
    languageButton.title = t("switchLanguage");
    languageButton.setAttribute("aria-label", t("switchLanguage"));
    collapseButton.title = t("collapse");
    collapseButton.setAttribute("aria-label", t("collapse"));
    const closeButton = shadow.querySelector(".close");
    closeButton.title = t("close");
    closeButton.setAttribute("aria-label", t("close"));
    for (const key of ["present", "absent", "late", "notChecked"]) {
      const button = shadow.querySelector(`.card[data-filter="${key}"]`);
      button.querySelector("span").textContent = t(key);
      button.title = `${t("showing")} ${t(key)}`;
    }
    shadow.querySelector(".all-filter").textContent = t("all");
    shadow.querySelector(".empty").textContent = t("empty");
    const exportButton = shadow.querySelector(".export");
    exportButton.lastChild.textContent = t("export");
    exportButton.title = t("exportTitle");
    shadow.querySelector(".refresh").textContent = t("refresh");
  }
  function activeStatusCodes() { return [...document.querySelectorAll("#courseville-attendance-sheet-table .courseville-attendance-control-column .cv-attendance-icon[data-active='1'][data-status]")].map((element) => element.dataset.status); }
  function attendanceRows() { return [...document.querySelectorAll("#courseville-attendance-sheet-table tr")].filter((row) => row.querySelector(".cv-attendance-icon[data-active='1'][data-status]")); }
  function setRowVisible(row, visible) {
    if (visible) {
      if (!row.hasAttribute("data-mcv-attendance-filter-hidden")) return;
      const originalValue = row.dataset.mcvAttendanceOriginalDisplay || "";
      const originalPriority = row.dataset.mcvAttendanceOriginalDisplayPriority || "";
      if (originalValue) row.style.setProperty("display", originalValue, originalPriority);
      else row.style.removeProperty("display");
      row.removeAttribute("data-mcv-attendance-filter-hidden");
      delete row.dataset.mcvAttendanceOriginalDisplay;
      delete row.dataset.mcvAttendanceOriginalDisplayPriority;
      return;
    }
    if (!row.hasAttribute("data-mcv-attendance-filter-hidden")) {
      row.dataset.mcvAttendanceOriginalDisplay = row.style.getPropertyValue("display");
      row.dataset.mcvAttendanceOriginalDisplayPriority = row.style.getPropertyPriority("display");
    }
    row.setAttribute("data-mcv-attendance-filter-hidden", "1");
    row.style.setProperty("display", "none", "important");
  }

  function splitMcvName(container) {
    if (!container) return { firstName: "", lastName: "" };
    const firstName = container.querySelector("strong")?.textContent?.trim() || "";
    const fullName = container.textContent?.trim() || "";
    return { firstName, lastName: fullName.slice(firstName.length).trim() };
  }

  function scheduleMetadata() {
    const select = document.querySelector("#courseville-attendance-check-si-select");
    const selectedText = select?.selectedOptions?.[0]?.textContent?.trim() || "";
    const match = selectedText.match(/^(?:Sun|Mon|Tue|Wed|Thu|Fri|Sat)\s+([A-Z][a-z]{2})\s+(\d{1,2}),\s+(\d{4}):\s*(.*)$/);
    if (!select || select.selectedIndex < 1 || !match) return null;
    const months = { Jan: 1, Feb: 2, Mar: 3, Apr: 4, May: 5, Jun: 6, Jul: 7, Aug: 8, Sep: 9, Oct: 10, Nov: 11, Dec: 12 };
    return { scheduleNumber: select.selectedIndex, date: `${months[match[1]]}/${Number(match[2])}/${match[3]}`, topic: match[4] };
  }

  function exportFilename() {
    const courseCode = document.querySelector("#cvcourseleftcol-btn-course-code-trigger")?.textContent?.replace("▼", "").trim() || "attendance";
    const attendanceName = document.querySelector("#courseville-attendance-check-si-select")?.selectedOptions?.[0]?.textContent?.trim() || "Attendance";
    const now = new Date();
    const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    const stamp = `${String(now.getDate()).padStart(2, "0")}-${months[now.getMonth()]}-${String(now.getFullYear()).slice(-2)}`;
    return attendance.buildExportFilename({ courseCode, stamp, attendanceName });
  }

  function exportMcvCsv() {
    const metadata = scheduleMetadata();
    const rows = attendanceRows();
    if (!metadata || rows.length === 0) {
      shadow.querySelector(".filter-label").textContent = t("selectBeforeExport");
      return;
    }
    const students = rows.map((row) => {
      const thai = splitMcvName(row.querySelector('[data-part="student-name"][data-lang="auto"]'));
      const english = splitMcvName(row.querySelector('[data-part="student-name"][data-lang="en"]'));
      return {
        classRef: row.cells[1]?.textContent?.trim() || "",
        id: row.getAttribute("student_id") || "",
        titleTh: "",
        firstNameTh: thai.firstName,
        lastNameTh: thai.lastName,
        titleEn: "",
        firstNameEn: english.firstName,
        lastNameEn: english.lastName,
        status: row.querySelector('.cv-attendance-icon[data-active="1"][data-status]')?.dataset.status,
      };
    });
    const csv = attendance.buildMcvCsv({ ...metadata, students });
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = exportFilename();
    link.hidden = true;
    document.documentElement.appendChild(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    shadow.querySelector(".filter-label").textContent = `${t("exported")} ${students.length}`;
  }

  function applyFilter() {
    const targetCode = FILTER_CODES[activeFilter];
    let visible = 0;
    for (const row of attendanceRows()) {
      const code = Number(row.querySelector(".cv-attendance-icon[data-active='1'][data-status]")?.dataset.status);
      const show = activeFilter === "all" || code === targetCode;
      setRowVisible(row, show);
      if (show) visible += 1;
    }
    shadow.querySelectorAll(".card[data-filter]").forEach((button) => { const selected = button.dataset.filter === activeFilter; button.classList.toggle("active", selected); button.setAttribute("aria-pressed", String(selected)); });
    shadow.querySelector(".all-filter").classList.toggle("active", activeFilter === "all");
    shadow.querySelector(".filter-label").textContent = activeFilter === "all" ? t("filterHint") : `${t("showing")}: ${t(activeFilter)} (${visible})`;
  }
  function scan() {
    if (!state.enabled) return;
    const counts = attendance.countStatusCodes(activeStatusCodes());
    for (const key of ["present", "absent", "late", "notChecked"]) shadow.querySelector(`[data-count="${key}"]`).textContent = String(counts[key]);
    panel.classList.toggle("is-empty", counts.total === 0);
    shadow.querySelector(".summary").textContent = counts.total ? `${t("checked")} ${counts.checked}/${counts.total} • ${t("notChecked")} ${counts.notChecked}` : t("noStudents");
    const schedule = document.querySelector("#courseville-attendance-check-si-select");
    shadow.querySelector(".source").textContent = schedule?.selectedOptions?.[0]?.textContent?.trim() || "MyCourseVille Attendance Check";
    host.dataset.counts = JSON.stringify(counts);
    applyFilter();
  }
  function scheduleScan() { clearTimeout(scanTimer); scanTimer = setTimeout(scan, 180); }
  function placePanel() {
    panel.style.top = `${Math.max(8, Number(state.y) || 24)}px`;
    if (state.x == null) { panel.style.left = "auto"; panel.style.right = "24px"; }
    else { const maxX = Math.max(8, innerWidth - panel.offsetWidth - 8); panel.style.left = `${Math.min(Math.max(8, Number(state.x)), maxX)}px`; panel.style.right = "auto"; }
  }
  function applyState() { host.style.display = state.enabled ? "block" : "none"; panel.classList.toggle("collapsed", state.collapsed); collapseButton.textContent = state.collapsed ? "+" : "–"; applyLanguage(); placePanel(); if (state.enabled) scan(); }
  function saveState(patch) { Object.assign(state, patch); if (!state.enabled) { activeFilter = "all"; applyFilter(); } chrome.storage.local.set({ mcvAttendanceOverlay: state }); applyState(); }
  let drag = null;
  header.addEventListener("pointerdown", (event) => { if (event.target.closest("button")) return; const rect=panel.getBoundingClientRect(); drag={dx:event.clientX-rect.left,dy:event.clientY-rect.top}; header.setPointerCapture(event.pointerId); });
  header.addEventListener("pointermove", (event) => { if (!drag) return; const x=Math.min(Math.max(8,event.clientX-drag.dx),innerWidth-panel.offsetWidth-8); const y=Math.min(Math.max(8,event.clientY-drag.dy),innerHeight-panel.offsetHeight-8); state.x=x; state.y=y; panel.style.left=`${x}px`; panel.style.top=`${y}px`; panel.style.right="auto"; });
  header.addEventListener("pointerup", () => { if (!drag) return; drag=null; chrome.storage.local.set({ mcvAttendanceOverlay:state }); });
  collapseButton.addEventListener("click", () => saveState({ collapsed:!state.collapsed }));
  languageButton.addEventListener("click", () => saveState({ language: state.language === "th" ? "en" : "th" }));
  shadow.querySelector(".close").addEventListener("click", () => saveState({ enabled:false }));
  shadow.querySelector(".refresh").addEventListener("click", scan);
  shadow.querySelector(".export").addEventListener("click", exportMcvCsv);
  shadow.querySelectorAll(".card[data-filter]").forEach((button) => button.addEventListener("click", () => { activeFilter = activeFilter === button.dataset.filter ? "all" : button.dataset.filter; applyFilter(); }));
  shadow.querySelector(".all-filter").addEventListener("click", () => { activeFilter = "all"; applyFilter(); });
  addEventListener("resize", placePanel, { passive:true });
  chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => { if (message?.type === "MCV_SET_ENABLED") saveState({ enabled:Boolean(message.enabled) }); if (message?.type === "MCV_SET_LANGUAGE" && ["en","th"].includes(message.language)) saveState({ language:message.language }); if (message?.type === "MCV_REFRESH") scan(); if (message?.type === "MCV_GET_STATUS") sendResponse({ enabled:state.enabled, language:state.language, counts:JSON.parse(host.dataset.counts || "{}") }); });
  document.documentElement.appendChild(host);
  const observer = new MutationObserver(scheduleScan);
  observer.observe(document.body || document.documentElement, { childList:true, subtree:true, attributes:true, attributeFilter:["data-active","data-status"] });
  chrome.storage.local.get("mcvAttendanceOverlay", (saved) => { Object.assign(state, saved.mcvAttendanceOverlay || {}); if (!["en","th"].includes(state.language)) state.language = DEFAULTS.language; applyState(); });
})();
