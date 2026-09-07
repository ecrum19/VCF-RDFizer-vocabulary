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
- `vcf45-coverage-inventory.json` is the auditable construct inventory behind the published coverage figures.
- `coverage-report.json` is generated from it; `check_paper_figures.py` asserts the manuscript still quotes it correctly.
- `.validation-stamp.json` records the fingerprint of the last full run (see the gate section below).

Run the supported entry points from the repository root:

```sh
npm run validate           # fast checks always; slow suite only if normative inputs changed
npm run validate:force     # unconditional full run, then refresh the stamp
npm run validate:regressions
npm run validate:examples
```

## Why `npm run validate` is usually fast

The SHACL suite takes about 190 seconds and the regression probes another 21, but
most commits touch the manuscript or documentation rather than the vocabulary.
`scripts/validation-gate.py` fingerprints the normative inputs — ontology modules,
SHACL profiles, per-version registries, examples, mappings, validation code and the
declared version — into `tests/.validation-stamp.json`. When that fingerprint is
unchanged, `npm run validate` runs only the fast lane (RDF parse, coverage report,
paper-figure check, examples, paper evidence: about three seconds) and skips the rest.

Changing any normative file, or bumping the version in `package.json`, makes the gate
require a full run. `npm run validate:gate:status` shows what it thinks changed. The
manuscript is deliberately outside the fingerprint, so editing prose never costs three
minutes; the paper-figure check that guards its statistics is in the fast lane.

**Commit the stamp.** CI does not trust it — pull-request validation is scoped by path
filters and always runs `validate:force` — but it does fail the build if the stamp you
committed is out of date.
