(async function () {
  const enabled = document.getElementById("enabled");
  const refresh = document.getElementById("refresh");
  const status = document.getElementById("status");
  const languageButton = document.getElementById("language");
  const STRINGS = {
    en: {
      brandSubtitle: "For MyCourseVille only", enabledTitle: "Show overlay", enabledSubtitle: "On Attendance Check pages", refresh: "Refresh this page",
      checking: "Checking…", localOnly: "Local-only processing", privacy: "No data is sent to the developer, and MyCourseVille credentials are never read or stored.",
      enabled: "Overlay enabled", disabled: "Overlay hidden", reload: "Refresh the web page once to start the extension", refreshed: "Page rescanned",
      openAttendance: "Open a MyCourseVille Attendance Check page first", found: "students found on this page", switchLanguage: "Switch to Thai",
    },
    th: {
      brandSubtitle: "สำหรับ MyCourseVille เท่านั้น", enabledTitle: "แสดง Overlay", enabledSubtitle: "บนหน้า Attendance Check", refresh: "สแกนหน้านี้ใหม่",
      checking: "กำลังตรวจสอบ…", localOnly: "ทำงานภายในเครื่องเท่านั้น", privacy: "ไม่ส่งข้อมูลกลับผู้พัฒนา และไม่อ่านหรือจัดเก็บ credentials ของ MyCourseVille",
      enabled: "เปิด overlay แล้ว", disabled: "ซ่อน overlay แล้ว", reload: "รีเฟรชหน้าเว็บหนึ่งครั้งเพื่อเริ่มใช้งาน", refreshed: "สแกนหน้านี้ใหม่แล้ว",
      openAttendance: "เปิดหน้า Attendance Check ของ MyCourseVille ก่อน", found: "คนในหน้านี้", switchLanguage: "Switch to English",
    },
  };

  const saved = await chrome.storage.local.get("mcvAttendanceOverlay");
  let preferences = { ...(saved.mcvAttendanceOverlay || {}) };
  if (!["en", "th"].includes(preferences.language)) preferences.language = navigator.language?.toLowerCase().startsWith("th") ? "th" : "en";
  enabled.checked = preferences.enabled !== false;
  const t = (key) => STRINGS[preferences.language]?.[key] || STRINGS.en[key] || key;

  function applyLanguage() {
    document.documentElement.lang = preferences.language;
    languageButton.textContent = preferences.language.toUpperCase();
    languageButton.title = t("switchLanguage");
    languageButton.setAttribute("aria-label", t("switchLanguage"));
    document.getElementById("brand-subtitle").textContent = t("brandSubtitle");
    document.getElementById("enabled-title").textContent = t("enabledTitle");
    document.getElementById("enabled-subtitle").textContent = t("enabledSubtitle");
    refresh.textContent = t("refresh");
    document.getElementById("privacy-title").textContent = t("localOnly");
    document.getElementById("privacy-text").textContent = t("privacy");
  }

  async function activeTab() {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    return tab;
  }

  async function send(message) {
    const tab = await activeTab();
    if (!tab?.id) throw new Error("NO_ACTIVE_TAB");
    const url = new URL(tab.url || "about:blank");
    const q = url.searchParams.get("q") || "";
    if (url.hostname !== "www.mycourseville.com" || !/(?:^|\/)attendance_check(?:\/|$)/.test(q)) throw new Error("NOT_MCV_ATTENDANCE");
    return chrome.tabs.sendMessage(tab.id, message);
  }

  languageButton.addEventListener("click", async () => {
    preferences.language = preferences.language === "th" ? "en" : "th";
    await chrome.storage.local.set({ mcvAttendanceOverlay: preferences });
    applyLanguage();
    status.textContent = t("checking");
    try { await send({ type: "MCV_SET_LANGUAGE", language: preferences.language }); }
    catch { status.textContent = t("reload"); }
  });

  enabled.addEventListener("change", async () => {
    preferences.enabled = enabled.checked;
    await chrome.storage.local.set({ mcvAttendanceOverlay: preferences });
    try { await send({ type: "MCV_SET_ENABLED", enabled: enabled.checked }); status.textContent = enabled.checked ? t("enabled") : t("disabled"); }
    catch { status.textContent = t("reload"); }
  });

  refresh.addEventListener("click", async () => {
    refresh.disabled = true;
    try {
      await send({ type: "MCV_REFRESH" });
      status.textContent = t("refreshed");
    } catch {
      status.textContent = t("openAttendance");
    } finally { refresh.disabled = false; }
  });

  applyLanguage();
  status.textContent = t("checking");
  try {
    const result = await send({ type: "MCV_GET_STATUS" });
    if (result?.counts?.total != null) status.textContent = preferences.language === "th" ? `พบ ${result.counts.total} ${t("found")}` : `${result.counts.total} ${t("found")}`;
  } catch { status.textContent = t("openAttendance"); }
})();
