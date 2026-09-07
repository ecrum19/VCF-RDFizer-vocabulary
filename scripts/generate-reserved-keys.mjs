#!/usr/bin/env node
/**
 * Generate the versioned VCF 4.5 reserved-key registry.
 *
 * The VCF specification intentionally uses two source layouts: its general
 * INFO/FORMAT keys are longtables, while its SV keys are concrete ##INFO and
 * ##FORMAT declarations.  This generator reads both layouts and fails closed
 * if their expected counts change, so a VCF 4.6 update cannot silently alter
 * the 4.5 registry.
 *
 * Usage:
 *   node scripts/generate-reserved-keys.mjs --source VCFv4.5.tex
 *   node scripts/generate-reserved-keys.mjs --source https://.../VCFv4.5.tex
 */

import { createHash } from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const DEFAULT_SOURCE =
  "https://raw.githubusercontent.com/samtools/hts-specs/master/VCFv4.5.tex";
const DEFAULT_OUTPUT = path.join(REPO_ROOT, "ontology", "vcf-core-reserved-keys.ttl");
const EXPECTED_COUNTS = {
  info: 21,
  format: 63,
  svInfo: 31,
  svFormat: 8,
  unique: 122,
};

function option(name, fallback) {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : fallback;
}

async function readSource(source) {
  if (/^https?:\/\//i.test(source)) {
    const response = await fetch(source);
    if (!response.ok) {
      throw new Error(`Could not download ${source}: ${response.status} ${response.statusText}`);
    }
    return response.text();
  }
  return fs.readFile(path.resolve(process.cwd(), source), "utf8");
}

function section(text, startMarker, endMarker) {
  const start = text.indexOf(startMarker);
  if (start < 0) throw new Error(`Missing source marker: ${startMarker}`);
  const end = text.indexOf(endMarker, start);
  if (end < 0) throw new Error(`Missing source marker: ${endMarker}`);
  return text.slice(start, end);
}

function longtableRows(text, label) {
  const labelAt = text.indexOf(`\\label{${label}}`);
  if (labelAt < 0) throw new Error(`Missing longtable label: ${label}`);
  const start = text.lastIndexOf("\\begin{longtable}", labelAt);
  const end = text.indexOf("\\end{longtable}", labelAt);
  if (start < 0 || end < 0) throw new Error(`Malformed longtable: ${label}`);

  return text
    .slice(start, end)
    .split(/\r?\n/)
    .filter((line) => line.includes("&") && /\\\\\s*$/.test(line))
    .map((line) => line.replace(/\\\\\s*$/, "").split("&").map((cell) => cleanTex(cell)))
    .filter((cells) => cells.length === 4 && cells[0] !== "Key" && cells[0] !== "Field")
    .map(([id, number, type, description]) => ({ id, number, type, description }));
}

function declarationRows(text, startMarker, endMarker, kind) {
  const source = section(text, startMarker, endMarker);
  const pattern = new RegExp(
    `##${kind}=<ID=([^,>]+),Number=([^,>]+),Type=([^,>]+),Description="([^"]*)">`,
    "g",
  );
  return [...source.matchAll(pattern)].map((match) => ({
    id: cleanTex(match[1]),
    number: cleanTex(match[2]),
    type: cleanTex(match[3]),
    description: cleanTex(match[4]),
  }));
}

function cleanTex(value) {
  return value
    .trim()
    .replace(/\\verb\|([^|]*)\|/g, "$1")
    .replace(/\\texttt\{([^}]*)\}/g, "$1")
    .replace(/\\textsc\{([^}]*)\}/g, "$1")
    .replace(/\\textbf\{([^}]*)\}/g, "$1")
    .replace(/\\emph\{([^}]*)\}/g, "$1")
    .replace(/\$<\$/g, "<")
    .replace(/\$>\$/g, ">")
    .replace(/\$<\$\*\$>\$/g, "<*>")
    .replace(/\$\{([^}]*)\}\$/g, "$1")
    .replace(/\\_/g, "_")
    .replace(/\\%/g, "%")
    .replace(/``|''/g, '"')
    .replace(/\s+/g, " ");
}

function turtleString(value) {
  return JSON.stringify(value);
}

function localName(kind, id) {
  const normalized = id
    .replace(/\[0-9\]\+/g, "ChEBI")
    .replace(/[^A-Za-z0-9_]/g, "_");
  return `Reserved${kind}_${normalized}`;
}

function arityStatements(number) {
  const symbolic = {
    A: "ArityPerAlt",
    R: "ArityPerAllele",
    G: "ArityPerGenotype",
    ".": "ArityVariable",
    LA: "ArityPerLocalAlt",
    LR: "ArityPerLocalAllele",
    LG: "ArityPerLocalGenotype",
    P: "ArityPerGTAllele",
    M: "ArityPerBaseModification",
  };
  if (symbolic[number]) return [`vcfc:fieldArity vcfc:${symbolic[number]}`];
  if (/^\d+$/.test(number)) return [`vcfc:fieldNumberInteger ${number}`];
  throw new Error(`Unsupported VCF Number value: ${number}`);
}

const CHEBI_ALIASES = new Map([
  ["M5mC", "27551"],
  ["M5hmC", "76792"],
  ["M5fC", "76794"],
  ["M5caC", "76793"],
  ["M5hmU", "16964"],
  ["M5fU", "80961"],
  ["M5caU", "17477"],
  ["M6mA", "28871"],
  ["M8oxoG", "44605"],
  ["MXaoN", "18107"],
]);

function aliasTarget(id) {
  const match = /^(DPM|ADM|M)(5mC|5hmC|5fC|5caC|5hmU|5fU|5caU|6mA|8oxoG|XaoN)$/.exec(id);
  if (!match) return null;
  const [, prefix, suffix] = match;
  const chebi = CHEBI_ALIASES.get(`M${suffix}`);
  const base = suffix.endsWith("U") ? "T" : suffix.endsWith("N") ? "N" : suffix.at(-1);
  return `${prefix}${chebi}${base}`;
}

function renderDefinition(kind, definition) {
  const isPatternFamily = /^(M|DPM|ADM)\[0-9\]\+\[ACGTUN\]$/.test(definition.id);
  const statements = [
    `a owl:NamedIndividual, vcfc:${kind}FieldDefinition`,
    `rdfs:label ${turtleString(`${kind} ${definition.id} reserved field definition`)}@en`,
    `vcfc:fieldNumber ${turtleString(definition.number)}`,
    ...arityStatements(definition.number),
    `vcfc:fieldType vcfc:${definition.type}Type`,
    `vcfc:fieldDescription ${turtleString(definition.description)}`,
    `vcfc:reservedIn "VCFv4.5"`,
  ];

  // M, DPM, and ADM are parameterized key families in the VCF specification,
  // not literal keys.  Represent their grammar with keyPattern rather than
  // fabricating a fieldId that cannot satisfy the identifier lexical rule.
  if (!isPatternFamily) statements.splice(2, 0, `vcfc:fieldId ${turtleString(definition.id)}`);

  if (["END", "SVTYPE"].includes(definition.id) && kind === "Info") {
    statements.push(`vcfc:deprecatedInVersion "${definition.id === 'END' ? 'VCFv4.5' : 'VCFv4.4'}"`);
  }
  if (isPatternFamily) {
    statements.push(`vcfc:keyPattern ${turtleString(definition.id)}`);
  }
  const target = aliasTarget(definition.id);
  if (target) statements.push(`vcfc:aliasOf ${turtleString(target)}`);
  const chebi = CHEBI_ALIASES.get(definition.id);
  if (chebi) statements.push(`skos:exactMatch chebi:${chebi}`);

  return `vcfc:${localName(kind, definition.id)} ${statements.join(" ;\n  ")} .`;
}

function ensureCount(name, definitions, expected) {
  if (definitions.length !== expected) {
    throw new Error(`Expected ${expected} ${name} definitions, found ${definitions.length}`);
  }
}

function deduplicate(kind, definitions) {
  const seen = new Map();
  for (const definition of definitions) {
    const current = seen.get(definition.id);
    if (current && JSON.stringify(current) !== JSON.stringify(definition)) {
      throw new Error(`Conflicting ${kind} definitions for ${definition.id}`);
    }
    seen.set(definition.id, definition);
  }
  return [...seen.values()];
}

function sourceIri(source) {
  return /^https?:\/\//i.test(source) ? source : new URL(`file://${path.resolve(source)}`).href;
}

function render(text, source, sourceReference) {
  const info = longtableRows(text, "table:reserved-info");
  const format = longtableRows(text, "table:reserved-genotypes");
  const svInfo = declarationRows(
    text,
    "\\label{sv-info-keys}",
    "\\section{FORMAT keys used for structural variants}",
    "INFO",
  );
  const svFormat = declarationRows(
    text,
    "\\label{sv-format-keys}",
    "\\section{Representing variation in VCF records}",
    "FORMAT",
  );

  ensureCount("general INFO", info, EXPECTED_COUNTS.info);
  ensureCount("general FORMAT", format, EXPECTED_COUNTS.format);
  ensureCount("SV INFO", svInfo, EXPECTED_COUNTS.svInfo);
  ensureCount("SV FORMAT", svFormat, EXPECTED_COUNTS.svFormat);

  const allInfo = deduplicate("INFO", [...info, ...svInfo]);
  const allFormat = deduplicate("FORMAT", [...format, ...svFormat]);
  if (allInfo.length + allFormat.length !== EXPECTED_COUNTS.unique) {
    throw new Error(
      `Expected ${EXPECTED_COUNTS.unique} unique definitions, found ${allInfo.length + allFormat.length}`,
    );
  }

  const digest = createHash("sha256").update(text).digest("hex");
  const body = [
    ...allInfo.map((definition) => renderDefinition("Info", definition)),
    ...allFormat.map((definition) => renderDefinition("Format", definition)),
  ].join("\n\n");

  return `@prefix vcfc:  <https://w3id.org/vcf-core/vocab#> .
@prefix owl:   <http://www.w3.org/2002/07/owl#> .
@prefix rdfs:  <http://www.w3.org/2000/01/rdf-schema#> .
@prefix dct:   <http://purl.org/dc/terms/> .
@prefix skos:  <http://www.w3.org/2004/02/skos/core#> .
@prefix chebi: <http://purl.obolibrary.org/obo/CHEBI_> .

#################################################################
# VCF 4.5 reserved-key registry
#
# Generated by scripts/generate-reserved-keys.mjs from ${sourceReference}
# SHA-256: ${digest}
# Source rows: ${info.length} general INFO, ${svInfo.length} SV INFO,
# ${format.length} general FORMAT, ${svFormat.length} SV FORMAT.
# Do not edit by hand; regenerate from the cited VCF 4.5 source.
#################################################################

<https://w3id.org/vcf-core/reserved-keys> a owl:Ontology ;
  rdfs:label "VCF Core reserved-key registry for VCF 4.5"@en ;
  dct:source <${sourceIri(sourceReference)}> ;
  owl:imports <https://w3id.org/vcf-core/vocab> ;
  owl:versionInfo "VCFv4.5" .

vcfc:reservedIn a owl:AnnotationProperty ;
  rdfs:label "reserved in"@en ;
  rdfs:comment "Records the VCF specification version that reserves a field identifier or identifier pattern."@en .

vcfc:deprecatedInVersion a owl:AnnotationProperty ;
  rdfs:label "deprecated in version"@en ;
  rdfs:comment "Records the VCF specification version in which a reserved field is deprecated."@en .

vcfc:keyPattern a owl:AnnotationProperty ;
  rdfs:label "key pattern"@en ;
  rdfs:comment "The regular-expression family reserved by a FORMAT field definition rather than one concrete key."@en .

vcfc:aliasOf a owl:AnnotationProperty ;
  rdfs:label "alias of"@en ;
  rdfs:comment "The canonical reserved key denoted by a VCF base-modification alias."@en .

${body}
`;
}

const source = option("--source", DEFAULT_SOURCE);
const output = option("--output", DEFAULT_OUTPUT);
const sourceReference = option("--source-reference", DEFAULT_SOURCE);
if (!source || !output) {
  throw new Error("Usage: node scripts/generate-reserved-keys.mjs --source <path-or-url> [--output <path>]");
}

const sourceText = await readSource(source);
const generated = render(sourceText, source, sourceReference);
await fs.writeFile(path.resolve(process.cwd(), output), generated, "utf8");
console.log(`Generated ${path.relative(REPO_ROOT, path.resolve(process.cwd(), output))} from ${source}.`);
