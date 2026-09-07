# Executable coverage checklist

This is a maintained inventory of implemented coverage, not a percentage of all
VCF constructs. Specification references are to
[VCF 4.5](https://samtools.github.io/hts-specs/VCFv4.5.pdf), unless versioned below.

| Specification area | Vocabulary / enforcement | Positive evidence / negative probe |
| --- | --- | --- |
| §§1.4–1.5 fileformat and column line | File/header shapes; `HeaderVersionAgreementShape` | All complete graphs; missing fileformat/columns and conflicting versions |
| §1.4 structured attributes | `HeaderAttribute`; `HeaderDeclarationAgreementShape` | Feature metadata, legacy declarations; conflicting Number attribute |
| §§1.3, 1.6 numeric/GT lexical forms | Integer-derived types, Float/GT patterns, Null token; decoded range checks | Ordinary/derived integers, Infinity; negative POS, invalid GT/Float, forbidden integers, bad missing token |
| §§1.4.2, 1.4.4 Number and reserved keys | Five version overlays, fixed arity agreement | 4.1–4.5 paired fixtures; Q, wrong AF declaration, unsupported M/R |
| §1.6.1 ordered REF/ALT and IDs | Allele raw/count rules; `RecordIdentifier` | All rich fixtures; conflicting REF/ALT, duplicate IDs checked by decoded validator |
| §1.6.1 FILTER and §1.6.2 FT | `FilterCode`, `filterStatus`, raw-code agreement | q10 in feature example; decoded code syntax/uniqueness |
| §1.6.2 GT, phasing, PSL | `phaseIndicator`, `allelePhaseSet`; ploidy/allele agreement | Mixed triploid example; wrong ploidy/indicator; missing PS with populated PSL |
| §1.6.2 local alleles | `LocalAlleleMembership`, LAA order; local cardinality | LAA/LAD/LPL example and query; version gate and membership checks |
| §1.6.2 Number=A/R/G/LA/LR/LG/P | SHACL raw cardinality and materialized item agreement; arbitrary-ploidy Python formulas | Biallelic PL, triploid LPL; extra AF item, wrong raw count, ploidy-9 PL count |
| §§1.4.4, 1.6.2 Number=M | Linked item/modification/GT-site resources; decoded site counts | 5mC on explicit C/T genotype; extra modification value |
| §3 confidence/mobile-element aggregates | Version-scoped tuple rules; numeric interval ordering | CILEN bounds, 4.3/4.4 CIPOS; zero parsed items, reversed interval, old data under modern rule |
| §5.4 breakends | Four bracket carriers, mate links, FALDO remote position; single-breakend alternative | Reciprocal pair and single breakend; mate query |
| §5.5 reference blocks | Independent sample block → ALT; LEN/POS/end agreement, decoded overlap checks | Two different LEN values in one record; reference-block query |
| §§5.6–5.7 repeats/copy number | Repeat count/unit resources, versioned CN; decoded sum(RN) checks | Repeat fixture and query; historical CN declarations |
| Expanded/condensed representation contract | Sample ordering, vectors, decoded FORMAT and profile checks | Real expanded calls, an eight-sample condensed cohort and compact paper profiles; shortened-vector regression |
| Examples and conversion evidence | Independent RDF-to-VCF line reconstruction, declared-term/property-kind checks | `examples/manifest.json`; nine queries with fixed expected answers |

`test_validation.py` tests individual constraints in isolation, including shared
shape dependencies, so another unrelated violation cannot mask a broken rule.
`validate_shacl.py` runs all shapes together against every complete example, both
paper graphs, the merged example, the mapping output and legacy controls.
`check_examples.py` validates saved graphs against their paired sources and query
answers. `npm run ocg:check` includes all three, both on PR CI and before publishing.

## Remaining boundaries

- No VCF 4.0 overlay; supported conformance profiles are 4.1–4.5.
- The legacy registries preserve explicit source declarations, not invented
  requirements for earlier prose-only key definitions.
- The example materializer is a bounded fixture tool, not a production VCF
  parser. BCF encoding and exact byte/line-ending preservation remain outside
  this logical-model assessment.
- SHACL G/LG checks cover ploidy 1–8; the Python complement covers arbitrary
  ploidy. Decoded vectors and reference-block overlap checks also use Python.
- Complex breakpoint-event reconstruction, all repeat-list combinations,
  reference-aware sequence interpretation and base modifications within
  reference blocks are not exhaustively validated. The representative fixture
  corpus and this checklist do not establish full VCF 4.5 certification.
- RDF/property-kind checks and SHACL do not constitute a full OWL consistency
  proof against all external ontologies.
