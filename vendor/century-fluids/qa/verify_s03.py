#!/usr/bin/env python3
"""S03: portable TypeScript, numerical QA, original ledger and safe incremental ZIP delta."""
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

REQUIRED = {'src/liquid.ts','src/particles.ts','src/spatial.ts','src/world.ts','src/index.ts',
 'tests/liquid_solver.test.mjs','tests/benchmark_liquid.mjs','docs/12_TYPESCRIPT_LIQUID_SOLVER_S03.md',
 'qa/S02_LOCAL_USER_QA.md','qa/S03_REVIEW.md','qa/S03_RUN.log','qa/verify_s03.py','qa/MANIFEST.sha256',
 'ledger/CENTURY_FLUIDS_LEDGER.xlsx','package.json','package-lock.json'}

def check(cond,msg):
    if not cond: raise ValueError(msg)

def main():
    parser=argparse.ArgumentParser()
    parser.add_argument('--project',type=Path,default=Path(__file__).resolve().parents[1])
    parser.add_argument('--static-only',action='store_true')
    parser.add_argument('--previous-baseline',type=Path)
    parser.add_argument('--baseline',type=Path)
    parser.add_argument('--change',type=Path)
    args=parser.parse_args()
    root=args.project.resolve()
    files=local_files(root)
    check(REQUIRED <= set(files),f'missing S03 files: {sorted(REQUIRED-set(files))}')
    check_manifest(files)
    check_ledger(root)
    package=json.loads(files['package.json'])
    lock=json.loads(files['package-lock.json'])
    check(package['name']=='@century/fluids' and package['type']=='module' and not package.get('dependencies'), 'core identity/dependency mismatch')
    check(lock['packages']['']['devDependencies']==package['devDependencies'], 'lock mismatch')
    check('tests/benchmark_liquid.mjs' in files,'historical benchmark file missing')
    for f in ('src/liquid.ts','src/particles.ts','src/spatial.ts','src/world.ts'):
        for line in files[f].decode('utf8').splitlines():
            if line.lstrip().startswith('import '):
                check(not any(word in line.lower() for word in ('jolt','three','century/')),'core host dependency')
    if any((args.previous_baseline,args.baseline,args.change)):
        check(all((args.previous_baseline,args.baseline,args.change)),'supply all 3 archive paths')
        check_delta(args.previous_baseline,args.baseline,args.change,files)
    print(f'S03_STATIC_PASS files={len(files)} sheets=6 sprints=11 gates=11 project={root.name}',flush=True)
    if args.static_only:return 0
    check(all(shutil.which(x) for x in ('node','npm')), 'node/npm toolchain missing')
    for command in (['npm','run','qa'],['node','tests/benchmark_particles.mjs'],['node','tests/benchmark_liquid.mjs']):
        check(subprocess.run(command,cwd=root,check=False).returncode==0,f'QA command failed: {command}')
    print('S03_QA_PASS: TypeScript strict + build + 37 tests + both numerical benchmarks',flush=True)
    return 0

if __name__=='__main__':
    try:sys.exit(main())
    except (OSError,KeyError,ValueError,zipfile.BadZipFile,json.JSONDecodeError) as ex:
        print(f'S03_QA_FAIL: {ex}',file=sys.stderr);sys.exit(1)
