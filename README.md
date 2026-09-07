# VCF Core Vocabulary

Vocabulary + SHACL shapes for representing **VCF files, headers, records, and genotype data** in RDF.

> **Renamed in 2.0.0.** This vocabulary was previously published as the *VCF-RDFizer Vocabulary* in the
> `https://w3id.org/vcf-rdfizer/vocab#` namespace. It is a semantic target that any conversion system can
> adopt, so its name and namespace no longer carry the name of one converter. See
> [Migrating from 1.1.0](#migrating-from-110) below. The VCF-RDFizer converter is a separate project with
> its own version line; the two version numbers are unrelated.

This repository is intentionally **VCF-centric** (file + header metadata + row/call provenance), and is designed to **link out** to established ontologies for representing the *sequence alteration itself*.

## Why this exists

- VCF is the de-facto interchange format for variant catalogs.
- Existing semantic models (e.g., SB/gvar) focus on *variants as Linked Data*, not a complete RDF rendering of VCF files.  
  We therefore model the **VCF artifact**, **header lines**, and **call-level fields** here, and enable alignment to SB/gvar (and optionally HERO).

## Expanded and condensed genotype representations

A cohort-oriented representation for large multi-sample VCF files sits alongside the per-sample terms; neither profile replaces the other. A producer declares one of two profiles on the `vcfc:VCFFile`:

- `vcfc:ExpandedRepresentation` for individual `vcfc:SampleCall` and `vcfc:FormatFieldValue` resources.
- `vcfc:CondensedRepresentation` for sample-ordered `vcfc:CohortCallMatrix` and `vcfc:FormatValueVector` resources.

The expanded profile is suitable for single-sample and low-sample inputs. The condensed profile prevents the RDF graph from growing with every variant × sample × FORMAT-field combination while retaining the genotype contents in an explicitly described vector encoding.

## Namespace

Persistent namespace, prefix `vcfc:`:

- `https://w3id.org/vcf-core/vocab#`

The retired namespace `https://w3id.org/vcf-rdfizer/vocab#` is **not** redirected here. It serves
`legacy/legacy-vcf-rdfizer.ttl`, a document in which every 1.1.0 term is present, deprecated, and linked to
its successor. Redirecting instead would resolve each legacy IRI to a document that does not define it,
which is less useful than a 404. Both `.htaccess` files for the [w3id.org](https://github.com/perma-id/w3id.org)
pull request are in `w3id/`.

## Migrating from 2.0.0

Version 3.0.0 is a **corrective release with no new terms**. It changes only what could not be
corrected without a major version bump, plus two SHACL bug fixes. See
[`VCF45-COVERAGE-ASSESSMENT.md`](VCF45-COVERAGE-ASSESSMENT.md) for the planned additive work.

Three changes need action from consumers:

1. **The five VCF Type terms are now named individuals, not classes.** `vcfc:fieldType` has
   `rdfs:range vcfc:VCFValueType`, so `vcfc:IntegerType`, `vcfc:FloatType`, `vcfc:FlagType`,
   `vcfc:CharacterType` and `vcfc:StringType` were being used as instances while declared as
   `owl:Class rdfs:subClassOf vcfc:VCFValueType` — class/individual punning, outside OWL 2 DL, and
   inconsistent with how `vcfc:RepresentationProfile` and `vcfc:VectorEncoding` values are declared.
   They are now `owl:NamedIndividual, vcfc:VCFValueType`.

   *Instance data does not change.* A triple such as `?def vcfc:fieldType vcfc:IntegerType` was
   already correct and stays correct — it is now also well-typed. Only consumers that queried these
   IRIs *as classes* (`?t rdfs:subClassOf vcfc:VCFValueType`, or `?x a vcfc:IntegerType`) must
   change to `?t a vcfc:VCFValueType`. `legacy/legacy-vcf-rdfizer.ttl` was updated to bridge them
   with `owl:sameAs` instead of `owl:equivalentClass`.

2. **The recommended IRI templates use `{recordKey}`, not `{recordId}`.** The placeholder named a
   row key while `vcfc:recordId` is the datatype property carrying the ID column — two different
   things under one name. Only the recommended template text changed; no minted IRI needs rewriting,
   and generators that already substitute their own row key are unaffected.

3. **`rdfs:domain rdf:Resource` was dropped** from `vcfc:fieldValue`, `vcfc:fieldValueInteger`,
   `vcfc:fieldValueDecimal` and `vcfc:fieldValueBoolean` (`rdf:Resource` is not an OWL 2 class, so
   its presence made the ontology non-DL). These properties are now domain-free, which is a
   loosening: no existing graph becomes invalid.

Also fixed, non-breaking, in `shacl/vcf-core-vocabulary.shacl.ttl`:

- `vcfc:VCFRecordShape` required `vcfc:alt` to be `xsd:string`, so **every record with `ALT=.`**
  — every REF-only and gVCF-style record — **failed validation**. It now accepts `xsd:string` or
  `vcfc:Null`.
- `vcfc:VariantCallShape` allowed QUAL only as `xsd:decimal` or `vcfc:Null`, rejecting the
  `INF`/`INFINITY`/`NAN` spellings that the VCF Float lexical space permits. It now accepts the full
  VCF Float space.

## Migrating from 1.1.0

Version 2.0.0 renames the vocabulary and moves it to a new namespace. The model is otherwise unchanged
except for one term:

| 1.1.0 | 2.0.0 |
| --- | --- |
| `https://w3id.org/vcf-rdfizer/vocab#` | `https://w3id.org/vcf-core/vocab#` |
| prefix `vcfr:` | prefix `vcfc:` |
| `vcfr:DenseRepresentation` | `vcfc:ExpandedRepresentation` |
| every other `vcfr:X` | `vcfc:X`, same local name |

The version number is a major bump because the namespace change is breaking, not because the model changed.

To migrate a repository or a converter, run the two passes of `scripts/migrate-namespace.mjs` and review the
diff:

```sh
node scripts/migrate-namespace.mjs rewrite .
node scripts/migrate-namespace.mjs bridge <1.1.0-ontology.ttl> -o legacy/legacy-vcf-rdfizer.ttl
```

The `rewrite` pass performs the IRI and prefix substitution and reports any free-text occurrence of "dense"
that a string replace cannot judge. The `bridge` pass regenerates the legacy document; it needs `n3`.

Existing graphs do not have to be rewritten. Every 1.1.0 IRI keeps its meaning under a reasoner through the
`owl:equivalentClass` / `owl:equivalentProperty` / `owl:sameAs` axioms in `legacy/legacy-vcf-rdfizer.ttl`.

## Canonical IRI Pattern

Recommended base for VCF instance resources:

- `file://{vcfFilePath}`

Recommended templates (also formalized in ontology via `vcfc:iriTemplate`):

```text
VCFFile          file://{vcfFilePath}
VCFHeader        file://{vcfFilePath}#header
HeaderLine       file://{vcfFilePath}#header/line/{lineId}
VCFRecord        file://{vcfFilePath}#record/{recordKey}
VariantCall      file://{vcfFilePath}#call/{recordKey}
SampleCall       file://{vcfFilePath}#sample/{recordKey}/{sampleId}
InfoFieldValue   file://{vcfFilePath}#call/{recordKey}/info/{fieldKey}
FormatFieldValue file://{vcfFilePath}#sample/{recordKey}/{sampleId}/fmt/{fieldKey}
SampleSet         file://{vcfFilePath}#samples
VCFSample         file://{vcfFilePath}#samples/{sampleId}
CohortCallMatrix  file://{vcfFilePath}#call/{recordKey}/matrix
FormatValueVector file://{vcfFilePath}#call/{recordKey}/matrix/fmt/{fieldKey}
```

## Key concepts

### VCF file and headers

- `vcfc:VCFFile` – a VCF file artifact (a dataset distribution)
- `vcfc:VCFHeader` – container for header lines
- Header line types (subclasses of `vcfc:HeaderLine`):
  - `vcfc:FileFormatHeaderLine` for `##fileformat`
  - `vcfc:FileDateHeaderLine` for `##fileDate`
  - `vcfc:SourceHeaderLine` for `##source`
  - `vcfc:ReferenceHeaderLine` for `##reference`
  - `vcfc:ContigHeaderLine` for `##contig`
  - `vcfc:INFOHeaderLine` for `##INFO=<...>`
  - `vcfc:FORMATHeaderLine` for `##FORMAT=<...>`
  - `vcfc:FILTERHeaderLine` for `##FILTER=<...>`
  - `vcfc:ALTHeaderLine` for `##ALT=<...>`

### VCF records and calls

- `vcfc:VCFRecord` – one row of a VCF (variant observation statement)
- `vcfc:VariantCall` – call-level representation (QUAL/FILTER/INFO/FORMAT + sample calls)
- `vcfc:SampleCall` – per-sample call values (GT/DP/AD/…)
- `vcfc:VCFSample` – one reusable, file-scoped VCF sample-column identity
- `vcfc:SampleSet` – the ordered sample columns of a VCF file
- `vcfc:CohortCallMatrix` – condensed genotype data for one `vcfc:VariantCall`
- `vcfc:FormatValueVector` – values of one FORMAT key across the matrix sample order

### Expanded profile

Use `vcfc:ExpandedRepresentation` when direct RDF statements about individual samples and FORMAT values are required. Each `vcfc:VariantCall` has a `vcfc:hasSampleCall` relation for every represented sample; each `vcfc:SampleCall` has a `vcfc:hasFormatValue` relation for its FORMAT entries. `vcfc:SampleCall` and `vcfc:FormatFieldValue` are deliberately **one-sample** resources and must not be used for values spanning multiple samples.

The expanded profile is the original representation and remains appropriate for one sample or a small number of samples. Producers may additionally link a `SampleCall` to a reusable `vcfc:VCFSample` using `vcfc:forSample`.

### Condensed profile

Use `vcfc:CondensedRepresentation` for large multi-sample VCF files. Model the `#CHROM` sample columns once as a `vcfc:SampleSet`; every member is a `vcfc:VCFSample` with an exact `vcfc:sampleName` and one-based `vcfc:sampleIndex`.

For each record with genotype data, link the `vcfc:VariantCall` to one `vcfc:CohortCallMatrix` with `vcfc:hasCallMatrix`. The matrix identifies its `vcfc:appliesToSampleSet` and has one `vcfc:hasFormatValueVector` per represented FORMAT key. Each vector:

- links with `vcfc:declaredBy` to the appropriate `vcfc:FormatFieldDefinition`;
- declares a `vcfc:valueEncoding`; and
- stores its lexical payload in `vcfc:encodedValues`.

The initial standard encoding is `vcfc:VCFTextVector`: tab-separated raw VCF values in `vcfc:sampleIndex` order. It has exactly one position per sample. `.` remains the VCF missing-value token, and commas remain inside a single FORMAT value (for example `AD` or `PL`); commas are never vector separators. A consumer obtains the value for sample *i* by selecting position *i* in every needed FORMAT vector. The record's `vcfc:formatRaw` retains the source FORMAT-key order.

`vcfc:encodedValues` is a compact payload, not thousands of individual RDF assertions. Consumers must decode it using the vector encoding, the linked FORMAT definition, and the matrix SampleSet. If source-level textual fidelity is required, a matrix may additionally use `vcfc:sampleDataRaw` for the original tab-separated sample blocks. It is optional because the FORMAT vectors already preserve the semantic genotype values.

Use one profile consistently for a graph. A converter should not emit both expanded calls and condensed vectors for the same call unless it intentionally documents the redundant materialization. The condensed profile is semantically complete for the represented VCF values, but a SPARQL engine cannot filter inside vector payloads without a decoder or an application-level vector function.

### Alignment

This vocabulary:
- can link a `vcfc:VCFRecord` / `vcfc:VariantCall` to SB/gvar’s `so:0001059` (SequenceAlteration) representation using `vcfc:asSequenceAlteration`.

### Missing values (`.`)

- Missing VCF token `.` is modeled as a typed literal: `"."^^vcfc:Null`.
- This avoids using plain `"."^^xsd:string` and keeps missingness explicit in RDF.

SB/gvar reference:
- Docs: https://swat4hcls-2025-genomic-variation.github.io/genomic-variant-schema/
- Schema source: https://github.com/swat4hcls-2025-genomic-variation/genomic-variant-schema/blob/main/gvar-schema.yaml

## Validation

SHACL shapes are provided in `shacl/vcf-core-vocabulary.shacl.ttl`. They validate the required identifiers and links of `VCFSample`, `SampleSet`, `CohortCallMatrix`, and `FormatValueVector`; lexical payload cardinality and vector position parsing remain encoding-specific application responsibilities.

## Documentation

The companion site is generated at publish time by [Ontology Companion Generator (OCG) v1.3.0](https://www.npmjs.com/package/ontology-companion-generator) from `ocg.config.json`. The generated Pages output is intentionally not tracked in this repository; the GitHub Pages workflow publishes the temporary `site/` directory created by OCG.

OCG parses the source Turtle, generates the reference and term pages, and supplies the Sigma.js/Graphology relationship graph with predicate-node and predicate-edge modes, filtering, search, selection, hover details, draggable nodes, and fit-to-view controls. The configured hierarchy overview uses the current VCF concept roots and the ontology's `rdfs:subClassOf`, `rdfs:domain`, and `rdfs:range` relationships. `scripts/insert-class-hierarchy.mjs` is the only repository-specific Pages extension: it verifies that OCG inserted the hierarchy and makes the generated hierarchy Turtle asset self-contained by restoring source prefix declarations.

Run `npm run ocg:check` to validate the configuration and source ontology, or `npm run ocg:build` to build the local companion site in `site/`.

The formatted example graph (`examples/example.ttl`) is generated from `examples/example.nt` by `scripts/convert-example-nt-to-ttl.mjs`; run `npm run examples:ttl` when the N-Triples source changes.

## Quick example

See:
- `examples/example-headers.ttl`
- `examples/example-minimal-record.ttl`
- `examples/example-condensed-cohort.ttl` (condensed cohort profile; a partial illustration, not a standalone conforming graph)
- `examples/example.ttl` (formatted from `example.nt`)
- `examples/example.nt`
- `examples/example.vcf`

## Publishing

- `.github/workflows/publish-pages.yml` is the OCG v1.3.0 publishing workflow. It builds `site/` and deploys it to GitHub Pages; no generated HTML, graph data, diagrams, or Pages assets are committed.
- `docs/` and `site/` are ignored build directories. The vocabulary sources, SHACL shapes, mappings, examples, OCG configuration, and the one hierarchy post-build hook remain in the repository.
- Register the w3id paths from `w3id/` in one [perma-id/w3id.org](https://github.com/perma-id/w3id.org) pull request:
  - `/vcf-core/` serves this vocabulary and its documentation, with content negotiation.
  - `/vcf-rdfizer/` keeps serving the legacy deprecation document; it is never redirected to `/vcf-core/`.
  - Both files contain a `REPLACE-ME` host that must be set to the real publishing location before the PR.

## License

- CC BY 4.0 (see LICENSE)
