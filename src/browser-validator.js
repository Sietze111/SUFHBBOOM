import Ajv from "ajv";
import addFormats from "ajv-formats";

export const BASE_URI = "https://suf.norminstituutbomen.nl/schema/";

export const ORDER = [
  "geometry.schema.json",
  "boomkenmerk.schema.json",
  "onderhoud.schema.json",
  "veiligheid.schema.json",
  "gebrek.schema.json",
  "inspectie.schema.json",
  "uitvoeringsmaatregel.schema.json",
  "boom.schema.json",
];

export function fixRefs(obj) {
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

function cloneSchema(schema) {
  return JSON.parse(JSON.stringify(schema));
}

function prepareSchema(schema, idSuffix) {
  const prepared = cloneSchema(schema);
  prepared.$id = `${BASE_URI}${idSuffix}`;
  fixRefs(prepared);
  return prepared;
}

export function groupErrors(errors) {
  const grouped = new Map();

  for (const err of errors || []) {
    const key = `${err.instancePath || "/"} | ${err.keyword}: ${err.message}`;
    grouped.set(key, (grouped.get(key) || 0) + 1);
  }

  return [...grouped.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([message, count]) => ({ message, count }));
}

export function createBrowserValidator() {
  const ajv = new Ajv({ allErrors: true, strict: false });
  addFormats(ajv);

  const domainModules = import.meta.glob("../domainvalues/*.schema.json", {
    eager: true,
    import: "default",
  });

  const schemaModules = import.meta.glob("../schemas/*.schema.json", {
    eager: true,
    import: "default",
  });

  const domainEntries = Object.entries(domainModules).sort(([a], [b]) =>
    a.localeCompare(b),
  );

  for (const [modulePath, schema] of domainEntries) {
    const fileName = modulePath.split("/").pop();
    ajv.addSchema(prepareSchema(schema, `domainvalues/${fileName}`));
  }

  const topSchemasByName = new Map();
  for (const [modulePath, schema] of Object.entries(schemaModules)) {
    const fileName = modulePath.split("/").pop();
    topSchemasByName.set(fileName, schema);
  }

  for (const fileName of ORDER) {
    const schema = topSchemasByName.get(fileName);
    if (!schema) {
      throw new Error(`Schema ontbreekt in build: ${fileName}`);
    }
    ajv.addSchema(prepareSchema(schema, fileName));
  }

  const rootSchema = topSchemasByName.get("featurecollection.schema.json");
  if (!rootSchema) {
    throw new Error(
      "Rootschema featurecollection.schema.json ontbreekt in build.",
    );
  }

  const validate = ajv.compile(
    prepareSchema(rootSchema, "featurecollection.schema.json"),
  );
  return validate;
}

export function validateDataWith(validate, data) {
  const valid = validate(data);
  const rawErrors = validate.errors || [];

  return {
    valid,
    errorCount: rawErrors.length,
    groupedErrors: groupErrors(rawErrors),
    rawErrors,
  };
}
