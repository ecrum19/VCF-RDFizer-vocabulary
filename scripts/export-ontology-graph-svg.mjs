#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";

const TYPE_COLORS = {
  class: "#b7dcf6",
  objectProperty: "#bee7c3",
  datatypeProperty: "#f7d7ab",
  annotationProperty: "#f2bebf",
  external: "#dfe6ee"
};

const RELATION_COLORS = {
  subClassOf: "#1f6f92",
  domain: "#2f8040",
  range: "#ab6b22",
  annotation: "#a64343"
};

const RELATION_CURVE = {
  subClassOf: 6,
  domain: 16,
  range: -16,
  annotation: 24
};

const TYPE_ORDER = ["class", "objectProperty", "datatypeProperty", "annotationProperty", "external"];
const REL_ORDER = ["subClassOf", "domain", "range", "annotation"];

function hashInt(input) {
  let hash = 2166136261;
  for (let i = 0; i < input.length; i += 1) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function escapeXml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function formatNumber(value) {
  return Number(value.toFixed(2));
}

function computeBounds(nodes) {
  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;

  for (const node of nodes) {
    minX = Math.min(minX, node.x);
    maxX = Math.max(maxX, node.x);
    minY = Math.min(minY, node.y);
    maxY = Math.max(maxY, node.y);
  }

  if (!Number.isFinite(minX)) {
    minX = -1;
    maxX = 1;
    minY = -1;
    maxY = 1;
  }

  return { minX, maxX, minY, maxY };
}

function buildNodePositioner(nodes, graphWidth, graphHeight, margin) {
  const bounds = computeBounds(nodes);
  const spanX = Math.max(bounds.maxX - bounds.minX, 1);
  const spanY = Math.max(bounds.maxY - bounds.minY, 1);

  return (node) => {
    const x = margin + ((node.x - bounds.minX) / spanX) * graphWidth;
    const y = margin + ((node.y - bounds.minY) / spanY) * graphHeight;
    return { x, y };
  };
}

function nodeRadius(node) {
  if (node.isExternal) {
    return 5.2;
  }
  const degreeFactor = Math.min(5, Math.max(0, node.degree || 0));
  return 6.2 + degreeFactor * 0.52;
}

function renderLegend(x, y, width, data) {
  const typeEntries = TYPE_ORDER.map((type) => ({
    label: type,
    color: TYPE_COLORS[type],
    count: data.summary.countsByType[type] || 0
  }));

  const relEntries = REL_ORDER.map((rel) => ({
    label: rel,
    color: RELATION_COLORS[rel],
    count: data.summary.relationCounts[rel] || 0
  }));

  let cursorY = y + 32;
  let out = "";

  out += `<rect x="${x}" y="${y}" width="${width}" height="420" rx="16" fill="#ffffff" stroke="#d3dfe8"/>`;
  out += `<text x="${x + 16}" y="${y + 24}" font-size="18" font-family="IBM Plex Sans, sans-serif" font-weight="600" fill="#1d2a36">Legend</text>`;

  out += `<text x="${x + 16}" y="${cursorY}" font-size="13" font-family="IBM Plex Sans, sans-serif" fill="#4a5b6b">Node types</text>`;
  cursorY += 16;

  for (const entry of typeEntries) {
    out += `<rect x="${x + 16}" y="${cursorY - 9}" width="12" height="12" rx="2" fill="${entry.color}" stroke="#b9c6d2"/>`;
    out += `<text x="${x + 34}" y="${cursorY + 1}" font-size="12" font-family="IBM Plex Sans, sans-serif" fill="#2a3947">${escapeXml(entry.label)} (${entry.count})</text>`;
    cursorY += 20;
  }

  cursorY += 8;
  out += `<text x="${x + 16}" y="${cursorY}" font-size="13" font-family="IBM Plex Sans, sans-serif" fill="#4a5b6b">Edge relations</text>`;
  cursorY += 16;

  for (const entry of relEntries) {
    out += `<line x1="${x + 16}" y1="${cursorY - 4}" x2="${x + 34}" y2="${cursorY - 4}" stroke="${entry.color}" stroke-width="2.3"/>`;
    out += `<text x="${x + 40}" y="${cursorY}" font-size="12" font-family="IBM Plex Sans, sans-serif" fill="#2a3947">${escapeXml(entry.label)} (${entry.count})</text>`;
    cursorY += 20;
  }

  cursorY += 10;
  out += `<text x="${x + 16}" y="${cursorY}" font-size="12" font-family="IBM Plex Sans, sans-serif" fill="#4b6174">Total nodes: ${data.summary.nodes}</text>`;
  cursorY += 18;
  out += `<text x="${x + 16}" y="${cursorY}" font-size="12" font-family="IBM Plex Sans, sans-serif" fill="#4b6174">Total edges: ${data.summary.edges}</text>`;

  return out;
}

function renderSvg(data, outputPath) {
  const canvasWidth = 2580;
  const canvasHeight = 1780;
  const sidePanel = 380;
  const margin = 90;

  const graphWidth = canvasWidth - sidePanel - margin * 2;
  const graphHeight = canvasHeight - margin * 2;

  const positionFor = buildNodePositioner(data.nodes, graphWidth, graphHeight, margin);
  const positioned = new Map();
  for (const node of data.nodes) {
    positioned.set(node.id, positionFor(node));
  }

  const edges = [...data.edges].sort((a, b) => {
    if (a.relation !== b.relation) {
      return REL_ORDER.indexOf(a.relation) - REL_ORDER.indexOf(b.relation);
    }
    if (a.sourceQname !== b.sourceQname) {
      return a.sourceQname.localeCompare(b.sourceQname);
    }
    return a.targetQname.localeCompare(b.targetQname);
  });

  const nodes = [...data.nodes].sort((a, b) => {
    if (a.termType !== b.termType) {
      return TYPE_ORDER.indexOf(a.termType) - TYPE_ORDER.indexOf(b.termType);
    }
    return a.qname.localeCompare(b.qname);
  });

  let svg = "";
  svg += `<?xml version="1.0" encoding="UTF-8"?>\n`;
  svg += `<svg xmlns="http://www.w3.org/2000/svg" width="${canvasWidth}" height="${canvasHeight}" viewBox="0 0 ${canvasWidth} ${canvasHeight}" role="img" aria-label="VCF-RDFizer ontology relationship graph">`;
  svg += `<defs>`;
  svg += `<linearGradient id="bg-grad" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stop-color="#f5f0e8"/><stop offset="70%" stop-color="#eef5fa"/><stop offset="100%" stop-color="#faf4ea"/></linearGradient>`;

  for (const relation of REL_ORDER) {
    const color = RELATION_COLORS[relation];
    svg += `<marker id="arrow-${relation}" markerWidth="8" markerHeight="8" refX="7" refY="4" orient="auto" markerUnits="strokeWidth">`;
    svg += `<path d="M 0 0 L 8 4 L 0 8 z" fill="${color}"/>`;
    svg += `</marker>`;
  }

  svg += `</defs>`;

  svg += `<rect x="0" y="0" width="${canvasWidth}" height="${canvasHeight}" fill="url(#bg-grad)"/>`;
  svg += `<rect x="24" y="24" width="${canvasWidth - 48}" height="${canvasHeight - 48}" rx="20" fill="#ffffff" fill-opacity="0.66" stroke="#d8e3ec"/>`;

  svg += `<text x="${margin}" y="52" font-family="Space Grotesk, IBM Plex Sans, sans-serif" font-size="30" font-weight="700" fill="#1d2a36">VCF-RDFizer Vocabulary: Static Relationship Graph</text>`;
  svg += `<text x="${margin}" y="78" font-family="IBM Plex Sans, sans-serif" font-size="14" fill="#4e6070">Generated from ontology/vcf-rdfizer-vocabulary.ttl at ${escapeXml(data.generatedAt)} (UTC)</text>`;

  svg += `<g id="edges" opacity="0.92">`;
  for (const edge of edges) {
    const source = positioned.get(edge.source);
    const target = positioned.get(edge.target);
    if (!source || !target) {
      continue;
    }

    const dx = target.x - source.x;
    const dy = target.y - source.y;
    const distance = Math.max(Math.hypot(dx, dy), 1);
    const nx = -dy / distance;
    const ny = dx / distance;
    const jitter = (hashInt(edge.id) % 11) - 5;
    const curvature = (RELATION_CURVE[edge.relation] || 0) + jitter * 1.5;

    const cx = (source.x + target.x) / 2 + nx * curvature;
    const cy = (source.y + target.y) / 2 + ny * curvature;

    const path = `M ${formatNumber(source.x)} ${formatNumber(source.y)} Q ${formatNumber(cx)} ${formatNumber(cy)} ${formatNumber(target.x)} ${formatNumber(target.y)}`;
    const color = RELATION_COLORS[edge.relation] || "#6f8394";
    const width = edge.relation === "annotation" ? 1.25 : 1.55;
    const dash = edge.relation === "annotation" ? "4 4" : "";

    svg += `<path d="${path}" fill="none" stroke="${color}" stroke-width="${width}" stroke-opacity="0.54" marker-end="url(#arrow-${edge.relation})"`;
    if (dash) {
      svg += ` stroke-dasharray="${dash}"`;
    }
    svg += `/>`;
  }
  svg += `</g>`;

  svg += `<g id="nodes">`;
  for (const node of nodes) {
    const pos = positioned.get(node.id);
    if (!pos) {
      continue;
    }

    const fill = TYPE_COLORS[node.termType] || "#dfe6ee";
    const radius = nodeRadius(node);
    const stroke = node.isExternal ? "#8898aa" : "#5a6f82";
    const strokeWidth = node.isExternal ? 0.9 : 1.1;

    svg += `<circle cx="${formatNumber(pos.x)}" cy="${formatNumber(pos.y)}" r="${formatNumber(radius)}" fill="${fill}" stroke="${stroke}" stroke-width="${strokeWidth}"/>`;

    const labelOffset = radius + 6;
    const alignLeft = pos.x > margin + graphWidth - 240;
    const labelX = alignLeft ? pos.x - labelOffset : pos.x + labelOffset;
    const anchor = alignLeft ? "end" : "start";
    const fontSize = node.isExternal ? 10 : 11.2;
    const textColor = node.isExternal ? "#5f6f80" : "#1e2e3f";

    svg += `<text x="${formatNumber(labelX)}" y="${formatNumber(pos.y + 3.8)}" text-anchor="${anchor}" font-family="IBM Plex Sans, sans-serif" font-size="${fontSize}" fill="${textColor}" stroke="#ffffff" stroke-width="3" paint-order="stroke fill">${escapeXml(node.qname)}</text>`;
  }
  svg += `</g>`;

  svg += renderLegend(canvasWidth - sidePanel + 22, 114, sidePanel - 44, data);

  svg += `<text x="${canvasWidth - sidePanel + 38}" y="560" font-size="12" font-family="IBM Plex Sans, sans-serif" fill="#4a6175">Edge labels omitted in static export for readability.</text>`;
  svg += `<text x="${canvasWidth - sidePanel + 38}" y="579" font-size="12" font-family="IBM Plex Sans, sans-serif" fill="#4a6175">Use docs/ontology-graph.html for interactive filtering.</text>`;

  svg += `</svg>\n`;

  fs.writeFileSync(outputPath, svg, "utf8");
}

function main() {
  const repoRoot = process.argv[2] ? path.resolve(process.argv[2]) : process.cwd();
  const assetsDir = path.join(repoRoot, "docs", "assets");
  const graphDataPath = path.join(assetsDir, "ontology-graph-data.json");
  const outputPath = path.join(assetsDir, "ontology-graph-static.svg");

  if (!fs.existsSync(graphDataPath)) {
    throw new Error("Missing graph data file: " + graphDataPath);
  }

  const data = JSON.parse(fs.readFileSync(graphDataPath, "utf8"));
  renderSvg(data, outputPath);

  console.log("Wrote", path.relative(repoRoot, outputPath));
}

main();
