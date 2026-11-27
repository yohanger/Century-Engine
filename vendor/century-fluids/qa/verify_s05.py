#!/usr/bin/env python3
"""S05 source + Node/TypeScript distribution QA. Browser parity: interactive Vite QA.

No local folder naming assumptions; no writes outside build/test-generated outputs.
"""
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

GATE='CENTURY-FLUIDS-S05-G001-INTEGRAL-TYPESCRIPT-DISTRIBUTION-AND-INTEROPERABILITY'
REQUIRED={
    'package.json','package-lock.json','tsconfig.json','src/index.ts',
    'docs/14_TYPESCRIPT_DISTRIBUTION_S05.md','tests/interoperability.test.mjs',
    'tests/verify_distribution.mjs','tests/browser_discovery.mjs','tests/browser_discovery.test.mjs',
    'tests/run_vite_qa.mjs','tests/vite_browser_qa.test.mjs','tests/browser-vite/index.html',
    'tests/browser-vite/main.mjs','tests/browser-vite/probe.mjs',
    'tests/browser-vite/verify.mjs','tests/browser-vite/style.css',
    'qa/S04_LOCAL_USER_QA.md','qa/S05_REVIEW.md',
    'qa/S05_RUN.log','qa/verify_s05.py','qa/MANIFEST.sha256',
    'ledger/CENTURY_FLUIDS_LEDGER.xlsx'
}

def check(condition:bool,message:str)->None:
    if not condition: raise ValueError(message)

def gate_cell(root:Path)->str:
    import xml.etree.ElementTree as ET
    with zipfile.ZipFile(root/'ledger/CENTURY_FLUIDS_LEDGER.xlsx') as z:
        ns={'x':'http://schemas.openxmlformats.org/spreadsheetml/2006/main'}
        sheet=ET.fromstring(z.read('xl/worksheets/sheet4.xml'))
        shared=[]
        if 'xl/sharedStrings.xml' in z.namelist():
            rootxml=ET.fromstring(z.read('xl/sharedStrings.xml'))
            shared=[''.join((e.text or '') for e in si.findall('.//x:t',ns)) for si in rootxml.findall('x:si',ns)]
        for c in sheet.findall('.//x:sheetData/x:row/x:c',ns):
            if c.get('r')!='A10': continue
            if c.get('t')=='inlineStr':return ''.join((e.text or '') for e in c.findall('.//x:t',ns))
            v=c.find('x:v',ns)
            return '' if v is None else (shared[int(v.text)] if c.get('t')=='s' else v.text or '')
    return ''

def main()->int:
    p=argparse.ArgumentParser()
    p.add_argument('--project',type=Path,default=Path(__file__).resolve().parents[1])
    p.add_argument('--static-only',action='store_true')
    p.add_argument('--browser',action='store_true',help='prepare manual Vite browser QA; does not imply browser PASS')
    p.add_argument('--previous-baseline',type=Path)
    p.add_argument('--baseline',type=Path)
    p.add_argument('--change',type=Path)
    args=p.parse_args();root=args.project.resolve()
    files=local_files(root)
    check(REQUIRED<=set(files),f'missing S05 files: {sorted(REQUIRED-set(files))}')
    check_manifest(files)
    check_ledger(root)
    check(gate_cell(root)==GATE,f'S05 ledger gate mismatch: {gate_cell(root)}')
    package=json.loads(files['package.json']);lock=json.loads(files['package-lock.json'])
    check(package['name']=='@century/fluids' and package['private'] is True,'unexpected registry publishing configuration')
    check(package['type']=='module' and not package.get('dependencies'),'core has host/runtime dependencies')
    check(package['license']=='UNLICENSED','unapproved package license mutation')
    check(package['files']==['dist'] and package['exports']['.']['types']=='./dist/index.d.ts','dist/exports contract mismatch')
    check(package['scripts']['prepack']=='npm run build','prepack must compile before packaging')
    check('tests/run_vite_qa.mjs' in files,'Vite QA helper missing')
    check('playground' in package['scripts'],'interactive playground entrypoint missing')
    check(lock['packages']['']['devDependencies']==package['devDependencies'],'package lock mismatched')
    for name in ('src/index.ts','src/world.ts','src/liquid.ts','src/contacts.ts'):
        check(not any(x in files[name].decode().lower() for x in ('from \'jolt','from \'three','from \'@century/')),f'host dependency {name}')
    if any((args.previous_baseline,args.baseline,args.change)):
        check(all((args.previous_baseline,args.baseline,args.change)),'supply all ZIPs')
        check_delta(args.previous_baseline,args.baseline,args.change,files)
    print(f'S05_STATIC_PASS files={len(files)} sheets=6 sprints=11 gates=11 project={root.name}',flush=True)
    if args.static_only:return 0
    # npm scripts resolve the project-local TypeScript executable in node_modules/.bin.
    # Requiring a global `tsc` rejects valid clean installs (`npm ci`).
    check(all(shutil.which(x) for x in ('node','npm')),'S05_TOOLCHAIN_BLOCKED: node/npm needed')
    commands=[['npm','run','qa'],['node','tests/verify_distribution.mjs'],
        ['node','tests/benchmark_particles.mjs'],['node','tests/benchmark_liquid.mjs'],
        ['node','tests/benchmark_boundaries.mjs']]
    for cmd in commands:
        check(subprocess.run(cmd,cwd=root,check=False).returncode==0,f'QA failed: {cmd}')
    if args.browser:
        check(subprocess.run(['node','tests/run_vite_qa.mjs','--prepare-only'],cwd=root,check=False).returncode==0,'Vite consumer preparation failed')
        print('S05_BROWSER_MANUAL_REQUIRED: ejecuta node tests/run_vite_qa.mjs; abre http://127.0.0.1:5173 en Brave, comprueba PASS/FAIL y aporta evidencia.',flush=True)
        return 2
    else:
        print('S05_CORE_QA_PASS browser=NOT_VERIFIED: strict + Node tests + packed JS/TS consumer + prior benchmarks',flush=True)
    return 0

if __name__=='__main__':
    try: sys.exit(main())
    except (OSError,KeyError,ValueError,zipfile.BadZipFile,json.JSONDecodeError) as err:
        print(f'S05_QA_FAIL: {err}',file=sys.stderr);sys.exit(1)
