#!/usr/bin/env python3
"""Runner documental S00-G001 (stdlib); NO es un runner de físicas ni de compilación."""
from __future__ import annotations
import argparse
import hashlib
import json
from pathlib import Path
import sys
import zipfile
import xml.etree.ElementTree as ET

EXPECTED_DIRS = {'src', 'tests', 'qa', 'docs', 'ledger'}
SHEETS = {'ROADMAP', 'BACKLOG', 'DEPENDENCIES', 'GATES', 'EVIDENCE', 'TRACEABILITY'}
DOCS = {'00_AUTHORITY_AND_SCOPE.md','01_ARCHITECTURE_CONTRACT.md','02_PHYSICS_AND_NUMERICS.md',
        '03_JOLT_WASM_CONTRACT.md','04_ROADMAP_11_SPRINTS.md','05_RELEASE_AND_QA_CONTRACT.md',
        '06_SOURCE_AUDIT.md','07_REFERENCES.md'}
N = {'x': 'http://schemas.openxmlformats.org/spreadsheetml/2006/main'}
FORBIDDEN = ('/target/', '/node_modules/', '/build/', '/.git/', '/__pycache__/', '/.venv/')

def sha256(path):
    return hashlib.sha256(Path(path).read_bytes()).hexdigest()

def check(condition, text):
    if not condition:
        raise ValueError(text)

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--project', type=Path, default=Path(__file__).resolve().parents[1])
    parser.add_argument('--baseline', type=Path)
    parser.add_argument('--change', type=Path)
    parser.add_argument('--previous-baseline', type=Path, help='Baseline anterior para comprobar CHANGE incremental real')
    args=parser.parse_args()
    root=args.project.resolve()
    check(root.name == 'CENTURY_FLUIDS', f'root inesperada: {root}')
    dirs={p.name for p in root.iterdir() if p.is_dir()}
    check(dirs == EXPECTED_DIRS, f'carpetas no esperadas: {dirs ^ EXPECTED_DIRS}')
    check(not list((root/'src').rglob('*')),'src debe permanecer vacío en S00')
    check(not list((root/'tests').rglob('*')),'tests debe permanecer vacío en S00')
    check((root/'README.md').is_file(),'README falta')
    actual_docs={p.name for p in (root/'docs').glob('*.md')}
    check(actual_docs == DOCS,'documentos esperados distintos')
    xlsx=root/'ledger'/'CENTURY_FLUIDS_LEDGER.xlsx'
    check(xlsx.exists(),'ledger no existe')
    with zipfile.ZipFile(xlsx) as z:
        check(z.testzip() is None,'XLSX corrupto')
        tree=ET.fromstring(z.read('xl/workbook.xml'))
        names=[x.attrib['name'] for x in tree.findall('x:sheets/x:sheet',N)]
        check(set(names)==SHEETS and len(names)==6,'pestañas incorrectas: '+str(names))
        check(all(f'xl/worksheets/sheet{i}.xml' in z.namelist() for i in range(1,7)),'hojas ausentes')
        # ROADMAP is sheet 1, and sprint ids occupy A5:A15.
        sh=ET.fromstring(z.read('xl/worksheets/sheet1.xml'))
        cells={c.attrib.get('r'):c for c in sh.findall('.//x:sheetData/x:row/x:c',N)}
        shared=[]
        if 'xl/sharedStrings.xml' in z.namelist():
            st=ET.fromstring(z.read('xl/sharedStrings.xml'))
            for si in st.findall('x:si',N):
                shared.append(''.join((t.text or '') for t in si.findall('.//x:t',N)))
        def val(cell):
            if cell.attrib.get('t')=='inlineStr':
                return ''.join((t.text or '') for t in cell.findall('.//x:t',N))
            v=cell.find('x:v',N)
            if v is None: return ''
            return shared[int(v.text)] if cell.attrib.get('t')=='s' else v.text
        ids=[val(cells[f'A{row}']) for row in range(5,16)]
        check(ids == [f'S{i:02d}' for i in range(11)],'sprints incorrectos '+str(ids))
        check(len(set(ids))==11,'sprints duplicados')
        names_gates=[val(cells[f'D{row}']) for row in range(5,16)]
        check(len(set(names_gates))==11 and all('-G001-' in n for n in names_gates),'no hay 11 Gates G001 únicos')
    manifest = root/'qa'/'MANIFEST.sha256'
    check(manifest.exists(),'manifest ausente')
    for line in manifest.read_text(encoding='utf-8').splitlines():
        if not line.strip(): continue
        expected,relative=line.split('  ',1)
        p=root/relative
        check(p.is_file(),f'manifest falta {relative}')
        check(sha256(p)==expected,f'hash inválido {relative}')
    files=[p for p in root.rglob('*') if p.is_file()]
    check(not any(any(piece in '/'+str(p.relative_to(root)).replace('\\','/')+'/' for piece in FORBIDDEN) for p in files), 'build/cachés detectados')
    previous_content = None
    if args.previous_baseline:
        with zipfile.ZipFile(args.previous_baseline) as z:
            check(z.testzip() is None,'SOURCE_BASELINE anterior corrupto')
            previous_content = {n: z.read(n) for n in z.namelist() if not n.endswith('/')}
    for label,archive in [('baseline',args.baseline),('change',args.change)]:
        if not archive: continue
        check(archive.exists(),f'ZIP no encontrado: {archive}')
        with zipfile.ZipFile(archive) as z:
            check(z.testzip() is None,f'{label} ZIP corrupto')
            stored={n for n in z.namelist() if not n.endswith('/')}
            actual={f'CENTURY_FLUIDS/{p.relative_to(root).as_posix()}' for p in files}
            if label=='baseline':
                check(stored==actual,'baseline difiere de la estructura completa')
            else:
                if previous_content is None:
                    check(stored == actual,'Sin baseline anterior, CHANGE debe contener todos los archivos')
                else:
                    check(previous_content.keys() <= actual, 'Se eliminaron archivos del baseline previo')
                    changed = {name for name in actual if name not in previous_content
                        or (root/name.split('/',1)[1]).read_bytes() != previous_content[name]}
                    check(stored == changed,
                          f'CHANGE no corresponde al delta: faltan {sorted(changed-stored)}, sobran {sorted(stored-changed)}')
            for item in stored:
                check(hashlib.sha256(z.read(item)).hexdigest()==sha256(root/item.split('/',1)[1]), f'{label}: bytes distintos {item}')
    result={'status':'PASS','project':str(root),'folders':5,'files':len(files),'docs':len(actual_docs),
            'worksheets':names,'sprints':ids,'gates':len(names_gates),'zip_baseline_checked':bool(args.baseline),
            'zip_change_checked':bool(args.change),'previous_baseline_checked':bool(args.previous_baseline),'scope':'DOCUMENTAL - AUDITORÍA ESTÁTICA; NO SIMULACIÓN'}
    print(json.dumps(result,ensure_ascii=False,indent=2))

if __name__=='__main__':
    try: main()
    except Exception as ex:
        print(f'S00_QA_FAIL: {type(ex).__name__}: {ex}',file=sys.stderr)
        raise SystemExit(1)
