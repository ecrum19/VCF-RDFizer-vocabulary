# Repository Scripts

Scripts in this directory generate repository artifacts or extend the OCG build.
Validation and regression checks live in `tests/`.

- `build-ontology-bundle.mjs` combines the normative ontology modules for OCG.
- `build-shacl-profiles.py` generates version-specific SHACL overlays.
- `coverage-report.py` recomputes every published coverage statistic into `tests/coverage-report.json`.
- `validation-gate.py` fingerprints the normative inputs so the slow suite only reruns when they change.
- `convert-example-nt-to-ttl.mjs` formats the canonical N-Triples example as Turtle.
- `generate-reserved-keys.mjs` creates the VCF 4.5 reserved-key registry.
- `insert-class-hierarchy.mjs` adds the configured class-hierarchy extension after OCG builds the site.
- `migrate-namespace.mjs` provides the one-shot 1.1.0 namespace migration utility.
- `vcf_examples.py` materializes the generated example graphs from their VCF sources.

All commands are exposed through `package.json`; run them from the repository root
so relative source and output paths remain stable.
