#!/usr/bin/env python3
"""Recompute every coverage statistic reported for VCF Core.

Reads the normative ontology modules, the SHACL profiles, the per-version
reserved-key registries and the curated construct inventory in
``tests/vcf45-coverage-inventory.json``; writes ``tests/coverage-report.json``
and prints a summary.

The inventory records editorial verdicts. This script does not second-guess
them, but it does fail if any term the inventory cites has disappeared from the
ontology, so a published percentage cannot silently drift from the artifacts.

Usage:  npm run coverage:report   (or: python3 scripts/coverage-report.py)
"""
from __future__ import annotations

import glob
import json
import pathlib
import sys
from collections import Counter, defaultdict

from rdflib import Graph, RDF, RDFS, OWL, URIRef

ROOT = pathlib.Path(__file__).resolve().parent.parent
VCFC = "https://w3id.org/vcf-core/vocab#"
SH = "http://www.w3.org/ns/shacl#"
XSD = "http://www.w3.org/2001/XMLSchema#"
MODULES = ["vocabulary", "alleles", "genotypes", "sv", "reserved-keys"]

EXTERNAL = [
    ("faldo", "http://biohackathon.org/resource/faldo#"),
    ("so", "http://purl.obolibrary.org/obo/SO_"),
    ("geno", "http://purl.obolibrary.org/obo/GENO_"),
    ("chebi", "http://purl.obolibrary.org/obo/CHEBI_"),
    ("vrs", "https://w3id.org/ga4gh/schema/vrs/2.0/json/"),
    ("hero", "https://w3id.org/hereditary/ontology/genomics/schema/"),
    ("dcat", "http://www.w3.org/ns/dcat#"),
    ("prov", "http://www.w3.org/ns/prov#"),
    ("sio", "http://semanticscience.org/resource/SIO_"),
]
SKOS_MATCH = {
    "exactMatch", "closeMatch", "relatedMatch", "broadMatch", "narrowMatch",
}
STRUCTURAL = {RDFS.subClassOf, RDFS.subPropertyOf, RDFS.domain, RDFS.range,
              OWL.equivalentClass, OWL.equivalentProperty}


def external_prefix(term) -> str | None:
    text = str(term)
    for prefix, base in EXTERNAL:
        if text.startswith(base):
            return prefix
    return None


def load_ontology() -> tuple[Graph, dict[str, int]]:
    graph = Graph()
    per_module: dict[str, int] = {}
    for module in MODULES:
        part = Graph()
        part.parse(ROOT / "ontology" / f"vcf-core-{module}.ttl", format="turtle")
        per_module[module] = len(
            {s for s in part.subjects(RDF.type, None) if str(s).startswith(VCFC)}
        )
        graph += part
    return graph, per_module


def vocabulary_stats(graph: Graph, per_module: dict[str, int]) -> dict:
    terms = {s for s in graph.subjects(RDF.type, None) if str(s).startswith(VCFC)}
    kinds: Counter[str] = Counter()
    for term in terms:
        types = set(graph.objects(term, RDF.type))
        for node, label in (
            (OWL.Class, "class"),
            (OWL.ObjectProperty, "objectProperty"),
            (OWL.DatatypeProperty, "datatypeProperty"),
            (OWL.AnnotationProperty, "annotationProperty"),
            (RDFS.Datatype, "datatype"),
            (OWL.Ontology, "ontologyHeader"),
        ):
            if node in types:
                kinds[label] += 1
                break
        else:
            kinds["namedIndividual"] += 1
    return {"declaredTerms": len(terms), "byModule": per_module, "byKind": dict(kinds)}


def external_stats(graph: Graph) -> dict:
    structural: dict[str, set[str]] = defaultdict(set)
    alignment: dict[str, set[str]] = defaultdict(set)
    axioms: list[dict[str, str]] = []
    for subject, predicate, obj in graph:
        if not isinstance(obj, URIRef):
            continue
        prefix = external_prefix(obj)
        if prefix is None or str(obj).startswith(VCFC) or str(obj).startswith(XSD):
            continue
        if predicate in STRUCTURAL:
            structural[prefix].add(str(obj))
            axioms.append({
                "subject": str(subject).replace(VCFC, "vcfc:"),
                "predicate": str(predicate).rsplit("#", 1)[-1],
                "object": str(obj),
            })
        elif predicate == RDFS.seeAlso or str(predicate).rsplit("#", 1)[-1] in SKOS_MATCH:
            alignment[prefix].add(str(obj))
    return {
        "structuralReuse": {
            "distinctTerms": len({t for v in structural.values() for t in v}),
            "byVocabulary": {k: sorted(v) for k, v in sorted(structural.items())},
            "axioms": sorted(axioms, key=lambda a: (a["subject"], a["predicate"])),
        },
        "alignmentTargets": {
            "distinctTerms": len({t for v in alignment.values() for t in v}),
            "byVocabulary": {k: len(v) for k, v in sorted(alignment.items())},
        },
    }


def registry_stats(graph: Graph) -> dict:
    info = len(list(graph.subjects(RDF.type, URIRef(VCFC + "InfoFieldDefinition"))))
    fmt = len(list(graph.subjects(RDF.type, URIRef(VCFC + "FormatFieldDefinition"))))
    versions: dict[str, dict] = {}
    for path in sorted(glob.glob(str(ROOT / "ontology" / "versions" / "*-reserved.json"))):
        payload = json.loads(pathlib.Path(path).read_text())
        definitions = payload.get("definitions", [])
        kinds = Counter(d.get("kind", "?") for d in definitions)
        versions[f"VCFv{payload['version']}"] = {
            "entries": len(definitions),
            "byKind": dict(sorted(kinds.items())),
            "scope": payload.get("scope"),
            "source": payload.get("source"),
            "sha256": payload.get("sha256"),
        }
    versions["VCFv4.5"] = {
        "entries": info + fmt,
        "byKind": {"format": fmt, "info": info},
        "scope": "Reserved INFO/FORMAT tables and the structural-variant declaration sections",
        "source": "generated by scripts/generate-reserved-keys.mjs from the VCF 4.5 LaTeX source",
    }
    return {"vcf45": {"info": info, "format": fmt, "total": info + fmt}, "byVersion": versions}


def shacl_stats() -> dict:
    profiles: dict[str, dict] = {}
    for path in sorted(glob.glob(str(ROOT / "shacl" / "*.ttl"))):
        graph = Graph()
        graph.parse(path, format="turtle")
        profiles[pathlib.Path(path).name] = {
            "nodeShapes": len(set(graph.subjects(RDF.type, URIRef(SH + "NodeShape")))),
            "propertyShapes": len(list(graph.triples((None, URIRef(SH + "property"), None)))),
            "sparqlConstraints": len(list(graph.triples((None, URIRef(SH + "sparql"), None)))),
            "triples": len(graph),
        }
    return profiles


def coverage_stats(graph: Graph) -> tuple[dict, list[str]]:
    inventory = json.loads((ROOT / "tests" / "vcf45-coverage-inventory.json").read_text())
    declared = {str(s)[len(VCFC):] for s in graph.subjects(RDF.type, None) if str(s).startswith(VCFC)}

    missing: list[str] = []
    totals: Counter[str] = Counter()
    per_area = []
    for area in inventory["areas"]:
        counts: Counter[str] = Counter()
        for construct in area["constructs"]:
            counts[construct["verdict"]] += 1
            totals[construct["verdict"]] += 1
            for term in construct["terms"]:
                if term not in declared:
                    missing.append(f"construct {construct['id']} cites vcfc:{term}, which is not declared")
        per_area.append({
            "area": area["area"],
            "section": area["section"],
            "constructs": len(area["constructs"]),
            "full": counts["full"],
            "partial": counts["partial"],
            "absent": counts["absent"],
        })

    total = sum(totals.values())
    full, partial = totals["full"], totals["partial"]
    return {
        "inventory": "tests/vcf45-coverage-inventory.json",
        "constructs": total,
        "full": full,
        "partial": partial,
        "absent": totals["absent"],
        "fullPercent": round(100 * full / total, 1),
        "creditedPercent": round(100 * (full + 0.5 * partial) / total, 1),
        "byArea": per_area,
        "outOfScope": [item["item"] for item in inventory["out_of_scope"]],
    }, missing


def fixture_stats() -> dict:
    path = ROOT / "tests" / "validation-results.json"
    if not path.exists():
        return {"available": False}
    results = json.loads(path.read_text())
    return {
        "available": True,
        "fixtures": len(results),
        "passed": sum(1 for r in results if r["passed"]),
        "violations": sum(r["violations"] for r in results),
        "warnings": sum(r["warnings"] for r in results),
    }


def main() -> int:
    graph, per_module = load_ontology()
    coverage, missing = coverage_stats(graph)
    report = {
        "vocabulary": vocabulary_stats(graph, per_module),
        "externalVocabularies": external_stats(graph),
        "reservedKeys": registry_stats(graph),
        "shaclProfiles": shacl_stats(),
        "coverage": coverage,
        "validation": fixture_stats(),
    }
    (ROOT / "tests" / "coverage-report.json").write_text(json.dumps(report, indent=1) + "\n")

    voc = report["vocabulary"]
    print(f"Declared terms: {voc['declaredTerms']}  " + ", ".join(f"{k}={v}" for k, v in sorted(voc["byKind"].items())))
    print(f"Reserved keys (4.5): {report['reservedKeys']['vcf45']['total']} "
          f"(INFO {report['reservedKeys']['vcf45']['info']}, FORMAT {report['reservedKeys']['vcf45']['format']})")
    print("Per-version registries: " + ", ".join(
        f"{k}={v['entries']}" for k, v in sorted(report["reservedKeys"]["byVersion"].items())))
    ext = report["externalVocabularies"]
    print(f"External reuse: {ext['structuralReuse']['distinctTerms']} terms in axioms; "
          f"{ext['alignmentTargets']['distinctTerms']} alignment targets "
          f"({', '.join(f'{k} {v}' for k, v in ext['alignmentTargets']['byVocabulary'].items())})")
    print(f"Coverage: {coverage['full']}/{coverage['constructs']} full "
          f"({coverage['fullPercent']}%), {coverage['partial']} partial, {coverage['absent']} absent; "
          f"credited {coverage['creditedPercent']}%")
    for area in coverage["byArea"]:
        print(f"  {area['area']:42} {area['full']:3}/{area['constructs']:<3} full")
    val = report["validation"]
    if val["available"]:
        print(f"Validation fixtures: {val['passed']}/{val['fixtures']} passed, "
              f"{val['violations']} violations, {val['warnings']} warnings")

    if missing:
        print("\nFAILED: inventory cites terms that are not declared:", file=sys.stderr)
        for line in missing:
            print(f"  {line}", file=sys.stderr)
        return 1
    print("\nInventory term check: all cited terms are declared.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
