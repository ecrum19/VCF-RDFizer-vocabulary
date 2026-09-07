# VCF Core Vocabulary

Vocabulary + SHACL shapes for representing the **logical VCF 4.5 model** — files, headers, records, alleles, indexed values, genotypes, and VCF-specific SV syntax — in RDF.

> **Renamed in 2.0.0.** This vocabulary was previously published as the *VCF-RDFizer Vocabulary* in the
> `https://w3id.org/vcf-rdfizer/vocab#` namespace. It is a semantic target that any conversion system can
> adopt, so its name and namespace no longer carry the name of one converter. See
> [v2.0.0 release notes and migration guide](RELEASE-NOTES-v2.0.0.md#migrating-from-v110). The VCF-RDFizer converter is a separate project with
> its own version line; the two version numbers are unrelated.

This repository is intentionally **VCF-centric** (file + header metadata + row/call provenance), and is designed to **link out** to established ontologies for representing the *sequence alteration itself*. BCF 2.2's byte layout is deliberately out of scope: the RDF target is VCF's logical model.

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
its successor.


## Canonical IRI Pattern

Recommended base for VCF instance resources:

- `file://{vcfFilePath}`

The examples use the portable filename form, for example
`file://example-file1.vcf#header` and
`file://example-file1.vcf#record/var6/sample/SAMPLE2/fmt/DP`. These are local
resource identifiers for demonstrating the pattern; they are not expected to
resolve as web pages. When minting IRIs for a real absolute local path, use the
corresponding absolute `file:///...` form, and use a stable project-specific
HTTP(S) base when the RDF must be shared or dereferenced across systems.

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
- `vcfc:StructuredHeaderLine` / `vcfc:UnstructuredHeaderLine` distinguish the two VCF metadata forms; `vcfc:HeaderAttribute` exposes every structured attribute without discarding `vcfc:headerValue`.
- `vcfc:ColumnHeaderLine` represents `#CHROM`; `vcfc:hasGenotypeColumns` retains ordered sample columns.
- `vcfc:AssemblyHeaderLine`, `vcfc:MetaHeaderLine`, `vcfc:SampleHeaderLine`, `vcfc:PedigreeHeaderLine`, and `vcfc:PedigreeDBHeaderLine` cover the remaining VCF 4.5 line forms.

### Content, arity, and syntax carriers

- `vcfc:fieldArity` links symbolic `Number` values to `VCFNumberArity` individuals; `fieldNumberInteger` exposes fixed counts while `fieldNumber` remains lossless.
- `vcfc:ReferenceAllele` and `vcfc:AltAllele` carry `alleleIndex` (0 for REF; 1…n in ALT order), kind, value, declaration, and FALDO location hooks.
- `vcfc:FieldValueItem` indexes parsed comma-list entries and links them to the applicable allele, genotype, GT allele, or base modification.
- `vcfc:Genotype`, `vcfc:GenotypeAlleleCall`, `vcfc:PhaseSet`, and `vcfc:LocalAlleleSet` expose GT, phase, PS/PSL/PSO/PSQ, LAA, and FT without replacing the raw FORMAT values.
- The SV module supplies VCF syntax carriers for symbolic ALT types, SVCLAIM, breakends, EVENT/EVENTTYPE, confidence intervals, tandem repeats, copy number, gVCF reference blocks, and base modifications. FALDO, VRS, SO, GENO, and ChEBI provide the aligned external semantics.

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
- can link a `vcfc:VCFRecord` / `vcfc:VariantCall` to SB/gvar’s `so:0001059` (SequenceAlteration) representation using `vcfc:asSequenceAlteration`.

### Missing values (`.`)

<<<<<<< HEAD
- Missing VCF token `.` is modeled as a typed literal: `"."^^vcfc:Null`.
- This avoids using plain `"."^^xsd:string` and keeps missingness explicit in RDF.
=======
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
>>>>>>> origin/main

SB/gvar reference:
- Docs: https://swat4hcls-2025-genomic-variation.github.io/genomic-variant-schema/
- Schema source: https://github.com/swat4hcls-2025-genomic-variation/genomic-variant-schema/blob/main/gvar-schema.yaml

## Validation

<<<<<<< HEAD
The validator combines shared structural/consistency shapes with VCF **4.1–4.5**
version overlays. See [SHACL profiles](shacl/README.md) for file selection,
integer datatype policy, warnings and the boundary between SHACL and decoded
Python checks. Historical reserved-key snapshots are under `ontology/versions/`.

```sh
python3 -m venv .venv
.venv/bin/python -m pip install -r requirements-dev.txt
npm run validate
# Validate another graph, allowing recommendation warnings:
.venv/bin/python tests/validate_shacl.py input.ttl
```

`npm run ocg:check` runs RDF parsing, all complete example graphs through SHACL
and decoded semantic validation, independent regression probes, paired VCF/RDF
reconstruction and nine example queries. It runs on PR CI as well as before
publishing. This is a maintained conformance corpus, not exhaustive VCF
certification; [the checklist](tests/coverage.md) records remaining boundaries.
=======
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
>>>>>>> origin/main

## Documentation

The companion site is generated at publish time by [Ontology Companion Generator (OCG) v1.3.0](https://www.npmjs.com/package/ontology-companion-generator) from `ocg.config.json`. The generated Pages output is intentionally not tracked in this repository; the GitHub Pages workflow publishes the temporary `site/` directory created by OCG.

OCG parses `ontology/vcf-core-vocabulary.bundle.ttl`, generated from the five normative modules, so the site contains one complete reference and graph. `scripts/insert-class-hierarchy.mjs` verifies that OCG inserted the hierarchy and makes the generated hierarchy Turtle asset self-contained by restoring source prefix declarations.

Run `npm run ocg:check` to validate the configuration and source ontology, or `npm run ocg:build` to build the local companion site in `site/`.

Regenerate the VCF 4.5 reserved-key registry from an authoritative source checkout with:

```sh
node scripts/generate-reserved-keys.mjs --source /path/to/VCFv4.5.tex
npm run ontology:bundle
```

The formatted example graph (`examples/core/example.ttl`) is generated from `examples/core/example.nt` by `scripts/convert-example-nt-to-ttl.mjs`; run `npm run examples:ttl` when the N-Triples source changes.

## Quick example

<<<<<<< HEAD
Start with [example-quickstart.ttl](examples/core/example-quickstart.ttl). The
[example guide](examples/README.md) then covers both sample representations,
structured metadata, alleles, mixed phasing, local alleles, base modifications,
breakends, repeats, reference blocks and earlier VCF versions. Every advertised
Turtle example is now complete; the header-only example represents a zero-record
file and may also be merged with the single-record example.
=======
See:
- `examples/example-headers.ttl`
- `examples/example-minimal-record.ttl`
- `examples/example-condensed-record.ttl`
- `examples/example.ttl` (formatted from `example.nt`)
- `examples/example.nt`
- `examples/example.vcf`
>>>>>>> origin/main

For real sample calls, use the [eight-sample 1000 Genomes cohort](examples/profiles/example-condensed-cohort.vcf)
or the [three-record HaplotypeCaller subset](examples/core/example.vcf).
Their source calls are retained with documented reductions in
[the provenance record](examples/provenance.json).

[manifest.json](examples/manifest.json) links source VCFs, saved RDF and executable
queries with expected answers. Run `npm run examples:build` to regenerate the rich
fixtures and `npm run validate:examples` to check their source agreement.


## Versioning

Release notes are in [`CHANGELOG.md`](CHANGELOG.md). The current version is
declared by `owl:versionIRI` in the ontology and mirrored in `package.json` and
`CITATION.cff`.

## License

- CC BY 4.0 (see LICENSE)
