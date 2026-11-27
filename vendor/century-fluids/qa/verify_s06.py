#!/usr/bin/env python3
"""S06: audit, test and optional REAL Jolt WASM acceptance (no mock acceptance).

Default QA performs core + bridge structural-port regression. --jolt MUST execute real
pinned JoltPhysics.js in tests/jolt-real/node_modules; absent dependency is a failure.
"""
from __future__ import annotations
import argparse
import json
import shutil
import subprocess
import sys
import zipfile
from pathlib import Path
from verify_s01 import local_files, check_manifest, check_ledger
from verify_s02 import check_delta

GATE='CENTURY-FLUIDS-S06-G001-INTEGRAL-JOLT-BIDIRECTIONAL-COUPLING'
REQUIRED={
 'src/adapters/jolt.ts','src/rotation.ts','src/world.ts','src/contacts.ts',
 'docs/15_JOLT_BIDIRECTIONAL_S06.md','tests/jolt_bridge.test.mjs',
 'tests/jolt-real/package.json','tests/jolt-real/real_jolt.test.mjs',
 'qa/verify_s06.py','qa/S06_REVIEW.md','qa/S06_RUN.log',
 'qa/MANIFEST.sha256','ledger/CENTURY_FLUIDS_LEDGER.xlsx',
}

def check(ok:bool,message:str)->None:
 if not ok:raise ValueError(message)

def read_gate(root:Path,row:int)->str:
 import xml.etree.ElementTree as ET
 with zipfile.ZipFile(root/'ledger/CENTURY_FLUIDS_LEDGER.xlsx') as z:
  ns={'x':'http://schemas.openxmlformats.org/spreadsheetml/2006/main'}
  sheet=ET.fromstring(z.read('xl/worksheets/sheet4.xml'))
  shared=[]
  if 'xl/sharedStrings.xml' in z.namelist():
   rootxml=ET.fromstring(z.read('xl/sharedStrings.xml'))
   shared=[''.join((e.text or '') for e in si.findall('.//x:t',ns)) for si in rootxml.findall('x:si',ns)]
  for c in sheet.findall('.//x:sheetData/x:row/x:c',ns):
   if c.get('r')!=f'A{row}': continue
   if c.get('t')=='inlineStr':return ''.join((e.text or '') for e in c.findall('.//x:t',ns))
   v=c.find('x:v',ns)
   return '' if v is None else (shared[int(v.text)] if c.get('t')=='s' else v.text or '')
 return ''

def run(root:Path,command:list[str])->None:
 print('QA_RUN',' '.join(command),flush=True)
 result=subprocess.run(command,cwd=root,check=False)
 check(result.returncode==0,f'QA command failed exit={result.returncode}: {command}')

def main()->int:
 ap=argparse.ArgumentParser()
 ap.add_argument('--project',type=Path,default=Path(__file__).resolve().parents[1])
 ap.add_argument('--static-only',action='store_true')
 ap.add_argument('--jolt',action='store_true',help='MANDATORY for S06 acceptance; actual pinned Jolt WASM, never substituted')
 ap.add_argument('--previous-baseline',type=Path)
 ap.add_argument('--baseline',type=Path)
 ap.add_argument('--change',type=Path)
 args=ap.parse_args();root=args.project.resolve()
 files=local_files(root)
 check(REQUIRED<=set(files),f'missing S06 files: {sorted(REQUIRED-set(files))}')
 check_manifest(files);check_ledger(root)
 check(read_gate(root,11)==GATE,f'wrong S06 ledger gate: {read_gate(root,11)}')
 check(read_gate(root,10)=='CENTURY-FLUIDS-S05-G001-INTEGRAL-TYPESCRIPT-DISTRIBUTION-AND-INTEROPERABILITY','S05 gate changed')
 pkg=json.loads(files['package.json']);lock=json.loads(files['package-lock.json'])
 lab=json.loads(files['tests/jolt-real/package.json'])
 check(pkg.get('dependencies') in (None,{}),'Jolt leaked into core runtime dependencies')
 check('jolt-physics' not in pkg['devDependencies'],'Jolt must stay in isolated lab')
 check(lock['packages']['']['devDependencies']==pkg['devDependencies'],'root npm lock out of sync')
 check(lab['dependencies']['jolt-physics']=='1.1.0','real WASM dependency not pinned')
 check(pkg['exports']['./adapters/jolt']['import']=='./dist/adapters/jolt.js','adapter export missing')
 check('tests/jolt-real/real_jolt.test.mjs' in files,'real Jolt WASM QA test missing')
 for f in ('src/world.ts','src/liquid.ts','src/contacts.ts','src/index.ts'):
  imports=[line.lower() for line in files[f].decode().splitlines() if line.startswith('import ')]
  check(not any('jolt-physics' in i or 'three' in i or 'century/' in i for i in imports),'core imports host backend')
 if any((args.previous_baseline,args.baseline,args.change)):
  check(all((args.previous_baseline,args.baseline,args.change)),'provide all three ZIP arguments')
  check_delta(args.previous_baseline,args.baseline,args.change,files)
 print(f'S06_STATIC_PASS files={len(files)} sheets=6 sprints=11 gates=11 project={root.name}',flush=True)
 if args.static_only:return 0
 check(all(shutil.which(t) for t in ('node','npm')),'Node/npm missing')
 if args.jolt:
  check((root/'tests/jolt-real/node_modules/jolt-physics/package.json').is_file(),
    'S06_REAL_WASM_BLOCKED: run npm install --prefix tests/jolt-real --no-save --package-lock=false --ignore-scripts --no-audit --no-fund first')
 run(root,['npm','run','qa'])
 run(root,['node','tests/verify_distribution.mjs'])
 run(root,['node','tests/run_vite_qa.mjs','--prepare-only'])
 for t in ('benchmark_particles.mjs','benchmark_liquid.mjs','benchmark_boundaries.mjs'):
  run(root,['node',f'tests/{t}'])
 print('S06_CORE_QA_PASS wasm=NOT_VERIFIED: structural port + TypeScript/Node + prior QA',flush=True)
 if args.jolt:
  run(root,['node','--test','tests/jolt-real/real_jolt.test.mjs'])
  print('S06_JOLT_WASM_QA_PASS: actual Jolt 1.1.0 and rigid body response verified',flush=True)
 return 0

if __name__=='__main__':
 try:sys.exit(main())
 except (OSError,KeyError,ValueError,zipfile.BadZipFile,json.JSONDecodeError) as e:
  print(f'S06_QA_FAIL: {e}',file=sys.stderr);sys.exit(1)
