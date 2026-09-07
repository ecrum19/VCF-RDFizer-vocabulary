#!/usr/bin/env python3
"""Independently reconstruct fixture VCF lines from RDF and execute example queries."""
from pathlib import Path
import json
from rdflib import Graph, Namespace, Literal
from rdflib.namespace import RDF,OWL
ROOT=Path(__file__).resolve().parent.parent
V=Namespace('https://w3id.org/vcf-core/vocab#')


def reconstruct(g):
    def val(s,p,default='.'):
        value=g.value(s,V[p]);return str(value) if value is not None else default
    def order(s,p,key):return sorted(g.objects(s,V[p]),key=lambda n:int(val(n,key,'0')))
    def field(n):
        d=g.value(n,V.declaredBy);key=val(d,'fieldId');typ=val(d,'fieldType')
        if typ==str(V.FlagType):return key,None
        for prop in ('fieldValue','fieldValueInteger','fieldValueDecimal'):
            raw=g.value(n,V[prop])
            if raw is not None:return key,str(raw)
        raise AssertionError('No value on '+str(n))
    f=next(g.subjects(RDF.type,V.VCFFile));h=g.value(f,V.hasHeader);samples=order(g.value(f,V.hasSampleSet),'hasSample','sampleIndex')
    lines=['##'+val(n,'headerKey')+'='+val(n,'headerValue') for n in order(h,'hasHeaderLine','lineIndex')]
    lines.append('\t'.join(['#CHROM','POS','ID','REF','ALT','QUAL','FILTER','INFO']+(['FORMAT']+[val(s,'sampleName') for s in samples] if samples else [])))
    for record in order(f,'hasRecord','recordIndex'):
        call=g.value(record,V.hasCall)
        info=[key if raw is None else key+'='+raw for key,raw in (field(n) for n in order(call,'hasInfoValue','fieldIndex'))]
        cols=[val(record,p) for p in ('chrom','pos','recordId','ref','alt')]+[val(call,'qual'),val(call,'filter'),';'.join(info) or '.']
        if samples:
            fmt=val(call,'formatRaw');keys=fmt.split(':');cols.append(fmt)
            calls={g.value(s,V.forSample):s for s in g.objects(call,V.hasSampleCall)}
            matrix=g.value(call,V.hasCallMatrix)
            if matrix:
                vectors={val(g.value(n,V.declaredBy),'fieldId'):val(n,'encodedValues').split('\t') for n in g.objects(matrix,V.hasFormatValueVector)}
                cols.extend(':'.join(vectors[key][i] for key in keys) for i in range(len(samples)))
            else:
                for sample in samples:
                    values=dict(field(n) for n in g.objects(calls[sample],V.hasFormatValue))
                    last=max((i for i,k in enumerate(keys) if k in values),default=-1)
                    cols.append(':'.join(values.get(key,'.') for key in keys[:last+1]))
        lines.append('\t'.join(cols))
    return lines


def main():
    manifest=json.loads((ROOT/'examples/manifest.json').read_text());total=0
    ontology=Graph().parse(ROOT/'ontology/vcf-core-vocabulary.bundle.ttl')
    for fixture in manifest['fixtures']:
        source=(ROOT/fixture['vcf']).read_text().splitlines()
        for rdf in fixture['rdf']:
            g=Graph().parse(ROOT/rdf,format='nt' if rdf.endswith('.nt') else 'turtle')
            for subject,predicate,value in g:
                terms=[predicate]+([value] if predicate==RDF.type else [])
                for term in terms:
                    if str(term).startswith(str(V)):
                        assert any(ontology.triples((term,None,None))),f'{rdf}: undeclared term {term}'
                if (predicate,RDF.type,OWL.ObjectProperty) in ontology:
                    assert not isinstance(value,Literal),f'{rdf}: literal object of {predicate}'
                if (predicate,RDF.type,OWL.DatatypeProperty) in ontology:
                    assert isinstance(value,Literal),f'{rdf}: resource object of {predicate}'
            actual=reconstruct(g)
            assert actual==source, f'{rdf}: source reconstruction differs: '+str(next(((i,a,b) for i,(a,b) in enumerate(zip(actual,source),1) if a!=b),(len(actual),len(source))))
            total+=1
    for check in manifest['queries']:
        g=Graph().parse(ROOT/check['rdf']);rows=[[str(x) for x in row] for row in g.query((ROOT/check['query']).read_text())]
        assert rows==check['expected'],f'{check["query"]}: expected {check["expected"]}, got {rows}'
    print(f'{total} RDF/source pairs reconstruct exactly as logical VCF lines; {len(manifest["queries"])} queries return expected answers.')
if __name__=='__main__':main()
