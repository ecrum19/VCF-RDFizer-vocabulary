# VCF-RDFizer-vocabulary

Vocabulary + SHACL shapes for representing **VCF files, headers, records, and per-sample calls** in RDF.

This repository is intentionally **VCF-centric** (file + header metadata + row/call provenance), and is designed to **link out** to established ontologies for representing the *sequence alteration itself*.

## Why this exists

- VCF is the de-facto interchange format for variant catalogs.
- Existing semantic models (e.g., SB/gvar) focus on *variants as Linked Data*, not a complete RDF rendering of VCF files.  
  We therefore model the **VCF artifact**, **header lines**, and **call-level fields** here, and enable alignment to SB/gvar (and optionally HERO).

## Namespace

Target persistent namespace:

- `https://w3id.org/vcf-rdfizer/vocab#`

(You can use it immediately; later you can register it via w3id.org and configure redirects.)

## Canonical IRI Pattern

Recommended base for VCF instance resources:

- `file://{vcfFilePath}`

Recommended templates (also formalized in ontology via `vcfr:iriTemplate`):

```text
VCFFile          file://{vcfFilePath}
VCFHeader        file://{vcfFilePath}#header
HeaderLine       file://{vcfFilePath}#header/line/{lineId}
VCFRecord        file://{vcfFilePath}#record/{recordId}
VariantCall      file://{vcfFilePath}#call/{recordId}
SampleCall       file://{vcfFilePath}#sample/{recordId}/{sampleId}
InfoFieldValue   file://{vcfFilePath}#call/{recordId}/info/{fieldKey}
FormatFieldValue file://{vcfFilePath}#sample/{recordId}/{sampleId}/fmt/{fieldKey}

# Condensed profile
SampleSet         file://{vcfFilePath}#samples
VCFSample         file://{vcfFilePath}#samples/{sampleId}
CohortCallMatrix  file://{vcfFilePath}#call/{recordId}/matrix
FormatValueVector file://{vcfFilePath}#call/{recordId}/matrix/fmt/{fieldKey}
```

## Key concepts

### VCF file and headers

- `vcfr:VCFFile` – a VCF file artifact (a dataset distribution)
- `vcfr:VCFHeader` – container for header lines
- Header line types (subclasses of `vcfr:HeaderLine`):
  - `vcfr:FileFormatHeaderLine` for `##fileformat`
  - `vcfr:FileDateHeaderLine` for `##fileDate`
  - `vcfr:SourceHeaderLine` for `##source`
  - `vcfr:ReferenceHeaderLine` for `##reference`
  - `vcfr:ContigHeaderLine` for `##contig`
  - `vcfr:INFOHeaderLine` for `##INFO=<...>`
  - `vcfr:FORMATHeaderLine` for `##FORMAT=<...>`
  - `vcfr:FILTERHeaderLine` for `##FILTER=<...>`
  - `vcfr:ALTHeaderLine` for `##ALT=<...>`

### VCF records and calls

- `vcfr:VCFRecord` – one row of a VCF (variant observation statement)
- `vcfr:VariantCall` – call-level representation (QUAL/FILTER/INFO/FORMAT + sample calls)
- `vcfr:SampleCall` – per-sample call values (GT/DP/AD/…)

### Representation profiles

The same VCF can be serialized with two different shapes for its per-sample
genotype block. A file declares which one it follows with
`vcfr:representationProfile`, and a consumer should read that first, because it
decides how per-sample values are addressed.

| | `vcfr:ExpandedRepresentation` | `vcfr:CondensedRepresentation` |
|---|---|---|
| Per-sample values | one `vcfr:SampleCall` per sample, one `vcfr:FormatFieldValue` per key | one `vcfr:CohortCallMatrix` per record, one `vcfr:FormatValueVector` per key |
| Samples declared | per record | once per file, as a `vcfr:SampleSet` of `vcfr:VCFSample` |
| A value is addressed | by IRI | by position, using the sample's `vcfr:sampleIndex` |
| Genotype resources | records x samples x keys | records x keys |

The condensed profile exists because the expanded one does not survive cohort
scale: its genotype cost grows with the number of samples, and a large cohort
is mostly genotype. The condensed terms are:

- `vcfr:SampleSet` / `vcfr:hasSampleSet` – the file's sample columns, declared once
- `vcfr:VCFSample` / `vcfr:hasSample` – one sample column, with `vcfr:sampleName` and a 1-based `vcfr:sampleIndex`
- `vcfr:CohortCallMatrix` / `vcfr:hasCallMatrix` – a record's whole genotype block, `vcfr:appliesToSampleSet` the file's sample set
- `vcfr:FormatValueVector` / `vcfr:hasFormatValueVector` – one FORMAT key's values across all samples
- `vcfr:valueEncoding` / `vcfr:VCFTextVector` / `vcfr:encodedValues` – how a vector's literal is split back into per-sample values

Under `vcfr:VCFTextVector`, `vcfr:encodedValues` holds one tab-separated field
per sample in ascending `vcfr:sampleIndex` order. See
`examples/example-condensed-record.ttl`, which is the same record as
`examples/example-minimal-record.ttl` in the other profile.

### Alignment

This vocabulary:
- can link a `vcfr:VCFRecord` / `vcfr:VariantCall` to SB/gvar’s `so:0001059` (SequenceAlteration) representation using `vcfr:asSequenceAlteration`.

### Missing values (`.`)

- Where VCF 4.5 permits the missing token - ID, ALT, QUAL, FILTER, INFO, and any
  INFO or FORMAT value - it is modeled as a typed literal: `"."^^vcfr:Null`.
  This avoids plain `"."^^xsd:string` and keeps missingness explicit in RDF.
- CHROM, POS and REF are **required** and have no missing form, so the policy
  does not apply to them: a `.` in one of those is malformed input, and the
  SHACL shapes state their datatype exactly so that it is reported.
- Inside a `vcfr:FormatValueVector`, a missing per-sample value stays the
  character `.` at that sample's position in `vcfr:encodedValues`. Lifting it
  out into a typed literal would break the positional alignment the whole
  profile depends on.

The boundary matters: stating the policy without it put the vocabulary in
contradiction with its own shapes, since a record with no alternative allele
could satisfy neither `vcfr:missingValuePolicy` nor a `vcfr:alt` constrained to
`xsd:string`.

SB/gvar reference:
- Docs: https://swat4hcls-2025-genomic-variation.github.io/genomic-variant-schema/
- Schema source: https://github.com/swat4hcls-2025-genomic-variation/genomic-variant-schema/blob/main/gvar-schema.yaml

## Validation

SHACL shapes are provided in `shacl/vcf-rdfizer-vocabulary.shacl.ttl`, covering
both representation profiles. The condensed shapes constrain what positional
decoding actually depends on: every `vcfr:VCFSample` carries exactly one
`vcfr:sampleIndex`, every matrix names the sample set it applies to, and every
vector states its encoding and its FORMAT declaration. A vector cannot be read
without those, so they are required rather than merely recommended.

```bash
pyshacl -s shacl/vcf-rdfizer-vocabulary.shacl.ttl \
        -e ontology/vcf-rdfizer-vocabulary.ttl \
        -df turtle examples/example-condensed-record.ttl
```

The profile terms (`vcfr:ExpandedRepresentation`, `vcfr:CondensedRepresentation`,
`vcfr:VCFTextVector`) are classes used as values, following the vocabulary's
existing `vcfr:VCFValueType` pattern. They therefore carry no `rdf:type` edge,
and the shapes constrain them with `sh:in` rather than `sh:class`.

## Documentation

The companion site is generated at publish time by [Ontology Companion Generator (OCG) v1.3.0](https://www.npmjs.com/package/ontology-companion-generator) from `ocg.config.json`. The generated Pages output is intentionally not tracked in this repository; the GitHub Pages workflow publishes the temporary `site/` directory created by OCG.

OCG parses the source Turtle, generates the reference and term pages, and supplies the Sigma.js/Graphology relationship graph with predicate-node and predicate-edge modes, filtering, search, selection, hover details, draggable nodes, and fit-to-view controls. The configured hierarchy overview uses the current VCF concept roots and the ontology's `rdfs:subClassOf`, `rdfs:domain`, and `rdfs:range` relationships. `scripts/insert-class-hierarchy.mjs` is the only repository-specific Pages extension: it verifies that OCG inserted the hierarchy and makes the generated hierarchy Turtle asset self-contained by restoring source prefix declarations.

Run `npm run ocg:check` to validate the configuration and source ontology, or `npm run ocg:build` to build the local companion site in `site/`.

The formatted example graph (`examples/example.ttl`) is generated from `examples/example.nt` by `scripts/convert-example-nt-to-ttl.mjs`; run `npm run examples:ttl` when the N-Triples source changes.

## Quick example

See:
- `examples/example-headers.ttl`
- `examples/example-minimal-record.ttl`
- `examples/example-condensed-record.ttl`
- `examples/example.ttl` (formatted from `example.nt`)
- `examples/example.nt`
- `examples/example.vcf`

## Publishing

- `.github/workflows/publish-pages.yml` is the OCG v1.3.0 publishing workflow. It builds `site/` and deploys it to GitHub Pages; no generated HTML, graph data, diagrams, or Pages assets are committed.
- `docs/` and `site/` are ignored build directories. The vocabulary sources, SHACL shapes, mappings, examples, OCG configuration, and the one hierarchy post-build hook remain in the repository.
- Register w3id redirect:
  - Desired path: `/vcf-rdfizer/`
  - Redirect to your hosted ontology + docs.

## Versioning

Release notes are in [`CHANGELOG.md`](CHANGELOG.md). The current version is
declared by `owl:versionIRI` in the ontology and mirrored in `package.json` and
`CITATION.cff`.

## License

- CC BY 4.0 (see LICENSE)
