(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  root.MCVAttendance = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";
  const STATUS = Object.freeze({ NOT_CHECKED: 0, PRESENT: 1, ABSENT: 2, LATE: 3 });
  const CSV_STATUS = Object.freeze({ 0: "-", 1: "1", 2: "0", 3: "0.5" });
  function countStatusCodes(codes) {
    const counts = { present: 0, absent: 0, late: 0, notChecked: 0, total: 0 };
    for (const rawCode of codes) {
      const code = Number(rawCode);
      if (!Number.isInteger(code) || code < 0 || code > 3) continue;
      counts.total += 1;
      if (code === STATUS.PRESENT) counts.present += 1;
      else if (code === STATUS.ABSENT) counts.absent += 1;
      else if (code === STATUS.LATE) counts.late += 1;
      else counts.notChecked += 1;
    }
    counts.checked = counts.present + counts.absent + counts.late;
    return counts;
  }

  function statusCodeToCsv(code) {
    return CSV_STATUS[Number(code)] ?? "-";
  }

  function csvCell(value) {
    const text = String(value ?? "");
    return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
  }

  function safeFilenamePart(value) {
    let result = String(value || "")
      .normalize("NFC")
      .replace(/:/g, "\uE000")
      .replace(/[<>"/\\|?*\u0000-\u001F]+/g, "-")
      .replace(/\s+/g, " ")
      .replace(/\uE000/g, " -")
      .replace(/[-. ]+$/g, "")
      .trim();
    if (!result || result === "." || result === "..") result = "untitled";
    if (/^(?:con|prn|aux|nul|com[1-9]|lpt[1-9])$/i.test(result)) result = `_${result}`;
    return result;
  }

  function truncateUtf8(value, maxBytes) {
    const encoder = new TextEncoder();
    let output = "";
    for (const character of String(value)) {
      if (encoder.encode(output + character).length > maxBytes) break;
      output += character;
    }
    return output.replace(/[-. ]+$/g, "");
  }

  function buildExportFilename({ courseCode, stamp, attendanceName }) {
    const extension = ".csv";
    const prefix = `${safeFilenamePart(courseCode)}-${safeFilenamePart(stamp)}-`;
    const maxFilenameBytes = 240;
    const encoder = new TextEncoder();
    const roomForName = Math.max(1, maxFilenameBytes - encoder.encode(prefix + extension).length);
    const safeName = truncateUtf8(safeFilenamePart(attendanceName), roomForName) || "Attendance";
    return `${prefix}${safeName}${extension}`;
  }

  function buildMcvCsv({ scheduleNumber, date, topic, students }) {
    const rows = [
      ["class ref", "id", "title_th", "firstname_th", "lastname_th", "title_en", "firstname_en", "lastname_en", scheduleNumber],
      ["", "", "", "", "", "", "", "", date],
      ["", "", "", "", "", "", "", "", topic],
      ...students.map((student) => [
        student.classRef,
        student.id,
        student.titleTh || "",
        student.firstNameTh || "",
        student.lastNameTh || "",
        student.titleEn || "",
        student.firstNameEn || "",
        student.lastNameEn || "",
        statusCodeToCsv(student.status),
      ]),
    ];
    return `\uFEFF${rows.map((row) => row.map(csvCell).join(",")).join("\r\n")}\r\n`;
  }

  return { STATUS, CSV_STATUS, countStatusCodes, statusCodeToCsv, csvCell, safeFilenamePart, truncateUtf8, buildExportFilename, buildMcvCsv };
});
