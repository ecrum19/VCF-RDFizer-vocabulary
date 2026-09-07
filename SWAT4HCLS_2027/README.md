# SWAT4HCLS 2027 short-paper draft

- `outline.md`: detailed argument, section plan, design rationale, and evidence boundaries.
- `main.tex`: first scientific draft in the supplied one-column CEURART class.
- `sources.bib`: 14 verified references, all cited in the manuscript.
- `paper-draft.pdf`: compiled draft; five pages of main matter plus one page of references.
- `author-notes.md`: source provenance, author confirmations, validation limits, and pre-submission work.
- `evidence/`: synthetic VCF, two RDF profiles, an executable value-recovery check, and an illustrative SPARQL query.

## Build

From this directory, run:

```sh
make
```

The Makefile requires `latexmk`, `pdflatex`, and BibTeX with the packages used by the supplied `ceurart.cls` and its `elsarticle-num-names` bibliography style. It compiles copies in `.build/` and copies the result to `paper-draft.pdf`. No class modifications, font-size changes, margin changes, or shell escape are used. An isolated build avoids collisions with editor builds of `main.pdf`.

The original template class and logo files are retained locally. The initial `main.tex`, `sources.bib`, and Makefile were backed up in `.draft-backup/`. The existing ignore rules continue to exclude PDFs, build intermediates, backups, and template assets; authored source documents, the Makefile, and evidence are visible to Git.

## Check the synthetic illustration

From the repository root:

```sh
node SWAT4HCLS_2027/evidence/verify.mjs
```

This checks the six represented GT/DP cells, sample ordering, missingness, and application-level depth filtering. It is not a converter benchmark, a general VCF conformance test, a SPARQL execution test, or a SHACL validation run. Details and captured results are in `evidence/README.md` and `evidence/verification.json`.

## Review status

The final PDF has five main-matter pages, including the acknowledgments and the AI declaration, and references start on page six. The revision of 6 September 2026 renamed the vocabulary to VCF Core 2.0.0 and added GFVO to related work; both additions were tightened to keep the five-page budget. BibTeX resolves all 14 citations; the final build has no undefined citations/references or missing-glyph warnings. CEURART produces internal title-box and PDF/A metadata warnings; the rendered title, authors, contact details, figure, body, and references are legible and unclipped. These checks do not constitute a formal PDF/A conformance certification.

The venue information was checked on 6 September 2026 against the [official call](https://www.swat4ls.org/workshops/basel2027/call-for-papers/). Authors and FWO acknowledgments were retained as confirmed. The preparatory draft includes a truthful AI-use declaration and requires substantive human revision before submission under the current CEUR-WS policy; see `author-notes.md`.
