const fs = require("fs");
const path = require("path");
const Ajv = require("ajv");
const addFormats = require("ajv-formats");

const BASE_URI = "https://suf.norminstituutbomen.nl/schema/";
const ORDER = [
  "geometry.schema.json",
  "boomkenmerk.schema.json",
  "onderhoud.schema.json",
  "veiligheid.schema.json",
  "gebrek.schema.json",
  "inspectie.schema.json",
  "uitvoeringsmaatregel.schema.json",
  "boom.schema.json",
];

function deepClone(value) {
  return JSON.parse(JSON.stringify(value));
}

function fixRefs(obj) {
  if (Array.isArray(obj)) {
    obj.forEach(fixRefs);
    return;
  }

  if (!obj || typeof obj !== "object") {
    return;
  }

  if (typeof obj.$ref === "string" && obj.$ref.startsWith("./")) {
    obj.$ref = BASE_URI + obj.$ref.slice(2);
  }

  for (const value of Object.values(obj)) {
    fixRefs(value);
  }
}

function prepareSchema(schema, idSuffix) {
  const prepared = deepClone(schema);
  prepared.$id = BASE_URI + idSuffix;
  fixRefs(prepared);
  return prepared;
}

function createAjv() {
  const ajv = new Ajv({ allErrors: true, strict: false });
  addFormats(ajv);
  return ajv;
}

function loadJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function createValidatorFromNodeFiles(projectRoot) {
  const root = projectRoot || __dirname;
  const schemasDir = path.join(root, "schemas");
  const domainDir = path.join(root, "domainvalues");
  const ajv = createAjv();

  const domainFiles = fs
    .readdirSync(domainDir)
    .filter((fileName) => fileName.endsWith(".schema.json"))
    .sort((a, b) => a.localeCompare(b));

  for (const fileName of domainFiles) {
    const schema = loadJson(path.join(domainDir, fileName));
    ajv.addSchema(prepareSchema(schema, `domainvalues/${fileName}`));
  }

  for (const fileName of ORDER) {
    const schema = loadJson(path.join(schemasDir, fileName));
    ajv.addSchema(prepareSchema(schema, fileName));
  }

  const rootSchema = prepareSchema(
    loadJson(path.join(schemasDir, "featurecollection.schema.json")),
    "featurecollection.schema.json",
  );

  const validate = ajv.compile(rootSchema);
  return { validate };
}

function groupErrors(errors) {
  const grouped = new Map();
  for (const err of errors || []) {
    const key = `${err.instancePath || "/"} | ${err.keyword}: ${err.message}`;
    grouped.set(key, (grouped.get(key) || 0) + 1);
  }

  return [...grouped.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([message, count]) => ({ message, count }));
}

function validateData(data, projectRoot) {
  const { validate } = createValidatorFromNodeFiles(projectRoot);
  const valid = validate(data);
  const rawErrors = validate.errors || [];

  return {
    valid,
    errorCount: rawErrors.length,
    groupedErrors: groupErrors(rawErrors),
    rawErrors,
  };
}

module.exports = {
  BASE_URI,
  ORDER,
  fixRefs,
  groupErrors,
  prepareSchema,
  validateData,
};
