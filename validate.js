/**
 * validate.js  –  SUF Handboek Bomen 2026 JSON Validator (CLI)
 *
 * Usage:
 *   node validate.js
 *   node validate.js path/to/your_export.json
 */
const fs = require("fs");
const path = require("path");
const { validateData } = require("./validator-core");

const projectRoot = __dirname;
const exportFile =
  process.argv[2] ||
  path.join(
    projectRoot,
    "voorbeeldbestand",
    "suf_export_alle_bomen_2026-05-04.json",
  );

if (!fs.existsSync(exportFile)) {
  console.error(`Export file not found: ${exportFile}`);
  process.exit(1);
}

console.log(`Validating: ${exportFile}`);

let exportData;
try {
  exportData = JSON.parse(fs.readFileSync(exportFile, "utf8"));
} catch (error) {
  console.error(`\n❌  Could not parse JSON: ${error.message}`);
  process.exit(1);
}

const result = validateData(exportData, projectRoot);

if (result.valid) {
  console.log(
    "\n✅  No validation errors — the export is fully schema-compliant.",
  );
  process.exit(0);
}

console.log(`\n❌  Found ${result.errorCount} validation errors:\n`);

let shown = 0;
for (const entry of result.groupedErrors) {
  const suffix = entry.count > 1 ? `  (×${entry.count})` : "";
  console.log(`  ${entry.message}${suffix}`);
  shown += 1;

  if (shown >= 100) {
    console.log(
      `\n  … and ${result.groupedErrors.length - shown} more unique error patterns`,
    );
    break;
  }
}

console.log(`\nTotal raw validation errors: ${result.errorCount}`);
process.exit(1);
