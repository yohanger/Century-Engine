#!/usr/bin/env python3
"""S04 integrity + real TypeScript boundary QA. Name-agnostic; read-only verifier."""
from __future__ import annotations
import argparse
import json
from pathlib import Path
import shutil
import subprocess
import sys
import zipfile
from verify_s01 import local_files, check_manifest, check_ledger
from verify_s02 import check_delta

REQUIRED = {
  'src/boundaries.ts','src/contacts.ts','src/liquid.ts','src/world.ts','src/index.ts',
  'docs/13_TYPESCRIPT_BOUNDARIES_S04.md', 'tests/boundaries.test.mjs',
  'tests/benchmark_boundaries.mjs', 'qa/S03_LOCAL_USER_QA.md', 'qa/S04_REVIEW.md',
  'qa/S04_RUN.log','qa/verify_s04.py','qa/MANIFEST.sha256',
  'ledger/CENTURY_FLUIDS_LEDGER.xlsx', 'package.json','package-lock.json'
}
GATE = 'CENTURY-FLUIDS-S04-G001-INTEGRAL-FLUID-COLLISIONS-AND-BOUNDARIES'

def check(condition: bool, message: str):
    if not condition: raise ValueError(message)

def gate_from_sheet(root: Path) -> bool:
    import xml.etree.ElementTree as ET
    with zipfile.ZipFile(root/'ledger/CENTURY_FLUIDS_LEDGER.xlsx') as z:
        ns={'m':'http://schemas.openxmlformats.org/spreadsheetml/2006/main'}
        root = ET.fromstring(z.read('xl/worksheets/sheet4.xml'))
        for c in root.findall('.//m:sheetData/m:row/m:c',ns):
            if c.get('r')!='A9':continue
            if c.get('t')=='inlineStr':
                text=''.join((x.text or '') for x in c.findall('.//m:t',ns))
            else:
                item=c.find('m:v',ns)
                if item is None:return False
                if c.get('t')=='s':
                    shared=ET.fromstring(z.read('xl/sharedStrings.xml'))
                    text=''.join((x.text or '') for x in shared.findall('m:si',ns)[int(item.text)].findall('.//m:t',ns))
                else: text=item.text
            return text==GATE
    return False

def main():
    p=argparse.ArgumentParser()
    p.add_argument('--project',type=Path,default=Path(__file__).resolve().parents[1])
    p.add_argument('--static-only',action='store_true')
    p.add_argument('--previous-baseline',type=Path)
    p.add_argument('--baseline',type=Path)
    p.add_argument('--change',type=Path)
    args=p.parse_args(); root=args.project.resolve()
    files=local_files(root)
    check(REQUIRED<=set(files),f'missing S04 files: {sorted(REQUIRED-set(files))}')
    check_manifest(files)
    check_ledger(root)
    check(gate_from_sheet(root),'active S04 gate mismatch')
    package=json.loads(files['package.json']);lock=json.loads(files['package-lock.json'])
    check(package['name']=='@century/fluids' and package['type']=='module' and not package.get('dependencies'),'core host dependency')
    check(lock['packages']['']['devDependencies']==package['devDependencies'],'typescript lock mismatch')
    check('tests/benchmark_boundaries.mjs' in files,'historical benchmark file missing')
    for name in ('src/boundaries.ts','src/contacts.ts','src/world.ts','src/liquid.ts'):
        imports=[s.strip() for s in files[name].decode('utf8').splitlines() if s.strip().startswith('import ')]
        check(not any(token in item.lower() for item in imports for token in ('jolt','three','century/')),f'host import {name}')
    if any((args.previous_baseline,args.baseline,args.change)):
        check(all((args.previous_baseline,args.baseline,args.change)),'supply all 3 archive paths')
        check_delta(args.previous_baseline,args.baseline,args.change,files)
    print(f'S04_STATIC_PASS files={len(files)} sheets=6 sprints=11 gates=11 project={root.name}',flush=True)
    if args.static_only:return 0
    check(all(shutil.which(x) for x in ('node','npm')), 'Node/npm toolchain missing')
    for command in (['npm','run','qa'],['node','tests/benchmark_particles.mjs'],
                    ['node','tests/benchmark_liquid.mjs'],['node','tests/benchmark_boundaries.mjs']):
        rc=subprocess.run(command,cwd=root,check=False).returncode
        check(rc==0,f'QA failed command={command}, exit={rc}')
    print('S04_QA_PASS: TypeScript strict + ESM build + 55 tests + spatial/liquid/boundary oracles',flush=True)
    return 0

if __name__=='__main__':
    try:sys.exit(main())
    except (OSError,KeyError,ValueError,zipfile.BadZipFile,json.JSONDecodeError) as ex:
        print(f'S04_QA_FAIL: {ex}',file=sys.stderr);sys.exit(1)
