#!/usr/bin/env python3
"""S09 integral QA: inspect independent fluids playground and CPU/stress; optional real Jolt/browser build.

AUTHOR PASS != BROWSER PASS; graphical interaction/GPU/Jolt WASM-in-browser require human QA.
"""
from __future__ import annotations
import argparse
import json
from pathlib import Path
import subprocess
import shutil
import sys
import zipfile
from verify_s01 import check_manifest,check_ledger,local_files
from verify_s02 import check_delta
from verify_s06 import read_gate

GATE='CENTURY-FLUIDS-S09-G001-INTEGRAL-PERFORMANCE-AND-STABILITY'
REQUIRED={
 'docs/18_CF_CA_004_FLUIDS_PLAYGROUND_GENERALIZATION.md',
 'docs/19_S09_FLUIDS_PLAYGROUND_QA_AND_CONTINUITY.md',
 'qa/S09_REVIEW.md','qa/S09_RUN.log','qa/verify_s09.py',
 'playground/package.json','playground/index.html','playground/src/main.mjs',
 'playground/src/style.css','playground/src/fluids.mjs','playground/src/scenarios.mjs',
 'playground/src/clock.mjs','playground/src/simulation.mjs','playground/src/renderer.mjs',
 'playground/src/jolt-runtime.mjs','tests/run_playground.mjs',
 'tests/benchmark_playground.mjs','tests/verify_playground_consumer.mjs','tests/playground_s09.test.mjs',
 'ledger/CENTURY_FLUIDS_LEDGER.xlsx','qa/MANIFEST.sha256',
}

def check(ok:bool,message:str)->None:
 if not ok:raise ValueError(message)

def run(root:Path,command:list[str])->None:
 print('QA_RUN',' '.join(command),flush=True)
 proc=subprocess.run(command,cwd=root,check=False)
 check(proc.returncode==0,f'command failed exit={proc.returncode}: {" ".join(command)}')

def main()->int:
 p=argparse.ArgumentParser()
 p.add_argument('--project',type=Path,default=Path(__file__).resolve().parents[1])
 p.add_argument('--static-only',action='store_true')
 p.add_argument('--jolt',action='store_true',help='Run REAL Jolt 1.1.0 Node/WASM lab (not browser)')
 p.add_argument('--browser-build',action='store_true',help='Install pinned isolated consumer and execute Vite production build; NOT browser GUI QA')
 p.add_argument('--previous-baseline',type=Path)
 p.add_argument('--baseline',type=Path)
 p.add_argument('--change',type=Path)
 a=p.parse_args();root=a.project.resolve();files=local_files(root)
 check(REQUIRED<=set(files),f'missing S09 files: {sorted(REQUIRED-set(files))}')
 check_manifest(files);check_ledger(root)
 check(read_gate(root,14)==GATE,'wrong S09 Gate: existing 11 main Gates may not be renumbered')
 check(read_gate(root,12)=='CENTURY-FLUIDS-S07-G001-INTEGRAL-FLUID-SURFACE-EXTRACTION','S07 Gate renamed')
 check(read_gate(root,13)=='CENTURY-FLUIDS-S08-G001-INTEGRAL-CENTURY-EDITOR-RUNTIME-INTEGRATION','S08 paused gate renamed')
 doc=files['docs/18_CF_CA_004_FLUIDS_PLAYGROUND_GENERALIZATION.md'].decode()
 check('RATIFICADO' in doc and 'fluido' in doc.lower() and 'EN PAUSA' in doc,'CF-CA-004 not ratified or S08 pause lost')
 base=json.loads(files['package.json']);lock=json.loads(files['package-lock.json'])
 pmanifest=json.loads(files['playground/package.json'])
 check(not base.get('dependencies'),'Three/Jolt/Vite contaminated core dependencies')
 check(base['devDependencies']==lock['packages']['']['devDependencies'],'root package-lock changed inconsistently')
 check(pmanifest['private'] and pmanifest['name']=='century-fluids-playground','playground must be isolated and private')
 check(pmanifest['dependencies']['@century/fluids']=='file:./.local/century-fluids-0.1.0.tgz','playground must consume tarball, not source')
 check(pmanifest['dependencies']['jolt-physics']=='1.1.0','Jolt not pinned to 1.1.0')
 check(pmanifest['dependencies']['three']=='0.186.0' and pmanifest['devDependencies']['vite']=='8.3.8','browser dependencies not pinned')
 check(base['scripts'].get('playground')=='node tests/run_playground.mjs','S09 runner missing')
 check('tests/run_playground.mjs' in files,'S09 preparation helper missing')
 for f in ('src/index.ts','src/world.ts','src/liquid.ts','src/fluids/water/index.ts','src/surface/mesh.ts','src/adapters/jolt.ts'):
  source=files[f].decode()
  check('from \'three\'' not in source and "from 'vite'" not in source,'render/browser dependency in physical module '+f)
 check('JoltFluidBridge' in files['playground/src/simulation.mjs'].decode(),'S09 did not consume existing Jolt bridge')
 check('new FluidWorld' not in files['playground/src/renderer.mjs'].decode(),'renderer became owner of solver')
 check('FLUID_TYPES' in files['playground/src/fluids.mjs'].decode(),'specialization registry missing')
 check('S09_BROWSER_READY' in files['playground/src/main.mjs'].decode(),'browser readiness marker absent')
 if any((a.previous_baseline,a.baseline,a.change)):
  check(all((a.previous_baseline,a.baseline,a.change)),'provide baseline and change and previous baseline')
  check_delta(a.previous_baseline,a.baseline,a.change,files)
 print(f'S09_STATIC_PASS files={len(files)} sheets=6 sprints=11 gates=11 project={root.name}',flush=True)
 if a.static_only:return 0
 check(shutil.which('node') and shutil.which('npm'),'Node/npm missing')
 if a.jolt:
  check((root/'tests/jolt-real/node_modules/jolt-physics/package.json').exists(),
    'S09_JOLT_WASM_BLOCKED: npm install --prefix tests/jolt-real --no-save --package-lock=false --ignore-scripts --no-audit --no-fund')
 for command in [
  ['npm','run','qa'],
  ['node','tests/verify_distribution.mjs'],
  ['node','tests/run_vite_qa.mjs','--prepare-only'],
  ['node','tests/run_playground.mjs','--prepare-only'],
  ['node','tests/verify_playground_consumer.mjs'],
  # S02–S04 and S07 benchmarks are archival diagnostics, not mandatory current QA.
  # Current physical/performance benchmarks remain explicitly in CONT-005 QA.
  ['node','tests/benchmark_playground.mjs']]:run(root,command)
 print('S09_AUTHOR_QA_PASS browser_GUI=NOT_VERIFIED browser_JOLT_WASM=NOT_VERIFIED',flush=True)
 if a.jolt:
  run(root,['node','--test','tests/jolt-real/real_jolt.test.mjs'])
  print('S09_JOLT_NODE_WASM_QA_PASS (not browser integration)',flush=True)
 if a.browser_build:
  run(root,['node','tests/run_playground.mjs','--build'])
  print('S09_BROWSER_BUILD_PASS GUI=NOT_VERIFIED',flush=True)
 print('S09_QA_COMPLETE_FOR_SELECTED_OPTIONS browser_visual_approval=PENDING',flush=True)
 return 0

if __name__=='__main__':
 try:sys.exit(main())
 except (OSError,ValueError,KeyError,zipfile.BadZipFile,json.JSONDecodeError) as e:
  print('S09_QA_FAIL:',e,file=sys.stderr);sys.exit(1)
