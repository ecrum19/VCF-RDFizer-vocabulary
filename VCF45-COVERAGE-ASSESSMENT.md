# VCF Core Vocabulary — VCF 4.5 coverage assessment and implementation guide

**Status.** Version 3.0.0 landed the breaking corrections only (§2). Everything in §4–§6 is
outstanding, specified but not implemented.

Assessed: `ontology/vcf-core-vocabulary.ttl` (95 declared terms — 30 classes, 19 object properties,
34 datatype properties, 8 named individuals, 3 annotation properties, 1 datatype),
`shacl/vcf-core-vocabulary.shacl.ttl` (13 node shapes), `mappings/`, `examples/`.
Reference: [VCFv4.5](https://samtools.github.io/hts-specs/VCFv4.5.pdf), assessed against the LaTeX
master `samtools/hts-specs@master:VCFv4.5.tex` (2834 lines).

---

## 1. Coverage

| Axis | Score |
| --- | --- |
| Textual losslessness — can every byte be stored and reconstructed? | ~90% |
| **Structural typing — can a consumer query a construct without string-parsing a literal?** | **~20%** |
| Spec-defined `##` line types with a class | 6 / 11 |

Method: ~284 normative constructs enumerated from the spec, ~32 structurally represented; excluding
the 122 reserved-key declarations as content rather than vocabulary gives 32/162 ≈ 20%. Losslessness
falls short of 100% only because nothing preserves order — repeated `vcfc:alt` triples lose ALT
order, and there is no line or record index.

The vocabulary models the VCF **container** well, and the expanded/condensed dual profile is its
strongest, best-validated part. It does not yet model VCF **content**. Under the narrower scope
recommended in §7.2 (syntax only, semantics delegated), structural typing reads ~35%.

---

## 2. Changes made in 3.0.0

Breaking corrections, plus two SHACL bugs and one dangling IRI. **No new terms.**

| # | Defect | Change | File |
| --- | --- | --- | --- |
| D1 | `IntegerType`…`StringType` declared `owl:Class rdfs:subClassOf VCFValueType` but used as values of `fieldType` (`rdfs:range VCFValueType`) — punning, non-DL, inconsistent with how `RepresentationProfile`/`VectorEncoding` values are declared | → `owl:NamedIndividual, vcfc:VCFValueType`. **Breaking.** Instance data unchanged; only consumers querying these IRIs *as classes* must change | ontology |
| D1b | Legacy bridge asserted `owl:equivalentClass` from the five `vcfr:*Type` classes to what are now individuals | → `owl:NamedIndividual` + `owl:sameAs`, matching the existing treatment of `CondensedRepresentation` | legacy |
| D3 | `rdfs:domain rdf:Resource` on the four `fieldValue*` properties (`rdf:Resource` is not an OWL 2 class) | domain dropped — a loosening, invalidates nothing | ontology |
| D5 | `vcfc:chromosome` had no `rdfs:domain` | `rdfs:domain vcfc:VCFRecord` | ontology |
| D8 | `{recordId}` IRI-template placeholder collided with the `vcfc:recordId` property (row key vs the ID column) | placeholder → `{recordKey}` in all 7 templates and the README table | ontology, README |
| D11 | `ContigHeaderLine skos:relatedMatch faldo:Reference` — **that IRI does not exist**; FALDO declares the object property `faldo:reference` and no `Reference` class | → `skos:relatedMatch vrs:SequenceReference`, `rdfs:seeAlso faldo:reference, vrs:SequenceReference` | ontology |
| D6 | `VCFRecordShape` required `vcfc:alt` `sh:datatype xsd:string`, so **every record with `ALT=.`** (REF-only, gVCF) **failed validation** | `sh:or (xsd:string, vcfc:Null)` | shacl |
| D7 | `VariantCallShape` allowed QUAL only as `xsd:decimal`/`vcfc:Null`, rejecting the `INF`/`INFINITY`/`NAN` spellings the VCF Float lexical space permits | `sh:or` over decimal/double/float/Null plus a pattern branch for the case-variant spellings | shacl |

Also: version → 3.0.0 in ontology header, `package.json`, `CITATION.cff`; migration section added to
the README. Verified: all four Turtle documents parse (n3), `npm run ocg:check` passes.

Two deferred defects, both additive, both in §4: **D2** — `VCFNumberArity` is a declared class with
zero individuals that nothing points at, so field arity is not machine-readable at all. **D4** — no
ordering property anywhere.

Judgement call worth knowing: D6/D7/D11 are not breaking, but shipping a release while the published
shapes reject every REF-only record, and while an alignment points at a non-existent IRI, seemed
worse than the scope creep.

---

## 3. Gap reference

✅ structurally modelled · ◐ raw string only · ❌ absent

**Header (§1.3–1.5)** — ✅ file, header block, unstructured lines, `##fileformat`, `##INFO`,
`##FILTER`, `##FORMAT`, `##ALT`, `##contig` (ID/length/md5), `##fileDate`/`##source`/`##reference`
conventions. ◐ structured lines (kept as one opaque `headerValue`; no attribute model, so the
spec's arbitrary implementation-defined structured lines are unqueryable). ❌ `##assembly`,
`##META`, `##SAMPLE`, `##PEDIGREE`, `##pedigreeDB`, `#CHROM` line as a resource, contig `URL`, INFO
`Source`/`Version`, header-line order, ID uniqueness per type, all five spec regexes.

**Types and arity (§1.2–1.3)** — ✅ the five Type codes (fixed in 3.0.0). ❌ arity codes
A/R/G/`.`/LA/LR/LG/P/M as individuals, Float lexical space as a datatype, Integer disallowed range,
percent-encoding of `%3A %3B %3D %25 %2C %0D %0A %09`.

**Fixed fields (§1.6.1)** — ✅ CHROM (+ contig link), POS, REF, QUAL. ◐ ID (one literal holding a
semicolon-separated list), FILTER (raw column only — no link to the `FilterDefinition`s that failed,
no `PASS` individual), INFO (structured, but no per-allele/per-genotype indexing, so `AC`, `AF`,
`SVLEN`, `CIPOS`, `MEINFO` stay opaque). ❌ **ALT structure** — the keystone gap: one datatype
property, repeated assertions, no index, no distinction among the six legal allele forms (base
string, `*`, `.`, `<ID>`, `<*>`, breakend). ❌ 21 reserved INFO keys.

**Genotype fields (§1.6.2)** — ✅ per-sample blocks, both profiles. ◐ FORMAT column (`formatRaw`
only; no ordered key resources). ❌ **GT structure** (ploidy, allele-call positions, `/` vs `|`,
optional leading indicator, `.` no-call, GT=0-means-absence-of-symbolic-SV), genotype ordering
formula, PS, PSL/PSO/PSQ, LAA/LA and the eight local-allele fields, **base modifications** (`M*`,
`DPM*`, `ADM*` — the flagship 4.5 addition), FT, LEN and `<*>` reference blocks, missing-value
nuances (single `.` vs `.,.,.`, droppable trailing fields, empty string in string lists), 63
reserved FORMAT keys.

**Structural variants (§2–3, §4.3–4.8)** — ❌ entirely: 31 SV INFO keys, 8 SV FORMAT keys, the
9-member symbolic-ALT type taxonomy, IUPAC symbolic alleles, breakend notation and mate/partner/
single/telomere handling, 15 EVENTTYPE values, SVCLAIM D/J/DJ, the six confidence-interval fields,
CNV representation, `<CNV:TR>` tandem repeats, gVCF blocks, HAP/AHAP.

**BCF 2.2 (§6)** — ❌; a scope decision, see §7.1.

---

## 4. Implementation guide

Design rule, now recorded in the ontology header: **mint a term only when it carries VCF syntax with
no equivalent in a published vocabulary.** Everything else is delegated by alignment. §5 is the
verified mapping table — use it rather than re-deriving IRIs.

### WP-1 — Arity and ordering *(additive; unblocks WP-4)*
`vcfc:fieldArity` (object property → `VCFNumberArity`), `vcfc:arityCode` (the literal token, for
round-tripping), `vcfc:fieldNumberInteger` (`xsd:nonNegativeInteger`, the fixed-count case), and nine
`VCFNumberArity` individuals: `ArityPerAlt` A, `ArityPerAllele` R, `ArityPerGenotype` G,
`ArityVariable` `.`, `ArityPerLocalAlt` LA, `ArityPerLocalAllele` LR, `ArityPerLocalGenotype` LG,
`ArityPerGTAllele` P, `ArityPerBaseModification` M. Keep `fieldNumber` as the lossless string. Plus
`vcfc:lineIndex` (on `HeaderLine`) and `vcfc:recordIndex` (on `VCFRecord`) — D4. **~14 terms.**

### WP-2 — Header model
Classes `StructuredHeaderLine`, `UnstructuredHeaderLine`, `HeaderAttribute`, `ColumnHeaderLine`,
`AssemblyHeaderLine`, `MetaHeaderLine`, `MetaDefinition` (⊑ `FieldDefinition`, so it reuses
`fieldId`/`fieldArity`/`fieldType`), `SampleHeaderLine`, `SampleDeclaration`, `PedigreeHeaderLine`,
`PedigreeRelation`, `PedigreeDBHeaderLine`. Properties `hasAttribute`, `attributeKey`,
`attributeValue`, `attributeIndex`, `hasGenotypeColumns`, `assemblyUrl`, `pedigreeDbUrl`,
`metaAllowedValue`, `declaresSample`, `pedigreeAncestor` (⊒ `pedigreeMother`, `pedigreeFather`;
⊑ `prov:wasDerivedFrom` for the clonal `Original=` case), `ancestorRole`, `contigUrl` (D9),
`fieldSource`, `fieldVersion`. Add `subClassOf` axioms placing the existing line classes under
Structured/Unstructured.

Two notes that cut work: `HeaderAttribute` is the highest-leverage term in the whole guide — it makes
every implementation-defined structured line queryable and captures optional attributes without a
bespoke property each. And **do not mint `sampleAssay`/`sampleDisease`/`sampleTissue`/
`sampleEthnicity`** — those are `##META`-declared keys, not fixed VCF fields, so they belong on
`hasAttribute` + `declaredBy` → `MetaDefinition`. **~26 terms.**

### WP-3 — Allele model *(the keystone; everything below depends on it)*
`vcfc:Allele` (abstract), `ReferenceAllele`, `AltAllele`; `AlleleKind` with individuals
`BaseSequenceAllele`, `OverlappingDeletionAllele` (`*`), `MissingAllele` (`.`), `SymbolicAllele`
(`<ID>`), `UnspecifiedAllele` (`<*>` / `<NON_REF>`), `BreakendAllele`. Properties `hasAltAllele`,
`hasReferenceAllele`, `alleleIndex` (0 = REF, 1..n into ALT — this is the term that makes
Number=A/R/G work), `alleleValue`, `alleleKind`, `declaredByAlt` (→ `AltDefinition`). Keep
`vcfc:alt` as the lossless raw form, annotated as unsuitable for per-allele annotation.

Positions cost **zero new terms**: put `faldo:location` on the record and the allele, with
`faldo:Region` / `faldo:ExactPosition` and `faldo:reference` → the contig. **~15 terms.**

### WP-4 — Value indexing for A/R/G/LA/LR/LG/P/M
`vcfc:FieldValueItem`; `hasValueItem`, `valueIndex`, `itemValue`, `forAllele` (→ `Allele`),
`forGenotypeIndex`, `forGTAlleleIndex`, `forBaseModification`, `tupleArity` (the 2× and 4× grouping
of CIPOS/CIEND/CILEN and MEINFO/METRANS). This turns `AC=2,1`, `CIPOS=-5,5,0,0`,
`MEINFO=NAME,START,END,POLARITY` and the `RUS`/`RN` list-of-lists into triples. **~9 terms.**

### WP-5 — Genotype and phasing
`Genotype`, `GenotypeAlleleCall`, `PhasingStatus` (individuals `Phased`, `Unphased`), `PhaseSet`,
`LocalAlleleSet`. Properties `hasGenotype`, `genotypeString`, `ploidy`, `hasAlleleCall`, `callIndex`,
`calledAllele`, `phasingStatus`, `isNoCall`, `inPhaseSet`, `phaseSetId` (PS), `phaseSetName` (PSL),
`phaseSetOrdinal` (PSO), `phaseSetQuality` (PSQ), `hasLocalAllele`, `localAlleleIndex`,
`genotypeIndex` (carry the `Index(k₁…k_P) = Σ C(k_m+m-1, m)` formula in the comment), `sampleFilter`
(FT). **~20 terms.**

### WP-6 — Reserved key registry *(bulk, mechanical, generate it)*
`ontology/vcf-core-reserved-keys.ttl`: ~122 `InfoFieldDefinition`/`FormatFieldDefinition` named
individuals — 21 Table-1 INFO, 31 SV INFO, 63 Table-2 FORMAT (including three regex families and 30
base-modification aliases), 8 SV FORMAT — each with `fieldId`, `fieldArity`, `fieldType`,
`fieldDescription` verbatim from the spec. Plus annotation properties `reservedIn` (`"VCFv4.5"`),
`deprecatedInVersion` (END, SVTYPE), `keyPattern` (`M[0-9]+[ACGTUN]`, `DPM…`, `ADM…`), `aliasOf`
(M5mC → M27551C), and `skos:exactMatch` to ChEBI for the base-modification keys (§5).

Write `scripts/generate-reserved-keys.mjs` against the spec's LaTeX `longtable` blocks rather than
hand-typing, and version this file separately — it, not the core, is what changes for VCF 4.6.

### WP-7 — Structural variation *(heavily delegated; see §5)*
Mint only the VCF-specific carriers: `SymbolicAlleleType` + 9 individuals with `svTypeCode` and SO
alignments; `SVClaim` + `AbundanceClaim` D / `AdjacencyClaim` J / `AbundanceAndAdjacencyClaim` DJ;
`Breakend`; `BreakendOrientation` + the four bracket-form individuals; `VariantEvent`; `EventType` +
15 individuals; `ConfidenceInterval` with `ciLower`/`ciUpper`. Properties `svType`, `svSubtypeOf`,
`svClaim`, `svLength`, `isImprecise`, `isNovel`, `mateBreakend`, `partnerBreakend`,
`isSingleBreakend`, `isTelomereBreakend`, `breakendReplacementString`, `breakendOrientation`,
`insertedSequence`, `inEvent`, `eventType`, and six CI binding properties (`posConfidenceInterval`,
`endConfidenceInterval`, `lenConfidenceInterval`, `copyNumberConfidenceInterval`,
`rucConfidenceInterval`, `rbConfidenceInterval`).

`ConfidenceInterval` is needed only for CILEN/CICN/CIRUC/CIRB — **CIPOS and CIEND should use
`faldo:InRangePosition`**, which is exactly FALDO's idiom for an uncertain position. Reuse
`asSequenceAlteration` for the SO link rather than reclassifying the VCF resource. **~38 terms.**

### WP-8 — Repeats, copy number, gVCF, base modifications
`TandemRepeatAllele` (⊑ `AltAllele`), `RepeatSequence`, `RepeatUnit`, `ReferenceBlock`,
`BaseModification`. Properties `repeatSequenceCount` (RN), `hasRepeatSequence`, `repeatSequenceIndex`,
`repeatUnitSequence` (RUS), `repeatUnitLength` (RUL), `repeatUnitCount` (RUC), `repeatBases` (RB),
`repeatUnitBases` (RUB), `copyNumber` (allele-specific INFO CN and total FORMAT CN),
`copyNumberQuality`/`Likelihood`/`Posterior` (CNQ/CNL/CNP), `haplotypeId` (HAP),
`ancestralHaplotypeId` (AHAP), `referenceBlockLength` (LEN), `endPosition` (derived END),
`isReferenceBlockStart`, `modifiedResidue` (→ a ChEBI IRI directly), `modifiedBaseOffset`,
`modificationFraction`, `modificationDepth`, `modificationAlleleDepth`.

Base-modification strandedness costs **zero new terms** — the spec's positive/negative-strand value
pairs map onto `faldo:ForwardStrandPosition` / `faldo:ReverseStrandPosition`, and its unstranded
convention onto `faldo:BothStrandsPosition`. **~24 terms.**

### WP-9 — Lexical layer
Datatypes `VCFFloat` (`^[-+]?[0-9]*\.?[0-9]+([eE][-+]?[0-9]+)?$` or `^[-+]?(INF|INFINITY|NAN)$`,
case-insensitive), `VCFInteger` (excluding −2³¹ … −2³¹+7), `GenotypeString`, `BreakendString`. Plus
`percentEncodingPolicy` and a `rawValue`/`decodedValue` pair so a consumer knows whether `%3B` was
decoded. Declaring `VCFFloat` also lets the D7 shape fix collapse to one branch. **~8 terms.**

### Totals and modularisation
~154 new terms + ~122 reserved-key individuals → ~370 from 95. Split, with one `w3id` slash path
each and OCG building one site across all of them:

```
ontology/vcf-core-vocabulary.ttl      core: file, header, record, profiles   (WP-1, WP-2, WP-9)
ontology/vcf-core-alleles.ttl                                               (WP-3, WP-4)
ontology/vcf-core-genotypes.ttl                                             (WP-5)
ontology/vcf-core-sv.ttl                                                    (WP-7, WP-8)
ontology/vcf-core-reserved-keys.ttl   versioned against the VCF spec        (WP-6)
```

The `owl:imports` block for these was drafted and reverted in 3.0.0; re-add it when the files exist.

---

## 5. External vocabulary reuse map

Every IRI below was resolved and verified on 2026-09-07 — SO and ChEBI via EBI OLS4, FALDO from
`OBF/FALDO@master:faldo.ttl`, VRS 2.0 by dereferencing `w3id.org/ga4gh/schema/vrs/2.0/json/*`.
**Do not add an alignment without checking it the same way** — 3.0.0 had to remove
`faldo:Reference`, which never existed.

**FALDO** — the one vocabulary to *reuse structurally*, not merely align to: it is real RDF, designed
for exactly this, and already prefixed in the ontology.

| VCF construct | FALDO term |
| --- | --- |
| POS | `faldo:ExactPosition` + `faldo:position`, `faldo:reference` → contig |
| POS..END interval | `faldo:Region` + `faldo:begin` / `faldo:end`, via `faldo:location` |
| CIPOS / CIEND | `faldo:InRangePosition` + `faldo:begin` / `faldo:end` |
| Imprecise position, no CI given | `faldo:FuzzyPosition` |
| Symbolic-SV POS ("base immediately preceding") | `faldo:InBetweenPosition` |
| `M*` positive / negative strand values | `faldo:ForwardStrandPosition` / `faldo:ReverseStrandPosition` |
| `M*` unstranded convention | `faldo:BothStrandsPosition` |

**GA4GH VRS 2.0** (`https://w3id.org/ga4gh/schema/vrs/2.0/json/`) — JSON Schema, not RDF, so
`skos:closeMatch` + `rdfs:seeAlso` only, matching the existing `vrs:Allele` usage. The matches are
unusually good:

| VCF construct | VRS 2.0 class |
| --- | --- |
| Breakend / novel adjacency | `Adjacency` |
| Single breakend, telomere breakend | `Terminus` |
| Phase set (PS / PSL) | `CisPhasedBlock` |
| PSO derivative-chromosome traversal | `DerivativeMolecule`, `TraversalBlock` |
| FORMAT CN (total copy number) | `CopyNumberCount` |
| `<DEL>` / `<DUP>` abundance claim | `CopyNumberChange` |
| CIPOS/CIEND bounds | `Range` |
| SVLEN, `<CNV:TR>` repeat structure | `LengthExpression`, `ReferenceLengthExpression` |
| REF / ALT base strings | `LiteralSequenceExpression` |
| contig | `SequenceReference` |
| POS location | `SequenceLocation` |
| allele | `Allele` |

**Sequence Ontology** — `skos:exactMatch` for the symbolic-ALT taxonomy.

| VCF | SO | | VCF | SO |
| --- | --- | --- | --- | --- |
| `<DEL>` | `SO:0000159` deletion | | `DUP:TANDEM` | `SO:1000173` tandem_duplication |
| `<INS>` | `SO:0000667` insertion | | `DEL:ME` | `SO:0002066` mobile_element_deletion |
| `<DUP>` | `SO:1000035` duplication | | `INS:ME` | `SO:0001837` mobile_element_insertion |
| `<INV>` | `SO:1000036` inversion | | EVENTTYPE TRA | `SO:0000199` translocation |
| `<CNV>` | `SO:0001019` copy_number_variation | | TRA (inter-chr) | `SO:0002060` interchromosomal_translocation |
| `CNV:TR` | `SO:0000705` tandem_repeat (close); `SO:0002096` short_tandem_repeat_variation (related) | | TRA:BALANCED | `SO:1000048` reciprocal_chromosomal_translocation |
| breakend | `SO:0001021` chromosome_breakpoint (related) | | CHROMOTHRIPSIS | `SO:0002062` complex_chromosomal_rearrangement (**close, not exact** — matched as a synonym) |

Already used and confirmed valid: `SO:0001059` sequence_alteration, `SO:0001060` sequence_variant.
Also available if useful: `SO:0001483` SNV, `SO:0002007` MNV, `SO:1000005` complex_substitution,
`SO:0001742`/`SO:0001743` copy_number_gain/loss, `SO:0001537` structural_variant.
**No SO term exists** for `DUP:DISPERSED`, `TRA:UNBALANCED`, `BFB`, or `DOUBLEMINUTE` — leave those
four unaligned rather than forcing a near-match.

**GENO** — `skos:closeMatch` for the genotype layer: `GENO:0000536` genotype, `GENO:0000512` allele,
`GENO:0000036` reference allele, `GENO:0000002` variant allele, `GENO:0000886` allelic phase,
`GENO:0000131` in cis, `GENO:0000871` haplotype (for HAP/AHAP), `GENO:0000133` zygosity.

**ChEBI** — all ten IDs the spec names verify, so the `M*` aliases can point at real classes:
`CHEBI:27551` 5-methylcytosine (M5mC), `CHEBI:76792` 5-(hydroxymethyl)cytosine (M5hmC),
`CHEBI:76794` 5-formylcytosine (M5fC), `CHEBI:76793` 5-carboxycytosine (M5caC), `CHEBI:16964`
5-hydroxymethyluracil (M5hmU), `CHEBI:80961` 5-formyluracil (M5fU), `CHEBI:17477`
uracil-5-carboxylic acid (M5caU), `CHEBI:28871` 6-methyladenine (M6mA), `CHEBI:44605` 8-oxoguanine
(M8oxoG), `CHEBI:18107` xanthosine (MXaoN).

**Unverified.** The `hero:` alignments already in the ontology (`VCFFile`, `VCFRecord`, `Genotype`,
`Zygosity`, `GenomicVariation`, `VariantLevelData`) were not checked; given `faldo:Reference`, they
are worth a pass. The `geno:`, `sio:` and `ican:` prefixes are declared but unused.

---

## 6. SHACL backlog

D6/D7 are fixed. Remaining, roughly in value order:

1. Missing node shapes: `HeaderLine` (`headerKey` required), `ContigHeaderLine` (`contigId`),
   `FilterDefinition`, `AltDefinition`, `FileFormatHeaderLine`, plus one per new WP class.
2. `sh:pattern` for the five spec regexes — INFO key `^([A-Za-z_][0-9A-Za-z_.]*|1000G)$`, FORMAT key
   `^[A-Za-z_][0-9A-Za-z_.]*$`, contig name
   `^[0-9A-Za-z!#$%&+./:;?@^_|~-][0-9A-Za-z!#$%&*+./:;=?@^_|~-]*$`, REF `^[ACGTNacgtn]+$`, Float —
   and `^VCFv4\.5$` on `fileFormat`.
3. The INFO/FORMAT asymmetries the two identical definition shapes currently miss: FORMAT
   `Type ≠ Flag`; INFO `Type=Flag ⇒ Number=0`.
4. `sh:in` for `fieldType`, `arityCode`, `svClaim`, `eventType`, `svType`.
5. Uniqueness (`sh:sparql`): `fieldId` per definition type, `sampleName`/`sampleIndex` per file,
   sample-column IDs, record IDs across the file, FILTER codes within a record, `0` forbidden as a
   `filterId`.
6. Cross-field cardinality (`sh:sparql`): CIPOS/CIEND/CILEN = 2×|ALT|; MEINFO/METRANS = 4×|ALT|;
   RUS/RUL/RUC/RB = ΣRN; CIRUC/CIRB = 2×ΣRN; PL/GL/GP = C(n+P−1, P); GT first when present; LAA
   present and early when any local-allele field is non-missing; PS xor PSL; `POS ≤ contigLength+1`.
7. Ordering (`sh:sparql`, needs WP-1): contiguous CHROM blocks, ascending POS, `##fileformat` at
   `lineIndex` 1.
8. `sh:severity sh:Warning` for the spec's *recommended* rules (contig declarations, reference tags,
   INFO Source/Version) versus `sh:Violation` for *must*.
9. Profile shapes `ExpandedProfileShape`/`CondensedProfileShape` with `sh:xone`, enforcing the
   README's one-profile-per-graph rule that is currently prose only.
10. `sh:closed` on structured-header shapes once `HeaderAttribute` exists.

Items 5–7 need `sh:sparql`. Split into `…shacl.ttl` (Core, portable) and `…shacl-sparql.ttl` so
lightweight validators keep working.

---

## 7. Two scope decisions

**7.1 BCF 2.2.** The spec is titled "VCFv4.5 and BCFv2.2" and ~680 of its 2834 lines specify the
binary encoding. Nothing models it and the README is silent, which reads as an oversight rather than
a decision. Recommend declaring it out of scope in one sentence in the ontology header and README —
the RDF target is the logical model, not the byte layout.

**7.2 How far into representation semantics.** Following the agreed preference for reuse, WP-7/WP-8
are now thin: mint the VCF-specific syntax carriers (SVCLAIM codes, EVENTTYPE codes, breakend
orientation, the CI pattern) and delegate the rest to VRS 2.0, SO and FALDO per §5. If you want to go
further and drop WP-7/WP-8 entirely, the honest goal statement becomes *complete coverage of VCF 4.5
syntax, with variation semantics delegated by alignment* — ~200 terms rather than ~370 — and §3's SV
block becomes a deliberate exclusion rather than a gap. The README's existing "intentionally
VCF-centric… designed to link out" already points that way.

---

## 8. Sequencing

| Release | Contents | Breaking? |
| --- | --- | --- |
| **3.0.0** ✅ | D1, D1b, D3, D5, D8, D11, D6, D7. No new terms | Yes (D1) |
| **3.1.0** | WP-1, WP-2, WP-9; SHACL items 1–4 | No |
| **3.2.0** | WP-3, WP-4, WP-5; SHACL items 5–9 | No |
| **3.3.0** | WP-6 (generated), WP-7, WP-8 — WP-7/WP-8 subject to §7.2 | No |
