# Author notes for the first draft

Prepared 6 September 2026. These notes are outside the manuscript's page limit.

## Confirmed scope

The author confirmed that the draft should use repository evidence and retain the four existing authors, affiliations, contact details, ORCIDs, and FWO acknowledgments. The follow-up request explicitly extends the evidence base to the open-source VCF-RDFizer converter repository and asks for naming suggestions. The scientific argument is a vocabulary contribution and a foundation for future investigation, not a report of an evaluated VCF converter. The inherited RML-performance manuscript was replaced; original `main.tex` and `sources.bib` are preserved locally in `.draft-backup/`.

The detailed outline was written before the first manuscript draft and is retained in `outline.md`. It records the rationale and page budget, with minor subsequent updates for the author's answers and verified related work.

## Submission details

The official [SWAT4HCLS 2027 call](https://www.swat4ls.org/workshops/basel2027/call-for-papers/) was checked on 6 September 2026. It requires English PDF submissions in **one-column CEURART**; short papers are **up to five pages plus references**. The call includes position papers, application notes, discovery notes, and use cases. The draft fits a vocabulary-focused position paper/application note.

The listed conference dates are 1-4 February 2027 in Basel, Switzerland. The optional abstract deadline is 7 September 2026, and the paper deadline is 14 September 2026, AOE. Check the live call again before submission. Conference and copyright metadata in `main.tex` now use 2027.

The manuscript keeps the supplied `ceurart.cls` unchanged, using its standard one-column font sizes and margins. References explicitly start on a new page to make the main-matter count unambiguous. See the build and render verification below for the final pagination.

## Positioning and evidence

The vocabulary snapshot is version 1.1.0, repository commit `df827db61922e29e26842007d9735fd2039832dc`, dated 1 September 2026. The author/version/date in `CITATION.cff` agree with the current ontology and package version. The bibliography links to that exact commit, avoiding a moving repository reference.

The main contribution is the combination of a VCF-facing artifact/header/record/call model and explicitly distinct genotype materializations. It should not be described as the first VCF-to-RDF representation, the first ontology to include VCF files/records, a clinically deployed standard, or a proven compression method.

The user's “expanded” terminology is introduced as the vocabulary's existing `vcfc:ExpandedRepresentation`. The condensed profile retains represented genotype contents in ordered lexical vectors. It reduces materialized genotype-resource structure, but its payload still contains the same record-by-sample-by-field cells. The analytical resource-count equation assumes the same sample count and represented FORMAT-key count across all records, full materialization of those cells, and an expanded graph without the optional reusable sample layer. The checked fixture includes that layer in both graphs; its count comparison therefore isolates sample calls/field values from matrices/vectors.

The design justifications in the paper follow from the implemented model and its documentation. No interviews, design workshops, formal requirements-elicitation process, adoption survey, clinical findings, or benchmark results were invented.

## Executed checks and their limits

- `npm run ocg:check` passed, reporting 96 declared terms and 135 relationships. This checks the ontology/documentation configuration, not general instance conformance.
- N3 successfully parsed the ontology (480 triples), SHACL graph (224 triples), and the four inspected Turtle example files. Syntax parsing is not SHACL validation.
- The paper-specific synthetic fixture in `evidence/` was authored as a self-contained illustration using actual version 1.1.0 terms. `node SWAT4HCLS_2027/evidence/verify.mjs` passed and was independently rerun. It recovers all six raw GT/DP cells in both profiles, checks sample ordering and simple missingness, and selects SAMPLE1 with an application-level DP >= 20 predicate.
- The fixture has 94 expanded triples and 71 condensed triples; these counts include chosen explicit types and optional lexical/typed fields. The manuscript reports the clearer counts of three sample calls/six field values versus one matrix/two vectors and does not use total triples as a benchmark.
- `evidence/sample-depth.rq` is a concrete SPARQL query with an expected answer, **not an executed SPARQL result**. The value recovery and sample filtering were checked in Node.js.
- **No SHACL engine was run.** The supplied shapes were inspected, and the synthetic fixture was checked by explicit assertions. This is not represented as a complete SHACL conformance test.

## Repository issues to address before stronger claims

These observations were recorded without changing the vocabulary or legacy examples, because the requested task is paper writing:

1. The current shapes enforce selected cardinalities, datatypes, and links. They do not enforce unique/contiguous sample indices, one vector per FORMAT key, vector payload length, field-specific VCF arity/type semantics, mandatory profile declarations, consistency between profile and graph contents, or exactly one matrix per call. INFO/FORMAT definition shapes do not require `fieldType`.
2. `examples/example-condensed-cohort.ttl` is a partial illustration: it lacks the header link required by `VCFFileShape`, and its sample indices use bare Turtle integers rather than the required `xsd:positiveInteger`. It should not be presented as a standalone conforming graph. The paper-specific fixture supplies the missing context and explicit datatypes.
3. The full legacy example does not consistently provide current profile declarations, typed missing tokens, header links for values, or all available source fields. It cannot substantiate a universal fidelity claim.
4. `examples/example.vcf` has spaces between purported sample columns; `examples/example-file1.vcf` is the tab-separated source matching the focused header/record examples. Neither was used as a benchmark. The manuscript's new `evidence/synthetic.vcf` is explicitly tab-delimited.
5. Repeated RDF assertions do not preserve ALT order. A tested operational convention for alternate-allele ordering is needed before claiming general recovery of multiallelic genotype indices or allele-dependent arrays. Optional raw properties also preclude a general byte-for-byte reconstruction guarantee.
6. The README describes the w3id namespace as a target with registration still to be done. A live dereferenceability check was inconclusive through the browsing tool, so the paper identifies the namespace but does not claim verified persistent resolution. Confirm registration, content negotiation, and published version 1.1.0 documentation before making availability claims stronger than the repository citation.
7. The mapping file is an illustrative SPARQL CONSTRUCT template with example bindings, not an implemented complete converter. Cohort-scale conversion, storage, and query measurements remain future work.

## Real references and the supplied papers

All 13 active bibliography entries were checked against primary standards, publisher pages, proceedings, or repository sources. The supplied manuscripts inspired the narrative and presentation; instructions and editorial notes inside them were treated as source content, not as user requests.

| BibTeX key | Primary source and verification note |
| --- | --- |
| `danecek2011vcf` | [Bioinformatics](https://academic.oup.com/bioinformatics/article/27/15/2156/402296), DOI `10.1093/bioinformatics/btr330`; 2011, 27(15), 2156-2158. |
| `vcf45` | [VCF 4.5 specification](https://samtools.github.io/hts-specs/VCFv4.5.pdf), 25 February 2026 printing, version `e821e4f`. This dates the consulted printing, not the initial introduction of VCF 4.5. |
| `penha2017vcf2rdf` | [Bioinformatics](https://academic.oup.com/bioinformatics/article/33/4/547/2593587), DOI `10.1093/bioinformatics/btw652`; 2017, 33(4), 547-548. |
| `cazzaro2025hero` | [Final CEUR paper](https://ceur-ws.org/Vol-4196/paper_17.pdf), pp. 33-42. Final title: *HERO-Genomics: An Ontology for Integration and Access of Multicenter Genomic Data*. Final author order: Cazzaro, Gut, Menotti, Rueda, Silvello. The attachment's earlier title and author order differ. |
| `bodrug2025semantic` | [Final CEUR paper](https://ceur-ws.org/Vol-4196/paper_16.pdf), pp. 21-32. Final author order: Bodrug-Schepers, Chabane, Montoya, Serrano-Alvarado, Redon, Gaignard. |
| `gvar` | [Genomic variant schema repository](https://github.com/swat4hcls-2025-genomic-variation/genomic-variant-schema) and its `gvar-schema.yaml`. No verified publication year/author list was present; bibliography explicitly uses `n.d.` and the access date rather than inventing metadata. It is cited separately from Semantic Beacons. |
| `eilbeck2005so` | [Genome Biology](https://link.springer.com/article/10.1186/gb-2005-6-5-r44), DOI `10.1186/gb-2005-6-5-r44`; 2005, 6(5), R44. |
| `bolleman2016faldo` | [Journal of Biomedical Semantics](https://link.springer.com/article/10.1186/s13326-016-0067-z), DOI `10.1186/s13326-016-0067-z`; 2016, 7, article 39. |
| `crum2025semantifying` | [Final CEUR poster](https://ceur-ws.org/Vol-4196/paper_6.pdf), pp. 199-200, authors Crum, Taelman, Buelens, Ertaylan, Verborgh. It already proposed an ontology for single-sample VCF transformation. |
| `vcfrConverter2026` | [Pinned public converter snapshot](https://github.com/ecrum19/VCF-RDFizer/tree/db56f6e41abbac79d2784205160df394709bfa39), verified through the live GitHub API on 6 September 2026. Commit dated 5 September 2026; `CITATION.cff` gives version 2.1.0 and corporate author VCF-RDFizer maintainers; `LICENSE` is MIT. The commit date is not presented as a release date. |
| `vcfr110` | [Pinned vocabulary snapshot](https://github.com/ecrum19/VCF-RDFizer-vocabulary/tree/df827db61922e29e26842007d9735fd2039832dc), version/date/creator checked against local `CITATION.cff` and ontology metadata. |
| `prov2013` | [W3C PROV-O Recommendation](https://www.w3.org/TR/2013/REC-prov-o-20130430/), 30 April 2013, editors Timothy Lebo, Satya Sahoo, Deborah McGuinness; institutional W3C attribution renders in the supplied BibTeX style. |
| `shacl2017` | [W3C SHACL Recommendation](https://www.w3.org/TR/2017/REC-shacl-20170720/), 20 July 2017, editors Holger Knublauch and Dimitris Kontokostas; institutional W3C attribution renders in the supplied style. |

The [CEUR volume 4196 index](https://ceur-ws.org/Vol-4196/) identifies the SWAT4HCLS 2025 conference and 2025 copyright, while recording online publication on 22 April 2026. The BibTeX entries use the conference year, 2025; no DOI was invented for these proceedings papers.

The attached HERO manuscript has inline editorial notes and an unfinished deployment section. The attached Semantic Beacons manuscript contains erroneous references, including an unrelated article cited for RML and an incorrect FALDO year. These were not inherited. GENO is distinct from Gene Ontology: the inherited draft's use of the Gene Ontology paper as a GENO citation was removed.

HERO informed the explicit motivation/model/reuse argument and compact model overview. Semantic Beacons informed the concrete data-to-query example and the distinction between schema, access mechanism, and empirical evaluation. Neither paper's application results are presented as results of this vocabulary.

## Before submission

The current [CEUR-WS AI policy](https://ceur-ws.org/GenAI/Policy.html), checked on 6 September 2026, requires a dedicated declaration of AI contributions. It also explicitly restricts AI-generated paragraphs/sections and visual aids; a disclosure alone does not make an unchanged generated manuscript acceptable. The requested deliverable is therefore provided as a **preparatory first draft for substantive author revision**, not a submission-ready manuscript. Its declaration accurately lists Codex assistance and does not assert that human review has already happened. Rework the scientific prose and schematic under the authors' own judgment and finalize the declaration before submission, checking the applicable venue policy. The repository model and previously existing authors/funding details were the supplied basis for the draft, not inventions attributed to the authors.

Review the scientific wording and decide whether to submit as a position paper or application note. Retain the current limitations unless new checks support stronger claims. Publish or archive the paper-specific evidence with the final vocabulary snapshot, and confirm the namespace and documentation endpoint. The existing funding statements and author list have been retained as requested.

## Build and render verification

The draft is built in an isolated `.build/` directory so a separate editor's automatic LaTeX compilation cannot race with the review build. The final reviewed PDF is `paper-draft.pdf`. Build commands are documented in the local README. Pagination and visual inspection are recorded there after the final build.

## Follow-up: converter usage and naming

The converter discussion in Section 4 now grounds maturity in actual implemented use. The abstract and conclusion also identify this implementation context. These observations come from **public committed source**, not the local converter working tree, which contains unrelated uncommitted work. No converter files were changed and no converter run, regression suite, or performance experiment was executed for this revision.

The public `main` commit was resolved through GitHub's API to `db56f6e41abbac79d2784205160df394709bfa39` (5 September 2026). Inspection covered `README.md`, `CITATION.cff`, `LICENSE`, the default RML rules and rules guide, the Python emitters, and their unit tests. Relevant stable source locations:

- [Default mappings](https://github.com/ecrum19/VCF-RDFizer/blob/db56f6e41abbac79d2784205160df394709bfa39/rules/default_rules.ttl): namespace and file/header/record/call mappings.
- [Expanded emitter](https://github.com/ecrum19/VCF-RDFizer/blob/db56f6e41abbac79d2784205160df394709bfa39/vcf_rdfizer.py#L2114): `SampleCall` and `FormatFieldValue` emission.
- [Condensed emitter](https://github.com/ecrum19/VCF-RDFizer/blob/db56f6e41abbac79d2784205160df394709bfa39/vcf_rdfizer.py#L2719): shared samples, indices, matrices, linked FORMAT definitions, encoding declaration, and tab-separated vector payloads.
- [Expanded regression test](https://github.com/ecrum19/VCF-RDFizer/blob/db56f6e41abbac79d2784205160df394709bfa39/test/test_vcf_rdfizer_unit.py#L1713) and [condensed regression test](https://github.com/ecrum19/VCF-RDFizer/blob/db56f6e41abbac79d2784205160df394709bfa39/test/test_vcf_rdfizer_unit.py#L1828). Their presence and assertions were inspected; no claim that they were executed is made.

**Integration detail to reconcile before claiming complete conformance:** the public expanded emitter declares `vcfc:ExpandedRepresentation` at line 2147, while this vocabulary version defines `vcfc:ExpandedRepresentation`. Its expanded FORMAT values also omit the optional `declaredBy` linkage; condensed vectors include it. The manuscript therefore discusses implemented genotype structures and project-level use without claiming strict end-to-end conformance. Resolving the identifier mismatch is separate converter/vocabulary maintenance, not part of the requested paper revision. The current vocabulary namespace and term identifiers remain unchanged.

**Naming recommendation, not applied:** `VCFolio` (VCF + folio), with a subtitle such as “An RDF vocabulary for VCF files, metadata, and genotype calls.” It retains the recognizable VCF name, evokes the source artifact and its context, and distinguishes the vocabulary from the converter. Alternatives are `VarWeave` (broader integration emphasis) and `CallFolio` (call/context emphasis). A lightweight search found no obvious genomics/ontology collision for VCFolio or VarWeave; this is not a guarantee of uniqueness. A possible future title is “VCFolio: A Foundation for Expanded and Condensed RDF Representations of VCF.” No rename has been applied pending the author's choice.

## Revision of 6 September 2026: rename to VCF Core Vocabulary 2.0.0

These notes record the second revision pass. The scientific argument was not changed; the artifact was
renamed, one terminology mismatch was closed, and one missing related work was added.

### What changed in the manuscript

- **Title and framing.** `VCF Core: A Vocabulary Foundation for Expanded and Condensed RDF
  Representations of VCF`. The abstract, introduction, and conclusion name the VCF Core Vocabulary 2.0.0.
  The converter keeps its own name and is described as a separate artifact.
- **The rename is stated, not left implicit.** One sentence in the introduction records that the
  vocabulary was published through version 1.1.0 as the VCF-RDFizer Vocabulary, gives the reason (a shared
  semantic target should not be identified by one converter's name), and notes that the retired `vcfr:`
  namespace resolves to a deprecation document.
- **Expanded/dense mismatch closed.** The vocabulary now defines `vcfc:ExpandedRepresentation`; the figure
  branch label reads "Expanded" rather than "Expanded / dense", and Section 3.1 uses the qualified term.
  `vcfr:DenseRepresentation` survives only in the retired-namespace document and in one provenance
  sentence in the ontology comment.
- **GFVO added to related work.** The Genomic Feature and Variation Ontology explicitly renders VCF
  contents in RDF and predates everything else cited. It is placed first in the related-work list, framed
  as harmonizing several formats where this vocabulary retains what one file declares.
- **AI declaration updated** to name Claude alongside Codex for this revision.

### Verified reference

| BibTeX key | Primary source and verification note |
| --- | --- |
| `baran2015gfvo` | [PeerJ 3:e933](https://peerj.com/articles/933/), DOI `10.7717/peerj.933`; 2015. Author list and e-locator checked against [PMC4435477](https://pmc.ncbi.nlm.nih.gov/articles/PMC4435477/). |

`vcfr110` was rekeyed to `vcfc200` and now cites version 2.0.0. **Its `url` is the bare repository and its
`note` carries a `REPLACE-ME`**: pin the 2.0.0 release commit or tag and add the Zenodo DOI before
submission, so the citation is not a moving reference.

### Page budget

The draft is back within the venue limit after the additions: **five pages of main matter**, including the
acknowledgments and the AI declaration, with references starting on page six. Fitting the GFVO sentence
and the rename sentence required tightening those two additions rather than the pre-existing prose. If
further material is added, this is now the binding constraint.

Build verification for this revision ran in a container with TeX Live Debian, which needed
`texlive-publishers` for `elsarticle-num-names.bst` and `texlive-fonts-extra` for `ccicons.sty`. BibTeX
resolves all 14 citations with no undefined citation or reference warnings. This is a property of that
build environment, not of the repository.

### Repository changes made alongside the manuscript

- Namespace `https://w3id.org/vcf-rdfizer/vocab#` → `https://w3id.org/vcf-core/vocab#`, prefix `vcfr:` →
  `vcfc:`, across the ontology, SHACL shapes, mapping, examples, OCG configuration, scripts, README,
  `CITATION.cff`, and this paper's evidence files.
- `ontology/vcf-core-vocabulary.ttl`, `shacl/vcf-core-vocabulary.shacl.ttl`, and
  `mappings/vcf-to-vcf-core-construct.sparql` renamed to match.
- `legacy/legacy-vcf-rdfizer.ttl`: all 95 retired terms, each `owl:deprecated`, `dct:isReplacedBy`, and
  linked to its successor with `owl:equivalentClass`, `owl:equivalentProperty`, or `owl:sameAs`. The two
  profile individuals resolve to `owl:sameAs`, which is the correct form for `owl:NamedIndividual`
  values, and `vcfr:Null` to `owl:equivalentClass` as an `rdfs:Datatype`. No term fell back to an untyped
  default.
- `w3id/`: the two `.htaccess` files and their maintainer READMEs for the perma-id pull request. The old
  namespace is **not** redirected to the new one; it serves the deprecation document.
- Version 2.0.0 in `package.json`, `CITATION.cff`, `ocg.config.json`, and `owl:versionInfo`, with
  `owl:priorVersion` and `dct:replaces` pointing at the retired namespace.
- `ACKNOWLEDGEMENTS.md` added.

### Still open

1. **`REPLACE-ME` in both `.htaccess` files** — the real publishing host. If GitHub Pages, that is
   `https://ecrum19.github.io/VCF-RDFizer-vocabulary`; confirm the built site serves
   `assets/vcf-core-vocabulary.ttl`, `assets/vcf-core-vocabulary.shacl.ttl`, and
   `assets/legacy-vcf-rdfizer.ttl`. A local OCG build confirms all three are generated.
2. **`REPLACE-ME` in `vcfc200`** — the pinned 2.0.0 commit or tag, and the Zenodo DOI.
3. **Version-line collision.** The converter is already at 2.1.0. The vocabulary reaching 2.0.0 puts the
   two numbers next to each other exactly where the paper argues the artifacts are independent. Either
   say so explicitly in the release notes, or choose a different number for the vocabulary.
4. **The GitHub repository is still named `VCF-RDFizer-vocabulary`,** and the branding artwork in
   `assets/branding/` still reads VCF-RDFizer. Renaming the repository would change the citation URL, so
   this was left to the author.
5. **KNoWS-IDLab budget line unconfirmed.** `ACKNOWLEDGEMENTS.md` assumes the first author's PhD; the
   manuscript carries the attribution template as a comment beside the acknowledgments.
6. The seven repository issues recorded in the previous revision are unchanged; the rename did not address
   any of them.
