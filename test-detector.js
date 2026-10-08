const assert = require("node:assert/strict");
const attendance = require("./mcv-attendance.js");

assert.deepEqual(
  attendance.countStatusCodes([1, 3, 2, 1, 3, 0]),
  { present: 2, absent: 1, late: 2, notChecked: 1, total: 6, checked: 5 },
);
assert.deepEqual(
  attendance.countStatusCodes(["1", "2", "bad", 9]),
  { present: 1, absent: 1, late: 0, notChecked: 0, total: 2, checked: 2 },
);
assert.deepEqual([0, 1, 2, 3].map(attendance.statusCodeToCsv), ["-", "1", "0", "0.5"]);
assert.equal(
  attendance.safeFilenamePart("Tue Oct 6, 2026: Introduction + Basic Python"),
  "Tue Oct 6, 2026 - Introduction + Basic Python",
);
assert.equal(attendance.safeFilenamePart("AUX"), "_AUX");
assert.equal(attendance.safeFilenamePart("  Topic / Lab \\ 1:*?  "), "Topic - Lab - 1");
const portableFilename = attendance.buildExportFilename({
  courseCode: "2110403",
  stamp: "08-Oct-26",
  attendanceName: "Tue Oct 6, 2026: Introduction + Basic Python",
});
assert.equal(portableFilename, "2110403-08-Oct-26-Tue Oct 6, 2026 - Introduction + Basic Python.csv");
assert.ok(new TextEncoder().encode(attendance.buildExportFilename({ courseCode: "2110403", stamp: "08-Oct-26", attendanceName: "ทดสอบ".repeat(100) })).length <= 240);

const csv = attendance.buildMcvCsv({
  scheduleNumber: 1,
  date: "10/6/2026",
  topic: "Introduction + Basic Python",
  students: [{ classRef: "1", id: "6730000000", firstNameTh: "ทดสอบ", lastNameTh: "ระบบ", firstNameEn: "Test", lastNameEn: "System", status: 3 }],
});
assert.equal(
  csv,
  "\uFEFFclass ref,id,title_th,firstname_th,lastname_th,title_en,firstname_en,lastname_en,1\r\n,,,,,,,,10/6/2026\r\n,,,,,,,,Introduction + Basic Python\r\n1,6730000000,,ทดสอบ,ระบบ,,Test,System,0.5\r\n",
);

console.log("MCV detector and CSV export tests passed.");
