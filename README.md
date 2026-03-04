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

### Alignment

This vocabulary:
- can link a `vcfr:VCFRecord` / `vcfr:VariantCall` to SB/gvar’s `so:0001059` (SequenceAlteration) representation using `vcfr:asSequenceAlteration`.

SB/gvar reference:
- Docs: https://swat4hcls-2025-genomic-variation.github.io/genomic-variant-schema/
- Schema source: https://github.com/swat4hcls-2025-genomic-variation/genomic-variant-schema/blob/main/gvar-schema.yaml

## Validation

SHACL shapes are provided in `shacl/vcf-rdfizer-vocabulary.shacl.ttl`.

## Documentation

- Landing page (GitHub Pages): [docs/index.html](docs/index.html)
- Vocabulary reference (classes, properties, external alignments): [docs/ontology-reference.html](docs/ontology-reference.html)
- Interactive relationship diagram: [docs/ontology-graph.html](docs/ontology-graph.html)
- Serialized graph data: [docs/assets/ontology-graph-data.json](docs/assets/ontology-graph-data.json)
- Serialized relationship overview: [docs/assets/ontology-relationships-overview.json](docs/assets/ontology-relationships-overview.json)
- Static graph export (SVG): [docs/assets/ontology-graph-static.svg](docs/assets/ontology-graph-static.svg)

Graph and export files are generated from `ontology/vcf-rdfizer-vocabulary.ttl` by `scripts/build-ontology-graph-data.mjs` and `scripts/export-ontology-graph-svg.mjs` (both invoked by `scripts/sync-docs-assets.sh`).

## Quick example

See:
- `examples/example-headers.ttl`
- `examples/example-minimal-record.ttl`

## Publishing

- Host this repo with GitHub/GitLab pages for HTML docs (optional).
- Register w3id redirect:
  - Desired path: `/vcf-rdfizer/`
  - Redirect to your hosted ontology + docs.

## License

- CC BY 4.0 (see LICENSE)
