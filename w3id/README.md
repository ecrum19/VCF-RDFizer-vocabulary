# w3id.org configuration

Two directories to contribute to [perma-id/w3id.org](https://github.com/perma-id/w3id.org) in **one**
pull request:

| Directory | Path on w3id.org | Purpose |
| --- | --- | --- |
| `w3id/vcf-core/` | `https://w3id.org/vcf-core/` | New. Serves the VCF Core Vocabulary, VCF 4.5 modules, SHACL profiles, and companion documentation. |
| `w3id/vcf-rdfizer/` | `https://w3id.org/vcf-rdfizer/` | Replaces the existing directory. Serves the legacy deprecation document for the retired namespace. |

## Before opening the pull request

1. The `vcf-core/.htaccess` rules point to the current companion site at
   `https://ecrum19.github.io/vcf-core-vocabulary`. If the site moves, update that host in the file
   before opening the W3ID pull request.
2. In the upstream `perma-id/w3id.org` repository, place these directories under `ids/`:
   `ids/vcf-core/` and `ids/vcf-rdfizer/`. This repository keeps them under `w3id/` as a staging area.
3. **Confirm the host actually serves the referenced files.** The rules point at
   `assets/vcf-core-vocabulary.bundle.ttl`, four VCF 4.5 module Turtle files, the SHACL profile files, and
   `assets/legacy-vcf-rdfizer.ttl`. The OCG
   build copies configured artifacts into `site/assets/`; keep every module and profile registered in
   `ocg.config.json` before publishing.
4. **Test against a local checkout**, as the W3ID maintainers ask.
5. **Squash to one commit** and put the project name in the PR message. Merged changes go live
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
