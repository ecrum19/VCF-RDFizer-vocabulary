# Validation Tests

This directory contains executable validation code and its small negative/edge-case
fixtures. It is intentionally separate from `scripts/`, which contains generators,
build steps and publication helpers.

- `test_validation.py` contains focused SHACL regression probes.
- `validate_shacl.py` runs the complete SHACL and semantic validation suite.
- `check_examples.py` reconstructs logical VCF lines and executes the example queries.
- `verify-vcf45-implementation.mjs` performs fast RDF parsing and VCF 4.5 registry checks.
- `semantic_validation.py` contains the decoded-value checks used by the SHACL runner.
- `shacl/` contains negative and generic validation fixtures.
- `validation-results.json` records the latest machine-readable complete-suite summary.

Run the supported entry points from the repository root:

```sh
npm run validate
npm run validate:regressions
npm run validate:examples
```
