# w3id.org configuration

Two directories to contribute to [perma-id/w3id.org](https://github.com/perma-id/w3id.org) in **one**
pull request:

| Directory | Path on w3id.org | Purpose |
| --- | --- | --- |
| `vcf-core/` | `https://w3id.org/vcf-core/` | New. Serves the VCF Core Vocabulary, VCF 4.5 modules, SHACL profiles, and companion documentation. |
| `vcf-rdfizer/` | `https://w3id.org/vcf-rdfizer/` | Replaces the existing directory. Serves the legacy deprecation document for the retired namespace. |

## Before opening the pull request

1. **Replace every `REPLACE-ME`** in both `.htaccess` files with the real publishing host, no trailing
   slash. If the companion site is published to GitHub Pages from this repository, that host is
   `https://ecrum19.github.io/vcf-core-vocabulary`.
2. **Confirm the host actually serves the referenced files.** The rules point at
   `assets/vcf-core-vocabulary.bundle.ttl`, four VCF 4.5 module Turtle files, both SHACL profiles, and
   `assets/legacy-vcf-rdfizer.ttl`. The OCG
   build copies configured artifacts into `site/assets/`; keep every module and profile registered in
   `ocg.config.json` before publishing.
3. **Test against a local checkout**, as the w3id maintainers ask.
4. **Squash to one commit** and put the project name in the PR message. Merged changes go live
   immediately.

Each directory also needs the `README.md` next to its `.htaccess` with maintainer contact details; that
is what the w3id maintainers use to reach the namespace owner.

## Why the old namespace is not redirected

`vcf-rdfizer/.htaccess` serves a separate legacy document rather than redirecting to
`https://w3id.org/vcf-core/`. A redirect would resolve every 1.1.0 IRI to a document in which that IRI is
not defined — a live-looking term with no definition, which is worse for a consumer than a 404. The legacy
document keeps each retired term present, marked `owl:deprecated`, and linked to its successor, so graphs
minted under 1.1.0 keep their meaning under a reasoner without being rewritten.

## Maintainer

Elias Crum, IDLab, Ghent University — imec, Belgium. <elias.crum@ugent.be>
