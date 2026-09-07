# Changelog

## 1.1.0 — 2026-09-05

Adds the condensed cohort representation to the vocabulary, and resolves a
contradiction between the vocabulary's missing-value policy and its own shapes.

### Added

- **The condensed representation profile, 19 terms.** A VCF's per-sample
  genotype block can be serialized two ways, and only one of them was
  described. The expanded profile mints a resource per sample and FORMAT key,
  which does not survive cohort scale; the condensed profile declares the
  samples once per file and gives each record one vector per key. The vocabulary
  now defines both, so a graph in either can be dereferenced and checked.

  - Classes: `SampleSet`, `VCFSample`, `CohortCallMatrix`, `FormatValueVector`
  - Profile terms: `RepresentationProfile` with `ExpandedRepresentation` and
    `CondensedRepresentation`; `VectorEncoding` with `VCFTextVector`
  - Object properties: `hasSampleSet`, `hasSample`, `hasCallMatrix`,
    `appliesToSampleSet`, `hasFormatValueVector`, `valueEncoding`,
    `representationProfile`
  - Datatype properties: `sampleName`, `sampleIndex`, `encodedValues`

  `RepresentationProfile` and `VectorEncoding` are new superclasses that give
  the two enumerations a range; the other 17 terms were already being emitted by
  [VCF-RDFizer](https://github.com/ecrum19/VCF-RDFizer) and did not resolve.

- **SHACL shapes for the condensed profile.** They constrain what positional
  decoding actually depends on, rather than everything that could be
  constrained: exactly one `sampleIndex` per sample, a sample set on every
  matrix, and an encoding plus a FORMAT declaration on every vector. A vector
  cannot be read without those.

  The profile and encoding terms are classes used as values, following the
  vocabulary's existing `VCFValueType` pattern, so they carry no `rdf:type`
  edge. The shapes use `sh:in` rather than `sh:class` — which also pins the
  permitted set, rejecting an unknown profile rather than merely an untyped one.

- **`examples/example-condensed-record.ttl`** — the same record as
  `example-minimal-record.ttl`, in the condensed profile, so the two can be read
  side by side.

### Changed

- **`vcfr:missingValuePolicy` now states where it applies.** It previously said
  a missing token SHOULD be `"."^^vcfr:Null` without qualification, which put it
  in contradiction with `VCFRecordShape`: `vcfr:alt` was constrained to
  `sh:datatype xsd:string`, so a record with `ALT=.` could satisfy neither rule.

  The policy now names the fields where VCF 4.5 permits the token — ID, ALT,
  QUAL, FILTER, INFO, and any INFO or FORMAT value — and states that CHROM, POS
  and REF are required and have no missing form, so a `.` in one of them is
  malformed input rather than an absent value. It also states that within a
  `FormatValueVector` the token stays a character at its sample's position,
  because lifting it out would break positional alignment.

- **`VCFRecordShape` follows that boundary.** `vcfr:alt` and `vcfr:recordId`
  accept `xsd:string` or `vcfr:Null`, as `vcfr:qual` already did. `vcfr:chrom`,
  `vcfr:pos` and `vcfr:ref` keep an exact datatype deliberately: relaxing them
  too would have removed a check that catches genuinely malformed records.

- **`VariantCallShape`** admits `vcfr:hasCallMatrix` alongside
  `vcfr:hasSampleCall`. Neither is required — a call in one profile simply has
  none of the other's genotype block.

- `vcfr:alt` and `vcfr:recordId` carry a per-term `vcfr:missingValuePolicy`
  note, so the rule is visible on the term page and not only on the ontology
  node.

### Verified

- The shipped examples, and VCF-RDFizer's own expanded and condensed fixture
  graphs, all conform against the new shapes.
- The `ALT=.` contradiction was reproduced against the 1.0.1 shapes before the
  change and no longer occurs.
- Ten targeted corruptions of a condensed graph — dropped, duplicated and
  untyped `sampleIndex`, missing `sampleName`, missing `valueEncoding`,
  `declaredBy`, `encodedValues` and `appliesToSampleSet`, an unknown profile IRI,
  and an empty sample set — are each reported as a violation, so the new shapes
  are load-bearing rather than decorative.

## 1.0.1

Home-page display fixes and a Pages refactor; no vocabulary changes.
