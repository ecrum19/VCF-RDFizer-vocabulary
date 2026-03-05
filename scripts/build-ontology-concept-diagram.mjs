#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";

const URI = {
  rdfType: "http://www.w3.org/1999/02/22-rdf-syntax-ns#type",
  owlClass: "http://www.w3.org/2002/07/owl#Class",
  owlObjectProperty: "http://www.w3.org/2002/07/owl#ObjectProperty",
  owlDatatypeProperty: "http://www.w3.org/2002/07/owl#DatatypeProperty",
  owlAnnotationProperty: "http://www.w3.org/2002/07/owl#AnnotationProperty",
  rdfsDatatype: "http://www.w3.org/2000/01/rdf-schema#Datatype",
  rdfsLabel: "http://www.w3.org/2000/01/rdf-schema#label",
  rdfsComment: "http://www.w3.org/2000/01/rdf-schema#comment",
  rdfsSubClassOf: "http://www.w3.org/2000/01/rdf-schema#subClassOf",
  rdfsDomain: "http://www.w3.org/2000/01/rdf-schema#domain",
  rdfsRange: "http://www.w3.org/2000/01/rdf-schema#range",
  rdfsLiteral: "http://www.w3.org/2000/01/rdf-schema#Literal",
  xsdPrefix: "http://www.w3.org/2001/XMLSchema#"
};

const DECLARED_KIND = {
  [URI.owlClass]: "class",
  [URI.owlObjectProperty]: "objectProperty",
  [URI.owlDatatypeProperty]: "datatypeProperty",
  [URI.owlAnnotationProperty]: "annotationProperty",
  [URI.rdfsDatatype]: "datatype"
};

const KIND_ORDER = ["class", "property", "datatype"];

const NODE_STYLE = {
  class: { fill: "#cdc8dd", stroke: "#111111", rx: 8, shape: "rect", titleSize: 13, subtitleSize: 11 },
  property: { fill: "#f0f0f0", stroke: "#111111", rx: 2, shape: "rect", titleSize: 12, subtitleSize: 10 },
  datatype: { fill: "#efe7be", stroke: "#111111", rx: 0, shape: "ellipse", titleSize: 13, subtitleSize: 0 }
};

const EDGE_STYLE = {
  domain: { color: "#151515", width: 2.1, dash: "", marker: "arrow-main" },
  range: { color: "#151515", width: 2.1, dash: "", marker: "arrow-main" },
  subClassOf: { color: "#40578d", width: 1.9, dash: "7 5", marker: "arrow-subclass" }
};

const ROOT_QNAME = "vcfr:VCFFile";

function hashInt(input) {
  let hash = 2166136261;
  for (let i = 0; i < input.length; i += 1) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function approxTextWidth(text, fontSize = 12) {
  return text.length * fontSize * 0.56;
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function escapeXml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll("\"", "&quot;")
    .replaceAll("'", "&apos;");
}

function localName(uri) {
  if (uri.includes("#")) {
    return uri.slice(uri.lastIndexOf("#") + 1);
  }
  if (uri.includes("/")) {
    return uri.slice(uri.lastIndexOf("/") + 1);
  }
  return uri;
}

function stripComment(line) {
  let out = "";
  let inUri = false;
  let inString = false;
  let escaped = false;

  for (let i = 0; i < line.length; i += 1) {
    const ch = line[i];

    if (inString) {
      out += ch;
      if (escaped) {
        escaped = false;
      } else if (ch === "\\") {
        escaped = true;
      } else if (ch === "\"") {
        inString = false;
      }
      continue;
    }

    if (inUri) {
      out += ch;
      if (ch === ">") {
        inUri = false;
      }
      continue;
    }

    if (ch === "#") {
      break;
    }

    out += ch;

    if (ch === "<") {
      inUri = true;
    } else if (ch === "\"") {
      inString = true;
    }
  }

  return out;
}

function splitTopLevel(input, separator) {
  const parts = [];
  let cursor = "";
  let inUri = false;
  let inString = false;
  let escaped = false;

  for (let i = 0; i < input.length; i += 1) {
    const ch = input[i];

    if (inString) {
      cursor += ch;
      if (escaped) {
        escaped = false;
      } else if (ch === "\\") {
        escaped = true;
      } else if (ch === "\"") {
        inString = false;
      }
      continue;
    }

    if (inUri) {
      cursor += ch;
      if (ch === ">") {
        inUri = false;
      }
      continue;
    }

    if (ch === separator) {
      parts.push(cursor.trim());
      cursor = "";
      continue;
    }

    cursor += ch;
    if (ch === "<") {
      inUri = true;
    } else if (ch === "\"") {
      inString = true;
    }
  }

  if (cursor.trim()) {
    parts.push(cursor.trim());
  }

  return parts;
}

function splitStatements(ttl) {
  const statements = [];
  let cursor = "";
  let inUri = false;
  let inString = false;
  let escaped = false;

  for (let i = 0; i < ttl.length; i += 1) {
    const ch = ttl[i];

    if (inString) {
      cursor += ch;
      if (escaped) {
        escaped = false;
      } else if (ch === "\\") {
        escaped = true;
      } else if (ch === "\"") {
        inString = false;
      }
      continue;
    }

    if (inUri) {
      cursor += ch;
      if (ch === ">") {
        inUri = false;
      }
      continue;
    }

    if (ch === ".") {
      const statement = cursor.trim();
      if (statement) {
        statements.push(statement);
      }
      cursor = "";
      continue;
    }

    cursor += ch;
    if (ch === "<") {
      inUri = true;
    } else if (ch === "\"") {
      inString = true;
    }
  }

  const trailing = cursor.trim();
  if (trailing) {
    statements.push(trailing);
  }

  return statements;
}

function parsePrefixes(ttl) {
  const prefixes = {};
  const prefixPattern = /^\s*@prefix\s+([^:\s]*):\s*<([^>]+)>\s*\.?\s*$/;

  for (const rawLine of ttl.split(/\r?\n/)) {
    const line = stripComment(rawLine).trim();
    if (!line) {
      continue;
    }
    const match = line.match(prefixPattern);
    if (match) {
      prefixes[match[1]] = match[2];
    }
  }

  return prefixes;
}

function tokenToUri(token, prefixes) {
  const value = token.trim();
  if (!value) {
    return null;
  }

  if (value === "a") {
    return URI.rdfType;
  }

  if (value.startsWith("<") && value.endsWith(">")) {
    return value.slice(1, -1);
  }

  const index = value.indexOf(":");
  if (index < 0) {
    return null;
  }

  const prefix = value.slice(0, index);
  const suffix = value.slice(index + 1);
  if (!Object.prototype.hasOwnProperty.call(prefixes, prefix)) {
    return null;
  }
  return prefixes[prefix] + suffix;
}

function parseLiteral(token) {
  const trimmed = token.trim();
  if (!trimmed.startsWith("\"")) {
    return null;
  }

  const match = trimmed.match(/^"((?:\\.|[^"\\])*)"(?:@[a-zA-Z-]+|\^\^[^\s]+)?$/);
  if (!match) {
    return null;
  }

  return match[1]
    .replace(/\\"/g, "\"")
    .replace(/\\n/g, "\n")
    .replace(/\\t/g, "\t")
    .replace(/\\\\/g, "\\");
}

function uriToQname(uri, prefixes) {
  let bestPrefix = null;
  let bestBase = "";

  for (const [prefix, base] of Object.entries(prefixes)) {
    if (uri.startsWith(base) && base.length > bestBase.length) {
      bestPrefix = prefix;
      bestBase = base;
    }
  }

  if (bestPrefix !== null) {
    return `${bestPrefix}:${uri.slice(bestBase.length)}`;
  }
  return uri;
}

function parseOntology(ttlText) {
  const prefixes = parsePrefixes(ttlText);
  const cleanText = ttlText
    .split(/\r?\n/)
    .map((line) => stripComment(line))
    .join("\n");

  const statements = splitStatements(cleanText);
  const triples = [];

  for (const statement of statements) {
    if (!statement || statement.startsWith("@prefix")) {
      continue;
    }

    const firstSpace = statement.search(/\s/);
    if (firstSpace < 0) {
      continue;
    }

    const subjectToken = statement.slice(0, firstSpace).trim();
    const subjectUri = tokenToUri(subjectToken, prefixes);
    if (!subjectUri) {
      continue;
    }

    const body = statement.slice(firstSpace).trim();
    const predicateChunks = splitTopLevel(body, ";");

    for (const chunk of predicateChunks) {
      if (!chunk) {
        continue;
      }
      const splitIndex = chunk.search(/\s/);
      if (splitIndex < 0) {
        continue;
      }

      const predicateToken = chunk.slice(0, splitIndex).trim();
      const predicateUri = tokenToUri(predicateToken, prefixes);
      if (!predicateUri) {
        continue;
      }

      const objectChunk = chunk.slice(splitIndex + 1).trim();
      const objectTokens = splitTopLevel(objectChunk, ",");

      for (const objectToken of objectTokens) {
        if (!objectToken) {
          continue;
        }
        triples.push({
          subject: subjectUri,
          predicate: predicateUri,
          object: tokenToUri(objectToken, prefixes),
          literal: parseLiteral(objectToken)
        });
      }
    }
  }

  return { prefixes, triples };
}

function buildConceptModel(parsed) {
  const vcfrPrefix = parsed.prefixes.vcfr || "https://w3id.org/vcf-rdfizer/vocab#";
  const terms = new Map();
  const domainsByProperty = new Map();
  const rangesByProperty = new Map();
  const subclassTriples = [];

  function ensureTerm(uri) {
    if (!terms.has(uri)) {
      terms.set(uri, {
        uri,
        qname: uriToQname(uri, parsed.prefixes),
        label: "",
        comment: "",
        declaredKind: null,
        isExternal: !uri.startsWith(vcfrPrefix)
      });
    }
    return terms.get(uri);
  }

  function addToMapSet(map, key, value) {
    if (!map.has(key)) {
      map.set(key, new Set());
    }
    map.get(key).add(value);
  }

  for (const triple of parsed.triples) {
    ensureTerm(triple.subject);
    if (triple.object) {
      ensureTerm(triple.object);
    }

    if (triple.predicate === URI.rdfType && triple.object) {
      const mappedKind = DECLARED_KIND[triple.object];
      if (mappedKind) {
        ensureTerm(triple.subject).declaredKind = mappedKind;
      }
      continue;
    }

    if (triple.predicate === URI.rdfsLabel && triple.literal !== null) {
      const term = ensureTerm(triple.subject);
      if (!term.label) {
        term.label = triple.literal;
      }
      continue;
    }

    if (triple.predicate === URI.rdfsComment && triple.literal !== null) {
      const term = ensureTerm(triple.subject);
      if (!term.comment) {
        term.comment = triple.literal;
      }
      continue;
    }

    if (triple.predicate === URI.rdfsDomain && triple.object) {
      addToMapSet(domainsByProperty, triple.subject, triple.object);
      continue;
    }

    if (triple.predicate === URI.rdfsRange && triple.object) {
      addToMapSet(rangesByProperty, triple.subject, triple.object);
      continue;
    }

    if (triple.predicate === URI.rdfsSubClassOf && triple.object) {
      subclassTriples.push({ child: triple.subject, parent: triple.object });
    }
  }

  const selectedProperties = Array.from(terms.values())
    .filter((term) => term.declaredKind === "objectProperty" || term.declaredKind === "datatypeProperty")
    .filter((term) => (domainsByProperty.get(term.uri)?.size || rangesByProperty.get(term.uri)?.size))
    .sort((a, b) => a.qname.localeCompare(b.qname));

  const includeUris = new Set();
  const edgeRows = [];

  for (const property of selectedProperties) {
    includeUris.add(property.uri);

    const domains = domainsByProperty.get(property.uri) || new Set();
    const ranges = rangesByProperty.get(property.uri) || new Set();

    for (const domainUri of domains) {
      includeUris.add(domainUri);
      edgeRows.push({
        id: `dom:${domainUri}->${property.uri}`,
        kind: "domain",
        source: domainUri,
        target: property.uri,
        predicate: URI.rdfsDomain
      });
    }

    for (const rangeUri of ranges) {
      includeUris.add(rangeUri);
      edgeRows.push({
        id: `rng:${property.uri}->${rangeUri}`,
        kind: "range",
        source: property.uri,
        target: rangeUri,
        predicate: URI.rdfsRange
      });
    }
  }

  for (const term of terms.values()) {
    if (term.declaredKind === "class" && !term.isExternal) {
      includeUris.add(term.uri);
    }
    if (term.declaredKind === "datatype" && !term.isExternal) {
      includeUris.add(term.uri);
    }
  }

  for (const { child, parent } of subclassTriples) {
    if (!includeUris.has(child) && !includeUris.has(parent)) {
      continue;
    }
    includeUris.add(child);
    includeUris.add(parent);
    edgeRows.push({
      id: `sub:${child}->${parent}`,
      kind: "subClassOf",
      source: child,
      target: parent,
      predicate: URI.rdfsSubClassOf
    });
  }

  const includedTerms = Array.from(includeUris)
    .map((uri) => ensureTerm(uri));

  function termKind(term) {
    if (term.declaredKind === "objectProperty" || term.declaredKind === "datatypeProperty") {
      return "property";
    }
    if (
      term.declaredKind === "datatype" ||
      term.uri === URI.rdfsLiteral ||
      term.qname.startsWith("xsd:")
    ) {
      return "datatype";
    }
    return "class";
  }

  const nodes = includedTerms
    .map((term) => {
      const kind = termKind(term);
      const baseLabel = term.label || localName(term.uri).replace(/_/g, " ");
      const title = kind === "datatype" ? term.qname : `"${baseLabel}"`;
      const subtitle = kind === "datatype" ? "" : term.qname;
      const titleSize = NODE_STYLE[kind].titleSize;
      const subtitleSize = NODE_STYLE[kind].subtitleSize;
      const widthBase = Math.max(
        approxTextWidth(title, titleSize),
        subtitle ? approxTextWidth(subtitle, subtitleSize) : 0
      );

      let width = 0;
      let height = 0;
      if (kind === "class") {
        width = clamp(widthBase + 26, 136, 268);
        height = subtitle ? 54 : 42;
      } else if (kind === "property") {
        width = clamp(widthBase + 24, 112, 232);
        height = subtitle ? 48 : 40;
      } else {
        width = clamp(widthBase + 28, 102, 196);
        height = 36;
      }

      return {
        id: term.uri,
        uri: term.uri,
        qname: term.qname,
        label: term.label || "",
        title,
        subtitle,
        kind,
        isExternal: term.isExternal,
        declaredKind: term.declaredKind,
        comment: term.comment || "",
        w: Number(width.toFixed(2)),
        h: Number(height.toFixed(2)),
        x: 0,
        y: 0
      };
    })
    .sort((a, b) => {
      if (a.kind !== b.kind) {
        return KIND_ORDER.indexOf(a.kind) - KIND_ORDER.indexOf(b.kind);
      }
      return a.qname.localeCompare(b.qname);
    });

  const nodeById = new Map(nodes.map((node) => [node.id, node]));
  const edges = [];
  const seenEdges = new Set();

  for (const edge of edgeRows) {
    if (!nodeById.has(edge.source) || !nodeById.has(edge.target)) {
      continue;
    }
    const dedupeKey = `${edge.kind}|${edge.source}|${edge.target}|${edge.predicate}`;
    if (seenEdges.has(dedupeKey)) {
      continue;
    }
    seenEdges.add(dedupeKey);
    edges.push({
      id: edge.id,
      kind: edge.kind,
      source: edge.source,
      target: edge.target,
      predicate: edge.predicate
    });
  }

  return {
    generatedAt: new Date().toISOString(),
    source: "ontology/vcf-rdfizer-vocabulary.ttl",
    namespace: vcfrPrefix,
    prefixes: parsed.prefixes,
    nodes,
    edges,
    summary: {
      nodeCount: nodes.length,
      edgeCount: edges.length,
      classCount: nodes.filter((node) => node.kind === "class").length,
      propertyCount: nodes.filter((node) => node.kind === "property").length,
      datatypeCount: nodes.filter((node) => node.kind === "datatype").length,
      subClassEdgeCount: edges.filter((edge) => edge.kind === "subClassOf").length
    }
  };
}

function layoutModel(model) {
  const nodeById = new Map(model.nodes.map((node) => [node.id, node]));
  const classNodes = model.nodes.filter((node) => node.kind === "class");
  const propertyNodes = model.nodes.filter((node) => node.kind === "property");
  const datatypeNodes = model.nodes.filter((node) => node.kind === "datatype");

  const domainEdges = model.edges.filter((edge) => edge.kind === "domain");
  const rangeEdges = model.edges.filter((edge) => edge.kind === "range");
  const subclassEdges = model.edges.filter((edge) => edge.kind === "subClassOf");

  function addToMapSet(map, key, value) {
    if (!map.has(key)) {
      map.set(key, new Set());
    }
    map.get(key).add(value);
  }

  function increment(map, key) {
    map.set(key, (map.get(key) || 0) + 1);
  }

  const domainOutCount = new Map();
  const rangeInCount = new Map();
  const classIds = new Set(classNodes.map((node) => node.id));

  for (const edge of domainEdges) {
    if (classIds.has(edge.source)) {
      increment(domainOutCount, edge.source);
    }
  }
  for (const edge of rangeEdges) {
    if (classIds.has(edge.target)) {
      increment(rangeInCount, edge.target);
    }
  }

  const sideByClass = new Map();
  const rootNode = classNodes.find((node) => node.qname === ROOT_QNAME)
    || classNodes.find((node) => node.qname === "vcfr:VCFRecord")
    || classNodes[0];

  if (rootNode) {
    sideByClass.set(rootNode.id, "left");
  }

  for (const node of classNodes) {
    if (sideByClass.has(node.id)) {
      continue;
    }
    const domainOut = domainOutCount.get(node.id) || 0;
    const rangeIn = rangeInCount.get(node.id) || 0;
    if (!domainOut && !rangeIn) {
      continue;
    }
    sideByClass.set(node.id, domainOut >= rangeIn ? "left" : "right");
  }

  const subclassNeighbors = new Map(classNodes.map((node) => [node.id, []]));
  for (const edge of subclassEdges) {
    if (!classIds.has(edge.source) || !classIds.has(edge.target)) {
      continue;
    }
    subclassNeighbors.get(edge.source).push(edge.target);
    subclassNeighbors.get(edge.target).push(edge.source);
  }

  for (let iter = 0; iter < 8; iter += 1) {
    let changed = false;
    for (const node of classNodes) {
      if (sideByClass.has(node.id)) {
        continue;
      }
      const neighbors = subclassNeighbors.get(node.id) || [];
      let leftCount = 0;
      let rightCount = 0;
      for (const neighborId of neighbors) {
        const side = sideByClass.get(neighborId);
        if (side === "left") {
          leftCount += 1;
        } else if (side === "right") {
          rightCount += 1;
        }
      }
      if (!leftCount && !rightCount) {
        continue;
      }
      sideByClass.set(node.id, leftCount >= rightCount ? "left" : "right");
      changed = true;
    }
    if (!changed) {
      break;
    }
  }

  for (const node of classNodes) {
    if (sideByClass.has(node.id)) {
      continue;
    }
    const domainOut = domainOutCount.get(node.id) || 0;
    const rangeIn = rangeInCount.get(node.id) || 0;
    sideByClass.set(node.id, domainOut >= rangeIn ? "left" : "right");
  }

  const leftClassIds = classNodes
    .filter((node) => sideByClass.get(node.id) === "left")
    .map((node) => node.id);
  const rightClassIds = classNodes
    .filter((node) => sideByClass.get(node.id) === "right")
    .map((node) => node.id);
  const middleIds = propertyNodes.map((node) => node.id);
  const rightDatatypeIds = datatypeNodes.map((node) => node.id);
  const rightIds = rightClassIds.concat(rightDatatypeIds);

  const parentsByChild = new Map(classNodes.map((node) => [node.id, []]));
  const childrenByParent = new Map(classNodes.map((node) => [node.id, []]));
  for (const edge of subclassEdges) {
    if (!classIds.has(edge.source) || !classIds.has(edge.target)) {
      continue;
    }
    parentsByChild.get(edge.source).push(edge.target);
    childrenByParent.get(edge.target).push(edge.source);
  }

  const classDepth = new Map();
  const roots = classNodes
    .map((node) => node.id)
    .filter((id) => (parentsByChild.get(id) || []).length === 0);
  const queue = roots.length ? roots.slice() : classNodes.map((node) => node.id);
  for (const id of queue) {
    classDepth.set(id, 0);
  }
  while (queue.length) {
    const current = queue.shift();
    const currentDepth = classDepth.get(current) || 0;
    for (const child of childrenByParent.get(current) || []) {
      const candidateDepth = currentDepth + 1;
      if (!classDepth.has(child) || candidateDepth < classDepth.get(child)) {
        classDepth.set(child, candidateDepth);
        queue.push(child);
      }
    }
  }
  for (const node of classNodes) {
    if (!classDepth.has(node.id)) {
      classDepth.set(node.id, 0);
    }
  }

  const leftToMiddle = new Map();
  const rightToMiddle = new Map();
  const middleToSides = new Map();

  for (const id of leftClassIds) {
    leftToMiddle.set(id, new Set());
  }
  for (const id of rightIds) {
    rightToMiddle.set(id, new Set());
  }
  for (const id of middleIds) {
    middleToSides.set(id, []);
  }

  function noteClassPropertyLink(classId, propertyId, forcedSide = null) {
    const node = nodeById.get(classId);
    if (!node || !nodeById.has(propertyId)) {
      return;
    }

    const side = forcedSide || (node.kind === "datatype" ? "right" : sideByClass.get(classId));
    if (side === "left") {
      if (!leftToMiddle.has(classId)) {
        leftToMiddle.set(classId, new Set());
      }
      leftToMiddle.get(classId).add(propertyId);
    } else {
      if (!rightToMiddle.has(classId)) {
        rightToMiddle.set(classId, new Set());
      }
      rightToMiddle.get(classId).add(propertyId);
    }

    if (!middleToSides.has(propertyId)) {
      middleToSides.set(propertyId, []);
    }
    middleToSides.get(propertyId).push({
      id: classId,
      side: side || "right"
    });
  }

  for (const edge of domainEdges) {
    noteClassPropertyLink(edge.source, edge.target);
  }
  for (const edge of rangeEdges) {
    const targetNode = nodeById.get(edge.target);
    const forcedSide = targetNode?.kind === "datatype" ? "right" : null;
    noteClassPropertyLink(edge.target, edge.source, forcedSide);
  }

  leftClassIds.sort((aId, bId) => {
    const da = classDepth.get(aId) || 0;
    const db = classDepth.get(bId) || 0;
    if (da !== db) {
      return da - db;
    }
    return nodeById.get(aId).qname.localeCompare(nodeById.get(bId).qname);
  });

  rightClassIds.sort((aId, bId) => {
    const da = classDepth.get(aId) || 0;
    const db = classDepth.get(bId) || 0;
    if (da !== db) {
      return da - db;
    }
    return nodeById.get(aId).qname.localeCompare(nodeById.get(bId).qname);
  });

  rightDatatypeIds.sort((aId, bId) => nodeById.get(aId).qname.localeCompare(nodeById.get(bId).qname));
  middleIds.sort((aId, bId) => nodeById.get(aId).qname.localeCompare(nodeById.get(bId).qname));

  let leftOrder = leftClassIds.slice();
  let middleOrder = middleIds.slice();
  let rightOrder = rightClassIds.concat(rightDatatypeIds);

  function indexMap(ids) {
    const out = new Map();
    ids.forEach((id, index) => out.set(id, index));
    return out;
  }

  function average(values, fallback) {
    if (!values.length) {
      return fallback;
    }
    const sum = values.reduce((acc, value) => acc + value, 0);
    return sum / values.length;
  }

  for (let iter = 0; iter < 10; iter += 1) {
    const leftIndex = indexMap(leftOrder);
    const middleIndex = indexMap(middleOrder);
    const rightIndex = indexMap(rightOrder);

    middleOrder.sort((aId, bId) => {
      const aNeighbors = middleToSides.get(aId) || [];
      const bNeighbors = middleToSides.get(bId) || [];

      const aValues = [];
      const bValues = [];

      for (const ref of aNeighbors) {
        if (ref.side === "left") {
          const idx = leftIndex.get(ref.id);
          if (idx !== undefined) {
            aValues.push(idx);
          }
        } else {
          const idx = rightIndex.get(ref.id);
          if (idx !== undefined) {
            aValues.push(leftOrder.length + idx);
          }
        }
      }

      for (const ref of bNeighbors) {
        if (ref.side === "left") {
          const idx = leftIndex.get(ref.id);
          if (idx !== undefined) {
            bValues.push(idx);
          }
        } else {
          const idx = rightIndex.get(ref.id);
          if (idx !== undefined) {
            bValues.push(leftOrder.length + idx);
          }
        }
      }

      const aScore = average(aValues, Number.POSITIVE_INFINITY);
      const bScore = average(bValues, Number.POSITIVE_INFINITY);
      if (aScore !== bScore) {
        return aScore - bScore;
      }
      return nodeById.get(aId).qname.localeCompare(nodeById.get(bId).qname);
    });

    const refreshedMiddleIndex = indexMap(middleOrder);

    leftOrder.sort((aId, bId) => {
      const aPropertyIndices = Array.from(leftToMiddle.get(aId) || [])
        .map((id) => refreshedMiddleIndex.get(id))
        .filter((value) => value !== undefined);
      const bPropertyIndices = Array.from(leftToMiddle.get(bId) || [])
        .map((id) => refreshedMiddleIndex.get(id))
        .filter((value) => value !== undefined);

      const aSubclassIndices = (subclassNeighbors.get(aId) || [])
        .filter((id) => leftIndex.has(id))
        .map((id) => leftIndex.get(id));
      const bSubclassIndices = (subclassNeighbors.get(bId) || [])
        .filter((id) => leftIndex.has(id))
        .map((id) => leftIndex.get(id));

      const aScore = average(
        aPropertyIndices.concat(aSubclassIndices.map((value) => value * 0.45)),
        (classDepth.get(aId) || 0) * 0.9
      );
      const bScore = average(
        bPropertyIndices.concat(bSubclassIndices.map((value) => value * 0.45)),
        (classDepth.get(bId) || 0) * 0.9
      );

      if (aScore !== bScore) {
        return aScore - bScore;
      }
      return nodeById.get(aId).qname.localeCompare(nodeById.get(bId).qname);
    });

    const refreshedRightIndex = indexMap(rightOrder);
    rightOrder.sort((aId, bId) => {
      const aPropertyIndices = Array.from(rightToMiddle.get(aId) || [])
        .map((id) => refreshedMiddleIndex.get(id))
        .filter((value) => value !== undefined);
      const bPropertyIndices = Array.from(rightToMiddle.get(bId) || [])
        .map((id) => refreshedMiddleIndex.get(id))
        .filter((value) => value !== undefined);

      const aSideNeighbors = (subclassNeighbors.get(aId) || [])
        .filter((id) => refreshedRightIndex.has(id))
        .map((id) => refreshedRightIndex.get(id));
      const bSideNeighbors = (subclassNeighbors.get(bId) || [])
        .filter((id) => refreshedRightIndex.has(id))
        .map((id) => refreshedRightIndex.get(id));

      const aScore = average(
        aPropertyIndices.concat(aSideNeighbors.map((value) => value * 0.45)),
        Number.POSITIVE_INFINITY
      );
      const bScore = average(
        bPropertyIndices.concat(bSideNeighbors.map((value) => value * 0.45)),
        Number.POSITIVE_INFINITY
      );

      if (aScore !== bScore) {
        return aScore - bScore;
      }
      const aNode = nodeById.get(aId);
      const bNode = nodeById.get(bId);
      if (aNode.kind !== bNode.kind) {
        return KIND_ORDER.indexOf(aNode.kind) - KIND_ORDER.indexOf(bNode.kind);
      }
      return aNode.qname.localeCompare(bNode.qname);
    });
  }

  function splitIntoLanes(ids, maxRows) {
    if (!ids.length) {
      return [];
    }
    const laneCount = Math.max(1, Math.ceil(ids.length / maxRows));
    const rowsPerLane = Math.max(1, Math.ceil(ids.length / laneCount));
    const lanes = [];
    for (let lane = 0; lane < laneCount; lane += 1) {
      const start = lane * rowsPerLane;
      const end = Math.min(start + rowsPerLane, ids.length);
      lanes.push(ids.slice(start, end));
    }
    return lanes;
  }

  const leftLanes = splitIntoLanes(leftOrder, 16);
  const middleLanes = splitIntoLanes(middleOrder, 14);
  const rightLanes = splitIntoLanes(rightOrder, 16);

  const verticalGap = 24;
  const topPadding = 124;
  const sidePadding = 76;
  const columnGap = 220;

  function maxWidth(ids, fallback = 140) {
    if (!ids.length) {
      return fallback;
    }
    return Math.max(...ids.map((id) => nodeById.get(id).w), fallback);
  }

  const leftMaxWidth = maxWidth(leftOrder, 160);
  const middleMaxWidth = maxWidth(middleOrder, 180);
  const rightMaxWidth = maxWidth(rightOrder, 170);

  const leftLaneShift = leftMaxWidth + 62;
  const middleLaneShift = middleMaxWidth + 66;
  const rightLaneShift = rightMaxWidth + 62;

  function columnHalfSpan(lanes, laneShift, maxW) {
    if (!lanes.length) {
      return maxW / 2;
    }
    return ((lanes.length - 1) * laneShift) / 2 + maxW / 2;
  }

  const leftHalfSpan = columnHalfSpan(leftLanes, leftLaneShift, leftMaxWidth);
  const middleHalfSpan = columnHalfSpan(middleLanes, middleLaneShift, middleMaxWidth);
  const rightHalfSpan = columnHalfSpan(rightLanes, rightLaneShift, rightMaxWidth);

  const leftCenterX = sidePadding + leftHalfSpan;
  const middleCenterX = leftCenterX + leftHalfSpan + columnGap + middleHalfSpan;
  const rightCenterX = middleCenterX + middleHalfSpan + columnGap + rightHalfSpan;

  function laneHeight(laneIds) {
    if (!laneIds.length) {
      return 0;
    }
    let height = 0;
    laneIds.forEach((id, index) => {
      height += nodeById.get(id).h;
      if (index > 0) {
        height += verticalGap;
      }
    });
    return height;
  }

  const allLanes = leftLanes.concat(middleLanes, rightLanes);
  const maxLaneHeight = Math.max(...allLanes.map((lane) => laneHeight(lane)), 1);
  const centerY = topPadding + maxLaneHeight / 2;

  function placeColumn(lanes, column, centerX, laneShift) {
    lanes.forEach((laneIds, laneIndex) => {
      const laneX = centerX + (laneIndex - (lanes.length - 1) / 2) * laneShift;
      const totalHeight = laneHeight(laneIds);
      let cursorY = centerY - totalHeight / 2;
      laneIds.forEach((id, rowIndex) => {
        const node = nodeById.get(id);
        node.x = Number(laneX.toFixed(2));
        node.y = Number((cursorY + node.h / 2).toFixed(2));
        node.column = column;
        node.lane = laneIndex;
        node.row = rowIndex;
        cursorY += node.h + verticalGap;
      });
    });
  }

  placeColumn(leftLanes, "left", leftCenterX, leftLaneShift);
  placeColumn(middleLanes, "middle", middleCenterX, middleLaneShift);
  placeColumn(rightLanes, "right", rightCenterX, rightLaneShift);
}

function termHref(uri, model) {
  if (uri.startsWith(model.namespace)) {
    const local = encodeURIComponent(uri.slice(model.namespace.length));
    return `terms/${local}.html`;
  }
  return uri;
}

function edgePath(edge, nodeById) {
  const source = nodeById.get(edge.source);
  const target = nodeById.get(edge.target);
  if (!source || !target) {
    return null;
  }

  if (edge.kind === "subClassOf" && source.column && source.column === target.column) {
    const hash = hashInt(edge.id) % 4;
    let laneX = 0;
    let startX = 0;
    let endX = 0;

    if (source.column === "right") {
      laneX = Math.max(source.x + source.w / 2, target.x + target.w / 2) + 28 + hash * 9;
      startX = source.x + source.w / 2;
      endX = target.x + target.w / 2;
    } else {
      laneX = Math.min(source.x - source.w / 2, target.x - target.w / 2) - 28 - hash * 9;
      startX = source.x - source.w / 2;
      endX = target.x - target.w / 2;
    }

    return {
      d: `M ${startX.toFixed(2)} ${source.y.toFixed(2)} L ${laneX.toFixed(2)} ${source.y.toFixed(2)} L ${laneX.toFixed(2)} ${target.y.toFixed(2)} L ${endX.toFixed(2)} ${target.y.toFixed(2)}`,
      source,
      target
    };
  }

  const forward = target.x >= source.x;
  const direction = forward ? 1 : -1;
  const startX = source.x + direction * (source.w / 2);
  const endX = target.x - direction * (target.w / 2);
  const startY = source.y;
  const endY = target.y;

  if (forward) {
    const laneOffset = ((hashInt(edge.id) % 3) - 1) * 6;
    const midX = (startX + endX) / 2 + laneOffset;
    return {
      d: `M ${startX.toFixed(2)} ${startY.toFixed(2)} L ${midX.toFixed(2)} ${startY.toFixed(2)} L ${midX.toFixed(2)} ${endY.toFixed(2)} L ${endX.toFixed(2)} ${endY.toFixed(2)}`,
      source,
      target
    };
  }

  const lift = 26 + (hashInt(edge.id) % 5) * 10;
  const laneY = Math.min(startY, endY) - lift;
  const outX = startX - 26;
  const inX = endX + 26;
  return {
    d: `M ${startX.toFixed(2)} ${startY.toFixed(2)} L ${outX.toFixed(2)} ${startY.toFixed(2)} L ${outX.toFixed(2)} ${laneY.toFixed(2)} L ${inX.toFixed(2)} ${laneY.toFixed(2)} L ${inX.toFixed(2)} ${endY.toFixed(2)} L ${endX.toFixed(2)} ${endY.toFixed(2)}`,
    source,
    target
  };
}

function buildSvg(model) {
  const nodeById = new Map(model.nodes.map((node) => [node.id, node]));

  const bounds = {
    minX: Infinity,
    maxX: -Infinity,
    minY: Infinity,
    maxY: -Infinity
  };

  for (const node of model.nodes) {
    bounds.minX = Math.min(bounds.minX, node.x - node.w / 2);
    bounds.maxX = Math.max(bounds.maxX, node.x + node.w / 2);
    bounds.minY = Math.min(bounds.minY, node.y - node.h / 2);
    bounds.maxY = Math.max(bounds.maxY, node.y + node.h / 2);
  }

  if (!Number.isFinite(bounds.minX)) {
    bounds.minX = 0;
    bounds.maxX = 1200;
    bounds.minY = 0;
    bounds.maxY = 800;
  }

  const headerTop = 74;
  const minContentX = 24;
  const minContentY = headerTop + 18;
  const shiftX = bounds.minX < minContentX ? (minContentX - bounds.minX) : 0;
  const shiftY = bounds.minY < minContentY ? (minContentY - bounds.minY) : 0;

  if (shiftX || shiftY) {
    for (const node of model.nodes) {
      node.x += shiftX;
      node.y += shiftY;
    }
    bounds.minX += shiftX;
    bounds.maxX += shiftX;
    bounds.minY += shiftY;
    bounds.maxY += shiftY;
  }

  const legendHeight = 70;
  const legendGap = 34;
  const bottomPadding = 28;
  const width = Math.ceil(bounds.maxX + 34);
  const legendY = Math.ceil(bounds.maxY + legendGap);
  const height = Math.ceil(legendY + legendHeight + bottomPadding);

  const edges = [...model.edges].sort((a, b) => {
    if (a.kind !== b.kind) {
      return a.kind.localeCompare(b.kind);
    }
    if (a.source !== b.source) {
      return a.source.localeCompare(b.source);
    }
    return a.target.localeCompare(b.target);
  });

  const nodes = [...model.nodes].sort((a, b) => {
    if (a.kind !== b.kind) {
      return KIND_ORDER.indexOf(a.kind) - KIND_ORDER.indexOf(b.kind);
    }
    return a.qname.localeCompare(b.qname);
  });

  let svg = "";
  svg += `<?xml version="1.0" encoding="UTF-8"?>\n`;
  svg += `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" role="img" aria-label="VCF-RDFizer ontology concept model">`;
  svg += "<defs>";
  svg += '<marker id="arrow-main" markerWidth="7" markerHeight="7" refX="6" refY="3.5" orient="auto" markerUnits="userSpaceOnUse"><path d="M0 0 L7 3.5 L0 7 z" fill="#151515"/></marker>';
  svg += '<marker id="arrow-subclass" markerWidth="7" markerHeight="7" refX="6" refY="3.5" orient="auto" markerUnits="userSpaceOnUse"><path d="M0 0 L7 3.5 L0 7 z" fill="#40578d"/></marker>';
  svg += "</defs>";

  svg += `<rect x="0" y="0" width="${width}" height="${height}" fill="#e6e6e6"/>`;
  svg += `<text x="24" y="34" font-family="IBM Plex Sans, sans-serif" font-size="25" font-weight="700" fill="#1a1a1a">${escapeXml("VCF-RDFizer Ontology Conceptual Model")}</text>`;
  svg += `<text x="24" y="56" font-family="IBM Plex Sans, sans-serif" font-size="13" fill="#2f2f2f">${escapeXml(`Generated ${model.generatedAt} from ${model.source}`)}</text>`;

  svg += '<g id="edges">';
  for (const edge of edges) {
    const path = edgePath(edge, nodeById);
    if (!path) {
      continue;
    }
    const style = EDGE_STYLE[edge.kind];
    svg += `<path d="${path.d}" fill="none" stroke="${style.color}" stroke-width="${style.width}" marker-end="url(#${style.marker})"${style.dash ? ` stroke-dasharray="${style.dash}"` : ""} stroke-linecap="round" stroke-linejoin="round"/>`;
  }
  svg += "</g>";

  svg += '<g id="nodes">';
  for (const node of nodes) {
    const style = NODE_STYLE[node.kind];
    const href = termHref(node.uri, model);
    const open = href
      ? `<a href="${escapeXml(href)}" target="${href.startsWith("http") ? "_blank" : "_self"}"${href.startsWith("http") ? ' rel="noreferrer"' : ""}>`
      : "";
    const close = href ? "</a>" : "";

    svg += open;
    if (style.shape === "ellipse") {
      svg += `<ellipse cx="${node.x.toFixed(2)}" cy="${node.y.toFixed(2)}" rx="${(node.w / 2).toFixed(2)}" ry="${(node.h / 2).toFixed(2)}" fill="${style.fill}" stroke="${style.stroke}" stroke-width="1.5"/>`;
      svg += `<text x="${node.x.toFixed(2)}" y="${(node.y + 4).toFixed(2)}" text-anchor="middle" font-family="IBM Plex Sans, sans-serif" font-size="${style.titleSize}" font-weight="600" fill="#121212">${escapeXml(node.title)}</text>`;
    } else {
      const x = node.x - node.w / 2;
      const y = node.y - node.h / 2;
      svg += `<rect x="${x.toFixed(2)}" y="${y.toFixed(2)}" width="${node.w.toFixed(2)}" height="${node.h.toFixed(2)}" rx="${style.rx}" fill="${style.fill}" stroke="${style.stroke}" stroke-width="1.5"/>`;
      if (node.subtitle) {
        svg += `<text x="${node.x.toFixed(2)}" y="${(node.y - 5).toFixed(2)}" text-anchor="middle" font-family="IBM Plex Sans, sans-serif" font-size="${style.titleSize}" font-weight="600" fill="#121212">${escapeXml(node.title)}</text>`;
        svg += `<text x="${node.x.toFixed(2)}" y="${(node.y + 12).toFixed(2)}" text-anchor="middle" font-family="IBM Plex Sans, sans-serif" font-size="${style.subtitleSize}" fill="#222222">${escapeXml(node.subtitle)}</text>`;
      } else {
        svg += `<text x="${node.x.toFixed(2)}" y="${(node.y + 4).toFixed(2)}" text-anchor="middle" font-family="IBM Plex Sans, sans-serif" font-size="${style.titleSize}" font-weight="600" fill="#121212">${escapeXml(node.title)}</text>`;
      }
    }
    svg += close;
  }
  svg += "</g>";

  const legendWidth = Math.min(1240, width - 40);
  const legendX = (width - legendWidth) / 2;
  svg += `<g id="legend" transform="translate(${legendX.toFixed(2)}, ${legendY.toFixed(2)})">`;
  svg += `<rect x="0" y="0" width="${legendWidth.toFixed(2)}" height="${legendHeight}" rx="10" fill="#f5f5f5" stroke="#222222" stroke-width="1.2"/>`;
  svg += '<text x="18" y="44" font-family="IBM Plex Sans, sans-serif" font-size="18" font-weight="700" fill="#111111">Legend</text>';
  svg += '<rect x="112" y="26" width="24" height="18" rx="5" fill="#cdc8dd" stroke="#111111" stroke-width="1.3"/>';
  svg += '<text x="146" y="40" font-family="IBM Plex Sans, sans-serif" font-size="14" fill="#111111">Class</text>';
  svg += '<rect x="224" y="26" width="24" height="18" rx="1" fill="#f0f0f0" stroke="#111111" stroke-width="1.3"/>';
  svg += '<text x="258" y="40" font-family="IBM Plex Sans, sans-serif" font-size="14" fill="#111111">Property</text>';
  svg += '<ellipse cx="382" cy="35" rx="12" ry="9" fill="#efe7be" stroke="#111111" stroke-width="1.3"/>';
  svg += '<text x="402" y="40" font-family="IBM Plex Sans, sans-serif" font-size="14" fill="#111111">Datatype / Literal</text>';
  svg += '<line x1="560" y1="35" x2="598" y2="35" stroke="#151515" stroke-width="2.5" marker-end="url(#arrow-main)"/>';
  svg += '<text x="610" y="40" font-family="IBM Plex Sans, sans-serif" font-size="14" fill="#111111">Domain / Range link</text>';
  svg += '<line x1="808" y1="35" x2="846" y2="35" stroke="#40578d" stroke-width="2.1" stroke-dasharray="7 5" marker-end="url(#arrow-subclass)"/>';
  svg += '<text x="858" y="40" font-family="IBM Plex Sans, sans-serif" font-size="14" fill="#111111">rdfs:subClassOf</text>';
  svg += "</g>";

  svg += "</svg>\n";
  return svg;
}

function buildDot(model) {
  const lines = [];
  lines.push("digraph VCFRConceptModel {");
  lines.push('  graph [rankdir=LR, bgcolor="#e6e6e6", fontname="IBM Plex Sans", fontsize="12"];');
  lines.push('  node [fontname="IBM Plex Sans"];');
  lines.push('  edge [fontname="IBM Plex Sans"];');

  for (const node of model.nodes) {
    const kind = node.kind;
    const shape = kind === "datatype" ? "ellipse" : "box";
    const fill = NODE_STYLE[kind].fill;
    const label = kind === "datatype"
      ? node.title
      : `${node.title}\\n${node.subtitle}`;
    lines.push(`  "${node.id}" [shape=${shape}, style="filled,rounded", fillcolor="${fill}", color="#111111", label="${label.replaceAll("\"", "\\\"")}"];`);
  }

  for (const edge of model.edges) {
    const style = EDGE_STYLE[edge.kind];
    const attrs = [`color="${style.color}"`, `penwidth=${style.width}`];
    if (style.dash) {
      attrs.push('style="dashed"');
    }
    lines.push(`  "${edge.source}" -> "${edge.target}" [${attrs.join(", ")}];`);
  }

  lines.push("}");
  lines.push("");
  return lines.join("\n");
}

function main() {
  const repoRoot = process.argv[2] ? path.resolve(process.argv[2]) : process.cwd();
  const ontologyPath = path.join(repoRoot, "ontology", "vcf-rdfizer-vocabulary.ttl");
  const assetsDir = path.join(repoRoot, "docs", "assets");
  const modelPath = path.join(assetsDir, "ontology-concept-model.json");
  const dotPath = path.join(assetsDir, "ontology-concept.dot");
  const conceptSvgPath = path.join(assetsDir, "ontology-concept.svg");
  const legacySvgPath = path.join(assetsDir, "ontology-graph-static.svg");

  if (!fs.existsSync(ontologyPath)) {
    throw new Error(`Missing ontology source: ${ontologyPath}`);
  }

  const ontologyText = fs.readFileSync(ontologyPath, "utf8");
  const parsed = parseOntology(ontologyText);
  const model = buildConceptModel(parsed);
  layoutModel(model);

  const svg = buildSvg(model);
  const dot = buildDot(model);

  fs.writeFileSync(modelPath, JSON.stringify(model, null, 2) + "\n", "utf8");
  fs.writeFileSync(dotPath, dot, "utf8");
  fs.writeFileSync(conceptSvgPath, svg, "utf8");
  fs.writeFileSync(legacySvgPath, svg, "utf8");

  console.log(`Wrote ${path.relative(repoRoot, modelPath)}`);
  console.log(`Wrote ${path.relative(repoRoot, dotPath)}`);
  console.log(`Wrote ${path.relative(repoRoot, conceptSvgPath)}`);
  console.log(`Wrote ${path.relative(repoRoot, legacySvgPath)}`);
}

main();
