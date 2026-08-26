import { FileBlob, SpreadsheetFile } from "@oai/artifact-tool";

const input = await FileBlob.load("../../data/!McDirectory.xlsx");
const workbook = await SpreadsheetFile.importXlsx(input);
const summary = await workbook.inspect({
  kind: "workbook,sheet,table",
  maxChars: 12000,
  tableMaxRows: 8,
  tableMaxCols: 50,
  tableMaxCellChars: 100,
});
process.stdout.write(summary.ndjson + "\n");
const sheet = workbook.worksheets.getItem("Directory");
const values = sheet.getUsedRange(true).values;
const headers = values[0].map((value) => String(value ?? ""));
const rows = values.slice(1).map((values, index) => Object.fromEntries(headers.map((header, column) => [header, values[column] ?? ""]))).filter((row) => Object.values(row).some(Boolean));
const phones = rows.filter((row) => String(row.Phone || "").trim());
process.stdout.write(JSON.stringify({ headers, rowCount: rows.length, phoneRows: phones.length, phoneSamples: phones.slice(0, 12).map((row) => ({ sortName: row["Lineage::Sort_Name"], phone: row.Phone, street: row.Street, city: row.City, state: row.State, zip: row.Zip })) }, null, 2) + "\n");
