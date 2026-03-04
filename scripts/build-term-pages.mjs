#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";

const collator = new Intl.Collator("en", { numeric: true, sensitivity: "base" });
const VCFR_PREFIX = "vcfr:";
const VCFR_NAMESPACE = "https://w3id.org/vcf-rdfizer/vocab#";
const ALLOWED_EXTENSIONS = new Set([
  ".ttl",
  ".nt",
  ".md",
  ".html",
  ".yml",
  ".yaml",
  ".sh",
  ".mjs",
  ".json",
]);
const TERM_PATTERN = /\bvcfr:([A-Za-z0-9_]+)/g;

function escapeHtml(text) {
  return String(text)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function ensureDir(dirPath) {
  fs.mkdirSync(dirPath, { recursive: true });
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function toLocalTerm(qname) {
  if (!qname || !qname.startsWith(VCFR_PREFIX)) {
    return null;
  }
  return qname.slice(VCFR_PREFIX.length);
}

function humanTermType(type) {
  const map = {
    class: "Class",
    objectProperty: "Object Property",
    datatypeProperty: "Datatype Property",
    annotationProperty: "Annotation Property",
  };
  return map[type] || type || "Referenced Term";
}

function scanTermUsage(repoRoot) {
  const usage = new Map();
  const skipDirectories = new Set([".git", "node_modules"]);

  function addUsage(term, relativeFile) {
    if (!usage.has(term)) {
      usage.set(term, { total: 0, files: new Map() });
    }
    const entry = usage.get(term);
    entry.total += 1;
    entry.files.set(relativeFile, (entry.files.get(relativeFile) || 0) + 1);
  }

  function walk(dirPath) {
    const entries = fs.readdirSync(dirPath, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.isDirectory()) {
        if (skipDirectories.has(entry.name)) {
          continue;
        }
        const nextPath = path.join(dirPath, entry.name);
        const relative = path.relative(repoRoot, nextPath).replaceAll("\\", "/");
        if (relative === "docs/terms") {
          continue;
        }
        walk(nextPath);
        continue;
      }

      const ext = path.extname(entry.name).toLowerCase();
      if (!ALLOWED_EXTENSIONS.has(ext)) {
        continue;
      }
      const absolutePath = path.join(dirPath, entry.name);
      const relativePath = path.relative(repoRoot, absolutePath).replaceAll("\\", "/");
      let content = "";
      try {
        content = fs.readFileSync(absolutePath, "utf8");
      } catch {
        continue;
      }

      for (const match of content.matchAll(TERM_PATTERN)) {
        addUsage(match[1], relativePath);
      }
    }
  }

  walk(repoRoot);
  return usage;
}

function parseShaclShapes(shaclText) {
  const blocks = new Map();
  const lines = shaclText.split(/\r?\n/);

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];
    const match = line.match(/^\s*vcfr:([A-Za-z0-9_]+)\s+a\s+sh:NodeShape\s*;/);
    if (!match) {
      continue;
    }
    const term = match[1];
    const collected = [line];
    let cursor = index + 1;
    while (cursor < lines.length) {
      collected.push(lines[cursor]);
      if (/^\s*\.\s*$/.test(lines[cursor])) {
        break;
      }
      cursor += 1;
    }
    blocks.set(term, collected.join("\n"));
    index = cursor;
  }

  return blocks;
}

function fileToPublishedLink(relativeFile) {
  if (relativeFile === "ontology/vcf-rdfizer-vocabulary.ttl") {
    return "../assets/vcf-rdfizer-vocabulary.ttl";
  }
  if (relativeFile === "shacl/vcf-rdfizer-vocabulary.shacl.ttl") {
    return "../assets/vcf-rdfizer-vocabulary.shacl.ttl";
  }
  if (relativeFile.startsWith("examples/")) {
    return `../assets/${path.basename(relativeFile)}`;
  }
  if (relativeFile.startsWith("docs/")) {
    return `../${relativeFile.slice("docs/".length)}`;
  }
  return null;
}

function buildRelationLists(term, node, graphData, nodeById) {
  if (!node) {
    return { outgoing: [], incoming: [] };
  }

  const outgoing = graphData.edges
    .filter((edge) => edge.source === node.id)
    .sort(
      (left, right) =>
        collator.compare(left.relation, right.relation) ||
        collator.compare(left.targetQname || "", right.targetQname || "")
    )
    .map((edge) => {
      const targetNode = nodeById.get(edge.target);
      return {
        relation: edge.relation,
        predicate: edge.predicateQname || edge.predicateUri || "-",
        qname: edge.targetQname || (targetNode ? targetNode.qname : edge.target),
        uri: targetNode ? targetNode.uri : null,
      };
    });

  const incoming = graphData.edges
    .filter((edge) => edge.target === node.id)
    .sort(
      (left, right) =>
        collator.compare(left.relation, right.relation) ||
        collator.compare(left.sourceQname || "", right.sourceQname || "")
    )
    .map((edge) => {
      const sourceNode = nodeById.get(edge.source);
      return {
        relation: edge.relation,
        predicate: edge.predicateQname || edge.predicateUri || "-",
        qname: edge.sourceQname || (sourceNode ? sourceNode.qname : edge.source),
        uri: sourceNode ? sourceNode.uri : null,
      };
    });

  return { outgoing, incoming };
}

function buildQnameCell(qname, uri, allTerms) {
  const local = toLocalTerm(qname);
  if (local && allTerms.has(local)) {
    return `<a href="${encodeURIComponent(local)}.html"><code>${escapeHtml(qname)}</code></a>`;
  }
  if (uri) {
    return `<a href="${escapeHtml(uri)}" target="_blank" rel="noreferrer"><code>${escapeHtml(qname)}</code></a>`;
  }
  return `<code>${escapeHtml(qname)}</code>`;
}

function buildTermPage({
  term,
  node,
  usageEntry,
  shaclBlock,
  relations,
  allTerms,
  hasReferenceRow,
}) {
  const pageTitle = `${VCFR_PREFIX}${term}`;
  const qname = `${VCFR_PREFIX}${term}`;
  const typeLabel = node
    ? humanTermType(node.termType)
    : shaclBlock
      ? "SHACL NodeShape"
      : "Referenced Term";
  const label = node && node.label ? node.label : "-";
  const comment = node && node.comment ? node.comment : "No ontology comment available.";
  const uri = node ? node.uri : `${VCFR_NAMESPACE}${term}`;
  const usageFiles = usageEntry ? [...usageEntry.files.entries()] : [];
  usageFiles.sort(
    (left, right) => right[1] - left[1] || collator.compare(left[0], right[0])
  );

  const outgoingRows = relations.outgoing
    .map(
      (entry) => `<tr>
      <td><code>${escapeHtml(entry.relation)}</code></td>
      <td><code>${escapeHtml(entry.predicate)}</code></td>
      <td>${buildQnameCell(entry.qname, entry.uri, allTerms)}</td>
    </tr>`
    )
    .join("\n");

  const incomingRows = relations.incoming
    .map(
      (entry) => `<tr>
      <td><code>${escapeHtml(entry.relation)}</code></td>
      <td><code>${escapeHtml(entry.predicate)}</code></td>
      <td>${buildQnameCell(entry.qname, entry.uri, allTerms)}</td>
    </tr>`
    )
    .join("\n");

  const usageRows = usageFiles
    .map(([filePath, count]) => {
      const publishLink = fileToPublishedLink(filePath);
      const publishCell = publishLink
        ? `<a href="${escapeHtml(publishLink)}" target="_blank" rel="noreferrer">Open</a>`
        : "-";
      return `<tr>
      <td><code>${escapeHtml(filePath)}</code></td>
      <td>${count}</td>
      <td>${publishCell}</td>
    </tr>`;
    })
    .join("\n");

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${escapeHtml(pageTitle)} · VCF-RDFizer Term</title>
  <style>
    :root {
      --bg: #f3efe8;
      --panel: #ffffff;
      --ink: #1b2229;
      --muted: #5c6a78;
      --accent: #0f6772;
      --border: #d5e1eb;
    }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      font-family: "IBM Plex Sans", "Segoe UI", sans-serif;
      color: var(--ink);
      background: var(--bg);
    }
    .container {
      width: min(980px, 94vw);
      margin: 0 auto;
      padding: 28px 0 52px;
      display: grid;
      gap: 16px;
    }
    .panel {
      background: var(--panel);
      border: 1px solid var(--border);
      border-radius: 14px;
      padding: 18px;
    }
    h1 { margin: 0 0 8px; font-size: 1.9rem; }
    h2 { margin: 0 0 10px; font-size: 1.2rem; }
    p { margin: 0; color: var(--muted); line-height: 1.55; }
    .crumbs { font-size: 0.92rem; color: var(--muted); }
    .crumbs a { color: var(--accent); text-decoration: none; }
    .badge {
      display: inline-flex;
      border: 1px solid var(--border);
      border-radius: 999px;
      padding: 4px 10px;
      font-size: 0.82rem;
      color: var(--accent);
      font-weight: 600;
      margin-right: 8px;
    }
    .meta {
      margin-top: 10px;
      display: grid;
      gap: 8px;
      font-size: 0.94rem;
    }
    code {
      font-family: "IBM Plex Mono", "SFMono-Regular", monospace;
      background: #eff6f8;
      border-radius: 6px;
      padding: 2px 6px;
      color: #174950;
      font-size: 0.88rem;
    }
    .actions {
      margin-top: 10px;
      display: flex;
      flex-wrap: wrap;
      gap: 10px;
    }
    .btn {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      padding: 8px 12px;
      border: 1px solid var(--border);
      border-radius: 10px;
      text-decoration: none;
      color: var(--accent);
      background: #fff;
      font-weight: 600;
      font-size: 0.9rem;
    }
    .table-wrap {
      overflow: auto;
      border: 1px solid var(--border);
      border-radius: 12px;
      margin-top: 10px;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      background: #fff;
      min-width: 620px;
    }
    th, td {
      border-bottom: 1px solid var(--border);
      text-align: left;
      padding: 8px 10px;
      font-size: 0.9rem;
      vertical-align: top;
      line-height: 1.4;
    }
    th { background: #edf5f8; }
    pre {
      margin: 0;
      background: #0f1b25;
      color: #dfedff;
      padding: 12px;
      border-radius: 10px;
      overflow: auto;
      font-size: 0.85rem;
      line-height: 1.5;
    }
    @media (max-width: 700px) {
      table { min-width: 520px; }
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="panel">
      <div class="crumbs"><a href="../index.html">Home</a> / <a href="../ontology-reference.html">Vocabulary Reference</a> / <a href="index.html">Term Pages</a></div>
      <h1>${escapeHtml(pageTitle)}</h1>
      <div><span class="badge">${escapeHtml(typeLabel)}</span>${node ? '<span class="badge">Declared in ontology</span>' : ""}${shaclBlock ? '<span class="badge">Referenced in SHACL</span>' : ""}</div>
      <div class="meta">
        <div><strong>IRI:</strong> <code>${escapeHtml(uri)}</code></div>
        <div><strong>Label:</strong> ${escapeHtml(label)}</div>
        <div><strong>Description:</strong> ${escapeHtml(comment)}</div>
      </div>
      <div class="actions">
        ${hasReferenceRow ? `<a class="btn" href="../ontology-reference.html#term-${encodeURIComponent(term)}">Jump to table row</a>` : `<a class="btn" href="../ontology-reference.html">Open vocabulary reference</a>`}
        <a class="btn" href="../assets/vcf-rdfizer-vocabulary.ttl" target="_blank" rel="noreferrer">Open Ontology TTL</a>
        <a class="btn" href="../assets/vcf-rdfizer-vocabulary.shacl.ttl" target="_blank" rel="noreferrer">Open SHACL TTL</a>
      </div>
    </div>

    <div class="panel">
      <h2>Ontology Relationships</h2>
      ${node ? "<p>Relationships are derived from domain/range/subclass and annotation links in the ontology graph data.</p>" : "<p>This term is not declared as an ontology term in the current graph export.</p>"}
      <div class="table-wrap">
        <table>
          <thead><tr><th colspan="3">Outgoing</th></tr><tr><th>Relation</th><th>Predicate</th><th>Target</th></tr></thead>
          <tbody>${outgoingRows || '<tr><td colspan="3">None</td></tr>'}</tbody>
        </table>
      </div>
      <div class="table-wrap">
        <table>
          <thead><tr><th colspan="3">Incoming</th></tr><tr><th>Relation</th><th>Predicate</th><th>Source</th></tr></thead>
          <tbody>${incomingRows || '<tr><td colspan="3">None</td></tr>'}</tbody>
        </table>
      </div>
    </div>

    <div class="panel">
      <h2>Repository Usage</h2>
      <p>References to <code>${escapeHtml(qname)}</code> across tracked repo files.</p>
      <div class="table-wrap">
        <table>
          <thead><tr><th>Source File</th><th>Hits</th><th>Pages View</th></tr></thead>
          <tbody>${usageRows || '<tr><td colspan="3">No direct references found.</td></tr>'}</tbody>
        </table>
      </div>
    </div>

    <div class="panel">
      <h2>SHACL Snippet</h2>
      ${shaclBlock ? `<pre>${escapeHtml(shaclBlock)}</pre>` : "<p>No dedicated SHACL NodeShape block for this term.</p>"}
    </div>
  </div>
</body>
</html>
`;
}

function buildIndexPage({ terms, nodeByLocal, shaclBlocks, usage }) {
  const rows = terms
    .map((term) => {
      const node = nodeByLocal.get(term) || null;
      const usageEntry = usage.get(term) || null;
      const typeLabel = node
        ? humanTermType(node.termType)
        : shaclBlocks.has(term)
          ? "SHACL NodeShape"
          : "Referenced Term";
      const source = [
        node ? "ontology" : null,
        shaclBlocks.has(term) ? "shacl" : null,
        usageEntry ? "repo" : null,
      ]
        .filter(Boolean)
        .join(", ");
      const summary = node && node.comment ? node.comment : "No ontology comment available.";
      const count = usageEntry ? usageEntry.total : 0;

      return `<tr>
      <td><a href="${encodeURIComponent(term)}.html"><code>${escapeHtml(`${VCFR_PREFIX}${term}`)}</code></a></td>
      <td>${escapeHtml(typeLabel)}</td>
      <td>${escapeHtml(source || "-")}</td>
      <td>${count}</td>
      <td>${escapeHtml(summary)}</td>
    </tr>`;
    })
    .join("\n");

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>VCF-RDFizer Term Pages</title>
  <style>
    :root {
      --bg: #f3efe8;
      --panel: #ffffff;
      --ink: #1b2229;
      --muted: #5c6a78;
      --accent: #0f6772;
      --border: #d5e1eb;
    }
    * { box-sizing: border-box; }
    body { margin: 0; font-family: "IBM Plex Sans", "Segoe UI", sans-serif; color: var(--ink); background: var(--bg); }
    .container { width: min(1160px, 94vw); margin: 0 auto; padding: 30px 0 56px; display: grid; gap: 14px; }
    .panel { background: var(--panel); border: 1px solid var(--border); border-radius: 14px; padding: 18px; }
    h1 { margin: 0 0 8px; font-size: 2rem; }
    p { margin: 0; color: var(--muted); line-height: 1.55; }
    .actions { margin-top: 12px; display: flex; flex-wrap: wrap; gap: 10px; }
    .btn { display: inline-flex; align-items: center; justify-content: center; padding: 8px 12px; border: 1px solid var(--border); border-radius: 10px; text-decoration: none; color: var(--accent); background: #fff; font-weight: 600; font-size: 0.9rem; }
    .table-wrap { overflow: auto; border: 1px solid var(--border); border-radius: 12px; margin-top: 10px; }
    table { width: 100%; border-collapse: collapse; min-width: 760px; background: #fff; }
    th, td { border-bottom: 1px solid var(--border); padding: 8px 10px; font-size: 0.9rem; text-align: left; vertical-align: top; line-height: 1.4; }
    th { background: #edf5f8; }
    code { font-family: "IBM Plex Mono", "SFMono-Regular", monospace; background: #eff6f8; border-radius: 6px; padding: 2px 6px; color: #174950; font-size: 0.88rem; }
  </style>
</head>
<body>
  <div class="container">
    <div class="panel">
      <h1>VCF-RDFizer Term Pages</h1>
      <p>HTML documentation pages for every <code>vcfr:</code> term referenced in this repository (ontology, SHACL, examples, and docs).</p>
      <div class="actions">
        <a class="btn" href="../index.html">Back to Home</a>
        <a class="btn" href="../ontology-reference.html">Open Vocabulary Reference</a>
        <a class="btn" href="../assets/vcf-rdfizer-vocabulary.ttl" target="_blank" rel="noreferrer">Open Ontology TTL</a>
        <a class="btn" href="../assets/vcf-rdfizer-vocabulary.shacl.ttl" target="_blank" rel="noreferrer">Open SHACL TTL</a>
      </div>
    </div>
    <div class="panel">
      <div class="table-wrap">
        <table>
          <thead><tr><th>Term</th><th>Type</th><th>Sources</th><th>Repo Hits</th><th>Summary</th></tr></thead>
          <tbody>
${rows}
          </tbody>
        </table>
      </div>
    </div>
  </div>
</body>
</html>
`;
}

function main() {
  const repoRoot = process.argv[2] ? path.resolve(process.argv[2]) : process.cwd();
  const docsDir = path.join(repoRoot, "docs");
  const termsDir = path.join(docsDir, "terms");
  const graphPath = path.join(docsDir, "assets", "ontology-graph-data.json");
  const shaclPath = path.join(repoRoot, "shacl", "vcf-rdfizer-vocabulary.shacl.ttl");
  const ontologyReferencePath = path.join(docsDir, "ontology-reference.html");

  if (!fs.existsSync(graphPath)) {
    throw new Error(`Graph data not found at ${graphPath}. Run build-ontology-graph-data first.`);
  }

  const graphData = readJson(graphPath);
  const shaclText = fs.readFileSync(shaclPath, "utf8");
  const ontologyReferenceText = fs.readFileSync(ontologyReferencePath, "utf8");
  const shaclBlocks = parseShaclShapes(shaclText);
  const usage = scanTermUsage(repoRoot);
  const referenceTermIds = new Set(
    [...ontologyReferenceText.matchAll(/id="term-([A-Za-z0-9_]+)"/g)].map((match) => match[1])
  );

  const nodeById = new Map();
  const nodeByLocal = new Map();
  for (const node of graphData.nodes) {
    nodeById.set(node.id, node);
    const local = toLocalTerm(node.qname);
    if (!local) {
      continue;
    }
    nodeByLocal.set(local, node);
  }

  const allTerms = new Set([
    ...usage.keys(),
    ...nodeByLocal.keys(),
    ...shaclBlocks.keys(),
  ]);
  const sortedTerms = [...allTerms].sort(collator.compare);

  ensureDir(termsDir);
  for (const term of sortedTerms) {
    const node = nodeByLocal.get(term) || null;
    const usageEntry = usage.get(term) || null;
    const shaclBlock = shaclBlocks.get(term) || null;
    const relations = buildRelationLists(term, node, graphData, nodeById);
    const page = buildTermPage({
      term,
      node,
      usageEntry,
      shaclBlock,
      relations,
      allTerms,
      hasReferenceRow: referenceTermIds.has(term),
    });
    const outputPath = path.join(termsDir, `${term}.html`);
    fs.writeFileSync(outputPath, page, "utf8");
  }

  const indexHtml = buildIndexPage({
    terms: sortedTerms,
    nodeByLocal,
    shaclBlocks,
    usage,
  });
  fs.writeFileSync(path.join(termsDir, "index.html"), indexHtml, "utf8");
  console.log(`Wrote ${sortedTerms.length} term pages to docs/terms.`);
}

main();
