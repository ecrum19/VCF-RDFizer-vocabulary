#!/usr/bin/env node
/** Build the OCG input from the modular VCF Core ontology sources. */

import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const sourceFiles = [
  "ontology/vcf-core-vocabulary.ttl",
  "ontology/vcf-core-alleles.ttl",
  "ontology/vcf-core-genotypes.ttl",
  "ontology/vcf-core-sv.ttl",
  "ontology/vcf-core-reserved-keys.ttl",
];
const outputFile = path.join(repoRoot, "ontology/vcf-core-vocabulary.bundle.ttl");

const prefixLines = new Map();
const bodies = [];
for (const relativeFile of sourceFiles) {
  const source = await fs.readFile(path.join(repoRoot, relativeFile), "utf8");
  const body = source
    .split(/\r?\n/)
    .filter((line) => {
      const match = line.match(/^@prefix\s+([^\s:]+):\s*<([^>]+)>\s*\.\s*$/);
      if (!match) return true;
      const [, prefix, iri] = match;
      const existing = prefixLines.get(prefix);
      if (existing && existing !== iri) {
        throw new Error(`Conflicting prefix ${prefix}: ${existing} vs ${iri}`);
      }
      prefixLines.set(prefix, iri);
      return false;
    })
    .join("\n")
    .trim();
  bodies.push(`# Source: ${relativeFile}\n${body}`);
}

const prefixes = [...prefixLines.entries()]
  .map(([prefix, iri]) => `@prefix ${prefix}: <${iri}> .`)
  .join("\n");
const bundle = `${prefixes}

#################################################################
# Generated companion-site bundle. Do not edit by hand.
# Source modules remain normative and are listed below.
#################################################################

${bodies.join("\n\n")}
`;

await fs.writeFile(outputFile, bundle, "utf8");
console.log(`Built ${path.relative(repoRoot, outputFile)} from ${sourceFiles.length} ontology modules.`);
