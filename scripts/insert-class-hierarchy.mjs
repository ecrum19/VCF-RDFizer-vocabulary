#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";

const repoRoot = process.cwd();
const sitePath = path.resolve(repoRoot, process.argv[2] || "site");
const hierarchyPath = path.join(sitePath, "assets", "ontology_hierarchy.ttl");
const referencePath = path.join(sitePath, "ontology-reference.html");
const ontologyPath = path.join(repoRoot, "ontology", "vcf-core-vocabulary.bundle.ttl");

if (!fs.existsSync(hierarchyPath)) {
  throw new Error(`OCG did not generate the hierarchy asset: ${path.relative(repoRoot, hierarchyPath)}`);
}

if (!fs.existsSync(referencePath) || !fs.readFileSync(referencePath, "utf8").includes('id="ontology-hierarchy"')) {
  throw new Error("OCG did not insert the configured class hierarchy into ontology-reference.html.");
}

const hierarchy = fs.readFileSync(hierarchyPath, "utf8");
const sourcePrefixes = fs.readFileSync(ontologyPath, "utf8")
  .split(/\r?\n/)
  .filter((line) => /^\s*@prefix\s+[^\s:]+:\s*<[^>]+>\s*\.\s*$/.test(line));
const declaredPrefixes = new Set(
  [...hierarchy.matchAll(/^\s*@prefix\s+([^\s:]+):/gm)].map((match) => match[1])
);
const missingPrefixes = sourcePrefixes.filter((line) => {
  const match = line.match(/^\s*@prefix\s+([^\s:]+):/);
  return match && !declaredPrefixes.has(match[1]);
});

if (missingPrefixes.length) {
  fs.writeFileSync(hierarchyPath, `${missingPrefixes.join("\n")}\n${hierarchy}`);
}

console.log(
  `Class hierarchy inserted by OCG and verified in ${path.relative(repoRoot, referencePath)}.`
);
