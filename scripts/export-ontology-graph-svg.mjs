#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";

const TYPE_COLORS = {
  class: "#c8d9ee",
  objectProperty: "#d2e6cf",
  datatypeProperty: "#f2e7c9",
  annotationProperty: "#efd0cf",
  external: "#e6e6e6"
};

const RELATION_COLORS = {
  subClassOf: "#1f6f92",
  domain: "#2f8040",
  range: "#ab6b22",
  annotation: "#a64343"
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

function approxTextWidth(text, fontSize = 11) {
  return text.length * fontSize * 0.58;
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function boxForNode(node) {
  const primary = node.qname;
  const secondary = node.label && node.label.toLowerCase() !== node.qname.toLowerCase() ? node.label : "";
  const lines = secondary ? [primary, secondary] : [primary];
  const fontSize = node.isExternal ? 10 : 11;
  const lineHeight = fontSize + 2;
  const width = Math.max(...lines.map((line) => approxTextWidth(line, fontSize))) + 22;
  const height = lines.length * lineHeight + 14;
  return {
    id: node.id,
    qname: node.qname,
    label: node.label,
    termType: node.termType,
    isExternal: node.isExternal,
    comment: node.comment,
    lines,
    fontSize,
    lineHeight,
    w: clamp(width, 92, 260),
    h: clamp(height, 28, 62),
    x: node.x * 5.4,
    y: node.y * 5.4,
    ox: node.x * 5.4,
    oy: node.y * 5.4
  };
}

function resolveOverlaps(boxes) {
  const spacing = 10;

  for (let iter = 0; iter < 280; iter += 1) {
    let moved = false;

    for (let i = 0; i < boxes.length; i += 1) {
      const a = boxes[i];
      for (let j = i + 1; j < boxes.length; j += 1) {
        const b = boxes[j];

        const dx = a.x - b.x;
        const dy = a.y - b.y;

        const overlapX = (a.w + b.w) / 2 + spacing - Math.abs(dx);
        const overlapY = (a.h + b.h) / 2 + spacing - Math.abs(dy);

        if (overlapX <= 0 || overlapY <= 0) {
          continue;
        }

        moved = true;

        if (overlapX < overlapY) {
          const push = overlapX / 2;
          const dir = dx === 0 ? (hashInt(a.id + b.id) % 2 === 0 ? 1 : -1) : Math.sign(dx);
          a.x += dir * push;
          b.x -= dir * push;
        } else {
          const push = overlapY / 2;
          const dir = dy === 0 ? (hashInt(a.id + b.id + "y") % 2 === 0 ? 1 : -1) : Math.sign(dy);
          a.y += dir * push;
          b.y -= dir * push;
        }
      }
    }

    for (const box of boxes) {
      box.x += (box.ox - box.x) * 0.025;
      box.y += (box.oy - box.y) * 0.025;
    }

    if (!moved && iter > 40) {
      break;
    }
  }
}

function boundsForBoxes(boxes) {
  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;

  for (const box of boxes) {
    minX = Math.min(minX, box.x - box.w / 2);
    maxX = Math.max(maxX, box.x + box.w / 2);
    minY = Math.min(minY, box.y - box.h / 2);
    maxY = Math.max(maxY, box.y + box.h / 2);
  }

  if (!Number.isFinite(minX)) {
    minX = -1;
    maxX = 1;
    minY = -1;
    maxY = 1;
  }

  return { minX, maxX, minY, maxY };
}

function edgeAnchor(fromBox, toBox) {
  const dx = toBox.x - fromBox.x;
  const dy = toBox.y - fromBox.y;

  const safeDx = Math.abs(dx) < 0.001 ? 0.001 : dx;
  const safeDy = Math.abs(dy) < 0.001 ? 0.001 : dy;

  const tx = (fromBox.w / 2) / Math.abs(safeDx);
  const ty = (fromBox.h / 2) / Math.abs(safeDy);
  const t = Math.min(tx, ty);

  return {
    x: fromBox.x + dx * t,
    y: fromBox.y + dy * t
  };
}

function formatN(value) {
  return Number(value.toFixed(2));
}

function renderLegend(x, y, summary) {
  const safeSummary = summary || { countsByType: {}, relationCounts: {} };
  const countsByType = safeSummary.countsByType || {};
  const relationCounts = safeSummary.relationCounts || {};

  const typeCellWidth = 150;
  const relationCellWidth = 108;
  const legendWidth = Math.max(
    430,
    26 + TYPE_ORDER.length * typeCellWidth,
    26 + REL_ORDER.length * relationCellWidth
  );

  let out = "";
  out += `<g transform="translate(${x}, ${y})">`;
  out += `<rect x="0" y="0" width="${legendWidth}" height="82" rx="12" fill="#ffffff" stroke="#d3dfe8"/>`;
  out += `<text x="14" y="20" font-size="14" font-family="IBM Plex Sans, sans-serif" font-weight="600" fill="#1e2f41">Legend</text>`;

  TYPE_ORDER.forEach((type, index) => {
    const count = countsByType[type] || 0;
    const tx = 14 + index * typeCellWidth;
    out += `<g transform="translate(${tx}, 42)">`;
    out += `<rect x="0" y="-8" width="12" height="12" rx="2" fill="${TYPE_COLORS[type]}" stroke="#7a8a99"/>`;
    out += `<text x="18" y="2" font-size="12" font-family="IBM Plex Sans, sans-serif" fill="#263849">${escapeXml(type)} (${count})</text>`;
    out += `</g>`;
  });

  REL_ORDER.forEach((rel, index) => {
    const count = relationCounts[rel] || 0;
    const tx = 14 + index * relationCellWidth;
    out += `<g transform="translate(${tx}, 66)">`;
    out += `<line x1="0" y1="-2" x2="14" y2="-2" stroke="${RELATION_COLORS[rel]}" stroke-width="2"/>`;
    out += `<text x="20" y="2" font-size="12" font-family="IBM Plex Sans, sans-serif" fill="#263849">${escapeXml(rel)} (${count})</text>`;
    out += `</g>`;
  });

  out += `</g>`;
  return out;
}

function buildSvg(data) {
  const boxes = data.nodes.map(boxForNode);
  resolveOverlaps(boxes);

  const boxById = new Map(boxes.map((box) => [box.id, box]));

  const bounds = boundsForBoxes(boxes);
  const margin = 36;
  const header = 58;
  const footer = 116;

  const width = Math.ceil(bounds.maxX - bounds.minX + margin * 2);
  const height = Math.ceil(bounds.maxY - bounds.minY + margin * 2 + header + footer);

  for (const box of boxes) {
    box.x = box.x - bounds.minX + margin;
    box.y = box.y - bounds.minY + margin + header;
  }

  const sortedEdges = [...data.edges].sort((a, b) => {
    if (a.relation !== b.relation) {
      return REL_ORDER.indexOf(a.relation) - REL_ORDER.indexOf(b.relation);
    }
    if (a.sourceQname !== b.sourceQname) {
      return a.sourceQname.localeCompare(b.sourceQname);
    }
    return a.targetQname.localeCompare(b.targetQname);
  });

  let svg = "";
  svg += `<?xml version="1.0" encoding="UTF-8"?>\n`;
  svg += `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" role="img" aria-label="VCF-RDFizer ontology publication diagram">`;
  svg += `<defs>`;
  svg += `<linearGradient id="canvas-bg" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stop-color="#f6f2ec"/><stop offset="100%" stop-color="#eef4f9"/></linearGradient>`;
  for (const rel of REL_ORDER) {
    svg += `<marker id="arrow-${rel}" markerWidth="8" markerHeight="8" refX="7" refY="4" orient="auto" markerUnits="strokeWidth"><path d="M 0 0 L 8 4 L 0 8 z" fill="${RELATION_COLORS[rel]}"/></marker>`;
  }
  svg += `</defs>`;

  svg += `<rect x="0" y="0" width="${width}" height="${height}" fill="url(#canvas-bg)"/>`;
  svg += `<rect x="8" y="8" width="${width - 16}" height="${height - 16}" rx="14" fill="#ffffff" fill-opacity="0.72" stroke="#d3dfe8"/>`;

  svg += `<text x="24" y="30" font-family="Space Grotesk, IBM Plex Sans, sans-serif" font-size="22" font-weight="700" fill="#1f2f3f">VCF-RDFizer Vocabulary Relationship Overview</text>`;
  svg += `<text x="24" y="50" font-family="IBM Plex Sans, sans-serif" font-size="12" fill="#4f6375">Generated ${escapeXml(data.generatedAt)} from ontology/vcf-rdfizer-vocabulary.ttl</text>`;

  svg += `<g id="edges" opacity="0.9">`;
  for (const edge of sortedEdges) {
    const source = boxById.get(edge.source);
    const target = boxById.get(edge.target);
    if (!source || !target) {
      continue;
    }

    const start = edgeAnchor(source, target);
    const end = edgeAnchor(target, source);

    const dx = end.x - start.x;
    const dy = end.y - start.y;
    const dist = Math.max(Math.hypot(dx, dy), 1);
    const nx = -dy / dist;
    const ny = dx / dist;
    const curve = ((hashInt(edge.id) % 7) - 3) * 2.2 + (edge.relation === "annotation" ? 12 : 0);
    const cx = (start.x + end.x) / 2 + nx * curve;
    const cy = (start.y + end.y) / 2 + ny * curve;

    const d = `M ${formatN(start.x)} ${formatN(start.y)} Q ${formatN(cx)} ${formatN(cy)} ${formatN(end.x)} ${formatN(end.y)}`;
    const color = RELATION_COLORS[edge.relation] || "#6f8394";
    const widthStroke = edge.relation === "annotation" ? 1.25 : 1.45;

    svg += `<path d="${d}" fill="none" stroke="${color}" stroke-width="${widthStroke}" stroke-opacity="0.6" marker-end="url(#arrow-${edge.relation})"`;
    if (edge.relation === "annotation") {
      svg += ` stroke-dasharray="4 4"`;
    }
    svg += `/>`;

    if (dist > 130) {
      const lx = (start.x + end.x) / 2 + nx * (curve + 6);
      const ly = (start.y + end.y) / 2 + ny * (curve + 6);
      const label = edge.relation;
      const lw = approxTextWidth(label, 9.5) + 10;
      svg += `<rect x="${formatN(lx - lw / 2)}" y="${formatN(ly - 8)}" width="${formatN(lw)}" height="14" rx="2" fill="#f7f7f7" stroke="#b9c5d2" stroke-width="0.6"/>`;
      svg += `<text x="${formatN(lx)}" y="${formatN(ly + 2)}" text-anchor="middle" font-family="IBM Plex Sans, sans-serif" font-size="9.5" fill="#2e4050">${escapeXml(label)}</text>`;
    }
  }
  svg += `</g>`;

  const sortedBoxes = [...boxes].sort((a, b) => {
    if (a.termType !== b.termType) {
      return TYPE_ORDER.indexOf(a.termType) - TYPE_ORDER.indexOf(b.termType);
    }
    return a.qname.localeCompare(b.qname);
  });

  svg += `<g id="nodes">`;
  for (const box of sortedBoxes) {
    const fill = TYPE_COLORS[box.termType] || "#e6e6e6";
    const x = formatN(box.x - box.w / 2);
    const y = formatN(box.y - box.h / 2);

    svg += `<rect x="${x}" y="${y}" width="${formatN(box.w)}" height="${formatN(box.h)}" rx="6" fill="${fill}" stroke="#2a2a2a" stroke-width="1"/>`;

    let textY = box.y - ((box.lines.length - 1) * box.lineHeight) / 2 + 2;
    for (let i = 0; i < box.lines.length; i += 1) {
      const fontWeight = i === 0 ? 600 : 400;
      svg += `<text x="${formatN(box.x)}" y="${formatN(textY + i * box.lineHeight)}" text-anchor="middle" font-family="IBM Plex Sans, sans-serif" font-size="${box.fontSize}" font-weight="${fontWeight}" fill="#1d2c3b">${escapeXml(box.lines[i])}</text>`;
    }
  }
  svg += `</g>`;

  svg += renderLegend(24, height - 96, data.summary);

  svg += `</svg>\n`;
  return svg;
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
  const svg = buildSvg(data);
  fs.writeFileSync(outputPath, svg, "utf8");

  console.log("Wrote", path.relative(repoRoot, outputPath));
}

main();
