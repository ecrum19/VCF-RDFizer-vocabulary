#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";

const RDF_TYPE_URI = "http://www.w3.org/1999/02/22-rdf-syntax-ns#type";
const VCFR_NAMESPACE = "https://w3id.org/vcf-rdfizer/vocab#";
const LEGACY_INSTANCE_NAMESPACE = "https://w3id.org/vcf-rdfizer/vcf/";
const CANONICAL_BASE_IRI = "file://";
const KNOWN_PREFIXES = [
  { prefix: "vcfr", iri: VCFR_NAMESPACE },
  { prefix: "rdf", iri: "http://www.w3.org/1999/02/22-rdf-syntax-ns#" },
  { prefix: "xsd", iri: "http://www.w3.org/2001/XMLSchema#" },
];

const collator = new Intl.Collator("en", { numeric: true, sensitivity: "base" });

function isEscaped(text, index) {
  let slashCount = 0;
  for (let cursor = index - 1; cursor >= 0 && text[cursor] === "\\"; cursor -= 1) {
    slashCount += 1;
  }
  return slashCount % 2 === 1;
}

function skipWhitespace(text, start) {
  let cursor = start;
  while (cursor < text.length && /\s/.test(text[cursor])) {
    cursor += 1;
  }
  return cursor;
}

function readIri(text, start) {
  let cursor = start + 1;
  while (cursor < text.length && text[cursor] !== ">") {
    cursor += 1;
  }
  if (cursor >= text.length) {
    throw new Error("Unterminated IRI");
  }
  return { term: text.slice(start, cursor + 1), end: cursor + 1 };
}

function readBNode(text, start) {
  let cursor = start;
  while (cursor < text.length && !/\s/.test(text[cursor])) {
    cursor += 1;
  }
  return { term: text.slice(start, cursor), end: cursor };
}

function readLiteral(text, start) {
  let cursor = start + 1;
  while (cursor < text.length) {
    if (text[cursor] === '"' && !isEscaped(text, cursor)) {
      break;
    }
    cursor += 1;
  }
  if (cursor >= text.length) {
    throw new Error("Unterminated literal");
  }
  cursor += 1;

  if (text[cursor] === "@") {
    cursor += 1;
    while (cursor < text.length && /[A-Za-z0-9-]/.test(text[cursor])) {
      cursor += 1;
    }
    return { term: text.slice(start, cursor), end: cursor };
  }

  if (text[cursor] === "^" && text[cursor + 1] === "^") {
    cursor += 2;
    if (text[cursor] === "<") {
      const datatype = readIri(text, cursor);
      return { term: text.slice(start, datatype.end), end: datatype.end };
    }
    if (text[cursor] === "_" && text[cursor + 1] === ":") {
      const datatype = readBNode(text, cursor);
      return { term: text.slice(start, datatype.end), end: datatype.end };
    }
    throw new Error("Unsupported datatype term");
  }

  return { term: text.slice(start, cursor), end: cursor };
}

function readTerm(text, start, allowLiteral) {
  const cursor = skipWhitespace(text, start);
  const char = text[cursor];
  if (char === "<") {
    return readIri(text, cursor);
  }
  if (char === "_" && text[cursor + 1] === ":") {
    return readBNode(text, cursor);
  }
  if (allowLiteral && char === '"') {
    return readLiteral(text, cursor);
  }
  throw new Error(`Unsupported term at position ${cursor}`);
}

function parseNTriples(text) {
  const triples = [];
  const lines = text.split(/\r?\n/);

  lines.forEach((rawLine, index) => {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) {
      return;
    }

    let cursor = 0;
    try {
      const subject = readTerm(line, cursor, false);
      cursor = subject.end;
      const predicate = readTerm(line, cursor, false);
      cursor = predicate.end;
      const object = readTerm(line, cursor, true);
      cursor = object.end;
      cursor = skipWhitespace(line, cursor);
      if (line[cursor] !== ".") {
        throw new Error("Missing trailing dot");
      }
      cursor += 1;
      cursor = skipWhitespace(line, cursor);
      if (cursor !== line.length) {
        throw new Error("Unexpected content after trailing dot");
      }
      triples.push([subject.term, predicate.term, object.term]);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      throw new Error(`Failed to parse line ${index + 1}: ${message}`);
    }
  });

  return triples;
}

function getIri(term) {
  if (term.startsWith("<") && term.endsWith(">")) {
    return term.slice(1, -1);
  }
  return null;
}

function isSafePrefixedLocal(local) {
  return /^[A-Za-z_][A-Za-z0-9._~-]*$/.test(local);
}

function formatIri(term, position, baseIri) {
  const iri = getIri(term);
  if (!iri) {
    return term;
  }

  if (position === "predicate" && iri === RDF_TYPE_URI) {
    return "a";
  }

  for (const { prefix, iri: prefixIri } of KNOWN_PREFIXES) {
    if (iri.startsWith(prefixIri)) {
      const local = iri.slice(prefixIri.length);
      if (isSafePrefixedLocal(local)) {
        return `${prefix}:${local}`;
      }
    }
  }

  if (baseIri && iri.startsWith(baseIri)) {
    return `<${iri.slice(baseIri.length)}>`;
  }

  return term;
}

function formatLiteral(term) {
  const match = term.match(
    /^("(?:[^"\\]|\\.)*")(?:@([A-Za-z0-9-]+)|\^\^<([^>]+)>)?$/
  );
  if (!match) {
    return term;
  }

  const lexicalForm = match[1];
  const languageTag = match[2];
  const datatypeIri = match[3];

  if (languageTag) {
    return `${lexicalForm}@${languageTag}`;
  }
  if (!datatypeIri) {
    return lexicalForm;
  }

  const formattedDatatype = formatIri(`<${datatypeIri}>`, "object", null);
  return `${lexicalForm}^^${formattedDatatype}`;
}

function formatTerm(term, position, baseIri) {
  if (term.startsWith('"')) {
    return formatLiteral(term);
  }
  return formatIri(term, position, baseIri);
}

function sortKey(term) {
  const iri = getIri(term);
  if (iri) {
    return iri;
  }
  return term;
}

function predicateComparator(left, right) {
  const leftIri = getIri(left);
  const rightIri = getIri(right);
  const leftRank = leftIri === RDF_TYPE_URI ? 0 : 1;
  const rightRank = rightIri === RDF_TYPE_URI ? 0 : 1;
  if (leftRank !== rightRank) {
    return leftRank - rightRank;
  }
  return collator.compare(sortKey(left), sortKey(right));
}

function termComparator(left, right) {
  return collator.compare(sortKey(left), sortKey(right));
}

function parseVariantNumber(parts) {
  for (const part of parts) {
    const match = /^var(\d+)$/.exec(part);
    if (match) {
      return Number.parseInt(match[1], 10);
    }
  }
  return null;
}

function splitLegacyInstanceRelative(relative) {
  const match = /^(.*)\/(header|record|call|sample)(?:\/(.*))?$/.exec(relative);
  if (!match) {
    return { fileId: relative, resourcePath: "" };
  }

  const [, fileId, rootSegment, remainingPath] = match;
  return {
    fileId,
    resourcePath: remainingPath ? `${rootSegment}/${remainingPath}` : rootSegment,
  };
}

function canonicalizeInstanceIri(iri) {
  if (iri.startsWith(CANONICAL_BASE_IRI)) {
    const relative = iri.slice(CANONICAL_BASE_IRI.length);
    const hashIndex = relative.indexOf("#");
    if (hashIndex >= 0) {
      const fileId = relative.slice(0, hashIndex);
      const resourcePath = relative.slice(hashIndex + 1);
      return resourcePath ? `${CANONICAL_BASE_IRI}${fileId}#${resourcePath}` : `${CANONICAL_BASE_IRI}${fileId}`;
    }

    const { fileId, resourcePath } = splitLegacyInstanceRelative(relative);
    return resourcePath ? `${CANONICAL_BASE_IRI}${fileId}#${resourcePath}` : `${CANONICAL_BASE_IRI}${fileId}`;
  }

  if (iri.startsWith(LEGACY_INSTANCE_NAMESPACE)) {
    const relative = iri.slice(LEGACY_INSTANCE_NAMESPACE.length);
    const { fileId, resourcePath } = splitLegacyInstanceRelative(relative);
    return resourcePath ? `${CANONICAL_BASE_IRI}${fileId}#${resourcePath}` : `${CANONICAL_BASE_IRI}${fileId}`;
  }

  return iri;
}

function canonicalizeTerm(term) {
  const iri = getIri(term);
  if (!iri) {
    return term;
  }
  return `<${canonicalizeInstanceIri(iri)}>`;
}

function canonicalizeTriples(triples) {
  return triples.map(([subject, predicate, object]) => [
    canonicalizeTerm(subject),
    canonicalizeTerm(predicate),
    canonicalizeTerm(object),
  ]);
}

function parseRelativeInstancePath(relative) {
  const hashIndex = relative.indexOf("#");
  if (hashIndex >= 0) {
    const fileId = relative.slice(0, hashIndex);
    const resourcePath = relative.slice(hashIndex + 1);
    return {
      fileId,
      parts: resourcePath ? resourcePath.split("/") : [],
    };
  }

  const { fileId, resourcePath } = splitLegacyInstanceRelative(relative);
  return {
    fileId,
    parts: resourcePath ? resourcePath.split("/") : [],
  };
}

function subjectOrderKey(term, baseIri) {
  const iri = getIri(term);
  if (!iri) {
    return [9, "", "", term];
  }

  if (!baseIri || !iri.startsWith(baseIri)) {
    return [8, iri];
  }

  const relative = iri.slice(baseIri.length);
  const { fileId, parts } = parseRelativeInstancePath(relative);

  if (parts.length === 0) {
    // File-level metadata node.
    return [0, fileId];
  }

  if (parts[0] === "header" && parts.length === 1) {
    return [1, fileId];
  }

  if (parts[0] === "header" && parts[1] === "line" && /^\d+$/.test(parts[2] ?? "")) {
    return [2, fileId, Number.parseInt(parts[2], 10)];
  }

  const variantNumber = parseVariantNumber(parts);
  if (variantNumber !== null) {
    let resourceRank = 9;
    let sampleId = "";
    let formatFieldId = "";

    if (parts[0] === "record") {
      resourceRank = 0;
    } else if (parts[0] === "call") {
      resourceRank = 1;
    } else if (parts[0] === "sample" && parts[3] !== "fmt") {
      resourceRank = 2;
      sampleId = parts[2] ?? "";
    } else if (parts[0] === "sample" && parts[3] === "fmt") {
      resourceRank = 3;
      sampleId = parts[2] ?? "";
      formatFieldId = parts[4] ?? "";
    } else {
      resourceRank = 4;
    }

    // Variant-oriented grouping: var1 (record+call+samples+fmt), then var2, etc.
    return [3, fileId, variantNumber, resourceRank, sampleId, formatFieldId, relative];
  }

  return [4, fileId, relative];
}

function orderKeyComparator(left, right) {
  const leftLength = left.length;
  const rightLength = right.length;
  const maxLength = Math.max(leftLength, rightLength);

  for (let index = 0; index < maxLength; index += 1) {
    if (index >= leftLength) {
      return -1;
    }
    if (index >= rightLength) {
      return 1;
    }

    const leftValue = left[index];
    const rightValue = right[index];
    if (leftValue === rightValue) {
      continue;
    }
    if (typeof leftValue === "number" && typeof rightValue === "number") {
      return leftValue - rightValue;
    }
    return collator.compare(String(leftValue), String(rightValue));
  }

  return 0;
}

function subjectComparator(left, right, baseIri) {
  return orderKeyComparator(subjectOrderKey(left, baseIri), subjectOrderKey(right, baseIri));
}

function buildGroupedTriples(triples) {
  const grouped = new Map();
  for (const [subject, predicate, object] of triples) {
    if (!grouped.has(subject)) {
      grouped.set(subject, new Map());
    }
    const predicates = grouped.get(subject);
    if (!predicates.has(predicate)) {
      predicates.set(predicate, new Set());
    }
    predicates.get(predicate).add(object);
  }
  return grouped;
}

function expandGroupedTriples(groupedTriples) {
  const triples = [];
  for (const [subject, predicates] of groupedTriples.entries()) {
    for (const [predicate, objects] of predicates.entries()) {
      for (const object of objects.values()) {
        triples.push([subject, predicate, object]);
      }
    }
  }
  return triples;
}

function tripleKey([subject, predicate, object]) {
  return `${subject} ${predicate} ${object}`;
}

function assertFaithfulGraph(originalTriples, groupedTriples) {
  const originalKeys = new Set(originalTriples.map(tripleKey));
  const expandedKeys = new Set(expandGroupedTriples(groupedTriples).map(tripleKey));

  if (originalKeys.size !== expandedKeys.size) {
    throw new Error(
      `Grouped graph mismatch: input has ${originalKeys.size} unique triples, grouped graph has ${expandedKeys.size}.`
    );
  }

  for (const key of originalKeys) {
    if (!expandedKeys.has(key)) {
      throw new Error(`Missing triple during grouping: ${key}`);
    }
  }

  for (const key of expandedKeys) {
    if (!originalKeys.has(key)) {
      throw new Error(`Unexpected triple introduced during grouping: ${key}`);
    }
  }
}

function serializeTurtle(groupedTriples, baseIri) {
  const header = [
    baseIri ? `@base <${baseIri}> .` : null,
    "@prefix vcfr: <https://w3id.org/vcf-rdfizer/vocab#> .",
    "@prefix rdf: <http://www.w3.org/1999/02/22-rdf-syntax-ns#> .",
    "@prefix xsd: <http://www.w3.org/2001/XMLSchema#> .",
    "",
    "# This file is generated from examples/example.nt.",
  ].filter(Boolean);

  const subjectBlocks = [];
  const subjects = [...groupedTriples.keys()].sort((left, right) => subjectComparator(left, right, baseIri));
  for (const subject of subjects) {
    const predicates = groupedTriples.get(subject);
    const predicateKeys = [...predicates.keys()].sort(predicateComparator);
    const lines = [formatTerm(subject, "subject", baseIri)];

    predicateKeys.forEach((predicate, predicateIndex) => {
      const objects = [...predicates.get(predicate)].sort(termComparator);
      const objectTerms = objects.map((object) => formatTerm(object, "object", baseIri));
      const suffix = predicateIndex === predicateKeys.length - 1 ? " ." : " ;";
      const formattedPredicate = formatTerm(predicate, "predicate", baseIri);

      if (objectTerms.length === 1) {
        lines.push(`  ${formattedPredicate} ${objectTerms[0]}${suffix}`);
        return;
      }

      lines.push(`  ${formattedPredicate}`);
      objectTerms.forEach((objectTerm, objectIndex) => {
        const separator = objectIndex === objectTerms.length - 1 ? suffix : ",";
        lines.push(`    ${objectTerm}${separator}`);
      });
    });

    subjectBlocks.push(lines.join("\n"));
  }

  return `${header.join("\n")}\n\n${subjectBlocks.join("\n\n")}\n`;
}

function main() {
  const repoRoot = process.argv[2] ? path.resolve(process.argv[2]) : process.cwd();
  const inputPath = process.argv[3]
    ? path.resolve(process.argv[3])
    : path.join(repoRoot, "examples", "example.nt");
  const outputPath = process.argv[4]
    ? path.resolve(process.argv[4])
    : path.join(repoRoot, "examples", "example.ttl");

  const ntContent = fs.readFileSync(inputPath, "utf8");
  const triples = parseNTriples(ntContent);
  const canonicalTriples = canonicalizeTriples(triples);
  const groupedTriples = buildGroupedTriples(canonicalTriples);
  assertFaithfulGraph(canonicalTriples, groupedTriples);
  const turtleContent = serializeTurtle(groupedTriples, CANONICAL_BASE_IRI);

  fs.writeFileSync(outputPath, turtleContent, "utf8");
  console.log(`Wrote ${outputPath} (${canonicalTriples.length} triples, base ${CANONICAL_BASE_IRI}).`);
}

main();
