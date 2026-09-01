# VCF-RDFizer-vocabulary

Vocabulary + SHACL shapes for representing **VCF files, headers, records, and genotype data** in RDF.

This repository is intentionally **VCF-centric** (file + header metadata + row/call provenance), and is designed to **link out** to established ontologies for representing the *sequence alteration itself*.

## Why this exists

- VCF is the de-facto interchange format for variant catalogs.
- Existing semantic models (e.g., SB/gvar) focus on *variants as Linked Data*, not a complete RDF rendering of VCF files.  
  We therefore model the **VCF artifact**, **header lines**, and **call-level fields** here, and enable alignment to SB/gvar (and optionally HERO).

## Version 1.1.0: dense and condensed genotype representations

Version 1.1.0 adds an additive, cohort-oriented representation for large multi-sample VCF files. It does not change or deprecate the existing per-sample terms. A producer declares one of two profiles on the `vcfr:VCFFile`:

- `vcfr:DenseRepresentation` for individual `vcfr:SampleCall` and `vcfr:FormatFieldValue` resources.
- `vcfr:CondensedRepresentation` for sample-ordered `vcfr:CohortCallMatrix` and `vcfr:FormatValueVector` resources.

The dense profile is suitable for single-sample and low-sample inputs. The condensed profile prevents the RDF graph from growing with every variant × sample × FORMAT-field combination while retaining the genotype contents in an explicitly described vector encoding.

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
- `vcfr:VCFSample` – one reusable, file-scoped VCF sample-column identity
- `vcfr:SampleSet` – the ordered sample columns of a VCF file
- `vcfr:CohortCallMatrix` – condensed genotype data for one `vcfr:VariantCall`
- `vcfr:FormatValueVector` – values of one FORMAT key across the matrix sample order

### Dense profile

Use `vcfr:DenseRepresentation` when direct RDF statements about individual samples and FORMAT values are required. Each `vcfr:VariantCall` has a `vcfr:hasSampleCall` relation for every represented sample; each `vcfr:SampleCall` has a `vcfr:hasFormatValue` relation for its FORMAT entries. `vcfr:SampleCall` and `vcfr:FormatFieldValue` are deliberately **one-sample** resources and must not be used for values spanning multiple samples.

The dense profile is the pre-1.1.0 representation and remains appropriate for one sample or a small number of samples. Producers may additionally link a `SampleCall` to a reusable `vcfr:VCFSample` using `vcfr:forSample`.

### Condensed profile

Use `vcfr:CondensedRepresentation` for large multi-sample VCF files. Model the `#CHROM` sample columns once as a `vcfr:SampleSet`; every member is a `vcfr:VCFSample` with an exact `vcfr:sampleName` and one-based `vcfr:sampleIndex`.

For each record with genotype data, link the `vcfr:VariantCall` to one `vcfr:CohortCallMatrix` with `vcfr:hasCallMatrix`. The matrix identifies its `vcfr:appliesToSampleSet` and has one `vcfr:hasFormatValueVector` per represented FORMAT key. Each vector:

- links with `vcfr:declaredBy` to the appropriate `vcfr:FormatFieldDefinition`;
- declares a `vcfr:valueEncoding`; and
- stores its lexical payload in `vcfr:encodedValues`.

The initial standard encoding is `vcfr:VCFTextVector`: tab-separated raw VCF values in `vcfr:sampleIndex` order. It has exactly one position per sample. `.` remains the VCF missing-value token, and commas remain inside a single FORMAT value (for example `AD` or `PL`); commas are never vector separators. A consumer obtains the value for sample *i* by selecting position *i* in every needed FORMAT vector. The record's `vcfr:formatRaw` retains the source FORMAT-key order.

`vcfr:encodedValues` is a compact payload, not thousands of individual RDF assertions. Consumers must decode it using the vector encoding, the linked FORMAT definition, and the matrix SampleSet. If source-level textual fidelity is required, a matrix may additionally use `vcfr:sampleDataRaw` for the original tab-separated sample blocks. It is optional because the FORMAT vectors already preserve the semantic genotype values.

Use one profile consistently for a graph. A converter should not emit both dense calls and condensed vectors for the same call unless it intentionally documents the redundant materialization. The condensed profile is semantically complete for the represented VCF values, but a SPARQL engine cannot filter inside vector payloads without a decoder or an application-level vector function.

### Alignment

This vocabulary:
- can link a `vcfr:VCFRecord` / `vcfr:VariantCall` to SB/gvar’s `so:0001059` (SequenceAlteration) representation using `vcfr:asSequenceAlteration`.

### Missing values (`.`)

- Missing VCF token `.` is modeled as a typed literal: `"."^^vcfr:Null`.
- This avoids using plain `"."^^xsd:string` and keeps missingness explicit in RDF.

SB/gvar reference:
- Docs: https://swat4hcls-2025-genomic-variation.github.io/genomic-variant-schema/
- Schema source: https://github.com/swat4hcls-2025-genomic-variation/genomic-variant-schema/blob/main/gvar-schema.yaml

## Validation

SHACL shapes are provided in `shacl/vcf-rdfizer-vocabulary.shacl.ttl`. Version 1.1.0 validates the required identifiers and links of `VCFSample`, `SampleSet`, `CohortCallMatrix`, and `FormatValueVector`; lexical payload cardinality and vector position parsing remain encoding-specific application responsibilities.

## Documentation

The companion site is generated at publish time by [Ontology Companion Generator (OCG) v1.3.0](https://www.npmjs.com/package/ontology-companion-generator) from `ocg.config.json`. The generated Pages output is intentionally not tracked in this repository; the GitHub Pages workflow publishes the temporary `site/` directory created by OCG.

OCG parses the source Turtle, generates the reference and term pages, and supplies the Sigma.js/Graphology relationship graph with predicate-node and predicate-edge modes, filtering, search, selection, hover details, draggable nodes, and fit-to-view controls. The configured hierarchy overview uses the current VCF concept roots and the ontology's `rdfs:subClassOf`, `rdfs:domain`, and `rdfs:range` relationships. `scripts/insert-class-hierarchy.mjs` is the only repository-specific Pages extension: it verifies that OCG inserted the hierarchy and makes the generated hierarchy Turtle asset self-contained by restoring source prefix declarations.

Run `npm run ocg:check` to validate the configuration and source ontology, or `npm run ocg:build` to build the local companion site in `site/`.

The formatted example graph (`examples/example.ttl`) is generated from `examples/example.nt` by `scripts/convert-example-nt-to-ttl.mjs`; run `npm run examples:ttl` when the N-Triples source changes.

## Quick example

See:
- `examples/example-headers.ttl`
- `examples/example-minimal-record.ttl`
- `examples/example-condensed-cohort.ttl` (version 1.1.0 condensed cohort profile)
- `examples/example.ttl` (formatted from `example.nt`)
- `examples/example.nt`
- `examples/example.vcf`

## Publishing

- `.github/workflows/publish-pages.yml` is the OCG v1.3.0 publishing workflow. It builds `site/` and deploys it to GitHub Pages; no generated HTML, graph data, diagrams, or Pages assets are committed.
- `docs/` and `site/` are ignored build directories. The vocabulary sources, SHACL shapes, mappings, examples, OCG configuration, and the one hierarchy post-build hook remain in the repository.
- Register w3id redirect:
  - Desired path: `/vcf-rdfizer/`
  - Redirect to your hosted ontology + docs.

## License

- CC BY 4.0 (see LICENSE)
