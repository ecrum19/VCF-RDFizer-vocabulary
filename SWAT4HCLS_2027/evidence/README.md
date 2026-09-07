# Reproducible synthetic illustration

This fixture illustrates the two genotype representations in vocabulary version
1.1.0. It is a manually authored, synthetic example, not a converter evaluation,
storage benchmark, scalability measurement, biological finding, or demonstration
of lossless conversion for arbitrary VCF files. The three samples allow ordering
and missingness to be inspected in one small record; they do not suggest that
three samples constitute a large cohort. The expanded representation uses the
vocabulary's `vcfc:ExpandedRepresentation` profile identifier.

## Files and execution

- `synthetic.vcf`: one tab-delimited record with GT and DP for three samples.
- `expanded.ttl`: individual sample calls and FORMAT field values.
- `condensed.ttl`: one cohort matrix with sample-ordered GT and DP vectors.
- `verify.mjs`: parses both graphs and checks the fixture against the source row.
- `sample-depth.rq`: a SPARQL 1.1 query for expanded sample depth of at least 20.
- `verification.json`: captured output from the executed Node verification.

The verification requires Node.js and the `n3` package available through this
repository's existing dependencies. It uses only Node built-ins and N3; it does
not install packages or require network access. From the repository root, run:

```sh
node SWAT4HCLS_2027/evidence/verify.mjs
```

The script exits nonzero on an assertion failure. The recorded run used Node.js
24.16.0 and N3 2.3.0. Both graphs are standalone: header lines are explicitly also typed as
`vcfc:HeaderLine`, profile/encoding resources have their required classes, and
sample indices explicitly use `xsd:positiveInteger`. These explicit declarations
avoid relying on loading the ontology for the class constraints in the current
SHACL shapes. All example resource identifiers are file-scoped HTTPS IRIs under
the reserved example domain; no external resource is fetched.

## Executed checks and results

The script checks Turtle parsing, profile identifiers, the file/header/record
structure, FORMAT definitions, explicit sample ordering, per-sample identity,
vector dimensions, genotype resource counts, typed non-missing depths, and
reconstruction of all six raw FORMAT values. It reverses the parsed statement
order before checking to avoid dependence on Turtle statement order. In the
condensed graph, values are reconstructed from the vectors; the optional raw
sample block is checked separately against that reconstruction.

| Check | Expanded | Condensed |
| --- | ---: | ---: |
| Total triples in supplied graph | 94 | 71 |
| `SampleCall` resources | 3 | 0 |
| `FormatFieldValue` resources | 6 | 0 |
| `CohortCallMatrix` resources | 0 | 1 |
| `FormatValueVector` resources | 0 | 2 |
| Raw FORMAT cells recovered exactly | 6 of 6 | 6 of 6 |

Both representations preserve sample order `SAMPLE1`, `SAMPLE2`, `SAMPLE3`, the
GT strings `0/1`, `0/0`, `./.`, and the DP strings `42`, `18`, `.`. Expanded
non-missing DP values have both their raw string and an integer value. The
missing DP value is `"."^^vcfc:Null`; the missing diploid GT remains the raw
string `"./."`, preserving its two missing allele positions. No missing value
is replaced with zero or omitted from a vector.

The application-level depth predicate selects `SAMPLE1` in both decoded forms.
The separate SPARQL query has expected output `SAMPLE1`, `42` on `expanded.ttl`.
It was **not executed with a SPARQL engine**. Its graph pattern addresses the
expanded profile; condensed cell access needs an application decoder, a
materialized expansion, or an additional query mechanism. The Node test does
not demonstrate SPARQL execution on vector contents.

No general SHACL validator was available in the inspected environment, so
**SHACL validation was not executed**. The fixture assertions check selected
requirements and fixture invariants; they are not a replacement for running the
repository's complete SHACL graph in a standards-compliant validator.

## Interpretation boundaries

The genotype-specific resource count is nine in the expanded example (three
sample calls and six field values), versus three in the condensed example (one
matrix and two vectors). Both retain the same shared sample set, sample resources,
and field definitions. The total triple counts also include shared metadata,
explicit types, and optional raw or typed values and therefore depend on those
authoring choices. Neither count establishes runtime, compressed size, memory
use, query latency, a recommended sample-count threshold, or behavior on other
VCF features. The optional `sampleDataRaw` additionally duplicates condensed
payload text; its cost is not hidden by the resource count.

The fixture verifies only its single biallelic record, two FORMAT fields, three
sample columns, and simple missing values. It does not establish general
round-trip fidelity for multiallelic ordering, arbitrary cardinalities, omitted
trailing FORMAT fields, phasing, structural variants, special float values, or
header serialization.
