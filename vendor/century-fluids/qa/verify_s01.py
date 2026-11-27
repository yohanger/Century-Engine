#!/usr/bin/env python3
"""Century Fluids S01 TypeScript QA: source, manifest, safe delta, build and tests.

Return: 0=PASS; 1=FAIL; 2=toolchain missing. No simulation claims.
Historical Rust runner is preserved in the earlier Rust SOURCE_BASELINE.
"""
from __future__ import annotations

import argparse
import hashlib
import json
from pathlib import Path, PurePosixPath
import shutil
import subprocess
import sys
import zipfile

BASE='CENTURY_FLUIDS/'
REQUIRED={
 'README.md', 'package.json','package-lock.json','tsconfig.json',
 'src/index.ts','src/config.ts','src/error.ts','src/math.ts','src/world.ts',
 'tests/public_api.test.mjs',
 'docs/09_CF_CA_002_TYPESCRIPT_REPLACEMENT.md',
 'docs/10_TYPESCRIPT_API_S01.md',
 'qa/S01_TYPESCRIPT_RUN.log','qa/S01_TYPESCRIPT_REVIEW.md',
 'qa/S01_RUST_SUPERSESSION.md','qa/MANIFEST.sha256',
 'ledger/CENTURY_FLUIDS_LEDGER.xlsx',
}
EXCLUDED={'dist','node_modules','build','target','coverage','__pycache__','.git','.pytest_cache','.local'}
OLD=['Cargo.toml','src/config.rs','src/error.rs','src/lib.rs','src/math.rs','src/world.rs','tests/errors.rs','tests/public_api.rs']
EXPECTED_SHEETS={'ROADMAP','BACKLOG','DEPENDENCIES','GATES','EVIDENCE','TRACEABILITY'}


def sha(data:bytes)->str:
    return hashlib.sha256(data).hexdigest()


def check(condition:bool, message:str)->None:
    if not condition:
        raise ValueError(message)


def load_zip(path:Path, *, project:bool)->dict[str,bytes]:
    with zipfile.ZipFile(path) as z:
        check(z.testzip() is None, f'bad archive CRC: {path}')
        contents={}
        for name in z.namelist():
            if name.endswith('/'): continue
            raw=PurePosixPath(name)
            check(not raw.is_absolute() and '..' not in raw.parts,f'unsafe archive member: {name}')
            if project:
                check(name.startswith(BASE),f'unexpected project archive member: {name}')
                rel=name[len(BASE):]
            else:
                rel=name
            check(rel not in contents, f'duplicate archive member: {rel}')
            contents[rel]=z.read(name)
        return contents


def local_files(root:Path)->dict[str,bytes]:
    actual={}
    for f in root.rglob('*'):
        if not f.is_file(): continue
        rel=f.relative_to(root)
        if any(x in EXCLUDED for x in rel.parts):
            continue  # generated or locally installed; excluded from archives and manifest
        check(not f.is_symlink(),f'symlinks are not packaged: {rel}')
        actual[rel.as_posix()]=f.read_bytes()
    return actual


def check_manifest(files:dict[str,bytes])->None:
    lines=files['qa/MANIFEST.sha256'].decode('utf8').splitlines()
    expected={}
    for line in lines:
        if not line.strip():continue
        digest,sep,rel=line.partition('  ')
        check(sep and len(digest)==64 and rel not in expected,f'bad manifest: {line}')
        expected[rel]=digest
    need=set(files)-{'qa/MANIFEST.sha256'}
    check(set(expected)==need,f'manifest mismatch: {sorted(set(expected)^need)}')
    for rel in need:
        check(expected[rel]==sha(files[rel]),f'bad SHA256: {rel}')


def check_ledger(root:Path)->None:
    import xml.etree.ElementTree as ET
    p=root/'ledger/CENTURY_FLUIDS_LEDGER.xlsx'
    with zipfile.ZipFile(p) as z:
        check(z.testzip() is None,'corrupted ledger XLSX')
        ns={'x':'http://schemas.openxmlformats.org/spreadsheetml/2006/main'}
        tree=ET.fromstring(z.read('xl/workbook.xml'))
        sheets=[item.attrib['name'] for item in tree.findall('x:sheets/x:sheet',ns)]
        check(set(sheets)==EXPECTED_SHEETS and len(sheets)==6,f'ledger tabs {sheets}')
        shared=[]
        if 'xl/sharedStrings.xml' in z.namelist():
            st=ET.fromstring(z.read('xl/sharedStrings.xml'))
            shared=[''.join((t.text or '') for t in s.findall('.//x:t',ns)) for s in st.findall('x:si',ns)]
        def values(sheet_name:str):
            index=sheets.index(sheet_name)+1
            sh=ET.fromstring(z.read(f'xl/worksheets/sheet{index}.xml'))
            cells={c.attrib['r']:c for c in sh.findall('.//x:sheetData/x:row/x:c',ns)}
            def cv(addr:str):
                c=cells.get(addr)
                if c is None:return ''
                if c.attrib.get('t')=='inlineStr':
                    return ''.join((t.text or '') for t in c.findall('.//x:t',ns))
                v=c.find('x:v',ns)
                if v is None:return ''
                return shared[int(v.text)] if c.attrib.get('t')=='s' else v.text
            return cv
        roadmap=values('ROADMAP')
        ids=[roadmap(f'A{row}') for row in range(5,16)]
        check(ids==[f'S{i:02d}' for i in range(11)],f'roadmap sprints: {ids}')
        gates=values('GATES')
        gate_names=[gates(f'A{row}') for row in range(5,16)]
        check(len(gate_names)==11 and len(set(gate_names))==11 and all('-G001-' in g for g in gate_names), 'not exactly 11 main G001 gates')
        check(gate_names[1]=='CENTURY-FLUIDS-S01-G001-INTEGRAL-TYPESCRIPT-CORE-AND-API','S01 TypeScript gate missing')
        check('RUST' not in gate_names[1] and 'S08'==gates('B13'),'S01/S08 gate mismatch')


def archive_check(args,files):
    if not any((args.previous_baseline,args.baseline,args.change)):
        return
    check(all((args.previous_baseline,args.baseline,args.change)), 'provide all three zip arguments')
    old=load_zip(args.previous_baseline,project=True)
    baseline=load_zip(args.baseline,project=True)
    change=load_zip(args.change,project=False)
    check(baseline==files,'SOURCE_BASELINE differs from workspace')
    removals=change.pop('CHANGE_REMOVALS.json',None)
    check(removals is not None,'CHANGE missing safe removal manifest')
    spec=json.loads(removals)
    check(spec.get('schema')=='century-fluids/incremental-removals/v1','wrong removal schema')
    check(spec.get('previous_baseline_sha256')==sha(args.previous_baseline.read_bytes()),'wrong old baseline hash')
    expected_removed=set(old)-set(files)
    listed={x['path'][len(BASE):]:x['old_sha256'] for x in spec['paths']}
    check(set(listed)==expected_removed,f'removal set mismatch: {sorted(set(listed)^expected_removed)}')
    for rel,digest in listed.items():check(sha(old[rel])==digest,f'unsafe remove hash: {rel}')
    expected_changed={BASE+rel:data for rel,data in files.items() if old.get(rel)!=data}
    check(change==expected_changed,
        f'CHANGE mismatch: {sorted(set(change)^set(expected_changed))}')
    print(f'S01_TYPESCRIPT_ARCHIVE_DELTA_PASS changed={len(change)} removed={len(expected_removed)}')


def main()->int:
    parser=argparse.ArgumentParser()
    parser.add_argument('--project',type=Path,default=Path(__file__).resolve().parents[1])
    parser.add_argument('--static-only',action='store_true')
    parser.add_argument('--previous-baseline',type=Path)
    parser.add_argument('--baseline',type=Path)
    parser.add_argument('--change',type=Path)
    args=parser.parse_args()
    root=args.project.resolve()
    check(root.name=='CENTURY_FLUIDS',f'wrong project root: {root.name}')
    files=local_files(root)
    check(REQUIRED <= set(files),f'missing {sorted(REQUIRED-set(files))}')
    check(not any(x in files for x in OLD),'legacy Rust sources still active')
    check(not any(x.endswith('.rs') for x in files),'Rust sources still active')
    check_manifest(files)
    check_ledger(root)
    config=json.loads(files['package.json'])
    lock=json.loads(files['package-lock.json'])
    check(config['name']=='@century/fluids' and config['private'] and config['type']=='module', 'bad package settings')
    check('jolt-physics' not in config.get('dependencies',{}) and 'three' not in config.get('dependencies',{}),'core depends on host')
    check(lock['packages']['']['devDependencies']==config['devDependencies'], 'lock devDependencies mismatched')
    archive_check(args,files)
    print(f'S01_TYPESCRIPT_STATIC_PASS files={len(files)} sheets=6 sprints=11 gates=11')
    if args.static_only:
        print('STATIC ONLY; TypeScript compilation/test NOT RUN BY THIS INVOCATION')
        return 0
    if not all(shutil.which(x) for x in ('node','npm','tsc')):
        print('S01_TYPESCRIPT_TOOLCHAIN_BLOCKED: requires node/npm/tsc',file=sys.stderr)
        return 2
    print('RUN npm run qa',flush=True)
    proc=subprocess.run(['npm','run','qa'],cwd=root,check=False)
    if proc.returncode:
        print(f'S01_TYPESCRIPT_QA_FAIL exit={proc.returncode}',file=sys.stderr)
        return 1
    print('S01_TYPESCRIPT_QA_PASS: typecheck, build, Node tests')
    return 0

if __name__=='__main__':
    try:
        sys.exit(main())
    except (OSError,ValueError,KeyError,zipfile.BadZipFile,json.JSONDecodeError) as error:
        print(f'S01_TYPESCRIPT_QA_FAIL: {error}',file=sys.stderr)
        sys.exit(1)
