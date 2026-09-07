#!/usr/bin/env python3
"""Assert that every statistic quoted in the SWAT4HCLS 2027 manuscript still
matches ``tests/coverage-report.json``.

The manuscript quotes concrete counts. This check fails if the artifacts move
and the prose does not, so a published figure cannot go stale unnoticed.
Run ``npm run coverage:report`` first; ``npm run validate`` does both.
"""
from __future__ import annotations

import json
import pathlib
import sys

ROOT = pathlib.Path(__file__).resolve().parent.parent
REPORT = ROOT / "tests" / "coverage-report.json"
PAPER = ROOT / "SWAT4HCLS_2027" / "main.tex"


def main() -> int:
    if not REPORT.exists():
        print("coverage-report.json missing; run: npm run coverage:report", file=sys.stderr)
        return 1
    report = json.loads(REPORT.read_text())
    tex = PAPER.read_text()

    cov = report["coverage"]
    voc = report["vocabulary"]["byKind"]
    ext = report["externalVocabularies"]
    keys = report["reservedKeys"]
    shapes = report["shaclProfiles"]
    portable = shapes["vcf-core-vocabulary.shacl.ttl"]

    expected: list[tuple[str, str]] = [
        ("construct total", str(cov["constructs"])),
        ("constructs fully covered", str(cov["full"])),
        ("full percentage", f"{cov['fullPercent']}\\%"),
        ("credited percentage", f"{cov['creditedPercent']}\\%"),
        ("declared terms", str(report["vocabulary"]["declaredTerms"])),
        ("classes", f"{voc['class']} classes"),
        ("object properties", f"{voc['objectProperty']} object properties"),
        ("datatype properties", f"{voc['datatypeProperty']} datatype properties"),
        ("named individuals", f"{voc['namedIndividual']} named individuals"),
        ("reserved declarations", f"{keys['vcf45']['total']} reserved key declarations"),
        ("reserved split", f"{keys['vcf45']['info']} INFO and {keys['vcf45']['format']} FORMAT"),
        ("portable node shapes", f"{portable['nodeShapes']} node shapes"),
        ("portable property shapes", f"{portable['propertyShapes']} property shapes"),
        ("sparql rules", f"{shapes['vcf-core-vocabulary-sparql.shacl.ttl']['sparqlConstraints']} cross-resource"),
        ("consistency rules", f"{shapes['vcf-core-consistency.shacl.ttl']['sparqlConstraints']} rules relating raw tokens"),
        ("validated fixtures", f"{report['validation']['fixtures']} fixtures"),
    ]
    for prefix, count in (("SO", "so"), ("ChEBI", "chebi"), ("VRS", "vrs"),
                          ("HERO-Genomics", "hero"), ("FALDO", "faldo"), ("GENO", "geno")):
        expected.append((f"{prefix} alignment count",
                         f"{prefix}~({ext['alignmentTargets']['byVocabulary'][count]})"))

    for area in cov["byArea"]:
        expected.append((f"table row: {area['area']}",
                         f"{area['constructs']} & {area['full']} & "))

    missing = [(label, text) for label, text in expected if text not in tex]
    if missing:
        print("Manuscript figures no longer match the generated report:", file=sys.stderr)
        for label, text in missing:
            print(f"  {label}: expected to find {text!r} in main.tex", file=sys.stderr)
        return 1
    print(f"Manuscript figures: {len(expected)} checked, all match tests/coverage-report.json.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
